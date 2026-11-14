/** GTR-14: account jobs sweeper. */

process.env.S3_BUCKET_IMAGES = 'images-bucket';
process.env.S3_BUCKET_EXPORTS = 'exports-bucket';
process.env.COGNITO_USER_POOL_ID = 'pool';
process.env.COGNITO_CLIENT_ID = 'client';

const { mockClient } = require('aws-sdk-client-mock');

jest.mock('../../src/lib/accountQueue', () => ({ enqueue: jest.fn() }));
jest.mock('../../src/lib/accountJobs', () => ({
  ...jest.requireActual('../../src/lib/accountJobs'),
  updateTombstone: jest.fn(),
}));

describe('sweeper (deletion rules)', () => {
  const { DynamoDBDocumentClient, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
  const ddb = mockClient(DynamoDBDocumentClient);
  let sweep;
  let queue;
  let jobs;

  beforeAll(() => {
    queue = require('../../src/lib/accountQueue');
    jobs = require('../../src/lib/accountJobs');
    sweep = require('../../src/handlers/account-jobs/sweep');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    ddb.reset();
    ddb.on(DeleteCommand).resolves({});
  });

  const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString();

  test('re-enqueues only stale, never-enqueued tombstones', async () => {
    ddb.on(ScanCommand).resolves({
      Items: [
        { userId: 'stale', job: 'deletion', status: 'requested', requestedAt: minutesAgo(30) },
        { userId: 'fresh', job: 'deletion', status: 'requested', requestedAt: minutesAgo(5) },
        { userId: 'enqueued', job: 'deletion', status: 'requested', requestedAt: minutesAgo(60), enqueuedAt: minutesAgo(59) },
        { userId: 'busy', job: 'deletion', status: 'processing', requestedAt: minutesAgo(300), enqueuedAt: minutesAgo(299) },
      ],
    });
    await sweep.run();
    expect(queue.enqueue).toHaveBeenCalledTimes(1);
    expect(queue.enqueue).toHaveBeenCalledWith({ type: 'deletion', userId: 'stale', pass: 1 }, 0);
    expect(jobs.updateTombstone).toHaveBeenCalledWith('stale', { enqueuedAt: expect.any(String) });
  });

  test('removes completed tombstones past their 7 h window, keeps the rest', async () => {
    const now = Math.floor(Date.now() / 1000);
    ddb.on(ScanCommand).resolves({
      Items: [
        { userId: 'old', job: 'deletion', status: 'completed', expiresAt: now - 1 },
        { userId: 'recent', job: 'deletion', status: 'completed', expiresAt: now + 3600 },
      ],
    });
    await sweep.run();
    const deleted = ddb.commandCalls(DeleteCommand).map((c) => c.args[0].input.Key.userId);
    expect(deleted).toEqual(['old']);
  });
});

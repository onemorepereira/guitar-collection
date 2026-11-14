/** GTR-14: account jobs sweeper. */
process.env.S3_BUCKET_EXPORTS = process.env.S3_BUCKET_EXPORTS || 'exports-bucket';

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

describe('sweeper (export rules)', () => {
  const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
  const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
  const ddb = mockClient(DynamoDBDocumentClient);
  const s3m = mockClient(S3Client);
  const queue = require('../../src/lib/accountQueue');
  const sweep = require('../../src/handlers/account-jobs/sweep');
  const DAY = 24 * 3600 * 1000;
  const ago = (ms) => new Date(Date.now() - ms).toISOString();
  const future = Math.floor(Date.now() / 1000) + 30 * 86400;

  beforeEach(() => {
    jest.clearAllMocks();
    ddb.reset();
    s3m.reset();
    ddb.on(UpdateCommand).resolves({});
    s3m.on(DeleteObjectCommand).resolves({});
  });

  test('re-enqueues stale pending exports, times out stuck ones, expires 7-day-old ZIPs', async () => {
    ddb.on(ScanCommand).resolves({
      Items: [
        { userId: 'u1', job: 'export#a', jobId: 'a', status: 'pending', createdAt: ago(20 * 60000), expiresAt: future },
        { userId: 'u2', job: 'export#b', jobId: 'b', status: 'processing', createdAt: ago(40 * 60000), startedAt: ago(30 * 60000), expiresAt: future },
        { userId: 'u3', job: 'export#c', jobId: 'c', status: 'ready', createdAt: ago(8 * DAY), expiresAt: future },
        { userId: 'u4', job: 'export#d', jobId: 'd', status: 'ready', createdAt: ago(2 * DAY), expiresAt: future },
        { userId: 'u5', job: 'export#e', jobId: 'e', status: 'pending', createdAt: ago(60000), expiresAt: future },
      ],
    });
    const tally = await sweep.run();
    expect(tally).toMatchObject({ export_reenqueued: 1, export_timed_out: 1, export_expired: 1 });
    expect(queue.enqueue).toHaveBeenCalledWith({ type: 'export', userId: 'u1', jobId: 'a' }, 0);
    expect(s3m.commandCalls(DeleteObjectCommand)[0].args[0].input.Key).toBe('exports/u3/c.zip');
    const statuses = ddb.commandCalls(UpdateCommand).map((c) => [c.args[0].input.Key.userId, c.args[0].input.ExpressionAttributeValues]);
    expect(statuses).toEqual(expect.arrayContaining([
      ['u2', expect.objectContaining({ ':from': 'processing' })],
      ['u3', expect.objectContaining({ ':from': 'ready' })],
    ]));
  });
});

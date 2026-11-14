/** GTR-14: two-pass account deletion worker. */

process.env.S3_BUCKET_IMAGES = 'images-bucket';
process.env.S3_BUCKET_EXPORTS = 'exports-bucket';
process.env.COGNITO_USER_POOL_ID = 'pool';
process.env.COGNITO_CLIENT_ID = 'client';

const { mockClient } = require('aws-sdk-client-mock');

jest.mock('../../src/lib/accountJobs', () => ({
  ...jest.requireActual('../../src/lib/accountJobs'),
  getTombstone: jest.fn(),
  updateTombstone: jest.fn(),
}));
jest.mock('../../src/lib/cognito', () => ({ globalSignOut: jest.fn(), deleteCognitoUser: jest.fn() }));
jest.mock('../../src/lib/cdn', () => ({ invalidate: jest.fn() }));
jest.mock('../../src/lib/accountQueue', () => ({ enqueue: jest.fn() }));
jest.mock('../../src/lib/audit', () => ({ logAccountEvent: jest.fn() }));

describe('deletion worker', () => {
  const { DynamoDBDocumentClient, QueryCommand, BatchWriteCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
  const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
  const ddb = mockClient(DynamoDBDocumentClient);
  const s3m = mockClient(S3Client);
  let worker;
  let jobs;
  let cognito;
  let cdn;
  let queue;
  const order = [];

  beforeAll(() => {
    jobs = require('../../src/lib/accountJobs');
    cognito = require('../../src/lib/cognito');
    cdn = require('../../src/lib/cdn');
    queue = require('../../src/lib/accountQueue');
    worker = require('../../src/handlers/account-jobs/deletion');
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    ddb.reset();
    s3m.reset();
    order.length = 0;
    jobs.getTombstone.mockResolvedValue({ userId: 'user-a', job: 'deletion', status: 'requested' });
    jobs.updateTombstone.mockImplementation(async (_u, f) => { order.push(`tombstone:${f.status || 'fields'}`); });
    cognito.globalSignOut.mockResolvedValue();
    cognito.deleteCognitoUser.mockImplementation(async () => { order.push('cognito:delete'); });
    cdn.invalidate.mockImplementation(async (paths) => { order.push(`cdn:${paths[0]}`); });
    queue.enqueue.mockResolvedValue();

    ddb.on(QueryCommand).callsFake((input) => {
      const t = input.TableName;
      if (/shares/.test(t)) return { Items: [{ userId: 'user-a', shareId: 's1' }, { userId: 'user-a', shareId: 's2' }] };
      if (/guitars/.test(t)) return { Items: [{ userId: 'user-a', guitarId: 'g1' }] };
      if (/account-jobs/.test(t)) return { Items: [{ userId: 'user-a', job: 'export#1' }] };
      return { Items: [] };
    });
    ddb.on(BatchWriteCommand).callsFake((input) => {
      order.push(`ddb:${Object.keys(input.RequestItems)[0]}`);
      return {};
    });
    ddb.on(DeleteCommand).callsFake((input) => { order.push(`ddb:${input.TableName}`); return {}; });
    s3m.on(ListObjectsV2Command).callsFake((input) => ({ Contents: [{ Key: `${input.Prefix}file` }], IsTruncated: false }));
    s3m.on(DeleteObjectsCommand).callsFake((input) => { order.push(`s3:${input.Delete.Objects[0].Key}`); return {}; });
  });

  afterEach(() => jest.useRealTimers());

  // Run the worker while flushing its pacing/backoff sleeps instantly
  async function runWorker(message) {
    const result = worker.run(message);
    result.catch(() => {});
    await jest.runAllTimersAsync();
    return result;
  }

  test('pass 1 deletes items, files, invalidates two wildcards, then enqueues pass 2; Cognito untouched', async () => {
    await runWorker({ userId: 'user-a', pass: 1 });
    const s3Keys = order.filter((o) => o.startsWith('s3:'));
    expect(s3Keys).toEqual([
      's3:images/user-a/file',
      's3:uploads/user-a/file',
      's3:shared/s1/file',
      's3:shared/s2/file',
      's3:exports/user-a/file',
    ]);
    expect(order).toContain('cdn:/images/user-a/*');
    expect(order).toContain('cdn:/shared/*');
    expect(cdn.invalidate).toHaveBeenCalledWith(['/images/user-a/*'], { strict: true });
    expect(queue.enqueue).toHaveBeenCalledWith({ type: 'deletion', userId: 'user-a', pass: 2 }, 900);
    expect(cognito.deleteCognitoUser).not.toHaveBeenCalled();
  });

  test('pass 2 repeats the cleanup, then deletes the Cognito user last and completes the tombstone with a 7 h expiry', async () => {
    await runWorker({ userId: 'user-a', pass: 2 });
    const cognitoAt = order.indexOf('cognito:delete');
    const lastData = Math.max(...order.map((o, i) => (/^(ddb|s3|cdn):/.test(o) ? i : -1)));
    expect(cognitoAt).toBeGreaterThan(lastData);
    expect(order[order.length - 1]).toBe('tombstone:completed');
    const completed = jobs.updateTombstone.mock.calls.find((c) => c[1].status === 'completed')[1];
    expect(completed.expiresAt - Math.floor(Date.parse(completed.completedAt) / 1000)).toBe(7 * 3600);
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  test('a completed (or missing) tombstone is a no-op (duplicate or late delivery)', async () => {
    jobs.getTombstone.mockResolvedValue({ status: 'completed' });
    await runWorker({ userId: 'user-a', pass: 2 });
    jobs.getTombstone.mockResolvedValue(null);
    await runWorker({ userId: 'user-a', pass: 1 });
    expect(order).toEqual([]);
  });

  test('UnprocessedItems are retried', async () => {
    let calls = 0;
    ddb.on(BatchWriteCommand).callsFake((input) => {
      calls += 1;
      const table = Object.keys(input.RequestItems)[0];
      return calls === 1 ? { UnprocessedItems: { [table]: input.RequestItems[table] } } : {};
    });
    await runWorker({ userId: 'user-a', pass: 1 });
    expect(calls).toBeGreaterThan(1);
  });

  test('CloudFront throttling backs off and retries', async () => {
    let n = 0;
    cdn.invalidate.mockImplementation(async () => {
      n += 1;
      if (n === 1) throw Object.assign(new Error('slow down'), { name: 'TooManyInvalidationsInProgress' });
    });
    await runWorker({ userId: 'user-a', pass: 1 });
    expect(n).toBe(3); // 1 throttled + 1 retry for /images, 1 for /shared
  });

  test('failures are rethrown (SQS retries → DLQ) and never delete the Cognito user', async () => {
    s3m.on(DeleteObjectsCommand).resolves({ Errors: [{ Key: 'k', Code: 'AccessDenied' }] });
    await expect(runWorker({ userId: 'user-a', pass: 2 })).rejects.toThrow(/AccessDenied/);
    expect(cognito.deleteCognitoUser).not.toHaveBeenCalled();
  });
});


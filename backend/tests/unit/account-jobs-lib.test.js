/**
 * lib/accountJobs: tombstone reads are strongly consistent, expired items are
 * treated as absent, and tombstone creation is idempotent (GTR-14).
 */

process.env.DYNAMODB_TABLE_ACCOUNT_JOBS = 'account-jobs-test';

const { mockClient } = require('aws-sdk-client-mock');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} = require('@aws-sdk/lib-dynamodb');

const ddb = mockClient(DynamoDBDocumentClient);
const jobs = require('../../src/lib/accountJobs');

const nowSec = () => Math.floor(Date.now() / 1000);

beforeEach(() => ddb.reset());

test('getTombstone uses a strongly consistent read on the deletion item', async () => {
  ddb.on(GetCommand).resolves({ Item: { userId: 'u', job: 'deletion', status: 'requested' } });
  await jobs.getTombstone('u');
  const input = ddb.commandCalls(GetCommand)[0].args[0].input;
  expect(input).toMatchObject({
    TableName: 'account-jobs-test',
    Key: { userId: 'u', job: 'deletion' },
    ConsistentRead: true,
  });
});

test.each([
  ['requested', undefined, true],
  ['processing', undefined, true],
  ['completed (within 7 h)', nowSec() + 3600, true],
  ['completed (expired)', nowSec() - 1, false],
])('isDeleting for %s tombstone → %s', async (_label, expiresAt, expected) => {
  ddb.on(GetCommand).resolves({ Item: { userId: 'u', job: 'deletion', status: 'x', expiresAt } });
  await expect(jobs.isDeleting('u')).resolves.toBe(expected);
});

test('isDeleting is false without a tombstone and for a missing user id', async () => {
  ddb.on(GetCommand).resolves({});
  await expect(jobs.isDeleting('u')).resolves.toBe(false);
  await expect(jobs.isDeleting(undefined)).resolves.toBe(false);
});

test('putTombstoneIfAbsent creates once, then returns the existing tombstone', async () => {
  ddb.on(PutCommand).resolvesOnce({}).rejectsOnce(Object.assign(new Error('exists'), { name: 'ConditionalCheckFailedException' }));
  ddb.on(GetCommand).resolves({ Item: { userId: 'u', job: 'deletion', status: 'requested', requestedAt: 't0' } });

  const first = await jobs.putTombstoneIfAbsent('u', 't0');
  expect(first.created).toBe(true);
  expect(ddb.commandCalls(PutCommand)[0].args[0].input.ConditionExpression).toBe('attribute_not_exists(userId)');

  const second = await jobs.putTombstoneIfAbsent('u', 't1');
  expect(second).toMatchObject({ created: false, tombstone: { requestedAt: 't0' } });
});

test('cancelActiveExports cancels only pending/processing jobs', async () => {
  ddb.on(QueryCommand).resolves({
    Items: [
      { userId: 'u', job: 'export#1', status: 'pending' },
      { userId: 'u', job: 'export#2', status: 'processing' },
      { userId: 'u', job: 'export#3', status: 'ready' },
    ],
  });
  ddb.on(UpdateCommand).resolves({});
  await jobs.cancelActiveExports('u');
  const keys = ddb.commandCalls(UpdateCommand).map((c) => c.args[0].input.Key.job);
  expect(keys).toEqual(['export#1', 'export#2']);
});

test('newJobId is time-sortable', () => {
  const now = jest.spyOn(Date, 'now');
  now.mockReturnValue(1_700_000_000_000);
  const a = jobs.newJobId();
  now.mockReturnValue(1_700_000_000_001);
  const b = jobs.newJobId();
  now.mockRestore();
  expect(a < b).toBe(true);
});

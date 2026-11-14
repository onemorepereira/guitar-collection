/**
 * Account jobs sweeper (every 15 minutes, GTR-14).
 *
 * Deletions:
 *   - a tombstone still `requested` with no `enqueuedAt` after 15 min (the
 *     enqueue failed) is re-enqueued. An enqueued deletion is never re-enqueued:
 *     retries are SQS's job, and exhausted ones go to the DLQ + alarm.
 *   - a `completed` tombstone past its `expiresAt` is deleted now, so the 7-hour
 *     window holds without waiting for DynamoDB TTL (which can take days).
 * Exports: see the export rules (slice 4).
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const { TABLES } = require('../../config/constants');
const { updateTombstone, nowSeconds, DELETION_SK } = require('../../lib/accountJobs');
const { enqueue } = require('../../lib/accountQueue');

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1', maxAttempts: 3 })
);

const STALE_REQUEST_MS = 15 * 60 * 1000;

async function scanAll() {
  const items = [];
  let ExclusiveStartKey;
  do {
    const result = await ddb.send(new ScanCommand({ TableName: TABLES.ACCOUNT_JOBS, ExclusiveStartKey }));
    items.push(...(result.Items || []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

async function sweepDeletion(item, now) {
  if (item.status === 'requested' && !item.enqueuedAt && now - Date.parse(item.requestedAt) > STALE_REQUEST_MS) {
    await enqueue({ type: 'deletion', userId: item.userId, pass: 1 }, 0);
    await updateTombstone(item.userId, { enqueuedAt: new Date(now).toISOString() });
    return 'reenqueued';
  }
  if (item.status === 'completed' && typeof item.expiresAt === 'number' && item.expiresAt < nowSeconds()) {
    await ddb.send(new DeleteCommand({ TableName: TABLES.ACCOUNT_JOBS, Key: { userId: item.userId, job: DELETION_SK } }));
    return 'expired_removed';
  }
  return null;
}

// Replaced by the export rules in slice 4
async function sweepExport() {
  return null;
}

async function run() {
  const now = Date.now();
  const tally = {};
  for (const item of await scanAll()) {
    const outcome = item.job === DELETION_SK ? await sweepDeletion(item, now) : await sweepExport(item, now);
    if (outcome) tally[outcome] = (tally[outcome] || 0) + 1;
  }
  console.log(JSON.stringify({ event: 'account_jobs_sweep', ...tally }));
  return tally;
}

module.exports = { run, sweepDeletion, sweepExport, STALE_REQUEST_MS };

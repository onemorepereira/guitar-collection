/**
 * Account jobs sweeper (every 15 minutes, GTR-14).
 *
 * Deletions:
 *   - a tombstone still `requested` with no `enqueuedAt` after 15 min (the
 *     enqueue failed) is re-enqueued. An enqueued deletion is never re-enqueued:
 *     retries are SQS's job, and exhausted ones go to the DLQ + alarm.
 *   - a `completed` tombstone past its `expiresAt` is deleted now, so the 7-hour
 *     window holds without waiting for DynamoDB TTL (which can take days).
 * Exports:
 *   - `pending` for more than 15 min → re-enqueue (enqueue failed or was lost);
 *   - `processing` for more than 20 min → `failed` (timeout; the worker died);
 *   - `ready` past createdAt + 7 days → delete the ZIP now and mark `expired`
 *     (exact 7-day removal; the bucket lifecycle rule is only the backstop).
 *     The content-free job record stays until its 30-day TTL.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const { TABLES } = require('../../config/constants');
const { updateTombstone, nowSeconds, transitionExport, isExpired, DELETION_SK, EXPORT_AVAILABLE_MS } = require('../../lib/accountJobs');
const { enqueue } = require('../../lib/accountQueue');

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1', maxAttempts: 3 })
);

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1', maxAttempts: 3 });

const STALE_REQUEST_MS = 15 * 60 * 1000;
const PROCESSING_TIMEOUT_MS = 20 * 60 * 1000;

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

async function sweepExport(item, now) {
  if (isExpired(item)) return null; // stub past its 30-day TTL; DynamoDB removes it
  const jobId = item.jobId || item.job.slice('export#'.length);
  if (item.status === 'pending' && now - Date.parse(item.createdAt) > STALE_REQUEST_MS) {
    await enqueue({ type: 'export', userId: item.userId, jobId }, 0);
    return 'export_reenqueued';
  }
  if (item.status === 'processing' && now - Date.parse(item.startedAt || item.createdAt) > PROCESSING_TIMEOUT_MS) {
    await transitionExport(item.userId, jobId, 'processing', 'failed', { reason: 'timeout' });
    return 'export_timed_out';
  }
  if (item.status === 'ready' && now >= Date.parse(item.createdAt) + EXPORT_AVAILABLE_MS) {
    await s3.send(new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET_EXPORTS,
      Key: `exports/${item.userId}/${jobId}.zip`,
    }));
    await transitionExport(item.userId, jobId, 'ready', 'expired');
    return 'export_expired';
  }
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

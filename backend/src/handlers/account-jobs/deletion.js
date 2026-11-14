/**
 * Account deletion worker (GTR-14).
 *
 * Two passes, both idempotent:
 *   pass 1: delete all of the user's items and files, invalidate the CDN, then
 *           re-enqueue pass 2 with the maximum SQS delay (15 min);
 *   pass 2: repeat the cleanup (catches anything written in between), then
 *           sign out + delete the Cognito user and complete the tombstone.
 * The Cognito user is deleted only after all data deletion succeeded. Any error
 * is rethrown so SQS retries (DLQ + alarm after 5 receives).
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, BatchWriteCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');

const { TABLES } = require('../../config/constants');
const { getTombstone, updateTombstone, epochSeconds, EXPORT_PREFIX } = require('../../lib/accountJobs');
const { globalSignOut, deleteCognitoUser } = require('../../lib/cognito');
const { invalidate } = require('../../lib/cdn');
const { enqueue } = require('../../lib/accountQueue');
const { logAccountEvent } = require('../../lib/audit');

const region = process.env.AWS_REGION || 'us-east-1';
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region, maxAttempts: 3 }));
const s3 = new S3Client({ region, maxAttempts: 3 });

const PASS_2_DELAY_SECONDS = 900; // SQS maximum
const TOMBSTONE_TTL_AFTER_COMPLETION_SECONDS = 7 * 3600; // > 6 h ID-token lifetime
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Tables keyed by userId, with their sort key (null = partition key only). */
function userTables() {
  return [
    { table: TABLES.GUITARS, sortKey: 'guitarId' },
    { table: TABLES.DOCUMENTS, sortKey: 'documentId' },
    { table: TABLES.PROVENANCE_REPORTS, sortKey: 'reportId' },
    { table: TABLES.SHARES, sortKey: 'shareId' },
  ];
}

async function queryKeys(table, userId, sortKey, extra = {}) {
  const keys = [];
  let ExclusiveStartKey;
  do {
    const result = await ddb.send(new QueryCommand({
      TableName: table,
      KeyConditionExpression: extra.condition || 'userId = :u',
      ExpressionAttributeValues: { ':u': userId, ...(extra.values || {}) },
      ProjectionExpression: sortKey === 'job' ? 'userId, job' : `userId, ${sortKey}`,
      ExclusiveStartKey,
    }));
    for (const item of result.Items || []) keys.push({ userId: item.userId, [sortKey]: item[sortKey] });
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return keys;
}

async function batchDelete(table, keys) {
  for (let i = 0; i < keys.length; i += 25) {
    let requests = keys.slice(i, i + 25).map((Key) => ({ DeleteRequest: { Key } }));
    for (let attempt = 0; requests.length > 0; attempt += 1) {
      if (attempt > 5) throw new Error(`BatchWrite left ${requests.length} unprocessed item(s) in ${table}`);
      if (attempt > 0) await sleep(100 * 2 ** (attempt - 1));
      const result = await ddb.send(new BatchWriteCommand({ RequestItems: { [table]: requests } }));
      requests = result.UnprocessedItems?.[table] || [];
    }
  }
  return keys.length;
}

async function deletePrefix(bucket, prefix) {
  let deleted = 0;
  let ContinuationToken;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken }));
    const objects = (page.Contents || []).map((o) => ({ Key: o.Key }));
    if (objects.length > 0) {
      const result = await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: objects } }));
      if (result?.Errors?.length) {
        throw new Error(`Failed to delete ${result.Errors.length} object(s) under ${prefix}: ${result.Errors[0].Code}`);
      }
      deleted += objects.length;
    }
    ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return deleted;
}

/** Invalidate with backoff on CloudFront throttling (1 wildcard/s quota). */
async function invalidateWithBackoff(path) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await invalidate([path], { strict: true });
      return;
    } catch (error) {
      const throttled = ['TooManyInvalidationsInProgress', 'Throttling', 'ThrottlingException'].includes(error.name);
      if (!throttled || attempt >= 5) throw error;
      await sleep(5000 * 2 ** attempt);
    }
  }
}

/** Delete every item and file of the user. Returns counts (no identifiers). */
async function deleteUserData(userId) {
  const counts = { items: 0, objects: 0 };

  // Collect share ids first: their renders live under shared/{shareId}/
  const shareKeys = await queryKeys(TABLES.SHARES, userId, 'shareId');
  const shareIds = shareKeys.map((k) => k.shareId);

  for (const { table, sortKey } of userTables()) {
    counts.items += await batchDelete(table, await queryKeys(table, userId, sortKey));
  }
  await ddb.send(new DeleteCommand({ TableName: TABLES.USERS, Key: { userId } }));

  const exportJobs = await queryKeys(TABLES.ACCOUNT_JOBS, userId, 'job', {
    condition: 'userId = :u AND begins_with(job, :p)',
    values: { ':p': EXPORT_PREFIX },
  });
  counts.items += await batchDelete(TABLES.ACCOUNT_JOBS, exportJobs);

  const images = process.env.S3_BUCKET_IMAGES;
  counts.objects += await deletePrefix(images, `images/${userId}/`);
  counts.objects += await deletePrefix(images, `uploads/${userId}/`);
  for (const shareId of shareIds) {
    counts.objects += await deletePrefix(images, `shared/${shareId}/`);
  }
  counts.objects += await deletePrefix(process.env.S3_BUCKET_EXPORTS, `exports/${userId}/`);

  // Exactly two wildcards regardless of share count (owner-approved):
  // /shared/* refreshes every user's share renders once, which is harmless.
  await invalidateWithBackoff(`/images/${userId}/*`);
  await sleep(1100);
  await invalidateWithBackoff('/shared/*');

  return counts;
}

async function run({ userId, pass = 1 }) {
  const tombstone = await getTombstone(userId);
  if (!tombstone || tombstone.status === 'completed') {
    console.log(JSON.stringify({ event: 'deletion_skipped', reason: tombstone ? 'completed' : 'no_tombstone', pass }));
    return;
  }

  let step = 'start';
  try {
    step = 'mark_processing';
    await updateTombstone(userId, { status: 'processing' });

    step = 'delete_data';
    const counts = await deleteUserData(userId);

    if (pass === 1) {
      step = 'enqueue_pass_2';
      await enqueue({ type: 'deletion', userId, pass: 2 }, PASS_2_DELAY_SECONDS);
      console.log(JSON.stringify({ event: 'deletion_pass_1_done', ...counts }));
      return;
    }

    step = 'cognito';
    await globalSignOut(userId);
    await deleteCognitoUser(userId);

    step = 'complete_tombstone';
    const completedAt = new Date().toISOString();
    await updateTombstone(userId, {
      status: 'completed',
      completedAt,
      expiresAt: epochSeconds(completedAt) + TOMBSTONE_TTL_AFTER_COMPLETION_SECONDS,
    });

    logAccountEvent(userId, 'DELETION_COMPLETED', 'SUCCESS', counts);
    console.log(JSON.stringify({ event: 'deletion_completed', ...counts }));
  } catch (error) {
    console.error(JSON.stringify({ event: 'deletion_failed', step, pass, error: error.name || 'Error' }));
    logAccountEvent(userId, 'DELETION_FAILED', 'FAILURE', { step, pass });
    throw error;
  }
}

module.exports = { run, deleteUserData, PASS_2_DELAY_SECONDS, TOMBSTONE_TTL_AFTER_COMPLETION_SECONDS };

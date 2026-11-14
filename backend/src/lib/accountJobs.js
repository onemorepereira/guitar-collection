/**
 * Account jobs: deletion tombstones and export jobs (AccountJobs table).
 *
 * Item shapes (PK userId, SK job):
 *   { userId, job: 'deletion', status: 'requested'|'processing'|'completed',
 *     requestedAt, enqueuedAt?, completedAt?, expiresAt? (epoch seconds) }
 *   { userId, job: 'export#<jobId>', status: 'pending'|'processing'|'ready'|
 *     'failed'|'cancelled'|'expired', createdAt, startedAt?, completedAt?,
 *     sizeBytes?, reason?, expiresAt (epoch seconds) }
 *
 * DynamoDB TTL removes expired items asynchronously (often days later), so
 * every read treats `expiresAt < now` as absent.
 */

const crypto = require('crypto');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} = require('@aws-sdk/lib-dynamodb');
const { TABLES } = require('../config/constants');

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1', maxAttempts: 3 }),
  { marshallOptions: { removeUndefinedValues: true } }
);

const DELETION_SK = 'deletion';
const EXPORT_PREFIX = 'export#';

const nowSeconds = () => Math.floor(Date.now() / 1000);
const epochSeconds = (iso) => Math.floor(Date.parse(iso) / 1000);

function isExpired(item) {
  return typeof item?.expiresAt === 'number' && item.expiresAt < nowSeconds();
}

/** Time-sortable job id: fixed-width base36 milliseconds + random suffix. */
function newJobId() {
  return `${Date.now().toString(36).padStart(9, '0')}-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Strongly consistent read: a request right after the deletion 202 must see
 * the tombstone. Returns null when missing or expired.
 */
async function getTombstone(userId) {
  const result = await client.send(new GetCommand({
    TableName: TABLES.ACCOUNT_JOBS,
    Key: { userId, job: DELETION_SK },
    ConsistentRead: true,
  }));
  const item = result.Item;
  if (!item || isExpired(item)) return null;
  return item;
}

/** True while a deletion is requested/processing, and for 7 h after it completes. */
async function isDeleting(userId) {
  if (!userId) return false;
  const tombstone = await getTombstone(userId);
  return Boolean(tombstone);
}

/**
 * Create the tombstone unless one exists. Returns { created, tombstone }.
 */
async function putTombstoneIfAbsent(userId, requestedAt = new Date().toISOString()) {
  const item = { userId, job: DELETION_SK, status: 'requested', requestedAt };
  try {
    await client.send(new PutCommand({
      TableName: TABLES.ACCOUNT_JOBS,
      Item: item,
      ConditionExpression: 'attribute_not_exists(userId)',
    }));
    return { created: true, tombstone: item };
  } catch (error) {
    if (error.name !== 'ConditionalCheckFailedException') throw error;
    const existing = await getTombstone(userId);
    return { created: false, tombstone: existing };
  }
}

function buildSet(fields) {
  const names = {};
  const values = {};
  const parts = Object.entries(fields).map(([key, value], i) => {
    names[`#f${i}`] = key;
    values[`:v${i}`] = value;
    return `#f${i} = :v${i}`;
  });
  return { expression: `SET ${parts.join(', ')}`, names, values };
}

async function updateTombstone(userId, fields) {
  const { expression, names, values } = buildSet(fields);
  await client.send(new UpdateCommand({
    TableName: TABLES.ACCOUNT_JOBS,
    Key: { userId, job: DELETION_SK },
    UpdateExpression: expression,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ConditionExpression: 'attribute_exists(userId)',
  }));
}

async function listExportJobs(userId) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const result = await client.send(new QueryCommand({
      TableName: TABLES.ACCOUNT_JOBS,
      KeyConditionExpression: 'userId = :u AND begins_with(job, :p)',
      ExpressionAttributeValues: { ':u': userId, ':p': EXPORT_PREFIX },
      ExclusiveStartKey,
    }));
    items.push(...(result.Items || []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

/** Mark the user's pending/processing exports cancelled (they then write nothing). */
async function cancelActiveExports(userId) {
  const jobs = await listExportJobs(userId);
  for (const job of jobs) {
    if (job.status !== 'pending' && job.status !== 'processing') continue;
    try {
      await client.send(new UpdateCommand({
        TableName: TABLES.ACCOUNT_JOBS,
        Key: { userId, job: job.job },
        UpdateExpression: 'SET #s = :c',
        ConditionExpression: '#s IN (:p, :r)',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':c': 'cancelled', ':p': 'pending', ':r': 'processing' },
      }));
    } catch (error) {
      if (error.name !== 'ConditionalCheckFailedException') throw error;
    }
  }
}

module.exports = {
  client,
  DELETION_SK,
  EXPORT_PREFIX,
  epochSeconds,
  nowSeconds,
  isExpired,
  newJobId,
  getTombstone,
  isDeleting,
  putTombstoneIfAbsent,
  updateTombstone,
  listExportJobs,
  cancelActiveExports,
};

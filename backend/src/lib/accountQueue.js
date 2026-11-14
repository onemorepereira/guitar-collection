/**
 * Enqueue account jobs (export / deletion) on AccountJobsQueue.
 */

const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');

const sqs = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1', maxAttempts: 3 });

/**
 * @param {object} message - e.g. { type: 'deletion', userId, pass: 1 }
 * @param {number} [delaySeconds=0] - SQS allows 0–900
 */
async function enqueue(message, delaySeconds = 0) {
  await sqs.send(new SendMessageCommand({
    QueueUrl: process.env.ACCOUNT_JOBS_QUEUE_URL,
    MessageBody: JSON.stringify(message),
    DelaySeconds: delaySeconds,
  }));
}

module.exports = { enqueue };

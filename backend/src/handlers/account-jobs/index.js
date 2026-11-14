/**
 * Account jobs worker (GTR-14).
 *
 * Invoked by:
 *   - SQS (AccountJobsQueue, BatchSize 1): { type: 'deletion' | 'export', ... }
 *   - EventBridge schedule every 15 min: raw input { type: 'sweep' }
 *
 * Deletion errors propagate so SQS retries them (then the DLQ + alarm).
 * Export failures are recorded on the job and never rethrown.
 */

const deletion = require('./deletion');
const exportJob = require('./export');
const sweep = require('./sweep');

async function dispatch(message) {
  switch (message?.type) {
    case 'deletion':
      return deletion.run(message);
    case 'export':
      return exportJob.run(message);
    case 'sweep':
      return sweep.run();
    default:
      console.error('Unknown account job type', { type: message?.type });
      return undefined;
  }
}

exports.handler = async (event) => {
  if (Array.isArray(event?.Records)) {
    for (const record of event.Records) {
      await dispatch(JSON.parse(record.body));
    }
    return;
  }
  // Schedule events pass the configured Input as the event itself
  await dispatch(event);
};

exports.dispatch = dispatch;

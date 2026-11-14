/**
 * POST /user/export — start a data export (GTR-14). Password-verified.
 *
 * Refused (429 EXPORT_RATE_LIMITED, with the existing job) while an export is
 * pending/processing, or within 1 hour of one becoming ready. Failed or
 * cancelled exports don't block a new one.
 */

const { getUserIdFromEvent, verifyPassword } = require('../../lib/cognito');
const { latestExportJob, createExportJob } = require('../../lib/accountJobs');
const { enqueue } = require('../../lib/accountQueue');
const { logAccountEvent } = require('../../lib/audit');
const { validateCSRF } = require('../../lib/csrf');
const { CodedError, handleError } = require('../../lib/errors');
const response = require('../../lib/response');
const { effectiveStatus, viewOf, RATE_LIMIT_AFTER_READY_MS } = require('./export-common');

function blockingUntil(job, now) {
  if (!job) return null;
  const { status } = effectiveStatus(job, now);
  if (status === 'pending' || status === 'processing') return 'now';
  if (status === 'ready' && job.completedAt) {
    const until = Date.parse(job.completedAt) + RATE_LIMIT_AFTER_READY_MS;
    if (now < until) return new Date(until).toISOString();
  }
  return null;
}

async function startExport(event) {
  let userId;
  try {
    validateCSRF(event);
    userId = await getUserIdFromEvent(event);

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      throw new CodedError(400, 'Invalid request body', 'INVALID_BODY');
    }

    try {
      await verifyPassword(userId, body.password);
    } catch (error) {
      logAccountEvent(userId, 'EXPORT_REQUESTED', 'DENIED', { code: error.code });
      throw error;
    }

    const now = Date.now();
    const latest = await latestExportJob(userId);
    const until = blockingUntil(latest, now);
    if (until) {
      logAccountEvent(userId, 'EXPORT_REQUESTED', 'DENIED', { code: 'EXPORT_RATE_LIMITED' });
      const message = until === 'now'
        ? 'An export is already being prepared.'
        : `You can start a new export after ${until}.`;
      throw new CodedError(429, message, 'EXPORT_RATE_LIMITED', {
        job: viewOf(latest, now),
        ...(until !== 'now' ? { retryAfter: until } : {}),
      });
    }

    const job = await createExportJob(userId);
    try {
      await enqueue({ type: 'export', userId, jobId: job.jobId });
    } catch (error) {
      console.error('Failed to enqueue export', { error: error.name });
      // The sweeper re-enqueues pending jobs older than 15 minutes
    }

    logAccountEvent(userId, 'EXPORT_REQUESTED', 'ALLOWED');
    return response.success(202, { jobId: job.jobId, status: 'pending' });
  } catch (error) {
    return handleError(error, response);
  }
}

module.exports = { startExport, blockingUntil };

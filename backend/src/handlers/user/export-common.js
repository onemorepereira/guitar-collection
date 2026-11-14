/**
 * Shared export-job view logic (GTR-14).
 */

const { EXPORT_AVAILABLE_MS, exportSummary } = require('../../lib/accountJobs');

const PROCESSING_TIMEOUT_MS = 20 * 60 * 1000;
const RATE_LIMIT_AFTER_READY_MS = 60 * 60 * 1000;

/**
 * The status a client sees for a stored job at time `now`.
 * - processing for more than 20 min → failed (timeout)
 * - cancelled (deletion requested mid-export) → failed (cancelled)
 * - ready/expired past createdAt + 7 days → expired
 */
function effectiveStatus(job, now = Date.now()) {
  if (!job) return { status: 'none' };
  const created = Date.parse(job.createdAt);
  switch (job.status) {
    case 'processing':
      if (now - Date.parse(job.startedAt || job.createdAt) > PROCESSING_TIMEOUT_MS) {
        return { status: 'failed', reason: 'timeout' };
      }
      return { status: 'processing' };
    case 'cancelled':
      return { status: 'failed', reason: 'cancelled' };
    case 'failed':
      return { status: 'failed', reason: job.reason || 'error' };
    case 'ready':
    case 'expired':
      return now >= created + EXPORT_AVAILABLE_MS ? { status: 'expired' } : { status: job.status };
    default:
      return { status: job.status };
  }
}

/** Client view: stored summary with the effective status applied. */
function viewOf(job, now = Date.now()) {
  const effective = effectiveStatus(job, now);
  const summary = exportSummary(job) || {};
  const view = { ...summary, ...effective };
  if (effective.status !== 'ready') delete view.availableUntil;
  if (effective.status !== 'failed') delete view.reason;
  return view;
}

module.exports = { effectiveStatus, viewOf, PROCESSING_TIMEOUT_MS, RATE_LIMIT_AFTER_READY_MS };

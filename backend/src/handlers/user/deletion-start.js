/**
 * POST /user/deletion — request account deletion (GTR-14).
 *
 * Password-verified. Writes the tombstone first (from then on every API call
 * with this user's tokens is rejected), revokes refresh tokens, cancels any
 * running export, and enqueues the deletion with a 120 s delay so in-flight
 * requests (Lambda timeouts ≤ 60 s) finish before data is deleted.
 *
 * Idempotent: a retry after a failed enqueue passes the tombstone check
 * (allowDeleting) and re-enqueues; the worker tolerates duplicates.
 */

const { getUserIdFromEvent, verifyPassword, globalSignOut } = require('../../lib/cognito');
const { putTombstoneIfAbsent, updateTombstone, cancelActiveExports } = require('../../lib/accountJobs');
const { enqueue } = require('../../lib/accountQueue');
const { logAccountEvent } = require('../../lib/audit');
const { validateCSRF } = require('../../lib/csrf');
const { CodedError, handleError } = require('../../lib/errors');
const response = require('../../lib/response');

const DELETION_DELAY_SECONDS = 120;

async function requestDeletion(event) {
  let userId;
  try {
    validateCSRF(event);
    userId = await getUserIdFromEvent(event, { allowDeleting: true });

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      throw new CodedError(400, 'Invalid request body', 'INVALID_BODY');
    }

    try {
      await verifyPassword(userId, body.password);
    } catch (error) {
      logAccountEvent(userId, 'DELETION_REQUESTED', 'DENIED', { code: error.code });
      throw error;
    }

    const { tombstone } = await putTombstoneIfAbsent(userId, new Date().toISOString());
    if (tombstone?.status === 'completed') {
      // Already deleted; nothing left to do (the account is gone)
      return response.success(202, { status: 'requested' });
    }

    try {
      await globalSignOut(userId);
    } catch (error) {
      // The tombstone blocks access anyway; the worker signs out again later
      console.error('Global sign-out failed during deletion request', { error: error.name });
    }

    await cancelActiveExports(userId);

    try {
      await enqueue({ type: 'deletion', userId, pass: 1 }, DELETION_DELAY_SECONDS);
    } catch (error) {
      console.error('Failed to enqueue account deletion', { error: error.name });
      throw new CodedError(503, 'Please try again', 'SERVICE_UNAVAILABLE');
    }
    await updateTombstone(userId, { enqueuedAt: new Date().toISOString() });

    logAccountEvent(userId, 'DELETION_REQUESTED', 'ALLOWED');
    return response.success(202, { status: 'requested' });
  } catch (error) {
    return handleError(error, response);
  }
}

module.exports = { requestDeletion, DELETION_DELAY_SECONDS };

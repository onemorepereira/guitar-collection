/** GTR-14: POST /user/deletion. */

jest.mock('../../src/lib/cognito', () => ({
  getUserIdFromEvent: jest.fn(),
  verifyPassword: jest.fn(),
  globalSignOut: jest.fn(),
}));
jest.mock('../../src/lib/accountJobs', () => ({
  putTombstoneIfAbsent: jest.fn(),
  updateTombstone: jest.fn(),
  cancelActiveExports: jest.fn(),
}));
jest.mock('../../src/lib/accountQueue', () => ({ enqueue: jest.fn() }));
jest.mock('../../src/lib/audit', () => ({ logAccountEvent: jest.fn() }));
jest.mock('../../src/lib/csrf', () => ({ validateCSRF: jest.fn() }));

describe('POST /user/deletion', () => {
  let requestDeletion;
  let cognito;
  let jobs;
  let queue;
  let audit;

  beforeAll(() => {
    cognito = require('../../src/lib/cognito');
    jobs = require('../../src/lib/accountJobs');
    queue = require('../../src/lib/accountQueue');
    audit = require('../../src/lib/audit');
    ({ requestDeletion } = require('../../src/handlers/user/deletion-start'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    cognito.getUserIdFromEvent.mockResolvedValue('user-a');
    cognito.verifyPassword.mockResolvedValue();
    cognito.globalSignOut.mockResolvedValue();
    jobs.putTombstoneIfAbsent.mockResolvedValue({ created: true, tombstone: { status: 'requested' } });
    jobs.updateTombstone.mockResolvedValue();
    jobs.cancelActiveExports.mockResolvedValue();
    queue.enqueue.mockResolvedValue();
  });

  const ev = (body) => ({ headers: {}, body: JSON.stringify(body) });

  test('happy path: tombstone, sign-out, cancel exports, delayed enqueue, enqueuedAt, 202', async () => {
    const res = await requestDeletion(ev({ password: 'pw' }));
    expect(res.statusCode).toBe(202);
    expect(cognito.getUserIdFromEvent).toHaveBeenCalledWith(expect.anything(), { allowDeleting: true });
    expect(jobs.putTombstoneIfAbsent).toHaveBeenCalledWith('user-a', expect.any(String));
    expect(cognito.globalSignOut).toHaveBeenCalledWith('user-a');
    expect(jobs.cancelActiveExports).toHaveBeenCalledWith('user-a');
    expect(queue.enqueue).toHaveBeenCalledWith({ type: 'deletion', userId: 'user-a', pass: 1 }, 120);
    expect(jobs.updateTombstone).toHaveBeenCalledWith('user-a', { enqueuedAt: expect.any(String) });
    expect(audit.logAccountEvent).toHaveBeenCalledWith('user-a', 'DELETION_REQUESTED', 'ALLOWED');
  });

  test('wrong password: 401 with code, audited as DENIED, nothing written', async () => {
    const { CodedError } = require('../../src/lib/errors');
    cognito.verifyPassword.mockRejectedValue(new CodedError(401, "That password isn't right.", 'WRONG_PASSWORD'));
    const res = await requestDeletion(ev({ password: 'nope' }));
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('WRONG_PASSWORD');
    expect(audit.logAccountEvent).toHaveBeenCalledWith('user-a', 'DELETION_REQUESTED', 'DENIED', { code: 'WRONG_PASSWORD' });
    expect(jobs.putTombstoneIfAbsent).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  test('lockout: 429 TOO_MANY_ATTEMPTS', async () => {
    const { CodedError } = require('../../src/lib/errors');
    cognito.verifyPassword.mockRejectedValue(new CodedError(429, 'Too many attempts.', 'TOO_MANY_ATTEMPTS'));
    const res = await requestDeletion(ev({ password: 'x' }));
    expect(res.statusCode).toBe(429);
    expect(JSON.parse(res.body).code).toBe('TOO_MANY_ATTEMPTS');
  });

  test('retry with an existing tombstone re-enqueues (idempotent)', async () => {
    jobs.putTombstoneIfAbsent.mockResolvedValue({ created: false, tombstone: { status: 'requested' } });
    const res = await requestDeletion(ev({ password: 'pw' }));
    expect(res.statusCode).toBe(202);
    expect(queue.enqueue).toHaveBeenCalledTimes(1);
  });

  test('a repeat request for an already-queued deletion does not re-enqueue', async () => {
    jobs.putTombstoneIfAbsent.mockResolvedValue({ created: false, tombstone: { status: 'processing', enqueuedAt: 't' } });
    const res = await requestDeletion(ev({ password: 'pw' }));
    expect(res.statusCode).toBe(202);
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  test('enqueue failure → 503, and no enqueuedAt (the sweeper retries)', async () => {
    queue.enqueue.mockRejectedValue(new Error('sqs down'));
    const res = await requestDeletion(ev({ password: 'pw' }));
    expect(res.statusCode).toBe(503);
    expect(jobs.updateTombstone).not.toHaveBeenCalled();
  });

  test('sign-out failure does not stop the request', async () => {
    cognito.globalSignOut.mockRejectedValue(new Error('cognito blip'));
    const res = await requestDeletion(ev({ password: 'pw' }));
    expect(res.statusCode).toBe(202);
    expect(queue.enqueue).toHaveBeenCalled();
  });
});


/** GTR-14: POST /user/export and GET /user/export. */

process.env.S3_BUCKET_EXPORTS = 'exports-bucket';

jest.mock('../../src/lib/cognito', () => ({
  getUserIdFromEvent: jest.fn(),
  verifyPassword: jest.fn(),
}));
jest.mock('../../src/lib/accountJobs', () => ({
  ...jest.requireActual('../../src/lib/accountJobs'),
  latestExportJob: jest.fn(),
  createExportJob: jest.fn(),
}));
jest.mock('../../src/lib/accountQueue', () => ({ enqueue: jest.fn() }));
jest.mock('../../src/lib/audit', () => ({ logAccountEvent: jest.fn() }));
jest.mock('../../src/lib/csrf', () => ({ validateCSRF: jest.fn() }));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.example/export.zip'),
}));

const cognito = require('../../src/lib/cognito');
const jobs = require('../../src/lib/accountJobs');
const queue = require('../../src/lib/accountQueue');
const audit = require('../../src/lib/audit');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { CodedError } = require('../../src/lib/errors');
const { startExport } = require('../../src/handlers/user/export-start');
const { exportStatus } = require('../../src/handlers/user/export-status');

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const ago = (ms) => new Date(Date.now() - ms).toISOString();
const job = (fields) => ({ userId: 'user-a', job: 'export#j1', jobId: 'j1', createdAt: ago(10 * 60 * 1000), ...fields });
const post = (body) => ({ headers: {}, body: JSON.stringify(body) });

beforeEach(() => {
  jest.clearAllMocks();
  cognito.getUserIdFromEvent.mockResolvedValue('user-a');
  cognito.verifyPassword.mockResolvedValue();
  jobs.latestExportJob.mockResolvedValue(null);
  jobs.createExportJob.mockResolvedValue({ jobId: 'new-job', status: 'pending' });
  queue.enqueue.mockResolvedValue();
});

describe('POST /user/export', () => {
  test('happy path: creates and enqueues a job, 202 pending', async () => {
    const res = await startExport(post({ password: 'pw' }));
    expect(res.statusCode).toBe(202);
    expect(JSON.parse(res.body)).toEqual({ jobId: 'new-job', status: 'pending' });
    expect(queue.enqueue).toHaveBeenCalledWith({ type: 'export', userId: 'user-a', jobId: 'new-job' });
    expect(audit.logAccountEvent).toHaveBeenCalledWith('user-a', 'EXPORT_REQUESTED', 'ALLOWED');
  });

  test('wrong password → 401 WRONG_PASSWORD, audited DENIED, no job', async () => {
    cognito.verifyPassword.mockRejectedValue(new CodedError(401, "That password isn't right.", 'WRONG_PASSWORD'));
    const res = await startExport(post({ password: 'nope' }));
    expect(res.statusCode).toBe(401);
    expect(audit.logAccountEvent).toHaveBeenCalledWith('user-a', 'EXPORT_REQUESTED', 'DENIED', { code: 'WRONG_PASSWORD' });
    expect(jobs.createExportJob).not.toHaveBeenCalled();
  });

  test('lockout → 429 TOO_MANY_ATTEMPTS', async () => {
    cognito.verifyPassword.mockRejectedValue(new CodedError(429, 'Too many attempts.', 'TOO_MANY_ATTEMPTS'));
    const res = await startExport(post({ password: 'x' }));
    expect(res.statusCode).toBe(429);
    expect(JSON.parse(res.body).code).toBe('TOO_MANY_ATTEMPTS');
  });

  describe('rate limit (AC9) returns the existing job even in prod', () => {
    const ORIGINAL = process.env.NODE_ENV;
    beforeEach(() => { process.env.NODE_ENV = 'prod'; });
    afterEach(() => { process.env.NODE_ENV = ORIGINAL; });

    test.each([
      ['pending', job({ status: 'pending' })],
      ['processing (recent)', job({ status: 'processing', startedAt: ago(5 * 60 * 1000) })],
      ['ready less than 1 h ago', job({ status: 'ready', completedAt: ago(20 * 60 * 1000), sizeBytes: 10 })],
    ])('%s → 429 EXPORT_RATE_LIMITED with job', async (_l, existing) => {
      jobs.latestExportJob.mockResolvedValue(existing);
      const res = await startExport(post({ password: 'pw' }));
      expect(res.statusCode).toBe(429);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('EXPORT_RATE_LIMITED');
      expect(body.job.jobId).toBe('j1');
      expect(jobs.createExportJob).not.toHaveBeenCalled();
      expect(audit.logAccountEvent).toHaveBeenCalledWith('user-a', 'EXPORT_REQUESTED', 'DENIED', { code: 'EXPORT_RATE_LIMITED' });
    });
  });

  test.each([
    ['failed', job({ status: 'failed', reason: 'error' })],
    ['cancelled', job({ status: 'cancelled' })],
    ['processing stuck > 20 min (timeout)', job({ status: 'processing', startedAt: ago(30 * 60 * 1000) })],
    ['ready more than 1 h ago', job({ status: 'ready', completedAt: ago(2 * HOUR) })],
  ])('%s does not block a new export', async (_l, existing) => {
    jobs.latestExportJob.mockResolvedValue(existing);
    const res = await startExport(post({ password: 'pw' }));
    expect(res.statusCode).toBe(202);
  });

  test('an enqueue failure still creates the job (the sweeper re-enqueues)', async () => {
    queue.enqueue.mockRejectedValue(new Error('sqs down'));
    const res = await startExport(post({ password: 'pw' }));
    expect(res.statusCode).toBe(202);
  });
});

describe('GET /user/export', () => {
  const get = () => ({ headers: {} });

  test('no export → 404 status none', async () => {
    const res = await exportStatus(get());
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toEqual({ status: 'none' });
  });

  test('ready within 7 days → fresh 1-hour link for the caller\'s own ZIP, audited', async () => {
    jobs.latestExportJob.mockResolvedValue(job({ status: 'ready', completedAt: ago(HOUR), sizeBytes: 1234 }));
    const res = await exportStatus(get());
    const body = JSON.parse(res.body);
    expect(res.statusCode).toBe(200);
    expect(body).toMatchObject({ status: 'ready', downloadUrl: 'https://signed.example/export.zip', sizeBytes: 1234 });
    expect(body.availableUntil).toBeDefined();
    const [, command, options] = getSignedUrl.mock.calls[0];
    expect(command.input).toMatchObject({ Bucket: 'exports-bucket', Key: 'exports/user-a/j1.zip' });
    expect(command.input.ResponseContentDisposition).toMatch(/attachment; filename="guitar-collection-export-\d{4}-\d{2}-\d{2}\.zip"/);
    expect(options).toEqual({ expiresIn: 3600 });
    expect(audit.logAccountEvent).toHaveBeenCalledWith('user-a', 'EXPORT_LINK_ISSUED', 'SUCCESS');
  });

  test('ready but older than 7 days → expired, no link', async () => {
    jobs.latestExportJob.mockResolvedValue(job({ status: 'ready', createdAt: ago(8 * DAY), completedAt: ago(8 * DAY) }));
    const body = JSON.parse((await exportStatus(get())).body);
    expect(body.status).toBe('expired');
    expect(body.downloadUrl).toBeUndefined();
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  test.each([
    ['cancelled', job({ status: 'cancelled' }), { status: 'failed', reason: 'cancelled' }],
    ['failed too large', job({ status: 'failed', reason: 'too_large' }), { status: 'failed', reason: 'too_large' }],
    ['processing stuck', job({ status: 'processing', startedAt: ago(30 * 60 * 1000) }), { status: 'failed', reason: 'timeout' }],
    ['processing', job({ status: 'processing', startedAt: ago(60 * 1000) }), { status: 'processing' }],
  ])('%s → %o', async (_l, stored, expected) => {
    jobs.latestExportJob.mockResolvedValue(stored);
    expect(JSON.parse((await exportStatus(get())).body)).toMatchObject(expected);
  });

  test('only the caller\'s own latest job is looked up', async () => {
    await exportStatus(get());
    expect(jobs.latestExportJob).toHaveBeenCalledWith('user-a');
  });
});

/** GTR-14: export worker builds a ZIP of data.json + files, streamed to S3. */

process.env.S3_BUCKET_IMAGES = 'images-bucket';
process.env.S3_BUCKET_EXPORTS = 'exports-bucket';

const { Readable } = require('stream');
const AdmZip = require('adm-zip');
const { mockClient } = require('aws-sdk-client-mock');
const {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} = require('@aws-sdk/client-s3');

jest.mock('../../src/lib/dynamodb', () => ({ queryAll: jest.fn() }));
jest.mock('../../src/lib/accountJobs', () => ({
  transitionExport: jest.fn(),
  isDeleting: jest.fn(),
}));
jest.mock('../../src/lib/cognito', () => ({ getCognitoUser: jest.fn() }));
jest.mock('../../src/lib/audit', () => ({ logAccountEvent: jest.fn() }));

const dynamodb = require('../../src/lib/dynamodb');
const jobs = require('../../src/lib/accountJobs');
const cognito = require('../../src/lib/cognito');
const audit = require('../../src/lib/audit');
const worker = require('../../src/handlers/account-jobs/export');

const s3m = mockClient(S3Client);
let uploadedBytes;

function captureUpload() {
  uploadedBytes = [];
  // Small ZIPs go up as a single PutObject; large ones as multipart
  s3m.on(PutObjectCommand).callsFake(async (input) => { uploadedBytes.push(await toBuffer(input.Body)); return {}; });
  s3m.on(CreateMultipartUploadCommand).resolves({ UploadId: 'u1' });
  s3m.on(UploadPartCommand).callsFake(async (input) => { uploadedBytes.push(await toBuffer(input.Body)); return { ETag: 'e' }; });
  s3m.on(CompleteMultipartUploadCommand).resolves({});
  s3m.on(AbortMultipartUploadCommand).resolves({});
}

async function toBuffer(body) {
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (typeof body === 'string') return Buffer.from(body);
  const chunks = [];
  for await (const c of body) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks);
}

const files = {
  'images/user-a/strat.jpg': Buffer.from('JPEGDATA-strat'),
  'images/user-a/receipt.pdf': Buffer.from('%PDF-receipt'),
  'shared/s1/render.jpg': Buffer.from('JPEGDATA-render'),
};

beforeEach(() => {
  jest.clearAllMocks();
  s3m.reset();
  captureUpload();
  jobs.transitionExport.mockResolvedValue(true);
  jobs.isDeleting.mockResolvedValue(false);
  cognito.getCognitoUser.mockResolvedValue({ userId: 'user-a', email: 'a@example.com', emailVerified: true, name: 'A', createdAt: '2025-01-01T00:00:00.000Z' });
  dynamodb.queryAll.mockImplementation(async (table) => {
    if (/users/.test(table)) return [{ userId: 'user-a', name: 'A' }];
    if (/guitars/.test(table)) return [{ userId: 'user-a', guitarId: 'g1', brand: 'Fender', privateInfo: { purchasePrice: 100 }, notes: [{ content: 'n' }] }];
    if (/documents/.test(table)) return [{ userId: 'user-a', documentId: 'd1', extractedContent: { text: 'hi' } }];
    if (/provenance/.test(table)) return [];
    if (/shares/.test(table)) return [{ userId: 'user-a', shareId: 's1', views: [{ country: 'US' }] }];
    return [];
  });
  s3m.on(ListObjectsV2Command).callsFake((input) => ({
    Contents: Object.keys(files).filter((k) => k.startsWith(input.Prefix)).map((Key) => ({ Key, Size: files[Key].length })),
    IsTruncated: false,
  }));
  s3m.on(GetObjectCommand).callsFake((input) => ({ Body: Readable.from([files[input.Key]]) }));
  s3m.on(DeleteObjectCommand).resolves({});
});

function readZip() {
  return new AdmZip(Buffer.concat(uploadedBytes));
}

test('ZIP holds data.json (schema v1, every record) and every file at its zipPath', async () => {
  await worker.run({ userId: 'user-a', jobId: 'j1' });

  const zip = readZip();
  const names = zip.getEntries().map((e) => e.entryName).sort();
  expect(names).toEqual([
    'data.json',
    'files/images/user-a/receipt.pdf',
    'files/images/user-a/strat.jpg',
    'files/shared/s1/render.jpg',
  ]);
  expect(zip.readFile('files/images/user-a/strat.jpg').toString()).toBe('JPEGDATA-strat');

  const data = JSON.parse(zip.readAsText('data.json'));
  expect(data.schemaVersion).toBe(1);
  expect(data.account).toMatchObject({ userId: 'user-a', email: 'a@example.com', emailVerified: true });
  expect(data.guitars[0]).toMatchObject({ privateInfo: { purchasePrice: 100 }, notes: [{ content: 'n' }] });
  expect(data.documents[0].extractedContent.text).toBe('hi');
  expect(data.shares[0].views).toEqual([{ country: 'US' }]);
  expect(data.files).toContainEqual({ key: 'images/user-a/strat.jpg', zipPath: 'files/images/user-a/strat.jpg', sizeBytes: 14 });

  expect(jobs.transitionExport).toHaveBeenCalledWith('user-a', 'j1', 'pending', 'processing', expect.any(Object));
  expect(jobs.transitionExport).toHaveBeenCalledWith('user-a', 'j1', 'processing', 'ready', expect.objectContaining({ sizeBytes: expect.any(Number) }));
  expect(audit.logAccountEvent).toHaveBeenCalledWith('user-a', 'EXPORT_COMPLETED', 'SUCCESS', expect.objectContaining({ files: 3 }));
});

test('uploads to the private exports bucket under exports/{userId}/{jobId}.zip', async () => {
  await worker.run({ userId: 'user-a', jobId: 'j1' });
  const put = s3m.commandCalls(PutObjectCommand)[0] || s3m.commandCalls(CreateMultipartUploadCommand)[0];
  expect(put.args[0].input).toMatchObject({ Bucket: 'exports-bucket', Key: 'exports/user-a/j1.zip' });
});

test('a user with nothing gets a ZIP with their profile and empty collections', async () => {
  dynamodb.queryAll.mockImplementation(async (table) => (/users/.test(table) ? [{ userId: 'user-a' }] : []));
  s3m.on(ListObjectsV2Command).resolves({ Contents: [], IsTruncated: false });
  await worker.run({ userId: 'user-a', jobId: 'j1' });
  const data = JSON.parse(readZip().readAsText('data.json'));
  expect(data).toMatchObject({ guitars: [], documents: [], provenanceReports: [], shares: [], files: [] });
  expect(data.profile).toEqual({ userId: 'user-a' });
});

test('more than 2 GiB of files → failed too_large, nothing uploaded', async () => {
  s3m.on(ListObjectsV2Command).resolves({ Contents: [{ Key: 'images/user-a/huge.mov', Size: 2 * 1024 ** 3 + 1 }], IsTruncated: false });
  await worker.run({ userId: 'user-a', jobId: 'j1' });
  expect(jobs.transitionExport).toHaveBeenCalledWith('user-a', 'j1', 'processing', 'failed', { reason: 'too_large' });
  expect(uploadedBytes).toEqual([]);
});

test('a job that is not pending (duplicate delivery) is skipped', async () => {
  jobs.transitionExport.mockResolvedValueOnce(false);
  await worker.run({ userId: 'user-a', jobId: 'j1' });
  expect(dynamodb.queryAll).not.toHaveBeenCalled();
});

test('deletion requested before starting → cancelled, nothing read', async () => {
  jobs.isDeleting.mockResolvedValue(true);
  await worker.run({ userId: 'user-a', jobId: 'j1' });
  expect(jobs.transitionExport).toHaveBeenCalledWith('user-a', 'j1', 'processing', 'cancelled');
  expect(dynamodb.queryAll).not.toHaveBeenCalled();
});

test('deletion requested while zipping → ZIP deleted, cancelled', async () => {
  jobs.isDeleting.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  await worker.run({ userId: 'user-a', jobId: 'j1' });
  expect(s3m.commandCalls(DeleteObjectCommand)[0].args[0].input).toEqual({ Bucket: 'exports-bucket', Key: 'exports/user-a/j1.zip' });
  expect(jobs.transitionExport).toHaveBeenLastCalledWith('user-a', 'j1', 'processing', 'cancelled');
});

test('a failure marks the job failed and is not rethrown', async () => {
  s3m.on(GetObjectCommand).rejects(new Error('s3 read failed'));
  await expect(worker.run({ userId: 'user-a', jobId: 'j1' })).resolves.toBeUndefined();
  expect(jobs.transitionExport).toHaveBeenCalledWith('user-a', 'j1', 'processing', 'failed', { reason: 'error' });
  expect(audit.logAccountEvent).toHaveBeenCalledWith('user-a', 'EXPORT_FAILED', 'FAILURE', { reason: 'error' });
});

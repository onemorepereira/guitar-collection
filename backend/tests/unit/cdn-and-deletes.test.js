/**
 * GTR-14 slice 2 (AC17a): deleted files are invalidated on the images CDN,
 * per-key S3 delete failures surface, and photos/receipts removed from a guitar
 * become real deletes unless still referenced elsewhere.
 */

process.env.IMAGES_DISTRIBUTION_ID = 'EDIST123';
process.env.S3_BUCKET_IMAGES = 'images-bucket';
process.env.CLOUDFRONT_DOMAIN = 'images.example.com';

const { mockClient } = require('aws-sdk-client-mock');
const { CloudFrontClient, CreateInvalidationCommand } = require('@aws-sdk/client-cloudfront');
const { S3Client, DeleteObjectsCommand } = require('@aws-sdk/client-s3');

const cf = mockClient(CloudFrontClient);
const s3m = mockClient(S3Client);

const cdn = require('../../src/lib/cdn');
const s3 = require('../../src/lib/s3');

const invalidatedPaths = () =>
  cf.commandCalls(CreateInvalidationCommand).flatMap((c) => c.args[0].input.InvalidationBatch.Paths.Items);

beforeEach(() => {
  cf.reset();
  s3m.reset();
  cf.on(CreateInvalidationCommand).resolves({});
  s3m.on(DeleteObjectsCommand).resolves({});
});

describe('cdn.invalidate', () => {
  test('targets the images distribution and chunks to 100 paths per request', async () => {
    const paths = Array.from({ length: 150 }, (_, i) => `/images/u/${i}.jpg`);
    await cdn.invalidate(paths);
    const calls = cf.commandCalls(CreateInvalidationCommand);
    expect(calls).toHaveLength(2);
    expect(calls[0].args[0].input.DistributionId).toBe('EDIST123');
    expect(calls.map((c) => c.args[0].input.InvalidationBatch.Paths.Quantity)).toEqual([100, 50]);
  });

  test('non-strict swallows CloudFront errors; strict rethrows', async () => {
    cf.on(CreateInvalidationCommand).rejects(Object.assign(new Error('nope'), { name: 'TooManyInvalidationsInProgress' }));
    await expect(cdn.invalidate(['/images/u/a.jpg'])).resolves.toBeUndefined();
    await expect(cdn.invalidate(['/images/u/a.jpg'], { strict: true })).rejects.toThrow('nope');
  });

  test('de-duplicates and ignores empty input', async () => {
    await cdn.invalidate([]);
    await cdn.invalidate(['/a', '/a']);
    expect(invalidatedPaths()).toEqual(['/a']);
  });
});

describe('s3.deleteImages', () => {
  test('deletes then invalidates exactly the deleted paths', async () => {
    await s3.deleteImages(['images/u/a.jpg', 'images/u/b.jpg']);
    expect(s3m.commandCalls(DeleteObjectsCommand)).toHaveLength(1);
    expect(invalidatedPaths()).toEqual(['/images/u/a.jpg', '/images/u/b.jpg']);
  });

  test('throws when S3 reports per-key errors (and does not invalidate)', async () => {
    s3m.on(DeleteObjectsCommand).resolves({ Errors: [{ Key: 'images/u/a.jpg', Code: 'AccessDenied' }] });
    await expect(s3.deleteImages(['images/u/a.jpg'])).rejects.toThrow(/AccessDenied/);
    expect(cf.commandCalls(CreateInvalidationCommand)).toHaveLength(0);
  });

  test('a CDN failure does not fail the delete', async () => {
    cf.on(CreateInvalidationCommand).rejects(new Error('cdn down'));
    await expect(s3.deleteImages(['images/u/a.jpg'])).resolves.toBeUndefined();
  });
});

describe('guitar update removes files', () => {
  const CDN = 'https://images.example.com';
  const GUITAR_ID = '123e4567-e89b-42d3-a456-4266141740ab';
  let updateGuitar;
  let dynamodb;

  beforeAll(() => {
    jest.doMock('../../src/lib/dynamodb', () => ({
      getItem: jest.fn(),
      updateItem: jest.fn(),
      queryAll: jest.fn(),
    }));
    jest.doMock('../../src/lib/cognito', () => ({ getUserIdFromEvent: jest.fn().mockResolvedValue('user-a') }));
    jest.doMock('../../src/lib/csrf', () => ({ validateCSRF: jest.fn() }));
    dynamodb = require('../../src/lib/dynamodb');
    ({ updateGuitar } = require('../../src/handlers/guitars/update'));
  });

  const img = (name) => ({ id: name, url: `${CDN}/images/user-a/${name}.jpg` });
  const event = (body) => ({ headers: {}, pathParameters: { id: GUITAR_ID }, body: JSON.stringify(body) });

  function setup({ before, after, otherGuitars = [], documents = [], reports = [] }) {
    dynamodb.getItem.mockResolvedValue({ userId: 'user-a', guitarId: GUITAR_ID, ...before });
    dynamodb.updateItem.mockResolvedValue({ userId: 'user-a', guitarId: GUITAR_ID, ...after });
    dynamodb.queryAll.mockImplementation(async (table) => {
      if (/guitars/.test(table)) return [{ guitarId: GUITAR_ID, ...after }, ...otherGuitars];
      if (/documents/.test(table)) return documents;
      return reports;
    });
  }

  test('a removed, unreferenced photo is deleted and invalidated', async () => {
    setup({ before: { images: [img('a'), img('b')] }, after: { images: [img('a')] } });
    const res = await updateGuitar(event({ images: [img('a')] }));
    expect(res.statusCode).toBe(200);
    expect(invalidatedPaths()).toEqual(['/images/user-a/b.jpg']);
  });

  test('a removed photo still used by a saved report is kept', async () => {
    setup({
      before: { images: [img('a'), img('b')] },
      after: { images: [img('a')] },
      reports: [{ reportId: 'r1', guitar: { images: [img('b')] } }],
    });
    await updateGuitar(event({ images: [img('a')] }));
    expect(s3m.commandCalls(DeleteObjectsCommand)).toHaveLength(0);
  });

  test('a replaced receipt is deleted unless a document points at it', async () => {
    const receipt = (n) => `${CDN}/images/user-a/receipt-${n}.pdf`;
    setup({ before: { privateInfo: { receiptUrl: receipt(1) } }, after: { privateInfo: { receiptUrl: receipt(2) } } });
    await updateGuitar(event({ privateInfo: { receiptUrl: receipt(2) } }));
    expect(invalidatedPaths()).toEqual(['/images/user-a/receipt-1.pdf']);

    cf.reset(); s3m.reset(); cf.on(CreateInvalidationCommand).resolves({}); s3m.on(DeleteObjectsCommand).resolves({});
    setup({
      before: { privateInfo: { receiptUrl: receipt(1) } },
      after: { privateInfo: { receiptUrl: receipt(2) } },
      documents: [{ documentId: 'd1', url: receipt(1) }],
    });
    await updateGuitar(event({ privateInfo: { receiptUrl: receipt(2) } }));
    expect(s3m.commandCalls(DeleteObjectsCommand)).toHaveLength(0);
  });

  test('an update that does not touch images deletes nothing', async () => {
    setup({ before: { images: [img('a')] }, after: { images: [img('a')], color: 'Red' } });
    await updateGuitar(event({ color: 'Red' }));
    expect(dynamodb.queryAll).not.toHaveBeenCalled();
    expect(s3m.commandCalls(DeleteObjectsCommand)).toHaveLength(0);
  });
});

describe('share render cleanup', () => {
  test('deleted share renders are invalidated', async () => {
    // Shared module registry so the S3/CloudFront client mocks apply
    jest.doMock('sharp', () => jest.fn(), { virtual: true });
    const { deleteOptimizedImages } = require('../../src/handlers/shares/process-images');
    await deleteOptimizedImages(['shared/s1/a.jpg']);
    expect(invalidatedPaths()).toEqual(['/shared/s1/a.jpg']);
  });
});

/**
 * GET /public/guitars/random must only return guitars whose owner opted in
 * (showInGallery = true), across every Scan page, with private fields and
 * image captions stripped (GTR-13).
 */

process.env.GUITARS_TABLE_NAME = 'guitars-test';
process.env.CLOUDFRONT_DOMAIN = 'images.example.com';

const { mockClient } = require('aws-sdk-client-mock');

// Each test gets a fresh module registry so the handler's module-level
// 5-minute cache can't leak between tests. The mock must be installed on the
// DynamoDBDocumentClient class from that same registry.
let ddbMock;
let ScanCommand;
let handler;

function loadHandler() {
  return handler;
}

let isDeleting;

beforeEach(() => {
  jest.isolateModules(() => {
    isDeleting = jest.fn().mockResolvedValue(false);
    jest.doMock('../../src/lib/accountJobs', () => ({ isDeleting }));
    const lib = require('@aws-sdk/lib-dynamodb');
    ScanCommand = lib.ScanCommand;
    ddbMock = mockClient(lib.DynamoDBDocumentClient);
    ({ handler } = require('../../src/handlers/guitars/random-public'));
  });
});

afterEach(() => {
  ddbMock.restore();
});

function guitar(id, extra = {}) {
  return {
    userId: `owner-of-${id}`,
    guitarId: id,
    brand: 'Fender',
    model: 'Stratocaster',
    year: 1965,
    notes: [{ id: 'n1', content: 'private note' }],
    privateInfo: { purchasePrice: 4500, serialNumber: 'L12345' },
    serialNumber: 'L12345',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    images: [
      { id: 'img1', url: 'https://images.example.com/images/u/1.jpg', isPrimary: true, order: 0, caption: 'my living room' },
    ],
    ...extra,
  };
}

test('scans with a filter on showInGallery = true', async () => {
  ddbMock.on(ScanCommand).resolves({ Items: [guitar('g1', { showInGallery: true })] });

  const res = await loadHandler()({});

  expect(res.statusCode).toBe(200);
  const input = ddbMock.commandCalls(ScanCommand)[0].args[0].input;
  expect(input.TableName).toBe('guitars-test');
  expect(input.FilterExpression).toBe('showInGallery = :t');
  expect(input.ExpressionAttributeValues).toEqual({ ':t': true });
});

test('returns 404 when no guitar is opted in', async () => {
  ddbMock.on(ScanCommand).resolves({ Items: [] });
  const res = await loadHandler()({});
  expect(res.statusCode).toBe(404);
});

test('follows LastEvaluatedKey so opted-in guitars on later pages are eligible', async () => {
  ddbMock
    .on(ScanCommand)
    .resolvesOnce({ Items: [], LastEvaluatedKey: { userId: 'x', guitarId: 'page1-end' } })
    .resolvesOnce({ Items: [guitar('g-page2', { showInGallery: true })] });

  const res = await loadHandler()({});

  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body).id).toBe('g-page2');
  const calls = ddbMock.commandCalls(ScanCommand);
  expect(calls).toHaveLength(2);
  expect(calls[1].args[0].input.ExclusiveStartKey).toEqual({ userId: 'x', guitarId: 'page1-end' });
});

test('never returns private fields; images carry only id, url, isPrimary, order', async () => {
  ddbMock.on(ScanCommand).resolves({ Items: [guitar('g1', { showInGallery: true })] });

  const body = JSON.parse((await loadHandler()({})).body);

  expect(body).not.toHaveProperty('userId');
  expect(body).not.toHaveProperty('privateInfo');
  expect(body).not.toHaveProperty('notes');
  expect(body).not.toHaveProperty('createdAt');
  expect(body).not.toHaveProperty('updatedAt');
  expect(body).not.toHaveProperty('showInGallery');
  expect(body.serialNumber).toBe('***REDACTED***');
  expect(body.images).toEqual([
    { id: 'img1', url: 'https://images.example.com/images/u/1.jpg', isPrimary: true, order: 0 },
  ]);
});

test('serves from cache within the TTL without scanning again', async () => {
  ddbMock.on(ScanCommand).resolves({ Items: [guitar('g1', { showInGallery: true })] });
  const handler = loadHandler();

  await handler({});
  await handler({});

  expect(ddbMock.commandCalls(ScanCommand)).toHaveLength(1);
});

test('caches an empty result too (no scan storm when nothing is opted in)', async () => {
  ddbMock.on(ScanCommand).resolves({ Items: [] });
  const handler = loadHandler();

  expect((await handler({})).statusCode).toBe(404);
  expect((await handler({})).statusCode).toBe(404);
  expect(ddbMock.commandCalls(ScanCommand)).toHaveLength(1);
});

test('never returns an unflagged guitar even if the scan returns one (backstop)', async () => {
  ddbMock.on(ScanCommand).resolves({
    Items: [guitar('leak', {}), guitar('false-flag', { showInGallery: false }), guitar('str', { showInGallery: 'true' })],
  });
  const res = await loadHandler()({});
  expect(res.statusCode).toBe(404);
});

test('tolerates malformed image entries', async () => {
  ddbMock.on(ScanCommand).resolves({
    Items: [guitar('g1', { showInGallery: true, images: [null, { id: 'i', url: 'u', isPrimary: true, order: 0 }] })],
  });
  const body = JSON.parse((await loadHandler()({})).body);
  expect(body.images).toEqual([{ id: 'i', url: 'u', isPrimary: true, order: 0 }]);
});

test('returns 500 when the scan fails', async () => {
  ddbMock.on(ScanCommand).rejects(new Error('boom'));
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const res = await loadHandler()({});
  expect(res.statusCode).toBe(500);
  console.error.mockRestore();
});

test("never returns a guitar whose owner's account is being deleted, even from a warm cache", async () => {
  ddbMock.on(ScanCommand).resolves({
    Items: [
      guitar('mine', { showInGallery: true, userId: 'deleting-user' }),
      guitar('theirs', { showInGallery: true, userId: 'other-user' }),
    ],
  });
  const handler = loadHandler();
  // Warm the cache while nobody is deleting
  await handler({});

  isDeleting.mockImplementation(async (userId) => userId === 'deleting-user');
  for (let i = 0; i < 20; i++) {
    const body = JSON.parse((await handler({})).body);
    expect(body.id).toBe('theirs');
  }
  expect(ddbMock.commandCalls(ScanCommand)).toHaveLength(1);
});

test('returns 404 when every opted-in owner is being deleted', async () => {
  ddbMock.on(ScanCommand).resolves({ Items: [guitar('g1', { showInGallery: true })] });
  isDeleting.mockResolvedValue(true);
  expect((await loadHandler()({})).statusCode).toBe(404);
});

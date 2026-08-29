/**
 * Guitar create/update must reject image and receipt URLs pointing into
 * another user's S3 prefix; guitar delete must only delete S3 keys owned
 * by the requesting user (cross-tenant delete vector).
 */

jest.mock('../../src/lib/dynamodb', () => ({
  getItem: jest.fn(),
  putItem: jest.fn().mockResolvedValue({}),
  updateItem: jest.fn().mockResolvedValue({}),
  deleteItem: jest.fn().mockResolvedValue({}),
  queryItems: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../src/lib/cognito', () => ({
  getUserIdFromEvent: jest.fn().mockResolvedValue('user-a'),
}));
jest.mock('../../src/lib/csrf', () => ({
  validateCSRF: jest.fn(),
}));
jest.mock('../../src/lib/s3', () => ({
  deleteImages: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../src/lib/audit', () => ({
  logDeletion: jest.fn(),
  logSecurityEvent: jest.fn(),
  SECURITY_EVENTS: { UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS' },
  RESULT: { FAILURE: 'FAILURE' },
}));

const { getItem, putItem, deleteItem } = require('../../src/lib/dynamodb');
const { deleteImages } = require('../../src/lib/s3');
const { createGuitar } = require('../../src/handlers/guitars/create');
const { deleteGuitar } = require('../../src/handlers/guitars/delete');

const CDN = 'https://images.example.com';
const GUITAR_ID = '123e4567-e89b-42d3-a456-4266141740ab';

describe('createGuitar URL ownership', () => {
  test('rejects an image URL under another user prefix with 400', async () => {
    const event = {
      headers: {},
      body: JSON.stringify({
        brand: 'Fender',
        model: 'Stratocaster',
        year: 2020,
        images: [{ id: 'img1', url: `${CDN}/images/user-b/secret.jpg` }],
      }),
    };
    const result = await createGuitar(event);
    expect(result.statusCode).toBe(400);
    expect(putItem).not.toHaveBeenCalled();
  });

  test('rejects a foreign receipt URL with 400', async () => {
    const event = {
      headers: {},
      body: JSON.stringify({
        brand: 'Fender',
        model: 'Stratocaster',
        year: 2020,
        privateInfo: { receiptUrl: `${CDN}/images/user-b/receipt.pdf` },
      }),
    };
    const result = await createGuitar(event);
    expect(result.statusCode).toBe(400);
    expect(putItem).not.toHaveBeenCalled();
  });

  test('accepts the user own image URLs', async () => {
    const event = {
      headers: {},
      body: JSON.stringify({
        brand: 'Fender',
        model: 'Stratocaster',
        year: 2020,
        images: [{ id: 'img1', url: `${CDN}/images/user-a/mine.jpg` }],
      }),
    };
    const result = await createGuitar(event);
    expect(result.statusCode).toBe(201);
    expect(putItem).toHaveBeenCalled();
  });
});

describe('deleteGuitar S3 key ownership', () => {
  test('deletes only S3 keys under the requesting user prefix', async () => {
    getItem.mockResolvedValue({
      userId: 'user-a',
      guitarId: GUITAR_ID,
      brand: 'Fender',
      model: 'Stratocaster',
      year: 2020,
      images: [
        { id: 'img1', url: `${CDN}/images/user-a/mine.jpg` },
        { id: 'img2', url: `${CDN}/images/user-b/theirs.jpg` },
      ],
      privateInfo: { receiptUrl: `${CDN}/images/user-b/their-receipt.pdf` },
    });

    const event = { headers: {}, pathParameters: { id: GUITAR_ID } };
    const result = await deleteGuitar(event);

    expect(result.statusCode).toBe(200);
    expect(deleteImages).toHaveBeenCalledWith(['images/user-a/mine.jpg']);
  });

  test('still deletes the DB record when S3 cleanup fails', async () => {
    getItem.mockResolvedValue({
      userId: 'user-a',
      guitarId: GUITAR_ID,
      brand: 'Fender',
      model: 'Stratocaster',
      year: 2020,
      images: [{ id: 'img1', url: `${CDN}/images/user-a/mine.jpg` }],
    });
    deleteImages.mockRejectedValueOnce(new Error('s3 down'));

    const event = { headers: {}, pathParameters: { id: GUITAR_ID } };
    const result = await deleteGuitar(event);

    expect(result.statusCode).toBe(200);
    expect(deleteItem).toHaveBeenCalled();
  });
});

/**
 * Wiring of the share cascade: guitar delete, guitar update (photo removal),
 * and the public share page hiding photos no longer on the guitar.
 */

jest.mock('../../src/lib/shareCleanup', () => ({
  ...jest.requireActual('../../src/lib/shareCleanup'),
  deleteSharesForGuitar: jest.fn().mockResolvedValue(1),
  pruneSharesForRemovedImages: jest.fn().mockResolvedValue(1),
}));
jest.mock('../../src/lib/dynamodb', () => ({
  getItem: jest.fn(),
  updateItem: jest.fn(),
  deleteItem: jest.fn().mockResolvedValue({}),
  queryItems: jest.fn().mockResolvedValue([]),
  queryAll: jest.fn().mockResolvedValue([]),
  queryByIndex: jest.fn(),
}));
jest.mock('../../src/lib/cognito', () => ({ getUserIdFromEvent: jest.fn().mockResolvedValue('user-a') }));
jest.mock('../../src/lib/csrf', () => ({ validateCSRF: jest.fn() }));
jest.mock('../../src/lib/s3', () => ({ deleteImages: jest.fn().mockResolvedValue() }));
jest.mock('../../src/lib/accountJobs', () => ({ isDeleting: jest.fn().mockResolvedValue(false) }));
jest.mock('../../src/lib/audit', () => ({
  logDeletion: jest.fn(),
  logSecurityEvent: jest.fn(),
  SECURITY_EVENTS: { UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS' },
  RESULT: { FAILURE: 'FAILURE' },
}));

const dynamodb = require('../../src/lib/dynamodb');
const cleanup = require('../../src/lib/shareCleanup');
const { deleteGuitar } = require('../../src/handlers/guitars/delete');
const { updateGuitar } = require('../../src/handlers/guitars/update');
const { getPublicShare } = require('../../src/handlers/shares/public-get');

const GUITAR_ID = '123e4567-e89b-42d3-a456-4266141740ab';
const CDN = 'https://images.example.com';
const photo = (id) => ({ id, url: `${CDN}/images/user-a/${id}.jpg`, isPrimary: false, order: 0 });
const guitar = { userId: 'user-a', guitarId: GUITAR_ID, brand: 'Fender', model: 'Strat', images: [photo('p1'), photo('p2')] };

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CLOUDFRONT_DOMAIN = 'images.example.com';
  dynamodb.getItem.mockResolvedValue(guitar);
});

describe('guitar delete', () => {
  const event = () => ({ headers: {}, pathParameters: { id: GUITAR_ID } });

  test('deletes the guitar\'s shares before the guitar', async () => {
    const order = [];
    cleanup.deleteSharesForGuitar.mockImplementation(async () => { order.push('shares'); return 2; });
    dynamodb.deleteItem.mockImplementation(async () => { order.push('guitar'); });
    const res = await deleteGuitar(event());
    expect(res.statusCode).toBe(200);
    expect(cleanup.deleteSharesForGuitar).toHaveBeenCalledWith('user-a', GUITAR_ID);
    expect(order).toEqual(['shares', 'guitar']);
  });

  test('a share cleanup failure fails the request and keeps the guitar', async () => {
    cleanup.deleteSharesForGuitar.mockRejectedValue(new Error('AccessDenied'));
    const res = await deleteGuitar(event());
    expect(res.statusCode).toBe(500);
    expect(dynamodb.deleteItem).not.toHaveBeenCalled();
  });
});

describe('guitar update', () => {
  const event = (body) => ({ headers: {}, pathParameters: { id: GUITAR_ID }, body: JSON.stringify(body) });

  test('removing a photo prunes it from the guitar\'s shares', async () => {
    dynamodb.updateItem.mockResolvedValue({ ...guitar, images: [photo('p2')] });
    const res = await updateGuitar(event({ images: [photo('p2')] }));
    expect(res.statusCode).toBe(200);
    expect(cleanup.pruneSharesForRemovedImages).toHaveBeenCalledWith('user-a', GUITAR_ID, ['p1']);
  });

  test('an update that doesn\'t touch images leaves shares alone', async () => {
    dynamodb.updateItem.mockResolvedValue({ ...guitar, color: 'Red' });
    await updateGuitar(event({ color: 'Red' }));
    expect(cleanup.pruneSharesForRemovedImages).not.toHaveBeenCalled();
  });

  test('a prune failure doesn\'t fail the saved update', async () => {
    cleanup.pruneSharesForRemovedImages.mockRejectedValue(new Error('boom'));
    dynamodb.updateItem.mockResolvedValue({ ...guitar, images: [photo('p2')] });
    const res = await updateGuitar(event({ images: [photo('p2')] }));
    expect(res.statusCode).toBe(200);
  });
});

describe('public share page', () => {
  test('shows only resized copies whose photo is still on the guitar', async () => {
    dynamodb.queryByIndex.mockResolvedValue([{
      shareId: 's1', userId: 'user-a', guitarId: GUITAR_ID, isActive: true, sharedFields: {},
      selectedImageIds: ['p1', 'gone'],
      optimizedImages: [
        { originalId: 'p1', url: `${CDN}/shared/s1/p1.jpg`, s3Key: 'shared/s1/p1.jpg' },
        { originalId: 'gone', url: `${CDN}/shared/s1/gone.jpg`, s3Key: 'shared/s1/gone.jpg' },
      ],
    }]);
    dynamodb.updateItem.mockResolvedValue({});
    const res = await getPublicShare({ pathParameters: { shareId: 's1' }, headers: {} });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const images = body.images || body.guitar?.images;
    expect(images.map((i) => i.id)).toEqual(['p1']);
  });
});

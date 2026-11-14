/**
 * showInGallery opt-in flag on guitar create/update (GTR-13), plus the
 * create.js fix for conditionShape/conditionMarkers being dropped.
 */

jest.mock('../../src/lib/dynamodb', () => ({
  getItem: jest.fn(),
  putItem: jest.fn().mockResolvedValue({}),
  updateItem: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../src/lib/cognito', () => ({
  getUserIdFromEvent: jest.fn().mockResolvedValue('user-a'),
}));
jest.mock('../../src/lib/csrf', () => ({
  validateCSRF: jest.fn(),
}));

const { getItem, putItem, updateItem } = require('../../src/lib/dynamodb');
const { getUserIdFromEvent } = require('../../src/lib/cognito');
const { createGuitar } = require('../../src/handlers/guitars/create');
const { updateGuitar } = require('../../src/handlers/guitars/update');

const GUITAR_ID = '123e4567-e89b-42d3-a456-4266141740ab';
const BASE = { brand: 'Fender', model: 'Stratocaster', year: 1965 };

function createEvent(body) {
  return { headers: {}, body: JSON.stringify(body) };
}

function updateEvent(body) {
  return { headers: {}, pathParameters: { id: GUITAR_ID }, body: JSON.stringify(body) };
}

function storedItem() {
  return putItem.mock.calls[0][1];
}

function updatePayload() {
  return updateItem.mock.calls[0][2];
}

beforeEach(() => {
  getUserIdFromEvent.mockResolvedValue('user-a');
  getItem.mockResolvedValue({ userId: 'user-a', guitarId: GUITAR_ID, ...BASE });
  updateItem.mockImplementation(async (_t, _k, updates) => ({ userId: 'user-a', guitarId: GUITAR_ID, ...BASE, ...updates }));
});

describe('createGuitar showInGallery', () => {
  test.each([true, false])('stores showInGallery=%s', async (value) => {
    const result = await createGuitar(createEvent({ ...BASE, showInGallery: value }));
    expect(result.statusCode).toBe(201);
    expect(storedItem().showInGallery).toBe(value);
  });

  test('stores no flag when absent (not shown in gallery)', async () => {
    const result = await createGuitar(createEvent(BASE));
    expect(result.statusCode).toBe(201);
    expect(storedItem()).not.toHaveProperty('showInGallery');
  });

  test.each(['true', 1, null, {}])('rejects showInGallery=%p with 400', async (value) => {
    const result = await createGuitar(createEvent({ ...BASE, showInGallery: value }));
    expect(result.statusCode).toBe(400);
    expect(putItem).not.toHaveBeenCalled();
  });
});

describe('createGuitar condition fields (previously dropped)', () => {
  test('stores conditionShape and conditionMarkers', async () => {
    const markers = [{ id: 'm1', x: 10, y: 20, view: 'front', severity: 'minor', type: 'Scratch', note: 'small' }];
    const result = await createGuitar(createEvent({ ...BASE, conditionShape: 'stratocaster', conditionMarkers: markers }));
    expect(result.statusCode).toBe(201);
    expect(storedItem().conditionShape).toBe('stratocaster');
    expect(storedItem().conditionMarkers).toEqual(markers);
  });
});

describe('updateGuitar showInGallery', () => {
  test.each([true, false])('updates showInGallery=%s', async (value) => {
    const result = await updateGuitar(updateEvent({ showInGallery: value }));
    expect(result.statusCode).toBe(200);
    expect(updatePayload().showInGallery).toBe(value);
  });

  test('leaves the stored flag alone when absent', async () => {
    const result = await updateGuitar(updateEvent({ color: 'Sunburst' }));
    expect(result.statusCode).toBe(200);
    expect(updatePayload()).not.toHaveProperty('showInGallery');
  });

  test.each(['true', 1, null])('rejects showInGallery=%p with 400', async (value) => {
    const result = await updateGuitar(updateEvent({ showInGallery: value }));
    expect(result.statusCode).toBe(400);
    expect(updateItem).not.toHaveBeenCalled();
  });

  test("another user cannot opt in someone else's guitar (404, no write)", async () => {
    getUserIdFromEvent.mockResolvedValue('user-b');
    getItem.mockResolvedValue(null); // keyed lookup by (user-b, guitarId) finds nothing
    const result = await updateGuitar(updateEvent({ showInGallery: true }));
    expect(result.statusCode).toBe(404);
    expect(updateItem).not.toHaveBeenCalled();
  });
});

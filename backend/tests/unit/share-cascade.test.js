/**
 * Share links follow their guitar: deleting a guitar deletes its shares (copies
 * and view history); removing photos removes them from its shares.
 */

jest.mock('../../src/lib/dynamodb', () => ({
  queryAll: jest.fn(),
  deleteItem: jest.fn().mockResolvedValue({}),
  updateItem: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../src/lib/s3', () => ({ deleteImages: jest.fn().mockResolvedValue() }));

const { queryAll, deleteItem, updateItem } = require('../../src/lib/dynamodb');
const { deleteImages } = require('../../src/lib/s3');
const { deleteSharesForGuitar, pruneSharesForRemovedImages, removedImageIds } = require('../../src/lib/shareCleanup');

const copy = (originalId, shareId) => ({ originalId, s3Key: `shared/${shareId}/${originalId}.jpg`, url: `https://cdn/shared/${shareId}/${originalId}.jpg` });
const shares = [
  { userId: 'u', shareId: 's1', guitarId: 'g1', selectedImageIds: ['p1', 'p2'], optimizedImages: [copy('p1', 's1'), copy('p2', 's1')], views: [{}] },
  { userId: 'u', shareId: 's2', guitarId: 'g1', selectedImageIds: ['p2'], optimizedImages: [] },
  { userId: 'u', shareId: 's3', guitarId: 'g2', selectedImageIds: ['p9'], optimizedImages: [copy('p9', 's3')] },
];

beforeEach(() => {
  jest.clearAllMocks();
  queryAll.mockResolvedValue(shares);
});

describe('deleteSharesForGuitar', () => {
  test('deletes copies and items of that guitar\'s shares only, querying the caller\'s partition', async () => {
    await expect(deleteSharesForGuitar('u', 'g1')).resolves.toBe(2);
    expect(queryAll).toHaveBeenCalledWith(expect.any(String), 'userId = :u', { ':u': 'u' });
    expect(deleteImages).toHaveBeenCalledWith(['shared/s1/p1.jpg', 'shared/s1/p2.jpg']);
    expect(deleteImages).toHaveBeenCalledWith([]);
    expect(deleteItem.mock.calls.map((c) => c[1])).toEqual([{ userId: 'u', shareId: 's1' }, { userId: 'u', shareId: 's2' }]);
  });

  test('a failed copy delete stops before the share item is deleted', async () => {
    deleteImages.mockRejectedValueOnce(new Error('AccessDenied'));
    await expect(deleteSharesForGuitar('u', 'g1')).rejects.toThrow('AccessDenied');
    expect(deleteItem).not.toHaveBeenCalled();
  });

  test('no shares → nothing deleted', async () => {
    queryAll.mockResolvedValue([]);
    await expect(deleteSharesForGuitar('u', 'g1')).resolves.toBe(0);
    expect(deleteItem).not.toHaveBeenCalled();
  });
});

describe('pruneSharesForRemovedImages', () => {
  test('removes the photo from selection and copies, deletes its copy, leaves other shares alone', async () => {
    await expect(pruneSharesForRemovedImages('u', 'g1', ['p1'])).resolves.toBe(1);
    expect(deleteImages).toHaveBeenCalledWith(['shared/s1/p1.jpg']);
    expect(updateItem).toHaveBeenCalledTimes(1);
    const [, key, updates] = updateItem.mock.calls[0];
    expect(key).toEqual({ userId: 'u', shareId: 's1' });
    expect(updates.selectedImageIds).toEqual(['p2']);
    expect(updates.optimizedImages.map((i) => i.originalId)).toEqual(['p2']);
  });

  test('a photo only in a share\'s selection (no copy) is unselected', async () => {
    await pruneSharesForRemovedImages('u', 'g1', ['p2']);
    const byShare = Object.fromEntries(updateItem.mock.calls.map(([, key, u]) => [key.shareId, u]));
    expect(byShare.s2.selectedImageIds).toEqual([]);
    expect(byShare.s1.selectedImageIds).toEqual(['p1']);
  });

  test('nothing removed → no reads, no writes', async () => {
    await expect(pruneSharesForRemovedImages('u', 'g1', [])).resolves.toBe(0);
    expect(queryAll).not.toHaveBeenCalled();
  });
});

test('removedImageIds: ids before and not after', () => {
  expect(removedImageIds({ images: [{ id: 'a' }, { id: 'b' }, {}] }, { images: [{ id: 'b' }] })).toEqual(['a']);
  expect(removedImageIds({ images: [{ id: 'a' }] }, {})).toEqual(['a']);
  expect(removedImageIds({}, { images: [{ id: 'a' }] })).toEqual([]);
});

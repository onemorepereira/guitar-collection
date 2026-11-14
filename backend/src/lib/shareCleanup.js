/**
 * Keep share links in step with the guitar they show.
 *
 * Shares copy resized photos to shared/{shareId}/ and keep their own view
 * history. When a guitar is deleted its shares go too; when photos are removed
 * from a guitar they are removed from its shares. deleteImages also invalidates
 * the CDN for every deleted key.
 */

const { queryAll, deleteItem, updateItem } = require('./dynamodb');
const { deleteImages } = require('./s3');
const { TABLES } = require('../config/constants');

async function sharesForGuitar(userId, guitarId) {
  const shares = await queryAll(TABLES.SHARES, 'userId = :u', { ':u': userId });
  return shares.filter((share) => share.guitarId === guitarId);
}

const copyKeys = (images) => (images || []).map((img) => img && img.s3Key).filter(Boolean);

/**
 * Delete every share of a guitar: its shared/ copies, then the share item.
 * Errors propagate so the caller can stop before deleting the guitar; a retry
 * is safe (already-deleted shares are simply not found again).
 * @returns {Promise<number>} shares deleted
 */
async function deleteSharesForGuitar(userId, guitarId) {
  const shares = await sharesForGuitar(userId, guitarId);
  for (const share of shares) {
    await deleteImages(copyKeys(share.optimizedImages));
    await deleteItem(TABLES.SHARES, { userId, shareId: share.shareId });
  }
  return shares.length;
}

/**
 * Remove photos (by image id) from every share of a guitar.
 * @returns {Promise<number>} shares changed
 */
async function pruneSharesForRemovedImages(userId, guitarId, removedImageIds) {
  const removed = new Set(removedImageIds || []);
  if (removed.size === 0) return 0;

  let changed = 0;
  for (const share of await sharesForGuitar(userId, guitarId)) {
    const optimized = share.optimizedImages || [];
    const selected = share.selectedImageIds || [];
    const goneCopies = optimized.filter((img) => removed.has(img.originalId));
    const keptCopies = optimized.filter((img) => !removed.has(img.originalId));
    const keptSelected = selected.filter((id) => !removed.has(id));
    if (goneCopies.length === 0 && keptSelected.length === selected.length) continue;

    await deleteImages(copyKeys(goneCopies));
    await updateItem(
      TABLES.SHARES,
      { userId, shareId: share.shareId },
      { optimizedImages: keptCopies, selectedImageIds: keptSelected, updatedAt: new Date().toISOString() }
    );
    changed += 1;
  }
  return changed;
}

/** Image ids present before an update and missing after it. */
function removedImageIds(before, after) {
  const kept = new Set((after?.images || []).map((img) => img && img.id).filter(Boolean));
  return (before?.images || []).map((img) => img && img.id).filter((id) => id && !kept.has(id));
}

module.exports = { deleteSharesForGuitar, pruneSharesForRemovedImages, removedImageIds };

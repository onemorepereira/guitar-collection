/**
 * Update guitar handler
 */

const { getItem, updateItem, queryAll } = require('../../lib/dynamodb');
const { deleteImages } = require('../../lib/s3');
const { getUserIdFromEvent } = require('../../lib/cognito');
const { validateGuitarUpdateFields, validatePathParameter } = require('../../lib/validation');
const { sanitizeGuitarData } = require('../../lib/sanitization');
const { validateCSRF } = require('../../lib/csrf');
const { assertUrlOwnership, collectGuitarImageKeys } = require('../../lib/s3Keys');
const response = require('../../lib/response');
const { handleError } = require('../../lib/errors');
const { TABLES } = require('../../config/constants');

async function updateGuitar(event) {
  try {
    // Validate CSRF protection header
    validateCSRF(event);

    const userId = await getUserIdFromEvent(event);
    const guitarId = event.pathParameters?.id;

    // Validate guitar ID format
    validatePathParameter(guitarId, 'guitarId');

    const body = JSON.parse(event.body);

    // Step 1: Validate allowed fields (prevents NoSQL injection)
    const filteredData = validateGuitarUpdateFields(body);

    // Step 2: Sanitize all input (prevents XSS)
    const data = sanitizeGuitarData(filteredData);

    // Step 3: Reject image/receipt URLs pointing into another user's storage
    for (const image of data.images || []) {
      assertUrlOwnership(image.url, userId);
    }
    assertUrlOwnership(data.privateInfo?.receiptUrl, userId);

    // Get existing guitar to verify ownership
    const existingGuitar = await getItem(TABLES.GUITARS, {
      userId,
      guitarId,
    });

    // Return same error for not found and unauthorized to prevent enumeration
    if (!existingGuitar || existingGuitar.userId !== userId) {
      return response.notFound('Guitar not found');
    }

    // Prepare updates - include all sanitized fields
    const updates = {
      ...data,
      updatedAt: new Date().toISOString(),
    };

    // Convert types
    if (updates.year) {
      updates.year = parseInt(updates.year);
    }
    if (updates.numberOfFrets !== undefined && updates.numberOfFrets !== null) {
      updates.numberOfFrets = parseInt(updates.numberOfFrets);
    }

    // Update guitar
    const updatedGuitar = await updateItem(
      TABLES.GUITARS,
      { userId, guitarId },
      updates
    );

    // Photos/receipt removed by this update become real deletes, unless
    // something else of the user's still points at the file (another guitar,
    // a document, or a saved provenance/sales report).
    if (data.images !== undefined || data.privateInfo?.receiptUrl !== undefined) {
      try {
        await deleteRemovedFiles(userId, guitarId, existingGuitar, updatedGuitar);
      } catch (error) {
        // The update itself succeeded; a leftover file is cleanup debt, not a failed save
        console.error('Failed to delete removed files after guitar update', { error: error.name || error.message });
      }
    }

    // Map guitarId to id for frontend compatibility
    const guitarResponse = {
      ...updatedGuitar,
      id: updatedGuitar.guitarId,
    };
    delete guitarResponse.guitarId;

    return response.ok({
      message: 'Guitar updated successfully',
      guitar: guitarResponse,
    });
  } catch (error) {
    return handleError(error, response);
  }
}

async function deleteRemovedFiles(userId, guitarId, before, after) {
  const kept = new Set(collectGuitarImageKeys(after, userId));
  const removed = collectGuitarImageKeys(before, userId).filter((key) => !kept.has(key));
  if (removed.length === 0) return;

  const byUser = [TABLES.GUITARS, TABLES.DOCUMENTS, TABLES.PROVENANCE_REPORTS].map((table) =>
    queryAll(table, 'userId = :u', { ':u': userId })
  );
  const [guitars, documents, reports] = await Promise.all(byUser);
  const others = [
    ...guitars.filter((g) => g.guitarId !== guitarId),
    ...documents,
    ...reports,
  ].map((item) => JSON.stringify(item));

  const unreferenced = removed.filter((key) => !others.some((text) => text.includes(key)));
  await deleteImages(unreferenced);
}

module.exports = { updateGuitar };

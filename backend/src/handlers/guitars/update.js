/**
 * Update guitar handler
 */

const { getItem, updateItem } = require('../../lib/dynamodb');
const { getUserIdFromEvent } = require('../../lib/cognito');
const { validateGuitarUpdateFields, validatePathParameter } = require('../../lib/validation');
const { sanitizeGuitarData } = require('../../lib/sanitization');
const { validateCSRF } = require('../../lib/csrf');
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

module.exports = { updateGuitar };

/**
 * Get single guitar handler
 */

const { getItem } = require('../../lib/dynamodb');
const { getUserIdFromEvent } = require('../../lib/cognito');
const { validatePathParameter } = require('../../lib/validation');
const response = require('../../lib/response');
const { handleError } = require('../../lib/errors');
const { TABLES } = require('../../config/constants');
const { logSecurityEvent, SECURITY_EVENTS, RESULT } = require('../../lib/audit');

async function getGuitar(event) {
  try {
    const userId = await getUserIdFromEvent(event);
    const guitarId = event.pathParameters?.id;

    // Validate guitar ID format
    validatePathParameter(guitarId, 'guitarId');

    // Get guitar from DynamoDB
    const guitar = await getItem(TABLES.GUITARS, {
      userId,
      guitarId,
    });

    // Return same error for not found and unauthorized to prevent enumeration
    if (!guitar || guitar.userId !== userId) {
      // Log unauthorized access attempt
      logSecurityEvent(event, userId, SECURITY_EVENTS.UNAUTHORIZED_ACCESS, RESULT.FAILURE, {
        resourceType: 'guitar',
        resourceId: guitarId,
        operation: 'read',
        reason: 'not_found_or_unauthorized',
      });
      return response.notFound('Guitar not found');
    }

    // Map guitarId to id for frontend compatibility
    const guitarResponse = {
      ...guitar,
      id: guitar.guitarId,
    };
    delete guitarResponse.guitarId;

    return response.ok({
      guitar: guitarResponse,
    });
  } catch (error) {
    return handleError(error, response);
  }
}

module.exports = { getGuitar };

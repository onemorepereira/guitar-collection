/**
 * Update user name handler
 */

const { updateUserAttributes } = require('../../lib/cognito');
const { updateItem } = require('../../lib/dynamodb');
const { getUserIdFromEvent } = require('../../lib/cognito');
const { validateRequired } = require('../../lib/validation');
const { validateCSRF } = require('../../lib/csrf');
const { ValidationError } = require('../../lib/errors');
const response = require('../../lib/response');
const { handleError } = require('../../lib/errors');
const { TABLES } = require('../../config/constants');

async function updateName(event) {
  try {
    // Validate CSRF protection header
    validateCSRF(event);

    const userId = await getUserIdFromEvent(event);
    const body = JSON.parse(event.body);

    // Validate input
    validateRequired(body, ['name']);

    const name = body.name.trim();

    if (name.length < 2) {
      throw new ValidationError('Name must be at least 2 characters long');
    }

    // Update Cognito
    await updateUserAttributes(userId, { name });

    // Update DynamoDB
    await updateItem(
      TABLES.USERS,
      { userId },
      {
        name,
        updatedAt: new Date().toISOString(),
      }
    );

    return response.ok({
      message: 'Name updated successfully',
      name,
    });
  } catch (error) {
    return handleError(error, response);
  }
}

module.exports = { updateName };

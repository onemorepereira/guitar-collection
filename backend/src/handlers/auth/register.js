/**
 * User registration handler
 */

const { registerUser } = require('../../lib/cognito');
const { putItem } = require('../../lib/dynamodb');
const { validateRegistration, sanitizeObject } = require('../../lib/validation');
const { validateCSRF } = require('../../lib/csrf');
const response = require('../../lib/response');
const { handleError } = require('../../lib/errors');
const { TABLES } = require('../../config/constants');

async function register(event) {
  try {
    // Validate CSRF protection header
    validateCSRF(event);

    const body = JSON.parse(event.body);
    const data = sanitizeObject(body);

    // Validate input
    validateRegistration(data);

    // Register user in Cognito
    const user = await registerUser(data.email, data.password, data.name);

    // Create user record in DynamoDB
    const userRecord = {
      userId: user.userId,
      email: user.email,
      name: user.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await putItem(TABLES.USERS, userRecord);

    // Return success (don't include password in response)
    return response.created({
      message: 'User registered successfully',
      user: {
        userId: user.userId,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    return handleError(error, response);
  }
}

module.exports = { register };

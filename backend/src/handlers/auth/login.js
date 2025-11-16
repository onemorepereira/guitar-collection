/**
 * User login handler
 */

const { authenticateUser } = require('../../lib/cognito');
const { validateLogin, sanitizeObject } = require('../../lib/validation');
const response = require('../../lib/response');
const { handleError } = require('../../lib/errors');

async function login(event) {
  try {
    const body = JSON.parse(event.body);
    const data = sanitizeObject(body);

    // Validate input
    validateLogin(data);

    // Authenticate with Cognito
    const tokens = await authenticateUser(data.email, data.password);

    return response.ok({
      message: 'Login successful',
      tokens: {
        accessToken: tokens.accessToken,
        idToken: tokens.idToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      },
    });
  } catch (error) {
    return handleError(error, response);
  }
}

module.exports = { login };

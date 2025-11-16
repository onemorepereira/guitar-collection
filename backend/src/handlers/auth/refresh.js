/**
 * Token refresh handler
 */

const { refreshTokens } = require('../../lib/cognito');
const { validateRequired } = require('../../lib/validation');
const response = require('../../lib/response');
const { handleError } = require('../../lib/errors');

async function refresh(event) {
  try {
    const body = JSON.parse(event.body);

    // Validate input
    validateRequired(body, ['refreshToken']);

    // Refresh tokens
    const tokens = await refreshTokens(body.refreshToken);

    return response.ok({
      message: 'Tokens refreshed successfully',
      tokens: {
        accessToken: tokens.accessToken,
        idToken: tokens.idToken,
        expiresIn: tokens.expiresIn,
      },
    });
  } catch (error) {
    return handleError(error, response);
  }
}

module.exports = { refresh };

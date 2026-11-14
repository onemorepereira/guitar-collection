/**
 * User login handler
 */

const jwt = require('jsonwebtoken');
const { authenticateUser } = require('../../lib/cognito');
const { isDeleting } = require('../../lib/accountJobs');
const { validateLogin, sanitizeObject } = require('../../lib/validation');
const response = require('../../lib/response');
const { handleError, CodedError } = require('../../lib/errors');

async function login(event) {
  try {
    const body = JSON.parse(event.body);
    const data = sanitizeObject(body);

    // Validate input
    validateLogin(data);

    // Authenticate with Cognito
    const tokens = await authenticateUser(data.email, data.password);

    // An account being deleted can't sign in again (no tokens issued). The ID
    // token was just issued by Cognito, so decoding (not verifying) is enough.
    const sub = jwt.decode(tokens.idToken)?.sub;
    if (await isDeleting(sub)) {
      throw new CodedError(403, 'Your account is being deleted.', 'ACCOUNT_DELETION_IN_PROGRESS');
    }

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

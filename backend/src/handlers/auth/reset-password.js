/**
 * Password reset handlers
 */

const { forgotPassword, confirmForgotPassword } = require('../../lib/cognito');
const { validateRequired, validatePassword } = require('../../lib/validation');
const { ValidationError } = require('../../lib/errors');
const response = require('../../lib/response');
const { handleError } = require('../../lib/errors');

/**
 * Initiate forgot password flow
 */
async function initiateForgotPassword(event) {
  try {
    const body = JSON.parse(event.body);

    // Validate input
    validateRequired(body, ['email']);

    // Initiate forgot password
    const result = await forgotPassword(body.email);

    return response.ok({
      message: 'Password reset code sent',
      destination: result.destination,
    });
  } catch (error) {
    return handleError(error, response);
  }
}

/**
 * Confirm forgot password with code
 */
async function confirmPasswordReset(event) {
  try {
    const body = JSON.parse(event.body);

    // Validate input
    validateRequired(body, ['email', 'code', 'newPassword']);

    // Validate new password
    const passwordValidation = validatePassword(body.newPassword);
    if (!passwordValidation.valid) {
      throw new ValidationError('Invalid password', { errors: passwordValidation.errors });
    }

    // Confirm password reset
    await confirmForgotPassword(body.email, body.code, body.newPassword);

    return response.ok({
      message: 'Password reset successfully',
    });
  } catch (error) {
    return handleError(error, response);
  }
}

module.exports = {
  initiateForgotPassword,
  confirmPasswordReset,
};

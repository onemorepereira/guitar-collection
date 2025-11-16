/**
 * Auth Lambda handler entry point
 * Routes requests to appropriate auth functions
 */

const { register } = require('./register');
const { login } = require('./login');
const { refresh } = require('./refresh');
const { initiateForgotPassword, confirmPasswordReset } = require('./reset-password');
const response = require('../../lib/response');
const logger = require('../../lib/logger');

/**
 * Main Lambda handler for auth operations
 */
exports.handler = async (event) => {
  let path = event.rawPath || event.path;
  const method = event.requestContext.http.method;

  logger.logRequest(event, `Auth ${method} ${path}`);

  // Remove stage prefix if present (e.g., /prod/auth/register -> /auth/register)
  const stage = event.requestContext.stage;
  if (stage && path.startsWith(`/${stage}/`)) {
    path = path.substring(stage.length + 1);
  }

  try {
    // Route to appropriate handler based on path
    if (path === '/auth/register' && method === 'POST') {
      return await register(event);
    }

    if (path === '/auth/login' && method === 'POST') {
      return await login(event);
    }

    if (path === '/auth/refresh' && method === 'POST') {
      return await refresh(event);
    }

    if (path === '/auth/forgot-password' && method === 'POST') {
      return await initiateForgotPassword(event);
    }

    if (path === '/auth/reset-password' && method === 'POST') {
      return await confirmPasswordReset(event);
    }

    // Unknown route
    return response.notFound('Route not found');
  } catch (error) {
    logger.error('Unhandled error in auth handler', {
      errorMessage: error.message,
      errorName: error.name,
      path,
      method,
      stack: error.stack,
    });
    return response.internalError('An unexpected error occurred');
  }
};

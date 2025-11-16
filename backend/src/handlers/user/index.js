/**
 * User Lambda handler entry point
 * Routes requests to appropriate user functions
 */

const { getProfile, updateProfile } = require('./profile');
const { updateName } = require('./update-name');
const response = require('../../lib/response');
const logger = require('../../lib/logger');

/**
 * Main Lambda handler for user operations
 */
exports.handler = async (event) => {
  let path = event.rawPath || event.path;
  const method = event.requestContext.http.method;

  logger.logRequest(event, `User ${method} ${path}`);

  // Remove stage prefix if present
  const stage = event.requestContext.stage;
  if (stage && path.startsWith(`/${stage}/`)) {
    path = path.substring(stage.length + 1);
  }

  try {
    // Route to appropriate handler based on path and method
    if (path === '/user/profile' && method === 'GET') {
      return await getProfile(event);
    }

    if (path === '/user/profile' && method === 'PUT') {
      return await updateProfile(event);
    }

    if (path === '/user/name' && method === 'PUT') {
      return await updateName(event);
    }

    // Unknown route
    return response.notFound('Route not found');
  } catch (error) {
    logger.error('Unhandled error in user handler', {
      errorMessage: error.message,
      errorName: error.name,
      path,
      method,
      stack: error.stack,
    });
    return response.internalError('An unexpected error occurred');
  }
};

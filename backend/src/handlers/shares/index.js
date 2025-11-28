/**
 * Shares Lambda handler entry point
 * Routes requests to appropriate share functions
 */

const { createShare } = require('./create');
const { listShares } = require('./list');
const { getShare } = require('./get');
const { updateShare } = require('./update');
const { deleteShare } = require('./delete');
const { getPublicShare } = require('./public-get');
const response = require('../../lib/response');
const logger = require('../../lib/logger');

/**
 * Main Lambda handler for share operations
 */
exports.handler = async (event) => {
  let path = event.rawPath || event.path;
  const method = event.requestContext.http.method;

  logger.logRequest(event, `Shares ${method} ${path}`);

  // Remove stage prefix if present
  const stage = event.requestContext.stage;
  if (stage && path.startsWith(`/${stage}/`)) {
    path = path.substring(stage.length + 1);
  }

  try {
    // Public endpoint (no auth required)
    if (path.match(/^\/public\/shares\/[^/]+$/) && method === 'GET') {
      return await getPublicShare(event);
    }

    // Authenticated endpoints
    if (path === '/shares' && method === 'GET') {
      return await listShares(event);
    }

    if (path === '/shares' && method === 'POST') {
      return await createShare(event);
    }

    if (path.match(/^\/shares\/[^/]+$/) && method === 'GET') {
      return await getShare(event);
    }

    if (path.match(/^\/shares\/[^/]+$/) && method === 'PATCH') {
      return await updateShare(event);
    }

    if (path.match(/^\/shares\/[^/]+$/) && method === 'DELETE') {
      return await deleteShare(event);
    }

    // Unknown route
    return response.notFound('Route not found');
  } catch (error) {
    logger.error('Unhandled error in shares handler', {
      errorMessage: error.message,
      errorName: error.name,
      path,
      method,
      stack: error.stack,
    });
    return response.internalError('An unexpected error occurred');
  }
};

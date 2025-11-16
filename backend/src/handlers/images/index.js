/**
 * Images Lambda handler entry point
 * Routes requests to appropriate image functions
 */

const { getUploadUrl } = require('./upload-url');
const { processUpload } = require('./process');
const response = require('../../lib/response');
const logger = require('../../lib/logger');

/**
 * Main Lambda handler for image operations
 */
exports.handler = async (event) => {
  let path = event.rawPath || event.path;
  const method = event.requestContext.http.method;

  logger.logRequest(event, `Images ${method} ${path}`);

  // Remove stage prefix if present
  const stage = event.requestContext.stage;
  if (stage && path.startsWith(`/${stage}/`)) {
    path = path.substring(stage.length + 1);
  }

  try {
    // Route to appropriate handler based on path
    if (path === '/images/upload-url' && method === 'POST') {
      return await getUploadUrl(event);
    }

    if (path === '/images/upload-complete' && method === 'POST') {
      return await processUpload(event);
    }

    // Unknown route
    return response.notFound('Route not found');
  } catch (error) {
    logger.error('Unhandled error in images handler', {
      errorMessage: error.message,
      errorName: error.name,
      path,
      method,
      stack: error.stack,
    });
    return response.internalError('An unexpected error occurred');
  }
};

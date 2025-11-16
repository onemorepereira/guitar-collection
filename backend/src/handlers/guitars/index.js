/**
 * Guitars Lambda handler entry point
 * Routes requests to appropriate guitar functions
 */

const { listGuitars } = require('./list');
const { createGuitar } = require('./create');
const { getGuitar } = require('./get');
const { updateGuitar } = require('./update');
const { deleteGuitar } = require('./delete');
const { getBrands } = require('./brands');
const response = require('../../lib/response');
const logger = require('../../lib/logger');

/**
 * Main Lambda handler for guitar operations
 */
exports.handler = async (event) => {
  let path = event.rawPath || event.path;
  const method = event.requestContext.http.method;

  logger.logRequest(event, `Guitars ${method} ${path}`);

  // Remove stage prefix if present
  const stage = event.requestContext.stage;
  if (stage && path.startsWith(`/${stage}/`)) {
    path = path.substring(stage.length + 1);
  }

  try {
    // Route to appropriate handler based on path and method
    if (path === '/guitars' && method === 'GET') {
      return await listGuitars(event);
    }

    if (path === '/guitars' && method === 'POST') {
      return await createGuitar(event);
    }

    if (path === '/guitars/brands' && method === 'GET') {
      return await getBrands(event);
    }

    if (path.match(/^\/guitars\/[^/]+$/) && method === 'GET') {
      return await getGuitar(event);
    }

    if (path.match(/^\/guitars\/[^/]+$/) && method === 'PUT') {
      return await updateGuitar(event);
    }

    if (path.match(/^\/guitars\/[^/]+$/) && method === 'DELETE') {
      return await deleteGuitar(event);
    }

    // Unknown route
    return response.notFound('Route not found');
  } catch (error) {
    logger.error('Unhandled error in guitars handler', {
      errorMessage: error.message,
      errorName: error.name,
      path,
      method,
      stack: error.stack,
    });
    return response.internalError('An unexpected error occurred');
  }
};

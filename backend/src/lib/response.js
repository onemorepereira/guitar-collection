/**
 * Response utility for Lambda functions
 */

/**
 * Create a successful HTTP response
 * @param {number} statusCode - HTTP status code
 * @param {object} data - Response data
 * @param {object} headers - Additional headers
 * @returns {object} Lambda proxy response
 */
function success(statusCode = 200, data = {}, headers = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      'Access-Control-Allow-Credentials': true,
      ...headers,
    },
    body: JSON.stringify(data),
  };
}

/**
 * Create an error HTTP response
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {object} details - Additional error details
 * @param {object} headers - Additional headers
 * @returns {object} Lambda proxy response
 */
function error(statusCode = 500, message = 'Internal Server Error', details = {}, headers = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      'Access-Control-Allow-Credentials': true,
      ...headers,
    },
    body: JSON.stringify({
      error: message,
      ...details,
    }),
  };
}

/**
 * Create a 200 OK response
 * @param {object} data - Response data
 * @returns {object} Lambda proxy response
 */
function ok(data) {
  return success(200, data);
}

/**
 * Create a 201 Created response
 * @param {object} data - Response data
 * @returns {object} Lambda proxy response
 */
function created(data) {
  return success(201, data);
}

/**
 * Create a 400 Bad Request response
 * @param {string} message - Error message
 * @param {object} details - Additional error details
 * @returns {object} Lambda proxy response
 */
function badRequest(message = 'Bad Request', details = {}) {
  return error(400, message, details);
}

/**
 * Create a 401 Unauthorized response
 * @param {string} message - Error message
 * @returns {object} Lambda proxy response
 */
function unauthorized(message = 'Unauthorized') {
  return error(401, message);
}

/**
 * Create a 403 Forbidden response
 * @param {string} message - Error message
 * @returns {object} Lambda proxy response
 */
function forbidden(message = 'Forbidden') {
  return error(403, message);
}

/**
 * Create a 404 Not Found response
 * @param {string} message - Error message
 * @returns {object} Lambda proxy response
 */
function notFound(message = 'Not Found') {
  return error(404, message);
}

/**
 * Create a 409 Conflict response
 * @param {string} message - Error message
 * @param {object} details - Additional error details
 * @returns {object} Lambda proxy response
 */
function conflict(message = 'Conflict', details = {}) {
  return error(409, message, details);
}

/**
 * Create a 500 Internal Server Error response
 * @param {string} message - Error message
 * @returns {object} Lambda proxy response
 */
function internalError(message = 'Internal Server Error') {
  return error(500, message);
}

module.exports = {
  success,
  error,
  ok,
  created,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  internalError,
};

/**
 * CSRF (Cross-Site Request Forgery) protection middleware
 *
 * Validates custom headers that cannot be set by cross-origin requests
 * without explicit JavaScript access (which is prevented by CORS)
 */

const { AuthorizationError } = require('./errors');

/**
 * Allowed origins for CSRF validation
 * These should match your CORS configuration
 *
 * In production, only allow the production domain (from environment variable)
 * In development/test, also allow localhost origins
 */
const FRONTEND_DOMAIN = process.env.FRONTEND_DOMAIN || 'http://localhost:5173';

const ALLOWED_ORIGINS = process.env.NODE_ENV === 'prod'
  ? [
      `https://${FRONTEND_DOMAIN}`
    ]
  : [
      `https://${FRONTEND_DOMAIN}`,
      'http://localhost:5173',     // Local development
      'http://localhost:5174',     // Alternative local port
      'http://localhost:3000'      // Alternative local port
    ];

/**
 * Validate CSRF protection headers
 * Ensures request came from an authorized origin and contains custom headers
 *
 * @param {Object} event - Lambda event object
 * @throws {AuthorizationError} If CSRF validation fails
 * @returns {boolean} True if validation passes
 */
function validateCSRFHeaders(event) {
  const headers = event.headers || {};

  // Normalize header names (API Gateway may lowercase them)
  const normalizedHeaders = {};
  for (const [key, value] of Object.entries(headers)) {
    normalizedHeaders[key.toLowerCase()] = value;
  }

  // 1. Validate custom header (CSRF protection - cannot be set by cross-origin requests)
  const requestedWith = normalizedHeaders['x-requested-with'];
  if (requestedWith !== 'XMLHttpRequest') {
    throw new AuthorizationError('Missing required security header');
  }

  // 2. Validate Origin header
  const origin = normalizedHeaders['origin'];
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    throw new AuthorizationError(`Invalid origin: ${origin}`);
  }

  // 3. Validate Referer header (backup check)
  const referer = normalizedHeaders['referer'];
  if (referer) {
    const isValidReferer = ALLOWED_ORIGINS.some(allowedOrigin =>
      referer.startsWith(allowedOrigin)
    );

    if (!isValidReferer) {
      throw new AuthorizationError('Invalid referer');
    }
  }

  return true;
}

/**
 * Validate CSRF for state-changing operations
 * Should be called for POST, PUT, DELETE requests
 *
 * @param {Object} event - Lambda event object
 * @returns {boolean} True if validation passes
 */
function validateCSRF(event) {
  const method = event.requestContext?.http?.method || event.httpMethod;

  // Only validate CSRF for state-changing operations
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    return validateCSRFHeaders(event);
  }

  // GET and OPTIONS requests don't need CSRF validation
  return true;
}

/**
 * Check if request is from an allowed origin
 *
 * @param {Object} event - Lambda event object
 * @returns {boolean} True if origin is allowed
 */
function isAllowedOrigin(event) {
  const headers = event.headers || {};
  const origin = headers['origin'] || headers['Origin'];

  if (!origin) {
    // No origin header (might be same-origin request or direct API call)
    return true;
  }

  return ALLOWED_ORIGINS.includes(origin);
}

module.exports = {
  validateCSRF,
  validateCSRFHeaders,
  isAllowedOrigin,
  ALLOWED_ORIGINS
};

/**
 * Structured logging utility
 * Provides secure, production-safe logging with automatic sanitization
 */

/**
 * Sensitive field patterns to redact from logs
 */
const SENSITIVE_PATTERNS = [
  'password',
  'token',
  'authorization',
  'auth',
  'secret',
  'apikey',
  'api_key',
  'accesstoken',
  'refreshtoken',
  'sessionid',
  'cookie',
];

/**
 * Check if a key contains sensitive data
 * @param {string} key - Object key to check
 * @returns {boolean} True if key is sensitive
 */
function isSensitiveKey(key) {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_PATTERNS.some(pattern => lowerKey.includes(pattern));
}

/**
 * Sanitize an object by redacting sensitive fields
 * @param {*} data - Data to sanitize
 * @returns {*} Sanitized data
 */
function sanitizeData(data) {
  if (!data) return data;

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }

  // Handle objects
  if (typeof data === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      if (isSensitiveKey(key)) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeData(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  // Return primitives as-is
  return data;
}

/**
 * Create structured log entry
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {object} metadata - Additional metadata
 * @returns {object} Structured log entry
 */
function createLogEntry(level, message, metadata = {}) {
  return {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    message,
    environment: process.env.NODE_ENV || 'development',
    ...sanitizeData(metadata),
  };
}

/**
 * Log at INFO level
 * Use for general information about application flow
 *
 * @param {string} message - Log message
 * @param {object} metadata - Additional context
 */
function info(message, metadata = {}) {
  const entry = createLogEntry('INFO', message, metadata);
  console.log(JSON.stringify(entry));
}

/**
 * Log at WARN level
 * Use for potentially harmful situations
 *
 * @param {string} message - Log message
 * @param {object} metadata - Additional context
 */
function warn(message, metadata = {}) {
  const entry = createLogEntry('WARN', message, metadata);
  console.warn(JSON.stringify(entry));
}

/**
 * Log at ERROR level
 * Use for error events
 *
 * @param {string} message - Log message
 * @param {object} metadata - Additional context (error details, stack traces)
 */
function error(message, metadata = {}) {
  // Include stack trace only in non-production
  const entry = createLogEntry('ERROR', message, {
    ...metadata,
    stack: process.env.NODE_ENV !== 'prod' ? metadata.stack : undefined,
  });
  console.error(JSON.stringify(entry));
}

/**
 * Log at DEBUG level
 * Only logs in non-production environments
 *
 * @param {string} message - Log message
 * @param {object} metadata - Additional context
 */
function debug(message, metadata = {}) {
  // Only log debug messages in non-production
  if (process.env.NODE_ENV === 'prod') {
    return;
  }

  const entry = createLogEntry('DEBUG', message, metadata);
  console.log(JSON.stringify(entry));
}

/**
 * Log request context (sanitized)
 * Useful for tracking requests without exposing sensitive data
 *
 * @param {object} event - Lambda event object
 * @param {string} action - Action being performed
 */
function logRequest(event, action) {
  info(`Request: ${action}`, {
    action,
    path: event.rawPath || event.path,
    method: event.requestContext?.http?.method || event.httpMethod,
    requestId: event.requestContext?.requestId,
    // Don't log full event, headers, or body
  });
}

/**
 * Log response (sanitized)
 *
 * @param {string} action - Action performed
 * @param {number} statusCode - HTTP status code
 * @param {object} metadata - Additional context
 */
function logResponse(action, statusCode, metadata = {}) {
  info(`Response: ${action}`, {
    action,
    statusCode,
    ...metadata,
  });
}

module.exports = {
  info,
  warn,
  error,
  debug,
  logRequest,
  logResponse,
  sanitizeData,
};

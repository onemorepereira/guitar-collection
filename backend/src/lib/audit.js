/**
 * Security audit logging library
 * Provides standardized logging for security-sensitive events
 *
 * This module logs events that are critical for security monitoring:
 * - Authentication events (login, logout, failures)
 * - Authorization violations (unauthorized access attempts)
 * - Resource modifications (create, update, delete)
 * - Sensitive data access
 *
 * All logs are sent to CloudWatch for retention and analysis
 */

const logger = require('./logger');

/**
 * Security event types
 */
const SECURITY_EVENTS = {
  // Authentication
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  REGISTER_SUCCESS: 'REGISTER_SUCCESS',
  REGISTER_FAILED: 'REGISTER_FAILED',
  LOGOUT: 'LOGOUT',
  PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED: 'PASSWORD_RESET_COMPLETED',

  // Authorization
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
  FORBIDDEN_ACTION: 'FORBIDDEN_ACTION',

  // Resource operations
  GUITAR_CREATED: 'GUITAR_CREATED',
  GUITAR_UPDATED: 'GUITAR_UPDATED',
  GUITAR_DELETED: 'GUITAR_DELETED',
  GUITAR_ACCESSED: 'GUITAR_ACCESSED',

  DOCUMENT_CREATED: 'DOCUMENT_CREATED',
  DOCUMENT_UPDATED: 'DOCUMENT_UPDATED',
  DOCUMENT_DELETED: 'DOCUMENT_DELETED',
  DOCUMENT_ACCESSED: 'DOCUMENT_ACCESSED',

  PROVENANCE_REPORT_GENERATED: 'PROVENANCE_REPORT_GENERATED',
  PROVENANCE_REPORT_DELETED: 'PROVENANCE_REPORT_DELETED',

  IMAGE_UPLOADED: 'IMAGE_UPLOADED',
  IMAGE_DELETED: 'IMAGE_DELETED',

  // Data export/bulk operations
  DATA_EXPORTED: 'DATA_EXPORTED',
  BULK_OPERATION: 'BULK_OPERATION',

  // Profile changes
  PROFILE_UPDATED: 'PROFILE_UPDATED',
  EMAIL_CHANGED: 'EMAIL_CHANGED',
};

/**
 * Result types for security events
 */
const RESULT = {
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
  BLOCKED: 'BLOCKED',
};

/**
 * Extract IP address from Lambda event
 * @param {object} event - Lambda event
 * @returns {string} IP address
 */
function getIpAddress(event) {
  return event.requestContext?.http?.sourceIp ||
         event.requestContext?.identity?.sourceIp ||
         'UNKNOWN';
}

/**
 * Extract user agent from Lambda event
 * @param {object} event - Lambda event
 * @returns {string} User agent
 */
function getUserAgent(event) {
  return event.headers?.['user-agent'] ||
         event.headers?.['User-Agent'] ||
         'UNKNOWN';
}

/**
 * Log a security event
 *
 * @param {object} event - Lambda event object (for IP, user agent extraction)
 * @param {string} userId - User ID (or 'UNAUTHENTICATED')
 * @param {string} action - Security event type (use SECURITY_EVENTS constants)
 * @param {string} result - Event result (SUCCESS, FAILURE, BLOCKED)
 * @param {object} metadata - Additional metadata about the event
 */
function logSecurityEvent(event, userId, action, result, metadata = {}) {
  // Build security event log
  const securityEvent = {
    timestamp: new Date().toISOString(),
    eventType: 'SECURITY_EVENT',
    userId: userId || 'UNAUTHENTICATED',
    action,
    result,
    ipAddress: getIpAddress(event),
    userAgent: getUserAgent(event),
    requestId: event.requestContext?.requestId,
    path: event.rawPath || event.path,
    method: event.requestContext?.http?.method || event.httpMethod,
    ...metadata,
  };

  // Log based on result
  if (result === RESULT.FAILURE || result === RESULT.BLOCKED) {
    logger.warn(`Security Event: ${action} - ${result}`, securityEvent);
  } else {
    logger.info(`Security Event: ${action} - ${result}`, securityEvent);
  }
}

/**
 * Log authentication event
 * @param {object} event - Lambda event
 * @param {string} email - User email
 * @param {string} action - AUTH event type
 * @param {string} result - Result
 * @param {object} metadata - Additional data
 */
function logAuthEvent(event, email, action, result, metadata = {}) {
  logSecurityEvent(event, email, action, result, {
    ...metadata,
    email, // Include email for auth events
  });
}

/**
 * Log resource access attempt
 * @param {object} event - Lambda event
 * @param {string} userId - User ID
 * @param {string} resourceType - Type of resource (guitar, document, etc)
 * @param {string} resourceId - Resource ID
 * @param {string} operation - Operation attempted (read, write, delete)
 * @param {boolean} success - Whether access was granted
 * @param {object} metadata - Additional data
 */
function logResourceAccess(event, userId, resourceType, resourceId, operation, success, metadata = {}) {
  const action = success ? `${resourceType}_${operation}`.toUpperCase() : 'UNAUTHORIZED_ACCESS';
  const result = success ? RESULT.SUCCESS : RESULT.FAILURE;

  logSecurityEvent(event, userId, action, result, {
    resourceType,
    resourceId,
    operation,
    ...metadata,
  });
}

/**
 * Log data deletion event (always log deletes for audit trail)
 * @param {object} event - Lambda event
 * @param {string} userId - User ID
 * @param {string} resourceType - Type of resource
 * @param {string} resourceId - Resource ID
 * @param {object} metadata - Additional data (e.g., resource details before deletion)
 */
function logDeletion(event, userId, resourceType, resourceId, metadata = {}) {
  const action = `${resourceType}_DELETED`.toUpperCase();

  logSecurityEvent(event, userId, action, RESULT.SUCCESS, {
    resourceType,
    resourceId,
    ...metadata,
  });
}

/**
 * Log bulk operation (multiple resources affected)
 * @param {object} event - Lambda event
 * @param {string} userId - User ID
 * @param {string} operation - Operation performed
 * @param {number} count - Number of resources affected
 * @param {object} metadata - Additional data
 */
function logBulkOperation(event, userId, operation, count, metadata = {}) {
  logSecurityEvent(event, userId, SECURITY_EVENTS.BULK_OPERATION, RESULT.SUCCESS, {
    operation,
    count,
    ...metadata,
  });
}

module.exports = {
  logSecurityEvent,
  logAuthEvent,
  logResourceAccess,
  logDeletion,
  logBulkOperation,
  SECURITY_EVENTS,
  RESULT,
};

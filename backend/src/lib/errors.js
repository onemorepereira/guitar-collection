/**
 * Custom error classes for the application
 */

const logger = require('./logger');

class AppError extends Error {
  constructor(message, statusCode = 500, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation Error', details = {}) {
    super(message, 400, details);
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication Failed') {
    super(message, 401);
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Access Denied') {
    super(message, 403);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource Not Found') {
    super(message, 404);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource Conflict', details = {}) {
    super(message, 409, details);
  }
}

class ExternalServiceError extends AppError {
  constructor(message = 'External Service Error', details = {}) {
    super(message, 502, details);
  }
}

/**
 * Sanitize error details for safe exposure to clients
 * @param {object} details - Error details object
 * @returns {object} Sanitized details (only in dev mode)
 */
function sanitizeErrorDetails(details) {
  // Never expose error details in production
  if (process.env.NODE_ENV === 'prod') {
    return undefined;
  }

  // In development, return details but exclude sensitive fields
  const { password, token, secret, apiKey, ...safeDetails } = details || {};
  return Object.keys(safeDetails).length > 0 ? safeDetails : undefined;
}

/**
 * Handle errors and convert to appropriate response
 * @param {Error} error - The error to handle
 * @param {object} response - Response utilities
 * @returns {object} Lambda proxy response
 */
function handleError(error, response) {
  // Log the full error for debugging
  logger.error('Error in handler', {
    errorMessage: error.message,
    errorName: error.name,
    errorCode: error.code,
    statusCode: error.statusCode,
    stack: error.stack,
  });

  if (error instanceof AppError) {
    const sanitizedDetails = sanitizeErrorDetails(error.details);
    return response.error(error.statusCode, error.message, sanitizedDetails);
  }

  // AWS SDK errors - use generic messages to avoid leaking implementation details
  if (error.code) {
    switch (error.code) {
      case 'ConditionalCheckFailedException':
        return response.conflict('Item already exists or condition not met');
      case 'ResourceNotFoundException':
        return response.notFound('Resource not found');
      case 'ValidationException':
        // Don't expose AWS validation details
        return response.badRequest('Invalid request parameters');
      case 'UnauthorizedException':
        return response.unauthorized('Invalid credentials');
      case 'NotAuthorizedException':
        return response.unauthorized('Not authorized');
      case 'UserNotFoundException':
        return response.notFound('User not found');
      case 'UsernameExistsException':
        return response.conflict('User already exists');
      case 'InvalidParameterException':
        return response.badRequest('Invalid parameters provided');
      case 'TooManyRequestsException':
        return response.error(429, 'Too many requests. Please try again later.');
      default:
        logger.warn('Unhandled AWS error code', {
          errorCode: error.code,
          errorMessage: error.message,
        });
        return response.internalError('An unexpected error occurred');
    }
  }

  // Default to internal server error with no details
  return response.internalError('An unexpected error occurred');
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  ExternalServiceError,
  handleError,
};

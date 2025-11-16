/**
 * Validation utilities for request data
 */

const { ValidationError } = require('./errors');

/**
 * Validate email format (RFC 5322 compliant)
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 *
 * Validates:
 * - Local part: alphanumeric + allowed special chars (. ! # $ % & ' * + - / = ? ^ _ ` { | } ~)
 * - Domain: valid hostname with proper structure
 * - TLD: at least 2 characters
 *
 * Rejects:
 * - Consecutive dots
 * - Leading/trailing dots
 * - Invalid characters
 * - Numeric-only TLDs
 * - Single character TLDs
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Basic length check (RFC 5321)
  if (email.length > 254) {
    return false;
  }

  // More comprehensive RFC 5322-compliant regex
  // Allows most valid emails while rejecting obviously invalid ones
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!emailRegex.test(email)) {
    return false;
  }

  // Split and validate parts
  const [localPart, domain] = email.split('@');

  // Validate local part
  if (!localPart || localPart.length > 64) {
    return false;
  }

  // Check for consecutive dots or leading/trailing dots in local part
  if (localPart.includes('..') || localPart.startsWith('.') || localPart.endsWith('.')) {
    return false;
  }

  // Validate domain
  if (!domain || domain.length > 253) {
    return false;
  }

  // Domain must have at least one dot
  if (!domain.includes('.')) {
    return false;
  }

  // Check TLD (last part after final dot)
  const tld = domain.split('.').pop();

  // TLD must be at least 2 characters and not all numeric
  if (!tld || tld.length < 2 || /^\d+$/.test(tld)) {
    return false;
  }

  return true;
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} Validation result
 */
function validatePassword(password) {
  const errors = [];

  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate required fields in an object
 * @param {object} data - Data to validate
 * @param {string[]} requiredFields - Array of required field names
 * @throws {ValidationError} If validation fails
 */
function validateRequired(data, requiredFields) {
  const missing = [];
  const invalid = [];

  for (const field of requiredFields) {
    if (!(field in data)) {
      missing.push(field);
    } else if (data[field] === null || data[field] === undefined || data[field] === '') {
      invalid.push(field);
    }
  }

  if (missing.length > 0 || invalid.length > 0) {
    throw new ValidationError('Validation failed', {
      missingFields: missing,
      invalidFields: invalid,
    });
  }
}

/**
 * Validate guitar data
 * @param {object} guitar - Guitar data to validate
 * @throws {ValidationError} If validation fails
 */
function validateGuitar(guitar) {
  const required = ['brand', 'model', 'year'];
  validateRequired(guitar, required);

  const errors = [];

  // Validate year
  if (guitar.year) {
    const year = parseInt(guitar.year);
    const currentYear = new Date().getFullYear();
    if (isNaN(year) || year < 1900 || year > currentYear + 1) {
      errors.push('Year must be between 1900 and current year');
    }
  }

  // Validate price if provided
  if (guitar.price !== undefined && guitar.price !== null) {
    const price = parseFloat(guitar.price);
    if (isNaN(price) || price < 0) {
      errors.push('Price must be a positive number');
    }
  }

  // Validate serial number format if provided
  if (guitar.serialNumber && typeof guitar.serialNumber !== 'string') {
    errors.push('Serial number must be a string');
  }

  if (errors.length > 0) {
    throw new ValidationError('Invalid guitar data', { errors });
  }
}

/**
 * Validate user registration data
 * @param {object} data - Registration data
 * @throws {ValidationError} If validation fails
 */
function validateRegistration(data) {
  const required = ['email', 'password', 'name'];
  validateRequired(data, required);

  const errors = [];

  // Validate email
  if (!isValidEmail(data.email)) {
    errors.push('Invalid email format');
  }

  // Validate password
  const passwordValidation = validatePassword(data.password);
  if (!passwordValidation.valid) {
    errors.push(...passwordValidation.errors);
  }

  // Validate name
  if (data.name.length < 2) {
    errors.push('Name must be at least 2 characters long');
  }

  if (errors.length > 0) {
    throw new ValidationError('Registration validation failed', { errors });
  }
}

/**
 * Validate login data
 * @param {object} data - Login data
 * @throws {ValidationError} If validation fails
 */
function validateLogin(data) {
  const required = ['email', 'password'];
  validateRequired(data, required);

  if (!isValidEmail(data.email)) {
    throw new ValidationError('Invalid email format');
  }
}

/**
 * Sanitize string input
 * @param {string} input - Input to sanitize
 * @returns {string} Sanitized input
 */
function sanitizeString(input) {
  if (typeof input !== 'string') {
    return input;
  }
  return input.trim();
}

/**
 * Sanitize object by trimming all string values
 * @param {object} obj - Object to sanitize
 * @returns {object} Sanitized object
 */
function sanitizeObject(obj) {
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = value.trim();
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Allowed fields for guitar creation/updates
 * This prevents NoSQL injection by rejecting unauthorized fields
 */
const ALLOWED_GUITAR_FIELDS = [
  // Basic info
  'brand', 'model', 'year', 'type', 'color', 'serialNumber',

  // Purchase info (in privateInfo object)
  'purchaseDate', 'purchasePrice', 'purchaseLocation', 'receiptUrl',

  // Value tracking
  'currentValue', 'lastValueUpdate',

  // Condition & description
  'condition', 'notes', 'tags',

  // Specifications (includes both new and legacy field names)
  'bodyStyle', 'bodyWood', 'bodyMaterial', 'topWood', 'backWood', 'sideWood',
  'neckWood', 'neckMaterial', 'fretboardWood', 'fretboardMaterial',
  'fretCount', 'numberOfFrets', 'scaleLength',
  'nutWidth', 'neckProfile', 'neckJoint', 'nut',

  // Hardware & electronics (includes both new and legacy field names)
  'pickups', 'pickupConfiguration', 'bridge', 'tuners', 'tuningMachines',
  'hardware', 'electronics', 'controls',

  // Additional details
  'finish', 'binding', 'inlays', 'modifications',
  'caseIncluded', 'caseType', 'countryOfOrigin',

  // Nested objects
  'detailedSpecs', 'privateInfo', 'images', 'documents',

  // Document references (new schema)
  'documentIds'
];

/**
 * Protected fields that cannot be updated by users
 */
const PROTECTED_FIELDS = [
  'id', 'userId', 'createdAt'
];

/**
 * Allowed fields for user updates
 */
const ALLOWED_USER_FIELDS = [
  'name', 'email'
];

/**
 * Validate and filter object fields against whitelist
 * Prevents NoSQL injection and unauthorized field updates
 *
 * @param {object} data - Data object to validate
 * @param {string[]} allowedFields - Array of allowed field names
 * @param {string[]} protectedFields - Array of protected field names that cannot be updated
 * @throws {ValidationError} If invalid or protected fields are present
 * @returns {object} Filtered object containing only allowed fields
 */
function validateAndFilterFields(data, allowedFields, protectedFields = []) {
  const dataFields = Object.keys(data);

  // Check for protected fields
  const attemptedProtected = dataFields.filter(field =>
    protectedFields.includes(field)
  );

  if (attemptedProtected.length > 0) {
    throw new ValidationError(
      `Cannot update protected fields: ${attemptedProtected.join(', ')}`
    );
  }

  // Check for invalid fields
  const invalidFields = dataFields.filter(field =>
    !allowedFields.includes(field)
  );

  if (invalidFields.length > 0) {
    throw new ValidationError(
      `Invalid fields: ${invalidFields.join(', ')}`
    );
  }

  // Return filtered object (only allowed fields)
  const filtered = {};
  for (const field of allowedFields) {
    if (field in data) {
      filtered[field] = data[field];
    }
  }

  return filtered;
}

/**
 * Validate guitar update fields
 * Ensures only allowed fields are being updated
 *
 * @param {object} updates - Guitar update data
 * @throws {ValidationError} If validation fails
 * @returns {object} Filtered updates
 */
function validateGuitarUpdateFields(updates) {
  return validateAndFilterFields(
    updates,
    ALLOWED_GUITAR_FIELDS,
    PROTECTED_FIELDS
  );
}

/**
 * Validate user update fields
 * Ensures only allowed fields are being updated
 *
 * @param {object} updates - User update data
 * @throws {ValidationError} If validation fails
 * @returns {object} Filtered updates
 */
function validateUserUpdateFields(updates) {
  return validateAndFilterFields(
    updates,
    ALLOWED_USER_FIELDS,
    ['id', 'createdAt']
  );
}

/**
 * Validate UUID format (UUIDv4)
 * @param {string} uuid - UUID to validate
 * @returns {boolean} True if valid UUIDv4
 */
function isValidUUID(uuid) {
  if (!uuid || typeof uuid !== 'string') {
    return false;
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate path parameter (typically a UUID or ID)
 * @param {string} param - Path parameter to validate
 * @param {string} paramName - Name of parameter (for error messages)
 * @throws {ValidationError} If validation fails
 */
function validatePathParameter(param, paramName = 'id') {
  if (!param) {
    throw new ValidationError(`Missing required path parameter: ${paramName}`);
  }
  if (!isValidUUID(param)) {
    throw new ValidationError(`Invalid ${paramName} format`);
  }
}

/**
 * Validate query parameters for guitar list endpoint
 * @param {object} params - Query parameters object
 * @throws {ValidationError} If validation fails
 * @returns {object} Validated and parsed parameters
 */
function validateListQueryParams(params) {
  const errors = [];
  const validated = {};

  // Validate yearMin
  if (params.yearMin !== undefined && params.yearMin !== '') {
    const yearMin = parseInt(params.yearMin);
    if (isNaN(yearMin) || yearMin < 1900 || yearMin > new Date().getFullYear() + 1) {
      errors.push('yearMin must be a valid year between 1900 and current year');
    } else {
      validated.yearMin = yearMin;
    }
  }

  // Validate yearMax
  if (params.yearMax !== undefined && params.yearMax !== '') {
    const yearMax = parseInt(params.yearMax);
    if (isNaN(yearMax) || yearMax < 1900 || yearMax > new Date().getFullYear() + 1) {
      errors.push('yearMax must be a valid year between 1900 and current year');
    } else {
      validated.yearMax = yearMax;
    }
  }

  // Validate search length
  if (params.search !== undefined && params.search !== '') {
    if (params.search.length > 200) {
      errors.push('search parameter must be 200 characters or less');
    } else {
      validated.search = params.search.trim();
    }
  }

  // Validate brand (string, no special validation needed)
  if (params.brand !== undefined && params.brand !== '') {
    validated.brand = params.brand.trim();
  }

  // Validate type (string, no special validation needed)
  if (params.type !== undefined && params.type !== '') {
    validated.type = params.type.trim();
  }

  if (errors.length > 0) {
    throw new ValidationError('Invalid query parameters', { errors });
  }

  return validated;
}

/**
 * Validate integer parameter
 * @param {string|number} value - Value to validate
 * @param {string} paramName - Parameter name for error messages
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @throws {ValidationError} If validation fails
 * @returns {number} Parsed integer
 */
function validateIntegerParam(value, paramName, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
  const num = parseInt(value);
  if (isNaN(num)) {
    throw new ValidationError(`${paramName} must be a valid integer`);
  }
  if (num < min || num > max) {
    throw new ValidationError(`${paramName} must be between ${min} and ${max}`);
  }
  return num;
}

module.exports = {
  isValidEmail,
  validatePassword,
  validateRequired,
  validateGuitar,
  validateRegistration,
  validateLogin,
  sanitizeString,
  sanitizeObject,
  validateAndFilterFields,
  validateGuitarUpdateFields,
  validateUserUpdateFields,
  isValidUUID,
  validatePathParameter,
  validateListQueryParams,
  validateIntegerParam,
  ALLOWED_GUITAR_FIELDS,
  ALLOWED_USER_FIELDS,
  PROTECTED_FIELDS,
};

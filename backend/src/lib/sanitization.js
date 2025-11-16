/**
 * Input sanitization utilities to prevent XSS and injection attacks
 * Using sanitize-html (Lambda-compatible, no jsdom dependency)
 */

const sanitizeHtml = require('sanitize-html');

/**
 * Maximum field lengths to prevent buffer overflow attacks
 */
const MAX_LENGTHS = {
  brand: 100,
  model: 200,
  color: 100,
  serialNumber: 100,
  condition: 50,
  bodyStyle: 100,
  bodyWood: 100,
  neckWood: 100,
  fretboardWood: 100,
  pickups: 500,
  hardware: 500,
  electronics: 500,
  modifications: 1000,
  notes: 10000,
  name: 200,
  email: 255
};

/**
 * Sanitize a single string value
 * Removes all HTML tags and dangerous characters
 *
 * @param {string} input - Raw input string
 * @param {Object} options - Sanitization options
 * @returns {string} Sanitized string
 */
function sanitizeString(input, options = {}) {
  if (typeof input !== 'string') {
    return input;
  }

  // Trim whitespace
  let sanitized = input.trim();

  if (options.allowBasicFormatting) {
    // For notes and descriptions - allow some basic formatting
    sanitized = sanitizeHtml(sanitized, {
      allowedTags: ['b', 'i', 'em', 'strong', 'br', 'p'],
      allowedAttributes: {},
      disallowedTagsMode: 'discard'
    });
  } else {
    // Strict mode - remove all HTML tags
    sanitized = sanitizeHtml(sanitized, {
      allowedTags: [],
      allowedAttributes: {},
      disallowedTagsMode: 'discard'
    });
  }

  // Validate length if specified
  if (options.maxLength && sanitized.length > options.maxLength) {
    throw new Error(`Input exceeds maximum length of ${options.maxLength} characters`);
  }

  return sanitized;
}

/**
 * Recursively sanitize an object
 * Handles nested objects and arrays
 *
 * @param {Object} input - Raw input object
 * @param {Object} fieldOptions - Field-specific sanitization options
 * @returns {Object} Sanitized object
 */
function sanitizeObject(input, fieldOptions = {}) {
  if (input === null || input === undefined) {
    return input;
  }

  // Handle arrays
  if (Array.isArray(input)) {
    return input.map(item => {
      if (typeof item === 'object') {
        return sanitizeObject(item, fieldOptions);
      }
      return sanitizeString(item);
    });
  }

  // Handle objects
  if (typeof input === 'object') {
    const sanitized = {};

    for (const [key, value] of Object.entries(input)) {
      // Sanitize the key itself
      const sanitizedKey = sanitizeString(key);

      if (value === null || value === undefined) {
        sanitized[sanitizedKey] = value;
      } else if (typeof value === 'string') {
        // Get field-specific options
        const options = fieldOptions[key] || {};

        // Apply max length from predefined limits
        if (!options.maxLength && MAX_LENGTHS[key]) {
          options.maxLength = MAX_LENGTHS[key];
        }

        sanitized[sanitizedKey] = sanitizeString(value, options);
      } else if (typeof value === 'object') {
        // Recursively sanitize nested objects
        sanitized[sanitizedKey] = sanitizeObject(value, fieldOptions);
      } else {
        // Keep other types as-is (numbers, booleans)
        sanitized[sanitizedKey] = value;
      }
    }

    return sanitized;
  }

  // Return primitive types as-is
  return input;
}

/**
 * Sanitize guitar data with field-specific rules
 *
 * @param {Object} guitarData - Raw guitar data from request
 * @returns {Object} Sanitized guitar data
 */
function sanitizeGuitarData(guitarData) {
  const fieldOptions = {
    notes: { allowBasicFormatting: true, maxLength: MAX_LENGTHS.notes },
    modifications: { allowBasicFormatting: true, maxLength: MAX_LENGTHS.modifications },
    pickups: { maxLength: MAX_LENGTHS.pickups },
    hardware: { maxLength: MAX_LENGTHS.hardware },
    electronics: { maxLength: MAX_LENGTHS.electronics }
  };

  return sanitizeObject(guitarData, fieldOptions);
}

/**
 * Sanitize user input data
 *
 * @param {Object} userData - Raw user data from request
 * @returns {Object} Sanitized user data
 */
function sanitizeUserData(userData) {
  const fieldOptions = {
    name: { maxLength: MAX_LENGTHS.name },
    email: { maxLength: MAX_LENGTHS.email }
  };

  return sanitizeObject(userData, fieldOptions);
}

/**
 * Validate string length
 *
 * @param {string} field - Field name
 * @param {string} value - Field value
 * @param {number} maxLength - Maximum allowed length
 * @throws {Error} If value exceeds max length
 */
function validateLength(field, value, maxLength) {
  if (value && value.length > maxLength) {
    throw new Error(`${field} exceeds maximum length of ${maxLength} characters`);
  }
}

/**
 * Sanitize and validate all fields in an object
 *
 * @param {Object} data - Raw input data
 * @param {Object} options - Sanitization options
 * @returns {Object} Sanitized and validated data
 */
function sanitizeAndValidate(data, options = {}) {
  // First sanitize
  const sanitized = sanitizeObject(data, options.fieldOptions || {});

  // Then validate lengths
  if (options.validateLengths) {
    for (const [field, value] of Object.entries(sanitized)) {
      if (typeof value === 'string' && MAX_LENGTHS[field]) {
        validateLength(field, value, MAX_LENGTHS[field]);
      }
    }
  }

  return sanitized;
}

module.exports = {
  sanitizeString,
  sanitizeObject,
  sanitizeGuitarData,
  sanitizeUserData,
  sanitizeAndValidate,
  validateLength,
  MAX_LENGTHS
};

/**
 * File signature (magic number) validation
 * Validates actual file content, not just MIME type headers
 */

const { ValidationError } = require('./errors');

/**
 * Known file signatures (magic numbers)
 * First 4 bytes of known file types in hexadecimal
 */
const FILE_SIGNATURES = {
  // JPEG
  'ffd8ffe0': { type: 'image/jpeg', extension: 'jpg' },
  'ffd8ffe1': { type: 'image/jpeg', extension: 'jpg' },
  'ffd8ffe2': { type: 'image/jpeg', extension: 'jpg' },
  'ffd8ffe3': { type: 'image/jpeg', extension: 'jpg' },
  'ffd8ffe8': { type: 'image/jpeg', extension: 'jpg' },
  'ffd8ffdb': { type: 'image/jpeg', extension: 'jpg' },

  // PNG
  '89504e47': { type: 'image/png', extension: 'png' },

  // GIF
  '47494638': { type: 'image/gif', extension: 'gif' },

  // WebP (RIFF container)
  '52494646': { type: 'image/webp', extension: 'webp' },

  // PDF
  '25504446': { type: 'application/pdf', extension: 'pdf' },
};

/**
 * Allowed content types that can be validated
 */
const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf'
];

/**
 * Validate file signature from buffer
 *
 * @param {Buffer} buffer - File buffer (at least first 4 bytes)
 * @param {string} declaredType - Content-Type header from upload
 * @returns {Object} Validation result { valid: boolean, detectedType: string, error: string }
 */
function validateFileSignature(buffer, declaredType) {
  // Extract first 4 bytes
  if (!buffer || buffer.length < 4) {
    return {
      valid: false,
      error: 'File too small or invalid',
    };
  }

  // Convert first 4 bytes to hex string
  const signature = buffer.slice(0, 4).toString('hex').toLowerCase();

  // Check for WebP specifically (needs more bytes to confirm)
  if (signature === '52494646' && buffer.length >= 12) {
    const webpSignature = buffer.slice(8, 12).toString('ascii');
    if (webpSignature !== 'WEBP') {
      return {
        valid: false,
        detectedType: 'unknown',
        error: 'RIFF file is not a WebP image',
      };
    }
  }

  // Look up signature
  const detected = FILE_SIGNATURES[signature];

  if (!detected) {
    return {
      valid: false,
      detectedType: 'unknown',
      error: `Unknown or invalid file signature: ${signature}`,
    };
  }

  // Normalize declared type (image/jpg -> image/jpeg)
  const normalizedDeclaredType = declaredType === 'image/jpg' ? 'image/jpeg' : declaredType;

  // Check if detected type matches declared type
  if (detected.type !== normalizedDeclaredType) {
    return {
      valid: false,
      detectedType: detected.type,
      error: `File signature indicates ${detected.type} but ${normalizedDeclaredType} was declared`,
    };
  }

  return {
    valid: true,
    detectedType: detected.type,
    extension: detected.extension,
  };
}

/**
 * Validate content type is allowed
 *
 * @param {string} contentType - Content-Type to validate
 * @returns {boolean} True if allowed
 */
function isAllowedContentType(contentType) {
  return ALLOWED_CONTENT_TYPES.includes(contentType);
}

/**
 * Get file signature info from hex string
 * Useful for debugging
 *
 * @param {string} hexSignature - 8-character hex string
 * @returns {Object|null} Signature info or null
 */
function getSignatureInfo(hexSignature) {
  return FILE_SIGNATURES[hexSignature.toLowerCase()] || null;
}

module.exports = {
  validateFileSignature,
  isAllowedContentType,
  getSignatureInfo,
  FILE_SIGNATURES,
  ALLOWED_CONTENT_TYPES,
};

/**
 * Shared input-size limits to bound Bedrock/Textract cost and Lambda
 * runtime on user-supplied uploads and text.
 */

const { ValidationError } = require('./errors');

// Max raw uploaded file size (PDF/TXT) accepted for AI extraction.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

// Max characters of text sent to a model in a single extraction request.
const MAX_TEXT_CHARS = 50000;

/**
 * @param {Buffer} buffer - Uploaded file bytes
 * @throws {ValidationError} If the buffer exceeds MAX_UPLOAD_BYTES
 */
function assertUploadSize(buffer) {
  const size = buffer ? buffer.length : 0;
  if (size > MAX_UPLOAD_BYTES) {
    throw new ValidationError(
      `File too large (max ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB)`
    );
  }
}

/**
 * @param {string} text - Text to be sent to a model
 * @throws {ValidationError} If the text exceeds MAX_TEXT_CHARS
 */
function assertTextLength(text) {
  if (typeof text === 'string' && text.length > MAX_TEXT_CHARS) {
    throw new ValidationError(
      `Text content too large (max ${MAX_TEXT_CHARS.toLocaleString('en-US')} characters)`
    );
  }
}

module.exports = {
  MAX_UPLOAD_BYTES,
  MAX_TEXT_CHARS,
  assertUploadSize,
  assertTextLength,
};

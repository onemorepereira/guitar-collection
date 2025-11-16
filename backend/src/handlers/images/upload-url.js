/**
 * Generate presigned upload URL handler
 */

const { generateUploadUrl } = require('../../lib/s3');
const { getUserIdFromEvent } = require('../../lib/cognito');
const { validateRequired } = require('../../lib/validation');
const { validateCSRF } = require('../../lib/csrf');
const { ValidationError } = require('../../lib/errors');
const response = require('../../lib/response');
const { handleError } = require('../../lib/errors');
const { IMAGE_CONSTRAINTS } = require('../../config/constants');

async function getUploadUrl(event) {
  try {
    // Validate CSRF protection header
    validateCSRF(event);

    const userId = await getUserIdFromEvent(event);
    const body = JSON.parse(event.body);

    // Validate input - accept both contentType and fileType for compatibility
    const contentType = body.contentType || body.fileType;
    validateRequired(body, ['fileName']);

    if (!contentType) {
      throw new ValidationError('contentType or fileType is required');
    }

    // Validate content type
    if (!IMAGE_CONSTRAINTS.ALLOWED_TYPES.includes(contentType)) {
      throw new ValidationError('Invalid content type', {
        allowedTypes: IMAGE_CONSTRAINTS.ALLOWED_TYPES,
      });
    }

    // Generate presigned upload URL with server-side file size limit
    const { uploadUrl, key } = await generateUploadUrl(
      userId,
      body.fileName,
      contentType,
      IMAGE_CONSTRAINTS.MAX_SIZE_BYTES
    );

    return response.ok({
      uploadUrl,
      key,
      imageKey: key, // For frontend compatibility
      expiresIn: 300, // 5 minutes
    });
  } catch (error) {
    return handleError(error, response);
  }
}

module.exports = { getUploadUrl };

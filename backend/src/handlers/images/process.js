/**
 * Process uploaded image handler
 */

const { moveUploadedFile, getImageUrl, objectExists } = require('../../lib/s3');
const { getUserIdFromEvent } = require('../../lib/cognito');
const { validateRequired } = require('../../lib/validation');
const { NotFoundError, ValidationError } = require('../../lib/errors');
const response = require('../../lib/response');
const { handleError } = require('../../lib/errors');

async function processUpload(event) {
  try {
    const userId = await getUserIdFromEvent(event);
    const body = JSON.parse(event.body);

    // Validate input - accept both key and imageKey for compatibility
    const key = body.key || body.imageKey;
    if (!key) {
      throw new ValidationError('key or imageKey is required');
    }

    // Get content type if provided (for validation)
    const contentType = body.contentType || body.fileType;

    // Verify the upload exists
    const exists = await objectExists(key);
    if (!exists) {
      throw new NotFoundError('Uploaded file not found');
    }

    // Move file from uploads/ to images/ (includes magic number validation)
    const newKey = await moveUploadedFile(key, userId, contentType);

    // Get public URL
    const imageUrl = getImageUrl(newKey);

    return response.ok({
      message: 'Image processed successfully',
      key: newKey,
      imageKey: newKey, // For frontend compatibility
      url: imageUrl,
      imageUrl: imageUrl, // For frontend compatibility
    });
  } catch (error) {
    return handleError(error, response);
  }
}

module.exports = { processUpload };

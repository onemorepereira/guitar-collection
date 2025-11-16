/**
 * S3 utility functions
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const { validateFileSignature } = require('./fileValidation');
const { ValidationError } = require('./errors');

const s3 = new AWS.S3();

const BUCKET_NAME = process.env.S3_BUCKET_IMAGES;
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN;

/**
 * Generate a presigned URL for uploading to S3
 * @param {string} userId - User ID
 * @param {string} fileName - Original file name
 * @param {string} contentType - Content type
 * @param {number} maxSizeBytes - Maximum file size in bytes (default 30MB)
 * @returns {Promise<object>} Upload URL and key
 */
async function generateUploadUrl(userId, fileName, contentType = 'image/jpeg', maxSizeBytes = 30 * 1024 * 1024) {
  const fileExtension = fileName.split('.').pop();
  const key = `uploads/${userId}/${uuidv4()}.${fileExtension}`;

  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable', // Cache for 1 year
    Expires: 300, // URL expires in 5 minutes
    // Note: File size limit is enforced on the client side and during processing
  };

  const uploadUrl = await s3.getSignedUrlPromise('putObject', params);

  return {
    uploadUrl,
    key,
  };
}

/**
 * Move uploaded file from uploads/ to images/
 * Validates file signature (magic number) before moving
 *
 * @param {string} sourceKey - Source S3 key
 * @param {string} userId - User ID
 * @param {string} contentType - Expected content type (optional)
 * @returns {Promise<string>} New S3 key
 * @throws {ValidationError} If file signature is invalid
 */
async function moveUploadedFile(sourceKey, userId, contentType = null) {
  const fileName = sourceKey.split('/').pop();
  const destinationKey = `images/${userId}/${fileName}`;

  try {
    // Get file metadata and first few bytes for validation
    const headResponse = await s3.headObject({
      Bucket: BUCKET_NAME,
      Key: sourceKey,
    }).promise();

    // Get declared content type from S3 metadata or parameter
    const declaredContentType = contentType || headResponse.ContentType;

    // Read first 12 bytes of file (enough for all signature checks including WebP)
    const dataResponse = await s3.getObject({
      Bucket: BUCKET_NAME,
      Key: sourceKey,
      Range: 'bytes=0-11', // First 12 bytes
    }).promise();

    // Validate file signature
    const validation = validateFileSignature(dataResponse.Body, declaredContentType);

    if (!validation.valid) {
      // Delete invalid file
      await s3.deleteObject({
        Bucket: BUCKET_NAME,
        Key: sourceKey,
      }).promise();

      throw new ValidationError(
        `File validation failed: ${validation.error}`,
        {
          declaredType: declaredContentType,
          detectedType: validation.detectedType,
        }
      );
    }

    // File is valid, proceed with move

    // Copy object to permanent location
    await s3.copyObject({
      Bucket: BUCKET_NAME,
      CopySource: `${BUCKET_NAME}/${sourceKey}`,
      Key: destinationKey,
      ContentType: validation.detectedType, // Use validated content type
      CacheControl: 'public, max-age=31536000, immutable', // Cache for 1 year
      MetadataDirective: 'REPLACE',
    }).promise();

    // Delete original from uploads/
    await s3.deleteObject({
      Bucket: BUCKET_NAME,
      Key: sourceKey,
    }).promise();

    return destinationKey;
  } catch (error) {
    // If it's already a ValidationError, rethrow it
    if (error instanceof ValidationError) {
      throw error;
    }

    // For other errors, try to clean up and rethrow
    try {
      await s3.deleteObject({
        Bucket: BUCKET_NAME,
        Key: sourceKey,
      }).promise();
    } catch (deleteError) {
      console.error('Failed to delete invalid file:', deleteError);
    }

    throw error;
  }
}

/**
 * Get public URL for an image
 * @param {string} key - S3 key
 * @returns {string} Public URL
 */
function getImageUrl(key) {
  if (CLOUDFRONT_DOMAIN) {
    return `https://${CLOUDFRONT_DOMAIN}/${key}`;
  }
  return `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;
}

/**
 * Delete an image from S3
 * @param {string} key - S3 key
 * @returns {Promise<void>}
 */
async function deleteImage(key) {
  await s3.deleteObject({
    Bucket: BUCKET_NAME,
    Key: key,
  }).promise();
}

/**
 * Delete multiple images from S3
 * @param {string[]} keys - Array of S3 keys
 * @returns {Promise<void>}
 */
async function deleteImages(keys) {
  if (keys.length === 0) {
    return;
  }

  await s3.deleteObjects({
    Bucket: BUCKET_NAME,
    Delete: {
      Objects: keys.map(key => ({ Key: key })),
    },
  }).promise();
}

/**
 * Check if an object exists in S3
 * @param {string} key - S3 key
 * @returns {Promise<boolean>} True if exists
 */
async function objectExists(key) {
  try {
    await s3.headObject({
      Bucket: BUCKET_NAME,
      Key: key,
    }).promise();
    return true;
  } catch (error) {
    if (error.code === 'NotFound') {
      return false;
    }
    throw error;
  }
}

/**
 * Get object metadata
 * @param {string} key - S3 key
 * @returns {Promise<object>} Object metadata
 */
async function getObjectMetadata(key) {
  const result = await s3.headObject({
    Bucket: BUCKET_NAME,
    Key: key,
  }).promise();

  return {
    contentType: result.ContentType,
    contentLength: result.ContentLength,
    lastModified: result.LastModified,
    etag: result.ETag,
  };
}

/**
 * List objects with a prefix
 * @param {string} prefix - S3 key prefix
 * @returns {Promise<array>} Array of objects
 */
async function listObjects(prefix) {
  const result = await s3.listObjectsV2({
    Bucket: BUCKET_NAME,
    Prefix: prefix,
  }).promise();

  return result.Contents || [];
}

module.exports = {
  generateUploadUrl,
  moveUploadedFile,
  getImageUrl,
  deleteImage,
  deleteImages,
  objectExists,
  getObjectMetadata,
  listObjects,
};

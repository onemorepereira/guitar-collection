/**
 * Update share handler
 */

const { getItem, updateItem } = require('../../lib/dynamodb');
const { getUserIdFromEvent } = require('../../lib/cognito');
const { validatePathParameter } = require('../../lib/validation');
const { validateCSRF } = require('../../lib/csrf');
const { ValidationError, NotFoundError } = require('../../lib/errors');
const response = require('../../lib/response');
const { handleError } = require('../../lib/errors');
const { TABLES } = require('../../config/constants');
const logger = require('../../lib/logger');
const { processImages } = require('./process-images');

/**
 * Validate update data
 */
function validateUpdateData(data, guitar) {
  // Validate selectedImageIds if provided
  if (data.selectedImageIds !== undefined) {
    if (!Array.isArray(data.selectedImageIds)) {
      throw new ValidationError('selectedImageIds must be an array');
    }
    if (data.selectedImageIds.length > 10) {
      throw new ValidationError('Maximum 10 images can be shared');
    }

    // Validate that selected image IDs exist in the guitar's images
    if (guitar) {
      const guitarImageIds = (guitar.images || []).map(img => img.id);
      for (const imageId of data.selectedImageIds) {
        if (!guitarImageIds.includes(imageId)) {
          throw new ValidationError(`Image ID ${imageId} not found in guitar`);
        }
      }
    }
  }

  // Validate sharedFields if provided
  if (data.sharedFields !== undefined && typeof data.sharedFields !== 'object') {
    throw new ValidationError('sharedFields must be an object');
  }

  // Validate isActive if provided
  if (data.isActive !== undefined && typeof data.isActive !== 'boolean') {
    throw new ValidationError('isActive must be a boolean');
  }
}

async function updateShare(event) {
  try {
    // Validate CSRF protection header
    validateCSRF(event);

    const userId = await getUserIdFromEvent(event);
    const shareId = event.pathParameters?.shareId || event.pathParameters?.id;
    const body = JSON.parse(event.body);

    // Validate share ID format
    validatePathParameter(shareId, 'shareId');

    // Get existing share
    let share;
    try {
      share = await getItem(TABLES.SHARES, {
        userId,
        shareId,
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return response.notFound('Share not found');
      }
      throw error;
    }

    // Verify ownership
    if (share.userId !== userId) {
      return response.notFound('Share not found');
    }

    // Get guitar for validation
    let guitar = null;
    try {
      guitar = await getItem(TABLES.GUITARS, {
        userId,
        guitarId: share.guitarId,
      });
    } catch (error) {
      if (!(error instanceof NotFoundError)) {
        throw error;
      }
    }

    // Validate update data
    validateUpdateData(body, guitar);

    // Build updates
    const updates = {
      updatedAt: new Date().toISOString(),
    };

    let imagesChanged = false;

    if (body.sharedFields !== undefined) {
      updates.sharedFields = {
        ...share.sharedFields,
        ...body.sharedFields,
      };
    }

    if (body.selectedImageIds !== undefined) {
      // Check if images actually changed
      const oldIds = new Set(share.selectedImageIds || []);
      const newIds = new Set(body.selectedImageIds);
      imagesChanged = oldIds.size !== newIds.size ||
        [...oldIds].some(id => !newIds.has(id));

      updates.selectedImageIds = body.selectedImageIds;

      // Clear optimized images if selection changed (will be regenerated)
      if (imagesChanged) {
        updates.optimizedImages = [];
      }
    }

    if (body.isActive !== undefined) {
      updates.isActive = body.isActive;
    }

    // Perform update
    const updatedShare = await updateItem(
      TABLES.SHARES,
      { userId, shareId },
      updates
    );

    logger.info('Share updated', {
      userId,
      shareId,
      imagesChanged,
    });

    // If images changed, trigger reprocessing synchronously
    let optimizedImages = updatedShare.optimizedImages || [];
    if (imagesChanged && guitar) {
      try {
        optimizedImages = await processImages({ ...share, ...updates }, guitar) || [];
      } catch (error) {
        logger.error('Failed to process share images', {
          shareId,
          error: error.message,
        });
      }
    }

    const shareUrl = `${process.env.FRONTEND_URL || 'https://guitarhelp.click'}/s/${shareId}`;

    return response.ok({
      message: 'Share updated successfully',
      share: {
        ...updatedShare,
        optimizedImages,
        shareUrl,
      },
    });
  } catch (error) {
    return handleError(error, response);
  }
}

module.exports = { updateShare };

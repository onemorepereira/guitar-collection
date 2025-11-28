/**
 * Delete share handler
 */

const { getItem, deleteItem } = require('../../lib/dynamodb');
const { deleteImages } = require('../../lib/s3');
const { getUserIdFromEvent } = require('../../lib/cognito');
const { validatePathParameter } = require('../../lib/validation');
const { validateCSRF } = require('../../lib/csrf');
const { NotFoundError } = require('../../lib/errors');
const response = require('../../lib/response');
const { handleError } = require('../../lib/errors');
const { TABLES } = require('../../config/constants');
const { logDeletion, logSecurityEvent, SECURITY_EVENTS, RESULT } = require('../../lib/audit');

async function deleteShare(event) {
  try {
    // Validate CSRF protection header
    validateCSRF(event);

    const userId = await getUserIdFromEvent(event);
    const shareId = event.pathParameters?.shareId || event.pathParameters?.id;

    // Validate share ID format
    validatePathParameter(shareId, 'shareId');

    // Get share to verify ownership
    let share;
    try {
      share = await getItem(TABLES.SHARES, {
        userId,
        shareId,
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        // Log unauthorized access attempt
        logSecurityEvent(event, userId, SECURITY_EVENTS.UNAUTHORIZED_ACCESS, RESULT.FAILURE, {
          resourceType: 'share',
          resourceId: shareId,
          operation: 'delete',
          reason: 'not_found',
        });
        return response.notFound('Share not found');
      }
      throw error;
    }

    // Verify ownership
    if (share.userId !== userId) {
      logSecurityEvent(event, userId, SECURITY_EVENTS.UNAUTHORIZED_ACCESS, RESULT.FAILURE, {
        resourceType: 'share',
        resourceId: shareId,
        operation: 'delete',
        reason: 'unauthorized',
      });
      return response.notFound('Share not found');
    }

    // Delete optimized images from S3
    if (share.optimizedImages && share.optimizedImages.length > 0) {
      const imageKeys = share.optimizedImages
        .map(img => img.s3Key)
        .filter(Boolean);

      if (imageKeys.length > 0) {
        try {
          await deleteImages(imageKeys);
        } catch (error) {
          // Log but don't fail if S3 cleanup fails
          console.error('Failed to delete optimized images:', error);
        }
      }
    }

    // Delete share from DynamoDB
    await deleteItem(TABLES.SHARES, {
      userId,
      shareId,
    });

    // Log successful deletion
    logDeletion(event, userId, 'share', shareId, {
      guitarId: share.guitarId,
      viewCount: share.viewCount,
      imageCount: share.optimizedImages?.length || 0,
    });

    return response.ok({
      message: 'Share deleted successfully',
    });
  } catch (error) {
    return handleError(error, response);
  }
}

module.exports = { deleteShare };

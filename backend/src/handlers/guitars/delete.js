/**
 * Delete guitar handler
 */

const { getItem, deleteItem, queryItems, updateItem } = require('../../lib/dynamodb');
const { getUserIdFromEvent } = require('../../lib/cognito');
const { validatePathParameter } = require('../../lib/validation');
const { deleteImages } = require('../../lib/s3');
const { validateCSRF } = require('../../lib/csrf');
const response = require('../../lib/response');
const { handleError } = require('../../lib/errors');
const { TABLES } = require('../../config/constants');
const { logDeletion, logSecurityEvent, SECURITY_EVENTS, RESULT } = require('../../lib/audit');

async function deleteGuitar(event) {
  try {
    // Validate CSRF protection header
    validateCSRF(event);

    const userId = await getUserIdFromEvent(event);
    const guitarId = event.pathParameters?.id;

    // Validate guitar ID format
    validatePathParameter(guitarId, 'guitarId');

    // Get guitar to verify ownership and get image keys
    const guitar = await getItem(TABLES.GUITARS, {
      userId,
      guitarId,
    });

    // Return same error for not found and unauthorized to prevent enumeration
    if (!guitar || guitar.userId !== userId) {
      // Log unauthorized access attempt
      logSecurityEvent(event, userId, SECURITY_EVENTS.UNAUTHORIZED_ACCESS, RESULT.FAILURE, {
        resourceType: 'guitar',
        resourceId: guitarId,
        operation: 'delete',
        reason: 'not_found_or_unauthorized',
      });
      return response.notFound('Guitar not found');
    }

    // Delete associated images from S3
    // Extract S3 keys from image URLs
    const imageKeys = [];

    // Extract keys from guitar images
    if (guitar.images && guitar.images.length > 0) {
      for (const image of guitar.images) {
        if (image.url) {
          // Extract S3 key from CloudFront URL
          // URL format: https://d3jknizi2nswkn.cloudfront.net/images/userId/filename.jpg
          const match = image.url.match(/\/images\/.+$/);
          if (match) {
            imageKeys.push(match[0].substring(1)); // Remove leading slash
          }
        }
      }
    }

    // Extract key from receipt URL if it exists
    if (guitar.privateInfo?.receiptUrl) {
      const match = guitar.privateInfo.receiptUrl.match(/\/images\/.+$/);
      if (match) {
        imageKeys.push(match[0].substring(1)); // Remove leading slash
      }
    }

    if (imageKeys.length > 0) {
      await deleteImages(imageKeys);
    }

    // Remove this guitar from any documents' assignedGuitars arrays
    if (guitar.documentIds && guitar.documentIds.length > 0) {
      // Query all documents for this user
      const documents = await queryItems(
        TABLES.DOCUMENTS,
        'userId = :userId',
        { ':userId': userId }
      );

      // Find documents that reference this guitar
      const documentsWithGuitar = documents.filter(doc =>
        doc.assignedGuitars && doc.assignedGuitars.includes(guitarId)
      );

      // Remove guitar ID from each document's assignedGuitars
      for (const document of documentsWithGuitar) {
        const updatedAssignedGuitars = document.assignedGuitars.filter(id => id !== guitarId);

        await updateItem(
          TABLES.DOCUMENTS,
          { userId, documentId: document.documentId },
          { assignedGuitars: updatedAssignedGuitars }
        );
      }
    }

    // Delete guitar from DynamoDB
    await deleteItem(TABLES.GUITARS, {
      userId,
      guitarId,
    });

    // Log successful deletion for audit trail
    logDeletion(event, userId, 'guitar', guitarId, {
      brand: guitar.brand,
      model: guitar.model,
      year: guitar.year,
      imageCount: imageKeys.length,
      documentCount: guitar.documentIds?.length || 0,
    });

    return response.ok({
      message: 'Guitar deleted successfully',
    });
  } catch (error) {
    return handleError(error, response);
  }
}

module.exports = { deleteGuitar };

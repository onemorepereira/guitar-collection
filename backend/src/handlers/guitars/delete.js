/**
 * Delete guitar handler
 */

const { getItem, deleteItem, queryItems, updateItem } = require('../../lib/dynamodb');
const { getUserIdFromEvent } = require('../../lib/cognito');
const { validatePathParameter } = require('../../lib/validation');
const { deleteImages } = require('../../lib/s3');
const { validateCSRF } = require('../../lib/csrf');
const { collectGuitarImageKeys } = require('../../lib/s3Keys');
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

    // Delete associated images from S3 — only keys under this user's prefix
    const imageKeys = collectGuitarImageKeys(guitar, userId);

    if (imageKeys.length > 0) {
      try {
        await deleteImages(imageKeys);
      } catch (s3Error) {
        // Don't let S3 cleanup failure block deleting the record;
        // orphaned objects are recoverable, a stuck delete is not
        console.error('Failed to delete guitar images from S3', {
          guitarId,
          imageCount: imageKeys.length,
          error: s3Error.message,
        });
      }
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

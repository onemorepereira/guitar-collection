/**
 * Delete document handler
 */

const { getItem, deleteItem, query, updateItem } = require('../../lib/dynamodb');
const { getUserIdFromEvent } = require('../../lib/cognito');
const { validateCSRF } = require('../../lib/csrf');
const { deleteImages } = require('../../lib/s3');
const { extractOwnedKey } = require('../../lib/s3Keys');
const response = require('../../lib/response');
const { handleError } = require('../../lib/errors');
const { TABLES } = require('../../config/constants');

async function deleteDocument(event) {
  try {
    // Validate CSRF protection header
    validateCSRF(event);

    const userId = await getUserIdFromEvent(event);
    const { id } = event.pathParameters;

    // Get the document first
    const document = await getItem(TABLES.DOCUMENTS, {
      userId,
      documentId: id,
    });

    if (!document) {
      return response.notFound('Document not found');
    }

    // If document is assigned to guitars, we need to unassign it first
    if (document.assignedGuitars && document.assignedGuitars.length > 0) {
      // Get all guitars and remove this document from their documentIds arrays
      const guitars = await query(
        TABLES.GUITARS,
        'userId = :userId',
        { ':userId': userId }
      );

      // Find guitars that reference this document
      const guitarsWithDocument = guitars.filter(guitar =>
        guitar.documentIds && guitar.documentIds.includes(id)
      );

      // Remove document ID from each guitar
      for (const guitar of guitarsWithDocument) {
        const updatedDocumentIds = guitar.documentIds.filter(docId => docId !== id);

        await updateItem(
          TABLES.GUITARS,
          { userId, guitarId: guitar.guitarId },
          '#documentIds = :documentIds',
          { '#documentIds': 'documentIds' },
          { ':documentIds': updatedDocumentIds }
        );
      }
    }

    // Extract S3 key from URL for deletion — only if it belongs to this user
    const s3Keys = [];
    const documentKey = extractOwnedKey(document.url, userId);
    if (documentKey) {
      s3Keys.push(documentKey);
    }

    // Delete from S3 if we have keys
    if (s3Keys.length > 0) {
      try {
        await deleteImages(s3Keys);
      } catch (err) {
        console.error('Error deleting document from S3:', err);
        // Continue with deletion even if S3 delete fails
      }
    }

    // Delete the document record
    await deleteItem(TABLES.DOCUMENTS, {
      userId,
      documentId: id,
    });

    return response.ok({
      message: 'Document deleted successfully',
    });
  } catch (error) {
    return handleError(error, response);
  }
}

module.exports = { deleteDocument };

/**
 * Delete document handler
 */

const { getItem, deleteItem, query, updateItem } = require('../../lib/dynamodb');
const { getUserIdFromEvent } = require('../../lib/cognito');
const { validateCSRF } = require('../../lib/csrf');
const { deleteImages } = require('../../lib/s3');
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

    // Extract S3 key from URL for deletion
    // URL format: https://d3jknizi2nswkn.cloudfront.net/images/userId/filename.ext
    // Extract: images/userId/filename.ext
    const s3Keys = [];
    if (document.url) {
      try {
        const url = new URL(document.url);
        const pathParts = url.pathname.split('/').filter(Boolean);
        if (pathParts.length >= 3) {
          s3Keys.push(pathParts.join('/'));
        }
      } catch (err) {
        console.error('Error parsing document URL:', err);
      }
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

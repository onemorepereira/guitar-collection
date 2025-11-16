/**
 * Unassign document from guitar handler
 */

const { getItem, updateItem } = require('../../lib/dynamodb');
const { getUserIdFromEvent } = require('../../lib/cognito');
const { validateCSRF } = require('../../lib/csrf');
const response = require('../../lib/response');
const { handleError } = require('../../lib/errors');
const { TABLES } = require('../../config/constants');

async function unassignDocument(event) {
  try {
    // Validate CSRF protection header
    validateCSRF(event);

    const userId = await getUserIdFromEvent(event);
    const { guitarId, documentId } = event.pathParameters;

    // Verify guitar exists and belongs to user
    const guitar = await getItem(TABLES.GUITARS, {
      userId,
      guitarId,
    });

    if (!guitar) {
      return response.notFound('Guitar not found');
    }

    // Verify document exists and belongs to user
    const document = await getItem(TABLES.DOCUMENTS, {
      userId,
      documentId,
    });

    if (!document) {
      return response.notFound('Document not found');
    }

    // Remove document ID from guitar's documentIds array
    const existingDocumentIds = guitar.documentIds || [];
    if (!existingDocumentIds.includes(documentId)) {
      return response.badRequest('Document not assigned to this guitar');
    }

    const updatedDocumentIds = existingDocumentIds.filter(id => id !== documentId);

    await updateItem(
      TABLES.GUITARS,
      { userId, guitarId },
      '#documentIds = :documentIds',
      { '#documentIds': 'documentIds' },
      { ':documentIds': updatedDocumentIds }
    );

    // Remove guitar ID from document's assignedGuitars array
    const existingAssignedGuitars = document.assignedGuitars || [];
    const updatedAssignedGuitars = existingAssignedGuitars.filter(id => id !== guitarId);

    await updateItem(
      TABLES.DOCUMENTS,
      { userId, documentId },
      '#assignedGuitars = :assignedGuitars',
      { '#assignedGuitars': 'assignedGuitars' },
      { ':assignedGuitars': updatedAssignedGuitars }
    );

    return response.ok({
      message: 'Document unassigned from guitar successfully',
    });
  } catch (error) {
    return handleError(error, response);
  }
}

module.exports = { unassignDocument };

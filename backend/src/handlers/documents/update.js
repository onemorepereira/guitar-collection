/**
 * Update document handler
 */

const { getItem, updateItem } = require('../../lib/dynamodb');
const { getUserIdFromEvent } = require('../../lib/cognito');
const { validateCSRF } = require('../../lib/csrf');
const response = require('../../lib/response');
const { handleError } = require('../../lib/errors');
const { TABLES } = require('../../config/constants');

async function updateDocument(event) {
  try {
    // Validate CSRF protection header
    validateCSRF(event);

    const userId = await getUserIdFromEvent(event);
    const { id } = event.pathParameters;
    const body = JSON.parse(event.body);

    // Check if document exists
    const existingDocument = await getItem(TABLES.DOCUMENTS, {
      userId,
      documentId: id,
    });

    if (!existingDocument) {
      return response.notFound('Document not found');
    }

    // Only allow updating metadata fields (not url, type, etc)
    const allowedUpdates = {};
    if (body.name !== undefined) allowedUpdates.name = body.name;
    if (body.tags !== undefined) allowedUpdates.tags = body.tags;
    if (body.notes !== undefined) allowedUpdates.notes = body.notes;

    if (Object.keys(allowedUpdates).length === 0) {
      return response.badRequest('No valid fields to update');
    }

    // Add updatedAt timestamp
    allowedUpdates.updatedAt = new Date().toISOString();

    const updatedDocument = await updateItem(
      TABLES.DOCUMENTS,
      { userId, documentId: id },
      allowedUpdates
    );

    // Map documentId to id for frontend compatibility
    const documentResponse = {
      ...updatedDocument,
      id: updatedDocument.documentId,
    };
    delete documentResponse.documentId;

    return response.ok({
      message: 'Document updated successfully',
      document: documentResponse,
    });
  } catch (error) {
    return handleError(error, response);
  }
}

module.exports = { updateDocument };

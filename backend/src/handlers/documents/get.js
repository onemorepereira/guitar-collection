/**
 * Get document handler
 */

const { getItem } = require('../../lib/dynamodb');
const { getUserIdFromEvent } = require('../../lib/cognito');
const response = require('../../lib/response');
const { handleError } = require('../../lib/errors');
const { TABLES } = require('../../config/constants');

async function getDocument(event) {
  try {
    const userId = await getUserIdFromEvent(event);
    const { id } = event.pathParameters;

    const document = await getItem(TABLES.DOCUMENTS, {
      userId,
      documentId: id,
    });

    if (!document) {
      return response.notFound('Document not found');
    }

    // Map documentId to id for frontend compatibility
    const documentResponse = {
      ...document,
      id: document.documentId,
    };
    delete documentResponse.documentId;

    return response.ok({ document: documentResponse });
  } catch (error) {
    return handleError(error, response);
  }
}

module.exports = { getDocument };

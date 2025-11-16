/**
 * List documents handler
 */

const { queryItems } = require('../../lib/dynamodb');
const { getUserIdFromEvent } = require('../../lib/cognito');
const response = require('../../lib/response');
const { handleError } = require('../../lib/errors');
const { TABLES } = require('../../config/constants');

async function listDocuments(event) {
  try {
    console.log('listDocuments called');
    const userId = await getUserIdFromEvent(event);
    console.log('userId:', userId);

    // Query all documents for this user
    const documents = await queryItems(
      TABLES.DOCUMENTS,
      'userId = :userId',
      { ':userId': userId }
    );
    console.log('documents found:', documents.length);

    // Map documentId to id for frontend compatibility
    const documentsResponse = documents.map(doc => ({
      ...doc,
      id: doc.documentId,
      documentId: undefined,
    })).map(doc => {
      const { documentId, ...rest } = doc;
      return rest;
    });

    console.log('returning success response');
    return response.ok({
      documents: documentsResponse,
      count: documentsResponse.length,
    });
  } catch (error) {
    console.error('listDocuments error:', error);
    return handleError(error, response);
  }
}

module.exports = { listDocuments };

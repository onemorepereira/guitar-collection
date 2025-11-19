/**
 * Documents handler router
 */

const { createDocument } = require('./create');
const { listDocuments } = require('./list');
const { getDocument } = require('./get');
const { updateDocument } = require('./update');
const { deleteDocument } = require('./delete');
const { assignDocument } = require('./assign');
const { unassignDocument } = require('./unassign');
const { extractDocument } = require('./extract');
const response = require('../../lib/response');

exports.handler = async (event) => {
  let path = event.rawPath || event.path;
  const method = event.requestContext?.http?.method || event.httpMethod;

  // Remove stage prefix if present
  const stage = event.requestContext.stage;
  if (stage && path.startsWith(`/${stage}/`)) {
    path = path.substring(stage.length + 1);
  }

  try {
    // List documents
    if (path === '/documents' && method === 'GET') {
      return await listDocuments(event);
    }

    // Create document
    if (path === '/documents' && method === 'POST') {
      return await createDocument(event);
    }

    // Get single document
    if (path.match(/^\/documents\/[^/]+$/) && method === 'GET') {
      return await getDocument(event);
    }

    // Update document
    if (path.match(/^\/documents\/[^/]+$/) && method === 'PUT') {
      return await updateDocument(event);
    }

    // Delete document
    if (path.match(/^\/documents\/[^/]+$/) && method === 'DELETE') {
      return await deleteDocument(event);
    }

    // Trigger document extraction
    if (path.match(/^\/documents\/[^/]+\/extract$/) && method === 'POST') {
      return await extractDocument(event);
    }

    // Assign document to guitar
    if (path.match(/^\/guitars\/[^/]+\/documents\/[^/]+$/) && method === 'POST') {
      return await assignDocument(event);
    }

    // Unassign document from guitar
    if (path.match(/^\/guitars\/[^/]+\/documents\/[^/]+$/) && method === 'DELETE') {
      return await unassignDocument(event);
    }

    return response.notFound('Route not found');
  } catch (error) {
    console.error('Documents handler error:', error);
    return response.internalError('Internal server error');
  }
};

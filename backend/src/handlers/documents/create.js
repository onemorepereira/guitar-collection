/**
 * Create document handler
 */

const { v4: uuidv4 } = require('uuid');
const { putItem } = require('../../lib/dynamodb');
const { getUserIdFromEvent } = require('../../lib/cognito');
const { validateCSRF } = require('../../lib/csrf');
const response = require('../../lib/response');
const { handleError } = require('../../lib/errors');
const { TABLES } = require('../../config/constants');

async function createDocument(event) {
  try {
    // Validate CSRF protection header
    validateCSRF(event);

    const userId = await getUserIdFromEvent(event);
    const body = JSON.parse(event.body);

    // Validate required fields
    if (!body.name || !body.url || !body.type || !body.contentType) {
      return response.badRequest('Missing required fields: name, url, type, contentType');
    }

    // Validate document type
    if (!['pdf', 'image'].includes(body.type)) {
      return response.badRequest('Invalid type. Must be either "pdf" or "image"');
    }

    // Create document record
    const document = {
      userId,
      documentId: uuidv4(),
      name: body.name,
      url: body.url,
      type: body.type,
      contentType: body.contentType,
      uploadedAt: new Date().toISOString(),
      assignedGuitars: [], // Track which guitars use this document
      tags: body.tags || [],
      notes: body.notes || '',
    };

    await putItem(TABLES.DOCUMENTS, document);

    // Map documentId to id for frontend compatibility
    const documentResponse = {
      ...document,
      id: document.documentId,
    };
    delete documentResponse.documentId;

    return response.created({
      message: 'Document created successfully',
      document: documentResponse,
    });
  } catch (error) {
    return handleError(error, response);
  }
}

module.exports = { createDocument };

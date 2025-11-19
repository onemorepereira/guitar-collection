/**
 * Create document handler
 */

const { v4: uuidv4 } = require('uuid');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { putItem } = require('../../lib/dynamodb');
const { getUserIdFromEvent } = require('../../lib/cognito');
const { validateCSRF } = require('../../lib/csrf');
const response = require('../../lib/response');
const { handleError } = require('../../lib/errors');
const { TABLES } = require('../../config/constants');

const sqsClient = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1' });
const EXTRACTION_QUEUE_URL = process.env.SQS_DOCUMENT_EXTRACTION_QUEUE_URL;

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

    // Trigger async extraction if queue URL is configured
    if (EXTRACTION_QUEUE_URL) {
      try {
        const message = {
          userId,
          documentId: document.documentId,
          triggeredAt: new Date().toISOString(),
          source: 'document-create',
        };

        await sqsClient.send(new SendMessageCommand({
          QueueUrl: EXTRACTION_QUEUE_URL,
          MessageBody: JSON.stringify(message),
        }));

        console.log('Triggered document extraction', {
          userId,
          documentId: document.documentId,
          name: document.name,
        });
      } catch (sqsError) {
        // Log but don't fail document creation if extraction trigger fails
        console.error('Failed to trigger document extraction', {
          userId,
          documentId: document.documentId,
          error: sqsError.message,
        });
      }
    }

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

/**
 * Trigger document extraction handler
 */

const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { getItem } = require('../../lib/dynamodb');
const { getUserIdFromEvent } = require('../../lib/cognito');
const { validateCSRF } = require('../../lib/csrf');
const response = require('../../lib/response');
const { handleError } = require('../../lib/errors');
const { TABLES } = require('../../config/constants');

const sqsClient = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1' });
const EXTRACTION_QUEUE_URL = process.env.SQS_DOCUMENT_EXTRACTION_QUEUE_URL;

async function extractDocument(event) {
  try {
    // Validate CSRF protection header
    validateCSRF(event);

    const userId = await getUserIdFromEvent(event);
    const documentId = event.pathParameters?.id;

    if (!documentId) {
      return response.badRequest('Document ID is required');
    }

    // Verify document exists and belongs to user
    const document = await getItem(TABLES.DOCUMENTS, {
      userId,
      documentId,
    });

    if (!document) {
      return response.notFound('Document not found');
    }

    // Prevent duplicate extractions
    const currentStatus = document.extractedContent?.extractionStatus;
    if (currentStatus === 'pending' || currentStatus === 'processing') {
      return response.badRequest(`Extraction already ${currentStatus}`);
    }

    // Check if queue is configured
    if (!EXTRACTION_QUEUE_URL) {
      return response.internalError('Extraction queue not configured');
    }

    // Send extraction message to SQS
    const message = {
      userId,
      documentId,
      triggeredAt: new Date().toISOString(),
      source: 'manual',
    };

    await sqsClient.send(new SendMessageCommand({
      QueueUrl: EXTRACTION_QUEUE_URL,
      MessageBody: JSON.stringify(message),
    }));

    console.log('Triggered document extraction', {
      userId,
      documentId,
      name: document.name,
    });

    return response.ok({
      message: 'Extraction triggered successfully',
      documentId,
    });
  } catch (error) {
    return handleError(error, response);
  }
}

module.exports = { extractDocument };

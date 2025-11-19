/**
 * Document Extraction Handler
 * Processes SQS messages to start extraction and SNS notifications for Textract completion
 */

const { startExtraction, handleTextractComplete } = require('./extract');

exports.handler = async (event) => {
  console.log('Document extraction handler invoked', {
    recordCount: event.Records?.length || 0,
  });

  const results = [];

  for (const record of event.Records || []) {
    try {
      // Determine event source type
      const eventSource = record.EventSource || record.eventSource;

      if (eventSource === 'aws:sns') {
        // SNS event - Textract job completed
        const snsMessage = JSON.parse(record.Sns.Message);
        console.log('Processing Textract completion', {
          jobId: snsMessage.JobId,
          status: snsMessage.Status,
        });

        const result = await handleTextractComplete(snsMessage);
        results.push({
          messageId: record.Sns.MessageId,
          status: 'success',
          result,
        });
      } else {
        // SQS event - start extraction
        const message = JSON.parse(record.body);
        console.log('Processing extraction message', {
          userId: message.userId,
          documentId: message.documentId,
          messageId: record.messageId,
        });

        const result = await startExtraction(message);
        results.push({
          messageId: record.messageId,
          status: 'success',
          result,
        });
      }
    } catch (error) {
      console.error('Failed to process extraction', {
        messageId: record.messageId || record.Sns?.MessageId,
        error: error.message,
        stack: error.stack,
      });

      // Re-throw to send message to DLQ
      throw error;
    }
  }

  return {
    batchItemFailures: [],
    results,
  };
};

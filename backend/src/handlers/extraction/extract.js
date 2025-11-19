/**
 * Document content extraction handler
 * - startExtraction: Handles SQS message, starts Textract job or processes image
 * - handleTextractComplete: Handles SNS notification when Textract job completes
 */

const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const {
  TextractClient,
  StartDocumentTextDetectionCommand,
  GetDocumentTextDetectionCommand,
} = require('@aws-sdk/client-textract');
const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { getItem, updateItem } = require('../../lib/dynamodb');
const { TABLES } = require('../../config/constants');

// Initialize AWS clients
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const textractClient = new TextractClient({ region: process.env.AWS_REGION || 'us-east-1' });
const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const S3_BUCKET = process.env.S3_BUCKET_IMAGES;
const SNS_TOPIC_ARN = process.env.SNS_TEXTRACT_TOPIC_ARN;
const TEXTRACT_ROLE_ARN = process.env.TEXTRACT_SERVICE_ROLE_ARN;

/**
 * Extract S3 key from CloudFront or S3 URL
 */
function extractS3Key(url) {
  const match = url.match(/\/images\/[^/]+\/[^/]+$/);
  if (match) {
    return match[0].substring(1); // Remove leading slash
  }
  throw new Error(`Could not extract S3 key from URL: ${url}`);
}

/**
 * Start Textract document text detection with SNS notification
 */
async function startTextractJob(s3Key, documentId) {
  console.log('Starting Textract job with SNS notification', {
    bucket: S3_BUCKET,
    key: s3Key,
    topicArn: SNS_TOPIC_ARN,
  });

  const command = new StartDocumentTextDetectionCommand({
    DocumentLocation: {
      S3Object: {
        Bucket: S3_BUCKET,
        Name: s3Key,
      },
    },
    NotificationChannel: {
      SNSTopicArn: SNS_TOPIC_ARN,
      RoleArn: TEXTRACT_ROLE_ARN,
    },
  });

  const response = await textractClient.send(command);
  console.log('Textract job started', { jobId: response.JobId, documentId });
  return response.JobId;
}

/**
 * Get Textract results and extract text
 */
async function getTextractResults(jobId) {
  console.log('Getting Textract results', { jobId });

  let allBlocks = [];
  let nextToken = null;

  do {
    const command = new GetDocumentTextDetectionCommand({
      JobId: jobId,
      NextToken: nextToken,
    });
    const response = await textractClient.send(command);
    allBlocks = allBlocks.concat(response.Blocks || []);
    nextToken = response.NextToken;
  } while (nextToken);

  const textBlocks = allBlocks.filter(block => block.BlockType === 'LINE');
  const text = textBlocks.map(block => block.Text).join('\n');

  console.log('Textract results retrieved', {
    jobId,
    blockCount: allBlocks.length,
    lineCount: textBlocks.length,
    textLength: text.length,
  });

  return text;
}

/**
 * Use Nova Lite to reconstruct OCR text into readable content
 */
async function reconstructWithNovaLite(rawText, documentName) {
  console.log('Sending to Nova Lite for reconstruction', {
    documentName,
    textLength: rawText.length,
  });

  const maxInputLength = 100000;
  const truncatedText = rawText.length > maxInputLength
    ? rawText.substring(0, maxInputLength) + '\n\n[Content truncated due to length...]'
    : rawText;

  const prompt = `You are processing OCR output from a scanned document titled "${documentName}".

The raw OCR text below may contain:
- Fragmented text from columns or tables
- Headers and footers mixed with content
- Product specifications, prices, or catalog information

Please reconstruct this into clean, readable text that:
1. Preserves the original information and structure
2. Separates distinct sections clearly
3. Formats any tables or lists properly
4. Removes obvious OCR artifacts or repeated headers/footers

RAW OCR TEXT:
${truncatedText}

RECONSTRUCTED CONTENT:`;

  const command = new ConverseCommand({
    modelId: 'amazon.nova-lite-v1:0',
    messages: [
      {
        role: 'user',
        content: [{ text: prompt }],
      },
    ],
    inferenceConfig: {
      maxTokens: 4096,
      temperature: 0.1,
    },
  });

  const response = await bedrockClient.send(command);
  const reconstructedText = response.output?.message?.content?.[0]?.text || '';

  console.log('Nova Lite reconstruction complete', {
    inputLength: truncatedText.length,
    outputLength: reconstructedText.length,
  });

  return reconstructedText;
}

/**
 * Download image from S3 and return as base64
 */
async function downloadImageFromS3(s3Key) {
  console.log('Downloading image from S3', { bucket: S3_BUCKET, key: s3Key });

  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
  });

  const response = await s3Client.send(command);
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);

  console.log('Image downloaded', {
    key: s3Key,
    size: buffer.length,
    contentType: response.ContentType,
  });

  return {
    buffer,
    contentType: response.ContentType,
  };
}

/**
 * Get media type for Nova Lite from content type
 */
function getMediaType(contentType) {
  const typeMap = {
    'image/jpeg': 'image/jpeg',
    'image/jpg': 'image/jpeg',
    'image/png': 'image/png',
    'image/gif': 'image/gif',
    'image/webp': 'image/webp',
  };
  return typeMap[contentType?.toLowerCase()] || 'image/jpeg';
}

/**
 * Process image through Nova Lite multimodal (OCR + description)
 */
async function processImage(document) {
  const { userId, documentId, url, name } = document;

  const s3Key = extractS3Key(url);
  const { buffer, contentType } = await downloadImageFromS3(s3Key);
  const mediaType = getMediaType(contentType);

  console.log('Sending image to Nova Lite for extraction', {
    documentId,
    name,
    mediaType,
    size: buffer.length,
  });

  const prompt = `Analyze this image from a document titled "${name}".

Please provide:

1. **EXTRACTED TEXT**: Extract ALL text visible in the image, preserving the structure and layout as much as possible.

2. **DESCRIPTION**: Provide a detailed description of what this image shows, including:
   - Type of document (receipt, catalog page, certificate, photo, etc.)
   - Key information visible
   - Any notable details about condition, authenticity markers, or important features

Format your response as:

## Extracted Text
[All text from the image]

## Description
[Detailed description of the image]`;

  const command = new ConverseCommand({
    modelId: 'amazon.nova-lite-v1:0',
    messages: [
      {
        role: 'user',
        content: [
          {
            image: {
              format: mediaType.split('/')[1],
              source: {
                bytes: buffer,
              },
            },
          },
          { text: prompt },
        ],
      },
    ],
    inferenceConfig: {
      maxTokens: 4096,
      temperature: 0.1,
    },
  });

  const response = await bedrockClient.send(command);
  const responseText = response.output?.message?.content?.[0]?.text || '';

  // Parse response
  let extractedText = '';
  let description = '';

  const textMatch = responseText.match(/## Extracted Text\s*([\s\S]*?)(?=## Description|$)/i);
  const descMatch = responseText.match(/## Description\s*([\s\S]*?)$/i);

  if (textMatch) {
    extractedText = textMatch[1].trim();
  }
  if (descMatch) {
    description = descMatch[1].trim();
  }

  if (!extractedText && !description) {
    extractedText = responseText;
  }

  console.log('Image extraction complete', {
    documentId,
    textLength: extractedText.length,
    descriptionLength: description.length,
  });

  return {
    text: extractedText,
    description,
  };
}

/**
 * Find document by jobId using GSI (used when Textract completes)
 */
async function findDocumentByJobId(jobId) {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLES.DOCUMENTS,
    IndexName: 'JobIdIndex',
    KeyConditionExpression: 'jobId = :jobId',
    ExpressionAttributeValues: {
      ':jobId': jobId,
    },
  }));

  if (!result.Items || result.Items.length === 0) {
    return null;
  }

  return result.Items[0];
}

/**
 * Start extraction process (called from SQS)
 */
async function startExtraction(message) {
  const { userId, documentId } = message;

  if (!userId || !documentId) {
    throw new Error('Missing required fields: userId, documentId');
  }

  // Fetch document from DynamoDB
  const document = await getItem(TABLES.DOCUMENTS, {
    userId,
    documentId,
  });

  if (!document) {
    throw new Error(`Document not found: ${documentId}`);
  }

  console.log('Starting extraction', {
    userId,
    documentId,
    name: document.name,
    type: document.type,
    contentType: document.contentType,
  });

  const contentType = document.contentType || '';
  const isPDF = contentType === 'application/pdf' || document.type === 'pdf';
  const isImage = contentType.startsWith('image/') || document.type === 'image';

  if (isPDF) {
    // Start Textract job (async - will complete via SNS)
    const s3Key = extractS3Key(document.url);
    const jobId = await startTextractJob(s3Key, documentId);

    // Update status to processing with jobId at top level for GSI
    await updateItem(
      TABLES.DOCUMENTS,
      { userId, documentId },
      {
        jobId,  // Top-level for GSI lookup
        extractedContent: {
          extractionStatus: 'processing',
          startedAt: new Date().toISOString(),
        },
      }
    );

    console.log('PDF extraction started (async)', {
      userId,
      documentId,
      jobId,
    });

    return {
      documentId,
      status: 'processing',
      pipeline: 'pdf-async',
      jobId,
    };
  } else if (isImage) {
    // Process image synchronously (no Textract needed)
    await updateItem(
      TABLES.DOCUMENTS,
      { userId, documentId },
      {
        extractedContent: {
          extractionStatus: 'processing',
          startedAt: new Date().toISOString(),
        },
      }
    );

    try {
      const result = await processImage(document);

      await updateItem(
        TABLES.DOCUMENTS,
        { userId, documentId },
        {
          extractedContent: {
            extractionStatus: 'completed',
            text: result.text,
            description: result.description,
            storageType: 'dynamo',
            extractedAt: new Date().toISOString(),
          },
        }
      );

      console.log('Image extraction completed', {
        userId,
        documentId,
        textLength: result.text.length,
        descriptionLength: result.description.length,
      });

      return {
        documentId,
        status: 'completed',
        pipeline: 'image',
        textLength: result.text.length,
      };
    } catch (error) {
      await updateItem(
        TABLES.DOCUMENTS,
        { userId, documentId },
        {
          extractedContent: {
            extractionStatus: 'failed',
            error: error.message,
            completedAt: new Date().toISOString(),
          },
        }
      );
      throw error;
    }
  } else {
    // Unknown type
    await updateItem(
      TABLES.DOCUMENTS,
      { userId, documentId },
      {
        extractedContent: {
          extractionStatus: 'failed',
          error: `Unsupported content type: ${contentType}`,
          completedAt: new Date().toISOString(),
        },
      }
    );

    return {
      documentId,
      status: 'skipped',
      reason: 'Unsupported content type',
    };
  }
}

/**
 * Handle Textract job completion (called from SNS)
 */
async function handleTextractComplete(snsMessage) {
  const { JobId, Status, DocumentLocation } = snsMessage;

  console.log('Handling Textract completion', {
    jobId: JobId,
    status: Status,
    bucket: DocumentLocation?.S3Bucket,
    key: DocumentLocation?.S3ObjectName,
  });

  // Find the document by jobId
  const document = await findDocumentByJobId(JobId);

  if (!document) {
    console.error('Document not found for Textract job', { jobId: JobId });
    throw new Error(`Document not found for job: ${JobId}`);
  }

  const { userId, documentId, name } = document;

  if (Status === 'FAILED') {
    console.error('Textract job failed', { jobId: JobId, documentId });

    await updateItem(
      TABLES.DOCUMENTS,
      { userId, documentId },
      {
        extractedContent: {
          extractionStatus: 'failed',
          error: 'Textract job failed',
          completedAt: new Date().toISOString(),
        },
      }
    );

    return {
      documentId,
      status: 'failed',
      jobId: JobId,
    };
  }

  // Get Textract results
  const rawText = await getTextractResults(JobId);

  if (!rawText || rawText.trim().length === 0) {
    console.warn('Textract returned empty text', { documentId, jobId: JobId });

    await updateItem(
      TABLES.DOCUMENTS,
      { userId, documentId },
      {
        extractedContent: {
          extractionStatus: 'completed',
          text: '',
          rawTextLength: 0,
          storageType: 'dynamo',
          extractedAt: new Date().toISOString(),
        },
      }
    );

    return {
      documentId,
      status: 'completed',
      textLength: 0,
    };
  }

  // Reconstruct with Nova Lite
  const reconstructedText = await reconstructWithNovaLite(rawText, name);

  // Update document with extracted content
  await updateItem(
    TABLES.DOCUMENTS,
    { userId, documentId },
    {
      extractedContent: {
        extractionStatus: 'completed',
        text: reconstructedText,
        rawTextLength: rawText.length,
        storageType: 'dynamo',
        extractedAt: new Date().toISOString(),
      },
    }
  );

  console.log('PDF extraction completed', {
    userId,
    documentId,
    jobId: JobId,
    textLength: reconstructedText.length,
    rawTextLength: rawText.length,
  });

  return {
    documentId,
    status: 'completed',
    pipeline: 'pdf',
    jobId: JobId,
    textLength: reconstructedText.length,
  };
}

module.exports = { startExtraction, handleTextractComplete };

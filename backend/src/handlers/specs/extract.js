const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const pdfParse = require('pdf-parse');
const { getUserIdFromEvent } = require('../../lib/cognito');
const logger = require('../../lib/logger');

const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

const NOVA_MODEL_ID = 'amazon.nova-micro-v1:0'; // Foundation model for Nova Micro

// Field mapping with categories
const GUITAR_FIELDS = {
  basic: ['brand', 'model', 'year', 'type'],
  specs: [
    'bodyMaterial', 'neckMaterial', 'fretboardMaterial', 'numberOfFrets',
    'scaleLength', 'pickupConfiguration', 'color', 'finish', 'tuningMachines',
    'bridge', 'nut', 'electronics', 'caseIncluded', 'countryOfOrigin'
  ],
  detailed: [
    'bodyShape', 'bodyBinding', 'topWood', 'topCarve', 'neckProfile', 'neckJoint',
    'neckFinish', 'fretboardRadius', 'fretSize', 'fretboardInlays', 'nutWidth',
    'nutMaterial', 'trussRod', 'neckPickup', 'bridgePickup', 'pickupSelector',
    'controls', 'hardwareFinish', 'tailpiece', 'pickguard', 'controlKnobs',
    'strapButtons', 'stringTrees', 'stringGauge', 'headstock', 'weight'
  ]
};

// Create prompt for Nova to extract guitar specs
const createExtractionPrompt = (text) => {
  const allFields = [
    ...GUITAR_FIELDS.basic,
    ...GUITAR_FIELDS.specs,
    ...GUITAR_FIELDS.detailed
  ].join(', ');

  return `You are a guitar specification extraction expert. Extract guitar specifications from the following text and return them as a JSON array.

For each specification found, provide:
1. field: The exact field name from this list: ${allFields}
2. value: The extracted value (as appropriate type: string, number, or boolean)
3. confidence: A confidence score from 0.0 to 1.0
4. category: One of "basic", "specs", or "detailed"

Rules:
- Only extract fields from the provided list
- Be conservative with confidence scores (0.0-1.0)
- For "type", valid values are: ELECTRIC, ACOUSTIC, BASS, CLASSICAL
- For "year", extract only the manufacturing year as a number
- For "numberOfFrets", extract as a number
- For "caseIncluded", extract as true or false
- If you're unsure about a value, lower the confidence score
- Skip fields you cannot find
- Return ONLY valid JSON, no markdown or explanation

Input text:
${text}

Return format:
{
  "fields": [
    {
      "field": "brand",
      "value": "Fender",
      "confidence": 0.95,
      "category": "basic"
    },
    {
      "field": "model",
      "value": "American Professional II Stratocaster",
      "confidence": 0.98,
      "category": "basic"
    }
  ]
}`;
};

// Parse multipart form data to extract file and text
const parseMultipartFormData = (event) => {
  const contentType = event.headers['content-type'] || event.headers['Content-Type'];

  if (!contentType || !contentType.includes('multipart/form-data')) {
    return null;
  }

  const boundary = contentType.split('boundary=')[1];
  if (!boundary) return null;

  const body = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');
  const parts = [];
  const boundaryBuffer = Buffer.from(`--${boundary}`);

  let start = 0;
  while (true) {
    const boundaryIndex = body.indexOf(boundaryBuffer, start);
    if (boundaryIndex === -1) break;

    const nextBoundaryIndex = body.indexOf(boundaryBuffer, boundaryIndex + boundaryBuffer.length);
    if (nextBoundaryIndex === -1) break;

    const part = body.slice(boundaryIndex + boundaryBuffer.length, nextBoundaryIndex);
    parts.push(part);
    start = nextBoundaryIndex;
  }

  const result = {};

  for (const part of parts) {
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd === -1) continue;

    const headers = part.slice(0, headerEnd).toString();
    const content = part.slice(headerEnd + 4);

    const nameMatch = headers.match(/name="([^"]+)"/);
    if (!nameMatch) continue;

    const name = nameMatch[1];
    const filenameMatch = headers.match(/filename="([^"]+)"/);

    if (filenameMatch) {
      // It's a file
      result.file = {
        filename: filenameMatch[1],
        data: content.slice(0, -2) // Remove trailing \r\n
      };
    } else {
      // It's a text field
      result[name] = content.toString().trim();
    }
  }

  return result;
};

// Extract text from PDF
const extractTextFromPDF = async (pdfBuffer) => {
  try {
    const data = await pdfParse(pdfBuffer);
    return data.text;
  } catch (error) {
    logger.error('Error parsing PDF', {
      errorMessage: error.message,
      errorName: error.name,
    });
    throw new Error('Failed to parse PDF file');
  }
};

// Call Amazon Nova to extract specs
const extractSpecsWithNova = async (text) => {
  const prompt = createExtractionPrompt(text);

  const input = {
    modelId: NOVA_MODEL_ID,
    messages: [
      {
        role: 'user',
        content: [
          {
            text: prompt
          }
        ]
      }
    ],
    inferenceConfig: {
      maxTokens: 2000,
      temperature: 0.1, // Low temperature for consistent extraction
      topP: 0.9
    }
  };

  try {
    const command = new ConverseCommand(input);
    const response = await bedrockClient.send(command);

    if (!response.output || !response.output.message || !response.output.message.content) {
      throw new Error('Invalid response from Nova');
    }

    const responseText = response.output.message.content[0].text;

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn('No JSON found in Nova response', {
        responseLength: responseText.length,
      });
      throw new Error('Failed to parse Nova response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed;
  } catch (error) {
    logger.error('Error calling Nova', {
      errorMessage: error.message,
      errorName: error.name,
    });
    throw new Error('Failed to extract specifications with AI');
  }
};

exports.handler = async (event) => {
  logger.logRequest(event, 'Specs extraction');

  try {
    // Get userId from authorizer using utility function
    const userId = await getUserIdFromEvent(event);

    let textContent = '';

    // Check if it's multipart form data (file upload) or JSON (text paste)
    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';

    if (contentType.includes('multipart/form-data')) {
      // File upload
      const formData = parseMultipartFormData(event);

      if (!formData || !formData.file) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
          },
          body: JSON.stringify({ error: 'No file uploaded' }),
        };
      }

      const { filename, data } = formData.file;

      // Determine file type and extract text
      if (filename.toLowerCase().endsWith('.pdf')) {
        textContent = await extractTextFromPDF(data);
      } else if (filename.toLowerCase().endsWith('.txt')) {
        textContent = data.toString('utf8');
      } else {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
          },
          body: JSON.stringify({ error: 'Unsupported file type. Please upload PDF or TXT' }),
        };
      }
    } else if (contentType.includes('application/json')) {
      // Text paste
      const body = JSON.parse(event.body);
      textContent = body.text;

      if (!textContent || textContent.trim().length === 0) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
          },
          body: JSON.stringify({ error: 'No text provided' }),
        };
      }
    } else {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        },
        body: JSON.stringify({ error: 'Invalid content type' }),
      };
    }

    // Validate text length
    if (textContent.length > 50000) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        },
        body: JSON.stringify({ error: 'Text content too large (max 50,000 characters)' }),
      };
    }

    // Extract specs using Nova
    const extractedSpecs = await extractSpecsWithNova(textContent);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
      },
      body: JSON.stringify(extractedSpecs),
    };
  } catch (error) {
    logger.error('Error in extract handler', {
      errorMessage: error.message,
      errorName: error.name,
      stack: error.stack,
    });
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
      },
      body: JSON.stringify({
        error: error.message || 'Internal server error',
        details: process.env.NODE_ENV === 'dev' ? error.stack : undefined
      }),
    };
  }
};

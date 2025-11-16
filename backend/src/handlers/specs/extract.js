const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const pdfParse = require('pdf-parse');
const { getUserIdFromEvent } = require('../../lib/cognito');
const logger = require('../../lib/logger');

const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

const NOVA_MODEL_ID = 'amazon.nova-lite-v1:0'; // Foundation model for Nova Lite (better at structured output)

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

  return `You are a guitar specification extraction expert. You must extract guitar specifications and return EXACTLY the JSON format shown below.

MANDATORY JSON STRUCTURE - YOUR RESPONSE MUST START WITH THIS EXACT LINE:
{
  "fields": [

MANDATORY JSON STRUCTURE - YOUR RESPONSE MUST END WITH THIS EXACT LINE:
  ]
}

FIELD LIST - Only extract these fields:
${allFields}

CRITICAL RULES - FOLLOW EXACTLY:
1. Start your response with: { "fields": [
2. End your response with: ] }
3. Extract MAXIMUM 30 fields (most important only)
4. Only include fields with confidence >= 0.7
5. Each field object must have EXACTLY these properties: field, value, confidence, category
6. Optional properties: sourceText, reasoning (only if helpful)

STRING VALUE RULES - CRITICAL FOR VALID JSON:
- Replace ALL quote marks " with the word inch or feet
- Remove ALL special characters: ® ™ © °
- Do NOT use apostrophes in contractions - write "cannot" not "can't"
- Keep strings SHORT - max 25 characters for sourceText, max 15 words for reasoning
- No newlines, no tabs, no special formatting

VALID VALUES:
- type: Must be "Electric", "Acoustic", "Bass", or "Classical" (no other values)
- year: Number only (example: 2004)
- numberOfFrets: Number only (example: 22)
- caseIncluded: true or false (boolean, no quotes)
- confidence: Number between 0.0 and 1.0 (example: 0.95)
- category: Must be "basic", "specs", or "detailed" (no other values)

INPUT TEXT:
${text}

EXAMPLE OUTPUT - YOUR RESPONSE MUST FOLLOW THIS EXACT FORMAT:
{
  "fields": [
    {
      "field": "brand",
      "value": "Fender",
      "confidence": 0.95,
      "category": "basic",
      "sourceText": "Made by Fender",
      "reasoning": "Brand name stated"
    },
    {
      "field": "model",
      "value": "Stratocaster",
      "confidence": 0.98,
      "category": "basic",
      "sourceText": "Model Stratocaster",
      "reasoning": "Model explicitly listed"
    },
    {
      "field": "year",
      "value": 2004,
      "confidence": 0.90,
      "category": "basic"
    },
    {
      "field": "scaleLength",
      "value": "25.5 inch",
      "confidence": 0.85,
      "category": "specs",
      "sourceText": "Scale length 25.5 inch"
    }
  ]
}

FINAL REMINDERS:
- Maximum 30 fields
- Start with { "fields": [
- End with ] }
- Replace quotes with inch/feet
- Remove ® ™ © symbols
- Keep it simple and SHORT`;
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
        responsePreview: responseText.substring(0, 500),
      });
      throw new Error('Failed to parse Nova response');
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      logger.error('JSON parse error', {
        errorMessage: parseError.message,
        errorName: parseError.name,
        jsonLength: jsonMatch[0].length,
        jsonPreview: jsonMatch[0].substring(0, 1000),
        jsonAroundError: parseError.message.match(/position (\d+)/)
          ? jsonMatch[0].substring(
              Math.max(0, parseInt(parseError.message.match(/position (\d+)/)[1]) - 100),
              parseInt(parseError.message.match(/position (\d+)/)[1]) + 100
            )
          : 'N/A'
      });
      throw parseError;
    }

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

    // Include raw text for visual mapping in frontend
    const response = {
      ...extractedSpecs,
      rawText: textContent
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
      },
      body: JSON.stringify(response),
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

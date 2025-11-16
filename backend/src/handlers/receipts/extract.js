const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');
const pdfParse = require('pdf-parse');
const { getUserIdFromEvent } = require('../../lib/cognito');
const logger = require('../../lib/logger');

const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

const NOVA_MODEL_ID = 'amazon.nova-lite-v1:0';

// Create prompt for Nova to extract receipt/purchase information
const createReceiptPrompt = (text) => {
  return `You are a receipt analysis expert specializing in musical instrument purchases. Extract purchase information and return EXACTLY the JSON format shown below.

MANDATORY JSON STRUCTURE - YOUR RESPONSE MUST START WITH THIS EXACT LINE:
{
  "purchaseInfo": {

MANDATORY JSON STRUCTURE - YOUR RESPONSE MUST END WITH THIS EXACT LINE:
  }
}

CRITICAL RULES - FOLLOW EXACTLY:
1. Start your response with: { "purchaseInfo": {
2. End your response with: } }
3. Use VERY HIGH confidence threshold (0.9+) for financial data
4. Replace ALL quote marks with the word inch or feet or omit them
5. Remove ALL special characters: ® ™ © ° " '
6. Keep strings SHORT and simple
7. No newlines in strings, no tabs, no special formatting

FINANCIAL DATA TO EXTRACT (HIGH CONFIDENCE 0.9+ REQUIRED):

1. totalPaid (number, REQUIRED)
   - The FINAL amount the customer actually paid
   - Include tax, shipping, ALL fees, accessories, services
   - This is the grand total, the amount charged to credit card
   - Confidence must be >= 0.9 or omit this field

2. guitarPrice (number, optional)
   - The base retail price of the guitar BEFORE tax, shipping, discounts, accessories
   - This is the guitar's listed price, not the total paid
   - Confidence must be >= 0.9 or omit this field

3. currency (string, default "USD")
   - ISO currency code: USD, EUR, GBP, CAD, etc.

4. itemization (string, optional)
   - Human-readable breakdown for notes
   - Example: "Guitar $1099, Tax $87.92, Shipping $26.62, Setup $75, Case $120"
   - Keep under 200 characters
   - Only include if details are clearly visible

MERCHANT INFORMATION:

4. merchantName (string, REQUIRED)
   - Company or seller name
   - Examples: "Sweetwater", "Reverb", "Guitar Center", "Joe's Music"

5. merchantType (string, REQUIRED)
   - Must be one of: "retailer", "marketplace", "private_seller", "auction"
   - retailer: Sweetwater, Musician's Friend, Guitar Center
   - marketplace: Reverb, eBay (has separate seller)
   - private_seller: Individual, Craigslist, Facebook
   - auction: Heritage Auctions, Christie's

6. merchantLocation (string, optional)
   - Physical address or "Online"
   - Keep short: "Fort Wayne IN" not full address

7. merchantWebsite (string, optional)
   - Website domain only: "sweetwater.com" not full URL

SELLER INFORMATION (for marketplaces and private sales):

8. sellerUsername (string, optional)
   - Reverb shop name, eBay seller, etc.

9. sellerEmail (string, optional)
   - Contact email for private sales

10. sellerNotes (string, optional)
    - Freeform seller details, rating, contact info
    - Max 100 characters

PRODUCT INFORMATION:

11. serialNumber (string, optional)
    - Instrument serial number if visible on receipt
    - Confidence >= 0.8 required

12. productDescription (string, optional)
    - How the guitar appears on the receipt
    - Example: "Fender American Professional Stratocaster MN 3TS"
    - Max 100 characters

13. productCondition (string, optional)
    - Must be one of: "New", "Used", "Mint", "Excellent", "Good", "Fair", "B-Stock"
    - Only include if explicitly stated

14. purchaseDate (string, REQUIRED)
    - ISO 8601 format: YYYY-MM-DD
    - Receipt date, order date, or invoice date
    - Confidence >= 0.9 required

MULTI-ITEM DETECTION:

15. isMultiItem (boolean, REQUIRED)
    - true if receipt contains multiple guitars
    - false if single guitar or guitar + accessories

16. lineItems (array, optional)
    - Only include if isMultiItem is true
    - Parse each line item with:
      - description (string): Item description
      - price (number): Item price
      - isGuitar (boolean): AI guess if this is a guitar vs accessory
    - Example:
      [
        {"description": "Fender Stratocaster", "price": 1099, "isGuitar": true},
        {"description": "Gibson Les Paul", "price": 1599, "isGuitar": true},
        {"description": "Hard case", "price": 120, "isGuitar": false}
      ]

CONFIDENCE AND WARNINGS:

17. overallConfidence (number, REQUIRED)
    - Average confidence across all extracted fields
    - Must be between 0.0 and 1.0

18. warnings (array of strings, optional)
    - Financial warnings: "Subtotal and total do not match"
    - Multi-item warnings: "Multiple guitars detected - manual selection required"
    - Data quality: "Receipt quality poor - verify amounts"
    - Max 3 warnings

INPUT TEXT (RECEIPT CONTENT):
${text}

EXAMPLE OUTPUT - SINGLE ITEM RECEIPT:
{
  "purchaseInfo": {
    "totalPaid": 1408.54,
    "currency": "USD",
    "itemization": "Guitar $1099, Tax $87.92, Shipping $26.62, Setup $75, Hard case $120",
    "merchantName": "Sweetwater",
    "merchantType": "retailer",
    "merchantLocation": "Online",
    "merchantWebsite": "sweetwater.com",
    "serialNumber": "US23045678",
    "productDescription": "Fender American Professional Stratocaster",
    "productCondition": "New",
    "purchaseDate": "2024-03-15",
    "isMultiItem": false,
    "overallConfidence": 0.95
  }
}

EXAMPLE OUTPUT - MULTI-ITEM RECEIPT:
{
  "purchaseInfo": {
    "totalPaid": 3419.76,
    "currency": "USD",
    "itemization": "3 guitars, Tax $247.76, Shipping $75",
    "merchantName": "Guitar Center",
    "merchantType": "retailer",
    "merchantLocation": "Los Angeles CA",
    "purchaseDate": "2024-06-20",
    "isMultiItem": true,
    "lineItems": [
      {"description": "Fender Stratocaster", "price": 1099, "isGuitar": true},
      {"description": "Gibson Les Paul Standard", "price": 1599, "isGuitar": true},
      {"description": "Ibanez RG550", "price": 399, "isGuitar": true}
    ],
    "overallConfidence": 0.92,
    "warnings": ["Multiple guitars detected - manual selection required"]
  }
}

EXAMPLE OUTPUT - MARKETPLACE (REVERB):
{
  "purchaseInfo": {
    "totalPaid": 1250.00,
    "currency": "USD",
    "itemization": "Guitar $1150, Reverb fees $50, Shipping $50",
    "merchantName": "Reverb",
    "merchantType": "marketplace",
    "merchantLocation": "Online",
    "merchantWebsite": "reverb.com",
    "sellerUsername": "VintageGuitarsNYC",
    "sellerNotes": "Seller rating 4.9 stars with 1234 reviews",
    "productDescription": "1959 Gibson Les Paul Standard Reissue",
    "productCondition": "Excellent",
    "purchaseDate": "2024-05-10",
    "isMultiItem": false,
    "overallConfidence": 0.93
  }
}

FINAL REMINDERS:
- Total paid is THE MOST IMPORTANT field - must have 0.9+ confidence
- Start with { "purchaseInfo": {
- End with } }
- Replace quotes with inch/feet or omit
- Remove ® ™ © symbols
- Use high confidence for money (0.9+)
- Keep all strings SHORT and simple`;
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

// Extract text from PDF (kept for fallback/comparison)
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

// Send raw PDF to Nova for visual extraction
const extractReceiptWithNovaPDF = async (pdfBuffer, filename) => {
  // Sanitize filename - Bedrock only allows alphanumeric, whitespace, hyphens, parentheses, square brackets
  // Remove file extension and special characters
  const sanitizedFilename = (filename || 'receipt')
    .replace(/\.[^.]+$/, '') // Remove extension
    .replace(/[^a-zA-Z0-9\s\-()[\]]/g, '-') // Replace invalid chars with hyphen
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();

  logger.info('Sending PDF to Nova for extraction', {
    pdfSize: pdfBuffer.length,
    originalFilename: filename,
    sanitizedFilename,
  });

  const prompt = `You are a receipt analysis expert. Extract purchase information from this PDF receipt and return EXACTLY the JSON format shown below.

MANDATORY JSON STRUCTURE - YOUR RESPONSE MUST START WITH THIS EXACT LINE:
{
  "purchaseInfo": {

MANDATORY JSON STRUCTURE - YOUR RESPONSE MUST END WITH THIS EXACT LINE:
  }
}

Extract these fields from the receipt:
- totalPaid (number, REQUIRED): Final amount charged (grand total including tax, shipping, everything)
- guitarPrice (number, optional): Base retail price of the guitar BEFORE tax, shipping, discounts, accessories
- currency (string): USD, EUR, etc.
- itemization (string): Human-readable breakdown like "Guitar $1099, Tax $87, Shipping $50"
- merchantName (string, REQUIRED): Company name
- merchantType (string, REQUIRED): "retailer", "marketplace", "private_seller", or "auction"
- merchantLocation (string): Physical address or "Online"
- merchantWebsite (string): Website domain
- sellerUsername, sellerEmail, sellerNotes (strings): For marketplace/private sales
- serialNumber (string): Instrument serial if visible
- productDescription (string): How guitar appears on receipt
- productCondition (string): "New", "Used", "Mint", "Excellent", etc.
- purchaseDate (string, REQUIRED): YYYY-MM-DD format
- isMultiItem (boolean, REQUIRED): true ONLY if receipt has 2 or more GUITARS (accessories don't count)
- lineItems (array, REQUIRED if isMultiItem=true, omit otherwise): Each guitar as {description, price, isGuitar}
  CRITICAL: One guitar + accessories = isMultiItem FALSE. Two+ guitars = isMultiItem TRUE with lineItems
- overallConfidence (number, REQUIRED): 0.0-1.0
- warnings (array of strings): Any issues like "Multiple guitars detected", "Totals don't match"

CRITICAL RULES:
1. Return ONLY valid JSON, starting with { "purchaseInfo": { and ending with } }
2. Use high confidence (0.9+) for financial data
3. Replace ALL quote marks in strings with "inch" or omit them
4. Remove special characters: ® ™ © °
5. Keep strings SHORT and simple
6. For multi-page receipts, extract from ALL pages

EXAMPLE OUTPUT:
{
  "purchaseInfo": {
    "totalPaid": 2859.84,
    "guitarPrice": 2649.99,
    "currency": "USD",
    "itemization": "Guitar $2649.99, Tax $211.84, Shipping $65.11, Discount -$65.11",
    "merchantName": "Sweetwater",
    "merchantType": "retailer",
    "merchantLocation": "Online",
    "purchaseDate": "2024-11-02",
    "isMultiItem": false,
    "overallConfidence": 0.95
  }
}`;

  const content = [
    { text: prompt },
    {
      document: {
        format: 'pdf',
        name: sanitizedFilename,
        source: {
          bytes: pdfBuffer
        }
      }
    }
  ];

  const input = {
    modelId: NOVA_MODEL_ID,
    messages: [
      {
        role: 'user',
        content: content
      }
    ],
    inferenceConfig: {
      maxTokens: 2000,
      temperature: 0.1,
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
      throw new Error('No JSON found in Nova response');
    }

    const extracted = JSON.parse(jsonMatch[0]);

    if (!extracted.purchaseInfo) {
      throw new Error('Invalid JSON structure - missing purchaseInfo');
    }

    return extracted.purchaseInfo;
  } catch (error) {
    logger.error('Error calling Nova for PDF extraction', {
      errorMessage: error.message,
      errorName: error.name,
    });
    throw new Error('Failed to extract receipt from PDF');
  }
};

// Call Amazon Nova to extract receipt info from images
const extractReceiptWithNovaImages = async (images) => {
  const prompt = `You are a receipt analysis expert. Extract purchase information from this receipt and return EXACTLY the JSON format shown below.

MANDATORY JSON STRUCTURE - YOUR RESPONSE MUST START WITH THIS EXACT LINE:
{
  "purchaseInfo": {

MANDATORY JSON STRUCTURE - YOUR RESPONSE MUST END WITH THIS EXACT LINE:
  }
}

Extract these fields from the receipt image(s):
- totalPaid (number, REQUIRED): Final amount charged (grand total including tax, shipping, everything)
- currency (string): USD, EUR, etc.
- itemization (string): Human-readable breakdown like "Guitar $1099, Tax $87, Shipping $50"
- merchantName (string, REQUIRED): Company name
- merchantType (string, REQUIRED): "retailer", "marketplace", "private_seller", or "auction"
- merchantLocation (string): Physical address or "Online"
- merchantWebsite (string): Website domain
- sellerUsername, sellerEmail, sellerNotes (strings): For marketplace/private sales
- serialNumber (string): Instrument serial if visible
- productDescription (string): How guitar appears on receipt
- productCondition (string): "New", "Used", "Mint", "Excellent", etc.
- purchaseDate (string, REQUIRED): YYYY-MM-DD format
- isMultiItem (boolean, REQUIRED): true ONLY if receipt has 2 or more GUITARS (accessories don't count)
- lineItems (array, REQUIRED if isMultiItem=true, omit otherwise): Each guitar as {description, price, isGuitar}
  CRITICAL: One guitar + accessories = isMultiItem FALSE. Two+ guitars = isMultiItem TRUE with lineItems
- overallConfidence (number, REQUIRED): 0.0-1.0
- warnings (array of strings): Any issues like "Multiple guitars detected", "Totals don't match"

CRITICAL RULES:
1. Return ONLY valid JSON, starting with { "purchaseInfo": { and ending with } }
2. Use high confidence (0.9+) for financial data
3. Replace ALL quote marks in strings with "inch" or omit them
4. Remove special characters: ® ™ © °
5. Keep strings SHORT and simple
6. For multi-page receipts, extract from ALL pages provided

EXAMPLE OUTPUT:
{
  "purchaseInfo": {
    "totalPaid": 2859.84,
    "guitarPrice": 2649.99,
    "currency": "USD",
    "itemization": "Guitar $2649.99, Tax $211.84, Shipping $65.11, Discount -$65.11",
    "merchantName": "Sweetwater",
    "merchantType": "retailer",
    "merchantLocation": "Online",
    "purchaseDate": "2024-11-02",
    "isMultiItem": false,
    "overallConfidence": 0.95
  }
}`;

  // Build content array with text prompt and all images
  const content = [
    { text: prompt }
  ];

  // Add all pages as images
  for (const image of images) {
    content.push({
      image: {
        format: 'png',
        source: {
          bytes: image.buffer
        }
      }
    });
  }

  const input = {
    modelId: NOVA_MODEL_ID,
    messages: [
      {
        role: 'user',
        content: content
      }
    ],
    inferenceConfig: {
      maxTokens: 2000,
      temperature: 0.1,
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

    // Validate required fields
    const purchaseInfo = parsed.purchaseInfo;
    if (!purchaseInfo) {
      throw new Error('Missing purchaseInfo in response');
    }

    if (!purchaseInfo.totalPaid || typeof purchaseInfo.totalPaid !== 'number') {
      throw new Error('Missing or invalid totalPaid (required field)');
    }

    if (!purchaseInfo.merchantName || typeof purchaseInfo.merchantName !== 'string') {
      throw new Error('Missing or invalid merchantName (required field)');
    }

    if (!purchaseInfo.purchaseDate || typeof purchaseInfo.purchaseDate !== 'string') {
      throw new Error('Missing or invalid purchaseDate (required field)');
    }

    if (purchaseInfo.isMultiItem === undefined) {
      throw new Error('Missing isMultiItem flag (required field)');
    }

    // Validate confidence thresholds for critical financial data
    if (purchaseInfo.overallConfidence && purchaseInfo.overallConfidence < 0.85) {
      if (!purchaseInfo.warnings) {
        purchaseInfo.warnings = [];
      }
      purchaseInfo.warnings.push('Low confidence in extraction - please verify amounts carefully');
    }

    return parsed;
  } catch (error) {
    logger.error('Error calling Nova for receipt extraction from images', {
      errorMessage: error.message,
      errorName: error.name,
    });
    throw new Error('Failed to extract receipt information with AI');
  }
};

// Call Amazon Nova to extract receipt info from text (fallback)
const extractReceiptWithNova = async (text) => {
  const prompt = createReceiptPrompt(text);

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

    // Validate required fields
    const purchaseInfo = parsed.purchaseInfo;
    if (!purchaseInfo) {
      throw new Error('Missing purchaseInfo in response');
    }

    if (!purchaseInfo.totalPaid || typeof purchaseInfo.totalPaid !== 'number') {
      throw new Error('Missing or invalid totalPaid (required field)');
    }

    if (!purchaseInfo.merchantName || typeof purchaseInfo.merchantName !== 'string') {
      throw new Error('Missing or invalid merchantName (required field)');
    }

    if (!purchaseInfo.purchaseDate || typeof purchaseInfo.purchaseDate !== 'string') {
      throw new Error('Missing or invalid purchaseDate (required field)');
    }

    if (purchaseInfo.isMultiItem === undefined) {
      throw new Error('Missing isMultiItem flag (required field)');
    }

    // Validate confidence thresholds for critical financial data
    if (purchaseInfo.overallConfidence && purchaseInfo.overallConfidence < 0.85) {
      if (!purchaseInfo.warnings) {
        purchaseInfo.warnings = [];
      }
      purchaseInfo.warnings.push('Low confidence in extraction - please verify amounts carefully');
    }

    return parsed;
  } catch (error) {
    logger.error('Error calling Nova for receipt extraction', {
      errorMessage: error.message,
      errorName: error.name,
    });
    throw new Error('Failed to extract receipt information with AI');
  }
};

exports.handler = async (event) => {
  logger.logRequest(event, 'Receipt extraction');

  try {
    // Get userId from authorizer using utility function
    const userId = await getUserIdFromEvent(event);

    let textContent = '';
    let extractedReceipt;

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

      // Determine file type and process accordingly
      if (filename.toLowerCase().endsWith('.pdf')) {
        // Send raw PDF to Nova for visual extraction
        extractedReceipt = await extractReceiptWithNovaPDF(data, filename);

        // Also extract text for the raw text display (for user verification)
        textContent = await extractTextFromPDF(data);
      } else if (filename.toLowerCase().endsWith('.txt')) {
        textContent = data.toString('utf8');
        extractedReceipt = await extractReceiptWithNova(textContent);
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

      extractedReceipt = await extractReceiptWithNova(textContent);
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

    // Include raw text for reference
    const response = {
      purchaseInfo: extractedReceipt,
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
    logger.error('Error in receipt extract handler', {
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

/**
 * Get a random guitar for public display (no authentication required)
 * Sanitizes data to remove private information
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.GUITARS_TABLE_NAME;
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN;

// Cache configuration
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cachedGuitars = null;
let cacheExpiry = 0;

/**
 * Sanitize a guitar object for public display
 * Removes all private information
 */
function sanitizeGuitar(guitar) {
  return {
    id: guitar.guitarId || guitar.id, // guitarId is the DynamoDB field name
    brand: guitar.brand,
    model: guitar.model,
    year: guitar.year,
    type: guitar.type,
    color: guitar.color,
    finish: guitar.finish,
    serialNumber: guitar.serialNumber ? '***REDACTED***' : undefined,
    bodyMaterial: guitar.bodyMaterial,
    neckMaterial: guitar.neckMaterial,
    fretboardMaterial: guitar.fretboardMaterial,
    pickupConfiguration: guitar.pickupConfiguration,
    scaleLength: guitar.scaleLength,
    numberOfFrets: guitar.numberOfFrets,
    numberOfStrings: guitar.numberOfStrings,
    countryOfOrigin: guitar.countryOfOrigin,
    images: guitar.images || [],
    // Explicitly exclude private information:
    // - userId
    // - privateInfo (purchase price, receipt, etc.)
    // - notes
    // - createdAt/updatedAt
  };
}

exports.handler = async (event) => {
  try {
    let guitars;
    const now = Date.now();

    // Use cache if available and not expired
    if (cachedGuitars && now < cacheExpiry) {
      guitars = cachedGuitars;
    } else {
      // Scan all guitars from DynamoDB
      const scanCommand = new ScanCommand({
        TableName: TABLE_NAME,
      });

      const response = await docClient.send(scanCommand);
      guitars = response.Items || [];

      // Update cache
      cachedGuitars = guitars;
      cacheExpiry = now + CACHE_TTL_MS;
    }

    if (guitars.length === 0) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'No guitars found' }),
      };
    }

    // Pick a random guitar
    const randomIndex = Math.floor(Math.random() * guitars.length);
    const randomGuitar = guitars[randomIndex];

    // Sanitize the guitar data
    const publicGuitar = sanitizeGuitar(randomGuitar);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(publicGuitar),
    };
  } catch (error) {
    console.error('Error fetching random guitar:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

/**
 * Get a random guitar for public display (no authentication required)
 * Sanitizes data to remove private information
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { isDeleting } = require('../../lib/accountJobs');

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
    // Only what the Visibility copy promises: photos, no owner-written captions
    images: (guitar.images || [])
      .filter((image) => image && typeof image === 'object')
      .map(({ id, url, isPrimary, order }) => ({ id, url, isPrimary, order })),
    // Explicitly exclude private information:
    // - userId
    // - privateInfo (purchase price, receipt, etc.)
    // - notes
    // - createdAt/updatedAt
  };
}

/**
 * Scan for guitars whose owner opted in to the public gallery.
 * Follows LastEvaluatedKey: a Scan reads at most 1 MB per call and applies
 * the filter afterwards, so opted-in items can sit on any page.
 */
async function scanGalleryGuitars() {
  const items = [];
  let exclusiveStartKey;
  let pages = 0;
  let scannedCount = 0;

  do {
    const response = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'showInGallery = :t',
      ExpressionAttributeValues: { ':t': true },
      ExclusiveStartKey: exclusiveStartKey,
    }));
    // Backstop: never trust the filter alone on a privacy-critical path
    items.push(...(response.Items || []).filter((item) => item.showInGallery === true));
    scannedCount += response.ScannedCount || 0;
    pages += 1;
    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);

  // No personal data: counts only. Watch scannedCount to decide when a GSI
  // is worth it (see docs/ARCHITECTURE.md).
  console.log(JSON.stringify({ event: 'gallery_scan', pages, scannedCount, matched: items.length }));

  return items;
}

exports.handler = async (event) => {
  try {
    let guitars;
    const now = Date.now();

    // Use cache if available and not expired
    if (cachedGuitars && now < cacheExpiry) {
      guitars = cachedGuitars;
    } else {
      guitars = await scanGalleryGuitars();

      // Update cache
      cachedGuitars = guitars;
      cacheExpiry = now + CACHE_TTL_MS;
    }

    // Pick a random guitar, checked per request (not only on cache refresh):
    // an owner whose account is being deleted is dropped from the cache.
    let randomGuitar = null;
    while (guitars.length > 0) {
      const candidate = guitars[Math.floor(Math.random() * guitars.length)];
      if (!(await isDeleting(candidate.userId))) {
        randomGuitar = candidate;
        break;
      }
      guitars = guitars.filter((g) => g.userId !== candidate.userId);
      cachedGuitars = guitars;
    }

    if (!randomGuitar) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'No guitars found' }),
      };
    }

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

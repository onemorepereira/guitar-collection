/**
 * Public share view handler (no authentication required)
 */

const { queryByIndex, updateItem, getItem } = require('../../lib/dynamodb');
const { NotFoundError } = require('../../lib/errors');
const response = require('../../lib/response');
const { handleError } = require('../../lib/errors');
const { TABLES } = require('../../config/constants');
const logger = require('../../lib/logger');

// Maximum number of view entries to keep in the views array
const MAX_VIEW_ENTRIES = 1000;

/**
 * Extract analytics data from the request
 */
function extractAnalytics(event) {
  const headers = event.headers || {};

  return {
    viewedAt: new Date().toISOString(),
    referrer: headers.referer || headers.Referer || null,
    userAgent: headers['user-agent'] || headers['User-Agent'] || null,
    // CloudFront provides country via header
    country: headers['cloudfront-viewer-country'] || headers['CloudFront-Viewer-Country'] || null,
    // Client IP (for rate limiting, not stored in detail)
    ip: headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        event.requestContext?.http?.sourceIp || null,
  };
}

/**
 * Filter guitar data to only include shared fields
 */
function filterSharedData(guitar, sharedFields) {
  const filtered = {};

  // Map of guitar fields to their share field names
  const fieldMapping = {
    brand: 'brand',
    model: 'model',
    year: 'year',
    color: 'color',
    type: 'type',
    bodyMaterial: 'bodyMaterial',
    neckMaterial: 'neckMaterial',
    fretboardMaterial: 'fretboardMaterial',
    numberOfFrets: 'numberOfFrets',
    scaleLength: 'scaleLength',
    pickupConfiguration: 'pickupConfiguration',
    finish: 'finish',
    tuningMachines: 'tuningMachines',
    bridge: 'bridge',
    nut: 'nut',
    electronics: 'electronics',
    caseIncluded: 'caseIncluded',
    countryOfOrigin: 'countryOfOrigin',
    detailedSpecs: 'detailedSpecs',
  };

  // Handle condition report separately (mapped to conditionReport share field)
  if (sharedFields.conditionReport) {
    if (guitar.conditionShape) {
      filtered.conditionShape = guitar.conditionShape;
    }
    if (guitar.conditionMarkers) {
      filtered.conditionMarkers = guitar.conditionMarkers;
    }
  }

  // Only include fields that are marked as shared
  for (const [guitarField, shareField] of Object.entries(fieldMapping)) {
    if (sharedFields[shareField] && guitar[guitarField] !== undefined) {
      filtered[guitarField] = guitar[guitarField];
    }
  }

  // Handle private info fields separately
  if (sharedFields.purchasePrice && guitar.privateInfo?.purchasePrice) {
    filtered.purchasePrice = guitar.privateInfo.purchasePrice;
  }
  if (sharedFields.purchaseDate && guitar.privateInfo?.purchaseDate) {
    filtered.purchaseDate = guitar.privateInfo.purchaseDate;
  }
  if (sharedFields.notes && guitar.notes) {
    filtered.notes = guitar.notes;
  }

  return filtered;
}

async function getPublicShare(event) {
  try {
    const shareId = event.pathParameters?.shareId || event.pathParameters?.id;

    if (!shareId) {
      return response.badRequest('Share ID is required');
    }

    // Query by shareId using GSI
    const shares = await queryByIndex(
      TABLES.SHARES,
      'ShareIdIndex',
      'shareId = :shareId',
      { ':shareId': shareId }
    );

    if (shares.length === 0) {
      return response.notFound('Share not found');
    }

    const share = shares[0];

    // Check if share is active
    if (!share.isActive) {
      return response.notFound('Share not found');
    }

    // Get guitar data
    let guitar;
    try {
      guitar = await getItem(TABLES.GUITARS, {
        userId: share.userId,
        guitarId: share.guitarId,
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return response.notFound('Guitar no longer exists');
      }
      throw error;
    }

    // Extract analytics data
    const analytics = extractAnalytics(event);

    // Update view count and analytics asynchronously
    updateViewAnalytics(share, analytics).catch(error => {
      logger.error('Failed to update view analytics', {
        shareId,
        error: error.message,
      });
    });

    // Filter guitar data based on shared fields
    const filteredGuitar = filterSharedData(guitar, share.sharedFields);

    // Get images - prefer optimized images, fall back to originals
    let images = [];
    if (share.optimizedImages && share.optimizedImages.length > 0) {
      images = share.optimizedImages.map(img => ({
        id: img.originalId,
        url: img.url,
        width: img.width,
        height: img.height,
      }));
    } else {
      // Fall back to original images (filtered by selectedImageIds)
      const selectedIds = new Set(share.selectedImageIds || []);
      images = (guitar.images || [])
        .filter(img => selectedIds.has(img.id))
        .map(img => ({
          id: img.id,
          url: img.url,
        }));
    }

    logger.info('Public share viewed', {
      shareId,
      guitarId: share.guitarId,
      referrer: analytics.referrer,
      country: analytics.country,
    });

    return response.ok({
      shareId: share.shareId,
      createdAt: share.createdAt,
      guitar: filteredGuitar,
      images,
      sharedFields: share.sharedFields,
    });
  } catch (error) {
    return handleError(error, response);
  }
}

/**
 * Update view count and analytics for the share
 */
async function updateViewAnalytics(share, analytics) {
  // Don't store the IP address in permanent storage
  const viewEntry = {
    viewedAt: analytics.viewedAt,
    referrer: analytics.referrer,
    country: analytics.country,
    // Store only browser family, not full user agent
    browser: extractBrowserFamily(analytics.userAgent),
  };

  // Get current views, cap at MAX_VIEW_ENTRIES
  let views = share.views || [];

  // If we're at max, remove oldest entries to make room
  if (views.length >= MAX_VIEW_ENTRIES) {
    views = views.slice(-MAX_VIEW_ENTRIES + 1);
  }

  views.push(viewEntry);

  await updateItem(
    TABLES.SHARES,
    { userId: share.userId, shareId: share.shareId },
    {
      viewCount: (share.viewCount || 0) + 1,
      views,
      lastViewedAt: analytics.viewedAt,
    }
  );
}

/**
 * Extract browser family from user agent
 */
function extractBrowserFamily(userAgent) {
  if (!userAgent) return null;

  const ua = userAgent.toLowerCase();

  if (ua.includes('chrome') && !ua.includes('edg')) return 'Chrome';
  if (ua.includes('firefox')) return 'Firefox';
  if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari';
  if (ua.includes('edg')) return 'Edge';
  if (ua.includes('opera') || ua.includes('opr')) return 'Opera';

  return 'Other';
}

module.exports = { getPublicShare };

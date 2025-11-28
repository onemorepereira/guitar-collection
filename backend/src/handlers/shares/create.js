/**
 * Create share handler
 */

const { v4: uuidv4 } = require('uuid');
const { putItem, getItem } = require('../../lib/dynamodb');
const { getUserIdFromEvent } = require('../../lib/cognito');
const { validateCSRF } = require('../../lib/csrf');
const { ValidationError, NotFoundError } = require('../../lib/errors');
const response = require('../../lib/response');
const { handleError } = require('../../lib/errors');
const { TABLES } = require('../../config/constants');
const logger = require('../../lib/logger');
const { processImages } = require('./process-images');

// Default fields that can be shared (true = public by default)
const DEFAULT_SHARED_FIELDS = {
  brand: true,
  model: true,
  year: true,
  color: true,
  type: true,
  bodyMaterial: false,
  neckMaterial: false,
  fretboardMaterial: false,
  numberOfFrets: false,
  scaleLength: false,
  pickupConfiguration: false,
  finish: false,
  tuningMachines: false,
  bridge: false,
  nut: false,
  electronics: false,
  caseIncluded: false,
  countryOfOrigin: false,
  detailedSpecs: false,
  // Always private by default
  purchasePrice: false,
  purchaseDate: false,
  notes: false,
  provenance: false,
  documents: false,
};

/**
 * Validate share creation data
 */
function validateShareData(data, guitar) {
  if (!data.guitarId) {
    throw new ValidationError('guitarId is required');
  }

  // Validate selectedImageIds
  if (data.selectedImageIds) {
    if (!Array.isArray(data.selectedImageIds)) {
      throw new ValidationError('selectedImageIds must be an array');
    }
    if (data.selectedImageIds.length > 10) {
      throw new ValidationError('Maximum 10 images can be shared');
    }

    // Validate that selected image IDs exist in the guitar's images
    const guitarImageIds = (guitar.images || []).map(img => img.id);
    for (const imageId of data.selectedImageIds) {
      if (!guitarImageIds.includes(imageId)) {
        throw new ValidationError(`Image ID ${imageId} not found in guitar`);
      }
    }
  }

  // Validate sharedFields
  if (data.sharedFields && typeof data.sharedFields !== 'object') {
    throw new ValidationError('sharedFields must be an object');
  }
}

async function createShare(event) {
  try {
    // Validate CSRF protection header
    validateCSRF(event);

    const userId = await getUserIdFromEvent(event);
    const body = JSON.parse(event.body);

    // Get the guitar to verify ownership and get image data
    let guitar;
    try {
      guitar = await getItem(TABLES.GUITARS, {
        userId,
        guitarId: body.guitarId,
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return response.notFound('Guitar not found');
      }
      throw error;
    }

    // Verify ownership
    if (guitar.userId !== userId) {
      return response.notFound('Guitar not found');
    }

    // Validate share data
    validateShareData(body, guitar);

    // Merge provided sharedFields with defaults
    const sharedFields = {
      ...DEFAULT_SHARED_FIELDS,
      ...(body.sharedFields || {}),
    };

    // Use provided image IDs or all images if not specified
    const selectedImageIds = body.selectedImageIds ||
      (guitar.images || []).map(img => img.id);

    // Create share record
    const shareId = uuidv4();
    const now = new Date().toISOString();

    const share = {
      userId,
      shareId,
      guitarId: body.guitarId,
      createdAt: now,
      updatedAt: now,
      isActive: true,
      sharedFields,
      selectedImageIds,
      optimizedImages: [], // Will be populated by image processing
      viewCount: 0,
      views: [],
    };

    await putItem(TABLES.SHARES, share);

    logger.info('Share created', {
      userId,
      shareId,
      guitarId: body.guitarId,
      imageCount: selectedImageIds.length,
    });

    // Process images synchronously (wait for completion)
    let optimizedImages = [];
    try {
      optimizedImages = await processImages(share, guitar) || [];
    } catch (error) {
      logger.error('Failed to process share images', {
        shareId,
        error: error.message,
      });
      // Continue - share is created but images aren't optimized
    }

    // Return share with public URL
    const shareUrl = `${process.env.FRONTEND_URL || 'https://guitarhelp.click'}/s/${shareId}`;

    return response.created({
      message: 'Share created successfully',
      share: {
        ...share,
        optimizedImages,
        shareUrl,
      },
    });
  } catch (error) {
    return handleError(error, response);
  }
}

module.exports = { createShare };

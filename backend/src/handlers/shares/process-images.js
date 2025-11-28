/**
 * Image processing for shares using Sharp.js
 * Optimizes images for public sharing (resizes and converts to WebP)
 */

const AWS = require('aws-sdk');
const sharp = require('sharp');
const { updateItem } = require('../../lib/dynamodb');
const { TABLES } = require('../../config/constants');
const logger = require('../../lib/logger');

const s3 = new AWS.S3();
const BUCKET_NAME = process.env.S3_BUCKET_IMAGES;
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN;

// Image optimization settings
const MAX_WIDTH = 1200;
const WEBP_QUALITY = 80;

// Pre-rendered watermark PNG (360x56px) with "guitarhelp.click" text
// Created with NimbusSans font - clean, professional look
const WATERMARK_BASE64 = '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';

// Base watermark dimensions (will be scaled)
const WATERMARK_BASE_WIDTH = 360;
const WATERMARK_BASE_HEIGHT = 56;

/**
 * Get watermark buffer, scaled to target width
 * @param {number} targetWidth - Desired watermark width in pixels
 * @returns {Promise<Buffer>} Scaled PNG buffer
 */
async function getWatermark(targetWidth) {
  const watermarkBuffer = Buffer.from(WATERMARK_BASE64, 'base64');

  // Scale if needed
  if (targetWidth !== WATERMARK_BASE_WIDTH) {
    const scale = targetWidth / WATERMARK_BASE_WIDTH;
    const newHeight = Math.round(WATERMARK_BASE_HEIGHT * scale);

    return sharp(watermarkBuffer)
      .resize(targetWidth, newHeight)
      .png()
      .toBuffer();
  }

  return watermarkBuffer;
}

/**
 * Process and optimize images for a share
 * @param {object} share - Share record
 * @param {object} guitar - Guitar record with images
 */
async function processImages(share, guitar) {
  const { shareId, userId, selectedImageIds } = share;

  if (!selectedImageIds || selectedImageIds.length === 0) {
    logger.info('No images to process for share', { shareId });
    return;
  }

  // Find selected images from guitar
  const guitarImages = guitar.images || [];
  const imagesToProcess = guitarImages.filter(img =>
    selectedImageIds.includes(img.id)
  );

  if (imagesToProcess.length === 0) {
    logger.info('No matching images found for share', { shareId });
    return;
  }

  logger.info('Processing images for share', {
    shareId,
    imageCount: imagesToProcess.length,
  });

  const optimizedImages = [];

  for (const image of imagesToProcess) {
    try {
      const optimized = await processImage(image, shareId);
      if (optimized) {
        optimizedImages.push(optimized);
      }
    } catch (error) {
      logger.error('Failed to process image', {
        shareId,
        imageId: image.id,
        error: error.message,
      });
      // Continue processing other images
    }
  }

  // Update share with optimized images
  if (optimizedImages.length > 0) {
    await updateItem(
      TABLES.SHARES,
      { userId, shareId },
      {
        optimizedImages,
        imagesProcessedAt: new Date().toISOString(),
      }
    );

    logger.info('Share images processed', {
      shareId,
      processedCount: optimizedImages.length,
    });
  }

  return optimizedImages;
}

/**
 * Process a single image
 * @param {object} image - Image object with url and id
 * @param {string} shareId - Share ID for output path
 * @returns {object} Optimized image metadata
 */
async function processImage(image, shareId) {
  // Extract S3 key from CloudFront URL
  // URL format: https://d3jknizi2nswkn.cloudfront.net/images/userId/filename.jpg
  const match = image.url.match(/\/images\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid image URL format: ${image.url}`);
  }

  const sourceKey = `images/${match[1]}`;
  const outputFilename = `${image.id}.webp`;
  const outputKey = `shared/${shareId}/${outputFilename}`;

  // Download original image from S3
  const sourceObject = await s3.getObject({
    Bucket: BUCKET_NAME,
    Key: sourceKey,
  }).promise();

  // First pass: resize the image
  const resizedBuffer = await sharp(sourceObject.Body)
    .resize({
      width: MAX_WIDTH,
      height: MAX_WIDTH * 2, // Allow 2:1 aspect ratio max
      fit: 'inside',
      withoutEnlargement: true,
    })
    .toBuffer();

  // Get dimensions for watermark positioning
  const resizedMetadata = await sharp(resizedBuffer).metadata();
  const { width, height } = resizedMetadata;

  // Create watermark - scale based on image width
  // Target ~18% of image width, clamped between 140-220px
  const watermarkWidth = Math.max(140, Math.min(220, Math.floor(width * 0.18)));
  const watermarkBuffer = await getWatermark(watermarkWidth);
  const watermarkHeight = Math.round((watermarkWidth / WATERMARK_BASE_WIDTH) * WATERMARK_BASE_HEIGHT);
  const padding = 12;

  // Second pass: apply watermark and convert to WebP
  const processedBuffer = await sharp(resizedBuffer)
    .composite([
      {
        input: watermarkBuffer,
        top: height - watermarkHeight - padding,
        left: width - watermarkWidth - padding,
      },
    ])
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  // Get final metadata
  const metadata = await sharp(processedBuffer).metadata();

  // Upload to S3
  await s3.putObject({
    Bucket: BUCKET_NAME,
    Key: outputKey,
    Body: processedBuffer,
    ContentType: 'image/webp',
    CacheControl: 'public, max-age=31536000, immutable',
  }).promise();

  // Generate public URL
  const url = CLOUDFRONT_DOMAIN
    ? `https://${CLOUDFRONT_DOMAIN}/${outputKey}`
    : `https://${BUCKET_NAME}.s3.amazonaws.com/${outputKey}`;

  return {
    originalId: image.id,
    s3Key: outputKey,
    url,
    width: metadata.width,
    height: metadata.height,
    size: processedBuffer.length,
  };
}

/**
 * Delete optimized images for a share
 * @param {string[]} s3Keys - Array of S3 keys to delete
 */
async function deleteOptimizedImages(s3Keys) {
  if (!s3Keys || s3Keys.length === 0) {
    return;
  }

  await s3.deleteObjects({
    Bucket: BUCKET_NAME,
    Delete: {
      Objects: s3Keys.map(key => ({ Key: key })),
    },
  }).promise();
}

module.exports = {
  processImages,
  processImage,
  deleteOptimizedImages,
};

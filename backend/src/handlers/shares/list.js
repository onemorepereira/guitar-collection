/**
 * List shares handler
 */

const { queryItems, batchGetItems } = require('../../lib/dynamodb');
const { getUserIdFromEvent } = require('../../lib/cognito');
const response = require('../../lib/response');
const { handleError } = require('../../lib/errors');
const { TABLES } = require('../../config/constants');

async function listShares(event) {
  try {
    const userId = await getUserIdFromEvent(event);

    // Query all shares for this user
    const shares = await queryItems(
      TABLES.SHARES,
      'userId = :userId',
      { ':userId': userId }
    );

    // Get guitar details for each share
    const guitarIds = [...new Set(shares.map(s => s.guitarId))];
    let guitars = [];

    if (guitarIds.length > 0) {
      const guitarKeys = guitarIds.map(guitarId => ({
        userId,
        guitarId,
      }));

      try {
        guitars = await batchGetItems(TABLES.GUITARS, guitarKeys);
      } catch (error) {
        // If batch get fails, continue without guitar details
        console.error('Failed to fetch guitar details:', error);
      }
    }

    // Create a lookup map for guitars
    const guitarMap = guitars.reduce((map, guitar) => {
      map[guitar.guitarId] = guitar;
      return map;
    }, {});

    // Enrich shares with guitar summary and shareUrl
    const enrichedShares = shares.map(share => {
      const guitar = guitarMap[share.guitarId];
      const shareUrl = `${process.env.FRONTEND_URL || 'https://guitarhelp.click'}/s/${share.shareId}`;

      return {
        shareId: share.shareId,
        guitarId: share.guitarId,
        createdAt: share.createdAt,
        updatedAt: share.updatedAt,
        isActive: share.isActive,
        viewCount: share.viewCount,
        imageCount: share.selectedImageIds?.length || 0,
        shareUrl,
        guitar: guitar ? {
          brand: guitar.brand,
          model: guitar.model,
          year: guitar.year,
          // Include first image thumbnail if available
          thumbnail: guitar.images?.[0]?.url,
        } : null,
      };
    });

    // Sort by creation date, newest first
    enrichedShares.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return response.ok({
      shares: enrichedShares,
      count: enrichedShares.length,
    });
  } catch (error) {
    return handleError(error, response);
  }
}

module.exports = { listShares };

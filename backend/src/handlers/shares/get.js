/**
 * Get share handler (authenticated)
 */

const { getItem } = require('../../lib/dynamodb');
const { getUserIdFromEvent } = require('../../lib/cognito');
const { validatePathParameter } = require('../../lib/validation');
const { NotFoundError } = require('../../lib/errors');
const response = require('../../lib/response');
const { handleError } = require('../../lib/errors');
const { TABLES } = require('../../config/constants');

async function getShare(event) {
  try {
    const userId = await getUserIdFromEvent(event);
    const shareId = event.pathParameters?.shareId || event.pathParameters?.id;

    // Validate share ID format
    validatePathParameter(shareId, 'shareId');

    // Get share
    let share;
    try {
      share = await getItem(TABLES.SHARES, {
        userId,
        shareId,
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return response.notFound('Share not found');
      }
      throw error;
    }

    // Verify ownership
    if (share.userId !== userId) {
      return response.notFound('Share not found');
    }

    // Get guitar details
    let guitar = null;
    try {
      guitar = await getItem(TABLES.GUITARS, {
        userId,
        guitarId: share.guitarId,
      });
    } catch (error) {
      // Guitar might have been deleted
      if (!(error instanceof NotFoundError)) {
        throw error;
      }
    }

    const shareUrl = `${process.env.FRONTEND_URL || 'https://guitarhelp.click'}/s/${share.shareId}`;

    return response.ok({
      share: {
        ...share,
        shareUrl,
        guitar: guitar ? {
          brand: guitar.brand,
          model: guitar.model,
          year: guitar.year,
          images: guitar.images,
        } : null,
      },
    });
  } catch (error) {
    return handleError(error, response);
  }
}

module.exports = { getShare };

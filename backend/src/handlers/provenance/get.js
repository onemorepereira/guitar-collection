/**
 * Get a specific provenance report
 */

const { getItem } = require('../../lib/dynamodb');
const { getUserIdFromEvent } = require('../../lib/cognito');
const response = require('../../lib/response');
const { handleError, AuthorizationError } = require('../../lib/errors');
const { TABLES } = require('../../config/constants');

async function getReport(event) {
  try {
    const userId = await getUserIdFromEvent(event);
    const { reportId } = event.pathParameters;

    // Get report
    const report = await getItem(TABLES.PROVENANCE_REPORTS, {
      userId,
      reportId,
    });

    if (!report) {
      return response.notFound('Provenance report not found');
    }

    // Verify ownership
    if (report.userId !== userId) {
      throw new AuthorizationError('Unauthorized access to provenance report');
    }

    return response.ok({ report });
  } catch (error) {
    console.error('Error retrieving provenance report:', error);
    return handleError(error, response);
  }
}

module.exports = { getReport };

/**
 * Delete a provenance report or sales ad
 */

const { deleteItem } = require('../../lib/dynamodb');
const { getUserIdFromEvent } = require('../../lib/cognito');
const { validateCSRF } = require('../../lib/csrf');
const response = require('../../lib/response');
const { handleError, AuthorizationError } = require('../../lib/errors');
const { TABLES } = require('../../config/constants');
const { getItem } = require('../../lib/dynamodb');

async function deleteReport(event) {
  try {
    validateCSRF(event);
    const userId = await getUserIdFromEvent(event);
    const { reportId } = event.pathParameters;

    console.log('Deleting report:', { userId, reportId });

    // First get the report to verify ownership
    const report = await getItem(TABLES.PROVENANCE_REPORTS, {
      userId,
      reportId,
    });

    if (!report) {
      return response.notFound('Report not found');
    }

    // Verify ownership
    if (report.userId !== userId) {
      throw new AuthorizationError('Unauthorized access to report');
    }

    // Delete the report
    await deleteItem(TABLES.PROVENANCE_REPORTS, {
      userId,
      reportId,
    });

    console.log('Report deleted successfully:', reportId);

    return response.ok({
      message: 'Report deleted successfully',
      reportId,
    });
  } catch (error) {
    console.error('Error deleting report:', error);
    return handleError(error, response);
  }
}

module.exports = { deleteReport };

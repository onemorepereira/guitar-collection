/**
 * List provenance reports for a guitar
 */

const { queryByIndex } = require('../../lib/dynamodb');
const { getUserIdFromEvent } = require('../../lib/cognito');
const response = require('../../lib/response');
const { handleError } = require('../../lib/errors');
const { TABLES } = require('../../config/constants');

async function listReports(event) {
  try {
    const userId = await getUserIdFromEvent(event);
    const { guitarId } = event.pathParameters;

    // Get optional type filter from query params
    const typeFilter = event.queryStringParameters?.type; // 'provenance' or 'sales_ad'

    // Query reports by guitarId using GSI
    const reports = await queryByIndex(
      TABLES.PROVENANCE_REPORTS,
      'GuitarIdIndex',
      'guitarId = :guitarId',
      { ':guitarId': guitarId }
    );

    // Filter by userId for security
    let userReports = reports.filter(r => r.userId === userId);

    // Filter by type if specified
    if (typeFilter) {
      userReports = userReports.filter(r => r.reportType === typeFilter);
    }

    // Sort by version descending (newest first)
    userReports.sort((a, b) => b.version - a.version);

    // Return summary data only
    const summaries = userReports.map(r => ({
      id: r.reportId,
      version: r.version,
      generatedAt: r.generatedAt,
      guitarId: r.guitarId,
      ownerName: r.ownerName,
      type: r.reportType || 'provenance', // Default to provenance for backward compatibility
    }));

    return response.ok({
      reports: summaries,
      count: summaries.length,
    });
  } catch (error) {
    console.error('Error listing reports:', error);
    return handleError(error, response);
  }
}

module.exports = { listReports };

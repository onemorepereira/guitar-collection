/**
 * Provenance reports handler router
 */

const { generateReport } = require('./generate');
const { listReports } = require('./list');
const { getReport } = require('./get');
const { deleteReport } = require('./delete');
const response = require('../../lib/response');

exports.handler = async (event) => {
  let path = event.rawPath || event.path;
  const method = event.requestContext.http.method;

  console.log('Provenance handler:', { path, method });

  // Remove stage prefix if present
  const stage = event.requestContext.stage;
  if (stage && path.startsWith(`/${stage}/`)) {
    path = path.substring(stage.length + 1);
  }

  console.log('After stage removal:', { path, method });

  try {
    // Generate new report
    if (path.match(/^\/guitars\/[^/]+\/provenance$/) && method === 'POST') {
      console.log('Routing to generateReport');
      return await generateReport(event);
    }

    // List all reports for a guitar
    if (path.match(/^\/guitars\/[^/]+\/provenance$/) && method === 'GET') {
      console.log('Routing to listReports');
      return await listReports(event);
    }

    // Get specific report
    if (path.match(/^\/guitars\/[^/]+\/provenance\/[^/]+$/) && method === 'GET') {
      console.log('Routing to getReport');
      return await getReport(event);
    }

    // Delete specific report
    if (path.match(/^\/guitars\/[^/]+\/provenance\/[^/]+$/) && method === 'DELETE') {
      console.log('Routing to deleteReport');
      return await deleteReport(event);
    }

    return response.notFound('Route not found');
  } catch (error) {
    console.error('Provenance handler error:', error);
    return response.error('Internal server error');
  }
};

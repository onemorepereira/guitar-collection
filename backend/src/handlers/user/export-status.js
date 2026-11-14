/**
 * GET /user/export — status of the caller's latest export (GTR-14).
 * When ready (and within 7 days), returns a fresh 1-hour download link. The
 * link is signed with Lambda's temporary credentials, so it can expire sooner;
 * the UI fetches it right before downloading.
 */

const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const { getUserIdFromEvent } = require('../../lib/cognito');
const { latestExportJob } = require('../../lib/accountJobs');
const { logAccountEvent } = require('../../lib/audit');
const { handleError } = require('../../lib/errors');
const response = require('../../lib/response');
const { viewOf } = require('./export-common');

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1', maxAttempts: 3 });

async function exportStatus(event) {
  try {
    const userId = await getUserIdFromEvent(event);
    const job = await latestExportJob(userId);
    if (!job) {
      return response.success(404, { status: 'none' });
    }

    const view = viewOf(job);
    if (view.status === 'ready') {
      const date = job.createdAt.slice(0, 10);
      view.downloadUrl = await getSignedUrl(s3, new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_EXPORTS,
        Key: `exports/${userId}/${job.jobId}.zip`,
        ResponseContentDisposition: `attachment; filename="guitar-collection-export-${date}.zip"`,
        ResponseContentType: 'application/zip',
      }), { expiresIn: 3600 });
      logAccountEvent(userId, 'EXPORT_LINK_ISSUED', 'SUCCESS');
    }

    return response.ok(view);
  } catch (error) {
    return handleError(error, response);
  }
}

module.exports = { exportStatus };

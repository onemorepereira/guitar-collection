/**
 * Account export worker (GTR-14).
 *
 * Streams a ZIP (data.json + every file the user owns) straight to the private
 * exports bucket: archiver → PassThrough → lib-storage multipart Upload.
 * Failures are recorded on the job and never rethrown (exports are
 * user-retryable, not DLQ material).
 */

const { PassThrough } = require('stream');
const archiver = require('archiver');
const { Upload } = require('@aws-sdk/lib-storage');
const { S3Client, ListObjectsV2Command, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const { TABLES } = require('../../config/constants');
const { queryAll } = require('../../lib/dynamodb');
const { transitionExport, isDeleting } = require('../../lib/accountJobs');
const { getCognitoUser } = require('../../lib/cognito');
const { logAccountEvent } = require('../../lib/audit');

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1', maxAttempts: 3 });

const MAX_EXPORT_BYTES = 2 * 1024 ** 3; // 2 GiB of files
const PART_SIZE = 8 * 1024 * 1024;

async function listObjects(bucket, prefix) {
  const objects = [];
  let ContinuationToken;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken }));
    for (const o of page.Contents || []) objects.push({ key: o.Key, sizeBytes: o.Size || 0 });
    ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return objects;
}

async function collectData(userId) {
  const byUser = (table) => queryAll(table, 'userId = :u', { ':u': userId });
  const [profile, guitars, documents, provenanceReports, shares, account] = await Promise.all([
    byUser(TABLES.USERS),
    byUser(TABLES.GUITARS),
    byUser(TABLES.DOCUMENTS),
    byUser(TABLES.PROVENANCE_REPORTS),
    byUser(TABLES.SHARES),
    getCognitoUser(userId),
  ]);
  return { profile: profile[0] || null, guitars, documents, provenanceReports, shares, account };
}

/** Append a stream entry and wait until archiver has consumed it (one S3 stream open at a time). */
function appendAndWait(archive, source, name) {
  return new Promise((resolve, reject) => {
    const onEntry = () => { archive.off('error', onError); resolve(); };
    const onError = (error) => { archive.off('entry', onEntry); reject(error); };
    archive.once('entry', onEntry);
    archive.once('error', onError);
    archive.append(source, { name });
  });
}

function fail(userId, jobId, reason, extra = {}) {
  logAccountEvent(userId, 'EXPORT_FAILED', 'FAILURE', { reason, ...extra });
  console.log(JSON.stringify({ event: 'export_failed', reason, ...extra }));
  return transitionExport(userId, jobId, 'processing', 'failed', { reason });
}

async function run({ userId, jobId }) {
  const startedAt = new Date().toISOString();
  if (!(await transitionExport(userId, jobId, 'pending', 'processing', { startedAt }))) {
    console.log(JSON.stringify({ event: 'export_skipped', reason: 'not_pending' }));
    return;
  }
  if (await isDeleting(userId)) {
    await transitionExport(userId, jobId, 'processing', 'cancelled');
    return;
  }

  const imagesBucket = process.env.S3_BUCKET_IMAGES;
  const exportsBucket = process.env.S3_BUCKET_EXPORTS;
  const zipKey = `exports/${userId}/${jobId}.zip`;
  let upload;

  try {
    const data = await collectData(userId);

    const files = [
      ...(await listObjects(imagesBucket, `images/${userId}/`)),
    ];
    for (const share of data.shares) {
      files.push(...(await listObjects(imagesBucket, `shared/${share.shareId}/`)));
    }
    const totalBytes = files.reduce((sum, f) => sum + f.sizeBytes, 0);
    if (totalBytes > MAX_EXPORT_BYTES) {
      await fail(userId, jobId, 'too_large', { totalBytes });
      return;
    }

    const manifest = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      account: data.account,
      profile: data.profile,
      guitars: data.guitars,
      documents: data.documents,
      provenanceReports: data.provenanceReports,
      shares: data.shares,
      files: files.map((f) => ({ key: f.key, zipPath: `files/${f.key}`, sizeBytes: f.sizeBytes })),
    };

    const archive = archiver('zip', { zlib: { level: 0 } }); // photos/PDFs are already compressed
    const body = new PassThrough();
    archive.pipe(body);
    upload = new Upload({
      client: s3,
      params: { Bucket: exportsBucket, Key: zipKey, Body: body, ContentType: 'application/zip' },
      partSize: PART_SIZE,
      queueSize: 4,
    });
    const uploaded = upload.done();
    // If S3 rejects the upload early, stop producing the archive (otherwise
    // nothing drains it and the job would hang until the Lambda timeout)
    uploaded.catch((error) => archive.abort?.() || archive.emit('error', error));

    await appendAndWait(archive, Buffer.from(JSON.stringify(manifest, null, 2)), 'data.json');
    for (const file of files) {
      const object = await s3.send(new GetObjectCommand({ Bucket: imagesBucket, Key: file.key }));
      await appendAndWait(archive, object.Body, `files/${file.key}`);
    }
    await archive.finalize();
    await uploaded;
    const sizeBytes = archive.pointer();

    // A deletion requested meanwhile wins: drop the ZIP
    if (await isDeleting(userId)) {
      await s3.send(new DeleteObjectCommand({ Bucket: exportsBucket, Key: zipKey }));
      await transitionExport(userId, jobId, 'processing', 'cancelled');
      return;
    }

    const counts = {
      guitars: data.guitars.length,
      documents: data.documents.length,
      reports: data.provenanceReports.length,
      shares: data.shares.length,
      files: files.length,
      sizeBytes,
    };
    const marked = await transitionExport(userId, jobId, 'processing', 'ready', { completedAt: new Date().toISOString(), sizeBytes });
    if (!marked) {
      // Cancelled in the meantime (deletion requested): the deletion removes the ZIP
      console.log(JSON.stringify({ event: 'export_skipped', reason: 'no_longer_processing' }));
      return;
    }
    logAccountEvent(userId, 'EXPORT_COMPLETED', 'SUCCESS', counts);
    console.log(JSON.stringify({ event: 'export_completed', ...counts }));
  } catch (error) {
    if (upload) {
      try { await upload.abort(); } catch { /* best effort */ }
    }
    console.error(JSON.stringify({ event: 'export_error', error: error.name || 'Error' }));
    await fail(userId, jobId, 'error');
  }
}

module.exports = { run, MAX_EXPORT_BYTES };

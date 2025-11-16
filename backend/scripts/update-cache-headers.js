#!/usr/bin/env node

/**
 * Update Cache-Control headers on existing S3 images
 *
 * This script updates all images in the S3 bucket to have aggressive caching headers.
 * Run with --live to actually perform the updates (default is dry run).
 */

const { S3Client, ListObjectsV2Command, CopyObjectCommand } = require('@aws-sdk/client-s3');
const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');

const REGION = 'us-east-1';
const DRY_RUN = !process.argv.includes('--live');

const s3Client = new S3Client({ region: REGION });
const stsClient = new STSClient({ region: REGION });

let BUCKET_NAME; // Will be set after getting account ID

/**
 * Update cache headers for a single object
 */
async function updateCacheHeaders(key, contentType) {
  const copyParams = {
    Bucket: BUCKET_NAME,
    CopySource: `${BUCKET_NAME}/${key}`,
    Key: key,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
    MetadataDirective: 'REPLACE',
  };

  if (!DRY_RUN) {
    const command = new CopyObjectCommand(copyParams);
    await s3Client.send(command);
  }

  return true;
}

/**
 * Process all objects in the images/ folder
 */
async function updateAllImages() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Cache Headers Update - ${DRY_RUN ? 'DRY RUN' : 'LIVE RUN'}`);
  console.log(`${'='.repeat(60)}\n`);
  console.log(`Bucket: ${BUCKET_NAME}`);
  console.log(`Region: ${REGION}\n`);

  let continuationToken = undefined;
  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  do {
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: 'images/',
      ContinuationToken: continuationToken,
    });

    const response = await s3Client.send(listCommand);
    const objects = response.Contents || [];

    for (const object of objects) {
      totalProcessed++;
      const key = object.Key;

      // Determine content type from extension
      let contentType = 'application/octet-stream';
      if (key.endsWith('.jpg') || key.endsWith('.jpeg')) {
        contentType = 'image/jpeg';
      } else if (key.endsWith('.png')) {
        contentType = 'image/png';
      } else if (key.endsWith('.gif')) {
        contentType = 'image/gif';
      } else if (key.endsWith('.webp')) {
        contentType = 'image/webp';
      } else if (key.endsWith('.pdf')) {
        contentType = 'application/pdf';
      }

      console.log(`Processing: ${key}`);

      try {
        await updateCacheHeaders(key, contentType);
        totalUpdated++;
        console.log(`  ✅ ${DRY_RUN ? 'Would update' : 'Updated'}`);
      } catch (error) {
        totalErrors++;
        console.error(`  ❌ Error: ${error.message}`);
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  // Print summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('UPDATE SUMMARY');
  console.log(`${'='.repeat(60)}\n`);
  console.log(`Total objects processed:  ${totalProcessed}`);
  console.log(`Successfully updated:     ${totalUpdated}`);
  console.log(`Errors encountered:       ${totalErrors}`);

  if (DRY_RUN) {
    console.log(`\n🔍 This was a DRY RUN - no changes were made.`);
    console.log(`Run with --live to perform the actual updates.`);
  } else if (totalErrors > 0) {
    console.log(`\n⚠️  Some objects failed to update. Please review errors above.`);
  } else if (totalUpdated > 0) {
    console.log(`\n✅ Cache headers updated successfully!`);
  }

  console.log('');
}

// Initialize and run the update
async function main() {
  try {
    // Get bucket prefix from environment variable or use default
    const bucketPrefix = process.env.IMAGES_BUCKET_PREFIX || 'guitar-collection-images';
    const environment = process.env.ENVIRONMENT || 'prod';

    // Get AWS Account ID dynamically
    const command = new GetCallerIdentityCommand({});
    const response = await stsClient.send(command);
    const accountId = response.Account;

    BUCKET_NAME = `${bucketPrefix}-${environment}-${accountId}`;

    // Run the update
    await updateAllImages();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fatal error during update:', error);
    process.exit(1);
  }
}

main();

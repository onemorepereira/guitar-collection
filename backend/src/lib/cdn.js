/**
 * CloudFront invalidation for the images CDN.
 *
 * Deleted files must stop being served from edge caches (objects are cached
 * with max-age=1 year). Pricing counts each path (a wildcard counts as one);
 * the first 1,000 paths/month are free.
 */

const crypto = require('crypto');
const { CloudFrontClient, CreateInvalidationCommand } = require('@aws-sdk/client-cloudfront');

const MAX_PATHS_PER_REQUEST = 100;

const cloudfront = new CloudFrontClient({ region: 'us-east-1', maxAttempts: 3 });

/**
 * Invalidate CDN paths (each must start with '/').
 * @param {string[]} paths
 * @param {object} [options]
 * @param {boolean} [options.strict=false] - rethrow failures (account deletion);
 *   otherwise log and continue so a user-facing delete never fails on the CDN
 */
async function invalidate(paths, { strict = false } = {}) {
  const distributionId = process.env.IMAGES_DISTRIBUTION_ID;
  const unique = [...new Set((paths || []).filter(Boolean))];
  if (unique.length === 0) return;

  if (!distributionId) {
    const message = 'IMAGES_DISTRIBUTION_ID not set; skipping CDN invalidation';
    if (strict) throw new Error(message);
    console.warn(message);
    return;
  }

  for (let i = 0; i < unique.length; i += MAX_PATHS_PER_REQUEST) {
    const chunk = unique.slice(i, i + MAX_PATHS_PER_REQUEST);
    const callerReference = crypto
      .createHash('sha256')
      .update(`${[...chunk].sort().join('\n')}|${Date.now()}`)
      .digest('hex');
    try {
      await cloudfront.send(new CreateInvalidationCommand({
        DistributionId: distributionId,
        InvalidationBatch: {
          CallerReference: callerReference,
          Paths: { Quantity: chunk.length, Items: chunk },
        },
      }));
    } catch (error) {
      if (strict) throw error;
      console.error('CDN invalidation failed', { paths: chunk.length, error: error.name || error.message });
    }
  }
}

module.exports = { invalidate, MAX_PATHS_PER_REQUEST };

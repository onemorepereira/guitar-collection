/**
 * Ownership-enforcing S3 key extraction from stored URLs.
 *
 * Image/document URLs are user-supplied data. Any S3 key derived from one
 * must be verified to live under the requesting user's own prefix before
 * it is read, copied, or deleted — otherwise a crafted URL lets one user
 * operate on another user's objects.
 */

const { ValidationError } = require('./errors');

// S3 prefixes that are scoped per-user as `<prefix>/<userId>/...`
const USER_SCOPED_PREFIXES = ['images', 'uploads'];

/**
 * Parse a user-scoped S3 key out of a URL path, without regex on user input.
 * @param {string} url - Stored URL (CloudFront or S3)
 * @returns {{prefix: string, ownerId: string, key: string}|null}
 */
function parseUserScopedKey(url) {
  if (typeof url !== 'string' || url.length === 0) {
    return null;
  }

  let pathname;
  try {
    pathname = new URL(url).pathname;
  } catch (err) {
    return null;
  }

  const parts = pathname.split('/').filter(Boolean);
  if (parts.length < 3) {
    return null;
  }

  const [prefix, ownerId] = parts;
  if (!USER_SCOPED_PREFIXES.includes(prefix)) {
    return null;
  }

  return { prefix, ownerId, key: parts.join('/') };
}

/**
 * Extract an S3 key from a URL only if it belongs to the given user.
 * @param {string} url - Stored URL
 * @param {string} userId - Requesting user's id
 * @returns {string|null} The S3 key, or null if unowned/unrecognized
 */
function extractOwnedKey(url, userId) {
  const parsed = parseUserScopedKey(url);
  if (!parsed || parsed.ownerId !== userId) {
    return null;
  }
  return parsed.key;
}

/**
 * Reject URLs that reference another user's storage prefix.
 * URLs that do not point at user-scoped storage at all are allowed
 * (external links produce no S3 key and are harmless downstream).
 * @param {string} url - URL to validate (undefined/null allowed)
 * @param {string} userId - Requesting user's id
 * @throws {ValidationError} If the URL references a foreign user prefix
 */
function assertUrlOwnership(url, userId) {
  const parsed = parseUserScopedKey(url);
  if (parsed && parsed.ownerId !== userId) {
    throw new ValidationError('URL references storage not owned by the user');
  }
}

/**
 * Collect the S3 keys for a guitar's images and receipt that belong to
 * the given user. Foreign or unrecognized URLs are skipped.
 * @param {object} guitar - Guitar record
 * @param {string} userId - Requesting user's id
 * @returns {string[]} Deletable S3 keys
 */
function collectGuitarImageKeys(guitar, userId) {
  const keys = [];

  for (const image of guitar.images || []) {
    const key = extractOwnedKey(image.url, userId);
    if (key) {
      keys.push(key);
    }
  }

  const receiptKey = extractOwnedKey(guitar.privateInfo?.receiptUrl, userId);
  if (receiptKey) {
    keys.push(receiptKey);
  }

  return keys;
}

module.exports = {
  extractOwnedKey,
  assertUrlOwnership,
  collectGuitarImageKeys,
};

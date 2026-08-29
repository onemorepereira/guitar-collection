const {
  extractOwnedKey,
  assertUrlOwnership,
  collectGuitarImageKeys,
} = require('../../src/lib/s3Keys');
const { ValidationError } = require('../../src/lib/errors');

const USER = 'aaaa1111-2222-3333-4444-5555aaaa6666';
const OTHER = 'bbbb1111-2222-3333-4444-5555bbbb6666';
const CDN = 'https://images.example.com';

describe('extractOwnedKey', () => {
  test('returns the key for a URL under the requesting user prefix', () => {
    expect(extractOwnedKey(`${CDN}/images/${USER}/photo.jpg`, USER)).toBe(
      `images/${USER}/photo.jpg`
    );
  });

  test('returns null for a URL under another user prefix', () => {
    expect(extractOwnedKey(`${CDN}/images/${OTHER}/photo.jpg`, USER)).toBeNull();
  });

  test('returns null when the URL has no recognized prefix', () => {
    expect(extractOwnedKey(`${CDN}/other/${USER}/photo.jpg`, USER)).toBeNull();
    expect(extractOwnedKey('https://evil.example.com/steal', USER)).toBeNull();
  });

  test('returns null for non-string or empty input', () => {
    expect(extractOwnedKey(undefined, USER)).toBeNull();
    expect(extractOwnedKey(null, USER)).toBeNull();
    expect(extractOwnedKey(42, USER)).toBeNull();
    expect(extractOwnedKey('', USER)).toBeNull();
  });

  test('supports the uploads prefix', () => {
    expect(extractOwnedKey(`${CDN}/uploads/${USER}/file.png`, USER)).toBe(
      `uploads/${USER}/file.png`
    );
  });

  test('does not treat the user id as a regex (literal comparison)', () => {
    // A crafted "userId-like" path segment must not match via regex tricks
    expect(extractOwnedKey(`${CDN}/images/.*/photo.jpg`, USER)).toBeNull();
  });

  test('handles keys with nested path segments', () => {
    expect(extractOwnedKey(`${CDN}/images/${USER}/a/b/photo.jpg`, USER)).toBe(
      `images/${USER}/a/b/photo.jpg`
    );
  });
});

describe('assertUrlOwnership', () => {
  test('passes for a URL under the requesting user prefix', () => {
    expect(() =>
      assertUrlOwnership(`${CDN}/images/${USER}/photo.jpg`, USER)
    ).not.toThrow();
  });

  test('throws ValidationError for a URL under another user prefix', () => {
    expect(() =>
      assertUrlOwnership(`${CDN}/images/${OTHER}/photo.jpg`, USER)
    ).toThrow(ValidationError);
  });

  test('throws ValidationError for an uploads URL of another user', () => {
    expect(() =>
      assertUrlOwnership(`${CDN}/uploads/${OTHER}/file.png`, USER)
    ).toThrow(ValidationError);
  });

  test('passes for URLs that do not reference user-scoped storage', () => {
    // e.g. external links stored in documents — no images/uploads path
    expect(() =>
      assertUrlOwnership('https://example.com/manual.pdf', USER)
    ).not.toThrow();
  });

  test('passes for undefined/null (nothing to validate)', () => {
    expect(() => assertUrlOwnership(undefined, USER)).not.toThrow();
    expect(() => assertUrlOwnership(null, USER)).not.toThrow();
  });
});

describe('collectGuitarImageKeys', () => {
  test('collects only keys owned by the requesting user', () => {
    const guitar = {
      images: [
        { url: `${CDN}/images/${USER}/one.jpg` },
        { url: `${CDN}/images/${OTHER}/stolen.jpg` },
        { url: 'https://example.com/not-ours.jpg' },
        {},
      ],
      privateInfo: { receiptUrl: `${CDN}/images/${USER}/receipt.pdf` },
    };
    expect(collectGuitarImageKeys(guitar, USER)).toEqual([
      `images/${USER}/one.jpg`,
      `images/${USER}/receipt.pdf`,
    ]);
  });

  test('returns empty array for a guitar without images', () => {
    expect(collectGuitarImageKeys({}, USER)).toEqual([]);
  });

  test('skips a foreign receipt URL', () => {
    const guitar = {
      privateInfo: { receiptUrl: `${CDN}/images/${OTHER}/receipt.pdf` },
    };
    expect(collectGuitarImageKeys(guitar, USER)).toEqual([]);
  });
});

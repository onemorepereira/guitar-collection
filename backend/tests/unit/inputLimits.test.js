const {
  MAX_UPLOAD_BYTES,
  MAX_TEXT_CHARS,
  assertUploadSize,
  assertTextLength,
} = require('../../src/lib/inputLimits');
const { ValidationError } = require('../../src/lib/errors');

describe('assertUploadSize', () => {
  test('passes for a buffer within the limit', () => {
    expect(() => assertUploadSize(Buffer.alloc(1024))).not.toThrow();
  });

  test('throws ValidationError when over the byte limit', () => {
    expect(() => assertUploadSize(Buffer.alloc(MAX_UPLOAD_BYTES + 1))).toThrow(
      ValidationError
    );
  });
});

describe('assertTextLength', () => {
  test('passes for text within the limit', () => {
    expect(() => assertTextLength('x'.repeat(100))).not.toThrow();
  });

  test('throws ValidationError when over the character limit', () => {
    expect(() => assertTextLength('x'.repeat(MAX_TEXT_CHARS + 1))).toThrow(
      ValidationError
    );
  });
});

/**
 * images/process (upload-complete) must only move keys under the
 * requesting user's own uploads/ prefix — a client-supplied key for
 * another user's object would otherwise be copied into the caller's
 * images/ prefix and the source deleted (cross-tenant steal + delete).
 */

jest.mock('../../src/lib/s3', () => ({
  moveUploadedFile: jest.fn().mockResolvedValue('images/user-a/file.jpg'),
  getImageUrl: jest.fn(key => `https://images.example.com/${key}`),
  objectExists: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../src/lib/cognito', () => ({
  getUserIdFromEvent: jest.fn().mockResolvedValue('user-a'),
}));

const { moveUploadedFile } = require('../../src/lib/s3');
const { processUpload } = require('../../src/handlers/images/process');

function makeEvent(key) {
  return { headers: {}, body: JSON.stringify({ key }) };
}

describe('processUpload key ownership', () => {
  test('rejects a key under another user uploads prefix with 400', async () => {
    const result = await processUpload(makeEvent('uploads/user-b/stolen.jpg'));
    expect(result.statusCode).toBe(400);
    expect(moveUploadedFile).not.toHaveBeenCalled();
  });

  test('rejects a key outside the uploads prefix with 400', async () => {
    const result = await processUpload(makeEvent('images/user-b/photo.jpg'));
    expect(result.statusCode).toBe(400);
    expect(moveUploadedFile).not.toHaveBeenCalled();
  });

  test('accepts a key under the requesting user uploads prefix', async () => {
    const result = await processUpload(makeEvent('uploads/user-a/mine.jpg'));
    expect(result.statusCode).toBe(200);
    expect(moveUploadedFile).toHaveBeenCalledWith(
      'uploads/user-a/mine.jpg',
      'user-a',
      undefined
    );
  });
});

/**
 * documents/create must reject URLs that point into another user's
 * S3 prefix (cross-tenant read/exfiltration vector via auto-extraction).
 */

jest.mock('../../src/lib/dynamodb', () => ({
  putItem: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../src/lib/cognito', () => ({
  getUserIdFromEvent: jest.fn().mockResolvedValue('user-a'),
}));
jest.mock('../../src/lib/csrf', () => ({
  validateCSRF: jest.fn(),
}));
jest.mock('@aws-sdk/client-sqs', () => ({
  SQSClient: jest.fn(() => ({ send: jest.fn() })),
  SendMessageCommand: jest.fn(),
}));

const { putItem } = require('../../src/lib/dynamodb');
const { createDocument } = require('../../src/handlers/documents/create');

function makeEvent(url) {
  return {
    headers: {},
    body: JSON.stringify({
      name: 'receipt',
      url,
      type: 'image',
      contentType: 'image/jpeg',
    }),
  };
}

describe('createDocument URL ownership', () => {
  test('rejects a URL under another user prefix with 400', async () => {
    const result = await createDocument(
      makeEvent('https://images.example.com/images/user-b/secret.jpg')
    );
    expect(result.statusCode).toBe(400);
    expect(putItem).not.toHaveBeenCalled();
  });

  test('accepts a URL under the requesting user prefix', async () => {
    const result = await createDocument(
      makeEvent('https://images.example.com/images/user-a/mine.jpg')
    );
    expect(result.statusCode).toBe(201);
    expect(putItem).toHaveBeenCalled();
  });
});

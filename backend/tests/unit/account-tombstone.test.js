/**
 * GTR-14 slice 1: once a deletion tombstone exists, no API path reads or
 * writes the user's data (AC11, AC15), and coded errors reach the client even
 * in production (CodedError).
 */

process.env.AWS_REGION = 'us-east-1';

const jwt = require('jsonwebtoken');

jest.mock('../../src/lib/accountJobs', () => ({
  isDeleting: jest.fn().mockResolvedValue(false),
}));
jest.mock('../../src/lib/dynamodb', () => ({
  getItem: jest.fn(),
  putItem: jest.fn(),
  updateItem: jest.fn().mockResolvedValue({}),
  queryItems: jest.fn().mockResolvedValue([]),
  queryByIndex: jest.fn(),
  scanItems: jest.fn().mockResolvedValue([]),
}));

const { isDeleting } = require('../../src/lib/accountJobs');
const dynamodb = require('../../src/lib/dynamodb');
const { CodedError, handleError } = require('../../src/lib/errors');
const response = require('../../src/lib/response');
const { getUserIdFromEvent } = require('../../src/lib/cognito');

function authedEvent(sub = 'user-a', extra = {}) {
  return {
    headers: {},
    requestContext: { authorizer: { jwt: { claims: { sub } } } },
    queryStringParameters: null,
    ...extra,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  isDeleting.mockResolvedValue(false);
});

describe('CodedError serialization', () => {
  const ORIGINAL = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = ORIGINAL; });

  test('code and publicFields are sent even in prod', () => {
    process.env.NODE_ENV = 'prod';
    const res = handleError(new CodedError(429, 'Slow down', 'EXPORT_RATE_LIMITED', { job: { jobId: 'j1' } }), response);
    expect(res.statusCode).toBe(429);
    expect(JSON.parse(res.body)).toEqual({ error: 'Slow down', code: 'EXPORT_RATE_LIMITED', job: { jobId: 'j1' } });
  });
});

describe('getUserIdFromEvent tombstone check', () => {
  test('returns the user id when no deletion is in progress', async () => {
    await expect(getUserIdFromEvent(authedEvent())).resolves.toBe('user-a');
    expect(isDeleting).toHaveBeenCalledWith('user-a');
  });

  test('rejects with 401 ACCOUNT_DELETION_IN_PROGRESS while deleting', async () => {
    isDeleting.mockResolvedValue(true);
    await expect(getUserIdFromEvent(authedEvent())).rejects.toMatchObject({
      statusCode: 401,
      code: 'ACCOUNT_DELETION_IN_PROGRESS',
    });
  });

  test('allowDeleting skips the check (deletion retry only)', async () => {
    isDeleting.mockResolvedValue(true);
    await expect(getUserIdFromEvent(authedEvent(), { allowDeleting: true })).resolves.toBe('user-a');
  });

  test('fails closed with 503 when the tombstone lookup errors', async () => {
    isDeleting.mockRejectedValue(new Error('dynamo down'));
    await expect(getUserIdFromEvent(authedEvent())).rejects.toMatchObject({
      statusCode: 503,
      code: 'SERVICE_UNAVAILABLE',
    });
  });

  test('a real handler returns 401 with the code and touches no data', async () => {
    isDeleting.mockResolvedValue(true);
    const { listGuitars } = require('../../src/handlers/guitars/list');
    const res = await listGuitars(authedEvent());
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('ACCOUNT_DELETION_IN_PROGRESS');
    expect(dynamodb.queryItems).not.toHaveBeenCalled();
  });
});

describe('login while deleting', () => {
  test('returns 403 with the code and no tokens', async () => {
    isDeleting.mockImplementation(async (sub) => sub === 'user-a');
    let login;
    jest.isolateModules(() => {
      jest.doMock('../../src/lib/cognito', () => ({
        authenticateUser: jest.fn().mockResolvedValue({
          idToken: jwt.sign({ sub: 'user-a' }, 'test-secret'),
          accessToken: 'a', refreshToken: 'r', expiresIn: 3600,
        }),
      }));
      jest.doMock('../../src/lib/accountJobs', () => ({ isDeleting }));
      ({ login } = require('../../src/handlers/auth/login'));
    });
    const res = await login({ body: JSON.stringify({ email: 'a@example.com', password: 'Passw0rd!x' }) });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('ACCOUNT_DELETION_IN_PROGRESS');
    expect(body.tokens).toBeUndefined();
  });

  test('registering the same email while the Cognito user still exists is refused (existing 409 path)', async () => {
    let register;
    jest.isolateModules(() => {
      const { ConflictError } = require('../../src/lib/errors');
      jest.doMock('../../src/lib/cognito', () => ({
        registerUser: jest.fn().mockRejectedValue(new ConflictError('User already exists')),
      }));
      jest.doMock('../../src/lib/csrf', () => ({ validateCSRF: jest.fn() }));
      ({ register } = require('../../src/handlers/auth/register'));
    });
    const res = await register({ headers: {}, body: JSON.stringify({ email: 'a@example.com', password: 'Strat-Tele-1965!', name: 'Alex' }) });
    expect(res.statusCode).toBe(409);
  });
});

describe('public share of a deleting owner', () => {
  const { getPublicShare } = require('../../src/handlers/shares/public-get');
  const share = { shareId: 's1', userId: 'user-a', guitarId: 'g1', isActive: true, sharedFields: {} };

  test('returns 404 without reading the guitar', async () => {
    dynamodb.queryByIndex.mockResolvedValue([share]);
    isDeleting.mockResolvedValue(true);
    const res = await getPublicShare({ pathParameters: { shareId: 's1' }, headers: {} });
    expect(res.statusCode).toBe(404);
    expect(dynamodb.getItem).not.toHaveBeenCalled();
  });

  test('view analytics write is conditional on the share still existing', async () => {
    dynamodb.queryByIndex.mockResolvedValue([share]);
    dynamodb.getItem.mockResolvedValue({ userId: 'user-a', guitarId: 'g1', brand: 'Fender', model: 'Strat', year: 1965, images: [] });
    await getPublicShare({ pathParameters: { shareId: 's1' }, headers: {} });
    await new Promise((r) => setImmediate(r));
    const call = dynamodb.updateItem.mock.calls.find((c) => c[1].shareId === 's1');
    expect(call[3]).toEqual({ condition: 'attribute_exists(shareId)' });
  });
});

describe('document extraction after deletion', () => {
  let startExtraction;
  let handleTextractComplete;
  let ddbDocMock;

  beforeAll(() => {
    const { mockClient } = require('aws-sdk-client-mock');
    const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
    ddbDocMock = mockClient(DynamoDBDocumentClient);
    ({ startExtraction, handleTextractComplete } = require('../../src/handlers/extraction/extract'));
  });

  beforeEach(() => ddbDocMock.reset());

  test('start: skips (no write, no throw) when the owner is being deleted', async () => {
    dynamodb.getItem.mockResolvedValue({ userId: 'user-a', documentId: 'd1', contentType: 'application/pdf' });
    isDeleting.mockResolvedValue(true);
    await expect(startExtraction({ userId: 'user-a', documentId: 'd1' })).resolves.toMatchObject({ status: 'skipped' });
    expect(dynamodb.updateItem).not.toHaveBeenCalled();
  });

  test('start: skips when the document no longer exists', async () => {
    dynamodb.getItem.mockRejectedValue(Object.assign(new Error('missing'), { name: 'NotFoundError' }));
    await expect(startExtraction({ userId: 'user-a', documentId: 'd1' })).resolves.toMatchObject({ status: 'skipped' });
  });

  test('Textract completion: missing document is skipped, not thrown', async () => {
    const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
    ddbDocMock.on(QueryCommand).resolves({ Items: [] });
    await expect(handleTextractComplete({ JobId: 'job-1', Status: 'SUCCEEDED' })).resolves.toMatchObject({ status: 'skipped' });
  });

  test('Textract completion: conditional write failure (document deleted mid-job) is swallowed', async () => {
    const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
    ddbDocMock.on(QueryCommand).resolves({ Items: [{ userId: 'user-a', documentId: 'd1', name: 'n' }] });
    dynamodb.updateItem.mockRejectedValue(Object.assign(new Error('gone'), { name: 'ConditionalCheckFailedException' }));
    await expect(handleTextractComplete({ JobId: 'job-1', Status: 'FAILED' })).resolves.toMatchObject({ status: 'failed' });
    expect(dynamodb.updateItem.mock.calls[0][3]).toEqual({ condition: 'attribute_exists(documentId)' });
  });
});

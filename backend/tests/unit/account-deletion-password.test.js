/** GTR-14: verifyPassword maps Cognito errors to client codes. */

process.env.S3_BUCKET_IMAGES = 'images-bucket';
process.env.S3_BUCKET_EXPORTS = 'exports-bucket';
process.env.COGNITO_USER_POOL_ID = 'pool';
process.env.COGNITO_CLIENT_ID = 'client';

const { mockClient } = require('aws-sdk-client-mock');

jest.mock('../../src/lib/accountJobs', () => ({ isDeleting: jest.fn() }));

describe('verifyPassword error mapping', () => {
  const {
    CognitoIdentityProviderClient,
    AdminInitiateAuthCommand,
  } = require('@aws-sdk/client-cognito-identity-provider');
  const cog = mockClient(CognitoIdentityProviderClient);
  let verifyPassword;

  beforeAll(() => {
    ({ verifyPassword } = require('../../src/lib/cognito'));
  });
  beforeEach(() => cog.reset());

  const notAuthorized = (message) => Object.assign(new Error(message), { name: 'NotAuthorizedException' });

  test('correct password resolves; uses sub as USERNAME and trims like login', async () => {
    cog.on(AdminInitiateAuthCommand).resolves({ AuthenticationResult: {} });
    await expect(verifyPassword('sub-1', '  secret  ')).resolves.toBeUndefined();
    expect(cog.commandCalls(AdminInitiateAuthCommand)[0].args[0].input).toMatchObject({
      AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
      AuthParameters: { USERNAME: 'sub-1', PASSWORD: 'secret' },
    });
  });

  test.each([
    ['wrong password', notAuthorized('Incorrect username or password.'), 401, 'WRONG_PASSWORD'],
    ['lockout', notAuthorized('Password attempts exceeded'), 429, 'TOO_MANY_ATTEMPTS'],
    ['other failure', Object.assign(new Error('boom'), { name: 'InternalErrorException' }), 503, 'SERVICE_UNAVAILABLE'],
  ])('%s → %s %s', async (_l, error, status, code) => {
    cog.on(AdminInitiateAuthCommand).rejects(error);
    await expect(verifyPassword('sub-1', 'pw')).rejects.toMatchObject({ statusCode: status, code });
  });

  test('missing password → 400 without calling Cognito', async () => {
    await expect(verifyPassword('sub-1', '')).rejects.toMatchObject({ statusCode: 400, code: 'PASSWORD_REQUIRED' });
    expect(cog.commandCalls(AdminInitiateAuthCommand)).toHaveLength(0);
  });
});


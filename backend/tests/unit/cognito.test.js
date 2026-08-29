process.env.COGNITO_USER_POOL_ID = 'us-east-1_test';
process.env.COGNITO_CLIENT_ID = 'test-client';
process.env.AWS_REGION = 'us-east-1';

const { mockClient } = require('aws-sdk-client-mock');
const {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminInitiateAuthCommand,
} = require('@aws-sdk/client-cognito-identity-provider');

const cognitoMock = mockClient(CognitoIdentityProviderClient);

const cognito = require('../../src/lib/cognito');
const { AuthenticationError, ConflictError } = require('../../src/lib/errors');

function awsError(name) {
  return Object.assign(new Error(name), { name });
}

beforeEach(() => cognitoMock.reset());

describe('cognito wrapper (v3)', () => {
  test('registerUser creates the user, sets a permanent password, returns identity', async () => {
    cognitoMock.on(AdminCreateUserCommand).resolves({ User: { Username: 'a@b.com' } });
    cognitoMock.on(AdminSetUserPasswordCommand).resolves({});

    const out = await cognito.registerUser('a@b.com', 'Passw0rd!', 'Ada');

    expect(out).toEqual({ userId: 'a@b.com', email: 'a@b.com', name: 'Ada' });
    expect(cognitoMock.commandCalls(AdminCreateUserCommand)).toHaveLength(1);
    const setPw = cognitoMock.commandCalls(AdminSetUserPasswordCommand)[0].args[0].input;
    expect(setPw.Permanent).toBe(true);
  });

  test('registerUser maps UsernameExistsException to ConflictError (v3 error.name)', async () => {
    cognitoMock.on(AdminCreateUserCommand).rejects(awsError('UsernameExistsException'));
    await expect(cognito.registerUser('a@b.com', 'p', 'Ada')).rejects.toThrow(ConflictError);
  });

  test('authenticateUser returns tokens from AuthenticationResult', async () => {
    cognitoMock.on(AdminInitiateAuthCommand).resolves({
      AuthenticationResult: {
        AccessToken: 'acc',
        IdToken: 'id',
        RefreshToken: 'ref',
        ExpiresIn: 3600,
      },
    });
    const out = await cognito.authenticateUser('a@b.com', 'p');
    expect(out).toEqual({ accessToken: 'acc', idToken: 'id', refreshToken: 'ref', expiresIn: 3600 });
  });

  test('authenticateUser maps NotAuthorizedException to AuthenticationError', async () => {
    cognitoMock.on(AdminInitiateAuthCommand).rejects(awsError('NotAuthorizedException'));
    await expect(cognito.authenticateUser('a@b.com', 'bad')).rejects.toThrow(AuthenticationError);
  });
});

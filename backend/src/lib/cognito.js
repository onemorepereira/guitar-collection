/**
 * Cognito utility functions
 */

const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const { AuthenticationError, ConflictError } = require('./errors');

const cognito = new AWS.CognitoIdentityServiceProvider();

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const CLIENT_ID = process.env.COGNITO_CLIENT_ID;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

// JWKS client for Cognito public keys
const client = jwksClient({
  jwksUri: `https://cognito-idp.${AWS_REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 600000, // Cache for 10 minutes
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

/**
 * Register a new user
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} name - User name
 * @returns {Promise<object>} User data
 */
async function registerUser(email, password, name) {
  try {
    const params = {
      UserPoolId: USER_POOL_ID,
      Username: email,
      UserAttributes: [
        {
          Name: 'email',
          Value: email,
        },
        {
          Name: 'email_verified',
          Value: 'true',
        },
        {
          Name: 'name',
          Value: name,
        },
      ],
      MessageAction: 'SUPPRESS', // Don't send welcome email
      TemporaryPassword: password,
    };

    const result = await cognito.adminCreateUser(params).promise();

    // Set permanent password
    const passwordParams = {
      UserPoolId: USER_POOL_ID,
      Username: email,
      Password: password,
      Permanent: true,
    };

    await cognito.adminSetUserPassword(passwordParams).promise();

    return {
      userId: result.User.Username,
      email: email,
      name: name,
    };
  } catch (error) {
    if (error.code === 'UsernameExistsException') {
      throw new ConflictError('User already exists');
    }
    throw error;
  }
}

/**
 * Authenticate a user
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<object>} Authentication tokens
 */
async function authenticateUser(email, password) {
  try {
    const params = {
      UserPoolId: USER_POOL_ID,
      ClientId: CLIENT_ID,
      AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    };

    const result = await cognito.adminInitiateAuth(params).promise();

    return {
      accessToken: result.AuthenticationResult.AccessToken,
      idToken: result.AuthenticationResult.IdToken,
      refreshToken: result.AuthenticationResult.RefreshToken,
      expiresIn: result.AuthenticationResult.ExpiresIn,
    };
  } catch (error) {
    if (error.code === 'NotAuthorizedException' || error.code === 'UserNotFoundException') {
      throw new AuthenticationError('Invalid email or password');
    }
    throw error;
  }
}

/**
 * Refresh authentication tokens
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<object>} New authentication tokens
 */
async function refreshTokens(refreshToken) {
  try {
    const params = {
      UserPoolId: USER_POOL_ID,
      ClientId: CLIENT_ID,
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
      },
    };

    const result = await cognito.adminInitiateAuth(params).promise();

    return {
      accessToken: result.AuthenticationResult.AccessToken,
      idToken: result.AuthenticationResult.IdToken,
      expiresIn: result.AuthenticationResult.ExpiresIn,
    };
  } catch (error) {
    if (error.code === 'NotAuthorizedException') {
      throw new AuthenticationError('Invalid refresh token');
    }
    throw error;
  }
}

/**
 * Get user details
 * @param {string} userId - User ID
 * @returns {Promise<object>} User details
 */
async function getUserDetails(userId) {
  const params = {
    UserPoolId: USER_POOL_ID,
    Username: userId,
  };

  const result = await cognito.adminGetUser(params).promise();

  const attributes = {};
  result.UserAttributes.forEach(attr => {
    attributes[attr.Name] = attr.Value;
  });

  return {
    userId: result.Username,
    email: attributes.email,
    name: attributes.name,
    emailVerified: attributes.email_verified === 'true',
    createdAt: result.UserCreateDate,
    updatedAt: result.UserLastModifiedDate,
  };
}

/**
 * Update user attributes
 * @param {string} userId - User ID
 * @param {object} attributes - Attributes to update
 * @returns {Promise<void>}
 */
async function updateUserAttributes(userId, attributes) {
  const userAttributes = Object.keys(attributes).map(key => ({
    Name: key,
    Value: attributes[key],
  }));

  const params = {
    UserPoolId: USER_POOL_ID,
    Username: userId,
    UserAttributes: userAttributes,
  };

  await cognito.adminUpdateUserAttributes(params).promise();
}

/**
 * Initiate forgot password flow
 * @param {string} email - User email
 * @returns {Promise<object>} Result
 */
async function forgotPassword(email) {
  const params = {
    ClientId: CLIENT_ID,
    Username: email,
  };

  const result = await cognito.forgotPassword(params).promise();

  return {
    destination: result.CodeDeliveryDetails.Destination,
  };
}

/**
 * Confirm forgot password with code
 * @param {string} email - User email
 * @param {string} code - Confirmation code
 * @param {string} newPassword - New password
 * @returns {Promise<void>}
 */
async function confirmForgotPassword(email, code, newPassword) {
  const params = {
    ClientId: CLIENT_ID,
    Username: email,
    ConfirmationCode: code,
    Password: newPassword,
  };

  await cognito.confirmForgotPassword(params).promise();
}

/**
 * Get signing key from JWKS
 * @param {string} kid - Key ID from JWT header
 * @returns {Promise<string>} Signing key
 */
async function getSigningKey(kid) {
  return new Promise((resolve, reject) => {
    client.getSigningKey(kid, (err, key) => {
      if (err) {
        reject(new AuthenticationError('Unable to get signing key'));
      } else {
        const signingKey = key.getPublicKey();
        resolve(signingKey);
      }
    });
  });
}

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @returns {Promise<object>} Decoded token payload
 * @throws {AuthenticationError} If token is invalid
 */
async function verifyJWT(token) {
  try {
    // Decode header to get kid (key ID)
    const decoded = jwt.decode(token, { complete: true });

    if (!decoded || !decoded.header || !decoded.header.kid) {
      throw new AuthenticationError('Invalid token format');
    }

    // Get signing key using kid
    const signingKey = await getSigningKey(decoded.header.kid);

    // Verify token signature and claims
    const payload = jwt.verify(token, signingKey, {
      algorithms: ['RS256'],
      issuer: `https://cognito-idp.${AWS_REGION}.amazonaws.com/${USER_POOL_ID}`,
      audience: CLIENT_ID,
    });

    return payload;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AuthenticationError('Token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new AuthenticationError('Invalid token');
    } else if (error instanceof AuthenticationError) {
      throw error;
    }
    throw new AuthenticationError('Token verification failed');
  }
}

/**
 * Extract and validate user ID from JWT token
 * @param {object} event - Lambda event
 * @returns {Promise<string>} User ID
 */
async function getUserIdFromEvent(event) {
  // First, try to extract from API Gateway authorizer (primary path)
  // For HTTP API with JWT authorizer
  if (event.requestContext?.authorizer?.jwt?.claims?.sub) {
    const userId = event.requestContext.authorizer.jwt.claims.sub;

    // Defense in depth: Also verify the token if available in headers
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const payload = await verifyJWT(token);

        // Ensure the userId from authorizer matches the verified token
        if (payload.sub !== userId) {
          throw new AuthenticationError('Token mismatch');
        }
      } catch (error) {
        console.error('Token verification failed:', error.message);
        throw error;
      }
    }

    return userId;
  }

  // For REST API with custom authorizer
  if (event.requestContext?.authorizer?.claims?.sub) {
    return event.requestContext.authorizer.claims.sub;
  }

  // Fallback: If no authorizer context, try to validate token directly from headers
  const authHeader = event.headers?.Authorization || event.headers?.authorization;
  if (authHeader) {
    try {
      const token = authHeader.replace('Bearer ', '');
      const payload = await verifyJWT(token);
      return payload.sub;
    } catch (error) {
      throw error;
    }
  }

  throw new AuthenticationError('Unable to extract user ID from token');
}

module.exports = {
  registerUser,
  authenticateUser,
  refreshTokens,
  getUserDetails,
  updateUserAttributes,
  forgotPassword,
  confirmForgotPassword,
  getUserIdFromEvent,
  verifyJWT, // Export for advanced use cases
};

/**
 * User profile handlers
 */

const { getUserDetails, updateUserAttributes } = require('../../lib/cognito');
const { getItem, updateItem } = require('../../lib/dynamodb');
const { getUserIdFromEvent } = require('../../lib/cognito');
const response = require('../../lib/response');
const { handleError } = require('../../lib/errors');
const { TABLES } = require('../../config/constants');

/**
 * Get user profile
 */
async function getProfile(event) {
  try {
    const userId = await getUserIdFromEvent(event);

    // Get user details from Cognito
    const cognitoUser = await getUserDetails(userId);

    // Get user data from DynamoDB
    let dbUser;
    try {
      dbUser = await getItem(TABLES.USERS, { userId });
    } catch (error) {
      // User might not exist in DB yet, return Cognito data only
      dbUser = {};
    }

    return response.ok({
      user: {
        userId: cognitoUser.userId,
        email: cognitoUser.email,
        name: cognitoUser.name,
        emailVerified: cognitoUser.emailVerified,
        createdAt: dbUser.createdAt || cognitoUser.createdAt,
        updatedAt: dbUser.updatedAt || cognitoUser.updatedAt,
      },
    });
  } catch (error) {
    return handleError(error, response);
  }
}

/**
 * Update user profile
 */
async function updateProfile(event) {
  try {
    const userId = await getUserIdFromEvent(event);
    const body = JSON.parse(event.body);

    const updates = {};
    const cognitoUpdates = {};

    // Handle name update
    if (body.name) {
      cognitoUpdates.name = body.name.trim();
      updates.name = body.name.trim();
    }

    // Update Cognito attributes if any
    if (Object.keys(cognitoUpdates).length > 0) {
      await updateUserAttributes(userId, cognitoUpdates);
    }

    // Update DynamoDB record
    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date().toISOString();

      await updateItem(
        TABLES.USERS,
        { userId },
        updates
      );
    }

    // Get updated profile
    const updatedUser = await getUserDetails(userId);

    return response.ok({
      message: 'Profile updated successfully',
      user: {
        userId: updatedUser.userId,
        email: updatedUser.email,
        name: updatedUser.name,
        emailVerified: updatedUser.emailVerified,
      },
    });
  } catch (error) {
    return handleError(error, response);
  }
}

module.exports = {
  getProfile,
  updateProfile,
};

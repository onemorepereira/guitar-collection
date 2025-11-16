/**
 * DynamoDB utility functions
 */

const AWS = require('aws-sdk');
const { NotFoundError } = require('./errors');

const dynamodb = new AWS.DynamoDB.DocumentClient();

/**
 * Get an item from DynamoDB
 * @param {string} tableName - Table name
 * @param {object} key - Item key
 * @returns {Promise<object>} Item data
 */
async function getItem(tableName, key) {
  const params = {
    TableName: tableName,
    Key: key,
  };

  const result = await dynamodb.get(params).promise();

  if (!result.Item) {
    throw new NotFoundError('Item not found');
  }

  return result.Item;
}

/**
 * Put an item in DynamoDB
 * @param {string} tableName - Table name
 * @param {object} item - Item data
 * @param {object} options - Additional options
 * @returns {Promise<object>} Created item
 */
async function putItem(tableName, item, options = {}) {
  const params = {
    TableName: tableName,
    Item: item,
    ...options,
  };

  await dynamodb.put(params).promise();
  return item;
}

/**
 * Update an item in DynamoDB
 * @param {string} tableName - Table name
 * @param {object} key - Item key
 * @param {object} updates - Fields to update
 * @returns {Promise<object>} Updated item
 */
async function updateItem(tableName, key, updates) {
  const updateExpressionParts = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};

  Object.keys(updates).forEach((field, index) => {
    const attrName = `#attr${index}`;
    const attrValue = `:val${index}`;

    updateExpressionParts.push(`${attrName} = ${attrValue}`);
    expressionAttributeNames[attrName] = field;
    expressionAttributeValues[attrValue] = updates[field];
  });

  const params = {
    TableName: tableName,
    Key: key,
    UpdateExpression: `SET ${updateExpressionParts.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW',
  };

  const result = await dynamodb.update(params).promise();
  return result.Attributes;
}

/**
 * Delete an item from DynamoDB
 * @param {string} tableName - Table name
 * @param {object} key - Item key
 * @returns {Promise<void>}
 */
async function deleteItem(tableName, key) {
  const params = {
    TableName: tableName,
    Key: key,
  };

  await dynamodb.delete(params).promise();
}

/**
 * Query items from DynamoDB
 * @param {string} tableName - Table name
 * @param {string} keyConditionExpression - Key condition
 * @param {object} expressionAttributeValues - Expression values
 * @param {object} options - Additional options
 * @returns {Promise<array>} Query results
 */
async function queryItems(tableName, keyConditionExpression, expressionAttributeValues, options = {}) {
  const params = {
    TableName: tableName,
    KeyConditionExpression: keyConditionExpression,
    ExpressionAttributeValues: expressionAttributeValues,
    ...options,
  };

  const result = await dynamodb.query(params).promise();
  return result.Items;
}

/**
 * Scan items from DynamoDB
 * @param {string} tableName - Table name
 * @param {object} options - Additional options
 * @returns {Promise<array>} Scan results
 */
async function scanItems(tableName, options = {}) {
  const params = {
    TableName: tableName,
    ...options,
  };

  const result = await dynamodb.scan(params).promise();
  return result.Items;
}

/**
 * Query items by GSI
 * @param {string} tableName - Table name
 * @param {string} indexName - Index name
 * @param {string} keyConditionExpression - Key condition
 * @param {object} expressionAttributeValues - Expression values
 * @param {object} options - Additional options
 * @returns {Promise<array>} Query results
 */
async function queryByIndex(tableName, indexName, keyConditionExpression, expressionAttributeValues, options = {}) {
  return queryItems(tableName, keyConditionExpression, expressionAttributeValues, {
    IndexName: indexName,
    ...options,
  });
}

/**
 * Batch get items from DynamoDB
 * @param {string} tableName - Table name
 * @param {array} keys - Array of item keys
 * @returns {Promise<array>} Array of items
 */
async function batchGetItems(tableName, keys) {
  if (keys.length === 0) {
    return [];
  }

  const params = {
    RequestItems: {
      [tableName]: {
        Keys: keys,
      },
    },
  };

  const result = await dynamodb.batchGet(params).promise();
  return result.Responses[tableName] || [];
}

/**
 * Batch write items to DynamoDB
 * @param {string} tableName - Table name
 * @param {array} items - Array of items to write
 * @returns {Promise<void>}
 */
async function batchWriteItems(tableName, items) {
  if (items.length === 0) {
    return;
  }

  // DynamoDB batch write supports max 25 items
  const batches = [];
  for (let i = 0; i < items.length; i += 25) {
    batches.push(items.slice(i, i + 25));
  }

  for (const batch of batches) {
    const params = {
      RequestItems: {
        [tableName]: batch.map(item => ({
          PutRequest: {
            Item: item,
          },
        })),
      },
    };

    await dynamodb.batchWrite(params).promise();
  }
}

module.exports = {
  getItem,
  putItem,
  updateItem,
  deleteItem,
  queryItems,
  scanItems,
  queryByIndex,
  batchGetItems,
  batchWriteItems,
};

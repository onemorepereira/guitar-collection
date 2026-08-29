const { mockClient } = require('aws-sdk-client-mock');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  BatchWriteCommand,
} = require('@aws-sdk/lib-dynamodb');

const ddbMock = mockClient(DynamoDBDocumentClient);

const db = require('../../src/lib/dynamodb');
const { NotFoundError } = require('../../src/lib/errors');

beforeEach(() => ddbMock.reset());

describe('dynamodb wrapper (v3)', () => {
  test('getItem sends GetCommand and returns the item', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { id: '1', name: 'Strat' } });
    const item = await db.getItem('Guitars', { id: '1' });
    expect(item).toEqual({ id: '1', name: 'Strat' });
    const call = ddbMock.commandCalls(GetCommand)[0];
    expect(call.args[0].input).toEqual({ TableName: 'Guitars', Key: { id: '1' } });
  });

  test('getItem throws NotFoundError when no item', async () => {
    ddbMock.on(GetCommand).resolves({});
    await expect(db.getItem('Guitars', { id: 'x' })).rejects.toThrow(NotFoundError);
  });

  test('putItem sends PutCommand and returns the item', async () => {
    ddbMock.on(PutCommand).resolves({});
    const item = { id: '1', brand: 'Fender' };
    const out = await db.putItem('Guitars', item);
    expect(out).toBe(item);
    expect(ddbMock.commandCalls(PutCommand)[0].args[0].input).toEqual({
      TableName: 'Guitars',
      Item: item,
    });
  });

  test('updateItem builds a SET expression and returns Attributes', async () => {
    ddbMock.on(UpdateCommand).resolves({ Attributes: { id: '1', brand: 'Gibson' } });
    const out = await db.updateItem('Guitars', { id: '1' }, { brand: 'Gibson' });
    expect(out).toEqual({ id: '1', brand: 'Gibson' });
    const input = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(input.UpdateExpression).toBe('SET #attr0 = :val0');
    expect(input.ExpressionAttributeNames).toEqual({ '#attr0': 'brand' });
    expect(input.ExpressionAttributeValues).toEqual({ ':val0': 'Gibson' });
    expect(input.ReturnValues).toBe('ALL_NEW');
  });

  test('deleteItem sends DeleteCommand', async () => {
    ddbMock.on(DeleteCommand).resolves({});
    await db.deleteItem('Guitars', { id: '1' });
    expect(ddbMock.commandCalls(DeleteCommand)).toHaveLength(1);
  });

  test('queryItems returns Items', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [{ id: '1' }, { id: '2' }] });
    const out = await db.queryItems('Guitars', 'userId = :u', { ':u': 'user-a' });
    expect(out).toHaveLength(2);
  });

  test('batchWriteItems chunks writes into batches of 25', async () => {
    ddbMock.on(BatchWriteCommand).resolves({});
    const items = Array.from({ length: 26 }, (_, i) => ({ id: String(i) }));
    await db.batchWriteItems('Guitars', items);
    expect(ddbMock.commandCalls(BatchWriteCommand)).toHaveLength(2);
  });
});

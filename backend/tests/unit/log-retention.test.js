/** GTR-14 AC18: log-retention custom resource. */

const https = require('https');
const { EventEmitter } = require('events');
const { mockClient } = require('aws-sdk-client-mock');
const {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  PutRetentionPolicyCommand,
} = require('@aws-sdk/client-cloudwatch-logs');

const logs = mockClient(CloudWatchLogsClient);
const { handler } = require('../../src/handlers/log-retention');

let responses;

beforeEach(() => {
  logs.reset();
  responses = [];
  jest.spyOn(https, 'request').mockImplementation((options, onResponse) => {
    const req = new EventEmitter();
    req.end = (body) => {
      responses.push({ options, body: JSON.parse(body) });
      const res = new EventEmitter();
      res.resume = () => {};
      onResponse(res);
      res.emit('end');
    };
    return req;
  });
});

afterEach(() => jest.restoreAllMocks());

const event = (RequestType, FunctionNames = ['stack-auth', 'stack-guitars']) => ({
  RequestType,
  ResponseURL: 'https://cfn-response.example/path?sig=1',
  StackId: 'stack-id',
  RequestId: 'req-1',
  LogicalResourceId: 'LogRetention',
  ResourceProperties: { RetentionInDays: '90', FunctionNames },
});

test.each(['Create', 'Update'])('%s: creates (if missing) and sets 90 days on each function log group', async (type) => {
  logs.on(CreateLogGroupCommand).rejectsOnce(Object.assign(new Error('exists'), { name: 'ResourceAlreadyExistsException' })).resolves({});
  logs.on(PutRetentionPolicyCommand).resolves({});
  await handler(event(type));
  const puts = logs.commandCalls(PutRetentionPolicyCommand).map((c) => c.args[0].input);
  expect(puts).toEqual([
    { logGroupName: '/aws/lambda/stack-auth', retentionInDays: 90 },
    { logGroupName: '/aws/lambda/stack-guitars', retentionInDays: 90 },
  ]);
  expect(responses).toHaveLength(1);
  expect(responses[0].options).toMatchObject({ method: 'PUT', hostname: 'cfn-response.example', path: '/path?sig=1' });
  expect(responses[0].body).toMatchObject({ Status: 'SUCCESS', PhysicalResourceId: 'log-retention', RequestId: 'req-1' });
});

test('Delete: changes nothing and reports success', async () => {
  await handler(event('Delete'));
  expect(logs.commandCalls(PutRetentionPolicyCommand)).toHaveLength(0);
  expect(responses[0].body.Status).toBe('SUCCESS');
});

test('an API failure reports FAILED with a reason (the stack never hangs)', async () => {
  logs.on(CreateLogGroupCommand).resolves({});
  logs.on(PutRetentionPolicyCommand).rejects(Object.assign(new Error('not allowed'), { name: 'AccessDeniedException' }));
  await expect(handler(event('Update'))).resolves.toBeUndefined();
  expect(responses).toHaveLength(1);
  expect(responses[0].body.Status).toBe('FAILED');
  expect(responses[0].body.Reason).toMatch(/AccessDeniedException/);
});

/**
 * Assertions on backend/template.yaml for GTR-14 infrastructure.
 */

const { loadTemplate, functionsOf } = require('../helpers/template');

const t = loadTemplate();
const R = t.Resources;

const policyJson = (fn) => JSON.stringify(fn.Properties.Policies || []);

test('AccountJobsTable: keys, TTL, encryption, retained', () => {
  const table = R.AccountJobsTable;
  expect(table.DeletionPolicy).toBe('Retain');
  expect(table.UpdateReplacePolicy).toBe('Retain');
  expect(table.Properties.KeySchema).toEqual([
    { AttributeName: 'userId', KeyType: 'HASH' },
    { AttributeName: 'job', KeyType: 'RANGE' },
  ]);
  expect(table.Properties.TimeToLiveSpecification).toEqual({ AttributeName: 'expiresAt', Enabled: true });
  expect(table.Properties.SSESpecification.SSEEnabled).toBe(true);
});

test('every function can read AccountJobsTable (tombstone check)', () => {
  // LogRetentionHandler is a CloudFormation custom resource, not an API path
  for (const fn of functionsOf(t).filter((f) => f.name !== 'LogRetentionHandler')) {
    expect({ fn: fn.name, readsAccountJobs: /AccountJobsTable/.test(policyJson(fn)) })
      .toEqual({ fn: fn.name, readsAccountJobs: true });
  }
});

test('ExportsBucket: private, not versioned, 7-day expiry, retained, not a CDN origin', () => {
  const b = R.ExportsBucket;
  expect(b.DeletionPolicy).toBe('Retain');
  expect(b.Properties.VersioningConfiguration).toBeUndefined();
  expect(b.Properties.PublicAccessBlockConfiguration).toEqual({
    BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true,
  });
  const rule = b.Properties.LifecycleConfiguration.Rules[0];
  expect(rule.ExpirationInDays).toBe(7);
  expect(rule.AbortIncompleteMultipartUpload.DaysAfterInitiation).toBe(1);
  const distributions = Object.values(R).filter((r) => r.Type === 'AWS::CloudFront::Distribution');
  for (const d of distributions) {
    expect(JSON.stringify(d)).not.toMatch(/ExportsBucket/);
  }
});

test('AccountJobsQueue: visibility >= 6x worker timeout, DLQ after 5 receives, alarm on DLQ', () => {
  const q = R.AccountJobsQueue.Properties;
  const worker = R.AccountJobsHandler.Properties;
  expect(q.VisibilityTimeout).toBeGreaterThanOrEqual(6 * worker.Timeout);
  expect(q.RedrivePolicy.maxReceiveCount).toBe(5);
  expect(q.RedrivePolicy.deadLetterTargetArn).toEqual({ 'Fn::GetAtt': ['AccountJobsDLQ', 'Arn'] });
  const alarm = R.AccountJobsDLQAlarm.Properties;
  expect(alarm.Dimensions[0].Value).toEqual({ 'Fn::GetAtt': ['AccountJobsDLQ', 'QueueName'] });
  expect(alarm.TreatMissingData).toBe('notBreaching');
  expect(alarm.AlarmActions).toEqual([{ Ref: 'AlarmTopic' }]);
  expect(R.AlarmEmailSubscription.Condition).toBe('HasAlarmEmail');
});

test('AccountJobsHandler: SQS (batch 1) + 15-minute sweep schedule', () => {
  const ev = R.AccountJobsHandler.Properties.Events;
  expect(ev.Jobs).toMatchObject({ Type: 'SQS', Properties: { BatchSize: 1 } });
  expect(ev.Sweep).toMatchObject({ Type: 'Schedule', Properties: { Schedule: 'rate(15 minutes)' } });
  expect(JSON.parse(ev.Sweep.Properties.Input)).toEqual({ type: 'sweep' });
  expect(R.AccountJobsHandler.Properties.Timeout).toBe(900);
});

test('functions that delete files can invalidate the images CDN', () => {
  for (const name of ['GuitarsHandler', 'DocumentsHandler', 'SharesHandler', 'AccountJobsHandler']) {
    expect({ name, ok: /cloudfront:CreateInvalidation/.test(policyJson(R[name])) }).toEqual({ name, ok: true });
  }
});

test('Globals expose the new resources to functions', () => {
  const env = t.Globals.Function.Environment.Variables;
  expect(env.DYNAMODB_TABLE_ACCOUNT_JOBS).toEqual({ Ref: 'AccountJobsTable' });
  expect(env.IMAGES_DISTRIBUTION_ID).toEqual({ Ref: 'ImagesDistribution' });
  expect(env.S3_BUCKET_EXPORTS).toEqual({ Ref: 'ExportsBucket' });
  expect(env.ACCOUNT_JOBS_QUEUE_URL).toEqual({ Ref: 'AccountJobsQueue' });
});

test('POST /user/deletion: JWT-protected, throttled at 1 rps / burst 3', () => {
  const ev = R.UserHandler.Properties.Events.RequestDeletion.Properties;
  expect(ev).toMatchObject({ Path: '/user/deletion', Method: 'POST', Auth: { Authorizer: 'CognitoAuthorizer' } });
  const route = R.GuitarCollectionApi.Properties.RouteSettings['POST /user/deletion'];
  expect(route).toEqual({ ThrottlingBurstLimit: 3, ThrottlingRateLimit: 1 });
});

test('UserHandler can verify passwords, sign out, write tombstones, and enqueue jobs', () => {
  const p = policyJson(R.UserHandler);
  for (const needle of ['cognito-idp:AdminInitiateAuth', 'cognito-idp:AdminUserGlobalSignOut', 'SQSSendMessagePolicy']) {
    expect(p).toContain(needle);
  }
  expect(p).toMatch(/DynamoDBCrudPolicy[^\]]*AccountJobsTable/);
});

test('AccountJobsHandler can delete the Cognito user and every user table', () => {
  const p = policyJson(R.AccountJobsHandler);
  expect(p).toContain('cognito-idp:AdminDeleteUser');
  for (const table of ['GuitarsTable', 'UsersTable', 'DocumentsTable', 'ProvenanceReportsTable', 'SharesTable', 'AccountJobsTable']) {
    expect(p).toContain(table);
  }
});

test('export routes: POST throttled 1/3, GET status, both JWT-protected; User can read export ZIPs to presign', () => {
  const ev = R.UserHandler.Properties.Events;
  expect(ev.StartExport.Properties).toMatchObject({ Path: '/user/export', Method: 'POST', Auth: { Authorizer: 'CognitoAuthorizer' } });
  expect(ev.ExportStatus.Properties).toMatchObject({ Path: '/user/export', Method: 'GET', Auth: { Authorizer: 'CognitoAuthorizer' } });
  expect(R.GuitarCollectionApi.Properties.RouteSettings['POST /user/export']).toEqual({ ThrottlingBurstLimit: 3, ThrottlingRateLimit: 1 });
  expect(policyJson(R.UserHandler)).toMatch(/ExportsBucket\.Arn}\/exports\/\*/);
});

test('LogRetention covers every function with 90-day retention', () => {
  const props = R.LogRetention.Properties;
  expect(props.RetentionInDays).toBe(90);
  const listed = props.FunctionNames.map((f) => f.Ref).sort();
  expect(listed).toEqual(functionsOf(t).map((f) => f.name).sort());
  expect(policyJson(R.LogRetentionHandler)).toContain('logs:PutRetentionPolicy');
});

test('images bucket keeps old versions 30 days (images/, shared/) and 1 day (uploads/)', () => {
  const rules = R.ImagesBucket.Properties.LifecycleConfiguration.Rules;
  const byPrefix = Object.fromEntries(rules.map((r) => [r.Prefix, r]));
  expect(byPrefix['images/'].NoncurrentVersionExpiration).toEqual({ NoncurrentDays: 30 });
  expect(byPrefix['shared/'].NoncurrentVersionExpiration).toEqual({ NoncurrentDays: 30 });
  expect(byPrefix['images/'].ExpiredObjectDeleteMarker).toBe(true);
  expect(byPrefix['uploads/'].NoncurrentVersionExpiration).toEqual({ NoncurrentDays: 1 });
});

test('alarms: failed deletion steps (log metric filter) and API 5xx notify the alarm topic', () => {
  expect(R.AccountDeletionFailedMetricFilter.Properties.FilterPattern).toBe('{ $.event = "deletion_failed" }');
  expect(R.AccountDeletionFailedMetricFilter.DependsOn).toBe('LogRetention');
  expect(R.AccountDeletionFailedAlarm.Properties.AlarmActions).toEqual([{ Ref: 'AlarmTopic' }]);
  expect(R.ApiServerErrorsAlarm.Properties).toMatchObject({ Namespace: 'AWS/ApiGateway', MetricName: '5xx' });
  expect(R.ApiServerErrorsAlarm.Properties.Dimensions[0].Value).toEqual({ Ref: 'GuitarCollectionApi' });
});

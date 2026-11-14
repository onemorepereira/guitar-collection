/**
 * CloudFormation custom resource: 90-day retention on every function's log
 * group (GTR-14 AC18), including log groups Lambda auto-created earlier with
 * "never expire". Re-applied whenever the resource's properties change
 * (FunctionNames or Revision); a template test ensures every function is listed.
 *
 * Always responds to CloudFormation (SUCCESS or FAILED with a reason), so a
 * failure can never leave the stack waiting.
 */

const https = require('https');
const {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  PutRetentionPolicyCommand,
} = require('@aws-sdk/client-cloudwatch-logs');

const logs = new CloudWatchLogsClient({ region: process.env.AWS_REGION || 'us-east-1', maxAttempts: 5 });

async function applyRetention(functionNames, retentionInDays) {
  for (const name of functionNames) {
    const logGroupName = `/aws/lambda/${name}`;
    try {
      await logs.send(new CreateLogGroupCommand({ logGroupName }));
    } catch (error) {
      if (error.name !== 'ResourceAlreadyExistsException') throw error;
    }
    await logs.send(new PutRetentionPolicyCommand({ logGroupName, retentionInDays }));
  }
}

function respond(event, status, reason) {
  const body = JSON.stringify({
    Status: status,
    Reason: reason || 'See CloudWatch logs',
    PhysicalResourceId: 'log-retention',
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: {},
  });
  return new Promise((resolve) => {
    const url = new URL(event.ResponseURL);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'PUT',
      headers: { 'content-type': '', 'content-length': Buffer.byteLength(body) },
    }, (res) => { res.resume(); res.on('end', resolve); });
    req.setTimeout(10000, () => req.destroy(new Error('cfn-response timed out')));
    req.on('error', (error) => { console.error('Failed to send cfn-response', error.message); resolve(); });
    req.end(body);
  });
}

exports.handler = async (event) => {
  let status = 'SUCCESS';
  let reason;
  try {
    if (event.RequestType === 'Create' || event.RequestType === 'Update') {
      const props = event.ResourceProperties || {};
      const retention = Number(props.RetentionInDays);
      await applyRetention(props.FunctionNames || [], retention);
      console.log(JSON.stringify({ event: 'log_retention_applied', functions: (props.FunctionNames || []).length, retention }));
    }
    // Delete: leave retention in place (removing the resource shouldn't make logs permanent again)
  } catch (error) {
    status = 'FAILED';
    reason = `${error.name || 'Error'}: ${error.message}`.slice(0, 500);
    console.error(JSON.stringify({ event: 'log_retention_failed', reason }));
  } finally {
    await respond(event, status, reason);
  }
};

exports.applyRetention = applyRetention;

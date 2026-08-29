/**
 * Guards the v2→v3 marshalling behavior change: v2's DocumentClient silently
 * dropped undefined values, v3 throws "Pass options.removeUndefinedValues=true"
 * unless the client is configured with removeUndefinedValues. This crashed
 * provenance report generation in production.
 *
 * aws-sdk-client-mock can only mock at the DocumentClient send (which bypasses
 * marshalling) or the low-level client (which the DocumentClient does not route
 * through), so we can't fully stub the network here. Instead we assert the call
 * gets PAST marshalling: without the fix it rejects with the removeUndefinedValues
 * error; with it, marshalling succeeds and it fails later (on credentials) — never
 * with the marshalling error.
 */
const db = require('../../src/lib/dynamodb');

test('putItem with undefined values does not reject with the marshalling error', async () => {
  const item = { id: '1', keep: 'value', optional: undefined, nested: { a: undefined, b: 2 } };
  await expect(db.putItem('ProvenanceReports', item)).rejects.not.toThrow(/removeUndefinedValues/);
});

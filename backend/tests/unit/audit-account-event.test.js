/** GTR-14 AC20: account audit events never carry email, IP, or user agent. */

const { logAccountEvent } = require('../../src/lib/audit');

test('records user id, action, result, timestamp and safe details only', () => {
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  logAccountEvent('user-a', 'DELETION_REQUESTED', 'DENIED', {
    code: 'WRONG_PASSWORD',
    email: 'a@example.com',
    ip: '1.2.3.4',
    ipAddress: '1.2.3.4',
    userAgent: 'Mozilla',
  });
  const entry = JSON.parse(log.mock.calls[0][0]);
  log.mockRestore();
  expect(entry).toMatchObject({ type: 'ACCOUNT_EVENT', userId: 'user-a', action: 'DELETION_REQUESTED', result: 'DENIED', code: 'WRONG_PASSWORD' });
  expect(entry.timestamp).toEqual(expect.any(String));
  for (const key of ['email', 'ip', 'ipAddress', 'userAgent']) {
    expect(entry).not.toHaveProperty(key);
  }
});

const ALLOWED = 'https://guitarhelp.click';

// csrf.js computes its allowed-origin list at import time from env,
// so configure a production-like environment before requiring it.
process.env.NODE_ENV = 'prod';
process.env.FRONTEND_DOMAIN = 'guitarhelp.click';

const { validateCSRF } = require('../../src/lib/csrf');
const { AuthorizationError } = require('../../src/lib/errors');

function postEvent(headers) {
  return {
    requestContext: { http: { method: 'POST' } },
    headers,
  };
}

describe('validateCSRF origin enforcement', () => {
  test('passes with the custom header and a valid Origin', () => {
    expect(() =>
      validateCSRF(postEvent({ 'x-requested-with': 'XMLHttpRequest', origin: ALLOWED }))
    ).not.toThrow();
  });

  test('rejects a state-changing request with no Origin header', () => {
    expect(() =>
      validateCSRF(postEvent({ 'x-requested-with': 'XMLHttpRequest' }))
    ).toThrow(AuthorizationError);
  });

  test('rejects a foreign Origin', () => {
    expect(() =>
      validateCSRF(
        postEvent({ 'x-requested-with': 'XMLHttpRequest', origin: 'https://evil.example.com' })
      )
    ).toThrow(AuthorizationError);
  });

  test('does not require Origin on GET', () => {
    expect(() =>
      validateCSRF({ requestContext: { http: { method: 'GET' } }, headers: {} })
    ).not.toThrow();
  });
});

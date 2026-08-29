/**
 * The provenance router's top-level catch must return a proper HTTP 500,
 * not response.error('Internal server error') — which puts a string in
 * statusCode and makes API Gateway emit a 502.
 */

jest.mock('../../src/handlers/provenance/generate', () => ({ generateReport: jest.fn() }));
jest.mock('../../src/handlers/provenance/list', () => ({ listReports: jest.fn() }));
jest.mock('../../src/handlers/provenance/get', () => ({ getReport: jest.fn() }));
jest.mock('../../src/handlers/provenance/delete', () => ({ deleteReport: jest.fn() }));

const { handler } = require('../../src/handlers/provenance/index');

test('unhandled routing error yields a numeric 500 status', async () => {
  // rawPath undefined + path undefined makes path.match() throw inside try
  const event = {
    requestContext: { http: { method: 'POST' } },
  };
  const result = await handler(event);
  expect(typeof result.statusCode).toBe('number');
  expect(result.statusCode).toBe(500);
});

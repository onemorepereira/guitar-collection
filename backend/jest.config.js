module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  // Runtime Lambda deps are installed under src/ (SAM builds from src/package.json)
  moduleDirectories: ['node_modules', '<rootDir>/src/node_modules'],
  // Load the REAL sanitize-html (pinned to a CommonJS-compatible htmlparser2)
  // so the suite exercises the same module chain the Lambda runtime loads —
  // a passthrough stub here previously masked an ESM-only htmlparser2 that
  // crashed handlers at cold start in production.
  clearMocks: true,
};

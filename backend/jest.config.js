module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  // Runtime Lambda deps are installed under src/ (SAM builds from src/package.json)
  moduleDirectories: ['node_modules', '<rootDir>/src/node_modules'],
  // sanitize-html pulls in ESM-only htmlparser2 that jest can't parse; the
  // unit tests don't exercise sanitization, so stub it with a passthrough.
  moduleNameMapper: {
    '^sanitize-html$': '<rootDir>/tests/__mocks__/sanitize-html.js',
  },
  clearMocks: true,
};

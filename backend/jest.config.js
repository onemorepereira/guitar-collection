module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  // Runtime Lambda deps are installed under src/ (SAM builds from src/package.json)
  moduleDirectories: ['node_modules', '<rootDir>/src/node_modules'],
  clearMocks: true,
};

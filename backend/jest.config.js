module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  testMatch: ['**/tests/**/*.test.js'],
  moduleNameMapper: {
    // uuid v13 is ESM-only — redirect to a CJS-compatible shim using Node built-ins
    '^uuid$': '<rootDir>/__mocks__/uuid.js',
  },
};

const base = require('./jest.config.js');

module.exports = {
  ...base,
  testMatch: ['**/?(*.)+integration.test.ts'],
  testPathIgnorePatterns: ['/node_modules/'],
  testTimeout: 30000,
};

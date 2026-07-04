import baseConfig from './jest.config.js';

/** @type {import('jest').Config} */
const config = {
  ...baseConfig,
  testMatch: [
    '<rootDir>/__tests__/integration/**/*.test.ts',
  ],
  globalSetup: '<rootDir>/__tests__/integration/globalSetup.ts',
  globalTeardown: '<rootDir>/__tests__/integration/globalTeardown.ts',
  setupFiles: ['<rootDir>/__tests__/integration/setupEnv.ts'],
};

export default config;

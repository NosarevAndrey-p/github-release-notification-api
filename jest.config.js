/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
};

export default config;

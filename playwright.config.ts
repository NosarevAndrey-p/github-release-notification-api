import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// dotenv.config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './__tests__/e2e',
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on the same file because of database state. */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://127.0.0.1:8989',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },



  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npx tsx server.ts',
    url: 'http://127.0.0.1:8989/health',
    reuseExistingServer: !process.env.CI,
    timeout: 30 * 1000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      PORT: '8989',
      DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5434/repo_subscriber_test',
      NODE_ENV: 'test',
      SCAN_INTERVAL: '1000', // Scan every 1 second for fast and natural E2E test scanning
      GITHUB_API_URL: 'http://127.0.0.1:3002', // Point to our mock GitHub server
    },
  },
});

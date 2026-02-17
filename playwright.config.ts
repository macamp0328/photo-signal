import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Visual Regression Testing
 *
 * This configuration is specifically for visual regression tests.
 * See https://playwright.dev/docs/test-configuration
 */

const htmlReporter: [
  'html',
  { open: 'always' | 'never' | 'on-failure'; host: string; port: number },
] = [
  'html',
  {
    open: process.env.CI ? 'never' : 'on-failure',
    host: '0.0.0.0',
    port: 9323,
  },
];

export default defineConfig({
  testDir: './tests/visual',
  // Maximum time one test can run (30s for visual tests)
  timeout: 30 * 1000,
  // Expect timeout for assertions (5s)
  expect: {
    timeout: 5000,
    // Configuration for toHaveScreenshot
    toHaveScreenshot: {
      // Threshold for pixel mismatch (0.2% tolerance for anti-aliasing differences)
      maxDiffPixelRatio: 0.002,
      // Animation handling
      animations: 'disabled',
      // Scale option
      scale: 'css',
    },
  },
  // Run tests in files in parallel
  fullyParallel: true,
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  // Reliable CI: single worker and one retry for transient renderer noise
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  // Reporter to use
  reporter: process.env.CI ? [htmlReporter, ['github'], ['list']] : [htmlReporter, ['list']],
  // Shared settings for all the projects below
  use: {
    // Base URL for the app
    baseURL: 'http://localhost:4173',
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    // Screenshot on failure
    screenshot: 'only-on-failure',
    // Video on failure
    video: 'retain-on-failure',
  },

  // Configure projects for major browsers and devices
  // Firefox removed for speed; run Chrome/Safari + mobile variants in all environments
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
        },
      },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile devices
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 5'],
        launchOptions: {
          args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
        },
      },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Run your local dev server before starting the tests
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});

import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for FixTray end-to-end tests.
 *
 * Run:
 *   npm run test:e2e          — all browsers
 *   npm run test:e2e:ci       — Chromium only (CI)
 *   npm run test:e2e:headed   — visible browser window
 *   npm run test:e2e:ui       — interactive Playwright UI
 */
export default defineConfig({
  testDir: './e2e',

  // Run all tests in parallel by default
  fullyParallel: true,

  // Fail the build on CI if a test file has `test.only`
  forbidOnly: !!process.env.CI,

  // Retry once on CI to reduce flakiness from timing issues
  retries: process.env.CI ? 1 : 0,

  // Limit workers in CI to avoid resource contention
  workers: process.env.CI ? 2 : undefined,

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ...(process.env.CI ? [['github'] as ['github']] : []),
  ],

  use: {
    // Base URL so tests can use relative paths: await page.goto('/login')
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',

    // Collect traces on retry for debugging
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on retry
    video: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile viewports
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
    },
  ],

  // Start the Next.js dev server automatically before running e2e tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});

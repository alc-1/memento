import { defineConfig, devices } from '@playwright/test';

const PORT = 4321;

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        permissions: ['clipboard-read', 'clipboard-write'],
      },
    },
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7'],
        permissions: ['clipboard-read', 'clipboard-write'],
      },
      testIgnore: /(validate|slug|admin-api|admin-ui)\.spec\.js/, // browser-independent, run once
    },
  ],
  // Tests run against the real production build served under /meme/.
  webServer: {
    command: `npm run build && npx astro preview --port ${PORT}`,
    url: `http://localhost:${PORT}/meme/`,
    // Never reuse: a leftover server would serve a stale build and hide failures.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

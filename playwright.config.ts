import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:3911',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      // mobile runs booking + mobile-wizard only; manage tests run on desktop
      testMatch: ['e2e/booking.spec.ts', 'e2e/mobile-booking.spec.ts'],
    },
  ],
  webServer: {
    command: 'bash scripts/start-local-prod.sh 3911',
    url: 'http://localhost:3911/nl/boeken',
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})

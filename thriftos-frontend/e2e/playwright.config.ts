import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests on a phone-sized screen against the production build (service worker on).
 * Needs: `npx ng build`, `npm --prefix ../server run build`, and a Postgres with PW_DATABASE_URL
 * (a *_test database; `npm run e2e` resets it and seeds the base data first).
 */
export const PW_DATABASE_URL =
  process.env['PW_DATABASE_URL'] || 'postgresql://thriftos:thriftos@localhost:5432/thriftos_pw_test?schema=public';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4300',
    ...devices['Pixel 5'],
    viewport: { width: 360, height: 760 },
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'phone', use: { browserName: 'chromium' } }],
  webServer: [
    {
      command: 'node ../../server/dist/main.js',
      url: 'http://localhost:3300/api/health',
      reuseExistingServer: !process.env['CI'],
      env: {
        PORT: '3300',
        NODE_ENV: 'development',
        DATABASE_URL: PW_DATABASE_URL,
        JWT_SECRET: process.env['JWT_SECRET'] || 'playwright-only-secret',
        UPLOAD_DIR: '/tmp/thriftos-pw-uploads',
        PUBLIC_APP_URL: 'http://localhost:4300',
        THROTTLE_LIMIT_SHORT: '100000',
        THROTTLE_LIMIT_MEDIUM: '100000',
        THROTTLE_LIMIT_LONG: '100000',
      },
    },
    {
      command: 'node serve.mjs',
      url: 'http://localhost:4300/manifest.webmanifest',
      reuseExistingServer: !process.env['CI'],
      env: { PORT: '4300', API: 'http://localhost:3300' },
    },
  ],
});

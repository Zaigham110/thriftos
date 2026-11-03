import { defineConfig, devices } from '@playwright/test';

/**
 * Task 4.3: the demo, on the demo database (thriftos_demo, filled by `npm run demo:reset`), on a 360×740 phone,
 * in Urdu and English, plus the offline sale + payment test. Own ports, so it never mixes with the other tests.
 * Run with `npm run e2e:demo` (resets the demo first) or `npx playwright test -c e2e/playwright.demo.config.ts`.
 */
const DEMO_DATABASE_URL = process.env['DEMO_DATABASE_URL'] || 'postgresql://thriftos:thriftos@localhost:5432/thriftos_demo?schema=public';
process.env['PW_OWNER_EMAIL'] = 'owner@almadina.demo';
process.env['PW_OWNER_PASSWORD'] = 'Demo@1234';

export default defineConfig({
  testDir: '.',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4400',
    ...devices['Pixel 5'],
    viewport: { width: 360, height: 740 },
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'demo', testMatch: '*.demo.ts', use: { browserName: 'chromium' } },
    { name: 'offline', testMatch: 'offline-sync.spec.ts', grep: /offline sale and payment/, use: { browserName: 'chromium' } },
  ],
  webServer: [
    {
      command: 'node ../../server/dist/main.js',
      url: 'http://localhost:3400/api/health',
      reuseExistingServer: !process.env['CI'],
      env: {
        PORT: '3400',
        NODE_ENV: 'development',
        DATABASE_URL: DEMO_DATABASE_URL,
        JWT_SECRET: process.env['JWT_SECRET'] || 'playwright-only-secret',
        UPLOAD_DIR: '/tmp/thriftos-demo-uploads',
        PUBLIC_APP_URL: 'http://localhost:4400',
        THROTTLE_LIMIT_SHORT: '100000',
        THROTTLE_LIMIT_MEDIUM: '100000',
        THROTTLE_LIMIT_LONG: '100000',
        THROTTLE_LOGIN_LIMIT: '1000',
      },
    },
    {
      command: 'node serve.mjs',
      url: 'http://localhost:4400/manifest.webmanifest',
      reuseExistingServer: !process.env['CI'],
      env: { PORT: '4400', API: 'http://localhost:3400' },
    },
  ],
});

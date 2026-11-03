// Lighthouse (mobile) for the owner home and the sign-in page; writes docs/v1/lighthouse/.
// Lighthouse 11 is used because it still has the PWA (installable) category. Not a dependency of the app:
//   npm i --no-save lighthouse@11.7.1 && node scripts/lighthouse.mjs ../docs/v1/lighthouse
// Needs the app on http://localhost:4300 (e2e/serve.mjs + the API), signed in as the base seed's demo owner.
// CHROME=/path/to/chrome overrides the browser.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import lighthouse from 'lighthouse';
import { chromium } from 'playwright';
const out = process.argv[2] || '../docs/v1/lighthouse';
const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'lh-')), {
  ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}),
  args: ['--remote-debugging-port=9333'],
  viewport: { width: 360, height: 740 },
});
const page = await ctx.newPage();
await page.addInitScript(() => localStorage.setItem('thriftos.lang', 'en'));
await page.goto('http://localhost:4300/auth/login');
await page.locator('.who .chip').nth(1).click();
await page.fill('input[type=email]', 'admin@demo.thriftos.com');
await page.fill('input[type=password]', 'admin123');
await page.click('button[type=submit]');
await page.waitForURL('**/home');
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload();
await page.waitForTimeout(4000);
const results = {};
for (const [name, url, reset] of [['owner-home', 'http://localhost:4300/home', false], ['sign-in', 'http://localhost:4300/auth/login', false], ['sign-in-first-visit', 'http://localhost:4300/auth/login', true]]) {
  const r = await lighthouse(url, { port: 9333, output: ['html', 'json'], logLevel: 'error', onlyCategories: ['performance', 'pwa', 'accessibility', 'best-practices'], disableStorageReset: !reset }, {
    extends: 'lighthouse:default',
    settings: { formFactor: 'mobile', screenEmulation: { mobile: true, width: 360, height: 740, deviceScaleFactor: 2, disabled: false } },
  });
  fs.writeFileSync(`${out}/lighthouse-${name}.html`, r.report[0]);
  const lhr = r.lhr;
  const s = Object.fromEntries(Object.entries(lhr.categories).map(([k, c]) => [k, Math.round(c.score * 100)]));
  const a = lhr.audits;
  results[name] = {
    url,
    cache: reset ? 'cleared (first visit)' : 'service worker warm (installed app)',
    lighthouse: lhr.lighthouseVersion,
    throttling: lhr.configSettings.throttlingMethod,
    scores: s,
    installable: a['installable-manifest']?.score === 1,
    metrics: Object.fromEntries(['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift', 'speed-index', 'interactive'].map((m) => [m, a[m]?.displayValue])),
    failedPwa: lhr.categories.pwa ? lhr.categories.pwa.auditRefs.filter((x) => a[x.id].score !== null && a[x.id].score < 1).map((x) => x.id) : [],
  };
}
fs.writeFileSync(`${out}/summary.json`, JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
await ctx.close();

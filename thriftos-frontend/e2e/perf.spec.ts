import { expect, test } from '@playwright/test';
import { signIn, waitForOfflineReady } from './helpers';

/**
 * Task 4.2: owner home on Chrome "Slow 3G" (2 s round trip, ~400 kbit/s — applied by e2e/serve.mjs to every
 * request, service worker included) with the CPU slowed 4×, on a 360px phone.
 *
 * The owner opens the installed app: the app comes from the service worker, the owner's last numbers from
 * the phone, and the fresh numbers replace them when they arrive.
 */
test('owner home opens in under 2 s on Slow 3G with 4x CPU slowdown', async ({ page, context }) => {
  test.setTimeout(180_000);
  await signIn(page);
  await waitForOfflineReady(page);
  await page.goto('/home');
  await expect(page.locator('a.stat')).toHaveCount(4);
  await page.waitForLoadState('networkidle');

  await page.request.get('/__slow3g/on');
  try {
    const phone = await context.newPage();
    const cdp = await context.newCDPSession(phone);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    let freshAt = 0;
    const started = Date.now();
    context.on('requestfinished', (r) => {
      if (!freshAt && r.url().endsWith('/api/home')) freshAt = Date.now() - started;
    });
    await phone.goto('/home', { waitUntil: 'commit' });
    await expect(phone.locator('a.stat .big-number')).toHaveCount(4, { timeout: 30_000 });
    const shown = Date.now() - started;
    await expect.poll(() => freshAt, { timeout: 30_000 }).toBeGreaterThan(0);
    console.log(`owner home on Slow 3G + 4x CPU: numbers shown after ${shown} ms, fresh numbers after ${freshAt} ms`);
    test.info().annotations.push({ type: 'owner-home-shown-ms', description: String(shown) }, { type: 'owner-home-fresh-ms', description: String(freshAt) });
    expect(shown).toBeLessThan(2000);
  } finally {
    await page.request.get('/__slow3g/off');
  }
});

test('first visit ever (nothing cached) on Slow 3G with 4x CPU: how long the sign-in screen takes', async ({ browser }) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.75 });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.request.get('http://localhost:4300/__slow3g/on');
  try {
    const started = Date.now();
    await page.goto('http://localhost:4300/auth/login', { waitUntil: 'commit' });
    await expect(page.locator('button[type=submit]')).toBeVisible({ timeout: 60_000 });
    const ms = Date.now() - started;
    console.log(`first visit, sign-in screen usable after ${ms} ms (Slow 3G + 4x CPU, nothing cached)`);
    test.info().annotations.push({ type: 'cold-login-ms', description: String(ms) });
  } finally {
    await page.request.get('http://localhost:4300/__slow3g/off');
    await context.close();
  }
});

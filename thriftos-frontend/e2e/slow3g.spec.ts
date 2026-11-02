import { Page, expect, test } from '@playwright/test';
import { keypad, keys, loose } from './floor';
import { apiAs, signIn, waitForOfflineReady } from './helpers';

/**
 * Chrome DevTools "Slow 3G" (2 s round trip, ~400 kbit/s), applied by the test server (e2e/serve.mjs) to every
 * request — CDP throttling would miss the requests the service worker makes.
 */
async function slow3g(page: Page, on: boolean): Promise<void> {
  const res = await page.request.get(`/__slow3g/${on ? 'on' : 'off'}`);
  expect(res.ok()).toBeTruthy();
}

async function timed(label: string, work: () => Promise<void>): Promise<number> {
  const start = Date.now();
  await work();
  const ms = Date.now() - start;
  console.log(`${label}: ${(ms / 1000).toFixed(1)} s`);
  return ms;
}

/**
 * The 10-second test (docs/v1/05) on throttled Slow 3G with the app installed (service worker warm):
 * open each daily screen from its tab and save one entry. The screen must be usable and the save confirmed
 * in under 10 s of app and network time (a person's typing comes on top; each needs at most 4 fields).
 */
test.afterEach(async ({ page }) => {
  await page.request.get('/__slow3g/off');
});

test('daily screens pass the 10-second test on Slow 3G', async ({ page, request }) => {
  test.setTimeout(240_000);
  const api = await apiAs(request);
  const tag = Date.now().toString().slice(-6);
  const lot = await api.post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 500, purchaseCost: 100000 });
  const customer = await api.post('/customers', { name: `Slow Buyer ${tag}`, phone: `0301${tag}2` });
  const item = await api.post('/stock/items', { name: `Slow Jeans ${tag}`, unit: 'KG', quantity: 100, totalCost: 20000 });

  await signIn(page);
  await waitForOfflineReady(page);
  // Warm the cached data once, as a phone that has been used before.
  for (const url of ['/receive/lot', `/sort/${lot.id}`, '/sell/new', `/khata/${customer.id}`]) {
    await page.goto(url);
    await page.waitForLoadState('networkidle');
  }
  await page.goto('/home');
  await slow3g(page, true);
  test.info().annotations.push({ type: 'network', description: 'Slow 3G' });

  const results: Record<string, number> = {};
  results['receive lot'] = await timed('receive lot', async () => {
    await page.getByRole('link', { name: 'Maal aya' }).click();
    await page.getByRole('link', { name: /Loose lot/ }).click();
    await keypad(page, /^Lot weight/, 250);
    await keypad(page, /^Purchase cost/, 50000);
    await page.getByRole('button', { name: 'Save lot' }).click();
    await expect(page.locator('.done')).toBeVisible({ timeout: 20_000 });
  });

  results['sort line'] = await timed('sort line', async () => {
    await page.goto(`/sort/${lot.id}`);
    await page.getByRole('listitem').filter({ hasText: 'Jeans' }).click({ timeout: 20_000 });
    await keys(page, 120);
    await expect(page.getByRole('status').filter({ hasText: loose('120.0 kg Jeans added') })).toBeVisible({ timeout: 20_000 });
  });

  results['sale'] = await timed('sale', async () => {
    await page.getByRole('link', { name: 'Becho' }).click();
    await page.getByRole('link', { name: 'New sale' }).click();
    await page.getByPlaceholder('Search name or phone').fill(customer.name, { timeout: 20_000 });
    await page.getByRole('listitem').filter({ hasText: customer.name }).click();
    await page.getByPlaceholder('Search stock').fill(item.name);
    await page.getByRole('listitem').filter({ hasText: item.name }).click();
    await keypad(page, /^Quantity/, 10);
    await keypad(page, /^Price/, 400);
    await page.getByRole('button', { name: 'Save sale' }).click();
    await expect(page.getByRole('button', { name: 'Share bill on WhatsApp' })).toBeVisible({ timeout: 20_000 });
  });

  results['payment'] = await timed('payment', async () => {
    await page.goto(`/khata/${customer.id}`);
    await page.getByRole('button', { name: 'Payment received' }).click({ timeout: 20_000 });
    await keypad(page, /^Amount/, 1000);
    await page.getByRole('button', { name: 'Save payment' }).click();
    await expect(page.getByRole('status').filter({ hasText: loose('Rs 1,000 received') })).toBeVisible({ timeout: 20_000 });
  });

  await slow3g(page, false);
  for (const [screen, ms] of Object.entries(results)) expect(ms, `${screen} took ${ms} ms on Slow 3G`).toBeLessThan(10_000);
});

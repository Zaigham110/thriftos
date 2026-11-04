import { expect, test } from '@playwright/test';
import { keypad, loose, pickTile, sortLoose } from './floor';
import { apiAs, signIn, waitForOfflineReady } from './helpers';

/**
 * Task 3.2 acceptance: with the network off, a sale and a payment are saved on the phone; when the
 * network comes back they sync, and the server has exactly one sale and one payment — also when a
 * reply is lost on the way back and the phone sends the same entry again.
 */
test('offline sale and payment sync once when the network returns', async ({ page, context, request }) => {
  const api = await apiAs(request);
  const tag = Date.now().toString().slice(-6);
  const customer = await api.post('/customers', { name: `Offline Buyer ${tag}`, phone: `0300${tag}1` });
  const item = await api.post('/stock/items', { name: `Offline Jeans ${tag}`, unit: 'KG', quantity: 100, totalCost: 20000 });

  await signIn(page);
  await waitForOfflineReady(page);
  // Open the screens once online so their data (customers, stock, khata) is cached on the phone.
  await page.goto('/sell/new');
  await pickTile(page, 'Search name or phone', customer.name);
  await expect(page.locator('.picked')).toContainText(customer.name);
  await page.goto(`/khata/${customer.id}`);
  await expect(page.getByRole('heading', { name: new RegExp(customer.name) })).toBeVisible();

  await context.setOffline(true);

  // Sale on udhaar, with the network off.
  await page.goto('/sell/new');
  await pickTile(page, 'Search name or phone', customer.name);
  await pickTile(page, 'Search stock', item.name);
  await keypad(page, /^Quantity/, 10);
  await keypad(page, /^Price/, 450);
  await page.getByRole('button', { name: 'Udhaar', exact: true }).click();
  await page.getByRole('button', { name: 'Save sale' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Sale saved on phone' })).toBeVisible();

  // Payment received, with the network off.
  await page.goto(`/khata/${customer.id}`);
  await page.getByRole('button', { name: 'Payment received' }).click();
  await keypad(page, /^Amount/, 1500);
  await page.getByRole('button', { name: 'Save payment' }).click();
  await expect(page.getByRole('status').filter({ hasText: loose('Rs 1,500 saved on phone') })).toBeVisible();
  await expect(page.getByText('Offline — saved on phone (2)')).toBeVisible();

  // Nothing reached the server yet.
  expect((await api.get(`/khata/customers/${customer.id}`)).balance).toBe('0');

  // Back online, but the first reply to the sale is lost: the server saves it, the phone does not hear back.
  let dropped = false;
  await context.route('**/api/sales', async (route) => {
    if (!dropped && route.request().method() === 'POST') {
      dropped = true;
      await route.fetch();
      await route.abort('connectionreset');
      return;
    }
    await route.continue();
  });
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByText('Synced', { exact: true })).toBeVisible({ timeout: 60_000 });
  expect(dropped).toBe(true);

  const ledger = await api.get(`/khata/customers/${customer.id}`);
  const kinds = ledger.lines.map((e: { kind: string }) => e.kind);
  expect(kinds.filter((k: string) => k === 'SALE')).toHaveLength(1);
  expect(kinds.filter((k: string) => k === 'PAYMENT')).toHaveLength(1);
  expect(ledger.balance).toBe('3000'); // 10 kg × 450 − 1,500

  // Another sync attempt changes nothing.
  await page.reload();
  await page.waitForTimeout(1500);
  const again = await api.get(`/khata/customers/${customer.id}`);
  expect(again.lines).toHaveLength(ledger.lines.length);
});

/** Task 3.2/3.4: receive, sort lines and a bale made with the network off sync once each. */
test('offline lot, sort lines and bale sync once', async ({ page, context, request }) => {
  const startedAt = Date.now() - 1000;
  const api = await apiAs(request);
  const tag = Date.now().toString().slice(-6);
  const categories = await api.get('/tenant/categories');
  const tshirts = categories.find((c: { name: string }) => c.name === 'T-Shirts');
  // A lot to sort, and sorted T-Shirts to bale.
  const lot = await api.post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 200, purchaseCost: 40000 });
  const lot2 = await api.post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 100, purchaseCost: 30000 });
  const s = await api.post('/sorting/stage-1/start', { ragId: lot2.id });
  await api.post('/sorting/stage-1/allocate', { sessionId: s.session.id, categoryId: tshirts.id, amountKg: 100 });
  await request.patch(`/api/sorting/stage-1/${s.session.id}/seal`, { headers: { Authorization: `Bearer ${(await (await request.post('/api/auth/login', { data: { email: 'admin@demo.thriftos.com', password: 'admin123' } })).json()).accessToken}` }, data: {} });
  const balesBefore = (await api.get('/stock/bales')).length;

  await signIn(page);
  await waitForOfflineReady(page);
  for (const url of ['/receive/lot', '/sort', `/sort/${lot.id}`, '/stock/bale']) {
    await page.goto(url);
    await expect(page.locator('.floor-head h1')).toBeVisible();
    await page.waitForLoadState('networkidle');
  }
  await expect(page.locator('.tiles').getByRole('button').filter({ hasText: 'T-Shirts' }).first()).toBeVisible();

  await context.setOffline(true);

  await page.goto('/receive/lot');
  await keypad(page, /^Lot weight/, `3${tag.slice(-2)}`);
  await keypad(page, /^Purchase cost/, 60000);
  await page.getByRole('button', { name: 'Save lot' }).click();
  await expect(page.getByText('Saved on phone. It will sync when you are online.').first()).toBeVisible();

  await page.goto(`/sort/${lot.id}`);
  await sortLoose(page, 'Jeans', 120);
  await sortLoose(page, 'Dresses', 50);
  await expect(page.locator('.totals')).toContainText(loose('170.0 kg'));
  await expect(page.locator('.totals')).toContainText(loose('30.0 kg'));

  await page.goto('/stock/bale');
  await page.locator('.tiles').getByRole('button').filter({ hasText: 'T-Shirts' }).first().click();
  await keypad(page, /^Bale weight/, 40);
  await page.getByRole('button', { name: 'Save bale' }).click();
  await expect(page.getByText('Saved on phone. It will sync when you are online.').first()).toBeVisible();
  // lot + sort start + 2 lines + bale
  await expect(page.getByText('Offline — saved on phone (5)')).toBeVisible();

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByText('Synced', { exact: true })).toBeVisible({ timeout: 60_000 });

  // The lot made offline, counted among lots created during this test only (earlier runs leave others).
  const lots = (await api.get('/sorting/stage-1/queue?limit=100')).data as { weightKg: string; id: string; createdAt: string }[];
  expect(lots.filter((l) => l.weightKg === `3${tag.slice(-2)}` && new Date(l.createdAt).getTime() >= startedAt)).toHaveLength(1);
  const summary = await api.get(`/sorting/stage-1/summary?ragId=${lot.id}`);
  const kg = Object.fromEntries(summary.buckets.map((b: { category: { name: string }; outputWeightKg: string }) => [b.category.name, b.outputWeightKg]));
  expect(kg).toEqual({ Jeans: '120', Dresses: '50' });
  expect((await api.get('/stock/bales')).length).toBe(balesBefore + 1);

  await page.reload();
  await page.waitForTimeout(1500);
  expect((await api.get('/stock/bales')).length).toBe(balesBefore + 1);
});

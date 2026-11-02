import { expect, test } from '@playwright/test';
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
  await expect(page.getByText(customer.name)).toBeVisible();
  await page.goto(`/khata/${customer.id}`);
  await expect(page.getByRole('heading', { name: customer.name })).toBeVisible();

  await context.setOffline(true);

  // Sale on udhaar, with the network off.
  await page.goto('/sell/new');
  await page.getByPlaceholder('Search name or phone').fill(customer.name);
  await page.getByRole('button', { name: customer.name }).click();
  await page.getByPlaceholder('Search stock').fill(item.name);
  await page.getByRole('button', { name: new RegExp(item.name) }).click();
  await page.getByRole('spinbutton', { name: 'kg', exact: true }).fill('10');
  await page.getByRole('spinbutton', { name: 'Rs per kg' }).fill('450');
  await page.getByRole('button', { name: 'Udhaar' }).click();
  await page.getByRole('button', { name: 'Save sale' }).click();
  await expect(page.getByText('Sale saved on phone')).toBeVisible();

  // Payment received, with the network off.
  await page.goto(`/khata/${customer.id}`);
  await page.getByRole('button', { name: 'Payment received' }).click();
  await page.locator('input[name="amount"]').fill('1500');
  await page.getByRole('button', { name: 'Save payment' }).click();
  await expect(page.getByText('Rs 1,500 saved on phone')).toBeVisible();
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

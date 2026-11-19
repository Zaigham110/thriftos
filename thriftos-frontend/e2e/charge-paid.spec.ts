import { expect, test } from '@playwright/test';
import { apiAs, signIn } from './helpers';

test('a lot charge says where it was paid from and shows in that book (owner, 2026-11-19)', async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await signIn(page);
  await page.goto('/receive/records/lots/new');
  await page.getByLabel(/^Lot weight/).fill('300');
  await page.getByRole('radio', { name: 'Rate per kg' }).click();
  await page.getByLabel(/^Rate per kg/).fill('200');
  await page.getByRole('button', { name: '+ Transport' }).click();
  await page.getByLabel('Amount (Rs)').fill('4321');
  // A new charge is paid from the drawer unless said otherwise.
  const paid = page.getByLabel('Paid from');
  await expect(paid).toHaveValue('CASH');
  await paid.selectOption('BANK');
  await page.getByRole('button', { name: 'Save lot' }).click();
  await expect(page).toHaveURL(/\/sort\/records\/(?!new)[^/]+$/);
  const id = page.url().split('/').pop()!;

  const api = await apiAs(request);
  const lot = await api.get(`/procurement/rags/${id}`);
  expect(lot.charges.map((c: any) => [c.kind, Number(c.amount), c.paidFrom])).toEqual([['TRANSPORT', 4321, 'BANK']]);

  // The bank book shows it leaving, named by the lot; a click opens the lot.
  await page.goto('/finance/book');
  await page.locator('.methods').getByRole('button', { name: 'Bank' }).click();
  const row = page.locator('ws-data-grid tbody tr').filter({ hasText: `Transport for ${lot.ragCode}` });
  await expect(row).toContainText('4,321');
  await row.click();
  await expect(page).toHaveURL(new RegExp(`/${id}$`));
});

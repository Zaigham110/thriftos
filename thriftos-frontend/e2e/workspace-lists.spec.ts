import { APIRequestContext, expect, test } from '@playwright/test';
import { apiAs, signIn } from './helpers';

// Enterprise plan E2 in the browser: the sales list (server paging, filters, group-by, saved views, export)
// and a sale's record page (pipeline, amounts, lines/payments, notes with @mention, attachments),
// plus record search in Ctrl/⌘ K.

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

/** One part-paid sale of ready stock for a new customer, through the real API. */
async function makeSale(request: APIRequestContext) {
  const api = await apiAs(request);
  const tag = Date.now().toString().slice(-6);
  const customer = await api.post('/customers', { name: `Workspace Buyer ${tag}`, phone: `0301${tag}1`, city: 'Karachi' });
  const item = await api.post('/stock/items', { name: `Jeans bale ${tag}`, unit: 'BALE', quantity: 2, totalCost: 50000 });
  const sale = await api.post('/sales', {
    customerId: customer.id,
    lines: [{ inventoryItemId: item.id, unit: 'BALE', quantity: 1, unitPrice: 40000 }],
    paymentMode: 'PARTIAL',
    paidAmount: 15000,
    paymentMethod: 'JAZZCASH',
  });
  return { customer, sale, tag };
}

test('sales list: search, filter chip, group by status, saved view, Excel export', async ({ page, request }) => {
  const { sale, customer } = await makeSale(request);
  await signIn(page);
  await page.goto('/sell/records');
  await expect(page.getByRole('heading', { name: 'Sales', exact: true })).toBeVisible();
  await expect(page.locator('ws-data-grid tbody tr').first()).toBeVisible();

  await page.getByPlaceholder('Search sale number, customer or city').fill(customer.name);
  await expect(page.locator('ws-data-grid tbody tr')).toHaveCount(1);
  await expect(page.locator('ws-data-grid tbody tr')).toContainText(sale.saleNumber);
  await expect(page.locator('ws-data-grid tfoot')).toContainText('40,000');

  await page.getByPlaceholder('Search sale number, customer or city').fill('');
  await page.getByLabel('Status').last().selectOption({ label: 'Part paid' });
  await expect(page.locator('.chip')).toContainText('Status: Part paid');
  await expect(page.locator('ws-data-grid tbody tr').filter({ hasText: sale.saleNumber })).toBeVisible();

  await page.getByLabel('Group by').selectOption({ label: 'Status' });
  const group = page.locator('ws-data-grid tbody tr').filter({ hasText: 'Part paid' });
  await expect(group).toBeVisible();
  await group.click();
  await expect(page.getByLabel('Group by')).toHaveValue('');

  const viewName = `Part paid ${Date.now()}`;
  await page.locator('ws-view-menu button').first().click();
  await page.getByPlaceholder('Name this view').fill(viewName);
  await page.getByRole('button', { name: 'Save view' }).click();
  await page.reload();
  await page.locator('ws-view-menu button').first().click();
  await expect(page.getByRole('menuitemradio', { name: viewName })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Export' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Excel' }).click();
  expect((await download).suggestedFilename()).toMatch(/^thriftos-sales-\d{4}-\d{2}-\d{2}\.xlsx$/);
});

test('sale record: amounts, tabs, note with @mention and an attached file; Ctrl+K finds it', async ({ page, request }) => {
  const { sale, customer } = await makeSale(request);
  await signIn(page);

  await page.keyboard.press('Control+k');
  await page.keyboard.type(sale.saleNumber);
  await expect(page.getByRole('option', { name: new RegExp(sale.saleNumber) })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/sell/records/${sale.id}$`));

  await expect(page.getByRole('heading', { name: `${sale.saleNumber} · ${customer.name}` })).toBeVisible();
  await expect(page.locator('ws-status-pipeline [aria-current="step"]')).toHaveText('Part paid');
  await expect(page.locator('ws-smart-button').filter({ hasText: 'Due' })).toContainText('25,000');
  await expect(page.locator('ws-smart-button').filter({ hasText: 'Paid' })).toContainText('15,000');
  await page.getByRole('tab', { name: /Payments/ }).click();
  await expect(page.locator('ws-data-grid tbody tr')).toContainText('JazzCash');

  const box = page.getByPlaceholder('Write a note for the team…');
  await box.fill('Spoke to the buyer, rest on Friday. ');
  await box.press('End');
  await box.pressSequentially('@');
  await expect(page.getByRole('option').first()).toBeVisible();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Add note' }).click();
  await expect(page.locator('ws-activity-panel li.note')).toContainText('rest on Friday');

  await page.locator('ws-activity-panel input[type=file]').setInputFiles({ name: 'jazzcash-slip.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%slip\n') });
  await expect(page.locator('ws-activity-panel li.attachment')).toContainText('jazzcash-slip.pdf');
  await expect(page.locator('ws-activity-panel li.change')).toContainText('made the sale');
});

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
  await page.locator('[role=dialog] input').fill(sale.saleNumber);
  // Other records (lots) can match the same digits; pick the sale itself.
  await page.getByRole('option', { name: new RegExp(sale.saleNumber) }).click();
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

test('containers: list, board move, traceability record; supplier scorecard', async ({ page, request }) => {
  const api = await apiAs(request);
  const tag = Date.now().toString().slice(-6);
  const supplier = await api.post('/procurement/vendors', { name: `Atlantic Rags ${tag}`, originCountry: 'Canada' });
  const container = await api.post('/procurement/containers', { vendorId: supplier.id, containerNumber: `TGHU-${tag}`, netWeightKg: 12000, purchaseCost: 900000 });
  await api.post(`/procurement/containers/${container.id}/charges`, { chargeType: 'CLEARING', amount: 60000 });

  await signIn(page);
  await page.goto('/receive/records/containers');
  await expect(page.getByRole('heading', { name: 'Containers', exact: true })).toBeVisible();
  await page.getByPlaceholder('Search container number, supplier or country').fill(`TGHU-${tag}`);
  const row = page.locator('ws-data-grid tbody tr').filter({ hasText: `TGHU-${tag}` });
  await expect(row).toContainText('On the way');
  await expect(row).toContainText('960,000');

  // Board: move it to Arrived with the card's picker (the keyboard way; dragging calls the same move).
  await page.getByRole('button', { name: 'Board' }).click();
  const card = page.locator('app-board article').filter({ hasText: `TGHU-${tag}` });
  await expect(card).toBeVisible();
  await card.getByLabel('Move to').selectOption({ label: 'Arrived' });
  await expect(page.locator('app-board section[aria-label="Arrived"] article').filter({ hasText: `TGHU-${tag}` })).toBeVisible();
  // Closed is not a step from Arrived: the server refuses and the card stays.
  await page.locator('app-board section[aria-label="Arrived"] article').filter({ hasText: `TGHU-${tag}` }).getByLabel('Move to').selectOption({ label: 'Closed' });
  await expect(page.getByText('That move is not allowed from here')).toBeVisible();
  await expect(page.locator('app-board section[aria-label="Arrived"] article').filter({ hasText: `TGHU-${tag}` })).toBeVisible();

  await page.locator('app-board article').filter({ hasText: `TGHU-${tag}` }).getByRole('button', { name: `TGHU-${tag}` }).click();
  await expect(page).toHaveURL(new RegExp(`/receive/records/containers/${container.id}$`));
  await expect(page.getByRole('heading', { name: `TGHU-${tag} · Atlantic Rags ${tag}` })).toBeVisible();
  await expect(page.locator('ws-status-pipeline [aria-current="step"]')).toHaveText('Arrived');
  await expect(page.getByRole('list', { name: 'From landed cost to profit' })).toContainText('960,000');
  await expect(page.getByRole('tab', { name: /Landed cost/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('ws-data-grid tbody tr')).toContainText('Clearing');
  await page.getByRole('tab', { name: /Lots and sorting/ }).click();
  await expect(page.getByText('Not sorted yet')).toBeVisible();

  await page.goto('/receive/records/suppliers');
  await page.getByPlaceholder('Search supplier, country or phone').fill(`Atlantic Rags ${tag}`);
  await page.locator('ws-data-grid tbody tr').filter({ hasText: `Atlantic Rags ${tag}` }).click();
  await expect(page.getByRole('heading', { name: `Atlantic Rags ${tag}` })).toBeVisible();
  await expect(page.locator('ws-smart-button').filter({ hasText: 'Containers' })).toContainText('1');
  await expect(page.locator('ws-data-grid tbody tr')).toContainText(`TGHU-${tag}`);
});

test('inventory: stock list, item record, a count approved, stock value page', async ({ page, request }) => {
  const api = await apiAs(request);
  const tag = Date.now().toString().slice(-6);
  const item = await api.post('/stock/items', { name: `Ladies tops ${tag}`, unit: 'PIECE', quantity: 10, totalCost: 1000 });

  await signIn(page);
  await page.goto('/stock/items');
  await expect(page.getByRole('heading', { name: 'Stock', exact: true })).toBeVisible();
  await expect(page.locator('.chip').filter({ hasText: 'not Sold' })).toBeVisible();
  await page.getByPlaceholder('Search bale code, item, category, grade or supplier').fill(`Ladies tops ${tag}`);
  const row = page.locator('ws-data-grid tbody tr').filter({ hasText: `Ladies tops ${tag}` });
  await expect(row).toContainText('1,000');
  await row.click();
  await expect(page).toHaveURL(new RegExp(`/stock/items/${item.id}$`));
  await expect(page.getByRole('heading', { name: `Ladies tops ${tag}` })).toBeVisible();

  await page.getByRole('button', { name: 'Count stock' }).click();
  await page.getByLabel(/Counted/).fill('8');
  await page.getByLabel('Reason').fill('Two torn, thrown away');
  await page.getByRole('button', { name: 'Send for approval' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Count waiting for approval' })).toBeVisible();
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('Count approved — the books are updated')).toBeVisible();
  await expect(page.locator('ws-smart-button').filter({ hasText: '8 / 10' })).toBeVisible();
  await page.getByRole('tab', { name: /Counts/ }).click();
  await expect(page.locator('ws-data-grid tbody tr').first()).toContainText('Approved');

  await page.goto('/stock/value');
  await expect(page.getByRole('heading', { name: 'Stock value and ageing' })).toBeVisible();
  await expect(page.locator('ws-data-grid').first()).toContainText('0–30 days');
});

test('receivables: collections worklist, customer 360 with promise and payment, printable statement', async ({ page, request }) => {
  const { customer } = await makeSale(request);
  await signIn(page);
  await page.goto('/khata/records');
  await expect(page.getByRole('heading', { name: 'Collections', exact: true })).toBeVisible();
  await page.getByPlaceholder('Search customer, city or phone').fill(customer.name);
  const row = page.locator('ws-data-grid tbody tr').filter({ hasText: customer.name });
  await expect(row).toContainText('25,000');
  await row.click();

  await expect(page.getByRole('heading', { name: customer.name })).toBeVisible();
  await expect(page.locator('ws-smart-button').filter({ hasText: 'Balance' })).toContainText('25,000');

  await page.getByRole('button', { name: 'Promise to pay' }).click();
  await page.getByLabel('Amount').fill('10000');
  const tomorrow = new Date(Date.now() + 5 * 3_600_000 + 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel('Pay by').fill(tomorrow);
  await page.getByRole('button', { name: 'Save promise' }).click();
  await expect(page.getByText('Promise saved')).toBeVisible();
  await expect(page.locator('ws-data-grid tbody tr').first()).toContainText('Promised');

  await page.getByRole('button', { name: 'Receive payment' }).click();
  await page.getByLabel('Amount').fill('10000');
  await page.getByRole('button', { name: 'Save payment' }).click();
  await expect(page.getByText('Payment saved')).toBeVisible();
  await expect(page.locator('ws-smart-button').filter({ hasText: 'Balance' })).toContainText('15,000');
  await expect(page.locator('ws-data-grid tbody tr').first()).toContainText('Kept');

  await page.getByRole('link', { name: 'Statement' }).click();
  await expect(page.getByRole('heading', { name: 'Statement of account' }).or(page.getByText('Statement of account').first())).toBeVisible();
  await expect(page.locator('tfoot')).toContainText('15,000');
});

test('sorting: lots list and board, a lot record, yield analysis', async ({ page }) => {
  await signIn(page);
  await page.goto('/sort/records');
  await expect(page.getByRole('heading', { name: 'Lots and sorting', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Board' }).click();
  for (const column of ['Waiting', 'Sorting', 'Sorted']) await expect(page.locator(`app-board section[aria-label="${column}"]`)).toBeVisible();
  // The board only shows here: sorting moves a lot, so there is no "Move to" picker.
  await expect(page.locator('app-board').getByLabel('Move to')).toHaveCount(0);

  await page.getByRole('button', { name: 'Table' }).click();
  const first = page.locator('ws-data-grid tbody tr').first();
  if (await first.isVisible() && !(await first.textContent())?.includes('No lots match')) {
    await first.click();
    await expect(page).toHaveURL(/\/sort\/records\/[^/]+$/);
    await expect(page.locator('ws-status-pipeline')).toBeVisible();
  }

  await page.goto('/sort/yield');
  await expect(page.getByRole('heading', { name: 'Yield analysis' })).toBeVisible();
  await page.getByLabel('By').selectOption({ label: 'Month' });
  await expect(page.locator('ws-kpi-card').filter({ hasText: 'Lots sorted' })).toBeVisible();
});

test('finance: record an expense, close the day, cash book and profit and loss', async ({ page }) => {
  await signIn(page);
  await page.goto('/finance/expenses');
  await expect(page.getByRole('heading', { name: 'Expenses', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'New expense' }).click();
  await page.getByLabel('Category').selectOption({ label: 'Transport' });
  await page.getByLabel('Amount').fill('1500');
  await page.getByLabel('Paid to').fill('Loader rickshaw');
  await page.getByRole('button', { name: 'Save expense' }).click();
  await expect(page.getByText('Expense saved')).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Transport · / })).toContainText('1,500');
  await expect(page.locator('ws-record-activity')).toBeVisible();

  await page.goto('/finance/close');
  await expect(page.getByRole('heading', { name: 'Cash close' })).toBeVisible();
  const done = page.getByRole('status').filter({ hasText: 'Closed:' });
  if (!(await done.isVisible())) {
    await page.getByLabel('Counted').fill('0');
    await page.getByRole('button', { name: 'Close the day' }).click();
    await expect(page.getByText('Day closed')).toBeVisible();
  }
  await expect(page.getByRole('status').filter({ hasText: 'Closed:' })).toBeVisible();

  await page.goto('/finance/book');
  await expect(page.getByRole('heading', { name: 'Cash and bank book' })).toBeVisible();
  await expect(page.locator('ws-data-grid tbody')).toContainText('Transport · Loader rickshaw');

  await page.goto('/finance/pnl');
  await expect(page.getByRole('heading', { name: 'Profit and loss' })).toBeVisible();
  await expect(page.locator('ws-data-grid tbody tr').filter({ hasText: 'Net profit' })).toBeVisible();
});

import { APIRequestContext, Page, expect, test } from '@playwright/test';
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


/** Layout, grouping, columns and saved views sit behind the list's "View" button (v2 review). */
async function viewMenu(page: Page): Promise<void> {
  const panel = page.locator('.menu.panel');
  // A click elsewhere closes the panel a moment later: retry until it is open and stays open.
  await expect(async () => {
    if (!(await panel.isVisible())) await page.getByRole('button', { name: 'View', exact: true }).click();
    await page.waitForTimeout(150);
    await expect(panel).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 8000 });
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

  await viewMenu(page);
  await page.getByLabel('Group by').selectOption({ label: 'Status' });
  const group = page.locator('ws-data-grid tbody tr').filter({ hasText: 'Part paid' });
  await expect(group).toBeVisible();
  await group.click();
  await viewMenu(page);
  await expect(page.getByLabel('Group by')).toHaveValue('');

  const viewName = `Part paid ${Date.now()}`;
  await page.getByPlaceholder('Name this view').fill(viewName);
  await page.getByRole('button', { name: 'Save view' }).click();
  await page.reload();
  await viewMenu(page);
  await expect(page.getByRole('menuitemradio', { name: viewName })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.menu.panel')).toBeHidden();

  // The list closes open menus whenever its state changes (e.g. the saved view applied after the reload), so wait for
  // the page to settle and retry the whole export step if a late change closed the menu.
  await page.waitForLoadState('networkidle');
  let file = '';
  await expect(async () => {
    const download = page.waitForEvent('download', { timeout: 8000 });
    if (!(await page.getByRole('menuitem', { name: 'Excel' }).isVisible())) await page.getByRole('button', { name: 'Export' }).click();
    await page.getByRole('menuitem', { name: 'Excel' }).click({ timeout: 2000 });
    file = (await download).suggestedFilename();
  }).toPass({ timeout: 40000 });
  expect(file).toMatch(/^thriftos-sales-\d{4}-\d{2}-\d{2}\.xlsx$/);
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
  await expect(page.locator('ws-activity-panel').getByRole('option').first()).toBeVisible();
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
  await viewMenu(page);
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
  await expect(page.getByRole('tab', { name: /Total cost/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('ws-data-grid tbody tr')).toContainText('Clearing');

  // Fix a charge typed wrong in its panel: the total follows.
  await page.locator('ws-data-grid tbody tr').filter({ hasText: 'Clearing' }).click();
  const sheet = page.getByRole('dialog', { name: 'Change charge' });
  await sheet.getByLabel('Amount').fill('70000');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('list', { name: 'From landed cost to profit' })).toContainText('970,000');

  // Add a lot in its panel: it offers the kg not in a lot yet (all 12,000 kg here) and opens from the Lots tab.
  await page.getByRole('button', { name: 'Add lot' }).click();
  const lotSheet = page.getByRole('dialog', { name: 'Add lot' });
  await expect(lotSheet.getByLabel(/Lot weight/)).toHaveValue('12000');
  await lotSheet.getByRole('button', { name: 'Save lot' }).click();
  await page.getByRole('tab', { name: /Lots and sorting/ }).click();
  await expect(page.getByText('Not sorted yet')).toBeVisible();
  await expect(page.locator('ws-data-grid').filter({ hasText: 'Raw type' }).locator('tbody tr')).toHaveCount(1);

  // Close it from the status bar: Arrived → Cleared → Closed, each confirmed; then nothing can be added.
  await page.locator('ws-status-pipeline').getByRole('button', { name: /Cleared/ }).click();
  await page.getByRole('dialog', { name: 'Move to Cleared' }).getByRole('button', { name: 'Move to Cleared' }).click();
  await expect(page.locator('ws-status-pipeline [aria-current="step"]')).toHaveText('Cleared');
  await page.locator('ws-status-pipeline').getByRole('button', { name: /Closed/ }).click();
  await expect(page.getByRole('dialog', { name: 'Move to Closed' })).toContainText('no more charges');
  await page.getByRole('dialog', { name: 'Move to Closed' }).getByRole('button', { name: 'Move to Closed' }).click();
  await expect(page.locator('ws-status-pipeline [aria-current="step"]')).toHaveText('Closed');
  await expect(page.getByRole('button', { name: 'Add charge' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add lot' })).toHaveCount(0);

  await page.goto('/receive/records/suppliers');
  await page.getByPlaceholder('Search supplier, country or phone').fill(`Atlantic Rags ${tag}`);
  await page.locator('ws-data-grid tbody tr').filter({ hasText: `Atlantic Rags ${tag}` }).click();
  await expect(page.getByRole('heading', { name: `Atlantic Rags ${tag}` })).toBeVisible();
  await expect(page.getByRole('list', { name: 'From buying to profit' })).toContainText('Containers 1');
  await expect(page.getByRole('tab', { name: /Containers/ })).toContainText('1');
  await expect(page.locator('ws-data-grid tbody tr')).toContainText(`TGHU-${tag}`);
});

test('inventory: stock list, item record, a count approved, stock value page', async ({ page, request }) => {
  const api = await apiAs(request);
  const tag = Date.now().toString().slice(-6);
  const item = await api.post('/stock/items', { name: `Ladies tops ${tag}`, unit: 'PIECE', quantity: 10, totalCost: 1000 });

  await signIn(page);
  await page.goto('/stock/items');
  await expect(page.getByRole('heading', { name: 'Inventory', exact: true })).toBeVisible();
  // In stock is a switch, not a filter chip the owner did not set.
  await expect(page.getByRole('radio', { name: 'In stock' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.chip').filter({ hasText: 'not Sold' })).toHaveCount(0);
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
  await expect(page.getByRole('heading', { name: 'Receivables', exact: true })).toBeVisible();
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

  await page.getByRole('button', { name: 'Statement' }).click();
  await expect(page).toHaveURL(/\/khata\/records\/[^/]+\/statement$/);
  await expect(page.getByRole('heading', { name: 'Statement of account' }).or(page.getByText('Statement of account').first())).toBeVisible();
  await expect(page.locator('tfoot')).toContainText('15,000');
});

test('sorting: lots list and board, a lot record, yield analysis', async ({ page }) => {
  await signIn(page);
  await page.goto('/sort/records');
  await expect(page.getByRole('heading', { name: 'Sorting', exact: true })).toBeVisible();
  await viewMenu(page);
  await page.getByRole('button', { name: 'Board' }).click();
  for (const column of ['Waiting', 'Sorting', 'Sorted']) await expect(page.locator(`app-board section[aria-label="${column}"]`)).toBeVisible();
  // The board only shows here: sorting moves a lot, so there is no "Move to" picker.
  await expect(page.locator('app-board').getByLabel('Move to')).toHaveCount(0);

  await viewMenu(page);
  await page.getByRole('button', { name: 'Table' }).click();
  await page.keyboard.press('Escape');
  const first = page.locator('ws-data-grid tbody tr').first();
  if (await first.isVisible() && !(await first.textContent())?.includes('No lots match')) {
    await first.click();
    await expect(page).toHaveURL(/\/sort\/records\/[^/]+$/);
    await expect(page.locator('ws-status-pipeline')).toBeVisible();
  }

  await page.goto('/sort/yield');
  await expect(page.getByRole('heading', { name: 'Yield analysis' })).toBeVisible();
  await page.locator('ws-command-bar select').first().selectOption({ label: 'Month' });
  await expect(page.locator('ws-kpi-card').filter({ hasText: 'Lots sorted' })).toBeVisible();
});

test('finance: record an expense, close the day, cash book and profit and loss', async ({ page }) => {
  await signIn(page);
  await page.goto('/finance/expenses');
  await expect(page.getByRole('heading', { name: 'Expenses', exact: true })).toBeVisible();
  await expect(page.locator('.headline')).toContainText('Spent this month');
  await page.getByRole('link', { name: 'New expense' }).click();
  // Amount first and focused; nothing saves until a category is tapped.
  await expect(page.getByLabel('Amount')).toBeFocused();
  await page.getByLabel('Amount').fill('1500');
  await expect(page.getByText('Enter the amount and choose a category.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await page.locator('label.chip', { hasText: /^Transport$/ }).click();
  await page.getByLabel('Paid to').fill('Loader rickshaw');
  // Paid by bank: a cash expense on a day whose cash is already closed is refused (re-runs on the same database).
  await page.locator('label.chip', { hasText: /^Bank$/ }).click();
  await page.locator('label.chip', { hasText: /^Yesterday$/ }).click();
  await page.locator('label.chip', { hasText: /^Today$/ }).click();
  // Save and add another: the form empties for the next one.
  await page.getByRole('button', { name: 'Save and add another' }).click();
  await expect(page.getByText('Expense saved')).toBeVisible();
  await expect(page.getByLabel('Amount')).toHaveValue('');
  await page.getByLabel('Amount').fill('300');
  await page.locator('label.chip', { hasText: /^Tea and food$/ }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: /^Tea and food · / })).toContainText('300');
  await expect(page.locator('ws-record-activity')).toBeVisible();
  // Fix a mistake, then cancel with a reason.
  await page.getByRole('button', { name: 'Change' }).click();
  await page.getByLabel('Amount').fill('350');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Expense changed')).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Tea and food · / })).toContainText('350');
  await page.getByRole('button', { name: 'Cancel expense' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('button', { name: 'Cancel expense' })).toBeDisabled();
  await sheet.getByLabel('Why?').fill('Typed twice');
  await sheet.getByRole('button', { name: 'Cancel expense' }).click();
  await expect(page.getByText('Reason: Typed twice')).toBeVisible();
  // The list: cancelled ones behind the switch, no filter chip.
  await page.goto('/finance/expenses');
  await expect(page.getByText('Cancelled on:')).toHaveCount(0);
  await page.getByRole('radio', { name: 'Cancelled' }).click();
  await expect(page.locator('ws-data-grid tbody')).toContainText('Tea and food');
  await page.getByRole('radio', { name: 'Recorded' }).click();
  await expect(page.locator('ws-data-grid tbody')).toContainText('Loader rickshaw');
  // On a phone the rows are cards.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.locator('ul.cards li').first()).toBeVisible();
  await expect(page.locator('ws-data-grid')).toHaveCount(0);
  await page.setViewportSize({ width: 1280, height: 860 });

  // Cash close (v2 review): cash put in by the owner, count by notes, a reason when short or over, reopen.
  await page.goto('/finance/close');
  await expect(page.getByRole('heading', { name: 'Cash close' })).toBeVisible();
  const done = page.getByRole('status').filter({ hasText: 'Closed:' });
  if (await done.isVisible()) {
    await page.getByRole('button', { name: 'Reopen' }).click();
    await page.getByRole('dialog').getByLabel('Why?').fill('Recount');
    await page.getByRole('dialog').getByRole('button', { name: 'Reopen' }).click();
    await expect(page.getByText('Day reopened')).toBeVisible();
  }
  await page.getByRole('button', { name: 'Cash out / in' }).click();
  const moveSheet = page.getByRole('dialog');
  await moveSheet.locator('label.chip', { hasText: 'Put in' }).click();
  await moveSheet.locator('label.chip', { hasText: 'Brought by the owner' }).click();
  await moveSheet.getByLabel('Amount').fill('5000');
  await moveSheet.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.moves')).toContainText('Brought by the owner');
  await expect(page.locator('.sum')).toContainText('Put in');

  await page.getByRole('button', { name: 'Count notes' }).click();
  await page.getByRole('group', { name: 'Count notes' }).getByRole('spinbutton').first().fill('1');
  await expect(page.getByLabel('Counted')).toHaveValue('5000');
  await page.getByLabel('Counted').fill('1');
  await expect(page.getByRole('button', { name: 'Close the day' })).toBeDisabled();
  await page.getByLabel('Why short / over?').fill('Test count');
  await page.getByRole('button', { name: 'Close the day' }).click();
  await expect(page.getByText('Day closed')).toBeVisible();
  await expect(done).toContainText('Test count');
  // Undo a wrong count, then the day can be counted again.
  await page.getByRole('button', { name: 'Reopen' }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Reopen' })).toBeDisabled();
  await page.getByRole('dialog').getByLabel('Why?').fill('Typed the count wrong');
  await page.getByRole('dialog').getByRole('button', { name: 'Reopen' }).click();
  await expect(page.getByLabel('Counted')).toHaveValue('');
  await page.getByLabel('Counted').fill('2');
  await page.getByLabel('Why short / over?').fill('Test count again');
  await page.getByRole('button', { name: 'Close the day' }).click();
  await expect(done).toContainText('Test count again');
  await expect(page.locator('ws-data-grid').nth(1).locator('tbody')).toContainText('Closed');

  await page.goto('/finance/book');
  await expect(page.getByRole('heading', { name: 'Cash and bank book' })).toBeVisible();
  await page.getByRole('button', { name: 'Bank', exact: true }).click();
  await expect(page.locator('ws-data-grid tbody')).toContainText('Transport · Loader rickshaw');

  await page.goto('/finance/pnl');
  await expect(page.getByRole('heading', { name: 'Profit and loss' })).toBeVisible();
  await expect(page.locator('ws-data-grid tbody tr').filter({ hasText: 'Net profit' })).toBeVisible();
  // P&L review: the expenses total line, and an amount opens what is behind it.
  await expect(page.locator('ws-data-grid tbody tr.strong').filter({ hasText: 'Expenses' })).toBeVisible();
  await page.locator('ws-data-grid tbody tr').filter({ hasText: 'Transport' }).locator('td').last().click();
  await expect(page).toHaveURL(/\/finance\/expenses\?v=.*TRANSPORT/);
});

test('sales extras: price list for a group, keyboard sale entry suggests the list price, sales by month', async ({ page, request }) => {
  const api = await apiAs(request);
  const tag = Date.now().toString().slice(-6);
  const customer = await api.post('/customers', { name: `Wholesale Buyer ${tag}`, phone: `0302${tag}1`, city: 'Lahore' });
  const item = await api.post('/stock/items', { name: `Mixed jeans ${tag}`, unit: 'KG', quantity: 500, totalCost: 50000 });

  await signIn(page);
  await page.goto('/sell/records/new');
  await expect(page.getByRole('heading', { name: 'New sale' })).toBeVisible();
  await page.getByLabel('Customer').fill(customer.name);
  await expect(page.getByText('No price list')).toBeVisible();
  const itemInput = page.getByLabel('Add item');
  await itemInput.fill(`Mixed jeans ${tag}`);
  await expect(page.locator(`#ws-stock option[value="Mixed jeans ${tag}"]`)).toHaveCount(1);
  await itemInput.press('Enter');
  const qty = page.getByLabel('Quantity');
  await expect(qty).toBeFocused();
  await qty.fill('100');
  await page.getByLabel('Price', { exact: true }).fill('150');
  await expect(page.locator('tfoot')).toContainText('15,000');
  await page.getByRole('button', { name: 'Credit' }).click();
  await qty.press('Control+Enter');
  await expect(page).toHaveURL(/\/sell\/records\/(?!new)[^/]+$/);
  await expect(page.locator('ws-smart-button').filter({ hasText: 'Due' })).toContainText('15,000');

  await page.goto('/sell/records');
  await viewMenu(page);
  await page.getByLabel('Group by').selectOption({ label: 'Month' });
  const month = page.locator('ws-data-grid tbody tr').first();
  await expect(month).toContainText(new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }));
  await month.click();
  await viewMenu(page);
  await expect(page.getByLabel('Group by')).toHaveValue('');
  await page.keyboard.press('Escape');
  await expect(page.locator('ws-data-grid tbody tr').filter({ hasText: customer.name })).toBeVisible();

  await page.goto('/sell/prices');
  await expect(page.getByRole('heading', { name: 'Price lists', exact: true })).toBeVisible();
  await page.getByLabel('New group').fill(`Wholesale ${tag}`);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('heading', { name: `Wholesale ${tag}`, level: 2 })).toBeVisible();
});

test('dashboards: owner dashboard on Home, scorecard, sales analytics with CSV, report centre', async ({ page, request }) => {
  await makeSale(request);
  await signIn(page);
  await page.goto('/home');
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  const sales = page.locator('ws-kpi-card').filter({ hasText: 'Sales' }).first();
  await expect(sales).toContainText('Rs');
  // Every card says what it shows; the "i" never opens the card's list.
  await page.getByRole('button', { name: 'About Sales' }).first().click();
  await expect(page.getByRole('tooltip')).toContainText('total of all sale bills');
  await expect(page).toHaveURL(/\/home$/);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Latest activity' })).toHaveCount(0);
  await sales.click();
  await expect(page).toHaveURL(/\/sell\/records$/);

  await page.goto('/receive/scorecard');
  await expect(page.getByRole('heading', { name: 'Supplier and origin scorecard' })).toBeVisible();
  await page.getByRole('button', { name: 'Origin' }).click();
  await expect(page.locator('ws-data-grid')).toBeVisible();

  await page.goto('/sell/analytics');
  await expect(page.getByRole('heading', { name: 'Sales analytics' })).toBeVisible();
  await page.locator('ws-command-bar select').first().selectOption({ label: 'City' });
  await expect(page.locator('ws-data-grid').first().locator('tbody tr').filter({ hasText: 'Karachi' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  expect((await download).suggestedFilename()).toMatch(/^thriftos-sales-by-city-\d{4}-\d{2}-\d{2}\.csv$/);

  await page.goto('/insights');
  await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible();
  await page.getByRole('link', { name: /Supplier scorecard/ }).first().click();
  await expect(page).toHaveURL(/\/receive\/scorecard$/);
});

test('purchasing: containers and loose lots as two tabs, each with its own button, notes on the columns', async ({ page }) => {
  await signIn(page);
  await page.goto('/receive/records/containers');
  await expect(page.getByRole('link', { name: 'Receive a container' })).toBeVisible();
  await page.getByRole('button', { name: 'About Total cost' }).click();
  await expect(page.getByRole('tooltip')).toContainText('every charge added');
  await page.keyboard.press('Escape');

  await page.locator('nav.tabs').getByRole('link', { name: 'Loose lots' }).click();
  await expect(page).toHaveURL(/\/receive\/records\/lots$/);
  await expect(page.getByRole('heading', { name: 'Loose lots', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Buy a loose lot' })).toHaveAttribute('href', '/receive/records/lots/new');
  await expect(page.locator('.nav-item.also')).toContainText('Purchasing');

  // Purchasing opens on the tab used last; the old lots address opens this tab instead of a blank page.
  await page.goto('/receive/records');
  await expect(page).toHaveURL(/\/receive\/records\/lots$/);
  await page.goto('/receive/records/rags');
  await expect(page).toHaveURL(/\/receive\/records\/lots$/);
});

test('container form: receive on a laptop with date, status and charges, then edit the kg', async ({ page }) => {
  await signIn(page);
  await page.goto('/receive/records/containers');
  await page.getByRole('link', { name: 'Receive a container' }).click();
  await expect(page).toHaveURL(/\/receive\/records\/containers\/new$/);
  // Save says what is missing until the form is complete.
  await expect(page.getByRole('status').filter({ hasText: 'Still needed' })).toContainText('the supplier');
  await expect(page.getByRole('button', { name: 'Save container' })).toBeDisabled();

  await page.getByLabel('Supplier').selectOption({ index: 1 });
  await page.locator('input[name=date]').fill('2026-11-02');
  await page.getByLabel('Invoice weight (kg)').fill('20000');
  await page.getByLabel('Currency').selectOption('USD');
  await page.getByLabel('Purchase cost (USD)').fill('10000');
  await page.getByLabel('Rate (Rs per 1 USD)').fill('280');
  await page.getByRole('button', { name: '+ Add charge' }).click();
  await page.getByLabel('Charge type').selectOption('PORT_HANDLING');
  await page.getByLabel('Amount').fill('200000');
  const side = page.locator('aside.side');
  await expect(side).toContainText('Rs 3,000,000');
  await expect(side).toContainText('Rs 150');

  await page.getByRole('button', { name: 'Save container' }).click();
  await expect(page).toHaveURL(/\/receive\/records\/containers\/(?!new)[^/]+$/);
  await expect(page.locator('ws-page-header p').first()).toContainText('2 November 2026');
  await expect(page.locator('.pipeline, ws-status-pipeline').first()).toBeVisible();

  await page.getByRole('link', { name: 'Edit' }).click();
  await expect(page.getByLabel('Invoice weight (kg)')).toHaveValue('20000');
  await page.getByLabel('Invoice weight (kg)').fill('25000');
  await expect(page.locator('aside.side')).toContainText('Rs 120');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/receive\/records\/containers\/(?!new)[^/]+$/);
  await expect(page.locator('main')).toContainText(/Rs 120\W*per kg/);
});

test('loose lot form: buy one on a laptop with supplier and day, open it, then fix its price', async ({ page }) => {
  await signIn(page);
  await page.goto('/receive/records/lots');
  await page.getByRole('link', { name: 'Buy a loose lot' }).click();
  await expect(page).toHaveURL(/\/receive\/records\/lots\/new$/);
  await expect(page.getByRole('heading', { name: 'Buy a loose lot' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Still needed' })).toContainText('the price paid');

  await page.getByLabel(/^Supplier/).selectOption({ index: 1 });
  await page.locator('input[name=date]').fill('2026-11-01');
  await page.getByLabel(/^Lot weight/).fill('800');
  await page.getByLabel(/^Price paid/).fill('160000');
  await expect(page.locator('aside.side')).toContainText('Rs 200');
  await page.getByRole('button', { name: 'Save lot' }).click();
  await expect(page).toHaveURL(/\/sort\/records\/(?!new)[^/]+$/);

  await page.getByRole('link', { name: 'Edit' }).click();
  await expect(page).toHaveURL(/\/receive\/records\/lots\/[^/]+\/edit$/);
  await expect(page.getByLabel(/^Lot weight/)).toHaveValue('800');
  await page.getByLabel(/^Price paid/).fill('120000');
  await expect(page.locator('aside.side')).toContainText('Rs 150');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/sort\/records\/[^/]+$/);

  await page.goto('/receive/records/lots');
  const row = page.locator('ws-data-grid tbody tr').filter({ hasText: '1 Nov 2026' });
  await expect(row.first()).toContainText('120,000');
});

test('navigation: a list keeps its search through Back, records are named in the breadcrumb and tab, forms ask before losing changes', async ({ page, request }) => {
  const api = await apiAs(request);
  const tag = Date.now().toString().slice(-6);
  const supplier = await api.post('/procurement/vendors', { name: `Nav Rags ${tag}` });
  const container = await api.post('/procurement/containers', { vendorId: supplier.id, containerNumber: `NAV-${tag}`, netWeightKg: 1000, purchaseCost: 100000 });

  await signIn(page);
  await page.goto('/receive/records/containers');
  await page.getByPlaceholder('Search container number, supplier or country').fill(`NAV-${tag}`);
  await expect(page).toHaveURL(/[?&]v=/);
  await page.locator('ws-data-grid tbody tr').filter({ hasText: `NAV-${tag}` }).click();
  await expect(page).toHaveURL(new RegExp(`/receive/records/containers/${container.id}`));
  await expect(page.locator('nav.crumbs')).toContainText(`Purchasing›Containers›NAV-${tag}`.replace(/›/g, ''));
  await expect(page).toHaveTitle(`NAV-${tag} · Containers · ThriftOS`);

  // A tab is kept in the address too.
  await page.getByRole('tab', { name: /Sales/ }).click();
  await expect(page).toHaveURL(/tab=sales/);

  // Back: the list opens with the same search.
  await page.goBack();
  await expect(page).toHaveURL(/\/receive\/records\/containers\?/);
  await expect(page.getByPlaceholder('Search container number, supplier or country')).toHaveValue(`NAV-${tag}`);
  await expect(page.locator('ws-data-grid tbody tr')).toHaveCount(1);

  // A form with changes asks before leaving; Cancel goes back to where you came from.
  await page.getByRole('link', { name: 'Receive a container' }).click();
  await page.getByLabel('Invoice weight (kg)').fill('500');
  let asked = '';
  page.once('dialog', (d) => { asked = d.message(); void d.dismiss(); });
  await page.locator('nav a[href="/home"]').first().click();
  await expect(page).toHaveURL(/\/receive\/records\/containers\/new$/);
  expect(asked).toContain('not saved');
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(/\/receive\/records\/containers\?/);

  // An address that does not exist says so.
  await page.goto('/receive/records/no-such-page');
  await expect(page.getByText('This page does not exist')).toBeVisible();
});

test('suppliers: add one, change its phone, buy from it with the supplier already chosen', async ({ page }) => {
  const tag = Date.now().toString().slice(-6);
  await signIn(page);
  await page.goto('/receive/records/suppliers');
  await expect(page.locator('main ws-page-header').getByRole('link', { name: 'Supplier scorecard' })).toHaveAttribute('href', '/receive/scorecard');
  await page.getByRole('link', { name: 'New supplier' }).click();
  await expect(page).toHaveURL(/\/receive\/records\/suppliers\/new$/);
  await page.getByLabel('Supplier name').fill(`Italia Stock ${tag}`);
  await page.getByLabel('From country').fill('Italy');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: `Italia Stock ${tag}` })).toBeVisible();
  await expect(page.locator('nav.crumbs')).toContainText('Suppliers');
  await expect(page.locator('ws-page-header p').first()).toContainText('Italy');

  await page.getByRole('link', { name: 'Edit' }).click();
  await page.getByLabel(/^WhatsApp number/).fill('0300 1234567');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('ws-page-header p').first()).toContainText('0300 1234567');

  await page.getByRole('link', { name: 'Receive a container' }).click();
  await expect(page).toHaveURL(/\/receive\/records\/containers\/new\?supplier=/);
  await expect(page.locator('select[name=vendor]')).not.toHaveValue('');
  await expect(page.getByLabel('From country')).toHaveValue('Italy');
});

test('breadcrumbs: none on menu pages; a record opened from another keeps the way back', async ({ page, request }) => {
  const api = await apiAs(request);
  const tag = Date.now().toString().slice(-6);
  const supplier = await api.post('/procurement/vendors', { name: `Trail Rags ${tag}` });
  const lot = await api.post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 300, purchaseCost: 30000, vendorId: supplier.id });

  await signIn(page);
  for (const url of ['/home', '/receive/records/containers', '/receive/records/lots', '/receive/records/suppliers', '/sell/records', '/finance/expenses']) {
    await page.goto(url);
    await expect(page.locator('ws-page-header').first()).toBeVisible();
    await expect(page.locator('nav.crumbs')).toHaveCount(0);
  }

  // Suppliers → the supplier → its loose lot: the lot's breadcrumb leads back to the supplier.
  await page.goto('/receive/records/suppliers');
  await page.getByPlaceholder('Search supplier, country or phone').fill(`Trail Rags ${tag}`);
  await page.locator('ws-data-grid tbody tr').filter({ hasText: `Trail Rags ${tag}` }).click();
  await expect(page.locator('nav.crumbs')).toContainText(`Trail Rags ${tag}`);
  await page.locator('ws-data-grid tbody tr').filter({ hasText: lot.ragCode }).click();
  await expect(page).toHaveURL(new RegExp(`/sort/records/${lot.id}`));
  const crumbs = page.locator('nav.crumbs');
  await expect(crumbs).toContainText('Suppliers');
  await expect(crumbs).toContainText(`Trail Rags ${tag}`);
  await expect(crumbs).toContainText(lot.ragCode);
  await crumbs.getByRole('link', { name: `Trail Rags ${tag}` }).click();
  await expect(page).toHaveURL(new RegExp(`/receive/records/suppliers/${supplier.id}`));
  await expect(page.getByRole('heading', { name: `Trail Rags ${tag}` })).toBeVisible();
});

test('sorting: a half-sorted lot shows what is left, one row per category, and the sorting screen leads back to it', async ({ page, request }) => {
  const api = await apiAs(request);
  const lot = await api.post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 100, purchaseCost: 10000 });
  expect(lot.ragCode).toMatch(/^LOT-/);
  const cats = (await api.get('/tenant/categories')) as Array<{ id: string; name: string }>;
  const s = (await api.post('/sorting/stage-1/start', { ragId: lot.id })).session.id;
  await api.post('/sorting/stage-1/allocate', { sessionId: s, categoryId: cats[0].id, amountKg: 30 });
  await api.post('/sorting/stage-1/allocate', { sessionId: s, categoryId: cats[0].id, amountKg: 10 });

  await signIn(page);
  await page.goto('/sort/records');
  await expect(page.getByRole('heading', { name: 'Sorting', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sort next lot' })).toHaveAttribute('href', '/sort/next');
  await page.getByPlaceholder('Search lot, container, origin or raw type').fill(lot.ragCode);
  const row = page.locator('ws-data-grid tbody tr').filter({ hasText: lot.ragCode });
  await expect(row).toContainText('60.0 kg'); // left to sort, not "waste"
  await row.click();

  await expect(page.getByRole('progressbar')).toContainText('40% sorted');
  await expect(page.locator('ws-data-grid').filter({ hasText: 'Category' }).locator('tbody tr')).toHaveCount(1);
  await page.getByRole('link', { name: 'Continue sorting' }).click();
  await expect(page).toHaveURL(new RegExp(`/sort/${lot.id}$`));
  await expect(page.locator('nav.crumbs')).toContainText(lot.ragCode);
  await expect(page.locator('nav.crumbs')).toContainText('Sorting now');
  await page.getByRole('link', { name: 'Open lot page' }).click();
  await expect(page).toHaveURL(new RegExp(`/sort/records/${lot.id}$`));

  // "Sort next lot" opens a lot's sorting screen.
  await page.goto('/sort/next');
  await expect(page).toHaveURL(/\/sort\/(?!records|next)[^/?]+$/);
});

test('inventory by item: bales and sorted kg per item, open its bales, price every bale of a kind', async ({ page, request }) => {
  const api = await apiAs(request);
  const tag = Date.now().toString().slice(-6);
  const cats = (await api.get('/tenant/categories')) as Array<{ id: string; name: string }>;
  const lot = await api.post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 100, purchaseCost: 20000 });
  const s = (await api.post('/sorting/stage-1/start', { ragId: lot.id })).session.id;
  await api.post('/sorting/stage-1/allocate', { sessionId: s, categoryId: cats[0].id, amountKg: 90 });
  await api.post('/stock/bales', { categoryId: cats[0].id, weightKg: 45 });

  await signIn(page);
  await page.goto('/stock');
  await expect(page).toHaveURL(/\/stock\/by-item$/);
  await expect(page.getByRole('heading', { name: 'Inventory', exact: true })).toBeVisible();
  // Sorted kg not baled is stock too.
  await expect(page.locator('ws-data-grid thead')).toContainText('Sorted, not baled');
  const row = page.locator('ws-data-grid tbody tr').filter({ hasText: new RegExp(`^${cats[0].name}`) }).first();
  await expect(row).toBeVisible();

  const name = (await row.locator('td').first().innerText()).trim();
  const price = 20000 + Number(tag.slice(-3));
  await page.getByRole('button', { name: 'Set price' }).click();
  const sheet = page.getByRole('dialog', { name: 'Set price' });
  await sheet.getByLabel('Category').selectOption({ label: name });
  await sheet.getByLabel('Price per bale (Rs)').fill(String(price));
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(/Price set on \d+ bales/)).toBeVisible();

  await row.click();
  await expect(page).toHaveURL(/\/stock\/items\?/);
  await expect(page.locator('.chip').filter({ hasText: cats[0].name })).toBeVisible();
  await expect(page.locator('ws-data-grid tbody tr').first()).toContainText(price.toLocaleString('en-US'));
});

test('sales review: Enter picks the customer, new customer, below cost, receive payment on the bill, paid and due', async ({ page, request }) => {
  const api = await apiAs(request);
  const tag = Date.now().toString().slice(-6);
  await api.post('/customers', { name: `Review Buyer ${tag}`, phone: `0304${tag}1`, city: 'Multan' });
  await api.post('/stock/items', { name: `Review jeans ${tag}`, unit: 'KG', quantity: 300, totalCost: 30000 });

  await signIn(page);
  await page.goto('/sell/records/new');
  const customerBox = page.getByLabel('Customer');
  // A name nobody has: say so, and New customer adds them with what was typed.
  await customerBox.fill(`Walk-in ${tag}`);
  await customerBox.press('Enter');
  await expect(page.getByText(`No customer called “Walk-in ${tag}”`)).toBeVisible();
  await page.getByRole('button', { name: '+ New customer' }).click();
  const sheet = page.getByRole('dialog', { name: 'New customer' });
  await expect(sheet.getByLabel('Name')).toHaveValue(`Walk-in ${tag}`);
  await sheet.getByLabel('WhatsApp number').fill(`0305${tag}1`);
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toBeHidden();
  await expect(customerBox).toHaveValue(`Walk-in ${tag}`);

  // Part of a name and Enter picks the match, shows what they owe and moves on to the items.
  await customerBox.fill(`review buyer ${tag}`);
  await customerBox.press('Enter');
  await expect(customerBox).toHaveValue(`Review Buyer ${tag}`);
  await expect(page.getByText(/^Owes .*Rs 0/)).toBeVisible();
  const itemInput = page.getByLabel('Add item');
  await expect(itemInput).toBeFocused();
  await itemInput.fill(`Review jeans ${tag}`);
  await expect(page.locator(`#ws-stock option[value="Review jeans ${tag}"]`)).toHaveCount(1);
  await itemInput.press('Enter');
  const qty = page.getByLabel('Quantity');
  await qty.fill('100');
  const price = page.getByLabel('Price', { exact: true });
  await price.fill('60');
  await expect(page.getByText(/Below cost \(.*Rs 100.*\)/)).toBeVisible();
  await price.fill('150');
  await expect(page.getByText(/Below cost/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Credit' }).click();
  await qty.press('Control+Enter');
  await expect(page).toHaveURL(/\/sell\/records\/(?!new)[^/]+$/);

  // Take payment from the bill: it shows under Payments as paid with the sale, and the due goes down.
  await page.getByRole('button', { name: 'Receive payment' }).click();
  const pay = page.getByRole('dialog', { name: 'Receive payment' });
  await pay.getByLabel('Amount').fill('5000');
  await pay.getByRole('button', { name: 'Save payment' }).click();
  await expect(pay).toBeHidden();
  await expect(page.locator('ws-smart-button').filter({ hasText: 'Due' })).toContainText('10,000');
  await page.getByRole('tab', { name: /Payments/ }).click();
  await expect(page.locator('ws-data-grid tbody')).toContainText('With the sale');
  await expect(page.getByRole('button', { name: 'Print', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Bill page' })).toBeVisible();

  await page.goto('/sell/records');
  const row = page.locator('ws-data-grid tbody tr').filter({ hasText: `Review Buyer ${tag}` });
  await expect(row).toContainText('5,000');
  await expect(row).toContainText('10,000');
});

test('receivables review: new customer with an opening balance, edit, bills add up, view kept on Back, receive from the row, statement', async ({ page }) => {
  const tag = Date.now().toString().slice(-6);
  const name = `Opening Buyer ${tag}`;
  await signIn(page);
  await page.goto('/khata/records');
  await page.getByRole('button', { name: 'New customer' }).click();
  await expect(page).toHaveURL(/\/khata\/records\/new$/);
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('WhatsApp number').fill(`0306${tag}1`);
  await page.getByLabel('City · optional').fill('Quetta');
  await page.getByLabel(/Already owed before ThriftOS/).fill('40000');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
  await expect(page.getByText(`0306 ${tag}1`)).toBeVisible();
  // The opening balance is its own row, so the bills add up to the balance.
  await expect(page.locator('ws-data-grid tbody tr').filter({ hasText: 'Opening balance' })).toContainText('40,000');
  await expect(page.getByText(/= balance .*40,000/)).toBeVisible();

  // Edit: the city changes, Back lands on the customer.
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('City · optional').fill('Sukkur');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/khata\/records\/[^/]+$/);
  await expect(page.getByText(/Sukkur/).first()).toBeVisible();

  // The list keeps its view and search in the address: Back from the customer returns to them.
  await page.goto('/khata/records');
  await page.getByRole('button', { name: /^Over 90 days/ }).click();
  await page.getByRole('button', { name: /^Owe money/ }).click();
  await page.getByPlaceholder('Search customer, city or phone').fill(name);
  await expect(page).toHaveURL(/q=Opening/);
  const row = page.locator('ws-data-grid tbody tr').filter({ hasText: name });
  await row.locator('td').nth(1).click();
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
  await page.goBack();
  await expect(page.getByPlaceholder('Search customer, city or phone')).toHaveValue(name);

  // Take money from the row.
  await row.getByRole('button', { name: 'Receive' }).click();
  const sheet = page.getByRole('dialog', { name: 'Receive payment' });
  await expect(sheet.getByLabel('Amount')).toHaveValue('40000');
  await sheet.getByLabel('Amount').fill('15000');
  await sheet.getByRole('button', { name: 'Save payment' }).click();
  await expect(row).toContainText('25,000');

  // Paid up customers show under All customers.
  await page.getByRole('button', { name: /^All customers/ }).click();
  await expect(page).toHaveURL(/view=everyone/);

  // The statement sits under the customer, inside the app, and can go to WhatsApp.
  await row.locator('td').nth(1).click();
  await page.getByRole('button', { name: 'Statement' }).click();
  await expect(page.locator('nav.crumbs')).toContainText(name);
  await expect(page.getByRole('button', { name: 'Send on WhatsApp' })).toBeEnabled();
  await expect(page.locator('tfoot')).toContainText('25,000');
});

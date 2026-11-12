import { expect, test } from '@playwright/test';
import { loose } from './floor';
import { apiAs, setDemoModule, signIn } from './helpers';

// Phase 8: the owner adds a worker paid per kg; the sorting screen asks who sorted an entry; this week's pay sheet
// pays them kg × rate (a deduction off), marked paid in cash; the lot page shows the labour; productivity lists them.
test('sorter pay: add a worker, name them while sorting, pay sheet, paid, labour on the lot, productivity', async ({ page, request }) => {
  test.setTimeout(150_000);
  const undo = await setDemoModule(request, 'PAYROLL', true);
  try {
    const tag = Date.now().toString().slice(-6);
    const name = `Akram ${tag}`;
    await page.setViewportSize({ width: 1280, height: 860 });
    await signIn(page);
    await page.goto('/payroll');
    await expect(page.getByRole('heading', { name: 'Sorter pay' })).toBeVisible();
    await page.getByRole('button', { name: 'Add a worker' }).click();
    await page.getByLabel('Name').fill(name);
    await page.getByLabel(/^Phone/).fill('0300 1234567');
    await page.getByRole('button', { name: 'Per kg' }).click();
    await page.getByLabel(/^Rate per kg/).fill('10');
    await page.getByRole('button', { name: 'Save' }).click();
    const row = page.locator('.worker', { hasText: name });
    await expect(row).toContainText(loose('Rs 10 per kg'));

    // A lot sorted on the phone, naming the worker.
    const api = await apiAs(request);
    const cats = (await api.get('/tenant/categories')) as Array<{ id: string; name: string }>;
    const lot = await api.post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 300, purchaseCost: 30000 });
    await page.setViewportSize({ width: 390, height: 860 });
    await page.goto(`/sort/${lot.id}`);
    await page.locator('.tiles').getByRole('button').filter({ hasText: cats[0].name }).first().click();
    const entry = page.locator('.entry');
    await entry.getByRole('button', { name }).click();
    if (!(await entry.getByRole('button', { name: 'Loose kg', pressed: true }).count())) await entry.locator('.seg').getByRole('button', { name: 'Loose kg' }).click();
    await entry.getByLabel('Weight').fill('120');
    await entry.getByRole('button', { name: /^Save/ }).click();
    await expect(entry).toBeHidden();
    await expect(page.locator('.overview')).toContainText(loose('120.0 kg'));

    // This week's pay sheet: 120 kg × Rs 10 = Rs 1,200; Rs 200 off; paid in cash.
    await page.setViewportSize({ width: 1280, height: 860 });
    await page.goto('/payroll');
    await page.getByRole('tab', { name: 'Pay sheets' }).click();
    await page.getByRole('button', { name: 'This week' }).click();
    await page.getByRole('button', { name: 'Make pay sheet' }).click();
    const line = page.locator('.line', { hasText: name });
    await expect(line).toContainText(loose('120.0 kg × Rs 10 = Rs 1,200'));
    await line.getByLabel('Deduction').fill('200');
    await line.getByLabel('Deduction').press('Tab');
    await expect(line.locator('.amount')).toContainText(loose('Rs 1,000'));
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: /^Paid in cash/ }).click();
    await expect(page.getByText(/^Paid on /)).toBeVisible();
    await expect(line.getByRole('link', { name: 'Send payslip on WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\/923001234567\?text=/);

    // The lot page shows the labour; productivity lists the worker.
    await page.goto(`/sort/records/${lot.id}`);
    await expect(page.getByRole('region', { name: 'What was paid' })).toContainText(loose('Rs 1,000'));
    await page.goto('/payroll');
    await page.getByRole('tab', { name: 'Productivity' }).click();
    await expect(page.locator('tr', { hasText: name })).toContainText(loose('120.0 kg'));
  } finally {
    await undo();
  }
});

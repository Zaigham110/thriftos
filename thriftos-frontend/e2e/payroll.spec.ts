import { expect, test } from '@playwright/test';
import { loose } from './floor';
import { apiAs, setDemoModule, signIn } from './helpers';

// Employees (owner, 2026-11-17; it took the place of Sorter pay): the owner adds an employee with their record,
// paid per kg; with "count what each sorter sorts" on, the sorting screen asks who sorted an entry; this week's pay
// sheet pays them kg × rate (a deduction off), marked paid in cash; the lot page shows it; sorting work lists them.
test('employees: add one with their record, count their sorting, pay sheet, paid, shown on the lot, sorting work', async ({ page, request }) => {
  test.setTimeout(150_000);
  const undo = await setDemoModule(request, 'PAYROLL', true);
  try {
    const tag = Date.now().toString().slice(-6);
    const name = `Akram ${tag}`;
    await page.setViewportSize({ width: 1280, height: 860 });
    await signIn(page);
    // The old Sorter pay address opens Employees; the menu has People with Employees and Pay.
    await page.goto('/payroll');
    await expect(page).toHaveURL(/\/people$/);
    await expect(page.getByRole('heading', { name: 'Employees' })).toBeVisible();
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Pay', exact: true })).toHaveAttribute('href', '/people/pay');
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Sorter pay' })).toHaveCount(0);
    // Pay by kg needs sorting to say who sorted: a choice, off unless turned on.
    await page.getByLabel('Count what each sorter sorts').check();
    await page.getByRole('button', { name: 'Add an employee' }).click();
    await page.getByLabel('Name').fill(name);
    await page.getByLabel(/^Phone/).fill('0300 1234567');
    await page.getByRole('button', { name: 'Per kg' }).click();
    await page.getByLabel(/^Rate per kg/).fill('10');
    await page.getByLabel(/^Job/).fill('Sorter');
    await page.getByText('More about them').click();
    await page.getByLabel('CNIC').fill('42101-1234567-1');
    await page.getByLabel('Joined on').fill('2026-01-15');
    await page.getByRole('button', { name: 'Save' }).click();
    const row = page.locator('.worker', { hasText: name });
    await expect(row).toContainText(loose('Sorter · Rs 10 per kg'));
    await expect(row).toContainText('since 15 Jan 2026');

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
    await page.goto('/people/pay');
    await expect(page.getByRole('tab', { name: 'Pay', exact: true })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('button', { name: 'This week' }).click();
    await page.getByRole('button', { name: 'Make pay sheet' }).click();
    const line = page.locator('.line', { hasText: name });
    await expect(line).toContainText(loose('120.0 kg × Rs 10 = Rs 1,200'));
    await line.getByLabel('Deduction').fill('200');
    await line.getByLabel('Deduction').press('Tab');
    await expect(line.locator('.amount')).toContainText(loose('Rs 1,000'));
    // A bonus on top, with what it is for (owner, 2026-11-18).
    await line.getByLabel('Bonus or allowance').fill('300');
    await line.getByLabel('Bonus or allowance').press('Tab');
    await expect(line.locator('.amount')).toContainText(loose('Rs 1,300'));
    await line.getByLabel('For', { exact: true }).fill('Eid bonus');
    await line.getByLabel('For', { exact: true }).press('Tab');
    await expect(line).toContainText(loose('plus Eid bonus Rs 300'));
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: /^Paid in cash/ }).click();
    await expect(page.getByText(/^Paid on /)).toBeVisible();
    await expect(line.getByRole('link', { name: 'Send payslip on WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\/923001234567\?text=/);
    // Printed payslips: one per employee, with the bonus and a line to sign; the screen itself is not printed.
    await page.evaluate(() => { (window as unknown as { print: () => void }).print = () => undefined; });
    await page.getByRole('button', { name: 'Print payslips' }).click();
    await page.emulateMedia({ media: 'print' });
    const slip = page.locator('.slip', { hasText: name });
    await expect(slip).toBeVisible();
    await expect(slip).toContainText('Eid bonus');
    await expect(slip).toContainText(loose('Rs 1,300'));
    await expect(slip).toContainText('signature');
    await expect(page.locator('.floor.payroll')).toBeHidden();
    await page.emulateMedia({ media: 'screen' });

    // The lot page shows the labour; productivity lists the worker.
    await page.goto(`/sort/records/${lot.id}`);
    await expect(page.getByRole('region', { name: 'What was paid' })).toContainText(loose('Rs 1,000'));
    await page.goto('/people');
    await page.getByRole('tab', { name: 'Sorting work' }).click();
    await expect(page.locator('tr', { hasText: name })).toContainText(loose('120.0 kg'));
  } finally {
    await undo();
  }
});

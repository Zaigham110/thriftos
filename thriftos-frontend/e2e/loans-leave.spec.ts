import { expect, test } from '@playwright/test';
import { loose } from './floor';
import { apiAs, setDemoModule, signIn } from './helpers';

test('employees: give a loan, take cash back, and set paid leave days (owner, 2026-11-17)', async ({ page, request }) => {
  const undo = await setDemoModule(request, 'PAYROLL', true);
  try {
    const api = await apiAs(request);
    const tag = Date.now().toString().slice(-6);
    const name = `Loan Man ${tag}`;
    await api.post('/payroll/workers', { name, payType: 'MONTH', rate: 30000 });

    await page.setViewportSize({ width: 1280, height: 860 });
    await signIn(page);
    await page.goto('/people');
    const row = page.locator('.worker', { hasText: name });
    // A loan: how much, and how much comes off each pay.
    await row.getByRole('button', { name: 'Loan', exact: true }).click();
    await page.getByLabel(/^Loan to /).fill('5000');
    await page.getByLabel('Taken off each pay (Rs)').fill('1000');
    await page.getByRole('button', { name: 'Give the loan' }).click();
    await expect(row).toContainText(loose('owes Rs 5,000 on a loan'));
    // Cash handed back takes it down.
    await row.getByRole('button', { name: 'Loan paid back' }).click();
    await page.getByLabel(/^Cash .* is paying back/).fill('2000');
    await page.locator('form.form').getByRole('button', { name: 'Loan paid back' }).click();
    await expect(row).toContainText(loose('owes Rs 3,000 on a loan'));
    // Paid leave days a year show against what was taken.
    await row.getByRole('button', { name: 'Edit' }).click();
    await page.getByText('More about them').click();
    await page.getByLabel('Paid leave days a year').fill('14');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(row).toContainText('leave 0 of 14');
    // The loan left the drawer and is not an expense: it shows in the cash book.
    await page.goto('/finance/book');
    await expect(page.locator('ws-data-grid tbody')).toContainText(`Loan to ${name}`);
  } finally {
    await undo();
  }
});

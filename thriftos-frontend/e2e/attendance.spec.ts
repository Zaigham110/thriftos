import { expect, test } from '@playwright/test';
import { apiAs, setDemoModule, signIn } from './helpers';

test('attendance: mark a day with one tap each, all the rest present, and see the month (owner, 2026-11-17)', async ({ page, request }) => {
  const undo = await setDemoModule(request, 'PAYROLL', true);
  try {
    const api = await apiAs(request);
    const tag = Date.now().toString().slice(-6);
    const loader = await api.post('/payroll/workers', { name: `Loader ${tag}`, payType: 'DAY', rate: 1000, jobTitle: 'Loader' });
    const clerk = await api.post('/payroll/workers', { name: `Clerk ${tag}`, payType: 'MONTH', rate: 30000 });

    await page.setViewportSize({ width: 1280, height: 860 });
    await signIn(page);
    await page.getByRole('navigation').getByRole('link', { name: 'Attendance' }).click();
    await expect(page).toHaveURL(/\/people\/attendance$/);
    await expect(page.getByRole('heading', { name: 'Attendance' })).toBeVisible();
    const row = (name: string) => page.locator('li.emp').filter({ hasText: name });
    // One tap marks; the others are marked present together.
    await row(loader.name).getByRole('radio', { name: 'Absent' }).click();
    await expect(row(loader.name).getByRole('radio', { name: 'Absent' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: /^Mark the other \d+ present$/ }).click();
    await expect(row(clerk.name).getByRole('radio', { name: 'Present' })).toHaveAttribute('aria-checked', 'true');
    // The one already marked keeps its mark; nobody is left unmarked.
    await expect(row(loader.name).getByRole('radio', { name: 'Absent' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('.sum')).toContainText('absent');
    await expect(page.locator('.sum')).not.toContainText('not marked');
    // A half day, then the month's counts.
    await row(clerk.name).getByRole('radio', { name: 'Half day' }).click();
    await expect(row(clerk.name).getByRole('radio', { name: 'Half day' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('tab', { name: 'Month' }).click();
    const cells = (name: string) => page.locator('tbody tr').filter({ hasText: name }).locator('td');
    // Columns: name, Present, Absent, Half day, Leave, Holiday.
    await expect(cells(loader.name).nth(2)).toHaveText('1');
    await expect(cells(clerk.name).nth(3)).toHaveText('1');
    // A day that has not come cannot be picked.
    await expect(page.getByRole('button', { name: 'Later' })).toBeDisabled();

    // Leave asked for over days, then given: the days are marked; cancelled, they are cleared (owner, 2026-11-18).
    await page.getByRole('tab', { name: /^Leave/ }).click();
    const today = new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10);
    const later = new Date(Date.now() + 5 * 3_600_000 + 2 * 86_400_000).toISOString().slice(0, 10);
    await page.getByLabel('Name').selectOption({ label: loader.name });
    await page.getByLabel('From').fill(today);
    await page.getByLabel('To').fill(later);
    await page.getByLabel(/^Reason/).fill('Family wedding');
    await page.getByRole('button', { name: 'Save, decide later' }).click();
    const leave = page.locator('li.leave').filter({ hasText: loader.name });
    await expect(leave).toContainText('Waiting');
    await expect(leave).toContainText('3 days');
    await expect(page.getByRole('tab', { name: 'Leave (1)' })).toBeVisible();
    await leave.getByRole('button', { name: 'Give' }).click();
    await expect(leave).toContainText('Given');
    await page.getByRole('tab', { name: 'Day' }).click();
    await expect(row(loader.name).getByRole('radio', { name: 'Leave' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('tab', { name: /^Leave/ }).click();
    await leave.getByRole('button', { name: 'Cancel' }).click();
    await expect(leave).toContainText('Cancelled');
    await page.getByRole('tab', { name: 'Day' }).click();
    await expect(row(loader.name).getByRole('radio', { name: 'Absent' })).toHaveAttribute('aria-checked', 'false');
    await expect(row(loader.name).getByRole('radio', { name: 'Leave' })).toHaveAttribute('aria-checked', 'false');
  } finally {
    await undo();
  }
});

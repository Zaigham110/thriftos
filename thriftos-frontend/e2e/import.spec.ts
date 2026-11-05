import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

// v2 6.1: the owner brings the old khata in from a file — preview with plain problems, add, and never twice.

test('the owner imports customers from a register file once, with problems shown per row', async ({ page }) => {
  await signIn(page);
  await page.goto('/settings/admin/import');
  await expect(page.getByRole('heading', { name: 'Bring in your register' })).toBeVisible();

  const template = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download sheet' }).click();
  expect((await template).suggestedFilename()).toBe('thriftos-customers.xlsx');

  const tag = Date.now().toString(36);
  const file = {
    name: 'purana-khata.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(`Party Name,Mobile,Baqaya\r\nRafiq ${tag},0300-1234567,"Rs 1,25,000"\r\n,,\r\nBilal ${tag},92 321 7654321,1.5 lakh\r\nKamran ${tag},,abc\r\n`, 'utf8'),
  };
  await page.locator('input[type=file]').setInputFiles(file);
  await expect(page.getByText('2 ready to add')).toBeVisible();
  await expect(page.getByText('1 need fixing')).toBeVisible();
  await expect(page.getByText(/Opening balance: ".abc." is not an amount/)).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(`Rafiq ${tag}`) })).toContainText('125,000');

  await page.getByRole('button', { name: 'Add 2 rows' }).click();
  await expect(page.getByRole('status')).toContainText('Added 2. Skipped 1.');

  await page.locator('input[type=file]').setInputFiles(file);
  await expect(page.getByText('2 added before')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add 0 rows' })).toBeDisabled();
});

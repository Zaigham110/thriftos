import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

// v2 5.5/5.6: Terms and Privacy without a login, forgot password, and the owner's full data download.

test('Terms and Privacy open from the sign-in page, in English and Urdu', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('thriftos.lang', 'en'));
  await page.goto('/auth/login');
  await page.getByRole('link', { name: 'Privacy' }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible();
  await page.getByRole('link', { name: 'Terms of use' }).click();
  await expect(page.getByRole('heading', { name: 'Terms of use' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Language' }).selectOption('ur');
  await expect(page.getByRole('heading', { name: 'استعمال کی شرائط' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});

test('forgot password gives the same answer for any email', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('thriftos.lang', 'en'));
  await page.goto('/auth/login');
  await page.locator('.who .chip').nth(1).click();
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await expect(page.getByRole('heading', { name: 'Forgot password' })).toBeVisible();
  await page.getByLabel('Email').fill('nobody-at-all@example.com');
  await page.getByRole('button', { name: 'Send link' }).click();
  await expect(page.getByRole('status')).toContainText('If this email has an account');
});

test('the owner downloads all the business data as a zip', async ({ page }) => {
  await signIn(page);
  await page.goto('/settings');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Download all my data/ }).click();
  expect((await download).suggestedFilename()).toMatch(/^thriftos-.+\.zip$/);
});

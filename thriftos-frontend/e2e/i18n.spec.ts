import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

/** Task 3.3: Urdu switches to RTL with Urdu fonts and spoken tab names; numbers stay in Western digits. */
test('Urdu: right-to-left, Urdu words and fonts, Western digits; the choice is kept', async ({ page }) => {
  await signIn(page);
  const tabs = page.getByRole('navigation').last();
  // English is plain English; the trade's own words are in Roman Urdu.
  for (const word of ['Receive', 'Sorting', 'Sell', 'Receivables']) await expect(tabs.getByRole('link', { name: word, exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('combobox', { name: 'Language' }).selectOption('ur');

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ur');
  for (const word of ['ہوم', 'مال آیا', 'چھانٹی', 'بیچو', 'کھاتہ']) await expect(tabs.getByRole('link', { name: word, exact: true })).toBeVisible();
  await expect(page.getByText('سب محفوظ')).toBeVisible();

  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([document.fonts.load('16px "Noto Naskh Arabic"', 'اردو'), document.fonts.load('700 20px "Noto Nastaliq Urdu"', 'اردو')]);
    return { naskh: document.fonts.check('16px "Noto Naskh Arabic"', 'اردو'), nastaliq: document.fonts.check('700 20px "Noto Nastaliq Urdu"', 'اردو') };
  });
  expect(fonts).toEqual({ naskh: true, nastaliq: true });

  // No Eastern Arabic / Urdu digits anywhere on the page.
  expect(await page.locator('body').innerText()).not.toMatch(/[٠-٩۰-۹]/);

  // The choice survives a reload, and switching back restores LTR.
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.getByRole('button', { name: 'مزید' }).click();
  await page.getByRole('combobox', { name: 'زبان' }).selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});

test('Roman Urdu: left to right in Latin letters, with the words traders use', async ({ page }) => {
  await signIn(page);
  const tabs = page.getByRole('navigation').last();
  await page.getByRole('button', { name: 'More' }).click();
  await expect(page.getByRole('combobox', { name: 'Language' }).locator('option')).toHaveText(['English', 'اردو', 'Roman Urdu']);
  await page.getByRole('combobox', { name: 'Language' }).selectOption('roman');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ur-Latn');
  for (const word of ['Maal aya', 'Chhantai', 'Becho', 'Khata']) await expect(tabs.getByRole('link', { name: word, exact: true })).toBeVisible();
  await page.reload();
  await expect(tabs.getByRole('link', { name: 'Becho' })).toBeVisible();
});

test('the public bill page has its own language switch', async ({ page }) => {
  await page.goto('/bill/not-a-real-token');
  await expect(page.getByText('This bill link is not valid.')).toBeVisible();
  await page.getByRole('combobox', { name: 'Language' }).selectOption('ur');
  await expect(page.getByText('یہ بِل لنک درست نہیں۔')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});

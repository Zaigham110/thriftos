import { Page, expect, test } from '@playwright/test';
import { signIn } from './helpers';

async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL('**/auth/login**');
}

async function pinSignIn(page: Page, phone: string, pin: string): Promise<void> {
  await page.getByRole('tab', { name: 'Munshi' }).click();
  await page.getByLabel('WhatsApp number').fill(phone);
  for (const d of pin) await page.locator('.keys').getByRole('button', { name: d, exact: true }).click();
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/** Task 3.7: the owner adds a munshi; the munshi signs in with phone + PIN; 5 wrong PINs lock it; the owner unlocks. */
test('munshi phone + PIN sign-in with lockout after 5 wrong PINs', async ({ page }) => {
  const phone = `0333${Date.now().toString().slice(-7)}`;
  await signIn(page);
  await page.goto('/settings/team');
  await page.getByRole('button', { name: 'Add munshi' }).click();
  await page.getByLabel('Munshi name').fill('Akram');
  await page.getByLabel('WhatsApp number').fill(phone);
  await page.getByLabel(/PIN for the munshi/).fill('4821');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Akram can now sign in with phone and PIN.' })).toBeVisible();
  await signOut(page);

  // The munshi signs in and gets the floor home (no owner numbers).
  await pinSignIn(page, phone, '4821');
  await page.waitForURL('**/home');
  await expect(page.getByRole('heading', { name: "Today's work" })).toBeVisible();
  await expect(page.locator('a.stat').filter({ hasText: 'Profit per container' })).toHaveCount(0);
  await signOut(page);

  // The phone remembers: Munshi is selected and the number is filled in.
  await expect(page.getByRole('tab', { name: 'Munshi' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel('WhatsApp number')).toHaveValue(phone);

  for (const left of [4, 3, 2, 1]) {
    await pinSignIn(page, phone, '0000');
    await expect(page.getByRole('alert')).toHaveText(`Phone or PIN is wrong. ${left} tries left.`);
  }
  await pinSignIn(page, phone, '0000');
  await expect(page.getByRole('alert')).toHaveText('Too many wrong PINs. Try again in 15 minutes or ask the owner.');
  await pinSignIn(page, phone, '4821');
  await expect(page.getByRole('alert')).toContainText('Too many wrong PINs');

  // The owner unlocks it.
  await page.getByRole('tab', { name: 'Owner' }).click();
  await page.fill('input[type=email]', 'admin@demo.thriftos.com');
  await page.fill('input[type=password]', 'admin123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/home');
  await page.goto('/settings/team');
  const row = page.locator('li.member').filter({ hasText: 'Akram' }).filter({ hasText: '+92' + phone.slice(1) });
  await expect(row).toContainText('Locked');
  await row.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Akram can sign in again.' })).toBeVisible();
  await signOut(page);
  await pinSignIn(page, phone, '4821');
  await page.waitForURL('**/home');
});

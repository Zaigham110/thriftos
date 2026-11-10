import { Page, expect, test } from '@playwright/test';
import { signIn } from './helpers';

async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL('**/auth/login**');
}

async function pinSignIn(page: Page, phone: string, pin: string): Promise<void> {
  await page.getByRole('tab', { name: 'Phone + PIN' }).click();
  await page.getByLabel('WhatsApp number').fill(phone);
  for (const d of pin) await page.locator('.keys').getByRole('button', { name: d, exact: true }).click();
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/** Task 3.7 (v2: staff): the owner adds staff with a role; they sign in with phone + PIN; 5 wrong PINs lock it; the owner unlocks. */
test('staff phone + PIN sign-in with lockout after 5 wrong PINs', async ({ page }) => {
  const phone = `0333${Date.now().toString().slice(-7)}`;
  await signIn(page);
  await page.goto('/settings/team');
  await page.getByRole('button', { name: 'Add staff' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Akram');
  // Sorter is chosen first; each job says what it does.
  await expect(page.getByRole('button', { name: 'Sorter', exact: true })).toHaveClass(/on/);
  await page.getByRole('button', { name: 'Salesman', exact: true }).click();
  await expect(page.getByText('Sales, customers and collecting payments.')).toBeVisible();
  await page.getByRole('button', { name: 'Sorter', exact: true }).click();
  await page.getByLabel('WhatsApp number').fill(phone);
  await page.getByLabel(/PIN for them/).fill('4821');
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
  await expect(page.getByRole('tab', { name: 'Phone + PIN' })).toHaveAttribute('aria-selected', 'true');
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
  await page.getByRole('tab', { name: 'Email' }).click();
  await page.fill('input[type=email]', 'admin@demo.thriftos.com');
  await page.fill('input[type=password]', 'admin123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/home');
  await page.goto('/settings/team');
  // Phones show the local way (0333 1234567); open the person to act.
  const row = page.locator('li.member').filter({ hasText: 'Akram' }).filter({ hasText: phone.slice(4) });
  await expect(row).toContainText('Locked');
  await expect(row).toContainText('Sorter');
  await row.locator('button.head').click();
  await row.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Akram can sign in again.' })).toBeVisible();
  await signOut(page);
  await pinSignIn(page, phone, '4821');
  await page.waitForURL('**/home');

  // Settings review: the munshi sees their own things only, and changes their PIN.
  await page.goto('/settings');
  await expect(page.getByRole('link', { name: /Change my PIN/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Team/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /^Advanced/ })).toHaveCount(0);
  await page.getByRole('link', { name: /Change my PIN/ }).click();
  await page.getByLabel('Current PIN').fill('4821');
  await page.getByLabel(/^New PIN/).first().fill('1357');
  await page.getByLabel('New PIN again').fill('1357');
  await page.getByRole('button', { name: 'Save PIN' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'New PIN saved.' })).toBeVisible();
  // Settings has its own Sign out; use it.
  await page.locator('.me').getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL('**/auth/login**');
  await pinSignIn(page, phone, '1357');
  await page.waitForURL('**/home');
  await signOut(page);

  // The owner stops the munshi's access (they left); signing in no longer works.
  await page.getByRole('tab', { name: 'Email' }).click();
  await page.fill('input[type=email]', 'admin@demo.thriftos.com');
  await page.fill('input[type=password]', 'admin123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/home');
  await page.goto('/settings/team');
  const again = page.locator('li.member').filter({ hasText: phone.slice(4) });
  await again.locator('button.head').click();
  page.once('dialog', (d) => d.accept());
  await again.getByRole('button', { name: 'Stop access' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Akram can no longer sign in.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Access stopped' })).toBeVisible();
  await signOut(page);
  await pinSignIn(page, phone, '1357');
  await expect(page.getByRole('alert')).toBeVisible();
});

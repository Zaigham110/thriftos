import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

/** v2 review (Settings): one Business page, the Advanced lists and roles in plain, translated words. */
test('business details for bills, a godown added on the simple list, a role in plain words', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await signIn(page);
  await page.goto('/settings');
  await expect(page.getByText('Name, phone and address on bills, currency, language')).toBeVisible();
  await page.getByRole('link', { name: /^Business/ }).click();
  await expect(page).toHaveURL(/\/settings\/business$/);
  await page.getByLabel('Business phone').fill('0300 1112233');
  await page.getByLabel('Address').fill('Shop 12, Landa Bazaar');
  await page.getByLabel('City').fill('Lahore');
  await expect(page.locator('.preview')).toContainText('0300 1112233 · Shop 12, Landa Bazaar · Lahore');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Business saved.' })).toBeVisible();

  // Old addresses land on the new pages.
  await page.goto('/settings/admin/tenant');
  await expect(page).toHaveURL(/\/settings\/business$/);
  await page.goto('/settings/admin/users');
  await expect(page).toHaveURL(/\/settings\/team$/);

  const tag = Date.now().toString().slice(-5);
  await page.goto('/settings/admin/warehouses');
  await expect(page.getByRole('heading', { name: 'Godowns' })).toBeVisible();
  await page.getByLabel('Name').fill(`Shershah ${tag}`);
  await page.getByLabel('Where').fill('Shershah, Karachi');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: `Shershah ${tag} added.` })).toBeVisible();
  const row = page.locator('li').filter({ hasText: `Shershah ${tag}` });
  await row.getByRole('button', { name: 'Turn off' }).click();
  await expect(page.getByRole('heading', { name: /Turned off/ })).toBeVisible();

  await page.goto('/settings/admin/roles');
  await expect(page.getByRole('heading', { name: 'Roles' })).toBeVisible();
  await page.locator('li').filter({ hasText: 'Owner' }).first().getByRole('link', { name: 'What they can do' }).click();
  await expect(page.getByText('The owner can do everything')).toBeVisible();
  await expect(page.getByText('Containers: add')).toBeVisible();
  await expect(page.getByText("Close the day's cash")).toBeVisible();
});

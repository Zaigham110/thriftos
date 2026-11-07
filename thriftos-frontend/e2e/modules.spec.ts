import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

/**
 * Task 4.5: reports, warehouses, purchase orders and super admin billing are not part of v1. With the default
 * modules they are not in the menus, and opening their address says the part is turned off (the server refuses them too —
 * server/test/e2e/modules.e2e-spec.ts).
 */
test('an owner with the v1 modules sees no reports or purchase orders (godowns are core)', async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole('link', { name: 'Receivables', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Reports', exact: true })).toHaveCount(0);

  // Their addresses say the part is turned off (or that the page does not exist), with a way home.
  for (const url of ['/reports', '/reports/detail', '/home/overview', '/receive/records/pos', '/receive/records/pos/create']) {
    await page.goto(url);
    await expect(page.getByText(/This part is turned off|This page does not exist/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to Home' })).toBeVisible();
  }

  // Godowns are part of every business (stock transfers).
  await page.goto('/settings/admin/warehouses');
  await expect(page).toHaveURL(/\/settings\/admin\/warehouses$/);
  // The old procurement overview is gone: its address opens the containers list.
  await page.goto('/receive/records/dashboard');
  await expect(page).toHaveURL(/\/receive\/records\/containers$/);
});

test('the super admin console hides plans and billing unless the platform turned them on', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/auth/login');
  await page.locator('.who .chip').nth(1).click();
  await page.fill('input[type=email]', 'superadmin@thriftos.com');
  await page.fill('input[type=password]', 'SuperAdmin@123');
  await page.click('button[type=submit]');
  await page.waitForURL('**/admin/**');
  await expect(page.getByRole('link', { name: 'Businesses' })).toBeVisible();
  // Plans and Billing are gone (they showed sample numbers); old links go to the overview.
  await expect(page.getByText('Commercial', { exact: true })).toHaveCount(0);

  for (const url of ['/admin/billing', '/admin/plans']) {
    await page.goto(url);
    await page.waitForURL('**/admin/dashboard');
  }
});

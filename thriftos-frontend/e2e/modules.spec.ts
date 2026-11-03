import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

/**
 * Task 4.5: reports, warehouses, purchase orders and super admin billing are not part of v1. With the default
 * modules they are not in the menus, and opening their address goes back home (the server refuses them too —
 * server/test/e2e/modules.e2e-spec.ts).
 */
test('an owner with the v1 modules sees no reports, warehouses or purchase orders', async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole('link', { name: 'Khata', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Reports', exact: true })).toHaveCount(0);

  for (const url of ['/reports', '/reports/detail', '/home/overview', '/settings/admin/warehouses', '/receive/records/pos', '/receive/records/pos/create']) {
    await page.goto(url);
    await page.waitForURL('**/home');
  }

  await page.goto('/receive/records/dashboard');
  await expect(page.getByRole('heading', { name: 'Procurement Overview' })).toBeVisible();
  await expect(page.getByText('Active Purchase Orders', { exact: true })).toHaveCount(0);
  await expect(page.getByText('PO Spend vs. Allocation', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /New Purchase Order/ })).toHaveCount(0);
});

test('the super admin console hides plans and billing unless the platform turned them on', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/auth/login');
  await page.locator('.who .chip').nth(1).click();
  await page.fill('input[type=email]', 'superadmin@thriftos.com');
  await page.fill('input[type=password]', 'SuperAdmin@123');
  await page.click('button[type=submit]');
  await page.waitForURL('**/admin/**');
  await expect(page.getByText('Platform Governance', { exact: true }).first()).toBeVisible();
  // The "Commercial" group (Plans, Billing) is not in the menu.
  await expect(page.getByText('Commercial', { exact: true })).toHaveCount(0);

  for (const url of ['/admin/billing', '/admin/plans']) {
    await page.goto(url);
    await page.waitForURL('**/admin/dashboard');
  }
});

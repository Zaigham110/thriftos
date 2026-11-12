import { expect, test } from '@playwright/test';
import { setDemoModule, signIn } from './helpers';

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

test('the super admin console: Billing is a real page (Phase 7) and the old Plans link goes to it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/auth/login');
  await page.locator('.who .chip').nth(1).click();
  await page.fill('input[type=email]', 'superadmin@thriftos.com');
  await page.fill('input[type=password]', 'SuperAdmin@123');
  await page.click('button[type=submit]');
  await page.waitForURL('**/admin/**');
  await expect(page.getByRole('link', { name: 'Businesses' })).toBeVisible();
  // The old sample "Commercial" section stays gone; Billing (Phase 7) has real plans and payments.
  await expect(page.getByText('Commercial', { exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Billing' }).click();
  await expect(page.getByRole('heading', { name: 'Billing', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Plans' })).toBeVisible();
  await page.goto('/admin/plans');
  await page.waitForURL('**/admin/billing');
});

/** v2 modules: a business that buys only loose lots never lands on the Containers page (owner's report). */
test('loose lots only: Purchasing opens Loose lots, no Containers tab, no "turned off" page', async ({ page, request }) => {
  const undo = await setDemoModule(request, 'CONTAINERS', false);
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await signIn(page);
    await page.getByRole('link', { name: 'Purchasing' }).first().click();
    await expect(page).toHaveURL(/\/receive\/records\/lots$/);
    await expect(page.getByText('This part is turned off')).toHaveCount(0);
    await expect(page.locator('nav.tabs').getByRole('link', { name: 'Containers' })).toHaveCount(0);
    // "Maal aya" on a laptop goes to the same place.
    await page.goto('/receive');
    await expect(page).toHaveURL(/\/receive\/records\/lots$/);
    // The Purchasing address itself picks the tab this business has.
    await page.goto('/receive/records');
    await expect(page).toHaveURL(/\/receive\/records\/lots$/);
  } finally {
    await undo();
  }
});

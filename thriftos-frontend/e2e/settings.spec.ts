import { expect, test } from '@playwright/test';
import { setDemoModule, signIn } from './helpers';

/** v2 review (Settings): one Business page, the Advanced lists and roles in plain, translated words. */
test('business details for bills, a godown added on the simple list, a role in plain words', async ({ page, request }) => {
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
  // A second godown is "More than one godown" (v2 modules): off, there is no Add; the super admin turns it on.
  await expect(page.getByLabel('Where')).toHaveCount(0);
  // The page says why, with the way to the plan (v2 review: it said nothing).
  await expect(page.getByText('Your plan keeps stock in one godown.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'See Plan and billing' })).toHaveAttribute('href', '/settings/billing');
  const undo = await setDemoModule(request, 'WAREHOUSES', true);
  await page.reload();
  await page.getByLabel('Name').fill(`Shershah ${tag}`);
  await page.getByLabel('Where').fill('Shershah, Karachi');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: `Shershah ${tag} added.` })).toBeVisible();
  const row = page.locator('li').filter({ hasText: `Shershah ${tag}` });
  await row.getByRole('button', { name: 'Turn off' }).click();
  await expect(page.getByRole('heading', { name: /Turned off/ })).toBeVisible();
  await undo();

  await page.goto('/settings/admin/roles');
  await expect(page.getByRole('heading', { name: 'Roles' })).toBeVisible();
  await page.locator('li').filter({ hasText: 'Owner' }).first().getByRole('link', { name: 'What they can do' }).click();
  await expect(page.getByText('The owner can do everything')).toBeVisible();
  await expect(page.getByText('Containers: add')).toBeVisible();
  await expect(page.getByText("Close the day's cash")).toBeVisible();
});

test('raw types: change, put in order and turn off; help shows the guides this business can use (owner, 2026-11-17)', async ({ page, request }) => {
  const tag = Date.now().toString().slice(-5);
  await page.setViewportSize({ width: 1280, height: 860 });
  await signIn(page);
  await page.goto('/settings/admin/raw-categories');
  // One name for the page everywhere.
  await expect(page.getByRole('heading', { name: 'Raw types' })).toBeVisible();
  for (const name of [`Winter ${tag}`, `Summer ${tag}`]) {
    await page.getByLabel('Name').fill(name);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: `${name} added.` })).toBeVisible();
  }
  // The same name again is refused in plain words.
  await page.getByLabel('Name').fill(`winter ${tag}`);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'That name is already there.' })).toBeVisible();

  // Change how it comes: it is saved (it was refused before).
  const summer = page.locator('ul.rows li').filter({ hasText: `Summer ${tag}` });
  await summer.getByRole('button', { name: 'Change' }).click();
  await page.locator('form.edit').getByLabel('Comes as').selectOption({ label: 'Loose' });
  await page.locator('form.edit').getByRole('button', { name: 'Save' }).click();
  await expect(summer).toContainText('Loose');
  // Move it up: the order is saved.
  await summer.getByRole('button', { name: `Move up: Summer ${tag}` }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Order saved' })).toBeVisible();
  // Turn off asks nothing and can be undone.
  await summer.getByRole('button', { name: 'Turn off' }).click();
  await expect(page.getByRole('heading', { name: /Turned off/ })).toBeVisible();
  await page.locator('ul.rows.off li').filter({ hasText: `Summer ${tag}` }).getByRole('button', { name: 'Turn on' }).click();
  await expect(page.getByRole('status').filter({ hasText: `Summer ${tag} turned on.` })).toBeVisible();

  // Help: a business without containers is not shown the container guide; the new guides are there.
  const undo = await setDemoModule(request, 'CONTAINERS', false);
  await page.goto('/help');
  await expect(page).toHaveTitle('Help · ThriftOS');
  await expect(page.getByRole('link', { name: 'Buy a loose lot' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Record an expense' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Receive a container' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Add a supplier' }).click();
  await expect(page.getByRole('link', { name: 'New supplier' })).toHaveAttribute('href', '/receive/records/suppliers/new');
  await undo();
});

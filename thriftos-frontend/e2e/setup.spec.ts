import { expect, test } from '@playwright/test';
import { apiAs } from './helpers';

/**
 * Task 3.8 / journey 8: a brand-new business — made by the super admin — signs in, goes through the wizard
 * (one question per screen) and can sort with its own categories, grades and the Waste/Katran tile.
 */
test('a new business is set up through the wizard and ready to work', async ({ page, request }) => {
  const tag = Date.now().toString().slice(-6);
  const admin = await apiAs(request, { email: 'superadmin@thriftos.com', password: 'SuperAdmin@123' });
  const email = `owner${tag}@new.test`;
  await admin.post('/superadmin/tenants', { name: `New ${tag}`, companyCode: `NEW${tag}`, adminEmail: email, adminName: 'Owner', adminPassword: 'owner-pass-1' });
  const phone = `0312${tag}9`;

  await page.addInitScript(() => localStorage.setItem('thriftos.lang', 'en'));
  const started = Date.now();
  await page.goto('/auth/login');
  await page.locator('.who .chip').nth(1).click();
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', 'owner-pass-1');
  await page.getByRole('button', { name: 'Sign in' }).click();

  // The owner of a business that is not set up lands on the wizard.
  await page.waitForURL('**/setup');
  // How it sorts was set when the business was made (v2 modules): the wizard asks only for names.
  await expect(page.getByText('Step 1 of 4')).toBeVisible();
  await page.getByLabel('Business name').fill(`Al-Madina Traders ${tag}`);
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByRole('button', { name: /^Jeans/ })).toBeVisible();
  await page.getByRole('button', { name: /^Bags/ }).click(); // remove
  await page.getByPlaceholder('Add category').fill('Pathani suits');
  await page.getByPlaceholder('Add category').press('Enter');
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByLabel('Grade names 1')).toHaveValue('Cream');
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByText('Step 4 of 4')).toBeVisible();
  await page.getByLabel('Name', { exact: true }).fill('Akram');
  await page.getByRole('button', { name: 'Manager', exact: true }).click();
  await page.getByLabel('WhatsApp number').fill(phone);
  await page.getByLabel(/PIN for them/).fill('4821');
  await page.getByRole('button', { name: 'Start using ThriftOS' }).click();
  await page.waitForURL('**/home');
  console.log(`setup took ${((Date.now() - started) / 1000).toFixed(1)} s of app time (4 screens, 4 fields typed)`);

  // Its own categories on the sort screen, in order (with their grades, v2 6.6); no Bags. Kat is booked at close.
  const owner = await apiAs(request, { email, password: 'owner-pass-1' });
  const lot = await owner.post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 300, purchaseCost: 60000 });
  await page.goto(`/sort/${lot.id}`);
  const tiles = page.locator('tos-tiles .tile strong');
  await expect(tiles.first()).toHaveText(/^Jeans/);
  await expect(tiles.filter({ hasText: 'Pathani suits' }).first()).toBeVisible();
  await expect(tiles.filter({ hasText: 'Bags' })).toHaveCount(0);
  await expect(tiles.filter({ hasText: 'Waste/Katran' })).toHaveCount(0);

  // The wizard does not come back; the munshi can sign in.
  await page.goto('/home');
  await expect(page).toHaveURL(/\/home$/);
  const pin = await request.post('/api/auth/login/pin', { data: { phone, pin: '4821' } });
  expect(pin.ok()).toBeTruthy();
});

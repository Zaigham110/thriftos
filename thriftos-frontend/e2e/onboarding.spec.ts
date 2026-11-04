import { expect, test } from '@playwright/test';

// v2 6.5: the super admin makes a business in three fields, gets the welcome message with the PIN, opens it in the
// read-only support view, and sees last activity per business. The new owner then signs in with phone + PIN.

test('quick create, read-only support view, last activity, owner signs in with the PIN', async ({ page, browser }) => {
  const tag = Date.now().toString().slice(-7);
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto('/auth/login');
  await page.locator('.who .chip').nth(1).click();
  await page.fill('input[type=email]', 'superadmin@thriftos.com');
  await page.fill('input[type=password]', 'SuperAdmin@123');
  await page.click('button[type=submit]');
  await page.waitForURL('**/admin/**');

  await page.goto('/admin/tenants');
  await expect(page.getByRole('columnheader', { name: 'Last activity' })).toBeVisible();
  await page.getByRole('button', { name: 'New business' }).click();
  await expect(page).toHaveURL(/\/admin\/tenants\/quick$/);
  await page.getByLabel('Business name').fill(`Quick Bales ${tag}`);
  await page.getByLabel("Owner's name").fill('Haji Rafiq');
  await page.getByLabel("Owner's phone").fill(`0304 ${tag}`);
  await page.getByRole('button', { name: 'Create business' }).click();

  await expect(page.getByRole('heading', { name: `Quick Bales ${tag} is ready` })).toBeVisible();
  const pin = (await page.locator('.pin').textContent())!.trim();
  expect(pin).toMatch(/^\d{6}$/);
  const message = await page.getByLabel('Welcome message').inputValue();
  expect(message).toContain(pin);
  expect(message).toContain('السلام علیکم Haji Rafiq');
  await expect(page.getByRole('link', { name: 'Send on WhatsApp' })).toHaveAttribute('href', new RegExp(`^https://wa\\.me/92304${tag}\\?text=`));

  // Support view: the business as its owner sees it, a banner, and no changes allowed.
  await page.getByRole('button', { name: 'Open support view' }).click();
  await page.waitForURL(/\/(home|setup)/);
  // The business opens in its own language (Urdu here).
  const banner = page.locator('.tos-support');
  await expect(banner).toContainText(`Quick Bales ${tag}`);
  const write = await page.evaluate(async () => {
    const token = localStorage.getItem('thriftos_access_token') ?? sessionStorage.getItem('thriftos_access_token') ?? '';
    const r = await fetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: 'Support', phone: '0345 0000009' }) });
    return { status: r.status, body: await r.json() };
  });
  expect(write.status).toBe(403);
  expect(write.body.message).toMatch(/read-only/);
  await expect(banner).toContainText('سپورٹ ویو');
  await banner.getByRole('button').click();
  await page.waitForURL('**/admin/tenants');
  await expect(banner).toHaveCount(0);

  // The owner signs in on their phone with phone + PIN.
  const phone = await browser.newPage({ viewport: { width: 360, height: 780 } });
  await phone.goto('/auth/login');
  await phone.locator('.who .chip').nth(0).click();
  await phone.locator('input[type=tel]').fill(`0304 ${tag}`);
  for (const d of pin) await phone.getByRole('button', { name: d, exact: true }).click();
  await phone.locator('button[type=submit]').click();
  await phone.waitForURL(/\/(home|setup)/);
  await phone.close();
});

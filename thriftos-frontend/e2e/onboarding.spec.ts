import { expect, test } from '@playwright/test';

// v2 6.5: the super admin makes a business, gets the welcome message with the first password, opens it in the
// read-only support view, and sees last activity per business. The new owner signs in with email and must choose
// their own password first (v2: owners sign in with email).

test('quick create, read-only support view, last activity, owner signs in with email and chooses a password', async ({ page, browser }) => {
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
  await page.getByRole('link', { name: 'New business' }).click();
  await expect(page).toHaveURL(/\/admin\/tenants\/quick$/);
  await page.getByLabel('Business name').fill(`Quick Bales ${tag}`);
  await page.getByLabel("Owner's name").fill('Haji Rafiq');
  const email = `rafiq${tag}@quick.pk`;
  // Email is the login; without it Create says what is missing.
  await page.getByRole('button', { name: 'Create business' }).click();
  await expect(page.getByText('Enter an email like rafiq@example.com.')).toBeVisible();
  await page.getByLabel("Owner's email").fill(email);
  await page.getByLabel("Owner's phone").fill(`0304 ${tag}`);
  await page.getByRole('button', { name: 'Create business' }).click();

  await expect(page.getByRole('heading', { name: `Quick Bales ${tag} is ready` })).toBeVisible();
  const password = (await page.locator('.pin').textContent())!.trim();
  expect(password.length).toBeGreaterThanOrEqual(10);
  await expect(page.locator('.facts')).toContainText(`0304 ${tag}`);
  await expect(page.locator('.facts')).toContainText(email);
  const message = await page.getByLabel('Welcome message').inputValue();
  expect(message).toContain(password);
  expect(message).toContain(email);
  expect(message).toContain('السلام علیکم Haji Rafiq');
  await expect(page.getByRole('link', { name: 'Send on WhatsApp' })).toHaveAttribute('href', new RegExp(`^https://wa\\.me/92304${tag}\\?text=`));

  // Support view: the business as its owner sees it, a banner, and no changes allowed.
  await page.getByRole('button', { name: 'See it as the owner (read-only)' }).click();
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

  // The owner signs in with email and the first password, and must choose their own before anything else.
  const phone = await browser.newPage({ viewport: { width: 360, height: 780 } });
  await phone.addInitScript(() => localStorage.setItem('thriftos.lang', 'en'));
  await phone.goto('/auth/login');
  await phone.locator('.who .chip').nth(1).click();
  await phone.fill('input[type=email]', email);
  await phone.fill('input[type=password]', password);
  await phone.locator('button[type=submit]').click();
  await phone.waitForURL('**/settings/password');
  await expect(phone.getByRole('heading', { name: 'Choose your own password' })).toBeVisible();
  await phone.goto('/home');
  await phone.waitForURL('**/settings/password');
  await phone.getByLabel('Password you were sent').fill(password);
  await phone.getByLabel(/^New password/).first().fill('Rafiq-own-pass-1');
  await phone.getByLabel('New password again').fill('Rafiq-own-pass-1');
  await phone.getByRole('button', { name: 'Save password' }).click();
  // Then straight to work: everything the setup would ask was chosen in the console.
  await phone.waitForURL('**/home');
  await phone.close();
});

// v2 review: a test business from the console — made as a test, owner's phone fixed, a new PIN, sample data,
// the audit trail for it, then deleted with everything in it.
test('test business: new PIN, fix the phone, sample data, audit, delete', async ({ page }) => {
  test.setTimeout(240_000);
  const tag = Date.now().toString().slice(-7);
  const name = `Try Bales ${tag}`;
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto('/auth/login');
  await page.locator('.who .chip').nth(1).click();
  await page.fill('input[type=email]', 'superadmin@thriftos.com');
  await page.fill('input[type=password]', 'SuperAdmin@123');
  await page.click('button[type=submit]');
  await page.waitForURL('**/admin/**');

  await page.goto('/admin/tenants/quick');
  await expect(page.getByRole('link', { name: 'Full form' })).toHaveCount(0);
  await page.getByLabel('Business name').fill(name);
  await page.getByLabel("Owner's name").fill('Test Owner');
  await page.getByLabel("Owner's email").fill(`test${tag}@quick.pk`);
  await page.getByLabel("Owner's phone").fill(`0305 ${tag}`);
  await page.getByLabel(/Test business/).check();
  // Set up by hand (Phase 7: otherwise a 14-day trial whose plan decides the modules).
  await page.getByRole('radio', { name: /Set up by hand/ }).check();
  await page.getByRole('button', { name: 'Create business' }).click();
  await page.getByRole('link', { name: 'Open the business page' }).click();

  await expect(page.getByRole('heading', { name, level: 1 })).toContainText('Test');
  const owner = page.locator('tr').filter({ hasText: 'Test Owner' });
  await expect(owner).toContainText(`0305 ${tag}`);
  await expect(owner).toContainText('Email and password');
  await expect(owner.getByRole('button', { name: 'New PIN' })).toHaveCount(0);

  // Fix the phone.
  await owner.getByRole('button', { name: 'Edit' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/Phone/).fill(`0306 ${tag}`);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(owner).toContainText(`0306 ${tag}`);

  // A new password (owners sign in with email); they choose their own at the next sign-in.
  await owner.getByRole('button', { name: 'New password' }).click();
  await expect(page.locator('.dialog .pin')).not.toBeEmpty();
  await expect(page.getByRole('dialog')).toContainText('choose their own password');
  await page.getByRole('button', { name: 'Done' }).click();

  // How the business works (v2 modules): made with the everyday set; switch to ready bales only with Export sales.
  const works = page.locator('section').filter({ has: page.getByRole('heading', { name: 'How this business works' }) });
  await expect(works).toContainText('Sorts by category and grade');
  await expect(works).toContainText('Containers, Loose lots, Ready bales');
  await works.getByRole('button', { name: 'Change' }).click();
  await dialog.getByRole('button', { name: /^Containers/ }).click();
  await dialog.getByRole('button', { name: /^Loose lots/ }).click();
  // Without containers or loose lots there is nothing to sort: it goes to No sorting by itself.
  await expect(dialog.getByRole('radio', { name: 'No sorting' })).toHaveAttribute('aria-checked', 'true');
  await expect(dialog.getByRole('radio', { name: 'Categories', exact: true })).toBeDisabled();
  await dialog.getByRole('switch', { name: 'Export sales' }).check();
  await expect(dialog).toContainText('The Sorting tab goes away');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(works).toContainText('Ready bales');
  await expect(works.locator('.tag.ok').filter({ hasText: 'Export sales' })).toBeVisible();
  await expect(page.locator('.page-subtitle')).toContainText('Trading only');
  // Sample data is a container sorting story: a trader is not offered it.
  await expect(page.getByRole('button', { name: 'Fill with sample data' })).toHaveCount(0);

  // Back to containers sorted by category and grade.
  await works.getByRole('button', { name: 'Change' }).click();
  await dialog.getByRole('button', { name: /^Containers/ }).click();
  await dialog.getByRole('radio', { name: 'Categories and grades' }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(works).toContainText('Sorts by category and grade');

  // Sample data, then the numbers show it.
  await page.getByRole('button', { name: 'Fill with sample data' }).click();
  await expect(page.getByText(/Sample data added: \d+ sales/)).toBeVisible({ timeout: 180_000 });
  await expect(page.getByRole('button', { name: 'Fill with sample data' })).toHaveCount(0);

  // The audit trail for this business, in plain words.
  await page.getByRole('link', { name: 'All of it' }).click();
  await expect(page).toHaveURL(/\/admin\/audit\?business=/);
  const trail = page.locator('app-global-audit tbody');
  await expect(trail).toContainText('Sample data added');
  await page.getByLabel('Search').fill('password');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(trail).toContainText('New password made');
  await expect(trail).not.toContainText('Console change');
  await page.goBack();

  // Delete: only after typing the name.
  await page.getByRole('button', { name: 'Delete business' }).click();
  const del = page.getByRole('dialog');
  await expect(del.getByRole('button', { name: 'Delete for good' })).toBeDisabled();
  await del.getByRole('textbox').fill(name);
  await del.getByRole('button', { name: 'Delete for good' }).click();
  await page.waitForURL('**/admin/tenants');
  await expect(page.getByText(name)).toHaveCount(0);
  await expect(page.getByText('System Administration')).toHaveCount(0);
});

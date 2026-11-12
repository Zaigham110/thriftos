import { expect, test } from '@playwright/test';
import { apiAs } from './helpers';

const SUPER = { email: 'superadmin@thriftos.com', password: 'SuperAdmin@123' };

// Phase 7: a new business on its trial sees the banner, pays for a plan with a screenshot, the super admin confirms
// it in the console, and the owner sees "Paid until" and prints the invoice.
test('billing: trial banner, pay with a screenshot, the console confirms, paid until and invoice', async ({ page, browser, request }) => {
  test.setTimeout(180_000);
  const tag = Date.now().toString().slice(-7);
  const admin = await apiAs(request, SUPER);
  const made = await admin.post('/superadmin/tenants/quick', { businessName: `Pay Bales ${tag}`, ownerName: 'Saleem', ownerEmail: `saleem${tag}@pay.pk`, language: 'en', sortingStages: 2 });
  const tenantId = made.tenant.id as string;
  // The trial's last 3 days, so the banner shows; where customers pay.
  await admin.patch(`/superadmin/billing/tenants/${tenantId}`, { trialEndsAt: new Date(Date.now() + 3 * 86_400_000 - 3_600_000).toISOString() });
  const put = await request.put('/api/superadmin/billing/pay-to', {
    headers: { Authorization: `Bearer ${(await (await request.post('/api/auth/login', { data: SUPER })).json()).accessToken}` },
    data: { accountTitle: 'ThriftOS Pakistan', jazzcash: '0300 1112223', easypaisa: '', bank: '', note: '' },
  });
  expect(put.ok()).toBeTruthy();

  // The owner signs in (choosing their own password first) and sees the trial banner.
  const owner = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  await owner.addInitScript(() => localStorage.setItem('thriftos.lang', 'en'));
  await owner.goto('/auth/login');
  await owner.locator('.who .chip').nth(1).click();
  await owner.fill('input[type=email]', `saleem${tag}@pay.pk`);
  await owner.fill('input[type=password]', made.temporaryPassword);
  await owner.locator('button[type=submit]').click();
  await owner.waitForURL('**/settings/password');
  await owner.getByLabel('Password you were sent').fill(made.temporaryPassword);
  await owner.getByLabel(/^New password/).first().fill('Saleem-own-pass-1');
  await owner.getByLabel('New password again').fill('Saleem-own-pass-1');
  await owner.getByRole('button', { name: 'Save password' }).click();
  await owner.waitForURL('**/home');
  const banner = owner.locator('.plan-banner');
  await expect(banner).toContainText('Free trial of Workshop: 3 days left');
  await banner.getByRole('link', { name: 'Choose a plan' }).click();
  await owner.waitForURL('**/settings/billing');

  // Plan and billing: the trial, the plans, where to pay; Importer, monthly, JazzCash with a screenshot.
  await expect(owner.locator('.now')).toContainText('Free trial: 3 days left');
  await owner.locator('.plan', { hasText: 'Importer' }).click();
  await expect(owner.locator('.pay')).toContainText(/Pay .*8,000\W* for Importer/);
  await expect(owner.locator('.payto')).toContainText('0300 1112223');
  await owner.getByLabel('Transaction ID').fill('TID 5566778899');
  await owner.getByLabel('Screenshot of the payment').setInputFiles({ name: 'jazzcash.png', mimeType: 'image/png', buffer: Buffer.from('\x89PNG\r\n\x1a\nfake') });
  await owner.getByRole('button', { name: 'Send for confirmation' }).click();
  await expect(owner.getByText('Your payment is waiting to be confirmed')).toBeVisible();
  await expect(owner.locator('.pay-row')).toContainText('Waiting');

  // The console: the payment to confirm, with its screenshot; confirm.
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto('/auth/login');
  await page.locator('.who .chip').nth(1).click();
  await page.fill('input[type=email]', SUPER.email);
  await page.fill('input[type=password]', SUPER.password);
  await page.click('button[type=submit]');
  await page.waitForURL('**/admin/**');
  await page.goto('/admin/billing');
  const row = page.locator('tr', { hasText: `Pay Bales ${tag}` }).first();
  await expect(row).toContainText('Rs 8,000');
  await expect(row.getByRole('button', { name: 'Screenshot' })).toBeVisible();
  page.once('dialog', (d) => void d.accept());
  await row.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.locator('tr', { hasText: `Pay Bales ${tag}` }).getByText('Paid')).toBeVisible();

  // The owner: paid until, confirmed, the invoice.
  await owner.reload();
  await expect(owner.locator('.now')).toContainText('Paid until');
  await expect(owner.locator('.pay-row')).toContainText('Confirmed');
  await owner.locator('.pay-row').getByRole('button', { name: 'Invoice' }).click();
  const invoice = owner.getByRole('dialog');
  await expect(invoice).toContainText(/Invoice INV-\d{4}-\d{4}/);
  await expect(invoice).toContainText(`Pay Bales ${tag}`);
  await expect(invoice).toContainText('Importer');
  await expect(owner.locator('.plan-banner')).toHaveCount(0);
  await owner.close();
});

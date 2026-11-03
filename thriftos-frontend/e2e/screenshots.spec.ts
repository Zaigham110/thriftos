import { Page, expect, test } from '@playwright/test';
import path from 'node:path';
import { keypad, keys, pickTile } from './floor';
import { apiAs, signIn } from './helpers';

/**
 * Screenshots of every journey at 360px in English and Urdu, saved to docs/v1/screenshots/ for review without
 * running the app. Run on demand:  SCREENSHOTS=1 npx playwright test -c e2e/playwright.config.ts screenshots
 */
const OUT = path.resolve(__dirname, '../../docs/v1/screenshots');
test.skip(!process.env['SCREENSHOTS'], 'set SCREENSHOTS=1 to refresh docs/v1/screenshots');
test.use({ deviceScaleFactor: 1.5 });

async function shot(page: Page, name: string, lang: string): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, `${name}-${lang}.png`) });
}

for (const lang of ['en', 'ur'] as const) {
  test(`journeys 1–6 screenshots (${lang})`, async ({ page, request }) => {
    test.setTimeout(180_000);
    const api = await apiAs(request);
    const tag = Date.now().toString().slice(-5);
    const t = (en: string, ur: string) => (lang === 'en' ? en : ur);
    const supplier = await api.post('/procurement/vendors', { name: `Karachi Imports ${tag}`, originCountry: 'USA' });
    const container = await api.post('/procurement/containers', { vendorId: supplier.id, netWeightKg: 20000, purchaseCost: 16000, purchaseCurrency: 'USD', fxRate: 280, charges: [{ chargeType: 'DUTY', amount: 350000 }], withLot: true });
    const lotId = container.rags[0].id;
    const categories = await api.get('/tenant/categories');
    const id = (name: string) => categories.find((c: { name: string }) => c.name === name).id;
    const s = await api.post('/sorting/stage-1/start', { ragId: lotId });
    await api.post('/sorting/stage-1/allocate', { sessionId: s.session.id, categoryId: id('Jeans'), amountKg: 8200 });
    await api.post('/sorting/stage-1/allocate', { sessionId: s.session.id, categoryId: id('T-Shirts'), amountKg: 6400 });
    await api.post('/sorting/stage-1/allocate', { sessionId: s.session.id, categoryId: id('Jackets'), amountKg: 3100 });
    const customer = await api.post('/customers', { name: t(`Haji Rafiq ${tag}`, `حاجی رفیق ${tag}`), phone: `0300${tag}11`, city: t('Karachi', 'کراچی'), openingBalance: 45000 });
    await api.post('/stock/items', { name: t(`Ladies jackets ${tag}`, `لیڈیز جیکٹ ${tag}`), unit: 'BALE', quantity: 6, totalCost: 150000, salePrice: 32000 });

    // Sign-in, as the munshi sees it.
    await page.addInitScript((l) => localStorage.setItem('thriftos.lang', l), lang);
    await page.goto('/auth/login');
    await page.getByRole('tab').first().click();
    await page.locator('input[type=tel]').fill('0300 1234567');
    for (const d of '48') await page.locator('.keys').getByRole('button', { name: d, exact: true }).click();
    await shot(page, 'j0-login-munshi', lang);

    await signIn(page, undefined, lang);

    // Journey 1 — container.
    await page.goto('/receive');
    await shot(page, 'j1-receive', lang);
    await page.goto('/receive/container');
    if (await page.getByRole('searchbox').count()) await page.getByRole('searchbox').first().fill(supplier.name);
    await page.locator('.tiles').getByRole('button').filter({ hasText: supplier.name }).click();
    await keypad(page, t('Invoice weight', 'بِل کا وزن'), 18000);
    await page.getByRole('button', { name: 'USD', exact: true }).click();
    await keypad(page, t('Purchase cost', 'خرید کی قیمت'), 14500);
    await keypad(page, t('Dollar rate', 'ڈالر ریٹ'), 280);
    await page.getByRole('button', { name: t('Duty', 'ڈیوٹی'), exact: true }).click();
    await keypad(page, t('Duty', 'ڈیوٹی'), 310000);
    await shot(page, 'j1-container-form', lang);
    await page.locator('.action-bar .btn.primary').click();
    await expect(page.locator('.done')).toBeVisible();
    await shot(page, 'j1-container-saved', lang);

    // Journey 2 — sorting.
    await page.goto('/sort');
    await shot(page, 'j2-sort-lots', lang);
    await page.goto(`/sort/${lotId}`);
    await page.locator('.tiles').getByRole('button').filter({ hasText: 'Shoes' }).click();
    await shot(page, 'j2-sort-keypad', lang);
    await keys(page, 900);
    await shot(page, 'j2-sort-lines', lang);
    await page.locator('.action-bar .btn.primary').click();
    await shot(page, 'j2-sort-close-confirm', lang);
    await page.getByRole('alertdialog').locator('.btn.primary').click();
    await expect(page.locator('.list')).toBeVisible();
    await shot(page, 'j2-sort-yield', lang);

    // Journey 3 — bale.
    await page.goto('/stock/bale');
    await page.locator('.tiles').getByRole('button').filter({ hasText: 'Jeans' }).first().click();
    await keypad(page, t('Bale weight', 'گانٹھ کا وزن'), 45);
    await shot(page, 'j3-make-bale', lang);
    await page.locator('.action-bar .btn.primary').click();
    await expect(page.locator('.done')).toBeVisible();
    await shot(page, 'j3-bale-saved', lang);
    await page.locator('.done a.btn.primary').click();
    await expect(page.locator('.label svg')).toBeVisible();
    await shot(page, 'j3-label-sticker', lang);
    await page.goto('/stock');
    await shot(page, 'j3-stock', lang);

    // Journey 4 — sale.
    await page.goto('/sell/new');
    await pickTile(page, t('Search name or phone', 'نام یا فون تلاش کریں'), customer.name);
    await pickTile(page, t('Search stock', 'مال تلاش کریں'), tag);
    await keypad(page, t('Price', 'ریٹ'), 32000);
    await page.getByRole('button', { name: t('Part paid', 'کچھ ادا'), exact: true }).click();
    await keypad(page, t('Paid now', 'ابھی ادا'), 12000);
    await shot(page, 'j4-sale-form', lang);
    await page.locator('.action-bar .btn.primary').click();
    await expect(page.locator('.done')).toBeVisible();
    await shot(page, 'j4-sale-saved', lang);

    // Journey 5 — ready stock.
    await page.goto('/receive/ready');
    await page.getByLabel(t('What is it?', 'کیا مال ہے؟')).fill(t('Mixed tops', 'مکس ٹاپس'));
    await keypad(page, t('How many', 'کتنا'), 10);
    await keypad(page, t('Total cost', 'کل لاگت'), 210000);
    await shot(page, 'j5-ready-stock', lang);

    // Journey 6 — khata.
    await page.goto('/khata');
    await shot(page, 'j6-khata', lang);
    await page.goto(`/khata/${customer.id}`);
    await page.locator('.action-bar .btn.primary').click();
    await keypad(page, t('Amount', 'رقم'), 25000);
    await page.getByRole('button', { name: t('JazzCash', 'جاز کیش'), exact: true }).click();
    await shot(page, 'j6-payment', lang);

    // Journey 7 — owner home and the lists behind it.
    await page.goto('/home');
    await expect(page.locator('a.stat').first()).toBeVisible();
    await shot(page, 'j7-owner-home', lang);
    await page.goto('/home/containers');
    await expect(page.locator('.list').first()).toBeVisible();
    await shot(page, 'j7-containers', lang);
    await page.goto('/home/today');
    await shot(page, 'j7-today', lang);
  });
}

for (const lang of ['en', 'ur'] as const) {
  test(`journey 8 setup wizard screenshots (${lang})`, async ({ page, request }) => {
    const tag = Date.now().toString().slice(-6);
    const admin = await apiAs(request, { email: 'superadmin@thriftos.com', password: 'SuperAdmin@123' });
    const email = `shot${tag}@new.test`;
    await admin.post('/superadmin/tenants', { name: `New ${tag}`, companyCode: `S${tag}`, adminEmail: email, adminName: 'Owner', adminPassword: 'owner-pass-1' });
    await page.addInitScript((l) => localStorage.setItem('thriftos.lang', l), lang);
    await page.goto('/auth/login');
    await page.locator('.who .chip').nth(1).click();
    await page.fill('input[type=email]', email);
    await page.fill('input[type=password]', 'owner-pass-1');
    await page.locator('button[type=submit]').click();
    await page.waitForURL('**/setup');
    await page.locator('input[name=biz]').fill(lang === 'en' ? 'Al-Madina Traders' : 'المدینہ ٹریڈرز');
    await shot(page, 'j8-setup-1-business', lang);
    await page.locator('.action-bar .btn.primary').click();
    await page.locator('.option').nth(2).click();
    await shot(page, 'j8-setup-2-sort', lang);
    await page.locator('.action-bar .btn.primary').click();
    await shot(page, 'j8-setup-3-categories', lang);
    await page.locator('.action-bar .btn.primary').click();
    await shot(page, 'j8-setup-4-grades', lang);
    await page.locator('.action-bar .btn.primary').click();
    await shot(page, 'j8-setup-5-munshi', lang);
  });
}

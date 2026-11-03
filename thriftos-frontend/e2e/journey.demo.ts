import { APIRequestContext, Page, expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { keypad, keys, loose, pickTile } from './floor';
import { DEMO, apiAs, signIn } from './helpers';

type Lang = 'en' | 'ur';
type Dict = { [k: string]: string | Dict };
const dicts: Record<Lang, Dict> = {
  en: JSON.parse(fs.readFileSync(path.resolve(__dirname, '../public/i18n/en.json'), 'utf8')),
  ur: JSON.parse(fs.readFileSync(path.resolve(__dirname, '../public/i18n/ur.json'), 'utf8')),
};
/** The screen's own words in that language (from the dictionaries the app uses). */
const word = (lang: Lang, key: string, params: Record<string, string | number> = {}) => {
  const v = key.split('.').reduce<string | Dict | undefined>((d, k) => (d && typeof d === 'object' ? d[k] : undefined), dicts[lang]);
  if (typeof v !== 'string') throw new Error(`no ${lang} word for ${key}`);
  return v.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ''));
};
const rs = (n: number) => `Rs ${n.toLocaleString('en-PK')}`;

async function home(request: APIRequestContext) {
  return (await apiAs(request, DEMO)).get('/home');
}

async function sortTile(page: Page, name: string, kg: number) {
  await page.getByRole('listitem').filter({ hasText: name }).first().click();
  await keys(page, kg);
  await expect(page.getByRole('status').filter({ hasText: name })).toBeVisible();
}

/**
 * Task 4.3: the 5-minute demo on the demo database, on a 360×740 phone, through the screens only:
 * container with charges → sort into categories → grade → 2 bales and the QR label → sell one on udhaar and
 * open the WhatsApp bill link → payment → the owner home shows the new profit, udhaar and stock.
 */
for (const lang of ['ur', 'en'] as const) {
  test(`demo journey (${lang})`, async ({ page, context, request }) => {
    const w = (key: string, params?: Record<string, string | number>) => word(lang, key, params);
    const before = await home(request);
    await context.route('https://wa.me/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>WhatsApp</p>' }));
    await signIn(page, DEMO, lang);
    await expect(page.locator('html')).toHaveAttribute('dir', lang === 'ur' ? 'rtl' : 'ltr');

    // 1. Container with charges.
    await page.goto('/receive/container');
    await pickTile(page, w('common.search'), 'Global Textile Recyclers');
    await keypad(page, w('receive.invoiceKg'), 2000);
    await page.getByRole('button', { name: 'USD', exact: true }).click();
    await keypad(page, w('receive.purchaseCost'), 1300);
    await keypad(page, w('receive.fxRate'), 280);
    await page.getByRole('button', { name: w('receive.charge.DUTY'), exact: true }).click();
    await keypad(page, w('receive.charge.DUTY'), 48000);
    await page.getByRole('button', { name: w('receive.charge.CLEARING'), exact: true }).click();
    await keypad(page, w('receive.charge.CLEARING'), 30000);
    // (1,300 × 280 + 48,000 + 30,000) / 2,000 kg = Rs 221
    await expect(page.locator('.action-bar')).toContainText(loose('Rs 221'));
    await page.locator('.action-bar .btn.primary').click();
    await expect(page.locator('.done')).toContainText(loose(w('receive.landedPerKg', { rs: rs(221) })));

    // 2. Chhantai into categories, close with a remainder → yield.
    await page.locator('.done').getByRole('link', { name: w('nav.sort') }).click();
    await sortTile(page, 'Jeans', 900);
    await sortTile(page, 'T-Shirts', 700);
    await sortTile(page, 'Jackets', 250);
    await page.locator('.action-bar .btn.primary').click();
    await page.getByRole('alertdialog').locator('.btn.primary').click();
    await expect(page.getByRole('heading', { name: w('sort.closed') })).toBeVisible();
    await expect(page.locator('li', { hasText: 'Jeans' })).toContainText('45%');

    // Grading the Jeans of this container into A / B / C.
    await page.goto('/sort');
    await page.getByRole('link', { name: /Jeans/ }).first().click();
    await sortTile(page, 'A', 200);
    await sortTile(page, 'B', 500);
    await sortTile(page, 'C', 200);
    await page.locator('.action-bar .btn.primary').click();
    await expect(page.getByRole('heading', { name: w('sort.closed') })).toBeVisible();

    // 3. Two bales; the first one's QR label is opened from "Print label".
    const baleCodes: string[] = [];
    for (const [kind, kg] of [['Jeans · A', 50], ['Jeans · B', 55]] as const) {
      await page.goto('/stock/bale');
      await page.getByRole('listitem').filter({ hasText: kind }).first().click();
      await keypad(page, w('stock.baleWeight'), kg);
      await page.locator('.action-bar .btn.primary').click();
      await expect(page.locator('.done')).toBeVisible();
      baleCodes.push((await page.locator('.done h2').innerText()).match(/B-\d{4}/)![0]);
      if (baleCodes.length === 1) {
        await page.locator('.done').getByRole('link', { name: w('stock.printLabel') }).click();
        await expect(page.locator('.label').first()).toContainText(baleCodes[0]);
        await expect(page.locator('.label svg').first()).toBeVisible();
      }
    }

    // 4. Sell the first bale on udhaar to Haji Rafiq, and open the bill link from the WhatsApp message.
    await page.goto('/sell/new');
    await pickTile(page, w('sell.searchCustomer'), 'Haji Rafiq & Sons');
    await pickTile(page, w('sell.searchStock'), baleCodes[0]);
    await keypad(page, w('common.price'), 45000);
    await page.getByRole('button', { name: w('sell.mode.CREDIT'), exact: true }).click();
    await page.locator('.action-bar .btn.primary').click();
    const [popup] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: w('sell.share') }).click()]);
    await popup.waitForURL(/wa\.me/);
    const text = new URL(popup.url()).searchParams.get('text') ?? '';
    const billUrl = text.match(/https?:\/\/\S+\/bill\/\S+/)![0];
    await popup.close();
    const bill = await context.newPage();
    await bill.goto(billUrl);
    await expect(bill.locator('dl')).toContainText(loose(rs(45000)));
    await bill.close();

    // 5. Payment received: Rs 20,000 by JazzCash.
    await page.goto('/khata');
    await page.getByPlaceholder(w('khata.search')).fill('Haji Rafiq');
    await page.getByRole('link', { name: /Haji Rafiq/ }).click();
    await page.locator('.action-bar .btn.primary').click();
    await keypad(page, w('khata.amount'), 20000);
    await page.getByRole('button', { name: w('method.JAZZCASH'), exact: true }).click();
    await page.locator('.action-bar .btn.primary').click();
    await expect(page.getByRole('status').filter({ hasText: loose(rs(20000)) })).toBeVisible();

    // 6. Owner home: udhaar up by 25,000, today's sales up by 45,000, one more bale ready, profit changed.
    const after = await home(request);
    expect(Number(after.udhaar.owed) - Number(before.udhaar.owed)).toBe(25000);
    expect(after.today.sales - before.today.sales).toBe(1);
    expect(Number(after.today.total) - Number(before.today.total)).toBe(45000);
    expect(Number(after.stockReady.bales) - Number(before.stockReady.bales)).toBe(1);
    // The bale takes its cost from the oldest stock first (FIFO), so the profit lands on an older container — the
    // "last 5 containers" average only moves when that container is in the window. Today's profit always moves.
    const profit = Number(after.today.profit) - Number(before.today.profit);
    expect(profit).toBeGreaterThan(0);
    expect(profit).toBeLessThan(45000);
    await page.goto('/home');
    const card = (key: string) => page.locator('a.stat').filter({ hasText: w(key) });
    await expect(card('home.udhaar')).toContainText(loose(rs(Number(after.udhaar.owed))));
    await expect(card('home.todaySales')).toContainText(loose(rs(Number(after.today.total))));
    await expect(card('home.todaySales')).toContainText(loose(rs(Number(after.today.profit))));
    await expect(card('home.stockReady')).toContainText(`${after.stockReady.bales} `);
    await expect(card('home.profitPerContainer')).toContainText(loose(rs(Number(after.profitPerContainer.average))));
  });
}

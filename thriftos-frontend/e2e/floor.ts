import { Page, expect } from '@playwright/test';

/** Types a number on the big keypad: tap the field, tap the keys, OK. */
export async function keypad(page: Page, label: string | RegExp, value: string | number): Promise<void> {
  await page.locator('tos-number .field-btn').filter({ has: page.locator('.label', { hasText: label }) }).first().click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  for (const ch of String(value)) await sheet.getByRole('button', { name: ch, exact: true }).click();
  await sheet.locator('.ok').click();
  await expect(sheet).toBeHidden();
}

/** Sorting (v2 6.6): tap a category + grade tile, enter loose kg, Save. */
export async function sortLoose(page: Page, tile: string | RegExp, kg: string | number): Promise<void> {
  await page.locator('.tiles').getByRole('button').filter({ hasText: tile }).first().click();
  const entry = page.locator('.entry');
  // Loose kg opens the keypad by itself (straight away when the kind has no bale weight).
  await page.getByRole('dialog').waitFor({ timeout: 1500 }).catch(() => undefined);
  if (!(await page.getByRole('dialog').isVisible())) await entry.locator('.seg').getByRole('button', { name: 'Loose kg' }).click();
  await keys(page, kg);
  await entry.getByRole('button', { name: 'Save' }).click();
  await expect(entry).toBeHidden();
}

/** Sorting (v2 6.6): tap a tile, enter bales (count × kg per bale), Save. */
export async function sortBales(page: Page, tile: string | RegExp, bales: number, kgPerBale: number): Promise<void> {
  await page.locator('.tiles').getByRole('button').filter({ hasText: tile }).first().click();
  const entry = page.locator('.entry');
  // A kind without a bale weight opens the loose-kg keypad first: close it to switch to bales.
  await page.getByRole('dialog').waitFor({ timeout: 1500 }).catch(() => undefined);
  if (await page.getByRole('dialog').isVisible()) await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await entry.locator('.seg').getByRole('button', { name: 'Bales' }).click();
  for (let i = 1; i < bales; i++) await entry.getByRole('button', { name: 'One bale more' }).click();
  await keypad(page, /^Kg per bale/, kgPerBale);
  await entry.getByRole('button', { name: 'Save' }).click();
  await expect(entry).toBeHidden();
}

/** Keypad already open (a sort tile opens it directly): tap the keys, OK. */
export async function keys(page: Page, value: string | number): Promise<void> {
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  for (const ch of String(value)) await sheet.getByRole('button', { name: ch, exact: true }).click();
  await sheet.locator('.ok').click();
  await expect(sheet).toBeHidden();
}

/**
 * The UI rules that can be measured (docs/v1/05): nothing wider than the phone, one primary button in the
 * bottom bar (thumb zone, ≥ 52 px tall), and every visible button or link at least 44 px tall.
 */
export async function checkFloorScreen(page: Page, where: string): Promise<void> {
  await expect(page.locator('.action-bar .btn.primary')).toBeVisible();
  const report = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const wide = document.documentElement.scrollWidth > vw + 1;
    const bar = document.querySelector('.action-bar');
    const primaries = bar ? [...bar.querySelectorAll('.btn.primary')].map((b) => b.getBoundingClientRect()) : [];
    const small = [...document.querySelectorAll<HTMLElement>('main button, main a.btn, main .tile, main .chip')]
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({ text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 30), h: el.getBoundingClientRect().height }))
      .filter((b) => b.h > 0 && b.h < 44);
    return { wide, vw, scrollWidth: document.documentElement.scrollWidth, primaries: primaries.map((r) => ({ top: r.top, h: r.height, vh })), small };
  });
  expect(report.wide, `${where}: page is ${report.scrollWidth}px wide on a ${report.vw}px screen`).toBe(false);
  expect(report.primaries.length, `${where}: one primary button in the bottom bar`).toBe(1);
  expect(report.primaries[0].h, `${where}: primary button height`).toBeGreaterThanOrEqual(52);
  expect(report.primaries[0].top, `${where}: primary button in the thumb zone`).toBeGreaterThan(report.primaries[0].vh * 0.7);
  expect(report.small, `${where}: touch targets under 44px`).toEqual([]);
}

/** Matches text that contains left-to-right isolates around numbers ("Rs 300", "12.0 kg") as if they were not there. */
export function loose(text: string): RegExp {
  const pattern = [...text]
    .map((ch) => (ch === ' ' ? '[\\s\\u2066\\u2069]*' : ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\u2066\\u2069]*'))
    .join('');
  return new RegExp(`[\\u2066\\u2069]*${pattern}`);
}

/**
 * Taps a tile. The search box only appears with more than 8 tiles (docs/v1/05), so search when it is
 * there, then tap the tile either way.
 */
export async function pickTile(page: Page, searchPlaceholder: string, text: string): Promise<void> {
  await page.locator('tos-tiles .tile').first().waitFor();
  const search = page.getByPlaceholder(searchPlaceholder);
  // A search box shows its words only once the language's dictionary has loaded (before that it reads
  // "sell.searchCustomer", or the other language while the app switches), so give it a moment.
  if (await page.locator('tos-tiles input[type=search]').count()) {
    await search.waitFor({ timeout: 5000 }).catch(() => undefined);
  }
  if (await search.count()) await search.fill(text);
  await page.locator('.tiles').getByRole('button').filter({ hasText: text }).first().click();
}

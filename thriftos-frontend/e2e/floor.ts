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
  const search = page.getByPlaceholder(searchPlaceholder);
  if (await search.count()) await search.fill(text);
  await page.getByRole('listitem').filter({ hasText: text }).first().click();
}

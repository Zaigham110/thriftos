import { expect, test } from '@playwright/test';
import { apiAs, signIn } from './helpers';

test('mix two waiting lots, see what the mix was made from, and take it apart again (owner, 2026-11-17)', async ({ page, request }) => {
  const api = await apiAs(request);
  const one = await api.post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 60, purchaseCost: 6000 });
  const two = await api.post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 40, purchaseCost: 8000 });

  await page.setViewportSize({ width: 1280, height: 860 });
  await signIn(page);
  await page.goto('/sort/records');
  await page.getByRole('link', { name: 'Mix lots' }).click();
  await expect(page).toHaveURL(/\/sort\/mix$/);
  await expect(page.getByRole('heading', { name: 'Mix lots' })).toBeVisible();
  const make = page.getByRole('button', { name: 'Mix and sort together' });
  await expect(make).toBeDisabled();
  const rows = page.getByRole('list', { name: 'Lots waiting to be sorted' });
  await rows.locator('li').filter({ hasText: one.ragCode }).getByRole('checkbox').check();
  await expect(make).toBeDisabled();
  await rows.locator('li').filter({ hasText: two.ragCode }).getByRole('checkbox').check();
  // What the mix will be, and each lot's share by weight.
  await expect(page.locator('.sum').getByText(/2 lots, .*100\.0 kg.* together/)).toBeVisible();
  await expect(rows.locator('li').filter({ hasText: one.ragCode })).toContainText('60.0%');
  await expect(rows.locator('li').filter({ hasText: two.ragCode })).toContainText('40.0%');
  await make.click();

  // The mix is a lot of its own, made from the two.
  await expect(page).toHaveURL(/\/sort\/records\/[^/]+$/);
  await expect(page.getByRole('heading', { name: /^MIX-\d{4}-\d{3}/ })).toBeVisible();
  const from = page.getByRole('region', { name: 'Made from these lots' });
  await expect(from).toContainText(one.ragCode);
  await expect(from).toContainText(two.ragCode);
  // A lot that went in says where, and cannot be sorted on its own.
  await from.getByRole('link', { name: one.ragCode }).click();
  await expect(page.getByText(/went into the mix/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Start sorting/ })).toHaveCount(0);
  await page.getByRole('link', { name: /^MIX-/ }).click();

  // Nobody has started sorting it: it can be taken apart, and the lots wait again.
  await page.getByRole('button', { name: 'Take the mix apart' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'The lots are apart again.' })).toBeVisible();
  await page.goto('/sort/mix');
  await expect(page.getByRole('list', { name: 'Lots waiting to be sorted' }).locator('li').filter({ hasText: one.ragCode })).toBeVisible();
});

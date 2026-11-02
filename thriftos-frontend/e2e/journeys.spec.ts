import { expect, test } from '@playwright/test';
import { checkFloorScreen, keypad, keys, loose } from './floor';
import { apiAs, signIn } from './helpers';

/**
 * Task 3.4: journeys 1–6 on a 360px phone, through the screens only — container with charges → sort with
 * Undo → close with yield → grade → bale → sale on udhaar → payment — checking the UI rules on every screen.
 */
test('journeys 1–6 on a 360px phone', async ({ page, request }) => {
  const api = await apiAs(request);
  const tag = Date.now().toString().slice(-6);
  await signIn(page);

  // Journey 1 — container arrives.
  await page.getByRole('link', { name: 'Maal aya' }).click();
  await page.getByRole('link', { name: /Container/ }).click();
  await checkFloorScreen(page, 'receive container');
  await page.getByRole('listitem').filter({ hasText: 'New supplier' }).click();
  await page.getByLabel('Supplier name').fill(`Lahore Imports ${tag}`);
  await page.getByRole('button', { name: 'USA', exact: true }).first().click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('listitem').filter({ hasText: `Lahore Imports ${tag}` })).toHaveAttribute('aria-pressed', 'true');
  await keypad(page, /^Invoice weight/, 1000);
  await page.getByRole('button', { name: 'USD', exact: true }).click();
  await keypad(page, /^Purchase cost/, 1000);
  await keypad(page, /^Dollar rate/, 280);
  await page.getByRole('button', { name: 'Duty', exact: true }).click();
  await keypad(page, /^Duty/, 20000);
  // (1,000 × 280 + 20,000) / 1,000 kg
  await expect(page.locator('.action-bar')).toContainText(loose('Rs 300'));
  await page.getByRole('button', { name: 'Save container' }).click();
  await expect(page.getByText('Ready to sort').first()).toBeVisible();
  await expect(page.getByText(loose('Landed cost Rs 300 per kg'))).toBeVisible();

  // Journey 2 — sorting: tile → kg → saved; Undo; close with a remainder.
  await page.locator('.done').getByRole('link', { name: 'Chhantai' }).click();
  await expect(page).toHaveURL(/\/sort\/[a-z0-9]+$/);
  await checkFloorScreen(page, 'sort');
  await page.getByRole('listitem').filter({ hasText: 'Jeans' }).click();
  await keys(page, 600);
  await expect(page.getByRole('status').filter({ hasText: loose('600.0 kg Jeans added') })).toBeVisible();
  await page.getByRole('listitem').filter({ hasText: 'T-Shirts' }).click();
  await keys(page, 350);
  // Undo takes back the line its toast names.
  await page.getByRole('status').filter({ hasText: loose('350.0 kg T-Shirts added') }).getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.totals')).toContainText(loose('600.0 kg'));
  await page.getByRole('listitem').filter({ hasText: 'T-Shirts' }).click();
  await keys(page, 300);
  await expect(page.locator('.totals')).toContainText(loose('900.0 kg'));
  await expect(page.locator('.totals')).toContainText(loose('100.0 kg'));
  // More than is left is refused on the keypad itself.
  await page.getByRole('listitem').filter({ hasText: 'Jeans' }).click();
  for (const ch of '101') await page.getByRole('dialog').getByRole('button', { name: ch, exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText(loose('Weight is more than the lot left (100.0 kg)'));
  await expect(page.getByRole('dialog').locator('.ok')).toBeDisabled();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Close lot' }).click();
  await expect(page.getByText(loose('100.0 kg not sorted goes to waste. Close the lot?'))).toBeVisible();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Close lot' }).click();
  await expect(page.getByText('Lot closed')).toBeVisible();
  // Rs 300,000 over 900 kg of outputs.
  await expect(page.locator('li', { hasText: 'Jeans' })).toContainText('60%');
  await expect(page.locator('li', { hasText: 'Jeans' })).toContainText(loose('Rs 333.33/kg'));
  await expect(page.locator('li', { hasText: 'Waste / Katran' }).or(page.locator('li', { hasText: 'Waste/Katran' }))).toContainText('10%');

  // Grading (the demo tenant sorts in 2 stages).
  await page.getByRole('link', { name: 'Done' }).click();
  await page.getByRole('link', { name: /Jeans/ }).first().click();
  await page.getByRole('listitem').filter({ hasText: 'Grade A' }).first().click();
  await keys(page, 400);
  await page.getByRole('listitem').filter({ hasText: 'Grade B' }).first().click();
  await keys(page, 200);
  await page.getByRole('button', { name: 'Close lot' }).click();
  await expect(page.getByText('Lot closed')).toBeVisible();

  // Journey 3 — make a bale from Jeans · A.
  await page.goto('/stock/bale');
  await checkFloorScreen(page, 'make bale');
  await page.getByRole('listitem').filter({ hasText: 'Jeans · Grade A' }).click();
  await keypad(page, /^Bale weight/, 100);
  await page.getByRole('button', { name: 'Save bale' }).click();
  await expect(page.getByRole('link', { name: 'Print label' })).toBeVisible();
  const baleCode = (await page.locator('.done h2').innerText()).split(' ')[0];

  // Journey 4 — sell the bale on udhaar to a new customer.
  await page.getByRole('link', { name: 'Becho' }).click();
  await checkFloorScreen(page, 'sell home');
  await page.getByRole('link', { name: 'New sale' }).click();
  await checkFloorScreen(page, 'new sale');
  await page.getByRole('listitem').filter({ hasText: 'New customer' }).click();
  await page.getByLabel('Name', { exact: true }).fill(`Haji Rafiq ${tag}`);
  await page.getByLabel('WhatsApp number').fill(`0300${tag}9`);
  await page.getByRole('button', { name: 'Add customer' }).click();
  await page.getByPlaceholder('Search stock').fill(baleCode);
  await page.getByRole('listitem').filter({ hasText: 'Jeans Grade A' }).first().click();
  await keypad(page, /^Price/, 36000);
  await page.getByRole('button', { name: 'Udhaar', exact: true }).click();
  await expect(page.locator('.action-bar')).toContainText(loose('Rs 36,000'));
  await page.getByRole('button', { name: 'Save sale' }).click();
  await expect(page.getByRole('button', { name: 'Share bill on WhatsApp' })).toBeVisible();

  // Journey 6 — khata: the customer owes 36,000; JazzCash payment of 10,000.
  await page.getByRole('link', { name: 'Khata' }).click();
  await checkFloorScreen(page, 'khata');
  await page.getByRole('link', { name: new RegExp(`Haji Rafiq ${tag}`) }).click();
  await expect(page.locator('.balance')).toContainText(loose('Rs 36,000'));
  await checkFloorScreen(page, 'khata customer');
  await page.getByRole('button', { name: 'Payment received' }).click();
  await keypad(page, /^Amount/, 10000);
  await page.getByRole('button', { name: 'JazzCash', exact: true }).click();
  await page.getByRole('button', { name: 'Save payment' }).click();
  await expect(page.getByRole('status').filter({ hasText: loose('Rs 10,000 received. Balance now Rs 26,000.') })).toBeVisible();

  // The server agrees.
  const khata = await api.get('/khata?search=' + encodeURIComponent(`Haji Rafiq ${tag}`));
  expect(khata.customers[0].balance).toBe('26000');
});

test('journey 5: a trader receives ready stock and opens a bale into pieces', async ({ page }) => {
  const tag = Date.now().toString().slice(-6);
  await signIn(page);
  await page.goto('/receive/ready');
  await checkFloorScreen(page, 'ready stock');
  await page.getByLabel('What is it?').fill(`Ladies jackets ${tag}`);
  await page.getByRole('button', { name: 'bales', exact: true }).click();
  await keypad(page, /^How many/, 4);
  await keypad(page, /^Total cost/, 100000);
  await expect(page.locator('.action-bar')).toContainText(loose('Rs 25,000'));
  await page.getByRole('button', { name: 'Save stock' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved. Ready to sell.' })).toBeVisible();

  await page.getByRole('link', { name: new RegExp(`Ladies jackets ${tag}`) }).click();
  await keypad(page, /^Price/, 300);
  await keypad(page, /^Pieces/, 30);
  await page.getByRole('button', { name: 'Price', exact: true }).last().click();
  await page.getByRole('button', { name: /^Price/ }).nth(1).click();
  await page.getByRole('dialog').getByRole('button', { name: '8', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '0', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '0', exact: true }).click();
  await page.getByRole('dialog').locator('.ok').click();
  await page.getByRole('button', { name: /^Pieces/ }).nth(1).click();
  await page.getByRole('dialog').getByRole('button', { name: '9', exact: true }).click();
  await page.getByRole('dialog').locator('.ok').click();
  await expect(page.locator('.action-bar')).toContainText('39');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/receive\/ready$/);
});

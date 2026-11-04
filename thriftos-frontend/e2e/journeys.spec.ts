import { expect, test } from '@playwright/test';
import { baleCountAndWeight, checkFloorScreen, keypad, loose, pickTile, sortBales, sortLoose } from './floor';
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
  await page.locator('.tiles').getByRole('button').filter({ hasText: 'New supplier' }).click();
  await page.getByLabel('Supplier name').fill(`Lahore Imports ${tag}`);
  await page.getByRole('button', { name: 'USA', exact: true }).first().click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.tiles').getByRole('button').filter({ hasText: `Lahore Imports ${tag}` })).toHaveAttribute('aria-pressed', 'true');
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

  // Journey 2 — sorting, grading and baling in one step (v2 6.6): tile → bales or loose kg; Undo; close books kat.
  await page.locator('.done').getByRole('link', { name: 'Chhantai' }).click();
  await expect(page).toHaveURL(/\/sort\/[a-z0-9]+$/);
  await checkFloorScreen(page, 'sort');
  // Tiles are categories; the grade is optional and picked in the sheet.
  await sortLoose(page, 'Jeans', 400, 'Grade A');
  await expect(page.getByRole('status').filter({ hasText: loose('400.0 kg Jeans · Grade A added') })).toBeVisible();
  await sortLoose(page, 'T-Shirts', 350, 'Grade B');
  // Undo takes back the line its toast names.
  await page.getByRole('status').filter({ hasText: loose('350.0 kg T-Shirts · Grade B added') }).getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.totals')).toContainText(loose('400.0 kg'));
  // Two bales of 100 kg straight into stock, with stickers to print.
  await sortBales(page, 'Jeans', 2, 100, 'Grade B');
  await expect(page.getByRole('link', { name: /Print stickers for the 2 bales of Jeans · Grade B/ })).toBeVisible();
  await expect(page.locator('.today')).toContainText(loose('Today: 2 bales · 600.0 kg'));
  await sortLoose(page, 'T-Shirts', 300, 'Grade A');
  await expect(page.locator('.totals')).toContainText(loose('900.0 kg'));
  await expect(page.locator('.totals')).toContainText(loose('100.0 kg'));
  // More than is left is refused on the keypad itself.
  // Jeans opens on bales now (this phone remembers 100 kg a bale): switch to loose kg, which opens the keypad.
  await page.locator('.tiles').getByRole('button').filter({ hasText: 'Jeans' }).click();
  await page.locator('.entry .seg').getByRole('button', { name: 'Loose kg' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  for (const ch of '101') await page.getByRole('dialog').last().getByRole('button', { name: ch, exact: true }).click();
  await expect(page.getByRole('dialog').last()).toContainText(loose('Weight is more than the lot left (100.0 kg)'));
  await expect(page.getByRole('dialog').last().locator('.ok')).toBeDisabled();
  await page.getByRole('dialog').last().getByRole('button', { name: 'Cancel' }).click();
  await page.locator('.entry > .row2').getByRole('button', { name: 'Cancel' }).click();
  // While the gaari is still open: 2 bales of 100 kg from the 400 kg of Jeans · Grade A sorted loose.
  const ready = page.locator('.ready');
  await expect(ready.locator('li', { hasText: 'Jeans · Grade A' })).toContainText(loose('400.0 kg sorted, not baled yet'));
  await ready.locator('li', { hasText: 'Jeans · Grade A' }).getByRole('button', { name: 'Make bales' }).click();
  await baleCountAndWeight(page, page.locator('.entry'), 2, 100);
  await page.locator('.entry').getByRole('button', { name: 'Save bales' }).click();
  await expect(page.getByRole('link', { name: /Print stickers for the 2 bales of Jeans · Grade A/ })).toBeVisible();
  await expect(ready.locator('li', { hasText: 'Jeans · Grade A' })).toContainText(loose('200.0 kg sorted, not baled yet'));
  await expect(page.locator('.today')).toContainText(loose('Today: 4 bales'));
  await page.getByRole('button', { name: 'Close lot' }).click();
  await expect(page.getByText(loose('Is this gaari finished? The 100.0 kg left becomes kat and goes into stock.'))).toBeVisible();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Close lot' }).click();
  await expect(page.getByText('Lot closed')).toBeVisible();
  // Rs 300,000 over 900 kg of outputs.
  await expect(page.locator('li', { hasText: 'Jeans · Grade A' })).toContainText('40%');
  await expect(page.locator('li', { hasText: 'Jeans · Grade A' })).toContainText(loose('Rs 333.33/kg'));
  await expect(page.locator('li', { hasText: 'Jeans · Grade B' })).toContainText('2 bales');
  await expect(page.locator('li', { hasText: /^Kat/ })).toContainText('10%');
  await expect(page.getByText(loose('Kat 100.0 kg is in stock'))).toBeVisible();
  await page.getByRole('button', { name: 'Throw away kat' }).click();
  await expect(page.getByText('Kat is sold or thrown away.')).toBeVisible();
  await page.getByRole('link', { name: 'Done' }).click();

  // Journey 3 — make a bale from Jeans · A.
  await page.goto('/stock/bale');
  await checkFloorScreen(page, 'make bale');
  await page.locator('.tiles').getByRole('button').filter({ hasText: 'Jeans · Grade A' }).click();
  await keypad(page, /^Bale weight/, 100);
  await page.getByRole('button', { name: 'Save bale' }).click();
  await expect(page.getByRole('link', { name: 'Print label' })).toBeVisible();
  const baleCode = (await page.locator('.done h2').innerText()).split(' ')[0];

  // Journey 4 — sell the bale on udhaar to a new customer.
  await page.getByRole('link', { name: 'Becho' }).click();
  await checkFloorScreen(page, 'sell home');
  await page.getByRole('link', { name: 'New sale' }).click();
  await checkFloorScreen(page, 'new sale');
  await page.locator('.tiles').getByRole('button').filter({ hasText: 'New customer' }).click();
  await page.getByLabel('Name', { exact: true }).fill(`Haji Rafiq ${tag}`);
  await page.getByLabel('WhatsApp number').fill(`0300${tag}9`);
  await page.getByRole('button', { name: 'Add customer' }).click();
  await pickTile(page, 'Search stock', baleCode);
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
  // A second price tier: Rs 800 × 9 pieces (fields 3 and 4 on the screen).
  await page.locator('button.btn').filter({ hasText: 'Price' }).click();
  const fields = page.locator('tos-number .field-btn');
  await expect(fields).toHaveCount(4);
  for (const [i, value] of [[2, '800'], [3, '9']] as const) {
    await fields.nth(i).click();
    for (const ch of value) await page.getByRole('dialog').getByRole('button', { name: ch, exact: true }).click();
    await page.getByRole('dialog').locator('.ok').click();
    await expect(page.getByRole('dialog')).toBeHidden();
  }
  await expect(page.locator('.action-bar')).toContainText('39');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/receive\/ready$/);
});

test('journey 7: the owner home shows three numbers and today, and each taps through to its list', async ({ page, request }) => {
  const api = await apiAs(request);
  const numbers = await api.get('/home');
  await signIn(page);
  const card = (name: string) => page.locator('a.stat').filter({ hasText: name });
  await expect(card('Profit per container')).toBeVisible();
  await expect(page.locator('a.stat')).toHaveCount(4);
  await expect(card('Udhaar owed')).toContainText(loose(`Rs ${Number(numbers.udhaar.owed).toLocaleString('en-PK')}`));
  await expect(card("Today's sales")).toContainText(`${numbers.today.sales} sales`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);

  await card('Profit per container').click();
  await expect(page).toHaveURL(/\/home\/containers$/);
  await expect(page.getByText('By supplier')).toBeVisible();
  await page.goBack();
  await card('Udhaar owed').click();
  await expect(page).toHaveURL(/\/khata$/);
  await page.goBack();
  await card('Stock ready').click();
  await expect(page).toHaveURL(/\/stock$/);
  await page.goBack();
  await card("Today's sales").click();
  await expect(page).toHaveURL(/\/home\/today$/);
  await expect(page.locator('.list li')).toHaveCount(Math.max(numbers.today.sales, 1));
});

test('a lot received a moment ago, missing from a stale sort queue and without its first summary, still asks before closing', async ({ page, context }) => {
  // The sort queue can come from the phone's cache, made before this lot existed.
  // (context.route also sees the requests the service worker makes.)
  await context.route('**/api/sorting/stage-1/queue*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  // …and on a slow connection the first summary of the lot may not arrive at all.
  await context.route('**/api/sorting/stage-1/summary*', (route) => route.abort());
  const tag = Date.now().toString().slice(-6);
  await signIn(page);
  await page.goto('/receive/container');
  await page.locator('.tiles').getByRole('button').filter({ hasText: 'New supplier' }).click();
  await page.getByLabel('Supplier name').fill(`Stale Queue ${tag}`);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await keypad(page, /^Invoice weight/, 500);
  await keypad(page, /^Purchase cost/, 100000);
  await page.getByRole('button', { name: 'Save container' }).click();
  await page.locator('.done').getByRole('link', { name: 'Chhantai' }).click();

  // The lot's own weight is fetched, so the screen knows what is left.
  await expect(page.locator('.action-bar')).toContainText(loose('500.0 kg'));
  await sortLoose(page, 'Jeans', 400);
  await expect(page.locator('.totals')).toContainText(loose('100.0 kg'));
  await page.getByRole('button', { name: 'Close lot' }).click();
  await expect(page.getByText(loose('Is this gaari finished? The 100.0 kg left becomes kat and goes into stock.'))).toBeVisible();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Close lot' }).click();
  await expect(page.getByText('Lot closed')).toBeVisible();
  await expect(page.locator('li', { hasText: 'Jeans' })).toContainText('80%');
});

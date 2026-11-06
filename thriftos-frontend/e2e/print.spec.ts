import { expect, test } from '@playwright/test';
import { keypad } from './floor';
import { apiAs, signIn } from './helpers';

// v2 6.3: the bill and the payment receipt are drawn for 58 or 80 mm thermal paper; the same picture goes to a
// Bluetooth printer, the print dialog or WhatsApp.

test('a sale bill and a payment receipt open in the print sheet at the paper width', async ({ page, request }) => {
  const api = await apiAs(request);
  const tag = Date.now().toString().slice(-6);
  const customer = await api.post('/customers', { name: `Print Buyer ${tag}`, phone: `0303${tag}1` });
  const item = await api.post('/stock/items', { name: `Print jeans ${tag}`, unit: 'BALE', quantity: 4, totalCost: 100000 });
  const sale = await api.post('/sales', { customerId: customer.id, paymentMode: 'CREDIT', lines: [{ inventoryItemId: item.id, quantity: 2, unitPrice: 30000 }] });

  await signIn(page);
  await page.evaluate(() => localStorage.setItem('thriftos.paper', '58'));
  await page.goto(`/sell/records/${sale.id}`);
  await page.getByRole('button', { name: 'Print', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Print bill' });
  await expect(sheet).toBeVisible();
  const preview = sheet.locator('.previews img');
  await expect.poll(() => preview.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(384);
  await sheet.getByRole('button', { name: '80 mm' }).click();
  await expect.poll(() => preview.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(576);
  await expect(sheet.getByRole('button', { name: 'Print or save PDF' })).toBeEnabled();
  await sheet.getByRole('button', { name: 'Cancel' }).click();
  await expect(sheet).toBeHidden();

  // The payment receipt from the customer's khata (phone screen).
  await page.goto(`/khata/${customer.id}`);
  await page.getByRole('button', { name: 'Payment received' }).click();
  await keypad(page, /^Amount/, 5000);
  await page.getByRole('button', { name: 'Save payment' }).click();
  await page.getByRole('button', { name: 'Print receipt' }).click();
  const receipt = page.getByRole('dialog', { name: 'Print receipt' });
  await expect.poll(() => receipt.locator('.previews img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(576); // remembered
});

import { expect, test } from '@playwright/test';
import { apiAs, setDemoModule, signIn } from './helpers';

test('Customers has its own place in the menu: list, new customer and the customer page (owner, 2026-11-17)', async ({ page, request }) => {
  const api = await apiAs(request);
  const tag = Date.now().toString().slice(-6);
  await api.post('/customers', { name: `Listed Buyer ${tag}`, phone: `0306${tag}1`, city: 'Multan' });

  await page.setViewportSize({ width: 1280, height: 860 });
  await signIn(page);
  await page.getByRole('navigation').getByRole('link', { name: 'Customers', exact: true }).click();
  await expect(page).toHaveURL(/\/sell\/customers$/);
  await expect(page).toHaveTitle('Customers · Sales · ThriftOS');
  await expect(page.getByRole('heading', { name: 'Customers', exact: true })).toBeVisible();
  await page.getByPlaceholder('Search name, phone or city').fill(`Listed Buyer ${tag}`);
  const row = page.locator('ws-data-grid tbody tr').filter({ hasText: `Listed Buyer ${tag}` });
  await expect(row).toContainText('Multan');

  // A new customer is added from here and lands on their page, under Customers.
  await page.getByRole('link', { name: 'New customer' }).click();
  await expect(page).toHaveURL(/\/sell\/customers\/new$/);
  await page.locator('input[name="name"]').fill(`Added Buyer ${tag}`);
  await page.locator('input[name="phone"]').fill(`0307${tag}2`);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/sell\/customers\/(?!new)[^/]+$/);
  await expect(page.getByRole('heading', { name: `Added Buyer ${tag}` })).toBeVisible();
  // Edit opens under Customers too, and Back returns to the customer.
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page).toHaveURL(/\/sell\/customers\/[^/]+\/edit$/);

  // A business that does not sell on credit still has Customers; the credit actions are not offered.
  const undo = await setDemoModule(request, 'KHATA', false);
  await page.goto('/sell/customers');
  await expect(page.getByRole('heading', { name: 'Customers', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Receivables' })).toHaveCount(0);
  await page.getByPlaceholder('Search name, phone or city').fill(`Listed Buyer ${tag}`);
  await page.locator('ws-data-grid tbody tr').filter({ hasText: `Listed Buyer ${tag}` }).click();
  await expect(page.getByRole('heading', { name: `Listed Buyer ${tag}` })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Statement' })).toHaveCount(0);
  await undo();
});

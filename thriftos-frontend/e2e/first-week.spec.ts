import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

// Requests answered by the service worker skip page.route; block it so the mock is used.
test.use({ serviceWorkers: 'block' });

// v2 6.4: the first-week checklist on Home and the short help screens. The checklist state is mocked so the test does
// not depend on what the demo business has already done; adding a supplier really saves one.

test('the first-week checklist adds a supplier in place, opens each step and its help, and can be hidden', async ({ page }) => {
  let state = { show: true, done: 1, steps: { supplier: false, container: false, sale: true, team: false } };
  let hidden = false;
  await page.route('**/api/home/first-week', (route) => route.fulfill({ json: state }));
  await page.route('**/api/home/first-week/hide', (route) => {
    hidden = true;
    return route.fulfill({ json: { show: false } });
  });

  await signIn(page);
  await page.goto('/home');
  const card = page.getByRole('region', { name: 'Your first week' });
  await expect(card).toBeVisible();
  await expect(card.getByText('1 of 4 done')).toBeVisible();
  await expect(card.getByText('Make your first sale')).toBeVisible();

  // Supplier: name and country right in the card.
  await card.getByRole('button', { name: /Add your supplier/ }).click();
  await card.getByLabel('Supplier name').fill(`First Week Rags ${Date.now().toString().slice(-6)}`);
  await card.getByRole('button', { name: 'Korea' }).click();
  state = { ...state, done: 2, steps: { ...state.steps, supplier: true } };
  const saved = page.waitForResponse((r) => r.url().endsWith('/api/procurement/vendors') && r.request().method() === 'POST');
  await card.getByRole('button', { name: 'Save' }).click();
  expect((await saved).status()).toBe(201);
  await expect(card.getByText('2 of 4 done')).toBeVisible();

  // Each step is one tap to its screen; "?" opens the help for it.
  await card.getByRole('button', { name: /Receive your first container/ }).click();
  await expect(page).toHaveURL(/\/receive\/container$/);
  await page.goto('/home');
  await card.getByRole('link', { name: 'How? Add your munshi' }).click();
  await expect(page).toHaveURL(/\/help\/team$/);
  await expect(page.getByRole('heading', { name: 'Add your munshi' })).toBeVisible();
  await expect(page.locator('.steps li')).toHaveCount(4);
  await page.getByRole('link', { name: 'Open Team' }).click();
  await expect(page).toHaveURL(/\/settings\/team$/);

  await page.goto('/home');
  await card.getByRole('button', { name: 'Hide' }).click();
  await expect(card).toBeHidden();
  expect(hidden).toBe(true);
});

test('help lists the guides, in Urdu too', async ({ page }) => {
  await signIn(page, undefined, 'ur');
  await page.goto('/help');
  await expect(page.getByRole('heading', { name: 'مدد' })).toBeVisible();
  await page.getByRole('link', { name: /بِکری کریں/ }).click();
  await expect(page).toHaveURL(/\/help\/sale$/);
  await expect(page.locator('.steps li')).toHaveCount(4);
  await expect(page.getByRole('link', { name: 'نئی بِکری' })).toHaveAttribute('href', '/sell/new');
});

import { Page, expect, test } from '@playwright/test';
import { apiAs, signIn } from './helpers';

// Enterprise plan E1: from 1024 px the owner works in the workspace (top bar, grouped menu, Ctrl/⌘ K).
// Every owner screen opens inside it without errors; key screens also in Urdu, dark mode and at 1024 px.
// Phones keep the floor layout (covered by the other specs at 360 px).

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

const OWNER_ROUTES = [
  '/home', '/home/containers', '/home/today',
  '/receive', '/receive/container', '/receive/lot', '/receive/ready',
  '/sort', '/stock', '/stock/bale', '/stock/labels', '/stock/items',
  '/sell', '/sell/new', '/sell/records',
  '/khata', '/khata/:customer',
  '/settings', '/settings/team', '/settings/password', '/settings/ui-gallery',
];

async function expectWorkspace(page: Page, path: string): Promise<void> {
  await expect(page.locator('ws-shell .topbar'), path).toBeVisible();
  await expect(page.locator('ws-shell aside.nav'), path).toBeVisible();
  await expect(page.locator('#ws-main'), path).not.toBeEmpty();
  // The page itself never scrolls sideways (wide tables scroll inside their own box).
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${path} is wider than the window`).toBeLessThanOrEqual(1);
}

test('every owner screen opens inside the workspace at 1440 px, without errors', async ({ page, request }) => {
  test.setTimeout(180_000);
  const api = await apiAs(request);
  const customers = (await api.get('/khata')) as { customers?: { id: string }[] } | { id: string }[];
  const list = Array.isArray(customers) ? customers : customers.customers ?? [];
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await signIn(page);
  for (const route of OWNER_ROUTES) {
    const path = route === '/khata/:customer' ? (list[0] ? `/khata/${list[0].id}` : '/khata') : route;
    await page.goto(path);
    await expectWorkspace(page, path);
  }
  expect(errors, errors.join('\n')).toEqual([]);
});

for (const variant of [
  { name: 'Urdu, dark, 1024 px', lang: 'ur' as const, theme: 'dark', width: 1024, height: 768 },
  { name: 'English, light, 1024 px', lang: 'en' as const, theme: 'light', width: 1024, height: 768 },
  { name: 'Urdu, light, 1440 px', lang: 'ur' as const, theme: 'light', width: 1440, height: 900 },
]) {
  test(`key screens in the workspace: ${variant.name}`, async ({ page }) => {
    await page.setViewportSize({ width: variant.width, height: variant.height });
    await page.addInitScript((t) => localStorage.setItem('thriftos.theme', t), variant.theme);
    await signIn(page, undefined, variant.lang);
    for (const path of ['/home', '/sell/records', '/khata', '/settings/ui-gallery']) {
      await page.goto(path);
      await expectWorkspace(page, path);
    }
    await expect(page.locator('html')).toHaveAttribute('data-theme', variant.theme);
    await expect(page.locator('html')).toHaveAttribute('dir', variant.lang === 'ur' ? 'rtl' : 'ltr');
  });
}

test('keyboard: Ctrl+K jumps to a screen, / and ? open the palette and the shortcuts, [ collapses the menu', async ({ page }) => {
  await signIn(page);
  await expect(page.locator('ws-shell')).toBeVisible();

  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: 'Search or jump to…' })).toBeVisible();
  // Fill the palette's own input: keys typed while it is still opening can be lost.
  await page.locator('[role=dialog] input').fill('khata');
  await expect(page.getByRole('option').first()).toContainText('Receivables');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/khata\/records$/);
  await expect(page.locator('.nav-item.active')).toContainText('Receivables');

  await page.locator('#ws-main').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('/');
  await expect(page.getByRole('dialog', { name: 'Search or jump to…' })).toBeVisible();
  await page.locator('[role=dialog] input').fill('new sale');
  await expect(page.getByRole('option').first()).toContainText('New sale');
  await page.keyboard.press('Enter');
  // On the laptop "New sale" opens the keyboard-first sale form.
  await expect(page).toHaveURL(/\/sell\/records\/new$/);

  await page.locator('ws-shell .brand').focus();
  await page.keyboard.press('Shift+?');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeHidden();

  await page.keyboard.press('[');
  await expect(page.locator('ws-shell .ws')).toHaveClass(/collapsed/);
  await page.keyboard.press('[');
  await expect(page.locator('ws-shell .ws')).not.toHaveClass(/collapsed/);
});

test('theme and density are chosen in the workspace and remembered', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Your account' }).click();
  await page.getByRole('menuitem', { name: 'Compact rows' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
});

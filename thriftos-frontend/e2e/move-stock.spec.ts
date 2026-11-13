import { expect, test } from '@playwright/test';
import { apiAs, setDemoModule, signIn } from './helpers';

// Phase 9.3: on the phone, pick a godown, add bales by their code (or QR scan), and move them all in one go.
test('move between godowns: pick a godown, add a bale by its code, move it', async ({ page, request }) => {
  test.setTimeout(120_000);
  const undo = await setDemoModule(request, 'WAREHOUSES', true);
  try {
    const tag = Date.now().toString().slice(-6);
    const api = await apiAs(request);
    const godown = await api.post('/admin/warehouses', { name: `Shop ${tag}`, code: `S${tag}` });
    // A bale made while sorting a small lot.
    const cats = (await api.get('/tenant/categories')) as Array<{ id: string }>;
    const lot = await api.post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 100, purchaseCost: 10000 });
    const s = await api.post('/sorting/stage-1/start', { ragId: lot.id });
    const sessionId = s.session?.id ?? (await api.get(`/sorting/stage-1/summary?ragId=${lot.id}`)).session.id;
    const made = await api.post('/sorting/stage-1/allocate', { sessionId, categoryId: cats[0].id, bales: 1, baleWeightKg: 40 });
    const bale = await api.get(`/stock/bales/${made.baleIds[0]}`);
    const code = bale.unitCode as string;

    await page.setViewportSize({ width: 390, height: 860 });
    await signIn(page);
    await page.goto('/stock');
    await page.getByRole('link', { name: 'Move' }).click();
    await expect(page.getByRole('heading', { name: 'Move between godowns' })).toBeVisible();
    await page.getByRole('radio', { name: `Shop ${tag}` }).click();
    await page.getByLabel('Bale code').fill(code);
    await page.locator('form.typed').getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByRole('list', { name: 'Bales to move' })).toContainText(code);
    // The same code twice is added once.
    await page.getByLabel('Bale code').fill(code);
    await page.locator('form.typed').getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByRole('list', { name: 'Bales to move' }).locator('li.row')).toHaveCount(1);
    await page.getByRole('button', { name: `Move to Shop ${tag}` }).click();
    await expect(page.getByText(`1 moved to Shop ${tag}`)).toBeVisible();
    // A wrong code is refused and cleared, so the next one typed is not added to it.
    await page.getByLabel('Bale code').fill('NO-SUCH');
    await page.locator('form.typed').getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByText('NO-SUCH is not a bale in stock')).toBeVisible();
    await expect(page.getByLabel('Bale code')).toHaveValue('');
    // Pick from stock (a laptop has no camera): the bale is found by its code and moved back.
    const main = ((await api.get('/tenant/warehouses')) as Array<{ id: string; name: string }>).find((g) => g.id !== godown.id)!;
    await page.getByRole('radio', { name: main.name }).click();
    await page.locator('.pick input').fill(code);
    const option = page.getByRole('list', { name: 'Or pick from stock' }).locator('li.row').filter({ hasText: code });
    await option.getByRole('button', { name: 'Add' }).click();
    await page.getByRole('button', { name: `Move to ${main.name}` }).click();
    await expect(page.getByText(`1 moved to ${main.name}`)).toBeVisible();
    const items = await api.get(`/lists/stock?pageSize=200&f=status:ne:SOLD`);
    const row = (items.rows as Array<{ code: string | null; godown: string | null }>).find((r) => r.code === code);
    expect(row?.godown).toBe(main.name);
    expect(godown.id).toBeTruthy();
  } finally {
    await undo();
  }
});

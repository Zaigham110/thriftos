import { expect, test } from '@playwright/test';
import { apiAs, setDemoModule, signIn } from './helpers';

// Phase 9.2: an export sale with its shipment, then the sale's Export pack: packing list, commercial invoice and
// each bale's sorting record, printable.
test('export pack: export sale with shipment, packing list, invoice and bale records', async ({ page, request }) => {
  test.setTimeout(150_000);
  const undo = await setDemoModule(request, 'EXPORT', true);
  try {
    const tag = Date.now().toString().slice(-6);
    const api = await apiAs(request);
    const cats = (await api.get('/tenant/categories')) as Array<{ id: string; name: string }>;
    const lot = await api.post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 100, purchaseCost: 10000 });
    const s = await api.post('/sorting/stage-1/start', { ragId: lot.id });
    const sessionId = s.session?.id ?? (await api.get(`/sorting/stage-1/summary?ragId=${lot.id}`)).session.id;
    const made = await api.post('/sorting/stage-1/allocate', { sessionId, categoryId: cats[0].id, bales: 1, baleWeightKg: 45 });
    const bale = await api.get(`/stock/bales/${made.baleIds[0]}`);
    const code = bale.unitCode as string;
    const buyer = await api.post('/customers', { name: `Dubai Buyer ${tag}`, phone: `0304${tag}1`, city: 'Dubai' });

    await page.setViewportSize({ width: 1280, height: 860 });
    await signIn(page);
    await page.goto('/sell/records/new');
    await page.getByLabel('Customer').fill(buyer.name);
    const itemInput = page.getByLabel('Add item');
    await itemInput.fill(code);
    await itemInput.press('Enter');
    await page.getByLabel('Price', { exact: true }).fill('30000');
    await page.getByLabel('Export sale (shipment abroad)').check();
    await page.getByLabel('Destination country').fill('UAE');
    await page.getByLabel('Bill of lading no.').fill(`BL-${tag}`);
    await page.getByLabel('Price', { exact: true }).press('Control+Enter');
    await expect(page).toHaveURL(/\/sell\/records\/(?!new)[^/]+$/);

    // The sale's Export pack.
    await page.getByRole('tab', { name: 'Export pack' }).click();
    await expect(page.getByLabel('Bill of lading no.')).toHaveValue(`BL-${tag}`);
    await page.getByLabel('Vessel').fill('MSC Aurora');
    await page.getByRole('button', { name: 'Save shipment' }).click();
    await expect(page.getByText('Shipment saved')).toBeVisible();

    await page.getByRole('button', { name: 'Packing list', exact: true }).click();
    const paper = page.getByRole('dialog', { name: 'Packing list' });
    await expect(paper).toContainText(code);
    await expect(paper).toContainText('Vessel: MSC Aurora');
    await expect(paper).toContainText('Total: 1 bales');
    await paper.getByRole('button', { name: 'Close' }).click();

    await page.getByRole('button', { name: 'Commercial invoice' }).click();
    await expect(page.getByRole('dialog', { name: 'Commercial invoice' })).toContainText(buyer.name);
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();

    await page.getByRole('button', { name: 'Bale sorting records' }).click();
    const rec = page.getByRole('dialog', { name: 'Bale sorting records' });
    await expect(rec).toContainText(code);
    await expect(rec).toContainText(`from lot ${lot.ragCode}`);
  } finally {
    await undo();
  }
});

// A sale saved as local can be made an export sale from its Export pack tab; its pack then appears.
test('export pack: a local sale made an export sale afterwards', async ({ page, request }) => {
  test.setTimeout(150_000);
  const undo = await setDemoModule(request, 'EXPORT', true);
  try {
    const tag = Date.now().toString().slice(-6);
    const api = await apiAs(request);
    const cats = (await api.get('/tenant/categories')) as Array<{ id: string; name: string }>;
    const lot = await api.post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 100, purchaseCost: 10000 });
    const s = await api.post('/sorting/stage-1/start', { ragId: lot.id });
    const sessionId = s.session?.id ?? (await api.get(`/sorting/stage-1/summary?ragId=${lot.id}`)).session.id;
    const made = await api.post('/sorting/stage-1/allocate', { sessionId, categoryId: cats[0].id, bales: 1, baleWeightKg: 45 });
    const bale = await api.get(`/stock/bales/${made.baleIds[0]}`);
    const buyer = await api.post('/customers', { name: `Nairobi Buyer ${tag}`, phone: `0305${tag}1`, city: 'Nairobi' });
    const itemId = bale.inventoryItems[0].id as string;
    const sale = await api.post('/sales', { customerId: buyer.id, paymentMode: 'CASH', paymentMethod: 'CASH', lines: [{ inventoryItemId: itemId, unit: 'BALE', quantity: 1, unitPrice: 30000 }] });

    await page.setViewportSize({ width: 1280, height: 860 });
    await signIn(page);
    await page.goto(`/sell/records/${sale.id}`);
    await page.getByRole('tab', { name: 'Export pack' }).click();
    await expect(page.getByText('This sale was saved as a local sale.')).toBeVisible();
    await page.getByLabel('Destination country').fill('Kenya');
    await page.getByRole('button', { name: 'Make it an export sale' }).click();
    await expect(page.getByText('Now an export sale')).toBeVisible();
    await expect(page.getByLabel('Destination country')).toHaveValue('Kenya');
    await expect(page.getByRole('button', { name: 'Packing list', exact: true })).toBeVisible();
  } finally {
    await undo();
  }
});

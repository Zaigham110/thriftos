import { Page, expect, test } from '@playwright/test';
import { keypad, pickTile } from './floor';
import { apiAs, signIn } from './helpers';

/** A camera that films one image (the bale's QR), so scanning runs end to end in a headless browser. */
async function fakeCamera(page: Page, svg: string): Promise<void> {
  await page.addInitScript((qrSvg) => {
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 480;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 480, 480);
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 90, 90, 300, 300);
    img.src = 'data:image/svg+xml;base64,' + btoa(qrSvg);
    setInterval(() => img.complete && ctx.drawImage(img, 90, 90, 300, 300), 200);
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => canvas.captureStream(10) } });
  }, svg);
}

async function makeBale(request: Parameters<typeof apiAs>[0]) {
  const api = await apiAs(request);
  const categories = await api.get('/tenant/categories');
  const jackets = categories.find((c: { name: string }) => c.name === 'Jackets');
  const vendor = await api.post('/procurement/vendors', { name: `QR Supplier ${Date.now()}`, originCountry: 'UK' });
  const container = await api.post('/procurement/containers', { vendorId: vendor.id, netWeightKg: 500, purchaseCost: 100000, withLot: true });
  const s = await api.post('/sorting/stage-1/start', { ragId: container.rags[0].id });
  await api.post('/sorting/stage-1/allocate', { sessionId: s.session.id, categoryId: jackets.id, amountKg: 500 });
  const login = await (await request.post('/api/auth/login', { data: { email: 'admin@demo.thriftos.com', password: 'admin123' } })).json();
  await request.patch(`/api/sorting/stage-1/${s.session.id}/seal`, { headers: { Authorization: `Bearer ${login.accessToken}` }, data: {} });
  // A weight of its own, so this bale is the only one of its kind (bales of one kind share a code).
  const bale = await api.post('/stock/bales', { categoryId: jackets.id, weightKg: 50 + (Date.now() % 1000) / 100, pieces: 80 });
  const [label] = await api.get(`/stock/bales/labels?ids=${bale.id}`);
  return { api, bale, label };
}

test('Task 3.5: labels print as 50×30 mm stickers or an A4 sheet of 3×8', async ({ page, request }) => {
  const { bale, label: data } = await makeBale(request);
  // The code on the sticker is the one its kind shares: category, kg and pieces (its own number stays behind).
  expect(bale.code).toMatch(/^JACKETS-5\d(\.\d+)?-80P$/);
  expect(bale.unitCode).toMatch(/^B-\d{4}$/);
  expect(data.origin).toBeTruthy();
  await signIn(page);
  await page.goto(`/stock/label/${bale.id}`);
  const label = page.locator('.label').first();
  await expect(label).toContainText(bale.code);
  await expect(label).toContainText('Jackets');
  await expect(label).toContainText(data.origin);
  await expect(label).toContainText('Demo Thrift Company');
  await expect(label.locator('svg')).toBeVisible();

  await page.emulateMedia({ media: 'print' });
  const mm = (px: number) => Math.round((px * 25.4) / 96);
  const thermal = await label.boundingBox();
  expect([mm(thermal!.width), mm(thermal!.height)]).toEqual([50, 30]);
  await expect(page.locator('.action-bar')).toBeHidden();

  await page.emulateMedia({ media: 'screen' });
  await page.getByRole('button', { name: 'A4 sheet (3×8)' }).click();
  // Measure only once the screen has switched to the sheet layout (a fast runner can measure the old one).
  await expect(page.locator('.labels.a4')).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  // The layout switches after the click is handled; measure once it has (a single read raced it in CI).
  await expect
    .poll(async () => {
      const a4 = await label.boundingBox();
      return [mm(a4!.width), mm(a4!.height)];
    })
    .toEqual([70, 37]);
  // 3 columns × 8 rows of 70 × 37 mm fill an A4 page (210 × 297 mm) with the 0.5 mm page margin.
  expect(3 * 70).toBeLessThanOrEqual(210);
  expect(8 * 37 + 2 * 0.5).toBeLessThanOrEqual(297);
});

test('Task 3.5: scanning a bale QR adds it to a sale; typing the code opens the bale', async ({ page, request }) => {
  const { bale, label } = await makeBale(request);
  await fakeCamera(page, label.qrSvg);
  await signIn(page);

  await page.goto('/sell/new');
  await page.getByRole('button', { name: 'Scan bale' }).click();
  await expect(page.locator('.line').filter({ hasText: bale.code })).toBeVisible({ timeout: 15_000 });

  // No camera needed: the code printed on the sticker can be typed.
  await page.goto('/stock');
  await page.getByRole('button', { name: 'Scan QR' }).click();
  await page.getByLabel('Bale code').fill(bale.code.toLowerCase());
  await page.getByRole('dialog').getByRole('button', { name: 'OK' }).click();
  await expect(page).toHaveURL(new RegExp(`/stock/label/${bale.id}$`));

  await page.goto('/stock');
  await page.getByRole('button', { name: 'Scan QR' }).click();
  await page.getByLabel('Bale code').fill('B-9999');
  await page.getByRole('dialog').getByRole('button', { name: 'OK' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'This QR is not in your stock.' })).toBeVisible();
});

test('bales of one kind share a code: the phone sells a quantity of it and Inventory counts it (owner, 2026-11-16)', async ({ page, request }) => {
  const api = await apiAs(request);
  const tag = Date.now().toString().slice(-6);
  // Three bales of the same category and weight (a weight of their own, so the count is exactly three).
  const kg = 30 + (Date.now() % 1000) / 100;
  const cats = (await api.get('/tenant/categories')) as Array<{ id: string; name: string }>;
  const jeans = cats.find((c) => c.name === 'Jeans') ?? cats[0];
  const lot = await api.post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 200, purchaseCost: 20000 });
  const s = await api.post('/sorting/stage-1/start', { ragId: lot.id });
  const sessionId = s.session?.id ?? (await api.get(`/sorting/stage-1/summary?ragId=${lot.id}`)).session.id;
  const made = await api.post('/sorting/stage-1/allocate', { sessionId, categoryId: jeans.id, bales: 3, baleWeightKg: kg });
  const labels = (await api.get(`/stock/bales/labels?ids=${made.baleIds.join(',')}`)) as Array<{ code: string; qr: string }>;
  const code = labels[0].code;
  expect(new Set(labels.map((l) => l.code)).size).toBe(1);
  expect(new Set(labels.map((l) => l.qr)).size).toBe(1);
  const customer = await api.post('/customers', { name: `Kind Buyer ${tag}`, phone: `0305${tag}3` });

  await signIn(page);
  await page.goto('/sell/new');
  await pickTile(page, 'Search name or phone', customer.name);
  // One tile for the kind, with how many there are.
  const search = page.getByPlaceholder('Search stock');
  if (await search.count()) await search.fill(code);
  const tile = page.locator('.tiles').getByRole('button').filter({ hasText: code });
  await expect(tile).toHaveCount(1);
  await expect(tile).toContainText('3 bale');
  await tile.click();
  await expect(page.locator('.line')).toContainText('3 left');
  // More than there are cannot be saved; two can.
  await keypad(page, /^Price/, 9000);
  await keypad(page, /^Quantity/, 4);
  await expect(page.getByRole('button', { name: 'Save sale' })).toBeDisabled();
  await keypad(page, /^Quantity/, 2);
  await page.getByRole('button', { name: 'Save sale' }).click();
  await expect(page.getByRole('button', { name: 'Share bill on WhatsApp' })).toBeVisible({ timeout: 20_000 });

  // The two oldest went out on one bill; Inventory by item counts the one left under the code.
  const sales = (await api.get(`/lists/sales?q=${encodeURIComponent(customer.name)}`)) as { rows: Array<{ id: string }> };
  const bill = await api.get(`/sales/${sales.rows[0].id}/print`);
  expect(bill.lines.map((l: { quantity: string; lineTotal: string }) => [l.quantity, l.lineTotal])).toEqual([['2', '18000']]);
  expect(bill.lines[0].description).toContain(code);
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto('/stock/by-item');
  const row = page.getByRole('row').filter({ hasText: code });
  await expect(row).toHaveCount(1);
  await expect(row.getByRole('cell').nth(2)).toHaveText('1');
});

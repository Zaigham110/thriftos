import { Page, expect, test } from '@playwright/test';
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
  const bale = await api.post('/stock/bales', { categoryId: jackets.id, weightKg: 55, pieces: 80 });
  const [label] = await api.get(`/stock/bales/labels?ids=${bale.id}`);
  return { api, bale, label };
}

test('Task 3.5: labels print as 50×30 mm stickers or an A4 sheet of 3×8', async ({ page, request }) => {
  const { bale, label: data } = await makeBale(request);
  expect(bale.unitCode).toMatch(/^B-\d{4}$/);
  expect(data.origin).toBeTruthy();
  await signIn(page);
  await page.goto(`/stock/label/${bale.id}`);
  const label = page.locator('.label').first();
  await expect(label).toContainText(bale.unitCode);
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
  await page.emulateMedia({ media: 'print' });
  const a4 = await label.boundingBox();
  expect([mm(a4!.width), mm(a4!.height)]).toEqual([70, 37]);
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
  await expect(page.locator('.line').filter({ hasText: bale.unitCode })).toBeVisible({ timeout: 15_000 });

  // No camera needed: the code printed on the sticker can be typed.
  await page.goto('/stock');
  await page.getByRole('button', { name: 'Scan QR' }).click();
  await page.getByLabel('Bale code').fill(bale.unitCode.toLowerCase());
  await page.getByRole('dialog').getByRole('button', { name: 'OK' }).click();
  await expect(page).toHaveURL(new RegExp(`/stock/label/${bale.id}$`));

  await page.goto('/stock');
  await page.getByRole('button', { name: 'Scan QR' }).click();
  await page.getByLabel('Bale code').fill('B-9999');
  await page.getByRole('dialog').getByRole('button', { name: 'OK' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'This QR is not in your stock.' })).toBeVisible();
});

import { SYSTEM_COMPANY_CODE } from '../bootstrap/base-data';
import { INestApplicationContext } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { SuperAdminService } from '../superadmin/superadmin.service';
import { SetupService } from '../tenant/setup.service';
import { VendorService } from '../procurement/vendor/vendor.service';
import { ContainerService } from '../procurement/container/container.service';
import { SortSessionService } from '../sorting/sort-session.service';
import { GradeSessionService } from '../sorting/grade-session.service';
import { BaleService } from '../stock/bale.service';
import { DirectStockService } from '../stock/direct-stock.service';
import { CustomersService } from '../sales/customers.service';
import { SalesService } from '../sales/sales.service';
import { KhataService } from '../sales/khata.service';
import { startOfDayPKT } from '../home/home';

/**
 * Task 4.1: the demo businesses, made through the same services the app uses (so costs and khata are exactly
 * what the app would produce), dated over the last 3 months up to today so "today" is never empty.
 *
 * - Al-Madina Traders (Demo), Karachi: 3 suppliers (USA, UK, Korea), 6 containers with duty, clearing, freight
 *   and transport, sorted into 6 categories and graded A/B/C with yields that differ by origin (USA ~18% A,
 *   UK ~14%, Korea ~10%), 120 bales, 15 customers in Karachi / Lahore / Peshawar (some with old udhaar, some
 *   overdue), 60 sales and payments.
 * - Lahore Bale House (Demo): a trader who does not sort (sortingStages = 0), ready stock only.
 *
 * Only timestamps are moved back afterwards (createdAt / issuedAt / receivedAt), in date order, so khata
 * statuses and costs are untouched. Deterministic: the same story on every reset.
 */

/**
 * Demo logins. On a real server (server-demo.ts) the password and PIN come from DEMO_PASSWORD / DEMO_PIN, so the
 * public defaults below only ever work on a local demo or test database.
 */
export const DEMO = {
  owner: { email: 'owner@almadina.demo', password: process.env.DEMO_PASSWORD || 'Demo@1234' },
  munshi: { phone: '03007860786', pin: process.env.DEMO_PIN || '1234' },
  trader: { email: 'owner@lahorebales.demo', password: process.env.DEMO_PASSWORD || 'Demo@1234' },
  companyCode: 'ALMADINA',
  traderCode: 'LAHOREBALES',
};

const CATEGORIES = [
  { name: 'Jeans', share: 0.22 },
  { name: 'T-Shirts', share: 0.2 },
  { name: 'Ladies tops', share: 0.14 },
  { name: 'Jackets', share: 0.12 },
  { name: 'Sweaters', share: 0.1 },
  { name: 'Kids', share: 0.1 },
];
const GRADES = ['A', 'B', 'C'];

/** What each origin gives: A-grade share, B share (C is the rest), waste when sorting, price per kg in USD. */
const ORIGINS = {
  USA: { a: 0.18, b: 0.52, waste: 0.1, usdPerKg: 0.69 },
  UK: { a: 0.14, b: 0.5, waste: 0.11, usdPerKg: 0.61 },
  Korea: { a: 0.1, b: 0.45, waste: 0.15, usdPerKg: 0.43 },
} as const;
type Origin = keyof typeof ORIGINS;

const SUPPLIERS: { name: string; origin: Origin }[] = [
  { name: 'Global Textile Recyclers', origin: 'USA' },
  { name: 'London Clothing Bank', origin: 'UK' },
  { name: 'Busan Rag Trading', origin: 'Korea' },
];

/** 6 containers over 3 months: days ago, origin, invoice kg, rupee rate. */
const CONTAINERS: { daysAgo: number; origin: Origin; kg: number; fx: number }[] = [
  { daysAgo: 88, origin: 'USA', kg: 11200, fx: 279.5 },
  { daysAgo: 74, origin: 'UK', kg: 10600, fx: 280.2 },
  { daysAgo: 60, origin: 'Korea', kg: 11800, fx: 281 },
  { daysAgo: 41, origin: 'USA', kg: 11000, fx: 282.4 },
  { daysAgo: 26, origin: 'UK', kg: 10900, fx: 281.8 },
  { daysAgo: 9, origin: 'Korea', kg: 12000, fx: 280.9 },
];

/** Bales made per container by grade (20 each, 120 in all): more A bales where the maal gives more A. */
const BALES_PER_GRADE: Record<Origin, Record<string, number>> = {
  USA: { A: 8, B: 8, C: 4 },
  UK: { A: 6, B: 9, C: 5 },
  Korea: { A: 4, B: 9, C: 7 },
};
/** Sale price per kg of a bale by grade (Rs), before a small per-sale variation. */
const PRICE_PER_KG: Record<string, number> = { A: 860, B: 450, C: 225 };

const CUSTOMERS: { name: string; city: string; phone: string; opening?: number; neverPays?: boolean }[] = [
  { name: 'Haji Rafiq & Sons', city: 'Karachi', phone: '03002110011', opening: 85000 },
  { name: 'Bilal Garments', city: 'Karachi', phone: '03212110012' },
  { name: 'Saeed Cloth House', city: 'Karachi', phone: '03332110013' },
  { name: 'Imran Landa Centre', city: 'Karachi', phone: '03452110014', opening: 140000, neverPays: true },
  { name: 'Noor Traders', city: 'Karachi', phone: '03012110015' },
  { name: 'Zahid Bale Store', city: 'Lahore', phone: '03004220021', neverPays: true },
  { name: 'Usman & Brothers', city: 'Lahore', phone: '03214220022' },
  { name: 'Shahid Kapra Market', city: 'Lahore', phone: '03334220023', opening: 62500 },
  { name: 'Ali Traders', city: 'Lahore', phone: '03454220024' },
  { name: 'Rehman Second Hand', city: 'Lahore', phone: '03014220025' },
  { name: 'Gul Khan Traders', city: 'Peshawar', phone: '03009150031', opening: 210000 },
  { name: 'Afridi Cloth Market', city: 'Peshawar', phone: '03219150032' },
  { name: 'Wazir Landa House', city: 'Peshawar', phone: '03339150033', neverPays: true },
  { name: 'Shinwari Bale Point', city: 'Peshawar', phone: '03459150034' },
  { name: 'Mohmand Traders', city: 'Peshawar', phone: '03019150035' },
];

/** Small deterministic random numbers (mulberry32), so every reset tells the same story. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const kg2 = (n: number) => Math.round(n * 100) / 100;
const rs100 = (n: number) => Math.round(n / 100) * 100;
const rs1000 = (n: number) => Math.round(n / 1000) * 1000;

interface Ctx {
  app: INestApplicationContext;
  prisma: PrismaService;
  today: Date;
  random: () => number;
}

/** A moment `daysAgo` days before today, at `hour` o'clock Pakistan time (never in the future). */
function moment(ctx: Ctx, daysAgo: number, hour = 11, minute = 0): Date {
  const midnight = startOfDayPKT(ctx.today).getTime() - daysAgo * 86_400_000;
  const t = new Date(midnight + (hour * 60 + minute) * 60_000);
  return t > ctx.today ? new Date(ctx.today.getTime() - 60_000) : t;
}

export interface DemoResult {
  tenantId: string;
  traderTenantId: string;
  containers: number;
  bales: number;
  sales: number;
  customers: number;
  checkRows: { costChain: number; khata: number };
}

export async function seedDemo(app: INestApplicationContext, opts: { today?: Date; log?: (s: string) => void } = {}): Promise<DemoResult> {
  const log = opts.log ?? (() => undefined);
  const prisma = app.get(PrismaService);
  const ctx: Ctx = { app, prisma, today: opts.today ?? new Date(), random: rng(786) };
  const get = <T>(cls: new (...args: never[]) => T) => app.get(cls as never, { strict: false }) as T;
  const superadmin = get(SuperAdminService);
  const setup = get(SetupService);
  const vendors = get(VendorService);
  const containers = get(ContainerService);
  const sorting = get(SortSessionService);
  const grading = get(GradeSessionService);
  const bales = get(BaleService);
  const directStock = get(DirectStockService);
  const customers = get(CustomersService);
  const sales = get(SalesService);
  const khata = get(KhataService);

  // Any super admin of this database (the SYSTEM business's users) creates the demo businesses.
  const admin = await prisma.user.findFirstOrThrow({ where: { tenant: { companyCode: SYSTEM_COMPANY_CODE } }, orderBy: { createdAt: 'asc' }, select: { id: true } });

  // ── Al-Madina Traders (Demo) ────────────────────────────────────────────────────────────────────
  log('Al-Madina Traders (Demo)');
  await superadmin.createTenant(
    { name: 'Al-Madina Traders (Demo)', companyCode: DEMO.companyCode, currency: 'PKR', locale: 'ur-PK', adminEmail: DEMO.owner.email, adminName: 'Haji Abdul Majeed', adminPassword: DEMO.owner.password } as never,
    admin.id,
  );
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { companyCode: DEMO.companyCode } });
  const t = tenant.id;
  const owner = await prisma.user.findFirstOrThrow({ where: { tenantId: t, email: DEMO.owner.email } });
  await setup.save(
    t,
    {
      businessName: 'Al-Madina Traders (Demo)',
      currency: 'PKR',
      language: 'ur',
      sortingStages: 2,
      categories: CATEGORIES.map((c) => c.name),
      grades: GRADES,
      munshi: { name: 'Akram Munshi', phone: DEMO.munshi.phone, pin: DEMO.munshi.pin },
    },
    owner.id,
  );
  const munshi = await prisma.user.findFirstOrThrow({ where: { tenantId: t, phone: { not: null } } });
  const filled = await fillSortingStory(app, ctx, { tenantId: t, ownerId: owner.id, workerId: munshi.id, log, moveBusinessDate: true });
  const saleCount = filled.sales;
  const sinceMidnight = ctx.today.getTime() - startOfDayPKT(ctx.today).getTime();

  // ── Lahore Bale House (Demo): a trader who buys ready stock and does not sort ────────────────────
  log('Lahore Bale House (Demo)');
  await superadmin.createTenant(
    { name: 'Lahore Bale House (Demo)', companyCode: DEMO.traderCode, currency: 'PKR', locale: 'ur-PK', adminEmail: DEMO.trader.email, adminName: 'Malik Tariq', adminPassword: DEMO.trader.password } as never,
    admin.id,
  );
  const trader = await prisma.tenant.findUniqueOrThrow({ where: { companyCode: DEMO.traderCode } });
  const traderOwner = await prisma.user.findFirstOrThrow({ where: { tenantId: trader.id, email: DEMO.trader.email } });
  await setup.save(trader.id, { businessName: 'Lahore Bale House (Demo)', currency: 'PKR', language: 'ur', sortingStages: 0, categories: [], grades: [] }, traderOwner.id);
  const wholesaler = (await vendors.create(trader.id, { name: 'Sher Shah Wholesale', originCountry: 'Pakistan', country: 'Pakistan' } as never, traderOwner.id)) as { id: string };
  const items: Record<string, string> = {};
  for (const [name, unit, quantity, totalCost, weightKg, salePrice, daysAgo] of [
    ['Ladies jackets (UK)', 'BALE', 8, 200000, 360, 33000, 28],
    ['Gents sweaters', 'BALE', 6, 132000, 300, 27000, 21],
    ['Kids mix', 'KG', 600, 96000, undefined, 230, 14],
  ] as const) {
    const item = (await directStock.receive(
      trader.id,
      { name, unit, quantity, totalCost, vendorId: wholesaler.id, ...(weightKg ? { weightKg } : {}), salePrice } as never,
      traderOwner.id,
    )) as { id: string };
    items[name] = item.id;
    await prisma.inventoryItem.update({ where: { id: item.id }, data: { createdAt: moment(ctx, daysAgo, 10) } });
  }
  await directStock.open(trader.id, items['Ladies jackets (UK)'], { bales: 1, tiers: [{ price: 300, pieces: 40 }, { price: 500, pieces: 25 }, { price: 800, pieces: 10 }] } as never, traderOwner.id);
  const traderCustomers: string[] = [];
  for (const [name, phone, opening] of [
    ['Anarkali Bale Corner', '03004440041', 30000],
    ['Ichhra Second Hand', '03214440042', 0],
    ['Shadman Kapra', '03334440043', 0],
    ['Township Traders', '03454440044', 12000],
  ] as const) {
    const c = (await customers.create(trader.id, { name, phone, city: 'Lahore', openingBalance: opening } as never, traderOwner.id)) as { id: string };
    traderCustomers.push(c.id);
    await prisma.customer.update({ where: { id: c.id }, data: { createdAt: moment(ctx, 40) } });
  }
  const jacketPieces = await prisma.inventoryItem.findMany({ where: { tenantId: trader.id, parentItemId: items['Ladies jackets (UK)'] }, orderBy: { salePrice: 'asc' } });
  const traderSales: { daysAgo: number; customer: number; mode: string; lines: { inventoryItemId: string; unit: string; quantity: number; unitPrice: number }[] }[] = [
    { daysAgo: 20, customer: 0, mode: 'CREDIT', lines: [{ inventoryItemId: items['Ladies jackets (UK)'], unit: 'BALE', quantity: 2, unitPrice: 33000 }] },
    { daysAgo: 15, customer: 1, mode: 'CASH', lines: [{ inventoryItemId: items['Gents sweaters'], unit: 'BALE', quantity: 1, unitPrice: 27500 }] },
    { daysAgo: 10, customer: 2, mode: 'CASH', lines: [{ inventoryItemId: items['Kids mix'], unit: 'KG', quantity: 120, unitPrice: 240 }] },
    { daysAgo: 6, customer: 3, mode: 'CREDIT', lines: [{ inventoryItemId: items['Gents sweaters'], unit: 'BALE', quantity: 2, unitPrice: 27000 }] },
    { daysAgo: 2, customer: 1, mode: 'CASH', lines: [{ inventoryItemId: jacketPieces[0].id, unit: 'PIECE', quantity: 12, unitPrice: 300 }, { inventoryItemId: jacketPieces[2].id, unit: 'PIECE', quantity: 4, unitPrice: 800 }] },
    { daysAgo: 0, customer: 0, mode: 'CASH', lines: [{ inventoryItemId: items['Kids mix'], unit: 'KG', quantity: 80, unitPrice: 235 }] },
  ];
  for (const s of traderSales) {
    const at = s.daysAgo === 0 ? new Date(startOfDayPKT(ctx.today).getTime() + sinceMidnight * 0.6) : moment(ctx, s.daysAgo, 13);
    const sale = (await sales.create(trader.id, { customerId: traderCustomers[s.customer], paymentMode: s.mode, lines: s.lines, ...(s.mode !== 'CREDIT' ? { paymentMethod: 'CASH' } : {}) } as never, traderOwner.id)) as { id: string };
    await prisma.sale.update({ where: { id: sale.id }, data: { issuedAt: at, createdAt: at } });
    await prisma.payment.updateMany({ where: { tenantId: trader.id, saleId: sale.id }, data: { receivedAt: at, createdAt: at } });
  }
  const traderPayAt = moment(ctx, 8, 16);
  const tp = (await khata.recordPayment(trader.id, { customerId: traderCustomers[0], amount: 40000, method: 'EASYPAISA', receivedAt: traderPayAt.toISOString() } as never, traderOwner.id)) as { payment: { id: string } };
  await prisma.payment.update({ where: { id: tp.payment.id }, data: { receivedAt: traderPayAt, createdAt: traderPayAt } });

  // Both data checks must find nothing: costs add up at every stage, khata agrees with sales and payments.
  const checks = path.resolve(__dirname, '../../../prisma/checks');
  const ours = new Set([t, trader.id]);
  const run = async (file: string) =>
    ((await prisma.$queryRawUnsafe(fs.readFileSync(path.join(checks, file), 'utf8').replace(/;\s*$/m, ''))) as { tenantId: string }[]).filter((r) => ours.has(r.tenantId)).length;
  const checkRows = { costChain: await run('cost-chain-check.sql'), khata: await run('khata-check.sql') };
  log(`  checks: cost chain ${checkRows.costChain} rows, khata ${checkRows.khata} rows`);

  return {
    tenantId: t,
    traderTenantId: trader.id,
    containers: CONTAINERS.length,
    bales: filled.bales,
    sales: saleCount,
    customers: CUSTOMERS.length,
    checkRows,
  };
}

/**
 * The Al-Madina story in any business that sorts by category and grade: suppliers, customers, containers sorted,
 * graded and baled, three months of sales and udhaar paid back. Used by the demo and by "Fill with sample data" on a
 * test business (super admin console). The business must have the sample's categories (Jeans…) and grades (A, B, C).
 */
export async function fillSortingStory(
  app: Pick<INestApplicationContext, 'get'>,
  ctx: Ctx,
  opts: { tenantId: string; ownerId: string; workerId: string; log?: (s: string) => void; moveBusinessDate?: boolean },
): Promise<{ bales: number; sales: number }> {
  const log = opts.log ?? (() => undefined);
  const prisma = ctx.prisma;
  const get = <T>(cls: new (...args: never[]) => T) => app.get(cls as never, { strict: false }) as T;
  const vendors = get(VendorService);
  const containers = get(ContainerService);
  const sorting = get(SortSessionService);
  const grading = get(GradeSessionService);
  const bales = get(BaleService);
  const customers = get(CustomersService);
  const sales = get(SalesService);
  const khata = get(KhataService);
  const t = opts.tenantId;
  const owner = { id: opts.ownerId };
  const workerId = opts.workerId;
  const categoryId = Object.fromEntries((await prisma.category.findMany({ where: { tenantId: t, isActive: true } })).map((c) => [c.name, c.id]));
  const gradeId = Object.fromEntries((await prisma.grade.findMany({ where: { tenantId: t, isActive: true } })).map((g) => [g.name, g.id]));
  const katran = await prisma.wasteCategory.findFirstOrThrow({ where: { tenantId: t, name: 'Waste/Katran' } });
  if (opts.moveBusinessDate) await prisma.tenant.update({ where: { id: t }, data: { createdAt: moment(ctx, 100) } });

  const supplierId: Record<Origin, string> = {} as never;
  for (const s of SUPPLIERS) {
    const v = await vendors.create(t, { name: s.name, originCountry: s.origin, country: s.origin } as never, owner.id);
    supplierId[s.origin] = (v as { id: string }).id;
  }

  const customerIds: string[] = [];
  for (const c of CUSTOMERS) {
    const row = await customers.create(t, { name: c.name, phone: c.phone, city: c.city, openingBalance: c.opening ?? 0 } as never, owner.id);
    const id = (row as { id: string }).id;
    customerIds.push(id);
    await prisma.customer.update({ where: { id }, data: { createdAt: moment(ctx, 95) } });
  }

  // Containers → sort → grade → bales, one container at a time (each bale is picked from its own container).
  interface BaleStock { itemId: string; grade: string; kg: number; readyDay: number; container: number }
  const stock: BaleStock[] = [];
  for (const [ci, c] of CONTAINERS.entries()) {
    const o = ORIGINS[c.origin];
    const day = c.daysAgo;
    const kanta = kg2(c.kg * (0.996 + ctx.random() * 0.003));
    const created = (await containers.create(
      t,
      {
        vendorId: supplierId[c.origin],
        originCountry: c.origin,
        netWeightKg: c.kg,
        weighbridgeKg: kanta,
        purchaseCost: Math.round(c.kg * o.usdPerKg),
        purchaseCurrency: 'USD',
        fxRate: c.fx,
        charges: [
          { chargeType: 'DUTY', amount: rs1000(c.kg * 24) },
          { chargeType: 'CLEARING', amount: rs1000(85000 + ctx.random() * 10000) },
          { chargeType: 'FREIGHT', amount: rs1000(55000 + ctx.random() * 10000) },
          { chargeType: 'TRANSPORT', amount: rs1000(22000 + ctx.random() * 6000) },
        ],
        withLot: true,
      } as never,
      owner.id,
    )) as { id: string; rags: { id: string }[] };
    const arrived = moment(ctx, day, 10);
    await prisma.container.update({ where: { id: created.id }, data: { createdAt: arrived, arrivedAt: arrived } });
    await prisma.rag.updateMany({ where: { containerId: created.id }, data: { createdAt: arrived } });
    const lotId = created.rags[0].id;

    // Chhantai (stage 1): categories by share, the rest is waste.
    const s = (await sorting.start(t, { ragId: lotId } as never, workerId)) as { session: { id: string } };
    const usable = kanta * (1 - o.waste);
    for (const cat of CATEGORIES) {
      await sorting.addKg(t, { sessionId: s.session.id, categoryId: categoryId[cat.name], amountKg: kg2(usable * cat.share / CATEGORIES.reduce((x, k) => x + k.share, 0)) } as never, workerId);
    }
    await sorting.close(t, s.session.id, workerId, katran.id);
    await prisma.sortSession.update({ where: { id: s.session.id }, data: { startTime: moment(ctx, day - 1, 9), endTime: moment(ctx, day - 1, 17) } });

    // Grading (stage 2): A / B / C by what this origin gives; the last grade takes the exact remainder.
    const outputs = await prisma.categoryOutput.findMany({ where: { tenantId: t, sortCategoryBucket: { sortSessionId: s.session.id } }, include: { category: true } });
    const gradeOutputs: Record<string, Record<string, string>> = {};
    for (const out of outputs) {
      const g = (await grading.start(t, { categoryOutputId: out.id } as never, workerId)) as { session: { id: string } };
      const total = Number(out.weightKg);
      const a = kg2(total * o.a);
      const b = kg2(total * o.b);
      for (const [grade, kg] of [['A', a], ['B', b], ['C', kg2(total - a - b)]] as const) {
        await grading.addKg(t, { sessionId: g.session.id, gradeId: gradeId[grade], amountKg: kg } as never, workerId);
      }
      await grading.close(t, g.session.id, workerId);
      await prisma.gradeSession.update({ where: { id: g.session.id }, data: { startTime: moment(ctx, day - 2, 9), endTime: moment(ctx, day - 2, 16) } });
      const rows = await prisma.gradeOutput.findMany({ where: { tenantId: t, gradeBucket: { gradeSessionId: g.session.id } }, include: { grade: true } });
      gradeOutputs[out.category.name] = Object.fromEntries(rows.map((r) => [r.grade.name, r.id]));
    }

    // 20 bales from this container, rotating through the categories.
    let n = 0;
    for (const grade of GRADES) {
      for (let i = 0; i < BALES_PER_GRADE[c.origin][grade]; i++) {
        const cat = CATEGORIES[n++ % CATEGORIES.length].name;
        const weight = kg2(45 + Math.round(ctx.random() * 15));
        const bale = (await bales.makeBale(
          t,
          { categoryId: categoryId[cat], gradeId: gradeId[grade], weightKg: weight, allocations: [{ gradingOutputId: gradeOutputs[cat][grade], amountKg: weight }] } as never,
          workerId,
        )) as { id: string };
        const made = moment(ctx, Math.max(day - 3, 0), 12, n);
        await prisma.repackUnit.update({ where: { id: bale.id }, data: { createdAt: made } });
        const item = await prisma.inventoryItem.findFirstOrThrow({ where: { tenantId: t, repackUnitId: bale.id } });
        await prisma.inventoryItem.update({ where: { id: item.id }, data: { createdAt: made } });
        stock.push({ itemId: item.id, grade, kg: weight, readyDay: Math.max(day - 3, 0), container: ci });
      }
    }
    log(`  container ${ci + 1} (${c.origin}) sorted, graded, 20 bales`);
  }

  // 57 sales spread over the 3 months, then 3 today; payments later for some udhaar.
  interface Event { at: Date; run: () => Promise<void> }
  const events: Event[] = [];
  const sold = new Set<string>();
  const method = () => (['CASH', 'CASH', 'JAZZCASH', 'BANK', 'EASYPAISA'] as const)[Math.floor(ctx.random() * 5)];
  const saleDays = Array.from({ length: 57 }, (_, i) => Math.round(84 - (i * 83) / 56));
  const pickSale = (daysAgo: number) => {
    const pool = stock.filter((b) => !sold.has(b.itemId) && b.readyDay >= daysAgo).sort((x, y) => y.readyDay - x.readyDay);
    if (!pool.length) return null;
    const r = ctx.random();
    const count = Math.min(pool.length, r < 0.5 ? 1 : r < 0.9 ? 2 : 3);
    const lines: BaleStock[] = [];
    for (let k = 0; k < count; k++) {
      // Mostly older bales first, sometimes a newer one.
      const idx = Math.min(pool.length - 1, Math.floor(ctx.random() * ctx.random() * pool.length));
      const [b] = pool.splice(idx, 1);
      lines.push(b);
      sold.add(b.itemId);
    }
    return lines;
  };
  const sellAt = (at: Date, daysAgo: number) => {
    const lines = pickSale(daysAgo);
    if (!lines) return;
    const ci = Math.floor(ctx.random() * CUSTOMERS.length);
    const r = ctx.random();
    const mode = r < 0.45 ? 'CASH' : r < 0.8 ? 'CREDIT' : 'PARTIAL';
    const priced = lines.map((b) => ({ inventoryItemId: b.itemId, unit: 'BALE', quantity: 1, unitPrice: rs100(b.kg * PRICE_PER_KG[b.grade] * (0.95 + ctx.random() * 0.1)) }));
    const total = priced.reduce((s, l) => s + l.unitPrice, 0);
    const paid = mode === 'PARTIAL' ? rs1000(total * (0.3 + ctx.random() * 0.3)) : undefined;
    events.push({
      at,
      run: async () => {
        const sale = (await sales.create(
          t,
          { customerId: customerIds[ci], paymentMode: mode, lines: priced, ...(mode !== 'CREDIT' ? { paymentMethod: method() } : {}), ...(paid ? { paidAmount: paid } : {}) } as never,
          owner.id,
        )) as { id: string };
        await prisma.sale.update({ where: { id: sale.id }, data: { issuedAt: at, createdAt: at } });
        await prisma.payment.updateMany({ where: { tenantId: t, saleId: sale.id }, data: { receivedAt: at, createdAt: at } });
        await prisma.stockMovement.updateMany({ where: { referenceId: sale.id }, data: { createdAt: at } });
      },
    });
    // Udhaar paid back later by most customers (not the ones who never pay).
    if (mode !== 'CASH' && !CUSTOMERS[ci].neverPays && daysAgo > 12 && ctx.random() < 0.75) {
      const payDay = Math.max(1, daysAgo - 7 - Math.floor(ctx.random() * 14));
      const share = 0.5 + ctx.random() * 0.5;
      events.push({
        at: moment(ctx, payDay, 15, Math.floor(ctx.random() * 50)),
        run: async () => {
          const ledger = (await khata.ledger(t, customerIds[ci])) as { balance: Prisma.Decimal | string };
          const amount = rs1000(Number(ledger.balance) * share);
          if (amount <= 0) return;
          const at = moment(ctx, payDay, 15);
          const r2 = (await khata.recordPayment(t, { customerId: customerIds[ci], amount, method: method(), receivedAt: at.toISOString() } as never, owner.id)) as { payment: { id: string } };
          await prisma.payment.update({ where: { id: r2.payment.id }, data: { receivedAt: at, createdAt: at } });
        },
      });
    }
  };
  for (const d of saleDays) sellAt(moment(ctx, d, 11 + Math.floor(ctx.random() * 6), Math.floor(ctx.random() * 60)), d);
  // Today: three sales and a payment, at times already past.
  const sinceMidnight = ctx.today.getTime() - startOfDayPKT(ctx.today).getTime();
  for (const f of [0.55, 0.75, 0.9]) sellAt(new Date(startOfDayPKT(ctx.today).getTime() + sinceMidnight * f), 0);
  events.push({
    at: new Date(startOfDayPKT(ctx.today).getTime() + sinceMidnight * 0.8),
    run: async () => {
      const at = new Date(startOfDayPKT(ctx.today).getTime() + sinceMidnight * 0.8);
      const r = (await khata.recordPayment(t, { customerId: customerIds[0], amount: 50000, method: 'JAZZCASH', receivedAt: at.toISOString() } as never, owner.id)) as { payment: { id: string } };
      await prisma.payment.update({ where: { id: r.payment.id }, data: { receivedAt: at, createdAt: at } });
    },
  });
  events.sort((a, b) => a.at.getTime() - b.at.getTime());
  for (const e of events) await e.run();
  const saleCount = await prisma.sale.count({ where: { tenantId: t } });
  log(`  ${saleCount} sales, ${sold.size} of ${stock.length} bales sold`);
  return { bales: stock.length, sales: saleCount };
}

/** A fresh story context (fixed random seed, so the same sample every time). */
export function storyContext(app: Pick<INestApplicationContext, 'get'>, today = new Date()): Ctx {
  return { app: app as INestApplicationContext, prisma: app.get(PrismaService as never, { strict: false }) as PrismaService, today, random: rng(786) };
}

/** The sample's category and grade names (the setup a test business gets before "Fill with sample data"). */
export const SAMPLE_SETUP = { categories: CATEGORIES.map((c) => c.name), grades: GRADES };

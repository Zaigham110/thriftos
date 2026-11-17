import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createServer as createHttp } from 'node:http';
import { createServer } from 'node:net';
import request from 'supertest';

try {
  process.loadEnvFile();
} catch {
  /* values come from the environment */
}
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.POS_PRINT_LOOPBACK = '1';

import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { backfillKinds } from '../src/common/kinds';
import { PrismaService } from '../src/common/prisma.service';

/**
 * The whole shop day against a real database: set the shop up, import a shipment's bale list, sell whole bales and
 * pieces, cancel a bill. Runs only on a database whose name ends in _test, because it empties every table first.
 */
describe('Shop POS', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let owner = '';
  let cashier = '';
  let manager = '';
  let managerId = '';
  let till = '';
  let main = '';
  const api = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });

  const LIST = [
    'Bale no,Item,Category,Grade,Weight kg,Pieces,Cost,Bale sale price,Piece price',
    'TX-1,Mens jeans,Jeans,A,30,100,30000,40000,450',
    'TX-2,Ladies tops,Tops,A,30,200,20000,27000,',
    'TX-3,Kids mix,Kids,B,40,,10000,15000,150',
  ].join('\n');

  const upload = (path: string, token: string, fields: Record<string, string>, csv = LIST) => {
    let req = api().post(path).set(as(token));
    for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
    return req.attach('file', Buffer.from(csv), 'packing-list.csv');
  };

  const SHIPMENT = {
    supplierName: 'Texas Recycling',
    originCountry: 'USA',
    containerNo: 'MSKU1234567',
    billOfLadingNo: 'BL-99',
    arrivedOn: '2026-11-10',
    freight: '6000',
    customsDuty: '3000',
    clearing: '1000',
  };

  beforeAll(async () => {
    const name = new URL(process.env.DATABASE_URL ?? 'postgresql://x/none').pathname.slice(1);
    if (!name.endsWith('_test')) throw new Error(`Refusing to run: "${name}" is not a _test database.`);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    // Children first: bills keep their bales and users, shipments keep their supplier.
    for (const table of ['returnLine', 'saleReturn', 'salePayment', 'saleLine', 'customerEntry', 'sale', 'heldBill', 'cashMovement', 'shift', 'expense', 'transferLine', 'stockTransfer', 'stockCheckScan', 'stockCheck', 'supplierReturnLine', 'supplierReturn', 'auditLog', 'customer', 'bale', 'baleKind', 'shipment', 'supplier', 'user', 'till', 'branch', 'shop'] as const) {
      await (prisma[table] as unknown as { deleteMany(): Promise<unknown> }).deleteMany();
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('is set up once by the first person, who becomes the owner', async () => {
    expect((await api().get('/api/auth/status')).body).toEqual({ needsSetup: true });
    await api().post('/api/auth/setup').send({ shopName: 'Lunda Bazaar', ownerName: 'Asif', phone: '0300 1112223', password: '123' }).expect(400);
    const res = await api().post('/api/auth/setup').send({ shopName: 'Lunda Bazaar', city: 'Lahore', ownerName: 'Asif', phone: '0300 1112223', password: 'secret1' }).expect(201);
    owner = res.body.token;
    expect(res.body.user).toMatchObject({ name: 'Asif', role: 'OWNER', phone: '03001112223' });
    expect(res.body.shop).toMatchObject({ name: 'Lunda Bazaar', currency: 'PKR', taxRate: '0' });
    // A new shop can sell at once: one branch with one till.
    expect(res.body.branches).toHaveLength(1);
    expect(res.body.branches[0].tills[0]).toMatchObject({ code: 'T1' });
    main = res.body.branches[0].id;
    till = res.body.branches[0].tills[0].id;
    expect((await api().get('/api/auth/status')).body).toEqual({ needsSetup: false });
    const again = await api().post('/api/auth/setup').send({ shopName: 'Other', ownerName: 'X', phone: '0300 9999999', password: 'secret1' }).expect(409);
    expect(again.body.code).toBe('ALREADY_SET_UP');
  });

  it('signs in by phone and refuses a wrong password or no token', async () => {
    await api().post('/api/auth/login').send({ phone: '03001112223', password: 'nope' }).expect(401);
    await api().post('/api/auth/login').send({ phone: '0300-1112223', password: 'secret1' }).expect(201);
    await api().get('/api/sync/snapshot').expect(401);
  });

  it('lets the owner add a cashier and a manager, who cannot touch shipments, staff or settings', async () => {
    await api().post('/api/shop/staff').set(as(owner)).send({ name: 'Bilal', phone: '0301 5556667', password: '4321' }).expect(201);
    await api().post('/api/shop/staff').set(as(owner)).send({ name: 'Again', phone: '0301 5556667', password: '4321' }).expect(409);
    const sana = (await api().post('/api/shop/staff').set(as(owner)).send({ name: 'Sana', phone: '0302 7778889', password: '4321', role: 'MANAGER', pin: '1234' }).expect(201)).body;
    expect(sana).toMatchObject({ role: 'MANAGER', branchId: main });
    managerId = sana.id;
    cashier = (await api().post('/api/auth/login').send({ phone: '03015556667', password: '4321' }).expect(201)).body.token;
    manager = (await api().post('/api/auth/login').send({ phone: '03027778889', password: '4321' }).expect(201)).body.token;
    for (const token of [cashier, manager]) {
      for (const path of ['/api/shipments', '/api/shop/staff', '/api/shop/branches']) {
        expect((await api().get(path).set(as(token)).expect(403)).body.code).toBe('OWNER_ONLY');
      }
      await api().patch('/api/shop').set(as(token)).send({ name: 'Mine' }).expect(403);
    }
    expect((await api().get('/api/reports/sales').set(as(cashier)).expect(403)).body.code).toBe('MANAGER_ONLY');
  });

  it('previews a bale list without saving and points at the wrong rows', async () => {
    const good = await upload('/api/shipments/preview', owner, SHIPMENT).expect(201);
    expect(good.body.summary).toMatchObject({ bales: 3, bad: 0, pieces: 300, goodsCost: '60000', charges: '10000', landedCost: '70000', chargesSharedBy: 'weight' });
    // Charges of 10,000 by weight 30/30/40.
    expect(good.body.rows.map((r: { landedCost: string }) => r.landedCost)).toEqual(['33000', '23000', '14000']);

    const bad = await upload('/api/shipments/preview', owner, {}, 'Item,Cost\nJeans,100\nTops,\n').expect(201);
    expect(bad.body.summary.bad).toBe(1);
    expect(bad.body.rows[1].errors[0]).toContain('Cost is missing');
    expect(await prisma.bale.count()).toBe(0);

    await upload('/api/shipments', owner, SHIPMENT, 'Item,Cost\nJeans,100\nTops,\n').expect(400);
    expect(await prisma.shipment.count()).toBe(0);
  });

  it('saves the shipment with its papers, costs and numbered bales', async () => {
    await upload('/api/shipments', owner, { ...SHIPMENT, supplierName: '' }).expect(400);
    const res = await upload('/api/shipments', owner, SHIPMENT).expect(201);
    expect(res.body).toMatchObject({ code: 'S-0001', bales: 3 });

    const shipment = (await api().get(`/api/shipments/${res.body.id}`).set(as(owner)).expect(200)).body;
    expect(shipment).toMatchObject({ containerNo: 'MSKU1234567', billOfLadingNo: 'BL-99', goodsCost: '60000', freight: '6000', landedCost: '70000', baleCount: 3, totalWeightKg: '100' });
    expect(shipment.supplier.name).toBe('Texas Recycling');
    expect(shipment.bales.map((b: { code: string }) => b.code)).toEqual(['B-00001', 'B-00002', 'B-00003']);
    expect(shipment.bales[0]).toMatchObject({ baleNo: 'TX-1', item: 'Mens jeans', category: 'Jeans', grade: 'A', pieces: 100, cost: '30000', landedCost: '33000', salePrice: '40000', piecePrice: '450', status: 'IN_STOCK' });

    const same = await upload('/api/shipments', owner, SHIPMENT).expect(409);
    expect(same.body.code).toBe('SAME_CONTAINER');
  });

  it('shares the cost of goods when the file has no costs, equally without weights', async () => {
    const res = await upload('/api/shipments', owner, { supplierName: 'texas recycling', arrivedOn: '2026-11-11', goodsCost: '9000', transport: '900' }, 'Item\nMixed A\nMixed B\nMixed C').expect(201);
    expect(res.body.code).toBe('S-0002');
    const shipment = (await api().get(`/api/shipments/${res.body.id}`).set(as(owner))).body;
    expect(shipment.bales.map((b: { cost: string; landedCost: string; code: string }) => [b.code, b.cost, b.landedCost])).toEqual([
      ['B-00004', '3000', '3300'],
      ['B-00005', '3000', '3300'],
      ['B-00006', '3000', '3300'],
    ]);
    expect(await prisma.supplier.count()).toBe(1); // the same supplier, whatever the capitals
  });

  const bale = async (code: string, token = owner) => (await api().get(`/api/bales/by-code/${code}`).set(as(token))).body;
  const sell = (token: string, body: object) => api().post('/api/sales').set(as(token)).send({ tillId: till, ...body });
  const item = (unitPrice: string, quantity = 1, description = 'Bags') => ({ kind: 'ITEM', description, quantity, unitPrice });

  it('shows stock without costs to the cashier, and to the manager until the owner allows it', async () => {
    const stock = (await api().get('/api/bales').set(as(cashier)).expect(200)).body;
    expect(stock.total).toBe(6);
    expect(stock.categories).toEqual(['Jeans', 'Kids', 'Tops']);
    expect(stock.bales[0]).not.toHaveProperty('landedCost');
    expect((await api().get('/api/bales?search=jeans').set(as(cashier))).body.total).toBe(1);
    expect((await bale('b-00002', cashier)).item).toBe('Ladies tops');
    expect(await bale('TX-3')).toMatchObject({ code: 'B-00003', landedCost: '14000' });
    await api().get('/api/bales/by-code/NOPE').set(as(cashier)).expect(404);

    expect(await bale('B-00003', manager)).not.toHaveProperty('landedCost');
    await api().patch('/api/shop').set(as(owner)).send({ managerSeesCost: true }).expect(200);
    expect(await bale('B-00003', manager)).toMatchObject({ landedCost: '14000' });
    await api().patch('/api/shop').set(as(owner)).send({ managerSeesCost: false }).expect(200);
  });

  it('sells a whole bale once, numbered by the till, with discount and change', async () => {
    const b1 = await bale('B-00001');
    const body = { clientKey: 'k-1', lines: [{ baleId: b1.id, kind: 'BALE', unitPrice: '40000' }], discount: '1000', payments: [{ method: 'CASH', amount: '40000' }], customerName: 'Walk in' };
    const sale = (await sell(cashier, body).expect(201)).body;
    expect(sale).toMatchObject({ code: 'T1-000001', subtotal: '40000', discount: '1000', total: '39000', paidTotal: '39000', changeGiven: '1000', creditAmount: '0', status: 'COMPLETED' });
    expect(sale.payments).toEqual([expect.objectContaining({ method: 'CASH', amount: '39000' })]);
    expect(sale).not.toHaveProperty('costTotal');
    expect(sale.lines[0]).not.toHaveProperty('unitCost');
    expect((await bale('B-00001')).status).toBe('SOLD');

    // The same tap again returns the same bill; a new bill for that bale is refused.
    expect((await sell(cashier, body).expect(201)).body.code).toBe('T1-000001');
    expect((await sell(cashier, { ...body, clientKey: 'k-2' }).expect(409)).body.code).toBe('BALE_GONE');
    expect(await prisma.sale.count()).toBe(1);
    expect((await api().get(`/api/sales/${sale.id}`).set(as(owner))).body).toMatchObject({ costTotal: '33000', profit: '6000' });
  });

  it('opens a bale and sells pieces until none are left', async () => {
    const b2 = await bale('B-00002');
    const line = (quantity: number) => ({ lines: [{ baleId: b2.id, kind: 'PIECE', quantity, unitPrice: '200' }] });
    expect((await sell(cashier, line(1)).expect(409)).body.code).toBe('NOT_OPENED');
    await api().post(`/api/bales/${b2.id}/open`).set(as(cashier)).send({ pieces: 0 }).expect(400);
    const opened = (await api().post(`/api/bales/${b2.id}/open`).set(as(cashier)).send({ pieces: 180, piecePrice: '200' }).expect(201)).body;
    expect(opened).toMatchObject({ status: 'OPENED', pieces: 180, piecesLeft: 180, piecePrice: '200' });
    await sell(cashier, { lines: [{ baleId: b2.id, kind: 'BALE', unitPrice: '27000' }] }).expect(409);

    const sale = (await sell(cashier, { ...line(30), payments: [{ method: 'WALLET', amount: '6000', reference: 'EP-771' }] }).expect(201)).body;
    expect(sale).toMatchObject({ total: '6000', paidTotal: '6000', changeGiven: '0' });
    expect(sale.payments[0]).toMatchObject({ method: 'WALLET', reference: 'EP-771' });
    expect(await bale('B-00002')).toMatchObject({ piecesSold: 30, piecesLeft: 150, pieceCost: '127.7778' });
    expect((await api().get(`/api/sales/${sale.id}`).set(as(owner))).body.costTotal).toBe('3833.33');

    const short = await sell(cashier, line(151)).expect(409);
    expect(short.body.code).toBe('PIECES_SHORT');
    expect(short.body.message).toContain('150 pieces left');
    await sell(cashier, line(150)).expect(201);
    expect(await bale('B-00002')).toMatchObject({ status: 'FINISHED', piecesLeft: 0 });
  });

  it('refuses bills that do not add up, and holds a cashier to the discount limit', async () => {
    const b3 = await bale('B-00003');
    const one = { baleId: b3.id, kind: 'BALE', unitPrice: '15000' };
    expect((await sell(cashier, { lines: [] }).expect(400)).body.code).toBe('NO_LINES');
    expect((await sell(cashier, { lines: [one, one] }).expect(400)).body.code).toBe('BALE_TWICE');
    expect((await sell(cashier, { lines: [one], discount: '15001' }).expect(400)).body.code).toBe('DISCOUNT_TOO_BIG');
    expect((await sell(cashier, { lines: [one], payments: [{ method: 'CASH', amount: '100' }] }).expect(400)).body.code).toBe('NEEDS_CUSTOMER');
    expect((await sell(cashier, { lines: [one], payments: [{ method: 'BANK', amount: '20000' }] }).expect(400)).body.code).toBe('OVERPAID');
    expect((await sell(cashier, { lines: [{ ...one, unitPrice: '-5' }] }).expect(400)).body.code).toBe('BAD_NUMBER');
    expect((await sell(cashier, { lines: [{ ...one, discount: '3000' }] }).expect(403)).body.code).toBe('DISCOUNT_LIMIT');
    // Lowering the price instead of typing a discount is held to the same limit (the bale's own price is 15,000).
    expect((await sell(cashier, { lines: [{ ...one, unitPrice: '10000' }] }).expect(403)).body.code).toBe('DISCOUNT_LIMIT');
    expect((await bale('B-00003')).status).toBe('IN_STOCK');
  });

  let haji = '';
  let shiftId = '';
  let creditSale = '';
  it('keeps a customer khata: credit sales, the limit, and money received', async () => {
    const c = (await api().post('/api/customers').set(as(cashier)).send({ name: 'Haji Rafiq', phone: '0333 1234567', creditLimit: '10000', openingBalance: '2000' }).expect(201)).body;
    expect(c).toMatchObject({ name: 'Haji Rafiq', phone: '03331234567', balance: '2000' });
    haji = c.id;
    await api().post('/api/customers').set(as(cashier)).send({ name: 'Other', phone: '03331234567' }).expect(409);

    // Split payment: part cash, part wallet, the rest on khata.
    const sale = (await sell(cashier, { lines: [item('500', 2)], customerId: haji, payments: [{ method: 'CASH', amount: '300' }, { method: 'WALLET', amount: '100' }] }).expect(201)).body;
    expect(sale).toMatchObject({ total: '1000', paidTotal: '400', creditAmount: '600', customerName: 'Haji Rafiq' });
    expect(sale.payments).toHaveLength(2);
    creditSale = sale.id;
    expect((await sell(cashier, { lines: [item('9000')], customerId: haji, payments: [] }).expect(403)).body.code).toBe('OVER_LIMIT');

    const after = (await api().post(`/api/customers/${haji}/payments`).set(as(cashier)).send({ amount: '1000', method: 'BANK' }).expect(201)).body;
    expect(after.balance).toBe('1600');
    const khata = (await api().get(`/api/customers/${haji}`).set(as(cashier)).expect(200)).body;
    expect(khata.entries.map((e: { kind: string; amount: string; balanceAfter: string }) => [e.kind, e.amount, e.balanceAfter])).toEqual([
      ['PAYMENT', '-1000', '1600'],
      ['SALE', '600', '2600'],
      ['OPENING', '2000', '2000'],
    ]);
    expect((await api().get('/api/customers?owing=1').set(as(cashier))).body).toMatchObject({ owed: '1600', owing: 1 });
  });

  it('puts sales tax on bills, inside the price or on top', async () => {
    await api().patch('/api/shop').set(as(owner)).send({ taxRate: '10', taxInclusive: false, taxName: 'GST', ntn: '1234567-8' }).expect(200);
    expect((await sell(cashier, { lines: [item('1000')] }).expect(201)).body).toMatchObject({ subtotal: '1000', taxAmount: '100', total: '1100', taxName: 'GST', paidTotal: '1100' });
    await api().patch('/api/shop').set(as(owner)).send({ taxInclusive: true }).expect(200);
    expect((await sell(cashier, { lines: [item('1100')] }).expect(201)).body).toMatchObject({ taxAmount: '100', total: '1100' });
    await api().patch('/api/shop').set(as(owner)).send({ taxRate: '0' }).expect(200);
    expect((await sell(cashier, { lines: [item('50')] }).expect(201)).body).toMatchObject({ taxAmount: '0', total: '50', taxName: null });
  });

  it('runs a cash drawer shift: float, sales, cash out, expense, refund, count', async () => {
    expect((await api().get(`/api/shifts/current?tillId=${till}`).set(as(cashier)).expect(200)).body).toEqual({});
    await api().post('/api/shifts/open').set(as(cashier)).send({ tillId: till, openingFloat: '5000' }).expect(201);
    expect((await api().post('/api/shifts/open').set(as(cashier)).send({ tillId: till, openingFloat: '1' }).expect(409)).body.code).toBe('ALREADY_OPEN');

    const cash = (await sell(cashier, { lines: [item('1000', 2, 'Hangers')], payments: [{ method: 'CASH', amount: '5000' }] }).expect(201)).body;
    expect(cash).toMatchObject({ total: '2000', changeGiven: '3000' });
    await sell(cashier, { lines: [item('500')], payments: [{ method: 'WALLET', amount: '500' }] }).expect(201);
    await api().post(`/api/customers/${haji}/payments`).set(as(cashier)).send({ amount: '300', method: 'CASH', tillId: till }).expect(201);
    await api().post('/api/shifts/cash').set(as(cashier)).send({ tillId: till, kind: 'OUT', amount: '200', reason: 'Tea', clientKey: 'm-1' }).expect(201);
    await api().post('/api/shifts/cash').set(as(cashier)).send({ tillId: till, kind: 'OUT', amount: '200', reason: 'Tea', clientKey: 'm-1' }).expect(201);
    await api().post('/api/expenses').set(as(cashier)).send({ category: 'Rent', amount: '1' }).expect(403);
    await api().post('/api/expenses').set(as(manager)).send({ tillId: till, category: 'Loader', amount: '150' }).expect(201);

    // One of the two hangers comes back for cash. Only a manager may do it.
    await api().post(`/api/sales/${cash.id}/returns`).set(as(cashier)).send({ lines: [{ saleLineId: cash.lines[0].id, quantity: 1 }] }).expect(403);
    const back = (await api().post(`/api/sales/${cash.id}/returns`).set(as(manager)).send({ lines: [{ saleLineId: cash.lines[0].id, quantity: 1 }], refundTo: 'CASH', reason: 'Broken' }).expect(201)).body;
    expect(back.sale).toMatchObject({ returnedTotal: '1000' });
    expect(back.sale.lines[0].returnedQty).toBe(1);

    const now = (await api().get(`/api/shifts/current?tillId=${till}`).set(as(cashier)).expect(200)).body;
    // 5000 float + 2000 cash sale + 300 khata - 200 tea - 150 loader - 1000 refund.
    expect(now.summary).toMatchObject({ bills: 2, salesTotal: '2500', cashSales: '2000', walletSales: '500', khataCash: '300', cashOut: '200', cashExpenses: '150', cashRefunds: '1000', expectedCash: '5950' });
    expect(now.summary.moves).toHaveLength(1);

    const closed = (await api().post('/api/shifts/close').set(as(cashier)).send({ tillId: till, countedCash: '5900' }).expect(201)).body;
    expect(closed).toMatchObject({ expectedCash: '5950', countedCash: '5900', difference: '-50', closedByName: 'Bilal' });
    await api().post('/api/shifts/close').set(as(cashier)).send({ tillId: till, countedCash: '1' }).expect(409);
    const shifts = (await api().get('/api/shifts').set(as(manager)).expect(200)).body;
    expect(shifts).toHaveLength(1);
    // The cashier who ran it may read its report; in another branch it does not exist.
    await api().get(`/api/shifts/${shifts[0].id}`).set(as(cashier)).expect(200);
    shiftId = shifts[0].id;
  });

  it('takes a bale back onto the shelf, and will not cancel a bill that has a return', async () => {
    const b3 = await bale('B-00003');
    const sale = (await sell(cashier, { lines: [{ baleId: b3.id, kind: 'BALE', unitPrice: '15000' }], customerId: haji, payments: [{ method: 'CASH', amount: '15000' }] }).expect(201)).body;
    expect((await bale('B-00003')).status).toBe('SOLD');
    const back = (await api().post(`/api/sales/${sale.id}/returns`).set(as(manager)).send({ lines: [{ saleLineId: sale.lines[0].id }], refundTo: 'KHATA' }).expect(201)).body;
    expect(back.sale).toMatchObject({ returnedTotal: '15000' });
    expect((await bale('B-00003')).status).toBe('IN_STOCK');
    // 1600 - 300 paid in the shift - 15000 refunded to khata: the shop now owes the customer.
    expect((await api().get(`/api/customers/${haji}`).set(as(cashier))).body.balance).toBe('-13700');
    expect((await api().post(`/api/sales/${sale.id}/returns`).set(as(manager)).send({ lines: [{ saleLineId: sale.lines[0].id }] }).expect(409)).body.code).toBe('TOO_MANY');
    expect((await api().post(`/api/sales/${sale.id}/cancel`).set(as(manager)).send({}).expect(409)).body.code).toBe('NOT_CANCELLABLE');
    expect((await api().get(`/api/sales/${sale.id}`).set(as(owner))).body.profit).toBe('0');
  });

  it('lets a manager cancel a bill: stock and khata go back', async () => {
    await api().post(`/api/sales/${creditSale}/cancel`).set(as(cashier)).send({}).expect(403);
    const cancelled = (await api().post(`/api/sales/${creditSale}/cancel`).set(as(manager)).send({ reason: 'Wrong customer' }).expect(201)).body;
    expect(cancelled).toMatchObject({ status: 'CANCELLED', cancelReason: 'Wrong customer' });
    expect((await api().get(`/api/customers/${haji}`).set(as(cashier))).body.balance).toBe('-14300');
    await api().post(`/api/sales/${creditSale}/cancel`).set(as(manager)).send({}).expect(409);

    const first = (await api().get('/api/sales?search=T1-000001').set(as(owner))).body.sales[0];
    await api().post(`/api/sales/${first.id}/cancel`).set(as(owner)).send({}).expect(201);
    expect((await bale('B-00001')).status).toBe('IN_STOCK');
    expect((await api().get('/api/shop/activity').set(as(owner)).expect(200)).body.map((a: { action: string }) => a.action)).toEqual(expect.arrayContaining(['Bill cancelled', 'Return', 'Drawer difference']));
  });

  it('holds a bill and gives it to one till only', async () => {
    const held = (await api().post('/api/held').set(as(cashier)).send({ label: 'Lady in blue', total: '900', payload: { lines: [1, 2] } }).expect(201)).body;
    expect((await api().get('/api/held').set(as(manager)).expect(200)).body).toHaveLength(1);
    expect((await api().delete(`/api/held/${held.id}`).set(as(manager)).expect(200)).body.payload).toEqual({ lines: [1, 2] });
    await api().delete(`/api/held/${held.id}`).set(as(cashier)).expect(404);
  });

  let saddar = '';
  const inSaddar = () => ({ ...as(owner), 'X-Branch': saddar });
  it('keeps each branch to its own stock, and moves bales between branches', async () => {
    const branch = (await api().post('/api/shop/branches').set(as(owner)).send({ name: 'Saddar', city: 'Karachi' }).expect(201)).body;
    saddar = branch.id;
    expect(branch.tills[0].code).toBe('T2');
    await api().post('/api/shop/branches').set(as(owner)).send({ name: 'saddar' }).expect(409);
    expect((await api().get('/api/bales').set(inSaddar())).body.total).toBe(0);
    expect((await api().get('/api/sales').set(inSaddar())).body.sales).toHaveLength(0);
    await api().get(`/api/shifts/${shiftId}`).set(inSaddar()).expect(404);

    const b1 = await bale('B-00001');
    await api().post('/api/transfers').set(as(cashier)).send({ toBranchId: saddar, baleIds: [b1.id] }).expect(403);
    const sent = (await api().post('/api/transfers').set(as(manager)).send({ toBranchId: saddar, baleIds: [b1.id] }).expect(201)).body;
    expect(sent).toMatchObject({ code: 'TR-0001', bales: 1 });
    expect((await bale('B-00001')).status).toBe('IN_TRANSIT');
    expect((await sell(cashier, { lines: [{ baleId: b1.id, kind: 'BALE', unitPrice: '40000' }] }).expect(409)).body.code).toBe('BALE_GONE');
    // The sender cannot receive it; the other branch can.
    await api().post(`/api/transfers/${sent.id}/receive`).set(as(manager)).expect(404);
    expect((await api().get('/api/transfers').set(inSaddar())).body[0]).toMatchObject({ incoming: true, fromName: 'Main shop', status: 'SENT' });
    await api().post(`/api/transfers/${sent.id}/receive`).set(inSaddar()).expect(201);
    expect((await api().get('/api/bales').set(inSaddar())).body.total).toBe(1);
    await api().get('/api/bales/by-code/B-00001').set(as(cashier)).expect(404);
  });

  it('keeps an offline bill even when the stock is gone, and marks it for review', async () => {
    const b1 = (await api().get('/api/bales/by-code/B-00001').set(inSaddar())).body;
    const body = { clientKey: 'off-1', lines: [{ baleId: b1.id, kind: 'BALE', unitPrice: '40000' }], payments: [{ method: 'CASH', amount: '40000' }], offline: { code: 'T1-000050', soldAt: '2026-11-13T09:00:00.000Z' } };
    const sale = (await sell(cashier, body).expect(201)).body;
    expect(sale).toMatchObject({ code: 'T1-000050', madeOffline: true, needsReview: true, total: '40000', soldAt: '2026-11-13T09:00:00.000Z' });
    expect(sale.reviewNote).toContain('another branch');
    expect(sale.lines[0].conflict).toBe(true);
    expect((await sell(cashier, body).expect(201)).body.id).toBe(sale.id);
    expect((await api().get('/api/bales/by-code/B-00001').set(inSaddar())).body.status).toBe('IN_STOCK');
    // The till's counter moved past the offline number; the same number sent by another bill is renumbered.
    expect((await sell(cashier, { lines: [item('10')] }).expect(201)).body.code).toBe('T1-000051');
    const clash = (await sell(cashier, { clientKey: 'off-2', lines: [item('10')], offline: { code: 'T1-000050' } }).expect(201)).body;
    expect(clash).toMatchObject({ code: 'T1-000052', needsReview: true });

    expect((await api().get('/api/sales?review=1').set(as(manager))).body.sales).toHaveLength(2);
    expect((await api().get(`/api/sync/snapshot?tillId=${till}`).set(as(manager))).body).toMatchObject({ review: 2, till: { code: 'T1', billSeq: 52 } });
    expect((await api().post(`/api/sales/${sale.id}/reviewed`).set(as(manager)).expect(201)).body.needsReview).toBe(false);
  });

  it('gives a till everything it needs to sell offline, without costs', async () => {
    const snap = (await api().get(`/api/sync/snapshot?tillId=${till}`).set(as(cashier)).expect(200)).body;
    expect(snap.shop.name).toBe('Lunda Bazaar');
    expect(snap.branch.name).toBe('Main shop');
    expect(snap.bales.map((b: { code: string }) => b.code).sort()).toEqual(['B-00003', 'B-00004', 'B-00005', 'B-00006']);
    expect(snap.bales[0]).not.toHaveProperty('landedCost');
    expect(snap.customers[0]).toMatchObject({ name: 'Haji Rafiq' });
    expect(snap.review).toBe(0);
  });

  it('counts the shelf and lists what is missing', async () => {
    const check = (await api().post('/api/stock-checks').set(as(manager)).expect(201)).body;
    expect(check).toMatchObject({ expected: 4, found: 0 });
    expect((await api().post(`/api/stock-checks/${check.id}/scan`).set(as(cashier)).send({ code: 'b-00003' }).expect(201)).body).toMatchObject({ again: false, found: 1 });
    expect((await api().post(`/api/stock-checks/${check.id}/scan`).set(as(cashier)).send({ code: 'B-00003' }).expect(201)).body).toMatchObject({ again: true, found: 1 });
    expect((await api().post(`/api/stock-checks/${check.id}/scan`).set(as(cashier)).send({ code: 'B-00001' }).expect(409)).body.code).toBe('OTHER_BRANCH');
    const done = (await api().post(`/api/stock-checks/${check.id}/finish`).set(as(manager)).expect(201)).body;
    expect(done.found).toBe(1);
    expect(done.missing.map((b: { code: string }) => b.code)).toEqual(['B-00004', 'B-00005', 'B-00006']);
    // A missing bale is written off with a reason.
    await api().post(`/api/bales/${done.missing[0].id}/write-off`).set(as(manager)).send({ reason: 'Not found in stock check' }).expect(201);
    expect((await api().get('/api/bales').set(as(cashier))).body.total).toBe(3);
  });

  it('reports sales and stock, with profit only for those allowed', async () => {
    const mine = (await api().get('/api/reports/sales?from=2026-01-01T00:00:00.000Z&to=2030-01-01T00:00:00.000Z').set(as(owner)).expect(200)).body;
    expect(mine.totals).toHaveProperty('profit');
    expect(mine.totals.bills).toBeGreaterThan(5);
    expect(mine.byMethod.map((m: { key: string }) => m.key)).toEqual(['CASH', 'BANK', 'WALLET']);
    expect(mine.byCategory.find((c: { key: string }) => c.key === 'Tops')).toMatchObject({ quantity: 180, sales: '36000' });
    expect(mine.expenses).toEqual([{ key: 'Loader', amount: '150' }]);
    const theirs = (await api().get('/api/reports/sales?from=2026-01-01T00:00:00.000Z&to=2030-01-01T00:00:00.000Z').set(as(manager)).expect(200)).body;
    expect(theirs.totals).not.toHaveProperty('profit');
    expect(theirs.totals.sales).toBe(mine.totals.sales);

    const stock = (await api().get('/api/reports/stock?branch=all').set(as(owner)).expect(200)).body;
    expect(stock.totals).toMatchObject({ closed: 4, opened: 0 });
    expect(stock.shipments).toHaveLength(2);
    expect((await api().get('/api/reports/stock').set(as(manager))).body.shipments).toEqual([]);
  });

  // ---- Shared bale codes ----

  const KINDS = [
    'Bale no,Item,Category,Grade,Weight kg,Pieces,Cost,Bale sale price',
    'K-1,Mens denim,Denim,1,45,,1000,2000',
    'K-2,Ladies denim,Denim,1,45,,1100,2000',
    'K-3,Mens denim,denim,1,45.00,,1200,2000',
    'K-4,Mens denim,Denim,1,45.5,,1000,2000', // another weight: another kind
    'K-5,Mens denim,Denim,Grade A,,200,1000,2000',
    'K-6,Mens denim,Den im,1,45,,1000,2000', // reads the same as Denim-1-45, but is another kind
    'K-7,Kapray,کپڑے,,45,,1000,2000',
  ].join('\n');
  const own = async (baleNo: string) => prisma.bale.findFirstOrThrow({ where: { baleNo } });
  const denim = { kind: 'BALE', kindCode: 'DENIM-1-45', unitPrice: '2000' };

  it('gives bales of the same kind one shared code, another weight another code, and a clash a suffix', async () => {
    const res = await upload('/api/shipments', owner, { supplierName: 'Kind Traders', arrivedOn: '2026-11-15' }, KINDS).expect(201);
    const bales = (await api().get(`/api/shipments/${res.body.id}`).set(as(owner))).body.bales;
    expect(bales.map((b: { kindCode: string }) => b.kindCode)).toEqual(['DENIM-1-45', 'DENIM-1-45', 'DENIM-1-45', 'DENIM-1-45.5', 'DENIM-A-200P', 'DENIM-1-45-2', 'K-45']);
    // Every bale is still its own record: own number, own cost.
    expect(new Set(bales.map((b: { code: string }) => b.code)).size).toBe(7);
    expect(bales.slice(0, 3).map((b: { landedCost: string }) => b.landedCost)).toEqual(['1000', '1100', '1200']);

    // A later shipment of the same kind joins the code.
    const more = await upload('/api/shipments', owner, { supplierName: 'Kind Traders', arrivedOn: '2026-11-16' }, 'Bale no,Item,Category,Grade,Weight kg,Cost,Bale sale price\nK-8,Mens denim,DENIM,1,45,1300,2000').expect(201);
    const k8 = (await api().get(`/api/shipments/${more.body.id}`).set(as(owner))).body.bales[0];
    expect(k8.kindCode).toBe('DENIM-1-45');
  });

  it('gives bales saved before shared codes their code by the same rule, oldest first', async () => {
    const codes = async () => (await prisma.bale.findMany({ where: { baleNo: { startsWith: 'K-' } }, select: { baleNo: true, kindCode: true }, orderBy: { code: 'asc' } })).map((b) => [b.baleNo, b.kindCode]);
    const before = await codes();
    await prisma.bale.updateMany({ data: { kindCode: null } });
    await prisma.baleKind.deleteMany();
    expect(await backfillKinds(prisma)).toBe(await prisma.bale.count());
    // The same codes as the import gave, the clash suffix included.
    expect(await codes()).toEqual(before);
    expect(before).toContainEqual(['K-6', 'DENIM-1-45-2']);
    expect(await prisma.bale.count({ where: { kindCode: null } })).toBe(0);
    expect(await backfillKinds(prisma)).toBe(0); // nothing left to do

    // A code is fixed once given: renaming the category later does not change it.
    const k8 = await own('K-8');
    await api().patch(`/api/bales/${k8.id}`).set(as(owner)).send({ category: 'Jeans' }).expect(200);
    expect((await own('K-8')).kindCode).toBe('DENIM-1-45');
  });

  it('shows stock as one row per kind with quantity, kg and value, and value only to those who see cost', async () => {
    const rows = (await api().get('/api/bales/kinds?search=denim').set(as(owner)).expect(200)).body.kinds;
    expect(rows.find((k: { code: string }) => k.code === 'DENIM-1-45')).toMatchObject({ name: 'Denim · 1', qty: 4, kg: '180', value: '4600', salePrice: '2000' });
    expect(rows.find((k: { code: string }) => k.code === 'DENIM-1-45.5')).toMatchObject({ qty: 1, kg: '45.5' });
    const seen = (await api().get('/api/bales/kinds').set(as(cashier)).expect(200)).body.kinds;
    expect(seen.find((k: { code: string }) => k.code === 'DENIM-1-45')).toMatchObject({ qty: 4 });
    expect(seen[0]).not.toHaveProperty('value');
    // A row opens the bales behind it.
    const behind = (await api().get('/api/bales?status=IN_STOCK&kind=DENIM-1-45').set(as(owner))).body;
    expect(behind.total).toBe(4);
  });

  it('finds the kind by its shared code (oldest whole bale, how many), and one bale by its old sticker', async () => {
    const k1 = await own('K-1');
    const found = await bale('denim-1-45', cashier);
    expect(found).toMatchObject({ id: k1.id, kindCode: 'DENIM-1-45', kind: { code: 'DENIM-1-45', qty: 4 } });
    expect(found).not.toHaveProperty('landedCost');
    // A sticker printed before shared codes carries the bale's own number, and still finds that bale.
    const k3 = await own('K-3');
    const old = await bale(k3.code, cashier);
    expect(old).toMatchObject({ id: k3.id, kindCode: 'DENIM-1-45' });
    expect(old).not.toHaveProperty('kind');
  });

  it('sells a quantity of a kind: the oldest bales, each with its own cost', async () => {
    const sale = (await sell(manager, { lines: [{ ...denim, quantity: 2, discount: '100' }] }).expect(201)).body;
    expect(sale).toMatchObject({ subtotal: '3900', total: '3900' });
    const [k1, k2, k3, k8] = await Promise.all(['K-1', 'K-2', 'K-3', 'K-8'].map(own));
    const full = (await api().get(`/api/sales/${sale.id}`).set(as(owner))).body;
    // One line per bale behind the scenes, at the same price; the discount is shared between them.
    expect(full.lines.map((l: { bale: { code: string; kindCode: string }; quantity: number; unitPrice: string; lineTotal: string; unitCost: string }) => [l.bale.code, l.bale.kindCode, l.quantity, l.unitPrice, l.lineTotal, l.unitCost])).toEqual([
      [k1.code, 'DENIM-1-45', 1, '2000', '1950', '1000'],
      [k2.code, 'DENIM-1-45', 1, '2000', '1950', '1100'],
    ]);
    expect(full).toMatchObject({ costTotal: '2100', profit: '1800' });
    expect([k1.status, k2.status, k3.status, k8.status]).toEqual(['SOLD', 'SOLD', 'IN_STOCK', 'IN_STOCK']);

    // Asking for more than is in stock sells nothing.
    const short = (await sell(manager, { lines: [{ ...denim, quantity: 3 }, item('50')] }).expect(409)).body;
    expect(short).toMatchObject({ code: 'KIND_SHORT', message: 'Only 2 of DENIM-1-45 in stock.' });
    expect((await own('K-3')).status).toBe('IN_STOCK');
    expect((await bale('DENIM-1-45')).kind.qty).toBe(2);

    // A kind line and one of its own bales on one bill never take the same bale twice.
    expect((await sell(manager, { lines: [{ baleId: k3.id, kind: 'BALE', unitPrice: '2000' }, { ...denim, quantity: 2 }] }).expect(409)).body.message).toBe('Only 1 of DENIM-1-45 in stock.');
    const both = (await sell(manager, { lines: [{ ...denim, quantity: 1 }, { baleId: k3.id, kind: 'BALE', unitPrice: '2000' }] }).expect(201)).body;
    expect(both.lines.map((l: { bale: { code: string } }) => l.bale.code)).toEqual([k8.code, k3.code]);
    await sell(manager, { lines: [{ ...denim, quantity: 1 }] }).expect(409);
    await sell(manager, { lines: [{ kind: 'BALE', kindCode: 'NO-SUCH-1', quantity: 1, unitPrice: '1' }] }).expect(404);

    // Cancel and return work per bale, as before: the bales go back and the kind is in stock again.
    await api().post(`/api/sales/${both.id}/cancel`).set(as(manager)).send({ reason: 'test' }).expect(201);
    const back = (await api().post(`/api/sales/${sale.id}/returns`).set(as(manager)).send({ lines: [{ saleLineId: full.lines[0].id, quantity: 1 }], refundTo: 'CASH' }).expect(201)).body;
    expect(back.sale.returnedTotal).toBe('1950');
    expect((await bale('DENIM-1-45')).kind.qty).toBe(3);
    expect((await bale('DENIM-1-45')).id).toBe(k1.id); // the oldest again
  });

  it('holds a cashier to the discount limit on a kind line too', async () => {
    expect((await sell(cashier, { lines: [{ ...denim, quantity: 2, unitPrice: '1000' }] }).expect(403)).body.code).toBe('DISCOUNT_LIMIT');
    expect((await bale('DENIM-1-45')).kind.qty).toBe(3);
  });

  it('keeps an offline bill of a kind that came up short, and marks it for review', async () => {
    const sale = (await sell(manager, { lines: [{ ...denim, quantity: 4 }], offline: { code: 'T1-000900', soldAt: new Date().toISOString() } }).expect(201)).body;
    expect(sale).toMatchObject({ code: 'T1-000900', total: '8000', needsReview: true });
    expect(sale.reviewNote).toContain('Only 3 of DENIM-1-45 were in stock');
    expect(sale.lines.map((l: { conflict: boolean }) => l.conflict)).toEqual([false, false, false, true]);
    await api().post(`/api/sales/${sale.id}/cancel`).set(as(manager)).send({ reason: 'test' }).expect(201);
    expect((await bale('DENIM-1-45')).kind.qty).toBe(3);
  });

  it('counts a kind in a stock check one scan at a time', async () => {
    const check = (await api().post('/api/stock-checks').set(as(manager)).expect(201)).body;
    const scan = async (code: string) => (await api().post(`/api/stock-checks/${check.id}/scan`).set(as(cashier)).send({ code })).body;
    expect(await scan('DENIM-1-45')).toMatchObject({ again: false, kind: { counted: 1, total: 3 } });
    expect(await scan((await own('K-3')).code)).toMatchObject({ again: false }); // an old sticker counts that very bale
    expect(await scan('denim-1-45')).toMatchObject({ again: false, kind: { counted: 3, total: 3 } });
    expect(await scan('DENIM-1-45')).toMatchObject({ again: true, kind: { counted: 3, total: 3 } });
    const done = (await api().post(`/api/stock-checks/${check.id}/finish`).set(as(manager)).expect(201)).body;
    expect(done.missing.some((b: { kindCode: string }) => b.kindCode === 'DENIM-1-45')).toBe(false);
  });

  // ---- Currency, stock by hand, exchange, returns to a supplier ----

  it("keeps the shop's own currency and the suppliers' usual one", async () => {
    const shop = (await api().patch('/api/shop').set(as(owner)).send({ currency: 'pkr', supplierCurrency: 'USD', rateMode: 'MANUAL' }).expect(200)).body;
    expect(shop).toMatchObject({ currency: 'PKR', currencySign: 'Rs', supplierCurrency: 'USD', rateMode: 'MANUAL' });
    expect((await api().patch('/api/shop').set(as(owner)).send({ currency: 'rupees' }).expect(400)).body.code).toBe('BAD_CURRENCY');
    expect((await api().get('/api/auth/me').set(as(owner))).body.shop).toMatchObject({ currency: 'PKR', supplierCurrency: 'USD' });
  });

  it("fetches today's rate, and says so when it cannot", async () => {
    const asked: string[] = [];
    const rates = createHttp((req, res) => {
      asked.push(req.url ?? '');
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ result: 'success', time_last_update_utc: 'Mon, 16 Nov 2026 00:02:31 +0000', rates: { USD: 1, PKR: 278.5, GBP: 0.79 } }));
    });
    await new Promise<void>((r) => rates.listen(9117, '127.0.0.1', r));
    process.env.POS_RATES_URL = 'http://127.0.0.1:9117/latest';
    expect((await api().get('/api/rates?from=usd').set(as(owner)).expect(200)).body).toMatchObject({ from: 'USD', to: 'PKR', rate: '278.5', at: '2026-11-16T00:02:31.000Z' });
    expect((await api().get('/api/rates?from=USD&to=GBP').set(as(owner)).expect(200)).body.rate).toBe('0.79');
    expect(asked).toEqual(['/latest/USD']); // kept for an hour: only the currency code was sent, once
    expect((await api().get('/api/rates?from=PKR').set(as(owner)).expect(200)).body.rate).toBe('1');
    await api().get('/api/rates?from=USD').set(as(cashier)).expect(403);
    await api().get('/api/rates?from=dollars').set(as(owner)).expect(400);
    await new Promise((r) => rates.close(r));
    expect((await api().get('/api/rates?from=EUR').set(as(owner)).expect(502)).body.code).toBe('RATE_OFF');
  });

  const DOLLARS = ['Item,Category,Weight kg,Cost ($),Bale sale price', 'Shirts,Shirts,40,$100,45000', 'Shirts,Shirts,40,$120,45000'].join('\n');

  it("reads a list in another currency and saves its costs in the shop's own", async () => {
    const details = { supplierName: 'Dollar Traders', arrivedOn: '2026-11-16', freight: '2000' };
    const seen = (await upload('/api/shipments/preview', owner, details, DOLLARS).expect(201)).body;
    expect(seen.currency).toMatchObject({ detected: 'USD', list: 'USD', local: 'PKR', foreign: true, needsRate: true, goodsCostForeign: '220' });
    expect((await upload('/api/shipments', owner, details, DOLLARS).expect(400)).body.code).toBe('NEEDS_RATE');
    expect((await upload('/api/shipments/preview', owner, { ...details, rate: 'abc' }, DOLLARS).expect(400)).body.code).toBe('BAD_RATE');

    const priced = (await upload('/api/shipments/preview', owner, { ...details, rate: '280' }, DOLLARS).expect(201)).body;
    expect(priced.currency).toMatchObject({ needsRate: false, rate: '280' });
    expect(priced.summary).toMatchObject({ goodsCost: '61600', charges: '2000', landedCost: '63600' });

    const res = await upload('/api/shipments', owner, { ...details, rate: '280' }, DOLLARS).expect(201);
    const saved = (await api().get(`/api/shipments/${res.body.id}`).set(as(owner))).body;
    expect(saved).toMatchObject({ currency: 'USD', exchangeRate: '280', goodsCostForeign: '220', goodsCost: '61600', landedCost: '63600', manual: false });
    // Costs are converted; charges and selling prices are the shop's own and are not.
    expect(saved.bales.map((b: { cost: string; costForeign: string; landedCost: string; salePrice: string }) => [b.costForeign, b.cost, b.landedCost, b.salePrice])).toEqual([
      ['100', '28000', '29000', '45000'],
      ['120', '33600', '34600', '45000'],
    ]);

    // The owner can say the list is in the shop's own currency after all: nothing is converted.
    const plain = (await upload('/api/shipments/preview', owner, { ...details, currency: 'PKR' }, DOLLARS).expect(201)).body;
    expect(plain.currency).toMatchObject({ list: 'PKR', detected: 'USD', foreign: false, needsRate: false });
    expect(plain.summary.goodsCost).toBe('220');
  });

  it('adds stock typed by hand, a quantity of each kind', async () => {
    const towels = { item: 'Bath towels', category: 'Towels', grade: 'A', weightKg: 20, cost: 5000, salePrice: 7000, quantity: 3 };
    await api().post('/api/shipments/manual').set(as(cashier)).send({ rows: [towels] }).expect(403);
    expect((await api().post('/api/shipments/manual').set(as(owner)).send({ rows: [] }).expect(400)).body.code).toBe('NO_ROWS');
    expect((await api().post('/api/shipments/manual').set(as(owner)).send({ rows: [{ ...towels, baleNo: 'X-1' }] }).expect(400)).body.code).toBe('BALE_NO_ONCE');
    expect((await api().post('/api/shipments/manual').set(as(owner)).send({ rows: [{ ...towels, item: '' }] }).expect(400)).body.code).toBe('REQUIRED');
    expect((await api().post('/api/shipments/manual').set(as(owner)).send({ rows: [towels], currency: 'GBP' }).expect(400)).body.code).toBe('NEEDS_RATE');

    const res = (await api().post('/api/shipments/manual').set(as(owner)).send({ rows: [towels, { item: 'Belts', cost: '£10', quantity: 1 }], currency: 'GBP', rate: 350, transport: 400 }).expect(201)).body;
    expect(res.bales).toBe(4);
    const saved = (await api().get(`/api/shipments/${res.id}`).set(as(owner))).body;
    expect(saved).toMatchObject({ manual: true, fileName: null, currency: 'GBP', exchangeRate: '350', baleCount: 4 });
    expect(saved.supplier.name).toBe('Added by hand');
    expect(saved.bales.map((b: { kindCode: string; cost: string; landedCost: string; status: string }) => [b.kindCode, b.cost, b.landedCost, b.status])).toEqual([
      ['TOWELS-A-20', '1750000', '1750100', 'IN_STOCK'],
      ['TOWELS-A-20', '1750000', '1750100', 'IN_STOCK'],
      ['TOWELS-A-20', '1750000', '1750100', 'IN_STOCK'],
      ['BELTS', '3500', '3600', 'IN_STOCK'],
    ]);
    expect((await bale('TOWELS-A-20')).kind.qty).toBe(3);
  });

  it('finds the bill by the goods when the customer has none, and lists the returns', async () => {
    const towels = { kind: 'BALE', kindCode: 'TOWELS-A-20', unitPrice: '7000' };
    const sale = (await sell(manager, { lines: [{ ...towels, quantity: 2 }], customerName: 'No Bill Bibi' }).expect(201)).body;
    await api().get('/api/sales/by-goods/TOWELS-A-20').set(as(cashier)).expect(403);
    const byKind = (await api().get('/api/sales/by-goods/towels-a-20').set(as(manager)).expect(200)).body;
    expect(byKind.map((l: { sale: { code: string; customerName: string }; left: number }) => [l.sale.code, l.sale.customerName, l.left])).toEqual([[sale.code, 'No Bill Bibi', 1], [sale.code, 'No Bill Bibi', 1]]);
    // The bale's own number finds the one line that sold that bale.
    const byBale = (await api().get(`/api/sales/by-goods/${sale.lines[0].bale.code}`).set(as(manager)).expect(200)).body;
    expect(byBale.map((l: { id: string }) => l.id)).toEqual([sale.lines[0].id]);
    expect((await api().get('/api/sales/by-goods/NOPE-1').set(as(manager)).expect(200)).body).toEqual([]);

    // "Exchange" cannot be asked for as a plain refund: it would give nothing back and sell nothing.
    const back = (await api().post(`/api/sales/${sale.id}/returns`).set(as(manager)).send({ lines: [{ saleLineId: sale.lines[0].id, quantity: 1 }], refundTo: 'EXCHANGE' }).expect(201)).body;
    expect(back.sale.returns[0]).toMatchObject({ code: back.code, refundTo: 'CASH', total: '7000' });
    expect((await api().get('/api/sales/by-goods/TOWELS-A-20').set(as(manager))).body).toHaveLength(1);

    const day = (await api().get('/api/sales/returns').set(as(manager)).expect(200)).body;
    expect(day.returns[0]).toMatchObject({ code: back.code, total: '7000', refundTo: 'CASH', items: 1, userName: 'Sana', sale: { code: sale.code } });
    expect(day.returns[0]).not.toHaveProperty('costBack');
    await api().get('/api/sales/returns').set(as(cashier)).expect(403);
  });

  it('exchanges goods: what comes back pays for the new bill, all or nothing', async () => {
    const old = (await api().get('/api/sales?search=No Bill Bibi').set(as(manager))).body.sales[0];
    const towelBill = (await api().get(`/api/sales/${old.id}`).set(as(owner))).body;
    const towelLine = towelBill.lines.find((l: { returnedQty: number }) => l.returnedQty === 0);
    const exchange = { saleId: towelBill.id, lines: [{ saleLineId: towelLine.id, quantity: 1 }], reason: 'Wanted denim' };
    const denimLine = { kind: 'BALE', kindCode: 'DENIM-1-45', quantity: 1, unitPrice: '2000' };

    expect((await sell(cashier, { lines: [denimLine], exchange }).expect(403)).body.code).toBe('MANAGER_ONLY');
    expect((await sell(manager, { lines: [denimLine], exchange, offline: { code: 'T1-000950', soldAt: new Date().toISOString() } }).expect(400)).body.code).toBe('EXCHANGE_ONLINE');
    // The new bill fails (nothing in stock), so nothing comes back either.
    await sell(manager, { lines: [{ ...denimLine, quantity: 9 }], exchange }).expect(409);
    expect((await api().get(`/api/sales/${towelBill.id}`).set(as(owner))).body.returnedTotal).toBe('7000');

    // A towel bale worth 7,000 comes back for denim worth 2,000: nothing to pay, 5,000 goes back in cash.
    const bill = (await sell(manager, { lines: [denimLine], exchange }).expect(201)).body;
    expect(bill).toMatchObject({ total: '2000', exchangeAmount: '2000', paidTotal: '0', changeGiven: '5000', creditAmount: '0' });
    expect(bill.exchangeOf).toMatchObject({ total: '7000', sale: { code: towelBill.code } });
    expect(bill.payments).toEqual([]);
    const after = (await api().get(`/api/sales/${towelBill.id}`).set(as(owner))).body;
    expect(after.returnedTotal).toBe('14000');
    expect(after.returns[1]).toMatchObject({ refundTo: 'EXCHANGE', total: '7000', reason: 'Wanted denim' });
    expect((await bale('TOWELS-A-20')).kind.qty).toBe(3); // both towel bales are back with the third
    // The same goods cannot come back twice.
    expect((await sell(manager, { lines: [denimLine], exchange }).expect(409)).body.code).toBe('TOO_MANY');

    // The other way: denim worth 2,000 comes back for towels worth 7,000, and the customer pays 5,000.
    const swap = { saleId: bill.id, lines: [{ saleLineId: bill.lines[0].id, quantity: 1 }] };
    const towel = { kind: 'BALE', kindCode: 'TOWELS-A-20', quantity: 1, unitPrice: '7000' };
    expect((await sell(manager, { lines: [towel], exchange: swap, payments: [{ method: 'CASH', amount: '1000' }] }).expect(400)).body.code).toBe('NEEDS_CUSTOMER');
    const second = (await sell(manager, { lines: [towel], exchange: swap, payments: [{ method: 'CASH', amount: '6000' }] }).expect(201)).body;
    expect(second).toMatchObject({ total: '7000', exchangeAmount: '2000', paidTotal: '5000', changeGiven: '1000' });
    expect(second.payments).toEqual([expect.objectContaining({ method: 'CASH', amount: '5000' })]);
    expect((await bale('DENIM-1-45')).kind.qty).toBe(3);

    // An exchange bill is not cancelled (part of it was paid in goods); a return on it gives its full worth back.
    expect((await api().post(`/api/sales/${second.id}/cancel`).set(as(manager)).send({ reason: 'x' }).expect(409)).body.code).toBe('IS_EXCHANGE');
    const day = (await api().get('/api/sales/returns').set(as(manager))).body;
    expect(day.summary.byRefund.EXCHANGE).toBe('9000'); // the two exchanges; cash refunds of the day are counted apart
    expect(day.returns[0]).toMatchObject({ refundTo: 'EXCHANGE', exchangeSale: { code: second.code } });
  });

  it('sends bales back to the supplier, who then owes the shop for them', async () => {
    const shirts = await prisma.bale.findMany({ where: { item: 'Shirts' }, orderBy: { code: 'asc' } });
    const towel = await prisma.bale.findFirstOrThrow({ where: { kindCode: 'TOWELS-A-20', status: 'IN_STOCK' } });
    const ids = shirts.map((b) => b.id);
    await api().post('/api/supplier-returns').set(as(manager)).send({ baleIds: ids }).expect(403);
    expect((await api().post('/api/supplier-returns').set(as(owner)).send({ baleIds: [...ids, towel.id] }).expect(400)).body.code).toBe('ONE_SUPPLIER');
    expect((await api().post('/api/supplier-returns').set(as(owner)).send({ baleIds: [] }).expect(400)).body.code).toBe('NO_BALES');

    // Left empty, the amount is what the bales cost, without the shop's own charges.
    const made = (await api().post('/api/supplier-returns').set(as(owner)).send({ baleIds: ids, reason: 'Wet bales' }).expect(201)).body;
    expect(made).toMatchObject({ code: 'SR-0001', bales: 2, amount: '61600' });
    expect((await prisma.bale.findMany({ where: { id: { in: ids } } })).map((b) => b.status)).toEqual(['RETURNED_TO_SUPPLIER', 'RETURNED_TO_SUPPLIER']);
    expect((await api().get('/api/bales/by-code/SHIRTS-40').set(as(owner)).expect(409)).body.code).toBe('NONE_IN_STOCK');
    expect((await api().post('/api/supplier-returns').set(as(owner)).send({ baleIds: ids }).expect(409)).body.code).toBe('NOT_ON_SHELF');

    const list = (await api().get('/api/supplier-returns').set(as(owner)).expect(200)).body;
    expect(list.owed).toEqual([expect.objectContaining({ name: 'Dollar Traders', amount: '61600', returns: 1 })]);
    const one = (await api().get(`/api/supplier-returns/${made.id}`).set(as(owner)).expect(200)).body;
    expect(one.lines.map((l: { amount: string; bale: { kindCode: string } }) => [l.bale.kindCode, l.amount])).toEqual([['SHIRTS-40', '28000'], ['SHIRTS-40', '33600']]);

    expect((await api().post(`/api/supplier-returns/${made.id}/settle`).set(as(owner)).send({ note: 'Taken off invoice 12' }).expect(201)).body.settledNote).toBe('Taken off invoice 12');
    expect((await api().get('/api/supplier-returns').set(as(owner))).body.owed).toEqual([]);
    await api().post(`/api/supplier-returns/${made.id}/undo`).set(as(owner)).expect(404);

    // A typed amount is used as it is; a return made by mistake puts the bales back.
    const other = (await api().post('/api/supplier-returns').set(as(owner)).send({ baleIds: [towel.id], amount: '4000' }).expect(201)).body;
    expect(other).toMatchObject({ code: 'SR-0002', amount: '4000' });
    await api().post(`/api/supplier-returns/${other.id}/undo`).set(as(owner)).expect(201);
    expect((await prisma.bale.findUniqueOrThrow({ where: { id: towel.id } })).status).toBe('IN_STOCK');
    expect(await prisma.supplierReturn.count()).toBe(1);
  });

  it('keeps kinds to their own business: another one cannot see, scan or sell them', async () => {
    const other = await prisma.shop.create({ data: { name: 'Other Shop', tillSeq: 1 } });
    const branch = await prisma.branch.create({ data: { tenantId: other.id, name: 'Main shop' } });
    await prisma.till.create({ data: { tenantId: other.id, branchId: branch.id, code: 'T1', name: 'Counter 1' } });
    await prisma.user.create({ data: { tenantId: other.id, name: 'Other Owner', phone: '03009990001', passwordHash: await bcrypt.hash('other-pass', 4), role: 'OWNER' } });
    const them = (await api().post('/api/auth/login').send({ phone: '03009990001', password: 'other-pass' }).expect(201)).body.token;

    expect((await api().get('/api/bales/kinds').set(as(them)).expect(200)).body.kinds).toEqual([]);
    await api().get('/api/bales/by-code/DENIM-1-45').set(as(them)).expect(404);
    await api().post('/api/sales').set(as(them)).send({ lines: [{ ...denim, quantity: 1 }] }).expect(404);
    expect((await bale('DENIM-1-45')).kind.qty).toBe(3);

    // The same kind there gets the same readable code of its own (codes are unique per business, not everywhere).
    const res = await upload('/api/shipments', them, { supplierName: 'Their supplier', arrivedOn: '2026-11-15' }, 'Item,Category,Grade,Weight kg,Cost,Bale sale price\nDenim,Denim,1,45,500,900').expect(201);
    expect(res.body.bales).toBe(1);
    expect(await bale('DENIM-1-45', them)).toMatchObject({ salePrice: '900', kind: { qty: 1 } });
    expect((await api().post('/api/sales').set(as(them)).send({ lines: [{ ...denim, unitPrice: '900', quantity: 2 }] }).expect(409)).body.message).toBe('Only 1 of DENIM-1-45 in stock.');
    expect((await bale('DENIM-1-45')).kind.qty).toBe(3);
  });

  it('prints to a network printer on the shop network only', async () => {
    expect((await api().post('/api/print/network').set(as(cashier)).send({ host: '8.8.8.8', data: 'aGk=' }).expect(400)).body.code).toBe('BAD_PRINTER');
    expect((await api().post('/api/print/network').set(as(cashier)).send({ host: 'printer.example.com', data: 'aGk=' }).expect(400)).body.code).toBe('BAD_PRINTER');
    const got: Buffer[] = [];
    const printer = createServer((socket) => socket.on('data', (d) => got.push(d)));
    await new Promise<void>((r) => printer.listen(9107, '127.0.0.1', r));
    const bytes = Buffer.from([0x1b, 0x40, 0x48, 0x69, 0x0a, 0x1d, 0x56, 0x00]);
    await api().post('/api/print/network').set(as(cashier)).send({ host: '127.0.0.1', port: 9107, data: bytes.toString('base64') }).expect(201);
    await new Promise((r) => setTimeout(r, 100));
    await new Promise((r) => printer.close(r));
    expect(Buffer.concat(got).equals(bytes)).toBe(true);
    expect((await api().post('/api/print/network').set(as(cashier)).send({ host: '127.0.0.1', port: 9108, data: 'aGk=' }).expect(502)).body.code).toBe('PRINTER_OFF');
  });

  it('lets another person take over a signed-in till with a PIN', async () => {
    expect((await api().get('/api/auth/people').set(as(cashier)).expect(200)).body).toEqual([expect.objectContaining({ name: 'Sana', role: 'MANAGER' })]);
    await api().post('/api/auth/pin').set(as(cashier)).send({ userId: managerId, pin: '0000' }).expect(401);
    // Five wrong tries lock the PIN, even for the right one, so it cannot be guessed from a signed-in till.
    const victim = (await api().post('/api/shop/staff').set(as(owner)).send({ name: 'Guess Me', phone: '0303 1110000', password: '4321', pin: '2468' }).expect(201)).body;
    for (let i = 0; i < 5; i++) await api().post('/api/auth/pin').set(as(cashier)).send({ userId: victim.id, pin: '0000' }).expect(401);
    expect((await api().post('/api/auth/pin').set(as(cashier)).send({ userId: victim.id, pin: '2468' }).expect(429)).body.code).toBe('PIN_LOCKED');
    const session = (await api().post('/api/auth/pin').set(as(cashier)).send({ userId: managerId, pin: '1234' }).expect(201)).body;
    expect(session.user).toMatchObject({ name: 'Sana', role: 'MANAGER', hasPin: true });
    await api().get('/api/shifts').set(as(session.token)).expect(200);
  });

  it('stops a cashier at once', async () => {
    const staff = (await api().get('/api/shop/staff').set(as(owner))).body;
    const bilal = staff.find((s: { name: string }) => s.name === 'Bilal');
    await api().patch(`/api/shop/staff/${bilal.id}`).set(as(owner)).send({ active: false }).expect(200);
    await api().get('/api/sync/snapshot').set(as(cashier)).expect(401);
    const me = staff.find((s: { role: string }) => s.role === 'OWNER');
    await api().patch(`/api/shop/staff/${me.id}`).set(as(owner)).send({ active: false }).expect(400);
  });
});

import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Bale, BaleStatus, Prisma } from '@prisma/client';
import { audit } from '../common/audit';
import { Actor, ManagerUp, Me } from '../common/auth.guard';
import { PrismaService } from '../common/prisma.service';
import { D, fail, optAmount, optText, text, wholeNumber, ZERO } from '../common/util';

const ON_SHELF: BaleStatus[] = [BaleStatus.IN_STOCK, BaleStatus.OPENED];

/** Stock of the branch the person works in. A cashier sees and sells it but never sees what it cost. */
@Controller('bales')
export class BalesController {
  constructor(private readonly prisma: PrismaService) {}

  private view(me: Actor, bale: Bale & { shipment?: { code: string; arrivedOn: Date; supplier?: { name: string } } }) {
    const piecesLeft = bale.status === BaleStatus.OPENED ? (bale.pieces ?? 0) - bale.piecesSold : 0;
    if (me.seesCost) return { ...bale, piecesLeft };
    const { cost: _c, landedCost: _l, pieceCost: _p, ...rest } = bale;
    return { ...rest, piecesLeft };
  }

  private async find(me: Actor, id: string) {
    const bale = await this.prisma.bale.findFirst({ where: { id, tenantId: me.tenantId, branchId: me.branchId } });
    if (!bale) fail('NOT_FOUND', 'This bale was not found in this branch.', 404);
    return bale;
  }

  /** `status`: shelf (default: closed and opened bales), IN_STOCK, OPENED, SOLD, FINISHED or all. */
  @Get()
  async list(@Me() me: Actor, @Query() q: Record<string, string>) {
    const where: Prisma.BaleWhereInput = { tenantId: me.tenantId, branchId: me.branchId };
    const status = q.status || 'shelf';
    if (status === 'shelf') where.status = { in: ON_SHELF };
    else if (status !== 'all') {
      if (!(status in BaleStatus)) fail('BAD_STATUS', 'Unknown stock filter.');
      where.status = status as BaleStatus;
    }
    if (q.shipmentId) where.shipmentId = q.shipmentId;
    if (q.category) where.category = q.category;
    if (q.kind) where.kindCode = q.kind;
    const search = (q.search ?? '').trim();
    if (search) {
      where.OR = ['kindCode', 'code', 'baleNo', 'item', 'category', 'grade', 'brand'].map((field) => ({ [field]: { contains: search, mode: 'insensitive' } }));
    }
    const take = Math.min(Number(q.take) || 100, 2000);
    const [bales, total, categories] = await Promise.all([
      this.prisma.bale.findMany({ where, orderBy: [{ status: 'asc' }, { code: 'desc' }], take, include: { shipment: { select: { code: true, arrivedOn: true } } } }),
      this.prisma.bale.count({ where }),
      this.prisma.bale.findMany({ where: { tenantId: me.tenantId, branchId: me.branchId, category: { not: null } }, distinct: ['category'], select: { category: true }, orderBy: { category: 'asc' } }),
    ]);
    return { total, categories: categories.map((c) => c.category), bales: bales.map((b) => this.view(me, b)) };
  }

  /**
   * Whole bales on this branch's shelf, one row per kind: the shared code, how many, their weight and (for those who
   * may see cost) their value. Opened bales are not here; they are sold by the piece and listed one by one.
   */
  @Get('kinds')
  async kinds(@Me() me: Actor, @Query() q: Record<string, string>) {
    const where: Prisma.BaleWhereInput = { tenantId: me.tenantId, branchId: me.branchId, status: BaleStatus.IN_STOCK };
    if (q.category) where.category = q.category;
    const search = (q.search ?? '').trim();
    if (search) where.OR = ['kindCode', 'code', 'baleNo', 'item', 'category', 'grade', 'brand'].map((field) => ({ [field]: { contains: search, mode: 'insensitive' } }));
    const [bales, names] = await Promise.all([
      this.prisma.bale.findMany({
        where,
        select: { code: true, kindCode: true, item: true, category: true, grade: true, weightKg: true, pieces: true, salePrice: true, landedCost: true },
        orderBy: [{ createdAt: 'asc' }, { code: 'asc' }],
        take: 20_000,
      }),
      this.prisma.baleKind.findMany({ where: { tenantId: me.tenantId }, select: { code: true, name: true } }),
    ]);
    const nameOf = new Map(names.map((k) => [k.code, k.name]));
    const rows = new Map<string, { code: string; name: string; category: string | null; grade: string | null; weightKg: Prisma.Decimal | null; pieces: number | null; qty: number; kg: Prisma.Decimal; value: Prisma.Decimal; salePrice: Prisma.Decimal | null }>();
    for (const b of bales) {
      const code = b.kindCode ?? b.code;
      // Oldest first, so the row's price is the price of the bale that sells next.
      const row = rows.get(code) ?? { code, name: nameOf.get(code) ?? b.item, category: b.category, grade: b.grade, weightKg: b.weightKg, pieces: b.pieces, qty: 0, kg: ZERO, value: ZERO, salePrice: b.salePrice };
      row.qty += 1;
      row.kg = row.kg.plus(b.weightKg ?? new D(0));
      row.value = row.value.plus(b.landedCost);
      rows.set(code, row);
    }
    const kinds = [...rows.values()].sort((a, b) => a.code.localeCompare(b.code));
    return { kinds: me.seesCost ? kinds : kinds.map(({ value: _v, ...rest }) => rest) };
  }

  /**
   * The counter scans or types a sticker. A shared code means the kind: the answer is its oldest whole bale and how
   * many are in stock. A bale's own number (stickers printed before shared codes) or the supplier's bale no. means
   * that one bale.
   */
  @Get('by-code/:code')
  async byCode(@Me() me: Actor, @Param('code') code: string) {
    const c = code.trim();
    const kind = await this.prisma.baleKind.findFirst({ where: { tenantId: me.tenantId, code: { equals: c, mode: 'insensitive' } } });
    if (kind) {
      const where = { tenantId: me.tenantId, branchId: me.branchId, kindCode: kind.code, status: BaleStatus.IN_STOCK };
      const [qty, oldest] = await Promise.all([this.prisma.bale.count({ where }), this.prisma.bale.findFirst({ where, orderBy: [{ createdAt: 'asc' }, { code: 'asc' }] })]);
      if (!oldest) fail('NONE_IN_STOCK', `${kind.code} is not in stock.`, 409);
      return { ...this.view(me, oldest), kind: { code: kind.code, name: kind.name, qty } };
    }
    const bale =
      (await this.prisma.bale.findFirst({ where: { tenantId: me.tenantId, branchId: me.branchId, code: { equals: c, mode: 'insensitive' } } })) ??
      (await this.prisma.bale.findFirst({ where: { tenantId: me.tenantId, branchId: me.branchId, baleNo: { equals: c, mode: 'insensitive' }, status: { in: ON_SHELF } } }));
    if (!bale) fail('NOT_FOUND', `No bale has the number ${c}.`, 404);
    return this.view(me, bale);
  }

  @Get(':id')
  async get(@Me() me: Actor, @Param('id') id: string) {
    const bale = await this.prisma.bale.findFirst({
      where: { id, tenantId: me.tenantId, branchId: me.branchId },
      include: { shipment: { select: { code: true, arrivedOn: true, supplier: { select: { name: true } } } } },
    });
    if (!bale) fail('NOT_FOUND', 'This bale was not found.', 404);
    const lines = await this.prisma.saleLine.findMany({
      where: { tenantId: me.tenantId, baleId: id, sale: { status: 'COMPLETED' } },
      select: { id: true, kind: true, quantity: true, unitPrice: true, lineTotal: true, sale: { select: { id: true, code: true, createdAt: true } } },
      orderBy: { sale: { createdAt: 'desc' } },
      take: 50,
    });
    return { ...this.view(me, bale), sales: lines };
  }

  @ManagerUp()
  @Patch(':id')
  async update(@Me() me: Actor, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    const bale = await this.find(me, id);
    const data: Prisma.BaleUpdateInput = {};
    if ('item' in body) data.item = text(body.item, 'Item');
    if ('category' in body) data.category = optText(body.category, 'Category');
    if ('grade' in body) data.grade = optText(body.grade, 'Grade');
    if ('brand' in body) data.brand = optText(body.brand, 'Brand');
    if ('notes' in body) data.notes = optText(body.notes, 'Notes');
    if ('salePrice' in body) data.salePrice = optAmount(body.salePrice, 'Bale price');
    if ('piecePrice' in body) data.piecePrice = optAmount(body.piecePrice, 'Piece price');
    return this.view(me, await this.prisma.bale.update({ where: { id: bale.id }, data }));
  }

  /** Lost, stolen or damaged: off the shelf, with the reason kept. */
  @ManagerUp()
  @Post(':id/write-off')
  async writeOff(@Me() me: Actor, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    const bale = await this.find(me, id);
    const reason = text(body.reason, 'Reason', 200);
    const done = await this.prisma.bale.updateMany({
      where: { id, tenantId: me.tenantId, status: { in: ON_SHELF } },
      data: { status: BaleStatus.WRITTEN_OFF, writeOffReason: reason, closedAt: new Date() },
    });
    if (done.count !== 1) fail('NOT_ON_SHELF', 'Only a bale on the shelf can be written off.', 409);
    await audit(this.prisma, me, 'Bale written off', `${bale.code} ${bale.item}: ${reason}`);
    return this.view(me, await this.find(me, id));
  }

  /** New prices for many bales at once (after an import, or a season change). */
  @ManagerUp()
  @Post('prices')
  async prices(@Me() me: Actor, @Body() body: Record<string, unknown>) {
    const ids = Array.isArray(body.ids) ? body.ids.map(String).slice(0, 2000) : [];
    if (!ids.length) fail('NO_BALES', 'Choose the bales first.');
    const data: Prisma.BaleUpdateManyMutationInput = {};
    if ('salePrice' in body) data.salePrice = optAmount(body.salePrice, 'Bale price');
    if ('piecePrice' in body) data.piecePrice = optAmount(body.piecePrice, 'Piece price');
    const done = await this.prisma.bale.updateMany({ where: { id: { in: ids }, tenantId: me.tenantId, branchId: me.branchId, status: { in: ON_SHELF } }, data });
    await audit(this.prisma, me, 'Prices changed', `${done.count} bales`);
    return { changed: done.count };
  }

  /** Cut the bale open to sell piece by piece. The pieces are counted now; each piece carries an equal share of the cost. */
  @Post(':id/open')
  async open(@Me() me: Actor, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    const bale = await this.find(me, id);
    const pieces = wholeNumber(body.pieces, 'Pieces');
    const piecePrice = optAmount(body.piecePrice, 'Piece price') ?? bale.piecePrice;
    const done = await this.prisma.bale.updateMany({
      where: { id: bale.id, tenantId: me.tenantId, status: BaleStatus.IN_STOCK },
      data: { status: BaleStatus.OPENED, pieces, piecePrice, pieceCost: bale.landedCost.dividedBy(pieces).toDecimalPlaces(4), openedAt: new Date() },
    });
    if (done.count !== 1) fail('NOT_CLOSED', `Bale ${bale.code} is not a closed bale in stock.`, 409);
    return this.view(me, await this.find(me, id));
  }

  /** Opened by mistake and nothing sold from it yet: put it back as a closed bale. */
  @Post(':id/undo-open')
  async undoOpen(@Me() me: Actor, @Param('id') id: string) {
    const done = await this.prisma.bale.updateMany({
      where: { id, tenantId: me.tenantId, status: BaleStatus.OPENED, piecesSold: 0 },
      data: { status: BaleStatus.IN_STOCK, pieceCost: null, openedAt: null },
    });
    if (done.count !== 1) fail('CANNOT_CLOSE', 'Only an opened bale with no pieces sold can be closed again.', 409);
    return this.view(me, await this.find(me, id));
  }

  /** Nothing sellable is left in an opened bale: take it off the shelf. */
  @ManagerUp()
  @Post(':id/finish')
  async finish(@Me() me: Actor, @Param('id') id: string) {
    const done = await this.prisma.bale.updateMany({
      where: { id, tenantId: me.tenantId, status: BaleStatus.OPENED },
      data: { status: BaleStatus.FINISHED, closedAt: new Date() },
    });
    if (done.count !== 1) fail('NOT_OPENED', 'Only an opened bale can be finished.', 409);
    return this.view(me, await this.find(me, id));
  }
}

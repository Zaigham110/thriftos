import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Bale, BaleStatus, Prisma } from '@prisma/client';
import { audit } from '../common/audit';
import { Actor, ManagerUp, Me } from '../common/auth.guard';
import { PrismaService } from '../common/prisma.service';
import { fail, optAmount, optText, text, wholeNumber } from '../common/util';

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
    const search = (q.search ?? '').trim();
    if (search) {
      where.OR = ['code', 'baleNo', 'item', 'category', 'grade', 'brand'].map((field) => ({ [field]: { contains: search, mode: 'insensitive' } }));
    }
    const take = Math.min(Number(q.take) || 100, 2000);
    const [bales, total, categories] = await Promise.all([
      this.prisma.bale.findMany({ where, orderBy: [{ status: 'asc' }, { code: 'desc' }], take, include: { shipment: { select: { code: true, arrivedOn: true } } } }),
      this.prisma.bale.count({ where }),
      this.prisma.bale.findMany({ where: { tenantId: me.tenantId, branchId: me.branchId, category: { not: null } }, distinct: ['category'], select: { category: true }, orderBy: { category: 'asc' } }),
    ]);
    return { total, categories: categories.map((c) => c.category), bales: bales.map((b) => this.view(me, b)) };
  }

  /** The counter scans or types a sticker: an exact shop code or supplier bale no. */
  @Get('by-code/:code')
  async byCode(@Me() me: Actor, @Param('code') code: string) {
    const c = code.trim();
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

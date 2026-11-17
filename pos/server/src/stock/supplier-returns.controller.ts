import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { BaleStatus } from '@prisma/client';
import { audit } from '../common/audit';
import { Actor, Me, OwnerOnly } from '../common/auth.guard';
import { PrismaService } from '../common/prisma.service';
import { fail, optAmount, optText, pad, spread, ZERO } from '../common/util';

/**
 * Bales sent back to the supplier: wrong goods, bad quality. They leave the shelf, and the supplier owes the shop
 * for them until it is settled (money back, or taken off the next invoice). Costs are involved, so the owner's.
 */
@OwnerOnly()
@Controller('supplier-returns')
export class SupplierReturnsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Me() me: Actor) {
    const returns = await this.prisma.supplierReturn.findMany({
      where: { tenantId: me.tenantId },
      include: { supplier: { select: { id: true, name: true } }, _count: { select: { lines: true } } },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    const owed = new Map<string, { supplierId: string; name: string; amount: typeof ZERO; returns: number }>();
    for (const r of returns.filter((x) => !x.settledAt)) {
      const row = owed.get(r.supplierId) ?? { supplierId: r.supplierId, name: r.supplier.name, amount: ZERO, returns: 0 };
      owed.set(r.supplierId, { ...row, amount: row.amount.plus(r.amount), returns: row.returns + 1 });
    }
    return { owed: [...owed.values()], returns };
  }

  @Get(':id')
  async get(@Me() me: Actor, @Param('id') id: string) {
    const ret = await this.prisma.supplierReturn.findFirst({ where: { id, tenantId: me.tenantId }, include: { supplier: { select: { id: true, name: true } }, lines: true } });
    if (!ret) fail('NOT_FOUND', 'This return was not found.', 404);
    const bales = await this.prisma.bale.findMany({ where: { tenantId: me.tenantId, id: { in: ret.lines.map((l) => l.baleId) } }, select: { id: true, code: true, kindCode: true, baleNo: true, item: true, weightKg: true } });
    return { ...ret, lines: ret.lines.map((l) => ({ ...l, bale: bales.find((b) => b.id === l.baleId) ?? null })) };
  }

  /** `amount`: what the supplier owes for these bales. Left empty, it is what the bales cost (without charges). */
  @Post()
  async create(@Me() me: Actor, @Body() body: Record<string, unknown>) {
    const ids = Array.isArray(body.baleIds) ? [...new Set(body.baleIds.map(String))].slice(0, 2000) : [];
    if (!ids.length) fail('NO_BALES', 'Choose the bales that go back.');
    const reason = optText(body.reason, 'Reason', 200);
    const typed = optAmount(body.amount, 'Amount');
    return this.prisma.$transaction(async (tx) => {
      const bales = await tx.bale.findMany({ where: { tenantId: me.tenantId, branchId: me.branchId, id: { in: ids } }, include: { shipment: { select: { supplierId: true } } }, orderBy: { code: 'asc' } });
      if (bales.length !== ids.length) fail('NOT_FOUND', 'Some of these bales are not in this branch.', 404);
      const suppliers = new Set(bales.map((b) => b.shipment.supplierId));
      if (suppliers.size > 1) fail('ONE_SUPPLIER', 'These bales came from different suppliers. Send them back one supplier at a time.');
      // The status check is in the update itself: only whole bales still on the shelf go back.
      const gone = await tx.bale.updateMany({ where: { tenantId: me.tenantId, id: { in: ids }, status: BaleStatus.IN_STOCK }, data: { status: BaleStatus.RETURNED_TO_SUPPLIER, closedAt: new Date() } });
      if (gone.count !== ids.length) fail('NOT_ON_SHELF', 'Only whole bales on the shelf can go back to the supplier.', 409);
      const costs = bales.map((b) => b.cost);
      const amounts = typed ? spread(typed, costs.every((c) => c.greaterThan(0)) ? costs : costs.map(() => null)) : costs;
      const shop = await tx.shop.update({ where: { id: me.tenantId }, data: { supplierReturnSeq: { increment: 1 } } });
      const ret = await tx.supplierReturn.create({
        data: {
          tenantId: me.tenantId,
          branchId: me.branchId,
          code: `SR-${pad(shop.supplierReturnSeq, 4)}`,
          supplierId: bales[0].shipment.supplierId,
          amount: amounts.reduce((a, b) => a.plus(b), ZERO),
          reason,
          userId: me.id,
          userName: me.name,
          lines: { createMany: { data: bales.map((b, i) => ({ tenantId: me.tenantId, baleId: b.id, amount: amounts[i] })) } },
        },
      });
      await audit(tx, me, 'Returned to supplier', `${ret.code}: ${bales.length} bales, ${ret.amount.toFixed(0)}${reason ? `: ${reason}` : ''}`);
      return { id: ret.id, code: ret.code, bales: bales.length, amount: ret.amount };
    });
  }

  /** The supplier has paid it back, or taken it off an invoice. */
  @Post(':id/settle')
  async settle(@Me() me: Actor, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    const done = await this.prisma.supplierReturn.updateMany({ where: { id, tenantId: me.tenantId, settledAt: null }, data: { settledAt: new Date(), settledNote: optText(body.note, 'Note', 200) } });
    if (done.count !== 1) fail('NOT_FOUND', 'This return was not found or is already settled.', 404);
    return this.get(me, id);
  }

  /** Made by mistake and not settled yet: the bales go back on the shelf and the return is removed. */
  @Post(':id/undo')
  async undo(@Me() me: Actor, @Param('id') id: string) {
    await this.prisma.$transaction(async (tx) => {
      const ret = await tx.supplierReturn.findFirst({ where: { id, tenantId: me.tenantId, settledAt: null }, include: { lines: true } });
      if (!ret) fail('NOT_FOUND', 'This return was not found or is already settled.', 404);
      await tx.bale.updateMany({ where: { tenantId: me.tenantId, id: { in: ret.lines.map((l) => l.baleId) }, status: BaleStatus.RETURNED_TO_SUPPLIER }, data: { status: BaleStatus.IN_STOCK, closedAt: null } });
      await tx.supplierReturn.delete({ where: { id: ret.id } });
      await audit(tx, me, 'Return to supplier undone', `${ret.code}: ${ret.lines.length} bales back on the shelf`);
    });
    return { ok: true };
  }
}

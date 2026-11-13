import { Controller, Get, Query } from '@nestjs/common';
import { BaleStatus, KhataKind, PayMethod, Prisma, SaleStatus, UserRole } from '@prisma/client';
import { Actor, ManagerUp, Me } from '../common/auth.guard';
import { PrismaService } from '../common/prisma.service';
import { D, Dec, range, ZERO } from '../common/util';

class Group {
  private readonly rows = new Map<string, { key: string; bills: Set<string>; quantity: number; sales: Dec; cost: Dec }>();
  add(key: string, saleId: string, quantity: number, sales: Dec, cost: Dec) {
    const row = this.rows.get(key) ?? { key, bills: new Set<string>(), quantity: 0, sales: ZERO, cost: ZERO };
    row.bills.add(saleId);
    row.quantity += quantity;
    row.sales = row.sales.plus(sales);
    row.cost = row.cost.plus(cost);
    this.rows.set(key, row);
  }
  list(seesCost: boolean, byKey = false) {
    const out = [...this.rows.values()].map((r) => ({ key: r.key, bills: r.bills.size, quantity: r.quantity, sales: r.sales.toDecimalPlaces(2), ...(seesCost ? { profit: r.sales.minus(r.cost).toDecimalPlaces(2) } : {}) }));
    return byKey ? out.sort((a, b) => a.key.localeCompare(b.key)) : out.sort((a, b) => b.sales.comparedTo(a.sales));
  }
}

/** Numbers for the owner and managers. The owner may ask for every branch together (`branch=all`). */
@ManagerUp()
@Controller('reports')
export class ReportsController {
  constructor(private readonly prisma: PrismaService) {}

  private scope(me: Actor, q: Record<string, string>) {
    return { tenantId: me.tenantId, ...(q.branch === 'all' && me.role === UserRole.OWNER ? {} : { branchId: me.branchId }) };
  }

  @Get('sales')
  async sales(@Me() me: Actor, @Query() q: Record<string, string>) {
    const scope = this.scope(me, q);
    const when = range(q);
    const tz = Number(q.tz) || 0; // minutes the screen's clock is ahead of UTC
    const where: Prisma.SaleWhereInput = { ...scope, status: SaleStatus.COMPLETED, soldAt: when };
    const sum = (d: Dec | null | undefined) => d ?? new D(0);

    const [sales, lines, payments, khataIn, expenses, returns, cancelled] = await Promise.all([
      this.prisma.sale.findMany({ where, select: { id: true, soldAt: true, subtotal: true, discount: true, taxAmount: true, total: true, costTotal: true, returnedTotal: true, returnedCost: true, creditAmount: true, user: { select: { name: true } } }, take: 50_000 }),
      this.prisma.saleLine.findMany({ where: { tenantId: me.tenantId, conflict: false, sale: where }, select: { saleId: true, kind: true, quantity: true, lineTotal: true, costTotal: true, bale: { select: { category: true, grade: true } } }, take: 200_000 }),
      this.prisma.salePayment.groupBy({ by: ['method'], where: { tenantId: me.tenantId, sale: where }, _sum: { amount: true } }),
      this.prisma.customerEntry.aggregate({ where: { ...scope, kind: KhataKind.PAYMENT, createdAt: when }, _sum: { amount: true } }),
      this.prisma.expense.groupBy({ by: ['category'], where: { ...scope, createdAt: when }, _sum: { amount: true } }),
      this.prisma.saleReturn.aggregate({ where: { ...scope, createdAt: when }, _sum: { total: true }, _count: { _all: true } }),
      this.prisma.sale.count({ where: { ...scope, status: SaleStatus.CANCELLED, soldAt: when } }),
    ]);

    const byDay = new Group();
    const byCashier = new Group();
    let total = ZERO, cost = ZERO, discount = ZERO, tax = ZERO, credit = ZERO, returned = ZERO;
    for (const s of sales) {
      const net = s.total.minus(s.returnedTotal);
      const netCost = s.costTotal.minus(s.returnedCost);
      const local = new Date(s.soldAt.getTime() + tz * 60_000).toISOString().slice(0, 10);
      byDay.add(local, s.id, 0, net, netCost);
      byCashier.add(s.user.name, s.id, 0, net, netCost);
      total = total.plus(s.total);
      cost = cost.plus(netCost);
      discount = discount.plus(s.discount);
      tax = tax.plus(s.taxAmount);
      credit = credit.plus(s.creditAmount);
      returned = returned.plus(s.returnedTotal);
    }
    const byCategory = new Group();
    const byGrade = new Group();
    const byKind = new Group();
    for (const l of lines) {
      byCategory.add(l.bale?.category ?? (l.kind === 'ITEM' ? 'Other items' : 'No category'), l.saleId, l.quantity, l.lineTotal, l.costTotal);
      byGrade.add(l.bale?.grade ?? '—', l.saleId, l.quantity, l.lineTotal, l.costTotal);
      byKind.add(l.kind === 'BALE' ? 'Whole bales' : l.kind === 'PIECE' ? 'Pieces' : 'Other items', l.saleId, l.quantity, l.lineTotal, l.costTotal);
    }
    const expenseTotal = expenses.reduce((a, e) => a.plus(sum(e._sum.amount)), ZERO);
    const net = total.minus(returned);
    return {
      totals: {
        bills: sales.length,
        cancelled,
        sales: total,
        returned,
        returns: returns._count._all,
        net,
        discount,
        tax,
        credit,
        khataReceived: sum(khataIn._sum.amount).negated(),
        expenses: expenseTotal,
        ...(me.seesCost ? { cost, profit: net.minus(cost), netProfit: net.minus(cost).minus(expenseTotal) } : {}),
      },
      byMethod: Object.values(PayMethod).map((m) => ({ key: m, sales: sum(payments.find((p) => p.method === m)?._sum.amount) })),
      byDay: byDay.list(me.seesCost, true),
      byCashier: byCashier.list(me.seesCost),
      byCategory: byCategory.list(me.seesCost),
      byGrade: byGrade.list(me.seesCost),
      byKind: byKind.list(me.seesCost),
      expenses: expenses.map((e) => ({ key: e.category, amount: sum(e._sum.amount) })).sort((a, b) => b.amount.comparedTo(a.amount)),
    };
  }

  /** What is on the shelf: by category, how long it has been there, and how each shipment is doing. */
  @Get('stock')
  async stock(@Me() me: Actor, @Query() q: Record<string, string>) {
    const scope = this.scope(me, q);
    const bales = await this.prisma.bale.findMany({
      where: { ...scope, status: { in: [BaleStatus.IN_STOCK, BaleStatus.OPENED] } },
      select: { category: true, status: true, landedCost: true, salePrice: true, piecePrice: true, pieces: true, piecesSold: true, pieceCost: true, shipment: { select: { arrivedOn: true } } },
      take: 100_000,
    });
    const now = Date.now();
    const AGES = ['0 to 30 days', '31 to 60 days', '61 to 90 days', 'Over 90 days'];
    const make = () => ({ closed: 0, opened: 0, piecesLeft: 0, cost: ZERO as Dec, worth: ZERO as Dec });
    const cats = new Map<string, ReturnType<typeof make>>();
    const ages = new Map<string, ReturnType<typeof make>>(AGES.map((a) => [a, make()]));
    for (const b of bales) {
      const days = Math.floor((now - b.shipment.arrivedOn.getTime()) / 86_400_000);
      const age = AGES[days <= 30 ? 0 : days <= 60 ? 1 : days <= 90 ? 2 : 3];
      const key = b.category ?? 'No category';
      if (!cats.has(key)) cats.set(key, make());
      for (const row of [cats.get(key)!, ages.get(age)!]) {
        if (b.status === BaleStatus.IN_STOCK) {
          row.closed += 1;
          row.cost = row.cost.plus(b.landedCost);
          row.worth = row.worth.plus(b.salePrice ?? ZERO);
        } else {
          const left = (b.pieces ?? 0) - b.piecesSold;
          row.opened += 1;
          row.piecesLeft += left;
          row.cost = row.cost.plus((b.pieceCost ?? ZERO).times(left));
          row.worth = row.worth.plus((b.piecePrice ?? ZERO).times(left));
        }
      }
    }
    const out = (m: Map<string, ReturnType<typeof make>>) =>
      [...m.entries()].map(([key, r]) => ({ key, closed: r.closed, opened: r.opened, piecesLeft: r.piecesLeft, worth: r.worth.toDecimalPlaces(2), ...(me.seesCost ? { cost: r.cost.toDecimalPlaces(2) } : {}) }));

    let shipments: unknown[] = [];
    if (me.seesCost) {
      const [list, sold, left] = await Promise.all([
        this.prisma.shipment.findMany({ where: { tenantId: me.tenantId }, select: { id: true, code: true, arrivedOn: true, landedCost: true, baleCount: true, supplier: { select: { name: true } } }, orderBy: { arrivedOn: 'desc' }, take: 200 }),
        this.prisma.saleLine.findMany({ where: { tenantId: me.tenantId, conflict: false, baleId: { not: null }, sale: { status: SaleStatus.COMPLETED } }, select: { lineTotal: true, costTotal: true, bale: { select: { shipmentId: true } } }, take: 300_000 }),
        this.prisma.bale.groupBy({ by: ['shipmentId'], where: { tenantId: me.tenantId, status: { in: [BaleStatus.IN_STOCK, BaleStatus.OPENED, BaleStatus.IN_TRANSIT] } }, _count: { _all: true } }),
      ]);
      const earned = new Map<string, { sales: Dec; cost: Dec }>();
      for (const l of sold) {
        const e = earned.get(l.bale!.shipmentId) ?? { sales: ZERO, cost: ZERO };
        earned.set(l.bale!.shipmentId, { sales: e.sales.plus(l.lineTotal), cost: e.cost.plus(l.costTotal) });
      }
      shipments = list.map((s) => {
        const e = earned.get(s.id) ?? { sales: ZERO, cost: ZERO };
        return { id: s.id, code: s.code, supplier: s.supplier.name, arrivedOn: s.arrivedOn, bales: s.baleCount, balesLeft: left.find((g) => g.shipmentId === s.id)?._count._all ?? 0, landedCost: s.landedCost, sold: e.sales, profit: e.sales.minus(e.cost), recovered: s.landedCost.isZero() ? null : e.sales.times(100).dividedBy(s.landedCost).toDecimalPlaces(0) };
      });
    }
    const all = make();
    for (const r of cats.values()) {
      all.closed += r.closed;
      all.opened += r.opened;
      all.piecesLeft += r.piecesLeft;
      all.cost = all.cost.plus(r.cost);
      all.worth = all.worth.plus(r.worth);
    }
    return {
      totals: { closed: all.closed, opened: all.opened, piecesLeft: all.piecesLeft, worth: all.worth.toDecimalPlaces(2), ...(me.seesCost ? { cost: all.cost.toDecimalPlaces(2) } : {}) },
      byCategory: out(cats).sort((a, b) => b.worth.comparedTo(a.worth)),
      byAge: out(ages),
      shipments,
    };
  }
}

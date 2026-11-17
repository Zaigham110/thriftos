import { Injectable } from '@nestjs/common';
import { InventoryStatus, Prisma, RagSourceType, RagStatus, StockAdjustmentStatus, StockSource } from '@prisma/client';
import { localDayStart } from '../common/list/list-engine';
import { combine, containerEconomics, ContainerEconomics, lotEconomics } from '../home/container-economics';
import { PrismaService } from '../prisma/prisma.service';
import { supplierBalances } from '../procurement/supplier-khata';
import { KHATA_SALE_STATUSES } from '../sales/khata.service';
import { BaleService } from '../stock/bale.service';
import { stockLeft } from '../stock/stock.lists';
import { PnlQueryDto } from './finance.service';
import { businessDay } from './receivables.service';

const ZERO = new Prisma.Decimal(0);

/**
 * Trading: buying and selling only (owner, 2026-11-17: "financial reports different for purchasing selling, the
 * core; the other finances should not merge in this"). The monthly lines come from Profit and loss; this adds
 * what stands behind them: the stock account, profit by lot, supplier, customer and item, and what is owed to
 * suppliers and by customers. Nothing here knows about wages, rent, the cash drawer or any other expense.
 */
@Injectable()
export class TradingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bales: BaleService,
  ) {}

  async trading(tenantId: string, q: PnlQueryDto, now = new Date()) {
    const count = q.months ?? 12;
    const thisMonth = businessDay(now).slice(0, 7);
    const [y, m] = thisMonth.split('-').map(Number);
    const firstMonth = new Date(Date.UTC(y, m - count, 1)).toISOString().slice(0, 7);
    const start = localDayStart(firstMonth + '-01');
    const startDay = new Date(firstMonth + '-01T00:00:00Z');
    const inWindow = { OR: [{ issuedAt: { gte: start } }, { issuedAt: null, createdAt: { gte: start } }] };

    const [sales, lines, adjustments, looseLots, containers, readyStock, stockItems, waitingLots, sorted, vendors, supplierPaid, customers, customerSales, customerPayments, received] = await Promise.all([
      this.prisma.sale.findMany({
        where: { tenantId, status: { in: KHATA_SALE_STATUSES }, ...inWindow },
        select: { customerId: true, totalAmount: true, totalCost: true, customer: { select: { name: true, city: true } } },
      }),
      this.prisma.saleLine.findMany({
        where: { sale: { tenantId, status: { in: KHATA_SALE_STATUSES }, ...inWindow } },
        select: { lineTotal: true, lineCost: true, unit: true, quantity: true, inventoryItem: { select: { name: true, weightKg: true, quantity: true, category: { select: { name: true } }, grade: { select: { name: true } } } } },
      }),
      this.prisma.stockAdjustment.aggregate({ where: { tenantId, status: StockAdjustmentStatus.APPROVED, decidedAt: { gte: start } }, _sum: { costChange: true } }),
      this.prisma.rag.findMany({
        // A mix is not something bought: what it earned is shared back to the lots it was made from.
        where: { tenantId, containerId: null, sourceType: { not: RagSourceType.MIXED } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, ragCode: true, createdAt: true, allocatedCost: true, weightKg: true, vendorId: true, vendor: { select: { name: true } } },
      }),
      this.prisma.container.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, containerNumber: true, createdAt: true, landedCostPKR: true, vendorId: true, vendor: { select: { name: true } }, _count: { select: { rags: true } } },
      }),
      this.prisma.inventoryItem.aggregate({ where: { tenantId, source: StockSource.PURCHASED, createdAt: { gte: start } }, _sum: { totalCost: true } }),
      this.prisma.inventoryItem.findMany({ where: { tenantId, status: { not: InventoryStatus.SOLD } }, select: { quantity: true, usedQuantity: true, totalCost: true, unit: true, weightKg: true } }),
      // Bought, not sorted yet: still stock, at what it cost; a lot being sorted counts what has not moved to sorted piles.
      this.prisma.rag.findMany({
        where: { tenantId, status: { in: [RagStatus.NOT_STARTED, RagStatus.IN_SORTING] } },
        select: { allocatedCost: true, categoryOutputs: { select: { allocatedCost: true } } },
      }),
      this.bales.sortedStock(tenantId),
      this.prisma.vendor.findMany({ where: { tenantId }, select: { id: true, name: true } }),
      this.prisma.supplierPayment.aggregate({ where: { tenantId, cancelledAt: null, day: { gte: startDay } }, _sum: { amount: true } }),
      this.prisma.customer.findMany({ where: { tenantId }, select: { id: true, openingBalance: true } }),
      this.prisma.sale.groupBy({ by: ['customerId'], where: { tenantId, status: { in: KHATA_SALE_STATUSES } }, _sum: { totalAmount: true } }),
      this.prisma.payment.groupBy({ by: ['customerId'], where: { tenantId }, _sum: { amount: true } }),
      this.prisma.payment.aggregate({ where: { tenantId, receivedAt: { gte: start } }, _sum: { amount: true } }),
    ]);

    // ---- The stock account of the period: opening + bought − sold at cost − written off = closing ----
    const inWindowDate = (d: Date) => d >= start;
    const bought = looseLots.filter((l) => inWindowDate(l.createdAt)).reduce((t, l) => t.add(l.allocatedCost), ZERO)
      .add(containers.filter((c) => inWindowDate(c.createdAt)).reduce((t, c) => t.add(c.landedCostPKR), ZERO))
      .add(readyStock._sum.totalCost ?? ZERO);
    const soldAtCost = sales.reduce((t, s) => t.add(s.totalCost), ZERO);
    // A write-off is stored as a negative cost change; shown here as what was lost.
    const lost = adjustments._sum.costChange ?? ZERO;
    const writtenOff = lost.isZero() ? ZERO : lost.neg();
    const inHand = stockItems.reduce((t, i) => t.add(stockLeft(i).value), ZERO);
    const sortedValue = sorted.reduce((t, s) => t.add(s.value), ZERO);
    const waiting = waitingLots.reduce((t, l) => {
      const moved = l.categoryOutputs.reduce((s, o) => s.add(o.allocatedCost), ZERO);
      return t.add(Prisma.Decimal.max(ZERO, l.allocatedCost.sub(moved)));
    }, ZERO)
      // A container with no lot yet has its cost nowhere else.
      .add(containers.filter((c) => !c._count.rags).reduce((t, c) => t.add(c.landedCostPKR), ZERO));
    const closing = inHand.add(sortedValue).add(waiting);
    const stock = {
      // Worked back from the stock there is now, so the account always balances.
      opening: closing.sub(bought).add(soldAtCost).add(writtenOff),
      bought, soldAtCost, writtenOff, closing,
      parts: { waiting, sorted: sortedValue, ready: inHand },
    };

    // ---- By customer and by item, for the period ----
    const byCustomer = new Map<string, { id: string; name: string; city: string | null; bills: number; revenue: Prisma.Decimal; cost: Prisma.Decimal }>();
    for (const s of sales) {
      const r = byCustomer.get(s.customerId) ?? { id: s.customerId, name: s.customer.name, city: s.customer.city, bills: 0, revenue: ZERO, cost: ZERO };
      r.bills += 1;
      r.revenue = r.revenue.add(s.totalAmount);
      r.cost = r.cost.add(s.totalCost);
      byCustomer.set(s.customerId, r);
    }
    const byItem = new Map<string, { name: string; kg: Prisma.Decimal; revenue: Prisma.Decimal; cost: Prisma.Decimal }>();
    for (const l of lines) {
      const i = l.inventoryItem;
      const name = i.category ? [i.category.name, i.grade?.name].filter(Boolean).join(' · ') : (i.name ?? '').split(' · ')[0] || '—';
      const r = byItem.get(name) ?? { name, kg: ZERO, revenue: ZERO, cost: ZERO };
      // Kg sold: the line's kg, or the share of the item's weight that this many bales or pieces are.
      const kg = l.unit === 'KG' ? l.quantity : i.weightKg && !i.quantity.isZero() ? i.weightKg.mul(l.quantity).div(i.quantity) : ZERO;
      r.kg = r.kg.add(kg);
      r.revenue = r.revenue.add(l.lineTotal);
      r.cost = r.cost.add(l.lineCost);
      byItem.set(name, r);
    }
    const withProfit = <T extends { revenue: Prisma.Decimal; cost: Prisma.Decimal }>(r: T) => {
      const profit = r.revenue.sub(r.cost);
      return { ...r, profit, marginPercent: r.revenue.isZero() ? null : profit.div(r.revenue).mul(100).toDecimalPlaces(1).toNumber() };
    };

    // ---- By lot or container and by supplier, to date (a lot bought earlier still sells now) ----
    const [lotFigures, containerFigures, balances] = await Promise.all([
      lotEconomics(this.prisma, tenantId, looseLots.map((l) => l.id)),
      containerEconomics(this.prisma, tenantId, containers.map((c) => c.id)),
      supplierBalances(this.prisma, tenantId, vendors.map((v) => v.id)),
    ]);
    const lotRow = (kind: 'LOT' | 'CONTAINER', id: string, code: string, supplier: string | null, boughtAt: Date, cost: Prisma.Decimal, e: ContainerEconomics | undefined) => {
      const revenue = e?.revenue ?? ZERO;
      const profit = e?.profit ?? ZERO;
      const costSold = revenue.sub(profit);
      return { kind, id, code, supplier, boughtAt, bought: cost, kg: e?.kg ?? ZERO, revenue, costSold, profit, notSold: Prisma.Decimal.max(ZERO, cost.sub(costSold)) };
    };
    const byLot = [
      ...looseLots.map((l) => lotRow('LOT', l.id, l.ragCode, l.vendor?.name ?? null, l.createdAt, l.allocatedCost, lotFigures.get(l.id))),
      ...containers.map((c) => lotRow('CONTAINER', c.id, c.containerNumber, c.vendor?.name ?? null, c.createdAt, c.landedCostPKR, containerFigures.get(c.id))),
    ].sort((a, b) => b.boughtAt.getTime() - a.boughtAt.getTime());
    const bySupplier = vendors
      .map((v) => {
        const lots = looseLots.filter((l) => l.vendorId === v.id);
        const conts = containers.filter((c) => c.vendorId === v.id);
        const all = combine([...lots.map((l) => lotFigures.get(l.id)), ...conts.map((c) => containerFigures.get(c.id))].filter((e): e is ContainerEconomics => !!e));
        const cost = lots.reduce((t, l) => t.add(l.allocatedCost), ZERO).add(conts.reduce((t, c) => t.add(c.landedCostPKR), ZERO));
        const costSold = all.revenue.sub(all.profit);
        return {
          id: v.id, name: v.name, lots: lots.length + conts.length, kg: all.kg, bought: cost, revenue: all.revenue, costSold, profit: all.profit,
          notSold: Prisma.Decimal.max(ZERO, cost.sub(costSold)), owed: balances.get(v.id)?.owed ?? ZERO,
        };
      })
      .filter((r) => r.lots > 0 || !r.owed.isZero())
      .sort((a, b) => b.bought.comparedTo(a.bought));

    // ---- Owed to suppliers and by customers, now; and what was paid in the period ----
    const owedToSuppliers = [...balances.values()].reduce((t, b) => t.add(Prisma.Decimal.max(ZERO, b.owed)), ZERO);
    const soldTo = new Map(customerSales.map((s) => [s.customerId, s._sum.totalAmount ?? ZERO]));
    const paidBy = new Map(customerPayments.map((p) => [p.customerId, p._sum.amount ?? ZERO]));
    const owedByCustomers = customers.reduce((t, c) => t.add(Prisma.Decimal.max(ZERO, c.openingBalance.add(soldTo.get(c.id) ?? ZERO).sub(paidBy.get(c.id) ?? ZERO))), ZERO);

    return {
      from: firstMonth,
      stock,
      byCustomer: [...byCustomer.values()].map(withProfit).sort((a, b) => b.revenue.comparedTo(a.revenue)),
      byItem: [...byItem.values()].map(withProfit).sort((a, b) => b.revenue.comparedTo(a.revenue)),
      byLot,
      bySupplier,
      owed: {
        toSuppliers: owedToSuppliers, paidToSuppliers: supplierPaid._sum.amount ?? ZERO,
        byCustomers: owedByCustomers, receivedFromCustomers: received._sum.amount ?? ZERO,
      },
    };
  }
}

import { Injectable } from '@nestjs/common';
import { InventoryStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { KHATA_SALE_STATUSES, KhataService } from '../sales/khata.service';
import { byContainer, LineSource, percent, startOfDayPKT, topGradePercent } from './home';

const ZERO = new Prisma.Decimal(0);
const LAST_CONTAINERS = 5;

/** Owner home (journey 7): three numbers and today's sales, and the lists behind them. Every query is per tenant. */
@Injectable()
export class HomeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly khata: KhataService,
  ) {}

  async summary(tenantId: string, now = new Date()) {
    const [containers, khata, stock, today] = await Promise.all([
      this.containers(tenantId, LAST_CONTAINERS),
      this.khata.list(tenantId),
      this.stockReady(tenantId),
      this.prisma.sale.aggregate({
        where: { tenantId, status: { in: KHATA_SALE_STATUSES }, issuedAt: { gte: startOfDayPKT(now) } },
        _count: true,
        _sum: { totalAmount: true, totalProfit: true },
      }),
    ]);
    const profits = containers.containers.map((c) => new Prisma.Decimal(c.profit));
    return {
      profitPerContainer: {
        average: profits.length ? profits.reduce((s, p) => s.add(p), ZERO).div(profits.length).toDecimalPlaces(2).toString() : '0',
        containers: profits.length,
      },
      udhaar: { owed: khata.totalOwed.toString(), customers: khata.customers.filter((c) => c.balance.greaterThan(0)).length },
      stockReady: stock,
      today: { sales: today._count, total: (today._sum.totalAmount ?? ZERO).toString(), profit: (today._sum.totalProfit ?? ZERO).toString() },
    };
  }

  /** The last containers with profit so far (from what has been sold), yield and top-grade %, and supplier / origin comparison. */
  async containers(tenantId: string, limit = 10) {
    const list = await this.prisma.container.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 50),
      select: {
        id: true,
        containerNumber: true,
        originCountry: true,
        landedCostPKR: true,
        createdAt: true,
        vendor: { select: { id: true, name: true } },
        rags: { select: { weightKg: true } },
      },
    });
    const ids = list.map((c) => c.id);
    if (!ids.length) return { containers: [], bySupplier: [], byOrigin: [] };

    const [lines, outputs, graded, topGrade] = await Promise.all([
      this.prisma.saleLine.findMany({
        where: {
          sale: { tenantId, status: { in: KHATA_SALE_STATUSES } },
          inventoryItem: { tenantId, OR: [{ containerId: { in: ids } }, { repackUnit: { inputAllocations: { some: { containerId: { in: ids } } } } }] },
        },
        select: {
          profit: true,
          lineTotal: true,
          inventoryItem: { select: { containerId: true, repackUnit: { select: { inputAllocations: { select: { containerId: true, allocatedCost: true } } } } } },
        },
      }),
      this.prisma.categoryOutput.groupBy({ by: ['containerId'], where: { tenantId, containerId: { in: ids } }, _sum: { weightKg: true } }),
      this.prisma.gradeOutput.findMany({
        where: { tenantId, gradeBucket: { gradeSession: { categoryOutput: { containerId: { in: ids } } } } },
        select: { weightKg: true, grade: { select: { rank: true } }, gradeBucket: { select: { gradeSession: { select: { categoryOutput: { select: { containerId: true } } } } } } },
      }),
      this.prisma.grade.findFirst({ where: { tenantId, isActive: true }, orderBy: { rank: 'asc' }, select: { rank: true } }),
    ]);

    const sources: LineSource[] = lines.map((l) => {
      const allocations = l.inventoryItem.repackUnit?.inputAllocations ?? [];
      return {
        profit: l.profit,
        revenue: l.lineTotal,
        shares: allocations.length
          ? allocations.map((a) => ({ containerId: a.containerId, weight: a.allocatedCost }))
          : [{ containerId: l.inventoryItem.containerId, weight: 1 }],
      };
    });
    const money = byContainer(sources);
    const outputKg = new Map(outputs.map((o) => [o.containerId, o._sum.weightKg ?? ZERO]));
    const gradedBy = new Map<string, { rank: number; kg: Prisma.Decimal }[]>();
    for (const g of graded) {
      const cid = g.gradeBucket.gradeSession.categoryOutput.containerId;
      if (!cid) continue;
      gradedBy.set(cid, [...(gradedBy.get(cid) ?? []), { rank: g.grade.rank, kg: g.weightKg }]);
    }

    const rows = list.map((c) => {
      const kg = c.rags.reduce((s, r) => s.add(r.weightKg), ZERO);
      const m = money.get(c.id);
      return {
        id: c.id,
        containerNumber: c.containerNumber,
        supplier: c.vendor?.name ?? null,
        supplierId: c.vendor?.id ?? null,
        origin: c.originCountry,
        date: c.createdAt,
        kg: kg.toString(),
        landedCost: c.landedCostPKR.toString(),
        revenue: (m?.revenue ?? ZERO).toString(),
        profit: (m?.profit ?? ZERO).toString(),
        // Not sorted yet: no yield to show (rather than 0%).
        yieldPercent: (outputKg.get(c.id) ?? ZERO).isZero() ? null : percent(outputKg.get(c.id)!, kg),
        topGradePercent: topGrade ? topGradePercent(gradedBy.get(c.id) ?? [], topGrade.rank) : null,
      };
    });

    const compare = (key: (r: (typeof rows)[number]) => string | null) => {
      const groups = new Map<string, typeof rows>();
      for (const r of rows) {
        const k = key(r);
        if (k) groups.set(k, [...(groups.get(k) ?? []), r]);
      }
      return [...groups.entries()]
        .map(([name, rs]) => {
          const kg = rs.reduce((s, r) => s.add(r.kg), ZERO);
          const profit = rs.reduce((s, r) => s.add(r.profit), ZERO);
          const allGraded = rs.flatMap((r) => gradedBy.get(r.id) ?? []);
          return {
            name,
            containers: rs.length,
            profit: profit.toString(),
            profitPerKg: kg.isZero() ? '0' : profit.div(kg).toDecimalPlaces(2).toString(),
            topGradePercent: topGrade ? topGradePercent(allGraded, topGrade.rank) : null,
          };
        })
        .sort((a, b) => new Prisma.Decimal(b.profitPerKg).comparedTo(a.profitPerKg));
    };

    return { containers: rows, bySupplier: compare((r) => r.supplier), byOrigin: compare((r) => r.origin) };
  }

  /** What is ready to sell: kg (bales with a weight, and kg stock), bales, items, and their cost. */
  async stockReady(tenantId: string) {
    const items = await this.prisma.inventoryItem.findMany({
      where: { tenantId, status: InventoryStatus.AVAILABLE },
      select: { unit: true, quantity: true, usedQuantity: true, weightKg: true, totalCost: true },
    });
    let kg = ZERO;
    let bales = ZERO;
    let value = ZERO;
    for (const i of items) {
      const left = i.quantity.sub(i.usedQuantity);
      if (left.lessThanOrEqualTo(0) || i.quantity.isZero()) continue;
      const share = left.div(i.quantity);
      if (i.unit === 'KG') kg = kg.add(left);
      else if (i.weightKg) kg = kg.add(i.weightKg.mul(share));
      if (i.unit === 'BALE') bales = bales.add(left);
      value = value.add(i.totalCost.mul(share));
    }
    return { kg: kg.toDecimalPlaces(1).toString(), bales: bales.toString(), items: items.length, value: value.toDecimalPlaces(2).toString() };
  }

  /** Today's sales (Pakistan time), newest first. */
  async today(tenantId: string, now = new Date()) {
    return this.prisma.sale.findMany({
      where: { tenantId, status: { in: KHATA_SALE_STATUSES }, issuedAt: { gte: startOfDayPKT(now) } },
      orderBy: { issuedAt: 'desc' },
      select: { id: true, saleNumber: true, totalAmount: true, totalProfit: true, paymentMode: true, issuedAt: true, customer: { select: { id: true, name: true } } },
    });
  }
}

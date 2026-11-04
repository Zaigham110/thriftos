import { Injectable } from '@nestjs/common';
import { InventoryStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { KHATA_SALE_STATUSES, KhataService } from '../sales/khata.service';
import { startOfDayPKT } from './home';
import { combine, containerEconomics, topPercent, yieldPercent } from './container-economics';

const ZERO = new Prisma.Decimal(0);
const LAST_CONTAINERS = 5;
/** How long a new business sees the first-week checklist on Home. */
const FIRST_WEEK_DAYS = 30;

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

  /**
   * First-week checklist (v2 6.4): what a new business has done of the four first steps. Shown for 30 days after the
   * business was made, until all four are done or the owner hides it.
   */
  async firstWeek(tenantId: string, now = new Date()) {
    const [tenant, suppliers, containers, sales, team] = await Promise.all([
      this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { createdAt: true, firstWeekHiddenAt: true } }),
      this.prisma.vendor.count({ where: { tenantId } }),
      this.prisma.container.count({ where: { tenantId } }),
      this.prisma.sale.count({ where: { tenantId } }),
      this.prisma.user.count({ where: { tenantId, isActive: true } }),
    ]);
    const steps = { supplier: suppliers > 0, container: containers > 0, sale: sales > 0, team: team > 1 };
    const done = Object.values(steps).filter(Boolean).length;
    const young = now.getTime() - tenant.createdAt.getTime() < FIRST_WEEK_DAYS * 86_400_000;
    return { show: young && !tenant.firstWeekHiddenAt && done < 4, done, steps };
  }

  async hideFirstWeek(tenantId: string) {
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { firstWeekHiddenAt: new Date() } });
    return { show: false };
  }

  /** The last containers with profit so far (from what has been sold), yield and top-grade %, and supplier / origin comparison. */
  async containers(tenantId: string, limit = 10) {
    const list = await this.prisma.container.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 50),
      select: { id: true, containerNumber: true, originCountry: true, landedCostPKR: true, createdAt: true, vendor: { select: { id: true, name: true } } },
    });
    if (!list.length) return { containers: [], bySupplier: [], byOrigin: [] };
    const econ = await containerEconomics(this.prisma, tenantId, list.map((c) => c.id));

    const rows = list.map((c) => {
      const e = econ.get(c.id)!;
      return {
        id: c.id,
        containerNumber: c.containerNumber,
        supplier: c.vendor?.name ?? null,
        supplierId: c.vendor?.id ?? null,
        origin: c.originCountry,
        date: c.createdAt,
        kg: e.kg.toString(),
        landedCost: c.landedCostPKR.toString(),
        revenue: e.revenue.toString(),
        profit: e.profit.toString(),
        // Not sorted yet: no yield to show (rather than 0%).
        yieldPercent: yieldPercent(e),
        topGradePercent: topPercent(e),
      };
    });

    const compare = (key: (r: (typeof rows)[number]) => string | null) => {
      const groups = new Map<string, string[]>();
      for (const r of rows) {
        const k = key(r);
        if (k) groups.set(k, [...(groups.get(k) ?? []), r.id]);
      }
      return [...groups.entries()]
        .map(([name, ids]) => {
          const t = combine(ids.map((id) => econ.get(id)!));
          return { name, containers: ids.length, profit: t.profit.toString(), profitPerKg: t.profitPerKg.toString(), topGradePercent: t.topGradePercent };
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

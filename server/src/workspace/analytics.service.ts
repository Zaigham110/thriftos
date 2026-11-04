import { BadRequestException, Injectable } from '@nestjs/common';
import { ContainerStatus, PaymentMethod, Prisma, StockUnit } from '@prisma/client';
import { IsDateString, IsIn, IsOptional } from 'class-validator';
import { BUSINESS_UTC_OFFSET_MINUTES, localDayStart } from '../common/list/list-engine';
import { combine, containerEconomics, topPercent, yieldPercent } from '../home/container-economics';
import { percent } from '../home/home';
import { PrismaService } from '../prisma/prisma.service';
import { RECORD_TYPES } from '../records/record-types';
import { KHATA_SALE_STATUSES } from '../sales/khata.service';
import { ReceivablesService } from './receivables.service';
import { StockRecordsService } from './stock-records.service';

const ZERO = new Prisma.Decimal(0);
const DAY = 86_400_000;
const OFFSET = BUSINESS_UTC_OFFSET_MINUTES * 60_000;

export class PeriodDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

export const SCORE_GROUPS = ['supplier', 'origin'] as const;
export class ScorecardQueryDto extends PeriodDto {
  @IsOptional() @IsIn(SCORE_GROUPS) by?: (typeof SCORE_GROUPS)[number];
}

export const SALES_GROUPS = ['customer', 'category', 'grade', 'city', 'month'] as const;
export class SalesAnalyticsQueryDto extends PeriodDto {
  @IsOptional() @IsIn(SALES_GROUPS) by?: (typeof SALES_GROUPS)[number];
}

/** Pakistan business day / month of a moment. */
const day = (d: Date) => new Date(d.getTime() + OFFSET).toISOString().slice(0, 10);
const month = (d: Date) => day(d).slice(0, 7);
const money = <T>(allowed: boolean, v: T): T | null => (allowed ? v : null);

/** A period [from, to) in business days; this month so far when not given. */
export function period(q: PeriodDto, now = new Date()): { fromDay: string; toDay: string; from: Date; to: Date; days: number } {
  const today = day(now);
  const fromDay = q.from?.slice(0, 10) ?? today.slice(0, 8) + '01';
  const toDay = q.to?.slice(0, 10) ?? today;
  const from = localDayStart(fromDay);
  const to = new Date(localDayStart(toDay).getTime() + DAY);
  if (from >= to) throw new BadRequestException('"from" must be before "to"');
  if ((to.getTime() - from.getTime()) / DAY > 3 * 366) throw new BadRequestException('Choose a period of at most three years');
  return { fromDay, toDay, from, to, days: Math.round((to.getTime() - from.getTime()) / DAY) };
}

/**
 * Dashboards and analytics (enterprise plan E4): the owner dashboard, the supplier & origin scorecard and sales
 * analytics. Totals come from the same rows the lists use, so a number here matches its list (tests).
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly receivables: ReceivablesService,
    private readonly stock: StockRecordsService,
  ) {}

  private async salesTotals(tenantId: string, from: Date, to: Date) {
    const a = await this.prisma.sale.aggregate({
      where: { tenantId, status: { in: KHATA_SALE_STATUSES }, createdAt: { gte: from, lt: to } },
      _count: true,
      _sum: { totalAmount: true, totalCost: true, totalProfit: true },
    });
    const revenue = a._sum.totalAmount ?? ZERO;
    const profit = a._sum.totalProfit ?? ZERO;
    return { sales: a._count, revenue, cost: a._sum.totalCost ?? ZERO, profit, marginPercent: revenue.isZero() ? null : profit.div(revenue).mul(100).toDecimalPlaces(1).toNumber() };
  }

  /** E4.1 Owner dashboard for a period, compared with the same length of time just before it. */
  async dashboard(tenantId: string, q: PeriodDto, perms: { cost: boolean; finance: boolean }, now = new Date()) {
    const p = period(q, now);
    const prevFrom = new Date(p.from.getTime() - p.days * DAY);
    const [current, previous, sales, payments, expenses, prevPayments, receivables, stock, containers, activity, todaySales, todayPayments] = await Promise.all([
      this.salesTotals(tenantId, p.from, p.to),
      this.salesTotals(tenantId, prevFrom, p.from),
      this.prisma.sale.findMany({ where: { tenantId, status: { in: KHATA_SALE_STATUSES }, createdAt: { gte: p.from, lt: p.to } }, select: { createdAt: true, totalAmount: true, totalProfit: true } }),
      this.prisma.payment.findMany({ where: { tenantId, receivedAt: { gte: p.from, lt: p.to } }, select: { amount: true, method: true } }),
      this.prisma.expense.aggregate({ where: { tenantId, cancelledAt: null, day: { gte: new Date(p.fromDay + 'T00:00:00Z'), lt: new Date(new Date(p.toDay + 'T00:00:00Z').getTime() + DAY) } }, _sum: { amount: true } }),
      this.prisma.payment.aggregate({ where: { tenantId, receivedAt: { gte: prevFrom, lt: p.from } }, _sum: { amount: true } }),
      this.receivables.worklist(tenantId, now),
      this.stock.summary(tenantId, perms.cost, now),
      this.prisma.container.findMany({
        where: { tenantId, status: { not: ContainerStatus.CLOSED } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, containerNumber: true, status: true, netWeight: true, vendor: { select: { name: true } } },
      }),
      this.prisma.auditLog.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 12, select: { id: true, action: true, entityType: true, entityId: true, createdAt: true, userId: true } }),
      this.prisma.sale.aggregate({ where: { tenantId, status: { in: KHATA_SALE_STATUSES }, createdAt: { gte: localDayStart(day(now)) } }, _count: true, _sum: { totalAmount: true } }),
      this.prisma.payment.aggregate({ where: { tenantId, receivedAt: { gte: localDayStart(day(now)) } }, _count: true, _sum: { amount: true } }),
    ]);

    // Trend: per day up to ~2 months, else per month.
    const byMonth = p.days > 62;
    const buckets: string[] = [];
    if (byMonth) {
      for (let d = new Date(p.fromDay.slice(0, 7) + '-01T00:00:00Z'); d.toISOString().slice(0, 7) <= p.toDay.slice(0, 7); d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) buckets.push(d.toISOString().slice(0, 7));
    } else {
      for (let t = new Date(p.fromDay + 'T00:00:00Z').getTime(); new Date(t).toISOString().slice(0, 10) <= p.toDay; t += DAY) buckets.push(new Date(t).toISOString().slice(0, 10));
    }
    const trend = new Map(buckets.map((b) => [b, { revenue: ZERO, profit: ZERO }]));
    for (const s of sales) {
      const t = trend.get(byMonth ? month(s.createdAt) : day(s.createdAt));
      if (t) { t.revenue = t.revenue.add(s.totalAmount); t.profit = t.profit.add(s.totalProfit); }
    }
    const collected = payments.reduce((t, x) => t.add(x.amount), ZERO);
    const byMethod = Object.values(PaymentMethod).map((m) => ({ method: m, amount: payments.filter((x) => x.method === m).reduce((t, x) => t.add(x.amount), ZERO) })).filter((x) => !x.amount.isZero());

    const econ = await containerEconomics(this.prisma, tenantId, containers.map((c) => c.id));
    const userIds = [...new Set(activity.map((a) => a.userId))];
    const users = await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });
    const nameOf = new Map(users.map((u) => [u.id, u.name]));
    const typeOf = Object.entries(RECORD_TYPES);
    const expenseTotal = expenses._sum.amount ?? ZERO;

    return {
      period: { from: p.fromDay, to: p.toDay, days: p.days, previousFrom: day(prevFrom) },
      sales: {
        count: current.sales, revenue: current.revenue, previousRevenue: previous.revenue,
        grossProfit: money(perms.cost, current.profit), previousGrossProfit: money(perms.cost, previous.profit),
        marginPercent: money(perms.cost, current.marginPercent), previousMarginPercent: money(perms.cost, previous.marginPercent),
        trend: { by: byMonth ? 'month' : 'day', points: buckets.map((b) => ({ key: b, revenue: trend.get(b)!.revenue, profit: money(perms.cost, trend.get(b)!.profit) })) },
      },
      cash: { collected, previousCollected: prevPayments._sum.amount ?? ZERO, byMethod },
      expenses: perms.finance ? { total: expenseTotal, netProfit: perms.cost ? current.profit.sub(expenseTotal) : null } : null,
      udhaar: { owed: receivables.totals.owed, customers: receivables.totals.customers, buckets: receivables.totals.buckets, brokenPromises: receivables.rows.filter((r) => r.promise?.status === 'BROKEN').length },
      stock: { items: stock.total.items, kg: stock.total.kg, value: stock.total.value, ageing: stock.ageing },
      containers: {
        count: containers.length,
        kg: containers.reduce((t, c) => t.add(c.netWeight), ZERO),
        list: containers.slice(0, 6).map((c) => {
          const e = econ.get(c.id)!;
          return { id: c.id, number: c.containerNumber, supplier: c.vendor?.name ?? null, status: c.status, kg: c.netWeight, revenue: e.revenue, profit: money(perms.cost, e.profit), yield: yieldPercent(e) };
        }),
      },
      today: { sales: todaySales._count, revenue: todaySales._sum.totalAmount ?? ZERO, payments: todayPayments._count, collected: todayPayments._sum.amount ?? ZERO },
      activity: activity.map((a) => {
        const type = typeOf.find(([, t]) => t.auditEntities.includes(a.entityType));
        return { id: a.id, at: a.createdAt, action: a.action, who: nameOf.get(a.userId) ?? null, link: type ? type[1].link(a.entityId) : null };
      }),
    };
  }

  /** E4.2 Supplier and origin scorecard: containers received in the period, ranked by profit per kg. */
  async scorecard(tenantId: string, q: ScorecardQueryDto, canSeeCost: boolean, now = new Date()) {
    const by = q.by ?? 'supplier';
    const p = q.from || q.to ? period(q, now) : null;
    const containers = await this.prisma.container.findMany({
      where: { tenantId, ...(p ? { createdAt: { gte: p.from, lt: p.to } } : {}) },
      select: { id: true, originCountry: true, netWeight: true, landedCostPKR: true, vendor: { select: { id: true, name: true } } },
    });
    const econ = await containerEconomics(this.prisma, tenantId, containers.map((c) => c.id));
    const groups = new Map<string, { key: string; id: string | null; ids: string[]; landed: Prisma.Decimal; netKg: Prisma.Decimal }>();
    for (const c of containers) {
      const key = by === 'origin' ? c.originCountry ?? '' : c.vendor?.name ?? '';
      const g = groups.get(key) ?? { key, id: by === 'supplier' ? c.vendor?.id ?? null : null, ids: [], landed: ZERO, netKg: ZERO };
      g.ids.push(c.id);
      g.landed = g.landed.add(c.landedCostPKR);
      g.netKg = g.netKg.add(c.netWeight);
      groups.set(key, g);
    }
    const rows = [...groups.values()].map((g) => {
      const t = combine(g.ids.map((id) => econ.get(id)!));
      return {
        key: g.key, id: g.id, containers: g.ids.length, kg: t.kg, landed: money(canSeeCost, g.landed),
        costPerKg: money(canSeeCost, g.netKg.isZero() ? ZERO : g.landed.div(g.netKg).toDecimalPlaces(2)),
        revenue: t.revenue, profit: money(canSeeCost, t.profit), profitPerKg: money(canSeeCost, t.profitPerKg),
        yieldPercent: t.yieldPercent, topGradePercent: t.topGradePercent,
      };
    });
    // Ranked by profit per kg (what a kg bought from them earned), then sorted %.
    rows.sort((a, b) => (canSeeCost ? new Prisma.Decimal(b.profitPerKg ?? 0).comparedTo(a.profitPerKg ?? 0) : 0) || (b.yieldPercent ?? -1) - (a.yieldPercent ?? -1) || a.key.localeCompare(b.key));
    const all = combine(containers.map((c) => econ.get(c.id)!));
    return {
      by, from: p?.fromDay ?? null, to: p?.toDay ?? null,
      totals: { containers: containers.length, kg: all.kg, revenue: all.revenue, profit: money(canSeeCost, all.profit), profitPerKg: money(canSeeCost, all.profitPerKg), yieldPercent: all.yieldPercent, topGradePercent: all.topGradePercent },
      rows: rows.map((r, i) => ({ rank: i + 1, ...r })),
    };
  }

  /** E4.3 Sales analytics from sale lines: by customer, category, grade, city or month; top customers; price trend per grade. */
  async sales(tenantId: string, q: SalesAnalyticsQueryDto, canSeeCost: boolean, now = new Date()) {
    const by = q.by ?? 'customer';
    const p = period(q.from || q.to ? q : { from: day(new Date(now.getTime() - 365 * DAY)), to: day(now) }, now);
    const lines = await this.prisma.saleLine.findMany({
      where: { sale: { tenantId, status: { in: KHATA_SALE_STATUSES }, createdAt: { gte: p.from, lt: p.to } } },
      select: {
        unit: true, quantity: true, unitPrice: true, lineTotal: true, lineCost: true, profit: true,
        sale: { select: { id: true, createdAt: true, customer: { select: { id: true, name: true, city: true } } } },
        inventoryItem: { select: { unit: true, quantity: true, weightKg: true, category: { select: { name: true } }, grade: { select: { name: true } } } },
      },
    });
    const kgOf = (l: (typeof lines)[number]) => {
      if (l.unit === StockUnit.KG) return l.quantity;
      const i = l.inventoryItem;
      return i.weightKg && !i.quantity.isZero() && l.unit === i.unit ? i.weightKg.div(i.quantity).mul(l.quantity) : null;
    };
    const keyOf = (l: (typeof lines)[number]) => {
      switch (by) {
        case 'category': return l.inventoryItem.category?.name ?? '';
        case 'grade': return l.inventoryItem.grade?.name ?? '';
        case 'city': return l.sale.customer.city ?? '';
        case 'month': return month(l.sale.createdAt);
        default: return l.sale.customer.name;
      }
    };
    type G = { key: string; id: string | null; sales: Set<string>; revenue: Prisma.Decimal; cost: Prisma.Decimal; profit: Prisma.Decimal; kg: Prisma.Decimal };
    const groups = new Map<string, G>();
    for (const l of lines) {
      const k = keyOf(l);
      const g = groups.get(k) ?? { key: k, id: by === 'customer' ? l.sale.customer.id : null, sales: new Set<string>(), revenue: ZERO, cost: ZERO, profit: ZERO, kg: ZERO };
      g.sales.add(l.sale.id);
      g.revenue = g.revenue.add(l.lineTotal);
      g.cost = g.cost.add(l.lineCost);
      g.profit = g.profit.add(l.profit);
      g.kg = g.kg.add(kgOf(l) ?? ZERO);
      groups.set(k, g);
    }
    const total = lines.reduce((t, l) => t.add(l.lineTotal), ZERO);
    const rows = [...groups.values()]
      .map((g) => ({
        key: g.key, id: g.id, sales: g.sales.size, revenue: g.revenue, sharePercent: percent(g.revenue, total), kg: g.kg,
        profit: money(canSeeCost, g.profit), marginPercent: money(canSeeCost, g.revenue.isZero() ? null : g.profit.div(g.revenue).mul(100).toDecimalPlaces(1).toNumber()),
        perKg: g.kg.isZero() ? null : g.revenue.div(g.kg).toDecimalPlaces(2),
      }))
      .sort((a, b) => (by === 'month' ? a.key.localeCompare(b.key) : b.revenue.comparedTo(a.revenue)));

    // Price trend per grade: average price per kg (revenue ÷ kg) by month.
    const months = [...new Set(lines.map((l) => month(l.sale.createdAt)))].sort();
    const gradeNames = [...new Set(lines.map((l) => l.inventoryItem.grade?.name).filter((x): x is string => !!x))].sort();
    const trend = gradeNames.map((g) => ({
      grade: g,
      points: months.map((m) => {
        const ls = lines.filter((l) => l.inventoryItem.grade?.name === g && month(l.sale.createdAt) === m && kgOf(l));
        const kg = ls.reduce((t, l) => t.add(kgOf(l)!), ZERO);
        return { month: m, perKg: kg.isZero() ? null : ls.reduce((t, l) => t.add(l.lineTotal), ZERO).div(kg).toDecimalPlaces(2) };
      }),
    }));
    const profitTotal = lines.reduce((t, l) => t.add(l.profit), ZERO);
    return {
      by, from: p.fromDay, to: p.toDay,
      totals: {
        sales: new Set(lines.map((l) => l.sale.id)).size, revenue: total, profit: money(canSeeCost, profitTotal), kg: lines.reduce((t, l) => t.add(kgOf(l) ?? ZERO), ZERO),
        // Price per kg only over lines whose weight is known (a bale without a weight has no kg).
        perKg: (() => {
          const known = lines.filter((l) => kgOf(l));
          const kg = known.reduce((t, l) => t.add(kgOf(l)!), ZERO);
          return kg.isZero() ? null : known.reduce((t, l) => t.add(l.lineTotal), ZERO).div(kg).toDecimalPlaces(2);
        })(),
      },
      rows,
      topCustomers: this.top(lines.map((l) => ({ id: l.sale.customer.id, name: l.sale.customer.name, revenue: l.lineTotal }))),
      priceTrend: { months, grades: trend },
    };
  }

  private top(list: { id: string; name: string; revenue: Prisma.Decimal }[]) {
    const m = new Map<string, { id: string; name: string; revenue: Prisma.Decimal }>();
    for (const x of list) {
      const c = m.get(x.id) ?? { id: x.id, name: x.name, revenue: ZERO };
      c.revenue = c.revenue.add(x.revenue);
      m.set(x.id, c);
    }
    return [...m.values()].sort((a, b) => b.revenue.comparedTo(a.revenue)).slice(0, 10);
  }
}

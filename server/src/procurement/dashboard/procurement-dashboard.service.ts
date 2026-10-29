import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { parseDateRange } from '../../reports/common/report-utils';

function toIsoDate(d: Date): string {
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  return utc.toISOString().slice(0, 10);
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

@Injectable()
export class ProcurementDashboardService {
  constructor(private prisma: PrismaService) {}

  private resolveRange(filters: { startDate?: string; endDate?: string }) {
    const { start, end } = parseDateRange(filters);
    const effectiveEnd = end ?? startOfTodayUtc();
    const effectiveStart = start ?? addDays(effectiveEnd, -29);
    return { start: effectiveStart, end: effectiveEnd, startDate: toIsoDate(effectiveStart), endDate: toIsoDate(effectiveEnd) };
  }

  async summary(tenantId: string, filters: { startDate?: string; endDate?: string }) {
    const range = this.resolveRange(filters);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { currency: true },
    });

    const [activePos, inTransitContainers, looseBalesReceived] = await Promise.all([
      this.prisma.purchaseOrder.count({ where: { tenantId, status: 'OPEN' } }),
      this.prisma.container.count({ where: { tenantId, status: 'IN_TRANSIT' } }),
      this.prisma.rag.count({
        where: {
          tenantId,
          containerId: null,
          createdAt: { gte: range.start, lte: range.end },
        },
      }),
    ]);

    const budgetAgg = await this.prisma.$queryRawUnsafe<
      Array<{ totalBudgetCap: string | null; totalSpent: string | null }>
    >(
      `
      SELECT
        COALESCE(SUM(po."budgetCap"), 0) AS "totalBudgetCap",
        COALESCE(SUM(po."totalCost"), 0) AS "totalSpent"
      FROM "PurchaseOrder" po
      WHERE po."tenantId" = $1
        AND po."status" = 'OPEN'
      `,
      tenantId,
    );

    const totalBudgetCap = new Decimal(budgetAgg?.[0]?.totalBudgetCap ?? 0);
    const totalSpent = new Decimal(budgetAgg?.[0]?.totalSpent ?? 0);
    const remainingBudget = totalBudgetCap.sub(totalSpent);

    // Chart 1: PO spend vs allocated (as utilization % per active PO)
    const activePoRows = await this.prisma.$queryRawUnsafe<
      Array<{ poNumber: string; totalCost: string; budgetCap: string }>
    >(
      `
      SELECT
        po."poNumber" AS "poNumber",
        po."totalCost" AS "totalCost",
        po."budgetCap" AS "budgetCap"
      FROM "PurchaseOrder" po
      WHERE po."tenantId" = $1
        AND po."status" = 'OPEN'
        AND po."budgetCap" IS NOT NULL
      ORDER BY po."createdAt" DESC
      LIMIT 10
      `,
      tenantId,
    );

    const poUtilization = activePoRows.map((po) => {
      const cap = new Decimal(po.budgetCap ?? 0);
      const spent = new Decimal(po.totalCost ?? 0);
      const pct = cap.equals(new Decimal(0)) ? new Decimal(0) : spent.div(cap).mul(100);
      return { label: po.poNumber, value: Number(pct.toFixed(2)) };
    });

    // Chart 2: Vendor distribution (share % of spend in range)
    const vendorSpend = await this.prisma.$queryRawUnsafe<
      Array<{ vendorId: string | null; vendorName: string | null; totalCost: string }>
    >(
      `
      SELECT
        v."id" AS "vendorId",
        v."name" AS "vendorName",
        COALESCE(SUM(po."totalCost"), 0) AS "totalCost"
      FROM "PurchaseOrder" po
      LEFT JOIN "Vendor" v ON v."id" = po."vendorId"
      WHERE po."tenantId" = $1
        AND po."createdAt" >= $2
        AND po."createdAt" <= $3
      GROUP BY v."id", v."name"
      ORDER BY COALESCE(SUM(po."totalCost"), 0) DESC
      LIMIT 8
      `,
      tenantId,
      range.start,
      range.end,
    );

    const vendorTotal = vendorSpend.reduce((sum, r) => sum.add(new Decimal(r.totalCost as any)), new Decimal(0));

    const vendorDistribution = vendorSpend.map((r) => {
      const cost = new Decimal(r.totalCost as any);
      const sharePct = vendorTotal.equals(new Decimal(0)) ? new Decimal(0) : cost.div(vendorTotal).mul(100);
      return {
        vendorId: r.vendorId,
        vendorName: r.vendorName ?? 'Unassigned',
        totalCost: cost.toString(),
        sharePct: Number(sharePct.toFixed(2)),
      };
    });

    return {
      range: { startDate: range.startDate, endDate: range.endDate },
      currency: tenant?.currency ?? 'USD',
      kpis: {
        activePos,
        remainingBudget: remainingBudget.toString(),
        containersInTransit: inTransitContainers,
        looseBalesReceived,
      },
      charts: {
        poSpendVsAllocated: poUtilization,
        vendorDistribution,
      },
      generatedAt: new Date().toISOString(),
    };
  }
}

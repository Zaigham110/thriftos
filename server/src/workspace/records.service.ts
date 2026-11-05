import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { combine, containerEconomics, topPercent, yieldPercent } from '../home/container-economics';
import { KHATA_SALE_STATUSES } from '../sales/khata.service';
import { PrismaService } from '../prisma/prisma.service';

const ZERO = new Prisma.Decimal(0);

/** Hides money a person may not see (cost and profit need cost.view). */
function money<T>(allowed: boolean, value: T): T | null {
  return allowed ? value : null;
}

/**
 * Record pages for the workspace (enterprise plan E3.1). The container overview is the traceability page:
 * landed cost → lots → sorting by category and grade → bales → sales → profit, all for one business.
 */
@Injectable()
export class WorkspaceRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  async container(tenantId: string, id: string, canSeeCost: boolean) {
    const c = await this.prisma.container.findFirst({
      where: { id, tenantId },
      include: { vendor: { select: { id: true, name: true } }, containerCharges: { orderBy: { createdAt: 'asc' } } },
    });
    if (!c) throw new NotFoundException('Container not found');

    const [econ, lots, outputs, waste, grades, allocations] = await Promise.all([
      containerEconomics(this.prisma, tenantId, [id]),
      this.prisma.rag.findMany({ where: { tenantId, containerId: id }, orderBy: { createdAt: 'asc' }, select: { id: true, ragCode: true, weightKg: true, allocatedCost: true, status: true, rawCategory: { select: { name: true } } } }),
      this.prisma.categoryOutput.groupBy({ by: ['categoryId'], where: { tenantId, containerId: id }, _sum: { weightKg: true, allocatedCost: true } }),
      this.prisma.wasteLineItem.aggregate({ where: { tenantId, containerId: id, unitType: 'KG' }, _sum: { amount: true } }),
      this.prisma.gradeOutput.findMany({
        where: { tenantId, gradeBucket: { gradeSession: { categoryOutput: { containerId: id } } } },
        select: { weightKg: true, grade: { select: { name: true, rank: true } } },
      }),
      this.prisma.repackInputAllocation.findMany({
        where: { tenantId, containerId: id },
        select: {
          allocatedCost: true,
          repackUnit: {
            select: {
              id: true, unitCode: true, weightKg: true, totalCost: true,
              category: { select: { name: true } }, grade: { select: { name: true } },
              inventoryItems: { select: { id: true, status: true, quantity: true, usedQuantity: true } },
            },
          },
        },
      }),
    ]);
    const e = econ.get(id)!;
    const categories = await this.prisma.category.findMany({ where: { tenantId, id: { in: outputs.map((o) => o.categoryId) } }, select: { id: true, name: true } });
    const catName = new Map(categories.map((x) => [x.id, x.name]));

    // Grades: kg per grade name, best first.
    const byGrade = new Map<string, { name: string; rank: number; kg: Prisma.Decimal }>();
    for (const g of grades) {
      const cur = byGrade.get(g.grade.name) ?? { name: g.grade.name, rank: g.grade.rank, kg: ZERO };
      cur.kg = cur.kg.add(g.weightKg);
      byGrade.set(g.grade.name, cur);
    }

    // Bales made (in part) from this container; one row per bale.
    const bales = new Map<string, { id: string; itemId: string | null; code: string; category: string | null; grade: string | null; kg: Prisma.Decimal; sold: boolean; costFromHere: Prisma.Decimal; totalCost: Prisma.Decimal }>();
    for (const a of allocations) {
      const u = a.repackUnit;
      const item = u.inventoryItems[0];
      const cur = bales.get(u.id) ?? {
        id: u.id, itemId: item?.id ?? null, code: u.unitCode, category: u.category?.name ?? null, grade: u.grade?.name ?? null,
        kg: u.weightKg, sold: !!item && new Prisma.Decimal(item.usedQuantity).greaterThanOrEqualTo(item.quantity), costFromHere: ZERO, totalCost: u.totalCost,
      };
      cur.costFromHere = cur.costFromHere.add(a.allocatedCost);
      bales.set(u.id, cur);
    }

    // Sales of its stock: this container's share of each line (by cost share for mixed bales).
    const lines = await this.prisma.saleLine.findMany({
      where: {
        sale: { tenantId, status: { in: KHATA_SALE_STATUSES } },
        inventoryItem: { tenantId, OR: [{ containerId: id }, { repackUnit: { inputAllocations: { some: { containerId: id } } } }] },
      },
      select: {
        lineTotal: true, profit: true,
        sale: { select: { id: true, saleNumber: true, createdAt: true, customer: { select: { name: true } } } },
        inventoryItem: { select: { containerId: true, repackUnit: { select: { inputAllocations: { select: { containerId: true, allocatedCost: true } } } } } },
      },
    });
    const sales = new Map<string, { id: string; number: string; date: Date; customer: string; revenue: Prisma.Decimal; profit: Prisma.Decimal }>();
    for (const l of lines) {
      const allocs = l.inventoryItem.repackUnit?.inputAllocations ?? [];
      const total = allocs.reduce((s, a) => s.add(a.allocatedCost), ZERO);
      const mine = allocs.filter((a) => a.containerId === id).reduce((s, a) => s.add(a.allocatedCost), ZERO);
      const share = allocs.length ? (total.isZero() ? ZERO : mine.div(total)) : new Prisma.Decimal(l.inventoryItem.containerId === id ? 1 : 0);
      const cur = sales.get(l.sale.id) ?? { id: l.sale.id, number: l.sale.saleNumber, date: l.sale.createdAt, customer: l.sale.customer.name, revenue: ZERO, profit: ZERO };
      cur.revenue = cur.revenue.add(l.lineTotal.mul(share));
      cur.profit = cur.profit.add(l.profit.mul(share));
      sales.set(l.sale.id, cur);
    }

    const charges = c.containerCharges.reduce((s, x) => s.add(x.amount), ZERO);
    const purchasePKR = c.purchaseCurrency === 'PKR' ? c.purchaseCost : c.purchaseCost.mul(c.fxRate).toDecimalPlaces(2);
    const wasteKg = waste._sum.amount ?? ZERO;
    const baleList = [...bales.values()].sort((a, b) => a.code.localeCompare(b.code));

    return {
      container: {
        id: c.id, number: c.containerNumber, status: c.status, supplier: c.vendor, origin: c.originCountry, createdAt: c.createdAt,
        arrivedAt: c.arrivedAt, clearedAt: c.clearedAt, netWeight: c.netWeight, grossWeight: c.grossWeight, billOfLading: c.billOfLadingNumber,
        vessel: c.vesselName, notes: c.notes, purchaseCurrency: c.purchaseCurrency, fxRate: c.fxRate,
        kantaKg: c.weighbridgeNetWeight,
        shipping: {
          referenceNumber: c.referenceNumber, containerType: c.containerType, billOfLading: c.billOfLadingNumber, shippingLine: c.shippingLine,
          vessel: c.vesselName, forwarder: c.forwarder, portOfLoading: c.portOfLoading, portOfDischarge: c.portOfDischarge, etd: c.etd, eta: c.eta,
        },
      },
      cost: canSeeCost
        ? {
            purchase: c.purchaseCost, purchasePKR,
            charges: c.containerCharges.map((x) => ({ id: x.id, type: x.chargeType, description: x.description, amount: x.amount })),
            chargesTotal: charges, landed: c.landedCostPKR, perKg: c.landedCostPerKg,
          }
        : null,
      lots: lots.map((l) => ({ id: l.id, code: l.ragCode, kg: l.weightKg, status: l.status, rawType: l.rawCategory?.name ?? null, cost: money(canSeeCost, l.allocatedCost) })),
      sorting: {
        categories: outputs
          .map((o) => ({ name: catName.get(o.categoryId) ?? '', kg: o._sum.weightKg ?? ZERO, cost: money(canSeeCost, o._sum.allocatedCost ?? ZERO) }))
          .sort((a, b) => b.kg.comparedTo(a.kg)),
        sortedKg: e.outputKg,
        wasteKg,
        yieldPercent: yieldPercent(e),
      },
      grades: [...byGrade.values()].sort((a, b) => a.rank - b.rank).map((g) => ({ name: g.name, kg: g.kg })),
      topGradePercent: topPercent(e),
      bales: baleList.map((b) => ({ ...b, costFromHere: money(canSeeCost, b.costFromHere), totalCost: money(canSeeCost, b.totalCost) })),
      sales: [...sales.values()]
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .map((s) => ({ ...s, revenue: s.revenue.toDecimalPlaces(2), profit: money(canSeeCost, s.profit.toDecimalPlaces(2)) })),
      totals: {
        kg: e.kg,
        bales: baleList.length,
        balesSold: baleList.filter((b) => b.sold).length,
        revenue: e.revenue,
        profit: money(canSeeCost, e.profit),
        profitPerKg: money(canSeeCost, e.kg.isZero() ? ZERO : e.profit.div(e.kg).toDecimalPlaces(2)),
      },
    };
  }

  async supplier(tenantId: string, id: string, canSeeCost: boolean) {
    const v = await this.prisma.vendor.findFirst({
      where: { id, tenantId },
      select: { id: true, name: true, originCountry: true, country: true, contactPerson: true, contactPhone: true, contactEmail: true, paymentTerms: true, vendorType: true, createdAt: true },
    });
    if (!v) throw new NotFoundException('Supplier not found');
    const containers = await this.prisma.container.findMany({
      where: { tenantId, vendorId: id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, containerNumber: true, createdAt: true, status: true, netWeight: true, landedCostPKR: true, landedCostPerKg: true, originCountry: true },
    });
    const econ = await containerEconomics(this.prisma, tenantId, containers.map((c) => c.id));
    const t = combine(containers.map((c) => econ.get(c.id)!));
    const landed = containers.reduce((s, c) => s.add(c.landedCostPKR), ZERO);
    return {
      supplier: v,
      totals: {
        containers: containers.length,
        kg: t.kg,
        landed: money(canSeeCost, landed),
        revenue: t.revenue,
        profit: money(canSeeCost, t.profit),
        profitPerKg: money(canSeeCost, t.profitPerKg),
        yieldPercent: t.yieldPercent,
        topGradePercent: t.topGradePercent,
      },
      containers: containers.map((c) => {
        const e = econ.get(c.id)!;
        return {
          id: c.id, number: c.containerNumber, date: c.createdAt, status: c.status, origin: c.originCountry, kg: c.netWeight,
          landedCost: money(canSeeCost, c.landedCostPKR), costPerKg: money(canSeeCost, c.landedCostPerKg),
          revenue: e.revenue, profit: money(canSeeCost, e.profit), yield: yieldPercent(e), topGrade: topPercent(e),
        };
      }),
    };
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SortStatus, WasteStage, WasteUnitType } from '@prisma/client';
import { IsDateString, IsIn, IsOptional } from 'class-validator';
import { localDayStart } from '../common/list/list-engine';
import { percent, topGradePercent } from '../home/home';
import { PrismaService } from '../prisma/prisma.service';

const ZERO = new Prisma.Decimal(0);
const DAY = 86_400_000;

export const YIELD_GROUPS = ['supplier', 'origin', 'rawCategory', 'container', 'month'] as const;
export type YieldGroup = (typeof YIELD_GROUPS)[number];

export class YieldQueryDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsIn(YIELD_GROUPS) by?: YieldGroup;
}

const money = <T>(allowed: boolean, v: T): T | null => (allowed ? v : null);

/**
 * Sorting in the workspace (enterprise plan E3.2): a lot's sorting record (stage 1 by category, stage 2 by
 * grade, waste, cost) and yield analysis — how much of what was bought came out as sellable stock, by
 * supplier, origin, raw type, container or month, with the category and grade mix.
 */
@Injectable()
export class SortingRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  async lot(tenantId: string, ragId: string, canSeeCost: boolean) {
    const r = await this.prisma.rag.findFirst({
      where: { id: ragId, tenantId },
      include: {
        container: { select: { id: true, containerNumber: true, vendor: { select: { id: true, name: true } } } },
        vendor: { select: { id: true, name: true } },
        rawCategory: { select: { name: true } },
        sortSession: { include: { worker: { select: { name: true } }, supervisor: { select: { name: true } } } },
        charges: { select: { kind: true, amount: true, note: true }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!r) throw new NotFoundException('Lot not found');
    const s = r.sortSession;
    // Phase 8: sorter pay put on this lot by paid pay sheets.
    const labour = (await this.prisma.labourCost.aggregate({ where: { tenantId, ragId }, _sum: { amount: true } }))._sum.amount ?? ZERO;
    const [outputs, waste, grades, allocations] = await Promise.all([
      this.prisma.categoryOutput.findMany({
        where: { tenantId, ragId },
        orderBy: { weightKg: 'desc' },
        select: {
          id: true, weightKg: true, usedKg: true, count: true, allocatedCost: true, category: { select: { name: true } }, grade: { select: { name: true, rank: true } },
          gradeSessions: { select: { id: true, status: true, startTime: true, endTime: true, worker: { select: { name: true } } } },
        },
      }),
      this.prisma.wasteLineItem.findMany({
        where: { tenantId, ragId },
        select: { stage: true, amount: true, unitType: true, estimatedValue: true, categoryOutputId: true, wasteCategory: { select: { name: true } } },
      }),
      this.prisma.gradeOutput.findMany({
        where: { tenantId, gradeBucket: { gradeSession: { categoryOutput: { ragId } } } },
        select: {
          weightKg: true, count: true, allocatedCost: true, grade: { select: { name: true, rank: true } },
          gradeBucket: { select: { gradeSession: { select: { categoryOutputId: true } } } },
        },
      }),
      // Bales made from this lot (v2 review): its kg in each bale and what the bale became.
      this.prisma.repackInputAllocation.findMany({
        where: { tenantId, ragBaleId: ragId },
        select: {
          amountUsed: true, allocatedCost: true,
          repackUnit: {
            select: {
              id: true, unitCode: true, weightKg: true,
              category: { select: { name: true } }, grade: { select: { name: true } },
              inventoryItems: { select: { id: true, quantity: true, usedQuantity: true } },
            },
          },
        },
      }),
    ]);
    const topRank = (await this.prisma.grade.findFirst({ where: { tenantId, isActive: true }, orderBy: { rank: 'asc' }, select: { rank: true } }))?.rank ?? null;
    // Graded kg: grades given while sorting ("Jeans · A") plus a separate grading afterwards. An entry that was
    // graded again afterwards counts once, by that grading.
    const allGraded = [
      ...outputs.filter((o) => o.grade && !o.gradeSessions.length).map((o) => ({ weightKg: o.weightKg, count: o.count, allocatedCost: o.allocatedCost, grade: o.grade! })),
      ...grades,
    ];
    const sortedKg = outputs.reduce((t, o) => t.add(o.weightKg), ZERO);
    // A lot bought by the piece counts in pieces: sorted %, yield and each row's share are of its pieces.
    const sortedPieces = outputs.reduce((t, o) => t + o.count, 0);
    const lotPieces = r.pieces ?? 0;
    const wasteKg = (stage: WasteStage) => waste.filter((w) => w.stage === stage && w.unitType === WasteUnitType.KG).reduce((t, w) => t.add(w.amount), ZERO);

    return {
      lot: {
        id: r.id, code: r.ragCode, status: r.status, kg: r.weightKg, createdAt: r.createdAt, source: r.sourceType, origin: r.originCountry,
        rawCategory: r.rawCategory?.name ?? null, container: r.container ? { id: r.container.id, number: r.container.containerNumber } : null,
        supplier: r.container?.vendor ?? r.vendor ?? null, cost: money(canSeeCost, r.allocatedCost),
        costPerKg: money(canSeeCost, r.weightKg.isZero() ? ZERO : r.allocatedCost.div(r.weightKg).toDecimalPlaces(2)),
        labour: money(canSeeCost, labour),
        pieces: r.pieces,
        costPerPiece: lotPieces ? money(canSeeCost, r.allocatedCost.div(lotPieces).toDecimalPlaces(2)) : null,
      },
      // What was paid for a loose lot (v2 cycle review): the price (kg × rate, or the total typed) and each extra charge.
      purchase: canSeeCost && r.purchaseCost !== null
        ? { price: r.purchaseCost, ratePerKg: r.ratePerKg, pieces: r.pieces, ratePerPiece: r.ratePerPiece, charges: r.charges.map((c) => ({ kind: c.kind, amount: c.amount, note: c.note })), total: r.allocatedCost }
        : null,
      session: s
        ? { id: s.id, status: s.status, worker: s.worker.name, supervisor: s.supervisor.name, startTime: s.startTime, endTime: s.endTime, inputKg: s.totalInputWeight, outputKg: s.totalOutputWeight, wasteKg: s.wasteWeight }
        : null,
      // One row per category (and grade when it was graded while sorting): several entries of Jeans · A are one row.
      categories: groupOutputs(outputs).map(({ list }) => {
        const first = list[0];
        const ids = new Set(list.map((o) => o.id));
        const kg = list.reduce((t, o) => t.add(o.weightKg), ZERO);
        const cost = list.reduce((t, o) => t.add(o.allocatedCost), ZERO);
        const mine = grades.filter((g) => ids.has(g.gradeBucket.gradeSession.categoryOutputId));
        const gs = list.flatMap((o) => o.gradeSessions).find((g) => g.status !== 'CLOSED') ?? list.flatMap((o) => o.gradeSessions)[0];
        return {
          id: first.id, name: first.grade ? `${first.category.name} · ${first.grade.name}` : first.category.name,
          kg, pieces: list.reduce((t, o) => t + o.count, 0), cost: money(canSeeCost, cost),
          costPerKg: money(canSeeCost, kg.isZero() ? ZERO : cost.div(kg).toDecimalPlaces(2)),
          sharePercent: lotPieces ? percent(new Prisma.Decimal(list.reduce((t, o) => t + o.count, 0)), new Prisma.Decimal(sortedPieces)) : percent(kg, sortedKg), usedKg: list.reduce((t, o) => t.add(o.usedKg), ZERO),
          grading: gs ? { id: gs.id, status: gs.status, startTime: gs.startTime, endTime: gs.endTime, worker: gs.worker.name } : null,
          // Grading afterwards works on one ungraded entry not in bales (v2): only then does the row open grading.
          gradeTarget: list.length === 1 && !first.grade && first.usedKg.isZero() && gs?.status !== 'CLOSED' ? first.id : null,
          gradedKg: mine.reduce((t, g) => t.add(g.weightKg), ZERO),
          // What a grading afterwards made of it, best grade first ("A 200 kg · B 80 kg"); and whether it was graded while sorting.
          gradedAs: [...mine.reduce((m, g) => m.set(g.grade.name, { name: g.grade.name, rank: g.grade.rank, kg: (m.get(g.grade.name)?.kg ?? ZERO).add(g.weightKg) }), new Map<string, { name: string; rank: number; kg: Prisma.Decimal }>()).values()]
            .sort((x, y) => x.rank - y.rank)
            .map(({ name, kg: k }) => ({ name, kg: k })),
          gradedWhileSorting: !!first.grade,
          wasteKg: waste.filter((w) => w.stage === WasteStage.STAGE_2 && w.categoryOutputId && ids.has(w.categoryOutputId) && w.unitType === WasteUnitType.KG).reduce((t, w) => t.add(w.amount), ZERO),
        };
      }),
      bales: baleRows(allocations, canSeeCost),
      grades: aggregateGrades(allGraded, canSeeCost),
      waste: waste.map((w) => ({ stage: w.stage, category: w.wasteCategory.name, amount: w.amount, unit: w.unitType, value: money(canSeeCost, w.estimatedValue) })),
      totals: {
        sortedKg, stage1WasteKg: wasteKg(WasteStage.STAGE_1), stage2WasteKg: wasteKg(WasteStage.STAGE_2),
        sortedPieces: lotPieces ? sortedPieces : null,
        piecesLeft: lotPieces ? Math.max(lotPieces - sortedPieces, 0) : null,
        yieldPercent: s?.status === SortStatus.CLOSED ? (lotPieces ? percent(new Prisma.Decimal(sortedPieces), new Prisma.Decimal(lotPieces)) : percent(sortedKg, r.weightKg)) : null,
        // While sorting: what is still to sort and how far it has got (v2 review).
        leftKg: !s ? r.weightKg : s.status === SortStatus.OPEN ? s.wasteWeight : ZERO,
        progressPercent: lotPieces
          ? Math.min(100, percent(new Prisma.Decimal(sortedPieces), new Prisma.Decimal(lotPieces)) ?? 0)
          : r.weightKg.isZero() ? null : Math.min(100, percent(sortedKg, r.weightKg) ?? 0),
        topGradePercent: topRank === null ? null : topGradePercent(allGraded.map((g) => ({ rank: g.grade.rank, kg: lotPieces ? new Prisma.Decimal(g.count ?? 0) : g.weightKg })), topRank),
        minutes: s?.endTime ? Math.round((s.endTime.getTime() - s.startTime.getTime()) / 60_000) : null,
      },
    };
  }

  /** Yield over finished sorting (stage 1 sealed in the period), grouped; with the category and grade mix. */
  async yieldAnalysis(tenantId: string, q: YieldQueryDto) {
    const by: YieldGroup = q.by ?? 'supplier';
    const from = q.from ? localDayStart(q.from) : null;
    const to = q.to ? new Date(localDayStart(q.to).getTime() + DAY) : null;
    if (from && to && from >= to) throw new BadRequestException('"from" must be before "to"');
    const sessions = await this.prisma.sortSession.findMany({
      where: { tenantId, status: SortStatus.CLOSED, endTime: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } },
      select: {
        id: true, totalInputWeight: true, totalOutputWeight: true, wasteWeight: true, endTime: true,
        rag: {
          select: {
            id: true, originCountry: true, rawCategory: { select: { name: true } }, vendor: { select: { name: true } },
            container: { select: { containerNumber: true, vendor: { select: { name: true } } } },
          },
        },
      },
    });
    const ragIds = sessions.map((s) => s.rag.id);
    const [outputs, grades, topGrade, wasteLines] = await Promise.all([
      this.prisma.categoryOutput.findMany({
        where: { tenantId, ragId: { in: ragIds } },
        select: { ragId: true, weightKg: true, count: true, category: { select: { name: true } }, grade: { select: { name: true, rank: true } }, _count: { select: { gradeSessions: true } } },
      }),
      this.prisma.gradeOutput.findMany({
        where: { tenantId, gradeBucket: { gradeSession: { categoryOutput: { ragId: { in: ragIds } } } } },
        select: { weightKg: true, count: true, grade: { select: { name: true, rank: true } }, gradeBucket: { select: { gradeSession: { select: { categoryOutput: { select: { ragId: true } } } } } } },
      }),
      this.prisma.grade.findFirst({ where: { tenantId, isActive: true }, orderBy: { rank: 'asc' }, select: { rank: true } }),
      this.prisma.wasteLineItem.findMany({ where: { tenantId, ragId: { in: ragIds }, unitType: WasteUnitType.KG }, select: { stage: true, amount: true, estimatedValue: true, wasteCategory: { select: { name: true } } } }),
    ]);
    const keyOf = (s: (typeof sessions)[number]): string => {
      switch (by) {
        case 'origin': return s.rag.originCountry ?? '';
        case 'rawCategory': return s.rag.rawCategory?.name ?? '';
        case 'container': return s.rag.container?.containerNumber ?? '';
        case 'month': return new Date(s.endTime!.getTime() + 5 * 3_600_000).toISOString().slice(0, 7);
        default: return s.rag.container?.vendor?.name ?? s.rag.vendor?.name ?? '';
      }
    };
    const groups = new Map<string, { key: string; lots: number; inputKg: Prisma.Decimal; outputKg: Prisma.Decimal; wasteKg: Prisma.Decimal; ragIds: Set<string> }>();
    for (const s of sessions) {
      const k = keyOf(s);
      const g = groups.get(k) ?? { key: k, lots: 0, inputKg: ZERO, outputKg: ZERO, wasteKg: ZERO, ragIds: new Set<string>() };
      g.lots += 1;
      g.inputKg = g.inputKg.add(s.totalInputWeight);
      g.outputKg = g.outputKg.add(s.totalOutputWeight);
      g.wasteKg = g.wasteKg.add(s.wasteWeight);
      g.ragIds.add(s.rag.id);
      groups.set(k, g);
    }
    // Graded kg per lot: grades given while sorting plus a separate grading afterwards (counted once).
    const graded = [
      ...outputs.filter((o) => o.grade && !o._count.gradeSessions).map((o) => ({ ragId: o.ragId, weightKg: o.weightKg, count: o.count, grade: o.grade! })),
      ...grades.map((g) => ({ ragId: g.gradeBucket.gradeSession.categoryOutput.ragId, weightKg: g.weightKg, count: g.count, grade: g.grade })),
    ];
    const top = topGrade?.rank ?? null;
    const rows = [...groups.values()]
      .map((g) => ({
        key: g.key, lots: g.lots, inputKg: g.inputKg, outputKg: g.outputKg, wasteKg: g.wasteKg,
        yieldPercent: percent(g.outputKg, g.inputKg),
        topGradePercent: top === null ? null : topGradePercent(graded.filter((x) => g.ragIds.has(x.ragId)).map((x) => ({ rank: x.grade.rank, kg: x.weightKg })), top),
      }))
      .sort((a, b) => (by === 'month' ? a.key.localeCompare(b.key) : (b.yieldPercent ?? -1) - (a.yieldPercent ?? -1) || b.inputKg.comparedTo(a.inputKg)));

    const inputKg = sessions.reduce((t, s) => t.add(s.totalInputWeight), ZERO);
    const outputKg = sessions.reduce((t, s) => t.add(s.totalOutputWeight), ZERO);
    const byCategory = new Map<string, Prisma.Decimal>();
    for (const o of outputs) byCategory.set(o.category.name, (byCategory.get(o.category.name) ?? ZERO).add(o.weightKg));
    return {
      by,
      from: q.from ?? null,
      to: q.to ?? null,
      totals: {
        lots: sessions.length, inputKg, outputKg, wasteKg: inputKg.sub(outputKg), yieldPercent: percent(outputKg, inputKg),
        topGradePercent: top === null ? null : topGradePercent(graded.map((x) => ({ rank: x.grade.rank, kg: x.weightKg })), top),
      },
      rows,
      categories: [...byCategory.entries()].map(([name, kg]) => ({ name, kg, sharePercent: percent(kg, outputKg) })).sort((a, b) => b.kg.comparedTo(a.kg)),
      grades: aggregateGrades(graded, false).map(({ cost: _c, ...g }) => g),
      waste: [...wasteLines.reduce((m, w) => {
        const k = `${w.stage}|${w.wasteCategory.name}`;
        const cur = m.get(k) ?? { stage: w.stage, category: w.wasteCategory.name, kg: ZERO };
        cur.kg = cur.kg.add(w.amount);
        return m.set(k, cur);
      }, new Map<string, { stage: WasteStage; category: string; kg: Prisma.Decimal }>()).values()].sort((a, b) => b.kg.comparedTo(a.kg)),
      // Sorted % by month (when the sorting finished), oldest first.
      trend: [...sessions.reduce((m, s) => {
        const k = new Date(s.endTime!.getTime() + 5 * 3_600_000).toISOString().slice(0, 7);
        const cur = m.get(k) ?? { month: k, inputKg: ZERO, outputKg: ZERO };
        cur.inputKg = cur.inputKg.add(s.totalInputWeight);
        cur.outputKg = cur.outputKg.add(s.totalOutputWeight);
        return m.set(k, cur);
      }, new Map<string, { month: string; inputKg: Prisma.Decimal; outputKg: Prisma.Decimal }>()).values()]
        .sort((a, b) => a.month.localeCompare(b.month))
        .map((t) => ({ ...t, yieldPercent: percent(t.outputKg, t.inputKg) })),
    };
  }
}

function aggregateGrades(list: { weightKg: Prisma.Decimal; count: number; allocatedCost?: Prisma.Decimal; grade: { name: string; rank: number } }[], canSeeCost: boolean) {
  const m = new Map<string, { name: string; rank: number; kg: Prisma.Decimal; pieces: number; cost: Prisma.Decimal }>();
  for (const g of list) {
    const cur = m.get(g.grade.name) ?? { name: g.grade.name, rank: g.grade.rank, kg: ZERO, pieces: 0, cost: ZERO };
    cur.kg = cur.kg.add(g.weightKg);
    cur.pieces += g.count ?? 0;
    cur.cost = cur.cost.add(g.allocatedCost ?? ZERO);
    m.set(g.grade.name, cur);
  }
  const total = [...m.values()].reduce((t, g) => t.add(g.kg), ZERO);
  return [...m.values()].sort((a, b) => a.rank - b.rank).map((g) => ({ name: g.name, kg: g.kg, pieces: g.pieces, sharePercent: percent(g.kg, total), cost: money(canSeeCost, g.cost) }));
}

type Output = { id: string; weightKg: Prisma.Decimal; usedKg: Prisma.Decimal; count: number; allocatedCost: Prisma.Decimal; category: { name: string }; grade: { name: string } | null; gradeSessions: Array<{ id: string; status: string; startTime: Date; endTime: Date | null; worker: { name: string } }> };

/** Entries of the same category and grade, largest first. */
function groupOutputs(outputs: Output[]): Array<{ key: string; list: Output[] }> {
  const by = new Map<string, Output[]>();
  for (const o of outputs) {
    const k = `${o.category.name}|${o.grade?.name ?? ''}`;
    by.set(k, [...(by.get(k) ?? []), o]);
  }
  return [...by.values()]
    .map((list) => ({ key: list[0].id, list }))
    .sort((a, b) => b.list.reduce((t, o) => t.add(o.weightKg), ZERO).comparedTo(a.list.reduce((t, o) => t.add(o.weightKg), ZERO)));
}

type Allocation = {
  amountUsed: Prisma.Decimal; allocatedCost: Prisma.Decimal;
  repackUnit: { id: string; unitCode: string; weightKg: Prisma.Decimal; category: { name: string } | null; grade: { name: string } | null; inventoryItems: Array<{ id: string; quantity: Prisma.Decimal; usedQuantity: Prisma.Decimal }> };
};

/** Bales made from a lot: code, what it is, kg from this lot, sold or in stock, and its cost from this lot. */
function baleRows(allocations: Allocation[], canSeeCost: boolean) {
  const by = new Map<string, { id: string; itemId: string | null; code: string; category: string | null; grade: string | null; kg: Prisma.Decimal; sold: boolean; cost: Prisma.Decimal }>();
  for (const a of allocations) {
    const u = a.repackUnit;
    const item = u.inventoryItems[0];
    const cur = by.get(u.id) ?? {
      id: u.id, itemId: item?.id ?? null, code: u.unitCode, category: u.category?.name ?? null, grade: u.grade?.name ?? null,
      kg: ZERO, sold: !!item && new Prisma.Decimal(item.usedQuantity).greaterThanOrEqualTo(item.quantity), cost: ZERO,
    };
    cur.kg = cur.kg.add(a.amountUsed);
    cur.cost = cur.cost.add(a.allocatedCost);
    by.set(u.id, cur);
  }
  return [...by.values()].sort((a, b) => a.code.localeCompare(b.code)).map((b) => ({ ...b, cost: money(canSeeCost, b.cost) }));
}

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ExpenseCategory, PaySheetStatus, PaymentMethod, Prisma, WorkerPayType } from '@prisma/client';
import { BUSINESS_UTC_OFFSET_MINUTES, localDayStart } from '../common/list/list-engine';
import { toE164 } from '../common/phone/phone';
import { PrismaService } from '../prisma/prisma.service';
import { grossPay, netPay, periodDays, shareBy } from './payroll';
import { topGrade as topGradeOf } from '../sorting/top-grade';

type Tx = Prisma.TransactionClient;
const ZERO = new Prisma.Decimal(0);
const DAY = 86_400_000;
/** The business day (Pakistan) of a moment, YYYY-MM-DD. */
const businessDay = (d: Date) => new Date(d.getTime() + BUSINESS_UTC_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
const dayDate = (ymd: string) => new Date(`${ymd}T00:00:00Z`);
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const CASH_CLOSED = 'The cash for that day is already closed. Reopen the day first, or pick another day.';

export interface WorkerInput { name: string; phone?: string | null; payType: WorkerPayType; rate: number; isActive?: boolean }

/**
 * Phase 8 sorter pay: workers without a login (per kg, piece, day or month), sorting entries that name their worker,
 * pay sheets for a week or a month with advances and deductions, paid in cash as one Labour expense (so Cash close
 * and Profit and loss include wages), the paid cost on the lots each worker sorted (container and lot profit), and
 * kg per worker per day with their top-grade share.
 */
@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Workers ───────────────────────────────────────────────────────────────────────────────────────

  workers(tenantId: string, all = false) {
    return this.prisma.worker.findMany({
      where: { tenantId, ...(all ? {} : { isActive: true }) },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, phone: true, payType: true, rate: true, isActive: true, createdAt: true },
    });
  }

  /** What the sorting screen needs: active workers by name. */
  async forSorting(tenantId: string) {
    const t = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { enabledModules: true } });
    if (!t?.enabledModules.includes('PAYROLL')) return [];
    return this.prisma.worker.findMany({ where: { tenantId, isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } });
  }

  private clean(dto: Partial<WorkerInput>) {
    const phone = dto.phone === undefined ? undefined : dto.phone?.trim() ? toE164(dto.phone) : null;
    if (dto.phone?.trim() && !phone) throw new BadRequestException({ code: 'PHONE_INVALID', message: 'Enter a valid phone number, e.g. 0300 1234567' });
    if (dto.name !== undefined && !dto.name.trim()) throw new BadRequestException('Enter the name');
    if (dto.rate !== undefined && !(dto.rate >= 0)) throw new BadRequestException('Enter the rate');
    return {
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      ...(phone !== undefined && { phone }),
      ...(dto.payType !== undefined && { payType: dto.payType }),
      ...(dto.rate !== undefined && { rate: new Prisma.Decimal(dto.rate) }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    };
  }

  async addWorker(tenantId: string, dto: WorkerInput, userId: string) {
    const data = this.clean(dto);
    const w = await this.prisma.worker.create({ data: { tenantId, name: data.name!, phone: data.phone ?? null, payType: dto.payType, rate: data.rate!, createdBy: userId } });
    await this.audit(tenantId, userId, 'WORKER_ADDED', 'Worker', w.id, { name: w.name, payType: w.payType, rate: w.rate.toString() });
    return w;
  }

  async updateWorker(tenantId: string, id: string, dto: Partial<WorkerInput>, userId: string) {
    const w = await this.prisma.worker.findFirst({ where: { id, tenantId } });
    if (!w) throw new NotFoundException('Worker not found');
    const updated = await this.prisma.worker.update({ where: { id }, data: this.clean(dto) });
    await this.audit(tenantId, userId, 'WORKER_CHANGED', 'Worker', id, { before: { name: w.name, payType: w.payType, rate: w.rate.toString(), isActive: w.isActive }, after: { name: updated.name, payType: updated.payType, rate: updated.rate.toString(), isActive: updated.isActive } });
    return updated;
  }

  /** One worker: details, advances not yet taken off a pay sheet, and their pay sheet lines. */
  async worker(tenantId: string, id: string) {
    const w = await this.prisma.worker.findFirst({
      where: { id, tenantId },
      include: {
        advances: { orderBy: { day: 'desc' }, take: 50, select: { id: true, day: true, amount: true, note: true, paySheetLineId: true } },
        lines: { orderBy: { sheet: { periodStart: 'desc' } }, take: 24, select: { id: true, gross: true, net: true, kg: true, pieces: true, days: true, sheet: { select: { id: true, periodStart: true, periodEnd: true, status: true } } } },
      },
    });
    if (!w) throw new NotFoundException('Worker not found');
    const open = w.advances.filter((a) => !a.paySheetLineId).reduce((t, a) => t.add(a.amount), ZERO);
    return { ...w, advances: w.advances.map((a) => ({ ...a, day: ymd(a.day) })), openAdvances: open };
  }

  // ── Advances ──────────────────────────────────────────────────────────────────────────────────────

  /** Money given before pay day: a cash Labour expense now, taken off the worker's next pay sheet. */
  async giveAdvance(tenantId: string, workerId: string, dto: { amount: number; day?: string; note?: string }, userId: string, now = new Date()) {
    const w = await this.prisma.worker.findFirst({ where: { id: workerId, tenantId, isActive: true } });
    if (!w) throw new NotFoundException('Worker not found');
    if (!(dto.amount > 0)) throw new BadRequestException('Enter the amount');
    const day = dto.day ? dto.day.slice(0, 10) : businessDay(now);
    if (day > businessDay(now)) throw new BadRequestException('That day has not come yet.');
    return this.prisma.$transaction(async (tx) => {
      await this.assertCashOpen(tx, tenantId, day);
      const expense = await tx.expense.create({
        data: { tenantId, day: dayDate(day), category: ExpenseCategory.LABOUR, amount: new Prisma.Decimal(dto.amount), method: PaymentMethod.CASH, paidTo: w.name, note: dto.note?.trim() ? `Advance · ${dto.note.trim()}` : 'Advance', createdBy: userId },
      });
      const a = await tx.workerAdvance.create({ data: { tenantId, workerId, day: dayDate(day), amount: new Prisma.Decimal(dto.amount), note: dto.note?.trim() || null, expenseId: expense.id, createdBy: userId } });
      await tx.auditLog.create({ data: { tenantId, userId, action: 'WORKER_ADVANCE_GIVEN', entityType: 'Worker', entityId: workerId, metadataJson: { amount: a.amount.toString(), day, expenseId: expense.id } } });
      return { ...a, day };
    });
  }

  private async assertCashOpen(tx: Tx, tenantId: string, day: string) {
    if (await tx.cashClose.findFirst({ where: { tenantId, day: dayDate(day) }, select: { id: true } })) throw new ConflictException(CASH_CLOSED);
  }

  // ── Pay sheets ────────────────────────────────────────────────────────────────────────────────────

  sheets(tenantId: string) {
    return this.prisma.paySheet
      .findMany({ where: { tenantId }, orderBy: { periodStart: 'desc' }, take: 60, select: { id: true, periodStart: true, periodEnd: true, status: true, total: true, paidAt: true, _count: { select: { lines: true } } } })
      .then((rows) => rows.map((r) => ({ ...r, periodStart: ymd(r.periodStart), periodEnd: ymd(r.periodEnd), workers: r._count.lines })));
  }

  /** What each worker sorted in a period: kg, pieces, days with entries, and per lot (for labour cost). */
  private async work(db: Tx | PrismaService, tenantId: string, start: string, end: string) {
    const from = localDayStart(start);
    const to = new Date(localDayStart(end).getTime() + DAY);
    const rows = await db.categoryOutput.findMany({
      where: { tenantId, workerId: { not: null }, createdAt: { gte: from, lt: to } },
      select: { workerId: true, weightKg: true, count: true, createdAt: true, ragId: true, containerId: true },
    });
    const by = new Map<string, { kg: Prisma.Decimal; pieces: number; days: Set<string>; lots: Map<string, { containerId: string | null; kg: Prisma.Decimal; pieces: number }> }>();
    for (const r of rows) {
      const w = by.get(r.workerId!) ?? { kg: ZERO, pieces: 0, days: new Set<string>(), lots: new Map() };
      w.kg = w.kg.add(r.weightKg);
      w.pieces += r.count;
      w.days.add(businessDay(r.createdAt));
      const lot = w.lots.get(r.ragId) ?? { containerId: r.containerId, kg: ZERO, pieces: 0 };
      lot.kg = lot.kg.add(r.weightKg);
      lot.pieces += r.count;
      w.lots.set(r.ragId, lot);
      by.set(r.workerId!, w);
    }
    return by;
  }

  /**
   * A new pay sheet for a period: a line for each active worker who worked, has a day or month rate, or has
   * advances to take off. Periods of two sheets may not overlap (nobody is paid twice).
   */
  async createSheet(tenantId: string, dto: { periodStart: string; periodEnd: string }, userId: string, now = new Date()) {
    const start = dto.periodStart.slice(0, 10), end = dto.periodEnd.slice(0, 10);
    if (end < start) throw new BadRequestException('The period ends before it starts');
    if (periodDays(start, end) > 31) throw new BadRequestException('A pay sheet is for a week or a month (31 days at most)');
    if (start > businessDay(now)) throw new BadRequestException('That period has not started yet');
    const overlap = await this.prisma.paySheet.findFirst({ where: { tenantId, periodStart: { lte: dayDate(end) }, periodEnd: { gte: dayDate(start) } }, select: { periodStart: true, periodEnd: true } });
    if (overlap) throw new ConflictException(`There is already a pay sheet for ${ymd(overlap.periodStart)} – ${ymd(overlap.periodEnd)}`);

    return this.prisma.$transaction(async (tx) => {
      const [workers, work, advances] = await Promise.all([
        tx.worker.findMany({ where: { tenantId, isActive: true }, orderBy: { name: 'asc' } }),
        this.work(tx, tenantId, start, end),
        tx.workerAdvance.findMany({ where: { tenantId, paySheetLineId: null, day: { lte: dayDate(end) } }, select: { id: true, workerId: true, amount: true } }),
      ]);
      const sheet = await tx.paySheet.create({ data: { tenantId, periodStart: dayDate(start), periodEnd: dayDate(end), createdBy: userId } });
      let total = ZERO;
      for (const w of workers) {
        const did = work.get(w.id);
        const mine = advances.filter((a) => a.workerId === w.id);
        const adv = mine.reduce((t, a) => t.add(a.amount), ZERO);
        if (!did && !mine.length && w.payType !== WorkerPayType.MONTH && w.payType !== WorkerPayType.DAY) continue;
        const facts = { kg: did?.kg ?? ZERO, pieces: did?.pieces ?? 0, days: did?.days.size ?? 0 };
        const gross = grossPay(w.payType, w.rate, facts, start, end);
        const net = netPay(gross, adv, ZERO);
        const line = await tx.paySheetLine.create({
          data: { tenantId, paySheetId: sheet.id, workerId: w.id, payType: w.payType, rate: w.rate, kg: facts.kg, pieces: facts.pieces, days: facts.days, gross, advances: adv, net },
        });
        if (mine.length) await tx.workerAdvance.updateMany({ where: { id: { in: mine.map((a) => a.id) }, paySheetLineId: null }, data: { paySheetLineId: line.id } });
        total = total.add(net);
      }
      await tx.paySheet.update({ where: { id: sheet.id }, data: { total } });
      await tx.auditLog.create({ data: { tenantId, userId, action: 'PAY_SHEET_MADE', entityType: 'PaySheet', entityId: sheet.id, metadataJson: { start, end, total: total.toString() } } });
      return sheet.id;
    }).then((id) => this.sheet(tenantId, id));
  }

  async sheet(tenantId: string, id: string) {
    const s = await this.prisma.paySheet.findFirst({
      where: { id, tenantId },
      include: { lines: { orderBy: { worker: { name: 'asc' } }, include: { worker: { select: { id: true, name: true, phone: true } } } } },
    });
    if (!s) throw new NotFoundException('Pay sheet not found');
    return { ...s, periodStart: ymd(s.periodStart), periodEnd: ymd(s.periodEnd) };
  }

  /** While not paid: days (for day-rate workers), deductions and a note; gross and net follow. */
  async updateLine(tenantId: string, lineId: string, dto: { days?: number; deductions?: number; note?: string }, userId: string) {
    const line = await this.prisma.paySheetLine.findFirst({ where: { id: lineId, tenantId }, include: { sheet: true } });
    if (!line) throw new NotFoundException('Line not found');
    if (line.sheet.status !== PaySheetStatus.DRAFT) throw new ConflictException('This pay sheet is paid; it cannot change');
    if (dto.days !== undefined && (dto.days < 0 || dto.days > periodDays(ymd(line.sheet.periodStart), ymd(line.sheet.periodEnd)))) throw new BadRequestException('More days than the period has');
    if (dto.deductions !== undefined && dto.deductions < 0) throw new BadRequestException('A deduction cannot be below zero');
    const days = dto.days ?? line.days;
    const deductions = dto.deductions !== undefined ? new Prisma.Decimal(dto.deductions) : line.deductions;
    const gross = line.payType === WorkerPayType.DAY ? line.rate.mul(days).toDecimalPlaces(2) : line.gross;
    const net = netPay(gross, line.advances, deductions);
    await this.prisma.$transaction(async (tx) => {
      await tx.paySheetLine.update({ where: { id: lineId }, data: { days, deductions, gross, net, ...(dto.note !== undefined && { note: dto.note.trim() || null }) } });
      const sum = await tx.paySheetLine.aggregate({ where: { paySheetId: line.paySheetId }, _sum: { net: true } });
      await tx.paySheet.update({ where: { id: line.paySheetId }, data: { total: sum._sum.net ?? ZERO } });
      await tx.auditLog.create({ data: { tenantId, userId, action: 'PAY_SHEET_LINE_CHANGED', entityType: 'PaySheet', entityId: line.paySheetId, metadataJson: { lineId, days, deductions: deductions.toString(), net: net.toString() } } });
    });
    return this.sheet(tenantId, line.paySheetId);
  }

  /** A pay sheet not paid yet can be thrown away (its advances go back to waiting). */
  async deleteSheet(tenantId: string, id: string, userId: string) {
    const s = await this.prisma.paySheet.findFirst({ where: { id, tenantId } });
    if (!s) throw new NotFoundException('Pay sheet not found');
    if (s.status !== PaySheetStatus.DRAFT) throw new ConflictException('A paid pay sheet stays for the record');
    await this.prisma.$transaction([
      this.prisma.workerAdvance.updateMany({ where: { tenantId, line: { paySheetId: id } }, data: { paySheetLineId: null } }),
      this.prisma.paySheet.delete({ where: { id } }),
      this.prisma.auditLog.create({ data: { tenantId, userId, action: 'PAY_SHEET_DELETED', entityType: 'PaySheet', entityId: id, metadataJson: { start: ymd(s.periodStart), end: ymd(s.periodEnd) } } }),
    ]);
    return { ok: true };
  }

  /**
   * Paid in cash today: one Labour expense for what was handed over (the nets), and each line's cost (gross less
   * deductions) on the lots the worker sorted in the period — by kg (or pieces for piece pay); a day or month
   * salary over the lots by kg too. A salary with no sorting stays a general expense.
   */
  async paySheet(tenantId: string, id: string, userId: string, now = new Date()) {
    const today = businessDay(now);
    const result = await this.prisma.$transaction(async (tx) => {
      const s = await tx.paySheet.findFirst({ where: { id, tenantId }, include: { lines: { include: { worker: { select: { name: true } } } } } });
      if (!s) throw new NotFoundException('Pay sheet not found');
      if (s.status !== PaySheetStatus.DRAFT) throw new ConflictException('This pay sheet is already paid');
      await this.assertCashOpen(tx, tenantId, today);
      // Claim it first: of two requests at the same moment (a double tap on a slow line) only one changes the
      // row; the other waits on it, changes nothing and stops here, so there is never a second expense.
      const claimed = await tx.paySheet.updateMany({ where: { id, tenantId, status: PaySheetStatus.DRAFT }, data: { status: PaySheetStatus.PAID, paidAt: now, paidBy: userId } });
      if (claimed.count !== 1) throw new ConflictException('This pay sheet is already paid');
      const start = ymd(s.periodStart), end = ymd(s.periodEnd);
      const total = s.lines.reduce((t, l) => t.add(l.net), ZERO);
      const expense = total.isZero()
        ? null
        : await tx.expense.create({ data: { tenantId, day: dayDate(today), category: ExpenseCategory.LABOUR, amount: total, method: PaymentMethod.CASH, paidTo: `${s.lines.length} workers`, note: `Pay sheet ${start} – ${end}`, createdBy: userId } });
      const work = await this.work(tx, tenantId, start, end);
      for (const line of s.lines) {
        const cost = line.gross.sub(line.deductions);
        const did = work.get(line.workerId);
        if (!did || !cost.greaterThan(0)) continue;
        const byPieces = line.payType === WorkerPayType.PIECE || [...did.lots.values()].every((l) => l.kg.isZero());
        const parts = [...did.lots.entries()].map(([ragId, l]) => ({ key: { ragId, containerId: l.containerId }, weight: byPieces ? new Prisma.Decimal(l.pieces) : l.kg }));
        for (const p of shareBy(cost, parts)) {
          await tx.labourCost.create({ data: { tenantId, paySheetLineId: line.id, ragId: p.key.ragId, containerId: p.key.containerId, amount: p.amount } });
        }
      }
      await tx.paySheet.update({ where: { id }, data: { total, expenseId: expense?.id ?? null } });
      await tx.auditLog.create({ data: { tenantId, userId, action: 'PAY_SHEET_PAID', entityType: 'PaySheet', entityId: id, metadataJson: { total: total.toString(), expenseId: expense?.id ?? null, day: today } } });
      return id;
    });
    return this.sheet(tenantId, result);
  }

  // ── Productivity (owner) ──────────────────────────────────────────────────────────────────────────

  /** Kg (and pieces) per worker per day worked, and the share of their graded kg in the best grade. */
  async productivity(tenantId: string, from: string, to: string) {
    const start = from.slice(0, 10), end = to.slice(0, 10);
    if (end < start) throw new BadRequestException('The period ends before it starts');
    const [workers, rows, top] = await Promise.all([
      this.prisma.worker.findMany({ where: { tenantId }, select: { id: true, name: true, isActive: true, payType: true } }),
      this.prisma.categoryOutput.findMany({
        where: { tenantId, workerId: { not: null }, createdAt: { gte: localDayStart(start), lt: new Date(localDayStart(end).getTime() + DAY) } },
        select: { workerId: true, weightKg: true, count: true, createdAt: true, grade: { select: { rank: true } } },
      }),
      topGradeOf(this.prisma, tenantId),
    ]);
    const stats = new Map<string, { kg: Prisma.Decimal; pieces: number; days: Set<string>; graded: Prisma.Decimal; best: Prisma.Decimal }>();
    for (const r of rows) {
      const s = stats.get(r.workerId!) ?? { kg: ZERO, pieces: 0, days: new Set<string>(), graded: ZERO, best: ZERO };
      s.kg = s.kg.add(r.weightKg);
      s.pieces += r.count;
      s.days.add(businessDay(r.createdAt));
      if (r.grade) {
        s.graded = s.graded.add(r.weightKg);
        if (top && r.grade.rank === top.rank) s.best = s.best.add(r.weightKg);
      }
      stats.set(r.workerId!, s);
    }
    const out = workers
      .map((w) => {
        const s = stats.get(w.id);
        const days = s?.days.size ?? 0;
        return {
          id: w.id, name: w.name, isActive: w.isActive, payType: w.payType,
          kg: s?.kg ?? ZERO, pieces: s?.pieces ?? 0, days,
          kgPerDay: s && days ? s.kg.div(days).toDecimalPlaces(1) : ZERO,
          piecesPerDay: s && days ? Math.round(s.pieces / days) : 0,
          topGradePercent: s && s.graded.greaterThan(0) ? Math.round(s.best.div(s.graded).mul(100).toNumber()) : null,
        };
      })
      .filter((w) => w.days > 0 || w.isActive)
      .sort((a, b) => b.kg.comparedTo(a.kg) || b.pieces - a.pieces || a.name.localeCompare(b.name));
    return { from: start, to: end, topGrade: top?.name ?? null, workers: out };
  }

  private audit(tenantId: string, userId: string, action: string, entityType: string, entityId: string, metadataJson: Record<string, unknown>) {
    return this.prisma.auditLog.create({ data: { tenantId, userId, action, entityType, entityId, metadataJson: metadataJson as Prisma.InputJsonValue } });
  }
}

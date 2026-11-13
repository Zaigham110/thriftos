import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CashMoveDirection, CashMoveKind, ExpenseCategory, PaymentMethod, Prisma, StockAdjustmentStatus, StockSource } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { localDayStart } from '../common/list/list-engine';
import { PrismaService } from '../prisma/prisma.service';
import { KHATA_SALE_STATUSES } from '../sales/khata.service';
import { businessDay } from './receivables.service';
import { EXPENSE_SECTIONS, EXPENSE_SECTION_KEYS, ExpenseSection } from './finance';

const ZERO = new Prisma.Decimal(0);
const DAY = 86_400_000;

export class ExpenseDto {
  /** YYYY-MM-DD business day; today when absent. */
  @IsOptional() @IsDateString() day?: string;
  @IsEnum(ExpenseCategory) category!: ExpenseCategory;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) amount!: number;
  @IsOptional() @IsEnum(PaymentMethod) method?: PaymentMethod;
  @IsOptional() @IsString() @MaxLength(120) paidTo?: string;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

/** Changing an expense (v2 review): any of its fields; a cancelled expense cannot be changed. */
export class ExpenseUpdateDto {
  @IsOptional() @IsDateString() day?: string;
  @IsOptional() @IsEnum(ExpenseCategory) category?: ExpenseCategory;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) amount?: number;
  @IsOptional() @IsEnum(PaymentMethod) method?: PaymentMethod;
  @IsOptional() @IsString() @MaxLength(120) paidTo?: string;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

/** Cancelling asks why (v2 review). */
export class CancelExpenseDto {
  @IsString() @MinLength(2) @MaxLength(200) reason!: string;
}

/**
 * Errors the app shows in the person's own language: the code picks the words, the message is the English
 * fallback (v2 review).
 */
const CASH_CLOSED = { code: 'CASH_CLOSED', message: "That day's cash is already closed. Pick another day, or a method other than cash." };
const FUTURE_DAY = { code: 'FUTURE_DAY', message: 'An expense cannot be in the future' };
const ALREADY_CANCELLED = { code: 'ALREADY_CANCELLED', message: 'This expense is cancelled' };
// Cash close (v2 review).
const CLOSED_ALREADY = { code: 'CLOSED_ALREADY', message: 'This day is already closed' };
const NOT_STARTED = { code: 'NOT_STARTED', message: 'A day cannot be closed before it starts' };
const LATER_CLOSED = { code: 'LATER_CLOSED', message: 'A later day is already closed. Close days in order, or reopen the later one first.' };
const REASON_NEEDED = { code: 'REASON_NEEDED', message: 'The drawer is short or over: say why in the note' };
const NOT_CLOSED = { code: 'NOT_CLOSED', message: 'This day is not closed' };
const NOT_LATEST = { code: 'NOT_LATEST', message: 'Only the latest closed day can be reopened' };
const NOT_ENOUGH_CASH = { code: 'NOT_ENOUGH_CASH', message: 'That is more than should be in the drawer' };
const MOVE_CANCELLED = { code: 'ALREADY_CANCELLED', message: 'This is already cancelled' };

export class BookQueryDto {
  @IsOptional() @IsEnum(PaymentMethod) method?: PaymentMethod;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

export class CloseQueryDto {
  @IsOptional() @IsDateString() day?: string;
}

export class CloseDto {
  @IsDateString() day!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) counted!: number;
  /** Required when the drawer is short or over (v2 review). */
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

/** Reopening the latest close asks why (v2 review). */
export class ReopenDto {
  @IsString() @MinLength(2) @MaxLength(200) reason!: string;
}

/** Cash taken out of the drawer or put in (v2 review): bank, owner or other. Not part of profit and loss. */
export class CashMoveDto {
  /** YYYY-MM-DD business day; today when absent. */
  @IsOptional() @IsDateString() day?: string;
  @IsEnum(CashMoveDirection) direction!: CashMoveDirection;
  @IsEnum(CashMoveKind) kind!: CashMoveKind;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) amount!: number;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}

export class PnlQueryDto {
  /** Months back from this month (1–24). */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(24) months?: number;
}

/** One book line. MOVE: cash out of / into the drawer (ref = OUT:BANK, IN:OWNER, …; party = the note). */
type BookLine = { at: Date; day: string; kind: 'RECEIPT' | 'EXPENSE' | 'MOVE' | 'CLOSE' | 'SUPPLIER'; id: string; ref: string | null; party: string | null; in: Prisma.Decimal; out: Prisma.Decimal; createdAt?: Date };

const ymd = (s: string) => s.slice(0, 10);
const dayDate = (s: string) => new Date(ymd(s) + 'T00:00:00Z');
const dayOf = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Finance in the workspace (enterprise plan E3.6), management accounts only: expenses, cash and bank books by
 * payment method (money in = payments received, money out = expenses, cash also carries close differences),
 * the daily cash close, and profit and loss by month (sales − cost of goods − stock written off − expenses).
 */
@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async addExpense(tenantId: string, dto: ExpenseDto, userId: string, now = new Date()) {
    const day = dto.day ? ymd(dto.day) : businessDay(now);
    if (day > businessDay(now)) throw new BadRequestException(FUTURE_DAY);
    if (await this.closed(tenantId, day, dto.method ?? PaymentMethod.CASH)) throw new ConflictException(CASH_CLOSED);
    return this.prisma.$transaction(async (tx) => {
      const e = await tx.expense.create({
        data: {
          tenantId, day: dayDate(day), category: dto.category, amount: new Prisma.Decimal(dto.amount), method: dto.method ?? PaymentMethod.CASH,
          paidTo: dto.paidTo?.trim() || null, note: dto.note?.trim() || null, createdBy: userId,
        },
      });
      await tx.auditLog.create({ data: { tenantId, userId, action: 'EXPENSE_RECORDED', entityType: 'Expense', entityId: e.id, metadataJson: { category: e.category, amount: e.amount.toString(), method: e.method, day } } });
      return { ...e, day };
    });
  }

  async expense(tenantId: string, id: string) {
    const e = await this.prisma.expense.findFirst({ where: { id, tenantId } });
    if (!e) throw new NotFoundException('Expense not found');
    const users = await this.prisma.user.findMany({ where: { tenantId, id: { in: [e.createdBy, e.cancelledBy].filter((x): x is string => !!x) } }, select: { id: true, name: true } });
    const name = new Map(users.map((u) => [u.id, u.name]));
    return { ...e, day: dayOf(e.day), createdByName: name.get(e.createdBy) ?? null, cancelledByName: e.cancelledBy ? name.get(e.cancelledBy) ?? null : null };
  }

  /**
   * Fix a mistake in an expense (v2 review): the amount, category, day, method, paid to or note. A cash expense
   * on a closed day cannot be moved, and none can be moved onto one. Logged with what it was and what it became.
   */
  async updateExpense(tenantId: string, id: string, dto: ExpenseUpdateDto, userId: string, now = new Date()) {
    const e = await this.prisma.expense.findFirst({ where: { id, tenantId } });
    if (!e) throw new NotFoundException('Expense not found');
    if (e.cancelledAt) throw new ConflictException(ALREADY_CANCELLED);
    const day = dto.day ? ymd(dto.day) : dayOf(e.day);
    if (day > businessDay(now)) throw new BadRequestException(FUTURE_DAY);
    const method = dto.method ?? e.method;
    if (await this.closed(tenantId, dayOf(e.day), e.method)) throw new ConflictException(CASH_CLOSED);
    if ((day !== dayOf(e.day) || method !== e.method) && (await this.closed(tenantId, day, method))) throw new ConflictException(CASH_CLOSED);
    const data = {
      day: dayDate(day),
      category: dto.category ?? e.category,
      amount: dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : e.amount,
      method,
      paidTo: dto.paidTo !== undefined ? dto.paidTo.trim() || null : e.paidTo,
      note: dto.note !== undefined ? dto.note.trim() || null : e.note,
    };
    const view = (x: { day: Date; category: string; amount: Prisma.Decimal; method: string; paidTo: string | null; note: string | null }) => ({
      day: dayOf(x.day), category: x.category, amount: x.amount.toString(), method: x.method, paidTo: x.paidTo, note: x.note,
    });
    const before = view(e);
    const after = view(data);
    const changed = Object.keys(after).filter((k) => after[k as keyof typeof after] !== before[k as keyof typeof before]);
    if (!changed.length) return this.expense(tenantId, id);
    await this.prisma.$transaction([
      this.prisma.expense.update({ where: { id }, data }),
      this.prisma.auditLog.create({
        data: { tenantId, userId, action: 'EXPENSE_CHANGED', entityType: 'Expense', entityId: id, metadataJson: { before: Object.fromEntries(changed.map((k) => [k, before[k as keyof typeof before]])), after: Object.fromEntries(changed.map((k) => [k, after[k as keyof typeof after]])) } },
      }),
    ]);
    return this.expense(tenantId, id);
  }

  async cancelExpense(tenantId: string, id: string, userId: string, reason: string) {
    const e = await this.prisma.expense.findFirst({ where: { id, tenantId } });
    if (!e) throw new NotFoundException('Expense not found');
    if (e.cancelledAt) throw new ConflictException(ALREADY_CANCELLED);
    if (await this.closed(tenantId, dayOf(e.day), e.method)) throw new ConflictException(CASH_CLOSED);
    const why = reason.trim();
    await this.prisma.$transaction([
      this.prisma.expense.update({ where: { id }, data: { cancelledAt: new Date(), cancelledBy: userId, cancelReason: why } }),
      this.prisma.auditLog.create({ data: { tenantId, userId, action: 'EXPENSE_CANCELLED', entityType: 'Expense', entityId: id, metadataJson: { amount: e.amount.toString(), reason: why } } }),
    ]);
    return { id, cancelled: true };
  }

  /** Cash expenses on a closed day would change a counted drawer, so they are refused. */
  private async closed(tenantId: string, day: string, method: PaymentMethod): Promise<boolean> {
    if (method !== PaymentMethod.CASH) return false;
    return !!(await this.prisma.cashClose.findFirst({ where: { tenantId, day: dayDate(day) }, select: { id: true } }));
  }

  private async lines(tenantId: string, method: PaymentMethod, until?: Date): Promise<BookLine[]> {
    const [payments, expenses, closes, moves, supplierPayments] = await Promise.all([
      this.prisma.payment.findMany({
        where: { tenantId, method, ...(until ? { receivedAt: { lt: until } } : {}) },
        select: { id: true, amount: true, receivedAt: true, createdAt: true, reference: true, customer: { select: { name: true } }, sale: { select: { saleNumber: true } } },
      }),
      this.prisma.expense.findMany({ where: { tenantId, method, cancelledAt: null } }),
      method === PaymentMethod.CASH ? this.prisma.cashClose.findMany({ where: { tenantId } }) : Promise.resolve([]),
      // Cash moves: all of them in the cash book; bank ones also in the bank book, the other way round.
      method === PaymentMethod.CASH || method === PaymentMethod.BANK
        ? this.prisma.cashMove.findMany({ where: { tenantId, cancelledAt: null, ...(method === PaymentMethod.BANK ? { kind: CashMoveKind.BANK } : {}) } })
        : Promise.resolve([]),
      // Supplier khata: money paid to suppliers leaves the book it was paid from.
      this.prisma.supplierPayment.findMany({ where: { tenantId, method, cancelledAt: null }, select: { id: true, day: true, amount: true, note: true, vendor: { select: { name: true } } } }),
    ]);
    // An expense day / close day sits at the end of that business day for ordering (after the day's receipts).
    const endOf = (d: Date) => new Date(localDayStart(dayOf(d)).getTime() + DAY - 1);
    const out: BookLine[] = [
      ...payments.map((p) => ({ at: p.receivedAt, day: businessDay(p.receivedAt), kind: 'RECEIPT' as const, id: p.id, ref: p.sale?.saleNumber ?? p.reference, party: p.customer.name, in: p.amount, out: ZERO, createdAt: p.createdAt })),
      ...moves.map((m) => {
        const intoDrawer = m.direction === CashMoveDirection.IN;
        const intoBook = method === PaymentMethod.CASH ? intoDrawer : !intoDrawer;
        return { at: new Date(endOf(m.day).getTime() - 1), day: dayOf(m.day), kind: 'MOVE' as const, id: m.id, ref: `${m.direction}:${m.kind}`, party: m.note, in: intoBook ? m.amount : ZERO, out: intoBook ? ZERO : m.amount };
      }),
      ...expenses.map((e) => ({ at: new Date(endOf(e.day).getTime() - 1), day: dayOf(e.day), kind: 'EXPENSE' as const, id: e.id, ref: e.category, party: e.paidTo, in: ZERO, out: e.amount })),
      ...supplierPayments.map((p) => ({ at: new Date(endOf(p.day).getTime() - 1), day: dayOf(p.day), kind: 'SUPPLIER' as const, id: p.id, ref: p.note, party: p.vendor.name, in: ZERO, out: p.amount })),
      ...closes.map((c) => ({ at: endOf(c.day), day: dayOf(c.day), kind: 'CLOSE' as const, id: c.id, ref: null, party: null, in: c.difference.isPositive() ? c.difference : ZERO, out: c.difference.isNegative() ? c.difference.neg() : ZERO })),
    ];
    return out.filter((l) => !until || l.at < until).sort((a, b) => a.at.getTime() - b.at.getTime() || a.kind.localeCompare(b.kind));
  }

  /** Cash or bank book for a period: opening, every receipt and payment out, running balance, closing. */
  async book(tenantId: string, q: BookQueryDto) {
    const method = q.method ?? PaymentMethod.CASH;
    const from = q.from ? localDayStart(q.from) : null;
    const to = q.to ? new Date(localDayStart(q.to).getTime() + DAY) : null;
    if (from && to && from >= to) throw new BadRequestException('"from" must be before "to"');
    const all = await this.lines(tenantId, method, to ?? undefined);
    let balance = ZERO;
    let opening = ZERO;
    const lines = [];
    for (const l of all) {
      balance = balance.add(l.in).sub(l.out);
      if (from && l.at < from) opening = balance;
      else lines.push({ ...l, balance });
    }
    const totalIn = lines.reduce((t, l) => t.add(l.in), ZERO);
    const totalOut = lines.reduce((t, l) => t.add(l.out), ZERO);
    return { method, from: q.from ?? null, to: q.to ?? null, opening, in: totalIn, out: totalOut, closing: opening.add(totalIn).sub(totalOut), lines };
  }

  /**
   * The day's cash: opening, received, paid out, cash moved out/in, what should be in the drawer, and the close if
   * it was done (v2 review: cash received today after the close is listed apart: it counts in tomorrow's drawer).
   * Also the last 14 days, closed or not (days with no cash and no close are left out).
   */
  async closeView(tenantId: string, q: CloseQueryDto, now = new Date()) {
    const today = businessDay(now);
    const day = q.day ? ymd(q.day) : today;
    const start = localDayStart(day);
    const end = new Date(start.getTime() + DAY);
    const [all, closes] = await Promise.all([this.lines(tenantId, PaymentMethod.CASH), this.prisma.cashClose.findMany({ where: { tenantId }, orderBy: { day: 'desc' } })]);
    const close = closes.find((c) => dayOf(c.day) === day) ?? null;
    let opening = ZERO;
    const dayLines: BookLine[] = [];
    const afterClose: BookLine[] = [];
    for (const l of all) {
      if (l.at < start) opening = opening.add(l.in).sub(l.out);
      else if (l.at < end && !(l.kind === 'CLOSE' && l.day === day)) {
        if (close && l.kind === 'RECEIPT' && l.createdAt && l.createdAt > close.createdAt) afterClose.push(l);
        else dayLines.push(l);
      }
    }
    const sum = (ls: BookLine[], k: 'in' | 'out') => ls.reduce((t, l) => t.add(l[k]), ZERO);
    const trade = dayLines.filter((l) => l.kind !== 'MOVE');
    const moved = dayLines.filter((l) => l.kind === 'MOVE');
    const cashIn = sum(trade, 'in');
    const cashOut = sum(trade, 'out');
    const movedIn = sum(moved, 'in');
    const movedOut = sum(moved, 'out');
    const expected = opening.add(cashIn).sub(cashOut).add(movedIn).sub(movedOut);
    const people = close ? await this.prisma.user.findFirst({ where: { id: close.closedBy, tenantId }, select: { name: true } }) : null;
    // The last 14 days up to today: closed ones with their figures, open ones that had cash.
    const byDay = new Map(closes.map((c) => [dayOf(c.day), c]));
    const busy = new Set(all.filter((l) => l.kind !== 'CLOSE').map((l) => l.day));
    const recent = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(localDayStart(today).getTime() - i * DAY + 12 * 3_600_000).toISOString().slice(0, 10);
      const c = byDay.get(d);
      if (c) recent.push({ id: c.id, day: d, closed: true, expected: c.expected, counted: c.counted, difference: c.difference });
      else if (busy.has(d)) recent.push({ id: d, day: d, closed: false, expected: null, counted: null, difference: null });
    }
    const latest = closes[0] ? dayOf(closes[0].day) : null;
    return {
      day, opening, in: cashIn, out: cashOut, movedIn, movedOut, expected,
      lines: dayLines,
      afterClose, afterCloseTotal: sum(afterClose, 'in'),
      close: close ? { ...close, day: dayOf(close.day), closedByName: people?.name ?? null } : null,
      /** Days before today that had cash and were never closed (for the Home reminder). */
      openDays: recent.filter((r) => !r.closed && r.day < today).length,
      laterClosed: !!latest && latest > day,
      canReopen: !!close && latest === day,
      recent,
    };
  }

  async closeDay(tenantId: string, dto: CloseDto, userId: string, now = new Date()) {
    const day = ymd(dto.day);
    if (day > businessDay(now)) throw new BadRequestException(NOT_STARTED);
    const view = await this.closeView(tenantId, { day }, now);
    if (view.close) throw new ConflictException(CLOSED_ALREADY);
    // Closing an earlier day after a later one would change the later day's opening after it was counted.
    if (view.laterClosed) throw new ConflictException(LATER_CLOSED);
    const counted = new Prisma.Decimal(dto.counted);
    const difference = counted.sub(view.expected);
    const note = dto.note?.trim() || null;
    if (!difference.isZero() && (!note || note.length < 2)) throw new BadRequestException(REASON_NEEDED);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const c = await tx.cashClose.create({ data: { tenantId, day: dayDate(day), expected: view.expected, counted, difference, note, closedBy: userId } });
        await tx.auditLog.create({ data: { tenantId, userId, action: 'CASH_CLOSED', entityType: 'CashClose', entityId: c.id, metadataJson: { day, expected: view.expected.toString(), counted: counted.toString(), difference: difference.toString() } } });
        return { ...c, day };
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException(CLOSED_ALREADY);
      throw e;
    }
  }

  /** Undo a wrong count (v2 review): only the latest closed day, with a reason; the history keeps what it was. */
  async reopenDay(tenantId: string, day: string, reason: string, userId: string) {
    const d = ymd(day);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(dayDate(d).getTime())) throw new NotFoundException(NOT_CLOSED);
    const close = await this.prisma.cashClose.findFirst({ where: { tenantId, day: dayDate(d) } });
    if (!close) throw new NotFoundException(NOT_CLOSED);
    const later = await this.prisma.cashClose.findFirst({ where: { tenantId, day: { gt: close.day } }, select: { id: true } });
    if (later) throw new ConflictException(NOT_LATEST);
    const why = reason.trim();
    await this.prisma.$transaction([
      this.prisma.cashClose.delete({ where: { id: close.id } }),
      this.prisma.auditLog.create({
        data: { tenantId, userId, action: 'CASH_REOPENED', entityType: 'CashClose', entityId: close.id, metadataJson: { day: d, expected: close.expected.toString(), counted: close.counted.toString(), difference: close.difference.toString(), note: close.note, reason: why } },
      }),
    ]);
    return { day: d, reopened: true };
  }

  /** Cash out of the drawer or into it (v2 review): to/from the bank, the owner, or other. */
  async addCashMove(tenantId: string, dto: CashMoveDto, userId: string, now = new Date()) {
    const day = dto.day ? ymd(dto.day) : businessDay(now);
    if (day > businessDay(now)) throw new BadRequestException(FUTURE_DAY);
    if (await this.closed(tenantId, day, PaymentMethod.CASH)) throw new ConflictException(CASH_CLOSED);
    // Taking out more than the drawer should hold is a typing mistake (an extra zero), not a deposit.
    if (dto.direction === CashMoveDirection.OUT && new Prisma.Decimal(dto.amount).greaterThan((await this.closeView(tenantId, { day }, now)).expected)) {
      throw new BadRequestException(NOT_ENOUGH_CASH);
    }
    return this.prisma.$transaction(async (tx) => {
      const m = await tx.cashMove.create({ data: { tenantId, day: dayDate(day), direction: dto.direction, kind: dto.kind, amount: new Prisma.Decimal(dto.amount), note: dto.note?.trim() || null, createdBy: userId } });
      await tx.auditLog.create({ data: { tenantId, userId, action: 'CASH_MOVED', entityType: 'CashMove', entityId: m.id, metadataJson: { day, direction: m.direction, kind: m.kind, amount: m.amount.toString() } } });
      return { ...m, day };
    });
  }

  async cancelCashMove(tenantId: string, id: string, userId: string) {
    const m = await this.prisma.cashMove.findFirst({ where: { id, tenantId } });
    if (!m) throw new NotFoundException('Not found');
    if (m.cancelledAt) throw new ConflictException(MOVE_CANCELLED);
    if (await this.closed(tenantId, dayOf(m.day), PaymentMethod.CASH)) throw new ConflictException(CASH_CLOSED);
    await this.prisma.$transaction([
      this.prisma.cashMove.update({ where: { id }, data: { cancelledAt: new Date(), cancelledBy: userId } }),
      this.prisma.auditLog.create({ data: { tenantId, userId, action: 'CASH_MOVE_CANCELLED', entityType: 'CashMove', entityId: id, metadataJson: { day: dayOf(m.day), direction: m.direction, kind: m.kind, amount: m.amount.toString() } } }),
    ]);
    return { id, cancelled: true };
  }

  /**
   * Profit and loss by month (Pakistan months), the latest last (v2 review). Months before the business had any
   * activity are left out; `previous` is the same number of months just before (null when nothing happened then);
   * `current` says the latest month is not over yet (rent and salaries are booked for the whole month, sales only
   * so far). `cashDays` per month: the days closed short or over, the latest last.
   */
  async pnl(tenantId: string, q: PnlQueryDto, now = new Date()) {
    const count = q.months ?? 12;
    const today = businessDay(now);
    const thisMonth = today.slice(0, 7);
    const [y, m] = thisMonth.split('-').map(Number);
    // The window and the same number of months before it, in one pass.
    const all = Array.from({ length: count * 2 }, (_, i) => new Date(Date.UTC(y, m - count * 2 + i, 1)).toISOString().slice(0, 7));
    const start = localDayStart(all[0] + '-01');
    const firstDay = dayDate(all[0] + '-01');
    const [sales, expenses, adjustments, closes, moves, lots, containers, readyStock] = await Promise.all([
      this.prisma.sale.findMany({
        where: { tenantId, status: { in: KHATA_SALE_STATUSES }, OR: [{ issuedAt: { gte: start } }, { issuedAt: null, createdAt: { gte: start } }] },
        select: { totalAmount: true, totalCost: true, issuedAt: true, createdAt: true },
      }),
      this.prisma.expense.findMany({ where: { tenantId, cancelledAt: null, day: { gte: firstDay } }, select: { day: true, category: true, amount: true } }),
      this.prisma.stockAdjustment.findMany({ where: { tenantId, status: StockAdjustmentStatus.APPROVED, decidedAt: { gte: start } }, select: { decidedAt: true, costChange: true } }),
      this.prisma.cashClose.findMany({ where: { tenantId, day: { gte: firstDay } }, select: { day: true, difference: true }, orderBy: { day: 'asc' } }),
      // Not in profit, shown apart: cash the owner took out or put in, and cash to or from the bank.
      this.prisma.cashMove.findMany({ where: { tenantId, cancelledAt: null, kind: { in: [CashMoveKind.OWNER, CashMoveKind.BANK] }, day: { gte: firstDay } }, select: { day: true, kind: true, direction: true, amount: true } }),
      // Stock bought in the month (information: it becomes a cost when it is sold): loose lots, containers, ready stock.
      this.prisma.rag.findMany({ where: { tenantId, containerId: null, createdAt: { gte: start } }, select: { createdAt: true, allocatedCost: true } }),
      this.prisma.container.findMany({ where: { tenantId, createdAt: { gte: start } }, select: { createdAt: true, landedCostPKR: true } }),
      this.prisma.inventoryItem.findMany({ where: { tenantId, source: StockSource.PURCHASED, createdAt: { gte: start } }, select: { createdAt: true, totalCost: true } }),
    ]);
    const blank = () => ({
      revenue: ZERO, cost: ZERO, writeOffs: ZERO, cashDifference: ZERO, cashDays: [] as string[], active: false,
      bought: ZERO, ownerOut: ZERO, ownerIn: ZERO, bankOut: ZERO, bankIn: ZERO,
      expenses: Object.fromEntries(Object.values(ExpenseCategory).map((c) => [c, ZERO])) as Record<ExpenseCategory, Prisma.Decimal>,
    });
    const rows = new Map(all.map((mm) => [mm, blank()]));
    const at = (d: Date) => rows.get(businessDay(d).slice(0, 7));
    for (const s of sales) {
      const r = at(s.issuedAt ?? s.createdAt);
      if (r) { r.revenue = r.revenue.add(s.totalAmount); r.cost = r.cost.add(s.totalCost); r.active = true; }
    }
    for (const e of expenses) {
      const r = rows.get(dayOf(e.day).slice(0, 7));
      if (r) { r.expenses[e.category] = r.expenses[e.category].add(e.amount); r.active = true; }
    }
    for (const a of adjustments) {
      const r = a.decidedAt ? at(a.decidedAt) : undefined;
      if (r && a.costChange) { r.writeOffs = r.writeOffs.add(a.costChange); r.active = true; }
    }
    for (const c of closes) {
      const r = rows.get(dayOf(c.day).slice(0, 7));
      if (!r) continue;
      r.cashDifference = r.cashDifference.add(c.difference);
      if (!c.difference.isZero()) r.cashDays.push(dayOf(c.day));
      r.active = true;
    }
    for (const mv of moves) {
      const r = rows.get(dayOf(mv.day).slice(0, 7));
      if (!r) continue;
      const out = mv.direction === CashMoveDirection.OUT;
      const key = mv.kind === CashMoveKind.OWNER ? (out ? 'ownerOut' : 'ownerIn') : out ? 'bankOut' : 'bankIn';
      r[key] = r[key].add(mv.amount);
    }
    for (const b of [...lots.map((l) => ({ at: l.createdAt, cost: l.allocatedCost })), ...containers.map((c) => ({ at: c.createdAt, cost: c.landedCostPKR })), ...readyStock.map((i) => ({ at: i.createdAt, cost: i.totalCost }))]) {
      const r = at(b.at);
      if (r && b.cost) r.bought = r.bought.add(b.cost);
    }
    const sectionsOf = (expenses: Record<ExpenseCategory, Prisma.Decimal>) =>
      Object.fromEntries(EXPENSE_SECTION_KEYS.map((k) => [k, (EXPENSE_SECTIONS[k] as readonly ExpenseCategory[]).reduce((t, c) => t.add(expenses[c]), ZERO)])) as Record<ExpenseSection, Prisma.Decimal>;
    const line = (month: string) => {
      const r = rows.get(month)!;
      const gross = r.revenue.sub(r.cost);
      const expenseTotal = Object.values(r.expenses).reduce((t, v) => t.add(v), ZERO);
      return {
        month, revenue: r.revenue, cost: r.cost, grossProfit: gross,
        marginPercent: r.revenue.isZero() ? null : gross.div(r.revenue).mul(100).toDecimalPlaces(1).toNumber(),
        writeOffs: r.writeOffs, cashDifference: r.cashDifference, cashDays: r.cashDays, expenses: r.expenses, expenseTotal,
        sections: sectionsOf(r.expenses), bought: r.bought,
        notInProfit: { ownerOut: r.ownerOut, ownerIn: r.ownerIn, bankOut: r.bankOut, bankIn: r.bankIn },
        netProfit: netProfit({ grossProfit: gross, writeOffs: r.writeOffs, cashDifference: r.cashDifference, expenseTotal }),
      };
    };
    const totalOf = (list: ReturnType<typeof line>[]) => {
      const sum = (k: 'revenue' | 'cost' | 'grossProfit' | 'writeOffs' | 'cashDifference' | 'expenseTotal' | 'netProfit') => list.reduce((t, r) => t.add(r[k]), ZERO);
      const revenue = sum('revenue');
      const grossProfit = sum('grossProfit');
      return {
        revenue, cost: sum('cost'), grossProfit, writeOffs: sum('writeOffs'), cashDifference: sum('cashDifference'),
        expenseTotal: sum('expenseTotal'), netProfit: sum('netProfit'),
        marginPercent: revenue.isZero() ? null : grossProfit.div(revenue).mul(100).toDecimalPlaces(1).toNumber(),
        expenses: Object.fromEntries(Object.values(ExpenseCategory).map((c) => [c, list.reduce((t, r) => t.add(r.expenses[c]), ZERO)])),
        sections: Object.fromEntries(EXPENSE_SECTION_KEYS.map((k) => [k, list.reduce((t, r) => t.add(r.sections[k]), ZERO)])) as Record<ExpenseSection, Prisma.Decimal>,
        bought: list.reduce((t, r) => t.add(r.bought), ZERO),
        notInProfit: Object.fromEntries((['ownerOut', 'ownerIn', 'bankOut', 'bankIn'] as const).map((k) => [k, list.reduce((t, r) => t.add(r.notInProfit[k]), ZERO)])) as Record<'ownerOut' | 'ownerIn' | 'bankOut' | 'bankIn', Prisma.Decimal>,
      };
    };
    const window = all.slice(count);
    const before = all.slice(0, count);
    // Months before the first activity are left out (the latest month always stays).
    const first = window.findIndex((mm) => rows.get(mm)!.active);
    const shown = window.slice(first === -1 ? window.length - 1 : first);
    const out = shown.map(line);
    const previous = before.some((mm) => rows.get(mm)!.active) ? totalOf(before.map(line)) : null;
    const days = Number(today.slice(8, 10));
    const of = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { months: out, totals: totalOf(out), previous, current: days < of ? { month: thisMonth, days, of } : null };
  }
}

/** Net profit, the same everywhere (P&L and dashboard): gross profit, less stock written off (a negative cost
 * change) and cash short (a negative difference), less expenses. */
export function netProfit(p: { grossProfit: Prisma.Decimal; writeOffs: Prisma.Decimal; cashDifference: Prisma.Decimal; expenseTotal: Prisma.Decimal }): Prisma.Decimal {
  return p.grossProfit.add(p.writeOffs).add(p.cashDifference).sub(p.expenseTotal);
}

/** Stock written off and cash short or over in a period (business days from..to, inclusive). */
export async function writeOffsAndCash(prisma: PrismaService, tenantId: string, fromDay: string, toDay: string) {
  const end = new Date(localDayStart(toDay).getTime() + DAY);
  const [adj, cash] = await Promise.all([
    prisma.stockAdjustment.aggregate({ where: { tenantId, status: StockAdjustmentStatus.APPROVED, decidedAt: { gte: localDayStart(fromDay), lt: end } }, _sum: { costChange: true } }),
    prisma.cashClose.aggregate({ where: { tenantId, day: { gte: dayDate(fromDay), lte: dayDate(toDay) } }, _sum: { difference: true } }),
  ]);
  return { writeOffs: adj._sum.costChange ?? ZERO, cashDifference: cash._sum.difference ?? ZERO };
}

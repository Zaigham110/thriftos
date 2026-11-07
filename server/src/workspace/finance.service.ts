import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ExpenseCategory, PaymentMethod, Prisma, StockAdjustmentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { localDayStart } from '../common/list/list-engine';
import { PrismaService } from '../prisma/prisma.service';
import { KHATA_SALE_STATUSES } from '../sales/khata.service';
import { businessDay } from './receivables.service';

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
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

export class PnlQueryDto {
  /** Months back from this month (1–24). */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(24) months?: number;
}

type BookLine = { at: Date; day: string; kind: 'RECEIPT' | 'EXPENSE' | 'CLOSE'; id: string; ref: string | null; party: string | null; in: Prisma.Decimal; out: Prisma.Decimal };

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
    const [payments, expenses, closes] = await Promise.all([
      this.prisma.payment.findMany({
        where: { tenantId, method, ...(until ? { receivedAt: { lt: until } } : {}) },
        select: { id: true, amount: true, receivedAt: true, reference: true, customer: { select: { name: true } }, sale: { select: { saleNumber: true } } },
      }),
      this.prisma.expense.findMany({ where: { tenantId, method, cancelledAt: null } }),
      method === PaymentMethod.CASH ? this.prisma.cashClose.findMany({ where: { tenantId } }) : Promise.resolve([]),
    ]);
    // An expense day / close day sits at the end of that business day for ordering (after the day's receipts).
    const endOf = (d: Date) => new Date(localDayStart(dayOf(d)).getTime() + DAY - 1);
    const out: BookLine[] = [
      ...payments.map((p) => ({ at: p.receivedAt, day: businessDay(p.receivedAt), kind: 'RECEIPT' as const, id: p.id, ref: p.sale?.saleNumber ?? p.reference, party: p.customer.name, in: p.amount, out: ZERO })),
      ...expenses.map((e) => ({ at: new Date(endOf(e.day).getTime() - 1), day: dayOf(e.day), kind: 'EXPENSE' as const, id: e.id, ref: e.category, party: e.paidTo, in: ZERO, out: e.amount })),
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

  /** The day's cash: opening, in, out, what should be in the drawer, and the close if it was done. */
  async closeView(tenantId: string, q: CloseQueryDto, now = new Date()) {
    const day = q.day ? ymd(q.day) : businessDay(now);
    const start = localDayStart(day);
    const end = new Date(start.getTime() + DAY);
    const close = await this.prisma.cashClose.findFirst({ where: { tenantId, day: dayDate(day) } });
    const lines = (await this.lines(tenantId, PaymentMethod.CASH, end)).filter((l) => !(l.kind === 'CLOSE' && l.day === day));
    let opening = ZERO;
    let cashIn = ZERO;
    let cashOut = ZERO;
    for (const l of lines) {
      if (l.at < start) opening = opening.add(l.in).sub(l.out);
      else {
        cashIn = cashIn.add(l.in);
        cashOut = cashOut.add(l.out);
      }
    }
    const expected = opening.add(cashIn).sub(cashOut);
    const people = close ? await this.prisma.user.findFirst({ where: { id: close.closedBy, tenantId }, select: { name: true } }) : null;
    const recent = await this.prisma.cashClose.findMany({ where: { tenantId }, orderBy: { day: 'desc' }, take: 14 });
    return {
      day, opening, in: cashIn, out: cashOut, expected,
      lines: lines.filter((l) => l.at >= start),
      close: close ? { ...close, day: dayOf(close.day), closedByName: people?.name ?? null } : null,
      recent: recent.map((c) => ({ id: c.id, day: dayOf(c.day), expected: c.expected, counted: c.counted, difference: c.difference })),
    };
  }

  async closeDay(tenantId: string, dto: CloseDto, userId: string, now = new Date()) {
    const day = ymd(dto.day);
    if (day > businessDay(now)) throw new BadRequestException('A day cannot be closed before it starts');
    const view = await this.closeView(tenantId, { day }, now);
    if (view.close) throw new ConflictException('This day is already closed');
    const counted = new Prisma.Decimal(dto.counted);
    const difference = counted.sub(view.expected);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const c = await tx.cashClose.create({ data: { tenantId, day: dayDate(day), expected: view.expected, counted, difference, note: dto.note?.trim() || null, closedBy: userId } });
        await tx.auditLog.create({ data: { tenantId, userId, action: 'CASH_CLOSED', entityType: 'CashClose', entityId: c.id, metadataJson: { day, expected: view.expected.toString(), counted: counted.toString(), difference: difference.toString() } } });
        return { ...c, day };
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('This day is already closed');
      throw e;
    }
  }

  /** Profit and loss by month (Pakistan months), the latest last. */
  async pnl(tenantId: string, q: PnlQueryDto, now = new Date()) {
    const count = q.months ?? 12;
    const thisMonth = businessDay(now).slice(0, 7);
    const [y, m] = thisMonth.split('-').map(Number);
    const months = Array.from({ length: count }, (_, i) => new Date(Date.UTC(y, m - count + i, 1)).toISOString().slice(0, 7));
    const start = localDayStart(months[0] + '-01');
    const [sales, expenses, adjustments, closes] = await Promise.all([
      this.prisma.sale.findMany({
        where: { tenantId, status: { in: KHATA_SALE_STATUSES }, OR: [{ issuedAt: { gte: start } }, { issuedAt: null, createdAt: { gte: start } }] },
        select: { totalAmount: true, totalCost: true, issuedAt: true, createdAt: true },
      }),
      this.prisma.expense.findMany({ where: { tenantId, cancelledAt: null, day: { gte: dayDate(months[0] + '-01') } }, select: { day: true, category: true, amount: true } }),
      this.prisma.stockAdjustment.findMany({ where: { tenantId, status: StockAdjustmentStatus.APPROVED, decidedAt: { gte: start } }, select: { decidedAt: true, costChange: true } }),
      this.prisma.cashClose.findMany({ where: { tenantId, day: { gte: dayDate(months[0] + '-01') } }, select: { day: true, difference: true } }),
    ]);
    const blank = () => ({
      revenue: ZERO, cost: ZERO, writeOffs: ZERO, cashDifference: ZERO,
      expenses: Object.fromEntries(Object.values(ExpenseCategory).map((c) => [c, ZERO])) as Record<ExpenseCategory, Prisma.Decimal>,
    });
    const rows = new Map(months.map((mm) => [mm, blank()]));
    const at = (d: Date) => rows.get(businessDay(d).slice(0, 7));
    for (const s of sales) {
      const r = at(s.issuedAt ?? s.createdAt);
      if (r) { r.revenue = r.revenue.add(s.totalAmount); r.cost = r.cost.add(s.totalCost); }
    }
    for (const e of expenses) {
      const r = rows.get(dayOf(e.day).slice(0, 7));
      if (r) r.expenses[e.category] = r.expenses[e.category].add(e.amount);
    }
    for (const a of adjustments) {
      const r = a.decidedAt ? at(a.decidedAt) : undefined;
      if (r && a.costChange) r.writeOffs = r.writeOffs.add(a.costChange);
    }
    for (const c of closes) {
      const r = rows.get(dayOf(c.day).slice(0, 7));
      if (r) r.cashDifference = r.cashDifference.add(c.difference);
    }
    const out = months.map((month) => {
      const r = rows.get(month)!;
      const gross = r.revenue.sub(r.cost);
      const expenseTotal = Object.values(r.expenses).reduce((t, v) => t.add(v), ZERO);
      // Write-offs are negative cost changes (a loss) and cash short is a negative difference: both add on.
      const net = gross.add(r.writeOffs).add(r.cashDifference).sub(expenseTotal);
      return {
        month, revenue: r.revenue, cost: r.cost, grossProfit: gross,
        marginPercent: r.revenue.isZero() ? null : gross.div(r.revenue).mul(100).toDecimalPlaces(1).toNumber(),
        writeOffs: r.writeOffs, cashDifference: r.cashDifference, expenses: r.expenses, expenseTotal, netProfit: net,
      };
    });
    const sum = (k: 'revenue' | 'cost' | 'grossProfit' | 'writeOffs' | 'cashDifference' | 'expenseTotal' | 'netProfit') => out.reduce((t, r) => t.add(r[k]), ZERO);
    const totals = {
      revenue: sum('revenue'), cost: sum('cost'), grossProfit: sum('grossProfit'), writeOffs: sum('writeOffs'), cashDifference: sum('cashDifference'),
      expenseTotal: sum('expenseTotal'), netProfit: sum('netProfit'),
      expenses: Object.fromEntries(Object.values(ExpenseCategory).map((c) => [c, out.reduce((t, r) => t.add(r.expenses[c]), ZERO)])),
    };
    return { months: out, totals };
  }
}

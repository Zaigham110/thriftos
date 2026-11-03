import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { BUSINESS_UTC_OFFSET_MINUTES, localDayStart } from '../common/list/list-engine';
import { overdueDays } from '../sales/khata';
import { applyFor, KHATA_SALE_STATUSES, KhataService } from '../sales/khata.service';
import { PrismaService } from '../prisma/prisma.service';

const ZERO = new Prisma.Decimal(0);
const DAY = 86_400_000;

export class PromiseDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  amount!: number;

  /** YYYY-MM-DD, a Pakistan business day. */
  @IsDateString()
  promisedFor!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class CreditLimitDto {
  /** 0 = no limit. */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  creditLimit!: number;
}

export class StatementQueryDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

export class ReminderDto {
  @IsOptional() @IsString() lang?: string;
}

export const AGE_KEYS = ['0-30', '31-60', '61-90', '90+'] as const;
export type AgeKey = (typeof AGE_KEYS)[number];
const ageKey = (days: number): AgeKey => (days <= 30 ? '0-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '90+');

/** Pakistan business day (YYYY-MM-DD) of a moment. */
export const businessDay = (d: Date): string => new Date(d.getTime() + BUSINESS_UTC_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);

export type PromiseStatus = 'OPEN' | 'DUE_TODAY' | 'KEPT' | 'BROKEN' | 'CANCELLED';

/** Kept once the payments received since the promise reach its amount; broken when its day has passed. */
export function promiseStatus(
  p: { amount: Prisma.Decimal; promisedFor: Date; createdAt: Date; cancelledAt: Date | null },
  payments: { amount: Prisma.Decimal; receivedAt: Date }[],
  now: Date,
): { status: PromiseStatus; paid: Prisma.Decimal } {
  const paid = payments.filter((x) => x.receivedAt.getTime() >= p.createdAt.getTime()).reduce((s, x) => s.add(x.amount), ZERO);
  if (p.cancelledAt) return { status: 'CANCELLED', paid };
  if (paid.greaterThanOrEqualTo(p.amount)) return { status: 'KEPT', paid };
  const day = p.promisedFor.toISOString().slice(0, 10);
  const today = businessDay(now);
  return { status: today > day ? 'BROKEN' : today === day ? 'DUE_TODAY' : 'OPEN', paid };
}

type Applied = ReturnType<typeof applyFor<{ id: string; totalAmount: Prisma.Decimal; issuedAt: Date | null; createdAt: Date }>>;

/** What is owed by age of the debt: the opening balance counts from the day the customer was added. */
export function ageing(applied: Applied, openingSince: Date, now: Date): Record<AgeKey, Prisma.Decimal> {
  const out: Record<AgeKey, Prisma.Decimal> = { '0-30': ZERO, '31-60': ZERO, '61-90': ZERO, '90+': ZERO };
  const add = (at: Date, amount: Prisma.Decimal) => {
    const k = ageKey(Math.max(0, Math.floor((now.getTime() - at.getTime()) / DAY)));
    out[k] = out[k].add(amount);
  };
  if (applied.openingDue.greaterThan(0)) add(openingSince, applied.openingDue);
  for (const s of applied.sales) if (s.due.greaterThan(0)) add(s.at, s.due);
  // An advance on account is not debt; nothing to age.
  return out;
}

const money = <T>(allowed: boolean, v: T): T | null => (allowed ? v : null);

/**
 * Receivables in the workspace (enterprise plan E3.5): the collections worklist and ageing report, a customer's
 * 360 record, statement of account, promises to pay, reminders (logged) and credit limits. Balances are always
 * worked out from opening balance, sales and payments (sales/khata.ts) — nothing new is stored but promises.
 */
@Injectable()
export class ReceivablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly khata: KhataService,
  ) {}

  async worklist(tenantId: string, now = new Date()) {
    const [customers, sales, payments, promises, reminders] = await Promise.all([
      this.prisma.customer.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
      this.prisma.sale.findMany({
        where: { tenantId, status: { in: KHATA_SALE_STATUSES } },
        orderBy: [{ issuedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true, customerId: true, totalAmount: true, issuedAt: true, createdAt: true },
      }),
      this.prisma.payment.findMany({ where: { tenantId }, orderBy: { receivedAt: 'asc' }, select: { customerId: true, saleId: true, amount: true, receivedAt: true } }),
      this.prisma.paymentPromise.findMany({ where: { tenantId, cancelledAt: null }, orderBy: { createdAt: 'desc' } }),
      this.prisma.auditLog.groupBy({ by: ['entityId'], where: { tenantId, action: 'KHATA_REMINDER_SENT', entityType: 'Customer' }, _max: { createdAt: true } }),
    ]);
    const salesOf = group(sales, (s) => s.customerId);
    const paymentsOf = group(payments, (p) => p.customerId ?? '');
    const promiseOf = group(promises, (p) => p.customerId);
    const remindedAt = new Map(reminders.map((r) => [r.entityId, r._max.createdAt]));

    const totals = { owed: ZERO, advance: ZERO, customers: 0, buckets: { '0-30': ZERO, '31-60': ZERO, '61-90': ZERO, '90+': ZERO } as Record<AgeKey, Prisma.Decimal> };
    const rows = [];
    for (const c of customers) {
      const pays = paymentsOf.get(c.id) ?? [];
      const applied = applyFor(c.openingBalance, salesOf.get(c.id) ?? [], pays);
      if (applied.balance.lessThanOrEqualTo(0)) {
        totals.advance = totals.advance.add(applied.advance);
        continue;
      }
      const buckets = ageing(applied, c.createdAt, now);
      for (const k of AGE_KEYS) totals.buckets[k] = totals.buckets[k].add(buckets[k]);
      totals.owed = totals.owed.add(applied.balance);
      totals.customers += 1;
      const last = pays[pays.length - 1];
      // The promise that matters: the newest one not kept (open, due today or broken), else none.
      const promise = (promiseOf.get(c.id) ?? [])
        .map((p) => ({ p, ...promiseStatus(p, pays, now) }))
        .find((x) => x.status !== 'KEPT');
      const limit = c.creditLimit ?? ZERO;
      rows.push({
        id: c.id, name: c.name, phone: c.phone, city: c.city, balance: applied.balance, buckets,
        overdueDays: overdueDays(applied, c.createdAt, now),
        creditLimit: limit.greaterThan(0) ? limit : null,
        overLimit: limit.greaterThan(0) && applied.balance.greaterThan(limit),
        lastPayment: last ? { date: last.receivedAt, amount: last.amount } : null,
        lastReminder: remindedAt.get(c.id) ?? null,
        promise: promise ? { id: promise.p.id, amount: promise.p.amount, promisedFor: promise.p.promisedFor.toISOString().slice(0, 10), status: promise.status, paid: promise.paid } : null,
      });
    }
    rows.sort((a, b) => b.balance.comparedTo(a.balance) || a.name.localeCompare(b.name));
    return { totals, rows };
  }

  async customer(tenantId: string, id: string, canSeeCost: boolean, now = new Date()) {
    const { customer: c, sales, payments, applied } = await this.khata.accountTx(this.prisma, tenantId, id);
    const [promises, reminders, profit, saleNumbers] = await Promise.all([
      this.prisma.paymentPromise.findMany({ where: { tenantId, customerId: id }, orderBy: { createdAt: 'desc' } }),
      this.prisma.auditLog.findMany({ where: { tenantId, action: 'KHATA_REMINDER_SENT', entityType: 'Customer', entityId: id }, orderBy: { createdAt: 'desc' }, take: 10, select: { createdAt: true, userId: true } }),
      this.prisma.sale.aggregate({ where: { tenantId, customerId: id, status: { in: KHATA_SALE_STATUSES } }, _sum: { totalProfit: true } }),
      this.prisma.sale.findMany({ where: { tenantId, customerId: id }, select: { id: true, saleNumber: true } }),
    ]);
    const numberOf = new Map(saleNumbers.map((s) => [s.id, s.saleNumber]));
    const people = await this.prisma.user.findMany({ where: { tenantId, id: { in: [...new Set([...promises.map((p) => p.createdBy), ...reminders.map((r) => r.userId)])] } }, select: { id: true, name: true } });
    const nameOf = new Map(people.map((u) => [u.id, u.name]));
    const sold = sales.reduce((s, x) => s.add(x.totalAmount), ZERO);
    const paid = payments.reduce((s, x) => s.add(x.amount), ZERO);
    const limit = c.creditLimit ?? ZERO;

    // Last 12 months (Pakistan months): sold and received.
    const months: { month: string; sold: Prisma.Decimal; received: Prisma.Decimal }[] = [];
    const thisMonth = businessDay(now).slice(0, 7);
    for (let i = 11; i >= 0; i--) {
      const [y, m] = thisMonth.split('-').map(Number);
      const d = new Date(Date.UTC(y, m - 1 - i, 1));
      months.push({ month: d.toISOString().slice(0, 7), sold: ZERO, received: ZERO });
    }
    const slot = (at: Date) => months.find((x) => x.month === businessDay(at).slice(0, 7));
    for (const s of sales) {
      const x = slot(s.issuedAt ?? s.createdAt);
      if (x) x.sold = x.sold.add(s.totalAmount);
    }
    for (const p of payments) {
      const x = slot(p.receivedAt);
      if (x) x.received = x.received.add(p.amount);
    }

    return {
      customer: {
        id: c.id, name: c.name, phone: c.phone, city: c.city, companyName: c.companyName, address: c.billingAddress, notes: c.notes,
        createdAt: c.createdAt, isActive: c.isActive, openingBalance: c.openingBalance, creditLimit: limit.greaterThan(0) ? limit : null,
      },
      account: {
        balance: applied.balance, advance: applied.advance, openingDue: applied.openingDue, overdueDays: overdueDays(applied, c.createdAt, now),
        buckets: ageing(applied, c.createdAt, now), overLimit: limit.greaterThan(0) && applied.balance.greaterThan(limit),
        limitUsedPercent: limit.greaterThan(0) ? Math.round(applied.balance.div(limit).mul(100).toNumber()) : null,
      },
      totals: {
        sales: sales.length, sold, received: paid, profit: money(canSeeCost, profit._sum.totalProfit ?? ZERO),
        lastSale: sales.length ? sales[sales.length - 1].issuedAt ?? sales[sales.length - 1].createdAt : null,
        lastPayment: payments.length ? payments[payments.length - 1].receivedAt : null,
      },
      months,
      sales: [...applied.sales].reverse().map((s) => ({ id: s.key.id, number: s.key.saleNumber, date: s.at, total: s.total, paid: s.paid, due: s.due, status: s.status })),
      payments: [...payments].reverse().map((p) => ({ id: p.id, date: p.receivedAt, amount: p.amount, method: p.method, reference: p.reference, sale: p.saleId ? numberOf.get(p.saleId) ?? null : null, hasPhoto: !!p.attachmentUrl })),
      promises: promises.map((p) => ({
        id: p.id, amount: p.amount, promisedFor: p.promisedFor.toISOString().slice(0, 10), note: p.note, createdAt: p.createdAt,
        by: nameOf.get(p.createdBy) ?? null, ...promiseStatus(p, payments, now),
      })),
      reminders: reminders.map((r) => ({ date: r.createdAt, by: nameOf.get(r.userId) ?? null })),
    };
  }

  /** Statement of account for a period: balance brought forward, every sale and payment, balance carried. */
  async statement(tenantId: string, id: string, q: StatementQueryDto) {
    const ledger = await this.khata.ledger(tenantId, id);
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true } });
    const from = q.from ? localDayStart(q.from) : null;
    const to = q.to ? new Date(localDayStart(q.to).getTime() + DAY) : null;
    if (from && to && from >= to) throw new BadRequestException('"from" must be before "to"');
    let opening = ZERO;
    const lines = [];
    for (const l of ledger.lines) {
      if (from && l.at < from) opening = l.balance;
      else if (!to || l.at < to) lines.push({ date: l.at, kind: l.kind, ref: l.ref, debit: l.debit, credit: l.credit, balance: l.balance });
    }
    const debit = lines.reduce((s, l) => s.add(l.debit), ZERO);
    const credit = lines.reduce((s, l) => s.add(l.credit), ZERO);
    return {
      business: tenant.name,
      customer: { id: ledger.customer.id, name: ledger.customer.name, phone: ledger.customer.phone, city: ledger.customer.city, address: ledger.customer.billingAddress },
      from: q.from ?? null, to: q.to ?? null, opening, lines, debit, credit, closing: opening.add(debit).sub(credit),
      generatedAt: new Date(),
    };
  }

  async addPromise(tenantId: string, customerId: string, dto: PromiseDto, userId: string, now = new Date()) {
    const c = await this.prisma.customer.findFirst({ where: { id: customerId, tenantId }, select: { id: true } });
    if (!c) throw new NotFoundException('Customer not found');
    if (dto.promisedFor.slice(0, 10) < businessDay(now)) throw new BadRequestException('The promised day has already passed');
    return this.prisma.$transaction(async (tx) => {
      const p = await tx.paymentPromise.create({
        data: { tenantId, customerId, amount: new Prisma.Decimal(dto.amount), promisedFor: new Date(dto.promisedFor.slice(0, 10) + 'T00:00:00Z'), note: dto.note?.trim() || null, createdBy: userId },
      });
      await tx.auditLog.create({ data: { tenantId, userId, action: 'PAYMENT_PROMISED', entityType: 'Customer', entityId: customerId, metadataJson: { amount: p.amount.toString(), promisedFor: dto.promisedFor.slice(0, 10) } } });
      return { ...p, promisedFor: dto.promisedFor.slice(0, 10) };
    });
  }

  async cancelPromise(tenantId: string, promiseId: string, userId: string) {
    const p = await this.prisma.paymentPromise.findFirst({ where: { id: promiseId, tenantId } });
    if (!p) throw new NotFoundException('Promise not found');
    if (p.cancelledAt) throw new ConflictException('Already cancelled');
    await this.prisma.$transaction([
      this.prisma.paymentPromise.update({ where: { id: p.id }, data: { cancelledAt: new Date() } }),
      this.prisma.auditLog.create({ data: { tenantId, userId, action: 'PAYMENT_PROMISE_CANCELLED', entityType: 'Customer', entityId: p.customerId, metadataJson: { promiseId: p.id } } }),
    ]);
    return { id: p.id, cancelled: true };
  }

  /** The wa.me reminder for one customer, logged as sent (the person opens WhatsApp and sends it). */
  async remind(tenantId: string, customerId: string, dto: ReminderDto, userId: string) {
    const r = await this.khata.reminder(tenantId, customerId, dto.lang);
    if (!r.url) throw new BadRequestException('This customer has no WhatsApp number');
    await this.prisma.auditLog.create({ data: { tenantId, userId, action: 'KHATA_REMINDER_SENT', entityType: 'Customer', entityId: customerId, metadataJson: { balance: r.balance.toString() } } });
    return r;
  }

  async setCreditLimit(tenantId: string, customerId: string, dto: CreditLimitDto, userId: string) {
    const c = await this.prisma.customer.findFirst({ where: { id: customerId, tenantId }, select: { id: true, creditLimit: true } });
    if (!c) throw new NotFoundException('Customer not found');
    const limit = new Prisma.Decimal(dto.creditLimit);
    await this.prisma.$transaction([
      this.prisma.customer.update({ where: { id: c.id }, data: { creditLimit: limit } }),
      this.prisma.auditLog.create({ data: { tenantId, userId, action: 'CREDIT_LIMIT_CHANGED', entityType: 'Customer', entityId: c.id, metadataJson: { from: (c.creditLimit ?? ZERO).toString(), to: limit.toString() } } }),
    ]);
    return { id: c.id, creditLimit: limit.greaterThan(0) ? limit : null };
  }
}

function group<T>(list: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of list) {
    const k = key(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(x);
  }
  return m;
}

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CashKind, KhataKind, PayMethod, Prisma, RefundTo, SaleStatus, Shift } from '@prisma/client';
import { audit, openShift } from '../common/audit';
import { Actor, isManager, ManagerUp, Me } from '../common/auth.guard';
import { PrismaService } from '../common/prisma.service';
import { amount, D, day, Dec, fail, optText, range, text, ZERO } from '../common/util';

/** The cash drawer: a shift is opened with a float and closed by counting; and the shop's expenses. */
@Controller()
export class DrawerController {
  constructor(private readonly prisma: PrismaService) {}

  private async till(me: Actor, id: unknown) {
    const till = await this.prisma.till.findFirst({ where: { id: String(id ?? ''), tenantId: me.tenantId, branchId: me.branchId } });
    if (!till) fail('NO_TILL', 'Choose the till of this device in Settings first.', 409);
    return till;
  }

  /** Everything that moved in the drawer during a shift, and the cash that should be in it. */
  private async summary(shift: Shift) {
    const tenantId = shift.tenantId;
    const sum = (d: Dec | null | undefined) => d ?? new D(0);
    const [byMethod, sales, khataIn, refunds, expenses] = await Promise.all([
      this.prisma.salePayment.groupBy({ by: ['method'], where: { tenantId, sale: { shiftId: shift.id, status: SaleStatus.COMPLETED } }, _sum: { amount: true } }),
      this.prisma.sale.aggregate({ where: { tenantId, shiftId: shift.id, status: SaleStatus.COMPLETED }, _sum: { total: true, creditAmount: true, discount: true, taxAmount: true }, _count: { _all: true } }),
      this.prisma.customerEntry.groupBy({ by: ['method'], where: { tenantId, shiftId: shift.id, kind: KhataKind.PAYMENT }, _sum: { amount: true } }),
      this.prisma.saleReturn.groupBy({ by: ['refundTo'], where: { tenantId, shiftId: shift.id }, _sum: { total: true } }),
      this.prisma.expense.aggregate({ where: { tenantId, shiftId: shift.id, method: PayMethod.CASH }, _sum: { amount: true } }),
    ]);
    const moves = await this.prisma.cashMovement.findMany({ where: { tenantId, shiftId: shift.id }, orderBy: { createdAt: 'asc' } });
    const paid = (m: PayMethod) => sum(byMethod.find((g) => g.method === m)?._sum.amount);
    const moved = (k: CashKind) => moves.filter((m) => m.kind === k).reduce((a, m) => a.plus(m.amount), ZERO);
    const khataCash = sum(khataIn.find((g) => g.method === PayMethod.CASH)?._sum.amount).negated();
    const khataOther = khataIn.filter((g) => g.method !== PayMethod.CASH).reduce((a, g) => a.minus(sum(g._sum.amount)), ZERO);
    const cashRefunds = sum(refunds.find((g) => g.refundTo === RefundTo.CASH)?._sum.total);
    const cashExpenses = sum(expenses._sum.amount);
    const expectedCash = shift.openingFloat.plus(paid(PayMethod.CASH)).plus(khataCash).plus(moved(CashKind.IN)).minus(moved(CashKind.OUT)).minus(moved(CashKind.DROP)).minus(cashRefunds).minus(cashExpenses);
    return {
      bills: sales._count._all,
      salesTotal: sum(sales._sum.total),
      discount: sum(sales._sum.discount),
      tax: sum(sales._sum.taxAmount),
      credit: sum(sales._sum.creditAmount),
      cashSales: paid(PayMethod.CASH),
      bankSales: paid(PayMethod.BANK),
      walletSales: paid(PayMethod.WALLET),
      khataCash,
      khataOther,
      cashIn: moved(CashKind.IN),
      cashOut: moved(CashKind.OUT),
      drops: moved(CashKind.DROP),
      cashRefunds,
      otherRefunds: refunds.filter((g) => g.refundTo !== RefundTo.CASH).reduce((a, g) => a.plus(sum(g._sum.total)), ZERO),
      cashExpenses,
      expectedCash,
      moves,
    };
  }

  /** The shift open on this till now (or none). */
  @Get('shifts/current')
  async current(@Me() me: Actor, @Query('tillId') tillId: string) {
    const till = await this.till(me, tillId);
    const shift = await openShift(this.prisma, me.tenantId, till.id);
    return shift ? { ...shift, till: { code: till.code, name: till.name }, summary: await this.summary(shift) } : null;
  }

  @Post('shifts/open')
  async open(@Me() me: Actor, @Body() body: Record<string, unknown>) {
    const till = await this.till(me, body.tillId);
    const openingFloat = amount(body.openingFloat, 'Cash in the drawer');
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${till.id}))`;
      if (await openShift(tx, me.tenantId, till.id)) fail('ALREADY_OPEN', `${till.name} already has an open drawer.`, 409);
      return tx.shift.create({ data: { tenantId: me.tenantId, branchId: till.branchId, tillId: till.id, openedById: me.id, openedByName: me.name, openingFloat } });
    });
  }

  /** Cash put in, taken out, or taken to the bank. `clientKey` lets a till send it again safely after being offline. */
  @Post('shifts/cash')
  async cash(@Me() me: Actor, @Body() body: Record<string, unknown>) {
    const till = await this.till(me, body.tillId);
    const shift = await openShift(this.prisma, me.tenantId, till.id);
    if (!shift) fail('NO_SHIFT', 'Open the drawer first.', 409);
    const kind = String(body.kind) in CashKind ? (String(body.kind) as CashKind) : fail('BAD_KIND', 'Choose cash in, cash out or bank drop.');
    const value = amount(body.amount, 'Amount');
    if (!value.greaterThan(0)) fail('BAD_NUMBER', 'Type the amount.');
    const clientKey = optText(body.clientKey, 'Key', 80);
    if (clientKey) {
      const before = await this.prisma.cashMovement.findFirst({ where: { tenantId: me.tenantId, clientKey } });
      if (before) return before;
    }
    return this.prisma.cashMovement.create({ data: { tenantId: me.tenantId, shiftId: shift.id, kind, amount: value, reason: text(body.reason, 'Reason', 120), clientKey, userId: me.id, userName: me.name } });
  }

  /** The drawer was opened without a sale: kept in the owner's record. */
  @Post('shifts/no-sale')
  async noSale(@Me() me: Actor, @Body() body: Record<string, unknown>) {
    await audit(this.prisma, me, 'Drawer opened', optText(body.reason, 'Reason', 120) ?? 'No sale');
    return { ok: true };
  }

  /** Count the cash and close. The difference is kept; it is never hidden. */
  @Post('shifts/close')
  async close(@Me() me: Actor, @Body() body: Record<string, unknown>) {
    const till = await this.till(me, body.tillId);
    const shift = await openShift(this.prisma, me.tenantId, till.id);
    if (!shift) fail('NO_SHIFT', 'This till has no open drawer.', 409);
    const countedCash = amount(body.countedCash, 'Cash counted');
    const summary = await this.summary(shift);
    const difference = countedCash.minus(summary.expectedCash);
    const done = await this.prisma.shift.updateMany({
      where: { id: shift.id, closedAt: null },
      data: { closedAt: new Date(), closedById: me.id, closedByName: me.name, countedCash, expectedCash: summary.expectedCash, difference, note: optText(body.note, 'Note', 300) },
    });
    if (done.count !== 1) fail('NO_SHIFT', 'This drawer was already closed.', 409);
    if (!difference.isZero()) await audit(this.prisma, me, 'Drawer difference', `${till.name}: counted Rs ${countedCash.toFixed(0)}, expected Rs ${summary.expectedCash.toFixed(0)}`);
    return this.one(me, shift.id);
  }

  @ManagerUp()
  @Get('shifts')
  async list(@Me() me: Actor, @Query() q: Record<string, string>) {
    const shifts = await this.prisma.shift.findMany({ where: { tenantId: me.tenantId, branchId: me.branchId, ...(q.from ? { openedAt: range(q) } : {}) }, orderBy: { openedAt: 'desc' }, take: 100 });
    const tills = await this.prisma.till.findMany({ where: { tenantId: me.tenantId }, select: { id: true, code: true, name: true } });
    return shifts.map((s) => ({ ...s, till: tills.find((t) => t.id === s.tillId) }));
  }

  /** One shift with its full report (the Z report). The person who ran it may see it; others need a manager. */
  @Get('shifts/:id')
  async one(@Me() me: Actor, @Param('id') id: string) {
    const shift = await this.prisma.shift.findFirst({ where: { id, tenantId: me.tenantId, branchId: me.branchId } });
    if (!shift) fail('NOT_FOUND', 'This shift was not found.', 404);
    if (!isManager(me) && shift.openedById !== me.id && shift.closedById !== me.id) fail('MANAGER_ONLY', 'Only a manager or the owner can see another person\'s shift.', 403);
    const till = await this.prisma.till.findFirst({ where: { id: shift.tillId }, select: { code: true, name: true } });
    return { ...shift, till, summary: await this.summary(shift) };
  }

  // ---- Expenses ----

  @ManagerUp()
  @Get('expenses')
  async expenses(@Me() me: Actor, @Query() q: Record<string, string>) {
    const { gte, lt } = range(q);
    const where: Prisma.ExpenseWhereInput = { tenantId: me.tenantId, branchId: me.branchId, createdAt: { gte, lt } };
    const [expenses, categories] = await Promise.all([
      this.prisma.expense.findMany({ where, orderBy: { createdAt: 'desc' }, take: 500 }),
      this.prisma.expense.findMany({ where: { tenantId: me.tenantId }, distinct: ['category'], select: { category: true }, orderBy: { category: 'asc' } }),
    ]);
    return { expenses, total: expenses.reduce((a, e) => a.plus(e.amount), ZERO), categories: categories.map((c) => c.category) };
  }

  /** Cash expenses come out of the open drawer of the till they are typed on. */
  @ManagerUp()
  @Post('expenses')
  async addExpense(@Me() me: Actor, @Body() body: Record<string, unknown>) {
    const value = amount(body.amount, 'Amount');
    if (!value.greaterThan(0)) fail('BAD_NUMBER', 'Type the amount.');
    const method = String(body.method) in PayMethod ? (String(body.method) as PayMethod) : PayMethod.CASH;
    let shiftId: string | null = null;
    if (method === PayMethod.CASH && body.fromDrawer !== false && body.tillId) {
      const till = await this.till(me, body.tillId);
      shiftId = (await openShift(this.prisma, me.tenantId, till.id))?.id ?? null;
    }
    return this.prisma.expense.create({
      data: {
        tenantId: me.tenantId,
        branchId: me.branchId,
        shiftId,
        category: text(body.category, 'What it was for', 60),
        amount: value,
        method,
        note: optText(body.note, 'Note', 200),
        spentOn: body.spentOn ? day(body.spentOn, 'Date') : new Date(),
        userId: me.id,
        userName: me.name,
      },
    });
  }
}

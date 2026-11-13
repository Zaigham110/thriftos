import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { KhataKind, PayMethod, Prisma } from '@prisma/client';
import { khata, openShift } from '../common/audit';
import { Actor, ManagerUp, Me } from '../common/auth.guard';
import { PrismaService } from '../common/prisma.service';
import { amount, fail, optAmount, optText, text, ZERO } from '../common/util';

/** Customers and their khata (what they owe), shared by every branch; and bills put on hold. */
@Controller()
export class CustomersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('customers')
  async list(@Me() me: Actor, @Query() q: Record<string, string>) {
    const where: Prisma.CustomerWhereInput = { tenantId: me.tenantId, active: true };
    const search = (q.search ?? '').trim();
    if (search) where.OR = [{ name: { contains: search, mode: 'insensitive' } }, { phone: { contains: search.replace(/\s/g, '') } }];
    if (q.owing) where.balance = { gt: 0 };
    const [customers, owed] = await Promise.all([
      this.prisma.customer.findMany({ where, orderBy: q.owing ? { balance: 'desc' } : { name: 'asc' }, take: 500 }),
      this.prisma.customer.aggregate({ where: { tenantId: me.tenantId, active: true, balance: { gt: 0 } }, _sum: { balance: true }, _count: { _all: true } }),
    ]);
    return { customers, owed: owed._sum.balance ?? ZERO, owing: owed._count._all };
  }

  private data(body: Record<string, unknown>) {
    return {
      name: text(body.name, 'Name', 80),
      phone: optText(body.phone, 'Phone', 30)?.replace(/[^\d+]/g, '') ?? null,
      address: optText(body.address, 'Address'),
      notes: optText(body.notes, 'Notes', 300),
    };
  }

  @Post('customers')
  async add(@Me() me: Actor, @Body() body: Record<string, unknown>) {
    const data = this.data(body);
    if (data.phone) {
      const same = await this.prisma.customer.findFirst({ where: { tenantId: me.tenantId, phone: data.phone, active: true } });
      if (same) fail('PHONE_USED', `${same.name} already has this phone number.`, 409);
    }
    const opening = amount(body.openingBalance, 'Old balance');
    const limit = optAmount(body.creditLimit, 'Credit limit');
    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({ data: { tenantId: me.tenantId, ...data, creditLimit: limit } });
      if (opening.isZero()) return customer;
      return khata(tx, me, customer.id, { kind: KhataKind.OPENING, amount: opening, note: 'Balance brought from the old khata' });
    });
  }

  private async find(me: Actor, id: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id, tenantId: me.tenantId } });
    if (!customer) fail('NOT_FOUND', 'This customer was not found.', 404);
    return customer;
  }

  @Get('customers/:id')
  async get(@Me() me: Actor, @Param('id') id: string) {
    const customer = await this.find(me, id);
    const entries = await this.prisma.customerEntry.findMany({ where: { tenantId: me.tenantId, customerId: id }, orderBy: { createdAt: 'desc' }, take: 200 });
    return { ...customer, entries };
  }

  @Patch('customers/:id')
  async update(@Me() me: Actor, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    await this.find(me, id);
    return this.prisma.customer.update({
      where: { id },
      data: {
        ...(body.name ? this.data(body) : {}),
        ...('creditLimit' in body ? { creditLimit: optAmount(body.creditLimit, 'Credit limit') } : {}),
        ...(typeof body.active === 'boolean' ? { active: body.active } : {}),
      },
    });
  }

  /** The customer pays some of what they owe. Cash goes into the till's open drawer. */
  @Post('customers/:id/payments')
  async pay(@Me() me: Actor, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    await this.find(me, id);
    const paid = amount(body.amount, 'Amount');
    if (!paid.greaterThan(0)) fail('BAD_NUMBER', 'Type the amount received.');
    const method = String(body.method) in PayMethod ? (String(body.method) as PayMethod) : PayMethod.CASH;
    const till = body.tillId ? await this.prisma.till.findFirst({ where: { id: String(body.tillId), tenantId: me.tenantId } }) : null;
    const shift = till ? await openShift(this.prisma, me.tenantId, till.id) : null;
    return this.prisma.$transaction((tx) => khata(tx, me, id, { kind: KhataKind.PAYMENT, amount: paid.negated(), method, shiftId: shift?.id, note: optText(body.note, 'Note') }));
  }

  /** Put right a wrong balance (manager or owner), with the reason kept. */
  @ManagerUp()
  @Post('customers/:id/adjust')
  async adjust(@Me() me: Actor, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    const customer = await this.find(me, id);
    const target = amount(String(body.balance ?? '').replace('-', ''), 'Balance');
    const signed = String(body.balance ?? '').trim().startsWith('-') ? target.negated() : target;
    const note = text(body.note, 'Reason', 200);
    return this.prisma.$transaction((tx) => khata(tx, me, id, { kind: KhataKind.ADJUST, amount: signed.minus(customer.balance), note }));
  }

  // ---- Bills on hold ----

  @Get('held')
  held(@Me() me: Actor) {
    return this.prisma.heldBill.findMany({ where: { tenantId: me.tenantId, branchId: me.branchId }, orderBy: { createdAt: 'desc' } });
  }

  @Post('held')
  hold(@Me() me: Actor, @Body() body: Record<string, unknown>) {
    if (!body.payload || typeof body.payload !== 'object') fail('BAD_HOLD', 'There is no bill to hold.');
    if (JSON.stringify(body.payload).length > 60_000) fail('TOO_LONG', 'This bill is too big to hold.');
    return this.prisma.heldBill.create({
      data: { tenantId: me.tenantId, branchId: me.branchId, label: text(body.label, 'Name for this bill', 60), total: amount(body.total, 'Total'), payload: body.payload as Prisma.InputJsonValue, userId: me.id, userName: me.name },
    });
  }

  /** Taking a held bill back removes it, so two tills cannot finish the same one. */
  @Delete('held/:id')
  async take(@Me() me: Actor, @Param('id') id: string) {
    const bill = await this.prisma.heldBill.findFirst({ where: { id, tenantId: me.tenantId, branchId: me.branchId } });
    const gone = await this.prisma.heldBill.deleteMany({ where: { id, tenantId: me.tenantId, branchId: me.branchId } });
    if (!bill || gone.count !== 1) fail('NOT_FOUND', 'This held bill was already taken at another till.', 404);
    return bill;
  }
}

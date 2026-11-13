import { Prisma, PrismaClient } from '@prisma/client';
import { Actor } from './auth.guard';

type Db = PrismaClient | Prisma.TransactionClient;

/** One line in the owner's activity record. */
export function audit(db: Db, me: Actor, action: string, detail: string) {
  return db.auditLog.create({ data: { tenantId: me.tenantId, branchId: me.branchId, userId: me.id, userName: me.name, action, detail: detail.slice(0, 500) } });
}

/** The drawer sitting that is open on a till right now, if any. */
export function openShift(db: Db, tenantId: string, tillId: string) {
  return db.shift.findFirst({ where: { tenantId, tillId, closedAt: null }, orderBy: { openedAt: 'desc' } });
}

/** Changes what a customer owes and writes the khata line. `amount` > 0 = owes more. */
export async function khata(
  db: Db,
  me: Actor,
  customerId: string,
  entry: { kind: Prisma.CustomerEntryCreateManyInput['kind']; amount: Prisma.Decimal; method?: Prisma.CustomerEntryCreateManyInput['method']; saleId?: string; shiftId?: string | null; note?: string | null },
) {
  const customer = await db.customer.update({ where: { id: customerId }, data: { balance: { increment: entry.amount } } });
  await db.customerEntry.create({
    data: {
      tenantId: me.tenantId,
      customerId,
      branchId: me.branchId,
      kind: entry.kind,
      amount: entry.amount,
      balanceAfter: customer.balance,
      method: entry.method ?? null,
      saleId: entry.saleId ?? null,
      shiftId: entry.shiftId ?? null,
      note: entry.note ?? null,
      userId: me.id,
    },
  });
  return customer;
}

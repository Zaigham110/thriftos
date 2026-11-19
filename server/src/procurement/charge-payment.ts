import { ConflictException } from '@nestjs/common';
import { PaymentMethod, Prisma } from '@prisma/client';
import { businessDay } from '../workspace/receivables.service';

type Db = Prisma.TransactionClient;
const dayDate = (day: string) => new Date(`${day}T00:00:00.000Z`);

export const CHARGE_DAY_CLOSED = { code: 'CASH_CLOSED', message: 'This charge was paid in cash on a day whose cash is closed. Reopen that day first.' };

/**
 * How a new charge was paid (owner, 2026-11-19): from the drawer or the bank today, so it leaves that book; or not
 * said (null), paid outside ThriftOS. Cash paid after today's cash was closed counts on tomorrow's cash, as cash
 * received after the close does.
 */
export async function chargePaid(tx: Db, tenantId: string, paidFrom: PaymentMethod | null | undefined, now = new Date()): Promise<{ paidFrom: PaymentMethod | null; paidOn: Date | null }> {
  if (!paidFrom) return { paidFrom: null, paidOn: null };
  const today = businessDay(now);
  if (paidFrom === PaymentMethod.CASH && (await tx.cashClose.findFirst({ where: { tenantId, day: dayDate(today) }, select: { id: true } }))) {
    return { paidFrom, paidOn: new Date(dayDate(today).getTime() + 86_400_000) };
  }
  return { paidFrom, paidOn: dayDate(today) };
}

/** A charge paid in cash on a closed day stays as it is: changing or removing it would change that day's cash. */
export async function assertChargeOpen(tx: Db, tenantId: string, charge: { paidFrom: PaymentMethod | null; paidOn: Date | null }): Promise<void> {
  if (charge.paidFrom !== PaymentMethod.CASH || !charge.paidOn) return;
  if (await tx.cashClose.findFirst({ where: { tenantId, day: charge.paidOn }, select: { id: true } })) throw new ConflictException(CHARGE_DAY_CLOSED);
}

import { BadRequestException, ConflictException } from '@nestjs/common';
import { PaymentMethod, Prisma, PrismaClient } from '@prisma/client';
import { businessDay } from '../workspace/receivables.service';

type Db = PrismaClient | Prisma.TransactionClient;
const ZERO = new Prisma.Decimal(0);

/**
 * Supplier khata (owner, 2026-11-13): what the business owes a supplier =
 * opening balance + the price of what was bought on the khata − payments made.
 * The price is the goods' price alone (a container's in home currency); transport, labour and other charges are
 * paid to other people. Lots and containers bought before the khata are not on it: they count as paid.
 * A negative figure means the supplier was paid ahead.
 */
export interface SupplierBalance {
  opening: Prisma.Decimal;
  bought: Prisma.Decimal;
  paid: Prisma.Decimal;
  owed: Prisma.Decimal;
}

export async function supplierBalances(prisma: Db, tenantId: string, vendorIds: string[]): Promise<Map<string, SupplierBalance>> {
  const out = new Map<string, SupplierBalance>();
  if (!vendorIds.length) return out;
  const among = { in: vendorIds };
  const [vendors, lots, containers, payments] = await Promise.all([
    prisma.vendor.findMany({ where: { tenantId, id: among }, select: { id: true, openingBalance: true } }),
    prisma.rag.groupBy({ by: ['vendorId'], where: { tenantId, vendorId: among, onKhata: true, containerId: null }, _sum: { purchaseCost: true } }),
    prisma.container.findMany({ where: { tenantId, vendorId: among, onKhata: true }, select: { vendorId: true, purchaseCost: true, fxRate: true } }),
    prisma.supplierPayment.groupBy({ by: ['vendorId'], where: { tenantId, vendorId: among, cancelledAt: null }, _sum: { amount: true } }),
  ]);
  for (const v of vendors) out.set(v.id, { opening: v.openingBalance, bought: ZERO, paid: ZERO, owed: ZERO });
  for (const l of lots) {
    const b = out.get(l.vendorId ?? '');
    if (b) b.bought = b.bought.add(l._sum.purchaseCost ?? ZERO);
  }
  for (const c of containers) {
    const b = out.get(c.vendorId ?? '');
    if (b) b.bought = b.bought.add(c.purchaseCost.mul(c.fxRate).toDecimalPlaces(2));
  }
  for (const p of payments) {
    const b = out.get(p.vendorId);
    if (b) b.paid = p._sum.amount ?? ZERO;
  }
  for (const b of out.values()) b.owed = b.opening.add(b.bought).sub(b.paid);
  return out;
}

export const SUPPLIER_CASH_CLOSED = { code: 'CASH_CLOSED', message: "That day's cash is already closed. Pick another day, or a method other than cash." };
export const SUPPLIER_FUTURE_DAY = { code: 'FUTURE_DAY', message: 'A payment cannot be in the future' };

/** The business day as a date-only value (the `day` columns). */
const dayDate = (day: string) => new Date(`${day}T00:00:00.000Z`);

/**
 * Money paid to a supplier, inside the caller's transaction: out of the cash or bank book that day, off what is
 * owed, with an audit line. Cash cannot be paid on a day whose cash is already closed.
 */
export async function recordSupplierPayment(
  tx: Prisma.TransactionClient,
  p: { tenantId: string; vendorId: string; amount: Prisma.Decimal.Value; method?: PaymentMethod; day?: string; note?: string | null; userId: string; now?: Date },
) {
  const today = businessDay(p.now ?? new Date());
  const day = p.day ? p.day.slice(0, 10) : today;
  if (day > today) throw new BadRequestException(SUPPLIER_FUTURE_DAY);
  const method = p.method ?? PaymentMethod.CASH;
  const amount = new Prisma.Decimal(p.amount);
  if (!amount.greaterThan(0)) throw new BadRequestException('Enter the amount paid');
  if (method === PaymentMethod.CASH && (await tx.cashClose.findFirst({ where: { tenantId: p.tenantId, day: dayDate(day) }, select: { id: true } }))) {
    throw new ConflictException(SUPPLIER_CASH_CLOSED);
  }
  const vendor = await tx.vendor.findFirst({ where: { id: p.vendorId, tenantId: p.tenantId }, select: { id: true } });
  if (!vendor) throw new BadRequestException('Supplier not found');
  const row = await tx.supplierPayment.create({
    data: { tenantId: p.tenantId, vendorId: vendor.id, day: dayDate(day), amount, method, note: p.note?.trim() || null, createdBy: p.userId },
  });
  await tx.auditLog.create({
    data: { tenantId: p.tenantId, userId: p.userId, action: 'SUPPLIER_PAID', entityType: 'Vendor', entityId: vendor.id, metadataJson: { paymentId: row.id, amount: amount.toString(), method, day } },
  });
  return { ...row, day };
}

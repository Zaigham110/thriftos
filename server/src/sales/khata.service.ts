import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentMethod, Prisma, SaleStatus } from '@prisma/client';
import { BUSINESS_UTC_OFFSET_MINUTES } from '../common/list/list-engine';
import { IdempotencyService } from '../common/idempotency/idempotency.service';
import { FileStorageService } from '../common/storage/file-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { applyPayments, overdueDays } from './khata';
import { language, reminderMessage, whatsappLink } from './whatsapp';

type Tx = Prisma.TransactionClient;

/** Sales that count in the khata (drafts and cancelled sales do not). */
export const KHATA_SALE_STATUSES: SaleStatus[] = [SaleStatus.ISSUED, SaleStatus.PARTIALLY_PAID, SaleStatus.PAID];

export interface UploadedPhoto {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

const PHOTO_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

/** Applies one customer's payments: those made with a sale pay it, the rest pay the oldest debt (./khata.ts). */
export function applyFor<S extends { id: string; totalAmount: Prisma.Decimal; issuedAt: Date | null; createdAt: Date }>(
  openingBalance: Prisma.Decimal,
  sales: S[],
  payments: { saleId: string | null; amount: Prisma.Decimal }[],
) {
  const saleIds = new Set(sales.map((s) => s.id));
  const paidWith = new Map<string, Prisma.Decimal>();
  let onAccount = new Prisma.Decimal(0);
  for (const p of payments) {
    if (p.saleId && saleIds.has(p.saleId)) paidWith.set(p.saleId, (paidWith.get(p.saleId) ?? new Prisma.Decimal(0)).add(p.amount));
    else onAccount = onAccount.add(p.amount);
  }
  return applyPayments({
    openingBalance,
    onAccount,
    sales: sales.map((s) => ({ key: s, at: s.issuedAt ?? s.createdAt, total: s.totalAmount, paidWithSale: paidWith.get(s.id) ?? 0 })),
  });
}

/**
 * Customer accounts (udhaar). Balances are always computed from opening balance, sales and
 * payments (./khata.ts); only each sale's PAID / PARTIALLY_PAID status is stored, refreshed in
 * the same transaction as any sale, payment or opening-balance change.
 */
@Injectable()
export class KhataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
    private readonly files: FileStorageService,
  ) {}

  /** Locks the customer row so concurrent sales/payments for one customer apply in order. */
  async lockCustomer(tx: Tx, tenantId: string, customerId: string) {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Customer" WHERE id = ${customerId} AND "tenantId" = ${tenantId} FOR UPDATE`;
    if (!rows.length) throw new NotFoundException('Customer not found');
  }

  /** Re-applies the customer's payments and stores each sale's status. Returns the applied account. */
  async refreshStatusesTx(tx: Tx, tenantId: string, customerId: string) {
    const account = await this.accountTx(tx, tenantId, customerId);
    const changed: { saleNumber: string; from: SaleStatus; to: SaleStatus }[] = [];
    for (const sale of account.applied.sales) {
      if (sale.status !== sale.key.status) {
        await tx.sale.update({ where: { id: sale.key.id }, data: { status: sale.status } });
        changed.push({ saleNumber: sale.key.saleNumber, from: sale.key.status, to: sale.status });
      }
    }
    return { ...account, changed };
  }

  /** Opening balance, sales and payments of one customer, with payments applied. */
  async accountTx(db: Tx | PrismaService, tenantId: string, customerId: string) {
    const customer = await db.customer.findFirst({ where: { id: customerId, tenantId } });
    if (!customer) throw new NotFoundException('Customer not found');
    const [sales, payments] = await Promise.all([
      db.sale.findMany({
        where: { tenantId, customerId, status: { in: KHATA_SALE_STATUSES } },
        orderBy: [{ issuedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true, saleNumber: true, status: true, totalAmount: true, issuedAt: true, createdAt: true },
      }),
      db.payment.findMany({
        where: { tenantId, customerId },
        orderBy: [{ receivedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      }),
    ]);
    return { customer, sales, payments, applied: applyFor(customer.openingBalance, sales, payments) };
  }

  /** Khata list: every customer with what they owe and for how long, biggest balance first. */
  async list(tenantId: string, search?: string) {
    const q = search?.trim().toLowerCase();
    const [customers, sales, payments] = await Promise.all([
      this.prisma.customer.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
      this.prisma.sale.findMany({
        where: { tenantId, status: { in: KHATA_SALE_STATUSES } },
        orderBy: [{ issuedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true, customerId: true, totalAmount: true, issuedAt: true, createdAt: true },
      }),
      this.prisma.payment.findMany({ where: { tenantId }, select: { customerId: true, saleId: true, amount: true } }),
    ]);
    const now = new Date();
    const rows = customers
      .filter((c) => !q || c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q) || (c.city ?? '').toLowerCase().includes(q))
      .map((customer) => {
        const applied = applyFor(
          customer.openingBalance,
          sales.filter((x) => x.customerId === customer.id),
          payments.filter((p) => p.customerId === customer.id),
        );
        return {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          city: customer.city,
          isActive: customer.isActive,
          balance: applied.balance,
          overdueDays: overdueDays(applied, customer.createdAt, now),
        };
      })
      .sort((x, y) => y.balance.comparedTo(x.balance) || x.name.localeCompare(y.name));
    const owed = rows.reduce((total, r) => (r.balance.greaterThan(0) ? total.add(r.balance) : total), new Prisma.Decimal(0));
    return { totalOwed: owed, customers: rows };
  }

  /**
   * One customer's ledger: opening balance, sales and payments in date order with the running
   * balance after each, and what each sale still has due. All computed, nothing stored.
   */
  async ledger(tenantId: string, customerId: string) {
    const { customer, sales, payments, applied } = await this.accountTx(this.prisma, tenantId, customerId);
    type Line = { at: Date; kind: 'OPENING' | 'SALE' | 'PAYMENT'; id: string | null; ref: string | null; debit: Prisma.Decimal; credit: Prisma.Decimal };
    const zero = new Prisma.Decimal(0);
    const lines: Line[] = [
      ...sales.map((x) => ({ at: x.issuedAt ?? x.createdAt, kind: 'SALE' as const, id: x.id, ref: x.saleNumber, debit: x.totalAmount, credit: zero })),
      ...payments.map((p) => ({ at: p.receivedAt, kind: 'PAYMENT' as const, id: p.id, ref: p.method, debit: zero, credit: p.amount })),
    ].sort((x, y) => x.at.getTime() - y.at.getTime() || (x.kind === 'SALE' ? -1 : 1));
    if (!customer.openingBalance.isZero()) {
      lines.unshift({
        at: customer.createdAt,
        kind: 'OPENING',
        id: null,
        ref: null,
        debit: customer.openingBalance.isPositive() ? customer.openingBalance : zero,
        credit: customer.openingBalance.isNegative() ? customer.openingBalance.neg() : zero,
      });
    }
    let running = zero;
    const bySale = new Map(applied.sales.map((x) => [x.key.id, x]));
    const byPayment = new Map(payments.map((p) => [p.id, p]));
    return {
      customer,
      balance: applied.balance,
      advance: applied.advance,
      openingDue: applied.openingDue,
      overdueDays: overdueDays(applied, customer.createdAt, new Date()),
      lines: lines.map((line) => {
        running = running.add(line.debit).sub(line.credit);
        const sale = line.kind === 'SALE' ? bySale.get(line.id!)! : null;
        const payment = line.kind === 'PAYMENT' ? byPayment.get(line.id!)! : null;
        return {
          ...line,
          balance: running,
          ...(sale ? { status: sale.status, paid: sale.paid, due: sale.due } : {}),
          ...(payment ? { saleId: payment.saleId, reference: payment.reference, hasPhoto: !!payment.attachmentUrl } : {}),
        };
      }),
    };
  }

  /** "Remind": a wa.me link with the balance, in Urdu or English. */
  async reminder(tenantId: string, customerId: string, lang?: string) {
    const [{ customer, applied }, tenant] = await Promise.all([
      this.accountTx(this.prisma, tenantId, customerId),
      this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true, defaultLanguage: true } }),
    ]);
    const text = reminderMessage(language(lang, tenant.defaultLanguage), { business: tenant.name, customer: customer.name, balance: applied.balance });
    return { balance: applied.balance, phone: customer.phone, text, url: whatsappLink(customer.phone, text) };
  }

  /** "Payment received". Safe to repeat with the same Idempotency-Key. */
  async recordPayment(tenantId: string, dto: CreatePaymentDto, userId: string, idempotencyKey?: string) {
    return this.idempotency.run(tenantId, 'payment.create', idempotencyKey, async (tx) => {
      await this.lockCustomer(tx, tenantId, dto.customerId);
      if (dto.saleId) {
        const sale = await tx.sale.findFirst({ where: { id: dto.saleId, tenantId, customerId: dto.customerId }, select: { status: true } });
        if (!sale) throw new BadRequestException('Sale not found for this customer');
        if (!KHATA_SALE_STATUSES.includes(sale.status)) throw new ConflictException('This sale cannot take payments');
      }
      // v2 review (Cash close): cash dated onto an earlier day that is already closed would change a counted drawer.
      // Cash received today after the close is fine: it counts in tomorrow's drawer.
      if ((dto.method ?? PaymentMethod.CASH) === PaymentMethod.CASH && dto.receivedAt) {
        const day = new Date(new Date(dto.receivedAt).getTime() + BUSINESS_UTC_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
        const today = new Date(Date.now() + BUSINESS_UTC_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
        if (day < today && (await tx.cashClose.findFirst({ where: { tenantId, day: new Date(day + 'T00:00:00Z') }, select: { id: true } }))) {
          throw new ConflictException({ code: 'CASH_CLOSED', message: "That day's cash is already closed. Pick another day, or a method other than cash." });
        }
      }
      const payment = await tx.payment.create({
        data: {
          tenantId,
          customerId: dto.customerId,
          saleId: dto.saleId ?? null,
          amount: new Prisma.Decimal(dto.amount),
          method: dto.method,
          reference: dto.reference?.trim() || null,
          receivedBy: userId,
          receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : undefined,
        },
      });
      const { applied } = await this.refreshStatusesTx(tx, tenantId, dto.customerId);
      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'PAYMENT_RECEIVED',
          entityType: 'Payment',
          entityId: payment.id,
          metadataJson: { customerId: dto.customerId, saleId: dto.saleId ?? null, amount: payment.amount.toFixed(2), method: payment.method },
        },
      });
      return { payment: this.publicPayment(payment), balance: applied.balance, advance: applied.advance };
    });
  }

  /** Everything a printed payment receipt needs (v2 6.3): amount, method, who received it and the balance now. */
  async printReceipt(tenantId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, tenantId },
      include: { tenant: { select: { name: true } }, customer: { select: { id: true, name: true } }, sale: { select: { saleNumber: true } } },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    const [{ applied }, receiver] = await Promise.all([
      this.accountTx(this.prisma, tenantId, payment.customerId),
      payment.receivedBy ? this.prisma.user.findFirst({ where: { id: payment.receivedBy, tenantId }, select: { name: true } }) : null,
    ]);
    return {
      business: payment.tenant.name,
      receiptNo: `R-${payment.id.slice(-6).toUpperCase()}`,
      date: payment.receivedAt,
      customer: payment.customer.name,
      amount: payment.amount,
      method: payment.method,
      reference: payment.reference,
      saleNumber: payment.sale?.saleNumber ?? null,
      receivedBy: receiver?.name ?? null,
      balance: applied.balance,
      advance: applied.advance,
    };
  }

  /** Attaches a receipt screenshot (JPEG/PNG/WebP/PDF, up to 5 MB) to a payment. */
  async attachPhoto(tenantId: string, paymentId: string, file: UploadedPhoto | undefined, userId: string) {
    if (!file) throw new BadRequestException('Choose a photo');
    const ext = PHOTO_TYPES[file.mimetype];
    if (!ext) throw new BadRequestException('Photo must be JPEG, PNG, WebP or PDF');
    if (file.size > PHOTO_MAX_BYTES) throw new BadRequestException('Photo must be 5 MB or less');
    const payment = await this.prisma.payment.findFirst({ where: { id: paymentId, tenantId }, select: { id: true } });
    if (!payment) throw new NotFoundException('Payment not found');
    const key = await this.files.save(`payments/${tenantId}/${payment.id}.${ext}`, file.buffer);
    const updated = await this.prisma.payment.update({ where: { id: payment.id }, data: { attachmentUrl: key } });
    await this.prisma.auditLog.create({
      data: { tenantId, userId, action: 'PAYMENT_PHOTO_ADDED', entityType: 'Payment', entityId: payment.id },
    });
    return this.publicPayment(updated);
  }

  async photo(tenantId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({ where: { id: paymentId, tenantId }, select: { attachmentUrl: true } });
    if (!payment?.attachmentUrl) throw new NotFoundException('No photo for this payment');
    const ext = payment.attachmentUrl.split('.').pop()!;
    const type = Object.keys(PHOTO_TYPES).find((t) => PHOTO_TYPES[t] === ext)!;
    return { data: await this.files.read(payment.attachmentUrl), type };
  }

  /** The storage key is internal; clients only need to know there is a photo. */
  publicPayment<P extends { attachmentUrl: string | null }>(payment: P) {
    const { attachmentUrl, ...rest } = payment;
    return { ...rest, hasPhoto: !!attachmentUrl };
  }
}

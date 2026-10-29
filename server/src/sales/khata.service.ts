import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SaleStatus } from '@prisma/client';
import { IdempotencyService } from '../common/idempotency/idempotency.service';
import { FileStorageService } from '../common/storage/file-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { applyPayments } from './khata';

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
    for (const sale of account.applied.sales) {
      if (sale.status !== sale.key.status) {
        await tx.sale.update({ where: { id: sale.key.id }, data: { status: sale.status } });
      }
    }
    return account;
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
    const saleIds = new Set(sales.map((s) => s.id));
    const paidWith = new Map<string, Prisma.Decimal>();
    let onAccount = new Prisma.Decimal(0);
    for (const p of payments) {
      if (p.saleId && saleIds.has(p.saleId)) paidWith.set(p.saleId, (paidWith.get(p.saleId) ?? new Prisma.Decimal(0)).add(p.amount));
      else onAccount = onAccount.add(p.amount);
    }
    const applied = applyPayments({
      openingBalance: customer.openingBalance,
      onAccount,
      sales: sales.map((s) => ({ key: s, at: s.issuedAt ?? s.createdAt, total: s.totalAmount, paidWithSale: paidWith.get(s.id) ?? 0 })),
    });
    return { customer, sales, payments, applied };
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

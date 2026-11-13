import { Workbook } from 'exceljs';
import { businessContact } from '../tenant/business';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { tracePayments } from './khata';
import { InventoryStatus, MovementType, PaymentMode, Prisma, SaleStatus, SaleType, SequenceScope } from '@prisma/client';
import { randomBytes } from 'crypto';
import { IdempotencyService } from '../common/idempotency/idempotency.service';
import { money, saleProfit, sum, takeCost } from '../costing/costing';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { TenantSequenceService } from '../procurement/shared/tenant-sequence.service';
import { DirectStockService } from '../stock/direct-stock.service';
import { priceListPrice } from '../workspace/price-lists.service';
import { CreateSaleDto, LastPriceQueryDto, SetShipmentDto } from './dto';
import { KHATA_SALE_STATUSES, KhataService } from './khata.service';
import { SaleLineError, saleTake } from './sale-lines';
import { billMessage, language, whatsappLink } from './whatsapp';
import { itemName } from '../stock/stock.lists';

type Tx = Prisma.TransactionClient;

const itemSummary = {
  select: {
    id: true,
    name: true,
    unit: true,
    priceTier: true,
    weightKg: true,
    category: { select: { id: true, name: true } },
    grade: { select: { id: true, name: true } },
    repackUnit: { select: { unitCode: true, qrLabel: { select: { qrCode: true } } } },
  },
} satisfies Prisma.InventoryItemDefaultArgs;

/** What the bill calls an item: its name, else category + grade, plus the bale code. */
/** The shipment fields of an export sale, trimmed (empty = none). */
export function shipmentData(s: { destinationCountry?: string | null; portOfLoading?: string | null; portOfDischarge?: string | null; vesselName?: string | null; billOfLadingNumber?: string | null; containerSealNumber?: string | null; freightForwarder?: string | null }) {
  const v = (x?: string | null) => (x === undefined ? undefined : x?.trim() || null);
  return {
    destinationCountry: v(s.destinationCountry), portOfLoading: v(s.portOfLoading), portOfDischarge: v(s.portOfDischarge), vesselName: v(s.vesselName),
    billOfLadingNumber: v(s.billOfLadingNumber), containerSealNumber: v(s.containerSealNumber), freightForwarder: v(s.freightForwarder),
  };
}

export function describeItem(item: {
  name: string | null;
  priceTier?: string | null;
  category: { name: string } | null;
  grade: { name: string } | null;
  repackUnit: { unitCode: string } | null;
}): string {
  const kind = item.name || [item.category?.name, item.grade?.name].filter(Boolean).join(' ') || 'Stock';
  const tier = item.priceTier ? ` (${item.priceTier})` : '';
  return item.repackUnit ? `${kind}${tier} · ${item.repackUnit.unitCode}` : `${kind}${tier}`;
}

/**
 * Sales (journey 4): one request saves the whole sale: lines priced per kg, bale or piece, stock
 * used at its exact cost (cumulative share), the payment taken now, and the customer's khata.
 */
const billInclude = {
  tenant: { select: { name: true, phone: true, address: true, city: true } },
  customer: { select: { name: true } },
  lines: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], include: { inventoryItem: itemSummary } },
} satisfies Prisma.SaleInclude;

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: TenantSequenceService,
    private readonly idempotency: IdempotencyService,
    private readonly khata: KhataService,
    private readonly stock: DirectStockService,
  ) {}

  /** Safe to repeat with the same Idempotency-Key: one sale, same response. */
  async create(tenantId: string, dto: CreateSaleDto, userId: string, idempotencyKey?: string) {
    const ids = dto.lines.map((l) => l.inventoryItemId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Each stock item can be on a sale only once');

    return this.idempotency.run(tenantId, 'sale.create', idempotencyKey, async (tx) => {
      await this.khata.lockCustomer(tx, tenantId, dto.customerId);
      const [customer, tenant] = await Promise.all([
        tx.customer.findUniqueOrThrow({ where: { id: dto.customerId }, select: { isActive: true } }),
        tx.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { currency: true, enabledModules: true } }),
      ]);
      if (!customer.isActive) throw new BadRequestException('This customer is inactive');
      const type = dto.type ?? SaleType.LOCAL;
      if (type === SaleType.EXPORT && !tenant.enabledModules.includes('EXPORT')) {
        // Same answer as a route of a module that is off (ModuleGuard).
        throw new ForbiddenException({ statusCode: 403, error: 'Forbidden', code: 'MODULE_DISABLED', module: 'EXPORT', message: 'EXPORT is not turned on for this business' });
      }
      if (dto.paymentMode !== PaymentMode.CASH && !tenant.enabledModules.includes('KHATA')) {
        // Selling on credit (all or part) is khata.
        throw new ForbiddenException({ statusCode: 403, error: 'Forbidden', code: 'MODULE_DISABLED', module: 'KHATA', message: 'KHATA is not turned on for this business' });
      }

      const sale = await tx.sale.create({
        data: {
          tenantId,
          saleNumber: await this.nextSaleNumber(tx, tenantId),
          customerId: dto.customerId,
          type,
          paymentMode: dto.paymentMode,
          status: SaleStatus.ISSUED,
          issuedAt: new Date(),
          currencyCode: tenant.currency,
          billToken: randomBytes(24).toString('base64url'),
          createdBy: userId,
          ...(type === SaleType.EXPORT && dto.shipment ? shipmentData(dto.shipment) : {}),
        },
      });

      const lines = [];
      for (const line of dto.lines) {
        const item = await tx.inventoryItem.findFirst({ where: { id: line.inventoryItemId, tenantId } });
        if (!item) throw new BadRequestException('Stock item not found');
        if (item.status !== InventoryStatus.AVAILABLE) throw new ConflictException('This stock is already sold');
        let take: ReturnType<typeof saleTake>;
        try {
          take = saleTake(item, line);
        } catch (e) {
          if (e instanceof SaleLineError) throw e.kind === 'short' ? new ConflictException(e.message) : new BadRequestException(e.message);
          throw e;
        }
        const lineCost = takeCost({ cost: item.totalCost, kg: item.quantity }, item.usedQuantity, take.use);
        const lineTotal = money(new Prisma.Decimal(line.quantity).mul(line.unitPrice));
        await this.stock.use(tx, item, take.use);
        await tx.stockMovement.create({
          data: {
            inventoryItemId: item.id,
            movementType: type === SaleType.EXPORT ? MovementType.EXPORT : MovementType.SALE,
            quantityKg: take.kg,
            quantityPcs: take.pieces,
            referenceId: sale.id,
            metadataJson: { saleNumber: sale.saleNumber, used: take.use.toString(), unit: item.unit },
          },
        });
        lines.push({
          saleId: sale.id,
          inventoryItemId: item.id,
          unit: take.unit,
          quantity: new Prisma.Decimal(line.quantity),
          unitPrice: new Prisma.Decimal(line.unitPrice),
          lineTotal,
          lineCost,
          profit: saleProfit(lineTotal, lineCost),
        });
      }
      await tx.saleLine.createMany({ data: lines });

      const totalAmount = money(sum(lines.map((l) => l.lineTotal)));
      const totalCost = money(sum(lines.map((l) => l.lineCost)));
      await tx.sale.update({
        where: { id: sale.id },
        data: { totalAmount, totalCost, totalProfit: saleProfit(totalAmount, totalCost) },
      });

      const paid = this.paidNow(dto, totalAmount);
      if (paid.greaterThan(0)) {
        await tx.payment.create({
          data: {
            tenantId,
            customerId: dto.customerId,
            saleId: sale.id,
            amount: paid,
            method: dto.paymentMethod,
            reference: dto.paymentReference?.trim() || null,
            receivedBy: userId,
          },
        });
      }
      await this.khata.refreshStatusesTx(tx, tenantId, dto.customerId);
      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'SALE_CREATED',
          entityType: 'Sale',
          entityId: sale.id,
          metadataJson: { saleNumber: sale.saleNumber, total: totalAmount.toFixed(2), paidNow: paid.toFixed(2), paymentMode: dto.paymentMode },
        },
      });
      return this.view(tx, tenantId, sale.id);
    });
  }

  /** The latest 200 sales, each with what is paid and still due. */
  async list(tenantId: string) {
    const sales = await this.prisma.sale.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { customer: { select: { id: true, name: true, phone: true, city: true } } },
    });
    const applied = new Map<string, { paid: Prisma.Decimal; due: Prisma.Decimal }>();
    for (const customerId of new Set(sales.map((s) => s.customerId))) {
      const account = await this.khata.accountTx(this.prisma, tenantId, customerId);
      for (const s of account.applied.sales) applied.set(s.key.id, s);
    }
    const zero = new Prisma.Decimal(0);
    return sales.map((s) => ({ ...s, paid: applied.get(s.id)?.paid ?? zero, due: applied.get(s.id)?.due ?? zero }));
  }

  async get(tenantId: string, id: string) {
    return this.view(this.prisma, tenantId, id);
  }

  /** Phase 9.2: change an export sale's shipment details (they are often known only after the sale). */
  async setShipment(tenantId: string, id: string, dto: SetShipmentDto, userId: string) {
    const { makeExport, ...shipment } = dto;
    const sale = await this.prisma.sale.findFirst({ where: { id, tenantId }, select: { id: true, type: true, status: true } });
    if (!sale) throw new NotFoundException('Sale not found');
    const toExport = sale.type !== SaleType.EXPORT && makeExport === true;
    if (sale.type !== SaleType.EXPORT && !toExport) throw new BadRequestException('Only an export sale has a shipment');
    if (toExport) {
      // A local sale made an export sale afterwards: only with Export sales on, never a cancelled sale.
      const t = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { enabledModules: true } });
      if (!t?.enabledModules.includes('EXPORT')) throw new ForbiddenException({ code: 'MODULE_DISABLED', message: 'Export sales are not on for this business' });
      if (sale.status === SaleStatus.CANCELLED) throw new BadRequestException('A cancelled sale cannot be made an export sale');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.sale.update({ where: { id }, data: { ...shipmentData(shipment), ...(toExport ? { type: SaleType.EXPORT } : {}) } });
      if (toExport) {
        // Its stock went out as an export, like a sale saved as export from the start.
        await tx.stockMovement.updateMany({ where: { referenceId: id, movementType: MovementType.SALE, inventoryItem: { tenantId } }, data: { movementType: MovementType.EXPORT } });
      }
      await tx.auditLog.create({ data: { tenantId, userId, action: toExport ? 'SALE_MADE_EXPORT' : 'SALE_SHIPMENT_SET', entityType: 'Sale', entityId: id, metadataJson: { ...shipment } } });
    });
    return this.view(this.prisma, tenantId, id);
  }

  /**
   * Phase 9.2: everything the export pack prints, from data ThriftOS already has: the seller and buyer, the
   * shipment, the packing list (each bale: code, item, kg, pieces), the commercial invoice lines, and each bale's
   * sorting record (where it came from — lot, container, supplier, origin — when it was sorted and graded, by whom).
   */
  async exportPack(tenantId: string, id: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, tenantId },
      include: {
        customer: { select: { name: true, phone: true, city: true } },
        tenant: { select: { name: true, phone: true, address: true, city: true, currency: true } },
        lines: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          include: {
            inventoryItem: {
              select: {
                id: true, name: true, unit: true, quantity: true, weightKg: true, pcsCount: true, createdAt: true,
                category: { select: { name: true } }, grade: { select: { name: true } },
                repackUnit: {
                  select: {
                    unitCode: true, createdAt: true, weightKg: true, pcsCount: true,
                    inputAllocations: {
                      select: {
                        amountUsed: true, measurementType: true,
                        categoryOutput: { select: { createdAt: true, category: { select: { name: true } }, grade: { select: { name: true } }, worker: { select: { name: true } }, rag: { select: { ragCode: true, originCountry: true, vendor: { select: { name: true } }, container: { select: { containerNumber: true, originCountry: true, vendor: { select: { name: true } } } } } } } },
                        gradingOutput: { select: { createdAt: true, grade: { select: { name: true } }, gradeBucket: { select: { gradeSession: { select: { endTime: true, categoryOutput: { select: { category: { select: { name: true } }, rag: { select: { ragCode: true, originCountry: true, vendor: { select: { name: true } }, container: { select: { containerNumber: true, originCountry: true, vendor: { select: { name: true } } } } } } } } } } } } } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!sale) throw new NotFoundException('Sale not found');
    if (sale.type !== SaleType.EXPORT) throw new BadRequestException('Only an export sale has an export pack');
    const name = (i: { name: string | null; category: { name: string } | null; grade: { name: string } | null }) => i.name ?? ([i.category?.name, i.grade?.name].filter(Boolean).join(' · ') || null);
    const packing = sale.lines.map((l) => {
      const i = l.inventoryItem;
      // The kg and pieces this line takes: whole bales by their weight and count, part of a bale by its share.
      const share = i.quantity.isZero() ? new Prisma.Decimal(0) : (l.unit === i.unit ? l.quantity : l.unit === 'KG' && i.weightKg ? l.quantity.div(i.weightKg).mul(i.quantity) : l.unit === 'PIECE' && i.pcsCount ? l.quantity.div(i.pcsCount).mul(i.quantity) : l.quantity).div(i.quantity);
      return {
        code: i.repackUnit?.unitCode ?? null,
        item: name(i),
        category: i.category?.name ?? null,
        grade: i.grade?.name ?? null,
        unit: l.unit,
        quantity: l.quantity,
        kg: l.unit === 'KG' ? l.quantity : i.weightKg ? i.weightKg.mul(share).toDecimalPlaces(2) : null,
        pieces: l.unit === 'PIECE' ? l.quantity.toNumber() : i.pcsCount ? Math.round(share.mul(i.pcsCount).toNumber()) : null,
        unitPrice: l.unitPrice,
        total: l.lineTotal,
      };
    });
    const records = sale.lines
      .filter((l) => l.inventoryItem.repackUnit)
      .map((l) => {
        const u = l.inventoryItem.repackUnit!;
        const from = u.inputAllocations.map((a) => {
          const co = a.categoryOutput;
          const go = a.gradingOutput;
          const rag = co?.rag ?? go?.gradeBucket.gradeSession.categoryOutput.rag ?? null;
          return {
            lot: rag?.ragCode ?? null,
            container: rag?.container?.containerNumber ?? null,
            supplier: rag?.container?.vendor?.name ?? rag?.vendor?.name ?? null,
            origin: rag?.container?.originCountry ?? rag?.originCountry ?? null,
            category: co?.category.name ?? go?.gradeBucket.gradeSession.categoryOutput.category.name ?? null,
            grade: co?.grade?.name ?? go?.grade.name ?? null,
            sortedAt: co?.createdAt ?? null,
            gradedAt: go?.gradeBucket.gradeSession.endTime ?? (co?.grade ? co.createdAt : null),
            sortedBy: co?.worker?.name ?? null,
            amount: a.amountUsed,
            measure: a.measurementType,
          };
        });
        return { code: u.unitCode, item: name(l.inventoryItem), madeAt: u.createdAt, kg: u.weightKg.isZero() ? null : u.weightKg, pieces: u.pcsCount || null, from };
      });
    const sum = (f: (r: (typeof packing)[number]) => Prisma.Decimal | number | null) => packing.reduce((t, r) => t.add(f(r) ?? 0), new Prisma.Decimal(0));
    return {
      sale: { id: sale.id, number: sale.saleNumber, date: sale.issuedAt ?? sale.createdAt, currency: sale.currencyCode, total: sale.totalAmount },
      seller: sale.tenant,
      buyer: sale.customer,
      shipment: shipmentData(sale),
      packing,
      totals: { lines: packing.length, bales: packing.filter((p) => p.unit === 'BALE').reduce((t, p) => t + Number(p.quantity), 0), kg: sum((r) => r.kg), pieces: sum((r) => r.pieces).toNumber(), amount: sale.totalAmount },
      records,
    };
  }

  /**
   * The packing list as the bale list sheet buyers upload (owner's sample, 2026-11-13): one sheet "Bale list",
   * one row a packed line, these eleven columns in this order. It goes to the buyer, so "Cost" is what the buyer
   * pays for that line, never what it cost us. Brand, Bale sale price, Piece price and Notes are the buyer's to fill.
   */
  async exportPackSheet(tenantId: string, id: string): Promise<{ file: string; body: Buffer }> {
    const pack = await this.exportPack(tenantId, id);
    const wb = new Workbook();
    wb.creator = 'ThriftOS';
    const ws = wb.addWorksheet('Bale list');
    const widths: Array<[string, number]> = [['Bale no', 14], ['Item', 14], ['Category', 14], ['Grade', 14], ['Brand', 14], ['Weight kg', 14], ['Pieces', 14], ['Cost', 14], ['Bale sale price', 19], ['Piece price', 15], ['Notes', 14]];
    ws.columns = widths.map(([header, width]) => ({ header, width }));
    ws.getRow(1).font = { bold: true };
    const n = (v: Prisma.Decimal | number | null) => (v === null ? null : Number(v.toString()));
    for (const r of pack.packing) ws.addRow([r.code, r.item, r.category, r.grade, null, n(r.kg), r.pieces, n(r.total), null, null, null]);
    return { file: `bale-list-${pack.sale.number}.xlsx`, body: Buffer.from(await wb.xlsx.writeBuffer()) };
  }

  /** Price to suggest: this customer's last price for the same kind of stock, else anyone's, else the item's sale price. */
  async lastPrice(tenantId: string, query: LastPriceQueryDto) {
    const item = await this.prisma.inventoryItem.findFirst({ where: { id: query.inventoryItemId, tenantId } });
    if (!item) throw new NotFoundException('Stock item not found');
    const customer = await this.prisma.customer.findFirst({ where: { id: query.customerId, tenantId }, select: { id: true, priceGroup: true } });
    if (!customer) throw new NotFoundException('Customer not found');
    const unit = query.unit ?? item.unit;
    // An agreed group price comes first (enterprise E3.4), then what this customer paid last.
    const listed = await priceListPrice(this.prisma, tenantId, customer.priceGroup, item, unit);
    if (listed) return { unit, unitPrice: listed.price, from: 'PRICE_LIST' as const, group: customer.priceGroup };
    const sameKind: Prisma.SaleLineWhereInput = {
      unit,
      sale: { tenantId, status: { in: KHATA_SALE_STATUSES } },
      inventoryItem: { categoryId: item.categoryId, gradeId: item.gradeId, name: item.name, priceTier: item.priceTier },
    };
    const last = (where: Prisma.SaleLineWhereInput) =>
      this.prisma.saleLine.findFirst({ where, orderBy: { createdAt: 'desc' }, select: { unitPrice: true } });

    const own = await last({ ...sameKind, sale: { ...(sameKind.sale as object), customerId: customer.id } });
    if (own) return { unit, unitPrice: own.unitPrice, from: 'CUSTOMER' as const };
    const any = await last(sameKind);
    if (any) return { unit, unitPrice: any.unitPrice, from: 'ANY_CUSTOMER' as const };
    if (item.salePrice && unit === item.unit) return { unit, unitPrice: item.salePrice, from: 'ITEM' as const };
    return { unit, unitPrice: null, from: null };
  }

  /** "Share bill on WhatsApp": a wa.me link with the bill summary and the public bill link. */
  async whatsapp(tenantId: string, id: string, lang?: string) {
    const [sale, tenant] = await Promise.all([
      this.view(this.prisma, tenantId, id),
      this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true, phone: true, address: true, city: true, defaultLanguage: true } }),
    ]);
    const billUrl = `${(process.env.PUBLIC_APP_URL || 'http://localhost:4200').replace(/\/$/, '')}/bill/${sale.billToken}`;
    const text = billMessage(language(lang, tenant.defaultLanguage), {
      business: tenant.name,
      contact: businessContact(tenant),
      customer: sale.customer.name,
      saleNumber: sale.saleNumber,
      total: sale.totalAmount,
      paid: sale.paid,
      due: sale.due,
      url: billUrl,
    });
    return { text, url: whatsappLink(sale.customer.phone, text), billUrl };
  }

  /**
   * The bill behind a shared link, for anyone holding the token (no login). Shows only what is
   * on the bill: business, number, date, customer name, lines, total, paid and due. No costs,
   * profit, phone numbers or ids.
   */
  async publicBill(token: string) {
    const sale = /^[A-Za-z0-9_-]{20,80}$/.test(token)
      ? await this.prisma.sale.findUnique({ where: { billToken: token }, include: billInclude })
      : null;
    if (!sale || !KHATA_SALE_STATUSES.includes(sale.status)) throw new NotFoundException('Bill not found');
    const { bill } = await this.billView(sale);
    return bill;
  }

  /** Everything a printed bill needs (v2 6.3): the public bill, the customer's balance now and the bill link for its QR. */
  async printBill(tenantId: string, id: string) {
    const sale = await this.prisma.sale.findFirst({ where: { id, tenantId }, include: billInclude });
    if (!sale || !KHATA_SALE_STATUSES.includes(sale.status)) throw new NotFoundException('Bill not found');
    const { bill, balance } = await this.billView(sale);
    const base = (process.env.PUBLIC_APP_URL || 'http://localhost:4200').replace(/\/$/, '');
    const billUrl = sale.billToken ? `${base}/bill/${sale.billToken}` : null;
    const billQrSvg = billUrl ? await QRCode.toString(billUrl, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }) : null;
    return { ...bill, customerBalance: balance, billUrl, billQrSvg };
  }

  private async billView(sale: Prisma.SaleGetPayload<{ include: typeof billInclude }>) {
    const { applied } = await this.khata.accountTx(this.prisma, sale.tenantId, sale.customerId);
    const own = applied.sales.find((x) => x.key.id === sale.id)!;
    const bill = {
      business: sale.tenant.name,
      businessContact: businessContact(sale.tenant),
      saleNumber: sale.saleNumber,
      date: sale.issuedAt ?? sale.createdAt,
      customer: sale.customer.name,
      currency: sale.currencyCode,
      lines: sale.lines.map((l) => ({
        description: describeItem(l.inventoryItem),
        unit: l.unit,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        lineTotal: l.lineTotal,
      })),
      total: sale.totalAmount,
      paid: own.paid,
      due: own.due,
      status: own.status,
    };
    return { bill, balance: applied.balance };
  }

  /** Records the physical handover, separately from payment. */
  async fulfill(tenantId: string, saleId: string, fulfillmentReference: string | undefined, userId: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, tenantId },
      select: { id: true, saleNumber: true, status: true, fulfillmentStatus: true },
    });
    if (!sale) throw new NotFoundException('Sale not found');
    if (!KHATA_SALE_STATUSES.includes(sale.status)) throw new ConflictException('This sale cannot be handed over');
    if (sale.fulfillmentStatus === 'FULFILLED') throw new ConflictException('This sale has already been handed over');
    const updated = await this.prisma.sale.update({
      where: { id: sale.id },
      data: { fulfillmentStatus: 'FULFILLED', fulfilledAt: new Date(), fulfillmentReference: fulfillmentReference?.trim() || null },
    });
    await this.prisma.auditLog.create({
      data: { tenantId, userId, action: 'SALE_FULFILLED', entityType: 'Sale', entityId: sale.id, metadataJson: { saleNumber: sale.saleNumber } },
    });
    return updated;
  }

  /** QR scan: the stock item behind a bale code, if it can still be sold. */
  async scan(tenantId: string, code: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: {
        tenantId,
        status: InventoryStatus.AVAILABLE,
        OR: [{ repackUnit: { unitCode: code } }, { repackUnit: { qrLabel: { qrCode: code } } }],
      },
      include: {
        category: { select: { id: true, name: true } },
        grade: { select: { id: true, name: true } },
        repackUnit: { select: { unitCode: true, qrLabel: { select: { qrCode: true } } } },
      },
    });
    if (!item) throw new NotFoundException('This code is not a bale in stock');
    return { ...item, remainingQuantity: item.quantity.sub(item.usedQuantity), description: describeItem(item) };
  }

  /** A sale with its lines, payments made with it, and what is still due (payments applied oldest first). */
  private async view(db: Tx | PrismaService, tenantId: string, id: string) {
    const sale = await db.sale.findFirst({
      where: { id, tenantId },
      include: {
        customer: { select: { id: true, name: true, phone: true, city: true } },
        lines: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], include: { inventoryItem: itemSummary } },
        payments: { orderBy: { receivedAt: 'asc' } },
      },
    });
    if (!sale) throw new NotFoundException('Sale not found');
    const { applied, customer, sales, payments } = await this.khata.accountTx(db, tenantId, sale.customerId);
    const own = applied.sales.find((s) => s.key.id === sale.id);
    // Every payment that paid this bill: made with it, or a later payment on the khata that cleared it (v2 review).
    const traced = tracePayments({
      openingBalance: customer.openingBalance,
      sales: sales.map((x) => ({ id: x.id, total: x.totalAmount })),
      payments: payments.map((p) => ({ ...p, at: p.receivedAt })),
    }).get(sale.id) ?? [];
    return {
      ...sale,
      payments: sale.payments.map((p) => this.khata.publicPayment(p)),
      paidBy: traced.map((t) => ({ ...this.khata.publicPayment(t.payment), applied: t.amount, withSale: t.withSale })),
      // `item` is the name as Inventory writes it ("Jeans · A") and `code` the bale's number, so the page can show
      // one row per kind; `description` stays as bills print it.
      lines: sale.lines.map((l) => ({ ...l, description: describeItem(l.inventoryItem), item: itemName(l.inventoryItem) ?? describeItem(l.inventoryItem), code: l.inventoryItem.repackUnit?.unitCode ?? null })),
      paid: own?.paid ?? new Prisma.Decimal(0),
      due: own?.due ?? new Prisma.Decimal(0),
      customerBalance: applied.balance,
    };
  }

  private paidNow(dto: CreateSaleDto, total: Prisma.Decimal): Prisma.Decimal {
    if (dto.paymentMode === PaymentMode.CASH) return total;
    if (dto.paymentMode === PaymentMode.CREDIT) {
      if (dto.paidAmount !== undefined) throw new BadRequestException('An udhaar sale takes no payment now');
      return new Prisma.Decimal(0);
    }
    const paid = money(dto.paidAmount ?? 0);
    if (paid.lte(0) || paid.gte(total)) throw new BadRequestException('Part paid: enter an amount more than 0 and less than the total');
    return paid;
  }

  private async nextSaleNumber(tx: Tx, tenantId: string): Promise<string> {
    for (;;) {
      const code = this.sequences.formatCode(await this.sequences.nextInTx(tx, tenantId, SequenceScope.SALE), { prefix: 'SAL', includeYear: true, padSize: 4 });
      if (!(await tx.sale.findFirst({ where: { tenantId, saleNumber: code }, select: { id: true } }))) return code;
    }
  }
}

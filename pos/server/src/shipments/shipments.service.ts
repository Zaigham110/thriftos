import { Injectable } from '@nestjs/common';
import { Actor } from '../common/auth.guard';
import { currencyCode } from '../common/currency';
import { kindCodes } from '../common/kinds';
import { PrismaService } from '../common/prisma.service';
import { amount, D, day, Dec, fail, optAmount, optDay, optText, pad, spread, text, wholeNumber, ZERO } from '../common/util';
import { BaleRow, MAX_BALES, readBaleFile } from './bale-file';

export interface Upload {
  buffer: Buffer;
  originalname: string;
}

const CHARGES = ['freight', 'customsDuty', 'clearing', 'transport', 'otherCharges'] as const;

interface Details {
  supplierName: string;
  originCountry: string | null;
  containerNo: string | null;
  billOfLadingNo: string | null;
  invoiceNo: string | null;
  vessel: string | null;
  portOfLoading: string | null;
  portOfArrival: string | null;
  shippedOn: Date | null;
  arrivedOn: Date;
  goodsCost: Dec; // in the list's currency
  /** The currency the list is in, when the owner chose one; otherwise what the file says, or the shop's own. */
  currency: string | null;
  /** One unit of the list's currency in the shop's currency. */
  rate: Dec | null;
  charges: Record<(typeof CHARGES)[number], Dec>;
  notes: string | null;
}

@Injectable()
export class ShipmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private details(body: Record<string, unknown>, forSave: boolean): Details {
    return {
      supplierName: forSave ? text(body.supplierName, 'Supplier') : String(body.supplierName ?? '').trim(),
      originCountry: optText(body.originCountry, 'Country'),
      containerNo: optText(body.containerNo, 'Container no', 40),
      billOfLadingNo: optText(body.billOfLadingNo, 'Bill of lading no', 40),
      invoiceNo: optText(body.invoiceNo, 'Invoice no', 40),
      vessel: optText(body.vessel, 'Vessel'),
      portOfLoading: optText(body.portOfLoading, 'Port of loading'),
      portOfArrival: optText(body.portOfArrival, 'Port of arrival'),
      shippedOn: optDay(body.shippedOn, 'Shipped on'),
      arrivedOn: body.arrivedOn || forSave ? day(body.arrivedOn, 'Arrived on') : new Date(),
      goodsCost: amount(body.goodsCost, 'Cost of goods'),
      currency: body.currency ? currencyCode(body.currency, 'The list currency') : null,
      rate: this.rate(body.rate),
      charges: {
        freight: amount(body.freight, 'Freight'),
        customsDuty: amount(body.customsDuty, 'Customs duty'),
        clearing: amount(body.clearing, 'Clearing'),
        transport: amount(body.transport, 'Transport'),
        otherCharges: amount(body.otherCharges, 'Other charges'),
      },
      notes: optText(body.notes, 'Notes', 500),
    };
  }

  private rate(value: unknown): Dec | null {
    if (value === undefined || value === null || String(value).trim() === '') return null;
    const cleaned = String(value).replace(/[^0-9.]/g, '');
    if (!/^\d+(\.\d+)?$/.test(cleaned) || new D(cleaned).lessThanOrEqualTo(0)) fail('BAD_RATE', 'The rate must be a number above zero.');
    return new D(cleaned).toDecimalPlaces(6);
  }

  /**
   * Works out each bale's cost. A bale's own cost comes from the file; when the file has no costs, the shipment's
   * "cost of goods" is shared instead. Charges (freight, duty, clearing, transport, other) are shared on top, by
   * weight when every bale has a weight, otherwise equally.
   */
  private async plan(details: Details, file: Upload | undefined, local: string) {
    if (!file?.buffer?.length) fail('NO_FILE', 'Choose the bale list file.');
    const { rows, ignoredHeaders, currency } = await readBaleFile(file.buffer, file.originalname);
    return this.planRows(details, rows, local, currency, ignoredHeaders);
  }

  /**
   * `local` is the shop's own currency. A list in another currency (chosen by the owner, or read from the file) has
   * its costs turned into the shop's currency at `details.rate`; each bale keeps the cost as it was on the list too.
   * Charges and selling prices are the shop's own and are never converted.
   */
  private planRows(details: Details, rows: BaleRow[], local: string, detected: string | null, ignoredHeaders: string[] = []) {
    const warnings: string[] = [];
    if (ignoredHeaders.length) warnings.push(`These columns were not read: ${ignoredHeaders.join(', ')}.`);

    const withCost = rows.filter((r) => r.cost !== null).length;
    const costsInFile = withCost > 0;
    if (costsInFile && withCost < rows.length) {
      rows.filter((r) => r.cost === null).forEach((r) => r.errors.push('Cost is missing. Give a cost for every bale, or for none.'));
    }
    if (costsInFile && details.goodsCost.greaterThan(0)) warnings.push('The list has a cost for each bale, so the cost of goods you typed is not used.');
    if (!costsInFile && details.goodsCost.isZero()) warnings.push('No cost was given, so these bales will show no profit. Add a Cost column or type the cost of goods.');

    const currency = details.currency ?? detected ?? local;
    const foreign = currency !== local;
    const rate = foreign ? details.rate : new D(1);
    const needsRate = foreign && !rate;
    if (needsRate) warnings.push(`The costs are in ${currency}. Give the ${currency} rate to turn them into ${local}.`);
    const toLocal = (value: Dec) => (rate ? value.times(rate).toDecimalPlaces(2, D.ROUND_HALF_UP) : value);

    const weights = rows.map((r) => r.weightKg);
    const byWeight = weights.every((w) => w !== null);
    const listed = costsInFile ? rows.map((r) => r.cost ?? ZERO) : spread(details.goodsCost, weights);
    const goods = listed.map(toLocal);
    const chargesTotal = CHARGES.reduce((sum, key) => sum.plus(details.charges[key]), ZERO);
    const shares = spread(chargesTotal, weights);
    const bales = rows.map((row, i) => ({ row, cost: goods[i], costForeign: foreign ? listed[i] : null, landedCost: goods[i].plus(shares[i]) }));

    const goodsCost = goods.reduce((a, b) => a.plus(b), ZERO);
    const bad = rows.filter((r) => r.errors.length).length;
    return {
      bales,
      warnings,
      currency: { list: currency, detected, local, foreign, rate, needsRate, goodsCostForeign: foreign ? listed.reduce((a, b) => a.plus(b), ZERO) : null },
      summary: {
        bales: rows.length,
        bad,
        weightKg: weights.reduce<Dec>((a, w) => a.plus(w ?? ZERO), ZERO),
        pieces: rows.reduce((a, r) => a + (r.pieces ?? 0), 0),
        goodsCost,
        charges: chargesTotal,
        landedCost: goodsCost.plus(chargesTotal),
        chargesSharedBy: byWeight ? 'weight' : 'bale',
      },
    };
  }

  private async local(tenantId: string): Promise<string> {
    return (await this.prisma.shop.findUniqueOrThrow({ where: { id: tenantId }, select: { currency: true } })).currency;
  }

  async preview(me: Actor, body: Record<string, unknown>, file: Upload | undefined) {
    const plan = await this.plan(this.details(body, false), file, await this.local(me.tenantId));
    return {
      fileName: file!.originalname,
      warnings: plan.warnings,
      currency: plan.currency,
      summary: plan.summary,
      rows: plan.bales.map(({ row, cost, costForeign, landedCost }) => ({ ...row, cost, costForeign, landedCost })),
    };
  }

  async create(me: Actor, body: Record<string, unknown>, file: Upload | undefined) {
    const details = this.details(body, true);
    const plan = await this.plan(details, file, await this.local(me.tenantId));
    if (plan.summary.bad > 0) fail('ROWS_WRONG', `${plan.summary.bad} rows need fixing in the file. Nothing was saved.`);
    return this.save(me, details, plan, file!.originalname.slice(0, 200), body);
  }

  /**
   * Stock typed by hand instead of read from a file: local purchases, opening stock, a few bales. Each row is one
   * kind of bale and how many of it; the rest (costs, charges, currency, shared codes) works as for a file.
   */
  async createManual(me: Actor, body: Record<string, unknown>) {
    const typed = Array.isArray(body.rows) ? (body.rows as Record<string, unknown>[]) : [];
    if (!typed.length) fail('NO_ROWS', 'Add at least one row.');
    const rows: BaleRow[] = [];
    const seen = new Set<string>();
    typed.forEach((r, i) => {
      const line = i + 1;
      const quantity = wholeNumber(r?.quantity ?? 1, `Row ${line}: how many`);
      const item = text(r.item, `Row ${line}: item`, 120);
      const baleNo = optText(r.baleNo, `Row ${line}: bale no`, 40);
      if (baleNo && quantity > 1) fail('BALE_NO_ONCE', `Row ${line}: a bale no belongs to one bale. Leave it empty when adding ${quantity}.`);
      if (baleNo && seen.has(baleNo.toLowerCase())) fail('BALE_NO_TWICE', `Bale no "${baleNo}" is typed twice.`);
      if (baleNo) seen.add(baleNo.toLowerCase());
      const weightKg = optAmount(r.weightKg, `Row ${line}: weight`);
      const pieces = r.pieces === undefined || r.pieces === null || String(r.pieces).trim() === '' ? null : wholeNumber(r.pieces, `Row ${line}: pieces`);
      const row: BaleRow = {
        line,
        baleNo,
        item,
        category: optText(r.category, `Row ${line}: category`, 60),
        grade: optText(r.grade, `Row ${line}: grade`, 30),
        brand: optText(r.brand, `Row ${line}: brand`, 60),
        weightKg: weightKg && weightKg.greaterThan(0) ? weightKg : null,
        pieces,
        cost: optAmount(r.cost, `Row ${line}: cost`),
        salePrice: optAmount(r.salePrice, `Row ${line}: bale price`),
        piecePrice: optAmount(r.piecePrice, `Row ${line}: piece price`),
        notes: optText(r.notes, `Row ${line}: notes`, 200),
        errors: [],
      };
      for (let n = 0; n < quantity; n++) rows.push({ ...row, errors: [] });
      if (rows.length > MAX_BALES) fail('TOO_MANY', `${MAX_BALES} bales at most at one time.`);
    });
    const details = this.details({ ...body, supplierName: optText(body.supplierName, 'Supplier') ?? 'Added by hand', arrivedOn: body.arrivedOn || new Date().toISOString().slice(0, 10) }, true);
    const plan = this.planRows(details, rows, await this.local(me.tenantId), null);
    const wrong = plan.bales.find((b) => b.row.errors.length);
    if (wrong) fail('ROWS_WRONG', `Row ${wrong.row.line}: ${wrong.row.errors[0]}`);
    return this.save(me, details, plan, null, body);
  }

  private async save(me: Actor, details: Details, plan: ReturnType<ShipmentsService['planRows']>, fileName: string | null, body: Record<string, unknown>) {
    const tenantId = me.tenantId;
    if (plan.currency.needsRate) fail('NEEDS_RATE', `The costs are in ${plan.currency.list}. Give the ${plan.currency.list} rate first.`);

    if (details.containerNo && body.allowSameContainer !== 'true' && body.allowSameContainer !== true) {
      const same = await this.prisma.shipment.findFirst({ where: { tenantId, containerNo: { equals: details.containerNo, mode: 'insensitive' } } });
      if (same) fail('SAME_CONTAINER', `Container ${details.containerNo} is already saved as shipment ${same.code}.`, 409);
    }

    return this.prisma.$transaction(
      async (tx) => {
        const supplier =
          (await tx.supplier.findFirst({ where: { tenantId, name: { equals: details.supplierName, mode: 'insensitive' } } })) ??
          (await tx.supplier.create({ data: { tenantId, name: details.supplierName, country: details.originCountry } }));
        const shop = await tx.shop.update({
          where: { id: tenantId },
          data: { shipmentSeq: { increment: 1 }, baleSeq: { increment: plan.bales.length } },
        });
        const firstBale = shop.baleSeq - plan.bales.length + 1;
        const shipment = await tx.shipment.create({
          data: {
            tenantId,
            branchId: me.branchId,
            code: `S-${pad(shop.shipmentSeq, 4)}`,
            supplierId: supplier.id,
            originCountry: details.originCountry,
            containerNo: details.containerNo,
            billOfLadingNo: details.billOfLadingNo,
            invoiceNo: details.invoiceNo,
            vessel: details.vessel,
            portOfLoading: details.portOfLoading,
            portOfArrival: details.portOfArrival,
            shippedOn: details.shippedOn,
            arrivedOn: details.arrivedOn,
            goodsCost: plan.summary.goodsCost,
            currency: plan.currency.foreign ? plan.currency.list : null,
            exchangeRate: plan.currency.foreign ? plan.currency.rate : null,
            goodsCostForeign: plan.currency.goodsCostForeign,
            manual: fileName === null,
            ...details.charges,
            landedCost: plan.summary.landedCost,
            baleCount: plan.bales.length,
            totalWeightKg: plan.summary.weightKg.isZero() ? null : plan.summary.weightKg,
            fileName,
            notes: details.notes,
            createdById: me.id,
          },
        });
        // Bales of the same kind share one code; each bale also keeps its own number.
        const kinds = await kindCodes(tx, tenantId, plan.bales.map(({ row }) => row));
        await tx.bale.createMany({
          data: plan.bales.map(({ row, cost, costForeign, landedCost }, i) => ({
            tenantId,
            branchId: me.branchId,
            shipmentId: shipment.id,
            code: `B-${pad(firstBale + i, 5)}`,
            kindCode: kinds[i],
            ...this.baleFields(row),
            cost,
            costForeign,
            landedCost,
          })),
        });
        return { id: shipment.id, code: shipment.code, bales: plan.bales.length };
      },
      { timeout: 30_000 },
    );
  }

  private baleFields(row: BaleRow) {
    const { baleNo, item, category, grade, brand, weightKg, pieces, salePrice, piecePrice, notes } = row;
    return { baleNo, item, category, grade, brand, weightKg, pieces, salePrice, piecePrice, notes };
  }

  async list(tenantId: string) {
    const shipments = await this.prisma.shipment.findMany({
      where: { tenantId },
      include: { supplier: { select: { name: true } } },
      orderBy: [{ arrivedOn: 'desc' }, { createdAt: 'desc' }],
    });
    const left = await this.prisma.bale.groupBy({
      by: ['shipmentId'],
      where: { tenantId, status: { in: ['IN_STOCK', 'OPENED'] } },
      _count: { _all: true },
    });
    const leftBy = new Map(left.map((g) => [g.shipmentId, g._count._all]));
    return shipments.map((s) => ({ ...s, balesLeft: leftBy.get(s.id) ?? 0 }));
  }

  async get(tenantId: string, id: string) {
    const shipment = await this.prisma.shipment.findFirst({ where: { id, tenantId }, include: { supplier: { select: { name: true } } } });
    if (!shipment) fail('NOT_FOUND', 'This shipment was not found.', 404);
    const bales = await this.prisma.bale.findMany({ where: { tenantId, shipmentId: id }, orderBy: { code: 'asc' } });
    // What this shipment has earned so far, from sales that were not cancelled.
    const sold = await this.prisma.saleLine.aggregate({
      where: { tenantId, bale: { shipmentId: id }, conflict: false, sale: { status: 'COMPLETED' } },
      _sum: { lineTotal: true, costTotal: true },
    });
    const sales = sold._sum.lineTotal ?? new D(0);
    return { ...shipment, bales, soldAmount: sales, soldCost: sold._sum.costTotal ?? new D(0) };
  }

  suppliers(tenantId: string) {
    return this.prisma.supplier.findMany({ where: { tenantId }, select: { id: true, name: true, country: true }, orderBy: { name: 'asc' } });
  }
}

import { Injectable } from '@nestjs/common';
import { Actor } from '../common/auth.guard';
import { PrismaService } from '../common/prisma.service';
import { amount, D, day, Dec, fail, optDay, optText, pad, spread, text, ZERO } from '../common/util';
import { BaleRow, readBaleFile } from './bale-file';

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
  goodsCost: Dec;
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

  /**
   * Works out each bale's cost. A bale's own cost comes from the file; when the file has no costs, the shipment's
   * "cost of goods" is shared instead. Charges (freight, duty, clearing, transport, other) are shared on top, by
   * weight when every bale has a weight, otherwise equally.
   */
  private async plan(details: Details, file: Upload | undefined) {
    if (!file?.buffer?.length) fail('NO_FILE', 'Choose the bale list file.');
    const { rows, ignoredHeaders } = await readBaleFile(file.buffer, file.originalname);
    const warnings: string[] = [];
    if (ignoredHeaders.length) warnings.push(`These columns were not read: ${ignoredHeaders.join(', ')}.`);

    const withCost = rows.filter((r) => r.cost !== null).length;
    const costsInFile = withCost > 0;
    if (costsInFile && withCost < rows.length) {
      rows.filter((r) => r.cost === null).forEach((r) => r.errors.push('Cost is missing. Give a cost for every bale, or for none.'));
    }
    if (costsInFile && details.goodsCost.greaterThan(0)) warnings.push('The file has a cost for each bale, so the cost of goods you typed is not used.');
    if (!costsInFile && details.goodsCost.isZero()) warnings.push('No cost was given, so these bales will show no profit. Add a Cost column or type the cost of goods.');

    const weights = rows.map((r) => r.weightKg);
    const byWeight = weights.every((w) => w !== null);
    const goods = costsInFile ? rows.map((r) => r.cost ?? ZERO) : spread(details.goodsCost, weights);
    const chargesTotal = CHARGES.reduce((sum, key) => sum.plus(details.charges[key]), ZERO);
    const shares = spread(chargesTotal, weights);
    const bales = rows.map((row, i) => ({ row, cost: goods[i], landedCost: goods[i].plus(shares[i]) }));

    const goodsCost = goods.reduce((a, b) => a.plus(b), ZERO);
    const bad = rows.filter((r) => r.errors.length).length;
    return {
      bales,
      warnings,
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

  async preview(body: Record<string, unknown>, file: Upload | undefined) {
    const plan = await this.plan(this.details(body, false), file);
    return {
      fileName: file!.originalname,
      warnings: plan.warnings,
      summary: plan.summary,
      rows: plan.bales.map(({ row, cost, landedCost }) => ({ ...row, cost, landedCost })),
    };
  }

  async create(me: Actor, body: Record<string, unknown>, file: Upload | undefined) {
    const details = this.details(body, true);
    const plan = await this.plan(details, file);
    if (plan.summary.bad > 0) fail('ROWS_WRONG', `${plan.summary.bad} rows need fixing in the file. Nothing was saved.`);
    const tenantId = me.tenantId;

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
            ...details.charges,
            landedCost: plan.summary.landedCost,
            baleCount: plan.bales.length,
            totalWeightKg: plan.summary.weightKg.isZero() ? null : plan.summary.weightKg,
            fileName: file!.originalname.slice(0, 200),
            notes: details.notes,
            createdById: me.id,
          },
        });
        await tx.bale.createMany({
          data: plan.bales.map(({ row, cost, landedCost }, i) => ({
            tenantId,
            branchId: me.branchId,
            shipmentId: shipment.id,
            code: `B-${pad(firstBale + i, 5)}`,
            ...this.baleFields(row),
            cost,
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

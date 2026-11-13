import { Injectable } from '@nestjs/common';
import { BaleStatus, KhataKind, LineKind, PayMethod, Prisma, RefundTo, SaleStatus, UserRole } from '@prisma/client';
import { audit, khata, openShift } from '../common/audit';
import { Actor, isManager } from '../common/auth.guard';
import { PrismaService } from '../common/prisma.service';
import { amount, D, Dec, fail, moment, optText, pad, range, text, wholeNumber, ZERO } from '../common/util';

interface LineInput {
  baleId: string | null;
  kind: LineKind;
  description: string | null;
  quantity: number;
  unitPrice: Dec;
  discount: Dec;
}
interface PayInput {
  method: PayMethod;
  amount: Dec;
  reference: string | null;
}

const SALE_FULL = {
  user: { select: { name: true } },
  customer: { select: { id: true, name: true, phone: true, balance: true } },
  payments: { select: { id: true, method: true, amount: true, reference: true }, orderBy: { id: 'asc' } },
  lines: { include: { bale: { select: { code: true, baleNo: true } } }, orderBy: { id: 'asc' } },
  returns: { include: { lines: true }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.SaleInclude;

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  private lines(raw: unknown): LineInput[] {
    if (!Array.isArray(raw) || raw.length === 0) fail('NO_LINES', 'Add at least one bale or piece to the bill.');
    if (raw.length > 200) fail('TOO_MANY', 'A bill can hold 200 lines at most.');
    const seen = new Set<string>();
    return raw.map((r: Record<string, unknown>) => {
      const kind = r?.kind === 'PIECE' ? LineKind.PIECE : r?.kind === 'BALE' ? LineKind.BALE : r?.kind === 'ITEM' ? LineKind.ITEM : fail('BAD_LINE', 'A line must be a bale, pieces or an item.');
      const baleId = kind === LineKind.ITEM ? null : String(r.baleId ?? '');
      if (kind !== LineKind.ITEM) {
        if (!baleId) fail('BAD_LINE', 'A line has no bale.');
        if (seen.has(baleId)) fail('BALE_TWICE', 'The same bale is on the bill twice. Change the number of pieces instead.');
        seen.add(baleId);
      }
      const quantity = kind === LineKind.BALE ? 1 : wholeNumber(r.quantity ?? 1, kind === LineKind.PIECE ? 'Pieces' : 'Quantity');
      const unitPrice = amount(r.unitPrice, 'Price');
      const discount = amount(r.discount, 'Line discount');
      if (discount.greaterThan(unitPrice.times(quantity))) fail('DISCOUNT_TOO_BIG', 'A line discount is more than the line.');
      return { baleId, kind, description: kind === LineKind.ITEM ? text(r.description, 'Item name', 80) : null, quantity, unitPrice, discount };
    });
  }

  private payments(raw: unknown): PayInput[] | null {
    if (raw === undefined || raw === null) return null;
    if (!Array.isArray(raw) || raw.length > 6) fail('BAD_PAYMENT', 'The payments are not right.');
    return raw
      .map((p: Record<string, unknown>) => ({
        method: String(p?.method) in PayMethod ? (String(p.method) as PayMethod) : fail('BAD_PAYMENT', 'A payment must be cash, bank or wallet.'),
        amount: amount(p.amount, 'Payment'),
        reference: optText(p.reference, 'Reference', 60),
      }))
      .filter((p) => p.amount.greaterThan(0));
  }

  /**
   * Saves a bill. A bill made while the till was offline (`offline: { code, soldAt }`) already happened: the customer
   * has left with the goods. So it is never refused for stock or limits; it is saved and marked for the owner to review.
   */
  async create(me: Actor, body: Record<string, unknown>) {
    const tenantId = me.tenantId;
    const offline = body.offline && typeof body.offline === 'object' ? (body.offline as Record<string, unknown>) : null;
    const lines = this.lines(body.lines);
    const billDiscount = amount(body.discount, 'Discount');
    const clientKey = optText(body.clientKey, 'Key', 80);

    // The same bill sent twice (double tap, slow network, an offline resend) is saved once.
    if (clientKey) {
      const before = await this.prisma.sale.findFirst({ where: { tenantId, clientKey } });
      if (before) return this.get(me, before.id);
    }

    const review: string[] = [];
    const refuse = (code: string, message: string, status = 400) => {
      if (!offline) fail(code, message, status);
      review.push(message);
    };

    const shop = await this.prisma.shop.findUniqueOrThrow({ where: { id: tenantId } });
    const till =
      (body.tillId ? await this.prisma.till.findFirst({ where: { id: String(body.tillId), tenantId, branchId: me.branchId } }) : null) ??
      (await this.prisma.till.findFirst({ where: { tenantId, branchId: me.branchId, active: true }, orderBy: { createdAt: 'asc' } }));
    if (!till) fail('NO_TILL', 'This branch has no till. Add one in Settings.', 409);

    const gross = lines.reduce((sum, l) => sum.plus(l.unitPrice.times(l.quantity)), ZERO);
    const subtotal = lines.reduce((sum, l) => sum.plus(l.unitPrice.times(l.quantity)).minus(l.discount), ZERO);
    if (billDiscount.greaterThan(subtotal)) fail('DISCOUNT_TOO_BIG', 'The discount is more than the bill.');
    const net = subtotal.minus(billDiscount);
    if (me.role === UserRole.CASHIER && gross.greaterThan(0)) {
      // A price typed below the bale's own price is a discount too, so it counts towards the cashier's limit.
      const listed = await this.prisma.bale.findMany({
        where: { tenantId, id: { in: lines.filter((l) => l.baleId).map((l) => l.baleId!) } },
        select: { id: true, salePrice: true, piecePrice: true },
      });
      const full = lines.reduce((sum, l) => {
        const bale = listed.find((b) => b.id === l.baleId);
        const list = (l.kind === LineKind.BALE ? bale?.salePrice : l.kind === LineKind.PIECE ? bale?.piecePrice : null) ?? l.unitPrice;
        return sum.plus((list.greaterThan(l.unitPrice) ? list : l.unitPrice).times(l.quantity));
      }, ZERO);
      const pct = full.minus(net).times(100).dividedBy(full);
      if (pct.greaterThan(shop.cashierMaxDiscountPct)) {
        refuse('DISCOUNT_LIMIT', `A cashier can give ${shop.cashierMaxDiscountPct}% discount at most. Ask a manager to make this bill.`, 403);
      }
    }

    // Tax: either already inside the prices, or added on top.
    const rate = shop.taxRate;
    const taxAmount = rate.isZero() ? ZERO : shop.taxInclusive ? net.minus(net.times(100).dividedBy(rate.plus(100))).toDecimalPlaces(2) : net.times(rate).dividedBy(100).toDecimalPlaces(2);
    const total = shop.taxInclusive ? net : net.plus(taxAmount);

    // Money taken now. Change comes out of cash only; what is not paid goes on the customer's khata.
    const customer = body.customerId ? await this.prisma.customer.findFirst({ where: { id: String(body.customerId), tenantId } }) : null;
    if (body.customerId && !customer) fail('NOT_FOUND', 'This customer was not found.', 404);
    const tenders = this.payments(body.payments) ?? [{ method: PayMethod.CASH, amount: total, reference: null }];
    const tendered = tenders.reduce((sum, p) => sum.plus(p.amount), ZERO);
    const cashTendered = tenders.filter((p) => p.method === PayMethod.CASH).reduce((sum, p) => sum.plus(p.amount), ZERO);
    const change = tendered.greaterThan(total) ? tendered.minus(total) : ZERO;
    if (change.greaterThan(cashTendered)) fail('OVERPAID', 'Bank and wallet payments together are more than the bill.');
    const paid = tendered.minus(change);
    const credit = total.minus(paid);
    if (credit.greaterThan(0)) {
      if (!customer) refuse('NEEDS_CUSTOMER', `Rs ${credit.toFixed(0)} is not paid. Choose a customer to put it on khata, or take the full amount.`);
      else if (customer.creditLimit && customer.balance.plus(credit).greaterThan(customer.creditLimit) && !isManager(me)) {
        refuse('OVER_LIMIT', `${customer.name} would owe Rs ${customer.balance.plus(credit).toFixed(0)}, over the limit of Rs ${customer.creditLimit.toFixed(0)}. Ask a manager.`, 403);
      }
    }

    const saleId = await this.prisma.$transaction(async (tx) => {
      const prepared: Prisma.SaleLineCreateManySaleInput[] = [];
      for (const line of lines) {
        const lineTotal = line.unitPrice.times(line.quantity).minus(line.discount);
        if (line.kind === LineKind.ITEM) {
          prepared.push({ tenantId, kind: line.kind, description: line.description!, quantity: line.quantity, unitPrice: line.unitPrice, discount: line.discount, lineTotal, unitCost: ZERO, costTotal: ZERO });
          continue;
        }
        const bale = await tx.bale.findFirst({ where: { id: line.baleId!, tenantId } });
        if (!bale) fail('NOT_FOUND', 'A bale on the bill was not found.', 404);
        let unitCost: Dec;
        let conflict = false;
        const wrong = (code: string, message: string) => {
          if (!offline) fail(code, message, 409);
          review.push(message);
          conflict = true;
        };
        if (bale.branchId !== me.branchId) wrong('OTHER_BRANCH', `Bale ${bale.code} is in another branch.`);
        if (line.kind === LineKind.BALE) {
          unitCost = bale.landedCost;
          if (!conflict) {
            // The status check is in the update itself, so two counters cannot sell one bale.
            const sold = await tx.bale.updateMany({ where: { id: bale.id, tenantId, status: BaleStatus.IN_STOCK }, data: { status: BaleStatus.SOLD, closedAt: new Date() } });
            if (sold.count !== 1) wrong('BALE_GONE', `Bale ${bale.code} is not in stock as a closed bale any more.`);
          }
        } else {
          const pieces = bale.pieces ?? 0;
          unitCost = bale.pieceCost ?? ZERO;
          if (!conflict) {
            const taken = await tx.bale.updateMany({
              where: { id: bale.id, tenantId, status: BaleStatus.OPENED, piecesSold: { lte: pieces - line.quantity } },
              data: { piecesSold: { increment: line.quantity } },
            });
            if (taken.count !== 1) {
              if (bale.status !== BaleStatus.OPENED) wrong('NOT_OPENED', `Open bale ${bale.code} first to sell pieces from it.`);
              else wrong('PIECES_SHORT', `Bale ${bale.code} has ${pieces - bale.piecesSold} pieces left. Enter ${pieces - bale.piecesSold} or less.`);
            } else {
              // The last piece is gone: the bale leaves the shelf.
              await tx.bale.updateMany({ where: { id: bale.id, tenantId, status: BaleStatus.OPENED, piecesSold: pieces }, data: { status: BaleStatus.FINISHED, closedAt: new Date() } });
            }
          }
        }
        prepared.push({
          tenantId,
          baleId: bale.id,
          kind: line.kind,
          description: [bale.item, bale.grade].filter(Boolean).join(' · '),
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discount: line.discount,
          lineTotal,
          unitCost,
          costTotal: unitCost.times(line.quantity).toDecimalPlaces(2),
          conflict,
        });
      }

      // The bill number. Online the server gives the till's next number; an offline bill keeps the number it printed.
      let code = '';
      const wanted = offline ? optText(offline.code, 'Bill number', 30) : null;
      if (wanted && !(await tx.sale.findFirst({ where: { tenantId, code: wanted } }))) {
        code = wanted;
        const n = Number(wanted.split('-').pop());
        if (Number.isInteger(n)) await tx.till.updateMany({ where: { id: till.id, billSeq: { lt: n } }, data: { billSeq: n } });
      } else {
        const next = await tx.till.update({ where: { id: till.id }, data: { billSeq: { increment: 1 } } });
        code = `${till.code}-${pad(next.billSeq, 6)}`;
        if (wanted) review.push(`Printed as ${wanted}, but that number was already used. Saved as ${code}.`);
      }

      const shift = await openShift(tx, tenantId, till.id);
      const sale = await tx.sale.create({
        data: {
          tenantId,
          branchId: me.branchId,
          tillId: till.id,
          shiftId: shift?.id ?? null,
          code,
          clientKey,
          customerId: customer?.id ?? null,
          customerName: customer?.name ?? optText(body.customerName, 'Customer name'),
          customerPhone: customer?.phone ?? optText(body.customerPhone, 'Customer phone', 30),
          subtotal,
          discount: billDiscount,
          taxName: rate.isZero() ? null : shop.taxName,
          taxRate: rate,
          taxInclusive: shop.taxInclusive,
          taxAmount,
          total,
          costTotal: prepared.reduce((sum, l) => sum.plus(l.costTotal as Dec), ZERO),
          paidTotal: paid,
          changeGiven: change,
          creditAmount: credit.greaterThan(0) ? credit : ZERO,
          note: optText(body.note, 'Note', 300),
          madeOffline: !!offline,
          needsReview: review.length > 0,
          reviewNote: review.length ? review.join(' ').slice(0, 900) : null,
          userId: me.id,
          soldAt: offline ? moment(offline.soldAt, new Date()) : new Date(),
          lines: { createMany: { data: prepared } },
          payments: {
            createMany: {
              data: tenders
                .map((p) => ({ tenantId, method: p.method, reference: p.reference, amount: p.method === PayMethod.CASH ? p.amount.minus(change.times(p.amount).dividedBy(cashTendered.isZero() ? 1 : cashTendered)).toDecimalPlaces(2) : p.amount }))
                .filter((p) => p.amount.greaterThan(0)),
            },
          },
        },
      });
      if (credit.greaterThan(0) && customer) {
        await khata(tx, me, customer.id, { kind: KhataKind.SALE, amount: credit, saleId: sale.id, shiftId: shift?.id, note: `Bill ${code}` });
      }
      return sale.id;
    });
    return this.get(me, saleId);
  }

  /** Manager or owner. Everything on the bill goes back to stock, and its khata line is undone. */
  async cancel(me: Actor, id: string, reason: string | null) {
    const tenantId = me.tenantId;
    await this.prisma.$transaction(async (tx) => {
      const done = await tx.sale.updateMany({
        where: { id, tenantId, status: SaleStatus.COMPLETED, returnedTotal: 0 },
        data: { status: SaleStatus.CANCELLED, cancelledAt: new Date(), cancelReason: reason, needsReview: false },
      });
      if (done.count !== 1) fail('NOT_CANCELLABLE', 'This bill was not found, is already cancelled, or has a return on it.', 409);
      const sale = await tx.sale.findUniqueOrThrow({ where: { id }, include: { lines: true } });
      for (const line of sale.lines) await this.putBack(tx, tenantId, line, line.quantity, true);
      if (sale.creditAmount.greaterThan(0) && sale.customerId) {
        await khata(tx, me, sale.customerId, { kind: KhataKind.CANCEL, amount: sale.creditAmount.negated(), saleId: id, note: `Bill ${sale.code} cancelled` });
      }
      await audit(tx, me, 'Bill cancelled', `${sale.code}, Rs ${sale.total.toFixed(0)}${reason ? `: ${reason}` : ''}`);
    });
    return this.get(me, id);
  }

  private async putBack(tx: Prisma.TransactionClient, tenantId: string, line: { baleId: string | null; kind: LineKind; conflict: boolean }, quantity: number, restock: boolean) {
    if (!line.baleId || line.conflict) return;
    if (line.kind === LineKind.BALE) {
      await tx.bale.updateMany({
        where: { id: line.baleId, tenantId, status: BaleStatus.SOLD },
        data: restock ? { status: BaleStatus.IN_STOCK, closedAt: null } : { status: BaleStatus.WRITTEN_OFF, writeOffReason: 'Returned damaged' },
      });
    } else if (line.kind === LineKind.PIECE && restock) {
      await tx.bale.updateMany({ where: { id: line.baleId, tenantId }, data: { piecesSold: { decrement: quantity } } });
      await tx.bale.updateMany({ where: { id: line.baleId, tenantId, status: BaleStatus.FINISHED }, data: { status: BaleStatus.OPENED, closedAt: null } });
    }
  }

  /** A customer brings something back: some lines or pieces of one bill. */
  async refund(me: Actor, saleId: string, body: Record<string, unknown>) {
    const tenantId = me.tenantId;
    const refundTo = String(body.refundTo) in RefundTo ? (String(body.refundTo) as RefundTo) : RefundTo.CASH;
    const asked = Array.isArray(body.lines) ? (body.lines as Record<string, unknown>[]) : [];
    if (!asked.length) fail('NO_LINES', 'Choose what is coming back.');

    const returnId = await this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({ where: { id: saleId, tenantId, status: SaleStatus.COMPLETED }, include: { lines: true } });
      if (!sale) fail('NOT_FOUND', 'This bill was not found or is cancelled.', 404);
      if (refundTo === RefundTo.KHATA && !sale.customerId) fail('NEEDS_CUSTOMER', 'This bill has no customer, so the refund cannot go to khata.');
      // Each piece carries its share of the bill's discount and tax.
      const factor = sale.subtotal.isZero() ? ZERO : sale.total.dividedBy(sale.subtotal);
      let total = ZERO;
      let costBack = ZERO;
      const rows: Prisma.ReturnLineCreateManyRetInput[] = [];
      for (const ask of asked) {
        const line = sale.lines.find((l) => l.id === String(ask.saleLineId ?? ''));
        if (!line) fail('BAD_LINE', 'A line is not on this bill.');
        const quantity = wholeNumber(ask.quantity ?? 1, 'Quantity');
        const restock = ask.restock !== false;
        const moved = await tx.saleLine.updateMany({ where: { id: line.id, returnedQty: { lte: line.quantity - quantity } }, data: { returnedQty: { increment: quantity } } });
        if (moved.count !== 1) fail('TOO_MANY', `Only ${line.quantity - line.returnedQty} of "${line.description}" can still come back.`, 409);
        const lineAmount = line.lineTotal.times(factor).times(quantity).dividedBy(line.quantity).toDecimalPlaces(2);
        total = total.plus(lineAmount);
        if (restock && !line.conflict) costBack = costBack.plus(line.unitCost.times(quantity)).toDecimalPlaces(2);
        await this.putBack(tx, tenantId, line, quantity, restock);
        rows.push({ tenantId, saleLineId: line.id, quantity, amount: lineAmount, restock });
      }
      const left = sale.total.minus(sale.returnedTotal);
      if (total.greaterThan(left)) total = left; // rounding never refunds more than was billed

      const shop = await tx.shop.update({ where: { id: tenantId }, data: { returnSeq: { increment: 1 } } });
      const shift = sale.tillId ? await openShift(tx, tenantId, String(body.tillId ?? sale.tillId)) : null;
      const ret = await tx.saleReturn.create({
        data: {
          tenantId,
          branchId: me.branchId,
          shiftId: shift?.id ?? null,
          code: `R-${pad(shop.returnSeq, 5)}`,
          saleId,
          total,
          costBack,
          refundTo,
          reason: optText(body.reason, 'Reason', 200),
          userId: me.id,
          lines: { createMany: { data: rows } },
        },
      });
      await tx.sale.update({ where: { id: saleId }, data: { returnedTotal: { increment: total }, returnedCost: { increment: costBack } } });
      if (refundTo === RefundTo.KHATA) {
        await khata(tx, me, sale.customerId!, { kind: KhataKind.RETURN, amount: total.negated(), saleId, shiftId: shift?.id, note: `Return ${ret.code} on bill ${sale.code}` });
      }
      await audit(tx, me, 'Return', `${ret.code} on ${sale.code}, Rs ${total.toFixed(0)} to ${refundTo.toLowerCase()}`);
      return ret.id;
    });
    return { returnId, sale: await this.get(me, saleId) };
  }

  async get(me: Actor, id: string) {
    const sale = await this.prisma.sale.findFirst({ where: { id, tenantId: me.tenantId }, include: SALE_FULL });
    if (!sale) fail('NOT_FOUND', 'This bill was not found.', 404);
    return this.view(me, sale);
  }

  /** The owner has looked at an offline bill that did not fit. */
  async reviewed(me: Actor, id: string) {
    const done = await this.prisma.sale.updateMany({ where: { id, tenantId: me.tenantId, needsReview: true }, data: { needsReview: false } });
    if (done.count !== 1) fail('NOT_FOUND', 'This bill does not need a review.', 404);
    return this.get(me, id);
  }

  /** People without the right to see cost never get cost or profit. */
  private view<T extends { costTotal: Dec; total: Dec; returnedTotal: Dec; returnedCost: Dec; lines?: { unitCost: Dec; costTotal: Dec }[] }>(me: Actor, sale: T) {
    if (me.seesCost) return { ...sale, profit: sale.total.minus(sale.returnedTotal).minus(sale.costTotal.minus(sale.returnedCost)) };
    const { costTotal: _c, returnedCost: _r, ...rest } = sale;
    return { ...rest, lines: sale.lines?.map(({ unitCost: _u, costTotal: _t, ...line }) => line) };
  }

  /** Bills of one day (default today) or a range, in this branch; a cashier sees only their own. */
  async list(me: Actor, q: Record<string, string>) {
    const where: Prisma.SaleWhereInput = { tenantId: me.tenantId, branchId: me.branchId, soldAt: range(q) };
    if (me.role === UserRole.CASHIER) where.userId = me.id;
    if (q.customerId) {
      where.customerId = q.customerId;
      delete where.soldAt;
    }
    if (q.review) {
      where.needsReview = true;
      delete where.soldAt;
    }
    const search = (q.search ?? '').trim();
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search } },
      ];
      delete where.soldAt; // looking for one bill: any day
    }
    const sales = await this.prisma.sale.findMany({
      where,
      include: { user: { select: { name: true } }, payments: { select: { method: true, amount: true } }, _count: { select: { lines: true } } },
      orderBy: { soldAt: 'desc' },
      take: 300,
    });
    const done = sales.filter((s) => s.status === SaleStatus.COMPLETED);
    const sum = (pick: (s: (typeof sales)[number]) => Dec) => done.reduce((a, s) => a.plus(pick(s)), ZERO);
    const byMethod = Object.fromEntries(
      Object.values(PayMethod).map((m) => [m, done.reduce((a, s) => s.payments.filter((p) => p.method === m).reduce((b, p) => b.plus(p.amount), a), new D(0))]),
    );
    return {
      summary: {
        bills: done.length,
        total: sum((s) => s.total),
        returned: sum((s) => s.returnedTotal),
        credit: sum((s) => s.creditAmount),
        byMethod,
        ...(me.seesCost ? { profit: sum((s) => s.total.minus(s.returnedTotal).minus(s.costTotal.minus(s.returnedCost))) } : {}),
      },
      sales: sales.map((s) => this.view(me, s)),
    };
  }
}

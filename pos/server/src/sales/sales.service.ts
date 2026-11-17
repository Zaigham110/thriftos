import { Injectable } from '@nestjs/common';
import { BaleStatus, KhataKind, LineKind, PayMethod, Prisma, RefundTo, SaleStatus, UserRole } from '@prisma/client';
import { audit, khata, openShift } from '../common/audit';
import { Actor, isManager } from '../common/auth.guard';
import { sign } from '../common/currency';
import { PrismaService } from '../common/prisma.service';
import { amount, D, Dec, fail, moment, optText, pad, range, spread, text, wholeNumber, ZERO } from '../common/util';

interface LineInput {
  baleId: string | null;
  kindCode: string | null; // "this kind x quantity": the server picks the oldest whole bales
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
  lines: { include: { bale: { select: { code: true, baleNo: true, kindCode: true } } }, orderBy: { id: 'asc' } },
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
      // A whole-bale line names either one bale, or a kind (its shared code) and how many.
      const kindCode = kind === LineKind.BALE && !r.baleId && r.kindCode ? text(r.kindCode, 'Code', 60) : null;
      const baleId = kind === LineKind.ITEM || kindCode ? null : String(r.baleId ?? '');
      if (kind !== LineKind.ITEM && !kindCode) {
        if (!baleId) fail('BAD_LINE', 'A line has no bale.');
        if (seen.has(baleId)) fail('BALE_TWICE', 'The same bale is on the bill twice. Change the number of pieces instead.');
        seen.add(baleId);
      }
      const quantity = kindCode ? wholeNumber(r.quantity ?? 1, 'Quantity') : kind === LineKind.BALE ? 1 : wholeNumber(r.quantity ?? 1, kind === LineKind.PIECE ? 'Pieces' : 'Quantity');
      const unitPrice = amount(r.unitPrice, 'Price');
      const discount = amount(r.discount, 'Line discount');
      if (discount.greaterThan(unitPrice.times(quantity))) fail('DISCOUNT_TOO_BIG', 'A line discount is more than the line.');
      return { baleId, kindCode, kind, description: kind === LineKind.ITEM ? text(r.description, 'Item name', 80) : null, quantity, unitPrice, discount };
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

    // An exchange: goods of an earlier bill come back and pay for (part of) this one.
    const exchange = body.exchange && typeof body.exchange === 'object' ? (body.exchange as Record<string, unknown>) : null;
    if (exchange && offline) fail('EXCHANGE_ONLINE', 'An exchange needs the shop server. Try again when the connection is back.');
    if (exchange && !isManager(me)) fail('MANAGER_ONLY', 'A manager or the owner makes an exchange.', 403);

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
      // For a kind line: the prices of the bales that would be taken (the oldest ones).
      let kindFull = ZERO;
      for (const l of lines.filter((x) => x.kindCode)) {
        const next = await this.prisma.bale.findMany({
          where: { tenantId, branchId: me.branchId, kindCode: { equals: l.kindCode!, mode: 'insensitive' }, status: BaleStatus.IN_STOCK },
          select: { salePrice: true },
          orderBy: [{ createdAt: 'asc' }, { code: 'asc' }],
          take: l.quantity,
        });
        for (let i = 0; i < l.quantity; i++) {
          const list = next[i]?.salePrice ?? l.unitPrice;
          kindFull = kindFull.plus(list.greaterThan(l.unitPrice) ? list : l.unitPrice);
        }
      }
      const full = lines.filter((l) => !l.kindCode).reduce((sum, l) => {
        const bale = listed.find((b) => b.id === l.baleId);
        const list = (l.kind === LineKind.BALE ? bale?.salePrice : l.kind === LineKind.PIECE ? bale?.piecePrice : null) ?? l.unitPrice;
        return sum.plus((list.greaterThan(l.unitPrice) ? list : l.unitPrice).times(l.quantity));
      }, kindFull);
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
    // What the returned goods are worth pays first; if they are worth more than this bill, the rest goes back in cash.
    let exchangeWorth = ZERO;
    if (exchange) {
      const old = await this.prisma.sale.findFirst({ where: { id: String(exchange.saleId ?? ''), tenantId, status: SaleStatus.COMPLETED }, include: { lines: true } });
      if (!old) fail('NOT_FOUND', 'The bill of the returned goods was not found or is cancelled.', 404);
      exchangeWorth = this.worth(old, this.asked(exchange.lines)).total;
    }
    const exchanged = exchangeWorth.greaterThan(total) ? total : exchangeWorth;
    const exchangeBack = exchangeWorth.minus(exchanged);
    const due = total.minus(exchanged);
    const tenders = this.payments(body.payments) ?? [{ method: PayMethod.CASH, amount: due, reference: null }];
    const tendered = tenders.reduce((sum, p) => sum.plus(p.amount), ZERO);
    const cashTendered = tenders.filter((p) => p.method === PayMethod.CASH).reduce((sum, p) => sum.plus(p.amount), ZERO);
    const change = tendered.greaterThan(due) ? tendered.minus(due) : ZERO;
    if (change.greaterThan(cashTendered)) fail('OVERPAID', 'Bank and wallet payments together are more than the bill.');
    const paid = tendered.minus(change);
    const credit = due.minus(paid);
    const money = sign(shop.currency);
    if (credit.greaterThan(0)) {
      if (!customer) refuse('NEEDS_CUSTOMER', `${money} ${credit.toFixed(0)} is not paid. Choose a customer to put it on khata, or take the full amount.`);
      else if (customer.creditLimit && customer.balance.plus(credit).greaterThan(customer.creditLimit) && !isManager(me)) {
        refuse('OVER_LIMIT', `${customer.name} would owe ${money} ${customer.balance.plus(credit).toFixed(0)}, over the limit of ${money} ${customer.creditLimit.toFixed(0)}. Ask a manager.`, 403);
      }
    }

    const saleId = await this.prisma.$transaction(async (tx) => {
      // The returned goods come back first (in this same step, so an exchange is all or nothing).
      const taken = exchange ? await this.refundIn(tx, me, String(exchange.saleId), { ...exchange, refundTo: RefundTo.EXCHANGE, tillId: till.id }, true) : null;
      if (taken && !taken.total.equals(exchangeWorth)) fail('EXCHANGE_CHANGED', 'The bill of the returned goods changed meanwhile. Start the exchange again.', 409);

      const prepared: Prisma.SaleLineCreateManySaleInput[] = [];
      // Bales named one by one on this bill are theirs: a kind line never takes one of them.
      const named = lines.filter((l) => l.baleId).map((l) => l.baleId!);
      const tried: string[] = [];
      for (const line of lines) {
        const lineTotal = line.unitPrice.times(line.quantity).minus(line.discount);
        if (line.kindCode) {
          // "This kind x quantity": the oldest whole bales of this branch, each written as its own line with its own
          // cost, so profit, khata, cancel and return work as for bales sold one by one.
          const kind = await tx.baleKind.findFirst({ where: { tenantId, code: { equals: line.kindCode, mode: 'insensitive' } } });
          if (!kind) fail('NOT_FOUND', `No bales have the code ${line.kindCode}.`, 404);
          const got: { id: string; item: string; grade: string | null; landedCost: Dec }[] = [];
          for (let round = 0; got.length < line.quantity && round < 5; round++) {
            const next = await tx.bale.findMany({
              where: { tenantId, branchId: me.branchId, kindCode: kind.code, status: BaleStatus.IN_STOCK, id: { notIn: [...named, ...tried] } },
              select: { id: true, item: true, grade: true, landedCost: true },
              orderBy: [{ createdAt: 'asc' }, { code: 'asc' }],
              take: line.quantity - got.length,
            });
            if (!next.length) break;
            for (const bale of next) {
              tried.push(bale.id);
              // The status check is in the update itself, so two counters cannot sell one bale.
              const sold = await tx.bale.updateMany({ where: { id: bale.id, tenantId, status: BaleStatus.IN_STOCK }, data: { status: BaleStatus.SOLD, closedAt: new Date() } });
              if (sold.count === 1) got.push(bale);
            }
          }
          if (got.length < line.quantity) {
            // Nothing is sold: leaving the transaction puts back the bales just taken.
            if (!offline) fail('KIND_SHORT', `Only ${got.length} of ${kind.code} in stock.`, 409);
            review.push(`Only ${got.length} of ${kind.code} were in stock, ${line.quantity} were sold.`);
          }
          const less = spread(line.discount, Array.from({ length: line.quantity }, () => null));
          for (let i = 0; i < line.quantity; i++) {
            const bale = got[i];
            prepared.push({
              tenantId,
              baleId: bale?.id ?? null,
              kind: LineKind.BALE,
              description: bale ? [bale.item, bale.grade].filter(Boolean).join(' · ') : `${kind.code} ${kind.name}`,
              quantity: 1,
              unitPrice: line.unitPrice,
              discount: less[i],
              lineTotal: line.unitPrice.minus(less[i]),
              unitCost: bale?.landedCost ?? ZERO,
              costTotal: bale?.landedCost ?? ZERO,
              conflict: !bale,
            });
          }
          continue;
        }
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
          changeGiven: change.plus(exchangeBack),
          creditAmount: credit.greaterThan(0) ? credit : ZERO,
          exchangeAmount: exchanged,
          exchangeReturnId: taken?.id ?? null,
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
      if (taken) {
        await tx.saleReturn.update({ where: { id: taken.id }, data: { exchangeSaleId: sale.id } });
        // Returned goods worth more than the new bill: the difference leaves the drawer.
        if (exchangeBack.greaterThan(0) && shift) {
          await tx.cashMovement.create({ data: { tenantId, shiftId: shift.id, kind: 'OUT', amount: exchangeBack, reason: `Exchange ${taken.code}: difference given back`, userId: me.id, userName: me.name } });
        }
        await audit(tx, me, 'Exchange', `${taken.code} for bill ${code}: goods worth ${money} ${exchangeWorth.toFixed(0)} came back`);
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
      // Part of an exchange bill was paid with goods; cancelling it would lose that. A return gives it back properly.
      if (sale.exchangeAmount.greaterThan(0)) fail('IS_EXCHANGE', 'This bill is an exchange and cannot be cancelled. Take a return on it instead.', 409);
      for (const line of sale.lines) await this.putBack(tx, tenantId, line, line.quantity, true);
      if (sale.creditAmount.greaterThan(0) && sale.customerId) {
        await khata(tx, me, sale.customerId, { kind: KhataKind.CANCEL, amount: sale.creditAmount.negated(), saleId: id, note: `Bill ${sale.code} cancelled` });
      }
      await audit(tx, me, 'Bill cancelled', `${sale.code}, ${sale.total.toFixed(0)}${reason ? `: ${reason}` : ''}`);
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

  /** What a screen asks to return: lines of a bill and how many of each. */
  private asked(raw: unknown): { saleLineId: string; quantity: number; restock: boolean }[] {
    const list = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
    if (!list.length) fail('NO_LINES', 'Choose what is coming back.');
    return list.map((a) => ({ saleLineId: String(a?.saleLineId ?? ''), quantity: wholeNumber(a?.quantity ?? 1, 'Quantity'), restock: a?.restock !== false }));
  }

  /** What the asked lines are worth today: each piece carries its share of the bill's discount and tax. */
  private worth(sale: { subtotal: Dec; total: Dec; returnedTotal: Dec; lines: { id: string; quantity: number; returnedQty: number; lineTotal: Dec; description: string }[] }, asked: { saleLineId: string; quantity: number }[]) {
    const factor = sale.subtotal.isZero() ? ZERO : sale.total.dividedBy(sale.subtotal);
    let total = ZERO;
    const amounts = asked.map((ask) => {
      const line = sale.lines.find((l) => l.id === ask.saleLineId);
      if (!line) fail('BAD_LINE', 'A line is not on this bill.');
      if (ask.quantity > line.quantity - line.returnedQty) fail('TOO_MANY', `Only ${line.quantity - line.returnedQty} of "${line.description}" can still come back.`, 409);
      const lineAmount = line.lineTotal.times(factor).times(ask.quantity).dividedBy(line.quantity).toDecimalPlaces(2);
      total = total.plus(lineAmount);
      return lineAmount;
    });
    const left = sale.total.minus(sale.returnedTotal);
    if (total.greaterThan(left)) total = left; // rounding never refunds more than was billed
    return { total, amounts };
  }

  /** A customer brings something back: some lines or pieces of one bill. */
  async refund(me: Actor, saleId: string, body: Record<string, unknown>) {
    const ret = await this.prisma.$transaction((tx) => this.refundIn(tx, me, saleId, body, false));
    return { returnId: ret.id, code: ret.code, total: ret.total, sale: await this.get(me, saleId) };
  }

  /** `exchange`: the money is not paid out; it pays for the other goods on the exchange bill (see `create`). */
  private async refundIn(tx: Prisma.TransactionClient, me: Actor, saleId: string, body: Record<string, unknown>, exchange: boolean) {
    const tenantId = me.tenantId;
    const refundTo = exchange ? RefundTo.EXCHANGE : String(body.refundTo) in RefundTo && body.refundTo !== RefundTo.EXCHANGE ? (String(body.refundTo) as RefundTo) : RefundTo.CASH;
    const asked = this.asked(body.lines);

    const sale = await tx.sale.findFirst({ where: { id: saleId, tenantId, status: SaleStatus.COMPLETED }, include: { lines: true } });
    if (!sale) fail('NOT_FOUND', 'This bill was not found or is cancelled.', 404);
    if (refundTo === RefundTo.KHATA && !sale.customerId) fail('NEEDS_CUSTOMER', 'This bill has no customer, so the refund cannot go to khata.');
    const { total, amounts } = this.worth(sale, asked);
    let costBack = ZERO;
    const rows: Prisma.ReturnLineCreateManyRetInput[] = [];
    for (const [i, ask] of asked.entries()) {
      const line = sale.lines.find((l) => l.id === ask.saleLineId)!;
      const moved = await tx.saleLine.updateMany({ where: { id: line.id, returnedQty: { lte: line.quantity - ask.quantity } }, data: { returnedQty: { increment: ask.quantity } } });
      if (moved.count !== 1) fail('TOO_MANY', `Only ${line.quantity - line.returnedQty} of "${line.description}" can still come back.`, 409);
      if (ask.restock && !line.conflict) costBack = costBack.plus(line.unitCost.times(ask.quantity)).toDecimalPlaces(2);
      await this.putBack(tx, tenantId, line, ask.quantity, ask.restock);
      rows.push({ tenantId, saleLineId: line.id, quantity: ask.quantity, amount: amounts[i], restock: ask.restock });
    }

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
    await audit(tx, me, 'Return', `${ret.code} on ${sale.code}, ${total.toFixed(0)} ${exchange ? 'exchanged for other goods' : `to ${refundTo.toLowerCase()}`}`);
    return ret;
  }

  /** Returns taken in this branch in a day or a range, newest first, with what was given back and how. */
  async returns(me: Actor, q: Record<string, string>) {
    const list = await this.prisma.saleReturn.findMany({
      where: { tenantId: me.tenantId, branchId: me.branchId, createdAt: range(q) },
      include: { sale: { select: { id: true, code: true, customerName: true } }, lines: { select: { quantity: true } } },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    const names = await this.prisma.user.findMany({ where: { tenantId: me.tenantId, id: { in: [...new Set(list.map((r) => r.userId))] } }, select: { id: true, name: true } });
    const exchanges = await this.prisma.sale.findMany({ where: { tenantId: me.tenantId, id: { in: list.map((r) => r.exchangeSaleId).filter((x): x is string => !!x) } }, select: { id: true, code: true } });
    const byRefund = Object.fromEntries(Object.values(RefundTo).map((to) => [to, list.filter((r) => r.refundTo === to).reduce((a, r) => a.plus(r.total), ZERO)]));
    return {
      summary: { returns: list.length, total: list.reduce((a, r) => a.plus(r.total), ZERO), byRefund },
      returns: list.map(({ costBack: _c, lines, userId, ...r }) => ({ ...r, items: lines.reduce((a, l) => a + l.quantity, 0), userName: names.find((u) => u.id === userId)?.name ?? '', exchangeSale: exchanges.find((e) => e.id === r.exchangeSaleId) ?? null })),
    };
  }

  /**
   * The customer has no bill: find the bills by what they brought back. A sticker's shared code finds bills that
   * sold that kind (whole bales or pieces); a bale's own number finds the bill that sold that bale. Newest first.
   */
  async byGoods(me: Actor, codeRaw: string) {
    const code = codeRaw.trim();
    if (!code) fail('REQUIRED', 'Scan or type the code on the goods.');
    const same = { equals: code, mode: 'insensitive' as const };
    const lines = await this.prisma.saleLine.findMany({
      where: { tenantId: me.tenantId, conflict: false, sale: { tenantId: me.tenantId, branchId: me.branchId, status: SaleStatus.COMPLETED }, bale: { OR: [{ kindCode: same }, { code: same }, { baleNo: same }] } },
      select: { id: true, kind: true, description: true, quantity: true, returnedQty: true, unitPrice: true, lineTotal: true, bale: { select: { code: true, kindCode: true } }, sale: { select: { id: true, code: true, soldAt: true, customerName: true, customerPhone: true } } },
      orderBy: { sale: { soldAt: 'desc' } },
      take: 200,
    });
    return lines.filter((l) => l.returnedQty < l.quantity).slice(0, 40).map((l) => ({ ...l, left: l.quantity - l.returnedQty }));
  }

  async get(me: Actor, id: string) {
    const sale = await this.prisma.sale.findFirst({ where: { id, tenantId: me.tenantId }, include: SALE_FULL });
    if (!sale) fail('NOT_FOUND', 'This bill was not found.', 404);
    // An exchange bill says which return paid for part of it; a return says which bill it was exchanged for.
    const exchangeOf = sale.exchangeReturnId ? await this.prisma.saleReturn.findFirst({ where: { id: sale.exchangeReturnId, tenantId: me.tenantId }, select: { code: true, total: true, sale: { select: { id: true, code: true } } } }) : null;
    return this.view(me, { ...sale, exchangeOf });
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

import { StockUnit } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { DecimalLike, dec } from '../costing/costing';

export interface StockForSale {
  unit: StockUnit;
  quantity: Decimal;
  usedQuantity: Decimal;
  weightKg: Decimal | null;
}

/** Why a line cannot be sold: bad input, or not enough stock left. */
export class SaleLineError extends Error {
  constructor(
    message: string,
    readonly kind: 'invalid' | 'short',
  ) {
    super(message);
  }
}

const UNIT_NAMES: Record<StockUnit, string> = { KG: 'kg', BALE: 'bales', PIECE: 'pieces' };

/**
 * How much of a stock item a sale line uses (in the item's own unit), and the kg / pieces that
 * leave stock. A line is priced per kg, bale or piece: by default the item's unit; bales with a
 * known weight can also be sold by kg, in whole bales.
 */
export function saleTake(item: StockForSale, line: { unit?: StockUnit; quantity: DecimalLike }) {
  const unit = line.unit ?? item.unit;
  const quantity = dec(line.quantity);
  const left = item.quantity.sub(item.usedQuantity);
  const weightOf = (amount: Decimal) => (item.weightKg ? item.weightKg.mul(amount).div(item.quantity).toDecimalPlaces(2) : new Decimal(0));

  let use: Decimal;
  if (unit === item.unit) {
    if (unit !== StockUnit.KG && !quantity.isInteger()) throw new SaleLineError(`Sell whole ${UNIT_NAMES[unit]}`, 'invalid');
    use = quantity;
  } else if (item.unit === StockUnit.BALE && unit === StockUnit.KG && item.weightKg) {
    const kgPerBale = item.weightKg.div(item.quantity);
    use = quantity.div(kgPerBale);
    if (!use.isInteger()) throw new SaleLineError(`Sell whole bales by kg: ${kgPerBale.toDecimalPlaces(2).toString()} kg each`, 'invalid');
  } else {
    throw new SaleLineError(`This stock is sold by ${UNIT_NAMES[item.unit]}`, 'invalid');
  }
  if (use.greaterThan(left)) throw new SaleLineError(`Only ${left.toString()} ${UNIT_NAMES[item.unit]} left`, 'short');

  return {
    unit,
    use,
    kg: unit === StockUnit.KG ? quantity : weightOf(use),
    pieces: item.unit === StockUnit.PIECE ? use.toNumber() : 0,
  };
}

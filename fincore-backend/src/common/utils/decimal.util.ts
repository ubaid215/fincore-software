// src/common/utils/decimal.util.ts
import Decimal from 'decimal.js';

// Configure Decimal.js globally for financial precision
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/** Convert any money-like value to a Decimal safely */
export function toDecimal(value: string | number | Decimal | null | undefined): Decimal {
  if (value === null || value === undefined) return new Decimal(0);
  return new Decimal(value.toString());
}

/** Round to 4 decimal places (DECIMAL(19,4) in DB) */
export function roundMoney(value: Decimal | string | number): Decimal {
  return toDecimal(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}

/** Multiply quantity × unit price, apply discount and tax */
export function calculateLineTotal(
  quantity: Decimal | string | number,
  unitPrice: Decimal | string | number,
  taxRate = 0,
  discount = 0,
): Decimal {
  const qty = toDecimal(quantity);
  const price = toDecimal(unitPrice);
  const tax = toDecimal(taxRate);
  const disc = toDecimal(discount);

  return roundMoney(qty.mul(price).mul(new Decimal(1).minus(disc)).mul(new Decimal(1).plus(tax)));
}

/** Convert foreign currency amount to base currency */
export function toBaseCurrency(
  amount: Decimal | string | number,
  fxRate: Decimal | string | number,
): Decimal {
  return roundMoney(toDecimal(amount).mul(toDecimal(fxRate)));
}

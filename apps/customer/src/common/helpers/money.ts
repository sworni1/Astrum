import { Currency } from "@/common/types/product.types";

/**
 * Maps the currency string the API returns onto the enum. An unknown value
 * reads as rubles, never as dollars (spec 0009, AC-9).
 */
export const toCurrency = (value: string): Currency => {
  switch (value) {
    case Currency.USD:
      return Currency.USD;
    case Currency.RUB:
      return Currency.RUB;
    default:
      return Currency.RUB;
  }
};

/**
 * One amount in the reader's own locale, grouped and signed by `Intl`: `ru`
 * prints `46 332,00 ₽` and `en` prints `₽46,332.00`. `narrowSymbol` is the one
 * option that keeps the sign glued to the digits, because the default display
 * prints `RUB 46,332.00` in English (spec 0026, AC-14).
 */
export const formatMoney = (
  amount: number,
  currency: Currency,
  locale: string,
): string =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency: toCurrency(currency),
    currencyDisplay: "narrowSymbol",
  }).format(amount);


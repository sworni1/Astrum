import { Currency } from "@/common/types/product.types";
import { getCurrencyEmoji } from "./getCurrencyEmoji";

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

/** One amount with its sign and two decimals, in the given currency (AC-9). */
export const formatMoney = (amount: number, currency: Currency): string =>
  `${getCurrencyEmoji(toCurrency(currency))}${amount.toFixed(2)}`;

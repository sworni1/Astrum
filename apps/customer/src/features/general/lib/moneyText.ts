import { formatMoney, toCurrency } from "@/common/helpers/money";
import { Currency } from "@/common/types/product.types";

const JOINER = " · ";

/**
 * A list of amounts per currency: one entry as it is, several joined by a
 * middot, so a reader holding two currencies reads two honest amounts instead of
 * one sum of two units. An empty list prints zero rubles, the same fallback
 * `toCurrency` gives an unknown currency. Both order screens read it, so it
 * lives here instead of in one of them (spec 0025 AC-7, spec 0026 AC-6, AC-13).
 */
export const amountListText = (
  entries: readonly { currency: Currency; amount: number }[],
  locale: string,
): string => {
  if (entries.length === 0) {
    return formatMoney(0, Currency.RUB, locale);
  }

  return [...entries]
    .sort((left, right) => left.currency.localeCompare(right.currency))
    .map((entry) => formatMoney(entry.amount, toCurrency(entry.currency), locale))
    .join(JOINER);
};

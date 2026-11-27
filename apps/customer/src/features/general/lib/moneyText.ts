import { formatMoney, toCurrency } from "@/common/helpers/money";
import { Currency } from "@/common/types/product.types";

const JOINER = " · ";

export const amountListText = (
  entries: readonly { currency: Currency; amount: number }[],
  locale: string,
): string => {
  if (entries.length === 0) {
    return formatMoney(0, Currency.RUB, locale);
  }

  return [...entries]
    .sort((left, right) => left.currency.localeCompare(right.currency))
    .map((entry) =>
      formatMoney(entry.amount, toCurrency(entry.currency), locale),
    )
    .join(JOINER);
};

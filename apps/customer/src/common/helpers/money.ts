import { Currency } from "@/common/types/product.types";

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

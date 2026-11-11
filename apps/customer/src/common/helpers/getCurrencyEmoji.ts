import { Currency } from "@/common/types/product.types";

export const getCurrencyEmoji = (currency: Currency) => {
  switch (currency) {
    case Currency.RUB:
      return "₽";
    case Currency.USD:
      return "$";
    default:
      return "$";
  }
};

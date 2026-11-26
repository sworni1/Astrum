import {
  SHOP_NAME_FORBIDDEN_CHARACTER,
  SHOP_NAME_MAX_LENGTH,
  SHOP_NAME_MIN_LENGTH,
  SHOP_NAME_WHITESPACE_RUN,
} from "../constants/shop-name.constants";

export type ShopNameProblem = "required" | "tooShort" | "tooLong" | "forbidden";

export const normalizeShopName = (value: string): string =>
  value.normalize("NFC").trim().replace(SHOP_NAME_WHITESPACE_RUN, " ");

export const shopNameCodePointLength = (value: string): number =>
  [...value].length;

export const shopNameProblem = (value: string): ShopNameProblem | null => {
  if (value.trim() === "") {
    return "required";
  }

  const length = shopNameCodePointLength(value);

  if (length < SHOP_NAME_MIN_LENGTH) {
    return "tooShort";
  }

  if (length > SHOP_NAME_MAX_LENGTH) {
    return "tooLong";
  }

  if (SHOP_NAME_FORBIDDEN_CHARACTER.test(value)) {
    return "forbidden";
  }

  return null;
};

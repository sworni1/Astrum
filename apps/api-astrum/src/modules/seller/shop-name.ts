export const SHOP_NAME_MIN_LENGTH = 2;
export const SHOP_NAME_MAX_LENGTH = 60;

const WHITESPACE_RUN = /\s+/gu;
const FORBIDDEN_CHARACTER = /[\p{Cc}\p{Cf}]/u;

export type ShopNameProblem = "required" | "tooShort" | "tooLong" | "forbidden";

export const normalizeShopName = (value: string): string =>
  value.normalize("NFC").trim().replace(WHITESPACE_RUN, " ");

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

  if (FORBIDDEN_CHARACTER.test(value)) {
    return "forbidden";
  }

  return null;
};

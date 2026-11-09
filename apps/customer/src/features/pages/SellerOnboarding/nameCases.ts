/**
 * One table of shop name cases runs through the storefront zod schema and the
 * gateway DTO, so the two rules cannot drift (spec 0008, AC-4). This module
 * carries no imports: both test suites can read it from either workspace.
 */
export type ShopNameCase = {
  label: string;
  input: string;
  valid: boolean;
  stored: string;
};

const sixty = "x".repeat(60);
const sixtyOne = "x".repeat(61);

export const SHOP_NAME_CASES: ShopNameCase[] = [
  {
    label: "trims and collapses whitespace",
    input: "  My   Shop  ",
    valid: true,
    stored: "My Shop",
  },
  {
    label: "stores the NFC form of a decomposed accent",
    input: "Cafe\u0301",
    valid: true,
    stored: "Caf\u00e9",
  },
  {
    label: "accepts two code points",
    input: "AB",
    valid: true,
    stored: "AB",
  },
  {
    label: "accepts an emoji inside the name",
    input: "Shop \u{1f600}",
    valid: true,
    stored: "Shop \u{1f600}",
  },
  {
    label: "accepts 60 code points",
    input: sixty,
    valid: true,
    stored: sixty,
  },
  {
    label: "rejects one code point",
    input: "A",
    valid: false,
    stored: "",
  },
  {
    label: "rejects one astral code point, though it is two UTF-16 units",
    input: "\u{1f600}",
    valid: false,
    stored: "",
  },
  {
    label: "rejects 61 code points",
    input: sixtyOne,
    valid: false,
    stored: "",
  },
  {
    label: "rejects an empty value",
    input: "   ",
    valid: false,
    stored: "",
  },
  {
    label: "rejects a control character",
    input: "Shop\u0000",
    valid: false,
    stored: "",
  },
  {
    label: "rejects a right to left override",
    input: "Shop\u202e",
    valid: false,
    stored: "",
  },
  {
    label: "rejects a zero width joiner",
    input: "Shop\u200d",
    valid: false,
    stored: "",
  },
];

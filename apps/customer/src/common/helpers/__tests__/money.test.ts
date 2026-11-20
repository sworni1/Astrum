import { describe, expect, it } from "vitest";
import { Currency } from "@/common/types/product.types";
import { formatMoney, toCurrency } from "@/common/helpers/money";

const NBSP = "\u00A0";

describe("toCurrency", () => {
  const cases: [string, Currency][] = [
    ["RUB", Currency.RUB],
    ["USD", Currency.USD],
    ["rub", Currency.RUB],
    ["EUR", Currency.RUB],
    ["", Currency.RUB],
  ];

  it.each(cases)("maps %s onto %s (AC-9)", (value, expected) => {
    expect(toCurrency(value)).toBe(expected);
  });

  it("never answers a currency the enum does not hold (AC-9)", () => {
    const values = Object.values(Currency);

    expect(values).toContain(toCurrency("GBP"));
  });
});

describe("formatMoney", () => {
  const cases: [number, Currency, string, string][] = [
    [299, Currency.RUB, `299,00${NBSP}₽`, "₽299.00"],
    [799.5, Currency.RUB, `799,50${NBSP}₽`, "₽799.50"],
    [0, Currency.RUB, `0,00${NBSP}₽`, "₽0.00"],
    [19.999, Currency.RUB, `20,00${NBSP}₽`, "₽20.00"],
    [12.5, Currency.USD, `12,50${NBSP}$`, "$12.50"],
  ];

  it.each(cases)(
    "prints %d in %s through the reader's locale (AC-14)",
    (amount, currency, ru, en) => {
      expect(formatMoney(amount, currency, "ru")).toBe(ru);
      expect(formatMoney(amount, currency, "en")).toBe(en);
    },
  );

  it("groups thousands and puts the sign after the digits in ru (AC-14)", () => {
    expect(formatMoney(46332, Currency.RUB, "ru")).toBe(
      `46${NBSP}332,00${NBSP}₽`,
    );
    expect(formatMoney(46332, Currency.RUB, "en")).toBe("₽46,332.00");
  });

  it("leaves the emoji prefix out of the amount (AC-14)", () => {
    expect(formatMoney(299, Currency.RUB, "en")).not.toContain("💰");
  });

  it("falls back to rubles for a currency string it does not know (AC-9)", () => {
    const unknown = toCurrency("EUR");

    expect(formatMoney(10, unknown, "ru")).toBe(`10,00${NBSP}₽`);
    expect(formatMoney(10, unknown, "en")).not.toContain("$");
  });
});

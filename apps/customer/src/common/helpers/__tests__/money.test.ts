import { describe, expect, it } from "vitest";
import { Currency } from "@/common/types/product.types";
import { formatMoney, toCurrency } from "@/common/helpers/money";

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
  const cases: [number, Currency, string][] = [
    [299, Currency.RUB, "₽299.00"],
    [799.5, Currency.RUB, "₽799.50"],
    [0, Currency.RUB, "₽0.00"],
    [19.999, Currency.RUB, "₽20.00"],
    [12.5, Currency.USD, "$12.50"],
  ];

  it.each(cases)("formats %d in %s as %s (AC-9)", (amount, currency, text) => {
    expect(formatMoney(amount, currency)).toBe(text);
  });

  it("falls back to rubles for a currency string it does not know (AC-9)", () => {
    const unknown = toCurrency("EUR");

    expect(formatMoney(10, unknown)).toBe("₽10.00");
    expect(formatMoney(10, unknown)).not.toContain("$");
  });
});

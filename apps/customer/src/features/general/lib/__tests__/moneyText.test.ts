import { describe, expect, it } from "vitest";
import { Currency } from "@/common/types/product.types";
import { amountListText } from "@/features/general/lib/moneyText";

const NBSP = "\u00A0";

describe("amountListText", () => {
  it("печатает одну валюту как есть (AC-7)", () => {
    expect(amountListText([{ currency: Currency.RUB, amount: 1234.5 }], "ru")).toBe(
      `1${NBSP}234,50${NBSP}₽`,
    );
  });

  it("печатает ноль рублей, когда платить было не за что (AC-7)", () => {
    expect(amountListText([], "ru")).toBe(`0,00${NBSP}₽`);
  });

  it("соединяет две валюты по возрастанию кода (AC-7)", () => {
    expect(
      amountListText(
        [
          { currency: Currency.USD, amount: 10 },
          { currency: Currency.RUB, amount: 5 },
        ],
        "en",
      ),
    ).toBe("₽5.00 · $10.00");
  });

  it("печатает сумму в локали читателя, с разрядами (AC-14)", () => {
    expect(amountListText([{ currency: Currency.RUB, amount: 46332 }], "ru")).toBe(
      `46${NBSP}332,00${NBSP}₽`,
    );
    expect(amountListText([{ currency: Currency.RUB, amount: 46332 }], "en")).toBe(
      "₽46,332.00",
    );
  });
});

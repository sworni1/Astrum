import en from "@messages/en.json";
import ru from "@messages/ru.json";
import { describe, expect, it } from "vitest";
import { defaultLocale, isLocale, resolveLocale } from "./config";

type Catalog = Record<string, unknown>;

const flatten = (catalog: Catalog, prefix = ""): Record<string, string> => {
  const entries = Object.entries(catalog).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;

    if (typeof value === "string") {
      return [[path, value] as const];
    }

    if (typeof value === "object" && value !== null) {
      return Object.entries(flatten(value as Catalog, path));
    }

    return [];
  });

  return Object.fromEntries(entries);
};

const placeholdersOf = (message: string): string[] =>
  [...message.matchAll(/\{(\w+)[,}]/g)].map((match) => match[1]).sort();

describe("message catalogs", () => {
  const enKeys = Object.keys(flatten(en)).sort();
  const ruKeys = Object.keys(flatten(ru)).sort();

  it("carries the same key tree in both languages", () => {
    expect(ruKeys).toEqual(enKeys);
  });

  it("keeps the same interpolation placeholders in both languages", () => {
    const enMessages = flatten(en);
    const ruMessages = flatten(ru);

    for (const key of enKeys) {
      expect(placeholdersOf(enMessages[key]), key).toEqual(
        placeholdersOf(ruMessages[key]),
      );
    }
  });

  it("leaves no Russian text in the English catalog", () => {
    const cyrillic = /[\u0400-\u04FF]/;

    for (const [key, message] of Object.entries(flatten(en))) {
      expect(cyrillic.test(message), key).toBe(false);
    }
  });
});

describe("resolveLocale", () => {
  it("falls back to English when the value is missing", () => {
    expect(resolveLocale(undefined)).toBe(defaultLocale);
    expect(resolveLocale(null)).toBe(defaultLocale);
    expect(resolveLocale("")).toBe(defaultLocale);
  });

  it("keeps a known language", () => {
    expect(resolveLocale("en")).toBe("en");
    expect(resolveLocale("ru")).toBe("ru");
  });

  it("falls back to English for an unknown language", () => {
    expect(resolveLocale("de")).toBe(defaultLocale);
    expect(resolveLocale("ru-RU")).toBe(defaultLocale);
  });

  it("recognises only the two catalog languages", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("ru")).toBe(true);
    expect(isLocale("de")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

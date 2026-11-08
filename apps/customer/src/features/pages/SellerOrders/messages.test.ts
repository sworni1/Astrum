import { describe, expect, it } from "vitest";
import en from "../../../../messages/en.json";
import ru from "../../../../messages/ru.json";

type Messages = Record<string, unknown>;

const CATALOGS = { en, ru } as const;
type Locale = keyof typeof CATALOGS;

const load = (locale: Locale): Messages => CATALOGS[locale] as Messages;

const flatten = (value: unknown, prefix = ""): Record<string, string> => {
  if (typeof value !== "object" || value === null) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<
    Record<string, string>
  >((flat, [key, entry]) => {
    const path = prefix ? `${prefix}.${key}` : key;

    if (typeof entry === "string") {
      flat[path] = entry;
      return flat;
    }

    return { ...flat, ...flatten(entry, path) };
  }, {});
};

const seller = (locale: "en" | "ru"): Record<string, string> =>
  flatten(load(locale).seller);

const placeholders = (text: string): string[] =>
  [...text.matchAll(/\{\s*([a-zA-Z][a-zA-Z0-9_]*)/g)]
    .map((match) => match[1])
    .sort();

describe("seller catalog", () => {
  it("carries the same keys in english and russian (AC-12)", () => {
    expect(Object.keys(seller("ru")).sort()).toEqual(
      Object.keys(seller("en")).sort(),
    );
  });

  it("leaves no string empty in either language (AC-12)", () => {
    for (const locale of ["en", "ru"] as const) {
      const empty = Object.entries(seller(locale))
        .filter(([, text]) => text.trim() === "")
        .map(([key]) => key);

      expect({ locale, empty }).toEqual({ locale, empty: [] });
    }
  });

  it("passes the same values into both languages (AC-12)", () => {
    const en = seller("en");
    const ru = seller("ru");

    for (const key of Object.keys(en)) {
      expect({ key, args: placeholders(ru[key] ?? "") }).toEqual({
        key,
        args: placeholders(en[key]),
      });
    }
  });

  it("keeps the russian panel readable rather than an english copy (AC-12)", () => {
    const en = seller("en");
    const ru = seller("ru");
    const withCyrillic = Object.values(ru).filter((text) =>
      /[А-Яа-яЁё]/.test(text),
    );

    expect(ru.title).not.toBe(en.title);
    expect(withCyrillic.length).toBeGreaterThan(20);
  });
});

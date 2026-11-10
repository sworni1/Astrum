import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import ru from "../../messages/ru.json";

type Catalog = Record<string, unknown>;

const CATALOGS = { en, ru } as const;
type Locale = keyof typeof CATALOGS;

const load = (locale: Locale): Catalog => CATALOGS[locale] as Catalog;

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

const namespace = (locale: Locale, name: string): Record<string, string> =>
  flatten(load(locale)[name]);

const placeholders = (text: string): string[] =>
  [...text.matchAll(/\{\s*([a-zA-Z][a-zA-Z0-9_]*)/g)]
    .map((match) => match[1])
    .sort();

describe("message catalogs", () => {
  it("carry the same keys in english and russian in every namespace (AC-13)", () => {
    for (const name of Object.keys(load("en"))) {
      expect({ name, keys: Object.keys(namespace("ru", name)).sort() }).toEqual(
        {
          name,
          keys: Object.keys(namespace("en", name)).sort(),
        },
      );
    }
  });

  it("leaves no string empty in either language (AC-13)", () => {
    for (const locale of ["en", "ru"] as const) {
      const empty = Object.keys(load(locale))
        .flatMap((name) => Object.entries(namespace(locale, name)))
        .filter(([, text]) => text.trim() === "")
        .map(([key]) => key);

      expect({ locale, empty }).toEqual({ locale, empty: [] });
    }
  });

  it("passes the same values into both languages (AC-13)", () => {
    for (const name of Object.keys(load("en"))) {
      const english = namespace("en", name);
      const russian = namespace("ru", name);

      for (const key of Object.keys(english)) {
        expect({ key, args: placeholders(russian[key] ?? "") }).toEqual({
          key,
          args: placeholders(english[key]),
        });
      }
    }
  });

  it("keeps every russian namespace readable rather than an english copy (AC-13)", () => {
    for (const name of Object.keys(load("ru"))) {
      const texts = Object.values(namespace("ru", name));
      const translated = texts.filter((text) => /[А-Яа-яЁё]/.test(text));

      expect({ name, translated: translated.length > 0 }).toEqual({
        name,
        translated: true,
      });
    }
  });
});

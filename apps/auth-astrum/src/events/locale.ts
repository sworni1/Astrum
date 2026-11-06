export type LetterLocale = "en" | "ru";

const LETTER_LOCALES: readonly LetterLocale[] = ["en", "ru"];

export const DEFAULT_LETTER_LOCALE: LetterLocale = "en";

const isLetterLocale = (value: string): value is LetterLocale =>
  (LETTER_LOCALES as readonly string[]).includes(value);

/**
 * The storefront sends one explicit language, so the first tag wins and an
 * unknown or missing header falls back to English instead of reaching the
 * broker as an unreadable value.
 */
export const resolveLetterLocale = (
  header: string | undefined,
): LetterLocale => {
  const first = header?.split(",")[0]?.split(";")[0]?.trim().toLowerCase();
  const base = first?.split("-")[0];

  return base && isLetterLocale(base) ? base : DEFAULT_LETTER_LOCALE;
};

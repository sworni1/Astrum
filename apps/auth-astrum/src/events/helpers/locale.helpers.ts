import {
  DEFAULT_LETTER_LOCALE,
  LETTER_LOCALES,
} from "../constants/locale.constants";
import type { LetterLocale } from "../types/events.types";

const isLetterLocale = (value: string): value is LetterLocale =>
  (LETTER_LOCALES as readonly string[]).includes(value);

export const resolveLetterLocale = (
  header: string | undefined,
): LetterLocale => {
  const first = header?.split(",")[0]?.split(";")[0]?.trim().toLowerCase();
  const base = first?.split("-")[0];

  return base && isLetterLocale(base) ? base : DEFAULT_LETTER_LOCALE;
};

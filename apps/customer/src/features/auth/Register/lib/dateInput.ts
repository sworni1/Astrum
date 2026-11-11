import { format, isValid, parse } from "date-fns";

export const DATE_FORMAT = "dd.MM.yyyy";
export const OLDEST_BIRTH_YEAR = 1900;
export const DEFAULT_AGE_YEARS = 18;

export function maskDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);

  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)]
    .filter((part) => part.length > 0)
    .join(".");
}

export function parseDateInput(text: string): Date | undefined {
  if (text.length !== DATE_FORMAT.length) return undefined;

  const parsed = parse(text, DATE_FORMAT, new Date());

  if (!isValid(parsed)) return undefined;

  return format(parsed, DATE_FORMAT) === text ? parsed : undefined;
}

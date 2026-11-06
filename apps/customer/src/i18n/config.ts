export const LOCALE_COOKIE = "NEXT_LOCALE";
export const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const locales = ["en", "ru"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (locales as readonly string[]).includes(value);

export const resolveLocale = (value: unknown): Locale =>
  isLocale(value) ? value : defaultLocale;

/** The letter follows the page: an explicit header, never the browser default. */
export const localeHeader = (locale: Locale): string => locale;

export const acceptLanguage = (): Record<string, string> => ({
  "Accept-Language": readLocaleCookie(),
});

export const readLocaleCookie = (): Locale => {
  if (typeof document === "undefined") {
    return defaultLocale;
  }

  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LOCALE_COOKIE}=`));

  if (!match) {
    return defaultLocale;
  }

  return resolveLocale(
    decodeURIComponent(match.slice(LOCALE_COOKIE.length + 1)),
  );
};

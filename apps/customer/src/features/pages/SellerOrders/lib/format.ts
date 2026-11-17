let cachedTimeZone: string | undefined;

/**
 * The request config pins the formatter to UTC, so the browser zone is passed on
 * every date this screen shows. Eleven features read it from here today (the
 * debt spec 0025 recorded), so it stays the single source (spec 0026, AC-9).
 */
export const browserTimeZone = (): string => {
  cachedTimeZone ??= Intl.DateTimeFormat().resolvedOptions().timeZone;

  return cachedTimeZone;
};

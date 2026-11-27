let cachedTimeZone: string | undefined;

export const browserTimeZone = (): string => {
  cachedTimeZone ??= Intl.DateTimeFormat().resolvedOptions().timeZone;

  return cachedTimeZone;
};

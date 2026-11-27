export const toDate = (value: unknown): Date | undefined => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

export const completeYearsSince = (dateOfBirth: Date, now: Date): number => {
  const years = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const beforeBirthdayThisYear =
    now.getUTCMonth() < dateOfBirth.getUTCMonth() ||
    (now.getUTCMonth() === dateOfBirth.getUTCMonth() &&
      now.getUTCDate() < dateOfBirth.getUTCDate());

  return beforeBirthdayThisYear ? years - 1 : years;
};

export const minAgeMessage = (minYears: number): string =>
  `You must be at least ${minYears} years old`;

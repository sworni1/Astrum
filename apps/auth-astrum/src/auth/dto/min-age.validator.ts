import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from "class-validator";

export const MIN_AGE_YEARS = 14;

const FUTURE_MESSAGE = "Date of birth cannot be in the future";
function toDate(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function completeYearsSince(dateOfBirth: Date, now: Date): number {
  const years = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const beforeBirthdayThisYear =
    now.getUTCMonth() < dateOfBirth.getUTCMonth() ||
    (now.getUTCMonth() === dateOfBirth.getUTCMonth() &&
      now.getUTCDate() < dateOfBirth.getUTCDate());

  return beforeBirthdayThisYear ? years - 1 : years;
}

export function MinAge(years: number, validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: "minAge",
      target: object.constructor,
      propertyName,
      constraints: [years],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const dateOfBirth = toDate(value);

          if (!dateOfBirth) {
            return true;
          }

          const now = new Date();

          if (dateOfBirth.getTime() > now.getTime()) {
            return false;
          }

          const [minYears] = args.constraints as [number];

          return completeYearsSince(dateOfBirth, now) >= minYears;
        },
        defaultMessage(args: ValidationArguments): string {
          const dateOfBirth = toDate(args.value);

          if (dateOfBirth && dateOfBirth.getTime() > Date.now()) {
            return FUTURE_MESSAGE;
          }

          const [minYears] = args.constraints as [number];

          return `You must be at least ${minYears} years old`;
        },
      },
    });
  };
}

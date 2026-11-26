import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from "class-validator";
import { FUTURE_BIRTH_DATE_MESSAGE } from "../constants/auth.constants";
import {
  completeYearsSince,
  minAgeMessage,
  toDate,
} from "../helpers/min-age.helpers";

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
            return FUTURE_BIRTH_DATE_MESSAGE;
          }

          const [minYears] = args.constraints as [number];

          return minAgeMessage(minYears);
        },
      },
    });
  };
}

import { Expose, Transform } from "class-transformer";
import {
  IsString,
  Validate,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from "class-validator";
import {
  normalizeShopName,
  SHOP_NAME_MAX_LENGTH,
  SHOP_NAME_MIN_LENGTH,
  shopNameProblem,
} from "../shop-name";

@ValidatorConstraint({ name: "shopName", async: false })
class ShopNameConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === "string" && shopNameProblem(value) === null;
  }

  defaultMessage(): string {
    return `name must be ${SHOP_NAME_MIN_LENGTH} to ${SHOP_NAME_MAX_LENGTH} characters without control or format characters`;
  }
}

export class CreateOnboardingDto {
  @Expose()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? normalizeShopName(value) : value,
  )
  @IsString()
  @Validate(ShopNameConstraint)
  name!: string;
}

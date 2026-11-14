import { Expose } from "class-transformer";
import { IsString, Length } from "class-validator";

/**
 * `validateDto` runs with `excludeExtraneousValues: true`, so a field without
 * `@Expose()` is stripped before validation and a valid body turns into a 422
 * (spec 0017).
 */
export class CreatePointWorkerDto {
  @Expose()
  @IsString()
  @Length(1, 64)
  pickupPointId!: string;
}

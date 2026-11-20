import { Expose } from "class-transformer";
import { IsString, Length } from "class-validator";

export class CreatePointWorkerDto {
  @Expose()
  @IsString()
  @Length(1, 64)
  pickupPointId!: string;
}

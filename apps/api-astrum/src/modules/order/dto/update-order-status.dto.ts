import { Expose } from "class-transformer";
import { IsEnum } from "class-validator";
import { OrderStatus } from "@astrum/db/enums";

export class UpdateOrderStatusDto {
  @Expose()
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}

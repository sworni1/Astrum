import { OrderStatus } from "@astrum/db/enums";
import { Expose } from "class-transformer";
import { IsEnum } from "class-validator";

export class UpdateOrderStatusDto {
  @Expose()
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}

import { Expose } from "class-transformer";
import { IsEnum } from "class-validator";
import { OrderItemStatus } from "../../../../generated/prisma/enums";

export class UpdateOrderItemStatusDto {
  @Expose()
  @IsEnum(OrderItemStatus)
  status!: OrderItemStatus;
}

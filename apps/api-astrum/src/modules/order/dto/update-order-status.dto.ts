import { Expose } from "class-transformer";
import { IsEnum } from "class-validator";
import { OrderStatus } from "../../../../generated/prisma/enums";

/**
 * Only cancellation is accepted today (AC-4); a body with another status passes
 * validation and is refused by the service with INVALID_STATUS_TRANSITION.
 */
export class UpdateOrderStatusDto {
  @Expose()
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}

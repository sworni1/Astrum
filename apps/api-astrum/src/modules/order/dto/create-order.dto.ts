import type { PaymentMethod } from "@astrum/db/enums";
import { Expose, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { CHOOSABLE_PAYMENT_METHODS } from "../../payment/constants/payment.constants";
import {
  MAX_LINE_QUANTITY,
  MAX_ORDER_LINES,
} from "../constants/order.constants";

class OrderItemDto {
  @Expose()
  @IsNotEmpty()
  @IsString()
  productId!: string;

  @Expose()
  @IsInt()
  @Min(1)
  @Max(MAX_LINE_QUANTITY)
  quantity!: number;
}

export class CreateOrderDto {
  @Expose()
  @ValidateIf((dto: CreateOrderDto) => !dto.pickupPointId)
  @IsNotEmpty()
  @IsString()
  deliveryAddress?: string | null;

  @Expose()
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  pickupPointId?: string;

  @Expose()
  @IsNotEmpty()
  @IsDateString()
  deliveryDate!: Date;

  @Expose()
  @IsNotEmpty()
  @IsString()
  shippingMethodId!: string;

  @Expose()
  @IsNotEmpty()
  @IsIn([...CHOOSABLE_PAYMENT_METHODS])
  paymentMethod!: PaymentMethod;

  @Expose()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ORDER_LINES)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  orderItems!: OrderItemDto[];
}

export type { OrderItemDto };

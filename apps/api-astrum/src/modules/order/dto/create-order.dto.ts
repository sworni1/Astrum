import { Expose, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { PaymentMethod } from "../../../../generated/prisma/enums";
import { MAX_LINE_QUANTITY, MAX_ORDER_LINES } from "../order.constants";

/**
 * A line names what to buy and how many. Price, name and image come from the
 * product record on the server, so a body that carries them is stripped here.
 */
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
  @IsNotEmpty()
  @IsString()
  deliveryAddress!: string;

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
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @Expose()
  @IsNotEmpty()
  @IsString()
  paymentDetails!: string;

  @Expose()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ORDER_LINES)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  orderItems!: OrderItemDto[];
}

export type { OrderItemDto };

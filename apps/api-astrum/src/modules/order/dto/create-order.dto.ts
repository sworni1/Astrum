import { Expose, Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { PaymentMethod } from "../../../../generated/prisma/enums";

class OrderItemDto {
  @Expose()
  @IsNotEmpty()
  @IsString()
  productId!: string;

  @Expose()
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  name!: string;

  @Expose()
  @IsString()
  @IsNotEmpty()
  previewImage!: string;

  @Expose()
  @IsNotEmpty()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  quantity!: number;

  @Expose()
  @IsNotEmpty()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  price!: number;
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
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  orderItems!: OrderItemDto[];
}

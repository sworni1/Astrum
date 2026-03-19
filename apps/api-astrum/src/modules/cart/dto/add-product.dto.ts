import { IsString, IsNotEmpty, IsInt, IsUUID } from 'class-validator';
import { Expose } from 'class-transformer';
import { Product } from '../../../../generated/prisma/client';

export class AddProductToCartDto {
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  @Expose()
  productId!: Product['id'];
}

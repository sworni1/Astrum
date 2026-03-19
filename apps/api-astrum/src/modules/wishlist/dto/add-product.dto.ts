import { IsString, IsNotEmpty, IsUUID } from 'class-validator';
import { Expose } from 'class-transformer';
import { Product } from '../../../../generated/prisma/client';

export class AddProductToWishlistDto {
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  @Expose()
  productId!: Product['id'];
}

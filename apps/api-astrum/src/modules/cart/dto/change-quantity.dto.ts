import { IsInt, IsNotEmpty } from 'class-validator';
import { Expose } from 'class-transformer';
import { CartItem } from '../../../../generated/prisma/client';

export class ChangeQuantityDto {
  @IsInt()
  @IsNotEmpty()
  @Expose()
  quantity!: CartItem['quantity'];
}

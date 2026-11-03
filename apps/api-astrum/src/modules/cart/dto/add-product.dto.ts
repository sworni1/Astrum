import { Expose } from "class-transformer";
import { IsNotEmpty, IsString, IsUUID } from "class-validator";
import type { Product } from "../../../../generated/prisma/client";

export class AddProductToCartDto {
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  @Expose()
  productId!: Product["id"];
}

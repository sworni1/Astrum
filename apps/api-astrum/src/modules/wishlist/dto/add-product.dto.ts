import type { Product } from "@astrum/db/client";
import { Expose } from "class-transformer";
import { IsNotEmpty, IsString, IsUUID } from "class-validator";

export class AddProductToWishlistDto {
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  @Expose()
  productId!: Product["id"];
}

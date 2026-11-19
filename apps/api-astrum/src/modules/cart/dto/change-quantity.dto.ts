import { Expose } from "class-transformer";
import { IsInt, IsNotEmpty } from "class-validator";
import type { CartItem } from "@astrum/db/client";

export class ChangeQuantityDto {
  @IsInt()
  @IsNotEmpty()
  @Expose()
  quantity!: CartItem["quantity"];
}

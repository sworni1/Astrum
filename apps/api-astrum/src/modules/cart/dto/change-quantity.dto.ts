import type { CartItem } from "@astrum/db/client";
import { Expose } from "class-transformer";
import { IsInt, IsNotEmpty } from "class-validator";

export class ChangeQuantityDto {
  @IsInt()
  @IsNotEmpty()
  @Expose()
  quantity!: CartItem["quantity"];
}

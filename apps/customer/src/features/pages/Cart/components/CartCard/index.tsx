"use client";

import { Card, CardContent } from "../../../../../components/ui/card";
import { Checkbox } from "../../../../../components/ui/checkbox";
import Image from "next/image";
import { ProductCartProps } from "../../../../../common/types/product.types";
import { ToggleWishlistItemButton } from "../../../../general/ProductCard/actions";
import AddToCartWithQuantity from "./actions/AddToCartWithQuantity";
import RemoveFromCartButton from "./actions/RemoveFromCartButton";
import Link from "next/link";

const CartCard = ({
  id,
  name,
  quantity,
  quantityInCart,
  isWishlisted,
  price,
  previewImage,
  isSelected = false,
  onSelectionChange,
}: ProductCartProps) => {
  return (
    <Card className={`overflow-hidden p-0 transition-all `}>
      <CardContent className="p-0">
        <div className="flex h-full flex-col md:flex-row">
          <div className="relative h-auto w-full md:w-37">
            {/* Checkbox overlay on image */}
            <div className="absolute z-10 bg-white text-center p-[7px] border-none border-0 rounded-none rounded-br-[8px]">
              <Checkbox
                checked={isSelected}
                onCheckedChange={onSelectionChange}
                className="border-gray-400 data-[state=checked]:bg-gray-900 data-[state=checked]:border-gray-900 w-4 h-4"
              />
            </div>

            <Link href={`/products/${id}`}>
              <Image
                unoptimized
                src={previewImage}
                alt={name}
                width={500}
                height={500}
                className="h-full w-full object-cover"
              />
            </Link>
          </div>

          <div className="flex-1 p-6 pb-3">
            <div className="flex justify-between">
              <div>
                <Link href={`/products/${id}`}>
                  <h3 className="font-medium">{name}</h3>
                </Link>

                <p className="text-muted-foreground text-sm">
                  {"Grey"} • {15}
                </p>
                <p className="text-sm font-medium mt-1">
                  ${price.toFixed(2)} each
                </p>
              </div>

              <RemoveFromCartButton id={id} />
            </div>

            <div className="mt-4 flex items-center justify-between">
              <ToggleWishlistItemButton
                productId={id}
                isWishlisted={isWishlisted}
              />
              <AddToCartWithQuantity
                productId={id}
                quantity={quantity}
                size={"sm"}
                quantityInCart={quantityInCart}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CartCard;

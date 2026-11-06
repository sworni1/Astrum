"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ProductCartProps } from "../../../../../common/types/product.types";
import { Card, CardContent } from "../../../../../components/ui/card";
import { ToggleWishlistItemButton } from "../../../../general/ProductCard/actions";
import AddToCartWithQuantity from "./actions/AddToCartWithQuantity";
import RemoveFromCartButton from "./actions/RemoveFromCartButton";
import SelectionButton from "./actions/SelectionButton";

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
  const t = useTranslations("cart");

  return (
    <Card
      className={`overflow-hidden p-0 transition-all ${isSelected ? "border border-primary" : ""}`}
    >
      <CardContent className="p-0">
        <div className="flex h-full flex-col md:flex-row">
          <div className="relative h-auto w-full md:w-37">
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
                  {t("eachPrice", { price: price.toFixed(2) })}
                </p>
              </div>

              <div>
                <SelectionButton
                  onSelectionChange={onSelectionChange}
                  isSelected={isSelected}
                />
                <RemoveFromCartButton id={id} />
              </div>
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

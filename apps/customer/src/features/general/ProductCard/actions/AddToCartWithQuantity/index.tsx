"use client";

import { Loader2, Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { showToast } from "../../../../../common";
import { Button } from "../../../../../components/ui/button";
import {
  useAddProductToCart,
  useChangeProductCartQuantity,
  useDeleteProductFromCart,
} from "../../../../../hooks/product/useCart";

type Props = {
  productId: string;
  quantity: number;
  size: "full" | "sm";
  quantityInCart: number;
};

const AddToCartWithQuantity = ({
  productId,
  quantity,
  size,
  quantityInCart,
}: Props) => {
  const t = useTranslations("cart");
  const widthClass = size === "full" ? "w-full" : "w-full sm:w-[14rem]";

  const { addProductToCartTrigger, addProductToCartError } =
    useAddProductToCart();
  const { changeProductCartQuantityTrigger, changeProductCartQuantityError } =
    useChangeProductCartQuantity(productId);
  const { deleteProductFromCartTrigger, deleteProductFromCartError } =
    useDeleteProductFromCart(productId);

  const [localQuantity, setLocalQuantity] = useState(quantityInCart || 0);
  const [loading, setLoading] = useState(false);

  const handleAddToCart = async () => {
    try {
      setLoading(true);
      const res = await addProductToCartTrigger({ productId });
      setLocalQuantity(res.quantityInCart);
    } catch (e) {
      console.error("addToCart error", e);
    } finally {
      setLoading(false);
    }
  };

  const handleMinusProduct = async () => {
    try {
      setLoading(true);
      const newQuantity = localQuantity - 1;
      if (newQuantity > 0) {
        const res = await changeProductCartQuantityTrigger({
          quantity: newQuantity,
        });
        setLocalQuantity(res.quantityInCart);
      } else {
        await deleteProductFromCartTrigger();
        setLocalQuantity(0);
      }
    } catch (e) {
      console.error("minusProduct error", e);
    } finally {
      setLoading(false);
    }
  };

  const handlePlusProduct = async () => {
    try {
      setLoading(true);
      const newQuantity = localQuantity + 1;
      if (newQuantity <= quantity) {
        const res = await changeProductCartQuantityTrigger({
          quantity: newQuantity,
        });
        setLocalQuantity(res.quantityInCart);
      } else {
        console.warn("Product quantity limit");
      }
    } catch (e) {
      console.error("plusProduct error", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLocalQuantity(quantityInCart);
  }, [quantityInCart]);

  if (deleteProductFromCartError) {
    showToast({
      title: t("removeFailed"),
      type: "error",
    });
  }

  if (changeProductCartQuantityError) {
    showToast({
      title: t("quantityFailed"),
      type: "error",
    });
  }

  if (addProductToCartError) {
    showToast({
      title: t("addFailed"),
      type: "error",
    });
  }

  return (
    <div className="flex-1 content-center">
      {localQuantity > 0 ? (
        <div
          className={`inline-flex justify-around ${widthClass} items-center`}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-center" />
          ) : (
            <>
              <Button
                variant="secondary"
                size="icon"
                onClick={handleMinusProduct}
                disabled={loading}
              >
                <Minus className="h-4 w-4" />
              </Button>

              <div className="min-w-[30px] text-center">{localQuantity}</div>

              <Button
                variant="secondary"
                size="icon"
                onClick={handlePlusProduct}
                disabled={loading || quantity === localQuantity}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      ) : (
        <Button
          className={widthClass}
          onClick={handleAddToCart}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            t("addToCart")
          )}
        </Button>
      )}
    </div>
  );
};

export default AddToCartWithQuantity;

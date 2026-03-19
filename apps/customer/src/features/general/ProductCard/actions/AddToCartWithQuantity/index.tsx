"use client";

import { useEffect, useState } from "react";
import { Button } from "../../../../../components/ui/button";
import { Minus, Plus, Loader2 } from "lucide-react";
import {
  useAddProductToCart,
  useChangeProductCartQuantity,
  useDeleteProductFromCart,
} from "../../../../../hooks/product/useCart";
import { showToast } from "../../../../../common";

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
      title: "Error!",
      type: "error",
      description: "Failed to remove product from cart",
    });
  }

  if (changeProductCartQuantityError) {
    showToast({
      title: "Error!",
      type: "error",
      description: "Failed to change product quantity in cart",
    });
  }

  if (addProductToCartError) {
    showToast({
      title: "Error!",
      type: "error",
      description: "Failed to add product to cart",
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
            "Add to Cart"
          )}
        </Button>
      )}
    </div>
  );
};

export default AddToCartWithQuantity;

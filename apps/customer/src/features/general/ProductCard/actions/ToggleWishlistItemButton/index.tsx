"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { MdFavorite, MdFavoriteBorder } from "react-icons/md";
import { showToast } from "../../../../../common";
import { Button } from "../../../../../components/ui/button";
import {
  useAddProductToWishlist,
  useDeleteProductFromWishlist,
} from "../../../../../hooks";

type Props = {
  productId: string;
  isWishlisted: boolean;
  size?: "lg" | "default" | "sm" | "icon" | null | undefined;
};

const ToggleWishlistItemButton = ({
  productId,
  isWishlisted,
  size = "lg",
}: Props) => {
  const t = useTranslations("wishlist");
  const {
    addProductToWishlistTrigger,
    addProductToWishlistLoading,
    addProductToWishlistError,
  } = useAddProductToWishlist(productId);

  const {
    deleteProductToWishlistTrigger,
    deleteProductToWishlistLoading,
    deleteProductFromWishlistError,
  } = useDeleteProductFromWishlist(productId);

  const [wishlistState, setWishlistState] = useState(isWishlisted);

  useEffect(() => {
    setWishlistState(isWishlisted);
  }, [isWishlisted]);

  const handleWishlistToggle = async () => {
    try {
      if (wishlistState) {
        await deleteProductToWishlistTrigger();
        setWishlistState(false);
      } else {
        await addProductToWishlistTrigger({ productId });
        setWishlistState(true);
      }
    } catch (error) {
      console.error("Failed to update wishlist:", error);
      setWishlistState(!wishlistState);
    }
  };

  if (addProductToWishlistError) {
    showToast({
      title: t("addFailed"),
      type: "error",
    });
  }

  if (deleteProductFromWishlistError) {
    showToast({
      title: t("removeFailed"),
      type: "error",
    });
  }

  return (
    <Button
      disabled={addProductToWishlistLoading || deleteProductToWishlistLoading}
      variant="outline"
      size={size}
      onClick={handleWishlistToggle}
      className="transition-all duration-200 hover:scale-105 active:scale-95"
    >
      {wishlistState ? (
        <MdFavorite
          size={25}
          className="text-red-600 transition-colors duration-200"
        />
      ) : (
        <MdFavoriteBorder
          size={25}
          className="transition-colors duration-200 hover:text-red-400"
        />
      )}
    </Button>
  );
};

export default ToggleWishlistItemButton;

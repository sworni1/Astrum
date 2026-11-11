"use client";

import { useTranslations } from "next-intl";
import { showToast } from "@/common/helpers/showToast";
import ProductCardsSkeleton from "@/components/skeletons/ProductCardsSkeleton/ProductCardsSkeleton";
import ProductCard from "@/features/general/ProductCard";
import { useGetWishlist } from "@/hooks/product/useWishlist/useGetWishlist";

const WishList = () => {
  const t = useTranslations("wishlist");
  const { wishlist, wishlistIsLoading, wishlistError } = useGetWishlist();

  if (wishlistError) {
    showToast({
      title: t("failed"),
      type: "error",
    });
  }

  if (!wishlist || wishlist.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        {t("empty")}
      </div>
    );
  }

  return (
    <section className="py-8 antialiased md:py-12">
      <div className="mx-auto max-w-screen-2xl px-4 2xl:px-3">
        <div className="mb-4 items-end justify-between space-y-4 sm:flex sm:space-y-0 md:mb-8">
          <h2 className="mt-3 text-xl font-semibold text-gray-900 dark:text-white sm:text-2xl">
            {t("title")}
          </h2>
        </div>

        <div className="mb-4 grid gap-4 sm:grid-cols-2 md:mb-8 lg:grid-cols-3 xl:grid-cols-4">
          {!wishlistIsLoading && wishlist ? (
            wishlist.map((product) => (
              <ProductCard key={product.id} {...product} />
            ))
          ) : (
            <ProductCardsSkeleton />
          )}
        </div>
      </div>
    </section>
  );
};

export default WishList;

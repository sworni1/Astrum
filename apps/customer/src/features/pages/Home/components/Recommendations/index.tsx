"use client";

import { useTranslations } from "next-intl";
import { showToast } from "../../../../../common";
import { ProductCardsSkeleton } from "../../../../../components/skeletons";
import { useInfiniteScroll } from "../../../../../hooks";
import { useGetRecommendations } from "../../../../../hooks/product/useProducts";
import ProductCard from "../../../../general/ProductCard";

export default function Recommendations() {
  const t = useTranslations("home");
  const {
    previewRecommendations,
    previewRecommendationsIsLoading,
    previewRecommendationsIsValidating,
    previewRecommendationsError,
    setSize,
  } = useGetRecommendations();

  const { products, observerRef, hasNextPage } = useInfiniteScroll({
    data: previewRecommendations,
    isLoading: previewRecommendationsIsLoading,
    isValidating: previewRecommendationsIsValidating,
    setSize,
  });

  if (previewRecommendationsError) {
    showToast({
      title: t("recommendationsFailed"),
      type: "error",
    });
  }

  return (
    <section className="py-8 antialiased md:py-12">
      <div className="mx-auto max-w-screen-2xl px-4 2xl:px-3">
        <div className="mb-4 items-end justify-between space-y-4 sm:flex sm:space-y-0 md:mb-8">
          <h2 className="mt-3 text-xl font-semibold text-gray-900 dark:text-white sm:text-2xl">
            {t("recommendations")}
          </h2>
        </div>

        <div className="mb-4 grid gap-4 grid-cols-1 sm:grid-cols-2 md:mb-8 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} {...product} />
          ))}

          {hasNextPage
            ? (previewRecommendationsIsLoading ||
                previewRecommendationsIsValidating) && <ProductCardsSkeleton />
            : products.length > 0 && (
                <div className="col-span-full text-center py-2 text-gray-500">
                  {t("recommendationsEnd")}
                </div>
              )}

          <div ref={observerRef} />
        </div>
      </div>
    </section>
  );
}

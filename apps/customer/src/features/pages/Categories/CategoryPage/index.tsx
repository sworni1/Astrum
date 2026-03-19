"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useInfiniteScroll } from "../../../../hooks";
import { ProductCardsSkeleton } from "../../../../components/skeletons";
import ProductCard from "../../../general/ProductCard";
import { useGetCategoryProducts } from "../../../../hooks/product/useProducts";
import { showToast } from "../../../../common";

export const CategoryPage = () => {
  const params = useParams<{ category: string }>();
  const searchParams = useSearchParams();

  const category = params.category;
  const search_query = searchParams.get("search_query") || "";

  const {
    previewProductsByCategory,
    previewProductsByCategoryIsValidating,
    previewProductsByCategoryLoading,
    previewProductsByCategoryError,
    setSize,
  } = useGetCategoryProducts(category, search_query);

  const { products, observerRef, hasNextPage } = useInfiniteScroll({
    data: previewProductsByCategory,
    isLoading: previewProductsByCategoryLoading,
    isValidating: previewProductsByCategoryIsValidating,
    setSize,
  });

  if (previewProductsByCategoryError) {
    showToast({
      title: "Error!",
      type: "error",
      description: "Failed to load preview products by category",
    });
  }

  return (
    <section className="py-8 antialiased md:py-12">
      <div className="mx-auto max-w-screen-2xl px-4 2xl:px-3">
        <div className="mb-4 items-end justify-between space-y-4 sm:flex sm:space-y-0 md:mb-8">
          <h2 className="mt-3 text-xl font-semibold text-gray-900 dark:text-white sm:text-2xl">
            Results
          </h2>
        </div>

        <div className="mb-4 grid gap-4 grid-cols-1 sm:grid-cols-2 md:mb-8 lg:grid-cols-3 xl:grid-cols-4">
          {products.length > 0 ? (
            products.map((product) => (
              <ProductCard key={product.id} {...product} />
            ))
          ) : (
            <div className="col-span-full text-center py-8 text-gray-500">
              No more recommendations
            </div>
          )}

          <div ref={observerRef} className="h-10" />

          {hasNextPage
            ? (previewProductsByCategoryLoading ||
                previewProductsByCategoryIsValidating) && (
                <ProductCardsSkeleton />
              )
            : products.length > 0 && (
                <div className="col-span-full text-center py-8 text-gray-500">
                  No more recommendations
                </div>
              )}
        </div>
      </div>
    </section>
  );
};

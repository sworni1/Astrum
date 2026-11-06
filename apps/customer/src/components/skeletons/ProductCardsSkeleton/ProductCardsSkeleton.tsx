import ProductCardSkeleton from "./ProductCardSkeleton/ProductCardSkeleton";

export default function ProductCardsSkeleton() {
  const skeletonIds = Array.from(
    { length: 8 },
    (_, index) => `product-skeleton-${index + 1}`,
  );

  return (
    <>
      {skeletonIds.map((id) => (
        <ProductCardSkeleton key={id} />
      ))}
    </>
  );
}

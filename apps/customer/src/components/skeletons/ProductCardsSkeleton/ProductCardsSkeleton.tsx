import ProductCardSkeleton from "./ProductCardSkeleton/ProductCardSkeleton";

export default function ProductCardsSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </>
  );
}

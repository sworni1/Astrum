import { ProductCategory } from "@astrum/db/enums";

export const resolveProductCategory = (
  segment: string,
): ProductCategory | undefined => {
  const normalized = segment.toLowerCase();

  return (Object.values(ProductCategory) as ProductCategory[]).find(
    (value) => value.toLowerCase() === normalized,
  );
};

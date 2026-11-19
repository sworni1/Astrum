import { ProductCategory, PropertyLabel } from "@/common/types/product.types";

export type CategoryLabelKey = `category.${ProductCategory}`;
export type PropertyLabelKey = `property.${PropertyLabel}`;

export const categoryLabelKey = (value: ProductCategory): CategoryLabelKey =>
  `category.${value}`;

export const propertyLabelKey = (value: PropertyLabel): PropertyLabelKey =>
  `property.${value}`;

export const categorySlug = (value: ProductCategory): string =>
  value.toLowerCase();

export const categoryFromSlug = (slug: string): ProductCategory | null => {
  const wanted = slug.toLowerCase();

  return (
    (Object.values(ProductCategory) as ProductCategory[]).find(
      (value) => value.toLowerCase() === wanted,
    ) ?? null
  );
};

export const isPropertyLabel = (value: string): value is PropertyLabel =>
  (Object.values(PropertyLabel) as string[]).includes(value);

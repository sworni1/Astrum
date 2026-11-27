import type { ProductCategory } from "@astrum/db/enums";
import { invalidQuery, unknownCategory } from "./product.errors";
import { resolveProductCategory } from "./product-category.helpers";

export const ALL_CATEGORY_SLUG = "all";

export const resolveCatalogueCategory = (
  segment: string,
): ProductCategory | undefined => {
  if (segment.toLowerCase() === ALL_CATEGORY_SLUG) {
    return undefined;
  }

  const category = resolveProductCategory(segment);

  if (category === undefined) {
    throw unknownCategory(segment);
  }

  return category;
};

export const readQueryString = (
  raw: unknown,
  name: string,
): string | undefined => {
  if (raw === undefined) {
    return undefined;
  }

  if (typeof raw === "string") {
    return raw;
  }

  throw invalidQuery(name);
};

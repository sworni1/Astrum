import { categoryList } from "../constants/category.list";

export const isCategoryExists = (category?: string) => {
  if (!category) return false;

  const categoryValues = categoryList.map((category) => category.href);

  return categoryValues.includes(category);
};

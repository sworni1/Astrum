import type { ReviewState } from "./review.types";

export enum Currency {
  RUB = "RUB",
  USD = "USD",
}

export type ProductCardProps = {
  id: string;
  name: string;
  previewImage: string;
  images?: string[];
  quantity: number;
  price: number;
  discount: number;
  stars: number;
  currency: Currency;
  _count: {
    impressions: number;
  };
  isWishlisted: boolean;
  quantityInCart: number;
};

export type ProductCartProps = {
  id: string;
  quantity: number;
  name: string;
  isWishlisted: boolean;
  quantityInCart: number;
  price: number;
  previewImage: string;
  isSelected?: boolean;
  onSelectionChange?: (checked: boolean) => void;
};

export type GetRecommendationsType = {
  products: ProductCardProps[];
  nextCursor?: string;
  hasNextPage: boolean;
};

//
export enum PropertyLabel {
  Color = "Color",
  Size = "Size",
  Material = "Material",
  Brand = "Brand",
  Weight = "Weight",
  Dimensions = "Dimensions",
  Warranty = "Warranty",
  EnergyEfficiency = "EnergyEfficiency",
  StorageCapacity = "StorageCapacity",
  OperatingSystem = "OperatingSystem",
  Processor = "Processor",
  GraphicsCard = "GraphicsCard",
  ScreenSize = "ScreenSize",
  BatteryLife = "BatteryLife",
}

export enum ProductCategory {
  Electronics = "Electronics",
  Fashion = "Fashion",
  Home = "Home",
  Food = "Food",
  Beauty = "Beauty",
  Books = "Books",
  Sports = "Sports",
  Toys = "Toys",
  Automotive = "Automotive",
}

export enum ProductStatus {
  Draft = "Draft",
  Published = "Published",
  Discontinued = "Discontinued",
}

export enum ProductVisibility {
  Public = "Public",
  Private = "Private",
  Archived = "Archived",
  Draft = "Draft",
}

export interface Impression {
  id: string;
  stars: number;
  comment: string;
  photos: string[];
  userId: string;
  productId: string;
  Product?: Product;
}

export interface WishlistItem {
  id: string;
  createdAt: Date;
  userId: string;
  productId: string;
}

export interface CartItem {
  id: string;
  createdAt: Date;
  userId: string;
  productId: string;
  quantity: number;
}

export interface ProductProperty {
  id: string;
  label: PropertyLabel;
  value: string;
  productId: string;
  Product?: Product;
}

export interface Product {
  id: string;
  businessId: string;
  createdAt: Date;
  name: string;
  quantity: number;
  description?: string | null;
  price: number;
  discount?: number | null;
  stars: number;
  popularity: number;
  category: ProductCategory;
  currency: Currency;
  isDeleted: boolean;
  isOutOfStock: boolean;
  visibility: ProductVisibility;
  status: ProductStatus;
  images: string[];
  previewImage: string;
  sales: number;
  views: number;
  impressions: Impression[];
  properties: ProductProperty[];
}

export interface ProductOverview {
  id: string;
  businessId: string;
  name: string;
  quantity: number;
  description?: string | null;
  price: number;
  discount?: number | null;
  stars: number;
  popularity: number;
  category: ProductCategory;
  currency: Currency;
  isDeleted: boolean;
  isOutOfStock: boolean;
  images: string[];
  sales: number;
  views: number;
  impressions: Impression[];
  properties: ProductProperty[];
  _count: {
    impressions: number;
  };
  isWishlisted: boolean;
  quantityInCart: number;
  reviewState: ReviewState;
}

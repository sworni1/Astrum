import {
  Currency,
  ProductCategory,
  ProductVisibility,
  PropertyLabel,
} from "@astrum/db/enums";
import { Expose, Transform } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { MAX_PRODUCT_QUANTITY } from "../constants/product.constants";

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

export class CreateProductDto {
  @Expose()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  name!: string;

  @Expose()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(1000)
  description!: string;

  @Expose()
  @IsInt()
  @Min(1)
  @Max(MAX_PRODUCT_QUANTITY)
  quantity!: number;

  @Expose()
  @IsNumber()
  @IsPositive()
  price!: number;

  @Expose()
  @IsNumber()
  @Min(0)
  @IsOptional()
  discount?: number;

  @Expose()
  @IsEnum(ProductCategory)
  category!: ProductCategory;

  @Expose()
  @IsEnum(Currency)
  currency!: Currency;

  @Expose()
  @IsArray()
  @IsUrl({}, { each: true })
  @IsOptional()
  images?: string[];

  @Expose()
  @IsString()
  @IsNotEmpty()
  previewImage!: string;

  @Expose()
  @IsBoolean()
  @IsOptional()
  isOutOfStock?: boolean;

  @Expose()
  @IsEnum(ProductVisibility)
  @IsOptional()
  visibility?: ProductVisibility;
}

export class ProductPropertyDto {
  @IsEnum(PropertyLabel)
  label!: PropertyLabel;

  @IsString()
  @IsNotEmpty()
  value!: string;
}

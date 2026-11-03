import { Expose } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from "class-validator";
import {
  Currency,
  ProductCategory,
  ProductVisibility,
  PropertyLabel,
} from "../../../../generated/prisma/enums";

export class CreateProductDto {
  @Expose()
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  name!: string;

  @Expose()
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(1000)
  description!: string;

  @Expose()
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @Expose()
  @IsNumber()
  @IsPositive()
  price!: number;

  @Expose()
  @IsNumber()
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

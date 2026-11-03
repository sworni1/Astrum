import { Expose } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
} from "class-validator";

export class CreateReviewDto {
  @Expose() @IsString() @IsNotEmpty() productId!: string;

  @Expose() @IsString() @IsNotEmpty() orderItemId!: string;

  @Expose() @IsInt() @Min(1) @Max(5) rating!: number;

  @Expose() @IsInt() @Min(1) @Max(5) qualityRating!: number;

  @Expose() @IsInt() @Min(1) @Max(5) deliveryRating!: number;

  @Expose() @IsInt() @Min(1) @Max(5) accuracyRating!: number;

  @Expose() @IsString() @IsNotEmpty() @MinLength(5) comment!: string;

  @Expose()
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  photos?: string[];
}

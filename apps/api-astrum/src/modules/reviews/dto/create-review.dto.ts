import { Expose, Transform } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import {
  REVIEW_COMMENT_MAX_LENGTH,
  REVIEW_COMMENT_MIN_LENGTH,
} from "../constants/reviews.constants";

/** The comment is trimmed before validation, so the length is the real one. */
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

/**
 * No `productId`: the product comes from the path, and a body product is
 * dropped here rather than trusted (spec 0012, AC-11).
 */
export class CreateReviewDto {
  @Expose() @IsString() @IsNotEmpty() orderItemId!: string;

  @Expose() @IsInt() @Min(1) @Max(5) rating!: number;

  @Expose() @IsInt() @Min(1) @Max(5) qualityRating!: number;

  @Expose() @IsInt() @Min(1) @Max(5) deliveryRating!: number;

  @Expose() @IsInt() @Min(1) @Max(5) accuracyRating!: number;

  @Expose()
  @Transform(trim)
  @IsString()
  @MinLength(REVIEW_COMMENT_MIN_LENGTH)
  @MaxLength(REVIEW_COMMENT_MAX_LENGTH)
  comment!: string;

  @Expose()
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  photos?: string[];
}

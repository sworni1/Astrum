import { Expose, Transform } from "class-transformer";
import { IsString, MaxLength, MinLength } from "class-validator";
import {
  REVIEW_COMMENT_MAX_LENGTH,
  REVIEW_COMMENT_MIN_LENGTH,
} from "../constants/reviews.constants";
import { trim } from "../helpers/review-input.helpers";

export class CreateReviewCommentDto {
  @Expose()
  @Transform(trim)
  @IsString()
  @MinLength(REVIEW_COMMENT_MIN_LENGTH)
  @MaxLength(REVIEW_COMMENT_MAX_LENGTH)
  body!: string;
}

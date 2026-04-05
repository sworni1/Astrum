import { Expose } from 'class-transformer';
import { IsString, IsInt, IsOptional, Min, Max } from 'class-validator';

export class ReviewQueryDto {
  @Expose() @IsOptional() @IsString() after?: string;

  @Expose() @IsOptional() @IsInt() @Min(1) @Max(100) limit?: number;
}
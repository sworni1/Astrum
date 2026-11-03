import { Expose } from "class-transformer";
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class UpdateUserDto {
  @IsString()
  @MaxLength(25, {
    message: "Nickname cannot exceed 25 characters",
  })
  @IsOptional()
  @Expose()
  nickName?: string;

  @IsEmail()
  @IsOptional()
  @Expose()
  email?: string;
}

export class updateUserPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(8, {
    message: "Old password must be at least 8 characters",
  })
  @MaxLength(25, {
    message: "Old password cannot exceed 25 characters",
  })
  @Expose()
  oldPassword!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, {
    message: "New password must be at least 8 characters",
  })
  @MaxLength(25, {
    message: "New password cannot exceed 25 characters",
  })
  @Expose()
  newPassword!: string;
}

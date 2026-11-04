import { ApiProperty } from "@nestjs/swagger";
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { Gender } from "../../../generated/prisma/enums";
import { MIN_AGE_YEARS, MinAge } from "./min-age.validator";

export class RegisterUserDto {
  @IsNotEmpty()
  @IsEmail()
  @ApiProperty({
    required: true,
    default: "example@gmail.com",
    nullable: false,
    description: "Email",
  })
  email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8, {
    message: "Password must be at least 8 characters",
  })
  @MaxLength(25, {
    message: "Password cannot exceed 25 characters",
  })
  @ApiProperty({
    required: true,
    default: "qwertyuiop",
    minLength: 8,
    maxLength: 25,
    nullable: false,
    description: "Password",
  })
  password: string;

  @IsNotEmpty()
  @IsEnum(Gender)
  @ApiProperty({
    required: true,
    default: "Male",
    nullable: false,
    description: "Gender",
  })
  gender: Gender;

  @IsNotEmpty()
  @IsDateString()
  @MinAge(MIN_AGE_YEARS)
  @ApiProperty({
    required: true,
    nullable: false,
    description: "Date of birth, at least 14 years ago",
  })
  dateOfBirth: Date;

  @IsString()
  @IsOptional()
  @MaxLength(25, {
    message: "Nickname cannot exceed 25 characters",
  })
  @ApiProperty({
    required: false,
    default: "Oleg228",
    nullable: true,
    description: "nick name",
  })
  nickName?: string;
}

export class SignInUserDto {
  @IsNotEmpty()
  @IsEmail()
  @ApiProperty({
    required: true,
    default: "example@gmail.com",
    nullable: false,
    description: "Email",
  })
  email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8, {
    message: "Password must be at least 8 characters",
  })
  @MaxLength(25, {
    message: "Password cannot exceed 25 characters",
  })
  @ApiProperty({
    required: true,
    default: "qwertyuiop",
    minLength: 8,
    nullable: false,
    description: "Password",
  })
  password: string;
}

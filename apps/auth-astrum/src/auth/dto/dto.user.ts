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
import { Gender } from "@astrum/db/enums";
import {
  MIN_AGE_YEARS,
  NICKNAME_MAX_LENGTH,
  NICKNAME_MAX_LENGTH_MESSAGE,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MAX_LENGTH_MESSAGE,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MIN_LENGTH_MESSAGE,
} from "../constants/auth.constants";
import { MinAge } from "./min-age.validator";

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
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: PASSWORD_MIN_LENGTH_MESSAGE,
  })
  @MaxLength(PASSWORD_MAX_LENGTH, {
    message: PASSWORD_MAX_LENGTH_MESSAGE,
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
  @MaxLength(NICKNAME_MAX_LENGTH, {
    message: NICKNAME_MAX_LENGTH_MESSAGE,
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
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: PASSWORD_MIN_LENGTH_MESSAGE,
  })
  @MaxLength(PASSWORD_MAX_LENGTH, {
    message: PASSWORD_MAX_LENGTH_MESSAGE,
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

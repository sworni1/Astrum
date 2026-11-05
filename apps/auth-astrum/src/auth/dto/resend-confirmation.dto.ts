import { IsEmail, IsNotEmpty } from "class-validator";

export class ResendConfirmationDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;
}

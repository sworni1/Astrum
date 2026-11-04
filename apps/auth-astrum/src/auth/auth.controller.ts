import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { RegisterUserDto, SignInUserDto } from "./dto";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @HttpCode(HttpStatus.OK)
  @Post("register")
  @ApiOperation({ description: "Register a new user" })
  @ApiResponse({ status: HttpStatus.OK, description: "Success" })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "The user already exists",
  })
  signup(
    @Body() dto: RegisterUserDto,
    @Headers("user-agent") userAgent?: string,
  ) {
    return this.authService.register(dto, userAgent);
  }

  @HttpCode(HttpStatus.OK)
  @Post("signin")
  @ApiOperation({ description: "Log in to account" })
  @ApiResponse({ status: HttpStatus.OK, description: "Success" })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "The user does not exist",
  })
  signin(
    @Body() dto: SignInUserDto,
    @Headers("user-agent") userAgent?: string,
  ) {
    return this.authService.signin(dto, userAgent);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("logout")
  @ApiOperation({ description: "End the session carried by the __auth cookie" })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: "Session revoked, or nothing to revoke",
  })
  async logout(@Req() req: Request): Promise<void> {
    const cookies = req.cookies as { __auth?: string } | undefined;

    await this.authService.logout(cookies?.__auth);
  }
}

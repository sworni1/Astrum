import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { confirmRedirectUrl } from "../config/auth.config";
import { AuthService } from "./auth.service";
import { RegisterUserDto, ResendConfirmationDto, SignInUserDto } from "./dto";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(
    private authService: AuthService,
    private config: ConfigService,
  ) {}

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

  @Get("confirm")
  @ApiOperation({ description: "Confirm the address carried by the token" })
  @ApiResponse({
    status: HttpStatus.FOUND,
    description: "Redirect to the page",
  })
  async confirm(
    @Query("token") token: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const outcome = await this.authService.confirm(token);
    const storefrontUrl = this.config.get<string>("STOREFRONT_URL") ?? "";

    res.redirect(HttpStatus.FOUND, confirmRedirectUrl(storefrontUrl, outcome));
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("confirm/resend")
  @ApiOperation({ description: "Send another confirmation letter" })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: "Answered without body in every outcome",
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "The address is not a valid email",
  })
  async resend(
    @Body() dto: ResendConfirmationDto,
    @Req() req: Request,
  ): Promise<void> {
    await this.authService.resend(dto.email, req.ip);
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

import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { AuthService } from "./auth.service";
import type { RegisterUserDto, SignInUserDto } from "./dto";

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
  signup(@Body() dto: RegisterUserDto) {
    return this.authService.register(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post("signin")
  @ApiOperation({ description: "Log in to account" })
  @ApiResponse({ status: HttpStatus.OK, description: "Success" })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "The user does not exist",
  })
  signin(@Body() dto: SignInUserDto) {
    return this.authService.signin(dto);
  }
}

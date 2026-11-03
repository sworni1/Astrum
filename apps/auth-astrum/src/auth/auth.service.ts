import { ForbiddenException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import * as argon from "argon2";
import type { User } from "../../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { RegisterUserDto, SignInUserDto } from "./dto";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}
  async signToken(userId: User["id"]) {
    const payload = {
      userId: userId,
    };

    const secret = await this.config.get("JWT_SECRET");

    const token = await this.jwt.signAsync(payload, {
      expiresIn: "1d",
      secret: secret,
    });

    return { token: token, expiresIn: "1d" };
  }
  async register(dto: RegisterUserDto) {
    try {
      const passwordhash = await argon.hash(dto.password);

      delete dto.password;

      const user = await this.prisma.user.create({
        data: {
          passwordhash: passwordhash,
          ...dto,
        },
      });

      return this.signToken(user.id);
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError) {
        if (err.code === "P2002") {
          throw new ForbiddenException("The user already exists");
        }
        throw err;
      }
    }
  }
  async signin(dto: SignInUserDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });
    if (!user) throw new ForbiddenException("The user does not exist");

    const pwMatches = await argon.verify(user.passwordhash, dto.password);

    if (!pwMatches) throw new ForbiddenException("Password is incorrect");

    return this.signToken(user.id);
  }
}

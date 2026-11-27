import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Prisma } from "@astrum/db/client";
import { PrismaService } from "../../prisma/prisma.service";
import { JWT_SECRET_KEY } from "../constants/auth.constants";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get(JWT_SECRET_KEY),
    });
  }

  async validate(payload: { sub: string; email: string }) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      delete user.passwordhash;
      return user;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        throw err;
      }
    }
  }
}

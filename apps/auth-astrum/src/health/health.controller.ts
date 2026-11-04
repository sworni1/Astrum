import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @ApiOperation({
    description:
      "Liveness probe with a database and a session store round trip",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Service, database and session store ready",
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: "Database or session store unreachable",
  })
  async check(@Res() res: Response) {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      await this.redis.ping();
      res.status(HttpStatus.OK).json({
        status: "ok",
        instance: process.env.HOSTNAME ?? "unknown",
      });
    } catch {
      res
        .status(HttpStatus.SERVICE_UNAVAILABLE)
        .json({ status: "unavailable" });
    }
  }
}

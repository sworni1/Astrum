import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ description: "Liveness probe with a database round trip" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Service and database ready",
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: "Database unreachable",
  })
  async check(@Res() res: Response) {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
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

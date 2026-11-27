import type { Request } from "express";

export type JwtData = {
  userId: string;
  sid?: string;
  iat: number;
  exp: number;
};

export type AuthenticatedRequest = Request & { userId: string; sid: string };
export type AuthenticatedUserRequest = Request &
  Pick<AuthenticatedRequest, "userId">;

import type { Request } from "express";

export type JwtData = {
  userId: string;
  sid?: string;
  iat: number;
  exp: number;
};

/** Set by `authenticateToken` once the token and its session record agree. */
export type AuthenticatedRequest = Request & { userId: string; sid: string };
export type AuthenticatedUserRequest = Request &
  Pick<AuthenticatedRequest, "userId">;

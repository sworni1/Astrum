import type { Request } from "express";
import { verify } from "jsonwebtoken";

import type { JwtData } from "../../common/types/jwt.payload";
import { AUTH_COOKIE_NAME } from "../constants/session.constants";

export const authCookie = (req: Request): string | undefined =>
  (req.cookies as { __auth?: string } | undefined)?.[AUTH_COOKIE_NAME];

export const verifySessionToken = (token: string): JwtData =>
  verify(token, process.env.JWT_SECRET as string, {
    algorithms: ["HS256"],
  }) as JwtData;

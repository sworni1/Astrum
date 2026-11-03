import type { NextFunction, Request, Response } from "express";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { verify } from "jsonwebtoken";

import type { JwtData } from "../common/types/jwt.payload";

type RequestWithUser = Request & { userId?: string };

const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.cookies as { __auth?: string } | undefined;

  if (!authHeader || !authHeader.__auth) {
    res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ message: ReasonPhrases.UNAUTHORIZED });
    return;
  }

  const token = authHeader.__auth;

  try {
    const decoded = verify(token, process.env.JWT_SECRET as string) as JwtData;

    (req as RequestWithUser).userId = decoded.userId;

    next();
  } catch {
    res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ message: "Invalid or expired token" });
  }
};

export default authenticateToken;

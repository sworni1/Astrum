import type { Request, Response } from "express";

export const routeOf = (req: Request): { method: string; path: string } => ({
  method: req.method,
  path: `${req.baseUrl}${req.path}`,
});

export const refuse = (
  res: Response,
  status: number,
  code: string,
  message: string,
): void => {
  res.status(status).json({ code, message });
};

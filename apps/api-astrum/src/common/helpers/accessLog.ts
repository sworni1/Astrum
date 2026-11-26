import type { Request } from "express";

import { CONFIRM_PATH } from "../constants/app.constants";

export const isConfirmRequest = (req: Request): boolean =>
  req.method === "GET" &&
  (req.originalUrl || req.url).split("?")[0] === CONFIRM_PATH;

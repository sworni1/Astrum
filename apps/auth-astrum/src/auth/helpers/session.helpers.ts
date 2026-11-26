import { randomBytes } from "node:crypto";
import type { User } from "@astrum/db/client";
import {
  SESSION_ID_BYTES,
  USER_AGENT_MAX_LENGTH,
} from "../constants/auth.constants";

export const createSessionId = (): string =>
  randomBytes(SESSION_ID_BYTES).toString("base64url");

export const buildSessionRecord = (
  userId: User["id"],
  userAgent?: string | null,
): string =>
  JSON.stringify({
    userId,
    createdAt: new Date().toISOString(),
    userAgent: userAgent ? userAgent.slice(0, USER_AGENT_MAX_LENGTH) : null,
  });

import { createHash, randomBytes } from "node:crypto";

export const TOKEN_TTL_SECONDS = 86_400;

const TOKEN_BYTES = 32;

export const mintRawToken = (): string =>
  randomBytes(TOKEN_BYTES).toString("base64url");

export const hashToken = (raw: string): string =>
  createHash("sha256").update(raw).digest("hex");

export const expiresAtFrom = (mintedAt: Date): Date =>
  new Date(mintedAt.getTime() + TOKEN_TTL_SECONDS * 1000);

export const confirmationLink = (
  storefrontUrl: string,
  rawToken: string,
): string =>
  `${storefrontUrl}/api-gateway/auth/confirm?token=${encodeURIComponent(rawToken)}`;

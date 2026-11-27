export const CORS_FALLBACK_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

export const CORS_ALLOWED_HEADERS =
  "Content-Type, Authorization, Access-Control-Allow-Origin, Idempotency-Key";

export const CORS_EXPOSED_HEADERS = ["Idempotent-Replay"];

export const corsAllowedOrigins = (
  env: NodeJS.ProcessEnv = process.env,
): string[] => {
  const raw = env.CORS_ALLOWED_ORIGINS?.trim();

  if (!raw) {
    return [...CORS_FALLBACK_ORIGINS];
  }

  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
};

export const corsOptions = {
  origin: corsAllowedOrigins(),
  allowedHeaders: CORS_ALLOWED_HEADERS,
  exposedHeaders: CORS_EXPOSED_HEADERS,
  credentials: true,
};

export const CORS_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

export const CORS_ALLOWED_HEADERS =
  "Content-Type, Authorization, Access-Control-Allow-Origin, Idempotency-Key";

export const CORS_EXPOSED_HEADERS = ["Idempotent-Replay"];

export const corsOptions = {
  origin: CORS_ALLOWED_ORIGINS,
  allowedHeaders: CORS_ALLOWED_HEADERS,
  exposedHeaders: CORS_EXPOSED_HEADERS,
  credentials: true,
};

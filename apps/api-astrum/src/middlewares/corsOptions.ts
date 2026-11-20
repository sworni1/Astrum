const corsOptions = {
  origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
  allowedHeaders:
    "Content-Type, Authorization, Access-Control-Allow-Origin, Idempotency-Key",

  exposedHeaders: ["Idempotent-Replay"],
  credentials: true,
};

export default corsOptions;

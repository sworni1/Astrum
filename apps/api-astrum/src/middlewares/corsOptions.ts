const corsOptions = {
  origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
  allowedHeaders:
    "Content-Type, Authorization, Access-Control-Allow-Origin, Idempotency-Key",
  // A cross origin caller can read this header only when it is named here.
  exposedHeaders: ["Idempotent-Replay"],
  credentials: true,
};

export default corsOptions;

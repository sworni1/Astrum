import { resolve } from "node:path";
import { config } from "dotenv";

config({
  path: [
    resolve(__dirname, "../../api-astrum/.env"),
    resolve(__dirname, "../.env"),
  ],
});

process.env.JWT_SECRET ??= "test-jwt-secret";
process.env.AUTH_SERVICE_URL ??= "http://localhost:4580/api/auth";

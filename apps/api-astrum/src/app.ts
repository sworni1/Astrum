import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express, type Request } from "express";
import helmet from "helmet";
import { StatusCodes } from "http-status-codes";
import morgan from "morgan";
import { prisma } from "../lib/prisma";
import proxyOptions from "./common/helpers/proxyOptions";
import { createAuthenticateToken } from "./middlewares/authenticateToken";
import corsOptions from "./middlewares/corsOptions";
import cartRoutes from "./modules/cart/cart.routes";
import orderRoutes from "./modules/order/order.routes";
import productRoutes from "./modules/product/product.routes";
import { reviewsRouter } from "./modules/reviews/reviews.routes";
import userRoutes from "./modules/user/user.routes";
import wishlistRoutes from "./modules/wishlist/wishlist.routes";
import { getSessionStore } from "./session/sessionStore";

const app: Express = express();
const sessionStore = getSessionStore();
const authenticateToken = createAuthenticateToken(sessionStore);
const authServiceUrl = process.env.AUTH_SERVICE_URL;

if (!authServiceUrl) {
  throw new Error("AUTH_SERVICE_URL is required");
}

app.set("trust proxy", 1);
app.disable("x-powered-by");

const CONFIRM_PATH = "/api/auth/confirm";

app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
const isConfirmRequest = (req: Request): boolean =>
  req.method === "GET" &&
  (req.originalUrl || req.url).split("?")[0] === CONFIRM_PATH;

app.use(morgan("dev", { skip: isConfirmRequest }));
app.use(cors(corsOptions));
app.options("/{*splat}", cors(corsOptions));

app.use((_req, res, next) => {
  res.setHeader("X-Instance", process.env.HOSTNAME ?? "unknown");
  next();
});

app.use("/api/auth", proxyOptions(authServiceUrl));

app.use(express.json({ limit: "10mb" }));
app.use(
  express.urlencoded({ extended: true, limit: "10mb", parameterLimit: 10000 }),
);
app.use(cookieParser());

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await sessionStore.ping();
    res.status(StatusCodes.OK).json({
      status: "ok",
      instance: process.env.HOSTNAME ?? "unknown",
    });
  } catch {
    res.status(StatusCodes.SERVICE_UNAVAILABLE).json({ status: "unavailable" });
  }
});

app.use("/api/users", authenticateToken, userRoutes);
app.use("/api/products", authenticateToken, productRoutes);
app.use("/api/wishlist", authenticateToken, wishlistRoutes);
app.use("/api/cart", authenticateToken, cartRoutes);
app.use("/api/orders", authenticateToken, orderRoutes);
app.use("/api/reviews", authenticateToken, reviewsRouter);

app.get("/", (_req, res) => {
  res.send("Astrum backend is running...");
});

export default app;

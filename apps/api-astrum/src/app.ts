import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { StatusCodes } from "http-status-codes";
import morgan from "morgan";
import { prisma } from "../lib/prisma";
import {
  ACCESS_LOG_FORMAT,
  HEALTH_OK,
  HEALTH_UNAVAILABLE,
  INSTANCE_HEADER,
  JSON_BODY_LIMIT,
  ROOT_MESSAGE,
  TRUST_PROXY_HOPS,
  URLENCODED_BODY_LIMIT,
  URLENCODED_PARAMETER_LIMIT,
} from "./common/constants/app.constants";
import { isConfirmRequest } from "./common/helpers/accessLog";
import { instanceName } from "./common/helpers/instance";
import proxyOptions from "./common/helpers/proxyOptions";
import { createAuthenticateToken } from "./middlewares/authenticateToken";
import { corsOptions } from "./middlewares/constants/cors.constants";
import { createOptionalAuth } from "./middlewares/resolveOwner";
import cartRoutes from "./modules/cart/cart.routes";
import orderRoutes from "./modules/order/order.routes";
import sellerOrderRoutes from "./modules/order/seller-order.routes";
import paymentWebhookRoutes, {
  STRIPE_WEBHOOK_PATH,
} from "./modules/payment/payment.routes";
import pickupRoutes from "./modules/pickup/pickup.routes";
import productRoutes from "./modules/product/product.routes";
import { reviewsRouter } from "./modules/reviews/reviews.routes";
import sellerOnboardingRoutes from "./modules/seller/onboarding.routes";
import shippingRoutes from "./modules/shipping/shipping.routes";
import staffRoutes from "./modules/staff/staff.routes";
import userRoutes from "./modules/user/user.routes";
import wishlistRoutes from "./modules/wishlist/wishlist.routes";
import { getSessionStore } from "./session/sessionStore";

const app: Express = express();
const sessionStore = getSessionStore();
const authenticateToken = createAuthenticateToken(sessionStore);
const optionalAuth = createOptionalAuth(sessionStore);
const authServiceUrl = process.env.AUTH_SERVICE_URL;

if (!authServiceUrl) {
  throw new Error("AUTH_SERVICE_URL is required");
}

app.set("trust proxy", TRUST_PROXY_HOPS);
app.disable("x-powered-by");

app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));

app.use(morgan(ACCESS_LOG_FORMAT, { skip: isConfirmRequest }));
app.use(cors(corsOptions));
app.options("/{*splat}", cors(corsOptions));

app.use((_req, res, next) => {
  res.setHeader(INSTANCE_HEADER, instanceName());
  next();
});

app.use("/api/auth", proxyOptions(authServiceUrl));

app.use(STRIPE_WEBHOOK_PATH, paymentWebhookRoutes);

app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(
  express.urlencoded({
    extended: true,
    limit: URLENCODED_BODY_LIMIT,
    parameterLimit: URLENCODED_PARAMETER_LIMIT,
  }),
);
app.use(cookieParser());

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await sessionStore.ping();
    res.status(StatusCodes.OK).json({
      status: HEALTH_OK,
      instance: instanceName(),
    });
  } catch {
    res
      .status(StatusCodes.SERVICE_UNAVAILABLE)
      .json({ status: HEALTH_UNAVAILABLE });
  }
});

app.use("/api/users", authenticateToken, userRoutes);

app.use("/api/products", optionalAuth, productRoutes);
app.use("/api/wishlist", optionalAuth, wishlistRoutes);
app.use("/api/cart", optionalAuth, cartRoutes);
app.use("/api/orders", authenticateToken, orderRoutes);
app.use(
  "/api",
  authenticateToken,
  sellerOrderRoutes,
  sellerOnboardingRoutes,
  shippingRoutes,
  pickupRoutes,
  staffRoutes,
);
app.use("/api/reviews", authenticateToken, reviewsRouter);

app.get("/", (_req, res) => {
  res.send(ROOT_MESSAGE);
});

export default app;

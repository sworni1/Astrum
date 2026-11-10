import { Router } from "express";
import { ShippingController } from "./shipping.controller";

const shippingController = new ShippingController();

const shippingRoutes: Router = Router();

shippingRoutes.get("/shipping-methods", shippingController.getShippingMethods);

export default shippingRoutes;

import { Router } from "express";
import { PickupController } from "./pickup.controller";

const pickupController = new PickupController();

const pickupRoutes: Router = Router();

pickupRoutes.get("/pickup-points", pickupController.getPickupPoints);

export default pickupRoutes;

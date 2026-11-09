import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { requireActiveAccount } from "../../middlewares/requireActiveAccount";
import { validateDto } from "../../middlewares/validateDto";
import { CreateOnboardingDto } from "./dto/create-onboarding.dto";
import { SellerOnboardingController } from "./onboarding.controller";
import { SELLER_ERROR_CODES } from "./seller.constants";

const onboardingController = new SellerOnboardingController();
const sellerOnboardingRoutes: Router = Router();

sellerOnboardingRoutes.post(
  "/seller/onboarding",
  requireActiveAccount,
  validateDto(CreateOnboardingDto, {
    status: StatusCodes.UNPROCESSABLE_ENTITY,
    code: SELLER_ERROR_CODES.validation,
  }),
  onboardingController.createShop,
);

export default sellerOnboardingRoutes;

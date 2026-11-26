import { type Currency, Prisma, type ShippingMethod } from "@astrum/db/client";
import { AppError } from "../../common/helpers/appError";
import { ORDER_ERROR_CODES } from "./constants/order.constants";

type DeliveryChoice = {
  method: ShippingMethod;
  name: string;
  price: Prisma.Decimal;
};

export const assertShippingMethod = (
  method: ShippingMethod | null,
  currency: Currency,
): DeliveryChoice => {
  if (!method) {
    throw new AppError(
      409,
      ORDER_ERROR_CODES.unknownShippingMethod,
      "The selected delivery method does not exist.",
    );
  }

  if (!method.isActive) {
    throw new AppError(
      409,
      ORDER_ERROR_CODES.shippingMethodInactive,
      "The selected delivery method is no longer offered.",
    );
  }

  if (method.currency !== currency) {
    throw new AppError(
      409,
      ORDER_ERROR_CODES.shippingCurrencyMismatch,
      "The selected delivery method is priced in another currency.",
    );
  }

  return {
    method,
    name: method.name,
    price: new Prisma.Decimal(method.price).toDecimalPlaces(2),
  };
};

export const resolvePickupPoint = async (
  tx: Prisma.TransactionClient,
  method: ShippingMethod,
  requestedPointId: string | undefined,
): Promise<{ id: string; name: string; address: string } | null> => {
  if (!method.isPickup) {
    if (requestedPointId === undefined) {
      return null;
    }

    throw new AppError(
      409,
      ORDER_ERROR_CODES.pickupPointNotAllowed,
      "The selected delivery method does not hand over at a pickup point.",
    );
  }

  if (requestedPointId === undefined) {
    throw new AppError(
      409,
      ORDER_ERROR_CODES.pickupPointRequired,
      "The selected delivery method needs a pickup point.",
    );
  }

  const point = await tx.pickupPoint.findUnique({
    where: { id: requestedPointId },
    select: { id: true, name: true, address: true, isActive: true },
  });

  if (!point) {
    throw new AppError(
      409,
      ORDER_ERROR_CODES.unknownPickupPoint,
      "The selected pickup point does not exist.",
    );
  }

  if (!point.isActive) {
    throw new AppError(
      409,
      ORDER_ERROR_CODES.pickupPointInactive,
      "The selected pickup point is closed.",
    );
  }

  return { id: point.id, name: point.name, address: point.address };
};

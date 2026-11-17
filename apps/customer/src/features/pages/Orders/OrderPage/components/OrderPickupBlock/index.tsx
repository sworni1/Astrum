import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Order } from "@/common/types/order.types";

type Props = {
  order: Order;
};

/**
 * Where the parcel goes: the pickup point with its address, or the delivery
 * address. It prints no date, because the receiving card owns that one
 * (spec 0027, AC-4).
 */
const OrderPickupBlock = ({ order }: Props) => {
  const t = useTranslations("orders");
  const isPickup = order.pickupPointId !== null;

  return (
    <div
      className="rounded-stat border border-border bg-background p-5"
      data-testid="order-pickup-block"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-secondary">
          <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden />
        </div>
        <div className="font-medium">
          {isPickup ? t("pickupPoint") : t("deliveryAddress")}
        </div>
      </div>
      <div className="mt-3 space-y-1 text-sm">
        {isPickup ? (
          <>
            <p>{order.pickupPointName}</p>
            <p className="text-muted-foreground">{order.pickupPointAddress}</p>
          </>
        ) : (
          <p>{order.deliveryAddress}</p>
        )}
      </div>
    </div>
  );
};

export default OrderPickupBlock;

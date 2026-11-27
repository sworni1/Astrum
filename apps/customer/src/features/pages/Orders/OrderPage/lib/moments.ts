import type { Order } from "@/common/types/order.types";

export const arrivedOn = (order: Order): string | null => {
  const stamps = order.orderItems
    .map((line) => line.receiptDate)
    .filter((date): date is string => typeof date === "string");

  if (stamps.length === 0) {
    return null;
  }

  return stamps.reduce((earliest, current) =>
    new Date(current).getTime() < new Date(earliest).getTime()
      ? current
      : earliest,
  );
};

export const issueStamp = (order: Order): string | null => order.handedOverAt;

export type ReceivingMoment = {
  labelKey: "expectedOn" | "deliveredOn" | "handedOverOn";
  stamp: Date | string;
};

export const receivingMoment = (order: Order): ReceivingMoment => {
  const issued = issueStamp(order);

  if (issued !== null) {
    return { labelKey: "handedOverOn", stamp: issued };
  }

  const arrived = arrivedOn(order);

  if (arrived !== null) {
    return { labelKey: "deliveredOn", stamp: arrived };
  }

  return { labelKey: "expectedOn", stamp: order.deliveryDate };
};

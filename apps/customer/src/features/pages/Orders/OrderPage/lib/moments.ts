import type { Order } from "@/common/types/order.types";

/**
 * The arrival moment. The delivery pass writes one timestamp for every line, so
 * the block picks the earliest non null `receiptDate` rather than trusting the
 * first row: the detail read sets no order on the lines, and the order carries
 * no arrival column of its own (spec 0031, AC-10).
 */
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

/** The issue moment lives on the order, never on a line (spec 0031, AC-10). */
export const issueStamp = (order: Order): string | null => order.handedOverAt;

/** The copy key and the moment the receiving block prints (spec 0031, AC-10). */
export type ReceivingMoment = {
  labelKey: "expectedOn" | "deliveredOn" | "handedOverOn";
  stamp: Date | string;
};

/**
 * Three moments, three named sources: the issue stamp on the order, the arrival
 * date from the lines, and the promised day the buyer picked at checkout.
 */
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

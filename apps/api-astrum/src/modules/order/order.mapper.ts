import type { Currency, Order, OrderItem, Prisma } from "@astrum/db/client";
import type { OrderStatus } from "@astrum/db/enums";
import { toMoney } from "../../common/helpers/money";
import { SOLD_LINE_STATUSES } from "./constants/order.constants";
import type {
  OrderDetail,
  OrderDetailLine,
  OrderListCounts,
  OrderListPage,
  OrderSpentRow,
} from "./types/order.types";

type OrderDetailExtras = {
  paidAt: Date | null;
  brandNames: Map<string, string>;
  kinds: Map<string, string | null>;
};

export const toOrderDetail = (
  order: Order & { OrderItem: OrderItem[] },
  extras?: OrderDetailExtras,
): OrderDetail => {
  const { OrderItem: orderItems, ...rest } = order;

  if (!extras) {
    return { ...rest, orderItems };
  }

  return {
    ...rest,
    paidAt: extras.paidAt,
    orderItems: orderItems.map((item) => ({
      ...item,
      brandName: extras.brandNames.get(item.businessId) ?? "",
      kind: extras.kinds.get(item.productId) ?? null,
    })),
  };
};

type StatusGroup = {
  status: OrderStatus;
  _count: { _all: number };
};

type CurrencyGroup = {
  currency: Currency;
  _sum: { grandTotal: Prisma.Decimal | null };
};

export const countByStatus = (groups: StatusGroup[]): OrderListCounts => {
  const of = (status: OrderStatus): number =>
    groups.find((group) => group.status === status)?._count._all ?? 0;

  return {
    all: groups.reduce((sum, group) => sum + group._count._all, 0),
    delivered: SOLD_LINE_STATUSES.reduce((sum, status) => sum + of(status), 0),
    canceled: of("CANCELED"),
  };
};

export const spentByCurrency = (groups: CurrencyGroup[]): OrderSpentRow[] =>
  groups
    .flatMap((group) =>
      group._sum.grandTotal === null
        ? []
        : [{ currency: group.currency, amount: group._sum.grandTotal }],
    )
    .sort((left, right) => left.currency.localeCompare(right.currency));

const toLineJson = (item: OrderDetailLine) => {
  const {
    businessId: _businessId,
    userId: _userId,
    brandName,
    kind,
    ...visible
  } = item;

  const resolved =
    brandName === undefined
      ? {}
      : {
          brandName,
          kind: kind ?? null,
          subtotal: toMoney(Number(item.price) * item.quantity),
        };

  return { ...visible, price: toMoney(item.price), ...resolved };
};

type OrderRow = Pick<Order, "idempotencyKey" | "idempotencyHash">;

const withoutIdempotency = <T extends OrderRow>(
  row: T,
): Omit<T, "idempotencyKey" | "idempotencyHash"> => {
  const { idempotencyKey, idempotencyHash, ...rest } = row;

  return rest;
};

export const toOrderJson = (order: OrderDetail) => {
  const { userId: _userId, ...visible } = withoutIdempotency(order);

  return {
    ...visible,
    totalPrice: toMoney(order.totalPrice),
    deliveryPrice: toMoney(order.deliveryPrice),
    grandTotal: toMoney(order.grandTotal),
    orderItems: order.orderItems.map(toLineJson),
  };
};

export const toOrderListJson = (page: OrderListPage) => ({
  items: page.items.map((row) => ({
    ...row,
    grandTotal: toMoney(row.grandTotal),
  })),
  counts: page.counts,
  spent: page.spent.map((entry) => ({
    currency: entry.currency,
    amount: toMoney(entry.amount),
  })),
  page: page.page,
  limit: page.limit,
  total: page.total,
  totalPages: page.totalPages,
});

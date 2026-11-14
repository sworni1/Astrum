import type { OrderItem } from "../../../generated/prisma/client";
import type {
  PaymentMethod,
  PaymentStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../../lib/prisma";
import { AppError } from "../../common/helpers/appError";
import { parsePagination } from "../../common/helpers/pagination";
import { ORDER_ERROR_CODES } from "./constants/order.constants";

type SellerOrderLine = Pick<
  OrderItem,
  | "id"
  | "productId"
  | "name"
  | "previewImage"
  | "quantity"
  | "price"
  | "currency"
  | "status"
>;

const SELLER_ORDER_GROUP_SELECT = {
  id: true,
  createdAt: true,
  paymentStatus: true,
  paymentMethod: true,
  pickupPointId: true,
  pickupPointName: true,
  pickupPointAddress: true,
  handedOverAt: true,
  shippingMethod: { select: { isPickup: true } },
} as const;

type SellerOrderGroupRow = {
  id: string;
  createdAt: Date;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  pickupPointId: string | null;
  pickupPointName: string | null;
  pickupPointAddress: string | null;
  handedOverAt: Date | null;
  shippingMethod: { isPickup: boolean };
  OrderItem: SellerOrderLine[];
};

export const toSellerOrderGroupJson = (row: SellerOrderGroupRow) => ({
  id: row.id,
  createdAt: row.createdAt,
  paymentStatus: row.paymentStatus,
  paymentMethod: row.paymentMethod,
  isPickup: row.shippingMethod.isPickup,
  pickupPointId: row.pickupPointId,
  pickupPointName: row.pickupPointName,
  pickupPointAddress: row.pickupPointAddress,
  handedOverAt: row.handedOverAt,
  orderItems: row.OrderItem,
});

export type SellerOrderGroupJson = ReturnType<typeof toSellerOrderGroupJson>;

const sellerNotAssigned = () =>
  new AppError(
    403,
    ORDER_ERROR_CODES.sellerNotAssigned,
    "No business is assigned to this seller.",
  );

const invalidPagination = () =>
  new AppError(422, ORDER_ERROR_CODES.validation, "Invalid pagination.");

/**
 * The seller read and nothing else: a shop owner watches their own lines and
 * holds no authority over a parcel any more, so this service cannot write (spec
 * 0020). Nothing here touches an order row, which is why the route needs no
 * account gate.
 */
export class SellerOrderService {
  async getSellerOrders(
    userId: string,
    pageInput?: unknown,
    limitInput?: unknown,
  ) {
    const { page, limit } = parsePagination(
      pageInput,
      limitInput,
      invalidPagination,
    );
    const business = await prisma.business.findUnique({
      where: { ownerUserId: userId },
      select: { id: true },
    });

    if (!business) {
      throw sellerNotAssigned();
    }

    const total = await this.countSellerOrders(userId);
    const orders = await this.findSellerOrders(userId, page, limit);

    return {
      orders: orders.map(toSellerOrderGroupJson),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  private async countSellerOrders(userId: string): Promise<number> {
    const [result] = await prisma.$queryRaw<Array<{ total: number }>>`
      SELECT COUNT(DISTINCT oi."orderId")::int AS total
      FROM "OrderItem" oi
      JOIN "Business" b ON b.id = oi."businessId"
      WHERE b."ownerUserId" = ${userId}
    `;

    return result?.total ?? 0;
  }

  private async findSellerOrders(userId: string, page: number, limit: number) {
    return prisma.order.findMany({
      where: {
        OrderItem: {
          some: { business: { is: { ownerUserId: userId } } },
        },
      },
      select: {
        ...SELLER_ORDER_GROUP_SELECT,
        OrderItem: {
          where: { business: { is: { ownerUserId: userId } } },
          orderBy: { id: "asc" },
          select: {
            id: true,
            productId: true,
            name: true,
            previewImage: true,
            quantity: true,
            price: true,
            currency: true,
            status: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    });
  }
}

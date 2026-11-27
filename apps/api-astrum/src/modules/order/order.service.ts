import type { OrderStatus } from "@astrum/db/enums";
import { DEFAULT_PAGE_SIZE } from "../../common/constants/pagination.constants";
import type { CreateOrderDto } from "./dto/create-order.dto";
import { updateOrderStatus as updateOrderStatusFlow } from "./order-cancel";
import { createOrder as createOrderFlow } from "./order-create";
import {
  getOrderById as getOrderByIdFlow,
  getOrdersByUserId as getOrdersByUserIdFlow,
} from "./order-read";
import type {
  CreateOrderResult,
  OrderDetail,
  OrderListPage,
  OrderListQuery,
} from "./types/order.types";

export class OrderService {
  async createOrder(
    userId: string,
    dto: CreateOrderDto,
    idempotencyKey?: string,
  ): Promise<CreateOrderResult> {
    return createOrderFlow(userId, dto, idempotencyKey);
  }

  async getOrderById(orderId: string, userId: string): Promise<OrderDetail> {
    return getOrderByIdFlow(orderId, userId);
  }

  async getOrdersByUserId(
    userId: string,
    query: OrderListQuery = {},
    page = 1,
    limit = DEFAULT_PAGE_SIZE,
  ): Promise<OrderListPage> {
    return getOrdersByUserIdFlow(userId, query, page, limit);
  }

  async updateOrderStatus(
    orderId: string,
    userId: string,
    status: OrderStatus,
  ): Promise<OrderDetail> {
    return updateOrderStatusFlow(orderId, userId, status);
  }
}

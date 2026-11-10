"use client";

import {
  ArrowLeft,
  Check,
  CreditCard,
  Edit,
  Loader2,
  MapPin,
  Package,
  Printer,
  Truck,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney, itemStatusKey, showToast } from "../../../../common";
import {
  OrderStatus,
  PaymentMethod,
} from "../../../../common/types/order.types";
import { Separator } from "../../../../components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table";
import { useGetOrderById, useUpdateOrderStatus } from "../../../../hooks/order";

const ICON_SIZE = "h-4 w-4";

type Props = {
  orderId: string;
};

type LabelKey = "pending" | "confirmed" | "shipped" | "delivered" | "canceled";

const STATUS_KEYS: Record<OrderStatus, LabelKey> = {
  [OrderStatus.PENDING]: "pending",
  [OrderStatus.CONFIRMED]: "confirmed",
  [OrderStatus.SHIPPED]: "shipped",
  [OrderStatus.DELIVERED]: "delivered",
  [OrderStatus.CANCELED]: "canceled",
};

const PAYMENT_KEYS: Record<
  PaymentMethod,
  "onlineCard" | "paypal" | "stripe" | "cardOnDelivery" | "cash"
> = {
  [PaymentMethod.ONLINE_CARD]: "onlineCard",
  [PaymentMethod.PAYPAL]: "paypal",
  [PaymentMethod.STRIPE]: "stripe",
  [PaymentMethod.CARD_ON_DELIVERY]: "cardOnDelivery",
  [PaymentMethod.CASH]: "cash",
};

const getStatusColor = (status: OrderStatus) => {
  switch (status) {
    case OrderStatus.PENDING:
    case OrderStatus.CONFIRMED:
      return "bg-yellow-500";
    case OrderStatus.SHIPPED:
      return "bg-blue-500";
    case OrderStatus.DELIVERED:
      return "bg-green-500";
    case OrderStatus.CANCELED:
      return "bg-red-500";
    default:
      return "bg-gray-500";
  }
};

const getPaymentMethodIcon = (method: PaymentMethod) => {
  switch (method) {
    case PaymentMethod.ONLINE_CARD:
    case PaymentMethod.STRIPE:
    case PaymentMethod.PAYPAL:
      return <CreditCard className="h-5 w-5" />;
    default:
      return <CreditCard className="h-5 w-5" />;
  }
};

const getStatusSteps = (currentStatus: OrderStatus) => {
  const allSteps: {
    status: OrderStatus;
    key: LabelKey;
    icon: typeof Check;
  }[] = [
    { status: OrderStatus.PENDING, key: "pending", icon: Check },
    { status: OrderStatus.CONFIRMED, key: "confirmed", icon: Check },
    { status: OrderStatus.SHIPPED, key: "shipped", icon: Package },
    { status: OrderStatus.DELIVERED, key: "delivered", icon: Truck },
  ];

  const statusOrder = {
    [OrderStatus.PENDING]: 0,
    [OrderStatus.CONFIRMED]: 1,
    [OrderStatus.SHIPPED]: 2,
    [OrderStatus.DELIVERED]: 3,
    [OrderStatus.CANCELED]: -1,
  };

  const currentIndex = statusOrder[currentStatus];

  return allSteps.map((step, index) => ({
    ...step,
    active: currentIndex >= index && currentIndex !== -1,
  }));
};

export default function OrderPage({ orderId }: Props) {
  const router = useRouter();
  const t = useTranslations("orders");
  const format = useFormatter();
  const { order, isLoading, error } = useGetOrderById(orderId);
  const { updateOrderStatusTrigger, updateOrderStatusIsMutating } =
    useUpdateOrderStatus(orderId);

  const commonCardClass = "bg-[hsl(var(--card))] rounded-lg";
  const buttonOutlineClass =
    "border-gray-600 bg-transparent text-xs lg:text-sm h-8 lg:h-9 px-3 lg:px-4";

  if (isLoading) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    showToast({
      title: t("detailsFailed"),
      type: "error",
    });
    return (
      <div className="min-h-screen flex flex-col justify-center items-center">
        <h2 className="text-2xl font-bold mb-4">{t("notFoundTitle")}</h2>
        <p className="text-muted-foreground mb-4">{t("notFoundText")}</p>
        <Button onClick={() => router.push("/orders")}>
          {t("backToOrders")}
        </Button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const statusSteps = getStatusSteps(order.status);

  const handleCancelOrder = async () => {
    try {
      await updateOrderStatusTrigger({
        status: OrderStatus.CANCELED,
      });
      showToast({
        title: t("cancelSuccess"),
        type: "success",
      });
    } catch {
      showToast({
        title: t("cancelFailed"),
        type: "error",
      });
    }
  };

  return (
    <div className="min-h-screen">
      <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4 lg:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 lg:gap-4">
            <Button
              onClick={() => router.back()}
              variant="ghost"
              size="icon"
              className="text-muted-foreground h-8 w-8 lg:h-10 lg:w-10"
            >
              <ArrowLeft className={ICON_SIZE} />
            </Button>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold">
                {t("number", { number: order.id.slice(-8) })}
              </h1>
              <p className="text-muted-foreground text-sm">
                {t("placedOn", {
                  date: format.dateTime(new Date(order.createdAt), {
                    dateStyle: "long",
                    timeStyle: "short",
                  }),
                })}
              </p>
            </div>
          </div>
          <div className="flex gap-2 lg:gap-3">
            <Button variant="outline" size="sm" className={buttonOutlineClass}>
              <Printer className={ICON_SIZE} />{" "}
              <span className="ml-1 lg:ml-2">{t("print")}</span>
            </Button>
            {order.status === OrderStatus.PENDING && (
              <Button
                variant="outline"
                size="sm"
                className={buttonOutlineClass}
                onClick={handleCancelOrder}
                disabled={updateOrderStatusIsMutating}
              >
                {updateOrderStatusIsMutating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Edit className={ICON_SIZE} />{" "}
                    <span className="ml-1 lg:ml-2">{t("cancel")}</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Customer Info & Payment + Order Summary (Two Columns) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          {/* Customer Information & Payment Method */}
          <Card className={commonCardClass}>
            <CardContent className="p-4 space-y-6">
              {/* Order Status Badge */}
              <div className="flex items-center gap-3">
                <Badge
                  className={`text-white px-3 py-1 ${getStatusColor(order.status)}`}
                >
                  {t(`status.${STATUS_KEYS[order.status]}`)}
                </Badge>
                <span className="text-muted-foreground text-sm">
                  {order.paymentStatus === "PAID"
                    ? t("paid")
                    : t("paymentPending")}
                </span>
              </div>

              <Separator className="my-4" />

              {/* Delivery Address */}
              <div>
                <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  {t("deliveryAddress")}
                </h3>
                <div className="space-y-1 text-sm">
                  <p>{order.deliveryAddress}</p>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <h3 className="text-lg font-medium mb-3">
                  {t("paymentMethod")}
                </h3>
                <Card className="flex items-center justify-between bg-muted p-3 rounded-lg">
                  <div className="flex items-center gap-3">
                    {getPaymentMethodIcon(order.paymentMethod)}
                    <span className="text-muted-foreground">
                      {t(`payment.${PAYMENT_KEYS[order.paymentMethod]}`)}
                    </span>
                  </div>
                </Card>
              </div>

              {/* Shipping Method */}
              <div>
                <h3 className="text-lg font-medium mb-3">
                  {t("shippingMethod")}
                </h3>
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{order.shippingMethodName}</p>
                  <p className="text-muted-foreground">
                    {t("price", {
                      price: formatMoney(order.deliveryPrice, order.currency),
                    })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Summary */}
          <Card className={commonCardClass}>
            <CardHeader className="pb-3 lg:pb-4">
              <CardTitle className="text-lg font-medium">
                {t("summary")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 lg:space-y-4 pt-0">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{t("subtotal")}</span>
                <span className="font-medium">
                  {formatMoney(order.totalPrice, order.currency)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{t("shipping")}</span>
                <span className="font-medium">
                  {formatMoney(order.deliveryPrice, order.currency)}
                </span>
              </div>
              <Separator className="my-4" />
              <div>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-lg lg:text-base">
                    {t("total")}
                  </span>
                  <span className="font-semibold text-xl lg:text-lg">
                    {formatMoney(order.grandTotal, order.currency)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Delivery Status */}
        {order.status !== OrderStatus.CANCELED && (
          <Card className={commonCardClass}>
            <CardHeader className="pb-4 lg:pb-6">
              <CardTitle className="text-lg font-medium">
                {t("deliveryStatus")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {/* Mobile: Horizontal */}
              <div className="flex items-center justify-between lg:hidden mb-6">
                {statusSteps.map((step) => {
                  const Icon = step.icon;
                  return (
                    <div key={step.key} className="flex flex-col items-center">
                      <div
                        className={`w-12 h-12 rounded-full mb-2 flex items-center text-white justify-center ${
                          step.active ? "bg-green-500" : "bg-gray-600"
                        }`}
                      >
                        <Icon
                          className={`h-5 w-5 ${!step.active ? "text-white" : ""}`}
                        />
                      </div>
                      <span
                        className={`text-xs font-medium text-center ${
                          step.active ? "" : "text-muted-foreground "
                        }`}
                      >
                        {t(`status.${step.key}`)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Desktop: Horizontal Progress */}
              <div className="hidden lg:block relative mb-8">
                <div className="absolute top-5 left-5 right-5 h-0.5 bg-gray-500"></div>
                <div className="absolute top-5 left-5 w-1/3 h-0.5 bg-green-500"></div>
                <div className="relative flex justify-between">
                  {statusSteps.map((step) => {
                    const Icon = step.icon;
                    return (
                      <div
                        key={step.key}
                        className="flex flex-col items-center"
                      >
                        <div
                          className={`w-10 h-10 rounded-full mb-3 flex items-center text-white justify-center ${
                            step.active ? "bg-green-500" : "bg-gray-600"
                          }`}
                        >
                          <Icon
                            className={`h-5 w-5 ${!step.active ? "text-white" : ""}`}
                          />
                        </div>
                        <span
                          className={`text-sm ${
                            step.active
                              ? "font-medium"
                              : "text-muted-foreground"
                          }`}
                        >
                          {t(`status.${step.key}`)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Badge
                  className={`text-white px-3 py-1 text-sm font-medium ${getStatusColor(order.status)}`}
                >
                  {t(`status.${STATUS_KEYS[order.status]}`)}
                </Badge>
                <span className="text-muted-foreground text-sm">
                  {t("deliveryDate", {
                    date: format.dateTime(new Date(order.deliveryDate), {
                      dateStyle: "long",
                    }),
                  })}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Order Items */}
        <Card className={commonCardClass}>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-medium">
              {t("itemsTitle", { count: order.orderItems?.length || 0 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {/* Desktop: Table */}
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-left py-4 text-muted-foreground font-medium text-sm">
                    {t("columns.product")}
                  </TableHead>
                  <TableHead className="text-center py-4 text-muted-foreground font-medium text-sm">
                    {t("columns.quantity")}
                  </TableHead>
                  <TableHead className="text-right py-4 text-muted-foreground font-medium text-sm">
                    {t("columns.price")}
                  </TableHead>
                  <TableHead className="text-center py-4 text-muted-foreground font-medium text-sm">
                    {t("columns.status")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(order.orderItems || []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-6">
                        <div className="relative group">
                          <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm border border-gray-200 dark:border-gray-700 transition-all duration-200 group-hover:shadow-md group-hover:scale-105">
                            {item.previewImage || item.product?.previewImage ? (
                              <Image
                                src={
                                  item.previewImage ||
                                  item.product?.previewImage ||
                                  "/placeholder.svg"
                                }
                                alt={
                                  item.name ||
                                  item.product?.name ||
                                  t("productImage")
                                }
                                width={64}
                                height={64}
                                className="rounded-xl object-cover w-full h-full transition-transform duration-200 group-hover:scale-110"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = "none";
                                  const parent = target.parentElement;
                                  if (parent) {
                                    parent.innerHTML =
                                      '<div class="w-full h-full flex items-center justify-center"><Package class="h-8 w-8 text-muted-foreground" /></div>';
                                  }
                                }}
                              />
                            ) : (
                              <Package className="h-8 w-8 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm text-foreground leading-tight">
                            {item.name ||
                              item.product?.name ||
                              t("productFallback", { id: item.productId })}
                          </span>
                          <span className="text-xs text-muted-foreground mt-1">
                            ID: {item.productId.slice(-8)}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center py-4 font-medium">
                      {item.quantity}
                    </TableCell>
                    <TableCell className="text-right py-4 font-medium">
                      {formatMoney(item.price, order.currency)}
                    </TableCell>
                    <TableCell className="text-center py-4">
                      <Badge className="text-xs">
                        {t(
                          `itemStatus.${itemStatusKey(item.status) ?? "pending"}`,
                        )}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

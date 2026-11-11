import { useTranslations } from "next-intl";
import { itemStatusKey } from "@/common/helpers/itemStatus";
import { formatMoney } from "@/common/helpers/money";
import type { Order } from "@/common/types/order.types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import OrderItemImage from "@/features/pages/Orders/OrderPage/components/OrderItemImage";
import { CARD_CLASS } from "@/features/pages/Orders/OrderPage/lib/styles";

type Props = {
  order: Order;
};

/** One row per line the order was made of, with its own line status. */
const OrderItemsCard = ({ order }: Props) => {
  const t = useTranslations("orders");
  const items = order.orderItems || [];

  return (
    <Card className={CARD_CLASS}>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-medium">
          {t("itemsTitle", { count: items.length })}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
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
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="py-4">
                  <div className="flex items-center gap-6">
                    <OrderItemImage
                      src={item.previewImage || item.product?.previewImage}
                      alt={item.name || item.product?.name || t("productImage")}
                    />
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
                    {t(`itemStatus.${itemStatusKey(item.status) ?? "pending"}`)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default OrderItemsCard;

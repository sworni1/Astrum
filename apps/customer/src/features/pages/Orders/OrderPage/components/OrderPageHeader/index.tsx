import { ArrowLeft, Edit, Loader2, Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { type Order, OrderStatus } from "@/common/types/order.types";
import { Button } from "@/components/ui/button";
import {
  ICON_SIZE,
  OUTLINE_BUTTON_CLASS,
} from "@/features/pages/Orders/OrderPage/lib/styles";

type Props = {
  order: Order;
  isCancelling: boolean;
  onCancel: () => void;
};

/** Back out of the screen, the order number with its date, print and cancel. */
const OrderPageHeader = ({ order, isCancelling, onCancel }: Props) => {
  const router = useRouter();
  const t = useTranslations("orders");
  const format = useFormatter();

  return (
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
        <Button variant="outline" size="sm" className={OUTLINE_BUTTON_CLASS}>
          <Printer className={ICON_SIZE} />{" "}
          <span className="ml-1 lg:ml-2">{t("print")}</span>
        </Button>
        {order.status === OrderStatus.PENDING && (
          <Button
            variant="outline"
            size="sm"
            className={OUTLINE_BUTTON_CLASS}
            onClick={onCancel}
            disabled={isCancelling}
          >
            {isCancelling ? (
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
  );
};

export default OrderPageHeader;

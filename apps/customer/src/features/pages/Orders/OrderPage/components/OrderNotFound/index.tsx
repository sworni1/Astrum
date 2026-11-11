import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** The failed read, rendered as a screen with a way back to the list. */
const OrderNotFound = () => {
  const router = useRouter();
  const t = useTranslations("orders");

  return (
    <div className="min-h-screen flex flex-col justify-center items-center">
      <h2 className="text-2xl font-bold mb-4">{t("notFoundTitle")}</h2>
      <p className="text-muted-foreground mb-4">{t("notFoundText")}</p>
      <Button onClick={() => router.push("/orders")}>
        {t("backToOrders")}
      </Button>
    </div>
  );
};

export default OrderNotFound;

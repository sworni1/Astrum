import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

/** Shown while the one sync call runs, before the order is read as truth (AC-14). */
const PaymentChecking = () => {
  const t = useTranslations("orders");

  return (
    <div className="min-h-screen flex flex-col justify-center items-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin" />
      <p className="text-sm text-muted-foreground">{t("payment.checking")}</p>
    </div>
  );
};

export default PaymentChecking;

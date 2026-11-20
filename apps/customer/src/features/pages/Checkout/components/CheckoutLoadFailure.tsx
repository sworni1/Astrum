import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type Props = {
  onRetry: () => void;
};

const CheckoutLoadFailure = ({ onRetry }: Props) => {
  const t = useTranslations("cart");

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 py-20">
      <span className="text-sm text-destructive-soft">{t("failed")}</span>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        {t("retry")}
      </Button>
    </div>
  );
};

export default CheckoutLoadFailure;

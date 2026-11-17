import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type Props = {
  onRetry: () => void;
};

/**
 * A failed cart read is not an empty selection, so it gets its own state with a
 * retry instead of the redirect to `/cart` (spec 0024, AC-4).
 */
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

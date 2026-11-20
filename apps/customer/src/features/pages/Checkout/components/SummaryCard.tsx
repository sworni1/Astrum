import { CreditCard, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { formatMoney } from "@/common/helpers/money";
import { Button } from "@/components/ui/button";
import CheckoutCard from "@/features/pages/Checkout/components/CheckoutCard";
import CheckoutHint from "@/features/pages/Checkout/components/CheckoutHint";
import type { CheckoutFormState } from "@/features/pages/Checkout/lib/checkoutState";
import {
  CARD_BODY_SUMMARY,
  RULE,
  SUBMIT,
  SUMMARY_LABEL,
  SUMMARY_ROW,
  SUMMARY_TOTAL_LABEL,
  SUMMARY_TOTAL_ROW,
  SUMMARY_TOTAL_VALUE,
  SUMMARY_VALUE,
} from "@/features/pages/Checkout/lib/styles";

type Props = {
  state: CheckoutFormState;
};

const SummaryCard = ({ state }: Props) => {
  const t = useTranslations("cart");
  const locale = useLocale();
  const blocked = state.hint !== null || state.isSubmitting;

  return (
    <CheckoutCard title={t("checkoutSummaryTitle")} bodyClassName={CARD_BODY_SUMMARY}>
      <div className={SUMMARY_ROW}>
        <span className={SUMMARY_LABEL}>{t("subtotal")}</span>
        <span className={SUMMARY_VALUE}>
          {formatMoney(state.subtotal, state.currency, locale)}
        </span>
      </div>

      <div className={SUMMARY_ROW}>
        <span className={SUMMARY_LABEL}>{t("shipping")}</span>
        <span className={SUMMARY_VALUE}>
          {formatMoney(state.shippingPrice, state.currency, locale)}
        </span>
      </div>

      <hr className={RULE} />

      <div className={SUMMARY_TOTAL_ROW}>
        <span className={SUMMARY_TOTAL_LABEL}>{t("total")}</span>
        <span className={SUMMARY_TOTAL_VALUE}>
          {formatMoney(state.total, state.currency, locale)}
        </span>
      </div>

      <Button type="submit" className={SUBMIT} disabled={blocked}>
        {state.isSubmitting ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            {t("placingOrder")}
          </>
        ) : (
          <>
            <CreditCard className="mr-2 size-[18px]" />
            {t("placeOrder")}
          </>
        )}
      </Button>

      <CheckoutHint hint={state.hint} />
    </CheckoutCard>
  );
};

export default SummaryCard;

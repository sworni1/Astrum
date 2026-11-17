import { useTranslations } from "next-intl";
import type { CheckoutHintKey } from "@/features/pages/Checkout/lib/hints";
import { SUBMIT_HINT } from "@/features/pages/Checkout/lib/styles";

type Props = {
  hint: CheckoutHintKey | null;
};

/**
 * The line under the submit button: the first field still blocking the order,
 * at most one, from the table in `lib/hints` (spec 0024, AC-14).
 */
const CheckoutHint = ({ hint }: Props) => {
  const t = useTranslations("cart");

  if (hint === null) {
    return null;
  }

  return <p className={SUBMIT_HINT}>{t(hint)}</p>;
};

export default CheckoutHint;

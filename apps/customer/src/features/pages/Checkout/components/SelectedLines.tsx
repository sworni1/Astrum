import { ShoppingBag } from "lucide-react";
import { Fragment } from "react";
import { useTranslations } from "next-intl";
import type { Currency, ProductCartProps } from "@/common/types/product.types";
import CheckoutCard from "@/features/pages/Checkout/components/CheckoutCard";
import SelectedLine from "@/features/pages/Checkout/components/SelectedLine";
import {
  CARD_BODY_LINES,
  RULE,
} from "@/features/pages/Checkout/lib/styles";

type Props = {
  lines: ProductCartProps[];
  currency: Currency;
};

const SelectedLines = ({ lines, currency }: Props) => {
  const t = useTranslations("cart");

  return (
    <CheckoutCard
      title={t("checkoutSelectedItems", { count: lines.length })}
      icon={<ShoppingBag className="size-5" strokeWidth={1.75} />}
      bodyClassName={CARD_BODY_LINES}
    >
      {lines.map((line, index) => (
        <Fragment key={line.id}>
          {index > 0 ? <hr className={RULE} /> : null}
          <SelectedLine line={line} currency={currency} />
        </Fragment>
      ))}
    </CheckoutCard>
  );
};

export default SelectedLines;

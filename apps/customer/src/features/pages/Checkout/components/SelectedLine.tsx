import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { formatMoney } from "@/common/helpers/money";
import type { Currency, ProductCartProps } from "@/common/types/product.types";
import {
  LINE_HEAD,
  LINE_NAME,
  LINE_NOTE,
  LINE_ROW,
  LINE_TILE,
  LINE_TOTAL,
} from "@/features/pages/Checkout/lib/styles";

type Props = {
  line: ProductCartProps;
  currency: Currency;
};

const SelectedLine = ({ line, currency }: Props) => {
  const t = useTranslations("cart");
  const locale = useLocale();

  return (
    <div className={LINE_ROW} data-testid="checkout-line">
      <div className={LINE_HEAD}>
        <div className={LINE_TILE}>
          <Image
            unoptimized
            src={line.previewImage}
            alt={line.name}
            width={88}
            height={88}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0">
          <div className={LINE_NAME}>{line.name}</div>
          <p className={LINE_NOTE}>
            {t("lineQuantity", { count: line.quantityInCart })}
          </p>
        </div>
      </div>
      <div className={LINE_TOTAL}>
        {formatMoney(line.price * line.quantityInCart, currency, locale)}
      </div>
    </div>
  );
};

export default SelectedLine;

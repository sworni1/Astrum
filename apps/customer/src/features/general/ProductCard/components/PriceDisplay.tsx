import { useLocale } from "next-intl";
import { memo } from "react";
import { formatMoney } from "@/common/helpers/money";
import { Currency } from "@/common/types/product.types";
import { CardTitle } from "@/components/ui/card";

const PriceDisplay = memo(
  ({ price, currency }: { price: number; currency: Currency }) => {
    const locale = useLocale();

    return (
      <CardTitle className="text-2xl font-bold leading-tight text-gray-900 dark:text-white h-[40px]">
        {formatMoney(price, currency, locale)}
      </CardTitle>
    );
  },
);
PriceDisplay.displayName = "PriceDisplay";

export default PriceDisplay;

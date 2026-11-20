import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useCopyOrderNumber } from "@/features/pages/Orders/OrderPage/hooks/useCopyOrderNumber";
import { ICON_SIZE } from "@/features/pages/Orders/OrderPage/lib/styles";

type Props = {
  orderId: string;
};

const CopyOrderNumber = ({ orderId }: Props) => {
  const t = useTranslations("orders");
  const { copyNumber } = useCopyOrderNumber(orderId);

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="text-muted-foreground hover:bg-muted hover:text-foreground"
      aria-label={t("copyNumber")}
      data-testid="order-copy"
      onClick={() => void copyNumber()}
    >
      <Copy className={ICON_SIZE} aria-hidden />
    </Button>
  );
};

export default CopyOrderNumber;

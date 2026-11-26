import { useTranslations } from "next-intl";
import { showToast } from "@/common/helpers/showToast";

type UseCopyOrderNumberReturn = {
  copyNumber: () => Promise<void>;
};

export const useCopyOrderNumber = (
  orderId: string,
): UseCopyOrderNumberReturn => {
  const t = useTranslations("orders");

  const copyNumber = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(orderId.slice(-8));
      showToast({ title: t("copySuccess"), type: "success" });
    } catch {
      showToast({ title: t("copyFailed"), type: "error" });
    }
  };

  return { copyNumber };
};

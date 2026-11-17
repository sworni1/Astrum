import { useTranslations } from "next-intl";
import { showToast } from "@/common/helpers/showToast";

type UseCopyOrderNumberReturn = {
  copyNumber: () => Promise<void>;
};

/**
 * Copies the order number as the header prints it, the last eight characters of
 * the id with no hash. A refused clipboard (an insecure origin, a denied
 * permission) raises the failure toast instead of an unhandled rejection
 * (spec 0027, AC-7).
 */
export const useCopyOrderNumber = (orderId: string): UseCopyOrderNumberReturn => {
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

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { showToast } from "@/common/helpers/showToast";

export const useLoadFailureToast = (error: unknown): void => {
  const t = useTranslations("cart");
  const raisedFor = useRef<unknown>(null);

  useEffect(() => {
    if (!error || raisedFor.current === error) {
      return;
    }

    raisedFor.current = error;
    showToast({ title: t("failed"), type: "error" });
  }, [error, t]);
};

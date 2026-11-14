import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { showToast } from "@/common/helpers/showToast";

/**
 * A failed read is a side effect, so the toast is raised from an effect and the
 * screen still renders its own refused state. The error object is the key: SWR
 * hands a new one per failed request, so one failure raises one toast however
 * often the screen renders.
 */
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

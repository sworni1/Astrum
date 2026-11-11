"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { requestConfirmationEmail } from "@/common/helpers/confirmEmail";
import { showToast } from "@/common/helpers/showToast";

export const RESEND_COOLDOWN_SECONDS = 60;

/**
 * One cooldown for every resend button on the site: the address is sent
 * lowercased, and the button refuses to fire again for a minute after each
 * accepted request.
 */
export const useResendConfirmation = () => {
  const t = useTranslations("confirmEmail");
  const [cooldown, setCooldown] = useState(0);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }

    const timer = setTimeout(() => setCooldown((left) => left - 1), 1000);

    return () => clearTimeout(timer);
  }, [cooldown]);

  const send = useCallback(
    async (email: string) => {
      if (!email || cooldown > 0 || isSending) {
        return;
      }

      setIsSending(true);

      try {
        await requestConfirmationEmail(email);
        setCooldown(RESEND_COOLDOWN_SECONDS);
        showToast({
          title: t("sentTitle"),
          description: t("sentText"),
          type: "success",
        });
      } catch {
        showToast({
          title: t("sendFailedTitle"),
          description: t("sendFailedText"),
          type: "error",
        });
      } finally {
        setIsSending(false);
      }
    },
    [cooldown, isSending, t],
  );

  return {
    send,
    cooldown,
    isSending,
    isCoolingDown: cooldown > 0,
  };
};

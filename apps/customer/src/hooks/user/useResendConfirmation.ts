"use client";

import { useCallback, useEffect, useState } from "react";
import { showToast } from "../../common";
import { requestConfirmationEmail } from "../../common/helpers/confirmEmail";

export const RESEND_COOLDOWN_SECONDS = 60;

/**
 * One cooldown for every resend button on the site: the address is sent
 * lowercased, and the button refuses to fire again for a minute after each
 * accepted request.
 */
export const useResendConfirmation = () => {
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
          title: "Письмо отправлено",
          description: "Проверьте почту, ссылка действует 24 часа.",
          type: "success",
        });
      } catch {
        showToast({
          title: "Не удалось отправить письмо",
          description: "Повторите через минуту.",
          type: "error",
        });
      } finally {
        setIsSending(false);
      }
    },
    [cooldown, isSending],
  );

  return {
    send,
    cooldown,
    isSending,
    isCoolingDown: cooldown > 0,
  };
};

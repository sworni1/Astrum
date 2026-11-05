"use client";

import { MailWarning } from "lucide-react";
import Link from "next/link";
import { Button } from "../../../components/ui/button";
import { useUser } from "../../../hooks/user";
import { useResendConfirmation } from "../../../hooks/user/useResendConfirmation";

/**
 * Shown on every content page while the account is unconfirmed. It sends
 * another letter in place, so the customer does not have to open the confirm
 * screen to unblock ordering.
 */
export default function ConfirmEmailBanner() {
  const { profileData } = useUser();
  const { send, cooldown, isSending, isCoolingDown } = useResendConfirmation();

  if (profileData?.status !== "PENDING") {
    return null;
  }

  return (
    <div className="border-b border-amber-200/70 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
      <div className="mx-auto flex min-h-12 max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 text-sm">
        <p className="flex items-center gap-2">
          <MailWarning className="size-4 shrink-0" aria-hidden="true" />
          <span>
            Подтвердите почту {profileData.email} — заказы и отзывы откроются
            после клика по ссылке из письма.
          </span>
        </p>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isCoolingDown || isSending}
            onClick={() => void send(profileData.email)}
          >
            {isCoolingDown
              ? `Отправить снова через ${cooldown} с`
              : "Отправить письмо"}
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/auth/confirm-email">Подробнее</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

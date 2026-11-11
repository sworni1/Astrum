"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useResendConfirmation } from "@/hooks/user/useResendConfirmation";

type Props = {
  defaultEmail?: string;
};

/**
 * One form for every state a confirmation link can land in: the address is
 * prefilled when the session knows it.
 */
export default function ResendForm({ defaultEmail = "" }: Props) {
  const t = useTranslations("confirmEmail");
  const [typedEmail, setTypedEmail] = useState<string | null>(null);
  const { send, cooldown, isSending, isCoolingDown } = useResendConfirmation();
  const email = typedEmail ?? defaultEmail;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await send(email);
  };

  const buttonLabel = isCoolingDown
    ? t("resendIn", { seconds: cooldown })
    : t("resend");

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 text-left">
      <div className="space-y-2">
        <Label htmlFor="confirm-email">{t("emailLabel")}</Label>
        <Input
          id="confirm-email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setTypedEmail(event.target.value)}
          disabled={isSending}
          required
        />
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={isCoolingDown || isSending}
      >
        {buttonLabel}
      </Button>

      <p className="min-h-4 text-xs text-muted-foreground" aria-live="polite">
        {isCoolingDown ? t("resendHint") : ""}
      </p>
    </form>
  );
}

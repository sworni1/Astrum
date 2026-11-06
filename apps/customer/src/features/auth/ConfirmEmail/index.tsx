"use client";

import { Clock, Mail, MailCheck, MailWarning, MailX } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { UserData } from "../../../common";
import { useFetcher } from "../../../hooks";
import ResendForm from "./ResendForm";

type Outcome = "ok" | "expired" | "used" | "invalid";

const isOutcome = (value: string | null): value is Outcome =>
  value === "ok" ||
  value === "expired" ||
  value === "used" ||
  value === "invalid";

type ViewKeys = {
  title: "okTitle" | "expiredTitle" | "usedTitle" | "invalidTitle";
  text: "okText" | "expiredText" | "usedText" | "invalidText";
};

const VIEW_KEYS: Record<Outcome, ViewKeys> = {
  ok: { title: "okTitle", text: "okText" },
  expired: { title: "expiredTitle", text: "expiredText" },
  used: { title: "usedTitle", text: "usedText" },
  invalid: { title: "invalidTitle", text: "invalidText" },
};

const OUTCOME_ICONS: Record<Outcome, typeof MailCheck> = {
  ok: MailCheck,
  expired: Clock,
  used: MailWarning,
  invalid: MailX,
};

export default function ConfirmEmail() {
  const t = useTranslations("confirmEmail");
  const params = useSearchParams();
  const status = params.get("status");
  const outcome: Outcome | null = isOutcome(status) ? status : null;
  const { getData } = useFetcher();
  const { mutate } = useSWRConfig();
  const { data: profile } = useSWR<UserData>(
    outcome === null ? "/users/me" : null,
    getData,
  );

  useEffect(() => {
    if (outcome !== "ok") {
      return;
    }

    // The profile is read again and written into the cache, so the banner of
    // an unconfirmed account disappears on the next page without a re-login.
    void mutate("/users/me", getData("/users/me"), { revalidate: false });
  }, [outcome, mutate, getData]);

  if (outcome === "ok") {
    return (
      <Card>
        <CardHeader>
          <OutcomeIcon>
            <MailCheck className="size-5" aria-hidden="true" />
          </OutcomeIcon>
          <CardTitle className="text-2xl">{t("okTitle")}</CardTitle>
          <CardDescription>{t("okText")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button asChild className="w-full">
            <Link href="/">{t("goShopping")}</Link>
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href="/auth/signin">{t("signInOther")}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (outcome) {
    const OutcomeGlyph = OUTCOME_ICONS[outcome];

    return (
      <Card>
        <CardHeader>
          <OutcomeIcon>
            <OutcomeGlyph className="size-5" aria-hidden="true" />
          </OutcomeIcon>
          <CardTitle className="text-2xl">
            {t(VIEW_KEYS[outcome].title)}
          </CardTitle>
          <CardDescription>{t(VIEW_KEYS[outcome].text)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ResendForm defaultEmail={profile?.email} />
          <Button asChild variant="ghost" className="w-full">
            <Link href="/auth/signin">{t("backToSignIn")}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <OutcomeIcon>
          <Mail className="size-5" aria-hidden="true" />
        </OutcomeIcon>
        <CardTitle className="text-2xl">{t("checkMailTitle")}</CardTitle>
        <CardDescription>
          {profile?.email
            ? t("checkMailTo", { email: profile.email })
            : t("checkMailGeneric")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ResendForm defaultEmail={profile?.email} />
        <Button asChild variant="ghost" className="w-full">
          <Link href="/">{t("backToShop")}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function OutcomeIcon({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 flex size-11 items-center justify-center rounded-full bg-muted text-foreground">
      {children}
    </div>
  );
}

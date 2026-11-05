"use client";

import { Clock, Mail, MailCheck, MailWarning, MailX } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";
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
  value === "ok" || value === "expired" || value === "used" || value === "invalid";

const VIEWS: Record<Outcome, { title: string; description: string }> = {
  ok: {
    title: "Адрес подтверждён",
    description: "Спасибо! Заказы, отзывы и профиль открыты.",
  },
  expired: {
    title: "Срок ссылки истёк",
    description: "Ссылка живёт 24 часа. Отправим новую, укажите адрес.",
  },
  used: {
    title: "Ссылка больше не действует",
    description:
      "Похоже, адрес уже подтвердили или запросили новое письмо. Отправим ещё одно.",
  },
  invalid: {
    title: "Ссылка недействительна",
    description:
      "Проверьте, что адрес скопирован целиком, и запросите новое письмо.",
  },
};

const OUTCOME_ICONS: Record<Outcome, typeof MailCheck> = {
  ok: MailCheck,
  expired: Clock,
  used: MailWarning,
  invalid: MailX,
};

export default function ConfirmEmail() {
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
          <CardTitle className="text-2xl">{VIEWS.ok.title}</CardTitle>
          <CardDescription>{VIEWS.ok.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button asChild className="w-full">
            <Link href="/">Перейти к покупкам</Link>
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href="/auth/signin">Войти в другой аккаунт</Link>
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
          <CardTitle className="text-2xl">{VIEWS[outcome].title}</CardTitle>
          <CardDescription>{VIEWS[outcome].description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ResendForm defaultEmail={profile?.email} />
          <Button asChild variant="ghost" className="w-full">
            <Link href="/auth/signin">Вернуться ко входу</Link>
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
        <CardTitle className="text-2xl">Проверьте почту</CardTitle>
        <CardDescription>
          {profile?.email
            ? `Письмо со ссылкой ушло на ${profile.email}.`
            : "Письмо со ссылкой ушло на адрес, указанный при регистрации."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ResendForm defaultEmail={profile?.email} />
        <Button asChild variant="ghost" className="w-full">
          <Link href="/">Вернуться к покупкам</Link>
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

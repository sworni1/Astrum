"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function BackButton() {
  const router = useRouter();
  const t = useTranslations("auth");

  const goBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={goBack}
      className="-ml-2 self-start text-muted-foreground"
    >
      <ArrowLeft aria-hidden />
      {t("back")}
    </Button>
  );
}

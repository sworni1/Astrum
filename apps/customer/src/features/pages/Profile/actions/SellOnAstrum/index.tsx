"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** The profile entry point of the seller onboarding (spec 0008, AC-2). */
const SellOnAstrum = () => {
  const t = useTranslations("seller");

  return (
    <div className="mt-8 pt-4" data-testid="sell-on-astrum">
      <h2 className="text-xl font-medium">
        {t("onboarding.profileSectionTitle")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("onboarding.profileSectionText")}
      </p>
      <Button asChild className="mt-4">
        <Link href="/seller/onboarding">
          {t("onboarding.profileSectionAction")}
        </Link>
      </Button>
    </div>
  );
};

export default SellOnAstrum;

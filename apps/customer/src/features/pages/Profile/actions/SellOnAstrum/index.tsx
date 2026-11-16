"use client";

import { Store } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import ProfileCard from "@/features/pages/Profile/components/ProfileCard";
import {
  ACTION_SIZE,
  CARD_TEXT,
  CARD_TITLE,
  ICON_TILE,
  ROLE_HEAD,
} from "@/features/pages/Profile/lib/styles";

/** The seller role card of the profile (spec 0008 AC-2, spec 0023 AC-6). */
const SellOnAstrum = () => {
  const t = useTranslations("seller");

  return (
    <ProfileCard
      testId="sell-on-astrum"
      className="flex flex-col"
      bodyClassName="flex-1"
      footer={
        <Button asChild className={ACTION_SIZE}>
          <Link href="/seller/onboarding">
            {t("onboarding.profileSectionAction")}
          </Link>
        </Button>
      }
    >
      <div className={ROLE_HEAD}>
        <div className={ICON_TILE} aria-hidden="true">
          <Store className="size-5" />
        </div>
        <div>
          <h2 className={CARD_TITLE}>{t("onboarding.profileSectionTitle")}</h2>
          <p className={CARD_TEXT}>{t("onboarding.profileSectionText")}</p>
        </div>
      </div>
    </ProfileCard>
  );
};

export default SellOnAstrum;

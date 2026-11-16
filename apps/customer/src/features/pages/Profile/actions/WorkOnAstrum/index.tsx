"use client";

import { Briefcase } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { heldRoles } from "@/common/helpers/staffRoles";
import { Button } from "@/components/ui/button";
import ProfileCard from "@/features/pages/Profile/components/ProfileCard";
import {
  ACTION_SIZE,
  CARD_TEXT,
  CARD_TITLE,
  ICON_TILE,
  ROLE_HEAD,
} from "@/features/pages/Profile/lib/styles";
import { hasRole } from "@/hooks/staff/staff.types";
import { useUser } from "@/hooks/user/useUser";
import PointLine from "./PointLine";
import RoleLines from "./RoleLines";

/**
 * The staff role card of the profile: one sentence and a link for an account
 * without a role, the roles and the point for an account that holds one
 * (spec 0017 AC-2, spec 0023 AC-6).
 */
const WorkOnAstrum = () => {
  const t = useTranslations("staff");
  const { profileData, profileIsLoading, profileIsError } = useUser();

  if (profileIsLoading || profileIsError || !profileData) {
    return null;
  }

  const roles = heldRoles(profileData.staffRoles ?? []);
  const pending = profileData.status === "PENDING";

  return (
    <ProfileCard
      testId="work-on-astrum"
      className="flex flex-col"
      bodyClassName="flex-1"
      footer={
        roles.length === 0 ? (
          <Button asChild className={ACTION_SIZE}>
            <Link href="/staff/onboarding">{t("profile.action")}</Link>
          </Button>
        ) : undefined
      }
    >
      <div className={ROLE_HEAD}>
        <div className={ICON_TILE} aria-hidden="true">
          <Briefcase className="size-5" />
        </div>
        <div>
          <h2 className={CARD_TITLE}>{t("profile.sectionTitle")}</h2>
          <p className={CARD_TEXT}>
            {roles.length === 0
              ? t("profile.sectionText")
              : t("profile.rolesLabel")}
          </p>
        </div>
      </div>

      {roles.length === 0 ? null : (
        <>
          <RoleLines roles={roles} />
          {hasRole(roles, "POINT_WORKER") && <PointLine pending={pending} />}
        </>
      )}
    </ProfileCard>
  );
};

export default WorkOnAstrum;

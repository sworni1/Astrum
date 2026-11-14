"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { heldRoles } from "@/common/helpers/staffRoles";
import { Button } from "@/components/ui/button";
import { hasRole } from "@/hooks/staff/staff.types";
import { useUser } from "@/hooks/user/useUser";
import PointLine from "./PointLine";
import RoleLines from "./RoleLines";

/**
 * The profile entry point of the staff roles: one sentence and a link for an
 * account without a role, the roles and the point for an account that holds
 * one (spec 0017, AC-2).
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
    <div className="mt-8 pt-4" data-testid="work-on-astrum">
      <h2 className="text-xl font-medium">{t("profile.sectionTitle")}</h2>

      {roles.length === 0 ? (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("profile.sectionText")}
          </p>
          <Button asChild className="mt-4">
            <Link href="/staff/onboarding">{t("profile.action")}</Link>
          </Button>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("profile.rolesLabel")}
          </p>
          <RoleLines roles={roles} />
          {hasRole(roles, "POINT_WORKER") && <PointLine pending={pending} />}
        </>
      )}
    </div>
  );
};

export default WorkOnAstrum;

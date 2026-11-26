"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { staffRoleHref, staffRoleLabelKey } from "@/common/helpers/staffRoles";
import type { StaffRole } from "@/common/types/user.types";
import { Button } from "@/components/ui/button";

type Props = { role: StaffRole };

const RoleHeldCard = ({ role }: Props) => {
  const t = useTranslations("staff");
  const isPoint = role === "POINT_WORKER";

  return (
    <div className="rounded-xl border p-6" data-testid="staff-role-held">
      <h2 className="text-lg font-medium">{t(staffRoleLabelKey(role))}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {isPoint
          ? t("onboarding.alreadyHeldPoint")
          : t("onboarding.alreadyHeldCourier")}
      </p>
      <Button asChild variant="outline" className="mt-4">
        <Link href={staffRoleHref(role)}>
          {isPoint
            ? t("onboarding.alreadyHeldLinkPoint")
            : t("onboarding.alreadyHeldLinkCourier")}
        </Link>
      </Button>
    </div>
  );
};

export default RoleHeldCard;

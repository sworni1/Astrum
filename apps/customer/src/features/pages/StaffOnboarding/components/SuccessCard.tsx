"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { staffRoleHref, staffRoleLabelKey } from "@/common/helpers/staffRoles";
import { Button } from "@/components/ui/button";
import type { GrantedRole } from "@/features/pages/StaffOnboarding/hooks/useStaffOnboarding";
import type { StaffPoint } from "@/hooks/staff/staff.types";

type Props = { granted: GrantedRole };

/**
 * The card a successful action leaves behind: the stored role, and for the
 * point the stored name and address. It takes focus and is announced, so a
 * keyboard reader learns the job landed (AC-3, AC-15).
 */
const SuccessCard = ({ granted }: Props) => {
  const t = useTranslations("staff");
  const heading = useRef<HTMLHeadingElement>(null);
  const isPoint = granted.role === "POINT_WORKER";
  const point: StaffPoint | null = isPoint ? granted.answer.point : null;

  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <section className="mx-auto max-w-screen-xl px-4 py-12 2xl:px-0">
      <div
        role="status"
        aria-live="polite"
        className="mx-auto max-w-xl space-y-3 rounded-xl border p-6"
        data-testid="staff-success"
      >
        <h1
          ref={heading}
          tabIndex={-1}
          className="text-xl font-semibold outline-none"
        >
          {isPoint
            ? t("onboarding.successPointTitle")
            : t("onboarding.successCourierTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isPoint
            ? t("onboarding.successPointText")
            : t("onboarding.successCourierText")}
        </p>
        <p className="text-lg font-medium" data-testid="staff-success-role">
          {t(staffRoleLabelKey(granted.role))}
        </p>
        {point && (
          <div className="space-y-1 text-sm" data-testid="staff-success-point">
            <p className="font-medium">{point.name}</p>
            <p className="text-muted-foreground">{point.address}</p>
          </div>
        )}
        <Button asChild>
          <Link href={staffRoleHref(granted.role)}>
            {isPoint
              ? t("onboarding.successActionPoint")
              : t("onboarding.successActionCourier")}
          </Link>
        </Button>
      </div>
    </section>
  );
};

export default SuccessCard;

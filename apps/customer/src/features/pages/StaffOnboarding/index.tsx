"use client";

import { useTranslations } from "next-intl";
import { heldRoles } from "@/common/helpers/staffRoles";
import { useUser } from "@/hooks/user/useUser";
import { hasRole } from "@/hooks/staff/staff.types";
import FailureScreen from "@/features/staff/FailureScreen";
import PageSkeleton from "@/features/staff/PageSkeleton";
import CourierGrantCard from "./components/CourierGrantCard";
import PointGrantCard from "./components/PointGrantCard";
import RoleHeldCard from "./components/RoleHeldCard";
import SuccessCard from "./components/SuccessCard";
import { useStaffOnboarding } from "./hooks/useStaffOnboarding";

export default function StaffOnboarding() {
  const t = useTranslations("staff");
  const { profileData, profileIsLoading, profileIsError, mutateProfile } =
    useUser();
  const { granted, accept } = useStaffOnboarding(mutateProfile);

  if (granted) {
    return <SuccessCard granted={granted} />;
  }

  if (profileIsLoading) {
    return <PageSkeleton label={t("loading")} />;
  }

  if (profileIsError) {
    return (
      <FailureScreen
        title={t("failureTitle")}
        text={t("failureText")}
        retryLabel={t("retry")}
        onRetry={() => void mutateProfile()}
      />
    );
  }

  const roles = heldRoles(profileData?.staffRoles ?? []);
  const pending = profileData?.status === "PENDING";

  return (
    <section className="py-4 antialiased md:py-8">
      <div className="mx-auto max-w-screen-xl px-4 2xl:px-0">
        <h1 className="text-xl font-medium">{t("onboarding.title")}</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          {t("onboarding.subtitle")}
        </p>

        <div className="mt-6 grid max-w-xl gap-4">
          {hasRole(roles, "POINT_WORKER") ? (
            <RoleHeldCard role="POINT_WORKER" />
          ) : (
            <PointGrantCard pending={pending} onGranted={accept} />
          )}

          {hasRole(roles, "COURIER") ? (
            <RoleHeldCard role="COURIER" />
          ) : (
            <CourierGrantCard pending={pending} onGranted={accept} />
          )}
        </div>
      </div>
    </section>
  );
}

"use client";

import { useTranslations } from "next-intl";
import FailureScreen from "@/features/staff/FailureScreen";
import NoRoleScreen from "@/features/staff/NoRoleScreen";
import PageSkeleton from "@/features/staff/PageSkeleton";
import { resolveStaffPageState } from "@/hooks/staff/staffPage";
import { useStaffCourier } from "@/hooks/staff/useStaffCourier";
import CourierCard from "./components/CourierCard";

export default function CourierWorkspace() {
  const t = useTranslations("staff");
  const { isLoading, error, mutate } = useStaffCourier();
  const state = resolveStaffPageState(error, isLoading, "NOT_COURIER");

  if (state === "sessionGone") {
    return null;
  }

  if (state === "loading") {
    return <PageSkeleton label={t("loading")} />;
  }

  if (state === "noRole") {
    return (
      <NoRoleScreen
        title={t("courier.noRoleTitle")}
        text={t("courier.noRoleText")}
        actionLabel={t("courier.noRoleAction")}
      />
    );
  }

  if (state === "failure") {
    return (
      <FailureScreen
        title={t("courier.failureTitle")}
        text={t("courier.failureText")}
        retryLabel={t("retry")}
        onRetry={() => void mutate()}
      />
    );
  }

  return <CourierCard />;
}

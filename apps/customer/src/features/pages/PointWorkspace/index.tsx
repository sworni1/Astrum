"use client";

import { useTranslations } from "next-intl";
import FailureScreen from "@/features/staff/FailureScreen";
import NoRoleScreen from "@/features/staff/NoRoleScreen";
import PageSkeleton from "@/features/staff/PageSkeleton";
import { resolveStaffPageState } from "@/hooks/staff/staffPage";
import { useStaffPoint } from "@/hooks/staff/useStaffPoint";
import PointCard from "./components/PointCard";

export default function PointWorkspace() {
  const t = useTranslations("staff");
  const { point, isLoading, error, mutate } = useStaffPoint();
  const state = resolveStaffPageState(error, isLoading, "NOT_POINT_WORKER");

  if (state === "sessionGone") {
    return null;
  }

  if (state === "loading") {
    return <PageSkeleton label={t("loading")} />;
  }

  if (state === "noRole") {
    return (
      <NoRoleScreen
        title={t("point.noRoleTitle")}
        text={t("point.noRoleText")}
        actionLabel={t("point.noRoleAction")}
      />
    );
  }

  if (state === "failure" || !point) {
    return (
      <FailureScreen
        title={t("point.failureTitle")}
        text={t("point.failureText")}
        retryLabel={t("retry")}
        onRetry={() => void mutate()}
      />
    );
  }

  return <PointCard point={point} />;
}

"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { resolveStaffPageState } from "@/hooks/staff/staffPage";
import { useStaffPoint } from "@/hooks/staff/useStaffPoint";
import PointChangeControl from "./PointChangeControl";

type Props = { pending: boolean };

const PointLine = ({ pending }: Props) => {
  const t = useTranslations("staff");
  const { point, isLoading, error, mutate } = useStaffPoint();
  const state = resolveStaffPageState(error, isLoading, "NOT_POINT_WORKER");

  if (state === "loading") {
    return (
      <p className="mt-3 text-sm text-muted-foreground">
        {t("profile.pointLoading")}
      </p>
    );
  }

  if (state === "sessionGone") {
    return null;
  }

  if (state !== "ready" || !point) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-destructive">
          {t("profile.pointFailed")}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void mutate()}
        >
          {t("profile.pointRetry")}
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <p className="text-sm" data-testid="profile-point-name">
        <span className="text-muted-foreground">
          {t("profile.pointLabel")}:{" "}
        </span>
        <span className="font-medium">{point.name}</span>
      </p>
      <PointChangeControl
        currentPointId={point.id}
        pending={pending}
        onMoved={() => void mutate()}
      />
    </div>
  );
};

export default PointLine;

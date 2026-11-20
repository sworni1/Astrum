"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { showToast } from "@/common/helpers/showToast";
import type { StaffRole } from "@/common/types/user.types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePickupPoints } from "@/hooks/pickup/usePickupPoints";
import type { StaffAnswer } from "@/hooks/staff/staff.types";
import { staffErrorCode } from "@/hooks/staff/staffError";
import { useGrantPointWorker } from "@/hooks/staff/usePointWorkerMutations";

type Props = {
  pending: boolean;
  onGranted: (role: StaffRole, answer: StaffAnswer) => Promise<void>;
};

const PointGrantCard = ({ pending, onGranted }: Props) => {
  const t = useTranslations("staff");
  const cart = useTranslations("cart");
  const { points, isLoading, error, mutate } = usePickupPoints();
  const { run, isSubmitting } = useGrantPointWorker();
  const [pickupPointId, setPickupPointId] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const hasFailed = error !== null;
  const hasNoPoints = !isLoading && !hasFailed && points.length === 0;
  const blocked = pending || isLoading || hasFailed || hasNoPoints;
  const disabled = blocked || isSubmitting;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (!pickupPointId) {
      setProblem(t("refusals.validation"));
      return;
    }

    setProblem(null);

    try {
      const answer = await run({ pickupPointId });

      await onGranted("POINT_WORKER", answer);
    } catch (error) {
      const code = staffErrorCode(error);

      if (code === "VALIDATION" || code === "PICKUP_POINT_REQUIRED") {
        setProblem(t("refusals.validation"));
        return;
      }

      if (code === "UNKNOWN_PICKUP_POINT") {
        setProblem(cart("unknownPickupPoint"));
        return;
      }

      if (code === "PICKUP_POINT_INACTIVE") {
        setProblem(cart("pickupInactive"));
        return;
      }

      if (code === "EMAIL_NOT_CONFIRMED") {
        setProblem(t("refusals.emailNotConfirmed"));
        return;
      }

      showToast({ title: t("onboarding.actionFailed"), type: "error" });
    }
  };

  return (
    <div className="rounded-xl border p-6" data-testid="staff-point-grant">
      <h2 className="text-lg font-medium">{t("onboarding.pointTitle")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("onboarding.pointText")}
      </p>

      {pending && (
        <div
          role="status"
          className="mt-3 rounded-lg border border-dashed px-3 py-2 text-sm"
        >
          {t("onboarding.pendingNotice")}
        </div>
      )}

      <form onSubmit={submit} className="mt-4 space-y-3">
        <Label htmlFor="staff-point-select">{t("onboarding.pointLabel")}</Label>
        <Select
          value={pickupPointId}
          onValueChange={(value) => {
            setPickupPointId(value);
            setProblem(null);
          }}
          disabled={disabled}
        >
          <SelectTrigger id="staff-point-select" className="w-full">
            <SelectValue
              placeholder={
                isLoading ? t("loading") : t("onboarding.pointEmptyOption")
              }
            />
          </SelectTrigger>
          <SelectContent>
            {points.map((point) => (
              <SelectItem key={point.id} value={point.id}>
                <div className="flex flex-col">
                  <div className="font-medium">{point.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {point.address}
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {t("onboarding.pointHint")}
        </p>

        {problem && (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        )}

        {hasNoPoints && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm" data-testid="staff-no-points">
              {t("onboarding.pointNoPoints")}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void mutate()}
            >
              {t("onboarding.pointRetry")}
            </Button>
          </div>
        )}

        {hasFailed && (
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="text-sm text-destructive"
              data-testid="staff-points-failed"
            >
              {cart("pickupLoadFailed")}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void mutate()}
            >
              {cart("pickupRetry")}
            </Button>
          </div>
        )}

        <Button type="submit" disabled={disabled}>
          {isSubmitting
            ? t("onboarding.pointSubmitting")
            : t("onboarding.pointSubmit")}
        </Button>
      </form>
    </div>
  );
};

export default PointGrantCard;

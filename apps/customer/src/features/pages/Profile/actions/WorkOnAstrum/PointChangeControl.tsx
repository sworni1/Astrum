"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { showToast } from "@/common/helpers/showToast";
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
import { staffErrorCode } from "@/hooks/staff/staffError";
import { useMovePointWorker } from "@/hooks/staff/usePointWorkerMutations";

type Props = {
  currentPointId: string;
  pending: boolean;
  onMoved: () => void;
};

const PointChangeControl = ({ currentPointId, pending, onMoved }: Props) => {
  const t = useTranslations("staff");
  const cart = useTranslations("cart");
  const { points, isLoading, error } = usePickupPoints();
  const { run, isSubmitting } = useMovePointWorker();
  const [pickupPointId, setPickupPointId] = useState(currentPointId);
  const [problem, setProblem] = useState<string | null>(null);

  const blocked = pending || isLoading || error !== null || isSubmitting;
  const unchanged = pickupPointId === currentPointId;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (blocked || unchanged) {
      return;
    }

    setProblem(null);

    try {
      await run({ pickupPointId });

      onMoved();
    } catch (error) {
      const code = staffErrorCode(error);

      if (code === "UNKNOWN_PICKUP_POINT") {
        setProblem(cart("unknownPickupPoint"));
        return;
      }

      if (code === "PICKUP_POINT_INACTIVE") {
        setProblem(cart("pickupInactive"));
        return;
      }

      if (code === "VALIDATION") {
        setProblem(t("refusals.validation"));
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
    <form
      onSubmit={submit}
      className="mt-3 space-y-2"
      data-testid="point-change"
    >
      <Label htmlFor="staff-point-change">{t("profile.changeLabel")}</Label>
      <Select
        value={pickupPointId}
        onValueChange={(value) => {
          setPickupPointId(value);
          setProblem(null);
        }}
        disabled={pending || isLoading || isSubmitting}
      >
        <SelectTrigger id="staff-point-change" className="w-full max-w-sm">
          <SelectValue placeholder={t("onboarding.pointEmptyOption")} />
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

      {pending && (
        <p
          role="status"
          className="rounded-lg border border-dashed px-3 py-2 text-sm"
        >
          {t("profile.pendingNotice")}
        </p>
      )}

      {error !== null && (
        <p className="text-sm text-destructive">{cart("pickupLoadFailed")}</p>
      )}

      {problem && (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      )}

      <Button type="submit" disabled={blocked || unchanged}>
        {isSubmitting
          ? t("profile.changeSubmitting")
          : t("profile.changeSubmit")}
      </Button>
    </form>
  );
};

export default PointChangeControl;

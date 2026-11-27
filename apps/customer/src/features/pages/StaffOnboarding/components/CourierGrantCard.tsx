"use client";

import { useTranslations } from "next-intl";
import { showToast } from "@/common/helpers/showToast";
import type { StaffRole } from "@/common/types/user.types";
import { Button } from "@/components/ui/button";
import type { StaffAnswer } from "@/hooks/staff/staff.types";
import { staffErrorCode } from "@/hooks/staff/staffError";
import { useGrantCourier } from "@/hooks/staff/useGrantCourier";

type Props = {
  pending: boolean;
  onGranted: (role: StaffRole, answer: StaffAnswer) => Promise<void>;
};

const CourierGrantCard = ({ pending, onGranted }: Props) => {
  const t = useTranslations("staff");
  const { run, isSubmitting } = useGrantCourier();

  const take = async () => {
    if (isSubmitting) {
      return;
    }

    try {
      const answer = await run();

      await onGranted("COURIER", answer);
    } catch (error) {
      const code = staffErrorCode(error);

      if (code === "EMAIL_NOT_CONFIRMED") {
        showToast({ title: t("refusals.emailNotConfirmed"), type: "warning" });
        return;
      }

      showToast({ title: t("onboarding.actionFailed"), type: "error" });
    }
  };

  return (
    <div className="rounded-xl border p-6" data-testid="staff-courier-grant">
      <h2 className="text-lg font-medium">{t("onboarding.courierTitle")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("onboarding.courierText")}
      </p>

      {pending && (
        <div
          role="status"
          className="mt-3 rounded-lg border border-dashed px-3 py-2 text-sm"
        >
          {t("onboarding.pendingNotice")}
        </div>
      )}

      <Button
        type="button"
        className="mt-4"
        disabled={pending || isSubmitting}
        onClick={() => void take()}
      >
        {isSubmitting
          ? t("onboarding.courierSubmitting")
          : t("onboarding.courierSubmit")}
      </Button>
    </div>
  );
};

export default CourierGrantCard;

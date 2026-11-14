"use client";

import { useTranslations } from "next-intl";
import type { StaffPoint } from "@/hooks/staff/staff.types";
import PointQueue from "./PointQueue";

type Props = { point: StaffPoint };

/**
 * The point a worker stands at: its name and address, and the banner that says
 * it is switched off. No count and no control that pretends to work (AC-13).
 */
const PointCard = ({ point }: Props) => {
  const t = useTranslations("staff");

  return (
    <section className="py-4 antialiased md:py-8">
      <div className="mx-auto max-w-screen-xl px-4 2xl:px-0">
        <h1 className="text-xl font-medium">{t("point.title")}</h1>

        {!point.isActive && (
          <div
            role="status"
            className="mt-4 max-w-xl rounded-lg border border-dashed px-3 py-2 text-sm"
            data-testid="point-inactive"
          >
            {t("point.inactiveBanner")}
          </div>
        )}

        <dl className="mt-6 max-w-xl space-y-3">
          <div>
            <dt className="text-sm text-muted-foreground">
              {t("point.pointLabel")}
            </dt>
            <dd className="text-lg font-medium" data-testid="point-name">
              {point.name}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">
              {t("point.addressLabel")}
            </dt>
            <dd data-testid="point-address">{point.address}</dd>
          </div>
        </dl>

        <PointQueue isActive={point.isActive} />
      </div>
    </section>
  );
};
export default PointCard;

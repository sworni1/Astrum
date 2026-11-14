"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { showToast } from "@/common/helpers/showToast";
import { Button } from "@/components/ui/button";
import FailureScreen from "@/features/staff/FailureScreen";
import PageSkeleton from "@/features/staff/PageSkeleton";
import type {
  CourierOrder,
  CourierScope,
} from "@/hooks/staff/courierOrder.types";
import {
  type CourierOrderActionName,
  useCourierOrderAction,
} from "@/hooks/staff/useCourierOrderAction";
import type { UseCourierOrdersReturn } from "@/hooks/staff/useCourierOrders";
import { SUCCESS_KEY } from "@/features/pages/CourierWorkspace/lib/actions";
import {
  showRefusalToast,
  type Translate,
} from "@/features/pages/CourierWorkspace/lib/refusals";
import CourierOrderCard from "./CourierOrderCard";

type Props = {
  scope: CourierScope;
  data: UseCourierOrdersReturn;
  /** A successful action reads page one of both sections, so no parcel stands in two lists (AC-11). */
  onRefreshAll: () => Promise<void>;
};

/**
 * One of the courier's two lists: its heading, its own refresh, its own states and
 * its own `Show more`, so a failure here never hides the other section's rows. The
 * heading sits inside the live region and takes the focus after an action, because
 * the row that held it leaves the list (spec 0019, AC-11, AC-13).
 */
const CourierSection = ({ scope, data, onRefreshAll }: Props) => {
  const t = useTranslations("staff.courier.queue");
  const { orders, page, totalPages, isLoading, isValidating, error, showMore, mutate } =
    data;
  const { run, pending } = useCourierOrderAction();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [announcement, setAnnouncement] = useState({ text: "", seq: 0 });

  const runAction = async (
    order: CourierOrder,
    action: CourierOrderActionName,
  ): Promise<void> => {
    try {
      const answered = await run(order.id, action);

      // A second press while the first is in flight sends nothing.
      if (answered === null) {
        return;
      }

      await onRefreshAll();

      const text = t(SUCCESS_KEY[action]);

      setAnnouncement((current) => ({ text, seq: current.seq + 1 }));
      showToast({ title: text, type: "success" });
    } catch (raised) {
      await onRefreshAll();
      showRefusalToast(raised, t as unknown as Translate, () => {
        void runAction(order, action);
      });
    }
  };

  const live =
    pending !== null ? t(`${pending.action}Busy`) : announcement.text;

  return (
    <section className="mt-8" data-testid={`courier-${scope}-section`}>
      <div
        role="status"
        aria-live="polite"
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-lg font-medium focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          data-testid={`courier-${scope}-heading`}
        >
          {scope === "mine" ? t("mineTitle") : t("availableTitle")}
        </h2>
        <Button
          variant="outline"
          aria-disabled={isValidating}
          className="aria-disabled:opacity-50"
          onClick={() => void onRefreshAll()}
        >
          {t("refresh")}
        </Button>
        <p className="sr-only" data-testid={`courier-${scope}-live`}>
          {live}
        </p>
      </div>

      {isLoading ? (
        <div className="mt-4">
          <PageSkeleton label={t("loading")} />
        </div>
      ) : error ? (
        <div className="mt-4">
          <FailureScreen
            title={t("failureTitle")}
            text={t("failureText")}
            retryLabel={t("retry")}
            onRetry={() => void mutate()}
          />
        </div>
      ) : orders.length === 0 ? (
        <p
          className="mt-4 max-w-xl rounded-lg border border-dashed px-3 py-2 text-sm"
          data-testid={`courier-${scope}-empty`}
        >
          {scope === "mine" ? t("emptyMine") : t("emptyAvailable")}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <CourierOrderCard
                order={order}
                scope={scope}
                pending={pending}
                onRun={(target, action) => void runAction(target, action)}
                onClosed={() => headingRef.current?.focus()}
              />
            </li>
          ))}
        </ul>
      )}

      {page < totalPages && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            aria-disabled={isValidating}
            className="aria-disabled:opacity-50"
            onClick={showMore}
          >
            {t("showMore")}
          </Button>
        </div>
      )}
    </section>
  );
};

export default CourierSection;

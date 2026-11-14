"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { showToast } from "@/common/helpers/showToast";
import { Button } from "@/components/ui/button";
import {
  showRefusalToast,
  type Translate,
} from "@/features/pages/PointWorkspace/lib/refusals";
import FailureScreen from "@/features/staff/FailureScreen";
import PageSkeleton from "@/features/staff/PageSkeleton";
import type { PointOrder } from "@/hooks/staff/pointOrder.types";
import {
  type PointOrderActionName,
  usePointOrderAction,
} from "@/hooks/staff/usePointOrderAction";
import { usePointOrders } from "@/hooks/staff/usePointOrders";
import PointOrderCard from "./PointOrderCard";

type Props = { isActive: boolean };

/**
 * The parcels waiting at this point: the heading with its refresh control, one
 * card per order, `Show more`, and the four states of the read. A successful
 * move drops every accumulated page, re-reads the first one and moves the focus
 * to the heading, so a closed row can never linger (spec 0018, AC-10 to AC-12).
 */
const PointQueue = ({ isActive }: Props) => {
  const t = useTranslations("staff");
  const {
    orders,
    page,
    totalPages,
    isLoading,
    isValidating,
    error,
    showMore,
    mutate,
  } = usePointOrders();
  const { run, pending } = usePointOrderAction();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [announcement, setAnnouncement] = useState({ text: "", seq: 0 });

  // The dialog hands focus back to its trigger, which the closed row takes with
  // it, so the heading is focused after the commit that removes the row. The
  // sequence number makes a repeated message focus the heading again.
  useEffect(() => {
    if (announcement.seq > 0) {
      headingRef.current?.focus();
    }
  }, [announcement]);

  const runAction = async (
    order: PointOrder,
    action: PointOrderActionName,
  ): Promise<void> => {
    try {
      const closed = await run(order.id, action);

      if (closed === null) {
        return;
      }

      await mutate();

      const text = t(
        action === "handover"
          ? "point.queue.successHandover"
          : "point.queue.successCancel",
      );

      setAnnouncement((current) => ({ text, seq: current.seq + 1 }));
      showToast({ title: text, type: "success" });
    } catch (raised) {
      await mutate();
      showRefusalToast(raised, t as unknown as Translate, () => {
        void runAction(order, action);
      });
    }
  };

  if (isLoading) {
    return <PageSkeleton label={t("point.queue.loading")} />;
  }

  if (error) {
    return (
      <FailureScreen
        title={t("point.queue.failureTitle")}
        text={t("point.queue.failureText")}
        retryLabel={t("point.queue.retry")}
        onRetry={() => void mutate()}
      />
    );
  }

  const live =
    pending !== null
      ? t(`point.queue.${pending.action}Busy`)
      : announcement.text;

  return (
    <div className="mt-8">
      <div
        role="status"
        aria-live="polite"
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-lg font-medium focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          data-testid="point-queue-heading"
        >
          {t("point.queue.title")}
        </h2>
        <Button
          variant="outline"
          disabled={isValidating}
          onClick={() => void mutate()}
        >
          {t("point.queue.refresh")}
        </Button>
        <p className="sr-only" data-testid="point-queue-live">
          {live}
        </p>
      </div>

      {orders.length === 0 ? (
        <p
          className="mt-4 max-w-xl rounded-lg border border-dashed px-3 py-2 text-sm"
          data-testid="point-queue-empty"
        >
          {t("point.queue.empty")}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <PointOrderCard
                order={order}
                actionsDisabled={!isActive}
                pending={pending}
                onRun={(target, action) => void runAction(target, action)}
              />
            </li>
          ))}
        </ul>
      )}

      {page < totalPages && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" disabled={isValidating} onClick={showMore}>
            {t("point.queue.showMore")}
          </Button>
        </div>
      )}
    </div>
  );
};

export default PointQueue;

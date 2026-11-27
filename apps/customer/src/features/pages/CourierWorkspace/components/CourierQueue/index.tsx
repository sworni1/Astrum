"use client";

import { useCallback } from "react";
import { useCourierOrders } from "@/hooks/staff/useCourierOrders";
import CourierSection from "./CourierSection";

const CourierQueue = () => {
  const mine = useCourierOrders("mine");
  const available = useCourierOrders("available");
  const { mutate: refreshMine } = mine;
  const { mutate: refreshAvailable } = available;

  const refreshAll = useCallback(async (): Promise<void> => {
    await Promise.all([refreshMine(), refreshAvailable()]);
  }, [refreshMine, refreshAvailable]);

  return (
    <>
      <CourierSection scope="mine" data={mine} onRefreshAll={refreshAll} />
      <CourierSection
        scope="available"
        data={available}
        onRefreshAll={refreshAll}
      />
    </>
  );
};

export default CourierQueue;

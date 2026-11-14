"use client";

import { useTranslations } from "next-intl";
import CourierQueue from "./CourierQueue";

/** The courier page: the job's heading, then the pool and the parcels he took (AC-11). */
const CourierCard = () => {
  const t = useTranslations("staff");

  return (
    <section className="py-4 antialiased md:py-8">
      <div className="mx-auto max-w-screen-xl px-4 2xl:px-0">
        <h1 className="text-xl font-medium" data-testid="courier-title">
          {t("courier.title")}
        </h1>
        <CourierQueue />
      </div>
    </section>
  );
};

export default CourierCard;

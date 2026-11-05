import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "../../../../components/ui/skeleton";
import ConfirmEmail from "../../../../features/auth/ConfirmEmail";

export const metadata: Metadata = {
  title: "Подтверждение почты — Astrum",
  robots: { index: false, follow: false },
};

const page = () => {
  return (
    <Suspense fallback={<Skeleton className="h-80 w-full rounded-lg" />}>
      <ConfirmEmail />
    </Suspense>
  );
};

export default page;

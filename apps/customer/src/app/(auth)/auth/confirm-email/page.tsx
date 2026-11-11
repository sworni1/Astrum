import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import ConfirmEmail from "@/features/auth/ConfirmEmail";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("confirmEmail");

  return {
    title: t("metaTitle"),
    robots: { index: false, follow: false },
  };
}

const page = () => {
  return (
    <Suspense fallback={<Skeleton className="h-80 w-full rounded-lg" />}>
      <ConfirmEmail />
    </Suspense>
  );
};

export default page;

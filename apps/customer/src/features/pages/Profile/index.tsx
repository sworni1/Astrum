"use client";

import { useTranslations } from "next-intl";
import { showToast } from "@/common/helpers/showToast";
import EditProfileFormSkeleton from "@/components/skeletons/EditProfileFormSkeleton";
import { Separator } from "@/components/ui/separator";
import { useUser } from "@/hooks/user/useUser";
import ChangePasswordForm from "./actions/ChangePasswordForm";
import DeleteAccountForm from "./actions/DeleteAccountForm";
import EditProfileForm from "./actions/EditProfileForm";
import LogOutForm from "./actions/LogOutForm";
import SellOnAstrum from "./actions/SellOnAstrum";

export default function Profile() {
  const { profileData, profileIsLoading, profileIsError } = useUser();
  const t = useTranslations("profile");

  if (profileIsError) {
    showToast({
      title: t("failed"),
      type: "error",
    });
  }

  return (
    <section className="py-4 antialiased md:py-8 space-y-6">
      <div className="mx-auto max-w-screen-xl px-4 2xl:px-0">
        <h2 className="text-xl font-medium ">{t("title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>

        <Separator className="my-4" />

        {!profileIsLoading && profileData ? (
          <EditProfileForm profileData={profileData} />
        ) : (
          <EditProfileFormSkeleton />
        )}

        {!profileIsLoading &&
        !profileIsError &&
        profileData?.isSeller === false ? (
          <SellOnAstrum />
        ) : null}

        <ChangePasswordForm />
        <LogOutForm />
        <DeleteAccountForm />
      </div>
    </section>
  );
}

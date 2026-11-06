"use client";

import { useTranslations } from "next-intl";
import { showToast } from "../../../common";
import { EditProfileFormSkeleton } from "../../../components/skeletons";
import { Separator } from "../../../components/ui/separator";
import { useUser } from "../../../hooks/user";
import {
  ChangePasswordForm,
  DeleteAccountForm,
  EditProfileForm,
  LogOutForm,
} from "./actions";

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

        <ChangePasswordForm />
        <LogOutForm />
        <DeleteAccountForm />
      </div>
    </section>
  );
}

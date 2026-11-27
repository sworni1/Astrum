"use client";

import { useTranslations } from "next-intl";
import { showToast } from "@/common/helpers/showToast";
import EditProfileFormSkeleton from "@/components/skeletons/EditProfileFormSkeleton";
import {
  PROFILE_STACK,
  PROFILE_WRAPPER,
  ROLE_GRID,
} from "@/features/pages/Profile/lib/styles";
import { useUser } from "@/hooks/user/useUser";
import DeleteAccountForm from "./actions/DeleteAccountForm";
import EditProfileForm from "./actions/EditProfileForm";
import SellOnAstrum from "./actions/SellOnAstrum";
import WorkOnAstrum from "./actions/WorkOnAstrum";
import ProfileHeader from "./components/ProfileHeader";
import ProfileSecurityCard from "./components/ProfileSecurityCard";

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
    <section className={PROFILE_WRAPPER}>
      <div className={PROFILE_STACK}>
        {profileData ? <ProfileHeader profileData={profileData} /> : null}

        {!profileIsLoading && profileData ? (
          <EditProfileForm profileData={profileData} />
        ) : (
          <EditProfileFormSkeleton />
        )}

        <div className={ROLE_GRID}>
          {!profileIsLoading &&
          !profileIsError &&
          profileData?.isSeller === false ? (
            <SellOnAstrum />
          ) : null}

          <WorkOnAstrum />
        </div>

        <ProfileSecurityCard />
        <DeleteAccountForm />
      </div>
    </section>
  );
}

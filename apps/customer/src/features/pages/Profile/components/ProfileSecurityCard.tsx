"use client";

import { useTranslations } from "next-intl";
import { Separator } from "@/components/ui/separator";
import ChangePasswordForm from "@/features/pages/Profile/actions/ChangePasswordForm";
import LogOutForm from "@/features/pages/Profile/actions/LogOutForm";
import ProfileCard from "@/features/pages/Profile/components/ProfileCard";

const ProfileSecurityCard = () => {
  const t = useTranslations("profile");

  return (
    <ProfileCard
      title={t("securityTitle")}
      text={t("securitySubtitle")}
      flushBody
      testId="profile-security"
    >
      <ChangePasswordForm />
      <Separator />
      <LogOutForm />
    </ProfileCard>
  );
};

export default ProfileSecurityCard;

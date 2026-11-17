"use client";

import { useTranslations } from "next-intl";
import ChangePasswordForm from "@/features/pages/Profile/actions/ChangePasswordForm";
import LogOutForm from "@/features/pages/Profile/actions/LogOutForm";
import ProfileCard from "@/features/pages/Profile/components/ProfileCard";
import { Separator } from "@/components/ui/separator";

/**
 * The access card: the password row and the logout row, split by one line
 * (spec 0023, AC-7).
 */
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

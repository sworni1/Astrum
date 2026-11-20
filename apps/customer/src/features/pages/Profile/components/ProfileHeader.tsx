"use client";

import { useTranslations } from "next-intl";
import type { UserData } from "@/common/types/user.types";
import {
  HEADER_AVATAR,
  HEADER_AVATAR_GRADIENT,
  HEADER_EMAIL,
  HEADER_META,
  HEADER_NAME,
  HEADER_NAME_BLOCK,
  HEADER_ROW,
  ROLE_BADGE,
} from "@/features/pages/Profile/lib/styles";
import { avatarInitial, roleBadgeKey } from "@/features/pages/Profile/lib/roleBadge";

type Props = {
  profileData: UserData;
};

const ProfileHeader = ({ profileData }: Props) => {
  const t = useTranslations("profile");
  const badge = roleBadgeKey(profileData.isSeller, profileData.staffRoles);
  const displayName = profileData.nickName ?? profileData.email;

  return (
    <header className={HEADER_ROW} data-testid="profile-header">
      <div
        className={HEADER_AVATAR}
        style={{ backgroundImage: HEADER_AVATAR_GRADIENT }}
        aria-hidden="true"
      >
        {avatarInitial(displayName)}
      </div>

      <div className={HEADER_NAME_BLOCK}>
        <h1 className={HEADER_NAME}>{displayName}</h1>
        <div className={HEADER_META}>
          <span className={HEADER_EMAIL}>{profileData.email}</span>
          <span className={ROLE_BADGE} data-testid="profile-role-badge">
            {t(badge)}
          </span>
        </div>
      </div>
    </header>
  );
};

export default ProfileHeader;

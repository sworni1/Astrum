"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { staffRoleHref, staffRoleLabelKey } from "@/common/helpers/staffRoles";
import type { StaffRole } from "@/common/types/user.types";

type Props = { roles: StaffRole[] };

/** The roles the account holds, each with the page it opens (AC-2, AC-12). */
const RoleLines = ({ roles }: Props) => {
  const t = useTranslations("staff");

  return (
    <ul className="mt-2 space-y-1">
      {roles.map((role) => (
        <li key={role} className="text-sm">
          <Link
            href={staffRoleHref(role)}
            className="font-medium underline-offset-4 hover:underline"
          >
            {t(staffRoleLabelKey(role))}
          </Link>
        </li>
      ))}
    </ul>
  );
};

export default RoleLines;

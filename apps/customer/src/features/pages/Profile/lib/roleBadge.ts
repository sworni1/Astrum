import type { StaffRole } from "@/common/types/user.types";

export type RoleBadgeKey = "roleSeller" | "roleStaff" | "roleBuyer";

export const roleBadgeKey = (
  isSeller: boolean,
  staffRoles: readonly StaffRole[] | undefined,
): RoleBadgeKey => {
  if (isSeller) {
    return "roleSeller";
  }

  if (staffRoles && staffRoles.length > 0) {
    return "roleStaff";
  }

  return "roleBuyer";
};

export const avatarInitial = (name: string | null | undefined): string => {
  const first = (name ?? "").trim().charAt(0);

  return first === "" ? "?" : first.toLocaleUpperCase();
};

import type { StaffRole } from "@/common/types/user.types";

/** The three labels the header badge can print (spec 0023, AC-8). */
export type RoleBadgeKey = "roleSeller" | "roleStaff" | "roleBuyer";

/**
 * A seller outranks a staff role, because selling is what the account does with
 * its own shop; a role is a job it holds for someone else.
 */
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

/**
 * The one letter of the avatar: the first glyph of the name the header prints.
 * The API answers a missing nickname as null, so the parameter stays nullable.
 */
export const avatarInitial = (name: string | null | undefined): string => {
  const first = (name ?? "").trim().charAt(0);

  return first === "" ? "?" : first.toLocaleUpperCase();
};

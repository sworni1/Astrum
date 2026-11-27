import { UserRole } from "@astrum/db/enums";

export const USER_ROLE_ORDER: readonly UserRole[] = [
  UserRole.OWNER,
  UserRole.SELLER,
  UserRole.POINT_WORKER,
  UserRole.COURIER,
  UserRole.CUSTOMER,
];

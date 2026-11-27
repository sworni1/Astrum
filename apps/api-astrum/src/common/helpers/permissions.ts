import { UserRole } from "@astrum/db/enums";
import { USER_ROLE_ORDER } from "../constants/roles.constants";

export const PERMISSIONS = [
  "catalog:read",
  "cart:manage",
  "wishlist:manage",
  "order:create",
  "order:read:own",
  "review:write",
  "profile:manage",
  "seller:onboard",
  "seller:read:own",
  "seller:read:all",
  "staff:point:work",
  "staff:courier:work",
  "staff:courier:read:all",
  "platform:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const CUSTOMER_PERMISSIONS: readonly Permission[] = [
  "catalog:read",
  "cart:manage",
  "wishlist:manage",
  "order:create",
  "order:read:own",
  "review:write",
  "profile:manage",
];

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  [UserRole.CUSTOMER]: CUSTOMER_PERMISSIONS,
  [UserRole.SELLER]: [
    ...CUSTOMER_PERMISSIONS,
    "seller:onboard",
    "seller:read:own",
  ],
  [UserRole.POINT_WORKER]: [...CUSTOMER_PERMISSIONS, "staff:point:work"],
  [UserRole.COURIER]: [...CUSTOMER_PERMISSIONS, "staff:courier:work"],
  [UserRole.OWNER]: PERMISSIONS,
};

export const permissionsOf = (roles: readonly UserRole[]): Permission[] => {
  const granted = new Set<Permission>();

  for (const role of USER_ROLE_ORDER) {
    if (!roles.includes(role)) {
      continue;
    }

    for (const permission of ROLE_PERMISSIONS[role]) {
      granted.add(permission);
    }
  }

  return PERMISSIONS.filter((permission) => granted.has(permission));
};

export const hasPermission = (
  roles: readonly UserRole[],
  permission: Permission,
): boolean => permissionsOf(roles).includes(permission);

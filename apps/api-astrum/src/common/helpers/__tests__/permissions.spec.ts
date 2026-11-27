import { UserRole } from "@astrum/db/enums";
import {
  hasPermission,
  PERMISSIONS,
  permissionsOf,
} from "../permissions";

describe("permissionsOf", () => {
  it("grants the customer permissions to a plain account", () => {
    const permissions = permissionsOf([UserRole.CUSTOMER]);

    expect(permissions).toContain("catalog:read");
    expect(permissions).not.toContain("seller:read:own");
    expect(permissions).not.toContain("staff:point:work");
  });

  it("grants every permission to the owner", () => {
    expect(permissionsOf([UserRole.OWNER])).toEqual([...PERMISSIONS]);
  });

  it("unions the permissions of every held role", () => {
    const permissions = permissionsOf([
      UserRole.CUSTOMER,
      UserRole.SELLER,
      UserRole.COURIER,
    ]);

    expect(permissions).toContain("seller:read:own");
    expect(permissions).toContain("staff:courier:work");
    expect(permissions).not.toContain("staff:point:work");
  });

  it("answers an empty list for an account without roles", () => {
    expect(permissionsOf([])).toEqual([]);
  });

  it("answers one permission through hasPermission", () => {
    expect(hasPermission([UserRole.CUSTOMER], "catalog:read")).toBe(true);
    expect(hasPermission([UserRole.CUSTOMER], "platform:manage")).toBe(false);
  });
});

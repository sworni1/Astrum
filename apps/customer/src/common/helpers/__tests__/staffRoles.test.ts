import { describe, expect, it } from "vitest";
import {
  heldRoles,
  staffRoleHref,
  staffRoleLabelKey,
} from "@/common/helpers/staffRoles";

describe("staff role helpers", () => {
  it("lists the held roles in the fixed product order (AC-2)", () => {
    expect(heldRoles(["COURIER", "POINT_WORKER"])).toEqual([
      "POINT_WORKER",
      "COURIER",
    ]);
    expect(heldRoles(["COURIER"])).toEqual(["COURIER"]);
    expect(heldRoles([])).toEqual([]);
  });

  it("names each role through its catalog key (AC-14)", () => {
    expect(staffRoleLabelKey("POINT_WORKER")).toBe("roles.pointWorker");
    expect(staffRoleLabelKey("COURIER")).toBe("roles.courier");
  });

  it("opens the page of each role (AC-12)", () => {
    expect(staffRoleHref("POINT_WORKER")).toBe("/point");
    expect(staffRoleHref("COURIER")).toBe("/courier");
  });
});

import { describe, expect, it } from "vitest";
import { hasPermission } from "../src/permissions.js";

function memberWithRoles(...names: string[]) {
  return {
    permissions: { has: () => false },
    roles: { cache: names.map((name) => ({ name })) }
  } as never;
}

describe("hasPermission", () => {
  it("allows a guild master to perform officer operations", () => {
    expect(hasPermission(memberWithRoles("Guild Master"), "dkpOfficer")).toBe(true);
  });

  it("does not allow a raid leader to modify DKP", () => {
    expect(hasPermission(memberWithRoles("Raid Leader"), "dkpOfficer")).toBe(false);
  });
});

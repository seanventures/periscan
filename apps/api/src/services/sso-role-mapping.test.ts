import { describe, expect, it } from "vitest";

import {
  extractClaimValues,
  parseStoredRoleMappings,
  pickHighestPrivilegeRole,
  resolveSsoMappedRole
} from "./sso-role-mapping.js";

describe("extractClaimValues", () => {
  it("reads string, array, and nested value claims", () => {
    expect(extractClaimValues({ groups: "admins" }, "groups")).toEqual([
      "admins"
    ]);
    expect(
      extractClaimValues({ groups: ["admins", "viewers", "admins"] }, "groups")
    ).toEqual(["admins", "viewers"]);
    expect(
      extractClaimValues(
        {
          groups: [{ value: "periscan-admins" }, { value: "other" }]
        },
        "groups"
      )
    ).toEqual(["periscan-admins", "other"]);
  });

  it("returns empty for missing claims", () => {
    expect(extractClaimValues({}, "groups")).toEqual([]);
    expect(extractClaimValues(null, "groups")).toEqual([]);
  });
});

describe("resolveSsoMappedRole", () => {
  const mappings = [
    { claimValue: "periscan-admins", role: "Admin" as const },
    { claimValue: "periscan-viewers", role: "Viewer" as const },
    { claimValue: "periscan-owners", role: "Owner" as const },
    { claimValue: "periscan-engineers", role: "SecurityEngineer" as const }
  ];

  it("is disabled when no mappings are configured", () => {
    const result = resolveSsoMappedRole({
      claims: { groups: ["periscan-admins"] },
      config: {
        defaultMappedRole: null,
        roleClaimName: "groups",
        roleMappings: []
      }
    });
    expect(result).toMatchObject({ role: null, status: "disabled" });
  });

  it("maps a single matching group to a role", () => {
    const result = resolveSsoMappedRole({
      claims: { groups: ["periscan-engineers", "unrelated"] },
      config: {
        defaultMappedRole: null,
        roleClaimName: "groups",
        roleMappings: mappings
      }
    });
    expect(result).toMatchObject({
      role: "SecurityEngineer",
      status: "mapped"
    });
    if (result.status === "mapped") {
      expect(result.matchedClaimValues).toContain("periscan-engineers");
    }
  });

  it("picks the highest-privilege role when multiple groups match", () => {
    const result = resolveSsoMappedRole({
      claims: {
        groups: ["periscan-viewers", "periscan-admins", "periscan-engineers"]
      },
      config: {
        defaultMappedRole: "Viewer",
        roleClaimName: "groups",
        roleMappings: mappings
      }
    });
    expect(result).toMatchObject({ role: "Admin", status: "mapped" });
  });

  it("is case-insensitive for claim values", () => {
    const result = resolveSsoMappedRole({
      claims: { groups: ["Periscan-Admins"] },
      config: {
        defaultMappedRole: null,
        roleClaimName: "groups",
        roleMappings: mappings
      }
    });
    expect(result).toMatchObject({ role: "Admin", status: "mapped" });
  });

  it("defaults claim name to groups when unset", () => {
    const result = resolveSsoMappedRole({
      claims: { groups: ["periscan-viewers"] },
      config: {
        defaultMappedRole: null,
        roleClaimName: null,
        roleMappings: mappings
      }
    });
    expect(result).toMatchObject({ role: "Viewer", status: "mapped" });
  });

  it("supports custom claim names (Azure AD style)", () => {
    const claim =
      "http://schemas.microsoft.com/ws/2008/06/identity/claims/groups";
    const result = resolveSsoMappedRole({
      claims: {
        [claim]: ["periscan-owners"]
      },
      config: {
        defaultMappedRole: null,
        roleClaimName: claim,
        roleMappings: mappings
      }
    });
    expect(result).toMatchObject({ role: "Owner", status: "mapped" });
  });

  it("uses defaultMappedRole when no group matches", () => {
    const result = resolveSsoMappedRole({
      claims: { groups: ["something-else"] },
      config: {
        defaultMappedRole: "Viewer",
        roleClaimName: "groups",
        roleMappings: mappings
      }
    });
    expect(result).toMatchObject({ role: "Viewer", status: "default" });
  });

  it("returns unmapped (deny) when no match and no default", () => {
    const result = resolveSsoMappedRole({
      claims: { groups: ["something-else"] },
      config: {
        defaultMappedRole: null,
        roleClaimName: "groups",
        roleMappings: mappings
      }
    });
    expect(result).toMatchObject({ role: null, status: "unmapped" });
  });

  it("returns unmapped when claim is missing and no default", () => {
    const result = resolveSsoMappedRole({
      claims: { email: "user@example.com" },
      config: {
        defaultMappedRole: null,
        roleClaimName: "groups",
        roleMappings: mappings
      }
    });
    expect(result).toMatchObject({
      claimValues: [],
      role: null,
      status: "unmapped"
    });
  });
});

describe("parseStoredRoleMappings", () => {
  it("filters invalid JSON rows", () => {
    expect(
      parseStoredRoleMappings([
        { claimValue: "admins", role: "Admin" },
        { claimValue: "", role: "Viewer" },
        { claimValue: "x", role: "NotARole" },
        null,
        "skip"
      ])
    ).toEqual([{ claimValue: "admins", role: "Admin" }]);
  });
});

describe("pickHighestPrivilegeRole", () => {
  it("orders Owner above Admin above Viewer", () => {
    expect(
      pickHighestPrivilegeRole(["Viewer", "Admin", "SecurityEngineer"])
    ).toBe("Admin");
    expect(pickHighestPrivilegeRole(["Owner", "Admin"])).toBe("Owner");
    expect(pickHighestPrivilegeRole([])).toBeNull();
  });
});

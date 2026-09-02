import { describe, expect, it } from "vitest";

import { assessNonHumanIdentityRisk } from "./services/non-human-identities.js";

describe("non-human identity risk assessment", () => {
  it("ranks compound, evidence-derived credential risk deterministically", () => {
    const risk = assessNonHumanIdentityRisk(
      {
        environment: "production",
        expiresAt: "2026-06-01T00:00:00.000Z",
        lastUsedAt: "2025-01-01T00:00:00.000Z",
        owner: null,
        privileges: ["organization:admin"],
        publicExposure: true,
        resourceAccess: [
          { access: "write", environment: "production", resource: "repo:api" },
          { access: "write", environment: "development", resource: "repo:web" }
        ],
        rotatedAt: "2025-01-01T00:00:00.000Z"
      },
      new Date("2026-07-14T00:00:00.000Z")
    );

    expect(risk).toMatchObject({ level: "Critical", score: 100 });
    expect(risk.flags).toEqual(
      expect.arrayContaining([
        "Orphaned",
        "OverPrivileged",
        "PubliclyExposed",
        "Stale",
        "RotationOverdue",
        "Expired",
        "CrossEnvironment"
      ])
    );
  });
});

import { describe, expect, it } from "vitest";

import {
  COMMUNITY_VALIDATION_SUITE,
  isCommunityValidationModuleId,
  isCommunityValidationToolId
} from "@periscan/shared";

import { startBasVigoliumImport } from "./bas-vigolium-start.js";

function qualifiedInput(overrides: Record<string, unknown> = {}) {
  return {
    authorized: true,
    fixtureMode: true,
    policyOutcome: "Allowed",
    qualified: true,
    startGate: { startable: true },
    verifiedScope: true,
    ...overrides
  };
}

describe("startBasVigoliumImport", () => {
  it("records an import-only audit plan when qualified, authorized, and verified", () => {
    const result = startBasVigoliumImport(qualifiedInput());

    expect(result.jobsQueued).toBe(1);
    expect(result.queued).toBe(true);
    expect(result.recordedPlan?.kind).toBe("import-only-audit");
    expect(result.recordedPlan?.executed).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.importOnly).toBe(true);
    expect(result.liveSupported).toBe(false);
    expect(result.liveAttackPlanning).toBe(false);
    expect(result.communityDefaultPack).toBe(false);
    expect(result.installable).toBe(false);
    expect(result.license.spdxLicenseId).toBe("AGPL-3.0");
    expect(result.license.disposition).toBe("Blocked");
    expect(result.policyStatus).toBe("Blocked");
  });

  it("queues zero jobs when the start gate is not startable", () => {
    const result = startBasVigoliumImport(
      qualifiedInput({ startGate: { startable: false } })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.recordedPlan).toBeNull();
    expect(result.executed).toBe(false);
    expect(result.code).toBe("vigolium_not_startable");
  });

  it("queues zero jobs when unqualified, unauthorized, unverified, or policy is not Allowed", () => {
    const unqualified = startBasVigoliumImport(
      qualifiedInput({ qualified: false })
    );
    const unauthorized = startBasVigoliumImport(
      qualifiedInput({ authorized: false })
    );
    const unverified = startBasVigoliumImport(
      qualifiedInput({ verifiedScope: false })
    );
    const deniedPolicy = startBasVigoliumImport(
      qualifiedInput({ policyOutcome: "Denied" })
    );

    expect(unqualified.jobsQueued).toBe(0);
    expect(unqualified.code).toBe("vigolium_qualification_required");
    expect(unauthorized.jobsQueued).toBe(0);
    expect(unauthorized.code).toBe("vigolium_authorization_required");
    expect(unverified.jobsQueued).toBe(0);
    expect(unverified.code).toBe("vigolium_verified_scope_required");
    expect(deniedPolicy.jobsQueued).toBe(0);
    expect(deniedPolicy.recordedPlan).toBeNull();
    expect(deniedPolicy.code).toBe("vigolium_policy_not_allowed");
  });

  it("queues zero jobs for Community default pack or live attack planning", () => {
    const community = startBasVigoliumImport(
      qualifiedInput({ communityDefaultPack: true })
    );
    const live = startBasVigoliumImport(
      qualifiedInput({ liveAttackPlanning: true })
    );

    expect(community.jobsQueued).toBe(0);
    expect(community.communityDefaultPack).toBe(false);
    expect(community.code).toBe("vigolium_community_default_denied");
    expect(live.jobsQueued).toBe(0);
    expect(live.executed).toBe(false);
    expect(live.liveSupported).toBe(false);
    expect(live.code).toBe("vigolium_live_attack_planning_denied");
  });

  it("does not add Vigolium AGPL to the Community default pack", () => {
    const result = startBasVigoliumImport(qualifiedInput());

    expect(result.communityDefaultPack).toBe(false);
    expect(result.license.redistributableInDefaultPack).toBe(false);
    expect(result.license.spdxLicenseId).toBe("AGPL-3.0");
    expect(isCommunityValidationToolId("vigolium")).toBe(false);
    expect(isCommunityValidationModuleId("vigolium.audit_import")).toBe(false);
    expect(
      COMMUNITY_VALIDATION_SUITE.map((entry) => entry.moduleId as string)
    ).not.toContain("vigolium.audit_import");
    expect(
      COMMUNITY_VALIDATION_SUITE.some((entry) =>
        /GPL|LGPL|AGPL/i.test(entry.toolLicense)
      )
    ).toBe(false);
  });
});

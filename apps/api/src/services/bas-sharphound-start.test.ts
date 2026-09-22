import { describe, expect, it } from "vitest";

import {
  ENGINE_LAB_THEATER_TOOL_IDS,
  isCommunityValidationToolId
} from "@periscan/shared";

import { startBasSharpHoundCollection } from "./bas-sharphound-start.js";

function scopedDraft(overrides: Record<string, unknown> = {}) {
  return {
    bounds: {
      domainControllers: ["dc01.lab.example.test"],
      maxDepth: 4,
      maxObjects: 2500,
      timeoutSeconds: 90
    },
    identities: [
      {
        kind: "ServiceAccount",
        objectId: "S-1-5-21-9-9-9-1105",
        privileges: ["LDAPRead"],
        samAccountName: "svc-lab-collector"
      }
    ],
    methods: ["Group", "ACL", "ObjectProps"],
    profileId: "api-qualified-start",
    redaction: {
      redactCredentialMaterial: true,
      redactLapsPasswords: true,
      redactPasswordHashes: true,
      redactSecrets: true
    },
    targets: [
      {
        dnsName: "lab.example.test",
        kind: "Domain",
        objectId: "S-1-5-21-9-9-9"
      }
    ],
    ...overrides
  };
}

describe("startBasSharpHoundCollection", () => {
  it("records a bounded collection plan when the start gate is startable", () => {
    const result = startBasSharpHoundCollection({
      collectionProfile: scopedDraft(),
      startGate: { startable: true }
    });

    expect(result.jobsQueued).toBe(1);
    expect(result.queued).toBe(true);
    expect(result.recordedPlan?.profileId).toBe("api-qualified-start");
    expect(result.recordedPlan?.redaction.redactLapsPasswords).toBe(true);
    expect(result.recordedPlan?.targets).toHaveLength(1);
    expect(result.collectionIsNotExploitation).toBe(true);
    expect(result.liveAdCollection).toBe(false);
    expect(result.communityDefaultPack).toBe(false);
  });

  it("queues zero jobs when the start gate is not startable", () => {
    const result = startBasSharpHoundCollection({
      collectionProfile: scopedDraft(),
      startGate: { startable: false }
    });

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.recordedPlan).toBeNull();
  });

  it("queues zero jobs when LAPS redaction is off", () => {
    const result = startBasSharpHoundCollection({
      collectionProfile: scopedDraft({
        redaction: {
          redactCredentialMaterial: true,
          redactLapsPasswords: false,
          redactPasswordHashes: true,
          redactSecrets: true
        }
      }),
      startGate: { startable: true }
    });

    expect(result.jobsQueued).toBe(0);
    expect(result.recordedPlan).toBeNull();
    expect(result.denyCode).toBe("sharphound_redaction_required");
  });

  it("does not queue live AD without tenant authorization", () => {
    const result = startBasSharpHoundCollection({
      collectionProfile: scopedDraft(),
      liveAdCollection: true,
      startGate: { startable: true },
      tenantAuthorization: { liveAdCollection: false }
    });

    expect(result.jobsQueued).toBe(0);
    expect(result.liveAdCollection).toBe(false);
    expect(result.denyCode).toBe(
      "sharphound_live_ad_requires_tenant_authorization"
    );
  });

  it("does not add SharpHound to the Community default pack", () => {
    const result = startBasSharpHoundCollection({
      collectionProfile: scopedDraft(),
      startGate: { startable: true }
    });

    expect(result.communityDefaultPack).toBe(false);
    expect(result.license.redistributableInDefaultPack).toBe(false);
    expect(result.license.spdxLicenseId).toBe("GPL-3.0");
    expect(isCommunityValidationToolId("sharphound")).toBe(false);
    expect(ENGINE_LAB_THEATER_TOOL_IDS).toContain("sharphound");
  });
});

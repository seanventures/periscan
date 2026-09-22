import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  ENGINE_LAB_THEATER_TOOL_IDS,
  isCommunityValidationToolId
} from "@periscan/shared";

import { planSharpHoundQualifiedStart } from "./sharphound-qualified-start.js";

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
    profileId: "lab-qualified-start",
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

const FIXTURE_GRAPH = {
  edges: [
    {
      relationship: "MemberOf",
      source: "user:alice",
      target: "group:admins"
    }
  ],
  nodes: [
    { id: "user:alice", name: "alice", type: "User" },
    { id: "group:admins", name: "Admins", type: "Group" }
  ]
};

describe("SharpHound qualified collection start (PERISCAN-588)", () => {
  it("queues a bounded collection plan when startable with LAPS redaction and scoped targets", () => {
    const result = planSharpHoundQualifiedStart({
      collectionProfile: scopedDraft(),
      startable: true
    });

    expect(result.jobsQueued).toBe(1);
    expect(result.queued).toBe(true);
    expect(result.recorded).toBe(true);
    expect(result.collectionPlan).toMatchObject({
      collector: "sharphound",
      credentialTheft: false,
      executable: false,
      liveAdCollection: false,
      liveSupported: false,
      profileId: "lab-qualified-start",
      redaction: { redactLapsPasswords: true }
    });
    expect(result.collectionPlan?.targets).toHaveLength(1);
    expect(result.collectionIsNotExploitation).toBe(true);
    expect(result.communityDefaultPack).toBe(false);
    expect(result.liveAdCollection).toBe(false);
  });

  it("queues nothing when the start gate is not startable", () => {
    const result = planSharpHoundQualifiedStart({
      collectionProfile: scopedDraft(),
      startable: false
    });

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.recorded).toBe(false);
    expect(result.collectionPlan).toBeNull();
    expect(result.denyCode).toBe("sharphound_collection_not_startable");
  });

  it("queues nothing when LAPS password redaction is disabled", () => {
    const result = planSharpHoundQualifiedStart({
      collectionProfile: scopedDraft({
        redaction: {
          redactCredentialMaterial: true,
          redactLapsPasswords: false,
          redactPasswordHashes: true,
          redactSecrets: true
        }
      }),
      startable: true
    });

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.recorded).toBe(false);
    expect(result.collectionPlan).toBeNull();
    expect(result.denyCode).toBe("sharphound_redaction_required");
  });

  it("queues nothing for unscoped targets even when startable", () => {
    const result = planSharpHoundQualifiedStart({
      collectionProfile: scopedDraft({
        targets: [{ dnsName: "*", kind: "Domain", objectId: "*" }]
      }),
      startable: true
    });

    expect(result.jobsQueued).toBe(0);
    expect(result.denyCode).toBe("sharphound_targets_unscoped");
  });

  it("refuses live AD collection without tenant authorization", () => {
    const result = planSharpHoundQualifiedStart({
      collectionProfile: scopedDraft(),
      liveAdCollection: true,
      startable: true,
      tenantAuthorization: { liveAdCollection: false }
    });

    expect(result.jobsQueued).toBe(0);
    expect(result.liveAdCollection).toBe(false);
    expect(result.liveAdRequiresTenantAuthorization).toBe(true);
    expect(result.denyCode).toBe(
      "sharphound_live_ad_requires_tenant_authorization"
    );
  });

  it("does not execute live AD even when the tenant authorizes collection", () => {
    const result = planSharpHoundQualifiedStart({
      collectionProfile: scopedDraft(),
      liveAdCollection: true,
      startable: true,
      tenantAuthorization: { liveAdCollection: true }
    });

    expect(result.jobsQueued).toBe(1);
    expect(result.liveAdCollection).toBe(false);
    expect(result.collectionPlan?.liveAdCollection).toBe(false);
    expect(result.collectionPlan?.executable).toBe(false);
    expect(result.collectionPlan?.license.collectorExecutable).toBe(false);
    expect(result.liveAdRequiresTenantAuthorization).toBe(true);
  });

  it("refuses DCSync and credential theft instead of queuing", () => {
    const theft = planSharpHoundQualifiedStart({
      collectionProfile: scopedDraft({ credentialTheft: true }),
      startable: true
    });
    expect(theft.jobsQueued).toBe(0);
    expect(theft.credentialTheft).toBe(false);
    expect(theft.denyCode).toBe("sharphound_credential_theft_denied");

    const dcsync = planSharpHoundQualifiedStart({
      collectionProfile: scopedDraft({
        identities: [
          {
            kind: "User",
            objectId: "S-1-5-21-9-9-9-512",
            privileges: ["DCSync"],
            samAccountName: "admin"
          }
        ],
        methods: ["DCSync"]
      }),
      startable: true
    });
    expect(dcsync.jobsQueued).toBe(0);
    expect(dcsync.dcsync).toBe(false);
    expect(["sharphound_privilege_not_least", "sharphound_method_not_least_privilege"]).toContain(
      dcsync.denyCode
    );
  });

  it("keeps imported graphs as hypotheses until independent hop receipts exist", () => {
    const withoutReceipts = planSharpHoundQualifiedStart({
      collectionProfile: scopedDraft(),
      graph: FIXTURE_GRAPH,
      startable: true
    });

    expect(withoutReceipts.jobsQueued).toBe(1);
    expect(withoutReceipts.importedGraphIsHypothesis).toBe(true);
    expect(withoutReceipts.collectionIsNotExploitation).toBe(true);
    expect(withoutReceipts.pathHonesty?.claim.canClaimValidated).toBe(false);
    expect(withoutReceipts.pathHonesty?.claim.canClaimExploitable).toBe(false);

    const withReceipts = planSharpHoundQualifiedStart({
      collectionProfile: scopedDraft(),
      graph: FIXTURE_GRAPH,
      hopReceipts: [
        {
          evidenceIds: [randomUUID()],
          measurementMethod: "tcp reachability",
          moduleId: "periscan.tcp_reachability",
          relationship: "MemberOf",
          source: "user:alice",
          sourceKind: "SafeProbe",
          target: "group:admins",
          validationState: "Validated"
        }
      ],
      startable: true
    });

    expect(withReceipts.collectionIsNotExploitation).toBe(true);
    expect(withReceipts.pathHonesty?.collectionIsNotExploitation).toBe(true);
    expect(withReceipts.pathHonesty?.edges[0]?.independentlyMeasured).toBe(true);
    expect(withReceipts.pathHonesty?.edges[0]?.hypothesis).toBe(false);
  });

  it("keeps the GPL collector in Engine Lab and out of the Community default pack", () => {
    const result = planSharpHoundQualifiedStart({
      collectionProfile: scopedDraft(),
      startable: true
    });

    expect(result.communityDefaultPack).toBe(false);
    expect(result.license).toEqual({
      collectorExecutable: false,
      disposition: "RequiresLegalReview",
      redistributableInDefaultPack: false,
      spdxLicenseId: "GPL-3.0",
      toolId: "sharphound"
    });
    expect(isCommunityValidationToolId("sharphound")).toBe(false);
    expect(ENGINE_LAB_THEATER_TOOL_IDS).toContain("sharphound");
  });
});

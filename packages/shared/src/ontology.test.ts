import { describe, expect, it } from "vitest";

import {
  ENUM_ACCRETION_PR_CHECKLIST,
  DOMAIN_STATUS_ENUM_REGISTRY,
  findStatusEnumRegistration
} from "./domain-partitions.js";
import { GraphEdgeSchema, GraphNodeSchema } from "./domain.js";
import {
  isPlatformRelatedEntityType,
  isRiskRelatedEntityType,
  PLATFORM_RELATED_ENTITY_TYPES,
  RISK_RELATED_ENTITY_TYPES
} from "./related-entity-partitions.js";
import {
  ONTOLOGY_ACTIONS,
  ONTOLOGY_MODULE_VERSION,
  ONTOLOGY_OBJECT_TYPES,
  getOntologyObjectType,
  isMeasuredHopLegal,
  isMeasuredPathClaimLegal,
  listGraphEligibleObjectTypes,
  ontologyEntityHref,
  ontologyHasEntityHref,
  ontologyOpenApiTags,
  parseGraphNodeProperties,
  pathWeakestEvidenceBasis
} from "./ontology.js";
import {
  buildRunnerTaskRoutingHint,
  cidrsIntersect,
  runnerMatchesAffinityConstraints,
  scoreRunnerAffinity,
  pickRunnerIdByAffinity,
  resolveRunnerRoutingHint,
  selectRunnersByAffinity,
  toRunnerAffinityCandidate
} from "./runner-affinity.js";
import {
  RUNNER_SEGMENT_PROFILES,
  evaluateSegmentProfileTaskGate,
  getRunnerSegmentProfile,
  listRunnerSegmentProfiles,
  resolveModuleSegmentFamily,
  segmentProfileAllowsSafetyLevel
} from "./runner-segment.js";
import {
  REMEDIATION_FIXED_AUTHORIZED_WRITER_PATHS,
  assertRemediationFixedOnlyViaVerification
} from "./fix-verification.js";

describe("P09-13 RelatedEntityType partitions", () => {
  it("splits risk vs platform without overlap", () => {
    const risk = new Set<string>(RISK_RELATED_ENTITY_TYPES);
    const platform = new Set<string>(PLATFORM_RELATED_ENTITY_TYPES);
    for (const t of RISK_RELATED_ENTITY_TYPES as readonly string[]) {
      expect(platform.has(t)).toBe(false);
      expect(isRiskRelatedEntityType(t)).toBe(true);
    }
    for (const t of PLATFORM_RELATED_ENTITY_TYPES as readonly string[]) {
      expect(risk.has(t)).toBe(false);
      expect(isPlatformRelatedEntityType(t)).toBe(true);
    }
    expect(isRiskRelatedEntityType("Asset")).toBe(true);
    expect(isPlatformRelatedEntityType("TenantWebhook")).toBe(true);
    expect(isRiskRelatedEntityType("TenantWebhook")).toBe(false);
  });

  it("rejects platform types on GraphNode.relatedEntityType", () => {
    const base = {
      createdAt: "2026-07-29T00:00:00.000Z",
      evidenceIds: [],
      graphNodeId: "11111111-1111-4111-8111-111111111111",
      label: "node",
      nodeKey: "k",
      nodeType: "Asset",
      properties: {},
      relatedEntityId: "22222222-2222-4222-8222-222222222222",
      tenantId: "33333333-3333-4333-8333-333333333333",
      updatedAt: "2026-07-29T00:00:00.000Z"
    };
    expect(
      GraphNodeSchema.safeParse({
        ...base,
        relatedEntityType: "Asset"
      }).success
    ).toBe(true);
    expect(
      GraphNodeSchema.safeParse({
        ...base,
        relatedEntityType: "TenantWebhook"
      }).success
    ).toBe(false);
  });
});

describe("P09-16 enum partition registry", () => {
  it("registers Fixed-bearing status enums with non-duplication notes", () => {
    expect(ENUM_ACCRETION_PR_CHECKLIST.length).toBeGreaterThan(3);
    const validation = findStatusEnumRegistration("ValidationStateSchema");
    expect(validation?.partition).toBe("risk");
    expect(validation?.law).toBe("language");
    expect(DOMAIN_STATUS_ENUM_REGISTRY.some((r) => r.name === "RemediationStatusSchema")).toBe(
      true
    );
  });
});

describe("P11-14 GraphEdge first-class hop certainty", () => {
  it("parses evidenceBasis and measurementMethod as first-class fields", () => {
    const edge = GraphEdgeSchema.parse({
      createdAt: "2026-07-29T00:00:00.000Z",
      evidenceBasis: "Measured",
      evidenceIds: ["44444444-4444-4444-8444-444444444444"],
      graphEdgeId: "55555555-5555-4555-8555-555555555555",
      measurementMethod: "runner-probe:tcp-connect",
      properties: { source: "test" },
      relationship: "CAN_ACCESS",
      sourceNodeId: "66666666-6666-4666-8666-666666666666",
      targetNodeId: "77777777-7777-4777-8777-777777777777",
      tenantId: "33333333-3333-4333-8333-333333333333",
      updatedAt: "2026-07-29T00:00:00.000Z"
    });
    expect(edge.evidenceBasis).toBe("Measured");
    expect(edge.measurementMethod).toBe("runner-probe:tcp-connect");
  });

  it("defaults evidenceBasis to Heuristic", () => {
    const edge = GraphEdgeSchema.parse({
      createdAt: "2026-07-29T00:00:00.000Z",
      evidenceIds: [],
      graphEdgeId: "55555555-5555-4555-8555-555555555555",
      properties: {},
      relationship: "RELATES_TO",
      sourceNodeId: "66666666-6666-4666-8666-666666666666",
      targetNodeId: "77777777-7777-4777-8777-777777777777",
      tenantId: "33333333-3333-4333-8333-333333333333",
      updatedAt: "2026-07-29T00:00:00.000Z"
    });
    expect(edge.evidenceBasis).toBe("Heuristic");
  });
});

describe("P11-18 ontology module", () => {
  it("ships versioned object type registry and actions", () => {
    expect(ONTOLOGY_MODULE_VERSION).toBe("1.0.0");
    expect(ONTOLOGY_OBJECT_TYPES.length).toBeGreaterThan(20);
    expect(getOntologyObjectType("Asset")?.kind).toBe("risk");
    expect(getOntologyObjectType("TenantWebhook")?.graphEligible).toBe(false);
    expect(listGraphEligibleObjectTypes().every((t) => t.graphEligible)).toBe(
      true
    );
    expect(ONTOLOGY_ACTIONS.some((a) => a.id === "verify_fix")).toBe(true);
    expect(ontologyOpenApiTags().some((t) => t.name === "graph")).toBe(true);
  });

  it("enforces Measured hop legality with evidence + method", () => {
    expect(
      isMeasuredHopLegal({
        evidenceBasis: "Measured",
        evidenceIds: [],
        measurementMethod: "probe"
      })
    ).toBe(false);
    expect(
      isMeasuredHopLegal({
        evidenceBasis: "Measured",
        evidenceIds: ["e1"],
        measurementMethod: "probe"
      })
    ).toBe(true);
    expect(
      isMeasuredPathClaimLegal([
        {
          evidenceBasis: "Measured",
          evidenceIds: ["e1"],
          measurementMethod: "a"
        },
        {
          evidenceBasis: "Heuristic",
          evidenceIds: [],
          measurementMethod: null
        }
      ])
    ).toBe(false);
    expect(
      pathWeakestEvidenceBasis([
        { evidenceBasis: "Measured", evidenceIds: ["e"] },
        { evidenceBasis: "Heuristic", evidenceIds: [] }
      ])
    ).toBe("Heuristic");
  });

  it("resolves honest entity hrefs including object workspace", () => {
    expect(ontologyEntityHref("AttackPath", "p1")).toBe("/attack-paths/p1");
    expect(ontologyEntityHref("Scope", "s1")).toBeNull();
    expect(ontologyEntityHref("ThreatPackage", "tp-1")).toBe(
      "/objects/ThreatPackage/tp-1"
    );
    expect(ontologyHasEntityHref("ThreatPackage")).toBe(true);
    expect(ontologyEntityHref("TenantWebhook", "w1")).toBeNull();
    // P11R-3: Asset primary product URL is /assets (not /data-fabric)
    expect(ontologyEntityHref("Asset", "a1")).toBe("/assets?assetId=a1");
  });

  it("validates graph node property bags per family", () => {
    expect(
      parseGraphNodeProperties("Asset.Host", { crownJewel: true }).success
    ).toBe(true);
  });
});

describe("P10-17 segment runner profiles", () => {
  it("ships campus-passive, dc-measured, ot-safe-baseline with mTLS", () => {
    const profiles = listRunnerSegmentProfiles();
    expect(profiles).toHaveLength(3);
    for (const p of profiles) {
      expect(p.mtlsRequired).toBe(true);
      expect(p.skuKey.startsWith("segment.")).toBe(true);
    }
    expect(getRunnerSegmentProfile("ot-safe-baseline").forbidInternetEgress).toBe(
      true
    );
    expect(
      segmentProfileAllowsSafetyLevel("campus-passive", "PassiveReadOnly")
    ).toBe(true);
    expect(
      segmentProfileAllowsSafetyLevel("campus-passive", "ActiveNonInvasive")
    ).toBe(false);
    expect(
      segmentProfileAllowsSafetyLevel("dc-measured", "AdvancedAdversarial")
    ).toBe(false);
    expect(RUNNER_SEGMENT_PROFILES["dc-measured"].resourceLimits.maxConcurrentTasks).toBeGreaterThan(
      1
    );
  });

  it("P10-1: maps real moduleIds and enforces profile at task gate", () => {
    expect(resolveModuleSegmentFamily("runner.reachability_check")).toBe(
      "reachability"
    );
    expect(resolveModuleSegmentFamily("periscan.dns_resolution_check")).toBe(
      "dns-resolve"
    );
    expect(resolveModuleSegmentFamily("recon.http_probe")).toBe("http-probe");
    expect(resolveModuleSegmentFamily("identity.cred_spray")).toBeNull();

    // OT: passive only — reachability + ActiveNonInvasive denied
    expect(
      evaluateSegmentProfileTaskGate({
        moduleId: "runner.reachability_check",
        profileId: "ot-safe-baseline",
        safetyLevel: "ActiveNonInvasive"
      }).allowed
    ).toBe(false);

    // Campus-passive allows reachability at PassiveReadOnly only
    expect(
      evaluateSegmentProfileTaskGate({
        moduleId: "runner.reachability_check",
        profileId: "campus-passive",
        safetyLevel: "ActiveNonInvasive"
      })
    ).toMatchObject({ allowed: false, code: "runner_segment_safety_denied" });

    expect(
      evaluateSegmentProfileTaskGate({
        moduleId: "runner.dns_resolution_check",
        profileId: "campus-passive",
        safetyLevel: "PassiveReadOnly"
      }).allowed
    ).toBe(true);

    // Unbound runner always allowed
    expect(
      evaluateSegmentProfileTaskGate({
        moduleId: "runner.reachability_check",
        profileId: null,
        safetyLevel: "ActiveNonInvasive"
      }).allowed
    ).toBe(true);

    // OT force forbidInternetEgress
    expect(
      evaluateSegmentProfileTaskGate({
        moduleId: "runner.tls_certificate_check",
        profileId: "ot-safe-baseline",
        safetyLevel: "PassiveReadOnly"
      }).forbidInternetEgress
    ).toBe(true);
  });
});

describe("P10-15 multi-site runner affinity", () => {
  it("filters by site/segment and scores preferred runner", () => {
    const candidates = [
      {
        runnerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        status: "Active",
        affinity: {
          approvedCidrs: ["10.0.0.0/8"],
          networkSegment: "dc-east",
          siteId: "nyc-1"
        }
      },
      {
        runnerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        status: "Active",
        affinity: {
          approvedCidrs: ["192.168.0.0/16"],
          networkSegment: "campus",
          siteId: "bos-1"
        }
      }
    ];

    const selected = selectRunnersByAffinity(candidates, {
      siteId: "nyc-1",
      networkSegment: "dc-east",
      targetCidrs: ["10.1.2.3/32"]
    });
    expect(selected).toHaveLength(1);
    expect(selected[0]?.runnerId).toBe(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    );

    expect(
      scoreRunnerAffinity(candidates[0]!, {
        preferredRunnerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        targetCidrs: []
      })
    ).toBeGreaterThan(900);

    expect(cidrsIntersect("10.0.0.0/8", "10.1.2.3/32")).toBe(true);
    expect(cidrsIntersect("10.0.0.0/8", "192.168.1.0/24")).toBe(false);
  });

  it("P10-2: hard-fails wrong-site runner when routing requires site", () => {
    const plantRunner = {
      runnerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      status: "Active",
      affinity: {
        approvedCidrs: [] as string[],
        networkSegment: "ot-cell-b",
        siteId: "plant-3"
      }
    };
    const campusRunner = {
      runnerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      status: "Active",
      affinity: {
        approvedCidrs: [] as string[],
        networkSegment: "campus",
        siteId: "hq-1"
      }
    };
    const hint = buildRunnerTaskRoutingHint({
      siteId: "plant-3",
      networkSegment: "ot-cell-b"
    });
    expect(runnerMatchesAffinityConstraints(plantRunner, hint)).toBe(true);
    expect(runnerMatchesAffinityConstraints(campusRunner, hint)).toBe(false);
    // No hard topology constraints → eligible
    expect(
      runnerMatchesAffinityConstraints(
        campusRunner,
        buildRunnerTaskRoutingHint({})
      )
    ).toBe(true);
  });

  it("P10-2 residual: auto-picks runner by site/segment when preferred unset", () => {
    const candidates = [
      toRunnerAffinityCandidate({
        networkSegment: "ot-cell-b",
        runnerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        siteId: "plant-3",
        status: "Active"
      }),
      toRunnerAffinityCandidate({
        networkSegment: "campus",
        runnerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        siteId: "hq-1",
        status: "Active"
      }),
      toRunnerAffinityCandidate({
        networkSegment: null,
        runnerId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        siteId: null,
        status: "Active"
      })
    ];

    // Unbound hybrid: no topology + no preferred → leave runner unset.
    expect(
      pickRunnerIdByAffinity(candidates, resolveRunnerRoutingHint({}))
    ).toBeNull();

    // Scope segmentName alone drives hard segment affinity selection.
    const fromScope = resolveRunnerRoutingHint({
      scopeSegmentName: "ot-cell-b"
    });
    expect(fromScope.networkSegment).toBe("ot-cell-b");
    expect(pickRunnerIdByAffinity(candidates, fromScope)).toBe(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    );

    // Schedule config site+segment when preferredRunnerId unset.
    const fromConfig = resolveRunnerRoutingHint({
      config: { networkSegment: "campus", siteId: "hq-1" }
    });
    expect(pickRunnerIdByAffinity(candidates, fromConfig)).toBe(
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    );

    // Soft preferred ranks above site-only peers; still no hard fail.
    const preferred = resolveRunnerRoutingHint({
      config: {
        preferredRunnerId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        siteId: "hq-1",
        networkSegment: "campus"
      }
    });
    // Hard site/segment still filters; preferred unbound hybrid is ineligible.
    expect(pickRunnerIdByAffinity(candidates, preferred)).toBe(
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    );

    // Soft preferred alone (no hard topology) selects preferred when healthy.
    expect(
      pickRunnerIdByAffinity(
        candidates,
        resolveRunnerRoutingHint({
          preferredRunnerId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
        })
      )
    ).toBe("cccccccc-cccc-4ccc-8ccc-cccccccccccc");

    // Hard mismatch with no eligible fleet → null (gates deny wrong pin later).
    expect(
      pickRunnerIdByAffinity(
        candidates,
        resolveRunnerRoutingHint({
          siteId: "missing-site",
          networkSegment: "missing-seg"
        })
      )
    ).toBeNull();
  });
});

describe("P09-3 Fixed multiverse residual", () => {
  it("documents authorized Fixed writers and gates Fixed without verification", () => {
    expect(REMEDIATION_FIXED_AUTHORIZED_WRITER_PATHS).toEqual(
      expect.arrayContaining([
        "apps/api/src/services/remediation.ts:verifyRemediation",
        "apps/api/src/services/runner.ts:submitRunnerTaskResult"
      ])
    );
    expect(REMEDIATION_FIXED_AUTHORIZED_WRITER_PATHS).toHaveLength(2);
    expect(() =>
      assertRemediationFixedOnlyViaVerification({ nextStatus: "Fixed" })
    ).toThrow(/measured verification/);
    expect(() =>
      assertRemediationFixedOnlyViaVerification({
        measuredRevalidation: true,
        nextStatus: "Fixed",
        verificationOutcome: "Fixed"
      })
    ).not.toThrow();
  });
});

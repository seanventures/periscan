import { describe, expect, it } from "vitest";

import {
  allOntologyGatesPass,
  CANONICAL_PROOF_CLOCK,
  classifyLifecycleWorkUnit,
  composeFindingPriorityScore,
  composeFindingPriorityScoreWithPrincipal,
  deriveFindingSourceMotion,
  dispositionPriorityAdjustment,
  EXPOSURE_PATH_FINDING_LAW,
  EXPOSURE_PATH_FINDING_REDUCTION,
  FEATURE_ZOO_IA_LAW,
  isOperationalFindingIdentityComplete,
  isRemediationCauseLinkageValid,
  mapCtemStageToProofLoop,
  mapProofLoopStageToCtem,
  normalizeAssetCoverageTags,
  normalizeOccurrenceCount,
  ONTOLOGY_LAWS,
  ONTOLOGY_LAW_IDS,
  ONTOLOGY_PR_CHECKLIST,
  OPERATIONAL_TAXONOMY_LAW,
  PRINCIPAL_INVENTORY_LAW,
  principalKindFromIdentityType,
  principalKindFromNonHumanIdentityType,
  principalRiskPriorityFactor,
  resolveFindingCauseId,
  runOntologyAcceptanceGates,
  SCOPE_ASSET_JOIN_LAW,
  ScopeAssetBindingSchema,
  THREAT_SUBSUMPTION_ORDER,
  threatLayerFeeds
} from "./ontology-laws";

describe("Five Laws registry (P09-17)", () => {
  it("exports five laws with statements and gate hints", () => {
    expect(ONTOLOGY_LAW_IDS).toHaveLength(5);
    for (const id of ONTOLOGY_LAW_IDS) {
      expect(ONTOLOGY_LAWS[id].statement.length).toBeGreaterThan(10);
      expect(ONTOLOGY_LAWS[id].gateHint.length).toBeGreaterThan(10);
    }
    expect(ONTOLOGY_PR_CHECKLIST.length).toBeGreaterThanOrEqual(5);
  });

  it("gates Fixed writes via closure law", () => {
    const fail = runOntologyAcceptanceGates({
      fixedWrite: {
        nextStatus: "Fixed",
        verificationOutcome: "Fixed",
        measuredRevalidation: false
      }
    });
    expect(allOntologyGatesPass(fail)).toBe(false);

    const pass = runOntologyAcceptanceGates({
      fixedWrite: {
        nextStatus: "Fixed",
        verificationOutcome: "Fixed",
        measuredRevalidation: true
      },
      grounding: { evidenceIds: ["e1"] }
    });
    expect(allOntologyGatesPass(pass)).toBe(true);
  });

  it("grounds conclusions on evidence or honest empty", () => {
    const ungrounded = runOntologyAcceptanceGates({
      grounding: { evidenceIds: [] }
    });
    expect(allOntologyGatesPass(ungrounded)).toBe(false);

    const missing = runOntologyAcceptanceGates({
      grounding: {
        evidenceIds: [],
        allowsMissingSignal: true,
        missingSignalExplicit: true
      }
    });
    expect(allOntologyGatesPass(missing)).toBe(true);
  });
});

describe("Finding identity (P09-3 / P09-4)", () => {
  it("prefers fingerprint as cause id", () => {
    expect(
      resolveFindingCauseId({
        findingId: "path-uuid",
        fingerprint: "fp-stable"
      })
    ).toBe("fp-stable");
    expect(
      resolveFindingCauseId({ findingId: "path-uuid", fingerprint: null })
    ).toBe("path-uuid");
  });

  it("requires fingerprint + groupKey + occurrenceCount for operational rows", () => {
    expect(
      isOperationalFindingIdentityComplete({
        fingerprint: "fp",
        groupKey: "gk",
        occurrenceCount: 2
      })
    ).toBe(true);
    expect(
      isOperationalFindingIdentityComplete({
        fingerprint: "fp",
        groupKey: "gk"
      })
    ).toBe(false);
    expect(normalizeOccurrenceCount(undefined)).toBe(1);
    expect(normalizeOccurrenceCount(0)).toBe(1);
    expect(normalizeOccurrenceCount(3)).toBe(3);
  });
});

describe("Scope–Asset binding (P09-5)", () => {
  it("parses durable binding contract", () => {
    const binding = ScopeAssetBindingSchema.parse({
      tenantId: "11111111-1111-4111-8111-111111111111",
      scopeId: "22222222-2222-4222-8222-222222222222",
      assetId: "33333333-3333-4333-8333-333333333333",
      status: "Authorized",
      matchedIdentifiers: ["example.com"]
    });
    expect(binding.status).toBe("Authorized");
    expect(SCOPE_ASSET_JOIN_LAW).toMatch(/ScopeAssetBinding/);
  });
});

describe("Inventory tag collapse (P09-6)", () => {
  it("collapses K8s synonym into Kubernetes", () => {
    expect(normalizeAssetCoverageTags(["K8s", "Cloud", "Kubernetes", "K8s"])).toEqual([
      "Kubernetes",
      "Cloud"
    ]);
  });
});

describe("Threat subsumption (P09-7)", () => {
  it("orders feed → alert → advisory → action", () => {
    expect(THREAT_SUBSUMPTION_ORDER[0]).toBe("ThreatIntelItem");
    expect(threatLayerFeeds("ThreatIntelItem", "ThreatAdvisory")).toBe(true);
    expect(threatLayerFeeds("ThreatAdvisory", "ThreatIntelItem")).toBe(false);
  });
});

describe("Risk composition (P09-9)", () => {
  it("composes base + missing + disposition", () => {
    expect(
      composeFindingPriorityScore({
        baseRisk: 70,
        missingSignalImpact: 10,
        dispositionAdjustment: dispositionPriorityAdjustment("AcceptedRisk")
      })
    ).toBe(55);
    expect(
      composeFindingPriorityScore({
        baseRisk: 40,
        dispositionAdjustment: dispositionPriorityAdjustment("FalsePositive")
      })
    ).toBe(0);
  });
});

describe("Operational taxonomy (P09-10)", () => {
  it("derives sourceMotion instead of hardcoding APT", () => {
    expect(
      deriveFindingSourceMotion({ signalCategory: "ControlObservation" })
    ).toBe("BAS");
    expect(deriveFindingSourceMotion({ signalCategory: "Cloud" })).toBe("Cloud");
    expect(
      deriveFindingSourceMotion({
        signalCategory: "Repository",
        signalSubcategory: "SecretLeak"
      })
    ).toBe("Secrets");
    expect(
      deriveFindingSourceMotion({
        methodology: "multi-hop lateral",
        pathName: "Domain admin path"
      })
    ).toBe("APT");
    expect(OPERATIONAL_TAXONOMY_LAW.continuousValidation).toMatch(
      /ContinuousValidation/
    );
  });
});

describe("Proof clocks (P09-11)", () => {
  it("maps CTEM aliases to canonical ProofLoopStage", () => {
    expect(CANONICAL_PROOF_CLOCK).toBe("ProofLoopStage");
    expect(mapCtemStageToProofLoop("Scope")).toBe("Authorize");
    expect(mapCtemStageToProofLoop("Mobilize")).toBe("Act");
    expect(mapProofLoopStageToCtem("Prove")).toBe("Verify");
    expect(mapProofLoopStageToCtem("Authorize")).toBe("Scope");
  });
});

describe("Principal multiverse (P09-18)", () => {
  it("maps Identity and NHI types onto shared principal kinds", () => {
    expect(principalKindFromIdentityType("Human")).toBe("human");
    expect(principalKindFromIdentityType("ServiceAccount")).toBe("service");
    expect(principalKindFromIdentityType("APIKey")).toBe("key");
    expect(principalKindFromNonHumanIdentityType("WorkloadRole")).toBe(
      "workload"
    );
    expect(principalKindFromNonHumanIdentityType("APIKey")).toBe("key");
    expect(principalKindFromNonHumanIdentityType("Certificate")).toBe("key");
    expect(PRINCIPAL_INVENTORY_LAW.riskComposition).toMatch(/factor inputs/);
  });

  it("composes NHI risk only when principal is on a path", () => {
    expect(principalRiskPriorityFactor(100, { principalOnPath: false })).toBe(
      0
    );
    expect(principalRiskPriorityFactor(100, { principalOnPath: true })).toBe(
      15
    );
    expect(principalRiskPriorityFactor(50, { principalOnPath: true })).toBe(8);
    const base = composeFindingPriorityScore({ baseRisk: 70 });
    const withPrincipal = composeFindingPriorityScoreWithPrincipal({
      baseRisk: 70,
      principalRiskScore: 100,
      principalOnPath: true
    });
    expect(withPrincipal).toBe(base + 15);
    expect(
      composeFindingPriorityScoreWithPrincipal({
        baseRisk: 70,
        principalRiskScore: 100,
        principalOnPath: false
      })
    ).toBe(base);
  });
});

describe("Exposure/Path/Finding reduction (P09-19)", () => {
  it("documents reduction and prefers finding as work queue", () => {
    expect(EXPOSURE_PATH_FINDING_REDUCTION.exposure).toMatch(/asset-scoped/);
    expect(EXPOSURE_PATH_FINDING_REDUCTION.path).toMatch(/multi-node/);
    expect(EXPOSURE_PATH_FINDING_REDUCTION.finding).toMatch(/work-queue/);
    expect(EXPOSURE_PATH_FINDING_LAW).toMatch(/No third triage queue/);
    expect(
      classifyLifecycleWorkUnit({
        hasFindingFingerprint: true,
        hasPathId: true,
        hasExposureId: true
      })
    ).toBe("finding");
    expect(classifyLifecycleWorkUnit({ hasPathId: true })).toBe("path");
    expect(classifyLifecycleWorkUnit({ hasExposureId: true })).toBe("exposure");
  });

  it("accepts fingerprint-first remediation linkage", () => {
    expect(
      isRemediationCauseLinkageValid({ fingerprint: "fp-cause" })
    ).toBe(true);
    expect(
      isRemediationCauseLinkageValid({ pathId: "path-1", fingerprint: null })
    ).toBe(true);
    expect(
      isRemediationCauseLinkageValid({
        fingerprint: null,
        pathId: null,
        exposureId: null
      })
    ).toBe(false);
  });
});

describe("Feature zoo IA (P09-20)", () => {
  it("documents jobs-only navigation law", () => {
    expect(FEATURE_ZOO_IA_LAW.jobsOnly).toContain(
      "Understand (Paths + Findings + Controls)"
    );
    expect(FEATURE_ZOO_IA_LAW.singleNavSource).toMatch(/PRIMARY_NAV/);
  });
});

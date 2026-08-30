import { createHash, generateKeyPairSync, randomUUID } from "node:crypto";

import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  createPublicDemoValidationSnapshot,
  evaluateCapabilityEntitlement,
  type AttackPath,
  type ControlRuleCoverageSummary,
  type SignalEnvelope,
  type ValidatedFinding
} from "@periscan/shared";

import type { ExecutiveTrendInput } from "./runtime-services.js";
import type { RemediationTask } from "@periscan/shared";

import {
  apiKeyRoleForScopes,
  AppServiceError,
  assertCanAssignMembershipRole,
  requireAuditExportAccess,
  attachEvidenceToSignals,
  BILLING_PACKAGE_CATALOG,
  buildAuditExportCompleteness,
  compareControlRuleCoverageSummary,
  assertProductionSecretsAtRest,
  buildDeploymentStatus,
  buildExecutiveTrendSummary,
  buildReopenVerificationEventData,
  buildValidatedFindings,
  buildVerificationFreshnessNote,
  buildVerificationResult,
  computeAttackPathFindingFingerprint,
  countHighRiskPaths,
  describeNonSnapshotPackEvidenceState,
  evaluatePolicyDecisionGate,
  ensureCorrelatedAttackPathsForTenant,
  extractPathPatternId,
  extractSignalCorrelationKeys,
  getInterventionSigningSecret,
  getReportShareSecret,
  indexRemediationsForFindings,
  isOpenRemediationStatus,
  loadSnapshotFromEvidencePack,
  mapRemediationStatusToFindingStatus,
  filterValidatedFindings,
  isUnownedValidatedFinding,
  projectFindingOwnerSlaFromRemediation,
  resolveFindingOwnerMemberId,
  resolvePrimaryRemediationForFinding,
  redactIntegrationConfigForResponse,
  resolveConnectorResyncIntegrationIds,
  resolveExternalTicketClosedRemediationStatus,
  resolveExternalValidationTemplateProfile,
  resolveWebBaseUrl,
  timingSafeEqualHex
} from "./runtime-services.js";

import {
  computePathFindingMaterial,
  computeSignalFindingMaterial
} from "@periscan/evidence";

describe("compareControlRuleCoverageSummary", () => {
  function summary(
    status: "Covered" | "LoggedOnly" | "Missed"
  ): ControlRuleCoverageSummary {
    return {
      blockedTechniques: 0,
      controlSourceId: null,
      coveredTechniques: status === "Covered" ? 1 : 0,
      generatedAt: "2026-07-14T14:00:00.000Z",
      history: [],
      improvedTechniques: 0,
      items: [
        {
          confidence: 0.8,
          controlSourceId: "11111111-1111-4111-8111-111111111111",
          evidenceIds: [],
          expectedBehaviors: ["Detected"],
          lastObservedAt: "2026-07-14T14:00:00.000Z",
          observedBehaviors: status === "Missed" ? ["Missed"] : ["Detected"],
          observedSources: ["Test EDR"],
          previousStatus: null,
          recommendation: "Test recommendation",
          scenarioId: "scenario.command",
          signalIds: [],
          status,
          tacticName: "Execution",
          techniqueId: "T1059",
          techniqueName: "Command and Scripting Interpreter",
          title: "Command observer",
          trend: "New"
        }
      ],
      loggedOnlyTechniques: status === "LoggedOnly" ? 1 : 0,
      missedTechniques: status === "Missed" ? 1 : 0,
      needsTuningTechniques: 0,
      noEvidenceTechniques: 0,
      notTestedTechniques: 0,
      recommendations: [],
      regressedTechniques: 0,
      snapshotId: null,
      staleTechniques: 0,
      tenantId: "22222222-2222-4222-8222-222222222222",
      totalTechniques: 1
    };
  }

  it("reports conservative per-technique regressions and improvements", () => {
    const regression = compareControlRuleCoverageSummary(
      summary("LoggedOnly"),
      summary("Covered")
    );
    expect(regression.regressedTechniques).toBe(1);
    expect(regression.items[0]).toMatchObject({
      previousStatus: "Covered",
      trend: "Regressed"
    });

    const improvement = compareControlRuleCoverageSummary(
      summary("Covered"),
      summary("Missed")
    );
    expect(improvement.improvedTechniques).toBe(1);
    expect(improvement.items[0]).toMatchObject({
      previousStatus: "Missed",
      trend: "Improved"
    });
  });
});

describe("resolveExternalValidationTemplateProfile", () => {
  it("uses the scope-bound profile instead of a caller override", () => {
    expect(
      resolveExternalValidationTemplateProfile(
        { templateProfile: "safe-public-metadata" },
        { externalValidationProfileId: "safe-http-headers" }
      )
    ).toBe("safe-http-headers");
  });

  it("falls back to an explicit target profile and then the safe baseline", () => {
    expect(
      resolveExternalValidationTemplateProfile(
        { templateProfile: "safe-public-metadata" },
        { externalValidationProfileId: null }
      )
    ).toBe("safe-public-metadata");
    expect(
      resolveExternalValidationTemplateProfile(
        {},
        {
          externalValidationProfileId: null
        }
      )
    ).toBe("safe-baseline");
  });
});

describe("ensureCorrelatedAttackPathsForTenant concurrency", () => {
  it("shares one refresh across concurrent reads for the same tenant", async () => {
    let releaseInitialRead!: (value: []) => void;
    const findPaths = vi.fn(
      () => new Promise<[]>((resolve) => (releaseInitialRead = resolve))
    );
    const prisma = {
      attackPath: { findMany: findPaths },
      signalEnvelope: { findMany: vi.fn().mockResolvedValue([]) }
    } as unknown as PrismaClient;

    const tenantId = randomUUID();
    const first = ensureCorrelatedAttackPathsForTenant(prisma, tenantId);
    const second = ensureCorrelatedAttackPathsForTenant(prisma, tenantId);

    expect(findPaths).toHaveBeenCalledTimes(1);
    releaseInitialRead([]);
    await expect(Promise.all([first, second])).resolves.toEqual([[], []]);

    findPaths.mockResolvedValueOnce([]);
    await ensureCorrelatedAttackPathsForTenant(prisma, tenantId);
    expect(findPaths).toHaveBeenCalledTimes(2);
  });
});

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

const TEST_RUNNER_TASK_SIGNING_KEY_PAIR = generateKeyPairSync("ed25519");
const TEST_RUNNER_TASK_SIGNING_PRIVATE_KEY_PEM =
  TEST_RUNNER_TASK_SIGNING_KEY_PAIR.privateKey
    .export({
      format: "pem",
      type: "pkcs8"
    })
    .toString();
const TEST_MISMATCHED_RUNNER_TASK_SIGNING_PUBLIC_KEY_PEM = generateKeyPairSync(
  "ed25519"
)
  .publicKey.export({
    format: "pem",
    type: "spki"
  })
  .toString();

describe("timingSafeEqualHex", () => {
  it("returns true for equal hex digests", () => {
    const hash = sha256Hex("runner-auth-token");

    expect(timingSafeEqualHex(hash, hash)).toBe(true);
    expect(timingSafeEqualHex(hash, sha256Hex("runner-auth-token"))).toBe(true);
  });

  it("returns false for unequal hex digests", () => {
    expect(timingSafeEqualHex(sha256Hex("token-a"), sha256Hex("token-b"))).toBe(
      false
    );
  });

  it("returns false for differing-length inputs without throwing", () => {
    const hash = sha256Hex("token");

    expect(timingSafeEqualHex(hash, hash.slice(0, -2))).toBe(false);
    expect(timingSafeEqualHex("", hash)).toBe(false);
  });
});

function createSignal(): SignalEnvelope {
  const timestamp = new Date().toISOString();

  return {
    confidence: 0.82,
    createdAt: timestamp,
    evidenceIds: [],
    freshness: "Fresh",
    rawPayloadPointer: null,
    redactionStatus: "Redacted",
    relatedAssetIds: [],
    relatedControlIds: [],
    relatedEvidenceIds: [],
    relatedIdentityIds: [],
    relatedPathIds: [],
    sensitivityLevel: "Moderate",
    signalCategory: "Exposure",
    signalId: randomUUID(),
    signalSubcategory: "ExternalExposure",
    sourceIntegrationId: randomUUID(),
    sourceType: "connector.sync",
    sourceVendor: "Periscan",
    tenantId: randomUUID(),
    timestampIngested: timestamp,
    timestampObserved: timestamp,
    updatedAt: timestamp
  };
}

describe("BILLING_PACKAGE_CATALOG wartime honesty", () => {
  it("never presents packages as payment-ready or priced checkout products", () => {
    expect(BILLING_PACKAGE_CATALOG.length).toBeGreaterThan(0);
    for (const billingPackage of BILLING_PACKAGE_CATALOG) {
      expect(billingPackage.paymentProcessorStatus).toBe("NotConfigured");
      expect(JSON.stringify(billingPackage)).not.toMatch(
        /checkout|paymentIntent|cardNumber|stripe|amountDue|\$\d/iu
      );
      expect(billingPackage.publicPricingLanguage.length).toBeGreaterThan(0);
      // Exact dollar prices stay out of the catalog until a bank is connected.
      expect(billingPackage.publicPricingLanguage).not.toMatch(/\$\d/u);
    }
  });
});

describe("BILLING_PACKAGE_CATALOG Enterprise coverage", () => {
  // P08-16: Enterprise is governance + Snapshot/Core/Control/Evidence foundation,
  // not a kitchen-sink union of every published SKU.
  it("defines Enterprise as governance posture over Core/Control foundation (not full-catalog superset)", () => {
    const enterprisePackage = BILLING_PACKAGE_CATALOG.find(
      (pkg) => pkg.packageKey === "Enterprise"
    );
    expect(enterprisePackage).toBeDefined();
    expect(enterprisePackage?.status).toBe("ContactSales");
    expect(enterprisePackage?.description.toLowerCase()).toMatch(
      /governance|deployment posture|private runner/
    );

    // Governance layer present
    for (const capability of [
      "Private runner support",
      "Advanced RBAC and audit exports",
      "Tenant governance",
      "Deployment-managed retention and observability",
      "Enterprise API operations"
    ]) {
      expect(
        evaluateCapabilityEntitlement({
          package: enterprisePackage,
          requiredCapability: capability
        })
      ).toMatchObject({ entitled: true });
    }

    // Product foundation present
    for (const capability of [
      "Validation Snapshot",
      "Continuous validation schedules",
      "Control source registry",
      "EvidencePacks"
    ]) {
      expect(
        evaluateCapabilityEntitlement({
          package: enterprisePackage,
          requiredCapability: capability
        })
      ).toMatchObject({ entitled: true });
    }

    // Separate SKUs stay separate (anti kitchen-sink)
    for (const capability of [
      "MSSP tenant hierarchy",
      "Client portfolio dashboard",
      "Safe AI validation suites",
      "Promptfoo/PyRIT harness metadata",
      "Short-term assessment packs (co-managed ASV)"
    ]) {
      expect(
        evaluateCapabilityEntitlement({
          package: enterprisePackage,
          requiredCapability: capability
        })
      ).toMatchObject({ entitled: false });
    }

    expect(enterprisePackage?.includedMeterNames).not.toContain(
      "ClientTenants"
    );
    expect(enterprisePackage?.includedMeterNames).not.toContain(
      "ShortTermAssessments"
    );
    expect(enterprisePackage?.includedMeterNames).not.toContain(
      "AIApplications"
    );
  });

  it("entitles Enterprise tenants for control registry (not AI-only SKU surfaces)", () => {
    const enterprisePackage = BILLING_PACKAGE_CATALOG.find(
      (pkg) => pkg.packageKey === "Enterprise"
    );

    expect(
      evaluateCapabilityEntitlement({
        package: enterprisePackage,
        requiredCapability: "Control source registry"
      })
    ).toMatchObject({
      entitled: true,
      reason: expect.stringContaining("Enterprise")
    });

    expect(
      evaluateCapabilityEntitlement({
        package: enterprisePackage,
        requiredCapability: "AI app registry"
      })
    ).toMatchObject({ entitled: false });
  });
});

describe("buildValidatedFindings AI endpoint probe truthfulness", () => {
  it("does not promote a heuristic recorded state into a validated path claim", () => {
    const snapshot = createPublicDemoValidationSnapshot();
    const heuristicAssessment = snapshot.topAttackPaths[0]!;

    const findings = buildValidatedFindings({
      attackPaths: [heuristicAssessment],
      missingSignals: [],
      remediations: [],
      signals: [],
      tenantId: snapshot.tenantId
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      crossLinks: [
        expect.objectContaining({
          label: "Heuristic hypothesis",
          relationship: "priority_attack_path"
        })
      ],
      exploitability: "Unknown",
      pathProof: expect.objectContaining({
        objectiveState: "Unknown",
        fullyMeasured: false,
        claimDisplayLabel: "Heuristic hypothesis"
      }),
      status: "NeedsReview",
      validationState: "Discovered"
    });
    expect(findings[0]!.pathProof?.measuredEdgeCount).toBeDefined();
    expect(findings[0]!.pathProof?.totalEdgeCount).toBeDefined();
    expect(findings[0]!.priorityReason.pathContext).toMatch(
      /hops measured|no hop edges/i
    );
    expect(findings[0]!.priorityReason.pathContext).not.toMatch(
      /Leading min-cut/i
    );
    expect(findings[0]!.impact).toContain("heuristic path hypothesis");
  });

  it("P09-5: derives path sourceMotion from methodology/name (not hardcoded APT)", () => {
    const snapshot = createPublicDemoValidationSnapshot();
    const basPath = structuredClone(snapshot.topAttackPaths[0]!);
    basPath.attackPath.methodology = "atomic-bas control measurement";
    basPath.attackPath.name = "Control efficacy path";

    const exposurePath = structuredClone(snapshot.topAttackPaths[0]!);
    exposurePath.attackPath.pathId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    exposurePath.attackPath.methodology = "external exposure scan";
    exposurePath.attackPath.name = "Internet exposure path";
    exposurePath.attackPath.pathNodes = exposurePath.attackPath.pathNodes.map(
      (node) => ({ ...node, pathId: exposurePath.attackPath.pathId })
    );
    exposurePath.attackPath.pathEdges = exposurePath.attackPath.pathEdges.map(
      (edge) => ({ ...edge, pathId: exposurePath.attackPath.pathId })
    );

    const findings = buildValidatedFindings({
      attackPaths: [basPath, exposurePath],
      missingSignals: [],
      remediations: [],
      signals: [],
      tenantId: snapshot.tenantId
    });

    const basFinding = findings.find(
      (f) => f.findingId === basPath.attackPath.pathId
    );
    const exvFinding = findings.find(
      (f) => f.findingId === exposurePath.attackPath.pathId
    );
    expect(basFinding?.sourceMotion).toBe("BAS");
    expect(exvFinding?.sourceMotion).toBe("EXV");
    // Default multi-hop without clearer category still lands on APT via helper.
    const defaultPath = structuredClone(snapshot.topAttackPaths[0]!);
    defaultPath.attackPath.pathId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    defaultPath.attackPath.methodology = "multi-hop lateral movement";
    defaultPath.attackPath.name = "Lateral movement chain";
    defaultPath.attackPath.pathNodes = defaultPath.attackPath.pathNodes.map(
      (node) => ({ ...node, pathId: defaultPath.attackPath.pathId })
    );
    defaultPath.attackPath.pathEdges = defaultPath.attackPath.pathEdges.map(
      (edge) => ({ ...edge, pathId: defaultPath.attackPath.pathId })
    );
    const defaultFindings = buildValidatedFindings({
      attackPaths: [defaultPath],
      missingSignals: [],
      remediations: [],
      signals: [],
      tenantId: snapshot.tenantId
    });
    expect(defaultFindings[0]?.sourceMotion).toBe("APT");
  });

  it("P09-2: explicitly remaps overclaiming path validationState (no silent Validated)", () => {
    const snapshot = createPublicDemoValidationSnapshot();
    const overclaim = structuredClone(snapshot.topAttackPaths[0]!);
    overclaim.attackPath.evidenceBasis = "Heuristic";
    overclaim.attackPath.validationState = "Validated";
    overclaim.attackPath.pathEdges = overclaim.attackPath.pathEdges.map(
      (edge) => ({
        ...edge,
        evidenceBasis: "Heuristic" as const,
        evidenceIds: []
      })
    );

    const findings = buildValidatedFindings({
      attackPaths: [overclaim],
      missingSignals: [],
      remediations: [],
      signals: [],
      tenantId: snapshot.tenantId
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]!.validationState).toBe("Discovered");
    expect(findings[0]!.exploitability).toBe("Unknown");
    // Remap is explicit in priority language (not silent).
    expect(findings[0]!.priorityReason.exploitability).toMatch(
      /claim-safe remap|not fully measured/i
    );
  });

  it("does not promote benign AI endpoint probes into validated findings", () => {
    const signal = {
      ...createSignal(),
      signalCategory: "AIApplication",
      signalSubcategory: "Inconclusive",
      sourceType: "endpoint_probe.benign_policy_boundary",
      sourceVendor: "Periscan"
    } satisfies SignalEnvelope;

    expect(
      buildValidatedFindings({
        attackPaths: [],
        missingSignals: [],
        remediations: [],
        signals: [signal],
        tenantId: signal.tenantId
      })
    ).toEqual([]);
  });

  it("still promotes real AI harness risk signals into validated findings", () => {
    const signal = {
      ...createSignal(),
      confidence: 0.88,
      evidenceIds: ["evidence-ai-risk"],
      relatedEvidenceIds: ["evidence-ai-risk"],
      signalCategory: "AIApplication",
      signalSubcategory: "GuardrailBypassed",
      sourceType: "promptfoo.suite",
      sourceVendor: "Periscan"
    } satisfies SignalEnvelope;

    const findings = buildValidatedFindings({
      attackPaths: [],
      missingSignals: [],
      remediations: [],
      signals: [signal],
      tenantId: signal.tenantId
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      evidenceIds: ["evidence-ai-risk"],
      source: "promptfoo.suite",
      sourceMotion: "AIApp",
      title: "AIApp GuardrailBypassed",
      validationState: "Exploitable"
    });
  });
});

describe("buildValidatedFindings fingerprint grouping (Slice 4 C–D)", () => {
  const assetId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const pathId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  it("stamps fingerprint fields on path and signal findings", () => {
    const snapshot = createPublicDemoValidationSnapshot();
    const pathAssessment = snapshot.topAttackPaths[0]!;
    const signal = {
      ...createSignal(),
      confidence: 0.9,
      relatedAssetIds: [assetId],
      signalCategory: "Exposure" as const,
      signalSubcategory: "Secret",
      sourceType: "gitleaks",
      sourceVendor: "GitHub",
      tenantId: snapshot.tenantId
    } satisfies SignalEnvelope;

    const findings = buildValidatedFindings({
      attackPaths: [pathAssessment],
      missingSignals: [],
      remediations: [],
      signals: [signal],
      tenantId: snapshot.tenantId
    });

    expect(findings.length).toBeGreaterThanOrEqual(1);
    for (const finding of findings) {
      expect(finding.fingerprint).toMatch(/^[0-9a-f]{64}$/);
      expect(finding.groupKey).toMatch(/^v1\|/);
      expect(finding.rootCauseSummary).toBeTruthy();
      expect(finding.occurrenceCount).toBeGreaterThanOrEqual(1);
      expect(typeof finding.affectedAssetCount).toBe("number");
      expect(finding.firstSeenAt).toBeTruthy();
      expect(finding.lastSeenAt).toBeTruthy();
    }
  });

  it("collapses two identical-cause signal rows into one work item", () => {
    const tenantId = randomUUID();
    const shared = {
      confidence: 0.85,
      relatedAssetIds: [assetId],
      signalCategory: "Exposure" as const,
      signalSubcategory: "Secret",
      sourceType: "gitleaks",
      sourceVendor: "GitHub",
      tenantId
    };

    const first = {
      ...createSignal(),
      ...shared,
      createdAt: "2026-07-01T00:00:00.000Z",
      evidenceIds: ["evidence-secret-1"],
      relatedEvidenceIds: ["evidence-secret-1"],
      signalId: "11111111-1111-4111-8111-111111111111",
      updatedAt: "2026-07-01T00:00:00.000Z"
    } satisfies SignalEnvelope;
    const second = {
      ...createSignal(),
      ...shared,
      createdAt: "2026-07-08T00:00:00.000Z",
      evidenceIds: ["evidence-secret-2"],
      relatedEvidenceIds: ["evidence-secret-2"],
      signalId: "22222222-2222-4222-8222-222222222222",
      updatedAt: "2026-07-08T00:00:00.000Z"
    } satisfies SignalEnvelope;

    const findings = buildValidatedFindings({
      attackPaths: [],
      missingSignals: [],
      remediations: [],
      signals: [first, second],
      tenantId
    });

    expect(findings).toHaveLength(1);
    const row = findings[0]!;
    expect(row.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(row.occurrenceCount).toBe(2);
    expect(row.evidenceIds).toEqual(
      expect.arrayContaining(["evidence-secret-1", "evidence-secret-2"])
    );
    // Representative keeps a real signal id (oldest first-seen among pure signals).
    expect(row.findingId).toBe(first.signalId);
    expect(row.firstSeenAt).toBe("2026-07-01T00:00:00.000Z");
    expect(row.lastSeenAt).toBe("2026-07-08T00:00:00.000Z");
    // P06-17: group members retained so disposition can attach to either id.
    expect(row.memberFindingIds).toEqual(
      expect.arrayContaining([first.signalId, second.signalId])
    );
  });

  it("absorbs path-linked signals into the path finding and keeps path claim language", () => {
    const snapshot = createPublicDemoValidationSnapshot();
    const pathAssessment = structuredClone(snapshot.topAttackPaths[0]!);
    // Force a non-upgradable heuristic path claim (same as truthfulness tests).
    pathAssessment.attackPath.evidenceBasis = "Heuristic";
    pathAssessment.attackPath.validationState = "Validated";
    pathAssessment.attackPath.pathId = pathId;
    // Ensure path nodes/edges reference pathId consistently for finding construction.
    pathAssessment.attackPath.pathNodes = pathAssessment.attackPath.pathNodes.map(
      (node) => ({ ...node, pathId })
    );
    pathAssessment.attackPath.pathEdges = pathAssessment.attackPath.pathEdges.map(
      (edge) => ({ ...edge, pathId })
    );

    const contributingSignal = {
      ...createSignal(),
      confidence: 0.95,
      createdAt: "2026-07-10T00:00:00.000Z",
      evidenceIds: ["evidence-contributing-signal"],
      relatedAssetIds: pathAssessment.attackPath.pathNodes
        .filter((node) => node.entityType === "Asset")
        .map((node) => node.entityId)
        .slice(0, 1),
      relatedEvidenceIds: ["evidence-contributing-signal"],
      relatedPathIds: [pathId],
      signalCategory: "Exposure" as const,
      signalSubcategory: "Secret",
      signalId: "33333333-3333-4333-8333-333333333333",
      sourceType: "gitleaks",
      sourceVendor: "GitHub",
      tenantId: snapshot.tenantId,
      updatedAt: "2026-07-10T00:00:00.000Z"
    } satisfies SignalEnvelope;

    // Identical-cause second signal also linked to the same path — both absorb.
    const duplicateLinked = {
      ...contributingSignal,
      createdAt: "2026-07-11T00:00:00.000Z",
      evidenceIds: ["evidence-contributing-signal-2"],
      relatedEvidenceIds: ["evidence-contributing-signal-2"],
      signalId: "44444444-4444-4444-8444-444444444444",
      updatedAt: "2026-07-11T00:00:00.000Z"
    } satisfies SignalEnvelope;

    const pathValidationBefore = buildValidatedFindings({
      attackPaths: [pathAssessment],
      missingSignals: [],
      remediations: [],
      signals: [],
      tenantId: snapshot.tenantId
    })[0]!;

    const findings = buildValidatedFindings({
      attackPaths: [pathAssessment],
      missingSignals: [],
      remediations: [],
      signals: [contributingSignal, duplicateLinked],
      tenantId: snapshot.tenantId
    });

    // Both signals feed the path → absorb leaves only the path work item.
    expect(findings).toHaveLength(1);
    const row = findings[0]!;
    expect(row.findingId).toBe(pathId);
    expect(row.sourceEntityType).toBe("AttackPath");
    expect(row.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(row.groupKey).toMatch(/^v1\|path\|/);
    expect(row.occurrenceCount).toBe(3); // path + 2 absorbed signals
    expect(row.evidenceIds).toEqual(
      expect.arrayContaining([
        "evidence-contributing-signal",
        "evidence-contributing-signal-2"
      ])
    );

    // SAFETY: claim language not upgraded by merge relative to path-only build.
    expect(row.validationState).toBe(pathValidationBefore.validationState);
    expect(row.exploitability).toBe(pathValidationBefore.exploitability);
    expect(row.validationState).toBe("Discovered");
    expect(row.exploitability).toBe("Unknown");
  });

  it("does not upgrade signal validationState when merging identical-cause signals", () => {
    const tenantId = randomUUID();
    const inconclusive = {
      ...createSignal(),
      confidence: 0.4,
      relatedAssetIds: [assetId],
      signalCategory: "Exposure" as const,
      signalSubcategory: "Inconclusive",
      signalId: "55555555-5555-4555-8555-555555555555",
      sourceType: "connector.sync",
      sourceVendor: "Periscan",
      tenantId
    } satisfies SignalEnvelope;
    const alsoInconclusive = {
      ...inconclusive,
      confidence: 0.99,
      evidenceIds: ["evidence-b"],
      relatedEvidenceIds: ["evidence-b"],
      signalId: "66666666-6666-4666-8666-666666666666"
    } satisfies SignalEnvelope;

    const findings = buildValidatedFindings({
      attackPaths: [],
      missingSignals: [],
      remediations: [],
      signals: [inconclusive, alsoInconclusive],
      tenantId
    });

    expect(findings).toHaveLength(1);
    // mapSignalExploitability for Inconclusive subcategory → Inconclusive;
    // grouping must not promote to Validated/Exploitable from higher confidence.
    expect(findings[0]!.validationState).toBe("Inconclusive");
    expect(findings[0]!.exploitability).toBe("Inconclusive");
    expect(findings[0]!.occurrenceCount).toBe(2);
  });

  it("includes signal correlationKeys in the fingerprint when present on payload", () => {
    const tenantId = randomUUID();
    const base = {
      confidence: 0.9,
      relatedAssetIds: [assetId],
      signalCategory: "Exposure" as const,
      signalSubcategory: "Secret",
      sourceType: "gitleaks",
      sourceVendor: "GitHub",
      tenantId
    };

    const withAwsKey = {
      ...createSignal(),
      ...base,
      signalId: "11111111-1111-4111-8111-111111111111",
      attributes: { correlationKeys: ["gitleaks:aws-access-key"] }
    } as SignalEnvelope & { attributes: { correlationKeys: string[] } };

    const withPat = {
      ...createSignal(),
      ...base,
      signalId: "22222222-2222-4222-8222-222222222222",
      attributes: { correlationKeys: ["gitleaks:github-pat"] }
    } as SignalEnvelope & { attributes: { correlationKeys: string[] } };

    const findings = buildValidatedFindings({
      attackPaths: [],
      missingSignals: [],
      remediations: [],
      signals: [withAwsKey, withPat],
      tenantId
    });

    // Distinct correlation keys must not collapse into one work item.
    expect(findings).toHaveLength(2);
    const fingerprints = new Set(findings.map((finding) => finding.fingerprint));
    expect(fingerprints.size).toBe(2);

    const expectedAws = computeSignalFindingMaterial({
      correlationKeys: ["gitleaks:aws-access-key"],
      relatedAssetIds: [assetId],
      signalCategory: "Exposure",
      signalSubcategory: "Secret",
      sourceType: "gitleaks",
      sourceVendor: "GitHub"
    }).fingerprint;
    expect(findings.map((finding) => finding.fingerprint)).toContain(
      expectedAws
    );
  });

  it("passes path patternId into path fingerprint material when present", () => {
    const snapshot = createPublicDemoValidationSnapshot();
    const pathAssessment = structuredClone(snapshot.topAttackPaths[0]!);
    const patterned = pathAssessment.attackPath as AttackPath & {
      patternId?: string;
    };
    patterned.patternId = "repo-secret-cloud-role";
    // Use a methodology that would otherwise yield a different family.
    patterned.methodology = "heuristic-pattern-correlation:other-pattern";

    const findings = buildValidatedFindings({
      attackPaths: [pathAssessment],
      missingSignals: [],
      remediations: [],
      signals: [],
      tenantId: snapshot.tenantId
    });

    const pathFinding = findings.find(
      (finding) => finding.sourceEntityType === "AttackPath"
    );
    expect(pathFinding).toBeTruthy();

    const assetKeys = [
      ...new Set(
        patterned.pathNodes
          .filter(
            (node) =>
              node.entityType === "Asset" || node.entityType === "Exposure"
          )
          .map((node) => node.entityId)
      )
    ];
    const expected = computePathFindingMaterial({
      assetCorrelationKeys: assetKeys,
      methodology: patterned.methodology,
      name: patterned.name,
      patternId: "repo-secret-cloud-role"
    });
    expect(pathFinding!.fingerprint).toBe(expected.fingerprint);
    expect(pathFinding!.groupKey).toContain("repo-secret-cloud-role");
  });
});

describe("extractSignalCorrelationKeys / extractPathPatternId", () => {
  it("extracts correlation keys from attributes/metadata without inventing", () => {
    const signal = {
      ...createSignal(),
      attributes: {
        correlationKeys: ["gitleaks:aws-access-key", ""],
        correlation_key: "extra:key"
      },
      metadata: {
        correlation_keys: ["meta:one"]
      }
    } as SignalEnvelope & {
      attributes: Record<string, unknown>;
      metadata: Record<string, unknown>;
    };

    expect(extractSignalCorrelationKeys(signal)).toEqual([
      "extra:key",
      "gitleaks:aws-access-key",
      "meta:one"
    ]);
    // No inventing from category alone.
    expect(extractSignalCorrelationKeys(createSignal())).toEqual([]);
  });

  it("returns explicit path patternId only", () => {
    expect(
      extractPathPatternId({
        methodology: "heuristic-pattern-correlation:repo-secret-cloud-role",
        name: "Repository secret path",
        patternId: "repo-secret-cloud-role"
      })
    ).toBe("repo-secret-cloud-role");
    expect(
      extractPathPatternId({
        methodology: "heuristic-pattern-correlation:repo-secret-cloud-role",
        name: "Repository secret path"
      })
    ).toBeNull();
  });
});


describe("PERISCAN-7 one remediation per grouped cause + owner/SLA", () => {
  function remediationFixture(
    overrides: Partial<RemediationTask> &
      Pick<RemediationTask, "remediationId" | "relatedPathId" | "status">
  ): RemediationTask {
    const now = "2026-07-20T00:00:00.000Z";
    return {
      createdAt: now,
      dueAt: null,
      evidenceIds: ["evidence-remediation-1"],
      owner: null,
      recommendedAction: "Rotate the exposed secret.",
      relatedExposureId: null,
      relatedFindingFingerprint: null,
      technicalSteps: ["Rotate", "Revoke", "Retest"],
      tenantId: "tenant-1",
      ticketId: null,
      ticketSystem: null,
      updatedAt: now,
      verificationMethod: "Rerun validation.",
      verificationRequired: true,
      ...overrides
    };
  }

  it("computes the same fingerprint for two paths of the same cause and assets", () => {
    const sharedNodes = [
      {
        entityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        entityType: "Asset" as const,
        label: "Repo",
        nodeId: "n1",
        pathId: "p1",
        sequence: 1
      }
    ];
    const pathA = {
      methodology: "heuristic-pattern-correlation:repo-secret-cloud-role",
      name: "Repo secret to production cloud role",
      pathNodes: sharedNodes.map((node) => ({ ...node, pathId: "path-a" }))
    };
    const pathB = {
      methodology: "heuristic-pattern-correlation:repo-secret-cloud-role",
      name: "Repo secret to production cloud role (recorrelated)",
      pathNodes: sharedNodes.map((node) => ({ ...node, pathId: "path-b" }))
    };
    const fpA = computeAttackPathFindingFingerprint(pathA);
    const fpB = computeAttackPathFindingFingerprint(pathB);
    expect(fpA).toMatch(/^[0-9a-f]{64}$/);
    expect(fpA).toBe(fpB);
  });

  it("prefers path-linked remediation, then open fingerprint match", () => {
    const fingerprint =
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const pathLinked = remediationFixture({
      remediationId: "11111111-1111-4111-8111-111111111111",
      relatedPathId: "path-a",
      relatedFindingFingerprint: fingerprint,
      status: "Open",
      owner: "Path owner"
    });
    const openSameCause = remediationFixture({
      remediationId: "22222222-2222-4222-8222-222222222222",
      relatedPathId: "path-other",
      relatedFindingFingerprint: fingerprint,
      status: "InProgress",
      owner: "Fingerprint owner",
      dueAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-07-21T00:00:00.000Z"
    });
    const fixedSameCause = remediationFixture({
      remediationId: "33333333-3333-4333-8333-333333333333",
      relatedPathId: "path-fixed",
      relatedFindingFingerprint: fingerprint,
      status: "Fixed",
      owner: "Settled owner"
    });
    const index = indexRemediationsForFindings([
      fixedSameCause,
      openSameCause,
      pathLinked
    ]);
    expect(index.remediationsByPathId.get("path-a")?.remediationId).toBe(
      pathLinked.remediationId
    );
    expect(index.remediationsByFingerprint.get(fingerprint)?.remediationId).toBe(
      openSameCause.remediationId
    );
    expect(
      resolvePrimaryRemediationForFinding({
        fingerprint,
        pathId: "path-b-no-direct",
        remediationsByFingerprint: index.remediationsByFingerprint,
        remediationsByPathId: index.remediationsByPathId
      })?.remediationId
    ).toBe(openSameCause.remediationId);
    expect(isOpenRemediationStatus("Open")).toBe(true);
    expect(isOpenRemediationStatus("Fixed")).toBe(false);
  });

  it("projects ownerDisplay/slaDueAt from remediation and does not invent ownerId", () => {
    expect(projectFindingOwnerSlaFromRemediation(null)).toEqual({});
    expect(
      projectFindingOwnerSlaFromRemediation(
        remediationFixture({
          remediationId: "11111111-1111-4111-8111-111111111111",
          relatedPathId: "path-a",
          status: "Open",
          owner: "  Security engineering  ",
          dueAt: "2026-08-15T12:00:00.000Z"
        })
      )
    ).toEqual({
      ownerDisplay: "Security engineering",
      slaDueAt: "2026-08-15T12:00:00.000Z"
    });
  });

  it("treats unowned via ownerId/ownerDisplay; Escalated disposition owner counts; AcceptedRisk acceptor does not", () => {
    const memberId = "77777777-7777-4777-8777-777777777777";
    const base = {
      disposition: null as ValidatedFinding["disposition"],
      ownerDisplay: undefined as string | undefined,
      ownerId: undefined as string | undefined,
      priorityScore: 90,
      title: "x"
    };

    expect(isUnownedValidatedFinding(base)).toBe(true);
    expect(
      isUnownedValidatedFinding({ ...base, ownerDisplay: "Sec eng" })
    ).toBe(false);
    expect(isUnownedValidatedFinding({ ...base, ownerId: memberId })).toBe(
      false
    );
    // P06-3: non-AcceptedRisk disposition assignee is operational ownership.
    expect(
      isUnownedValidatedFinding({
        ...base,
        disposition: {
          approvalState: "NotRequired",
          approvedAt: null,
          approvedBy: null,
          disposition: "Escalated",
          expiresAt: null,
          note: null,
          ownerId: memberId,
          updatedAt: "2026-07-01T00:00:00.000Z",
          updatedBy: memberId
        } as ValidatedFinding["disposition"]
      })
    ).toBe(false);
    // P18-3: AcceptedRisk disposition.ownerId is acceptor only — still unowned.
    expect(
      isUnownedValidatedFinding({
        ...base,
        disposition: {
          approvalState: "Pending",
          approvedAt: null,
          approvedBy: null,
          disposition: "AcceptedRisk",
          expiresAt: "2026-12-31T00:00:00.000Z",
          note: "temp",
          ownerId: memberId,
          updatedAt: "2026-07-01T00:00:00.000Z",
          updatedBy: memberId
        } as ValidatedFinding["disposition"]
      })
    ).toBe(true);

    expect(resolveFindingOwnerMemberId(base)).toBeNull();
    expect(
      resolveFindingOwnerMemberId({
        ...base,
        disposition: {
          approvalState: "Pending",
          approvedAt: null,
          approvedBy: null,
          disposition: "AcceptedRisk",
          expiresAt: "2026-12-31T00:00:00.000Z",
          note: null,
          ownerId: memberId,
          updatedAt: "2026-07-01T00:00:00.000Z",
          updatedBy: memberId
        } as ValidatedFinding["disposition"]
      })
    ).toBe(memberId);
    expect(
      resolveFindingOwnerMemberId({
        ownerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        disposition: {
          approvalState: "Pending",
          approvedAt: null,
          approvedBy: null,
          disposition: "AcceptedRisk",
          expiresAt: "2026-12-31T00:00:00.000Z",
          note: null,
          ownerId: memberId,
          updatedAt: "2026-07-01T00:00:00.000Z",
          updatedBy: memberId
        } as ValidatedFinding["disposition"]
      })
    ).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  });

  it("filterValidatedFindings owner=unassigned ignores disposition.ownerId; excludeDisposition drops noise", () => {
    const memberId = "77777777-7777-4777-8777-777777777777";
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const mk = (
      overrides: Partial<ValidatedFinding> & { findingId: string; title: string }
    ): ValidatedFinding =>
      ({
        affectedAssetCount: 1,
        createdAt: "2026-07-01T00:00:00.000Z",
        crossLinks: [],
        disposition: null,
        evidenceIds: [],
        exploitability: "Unknown",
        impact: "impact",
        measuredInNetwork: false,
        occurrenceCount: 1,
        priorityFormula:
          "Priority = clamp(sum of recorded factor contributions, 0, 100).",
        priorityReason: {
          certainty: "Heuristic correlation",
          impact: "Moderate business impact",
          reachability: "Unknown",
          summary: "test"
        },
        priorityScore: 90,
        relatedAssetIds: [],
        relatedControlIds: [],
        relatedPathIds: [],
        relatedRemediationIds: [],
        remediation: "fix it",
        riskFactors: [],
        severity: "High",
        source: "test",
        sourceEntityId: "22222222-2222-4222-8222-222222222222",
        sourceEntityType: "AttackPath",
        sourceMotion: "Exposure",
        status: "Validated",
        tenantId,
        updatedAt: "2026-07-01T00:00:00.000Z",
        validationState: "Validated",
        ...overrides
      }) as ValidatedFinding;

    const unowned = mk({
      findingId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      title: "truly unowned"
    });
    const ownedDisplay = mk({
      findingId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      ownerDisplay: "Security engineering",
      title: "owned by display"
    });
    const acceptedRiskOnly = mk({
      disposition: {
        approvalState: "Pending",
        approvedAt: null,
        approvedBy: null,
        disposition: "AcceptedRisk",
        expiresAt: "2026-12-31T00:00:00.000Z",
        note: "temp",
        ownerId: memberId,
        updatedAt: "2026-07-01T00:00:00.000Z",
        updatedBy: memberId
      },
      findingId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      title: "accepted risk disposition owner only"
    });
    const falsePositive = mk({
      disposition: {
        approvalState: "NotRequired",
        approvedAt: null,
        approvedBy: null,
        disposition: "FalsePositive",
        expiresAt: null,
        note: "noise",
        ownerId: null,
        updatedAt: "2026-07-01T00:00:00.000Z",
        updatedBy: memberId
      },
      findingId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      priorityScore: 99,
      title: "false positive noise"
    });
    const suppressed = mk({
      disposition: {
        approvalState: "NotRequired",
        approvedAt: null,
        approvedBy: null,
        disposition: "Suppressed",
        expiresAt: null,
        note: "lab",
        ownerId: null,
        updatedAt: "2026-07-01T00:00:00.000Z",
        updatedBy: memberId
      },
      findingId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      priorityScore: 98,
      title: "suppressed noise"
    });
    const escalatedOwned = mk({
      disposition: {
        approvalState: "NotRequired",
        approvedAt: null,
        approvedBy: null,
        disposition: "Escalated",
        expiresAt: null,
        note: "handoff",
        ownerId: memberId,
        updatedAt: "2026-07-01T00:00:00.000Z",
        updatedBy: memberId
      },
      findingId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      // After overlayDispositions, Escalated owner projects to ownerId.
      ownerId: memberId,
      title: "escalated with queue owner"
    });

    const all = [
      unowned,
      ownedDisplay,
      acceptedRiskOnly,
      falsePositive,
      suppressed,
      escalatedOwned
    ];

    const unassigned = filterValidatedFindings(all, { owner: "unassigned" });
    expect(unassigned.map((f) => f.title).sort()).toEqual(
      [
        "accepted risk disposition owner only",
        "false positive noise",
        "suppressed noise",
        "truly unowned"
      ].sort()
    );

    const operational = filterValidatedFindings(all, {
      excludeDisposition: ["FalsePositive", "Suppressed"],
      owner: "unassigned",
      priorityMin: 70
    });
    expect(operational.map((f) => f.title).sort()).toEqual(
      ["accepted risk disposition owner only", "truly unowned"].sort()
    );

    const byMember = filterValidatedFindings(all, { owner: memberId });
    expect(byMember.map((f) => f.title).sort()).toEqual(
      ["accepted risk disposition owner only", "escalated with queue owner"].sort()
    );
  });

  it("two path findings same fingerprint share one remediation without claim upgrade", () => {
    const snapshot = createPublicDemoValidationSnapshot();
    const base = structuredClone(snapshot.topAttackPaths[0]!);
    base.attackPath.evidenceBasis = "Heuristic";
    base.attackPath.validationState = "Validated";
    base.attackPath.methodology =
      "heuristic-pattern-correlation:repo-secret-cloud-role";
    base.attackPath.name = "Repo secret to production cloud role";
    const pathAId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const pathBId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const pathA = structuredClone(base);
    pathA.attackPath.pathId = pathAId;
    pathA.attackPath.pathNodes = pathA.attackPath.pathNodes.map((node) => ({
      ...node,
      pathId: pathAId
    }));
    pathA.attackPath.pathEdges = pathA.attackPath.pathEdges.map((edge) => ({
      ...edge,
      pathId: pathAId
    }));
    const pathB = structuredClone(base);
    pathB.attackPath.pathId = pathBId;
    pathB.attackPath.pathNodes = pathB.attackPath.pathNodes.map((node) => ({
      ...node,
      pathId: pathBId
    }));
    pathB.attackPath.pathEdges = pathB.attackPath.pathEdges.map((edge) => ({
      ...edge,
      pathId: pathBId
    }));
    const fingerprint = computeAttackPathFindingFingerprint(pathA.attackPath);
    expect(computeAttackPathFindingFingerprint(pathB.attackPath)).toBe(
      fingerprint
    );
    const sharedRemediation = remediationFixture({
      remediationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      relatedPathId: pathAId,
      relatedFindingFingerprint: fingerprint,
      status: "Open",
      owner: "Security engineering",
      dueAt: "2026-09-01T00:00:00.000Z",
      tenantId: snapshot.tenantId,
      evidenceIds: pathA.attackPath.evidenceIds
    });
    const withoutRemediation = buildValidatedFindings({
      attackPaths: [pathA, pathB],
      missingSignals: [],
      remediations: [],
      signals: [],
      tenantId: snapshot.tenantId
    });
    expect(withoutRemediation).toHaveLength(1);
    expect(withoutRemediation[0]!.validationState).toBe("Discovered");
    expect(withoutRemediation[0]!.exploitability).toBe("Unknown");
    expect(withoutRemediation[0]!.ownerDisplay).toBeUndefined();

    const withRemediation = buildValidatedFindings({
      attackPaths: [pathA, pathB],
      missingSignals: [],
      remediations: [sharedRemediation],
      signals: [],
      tenantId: snapshot.tenantId
    });
    expect(withRemediation).toHaveLength(1);
    const row = withRemediation[0]!;
    expect(row.validationState).toBe("Discovered");
    expect(row.exploitability).toBe("Unknown");
    expect(row.relatedRemediationIds).toEqual([sharedRemediation.remediationId]);
    expect(row.ownerDisplay).toBe("Security engineering");
    expect(row.slaDueAt).toBe("2026-09-01T00:00:00.000Z");
    expect(row.ownerId).toBeUndefined();
  });
});

describe("buildReopenVerificationEventData", () => {
  const verifiedAt = new Date("2026-06-12T00:00:00.000Z");

  it("records previousState as Fixed (a reopen regresses FROM Fixed)", () => {
    const data = buildReopenVerificationEventData({
      pathEvidenceBasis: "Measured",
      remediation: { evidenceIds: ["e1"], remediationId: "r1" },
      tenantId: "t1",
      verifiedAt
    });

    // The attack path was already re-correlated to its current exposed state
    // during snapshot generation; previousState must still be the Fixed state it
    // regressed from, not that exposed state.
    expect(data.previousState).toBe("Fixed");
    expect(data.outcome).toBe("Reopened");
    expect(data.newState).toBe("Reopened");
    // A snapshot diff is not a measured re-fetch.
    expect(data.measuredRevalidation).toBe(false);
    expect(data.retestMethod).toBe("schedule-diff");
    expect(data.previousEvidenceBasis).toBe("Measured");
    expect(data.evidenceIds).toEqual(["e1"]);
    expect(data.remediationId).toBe("r1");
  });
});

describe("mapRemediationStatusToFindingStatus", () => {
  function remediationWith(status: string) {
    return { status, ticketId: null } as unknown as Parameters<
      typeof mapRemediationStatusToFindingStatus
    >[0];
  }

  function measuredClosure(status: "Fixed" | "Mitigated") {
    return {
      latestVerification: {
        measuredRevalidation: true,
        outcome: status
      },
      status,
      ticketId: null
    } as unknown as Parameters<typeof mapRemediationStatusToFindingStatus>[0];
  }

  it("never reports a partial fix as fully Fixed (no over-claim)", () => {
    const status = mapRemediationStatusToFindingStatus(
      remediationWith("PartiallyFixed")
    );
    expect(status).not.toBe("Fixed");
    expect(status).not.toBe("Revalidated");
    expect(status).toBe("InProgress");
  });

  it("reports a verified full fix as Revalidated", () => {
    expect(mapRemediationStatusToFindingStatus(measuredClosure("Fixed"))).toBe(
      "Revalidated"
    );
    expect(
      mapRemediationStatusToFindingStatus(measuredClosure("Mitigated"))
    ).toBe("Revalidated");
  });

  it("does not report a fixed workflow state as revalidated without measured closure", () => {
    expect(mapRemediationStatusToFindingStatus(remediationWith("Fixed"))).toBe(
      "Inconclusive"
    );
  });

  it("reports still-exposed and reopened remediations as Reopened", () => {
    expect(
      mapRemediationStatusToFindingStatus(remediationWith("StillExposed"))
    ).toBe("Reopened");
    expect(
      mapRemediationStatusToFindingStatus(remediationWith("Reopened"))
    ).toBe("Reopened");
  });
});

describe("buildVerificationResult evidence-basis honesty gate", () => {
  function pathWith(evidenceBasis: AttackPath["evidenceBasis"]): AttackPath {
    return {
      evidenceBasis,
      impactScore: 80,
      validationState: "Reachable"
    } as unknown as AttackPath;
  }

  it("marks a re-validated MEASURED exposure as Fixed", () => {
    expect(
      buildVerificationResult({
        currentDraft: null,
        executedRealRetest: true,
        previousPath: pathWith("Measured")
      }).outcome
    ).toBe("Fixed");
  });

  it("never claims Fixed for a HEURISTIC exposure that was never measured", () => {
    // A heuristic path is inferred from templates; its disappearance does not
    // prove the real exposure is closed, so the honest outcome is Inconclusive.
    expect(
      buildVerificationResult({
        currentDraft: null,
        executedRealRetest: true,
        previousPath: pathWith("Heuristic")
      }).outcome
    ).toBe("Inconclusive");
  });

  it("stays Inconclusive without a real retest, regardless of basis", () => {
    expect(
      buildVerificationResult({
        currentDraft: null,
        executedRealRetest: false,
        previousPath: pathWith("Measured")
      }).outcome
    ).toBe("Inconclusive");
  });
});

describe("assertCanAssignMembershipRole privilege boundary", () => {
  it("blocks Admin from self-promoting to Owner", () => {
    expect(() =>
      assertCanAssignMembershipRole({
        actorRole: "Admin",
        newRole: "Owner",
        previousRole: "Admin"
      })
    ).toThrow(AppServiceError);

    try {
      assertCanAssignMembershipRole({
        actorRole: "Admin",
        newRole: "Owner",
        previousRole: "Admin"
      });
      expect.unreachable("expected forbidden_role_assignment");
    } catch (error) {
      expect(error).toBeInstanceOf(AppServiceError);
      expect((error as AppServiceError).code).toBe("forbidden_role_assignment");
      expect((error as AppServiceError).statusCode).toBe(403);
    }
  });

  it("blocks ClientAdmin from inviting an Owner or modifying MSSPOwner", () => {
    expect(() =>
      assertCanAssignMembershipRole({
        actorRole: "ClientAdmin",
        newRole: "Owner"
      })
    ).toThrow(AppServiceError);

    expect(() =>
      assertCanAssignMembershipRole({
        actorRole: "ClientAdmin",
        newRole: "Admin",
        previousRole: "MSSPOwner"
      })
    ).toThrow(AppServiceError);
  });

  it("allows Owner to grant Owner and Admin to manage non-owner roles", () => {
    expect(() =>
      assertCanAssignMembershipRole({
        actorRole: "Owner",
        newRole: "Owner",
        previousRole: "Admin"
      })
    ).not.toThrow();

    expect(() =>
      assertCanAssignMembershipRole({
        actorRole: "Admin",
        newRole: "SecurityEngineer",
        previousRole: "Viewer"
      })
    ).not.toThrow();
  });
});

describe("resolveConnectorResyncIntegrationIds honesty gate", () => {
  it("prefers live signal-linked integrations over evidence recovery", () => {
    expect(
      resolveConnectorResyncIntegrationIds({
        evidenceLinkedIntegrationIds: ["evidence-integration"],
        signalLinkedIntegrationIds: ["signal-integration", "signal-integration"]
      })
    ).toEqual(["signal-integration"]);
  });

  it("recovers only evidence-linked integrations when signals are gone", () => {
    expect(
      resolveConnectorResyncIntegrationIds({
        evidenceLinkedIntegrationIds: [
          "original-measuring-integration",
          "original-measuring-integration"
        ],
        signalLinkedIntegrationIds: []
      })
    ).toEqual(["original-measuring-integration"]);
  });

  it("returns empty instead of inventing all-connected contributors", () => {
    // Concrete false-Fixed trigger: no live contributors and no path evidence
    // linkage. Callers must NOT substitute every Connected integration here.
    expect(
      resolveConnectorResyncIntegrationIds({
        evidenceLinkedIntegrationIds: [],
        signalLinkedIntegrationIds: []
      })
    ).toEqual([]);
  });
});

describe("resolveExternalTicketClosedRemediationStatus", () => {
  it("flags externally closed remediation tickets as closed without Periscan evidence", () => {
    expect(
      resolveExternalTicketClosedRemediationStatus({
        currentStatus: "Open",
        verificationRequired: true
      })
    ).toBe("ClosedWithoutEvidence");
    expect(
      resolveExternalTicketClosedRemediationStatus({
        currentStatus: "InProgress",
        verificationRequired: true
      })
    ).toBe("ClosedWithoutEvidence");
  });

  it("does not downgrade verified outcomes or remediations that do not require verification", () => {
    expect(
      resolveExternalTicketClosedRemediationStatus({
        currentStatus: "Fixed",
        verificationRequired: true
      })
    ).toBe("Fixed");
    expect(
      resolveExternalTicketClosedRemediationStatus({
        currentStatus: "InProgress",
        verificationRequired: false
      })
    ).toBe("InProgress");
  });
});

describe("redactIntegrationConfigForResponse manifest-driven redaction", () => {
  it("redacts a manifest secret field the key-name heuristic misses", () => {
    // connectwise-manage's apiKey auth marks `publicKey` secret, but the
    // key-name heuristic does not match "publicKey" — the authoritative manifest
    // must still redact it (and its sibling privateKey), while leaving the
    // non-secret base URL / company id queryable.
    const redacted = redactIntegrationConfigForResponse(
      {
        apiBaseUrl: "https://manage.example.com/apis/3.0",
        companyId: "periscan",
        connectorKey: "connectwise-manage",
        privateKey: "enc:private",
        publicKey: "enc:public"
      },
      "apiKey"
    );

    expect(redacted?.publicKey).toBe("[redacted]");
    expect(redacted?.privateKey).toBe("[redacted]");
    expect(redacted?.apiBaseUrl).toBe("https://manage.example.com/apis/3.0");
    expect(redacted?.companyId).toBe("periscan");
  });

  it("still redacts heuristic-matched secrets without a manifest auth type", () => {
    const redacted = redactIntegrationConfigForResponse({
      apiKey: "enc:key",
      connectorKey: "github",
      label: "Prod"
    });

    expect(redacted?.apiKey).toBe("[redacted]");
    expect(redacted?.label).toBe("Prod");
  });
});

describe("buildAuditExportCompleteness", () => {
  it("reports a complete export when all events fit", () => {
    expect(
      buildAuditExportCompleteness({ exportedCount: 42, totalCount: 42 })
    ).toEqual({ eventCount: 42, totalEventCount: 42, truncated: false });
  });

  it("flags truncation when the trail exceeds the exported slice", () => {
    // A compliance reviewer must be able to tell the export is partial.
    expect(
      buildAuditExportCompleteness({ exportedCount: 5000, totalCount: 8123 })
    ).toEqual({ eventCount: 5000, totalEventCount: 8123, truncated: true });
  });

  it("handles an empty trail", () => {
    expect(
      buildAuditExportCompleteness({ exportedCount: 0, totalCount: 0 })
    ).toEqual({ eventCount: 0, totalEventCount: 0, truncated: false });
  });
});

describe("countHighRiskPaths", () => {
  function band(value: string) {
    return { risk: { band: value } } as Parameters<
      typeof countHighRiskPaths
    >[0][number];
  }

  it("counts only Critical and High bands", () => {
    expect(
      countHighRiskPaths([
        band("Critical"),
        band("High"),
        band("Medium"),
        band("Low"),
        band("Informational")
      ])
    ).toBe(2);
  });

  it("counts across the FULL set, not a leading slice (the cap bug)", () => {
    // Six high-risk paths must all count even though a snapshot would only
    // display the top maxTopItems of them.
    const assessments = [
      ...Array.from({ length: 4 }, () => band("Critical")),
      ...Array.from({ length: 2 }, () => band("High")),
      band("Medium")
    ];
    expect(countHighRiskPaths(assessments)).toBe(6);
  });

  it("returns 0 for an empty set or no high-risk bands", () => {
    expect(countHighRiskPaths([])).toBe(0);
    expect(countHighRiskPaths([band("Medium"), band("Low")])).toBe(0);
  });
});

describe("evaluatePolicyDecisionGate", () => {
  function gateWith(
    outcome: string,
    approvalState: string,
    expiresAt?: Date | string | null
  ): Parameters<typeof evaluatePolicyDecisionGate>[0] {
    return { approvalState, expiresAt, outcome } as Parameters<
      typeof evaluatePolicyDecisionGate
    >[0];
  }

  it("starts an outright-allowed decision", () => {
    expect(evaluatePolicyDecisionGate(gateWith("Allowed", "NotRequired"))).toBe(
      "start"
    );
    expect(evaluatePolicyDecisionGate(gateWith("Allowed", "Approved"))).toBe(
      "start"
    );
  });

  it("honors an admin approval on a RequiresApproval decision (not decorative)", () => {
    // approvePolicyDecision flips approvalState→Approved but leaves outcome
    // RequiresApproval; the mission must still be startable, otherwise the
    // approval control does nothing and the mission is stuck forever.
    expect(
      evaluatePolicyDecisionGate(gateWith("RequiresApproval", "Approved"))
    ).toBe("start");
  });

  it("keeps an un-approved RequiresApproval decision pending (fail-closed)", () => {
    expect(
      evaluatePolicyDecisionGate(gateWith("RequiresApproval", "Pending"))
    ).toBe("pending");
  });

  it("denies anything not allowed or admin-approved", () => {
    expect(evaluatePolicyDecisionGate(gateWith("Denied", "Rejected"))).toBe(
      "denied"
    );
    expect(
      evaluatePolicyDecisionGate(gateWith("RequiresTimeWindow", "Pending"))
    ).toBe("denied");
  });

  it("honors an admin denial on a RequiresApproval decision (fail-closed)", () => {
    // denyPolicyDecision sets approvalState→Rejected but leaves outcome
    // RequiresApproval; the mission must be denied, not left re-approvable.
    expect(
      evaluatePolicyDecisionGate(gateWith("RequiresApproval", "Rejected"))
    ).toBe("denied");
  });

  it("denies an expired authorization regardless of outcome (not decorative)", () => {
    // expiresAt is serialized into the public DTO, so an approval reads as
    // time-boxed; an expired Allowed/Approved decision must NOT start, or the
    // expiry control is decorative. Fail closed to "denied".
    const past = "2000-01-01T00:00:00.000Z";
    expect(
      evaluatePolicyDecisionGate(gateWith("Allowed", "NotRequired", past))
    ).toBe("denied");
    expect(
      evaluatePolicyDecisionGate(gateWith("RequiresApproval", "Approved", past))
    ).toBe("denied");
  });

  it("starts a not-yet-expired decision and ignores a null expiresAt", () => {
    const future = "2999-01-01T00:00:00.000Z";
    expect(
      evaluatePolicyDecisionGate(gateWith("Allowed", "NotRequired", future))
    ).toBe("start");
    // No expiry recorded → never blocks (back-compat for decisions written
    // before expiresAt existed).
    expect(
      evaluatePolicyDecisionGate(gateWith("Allowed", "NotRequired", null))
    ).toBe("start");
  });
});

describe("buildDeploymentStatus credential-key check", () => {
  // A complete-enough env for the OTHER required deployment config items, so the
  // only variable under test is the credential encryption key.
  const baseEnv: NodeJS.ProcessEnv = {
    DATABASE_URL: "postgres://x",
    PERISCAN_ALERT_ROUTING_TARGET: "pagerduty",
    PERISCAN_DATABASE_BACKUP_CADENCE: "daily",
    PERISCAN_EVIDENCE_ENCRYPTION_AT_REST: "platform-managed-sse-s3",
    PERISCAN_EVIDENCE_S3_ENDPOINT: "https://evidence.example.com",
    PERISCAN_EVIDENCE_S3_ACCESS_KEY_ID: "evidence-access-key",
    PERISCAN_EVIDENCE_S3_BUCKET: "periscan-evidence",
    PERISCAN_EVIDENCE_S3_SECRET_ACCESS_KEY: "evidence-secret-key",
    PERISCAN_EMAIL_FROM: "Security <security@example.com>",
    PERISCAN_INCIDENT_CONTACT: "secops@example.com",
    PERISCAN_JWT_SECRET: "jwt-secret",
    PERISCAN_LOG_AGGREGATION_TARGET: "datadog",
    PERISCAN_OBJECT_STORAGE_RETENTION_DAYS: "365",
    PERISCAN_EMAIL_TRANSPORT: "smtp",
    PERISCAN_SMTP_HOST: "smtp.example.com",
    PERISCAN_MODEL_CREDENTIAL_KEY: "model-credential-key",
    PERISCAN_REPORT_SHARE_SECRET: "report-share-secret",
    PERISCAN_INTERVENTION_SIGNING_SECRET: "intervention-signing-secret",
    PERISCAN_RUNNER_TASK_SIGNING_PRIVATE_KEY_PEM:
      TEST_RUNNER_TASK_SIGNING_PRIVATE_KEY_PEM,
    PERISCAN_WEB_BASE_URL: "https://app.example.com",
    REDIS_URL: "redis://x"
  };

  it("requires a dedicated credential encryption key", () => {
    const status = buildDeploymentStatus(baseEnv);
    const item = status.items.find(
      (entry) => entry.key === "PERISCAN_INTEGRATION_CREDENTIAL_KEY"
    );
    expect(item).toBeDefined();
    expect(item?.required).toBe(true);
    expect(item?.category).toBe("Security");
    // Unset → reported missing and the deployment is not ready.
    expect(item?.configured).toBe(false);
    expect(status.missingRequired).toContain(
      "PERISCAN_INTEGRATION_CREDENTIAL_KEY"
    );
    expect(status.ready).toBe(false);
  });

  it("does not treat the development session secret as production ready", () => {
    const status = buildDeploymentStatus({
      ...baseEnv,
      PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
      PERISCAN_INTEGRATION_CREDENTIAL_KEY: "dedicated-credential-key",
      PERISCAN_JWT_SECRET: "periscan-dev-session-secret"
    });
    const item = status.items.find(
      (entry) => entry.key === "PERISCAN_JWT_SECRET"
    );

    expect(item).toBeDefined();
    expect(item?.required).toBe(true);
    expect(item?.configured).toBe(false);
    expect(status.missingRequired).toContain("PERISCAN_JWT_SECRET");
    expect(status.ready).toBe(false);
  });

  it("does not allow development mode in production readiness", () => {
    const status = buildDeploymentStatus({
      ...baseEnv,
      PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
      PERISCAN_DEV_MODE: "true",
      PERISCAN_INTEGRATION_CREDENTIAL_KEY: "dedicated-credential-key"
    });
    const item = status.items.find(
      (entry) => entry.key === "PERISCAN_DEV_MODE"
    );

    expect(item).toBeDefined();
    expect(item?.required).toBe(true);
    expect(item?.configured).toBe(false);
    expect(status.missingRequired).toContain("PERISCAN_DEV_MODE");
    expect(status.ready).toBe(false);
  });

  it("requires a valid runner task-signing private key in production readiness", () => {
    const missing = buildDeploymentStatus({
      ...baseEnv,
      PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
      PERISCAN_INTEGRATION_CREDENTIAL_KEY: "dedicated-credential-key",
      PERISCAN_RUNNER_TASK_SIGNING_PRIVATE_KEY_PEM: undefined
    });
    const missingItem = missing.items.find(
      (entry) => entry.key === "PERISCAN_RUNNER_TASK_SIGNING_PRIVATE_KEY_PEM"
    );

    expect(missingItem).toBeDefined();
    expect(missingItem?.required).toBe(true);
    expect(missingItem?.configured).toBe(false);
    expect(missing.missingRequired).toContain(
      "PERISCAN_RUNNER_TASK_SIGNING_PRIVATE_KEY_PEM"
    );
    expect(missing.ready).toBe(false);

    const invalid = buildDeploymentStatus({
      ...baseEnv,
      PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
      PERISCAN_INTEGRATION_CREDENTIAL_KEY: "dedicated-credential-key",
      PERISCAN_RUNNER_TASK_SIGNING_PRIVATE_KEY_PEM: "not-a-pem-key"
    });

    expect(invalid.missingRequired).toContain(
      "PERISCAN_RUNNER_TASK_SIGNING_PRIVATE_KEY_PEM"
    );
    expect(invalid.ready).toBe(false);

    const mismatched = buildDeploymentStatus({
      ...baseEnv,
      PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
      PERISCAN_INTEGRATION_CREDENTIAL_KEY: "dedicated-credential-key",
      PERISCAN_RUNNER_TASK_SIGNING_PUBLIC_KEY_PEM:
        TEST_MISMATCHED_RUNNER_TASK_SIGNING_PUBLIC_KEY_PEM
    });

    expect(mismatched.missingRequired).toContain(
      "PERISCAN_RUNNER_TASK_SIGNING_PRIVATE_KEY_PEM"
    );
    expect(mismatched.ready).toBe(false);
  });

  it("marks the deployment ready once credential keys are configured", () => {
    const status = buildDeploymentStatus({
      ...baseEnv,
      PERISCAN_INTEGRATION_CREDENTIAL_KEY: "dedicated-credential-key"
    });
    expect(
      status.missingRequired.includes("PERISCAN_INTEGRATION_CREDENTIAL_KEY")
    ).toBe(false);
    expect(status.ready).toBe(true);
  });

  it("accepts database aliases for deployment readiness without exposing the URL", () => {
    const status = buildDeploymentStatus({
      ...baseEnv,
      DATABASE_URL: undefined,
      PERISCAN_INTEGRATION_CREDENTIAL_KEY: "dedicated-credential-key",
      SUPABASE_DATABASE_URL:
        "postgresql://user:pass@supabase-prod.local:5432/periscan_prod"
    });
    const item = status.items.find((entry) => entry.key === "DATABASE_URL");

    expect(item).toBeDefined();
    expect(item?.required).toBe(true);
    expect(item?.configured).toBe(true);
    expect(item?.value).toBeNull();
    expect(status.missingRequired).not.toContain("DATABASE_URL");
    expect(status.ready).toBe(true);
  });

  it("rejects malformed Redis URLs in deployment readiness", () => {
    const status = buildDeploymentStatus({
      ...baseEnv,
      PERISCAN_INTEGRATION_CREDENTIAL_KEY: "dedicated-credential-key",
      REDIS_URL: "http://redis.example.com"
    });
    const item = status.items.find((entry) => entry.key === "REDIS_URL");

    expect(item).toBeDefined();
    expect(item?.required).toBe(true);
    expect(item?.configured).toBe(false);
    expect(status.missingRequired).toContain("REDIS_URL");
    expect(status.ready).toBe(false);
  });

  it("requires complete evidence object storage configuration", () => {
    const status = buildDeploymentStatus({
      ...baseEnv,
      PERISCAN_EVIDENCE_S3_ACCESS_KEY_ID: undefined,
      PERISCAN_EVIDENCE_S3_BUCKET: undefined,
      PERISCAN_EVIDENCE_S3_SECRET_ACCESS_KEY: undefined,
      PERISCAN_INTEGRATION_CREDENTIAL_KEY: "dedicated-credential-key"
    });

    expect(status.missingRequired).not.toContain(
      "PERISCAN_EVIDENCE_S3_ENDPOINT"
    );
    expect(status.missingRequired).toEqual(
      expect.arrayContaining([
        "PERISCAN_EVIDENCE_S3_ACCESS_KEY_ID",
        "PERISCAN_EVIDENCE_S3_BUCKET",
        "PERISCAN_EVIDENCE_S3_SECRET_ACCESS_KEY"
      ])
    );
    expect(status.ready).toBe(false);
  });

  it("accepts Supabase storage aliases for evidence object storage readiness", () => {
    const status = buildDeploymentStatus({
      ...baseEnv,
      PERISCAN_EVIDENCE_S3_ACCESS_KEY_ID: undefined,
      PERISCAN_EVIDENCE_S3_BUCKET: undefined,
      PERISCAN_EVIDENCE_S3_ENDPOINT: undefined,
      PERISCAN_EVIDENCE_S3_SECRET_ACCESS_KEY: undefined,
      PERISCAN_INTEGRATION_CREDENTIAL_KEY: "dedicated-credential-key",
      SUPABASE_STORAGE_ACCESS_KEY_ID: "supabase-access",
      SUPABASE_STORAGE_BUCKET: "supabase-evidence",
      SUPABASE_STORAGE_ENDPOINT: "https://example.supabase.co/storage/v1/s3",
      SUPABASE_STORAGE_SECRET_ACCESS_KEY: "supabase-secret"
    });

    expect(status.missingRequired).not.toEqual(
      expect.arrayContaining([
        "PERISCAN_EVIDENCE_S3_ACCESS_KEY_ID",
        "PERISCAN_EVIDENCE_S3_BUCKET",
        "PERISCAN_EVIDENCE_S3_ENDPOINT",
        "PERISCAN_EVIDENCE_S3_SECRET_ACCESS_KEY"
      ])
    );
    expect(status.ready).toBe(true);
  });

  it("requires a dedicated model credential encryption key", () => {
    const status = buildDeploymentStatus({
      ...baseEnv,
      PERISCAN_MODEL_CREDENTIAL_KEY: undefined
    });
    const item = status.items.find(
      (entry) => entry.key === "PERISCAN_MODEL_CREDENTIAL_KEY"
    );

    expect(item).toBeDefined();
    expect(item?.required).toBe(true);
    expect(item?.category).toBe("Security");
    expect(status.missingRequired).toContain("PERISCAN_MODEL_CREDENTIAL_KEY");
    expect(status.ready).toBe(false);
  });

  it("requires a dedicated report-share signing secret", () => {
    const status = buildDeploymentStatus({
      ...baseEnv,
      PERISCAN_INTEGRATION_CREDENTIAL_KEY: "dedicated-credential-key",
      PERISCAN_REPORT_SHARE_SECRET: undefined
    });
    const item = status.items.find(
      (entry) => entry.key === "PERISCAN_REPORT_SHARE_SECRET"
    );

    expect(item).toBeDefined();
    expect(item?.required).toBe(true);
    expect(item?.category).toBe("Security");
    expect(status.missingRequired).toContain("PERISCAN_REPORT_SHARE_SECRET");
    expect(status.ready).toBe(false);
  });

  it("requires a dedicated intervention signing secret", () => {
    const status = buildDeploymentStatus({
      ...baseEnv,
      PERISCAN_INTEGRATION_CREDENTIAL_KEY: "dedicated-credential-key",
      PERISCAN_INTERVENTION_SIGNING_SECRET: undefined
    });
    const item = status.items.find(
      (entry) => entry.key === "PERISCAN_INTERVENTION_SIGNING_SECRET"
    );

    expect(item).toBeDefined();
    expect(item?.required).toBe(true);
    expect(item?.category).toBe("Security");
    expect(status.missingRequired).toContain(
      "PERISCAN_INTERVENTION_SIGNING_SECRET"
    );
    expect(status.ready).toBe(false);
  });

  it("requires an explicit transactional email transport", () => {
    const status = buildDeploymentStatus({
      ...baseEnv,
      PERISCAN_EMAIL_TRANSPORT: undefined
    });
    const item = status.items.find(
      (entry) => entry.key === "PERISCAN_EMAIL_TRANSPORT"
    );

    expect(item).toBeDefined();
    expect(item?.required).toBe(true);
    expect(item?.category).toBe("Reliability");
    expect(status.missingRequired).toContain("PERISCAN_EMAIL_TRANSPORT");
    expect(status.ready).toBe(false);
  });

  it("requires a production-safe public web base URL for email links", () => {
    const missing = buildDeploymentStatus({
      ...baseEnv,
      PERISCAN_INTEGRATION_CREDENTIAL_KEY: "dedicated-credential-key",
      PERISCAN_WEB_BASE_URL: undefined
    });
    expect(missing.missingRequired).toContain("PERISCAN_WEB_BASE_URL");
    expect(missing.ready).toBe(false);

    const localProductionUrl = buildDeploymentStatus({
      ...baseEnv,
      PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
      PERISCAN_INTEGRATION_CREDENTIAL_KEY: "dedicated-credential-key",
      PERISCAN_WEB_BASE_URL: "http://localhost:3000"
    });
    const item = localProductionUrl.items.find(
      (entry) => entry.key === "PERISCAN_WEB_BASE_URL"
    );

    expect(item).toBeDefined();
    expect(item?.required).toBe(true);
    expect(item?.configured).toBe(false);
    expect(localProductionUrl.missingRequired).toContain(
      "PERISCAN_WEB_BASE_URL"
    );
    expect(localProductionUrl.ready).toBe(false);
  });

  it("keeps CORS optional but blocks unsafe configured production origins", () => {
    const withoutCors = buildDeploymentStatus({
      ...baseEnv,
      PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
      PERISCAN_INTEGRATION_CREDENTIAL_KEY: "dedicated-credential-key",
      PERISCAN_CORS_ORIGINS: undefined
    });
    const optionalItem = withoutCors.items.find(
      (entry) => entry.key === "PERISCAN_CORS_ORIGINS"
    );

    expect(optionalItem).toBeDefined();
    expect(optionalItem?.required).toBe(false);
    expect(withoutCors.missingRequired).not.toContain("PERISCAN_CORS_ORIGINS");
    expect(withoutCors.ready).toBe(true);

    const unsafeCors = buildDeploymentStatus({
      ...baseEnv,
      PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
      PERISCAN_INTEGRATION_CREDENTIAL_KEY: "dedicated-credential-key",
      PERISCAN_CORS_ORIGINS: "http://localhost:3000"
    });
    const unsafeItem = unsafeCors.items.find(
      (entry) => entry.key === "PERISCAN_CORS_ORIGINS"
    );

    expect(unsafeItem).toBeDefined();
    expect(unsafeItem?.required).toBe(true);
    expect(unsafeItem?.configured).toBe(false);
    expect(unsafeCors.missingRequired).toContain("PERISCAN_CORS_ORIGINS");
    expect(unsafeCors.ready).toBe(false);

    const safeCors = buildDeploymentStatus({
      ...baseEnv,
      PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
      PERISCAN_INTEGRATION_CREDENTIAL_KEY: "dedicated-credential-key",
      PERISCAN_CORS_ORIGINS:
        "https://app.example.com, https://admin.example.com/"
    });

    expect(safeCors.missingRequired).not.toContain("PERISCAN_CORS_ORIGINS");
    expect(safeCors.ready).toBe(true);
  });

  it("does not treat console transport as production ready", () => {
    const status = buildDeploymentStatus({
      ...baseEnv,
      PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
      PERISCAN_EMAIL_TRANSPORT: "console",
      PERISCAN_INTEGRATION_CREDENTIAL_KEY: "dedicated-credential-key"
    });
    const item = status.items.find(
      (entry) => entry.key === "PERISCAN_EMAIL_TRANSPORT"
    );

    expect(item).toBeDefined();
    expect(item?.required).toBe(true);
    expect(item?.configured).toBe(false);
    expect(status.missingRequired).toContain("PERISCAN_EMAIL_TRANSPORT");
    expect(status.ready).toBe(false);
  });

  it("requires an explicit sender address when SMTP transport is selected", () => {
    const status = buildDeploymentStatus({
      ...baseEnv,
      PERISCAN_EMAIL_FROM: undefined,
      PERISCAN_INTEGRATION_CREDENTIAL_KEY: "dedicated-credential-key"
    });
    const item = status.items.find(
      (entry) => entry.key === "PERISCAN_EMAIL_FROM"
    );

    expect(item).toBeDefined();
    expect(item?.required).toBe(true);
    expect(item?.category).toBe("Reliability");
    expect(status.missingRequired).toContain("PERISCAN_EMAIL_FROM");
    expect(status.ready).toBe(false);
  });

  it("requires an SMTP host only when SMTP transport is selected", () => {
    const status = buildDeploymentStatus({
      ...baseEnv,
      PERISCAN_INTEGRATION_CREDENTIAL_KEY: "dedicated-credential-key",
      PERISCAN_SMTP_HOST: undefined
    });
    const item = status.items.find(
      (entry) => entry.key === "PERISCAN_SMTP_HOST"
    );

    expect(item).toBeDefined();
    expect(item?.required).toBe(true);
    expect(item?.category).toBe("Reliability");
    expect(status.missingRequired).toContain("PERISCAN_SMTP_HOST");
    expect(status.ready).toBe(false);
  });

  it("does not require SMTP host when a non-SMTP transport is selected", () => {
    const status = buildDeploymentStatus({
      ...baseEnv,
      PERISCAN_EMAIL_TRANSPORT: "noop",
      PERISCAN_EMAIL_FROM: undefined,
      PERISCAN_INTEGRATION_CREDENTIAL_KEY: "dedicated-credential-key",
      PERISCAN_SMTP_HOST: undefined
    });
    const item = status.items.find(
      (entry) => entry.key === "PERISCAN_SMTP_HOST"
    );

    expect(item).toBeDefined();
    expect(item?.required).toBe(false);
    expect(status.missingRequired).not.toContain("PERISCAN_SMTP_HOST");
    expect(status.missingRequired).not.toContain("PERISCAN_EMAIL_FROM");
    expect(status.ready).toBe(true);
  });
});

describe("getReportShareSecret", () => {
  it("uses an explicit report-share secret when configured", () => {
    expect(
      getReportShareSecret({
        PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
        PERISCAN_JWT_SECRET: "jwt-secret",
        PERISCAN_REPORT_SHARE_SECRET: "report-share-secret"
      })
    ).toBe("report-share-secret");
  });

  it("allows JWT fallback only outside production", () => {
    expect(
      getReportShareSecret({
        PERISCAN_JWT_SECRET: "local-jwt-secret"
      })
    ).toBe("local-jwt-secret");
  });

  it("refuses fallback signing keys in production", () => {
    expect(() =>
      getReportShareSecret({
        PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
        PERISCAN_JWT_SECRET: "jwt-secret"
      })
    ).toThrow(/PERISCAN_REPORT_SHARE_SECRET/u);
  });
});

describe("getInterventionSigningSecret", () => {
  it("uses an explicit intervention secret when configured", () => {
    expect(
      getInterventionSigningSecret({
        PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
        PERISCAN_JWT_SECRET: "jwt-secret",
        PERISCAN_INTERVENTION_SIGNING_SECRET: "intervention-secret"
      })
    ).toBe("intervention-secret");
  });

  it("allows JWT fallback only outside production", () => {
    expect(
      getInterventionSigningSecret({
        PERISCAN_JWT_SECRET: "local-jwt-secret"
      })
    ).toBe("local-jwt-secret");
  });

  it("refuses session-JWT fallback in production", () => {
    expect(() =>
      getInterventionSigningSecret({
        PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
        PERISCAN_JWT_SECRET: "jwt-secret"
      })
    ).toThrow(/PERISCAN_INTERVENTION_SIGNING_SECRET/u);
  });
});

describe("assertProductionSecretsAtRest", () => {
  it("is a no-op outside production", () => {
    expect(() =>
      assertProductionSecretsAtRest({
        PERISCAN_DEPLOYMENT_ENVIRONMENT: "development"
      })
    ).not.toThrow();
  });

  it("fails closed when production secrets are missing or placeholder", () => {
    expect(() =>
      assertProductionSecretsAtRest({
        PERISCAN_DEPLOYMENT_ENVIRONMENT: "production"
      })
    ).toThrow(/PERISCAN_INTEGRATION_CREDENTIAL_KEY/u);

    expect(() =>
      assertProductionSecretsAtRest({
        PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
        PERISCAN_INTEGRATION_CREDENTIAL_KEY: "integration-key",
        PERISCAN_MODEL_CREDENTIAL_KEY: "model-key",
        PERISCAN_EVIDENCE_ENCRYPTION_AT_REST: "todo",
        PERISCAN_REPORT_SHARE_SECRET: "share-secret"
      })
    ).toThrow(/PERISCAN_EVIDENCE_ENCRYPTION_AT_REST/u);
  });

  it("accepts a complete production secret set", () => {
    expect(() =>
      assertProductionSecretsAtRest({
        PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
        PERISCAN_EVIDENCE_ENCRYPTION_AT_REST: "platform-managed-sse-s3",
        PERISCAN_INTEGRATION_CREDENTIAL_KEY: "integration-key",
        PERISCAN_MODEL_CREDENTIAL_KEY: "model-key",
        PERISCAN_REPORT_SHARE_SECRET: "share-secret"
      })
    ).not.toThrow();
  });
});

describe("resolveWebBaseUrl", () => {
  it("defaults locally and trims trailing slashes", () => {
    expect(resolveWebBaseUrl({})).toBe("http://localhost:3000");
    expect(
      resolveWebBaseUrl({ PERISCAN_WEB_BASE_URL: "https://app.example.com///" })
    ).toBe("https://app.example.com");
  });

  it("requires a public HTTPS base URL in production", () => {
    expect(() =>
      resolveWebBaseUrl({ PERISCAN_DEPLOYMENT_ENVIRONMENT: "production" })
    ).toThrow(/PERISCAN_WEB_BASE_URL/u);
    expect(() =>
      resolveWebBaseUrl({
        PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
        PERISCAN_WEB_BASE_URL: "http://localhost:3000"
      })
    ).toThrow(/public HTTPS/u);
    expect(
      resolveWebBaseUrl({
        PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
        PERISCAN_WEB_BASE_URL: "https://app.periscan.example/"
      })
    ).toBe("https://app.periscan.example");
  });
});

describe("attachEvidenceToSignals", () => {
  it("appends evidence ids to signal evidence and related evidence fields", () => {
    const evidenceId = randomUUID();
    const signals = attachEvidenceToSignals([createSignal()], [evidenceId]);

    expect(signals[0]?.evidenceIds).toEqual([evidenceId]);
    expect(signals[0]?.relatedEvidenceIds).toEqual([evidenceId]);
  });

  it("preserves existing evidence ids without duplication", () => {
    const existingEvidenceId = randomUUID();
    const nextEvidenceId = randomUUID();
    const signal = createSignal();
    signal.evidenceIds = [existingEvidenceId];
    signal.relatedEvidenceIds = [existingEvidenceId];

    const signals = attachEvidenceToSignals(
      [signal],
      [existingEvidenceId, nextEvidenceId]
    );

    expect(signals[0]?.evidenceIds).toEqual([
      existingEvidenceId,
      nextEvidenceId
    ]);
    expect(signals[0]?.relatedEvidenceIds).toEqual([
      existingEvidenceId,
      nextEvidenceId
    ]);
  });
});

describe("buildExecutiveTrendSummary verified_fixes evidence scope", () => {
  function trendInput(
    overrides: Partial<ExecutiveTrendInput>
  ): ExecutiveTrendInput {
    return {
      evidenceArtifacts: [],
      findings: [],
      generatedAt: "2026-06-16T00:00:00.000Z",
      integrations: [],
      missingSignals: [],
      remediations: [],
      reports: [],
      scopes: [],
      tenantId: "tenant-1",
      verificationEvents: [],
      ...overrides
    } as unknown as ExecutiveTrendInput;
  }

  it("composes honestyTrust from measured hops, fixed revalidation, and denials (ICP-P1-6)", () => {
    const summary = buildExecutiveTrendSummary(
      trendInput({
        attackPaths: [
          {
            attackPath: {
              evidenceBasis: "Measured",
              pathEdges: [
                { evidenceBasis: "Measured" },
                { evidenceBasis: "Heuristic" },
                { evidenceBasis: "Measured" }
              ]
            }
          }
        ] as unknown as ExecutiveTrendInput["attackPaths"],
        deniedNeverQueuedCount: 4,
        remediations: [
          {
            createdAt: "2026-06-01T00:00:00.000Z",
            evidenceIds: [],
            remediationId: "rem-fixed",
            status: "Fixed"
          },
          {
            createdAt: "2026-06-01T00:00:00.000Z",
            evidenceIds: [],
            remediationId: "rem-still-fixed",
            status: "Fixed"
          },
          {
            createdAt: "2026-06-01T00:00:00.000Z",
            evidenceIds: [],
            remediationId: "rem-reopened",
            status: "Reopened"
          }
        ] as unknown as ExecutiveTrendInput["remediations"],
        verificationEvents: [
          {
            evidenceIds: ["ev-1"],
            measuredRevalidation: true,
            outcome: "Fixed",
            remediationId: "rem-fixed",
            verifiedAt: "2026-06-02T00:00:00.000Z"
          },
          {
            evidenceIds: ["ev-2"],
            measuredRevalidation: true,
            outcome: "Fixed",
            remediationId: "rem-still-fixed",
            verifiedAt: "2026-06-02T00:00:00.000Z"
          }
        ] as unknown as ExecutiveTrendInput["verificationEvents"]
      })
    );

    // Hop bases: 2 Measured / 3 total → 66.7%
    expect(summary.honestyTrust.claimsTotalCount).toBe(3);
    expect(summary.honestyTrust.claimsMeasuredCount).toBe(2);
    expect(summary.honestyTrust.claimsMeasuredPct).toBe(66.7);
    expect(summary.honestyTrust.deniedNeverQueuedCount).toBe(4);
    // Currently Fixed with measured verification: rem-fixed + rem-still-fixed.
    // rem-reopened is attempted-but-not-surviving (excluded from Fixed set).
    expect(summary.honestyTrust.fixedSurvivedCount).toBe(2);
    expect(summary.honestyTrust.fixedAttemptedCount).toBe(3);
    expect(summary.honestyTrust.signatureVerificationRatePct).toBeNull();
  });

  it("adds a USD trend metric only when paths have explicit financial assumptions", () => {
    const summary = buildExecutiveTrendSummary(
      trendInput({
        attackPaths: [
          {
            attackPath: { evidenceIds: ["ev-financial-1"] },
            financialExposure: { annualizedLossExposureUsd: 234_722.22 }
          },
          {
            attackPath: { evidenceIds: ["ev-financial-2"] },
            financialExposure: { annualizedLossExposureUsd: 100_000 }
          }
        ] as unknown as ExecutiveTrendInput["attackPaths"]
      })
    );
    const metric = summary.metrics.find(
      (candidate) => candidate.metricId === "annualized_loss_exposure_usd"
    );

    expect(metric).toMatchObject({
      evidenceIds: ["ev-financial-1", "ev-financial-2"],
      unit: "USD",
      value: 334_722.22
    });
    expect(
      buildExecutiveTrendSummary(trendInput({})).metrics.some(
        (candidate) => candidate.metricId === "annualized_loss_exposure_usd"
      )
    ).toBe(false);
  });

  it("scopes the metric's evidence to the fixed remediations it counts", () => {
    // A verification run that did NOT result in a fix (Reopened) still produces a
    // VerificationEvent with evidence. That evidence must not back the "Verified
    // fixes" metric — only the evidence of the Fixed/Mitigated remediations the
    // value actually counts.
    const summary = buildExecutiveTrendSummary(
      trendInput({
        remediations: [
          {
            createdAt: "2026-06-01T00:00:00.000Z",
            evidenceIds: ["ev-fixed"],
            remediationId: "rem-fixed",
            status: "Fixed"
          },
          {
            createdAt: "2026-06-01T00:00:00.000Z",
            evidenceIds: ["ev-mitigated"],
            remediationId: "rem-mitigated",
            status: "Mitigated"
          },
          {
            createdAt: "2026-06-01T00:00:00.000Z",
            evidenceIds: ["ev-reopened"],
            remediationId: "rem-reopened",
            status: "Reopened"
          }
        ] as unknown as ExecutiveTrendInput["remediations"],
        verificationEvents: [
          {
            evidenceIds: ["ev-fixed-run"],
            measuredRevalidation: true,
            outcome: "Fixed",
            remediationId: "rem-fixed",
            verifiedAt: "2026-06-02T00:00:00.000Z"
          },
          {
            evidenceIds: ["ev-mitigated-run"],
            measuredRevalidation: true,
            outcome: "Mitigated",
            remediationId: "rem-mitigated",
            verifiedAt: "2026-06-02T00:00:00.000Z"
          },
          {
            evidenceIds: ["ev-reopened-run"],
            measuredRevalidation: true,
            outcome: "Reopened",
            remediationId: "rem-reopened",
            verifiedAt: "2026-06-02T00:00:00.000Z"
          }
        ] as unknown as ExecutiveTrendInput["verificationEvents"]
      })
    );

    const verifiedFixes = summary.metrics.find(
      (metric) => metric.metricId === "verified_fixes"
    );

    expect(verifiedFixes?.value).toBe(2);
    expect([...(verifiedFixes?.evidenceIds ?? [])].sort()).toEqual([
      "ev-fixed-run",
      "ev-mitigated-run"
    ]);
    // The Reopened verification run's evidence must not leak into the metric.
    expect(verifiedFixes?.evidenceIds).not.toContain("ev-reopened-run");
    expect(verifiedFixes?.evidenceIds).not.toContain("ev-reopened");
  });

  it("counts a PartiallyFixed remediation as open work, not a verified fix", () => {
    // A PartiallyFixed remediation has reduced — not eliminated — the exposure,
    // so it is still-open active work (treated identically to InProgress). It
    // must show up in the "Open remediations" metric and velocity, and must NOT
    // inflate "Verified fixes". Previously it fell into no bucket at all and
    // silently vanished from the velocity breakdown.
    const summary = buildExecutiveTrendSummary(
      trendInput({
        remediations: [
          {
            createdAt: "2026-06-01T00:00:00.000Z",
            evidenceIds: ["ev-fixed"],
            remediationId: "rem-fixed",
            status: "Fixed"
          },
          {
            createdAt: "2026-06-01T00:00:00.000Z",
            evidenceIds: ["ev-open"],
            remediationId: "rem-open",
            status: "Open"
          },
          {
            createdAt: "2026-06-01T00:00:00.000Z",
            evidenceIds: ["ev-partial"],
            remediationId: "rem-partial",
            status: "PartiallyFixed"
          }
        ] as unknown as ExecutiveTrendInput["remediations"]
      })
    );

    const openMetric = summary.metrics.find(
      (metric) => metric.metricId === "open_remediations"
    );
    const verifiedFixes = summary.metrics.find(
      (metric) => metric.metricId === "verified_fixes"
    );

    // Open + PartiallyFixed both count as open; Fixed without a measured
    // closure event remains a recorded state, not a verified-fix metric.
    expect(openMetric?.value).toBe(2);
    expect([...(openMetric?.evidenceIds ?? [])].sort()).toEqual([
      "ev-open",
      "ev-partial"
    ]);
    expect(verifiedFixes?.value).toBe(0);
    expect(verifiedFixes?.evidenceIds).not.toContain("ev-partial");

    // The velocity breakdown reconciles to the total: a PartiallyFixed item is
    // no longer dropped between the open and fixed buckets.
    expect(summary.remediationVelocity.openRemediations).toBe(2);
    expect(summary.remediationVelocity.fixedRemediations).toBe(1);
    expect(summary.remediationVelocity.totalRemediations).toBe(3);
  });

  it("counts an Inconclusive remediation as open work and reconciles the velocity breakdown", () => {
    // An Inconclusive verification never proved the exposure closed, so the
    // remediation is still unresolved/open (mapRemediationStatusToFindingStatus
    // maps it to the "Inconclusive" active finding state, and the canonical
    // open/resolved split counts it as open). Unlike VerificationPending,
    // Reopened, and ClosedWithoutEvidence, it has no dedicated velocity bucket,
    // so previously it fell into NO bucket at all — under-claiming "Open
    // remediations" while still inflating totalRemediations, so the breakdown
    // could not reconcile to the total.
    const summary = buildExecutiveTrendSummary(
      trendInput({
        remediations: [
          {
            createdAt: "2026-06-01T00:00:00.000Z",
            evidenceIds: ["ev-fixed"],
            remediationId: "rem-fixed",
            status: "Fixed"
          },
          {
            createdAt: "2026-06-01T00:00:00.000Z",
            evidenceIds: ["ev-open"],
            remediationId: "rem-open",
            status: "Open"
          },
          {
            createdAt: "2026-06-01T00:00:00.000Z",
            evidenceIds: ["ev-inconclusive"],
            remediationId: "rem-inconclusive",
            status: "Inconclusive"
          }
        ] as unknown as ExecutiveTrendInput["remediations"]
      })
    );

    const openMetric = summary.metrics.find(
      (metric) => metric.metricId === "open_remediations"
    );
    const verifiedFixes = summary.metrics.find(
      (metric) => metric.metricId === "verified_fixes"
    );

    // Open + Inconclusive both count as open; Fixed without a measured
    // closure event remains a recorded state, not a verified-fix metric.
    expect(openMetric?.value).toBe(2);
    expect([...(openMetric?.evidenceIds ?? [])].sort()).toEqual([
      "ev-inconclusive",
      "ev-open"
    ]);
    expect(verifiedFixes?.value).toBe(0);
    expect(verifiedFixes?.evidenceIds).not.toContain("ev-inconclusive");

    // The velocity breakdown reconciles to the total: the Inconclusive item is
    // no longer dropped between the open, ready, fixed, reopened, and
    // closed-without-evidence buckets.
    expect(summary.remediationVelocity.openRemediations).toBe(2);
    expect(summary.remediationVelocity.fixedRemediations).toBe(1);
    expect(summary.remediationVelocity.readyForVerification).toBe(0);
    expect(summary.remediationVelocity.reopenedRemediations).toBe(0);
    expect(summary.remediationVelocity.closedWithoutEvidence).toBe(0);
    expect(summary.remediationVelocity.totalRemediations).toBe(3);
  });
});

describe("buildVerificationFreshnessNote", () => {
  const past = "2026-06-01T00:00:00.000Z";
  const future = "2099-01-01T00:00:00.000Z";

  it("is empty when there are no settled fixes", () => {
    expect(
      buildVerificationFreshnessNote([
        { nextVerificationAt: past, status: "Open" },
        { nextVerificationAt: past, status: "Reopened" }
      ])
    ).toBe("");
  });

  it("flags settled fixes whose re-verification has lapsed", () => {
    const note = buildVerificationFreshnessNote([
      { nextVerificationAt: past, status: "Fixed" },
      { nextVerificationAt: past, status: "Mitigated" },
      { nextVerificationAt: future, status: "PartiallyFixed" }
    ]);
    expect(note).toBe(
      " 2 settled fixes are overdue for re-verification and should be re-checked."
    );
  });

  it("confirms all settled fixes are within the window when none have lapsed", () => {
    const note = buildVerificationFreshnessNote([
      { nextVerificationAt: future, status: "Fixed" },
      { nextVerificationAt: future, status: "Mitigated" }
    ]);
    expect(note).toBe(
      " All 2 settled fixes are within the continuous re-verification window."
    );
  });

  // Truthfulness: the note (and the staleVerificationCount metric it mirrors)
  // must reflect the TENANT-WIDE settled set. A lapsed Fixed that lives outside
  // the snapshot's top-path display slice still has to be flagged — it cannot be
  // silently dropped just because it is not one of the embedded priorities.
  it("counts a lapsed settled fix even when other settled fixes are fresh", () => {
    const note = buildVerificationFreshnessNote([
      { nextVerificationAt: future, status: "Fixed" },
      { nextVerificationAt: future, status: "Fixed" },
      { nextVerificationAt: past, status: "Fixed" }
    ]);
    expect(note).toBe(
      " 1 settled fix is overdue for re-verification and should be re-checked."
    );
  });
});

describe("apiKeyRoleForScopes (ICP-P1-9 least privilege)", () => {
  it("maps coarse admin and write scopes as before", () => {
    expect(apiKeyRoleForScopes(["admin"])).toBe("Admin");
    expect(apiKeyRoleForScopes(["write"])).toBe("SecurityEngineer");
    expect(apiKeyRoleForScopes(["read"])).toBe("Viewer");
  });

  it("does not elevate webhook:admin alone to Admin", () => {
    expect(apiKeyRoleForScopes(["webhook:admin"])).toBe("Viewer");
    expect(apiKeyRoleForScopes(["read", "webhook:admin"])).toBe("Viewer");
  });

  it("does not elevate audit:read-only keys to Admin", () => {
    expect(apiKeyRoleForScopes(["audit:read"])).toBe("Viewer");
    expect(apiKeyRoleForScopes(["audit:read", "webhook:admin"])).toBe("Viewer");
    expect(apiKeyRoleForScopes(["read", "audit:read"])).toBe("Viewer");
  });

  it("maps mission:run and remediation:write to SecurityEngineer", () => {
    expect(apiKeyRoleForScopes(["mission:run"])).toBe("SecurityEngineer");
    expect(apiKeyRoleForScopes(["remediation:write"])).toBe("SecurityEngineer");
    expect(
      apiKeyRoleForScopes(["mission:run", "webhook:admin"])
    ).toBe("SecurityEngineer");
  });
});

describe("describeNonSnapshotPackEvidenceState", () => {
  it("refuses to claim measured evidence when the pack has none", () => {
    expect(
      describeNonSnapshotPackEvidenceState({
        linkedObservationCount: 0,
        packEvidenceIds: []
      })
    ).toEqual({
      overview:
        "No measured evidence is attached to this scheduled validation pack yet.",
      topRiskBand: "Low"
    });
  });

  it("stays honest when pack evidence exists but no linked observations do", () => {
    expect(
      describeNonSnapshotPackEvidenceState({
        linkedObservationCount: 0,
        packEvidenceIds: [randomUUID()]
      })
    ).toMatchObject({
      topRiskBand: "Low"
    });
  });

  it("only claims evidence-backed status when linked observations exist", () => {
    expect(
      describeNonSnapshotPackEvidenceState({
        linkedObservationCount: 2,
        packEvidenceIds: [randomUUID()]
      })
    ).toEqual({
      overview:
        "Evidence-backed scheduled validation with attached observations.",
      topRiskBand: "Medium"
    });
  });
});

describe("loadSnapshotFromEvidencePack non-snapshot honesty", () => {
  const tenantId = randomUUID();
  const packId = randomUUID();
  const now = new Date("2026-07-24T00:00:00.000Z");
  const context = {
    tenant: { tenantId },
    user: { userId: randomUUID() }
  } as unknown as Parameters<typeof loadSnapshotFromEvidencePack>[1];

  function pack(evidenceIds: string[] = []) {
    return {
      audience: "Security Team",
      createdAt: now,
      evidenceIds,
      evidencePackId: packId,
      packType: "ControlValidationReport" as const,
      redactionLevel: "Moderate" as const,
      status: "Draft" as const,
      storageUri: null,
      tenantId,
      title: "ControlValidation (scheduled)",
      updatedAt: now
    };
  }

  it("does not query or attach unrelated tenant signals for empty packs", async () => {
    const findMany = vi.fn();
    const prisma = {
      evidenceArtifact: {
        findMany: vi.fn().mockResolvedValue([])
      },
      signalEnvelope: {
        findMany
      }
    } as unknown as PrismaClient;

    const snapshot = await loadSnapshotFromEvidencePack(
      prisma,
      context,
      pack([])
    );

    expect(findMany).not.toHaveBeenCalled();
    expect(snapshot).toMatchObject({
      controlObservations: [],
      aiAppRisks: [],
      evidenceIds: [],
      summary: {
        overview:
          "No measured evidence is attached to this scheduled validation pack yet.",
        topRiskBand: "Low"
      }
    });
  });

  it("does not fall back to recent tenant signals when pack-linked signals are absent", async () => {
    const linkedEvidenceId = randomUUID();
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      evidenceArtifact: {
        findMany: vi.fn().mockResolvedValue([])
      },
      signalEnvelope: {
        findMany
      }
    } as unknown as PrismaClient;

    const snapshot = await loadSnapshotFromEvidencePack(
      prisma,
      context,
      pack([linkedEvidenceId])
    );

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId,
          evidenceIds: { hasSome: [linkedEvidenceId] }
        }
      })
    );
    expect(snapshot).toMatchObject({
      controlObservations: [],
      aiAppRisks: [],
      evidenceIds: [linkedEvidenceId],
      summary: {
        topRiskBand: "Low"
      }
    });
    expect(snapshot?.summary.overview).not.toMatch(/Evidence-backed/i);
  });
});

describe("requireAuditExportAccess (ICP-P1-9 residual)", () => {
  it("allows audit:read API keys without Admin role", () => {
    expect(() =>
      requireAuditExportAccess(
        {
          apiKeyScopes: ["audit:read"],
          membership: { role: "Viewer" }
        } as never,
        "export audit events"
      )
    ).not.toThrow();
  });

  it("denies API keys lacking audit:read even if role is Admin", () => {
    expect(() =>
      requireAuditExportAccess(
        {
          apiKeyScopes: ["read"],
          membership: { role: "Admin" }
        } as never,
        "export audit events"
      )
    ).toThrow(/audit:read/);
  });

  it("requires Tenant Admin role for session users", () => {
    expect(() =>
      requireAuditExportAccess(
        {
          membership: { role: "Viewer" }
        } as never,
        "export audit events"
      )
    ).toThrow(/Admin|role/i);
    expect(() =>
      requireAuditExportAccess(
        {
          membership: { role: "Admin" }
        } as never,
        "export audit events"
      )
    ).not.toThrow();
  });
});

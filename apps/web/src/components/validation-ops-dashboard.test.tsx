import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ValidationOpsDashboard } from "./validation-ops-dashboard";

const timestamp = "2026-06-01T00:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const membershipId = "33333333-3333-4333-8333-333333333333";
const scopeId = "44444444-4444-4444-8444-444444444444";
const evidenceId = "55555555-5555-4555-8555-555555555555";
const pathId = "66666666-6666-4666-8666-666666666666";
const nodeId = "77777777-7777-4777-8777-777777777777";
const impactNodeId = "88888888-8888-4888-8888-888888888888";
const remediationId = "99999999-9999-4999-8999-999999999999";
const reportId = "10101010-1010-4010-8010-101010101010";
const snapshotId = "11111111-2222-4333-8444-555555555555";
const integrationId = "12121212-1212-4212-8212-121212121212";
const aiAppId = "13131313-1313-4313-8313-131313131313";
const controlSourceId = "14141414-1414-4414-8414-141414141414";
const runnerId = "15151515-1515-4515-8515-151515151515";

const authPayload = {
  membership: {
    createdAt: timestamp,
    membershipId,
    role: "Owner",
    tenantId,
    updatedAt: timestamp,
    userId
  },
  tenant: {
    billingAccountId: "acct-demo",
    createdAt: timestamp,
    dataRegion: "us-east-1",
    name: "Demo Security",
    parentTenantId: null,
    tenantId,
    type: "Organization",
    updatedAt: timestamp
  },
  user: {
    createdAt: timestamp,
    email: "owner@example.com",
    name: "Owner User",
    status: "Active",
    updatedAt: timestamp,
    userId
  }
};

const attackPathAssessment = {
  attackPath: {
    confidence: 0.91,
    createdAt: timestamp,
    entryNodeId: nodeId,
    evidenceIds: [evidenceId],
    impactNodeId,
    impactScore: 86,
    name: "Repository secret can reach production",
    pathBreakers: [],
    pathEdges: [],
    pathId,
    pathNodes: [],
    tenantId,
    updatedAt: timestamp,
    validationState: "Validated"
  },
  risk: {
    band: "High",
    factors: [],
    score: 84,
    summary: "A validated repository secret has a plausible production path."
  }
};

const opsPayloadByRoute: Record<string, unknown> = {
  "/api/v1/ai-apps": {
    items: [
      {
        aiAppId,
        appType: "RAG",
        authMethod: "Test account",
        createdAt: timestamp,
        dataSourcesDescription: "Customer help center",
        endpointUrl: "https://ai.example.com/chat",
        guardrailsDescription: "Tenant policy guardrails",
        lastValidatedAt: timestamp,
        name: "Support Copilot",
        owner: "AI Platform",
        ragEnabled: true,
        scopeId,
        tenantId,
        toolsEnabled: true,
        updatedAt: timestamp
      }
    ]
  },
  "/api/v1/attack-paths": {
    items: [attackPathAssessment]
  },
  "/api/v1/billing/meters": {
    items: [
      {
        description: "Validation runs executed.",
        label: "Validation runs",
        meterName: "ValidationRuns",
        unit: "runs"
      },
      {
        description: "Evidence packs generated.",
        label: "Evidence packs",
        meterName: "EvidencePacks",
        unit: "packs"
      }
    ]
  },
  "/api/v1/billing/packages": {
    items: [
      {
        apiAccess: "Included",
        audiences: ["Security team", "GRC"],
        description: "One-time evidence-backed validation report.",
        includedCapabilities: [
          "Run safe validation modules",
          "Generate a validation report"
        ],
        includedMeterNames: ["ValidationMissions", "EvidencePacks"],
        label: "Validation Snapshot",
        packageKey: "ValidationSnapshot",
        paymentProcessorStatus: "NotConfigured",
        publicPricingLanguage: "Pay for what you validate.",
        status: "Available",
        supportedOutcomes: ["Validate risk", "Produce proof"]
      },
      {
        apiAccess: "Enterprise",
        audiences: ["Enterprise security", "Platform teams"],
        description: "Custom governance, tenancy, and API access package.",
        includedCapabilities: [
          "Advanced tenant governance",
          "Enterprise API access"
        ],
        includedMeterNames: ["ClientTenants", "APIUsage"],
        label: "Enterprise",
        packageKey: "Enterprise",
        paymentProcessorStatus: "NotConfigured",
        publicPricingLanguage: "Pay for what you validate.",
        status: "ContactSales",
        supportedOutcomes: ["Govern programs", "Integrate platforms"]
      }
    ]
  },
  "/api/v1/billing/active-package": {
    apiAccess: "Included",
    audiences: ["Security team", "GRC"],
    description: "One-time evidence-backed validation report.",
    includedCapabilities: [
      "Run safe validation modules",
      "Generate a validation report"
    ],
    includedMeterNames: ["ValidationMissions", "EvidencePacks"],
    label: "Validation Snapshot",
    packageKey: "ValidationSnapshot",
    paymentProcessorStatus: "NotConfigured",
    publicPricingLanguage: "Pay for what you validate.",
    status: "Available",
    supportedOutcomes: ["Validate risk", "Produce proof"]
  },
  "/api/v1/billing/usage": {
    billingAccountId: "acct-demo",
    meteringPeriodEnd: "2026-07-01T00:00:00.000Z",
    meteringPeriodStart: timestamp,
    meters: [
      {
        description: "Validation runs executed.",
        label: "Validation runs",
        measuredAt: timestamp,
        meterName: "ValidationRuns",
        quantity: 7,
        unit: "runs"
      },
      {
        description: "Evidence packs generated.",
        label: "Evidence packs",
        measuredAt: timestamp,
        meterName: "EvidencePacks",
        quantity: 2,
        unit: "packs"
      }
    ],
    tenantId
  },
  "/api/v1/tenants/current/executive-trends": {
    generatedAt: timestamp,
    honestyTrust: {
      claimsMeasuredPct: 100,
      claimsMeasuredCount: 1,
      claimsTotalCount: 1,
      fixedSurvivedRevalidationPct: 0,
      fixedSurvivedCount: 0,
      fixedAttemptedCount: 0,
      deniedNeverQueuedCount: 0,
      signatureVerificationRatePct: null,
      signatureVerifiedCount: 0,
      signatureCheckedCount: 0,
      compositionNote: "Trust metrics composition note."
    },
    metrics: [
      {
        delta: 1,
        evidenceIds: [evidenceId],
        label: "Evidence-backed paths",
        metricId: "validated_paths",
        previousValue: 0,
        trendDirection: "Improved",
        unit: "paths",
        value: 1
      }
    ],
    proofDelivery: {
      evidencePacksReady: 1,
      latestReportCreatedAt: timestamp,
      latestReportId: reportId,
      reportExports: 2
    },
    recommendations: ["Verify open remediations before marking risk fixed."],
    remediationVelocity: {
      averageVerificationHours: null,
      closedWithoutEvidence: 0,
      fixedRemediations: 0,
      openRemediations: 1,
      readyForVerification: 1,
      reopenedRemediations: 0,
      totalRemediations: 1
    },
    tenantId
  },
  "/api/v1/control-sources": {
    items: [
      {
        controlSourceId,
        controlType: "SIEM",
        createdAt: timestamp,
        expectedBehaviors: ["Logged", "Alerted"],
        healthStatus: "Healthy",
        integrationId,
        lastValidatedAt: timestamp,
        provider: "Splunk",
        telemetryStatus: "Healthy",
        tenantId,
        updatedAt: timestamp
      }
    ]
  },
  "/api/v1/control-sources/rule-coverage": {
    blockedTechniques: 0,
    controlSourceId: null,
    coveredTechniques: 1,
    generatedAt: timestamp,
    items: [
      {
        confidence: 0.82,
        controlSourceId,
        evidenceIds: [evidenceId],
        expectedBehaviors: ["Detected"],
        lastObservedAt: timestamp,
        observedBehaviors: ["Detected"],
        observedSources: ["SentinelOne"],
        recommendation: "Maintain the current detection path.",
        scenarioId: "scenario-t1059",
        signalIds: [],
        status: "Covered",
        tacticName: "Execution",
        techniqueId: "T1059",
        techniqueName: "Command and Scripting Interpreter",
        title: "Command interpreter abuse"
      },
      {
        confidence: 0.6,
        controlSourceId,
        evidenceIds: [],
        expectedBehaviors: ["Alerted"],
        lastObservedAt: timestamp,
        observedBehaviors: ["Logged"],
        observedSources: ["Splunk"],
        recommendation:
          "Tune alert routing so logged evidence creates an actionable alert.",
        scenarioId: "scenario-t1071",
        signalIds: [],
        status: "LoggedOnly",
        tacticName: "Command and Control",
        techniqueId: "T1071",
        techniqueName: "Application Layer Protocol",
        title: "C2 over application protocol"
      }
    ],
    loggedOnlyTechniques: 1,
    missedTechniques: 0,
    needsTuningTechniques: 0,
    noEvidenceTechniques: 0,
    notTestedTechniques: 0,
    recommendations: [
      "Tune alert routing so logged evidence creates an actionable alert."
    ],
    staleTechniques: 0,
    tenantId,
    totalTechniques: 2
  },
  "/api/v1/ctem/program": {
    generatedAt: timestamp,
    snapshotId: snapshotId,
    source: "Snapshot",
    stages: [
      {
        evidenceCount: 1,
        openItemCount: 0,
        stage: "Scope",
        status: "OnTrack",
        trend: "Stable"
      },
      {
        evidenceCount: 1,
        openItemCount: 0,
        stage: "Discover",
        status: "OnTrack",
        trend: "Stable"
      },
      {
        evidenceCount: 1,
        openItemCount: 1,
        stage: "Prioritize",
        status: "NeedsAttention",
        trend: "Stable"
      },
      {
        evidenceCount: 1,
        openItemCount: 1,
        stage: "Validate",
        status: "NeedsAttention",
        trend: "Stable"
      },
      {
        evidenceCount: 0,
        openItemCount: 1,
        stage: "Mobilize",
        status: "NeedsAttention",
        trend: "Stable"
      },
      {
        evidenceCount: 0,
        openItemCount: 1,
        stage: "Verify",
        status: "NotStarted",
        trend: "Stable"
      }
    ],
    tenantId,
    topRiskBand: "High"
  },
  "/api/v1/tenants/current/operational-metrics": {
    connectorSyncs: {
      averageDurationMs: 42,
      failedSyncCount: 0,
      p95DurationMs: 42,
      recentSyncs: [
        {
          assetCount: 3,
          durationMs: 42,
          healthStatus: "Healthy",
          integrationId,
          product: "GitHub",
          signalCount: 4,
          status: "Succeeded",
          syncedAt: timestamp,
          vendor: "GitHub"
        }
      ],
      totalSyncCount: 1
    },
    generatedAt: timestamp,
    missionStartLatency: {
      averageDurationMs: 120,
      maxDurationMs: 120,
      p95DurationMs: 120,
      queuedMissionCount: 0,
      recentStarts: [],
      startedMissionCount: 1
    },
    policyDenials: {
      denialRate: 0.25,
      deniedDecisionCount: 1,
      recentDenials: [],
      totalPolicyDecisionCount: 4
    },
    recommendations: ["Review one recent policy denial."],
    tenantId,
    window: {
      since: timestamp,
      until: "2026-07-01T00:00:00.000Z"
    }
  },
  "/api/v1/evidence": {
    items: [
      {
        artifactType: "NormalizedEvidence",
        createdAt: timestamp,
        evidenceId,
        redactionStatus: "Redacted",
        relatedEntityId: pathId,
        relatedEntityType: "AttackPath",
        sensitivityLevel: "Moderate",
        sha256: "abc123",
        storageUri: "s3://periscan-demo/evidence.json",
        tenantId,
        updatedAt: timestamp
      }
    ]
  },
  "/api/v1/me": authPayload,
  "/api/v1/remediations": {
    items: [
      {
        createdAt: timestamp,
        evidenceIds: [evidenceId],
        owner: "Cloud Security",
        recommendedAction: "Rotate exposed repository secret",
        relatedExposureId: null,
        relatedPathId: pathId,
        remediationId,
        status: "Open",
        technicalSteps: ["Rotate the secret", "Re-run validation"],
        tenantId,
        ticketId: null,
        ticketSystem: null,
        updatedAt: timestamp,
        verificationMethod: "Re-run secret and cloud access validation",
        verificationRequired: true
      },
      {
        createdAt: timestamp,
        evidenceIds: [evidenceId],
        lastVerifiedAt: "2026-01-01T00:00:00.000Z",
        latestVerification: {
          exposureReCorrelated: false,
          measuredRevalidation: true,
          outcome: "Fixed",
          retestMethod: "connector-resync",
          verifiedAt: "2026-01-01T00:00:00.000Z"
        },
        nextVerificationAt: "2026-02-01T00:00:00.000Z",
        owner: "Cloud Security",
        recommendedAction: "Disable legacy access key",
        relatedExposureId: null,
        relatedPathId: null,
        remediationId: "20202020-2020-4020-8020-202020202020",
        status: "Fixed",
        technicalSteps: ["Remove the key"],
        tenantId,
        ticketId: null,
        ticketSystem: null,
        updatedAt: timestamp,
        verificationMethod: "Re-run cloud access validation",
        verificationRequired: true
      }
    ]
  },
  "/api/v1/reports": {
    items: [
      {
        audience: "Security Team",
        createdAt: timestamp,
        evidenceIds: [evidenceId],
        evidencePackId: reportId,
        packType: "ValidationSnapshotReport",
        redactionLevel: "Moderate",
        status: "Ready",
        storageUri: "s3://periscan-demo/report.html",
        tenantId,
        title: "Demo Validation Snapshot",
        updatedAt: timestamp
      }
    ]
  },
  "/api/v1/runners": {
    items: [
      {
        arch: "amd64",
        certificateExpiresAt: null,
        createdAt: timestamp,
        createdBy: userId,
        deploymentMode: "Docker",
        hostname: "runner-1",
        labels: ["prod"],
        lastSeenAt: timestamp,
        name: "Production Runner",
        networkProfile: {
          additionalEgressNotes: null,
          dnsResolutionRequired: true,
          explicitProxyUrl: null,
          gatewayHostnames: ["api.periscan.test"],
          httpConnectProxySupported: true,
          outboundHttpsPorts: [443]
        },
        os: "linux",
        revokedAt: null,
        runnerId,
        status: "Active",
        tenantId,
        transportMode: "LongPollHttps",
        updatedAt: timestamp,
        version: "0.1.0"
      }
    ]
  },
  "/api/v1/snapshots": {
    items: [
      {
        aiAppRisks: [
          {
            confidence: 0.91,
            createdAt: timestamp,
            evidenceIds: [evidenceId],
            freshness: "Current",
            rawPayloadPointer: null,
            redactionStatus: "Redacted",
            relatedAssetIds: [],
            relatedControlIds: [],
            relatedEvidenceIds: [evidenceId],
            relatedIdentityIds: [],
            relatedPathIds: [],
            sensitivityLevel: "Moderate",
            signalCategory: "AIApplication",
            signalId: "30303030-3030-4030-8030-303030303030",
            signalSubcategory: "Prompt injection failed",
            sourceIntegrationId: integrationId,
            sourceType: "Module",
            sourceVendor: "Periscan",
            tenantId,
            timestampIngested: timestamp,
            timestampObserved: timestamp,
            updatedAt: timestamp
          }
        ],
        controlObservations: [],
        createdAt: timestamp,
        evidenceIds: [evidenceId],
        evidencePack: {
          audience: "Security Team",
          createdAt: timestamp,
          evidenceIds: [evidenceId],
          evidencePackId: reportId,
          packType: "ValidationSnapshotReport",
          redactionLevel: "Moderate",
          status: "Ready",
          storageUri: "s3://periscan-demo/report.html",
          tenantId,
          title: "Demo Validation Snapshot",
          updatedAt: timestamp
        },
        integrationIds: [integrationId],
        metrics: {
          aiRiskCount: 1,
          controlObservationCount: 0,
          correlatedThreatAdvisoryCount: 0,
          highRiskPathCount: 1,
          integrationCount: 1,
          openThreatAdvisoryCount: 0,
          remediationCount: 1,
          staleVerificationCount: 1,
          topPathCount: 1,
          verifiedScopeCount: 1
        },
        missionId: null,
        remediationPriorities: [],
        scopeIds: [scopeId],
        snapshotId,
        summary: {
          headline: "Validated repository-to-cloud path",
          overview: "The Snapshot has normalized evidence.",
          topRiskBand: "High"
        },
        tenantId,
        topAttackPaths: [attackPathAssessment],
        updatedAt: timestamp,
        verificationPlan: ["Re-run validation after fix."]
      }
    ]
  }
};

function mockFetchWithPayloads(overrides: Record<string, unknown> = {}) {
  const payloads = {
    ...opsPayloadByRoute,
    ...overrides
  };

  return vi.fn(async (input: RequestInfo | URL) => {
    const route = String(input);
    // listAttackPaths (and similar) append ?limit=&offset=; match base path too
    const baseRoute = route.split("?")[0] ?? route;
    const payload = payloads[route] ?? payloads[baseRoute];

    if (payload == null) {
      return {
        json: async () => ({
          error: `Unhandled route ${route}`
        }),
        ok: false,
        status: 404
      };
    }

    return {
      json: async () => payload,
      ok: true,
      status: 200
    };
  }) as unknown as typeof fetch;
}

describe("ValidationOpsDashboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders tenant validation operations from API-backed resources", async () => {
    const fetchImpl = mockFetchWithPayloads();

    vi.stubGlobal("fetch", fetchImpl);

    render(<ValidationOpsDashboard />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          name: "API-backed validation, proof, and remediation status."
        })
      ).toBeInTheDocument();
    });

    expect(screen.getAllByText("Priority paths")).toHaveLength(2);
    const prdCards = screen.getByLabelText("PRD dashboard cards");
    for (const label of [
      "Priority exposure paths",
      "Controls needing proof",
      "AI apps with failed checks",
      "Fixes awaiting re-test",
      "Risk reduced this month",
      "Evidence packs ready"
    ]) {
      expect(within(prdCards).getByText(label)).toBeInTheDocument();
    }
    expect(
      within(prdCards).getByText(
        "AI risk signals attached to current Snapshot payloads."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("Repository secret can reach production")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Rotate exposed repository secret")
    ).toBeInTheDocument();
    expect(screen.getByText("Demo Validation Snapshot")).toBeInTheDocument();
    expect(screen.getByText("Support Copilot")).toBeInTheDocument();
    expect(screen.getByText("Splunk SIEM")).toBeInTheDocument();
    expect(screen.getByText("Production Runner")).toBeInTheDocument();
    // "Validation runs" appears in demo metrics and now also in the visible usage meters list.
    expect(
      screen.getAllByText("Validation runs").length
    ).toBeGreaterThanOrEqual(1);
    // "Validation Snapshot" now also appears in the active-subscription callout,
    // so scope the catalog assertion to the package catalog grid.
    const billingPackagesGrid = screen.getByLabelText("Billing packages");
    expect(
      within(billingPackagesGrid).getByText("Validation Snapshot")
    ).toBeInTheDocument();
    expect(
      within(billingPackagesGrid).getByText("Enterprise")
    ).toBeInTheDocument();
    expect(screen.getByText("Pay for what you validate.")).toBeInTheDocument();
    expect(
      screen.getAllByText(/Payment processor: NotConfigured/)
    ).toHaveLength(2);
    expect(
      screen.getByText("Operational health and trends")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Review one recent policy denial.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Verify open remediations before marking risk fixed.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Priority paths top risk band: High"
      })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Validation operations metrics")).toHaveClass(
      "grid-cols-1",
      "sm:grid-cols-2",
      "lg:grid-cols-4"
    );
    // The risk-band distribution chart ships an accessible data-table fallback
    // (rendered under jsdom where nivo cannot measure) driven by real API data.
    const riskBandFigure = screen.getByRole("figure", {
      name: "Priority attack paths by risk band"
    });
    expect(
      within(riskBandFigure).getByRole("rowheader", { name: "High" })
    ).toBeInTheDocument();

    // Validation integrity: the fixture path has no measured evidence basis, so
    // it is treated as Heuristic and the measured share is 0%.
    expect(
      screen.getByRole("status", { name: "Measured validation share: 0%" })
    ).toBeInTheDocument();
    const evidenceBasisFigure = screen.getByRole("figure", {
      name: "Priority paths by evidence basis"
    });
    expect(
      within(evidenceBasisFigure).getByRole("rowheader", { name: "Heuristic" })
    ).toBeInTheDocument();

    // Prove-it-fixed: the settled "Disable legacy access key" fix is past its
    // re-verification date, so it surfaces as overdue with its measured
    // re-validation provenance.
    expect(
      screen.getByRole("status", { name: "Re-verification due count: 1" })
    ).toBeInTheDocument();
    const reverifyRegion = screen.getByRole("region", {
      name: "Re-verification due"
    });
    expect(
      within(reverifyRegion).getByText("Disable legacy access key")
    ).toBeInTheDocument();
    expect(
      within(reverifyRegion).getByRole("status", {
        name: "Last re-validation for Disable legacy access key: Measured"
      })
    ).toBeInTheDocument();
    // The overdue fix can be re-verified or have its verification trail loaded.
    expect(
      within(reverifyRegion).getByRole("button", { name: "Re-verify" })
    ).toBeInTheDocument();
    expect(
      within(reverifyRegion).getByRole("button", { name: "History" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Repository secret can reach production risk: High 84"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Open remediation count: 1"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Remediation status for Rotate exposed repository secret: Open"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Ready evidence pack count: 1"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Evidence pack status for Demo Validation Snapshot: Ready"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Validation readiness source: API inputs"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Control source Splunk SIEM health: Healthy"
      })
    ).toBeInTheDocument();

    // Detection coverage is surfaced per technique, naming the backing tool.
    expect(
      screen.getByText("T1059 Command and Scripting Interpreter")
    ).toBeInTheDocument();
    expect(screen.getByText("Observed via SentinelOne")).toBeInTheDocument();
    expect(screen.getByText("Observed via Splunk")).toBeInTheDocument();

    // Truthfulness: an actively-detected technique is "Covered" (success tone)…
    const coveredPill = screen.getByRole("status", {
      name: "Detection coverage for T1059: Covered"
    });
    expect(coveredPill).toHaveClass("text-success");

    // …but a logged-only SIEM hit is shown as "Logged only" and is NEVER
    // promoted to the same success green as active detection.
    const loggedOnlyPill = screen.getByRole("status", {
      name: "Detection coverage for T1071: Logged only"
    });
    expect(loggedOnlyPill).toHaveClass("text-warning");
    expect(loggedOnlyPill).not.toHaveClass("text-success");
    expect(
      screen.getByRole("status", {
        name: "Runner Production Runner status: Active"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "CTEM top risk band: High"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Active billing meter count: 2"
      })
    ).toBeInTheDocument();

    // The tenant's active subscription package + its entitled capabilities are
    // surfaced (billing entitlement vertical, v0.1.283-285).
    const activeSubscription = screen.getByRole("article", {
      name: "Active subscription package"
    });
    expect(
      within(activeSubscription).getByText("Validation Snapshot")
    ).toBeInTheDocument();
    const entitledCapabilities = within(activeSubscription).getByRole("list", {
      name: "Entitled capabilities"
    });
    expect(
      within(entitledCapabilities).getByText("Run safe validation modules")
    ).toBeInTheDocument();

    expect(
      screen.getByRole("status", {
        name: "Operational health source: API-derived"
      })
    ).toBeInTheDocument();

    const ctemRegion = screen.getByRole("region", {
      name: "CTEM program view"
    });
    expect(within(ctemRegion).getByText("Validate")).toBeInTheDocument();
    expect(
      within(ctemRegion).getByText(`from Snapshot ${snapshotId}.`, {
        exact: false
      })
    ).toBeInTheDocument();

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/attack-paths?limit=200&offset=0",
      expect.objectContaining({ cache: "no-store" })
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/billing/packages",
      expect.objectContaining({ cache: "no-store" })
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/billing/usage",
      expect.objectContaining({ cache: "no-store" })
    );
  });

  it("shows an authenticated empty state without fabricated operational data", async () => {
    const fetchImpl = mockFetchWithPayloads({
      "/api/v1/ai-apps": { items: [] },
      "/api/v1/attack-paths": { items: [] },
      "/api/v1/control-sources": { items: [] },
      "/api/v1/control-sources/rule-coverage": {
        blockedTechniques: 0,
        controlSourceId: null,
        coveredTechniques: 0,
        generatedAt: timestamp,
        items: [],
        loggedOnlyTechniques: 0,
        missedTechniques: 0,
        needsTuningTechniques: 0,
        noEvidenceTechniques: 0,
        notTestedTechniques: 0,
        recommendations: [],
        staleTechniques: 0,
        tenantId,
        totalTechniques: 0
      },
      "/api/v1/evidence": { items: [] },
      "/api/v1/remediations": { items: [] },
      "/api/v1/reports": { items: [] },
      "/api/v1/runners": { items: [] },
      "/api/v1/snapshots": { items: [] },
      "/api/v1/ctem/program": {
        generatedAt: timestamp,
        snapshotId: null,
        source: "LiveTenantStateBaseline",
        stages: [
          "Scope",
          "Discover",
          "Prioritize",
          "Validate",
          "Mobilize",
          "Verify"
        ].map((stage) => ({
          evidenceCount: 0,
          openItemCount: 0,
          stage,
          status: "NotStarted",
          trend: "Stable"
        })),
        tenantId,
        topRiskBand: "Informational"
      }
    });

    vi.stubGlobal("fetch", fetchImpl);

    render(<ValidationOpsDashboard />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "No priority attack paths are available for this tenant yet."
        )
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText("No remediation tasks are currently open.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("No evidence artifacts have been stored yet.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("No AI applications are registered.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("No internal runners are registered.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("No detection coverage has been measured yet.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("as a live baseline from tenant-scoped state", {
        exact: false
      })
    ).toBeInTheDocument();
  });

  it("shows a signed-out state instead of querying tenant operations", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      json: async () => ({
        error: "Unauthorized"
      }),
      ok: false,
      status: 401
    });

    vi.stubGlobal("fetch", fetchImpl);

    render(<ValidationOpsDashboard />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          name: "Sign in to review validation operations."
        })
      ).toBeInTheDocument();
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/me",
      expect.objectContaining({ cache: "no-store" })
    );
  });

  it("shows a retryable error when an operations API call fails", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const route = String(input);
      const baseRoute = route.split("?")[0] ?? route;

      if (baseRoute === "/api/v1/me") {
        return {
          json: async () => authPayload,
          ok: true,
          status: 200
        };
      }

      if (baseRoute === "/api/v1/attack-paths") {
        return {
          json: async () => ({
            error: "Attack path service unavailable"
          }),
          ok: false,
          status: 503
        };
      }

      const payload = opsPayloadByRoute[route] ?? opsPayloadByRoute[baseRoute];

      return {
        json: async () => payload,
        ok: true,
        status: 200
      };
    }) as unknown as typeof fetch;

    vi.stubGlobal("fetch", fetchImpl);

    render(<ValidationOpsDashboard />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Attack path service unavailable"
      );
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Retry"
      })
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/attack-paths?limit=200&offset=0",
      expect.objectContaining({ cache: "no-store" })
    );
  });

  it("keeps operational data visible and safely reloads after a refresh failure", async () => {
    let attackPathRequestCount = 0;

    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const route = String(input);
      const baseRoute = route.split("?")[0] ?? route;

      if (baseRoute === "/api/v1/attack-paths") {
        attackPathRequestCount += 1;

        if (attackPathRequestCount === 2) {
          return {
            json: async () => ({
              error: "Attack path refresh failed"
            }),
            ok: false,
            status: 503
          };
        }
      }

      const payload = opsPayloadByRoute[route] ?? opsPayloadByRoute[baseRoute];

      return {
        json: async () => payload,
        ok: true,
        status: 200
      };
    }) as unknown as typeof fetch;

    vi.stubGlobal("fetch", fetchImpl);

    render(<ValidationOpsDashboard />);

    await waitFor(() => {
      expect(
        screen.getByText("Repository secret can reach production")
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Refresh API state"
      })
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Attack path refresh failed"
      );
    });

    expect(
      screen.getByText("Repository secret can reach production")
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Reload validation operations"
      })
    );

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    expect(attackPathRequestCount).toBe(3);
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/attack-paths?limit=200&offset=0",
      expect.objectContaining({ cache: "no-store" })
    );
  });

  it("filters attack paths by evidence basis (measured vs heuristic)", async () => {
    const heuristicPath = {
      attackPath: {
        ...attackPathAssessment.attackPath,
        evidenceBasis: "Heuristic",
        name: "Heuristic inferred path"
      },
      risk: { ...attackPathAssessment.risk, summary: "Inferred path." }
    };
    const measuredPath = {
      attackPath: {
        ...attackPathAssessment.attackPath,
        evidenceBasis: "Measured",
        name: "Measured proven path",
        pathEdges: [
          {
            createdAt: timestamp,
            evidenceBasis: "Measured",
            evidenceIds: [evidenceId],
            measurementMethod: "signed-safe-probe",
            pathEdgeId: "88888888-8888-4888-8888-888888888888",
            pathId: "77777777-7777-4777-8777-777777777777",
            rationale: "Measured from a safe probe.",
            relationship: "CAN_ACCESS",
            sourceNodeId: nodeId,
            targetNodeId: impactNodeId,
            tenantId,
            updatedAt: timestamp
          }
        ],
        pathId: "77777777-7777-4777-8777-777777777777"
      },
      risk: { ...attackPathAssessment.risk, summary: "Proven path." }
    };

    const fetchImpl = mockFetchWithPayloads({
      "/api/v1/attack-paths": { items: [heuristicPath, measuredPath] }
    });
    vi.stubGlobal("fetch", fetchImpl);

    render(<ValidationOpsDashboard />);

    await waitFor(() => {
      expect(
        screen.getByRole("article", { name: "Measured proven path" })
      ).toBeInTheDocument();
    });
    // Both paths are visible with the default "all" filter.
    expect(
      screen.getByRole("article", { name: "Heuristic inferred path" })
    ).toBeInTheDocument();

    // Filtering to Measured isolates the proven path and hides the inferred one
    // (proof-core: focus on measured paths, never conflate with heuristic).
    fireEvent.change(screen.getByLabelText("Evidence basis"), {
      target: { value: "Measured" }
    });
    expect(
      screen.queryByRole("article", { name: "Heuristic inferred path" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("article", { name: "Measured proven path" })
    ).toBeInTheDocument();
  });

  it("shows a filtered empty-state when no paths match the evidence basis", async () => {
    const heuristicOnly = {
      attackPath: {
        ...attackPathAssessment.attackPath,
        evidenceBasis: "Heuristic",
        name: "Only a heuristic path"
      },
      risk: { ...attackPathAssessment.risk, summary: "Inferred." }
    };

    const fetchImpl = mockFetchWithPayloads({
      "/api/v1/attack-paths": { items: [heuristicOnly] }
    });
    vi.stubGlobal("fetch", fetchImpl);

    render(<ValidationOpsDashboard />);

    await waitFor(() => {
      expect(
        screen.getByRole("article", { name: "Only a heuristic path" })
      ).toBeInTheDocument();
    });

    // Filtering to Measured (none exist) shows a filtered empty-state, not a
    // blank list — the empty-state reflects the FILTERED set.
    fireEvent.change(screen.getByLabelText("Evidence basis"), {
      target: { value: "Measured" }
    });
    expect(
      screen.queryByRole("article", { name: "Only a heuristic path" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("No attack paths match the selected evidence basis.")
    ).toBeInTheDocument();
  });

  it("notes truncation when more than five attack paths exist", async () => {
    const manyPaths = Array.from({ length: 6 }, (_unused, index) => ({
      attackPath: {
        ...attackPathAssessment.attackPath,
        name: `Validated path ${index}`,
        pathId: `1111111${index}-1111-4111-8111-111111111111`
      },
      risk: { ...attackPathAssessment.risk, summary: `Path ${index}.` }
    }));

    const fetchImpl = mockFetchWithPayloads({
      "/api/v1/attack-paths": { items: manyPaths }
    });
    vi.stubGlobal("fetch", fetchImpl);

    render(<ValidationOpsDashboard />);

    await waitFor(() => {
      expect(
        screen.getByRole("status", {
          name: "Showing top 5 of 6 attack paths"
        })
      ).toBeInTheDocument();
    });
  });
});

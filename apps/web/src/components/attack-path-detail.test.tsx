import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createPublicDemoValidationSnapshot,
  type PolicyDecision,
  type Scope,
  type ValidationMission
} from "@periscan/shared";

import { AttackPathDetail } from "./attack-path-detail";

const SCOPE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MISSION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const POLICY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const RECEIPT_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const USER_ID = "99999999-9999-4999-8999-999999999999";

function buildAssessment() {
  const snapshot = createPublicDemoValidationSnapshot();
  const assessment = {
    ...snapshot.topAttackPaths[0]!,
    financialExposure: {
      annualizedLossExposureUsd: 234_722.22,
      assetId: "11111111-1111-4111-8111-111111111111",
      assetName: "Production payments API",
      assumptions: [
        "Loss-event frequency range: 0.5 / 1 / 2 per year.",
        "User-supplied assumptions, not measured loss history."
      ],
      businessServiceName: "Payments",
      confidence: "Medium" as const,
      currency: "USD" as const,
      expectedLossEventFrequencyPerYear: 1.08,
      expectedLossMagnitudeUsd: 216_666.67,
      lowerBoundUsd: 50_000,
      methodology: "FAIR-inspired PERT range estimate" as const,
      upperBoundUsd: 800_000,
      valuationUpdatedAt: snapshot.updatedAt
    }
  };
  return { assessment, snapshot };
}

function verifiedScope(
  tenantId: string,
  createdAt: string,
  updatedAt: string
): Scope {
  return {
    assetClass: "Other",
    businessCriticality: "High",
    createdAt,
    createdBy: USER_ID,
    effectiveMaxSafetyLevel: "ActiveNonInvasive",
    externalValidationProfileId: null,
    isOperationalTechnology: false,
    lastPostureCheckAt: null,
    maxSafetyLevel: "ActiveNonInvasive",
    nextPostureCheckAt: null,
    purdueLevel: null,
    safetyRestrictionReason:
      "This scope permits validation through ActiveNonInvasive.",
    scopeId: SCOPE_ID,
    scopeType: "Domain",
    segmentName: null,
    sensitivity: "Moderate",
    tags: [],
    tenantId,
    updatedAt,
    value: "app.example.com",
    verificationExpiresAt: null,
    verificationMethod: "dns_txt",
    verificationStale: false,
    verificationStatus: "Verified",
    verificationToken: null,
    verifiedAt: updatedAt,
    verifiedBy: USER_ID
  };
}

function stubFetch(
  payloads: Record<string, unknown>,
  options?: {
    postHandlers?: Record<
      string,
      (
        body: unknown
      ) =>
        | { status?: number; body: unknown }
        | Promise<{ status?: number; body: unknown }>
    >;
  }
) {
  // Dual-pane path list always hits GET /attack-paths; default empty page so
  // detail tests stay focused unless they assert the sidebar.
  // next-mission defaults to honest empty recommendation envelope.
  const resolved: Record<string, unknown> = {
    "/api/v1/attack-paths": {
      items: [],
      page: { hasMore: false, limit: 200, offset: 0 }
    },
    ...payloads
  };

  // Auto-stub next-mission for any path detail unless the test overrides it.
  for (const key of Object.keys(resolved)) {
    const match = key.match(/^\/api\/v1\/attack-paths\/([^/]+)$/);
    if (match) {
      const nextKey = `/api/v1/attack-paths/${match[1]}/next-mission`;
      if (!(nextKey in resolved)) {
        resolved[nextKey] = { recommendation: null };
      }
    }
  }

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const route = String(input).split("?")[0] ?? "";
      const method = (init?.method ?? "GET").toUpperCase();

      if (method === "POST" && options?.postHandlers?.[route]) {
        let body: unknown = {};
        if (typeof init?.body === "string" && init.body.length > 0) {
          body = JSON.parse(init.body);
        }
        const result = await options.postHandlers[route]!(body);
        return {
          json: async () => result.body,
          ok: (result.status ?? 200) < 400,
          status: result.status ?? 200
        };
      }

      if (!(route in resolved)) {
        return {
          json: async () => ({ error: `Unhandled route ${route}` }),
          ok: false,
          status: 404
        };
      }

      return {
        json: async () => resolved[route],
        ok: true,
        status: 200
      };
    }) as unknown as typeof fetch
  );
}

describe("AttackPathDetail", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exposes safe verification, evidence drill-through, and path export", async () => {
    const { assessment, snapshot } = buildAssessment();
    const pathId = assessment.attackPath.pathId;
    const evidenceId = assessment.attackPath.evidenceIds[0]!;
    const edges = assessment.attackPath.pathEdges;

    stubFetch({
      [`/api/v1/attack-paths/${pathId}`]: assessment,
      [`/api/v1/attack-paths/${pathId}/evidence`]: {
        items: [
          {
            artifactType: "NormalizedEvidence",
            chainHash: "b".repeat(64),
            chainSeq: "4",
            createdAt: snapshot.createdAt,
            evidenceId,
            prevChainHash: "a".repeat(64),
            redactedAt: null,
            redactedSha256: null,
            redactionStatus: "NotRequired",
            relatedEntityId: pathId,
            relatedEntityType: "AttackPath",
            sensitivityLevel: "Moderate",
            sha256: "c".repeat(64),
            storageUri: `evidence://${evidenceId}`,
            tenantId: snapshot.tenantId,
            updatedAt: snapshot.updatedAt
          }
        ]
      },
      "/api/v1/scopes": { items: [] },
      [`/api/v1/attack-paths/${pathId}/validation-plan`]: {
        pathId,
        claimSummary: `Hypothesis path: 0/${edges.length} hops Measured with evidence; 0 eligible for safe hop probes; ${edges.length} blocked by scope, runner, integration, approval, or missing safe module.`,
        overallStatus: "Blocked",
        items: edges.map((edge, index) => ({
          pathEdgeId: edge.pathEdgeId,
          sequence: index,
          relationship: edge.relationship,
          evidenceBasis: edge.evidenceBasis,
          recommendedModuleIds: ["periscan.tcp_reachability"],
          safetyLevel: "ActiveNonInvasive",
          missionType: "ExposureValidation",
          requiredScopeTypes: ["Domain"],
          requiresInternalRunner: false,
          prerequisites: [
            "Add and verify authorized scope before launching hop probes"
          ],
          missingTelemetry: [],
          eligibility: "NeedsScope"
        }))
      },
      [`/api/v1/attack-paths/${pathId}/measurement-state`]: {
        pathId,
        pathEvidenceBasis: assessment.attackPath.evidenceBasis,
        measuredEdgeCount: 0,
        totalEdgeCount: edges.length,
        measuredHopFraction: 0,
        fullyMeasured: false,
        claimSafeValidationState: "Discovered",
        edgeStates: edges.map((edge) => ({
          pathEdgeId: edge.pathEdgeId,
          hopKey: `${edge.sourceNodeId}|${edge.relationship}|${edge.targetNodeId}`,
          evidenceBasis: edge.evidenceBasis,
          evidenceIds: edge.evidenceIds,
          measurementMethod: null,
          latestReceiptId: null
        }))
      },
      [`/api/v1/attack-paths/${pathId}/edge-receipts`]: { items: [] }
    });

    render(<AttackPathDetail id={pathId} />);

    expect(
      await screen.findByText(assessment.attackPath.name)
    ).toBeInTheDocument();
    expect(screen.getByText("$234,722")).toBeInTheDocument();
    expect(screen.getByText(/not measured loss history/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Export JSON" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: `ev·${evidenceId.slice(0, 8)}` })
    ).toHaveAttribute("href", `/evidence?evidenceId=${evidenceId}`);

    // Without verified scope, never claim Measure path hops as primary CTA.
    const hopLinks = screen.getAllByRole("link", {
      name: /authorize scope to measure/i
    });
    expect(hopLinks.length).toBeGreaterThanOrEqual(1);
    for (const link of hopLinks) {
      expect(link).toHaveAttribute("href", "#hop-measurement");
    }
    expect(
      screen.queryByRole("link", { name: /^Measure hops$/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /^Measure path hops/i })
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("proof-stage-strip")).toBeInTheDocument();
    // P08: single primary proof chrome — strip only, no dual ProofLoopContext soup.
    expect(
      screen.queryByRole("region", { name: "Proof loop context" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Proof loop context")
    ).not.toBeInTheDocument();
    // Claim-safe strip: Heuristic hypothesis, never upgrades Validated without hops.
    expect(screen.getByTestId("proof-stage-basis")).toHaveTextContent(
      /Heuristic hypothesis/i
    );
    expect(screen.getByTestId("path-claim-remap-banner")).toHaveTextContent(
      /does not support recorded Validated/i
    );
    expect(screen.getAllByText(/Heuristic hypothesis/i).length).toBeGreaterThan(
      0
    );
    expect(screen.queryByText("FullyMeasured")).not.toBeInTheDocument();
    // UX-W1 path claim hero + primary CTA (scope-gated Measure honesty).
    expect(screen.getByTestId("path-claim-hero")).toBeInTheDocument();
    expect(screen.getByTestId("path-claim-hero")).toHaveAttribute(
      "data-claim-kind",
      "HeuristicHypothesis"
    );
    expect(screen.getByTestId("path-measure-primary-cta")).toHaveAttribute(
      "href",
      "#hop-measurement"
    );
    expect(screen.getByTestId("path-measure-primary-cta")).toHaveTextContent(
      /authorize scope to measure/i
    );
    // UX-W8: sticky back + product-help stage chips on path detail.
    const back = screen.getByTestId("attack-path-back-link");
    expect(back).toHaveAttribute("href", "/attack-paths");
    expect(back).toHaveTextContent(/All attack paths/i);
    const chips = screen.getByTestId("proof-stage-chips");
    expect(chips.querySelector('[aria-current="step"]')).toHaveTextContent(
      "Understand"
    );
    for (const stage of [
      "Connect",
      "Authorize",
      "Validate",
      "Understand",
      "Act",
      "Verify",
      "Prove"
    ]) {
      expect(chips).toHaveTextContent(stage);
    }
    expect(
      screen.getAllByText(/0\/\d+ measured|hops measured|Not measured/i).length
    ).toBeGreaterThan(0);

    // UX-W5 / 190: weakest-link spotlight on first unmeasured hop
    expect(screen.getByTestId("weakest-link-spotlight")).toBeInTheDocument();
    expect(screen.getByText("Weakest link")).toBeInTheDocument();
    expect(screen.getByTestId("weakest-link-measure-cta")).toHaveAttribute(
      "href",
      expect.stringMatching(/^#hop-card-anchor-/)
    );

    // UX-W5 / 189: Proof Timeline honest empty when no receipts
    expect(screen.getByTestId("proof-timeline")).toBeInTheDocument();
    expect(screen.getByTestId("proof-timeline-empty")).toHaveTextContent(
      "No measured events yet"
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Policy-gated path mission" })
    );

    expect(
      screen.getByText(/does not queue or execute validation/i)
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("link", { name: "Verify a scope first" })
    ).toHaveAttribute("href", "/scopes");
  });

  it("displays the hop validation plan with eligibility and recommended modules", async () => {
    const { assessment, snapshot } = buildAssessment();
    const pathId = assessment.attackPath.pathId;
    const edges = assessment.attackPath.pathEdges;
    const firstEdge = edges[0]!;
    const secondEdge = edges[1]!;

    stubFetch({
      [`/api/v1/attack-paths/${pathId}`]: assessment,
      [`/api/v1/attack-paths/${pathId}/evidence`]: { items: [] },
      "/api/v1/scopes": {
        items: [
          verifiedScope(snapshot.tenantId, snapshot.createdAt, snapshot.updatedAt)
        ]
      },
      [`/api/v1/attack-paths/${pathId}/validation-plan`]: {
        pathId,
        claimSummary:
          "Hypothesis path: 0/2 hops Measured with evidence; 1 eligible for safe hop probes; 1 blocked by scope, runner, integration, approval, or missing safe module.",
        overallStatus: "PartiallyReady",
        items: [
          {
            pathEdgeId: firstEdge.pathEdgeId,
            sequence: 0,
            relationship: firstEdge.relationship,
            evidenceBasis: "Heuristic",
            recommendedModuleIds: [
              "periscan.tcp_reachability",
              "periscan.http_health_check"
            ],
            safetyLevel: "ActiveNonInvasive",
            missionType: "ExposureValidation",
            requiredScopeTypes: ["Domain", "Subdomain"],
            requiresInternalRunner: false,
            prerequisites: ["Verified scope covering source and target hosts"],
            missingTelemetry: [],
            eligibility: "Eligible"
          },
          {
            pathEdgeId: secondEdge.pathEdgeId,
            sequence: 1,
            relationship: secondEdge.relationship,
            evidenceBasis: "Heuristic",
            recommendedModuleIds: [],
            safetyLevel: "PassiveReadOnly",
            missionType: "ExposureValidation",
            requiredScopeTypes: ["CloudAccount"],
            requiresInternalRunner: false,
            prerequisites: [
              "Identity hop measurement requires a connected Identity or Cloud integration (no safe ActiveNonInvasive identity probe in first-customer set)"
            ],
            missingTelemetry: ["identity_posture"],
            eligibility: "NeedsIntegration"
          }
        ]
      },
      [`/api/v1/attack-paths/${pathId}/measurement-state`]: {
        pathId,
        pathEvidenceBasis: "Heuristic",
        measuredEdgeCount: 0,
        totalEdgeCount: 2,
        measuredHopFraction: 0,
        fullyMeasured: false,
        claimSafeValidationState: "Discovered",
        edgeStates: edges.map((edge) => ({
          pathEdgeId: edge.pathEdgeId,
          hopKey: `${edge.sourceNodeId}|${edge.relationship}|${edge.targetNodeId}`,
          evidenceBasis: edge.evidenceBasis,
          evidenceIds: edge.evidenceIds,
          measurementMethod: null,
          latestReceiptId: null
        }))
      },
      [`/api/v1/attack-paths/${pathId}/edge-receipts`]: { items: [] }
    });

    render(<AttackPathDetail id={pathId} />);

    expect(
      await screen.findByText(assessment.attackPath.name)
    ).toBeInTheDocument();

    expect(
      (await screen.findAllByText(/0\/2 hops Measured with evidence/i)).length
    ).toBeGreaterThan(0);
    expect(
      screen.getByLabelText("Measured edge ratio 0 of 2")
    ).toHaveTextContent("0/2 measured");
    expect(screen.getAllByText("PartiallyReady").length).toBeGreaterThan(0);

    expect(
      screen.getByLabelText("Hop eligibility: Eligible")
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Hop eligibility: NeedsIntegration")
    ).toBeInTheDocument();
    expect(screen.getByText("periscan.tcp_reachability")).toBeInTheDocument();
    expect(screen.getByText("periscan.http_health_check")).toBeInTheDocument();
    expect(
      screen.getByText(/Verified scope covering source and target hosts/i)
    ).toBeInTheDocument();
    expect(screen.getByText("identity_posture")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Measure hop 1 \(safe\)/i })
    ).toBeInTheDocument();
    // Honest copy: launch queues only when policy allows; never marks Measured.
    expect(
      screen.getAllByText(
        /Does not mark this hop Measured|Creates a policy decision and approval-required mission/i
      ).length
    ).toBeGreaterThan(0);
    const hopLinks = screen.getAllByRole("link", {
      name: /Measure hops/i
    });
    expect(hopLinks.length).toBeGreaterThanOrEqual(1);
    for (const link of hopLinks) {
      expect(link).toHaveAttribute("href", "#hop-measurement");
    }
  });

  it("shows honest blocked hop state without a measure action", async () => {
    const { assessment } = buildAssessment();
    const pathId = assessment.attackPath.pathId;
    const edges = assessment.attackPath.pathEdges;

    stubFetch({
      [`/api/v1/attack-paths/${pathId}`]: assessment,
      [`/api/v1/attack-paths/${pathId}/evidence`]: { items: [] },
      "/api/v1/scopes": { items: [] },
      [`/api/v1/attack-paths/${pathId}/validation-plan`]: {
        pathId,
        claimSummary:
          "Hypothesis path: 0/2 hops Measured with evidence; 0 eligible for safe hop probes; 2 blocked by scope, runner, integration, approval, or missing safe module.",
        overallStatus: "Blocked",
        items: edges.map((edge, index) => ({
          pathEdgeId: edge.pathEdgeId,
          sequence: index,
          relationship: edge.relationship,
          evidenceBasis: edge.evidenceBasis,
          recommendedModuleIds: ["periscan.tcp_reachability"],
          safetyLevel: "ActiveNonInvasive",
          missionType: "ExposureValidation",
          requiredScopeTypes: ["Domain"],
          requiresInternalRunner: false,
          prerequisites: [
            "Add and verify authorized scope before launching hop probes"
          ],
          missingTelemetry: [],
          eligibility: "NeedsScope"
        }))
      },
      [`/api/v1/attack-paths/${pathId}/measurement-state`]: {
        pathId,
        pathEvidenceBasis: "Heuristic",
        measuredEdgeCount: 0,
        totalEdgeCount: edges.length,
        measuredHopFraction: 0,
        fullyMeasured: false,
        claimSafeValidationState: "Discovered",
        edgeStates: edges.map((edge) => ({
          pathEdgeId: edge.pathEdgeId,
          hopKey: null,
          evidenceBasis: edge.evidenceBasis,
          evidenceIds: edge.evidenceIds,
          measurementMethod: null,
          latestReceiptId: null
        }))
      },
      [`/api/v1/attack-paths/${pathId}/edge-receipts`]: { items: [] }
    });

    render(<AttackPathDetail id={pathId} />);

    expect(
      (await screen.findAllByLabelText("Hop eligibility: NeedsScope")).length
    ).toBe(2);
    expect(
      screen.getAllByText(
        /A verified scope is required before this hop can be measured/i
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: /Measure hop/i })
    ).not.toBeInTheDocument();
    // Hop-card blocked hint deep-links to scopes (not the primary CTA strip).
    // ICP-P1-16: NeedsScope → /scopes with Verify scope (not /missions).
    const hopScopeLinks = screen.getAllByRole("link", {
      name: /Verify scope/i
    }).filter((el) => el.getAttribute("href") === "/scopes");
    expect(hopScopeLinks.length).toBeGreaterThan(0);
    expect(screen.getAllByText("Blocked").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/No measured events yet/i)
    ).toBeInTheDocument();
    // Primary CTA stays honest without verified scope.
    expect(
      screen.getAllByRole("link", {
        name: /authorize scope to measure/i
      }).length
    ).toBeGreaterThan(0);
    expect(screen.queryByText("FullyMeasured")).not.toBeInTheDocument();
  });

  it("shows RequiresApproval launch messaging and never claims Measured from launch alone", async () => {
    const { assessment, snapshot } = buildAssessment();
    const pathId = assessment.attackPath.pathId;
    const firstEdge = assessment.attackPath.pathEdges[0]!;
    const secondEdge = assessment.attackPath.pathEdges[1]!;
    const hopKey = `${firstEdge.sourceNodeId}|${firstEdge.relationship}|${firstEdge.targetNodeId}`;
    const validateRoute = `/api/v1/attack-paths/${pathId}/edges/${firstEdge.pathEdgeId}/validate`;

    const mission: ValidationMission = {
      completedAt: null,
      createdAt: snapshot.createdAt,
      evidenceIds: [],
      missionId: MISSION_ID,
      missionType: "ExposureValidation",
      policyDecisionId: POLICY_ID,
      policyProfile: "attack-path-edge-validation",
      requestedBy: USER_ID,
      safetyLevel: "ActiveNonInvasive",
      scopeId: SCOPE_ID,
      scopeIds: [SCOPE_ID],
      startedAt: null,
      status: "Draft",
      tenantId: snapshot.tenantId,
      updatedAt: snapshot.updatedAt
    };

    const policyDecision: PolicyDecision = {
      approvalState: "Pending",
      approvedAt: null,
      approvedBy: null,
      createdAt: snapshot.createdAt,
      executionEnvironment: "ControlPlane",
      expiresAt: null,
      missionType: "ExposureValidation",
      outcome: "RequiresApproval",
      policyDecisionId: POLICY_ID,
      rationale: "ActiveNonInvasive requires explicit mission approval.",
      requestedAction: {
        credentialTheft: false,
        destructive: false,
        persistence: false,
        realDataExfiltration: false,
        requiresInternalRunner: false,
        requiresTimeWindow: false,
        uncontrolledExploitChaining: false
      },
      safetyLevel: "ActiveNonInvasive",
      scopeId: SCOPE_ID,
      target: {
        attackPathId: pathId,
        pathEdgeId: firstEdge.pathEdgeId,
        hopKey,
        moduleId: "periscan.tcp_reachability"
      },
      tenantId: snapshot.tenantId,
      updatedAt: snapshot.updatedAt,
      userId: USER_ID
    };

    stubFetch(
      {
        [`/api/v1/attack-paths/${pathId}`]: assessment,
        [`/api/v1/attack-paths/${pathId}/evidence`]: { items: [] },
        "/api/v1/scopes": {
          items: [
            verifiedScope(
              snapshot.tenantId,
              snapshot.createdAt,
              snapshot.updatedAt
            )
          ]
        },
        [`/api/v1/attack-paths/${pathId}/validation-plan`]: {
          pathId,
          claimSummary:
            "Hypothesis path: 0/2 hops Measured with evidence; 1 eligible for safe hop probes; 1 blocked by scope, runner, integration, approval, or missing safe module.",
          overallStatus: "PartiallyReady",
          items: [
            {
              pathEdgeId: firstEdge.pathEdgeId,
              sequence: 0,
              relationship: firstEdge.relationship,
              evidenceBasis: "Heuristic",
              recommendedModuleIds: ["periscan.tcp_reachability"],
              safetyLevel: "ActiveNonInvasive",
              missionType: "ExposureValidation",
              requiredScopeTypes: ["Domain"],
              requiresInternalRunner: false,
              prerequisites: [],
              missingTelemetry: [],
              eligibility: "Eligible"
            },
            {
              pathEdgeId: secondEdge.pathEdgeId,
              sequence: 1,
              relationship: secondEdge.relationship,
              evidenceBasis: "Heuristic",
              recommendedModuleIds: [],
              safetyLevel: "PassiveReadOnly",
              missionType: "ExposureValidation",
              requiredScopeTypes: [],
              requiresInternalRunner: false,
              prerequisites: ["No first-customer safe module mapped"],
              missingTelemetry: ["unsupported_hop_shape"],
              eligibility: "NoSafeModule"
            }
          ]
        },
        [`/api/v1/attack-paths/${pathId}/measurement-state`]: {
          pathId,
          pathEvidenceBasis: "Heuristic",
          measuredEdgeCount: 0,
          totalEdgeCount: 2,
          measuredHopFraction: 0,
          fullyMeasured: false,
          claimSafeValidationState: "Discovered",
          edgeStates: assessment.attackPath.pathEdges.map((edge) => ({
            pathEdgeId: edge.pathEdgeId,
            hopKey: null,
            evidenceBasis: edge.evidenceBasis,
            evidenceIds: edge.evidenceIds,
            measurementMethod: null,
            latestReceiptId: null
          }))
        },
        [`/api/v1/attack-paths/${pathId}/edge-receipts`]: {
          items: [
            {
              receiptId: RECEIPT_ID,
              tenantId: snapshot.tenantId,
              pathId,
              pathEdgeId: secondEdge.pathEdgeId,
              hopKey: "historical|LEADS_TO|target",
              validationRunId: null,
              missionId: null,
              policyDecisionId: null,
              moduleId: "periscan.http_health_check",
              outcome: "http_healthy",
              validationState: "Validated",
              evidenceIds: ["22222222-2222-4222-8222-222222222222"],
              measuredAt: snapshot.updatedAt,
              measurementMethod: "periscan.http_health_check",
              integrityHash: null,
              actor: "analyst"
            }
          ]
        }
      },
      {
        postHandlers: {
          [validateRoute]: (body) => {
            const input = body as { moduleId: string; scopeId: string };
            expect(input.moduleId).toBe("periscan.tcp_reachability");
            expect(input.scopeId).toBe(SCOPE_ID);
            return {
              status: 201,
              body: {
                attackPath: assessment,
                pathEdgeId: firstEdge.pathEdgeId,
                hopKey,
                moduleId: "periscan.tcp_reachability",
                evidenceIds: firstEdge.evidenceIds,
                mission,
                policyDecision,
                queued: false,
                status: "RequiresApproval",
                verificationPlan: {
                  nextStep:
                    "Approve the policy decision, then start the created mission with the edge hop-probe module. Measured claims require a receipt with evidence IDs.",
                  reason: null,
                  requestedAt: snapshot.updatedAt,
                  scopeId: SCOPE_ID,
                  pathEdgeId: firstEdge.pathEdgeId,
                  hopKey,
                  moduleId: "periscan.tcp_reachability"
                }
              }
            };
          }
        }
      }
    );

    render(<AttackPathDetail id={pathId} />);

    expect(
      await screen.findByRole("button", { name: /Measure hop 1 \(safe\)/i })
    ).toBeInTheDocument();

    expect(
      await screen.findByTestId(`edge-receipt-${RECEIPT_ID}`)
    ).toBeInTheDocument();
    expect(screen.getByText("periscan.http_health_check")).toBeInTheDocument();

    const measureBtn = screen.getByRole("button", {
      name: /Measure hop 1 \(safe\)/i
    });
    expect(measureBtn).not.toHaveAttribute("aria-busy");
    // UX-W8 / P16-15: focus-visible ring classes on measure CTA.
    expect(measureBtn.className).toMatch(/focus-visible:ring/);
    fireEvent.click(measureBtn);

    expect(
      await screen.findByText(/Measure hop request accepted — needs approval/i)
    ).toBeInTheDocument();
    const resultCard = screen.getByTestId(
      `hop-launch-result-${firstEdge.pathEdgeId}`
    );
    expect(resultCard).toBeInTheDocument();
    expect(resultCard).toHaveAttribute("role", "status");
    expect(resultCard).toHaveAttribute("aria-live", "polite");
    expect(resultCard).toHaveAttribute("tabindex", "-1");
    await waitFor(() => {
      expect(resultCard).toHaveFocus();
    });
    expect(
      screen.getByText(
        /Not queued\. Not Measured until approval and a receipt with evidence/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Measured claims require a receipt/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open Validation Snapshot" })
    ).toHaveAttribute("href", "/missions");

    // Path measurement ratio stays unmeasured after launch alone.
    expect(
      screen.getByLabelText("Measured edge ratio 0 of 2")
    ).toHaveTextContent("0/2 measured");

    await waitFor(() => {
      const hopCard = screen.getByTestId(`hop-card-${firstEdge.pathEdgeId}`);
      expect(hopCard.textContent).toMatch(/RequiresApproval/);
      // Launch result copy must not invent a Measured claim for this hop.
      expect(hopCard.textContent).toMatch(
        /Not Measured until approval and a receipt with evidence/i
      );
    });
  });

  it("marks Measure hop busy with aria-busy and a disabled reason while requesting", async () => {
    const { assessment, snapshot } = buildAssessment();
    const pathId = assessment.attackPath.pathId;
    const firstEdge = assessment.attackPath.pathEdges[0]!;
    const secondEdge = assessment.attackPath.pathEdges[1]!;
    const hopKey = `${firstEdge.sourceNodeId}|${firstEdge.relationship}|${firstEdge.targetNodeId}`;
    const validateRoute = `/api/v1/attack-paths/${pathId}/edges/${firstEdge.pathEdgeId}/validate`;

    let resolvePost: ((value: {
      status?: number;
      body: unknown;
    }) => void) | null = null;
    const pending = new Promise<{ status?: number; body: unknown }>(
      (resolve) => {
        resolvePost = resolve;
      }
    );

    stubFetch(
      {
        [`/api/v1/attack-paths/${pathId}`]: assessment,
        [`/api/v1/attack-paths/${pathId}/evidence`]: { items: [] },
        "/api/v1/scopes": {
          items: [
            verifiedScope(
              snapshot.tenantId,
              snapshot.createdAt,
              snapshot.updatedAt
            )
          ]
        },
        [`/api/v1/attack-paths/${pathId}/validation-plan`]: {
          pathId,
          claimSummary: "1 eligible hop",
          overallStatus: "PartiallyReady",
          items: [
            {
              pathEdgeId: firstEdge.pathEdgeId,
              sequence: 0,
              relationship: firstEdge.relationship,
              evidenceBasis: "Heuristic",
              recommendedModuleIds: ["periscan.tcp_reachability"],
              safetyLevel: "ActiveNonInvasive",
              missionType: "ExposureValidation",
              requiredScopeTypes: ["Domain"],
              requiresInternalRunner: false,
              prerequisites: [],
              missingTelemetry: [],
              eligibility: "Eligible"
            },
            {
              pathEdgeId: secondEdge.pathEdgeId,
              sequence: 1,
              relationship: secondEdge.relationship,
              evidenceBasis: "Heuristic",
              recommendedModuleIds: [],
              safetyLevel: "PassiveReadOnly",
              missionType: "ExposureValidation",
              requiredScopeTypes: [],
              requiresInternalRunner: false,
              prerequisites: [],
              missingTelemetry: [],
              eligibility: "NeedsIntegration"
            }
          ]
        },
        [`/api/v1/attack-paths/${pathId}/measurement-state`]: {
          pathId,
          pathEvidenceBasis: "Heuristic",
          measuredEdgeCount: 0,
          totalEdgeCount: 2,
          measuredHopFraction: 0,
          fullyMeasured: false,
          claimSafeValidationState: "Discovered",
          edgeStates: assessment.attackPath.pathEdges.map((edge) => ({
            pathEdgeId: edge.pathEdgeId,
            hopKey: null,
            evidenceBasis: edge.evidenceBasis,
            evidenceIds: edge.evidenceIds,
            measurementMethod: null,
            latestReceiptId: null
          }))
        },
        [`/api/v1/attack-paths/${pathId}/edge-receipts`]: { items: [] }
      },
      {
        postHandlers: {
          [validateRoute]: () => pending
        }
      }
    );

    render(<AttackPathDetail id={pathId} />);

    const measureBtn = await screen.findByRole("button", {
      name: /Measure hop 1 \(safe\)/i
    });
    fireEvent.click(measureBtn);

    await waitFor(() => {
      expect(measureBtn).toHaveAttribute("aria-busy", "true");
      expect(measureBtn).toBeDisabled();
      expect(measureBtn).toHaveAttribute("aria-disabled", "true");
      expect(measureBtn).toHaveTextContent(/Requesting/i);
    });
    const describedBy = measureBtn.getAttribute("aria-describedby") ?? "";
    expect(describedBy).toMatch(
      new RegExp(`hop-measure-disabled-${firstEdge.pathEdgeId}`)
    );
    expect(
      document.getElementById(`hop-measure-disabled-${firstEdge.pathEdgeId}`)
    ).toHaveTextContent(/in progress/i);

    resolvePost!({
      status: 201,
      body: {
        attackPath: assessment,
        pathEdgeId: firstEdge.pathEdgeId,
        hopKey,
        moduleId: "periscan.tcp_reachability",
        evidenceIds: [],
        mission: {
          completedAt: null,
          createdAt: snapshot.createdAt,
          evidenceIds: [],
          missionId: MISSION_ID,
          missionType: "ExposureValidation",
          policyDecisionId: POLICY_ID,
          policyProfile: "attack-path-edge-validation",
          requestedBy: USER_ID,
          safetyLevel: "ActiveNonInvasive",
          scopeId: SCOPE_ID,
          scopeIds: [SCOPE_ID],
          startedAt: null,
          status: "Queued",
          tenantId: snapshot.tenantId,
          updatedAt: snapshot.updatedAt
        },
        policyDecision: {
          approvalState: "NotRequired",
          approvedAt: null,
          approvedBy: null,
          createdAt: snapshot.createdAt,
          executionEnvironment: "ControlPlane",
          expiresAt: null,
          missionType: "ExposureValidation",
          outcome: "Allowed",
          policyDecisionId: POLICY_ID,
          rationale: "Allowed for hop probe.",
          requestedAction: {
            credentialTheft: false,
            destructive: false,
            persistence: false,
            realDataExfiltration: false,
            requiresInternalRunner: false,
            requiresTimeWindow: false,
            uncontrolledExploitChaining: false
          },
          safetyLevel: "ActiveNonInvasive",
          scopeId: SCOPE_ID,
          target: {
            attackPathId: pathId,
            pathEdgeId: firstEdge.pathEdgeId,
            hopKey,
            moduleId: "periscan.tcp_reachability"
          },
          tenantId: snapshot.tenantId,
          updatedAt: snapshot.updatedAt,
          userId: USER_ID
        },
        queued: true,
        status: "Queued",
        verificationPlan: {
          nextStep: "Wait for hop receipt with evidence IDs.",
          reason: null,
          requestedAt: snapshot.updatedAt,
          scopeId: SCOPE_ID,
          pathEdgeId: firstEdge.pathEdgeId,
          hopKey,
          moduleId: "periscan.tcp_reachability"
        }
      }
    });

    await waitFor(() => {
      expect(measureBtn).not.toHaveAttribute("aria-busy");
      expect(measureBtn).not.toBeDisabled();
    });
  });

  it("allows Measure hop when plan eligibility is NeedsApproval", async () => {
    const { assessment, snapshot } = buildAssessment();
    const pathId = assessment.attackPath.pathId;
    const firstEdge = assessment.attackPath.pathEdges[0]!;
    const secondEdge = assessment.attackPath.pathEdges[1]!;

    stubFetch({
      [`/api/v1/attack-paths/${pathId}`]: assessment,
      [`/api/v1/attack-paths/${pathId}/evidence`]: { items: [] },
      "/api/v1/scopes": {
        items: [
          verifiedScope(snapshot.tenantId, snapshot.createdAt, snapshot.updatedAt)
        ]
      },
      [`/api/v1/attack-paths/${pathId}/validation-plan`]: {
        pathId,
        claimSummary:
          "Hypothesis path: 0/2 hops Measured with evidence; 0 eligible for safe hop probes; 2 blocked by scope, runner, integration, approval, or missing safe module.",
        overallStatus: "Blocked",
        items: [
          {
            pathEdgeId: firstEdge.pathEdgeId,
            sequence: 0,
            relationship: firstEdge.relationship,
            evidenceBasis: "Heuristic",
            recommendedModuleIds: ["periscan.tcp_reachability"],
            safetyLevel: "ActiveNonInvasive",
            missionType: "ExposureValidation",
            requiredScopeTypes: ["Domain"],
            requiresInternalRunner: false,
            prerequisites: [
              "Tenant policy requires approval above PassiveReadOnly"
            ],
            missingTelemetry: [],
            eligibility: "NeedsApproval"
          },
          {
            pathEdgeId: secondEdge.pathEdgeId,
            sequence: 1,
            relationship: secondEdge.relationship,
            evidenceBasis: "Heuristic",
            recommendedModuleIds: [],
            safetyLevel: "PassiveReadOnly",
            missionType: "ExposureValidation",
            requiredScopeTypes: ["CloudAccount"],
            requiresInternalRunner: false,
            prerequisites: [],
            missingTelemetry: ["identity_posture"],
            eligibility: "NeedsIntegration"
          }
        ]
      },
      [`/api/v1/attack-paths/${pathId}/measurement-state`]: {
        pathId,
        pathEvidenceBasis: "Heuristic",
        measuredEdgeCount: 0,
        totalEdgeCount: 2,
        measuredHopFraction: 0,
        fullyMeasured: false,
        claimSafeValidationState: "Discovered",
        edgeStates: assessment.attackPath.pathEdges.map((edge) => ({
          pathEdgeId: edge.pathEdgeId,
          hopKey: `${edge.sourceNodeId}|${edge.relationship}|${edge.targetNodeId}`,
          evidenceBasis: edge.evidenceBasis,
          evidenceIds: edge.evidenceIds,
          measurementMethod: null,
          latestReceiptId: null
        }))
      },
      [`/api/v1/attack-paths/${pathId}/edge-receipts`]: { items: [] }
    });

    render(<AttackPathDetail id={pathId} />);

    expect(
      await screen.findByLabelText("Hop eligibility: NeedsApproval")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Measure hop 1 \(safe\)/i })
    ).toBeInTheDocument();
  });

  it("does not count Measured edges without evidence when measurement-state is missing", async () => {
    const { assessment } = buildAssessment();
    const pathId = assessment.attackPath.pathId;
    const edgeCount = assessment.attackPath.pathEdges.length;
    // Stamp Measured without evidence on the client path payload.
    assessment.attackPath.pathEdges = assessment.attackPath.pathEdges.map(
      (edge) => ({
        ...edge,
        evidenceBasis: "Measured" as const,
        evidenceIds: []
      })
    );
    assessment.attackPath.evidenceBasis = "Measured";

    stubFetch({
      [`/api/v1/attack-paths/${pathId}`]: assessment,
      [`/api/v1/attack-paths/${pathId}/evidence`]: { items: [] },
      "/api/v1/scopes": { items: [] },
      // measurement-state omitted → 404; UI falls back to edge fields.
      [`/api/v1/attack-paths/${pathId}/validation-plan`]: {
        pathId,
        claimSummary: "Hypothesis path",
        overallStatus: "Blocked",
        items: assessment.attackPath.pathEdges.map((edge, index) => ({
          pathEdgeId: edge.pathEdgeId,
          sequence: index,
          relationship: edge.relationship,
          evidenceBasis: "Measured",
          recommendedModuleIds: [],
          safetyLevel: "PassiveReadOnly",
          missionType: "ExposureValidation",
          requiredScopeTypes: [],
          requiresInternalRunner: false,
          prerequisites: [],
          missingTelemetry: [],
          eligibility: "AlreadyMeasured"
        }))
      },
      [`/api/v1/attack-paths/${pathId}/edge-receipts`]: { items: [] }
    });

    render(<AttackPathDetail id={pathId} />);

    expect(
      await screen.findByText(assessment.attackPath.name)
    ).toBeInTheDocument();

    // Hop-plan ratio uses the edge fallback when measurement-state errors.
    // Measured without evidenceIds must not show N/N measured.
    const ratio = await screen.findByLabelText(
      `${0} of ${edgeCount} path edges measured`
    );
    expect(ratio).toHaveTextContent(`0/${edgeCount} measured`);
  });

  it("shows counterfactual drawer from path breakers without fake risk scores (UX-W9 / #195)", async () => {
    const { assessment, snapshot } = buildAssessment();
    const pathId = assessment.attackPath.pathId;
    const edges = assessment.attackPath.pathEdges;
    const breaker = assessment.attackPath.pathBreakers[0]!;

    stubFetch({
      [`/api/v1/attack-paths/${pathId}`]: assessment,
      [`/api/v1/attack-paths/${pathId}/evidence`]: { items: [] },
      "/api/v1/scopes": { items: [] },
      [`/api/v1/attack-paths/${pathId}/validation-plan`]: {
        pathId,
        claimSummary: `Hypothesis path: 0/${edges.length} hops Measured with evidence.`,
        overallStatus: "Blocked",
        items: edges.map((edge, index) => ({
          pathEdgeId: edge.pathEdgeId,
          sequence: index,
          relationship: edge.relationship,
          evidenceBasis: edge.evidenceBasis,
          recommendedModuleIds: [],
          safetyLevel: "PassiveReadOnly",
          missionType: "ExposureValidation",
          requiredScopeTypes: [],
          requiresInternalRunner: false,
          prerequisites: [],
          missingTelemetry: [],
          eligibility: "NeedsScope"
        }))
      },
      [`/api/v1/attack-paths/${pathId}/measurement-state`]: {
        pathId,
        pathEvidenceBasis: assessment.attackPath.evidenceBasis,
        measuredEdgeCount: 0,
        totalEdgeCount: edges.length,
        measuredHopFraction: 0,
        fullyMeasured: false,
        claimSafeValidationState: "Discovered",
        edgeStates: edges.map((edge) => ({
          pathEdgeId: edge.pathEdgeId,
          hopKey: `${edge.sourceNodeId}|${edge.relationship}|${edge.targetNodeId}`,
          evidenceBasis: edge.evidenceBasis,
          evidenceIds: edge.evidenceIds,
          measurementMethod: null,
          latestReceiptId: null
        }))
      },
      [`/api/v1/attack-paths/${pathId}/edge-receipts`]: { items: [] }
    });

    render(<AttackPathDetail id={pathId} />);

    expect(
      await screen.findByText(assessment.attackPath.name)
    ).toBeInTheDocument();

    const drawer = screen.getByTestId("counterfactual-drawer");
    expect(drawer).toBeInTheDocument();
    expect(drawer.textContent).toMatch(/If measured fixed/i);
    expect(drawer.textContent).toMatch(/Estimate\s*\/\s*heuristic only/i);
    expect(drawer.textContent).toMatch(/not a residual risk score/i);
    expect(drawer.textContent).toMatch(/Red-team counterfactual/i);
    expect(drawer.textContent).toMatch(/Fixed is only via re-measurement/i);
    expect(drawer.textContent).toContain(breaker.title);
    expect(drawer.textContent).toContain(breaker.description);
    // Must not invent residual risk percentages or fake score deltas.
    expect(drawer.textContent).not.toMatch(/\d+%\s*risk/i);
    expect(drawer.textContent).not.toMatch(/residual score/i);
    expect(drawer.textContent).toMatch(/not a scored risk delta/i);
    // snapshot tenant used by fixture builder — keep reference for lint.
    expect(snapshot.tenantId).toBeTruthy();
  });

  it("sizes hop index badges by evidence count not severity (UX-W9 / #194)", async () => {
    const { assessment, snapshot } = buildAssessment();
    const pathId = assessment.attackPath.pathId;
    const edges = assessment.attackPath.pathEdges;
    const firstEdge = edges[0]!;
    const multiEvidence = [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222"
    ];

    stubFetch({
      [`/api/v1/attack-paths/${pathId}`]: assessment,
      [`/api/v1/attack-paths/${pathId}/evidence`]: { items: [] },
      "/api/v1/scopes": { items: [] },
      [`/api/v1/attack-paths/${pathId}/validation-plan`]: {
        pathId,
        claimSummary: `Hypothesis path: 0/${edges.length} hops Measured with evidence.`,
        overallStatus: "Blocked",
        items: edges.map((edge, index) => ({
          pathEdgeId: edge.pathEdgeId,
          sequence: index,
          relationship: edge.relationship,
          evidenceBasis: edge.evidenceBasis,
          recommendedModuleIds: [],
          safetyLevel: "PassiveReadOnly",
          missionType: "ExposureValidation",
          requiredScopeTypes: [],
          requiresInternalRunner: false,
          prerequisites: [],
          missingTelemetry: [],
          eligibility: "NeedsScope"
        }))
      },
      [`/api/v1/attack-paths/${pathId}/measurement-state`]: {
        pathId,
        pathEvidenceBasis: assessment.attackPath.evidenceBasis,
        measuredEdgeCount: 0,
        totalEdgeCount: edges.length,
        measuredHopFraction: 0,
        fullyMeasured: false,
        claimSafeValidationState: "Discovered",
        edgeStates: edges.map((edge, index) => ({
          pathEdgeId: edge.pathEdgeId,
          hopKey: `${edge.sourceNodeId}|${edge.relationship}|${edge.targetNodeId}`,
          evidenceBasis: edge.evidenceBasis,
          evidenceIds: index === 0 ? multiEvidence : [],
          measurementMethod: null,
          latestReceiptId: null
        }))
      },
      [`/api/v1/attack-paths/${pathId}/edge-receipts`]: { items: [] }
    });

    render(<AttackPathDetail id={pathId} />);

    expect(
      await screen.findByText(assessment.attackPath.name)
    ).toBeInTheDocument();

    const badge = await screen.findByTestId(
      `hop-index-badge-${firstEdge.pathEdgeId}`
    );
    expect(badge).toHaveAttribute("data-evidence-count", "2");
    expect(badge.getAttribute("aria-label") ?? "").toMatch(
      /2 evidence references/i
    );
    // Weight encodes evidence, not severity bands.
    expect(badge.className).toMatch(/font-bold/);
    expect(badge.className).not.toMatch(/missed|danger|critical/i);
    expect(snapshot.tenantId).toBeTruthy();
  });

  it("shows claim-safe FullyMeasured status region when all hops have receipts", async () => {
    const { assessment } = buildAssessment();
    const pathId = assessment.attackPath.pathId;
    const edges = assessment.attackPath.pathEdges;
    const evidenceIds = ["eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"];

    stubFetch({
      [`/api/v1/attack-paths/${pathId}`]: {
        ...assessment,
        attackPath: {
          ...assessment.attackPath,
          evidenceBasis: "Measured",
          pathEdges: edges.map((edge) => ({
            ...edge,
            evidenceBasis: "Measured" as const,
            evidenceIds
          }))
        }
      },
      [`/api/v1/attack-paths/${pathId}/evidence`]: { items: [] },
      "/api/v1/scopes": { items: [] },
      [`/api/v1/attack-paths/${pathId}/validation-plan`]: {
        pathId,
        claimSummary: `Measured path: ${edges.length}/${edges.length} hops Measured with evidence.`,
        overallStatus: "FullyMeasured",
        items: edges.map((edge, index) => ({
          pathEdgeId: edge.pathEdgeId,
          sequence: index,
          relationship: edge.relationship,
          evidenceBasis: "Measured",
          recommendedModuleIds: [],
          safetyLevel: "PassiveReadOnly",
          missionType: "ExposureValidation",
          requiredScopeTypes: [],
          requiresInternalRunner: false,
          prerequisites: [],
          missingTelemetry: [],
          eligibility: "AlreadyMeasured"
        }))
      },
      [`/api/v1/attack-paths/${pathId}/measurement-state`]: {
        pathId,
        pathEvidenceBasis: "Measured",
        measuredEdgeCount: edges.length,
        totalEdgeCount: edges.length,
        measuredHopFraction: 1,
        fullyMeasured: true,
        claimSafeValidationState: "Validated",
        edgeStates: edges.map((edge) => ({
          pathEdgeId: edge.pathEdgeId,
          hopKey: `${edge.sourceNodeId}|${edge.relationship}|${edge.targetNodeId}`,
          evidenceBasis: "Measured",
          evidenceIds,
          measurementMethod: "SafeHopProbe",
          latestReceiptId: RECEIPT_ID
        }))
      },
      [`/api/v1/attack-paths/${pathId}/edge-receipts`]: { items: [] }
    });

    render(<AttackPathDetail id={pathId} />);

    expect(
      await screen.findByText(assessment.attackPath.name)
    ).toBeInTheDocument();

    // UX-W13: claim-safe complete status (role=status), never invent from launch.
    const complete = await screen.findByTestId("path-measure-complete-status");
    expect(complete).toHaveAttribute("role", "status");
    expect(complete).toHaveTextContent(
      new RegExp(`All ${edges.length} hops have Measured receipts`, "u")
    );
    expect(complete).toHaveTextContent(/launch status never upgrades/i);
    expect(screen.getAllByText("FullyMeasured").length).toBeGreaterThanOrEqual(
      1
    );

    // Sticky Measure CTA remains the primary journey control.
    expect(
      screen.getAllByRole("link", {
        name: /Measure hops|Measure path hops|Choose a path breaker/i
      }).length
    ).toBeGreaterThanOrEqual(1);
    // ICP-P1-15: whole-path mission demoted to secondary Policy-gated control.
    expect(
      screen.getByRole("button", {
        name: /Policy-gated path mission/i
      })
    ).toBeInTheDocument();
  });

  it("shows sticky back and Up next sibling paths from list fetch [UX-W12]", async () => {
    const { assessment } = buildAssessment();
    const pathId = assessment.attackPath.pathId;
    // Distinct from demo path IDs so list filter does not collapse siblings.
    const siblingId = "a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1";
    const lowerSiblingId = "b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2";
    const sibling = {
      ...assessment,
      attackPath: {
        ...assessment.attackPath,
        pathId: siblingId,
        name: "Sibling lateral path to crown jewel"
      },
      risk: {
        ...assessment.risk,
        score: Math.max(0, assessment.risk.score - 5),
        band: "High" as const
      }
    };
    const lowerSibling = {
      ...assessment,
      attackPath: {
        ...assessment.attackPath,
        pathId: lowerSiblingId,
        name: "Lower priority path"
      },
      risk: {
        ...assessment.risk,
        score: 20,
        band: "Medium" as const
      }
    };

    stubFetch({
      "/api/v1/attack-paths": {
        items: [assessment, sibling, lowerSibling]
      },
      [`/api/v1/attack-paths/${pathId}`]: assessment,
      [`/api/v1/attack-paths/${pathId}/evidence`]: { items: [] },
      "/api/v1/scopes": { items: [] },
      [`/api/v1/attack-paths/${pathId}/validation-plan`]: {
        pathId,
        claimSummary: "Hypothesis",
        overallStatus: "Blocked",
        items: []
      },
      [`/api/v1/attack-paths/${pathId}/measurement-state`]: {
        pathId,
        pathEvidenceBasis: assessment.attackPath.evidenceBasis,
        measuredEdgeCount: 0,
        totalEdgeCount: assessment.attackPath.pathEdges.length,
        measuredHopFraction: 0,
        fullyMeasured: false,
        claimSafeValidationState: "Discovered",
        edgeStates: []
      },
      [`/api/v1/attack-paths/${pathId}/edge-receipts`]: { items: [] }
    });

    render(<AttackPathDetail id={pathId} />);

    expect(
      await screen.findByRole("heading", {
        name: assessment.attackPath.name,
        level: 1
      })
    ).toBeInTheDocument();

    // UX-W14 dual-pane workspace is present whenever a path is selected.
    expect(await screen.findByTestId("paths-dual-pane")).toBeInTheDocument();
    expect(screen.getByLabelText("Attack path list")).toBeInTheDocument();

    const back = screen.getByTestId("attack-path-back-link");
    expect(back).toHaveAttribute("href", "/attack-paths");
    expect(back.className).toMatch(/border-line|font-semibold/);

    const strip = await screen.findByTestId("path-siblings-strip");
    expect(strip).toHaveTextContent("Up next");
    // Sibling chips + dual-pane list both link to the same paths.
    const siblingLinks = screen.getAllByRole("link", {
      name: /Sibling lateral path to crown jewel/i
    });
    expect(siblingLinks.length).toBeGreaterThanOrEqual(1);
    for (const link of siblingLinks) {
      expect(link).toHaveAttribute("href", `/attack-paths/${siblingId}`);
    }
    const lowerLinks = screen.getAllByRole("link", {
      name: /Lower priority path/i
    });
    expect(lowerLinks.length).toBeGreaterThanOrEqual(1);
    for (const link of lowerLinks) {
      expect(link).toHaveAttribute("href", `/attack-paths/${lowerSiblingId}`);
    }
    // Current path must not appear as a sibling chip (list may still highlight it).
    expect(
      strip.querySelector(`a[href="/attack-paths/${pathId}"]`)
    ).toBeNull();
    const allPathsLinks = screen.getAllByRole("link", { name: /All paths/i });
    expect(allPathsLinks.length).toBeGreaterThanOrEqual(1);
    for (const link of allPathsLinks) {
      expect(link).toHaveAttribute("href", "/attack-paths");
    }

    // Dual-pane list marks the current path and navigates on select.
    const currentInList = screen
      .getByLabelText("Attack path list")
      .querySelector(`a[href="/attack-paths/${pathId}"]`);
    expect(currentInList).not.toBeNull();
    expect(currentInList).toHaveAttribute("aria-current", "page");
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  AttackPathAssessment,
  AttackPathChokePointAnalysis,
  BusinessImpactWorkspace
} from "@periscan/shared";
import {
  BUSINESS_IMPACT_SCENARIOS,
  BusinessImpactScenarioSchema
} from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { AttackPathsWorkbench } from "./attack-paths-workbench";

const now = "2026-07-14T20:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const pathId = "22222222-2222-4222-8222-222222222222";
const entryNodeId = "33333333-3333-4333-8333-333333333333";
const controlNodeId = "44444444-4444-4444-8444-444444444444";
const objectiveNodeId = "55555555-5555-4555-8555-555555555555";
const entryEntityId = "66666666-6666-4666-8666-666666666666";
const controlEntityId = "77777777-7777-4777-8777-777777777777";
const objectiveEntityId = "88888888-8888-4888-8888-888888888888";
const evidenceId = "99999999-9999-4999-8999-999999999999";

const assessment: AttackPathAssessment = {
  attackPath: {
    confidence: 0.82,
    createdAt: now,
    entryNodeId,
    evidenceBasis: "Heuristic",
    evidenceIds: [evidenceId],
    impactNodeId: objectiveNodeId,
    impactScore: 84,
    methodology: "Evidence graph correlation",
    name: "Exposed identity to production data",
    nonSnapPack: null,
    pathBreakers: [],
    pathEdges: [],
    pathId,
    pathNodes: [
      {
        createdAt: now,
        entityId: entryEntityId,
        entityType: "Exposure",
        evidenceIds: [evidenceId],
        label: "Exposed identity",
        pathId,
        pathNodeId: entryNodeId,
        sequence: 0,
        tenantId,
        updatedAt: now
      },
      {
        createdAt: now,
        entityId: controlEntityId,
        entityType: "Asset",
        evidenceIds: [evidenceId],
        label: "Privileged cloud role",
        pathId,
        pathNodeId: controlNodeId,
        sequence: 1,
        tenantId,
        updatedAt: now
      },
      {
        createdAt: now,
        entityId: objectiveEntityId,
        entityType: "Asset",
        evidenceIds: [evidenceId],
        label: "Production data",
        pathId,
        pathNodeId: objectiveNodeId,
        sequence: 2,
        tenantId,
        updatedAt: now
      }
    ],
    tenantId,
    updatedAt: now,
    validationState: "Validated"
  },
  financialExposure: null,
  risk: {
    band: "High",
    factors: [],
    score: 78,
    summary: "High-risk evidence-linked path."
  }
};

const analysis: AttackPathChokePointAnalysis = {
  analyzedAt: now,
  assumptions: [
    "These are evidence-backed path breakers ranked from persisted, evidence-linked paths — not XM-class min-cut science or a Leading graph claim.",
    "Recommendations use a greedy hitting-set approximation; they are not a proof of the exact global minimum or a single cheapest control across all paths."
  ],
  chokePoints: [
    {
      betweenness: 1,
      evidenceBasis: "Heuristic",
      evidenceIds: [evidenceId],
      label: "Privileged cloud role",
      nodeId: controlEntityId,
      pathCount: 1,
      pathIds: [pathId],
      pathNames: [assessment.attackPath.name]
    }
  ],
  collapseRatio: 1,
  honestyNote:
    "Methodology GreedyHittingSetApproximation: evidence-weighted path breakers only. Not graph-wide min-cut.",
  methodology: "GreedyHittingSetApproximation",
  recommendedCutSet: [
    {
      betweenness: 1,
      evidenceBasis: "Heuristic",
      evidenceIds: [evidenceId],
      label: "Privileged cloud role",
      nodeId: controlEntityId,
      pathCount: 1,
      pathIds: [pathId],
      pathNames: [assessment.attackPath.name]
    }
  ],
  tenantId,
  totalPaths: 1
};

const impactWorkspace: BusinessImpactWorkspace = {
  assets: [],
  generatedAt: now,
  limitations: ["Customer assumptions only."],
  methodology: "FAIR-inspired PERT range estimate",
  scenarios: BUSINESS_IMPACT_SCENARIOS.map((scenario) =>
    BusinessImpactScenarioSchema.parse(scenario)
  ),
  summary: {
    approvedAssetCount: 0,
    assumptionBasedAnnualizedExposureUsd: 0,
    failedIntegrityCount: 0,
    pendingReviewCount: 0,
    valuedAssetCount: 0
  }
};

function mockImpactDesk(options?: { scopeVerified?: boolean }) {
  vi.spyOn(api, "getBusinessImpactWorkspace").mockResolvedValue(
    impactWorkspace
  );
  vi.spyOn(api, "getMe").mockResolvedValue({
    membership: { role: "Owner" }
  } as unknown as Awaited<ReturnType<typeof api.getMe>>);
  vi.spyOn(api, "getProductActivationState").mockResolvedValue({
    completedMilestones: options?.scopeVerified === false ? 0 : 1,
    diagnostics: [],
    milestones: [
      {
        key: "ScopeVerified",
        state: options?.scopeVerified === false ? "Pending" : "Completed"
      }
    ],
    nextAction: null,
    totalMilestones: 7
  } as unknown as Awaited<ReturnType<typeof api.getProductActivationState>>);
}

describe("AttackPathsWorkbench", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders evidence-backed path breakers without min-cut Leading claims", async () => {
    vi.spyOn(api, "listAttackPaths").mockResolvedValue([assessment]);
    vi.spyOn(api, "getAttackPathChokePointAnalysis").mockResolvedValue(
      analysis
    );
    mockImpactDesk();

    render(<AttackPathsWorkbench />);

    expect(
      await screen.findByRole("heading", { name: "Path breaker optimizer" })
    ).toBeInTheDocument();
    expect(screen.getByText("Evidence-backed path breakers")).toBeInTheDocument();
    expect(screen.getByText("Privileged cloud role")).toBeInTheDocument();
    expect(screen.getAllByText("Heuristic").length).toBeGreaterThan(0);
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(
      screen.getByText(/not exact global min-cut/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Greedy approx")).toBeInTheDocument();
    expect(screen.queryByText(/Leading min-cut/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/never mark Fixed from this ranking alone/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Assumptions and limits"));
    expect(
      screen.getAllByText(/evidence-backed path breakers/i).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/greedy hitting-set approximation/i).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/not XM-class min-cut science/i).length
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/Leading min-cut/i)).not.toBeInTheDocument();
  });

  it("PageHeader exposes a clear multi-hop primary action (ICP residual)", async () => {
    vi.spyOn(api, "listAttackPaths").mockResolvedValue([assessment]);
    vi.spyOn(api, "getAttackPathChokePointAnalysis").mockResolvedValue(
      analysis
    );
    mockImpactDesk();

    render(<AttackPathsWorkbench />);

    const cta = await screen.findByTestId("paths-header-primary-cta");
    expect(cta.tagName).toBe("A");
    expect(cta.getAttribute("href")).toBeTruthy();
    expect(cta.textContent?.length).toBeGreaterThan(0);
  });

  it("leads with multi-hop measurement progress and honest empty hops", async () => {
    vi.spyOn(api, "listAttackPaths").mockResolvedValue([assessment]);
    vi.spyOn(api, "getAttackPathChokePointAnalysis").mockResolvedValue(
      analysis
    );
    mockImpactDesk();

    render(<AttackPathsWorkbench />);

    expect(
      await screen.findByText(/Investigate · measured multi-hop/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Multi-hop measurement")).toBeInTheDocument();
    // Fixture path has no edges — honest empty, not fake Measured.
    expect(
      screen.getByText(/no hop edges yet — nothing to measure/i)
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("0 of 0 hops measured across all paths")
    ).toHaveTextContent("0/0 hops");
    // Header primary + multi-hop strip both point at the same inspect target.
    expect(screen.getByTestId("paths-header-primary-cta")).toHaveAttribute(
      "href",
      `/attack-paths/${pathId}#hop-measurement`
    );
    expect(screen.getByTestId("multi-hop-primary-cta")).toHaveAttribute(
      "href",
      `/attack-paths/${pathId}#hop-measurement`
    );
    expect(
      screen.getByRole("link", { name: /Multi-hop operator journey/i })
    ).toHaveAttribute("href", "/getting-started");
    // UX-W8: list→detail back affordance + keyboard jump hint.
    expect(screen.getByTestId("paths-list-nav-hint")).toHaveTextContent(
      /All attack paths|⌘K/
    );
    // Path rows surface first-class EvidenceBasisBadge (Heuristic/Measured).
    expect(screen.getByTestId(`path-basis-${pathId}`)).toHaveTextContent(
      "Heuristic"
    );
  });

  it("surfaces primary Measure path hops CTA when unmeasured hops + verified scope", async () => {
    const edgeId = "abababab-abab-4bab-8bab-abababababab";
    vi.spyOn(api, "listAttackPaths").mockResolvedValue([
      {
        ...assessment,
        attackPath: {
          ...assessment.attackPath,
          pathEdges: [
            {
              createdAt: now,
              evidenceBasis: "Heuristic",
              evidenceIds: [evidenceId],
              measurementMethod: null,
              pathEdgeId: edgeId,
              pathId,
              rationale: "Correlated hypothesis hop.",
              relationship: "CAN_ACCESS",
              sourceNodeId: entryNodeId,
              targetNodeId: objectiveNodeId,
              tenantId,
              updatedAt: now
            }
          ]
        }
      }
    ]);
    vi.spyOn(api, "getAttackPathChokePointAnalysis").mockResolvedValue(
      analysis
    );
    mockImpactDesk({ scopeVerified: true });

    render(<AttackPathsWorkbench />);

    expect(
      await screen.findByText(/No hops measured yet across 1 recorded hop/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText("0/1 hops measured")).toBeInTheDocument();
    const primary = screen.getByTestId("multi-hop-primary-cta");
    expect(primary).toHaveTextContent("Measure path hops");
    expect(primary).toHaveAttribute(
      "href",
      `/attack-paths/${pathId}#hop-measurement`
    );
    expect(screen.getAllByText("Measure path hops").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("link", { name: /Exposed identity to production data/i })
        .closest("a")
    ).toHaveAttribute("href", `/attack-paths/${pathId}#hop-measurement`);
  });

  it("does not claim Measure primary without verified scope", async () => {
    const edgeId = "abababab-abab-4bab-8bab-abababababab";
    vi.spyOn(api, "listAttackPaths").mockResolvedValue([
      {
        ...assessment,
        attackPath: {
          ...assessment.attackPath,
          pathEdges: [
            {
              createdAt: now,
              evidenceBasis: "Heuristic",
              evidenceIds: [evidenceId],
              measurementMethod: null,
              pathEdgeId: edgeId,
              pathId,
              rationale: "Correlated hypothesis hop.",
              relationship: "CAN_ACCESS",
              sourceNodeId: entryNodeId,
              targetNodeId: objectiveNodeId,
              tenantId,
              updatedAt: now
            }
          ]
        }
      }
    ]);
    vi.spyOn(api, "getAttackPathChokePointAnalysis").mockResolvedValue(
      analysis
    );
    mockImpactDesk({ scopeVerified: false });

    render(<AttackPathsWorkbench />);

    const primary = await screen.findByTestId("multi-hop-primary-cta");
    expect(primary).toHaveTextContent(/authorize scope/i);
    expect(primary).not.toHaveTextContent(/^Measure path hops$/);
    expect(
      screen.getByRole("link", { name: /Authorize scope →/i })
    ).toHaveAttribute("href", "/scopes");
  });

  it("shows honest empty state when no paths (never fake FullyMeasured)", async () => {
    vi.spyOn(api, "listAttackPaths").mockResolvedValue([]);
    vi.spyOn(api, "getAttackPathChokePointAnalysis").mockResolvedValue({
      ...analysis,
      totalPaths: 0,
      recommendedCutSet: [],
      chokePoints: []
    });
    mockImpactDesk();

    render(<AttackPathsWorkbench />);

    const empty = await screen.findByTestId("attack-paths-empty");
    expect(empty).toBeInTheDocument();
    expect(empty).toHaveTextContent(/empty is honest, not a fake Measured path/i);
    expect(empty).toHaveTextContent(
      /never claim FullyMeasured without hop receipts/i
    );
    // UX-W7: one primary + one secondary CTA only (EmptyState).
    const links = empty.querySelectorAll("a");
    const hrefs = [...links].map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/integrations", "/getting-started"]);
    expect(links).toHaveLength(2);
    expect(empty).toHaveTextContent(/Connect a source/i);
    expect(empty).toHaveTextContent(/Multi-hop operator journey/i);
  });

  it("labels measured Kubernetes evidence fusion without implying exploitation", async () => {
    vi.spyOn(api, "listAttackPaths").mockResolvedValue([
      {
        ...assessment,
        attackPath: {
          ...assessment.attackPath,
          evidenceBasis: "Measured",
          methodology:
            "measured-evidence-fusion:public-exposure-and-kubernetes-cis-failure",
          name: "Measured public Kubernetes exposure with failed CIS controls",
          pathEdges: [
            {
              createdAt: now,
              evidenceBasis: "Measured",
              evidenceIds: [evidenceId],
              measurementMethod: "authoritative-config-read",
              pathEdgeId: "abababab-abab-4bab-8bab-abababababab",
              pathId,
              rationale: "Measured from authoritative configuration.",
              relationship: "CAN_ACCESS",
              sourceNodeId: entryNodeId,
              targetNodeId: objectiveNodeId,
              tenantId,
              updatedAt: now
            }
          ],
          validationState: "Validated"
        }
      }
    ]);
    vi.spyOn(api, "getAttackPathChokePointAnalysis").mockResolvedValue(
      analysis
    );
    mockImpactDesk();

    render(<AttackPathsWorkbench />);

    expect(
      await screen.findByText("Public exposure × live CIS")
    ).toBeInTheDocument();
    expect(screen.getByText("Measured validated path")).toBeInTheDocument();
    expect(screen.queryByText("Exploitable")).not.toBeInTheDocument();
  });

  it("shows claim-safe path hero labels (no raw Validated without measurement) [UX-W1]", async () => {
    // Recorded Validated + Heuristic must project to claim-safe Discovered /
    // "Heuristic hypothesis" — never a customer-facing bare Validated chip.
    vi.spyOn(api, "listAttackPaths").mockResolvedValue([assessment]);
    vi.spyOn(api, "getAttackPathChokePointAnalysis").mockResolvedValue(
      analysis
    );
    mockImpactDesk();

    render(<AttackPathsWorkbench />);

    const row = await screen.findByTestId("path-row");
    expect(row).toHaveAttribute("data-claim-kind", "HeuristicHypothesis");
    expect(row).toHaveAttribute("data-claim-safe-state", "Discovered");
    expect(row).toHaveAttribute("data-risk-band-display", "High");
    const claimHero = screen.getByTestId("path-claim-hero");
    expect(claimHero).toBeInTheDocument();
    expect(claimHero).toHaveTextContent(/Heuristic hypothesis/i);
    // Path claim hero never surfaces a raw Validated badge (filter options may
    // still list recorded workflow states — that is filter honesty, not claim).
    expect(claimHero).not.toHaveTextContent(/^Validated$/);
    expect(claimHero.textContent).not.toMatch(/\bValidated\b/i);
  });

  it("disambiguates Fixed risk band as Closed (risk) on path cards [UX-W1 #66]", async () => {
    vi.spyOn(api, "listAttackPaths").mockResolvedValue([
      {
        ...assessment,
        risk: {
          ...assessment.risk,
          band: "Fixed",
          summary: "Closed (risk) path band after verified residual closure."
        }
      }
    ]);
    vi.spyOn(api, "getAttackPathChokePointAnalysis").mockResolvedValue(
      analysis
    );
    mockImpactDesk();

    render(<AttackPathsWorkbench />);

    const row = await screen.findByTestId("path-row");
    expect(row).toHaveAttribute("data-risk-band-display", "Closed (risk)");
    // Summary strip + path card both use Closed (risk); never bare Fixed.
    expect(screen.getAllByText("Closed (risk)").length).toBeGreaterThanOrEqual(
      1
    );
    expect(row).toHaveTextContent("Closed (risk)");
    expect(row.textContent).not.toMatch(/\bFixed\b/);
  });
});

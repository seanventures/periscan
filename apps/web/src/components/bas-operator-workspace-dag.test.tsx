import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CAMPAIGN_DAG_EMPTY_TITLE,
  CAMPAIGN_DAG_NOT_EXECUTED_COVERAGE,
  compileBasCampaignDag,
  emptyDangerOperatorGate,
  listBasControlPlaneScenarios,
  type BasCampaignPreview,
  type BasContentVersionSummary,
  type ControlSource,
  type DangerOperatorGate,
  type Scope,
  type ValidationMission,
  type ValidationStimulus
} from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { BasOperatorWorkspace } from "./bas-operator-workspace";

const now = "2026-09-17T14:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const scopeId = "22222222-2222-4222-8222-222222222222";
const controlSourceId = "44444444-4444-4444-8444-444444444444";
const missionId = "55555555-5555-4555-8555-555555555555";
const policyDecisionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const compiledDigest = "ab".repeat(32);
const campaignPlanId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function authorizedScope(overrides: Partial<Scope> = {}): Scope {
  return {
    assetClass: "Network",
    businessCriticality: "High",
    createdAt: now,
    createdBy: null,
    effectiveMaxSafetyLevel: "BASLite",
    externalValidationProfileId: null,
    isOperationalTechnology: false,
    lastPostureCheckAt: null,
    maxSafetyLevel: "BASLite",
    nextPostureCheckAt: null,
    purdueLevel: null,
    safetyRestrictionReason: "This scope permits validation through BASLite.",
    scopeId,
    scopeType: "Domain",
    segmentName: null,
    sensitivity: "Moderate",
    tags: [],
    tenantId,
    updatedAt: now,
    value: "canary.example.com",
    verificationExpiresAt: null,
    verificationMethod: "MANUAL",
    verificationStale: false,
    verificationStatus: "Verified",
    verificationToken: null,
    verifiedAt: now,
    verifiedBy: null,
    ...overrides
  };
}

function controlSource(): ControlSource {
  return {
    controlSourceId,
    controlType: "SIEM",
    createdAt: now,
    expectedBehaviors: ["Detected", "Logged"],
    healthStatus: "Healthy",
    integrationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    lastValidatedAt: now,
    provider: "Splunk",
    telemetryStatus: "Healthy",
    tenantId,
    updatedAt: now
  };
}

function mission(): ValidationMission {
  return {
    completedAt: null,
    createdAt: now,
    evidenceIds: [],
    missionId,
    missionType: "ControlValidation",
    policyDecisionId,
    policyProfile: "owned-domain-control-canary",
    requestedBy: userId,
    safetyLevel: "BASLite",
    scopeId,
    scopeIds: [scopeId],
    startedAt: now,
    status: "Queued",
    tenantId,
    updatedAt: now
  };
}

function campaignPin(
  overrides: Partial<BasCampaignPreview["plan"]["scenarioPins"][number]> = {}
): BasCampaignPreview["plan"]["scenarioPins"][number] {
  return {
    contentSha256: "ef".repeat(32),
    dependsOn: [],
    provider: "ControlPlane",
    typedInputs: {},
    upstreamId: "control.detection.benign-marker",
    ...overrides
  };
}

function campaignPreview(
  overrides: Omit<Partial<BasCampaignPreview>, "plan"> & {
    plan?: Partial<BasCampaignPreview["plan"]>;
    pins?: BasCampaignPreview["plan"]["scenarioPins"];
  } = {}
): BasCampaignPreview {
  const { plan: planOverrides, pins, ...rest } = overrides;
  const scenarioPins = pins ?? [campaignPin({ typedInputs: { timeout: 30 } })];
  const dag = compileBasCampaignDag(scenarioPins);
  const dependencyGraph = dag.graph ?? {
    edges: [],
    executionOrder: scenarioPins.map((pin) => pin.stepKey ?? pin.upstreamId),
    nodes: scenarioPins.map((pin) => pin.stepKey ?? pin.upstreamId)
  };
  return {
    cancelledAt: null,
    cleanup: [],
    denyReason: null,
    dispatchPrevented: false,
    jobsQueued: 0,
    missionId: null,
    plan: {
      approvalDigest: "cd".repeat(32),
      basCampaignPlanId: campaignPlanId,
      cleanupPolicy: {
        onCancel: "request_then_record",
        requireVerifiedCleanup: true
      },
      compiledDigest,
      contentVersionIds: [],
      createdAt: now,
      policyDecisionId,
      runnerId: null,
      scopeId,
      scopeVerificationStatus: "Verified",
      scopeVersion: now,
      startable: true,
      tenantId,
      ...planOverrides,
      dependencyGraph: planOverrides?.dependencyGraph ?? dependencyGraph,
      scenarioPins: planOverrides?.scenarioPins ?? scenarioPins
    },
    policyOutcome: "Allowed",
    policyRationale: "Campaign compile preview is Allowed.",
    ...rest
  };
}

function stubLists(input?: {
  campaigns?: BasCampaignPreview[];
  content?: BasContentVersionSummary[];
  dangerGate?: DangerOperatorGate;
  campaignsError?: Error;
}) {
  vi.spyOn(api, "listMissions").mockResolvedValue([]);
  vi.spyOn(api, "listScopes").mockResolvedValue([authorizedScope()]);
  vi.spyOn(api, "listControlSources").mockResolvedValue([controlSource()]);
  vi.spyOn(api, "listValidationStimuli").mockResolvedValue(
    [] as ValidationStimulus[]
  );
  vi.spyOn(api, "listBasControlPlaneScenarios").mockResolvedValue(
    listBasControlPlaneScenarios()
  );
  vi.spyOn(api, "listBasContentVersions").mockResolvedValue({
    items: input?.content ?? [],
    nextCursor: null
  });
  vi.spyOn(api, "listBasCampaigns").mockImplementation(async () => {
    if (input?.campaignsError) throw input.campaignsError;
    return { items: input?.campaigns ?? [] };
  });
  vi.spyOn(api, "compileBasCampaign");
  vi.spyOn(api, "startBasCampaign");
  vi.spyOn(api, "cancelBasCampaign");
  vi.spyOn(api, "getBasContentVersion");
  vi.spyOn(api, "startBasScenario");
  vi.spyOn(api, "getBasDangerOperatorGate").mockResolvedValue(
    input?.dangerGate ?? emptyDangerOperatorGate()
  );
}

describe("BasOperatorWorkspace campaign DAG", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("shows an honest empty DAG region when there is no compiled graph", async () => {
    stubLists({ campaigns: [] });

    render(<BasOperatorWorkspace />);

    const dag = await screen.findByTestId("bas-campaign-dag");
    expect(dag).toHaveTextContent(CAMPAIGN_DAG_EMPTY_TITLE);
    expect(dag).toHaveTextContent(/No compiled campaign graph/i);
    expect(screen.getByText(/No compiled campaigns/i)).toBeInTheDocument();
    expect(
      screen.queryByTestId("bas-campaign-dag-edges")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Start campaign" })
    ).not.toBeInTheDocument();
    expect(api.startBasCampaign).not.toHaveBeenCalled();
  });

  it("renders the DAG region after compile with pin order and edges", async () => {
    const preview = campaignPreview({
      pins: [
        campaignPin({
          dependsOn: ["recon"],
          stepKey: "marker",
          typedInputs: { timeout: 30 }
        }),
        campaignPin({
          contentSha256: "cd".repeat(32),
          dependsOn: [],
          stepKey: "recon",
          typedInputs: {}
        })
      ],
      plan: {
        dependencyGraph: {
          edges: [{ from: "marker", to: "recon" }],
          executionOrder: ["recon", "marker"],
          nodes: ["recon", "marker"]
        },
        startable: true
      }
    });
    stubLists({ campaigns: [] });
    const compile = vi.spyOn(api, "compileBasCampaign").mockResolvedValue({
      denyReason: null,
      jobsQueued: 0,
      plan: preview.plan,
      queued: false,
      startable: true
    });
    vi.spyOn(api, "listBasCampaigns")
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValue({ items: [preview] });

    render(<BasOperatorWorkspace />);

    expect(
      await screen.findByLabelText("Authorized BAS inject scope")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Compile campaign" }));

    await waitFor(() => {
      expect(compile).toHaveBeenCalled();
    });
    await expect(compile.mock.results[0]?.value).resolves.toMatchObject({
      jobsQueued: 0,
      queued: false
    });

    const dag = await screen.findByTestId("bas-campaign-dag");
    expect(dag).toHaveTextContent(CAMPAIGN_DAG_NOT_EXECUTED_COVERAGE);
    expect(dag).not.toHaveTextContent(/executedCoverage:\s*true/i);
    const order = within(dag).getByTestId("bas-campaign-execution-order");
    expect(
      within(order)
        .getAllByRole("listitem")
        .map((step) => step.getAttribute("data-testid"))
    ).toEqual(["bas-campaign-pin-recon", "bas-campaign-pin-marker"]);
    const edges = within(dag).getByTestId("bas-campaign-dag-edges");
    expect(edges).toHaveTextContent(/marker depends on recon/i);
    expect(
      within(edges).getByTestId("bas-campaign-dag-edge-marker-recon")
    ).toHaveTextContent("marker depends on recon");
    expect(screen.getByTestId("bas-inject-panel")).toBeInTheDocument();
    expect(api.startBasCampaign).not.toHaveBeenCalled();
  });

  it("after operator Compile lists compiler graph edges, not executed coverage", async () => {
    const pins = [
      campaignPin({
        dependsOn: ["recon"],
        stepKey: "marker",
        typedInputs: { timeout: 30 }
      }),
      campaignPin({
        contentSha256: "cd".repeat(32),
        dependsOn: [],
        stepKey: "recon",
        typedInputs: {}
      })
    ];
    const compiled = compileBasCampaignDag(pins);
    expect(compiled.graph).not.toBeNull();
    expect(compiled.graph?.edges.length).toBeGreaterThan(0);
    const preview = campaignPreview({
      pins,
      plan: {
        dependencyGraph: compiled.graph ?? undefined,
        startable: true
      }
    });
    stubLists({ campaigns: [] });
    vi.spyOn(api, "compileBasCampaign").mockResolvedValue({
      denyReason: null,
      jobsQueued: 0,
      plan: preview.plan,
      queued: false,
      startable: true
    });
    vi.spyOn(api, "listBasCampaigns")
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValue({ items: [preview] });

    render(<BasOperatorWorkspace />);

    expect(
      await screen.findByLabelText("Authorized BAS inject scope")
    ).toBeInTheDocument();
    expect(screen.getByTestId("bas-inject-panel")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Compile campaign" }));

    const dag = await screen.findByRole("region", {
      name: "Compiled campaign DAG"
    });
    expect(dag).toHaveTextContent(CAMPAIGN_DAG_NOT_EXECUTED_COVERAGE);
    expect(dag).not.toHaveTextContent(/executedCoverage:\s*true/i);
    expect(screen.queryByText(CAMPAIGN_DAG_EMPTY_TITLE)).not.toBeInTheDocument();
    for (const edge of compiled.graph?.edges ?? []) {
      expect(
        within(dag).getByTestId(`bas-campaign-dag-edge-${edge.from}-${edge.to}`)
      ).toHaveTextContent(`${edge.from} depends on ${edge.to}`);
    }
    expect(screen.getByTestId("bas-inject-panel")).toBeInTheDocument();
    expect(api.startBasCampaign).not.toHaveBeenCalled();
  });

  it("lists compiler from→to edges as bas-campaign-dag-edge-* for a 2-pin compile", async () => {
    const pins = [
      campaignPin({
        contentSha256: "cd".repeat(32),
        dependsOn: [],
        stepKey: "recon",
        typedInputs: {}
      }),
      campaignPin({
        dependsOn: ["recon"],
        stepKey: "marker",
        typedInputs: { timeout: 30 }
      })
    ];
    const compiled = compileBasCampaignDag(pins);
    expect(compiled.graph?.edges).toEqual([{ from: "marker", to: "recon" }]);
    const preview = campaignPreview({
      jobsQueued: 0,
      pins,
      plan: {
        dependencyGraph: {
          edges: [],
          executionOrder: [],
          nodes: []
        },
        startable: true
      }
    });
    stubLists({ campaigns: [preview] });

    render(<BasOperatorWorkspace />);

    const row = await screen.findByTestId(
      `bas-campaign-plan-${compiledDigest}`
    );
    const dag = within(row).getByTestId("bas-campaign-dag");
    expect(dag).toHaveTextContent(CAMPAIGN_DAG_NOT_EXECUTED_COVERAGE);
    expect(dag).not.toHaveTextContent(/executedCoverage:\s*true/i);
    expect(
      within(dag).getByTestId("bas-campaign-dag-edge-marker-recon")
    ).toHaveTextContent("marker depends on recon");
    expect(row).toHaveTextContent(/jobs queued 0/i);
    expect(api.startBasCampaign).not.toHaveBeenCalled();
  });

  it("keeps live pack DAGs unstartable with jobsQueued 0", async () => {
    const preview = campaignPreview({
      denyReason:
        "Atomic adapter qualification is required before live execution. Denied tasks are never queued.",
      jobsQueued: 0,
      pins: [
        campaignPin({
          dependsOn: [],
          stepKey: "marker",
          typedInputs: { timeout: 30 }
        }),
        campaignPin({
          contentSha256: "11".repeat(32),
          dependsOn: ["marker"],
          stepKey: "atomic",
          upstreamId: "atomic.live"
        }),
        campaignPin({
          contentSha256: "22".repeat(32),
          dependsOn: ["atomic"],
          stepKey: "caldera",
          upstreamId: "caldera.live"
        }),
        campaignPin({
          contentSha256: "33".repeat(32),
          dependsOn: ["caldera"],
          stepKey: "metasploit",
          upstreamId: "metasploit.live"
        })
      ],
      plan: {
        dependencyGraph: {
          edges: [
            { from: "atomic", to: "marker" },
            { from: "caldera", to: "atomic" },
            { from: "metasploit", to: "caldera" }
          ],
          executionOrder: ["marker", "atomic", "caldera", "metasploit"],
          nodes: ["marker", "atomic", "caldera", "metasploit"]
        },
        startable: false
      },
      policyOutcome: "Denied",
      policyRationale:
        "Atomic adapter qualification is required before live execution. Denied tasks are never queued."
    });
    stubLists({ campaigns: [preview] });
    const start = vi.spyOn(api, "startBasCampaign").mockResolvedValue({
      campaignPlanId,
      compiledDigest,
      denyReason: preview.denyReason,
      jobsQueued: 0,
      mission: null,
      outcome: "Denied",
      policyDecisionId,
      queued: false,
      rationale: preview.policyRationale,
      runs: [],
      startable: false
    });

    render(<BasOperatorWorkspace />);

    const row = await screen.findByTestId(
      `bas-campaign-plan-${compiledDigest}`
    );
    const dag = within(row).getByTestId("bas-campaign-dag");
    expect(dag).toHaveTextContent(CAMPAIGN_DAG_NOT_EXECUTED_COVERAGE);
    expect(
      within(dag).getByTestId("bas-campaign-pin-atomic")
    ).toHaveTextContent(/not live executable/i);
    expect(
      within(dag).getByTestId("bas-campaign-pin-caldera")
    ).toHaveTextContent(/not live executable/i);
    expect(
      within(dag).getByTestId("bas-campaign-pin-metasploit")
    ).toHaveTextContent(/not live executable/i);
    expect(within(dag).getByTestId("bas-campaign-dag-edges")).toHaveTextContent(
      /atomic depends on marker/i
    );
    expect(row).toHaveTextContent(/jobs queued 0/i);
    expect(
      screen.getByRole("button", { name: "Start campaign" })
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Start campaign" }));
    expect(start).not.toHaveBeenCalled();
  });

  it("keeps unreviewed compiled DAGs fail-closed with Start disabled", async () => {
    const preview = campaignPreview({
      denyReason:
        "Unreviewed BAS content cannot execute. Campaign start is denied and jobs are not queued.",
      jobsQueued: 0,
      pins: [
        campaignPin({
          provider: "AtomicRedTeam",
          stepKey: "unreviewed",
          upstreamId: "T1082"
        })
      ],
      plan: { startable: false },
      policyOutcome: "Denied",
      policyRationale:
        "Unreviewed BAS content cannot execute. Campaign start is denied and jobs are not queued."
    });
    stubLists({ campaigns: [preview] });
    const start = vi.spyOn(api, "startBasCampaign").mockResolvedValue({
      campaignPlanId,
      compiledDigest,
      denyReason: preview.denyReason,
      jobsQueued: 0,
      mission: mission(),
      outcome: "Denied",
      policyDecisionId,
      queued: false,
      rationale: preview.policyRationale,
      runs: [],
      startable: false
    });

    render(<BasOperatorWorkspace />);

    const row = await screen.findByTestId(
      `bas-campaign-plan-${compiledDigest}`
    );
    const dag = within(row).getByTestId("bas-campaign-dag");
    expect(dag).toHaveTextContent(/unreviewed/i);
    expect(dag).toHaveTextContent(/not live executable/i);
    expect(dag).toHaveTextContent(CAMPAIGN_DAG_NOT_EXECUTED_COVERAGE);
    expect(row).toHaveTextContent(/jobs queued 0/i);
    expect(row).toHaveTextContent(/Unreviewed BAS content cannot execute/i);
    expect(
      screen.getByRole("button", { name: "Start campaign" })
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Start campaign" }));
    expect(start).not.toHaveBeenCalled();
  });

  it("surfaces bas_campaign_dag_invalid instead of inventing a graph", async () => {
    stubLists({ campaigns: [] });
    vi.spyOn(api, "compileBasCampaign").mockRejectedValue(
      new Error("bas_campaign_dag_invalid")
    );

    render(<BasOperatorWorkspace />);

    expect(
      await screen.findByLabelText("Authorized BAS inject scope")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Compile campaign" }));

    expect(
      await screen.findByText("bas_campaign_dag_invalid")
    ).toBeInTheDocument();
    const dag = screen.getByTestId("bas-campaign-dag");
    expect(dag).toHaveTextContent(CAMPAIGN_DAG_EMPTY_TITLE);
    expect(
      screen.queryByTestId("bas-campaign-dag-edges")
    ).not.toBeInTheDocument();
    expect(api.startBasCampaign).not.toHaveBeenCalled();
  });
});

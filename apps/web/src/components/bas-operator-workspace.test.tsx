import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  compileBasCampaignDag,
  emptyDangerOperatorGate,
  HIGH_DANGER_ACK_CHECKBOX_LABEL,
  HIGH_DANGER_SECTION_COPY,
  listBasControlPlaneScenarios,
  listDangerCatalog,
  type BasCampaignPreview,
  type BasContentVersionSummary,
  type ControlSource,
  type DangerOperatorGate,
  type Scope,
  type ValidationMission,
  type ValidationStimulus
} from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { MONDAY_MODE_STORAGE_KEY } from "./dashboard-command-center";
import {
  BasOperatorWorkspace,
  basMondayFocusReady
} from "./bas-operator-workspace";

const now = "2026-09-17T14:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const scopeId = "22222222-2222-4222-8222-222222222222";
const unverifiedScopeId = "33333333-3333-4333-8333-333333333333";
const controlSourceId = "44444444-4444-4444-8444-444444444444";
const missionId = "55555555-5555-4555-8555-555555555555";
const readyStimulusId = "66666666-6666-4666-8666-666666666666";
const observingStimulusId = "77777777-7777-4777-8777-777777777777";
const completedStimulusId = "88888888-8888-4888-8888-888888888888";
const policyDecisionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

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

function unverifiedScope(): Scope {
  return authorizedScope({
    scopeId: unverifiedScopeId,
    value: "pending.example.com",
    verificationStatus: "Pending",
    verifiedAt: null,
    safetyRestrictionReason: "Scope is not yet verified."
  });
}

function controlSource(overrides: Partial<ControlSource> = {}): ControlSource {
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
    updatedAt: now,
    ...overrides
  };
}

function mission(
  overrides: Partial<ValidationMission> = {}
): ValidationMission {
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
    updatedAt: now,
    ...overrides
  };
}

function stimulus(
  overrides: Partial<ValidationStimulus> = {}
): ValidationStimulus {
  return {
    cleanupBehavior: "Marker expires after the observation deadline.",
    completedAt: null,
    controlSourceId,
    createdAt: now,
    createdBy: userId,
    dispatchReceipt: null,
    dispatchedAt: null,
    errorSummary: null,
    evidenceIds: [],
    expectedControlBehaviors: ["Detected", "Logged"],
    markerFingerprint: "0123456789ab",
    maxRequestBytes: 1024,
    missionId,
    observationDeadlineAt: null,
    policyDecisionId,
    rateLimitPerMinute: 1,
    runId: null,
    safetyLevel: "ControlledValidation",
    scopeId,
    status: "Ready",
    stimulusId: readyStimulusId,
    stimulusType: "OwnedDomainUrlCanary",
    targetHost: "canary.example.com",
    techniqueId: "T1059",
    tenantId,
    ttlSeconds: 600,
    updatedAt: now,
    verdict: null,
    ...overrides
  };
}

function contentVersion(): BasContentVersionSummary {
  return {
    basContentVersionId: "99999999-9999-4999-8999-999999999999",
    contentSha256: "ab".repeat(32),
    createdAt: now,
    evidenceProduced: false,
    executable: false,
    provider: "AtomicRedTeam",
    provenance: "UserSuppliedUnverified",
    registeredByUserId: userId,
    scenarioCount: 1,
    sourcePath: "atomics/T1082/T1082.yaml",
    sourceRevision: "unreviewed",
    tenantId
  };
}

const compiledDigest = "ab".repeat(32);
const campaignPlanId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

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

function defaultCampaignPins(): BasCampaignPreview["plan"]["scenarioPins"] {
  return [campaignPin({ typedInputs: { timeout: 30 } })];
}

function campaignPreview(
  overrides: Omit<Partial<BasCampaignPreview>, "plan"> & {
    plan?: Partial<BasCampaignPreview["plan"]>;
    pins?: BasCampaignPreview["plan"]["scenarioPins"];
  } = {}
): BasCampaignPreview {
  const { plan: planOverrides, pins, ...rest } = overrides;
  const scenarioPins = pins ?? defaultCampaignPins();
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

function qualifiedDangerGate(
  overrides: Partial<DangerOperatorGate> = {}
): DangerOperatorGate {
  return {
    available: true,
    items: listDangerCatalog(),
    qualified: true,
    tenantAuthorized: true,
    ...overrides
  };
}

function stubLists(input?: {
  missions?: ValidationMission[];
  scopes?: Scope[];
  sources?: ControlSource[];
  stimuli?: ValidationStimulus[];
  content?: BasContentVersionSummary[];
  campaigns?: BasCampaignPreview[];
  dangerGate?: DangerOperatorGate;
  missionsError?: Error;
  stimuliError?: Error;
  contentError?: Error;
  campaignsError?: Error;
}) {
  vi.spyOn(api, "listMissions").mockImplementation(async () => {
    if (input?.missionsError) throw input.missionsError;
    return input?.missions ?? [];
  });
  vi.spyOn(api, "listScopes").mockResolvedValue(
    input?.scopes ?? [authorizedScope()]
  );
  vi.spyOn(api, "listControlSources").mockResolvedValue(
    input?.sources ?? [controlSource()]
  );
  vi.spyOn(api, "listValidationStimuli").mockImplementation(async () => {
    if (input?.stimuliError) throw input.stimuliError;
    return input?.stimuli ?? [];
  });
  vi.spyOn(api, "listBasControlPlaneScenarios").mockResolvedValue(
    listBasControlPlaneScenarios()
  );
  vi.spyOn(api, "listBasContentVersions").mockImplementation(async () => {
    if (input?.contentError) throw input.contentError;
    return { items: input?.content ?? [], nextCursor: null };
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
  vi.spyOn(api, "createValidationStimulus");
  vi.spyOn(api, "dispatchValidationStimulus");
  vi.spyOn(api, "observeValidationStimulus");
  vi.spyOn(api, "cancelValidationStimulus");
  vi.spyOn(api, "getBasDangerOperatorGate").mockResolvedValue(
    input?.dangerGate ?? emptyDangerOperatorGate()
  );
}

describe("BasOperatorWorkspace", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("mounts on the /bas product route", () => {
    const page = readFileSync(join(process.cwd(), "app/bas/page.tsx"), "utf8");
    expect(page).toMatch(/import\s*\{\s*BasOperatorWorkspace\s*\}\s*from/);
    expect(page).toMatch(/return\s*<BasOperatorWorkspace\s*\/>/);
  });

  it("shows marker-only honesty and does not offer live Atomic execution", async () => {
    stubLists({ missions: [], stimuli: [], scopes: [] });

    render(<BasOperatorWorkspace />);

    expect(
      await screen.findByRole("heading", { name: "BAS operator workspace" })
    ).toBeInTheDocument();
    const honesty = screen.getByTestId("bas-operator-honesty");
    expect(honesty).toHaveTextContent(/benign marker only/i);
    expect(honesty).toHaveTextContent(/hostname, env, date/i);
    expect(screen.getByTestId("bas-operator-loop")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Run Atomic|Start Atomic/i })
    ).not.toBeInTheDocument();
  });

  it("shows honest empty and not-configured states", async () => {
    stubLists({
      missions: [],
      stimuli: [],
      scopes: [unverifiedScope()],
      sources: []
    });

    render(<BasOperatorWorkspace />);

    expect(
      await screen.findByText(/Connect a SIEM or EDR observer/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Verify a scope that permits BAS-lite/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/No detection traces yet/i)).toBeInTheDocument();
    expect(
      screen.getByText(/No ControlValidation missions yet/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/No compiled campaigns/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Inject benign marker" })
    ).toBeDisabled();
    expect(api.startBasScenario).not.toHaveBeenCalled();
  });

  it("surfaces API errors instead of empty theater", async () => {
    stubLists({
      missionsError: new Error("missions unavailable"),
      stimuliError: new Error("stimuli unavailable")
    });

    render(<BasOperatorWorkspace />);

    expect(await screen.findByText("missions unavailable")).toBeInTheDocument();
    expect(screen.getByText("stimuli unavailable")).toBeInTheDocument();
    expect(
      screen.queryByText(/No detection traces yet/i)
    ).not.toBeInTheDocument();
  });

  it("injects the benign-marker scenario via the existing startBasScenario API", async () => {
    stubLists({ missions: [], stimuli: [] });
    const start = vi.spyOn(api, "startBasScenario").mockResolvedValue({
      claimClass: "benign_marker_only",
      denyReason: null,
      jobsQueued: 1,
      mission: mission(),
      outcome: "Allowed",
      policyDecisionId,
      queued: true,
      rationale: "Benign marker class is startable.",
      runs: [],
      scenarioId: "control.detection.benign-marker"
    });

    render(<BasOperatorWorkspace />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Inject benign marker" })
    );

    await waitFor(() => {
      expect(start).toHaveBeenCalledWith({
        scenarioId: "control.detection.benign-marker",
        scopeId,
        controlSourceId
      });
    });
  });

  it("dispatches, observes, and retests traces through existing APIs", async () => {
    const ready = stimulus({
      status: "Ready",
      stimulusId: readyStimulusId,
      targetHost: "ready.example.com"
    });
    const observing = stimulus({
      status: "Observing",
      stimulusId: observingStimulusId,
      targetHost: "observe.example.com",
      dispatchedAt: now,
      dispatchReceipt: {
        latencyMs: 12,
        method: "GET",
        requestBytes: 80,
        responseStatus: 200,
        targetHost: "observe.example.com"
      }
    });
    const completed = stimulus({
      status: "Completed",
      stimulusId: completedStimulusId,
      targetHost: "done.example.com",
      dispatchedAt: now,
      completedAt: now,
      dispatchReceipt: {
        latencyMs: 12,
        method: "GET",
        requestBytes: 80,
        responseStatus: 200,
        targetHost: "done.example.com"
      },
      verdict: {
        controlSourceId,
        correlationMatched: true,
        createdAt: now,
        evidenceIds: ["eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"],
        observedAt: now,
        observedOutcome: "Alerted",
        reason: "Exact marker matched.",
        signalIds: [],
        stimulusId: completedStimulusId,
        tenantId,
        updatedAt: now,
        verdict: "Detected",
        verdictId: "ffffffff-ffff-4fff-8fff-ffffffffffff"
      }
    });
    stubLists({
      missions: [mission()],
      stimuli: [ready, observing, completed]
    });
    const dispatch = vi
      .spyOn(api, "dispatchValidationStimulus")
      .mockResolvedValue({ ...ready, status: "Observing" });
    const observe = vi
      .spyOn(api, "observeValidationStimulus")
      .mockResolvedValue({ ...observing, status: "Completed" });
    const retest = vi
      .spyOn(api, "createValidationStimulus")
      .mockResolvedValue({
        policyDecision: {
          createdAt: now,
          decidedAt: now,
          missionType: "ControlValidation",
          outcome: "Allowed",
          policyDecisionId,
          policyProfile: "owned-domain-control-canary",
          rationale: "Allowed",
          requestedAction: "StartValidation",
          requestedBy: userId,
          safetyLevel: "BASLite",
          scopeId,
          tenantId,
          updatedAt: now
        },
        stimulus: stimulus()
      } as never);

    render(<BasOperatorWorkspace />);

    expect(await screen.findByText("ready.example.com")).toBeInTheDocument();
    expect(
      within(screen.getByTestId(`bas-trace-${completedStimulusId}`)).getByText(
        "Alerted"
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dispatch" }));
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(readyStimulusId);
    });

    fireEvent.click(screen.getByRole("button", { name: "Observe" }));
    await waitFor(() => {
      expect(observe).toHaveBeenCalledWith(observingStimulusId);
    });

    fireEvent.click(screen.getByRole("button", { name: "Retest" }));
    await waitFor(() => {
      expect(retest).toHaveBeenCalledWith({
        controlSourceId,
        scopeId,
        stimulusType: "OwnedDomainUrlCanary",
        techniqueId: "T1059",
        ttlSeconds: 600
      });
    });
  });

  it("does not show Missed when the observer is unhealthy", async () => {
    const completed = stimulus({
      status: "Completed",
      stimulusId: completedStimulusId,
      dispatchedAt: now,
      completedAt: now,
      dispatchReceipt: {
        latencyMs: 12,
        method: "GET",
        requestBytes: 80,
        responseStatus: 200,
        targetHost: "canary.example.com"
      },
      verdict: {
        controlSourceId,
        correlationMatched: false,
        createdAt: now,
        evidenceIds: ["eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"],
        observedAt: now,
        observedOutcome: "Missed",
        reason: "No marker.",
        signalIds: [],
        stimulusId: completedStimulusId,
        tenantId,
        updatedAt: now,
        verdict: "Missed",
        verdictId: "ffffffff-ffff-4fff-8fff-ffffffffffff"
      }
    });
    stubLists({
      missions: [mission()],
      stimuli: [completed],
      sources: [
        controlSource({
          healthStatus: "Unhealthy",
          telemetryStatus: "Unhealthy"
        })
      ]
    });

    render(<BasOperatorWorkspace />);

    expect(await screen.findByTestId("bas-observer-outage")).toBeInTheDocument();
    const row = screen.getByTestId(`bas-trace-${completedStimulusId}`);
    expect(within(row).getByText("Inconclusive")).toBeInTheDocument();
    expect(within(row).queryByText("Missed")).not.toBeInTheDocument();
    expect(within(row).getByText(/Missed gated/i)).toBeInTheDocument();
  });

  it("lists Atomic.live as qualification required and argv hostname as a startable catalog pin", async () => {
    stubLists({});

    render(<BasOperatorWorkspace />);

    const atomic = await screen.findByTestId("bas-scenario-atomic.live");
    expect(atomic).toHaveTextContent(/qualification required/i);
    expect(
      within(atomic).queryByRole("button", { name: /start|run|inject/i })
    ).not.toBeInTheDocument();
    const hostname = await screen.findByTestId(
      "bas-scenario-atomic:486e88ea-4f56-470f-9b57-3f4d73f39133"
    );
    expect(hostname).toHaveTextContent(/qualified argv/i);
  });

  it("shows registered content as authoring metadata, not a fake campaign", async () => {
    stubLists({ content: [contentVersion()] });

    render(<BasOperatorWorkspace />);

    expect(
      await screen.findAllByText(/atomics\/T1082\/T1082.yaml/)
    ).not.toHaveLength(0);
    expect(
      screen.getByText("not executable", { selector: "span" })
    ).toBeInTheDocument();
    expect(screen.getByText(/No compiled campaigns/i)).toBeInTheDocument();
    expect(screen.queryByText(/fake campaign/i)).not.toBeInTheDocument();
  });

  it("collapses catalog under Monday mode to the next operator beat", async () => {
    window.localStorage.setItem(MONDAY_MODE_STORAGE_KEY, "1");
    stubLists({
      stimuli: [
        stimulus({
          status: "Observing",
          stimulusId: observingStimulusId,
          dispatchedAt: now
        })
      ]
    });

    render(<BasOperatorWorkspace />);

    expect(await screen.findByTestId("bas-monday-focus")).toHaveTextContent(
      /observe/i
    );
    expect(screen.getByTestId("bas-inject-panel")).toBeInTheDocument();
    expect(
      screen.queryByText("Registered content (not a campaign)")
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("bas-campaign-compiler")).toBeInTheDocument();
  });

  it("does not ready Monday focus before mount even when pref is on", () => {
    expect(basMondayFocusReady(false, true)).toBe(false);
    expect(basMondayFocusReady(true, false)).toBe(false);
    expect(basMondayFocusReady(true, true)).toBe(true);
  });

  it("SSR HTML keeps the inject panel and omits Monday focus when pref is on", () => {
    window.localStorage.setItem(MONDAY_MODE_STORAGE_KEY, "1");
    stubLists();

    const html = renderToString(<BasOperatorWorkspace />);

    expect(html).toContain("bas-inject-panel");
    expect(html).toContain("bas-inject-title");
    expect(html).toContain("Inject benign marker");
    expect(html).not.toContain("bas-monday-focus");
  });

  it("after mount paints Monday focus without dropping the inject panel", async () => {
    window.localStorage.setItem(MONDAY_MODE_STORAGE_KEY, "1");
    stubLists();

    render(<BasOperatorWorkspace />);

    expect(await screen.findByTestId("bas-monday-focus")).toBeInTheDocument();
    expect(screen.getByTestId("bas-inject-panel")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Authorized BAS inject scope")
    ).toBeInTheDocument();
  });

  it("compiles a campaign from the real API and never queues", async () => {
    const preview = campaignPreview();
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

    fireEvent.change(await screen.findByLabelText("Campaign typed input key"), {
      target: { value: "timeout" }
    });
    fireEvent.change(screen.getByLabelText("Campaign typed input value"), {
      target: { value: "30" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Add typed input" }));
    fireEvent.click(screen.getByRole("button", { name: "Compile campaign" }));

    await waitFor(() => {
      expect(compile).toHaveBeenCalledWith({
        scopeId,
        scenarioPins: [
          {
            provider: "ControlPlane",
            typedInputs: { timeout: 30 },
            upstreamId: "control.detection.benign-marker"
          }
        ]
      });
    });
    expect(api.startBasCampaign).not.toHaveBeenCalled();
    expect(api.startBasScenario).not.toHaveBeenCalled();
    await expect(compile.mock.results[0]?.value).resolves.toMatchObject({
      jobsQueued: 0,
      queued: false
    });
    const row = await screen.findByTestId(`bas-campaign-plan-${compiledDigest}`);
    expect(row).toHaveTextContent(compiledDigest);
    expect(row).toHaveTextContent("timeout=30");
    expect(row).toHaveTextContent("Allowed");
    expect(
      within(row).getByTestId(
        "bas-campaign-pin-control.detection.benign-marker"
      )
    ).toBeInTheDocument();
  });

  it("starts a compiled qualified Atomic hostname campaign by digest", async () => {
    const hostnameId = "atomic:486e88ea-4f56-470f-9b57-3f4d73f39133";
    const preview = campaignPreview({
      jobsQueued: 0,
      pins: [
        campaignPin({
          provider: "ControlPlane",
          upstreamId: hostnameId
        })
      ],
      plan: { startable: true }
    });
    stubLists({ campaigns: [preview] });
    const start = vi.spyOn(api, "startBasCampaign").mockResolvedValue({
      campaignPlanId,
      compiledDigest,
      denyReason: null,
      jobsQueued: 1,
      mission: mission(),
      outcome: "Allowed",
      policyDecisionId,
      queued: true,
      rationale: "Qualified Atomic argv start is Allowed.",
      runs: [],
      startable: true
    });

    render(<BasOperatorWorkspace />);

    const row = await screen.findByTestId(`bas-campaign-plan-${compiledDigest}`);
    expect(within(row).getByText(/^startable$/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start campaign" }));
    await waitFor(() => {
      expect(start).toHaveBeenCalledWith({ compiledDigest });
    });
  });

  it("starts a compiled campaign by digest only", async () => {
    const preview = campaignPreview();
    stubLists({ campaigns: [preview] });
    const start = vi.spyOn(api, "startBasCampaign").mockResolvedValue({
      campaignPlanId,
      compiledDigest,
      denyReason: null,
      jobsQueued: 1,
      mission: mission(),
      outcome: "Allowed",
      policyDecisionId,
      queued: true,
      rationale: "Campaign start is Allowed.",
      runs: [],
      startable: true
    });

    render(<BasOperatorWorkspace />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Start campaign" })
    );

    await waitFor(() => {
      expect(start).toHaveBeenCalledWith({ compiledDigest });
    });
  });

  it("keeps unreviewed and live Atomic campaigns unstartable with jobsQueued 0", async () => {
    const atomic = campaignPreview({
      denyReason:
        "Atomic adapter qualification is required before live execution. Denied tasks are never queued.",
      jobsQueued: 0,
      plan: { startable: false },
      pins: [
        campaignPin({
          upstreamId: "atomic.live"
        })
      ],
      policyOutcome: "Denied",
      policyRationale:
        "Atomic adapter qualification is required before live execution. Denied tasks are never queued."
    });
    stubLists({ campaigns: [atomic] });
    const start = vi.spyOn(api, "startBasCampaign").mockResolvedValue({
      campaignPlanId,
      compiledDigest,
      denyReason: atomic.denyReason,
      jobsQueued: 0,
      mission: null,
      outcome: "Denied",
      policyDecisionId,
      queued: false,
      rationale: atomic.policyRationale,
      runs: [],
      startable: false
    });

    render(<BasOperatorWorkspace />);

    const row = await screen.findByTestId(`bas-campaign-plan-${compiledDigest}`);
    expect(row).toHaveTextContent(/not startable/i);
    expect(row).toHaveTextContent(/Denied/);
    expect(row).toHaveTextContent(/jobs queued 0/i);
    expect(row).not.toHaveTextContent(/liveSupported/i);
    expect(screen.getByRole("button", { name: "Start campaign" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Start campaign" }));
    expect(start).not.toHaveBeenCalled();
  });

  it("shows cleanup status and stops a campaign by compiled digest", async () => {
    const preview = campaignPreview({
      cleanup: [
        {
          detail: "Runner task still leased; cancel requested.",
          outputHash: null,
          receiptSha256: null,
          status: "pending",
          stepKey: "control.detection.benign-marker",
          verifiedAt: null
        }
      ]
    });
    stubLists({ campaigns: [preview] });
    const cancel = vi.spyOn(api, "cancelBasCampaign").mockResolvedValue({
      cancelCompleted: false,
      cancelRequested: true,
      cleanup: preview.cleanup,
      compiledDigest,
      delayedCancel: true,
      dispatchPrevented: true,
      mission: null
    });

    render(<BasOperatorWorkspace />);

    const row = await screen.findByTestId(`bas-campaign-plan-${compiledDigest}`);
    expect(row).toHaveTextContent(/cleanup pending/i);
    fireEvent.click(screen.getByRole("button", { name: "Stop campaign" }));
    await waitFor(() => {
      expect(cancel).toHaveBeenCalledWith({
        compiledDigest,
        cleanupReceipts: []
      });
    });
  });

  it("surfaces campaign list errors instead of inventing campaigns", async () => {
    stubLists({ campaignsError: new Error("campaigns unavailable") });

    render(<BasOperatorWorkspace />);

    expect(await screen.findByText("campaigns unavailable")).toBeInTheDocument();
    expect(screen.queryByText(/No compiled campaigns/i)).not.toBeInTheDocument();
  });

  it("renders compiled pins in topological executionOrder, not pin array order", async () => {
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
    stubLists({ campaigns: [preview] });

    render(<BasOperatorWorkspace />);

    const row = await screen.findByTestId(`bas-campaign-plan-${compiledDigest}`);
    const dag = within(row).getByTestId("bas-campaign-execution-order");
    const steps = within(dag).getAllByRole("listitem");
    expect(steps.map((step) => step.getAttribute("data-testid"))).toEqual([
      "bas-campaign-pin-recon",
      "bas-campaign-pin-marker"
    ]);
    const recon = within(dag).getByTestId("bas-campaign-pin-recon");
    const marker = within(dag).getByTestId("bas-campaign-pin-marker");
    expect(recon).toHaveTextContent(/01/);
    expect(recon).toHaveTextContent("recon");
    expect(marker).toHaveTextContent(/02/);
    expect(marker).toHaveTextContent("marker");
    expect(marker).toHaveTextContent(/depends on recon/i);
    expect(within(recon).getByText(/^startable$/i)).toBeInTheDocument();
    expect(within(marker).getByText(/^startable$/i)).toBeInTheDocument();
    expect(api.startBasCampaign).not.toHaveBeenCalled();
    expect(api.compileBasCampaign).not.toHaveBeenCalled();
  });

  it("marks startable:false pins unstartable and never presents live Atomic, Caldera, or Metasploit as executable", async () => {
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

    const row = await screen.findByTestId(`bas-campaign-plan-${compiledDigest}`);
    const dag = within(row).getByTestId("bas-campaign-execution-order");
    expect(
      within(dag)
        .getAllByRole("listitem")
        .map((step) => step.getAttribute("data-testid"))
    ).toEqual([
      "bas-campaign-pin-marker",
      "bas-campaign-pin-atomic",
      "bas-campaign-pin-caldera",
      "bas-campaign-pin-metasploit"
    ]);

    const marker = within(dag).getByTestId("bas-campaign-pin-marker");
    expect(within(marker).getByText(/not startable/i)).toBeInTheDocument();
    expect(within(marker).queryByText(/not live executable/i)).not.toBeInTheDocument();
    expect(
      within(marker).queryByRole("button", { name: /start|run|inject/i })
    ).not.toBeInTheDocument();

    for (const stepKey of ["atomic", "caldera", "metasploit"] as const) {
      const pin = within(dag).getByTestId(`bas-campaign-pin-${stepKey}`);
      expect(pin).toHaveTextContent(/not live executable/i);
      expect(pin).not.toHaveTextContent(/liveSupported/i);
      expect(within(pin).queryByText(/^startable$/i)).not.toBeInTheDocument();
      expect(within(pin).queryByText(/^executable$/i)).not.toBeInTheDocument();
      expect(
        within(pin).queryByRole("button", { name: /start|run|inject/i })
      ).not.toBeInTheDocument();
    }

    expect(row).toHaveTextContent(/jobs queued 0/i);
    expect(screen.getByRole("button", { name: "Start campaign" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Start campaign" }));
    expect(start).not.toHaveBeenCalled();
  });

  it("lists High danger catalog techniques on /bas, not as unmarked Validate", async () => {
    stubLists({});

    render(<BasOperatorWorkspace />);

    const section = await screen.findByTestId("bas-high-danger-catalog");
    expect(
      within(section).getByRole("heading", { name: "High danger" })
    ).toBeInTheDocument();
    expect(section).toHaveTextContent(HIGH_DANGER_SECTION_COPY);
    expect(section).toHaveTextContent(/Not Community default start/i);
    expect(section).toHaveTextContent(/Denied starts never queue without ack/i);
    expect(section).toHaveTextContent(/Not unmarked Validate/i);

    for (const entry of listDangerCatalog()) {
      const row = within(section).getByTestId(
        `bas-high-danger-${entry.moduleId}`
      );
      expect(row).toHaveTextContent(entry.title);
      expect(row).toHaveTextContent(entry.techniqueId);
      expect(
        within(row).getByRole("button", { name: `Start ${entry.title}` })
      ).toBeDisabled();
    }

    const inject = screen.getByRole("heading", { name: "Inject benign marker" });
    expect(inject).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Validate" })
    ).not.toBe(within(section).queryByRole("heading", { name: "High danger" }));
    const pinSelect = screen.getByLabelText("Campaign scenario pin");
    expect(pinSelect).not.toHaveTextContent(/Ransomware \/ impact \(T1486\)/);
    expect(pinSelect).not.toHaveTextContent(/Unscoped credential spray/);
    expect(pinSelect).not.toHaveTextContent(/Credential harvest/);
    expect(pinSelect).not.toHaveTextContent(/Kill-chain impact/);
    expect(pinSelect).not.toHaveTextContent(/^Persistence$/);
    expect(pinSelect).not.toHaveTextContent(/Metasploit payload/);
    expect(api.startBasCampaign).not.toHaveBeenCalled();
  });

  it("keeps High-danger Start disabled until danger acknowledgement plus qualify/authorize", async () => {
    stubLists({ dangerGate: qualifiedDangerGate() });
    const compile = vi.spyOn(api, "compileBasCampaign");
    const start = vi.spyOn(api, "startBasCampaign");

    render(<BasOperatorWorkspace />);

    const section = await screen.findByTestId("bas-high-danger-catalog");
    expect(within(section).getByText("qualified")).toBeInTheDocument();
    expect(within(section).getByText("authorized")).toBeInTheDocument();
    const startT1486 = within(section).getByRole("button", {
      name: "Start Ransomware / impact (T1486)"
    });
    expect(startT1486).toBeDisabled();
    fireEvent.click(startT1486);
    expect(compile).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();

    fireEvent.click(
      within(section).getByRole("checkbox", {
        name: HIGH_DANGER_ACK_CHECKBOX_LABEL
      })
    );
    expect(startT1486).toBeEnabled();
  });

  it("does not enable High-danger Start from the acknowledgement checkbox alone", async () => {
    stubLists({});

    render(<BasOperatorWorkspace />);

    const section = await screen.findByTestId("bas-high-danger-catalog");
    expect(within(section).getByText("qualification required")).toBeInTheDocument();
    expect(
      within(section).getByText("authorization denied")
    ).toBeInTheDocument();
    fireEvent.click(
      within(section).getByRole("checkbox", {
        name: HIGH_DANGER_ACK_CHECKBOX_LABEL
      })
    );
    expect(
      within(section).getByRole("button", {
        name: "Start Unscoped credential spray"
      })
    ).toBeDisabled();
    expect(api.startBasCampaign).not.toHaveBeenCalled();
  });

  it("starts a High-danger pin with danger acknowledgement and never queues a denied start", async () => {
    stubLists({ dangerGate: qualifiedDangerGate() });
    const preview = campaignPreview({
      denyReason: null,
      jobsQueued: 0,
      pins: [
        campaignPin({
          typedInputs: {},
          upstreamId: "exploitation.impact_t1486"
        })
      ],
      plan: { startable: false }
    });
    const compile = vi.spyOn(api, "compileBasCampaign").mockResolvedValue({
      denyReason:
        "High-danger class (T1486 / ransomware / unscoped spray / credential harvest / persistence / unrestricted Metasploit PAYLOAD) requires extra acknowledgement plus qualification and tenant authorization. Denied tasks are never queued.",
      jobsQueued: 0,
      plan: preview.plan,
      queued: false,
      startable: false
    });
    const start = vi.spyOn(api, "startBasCampaign").mockResolvedValue({
      campaignPlanId,
      compiledDigest,
      denyReason: null,
      jobsQueued: 0,
      mission: null,
      outcome: "Allowed",
      policyDecisionId,
      queued: false,
      rationale: "High-danger start acknowledged.",
      runs: [],
      startable: true
    });

    render(<BasOperatorWorkspace />);

    const section = await screen.findByTestId("bas-high-danger-catalog");
    fireEvent.click(
      within(section).getByRole("checkbox", {
        name: HIGH_DANGER_ACK_CHECKBOX_LABEL
      })
    );
    fireEvent.click(
      within(section).getByRole("button", {
        name: "Start Ransomware / impact (T1486)"
      })
    );

    await waitFor(() => {
      expect(compile).toHaveBeenCalledWith({
        scopeId,
        scenarioPins: [
          {
            provider: "ControlPlane",
            typedInputs: {},
            upstreamId: "exploitation.impact_t1486"
          }
        ]
      });
    });
    await waitFor(() => {
      expect(start).toHaveBeenCalledWith(
        expect.objectContaining({
          compiledDigest,
          dangerAcknowledged: true
        })
      );
    });
    const payload = start.mock.calls[0]?.[0];
    expect(payload?.dangerAckDigest?.length).toBeGreaterThanOrEqual(16);
    expect(start.mock.calls[0]?.[0].dangerAcknowledged).toBe(true);
  });
});

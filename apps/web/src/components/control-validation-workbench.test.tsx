import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  ControlSource,
  Scope,
  ValidationMission,
  ValidationStimulus
} from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { ControlValidationWorkbench } from "./control-validation-workbench";

/**
 * Acceptance (PERISCAN-490 BAS-lite ControlValidation workbench)
 *
 * An operator can:
 * 1. Start a ControlValidation mission on an authorized (verified BAS-lite) scope
 * 2. See control-validation stimuli from the real API client
 * 3. Dispatch, observe, and cancel those stimuli via existing API client methods
 *    (`dispatchValidationStimulus`, `observeValidationStimulus`,
 *    `cancelValidationStimulus`)
 * 4. Read “benign canary / marker-only coverage” — drvClaimClass stays
 *    benign_marker_only; additional BAS scenarios require adapter qualification
 *
 * Empty, error, and populated states are honest. Denied work is never queued.
 */

const now = "2026-07-14T14:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const scopeId = "22222222-2222-4222-8222-222222222222";
const unverifiedScopeId = "33333333-3333-4333-8333-333333333333";
const controlSourceId = "44444444-4444-4444-8444-444444444444";
const missionId = "55555555-5555-4555-8555-555555555555";
const readyStimulusId = "66666666-6666-4666-8666-666666666666";
const observingStimulusId = "77777777-7777-4777-8777-777777777777";
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

function stubLists(input?: {
  missions?: ValidationMission[];
  scopes?: Scope[];
  sources?: ControlSource[];
  stimuli?: ValidationStimulus[];
  missionsError?: Error;
  stimuliError?: Error;
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
  vi.spyOn(api, "createMission");
  vi.spyOn(api, "dispatchValidationStimulus");
  vi.spyOn(api, "observeValidationStimulus");
  vi.spyOn(api, "cancelValidationStimulus");
}

describe("ControlValidationWorkbench", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mounts on the /control-validation product route", () => {
    const page = readFileSync(
      join(process.cwd(), "app/control-validation/page.tsx"),
      "utf8"
    );
    expect(page).toMatch(
      /import\s*\{\s*ControlValidationWorkbench\s*\}\s*from/
    );
    expect(page).toMatch(/return\s*<ControlValidationWorkbench\s*\/>/);
  });

  it("shows benign canary / marker-only coverage honesty on empty load", async () => {
    stubLists({ missions: [], stimuli: [], scopes: [] });

    render(<ControlValidationWorkbench />);

    expect(
      await screen.findByRole("heading", { name: "Control validation" })
    ).toBeInTheDocument();
    const honesty = screen.getByTestId("control-validation-honesty");
    expect(honesty).toHaveTextContent(/benign canary \/ marker-only coverage/i);
    expect(honesty).toHaveTextContent(/benign_marker_only/);
    expect(
      screen.queryByRole("button", { name: /Atomic|Caldera|SharpHound/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "BAS operator workspace" })
    ).toHaveAttribute("href", "/bas");
  });

  it("shows empty states when no authorized scope, missions, or stimuli exist", async () => {
    stubLists({
      missions: [],
      stimuli: [],
      scopes: [unverifiedScope()],
      sources: []
    });

    render(<ControlValidationWorkbench />);

    expect(
      await screen.findByText(/Verify a scope that permits BAS-lite/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No ControlValidation missions yet/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/No stimuli yet/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start ControlValidation mission" })
    ).toBeDisabled();
    expect(api.createMission).not.toHaveBeenCalled();
  });

  it("surfaces API errors instead of an empty theater", async () => {
    stubLists({
      missionsError: new Error("missions unavailable"),
      stimuliError: new Error("stimuli unavailable")
    });

    render(<ControlValidationWorkbench />);

    expect(await screen.findByText("missions unavailable")).toBeInTheDocument();
    expect(screen.getByText("stimuli unavailable")).toBeInTheDocument();
    expect(
      screen.queryByText(/No ControlValidation missions yet/i)
    ).not.toBeInTheDocument();
  });

  it("starts a ControlValidation mission on authorized scope via createMission", async () => {
    stubLists({
      missions: [],
      stimuli: [],
      scopes: [authorizedScope(), unverifiedScope()]
    });
    const created = mission({ status: "Queued" });
    const listed: ValidationMission[] = [];
    vi.mocked(api.listMissions).mockImplementation(async () => listed);
    const create = vi
      .spyOn(api, "createMission")
      .mockImplementation(async () => {
        listed.push(created);
        return created;
      });

    render(<ControlValidationWorkbench />);

    const start = await screen.findByRole("button", {
      name: "Start ControlValidation mission"
    });
    expect(start).toBeEnabled();
    fireEvent.click(start);

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({
        missionType: "ControlValidation",
        safetyLevel: "BASLite",
        scopeId
      });
    });
    expect(
      await screen.findByRole("link", { name: /mission·55555555/i })
    ).toHaveAttribute("href", `/missions/${missionId}`);
  });

  it("does not start ControlValidation on an unverified scope", async () => {
    stubLists({
      missions: [],
      stimuli: [],
      scopes: [unverifiedScope()]
    });
    const create = vi.spyOn(api, "createMission").mockResolvedValue(mission());

    render(<ControlValidationWorkbench />);

    const start = await screen.findByRole("button", {
      name: "Start ControlValidation mission"
    });
    expect(start).toBeDisabled();
    fireEvent.click(start);
    expect(create).not.toHaveBeenCalled();
  });

  it("dispatches, observes, and cancels stimuli via existing API client methods", async () => {
    const ready = stimulus({
      status: "Ready",
      stimulusId: readyStimulusId,
      targetHost: "ready.example.com"
    });
    const observing = stimulus({
      status: "Observing",
      stimulusId: observingStimulusId,
      targetHost: "observe.example.com",
      dispatchedAt: now
    });
    stubLists({
      missions: [mission()],
      stimuli: [ready, observing],
      scopes: [authorizedScope()]
    });
    const dispatch = vi
      .spyOn(api, "dispatchValidationStimulus")
      .mockResolvedValue({ ...ready, status: "Observing" });
    const observe = vi
      .spyOn(api, "observeValidationStimulus")
      .mockResolvedValue({ ...observing, status: "Completed" });
    const cancel = vi
      .spyOn(api, "cancelValidationStimulus")
      .mockResolvedValue({ ...ready, status: "Cancelled" });

    render(<ControlValidationWorkbench />);

    expect(await screen.findByText("ready.example.com")).toBeInTheDocument();
    expect(screen.getByText("observe.example.com")).toBeInTheDocument();
    expect(screen.getByTestId("control-validation-honesty")).toHaveTextContent(
      /benign canary \/ marker-only coverage/i
    );

    fireEvent.click(screen.getByRole("button", { name: "Dispatch" }));
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(readyStimulusId);
    });

    fireEvent.click(screen.getByRole("button", { name: "Observe" }));
    await waitFor(() => {
      expect(observe).toHaveBeenCalledWith(observingStimulusId);
    });

    const readyRow = screen.getByTestId(`stimulus-${readyStimulusId}`);
    fireEvent.click(within(readyRow).getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(cancel).toHaveBeenCalledWith(readyStimulusId);
    });
  });
});

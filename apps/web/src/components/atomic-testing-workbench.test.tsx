import { readFileSync } from "node:fs";
import { join } from "node:path";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  listAtomicTestCatalog,
  type Asset,
  type RunnerRecord,
  type Scope,
  type StartAtomicTestResult
} from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { AtomicTestingWorkbench } from "./atomic-testing-workbench";

const now = "2026-09-17T14:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const scopeId = "22222222-2222-4222-8222-222222222222";
const runnerId = "66666666-6666-4666-8666-666666666666";
const policyDecisionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function authorizedScope(): Scope {
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
    verifiedBy: null
  };
}

function runner(): RunnerRecord {
  return {
    arch: "arm64",
    certificateExpiresAt: null,
    certificateSha256: null,
    createdAt: now,
    createdBy: null,
    deploymentMode: "Docker",
    hostname: "runner.local",
    killSwitchActivatedAt: null,
    killSwitchActivatedBy: null,
    killSwitchActive: false,
    killSwitchReason: null,
    labels: ["lab"],
    lastSeenAt: now,
    name: "Lab runner",
    networkProfile: {
      additionalEgressNotes: null,
      dnsResolutionRequired: true,
      explicitProxyUrl: null,
      gatewayHostnames: ["runner.periscan.cloud"],
      httpConnectProxySupported: true,
      outboundHttpsPorts: [443]
    },
    os: "linux",
    revokedAt: null,
    runnerId,
    status: "Active",
    tenantId,
    transportMode: "LongPollHttps",
    updatedAt: now,
    version: "0.1.0"
  };
}

function asset(): Asset {
  return {
    assetId: "44444444-4444-4444-8444-444444444444",
    assetType: "Host",
    businessCriticality: "High",
    createdAt: now,
    environment: "lab",
    firstSeenAt: now,
    identifiers: { hostname: "endpoint.lab" },
    internetExposed: false,
    lastSeenAt: now,
    name: "endpoint.lab",
    owner: "lab",
    status: "Active",
    tags: [],
    tenantId,
    updatedAt: now,
    valuation: null
  };
}

function stubLists(
  input: {
    assets?: Asset[];
    catalogError?: Error;
    runners?: RunnerRecord[];
    scopes?: Scope[];
  } = {}
) {
  vi.spyOn(api, "listAtomicTests").mockImplementation(async () => {
    if (input.catalogError) throw input.catalogError;
    return listAtomicTestCatalog();
  });
  vi.spyOn(api, "listScopes").mockResolvedValue(
    input.scopes ?? [authorizedScope()]
  );
  vi.spyOn(api, "listRunners").mockResolvedValue(input.runners ?? [runner()]);
  vi.spyOn(api, "listAssets").mockResolvedValue(input.assets ?? [asset()]);
  vi.spyOn(api, "startAtomicTest");
}

function loggedResult(): StartAtomicTestResult {
  return {
    boundAssetId: null,
    boundRunnerId: runnerId,
    claimClass: "benign_marker_only",
    denyReason: null,
    jobsQueued: 1,
    liveSupported: false,
    mission: null,
    outcome: "Allowed",
    policyDecisionId,
    queued: true,
    rationale: "Verified scope permits ActiveNonInvasive ControlValidation.",
    result: "Logged",
    runs: [],
    scenarioPin: {
      provider: "ControlPlane",
      typedInputs: {},
      upstreamId: "control.detection.benign-marker"
    },
    startable: true
  };
}

describe("AtomicTestingWorkbench", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mounts on the /bas/atomic-testing product route", () => {
    const page = readFileSync(
      join(process.cwd(), "app/bas/atomic-testing/page.tsx"),
      "utf8"
    );
    expect(page).toMatch(/import\s*\{\s*AtomicTestingWorkbench\s*\}\s*from/);
    expect(page).toMatch(/return\s*<AtomicTestingWorkbench\s*\/>/);
  });

  it("lists startable pins and keeps one primary Run", async () => {
    stubLists();
    render(<AtomicTestingWorkbench />);

    expect(
      await screen.findByRole("heading", { name: "Atomic testing" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("atomic-testing-honesty")).toHaveTextContent(
      /live atomic is not executable/i
    );
    expect(
      await screen.findByRole("radio", { name: /Benign detection marker/i })
    ).toBeChecked();
    expect(screen.getByRole("button", { name: "Run" })).toBeEnabled();
    expect(screen.queryAllByRole("button", { name: "Run" })).toHaveLength(1);
    expect(
      screen.getByRole("radio", { name: /Atomic \(qualification required\)/i })
    ).toBeInTheDocument();
  });

  it("does not offer Run for unqualified live Atomic", async () => {
    stubLists();
    render(<AtomicTestingWorkbench />);

    fireEvent.click(
      await screen.findByRole("radio", {
        name: /Atomic \(qualification required\)/i
      })
    );
    const run = screen.getByRole("button", { name: "Run" });
    expect(run).toBeDisabled();
    expect(
      screen.getByText(/Atomic adapter qualification is required/i)
    ).toBeInTheDocument();
    expect(api.startAtomicTest).not.toHaveBeenCalled();
  });

  it("runs a startable pin against the bound runner and shows Logged", async () => {
    stubLists();
    const start = vi
      .spyOn(api, "startAtomicTest")
      .mockResolvedValue(loggedResult());
    render(<AtomicTestingWorkbench />);

    fireEvent.click(await screen.findByRole("button", { name: "Run" }));

    await waitFor(() => expect(start).toHaveBeenCalledOnce());
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        runnerId,
        scenarioPin: expect.objectContaining({
          provider: "ControlPlane",
          upstreamId: "control.detection.benign-marker"
        }),
        scopeId
      })
    );
    expect(await screen.findByTestId("atomic-test-result")).toHaveTextContent(
      "Logged"
    );
    expect(screen.getByTestId("atomic-test-result")).not.toHaveTextContent(
      /liveSupported:\s*true/i
    );
  });

  it("requires High-danger acknowledgement and still reports jobsQueued=0", async () => {
    stubLists();
    const start = vi.spyOn(api, "startAtomicTest").mockResolvedValue({
      boundAssetId: "44444444-4444-4444-8444-444444444444",
      boundRunnerId: null,
      claimClass: "qualification_required",
      denyReason: "qualification_required",
      jobsQueued: 0,
      liveSupported: false,
      mission: null,
      outcome: "Denied",
      policyDecisionId,
      queued: false,
      rationale: "qualification_required",
      result: "Inconclusive",
      runs: [],
      scenarioPin: {
        provider: "HighDanger",
        typedInputs: {},
        upstreamId: "exploitation.impact_t1486"
      },
      startable: false
    });
    render(<AtomicTestingWorkbench />);

    fireEvent.click(
      await screen.findByRole("radio", {
        name: /Ransomware \/ impact \(T1486\)/i
      })
    );
    const run = screen.getByRole("button", { name: "Run" });
    expect(run).toBeDisabled();

    fireEvent.click(
      screen.getByRole("checkbox", { name: /acknowledge high danger/i })
    );
    fireEvent.click(run);

    await waitFor(() => expect(start).toHaveBeenCalledOnce());
    expect(start.mock.calls[0]?.[0]).toMatchObject({
      dangerAcknowledged: true,
      scenarioPin: { upstreamId: "exploitation.impact_t1486" }
    });
    expect(await screen.findByTestId("atomic-test-result")).toHaveTextContent(
      "Inconclusive"
    );
    expect(screen.getByTestId("atomic-test-jobs-queued")).toHaveTextContent(
      "0"
    );
  });

  it("shows honest empty when no verified scope or bound runner/asset exists", async () => {
    stubLists({ assets: [], runners: [], scopes: [] });
    render(<AtomicTestingWorkbench />);

    expect(
      await screen.findByText(/Verify a scope that permits BAS-lite/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Bind an active runner or asset/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run" })).toBeDisabled();
  });
});

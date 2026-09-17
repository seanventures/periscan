import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  CommunityValidationStartResult,
  CommunityValidationSuiteResponse,
  PolicyDecision,
  Scope
} from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { communityMissionHref } from "./community-run-progress";
import { ValidationSnapshotFlow } from "./validation-snapshot-flow";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push })
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  )
}));

const now = "2026-09-02T14:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const scopeId = "33333333-3333-4333-8333-333333333333";
const policyDecisionId = "44444444-4444-4444-8444-444444444444";
const missionId = "55555555-5555-4555-8555-555555555555";

const startable38 = [
  "gitleaks.repo_secrets",
  ...Array.from({ length: 37 }, (_, index) => `community.engine_${index + 2}`)
];

function repoScope(overrides: Partial<Scope> = {}): Scope {
  return {
    assetClass: "Code",
    businessCriticality: "Moderate",
    createdAt: now,
    createdBy: userId,
    effectiveMaxSafetyLevel: "ActiveNonInvasive",
    externalValidationProfileId: null,
    isOperationalTechnology: false,
    lastPostureCheckAt: null,
    maxSafetyLevel: "ActiveNonInvasive",
    nextPostureCheckAt: null,
    purdueLevel: null,
    safetyRestrictionReason:
      "This scope permits validation through ActiveNonInvasive.",
    scopeId,
    scopeType: "Repository",
    segmentName: null,
    sensitivity: "Moderate",
    tags: [],
    tenantId,
    updatedAt: now,
    value: "/tmp/authorized-repo",
    verificationExpiresAt: null,
    verificationMethod: "TOKEN_FILE",
    verificationStale: false,
    verificationStatus: "Verified",
    verificationToken: "periscan-token",
    verifiedAt: now,
    verifiedBy: userId,
    ...overrides
  };
}

function suite(
  overrides: Partial<CommunityValidationSuiteResponse> = {}
): CommunityValidationSuiteResponse {
  return {
    cloudAwsAvailable: false,
    copyleftOptIn: {
      hint: "GPL/LGPL extras stay Engine Lab.",
      licensedToolIds: [],
      modules: []
    },
    deferredModules: [
      {
        moduleId: "syft.repo_sbom",
        reason: "Enroll an internal runner to start this engine.",
        title: "Syft SBOM"
      }
    ],
    editionId: "community",
    includeExternalPoa: false,
    licenseNote: "Not live Atomic.",
    modules: startable38.map((moduleId) => ({
      defaultSafetyLevel: "PassiveReadOnly",
      executionMode: "ControlPlane",
      moduleId,
      requiredScopeTypes: ["Repository"],
      targetKind: "repositoryPath",
      title: moduleId,
      toolId: null,
      toolLicense: "MIT"
    })),
    runnerAvailable: false,
    scopeType: "Repository",
    startableModuleIds: startable38,
    valueLine: "Community edition is the open-core validation pack.",
    ...overrides
  };
}

function policy(): PolicyDecision {
  return {
    approvalState: "NotRequired",
    createdAt: now,
    executionEnvironment: "ControlPlane",
    expiresAt: null,
    missionType: "ValidationSnapshot",
    outcome: "Allowed",
    policyDecisionId,
    rationale:
      "Verified scope with a passive or non-invasive safety level is allowed.",
    requestedAction: {
      credentialTheft: false,
      destructive: false,
      persistence: false,
      realDataExfiltration: false,
      requiresInternalRunner: false,
      requiresTimeWindow: false,
      uncontrolledExploitChaining: false
    },
    safetyLevel: "PassiveReadOnly",
    scopeId,
    target: { repositoryPath: "/tmp/authorized-repo" },
    tenantId,
    updatedAt: now,
    userId
  };
}

function started(): CommunityValidationStartResult {
  return {
    editionId: "community",
    jobsQueued: 1,
    mission: {
      completedAt: null,
      createdAt: now,
      evidenceIds: [],
      missionId,
      missionType: "ValidationSnapshot",
      policyDecisionId,
      policyProfile: "community",
      requestedBy: tenantId,
      safetyLevel: "PassiveReadOnly",
      scopeId,
      scopeIds: [scopeId],
      startedAt: now,
      status: "Queued",
      tenantId,
      updatedAt: now
    },
    moduleIds: ["gitleaks.repo_secrets"],
    nucleiMissionId: null,
    nucleiSkipReason: null,
    runs: [],
    scopeType: "Repository",
    target: { repositoryPath: "/tmp/authorized-repo" }
  };
}

describe("ValidationSnapshotFlow empty add-scope", () => {
  afterEach(() => {
    push.mockClear();
    vi.restoreAllMocks();
  });

  it("defaults Type to Repository with a local-path placeholder", async () => {
    vi.spyOn(api, "listScopes").mockResolvedValue([]);
    vi.spyOn(api, "listMissions").mockResolvedValue([]);

    render(<ValidationSnapshotFlow />);

    const type = await screen.findByLabelText("Scope type");
    expect(type).toHaveValue("Repository");
    expect(screen.getByLabelText("Scope value")).toHaveAttribute(
      "placeholder",
      "/opt/customer/repo"
    );
    expect(screen.getByLabelText("Scope value")).not.toHaveAttribute(
      "placeholder",
      "example.com"
    );
  });
});

describe("ValidationSnapshotFlow hosted GitHub paste", () => {
  afterEach(() => {
    push.mockClear();
    vi.restoreAllMocks();
  });

  it("explains that a GitHub URL is not a control-plane local path", async () => {
    vi.spyOn(api, "listScopes").mockResolvedValue([]);
    vi.spyOn(api, "listMissions").mockResolvedValue([]);

    render(<ValidationSnapshotFlow />);

    const input = await screen.findByLabelText("Scope value");
    expect(
      screen.queryByText(/control plane verifies a local clone/i)
    ).not.toBeInTheDocument();

    fireEvent.change(input, {
      target: { value: "https://github.com/acme/payments-api" }
    });

    expect(screen.getByRole("note")).toHaveTextContent(
      "The control plane verifies a local clone path it can read, not github.com/org/repo. Paste an absolute path such as /opt/customer/repo. Hosted GitHub URLs cannot be added or verified here. Attest is runner-only, not a skip."
    );
    expect(screen.getByLabelText("Scope type")).toHaveValue("Repository");
    expect(screen.getByRole("button", { name: /^add scope$/i })).toBeDisabled();
    expect(screen.getByRole("note")).not.toHaveTextContent(/stay pending/i);
  });

  it("does not offer Verify for a pending hosted GitHub URL repository", async () => {
    const pendingGithub: Scope = {
      assetClass: "Code",
      businessCriticality: "Moderate",
      createdAt: "2026-09-02T00:00:00.000Z",
      createdBy: "22222222-2222-4222-8222-222222222222",
      effectiveMaxSafetyLevel: "ActiveNonInvasive",
      externalValidationProfileId: null,
      isOperationalTechnology: false,
      lastPostureCheckAt: null,
      maxSafetyLevel: "ActiveNonInvasive",
      nextPostureCheckAt: null,
      purdueLevel: null,
      safetyRestrictionReason:
        "This scope permits validation through ActiveNonInvasive.",
      scopeId: "33333333-3333-4333-8333-333333333333",
      scopeType: "Repository",
      segmentName: null,
      sensitivity: "Moderate",
      tags: [],
      tenantId: "11111111-1111-4111-8111-111111111111",
      updatedAt: "2026-09-02T00:00:00.000Z",
      value: "https://github.com/org/repo",
      verificationExpiresAt: null,
      verificationMethod: "FILE",
      verificationStale: false,
      verificationStatus: "Pending",
      verificationToken: "periscan-token",
      verifiedAt: null,
      verifiedBy: null
    };
    vi.spyOn(api, "listScopes").mockResolvedValue([pendingGithub]);
    vi.spyOn(api, "listMissions").mockResolvedValue([]);
    const verifyScope = vi.spyOn(api, "verifyScope");

    render(<ValidationSnapshotFlow />);

    expect(
      await screen.findByText("https://github.com/org/repo")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio"));
    expect(screen.getByText("Pending")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("note")).toHaveTextContent(
        /cannot be added or verified/i
      );
    });
    expect(
      screen.queryByRole("button", { name: /^verify scope$/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^attest authorization$/i })
    ).not.toBeInTheDocument();
    expect(verifyScope).not.toHaveBeenCalled();
  });
});

describe("ValidationSnapshotFlow engine start count", () => {
  afterEach(() => {
    push.mockClear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function mockValidateApis() {
    vi.spyOn(api, "listScopes").mockResolvedValue([repoScope()]);
    vi.spyOn(api, "getCommunityValidationSuite").mockResolvedValue(suite());
    vi.spyOn(api, "listMissions").mockResolvedValue([]);
    vi.spyOn(api, "previewPolicyDecision").mockResolvedValue(policy());
  }

  function stubSearch(search: string) {
    vi.stubGlobal("location", {
      ...window.location,
      search
    });
  }

  it("does not claim 38 engines will start when a first-hour pin queues Gitleaks", async () => {
    stubSearch("?moduleIds=gitleaks.repo_secrets");
    mockValidateApis();
    const start = vi
      .spyOn(api, "startCommunityValidation")
      .mockResolvedValue(started());

    render(<ValidationSnapshotFlow />);

    const pack = await screen.findByTestId("community-validation-suite");
    expect(pack).toHaveTextContent("1 engine start now");
    expect(pack).not.toHaveTextContent("38 engines start now");
    expect(pack).not.toHaveTextContent("AWS needed for Prowler");

    fireEvent.click(
      screen.getByRole("button", { name: "Preview policy decision" })
    );
    await screen.findByText(
      "Verified scope with a passive or non-invasive safety level is allowed."
    );
    fireEvent.click(screen.getByTestId("run-community-validation"));

    await waitFor(() => {
      expect(start).toHaveBeenCalledWith(
        expect.objectContaining({
          moduleIds: ["gitleaks.repo_secrets"],
          policyDecisionId,
          scopeId
        })
      );
    });
    expect(
      await screen.findByTestId("community-validation-started")
    ).toHaveTextContent("queued 1 job across 1 engine");
    expect(push).toHaveBeenCalledWith(communityMissionHref(missionId));
    expect(push).not.toHaveBeenCalledWith(expect.stringMatching(/findings/));
  });

  it("opens the mission Watch page after Community start instead of findings", async () => {
    stubSearch("?moduleIds=gitleaks.repo_secrets");
    mockValidateApis();
    vi.spyOn(api, "startCommunityValidation").mockResolvedValue(started());

    render(<ValidationSnapshotFlow />);

    await screen.findByTestId("community-validation-suite");
    fireEvent.click(
      screen.getByRole("button", { name: "Preview policy decision" })
    );
    await screen.findByText(
      "Verified scope with a passive or non-invasive safety level is allowed."
    );
    fireEvent.click(screen.getByTestId("run-community-validation"));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(`/missions/${missionId}`);
    });
    expect(push.mock.calls.flat().join(" ")).not.toMatch(/findings/i);
  });

  it("defaults unpinned Repository start to Gitleaks, not 38 engines", async () => {
    stubSearch("");
    mockValidateApis();
    const start = vi
      .spyOn(api, "startCommunityValidation")
      .mockResolvedValue(started());

    render(<ValidationSnapshotFlow />);

    const pack = await screen.findByTestId("community-validation-suite");
    expect(pack).toHaveTextContent("1 engine start now");
    expect(pack).not.toHaveTextContent("38 engines start now");
    expect(pack).not.toHaveTextContent("runner needed");
    expect(pack).not.toHaveTextContent("AWS needed for Prowler");

    fireEvent.click(
      screen.getByRole("button", { name: "Preview policy decision" })
    );
    await screen.findByText(
      "Verified scope with a passive or non-invasive safety level is allowed."
    );
    fireEvent.click(screen.getByTestId("run-community-validation"));

    await waitFor(() => {
      expect(start).toHaveBeenCalledWith(
        expect.objectContaining({
          moduleIds: ["gitleaks.repo_secrets"],
          policyDecisionId,
          scopeId
        })
      );
    });
    expect(
      await screen.findByTestId("community-validation-started")
    ).toHaveTextContent("queued 1 job across 1 engine");
  });

  it("keeps Run full Community pack as a second control that still starts 38", async () => {
    stubSearch("");
    mockValidateApis();
    const start = vi.spyOn(api, "startCommunityValidation").mockResolvedValue({
      ...started(),
      jobsQueued: 38,
      moduleIds: startable38
    });

    render(<ValidationSnapshotFlow />);

    const pack = await screen.findByTestId("community-validation-suite");
    expect(pack).toHaveTextContent("1 engine start now");

    const fullPack = await screen.findByTestId("run-full-community-pack");
    expect(fullPack).toHaveTextContent("Run full Community pack");
    expect(
      screen.getByTestId("full-community-pack-start-now")
    ).toHaveTextContent("38 engines start now");
    expect(
      screen.getByTestId("full-community-pack-start-now")
    ).toHaveTextContent("runner needed");

    fireEvent.click(
      screen.getByRole("button", { name: "Preview policy decision" })
    );
    await screen.findByText(
      "Verified scope with a passive or non-invasive safety level is allowed."
    );
    fireEvent.click(fullPack);

    await waitFor(() => {
      expect(start).toHaveBeenCalledWith(
        expect.objectContaining({
          policyDecisionId,
          scopeId
        })
      );
    });
    expect(start.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ moduleIds: startable38 })
    );
    expect(
      await screen.findByTestId("community-validation-started")
    ).toHaveTextContent("queued 38 jobs across 38 engines");
  });
});

describe("ValidationSnapshotFlow CloudAccount with zero startable engines", () => {
  afterEach(() => {
    push.mockClear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does not show a dead Run Community button; primary matches Connect AWS", async () => {
    const cloudScope = repoScope({
      assetClass: "Cloud",
      scopeType: "CloudAccount",
      value: "123456789012",
      verificationMethod: "operator_attestation"
    });
    vi.spyOn(api, "listScopes").mockResolvedValue([cloudScope]);
    vi.spyOn(api, "getCommunityValidationSuite").mockResolvedValue(
      suite({
        cloudAwsAvailable: false,
        deferredModules: [
          {
            moduleId: "prowler.aws_posture",
            reason: "Connect an AWS integration to start Prowler.",
            title: "Prowler AWS posture"
          },
          {
            moduleId: "cloudlist.cloud_assets",
            reason: "Enroll an internal runner to start this engine.",
            title: "cloudlist cloud assets"
          }
        ],
        modules: [
          {
            defaultSafetyLevel: "PassiveReadOnly",
            executionMode: "ControlPlane",
            moduleId: "prowler.aws_posture",
            requiredScopeTypes: ["CloudAccount"],
            targetKind: "hostname",
            title: "Prowler AWS posture",
            toolId: "prowler",
            toolLicense: "Apache-2.0"
          }
        ],
        runnerAvailable: false,
        scopeType: "CloudAccount",
        startableModuleIds: []
      })
    );
    vi.spyOn(api, "listMissions").mockResolvedValue([]);
    const start = vi.spyOn(api, "startCommunityValidation");

    render(<ValidationSnapshotFlow />);

    expect(
      await screen.findByTestId("community-nothing-startable")
    ).toHaveTextContent(/connect AWS/i);
    const connect = await screen.findByTestId("community-connect-aws");
    expect(connect).toHaveAttribute("href", "/integrations");
    expect(connect).toHaveTextContent(/^Connect AWS$/);
    expect(
      screen.queryByTestId("run-community-validation")
    ).not.toBeInTheDocument();
    expect(start).not.toHaveBeenCalled();
  });
});

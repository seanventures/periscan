import React from "react";
import { render } from "ink-testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ValidateScreen, type ValidateApi } from "./validate.js";

const VERIFIED_DOMAIN = {
  scopeId: "11111111-1111-4111-8111-111111111111",
  scopeType: "Domain",
  value: "lab.example.com",
  verificationStatus: "Verified" as const
};

const UNVERIFIED_DOMAIN = {
  scopeId: "22222222-2222-4222-8222-222222222222",
  scopeType: "Domain",
  value: "pending.example.com",
  verificationStatus: "Pending" as const
};

const VERIFIED_REPO = {
  scopeId: "33333333-3333-4333-8333-333333333333",
  scopeType: "Repository",
  value: "/opt/customer/repo",
  verificationStatus: "Verified" as const
};

const DOMAIN_STARTABLE = [
  "periscan.dns_resolution_check",
  "periscan.tls_certificate_check",
  "periscan.http_health_check"
];

const REPO_STARTABLE = ["gitleaks.repo_secrets", "trivy.repo_dependency_scan"];

const ALLOWED_POLICY = {
  approvalState: "NotRequired",
  outcome: "Allowed",
  policyDecisionId: "44444444-4444-4444-8444-444444444444",
  rationale: "Verified scope, non-invasive Community pack.",
  scopeId: VERIFIED_DOMAIN.scopeId
};

const DENIED_POLICY = {
  approvalState: "NotRequired",
  outcome: "Denied",
  policyDecisionId: "77777777-7777-4777-8777-777777777777",
  rationale: "Hostname is outside authorized Community scope.",
  scopeId: VERIFIED_DOMAIN.scopeId
};

const QUEUED_START = {
  jobsQueued: 3,
  mission: {
    missionId: "55555555-5555-4555-8555-555555555555",
    status: "Queued"
  },
  moduleIds: DOMAIN_STARTABLE,
  nucleiMissionId: "66666666-6666-4666-8666-666666666666",
  nucleiSkipReason: null
};

const DENIED_START = {
  jobsQueued: 0,
  mission: {
    missionId: "88888888-8888-4888-8888-888888888888",
    status: "DeniedByPolicy"
  },
  moduleIds: DOMAIN_STARTABLE,
  nucleiMissionId: null,
  nucleiSkipReason:
    "Nuclei External PoA was denied (kill switch, rate, or hostname guard). The rest of the Community pack still queued."
};

let screen: ReturnType<typeof render> | undefined;

afterEach(() => {
  screen?.unmount();
  screen = undefined;
});

const ANSI_COLOR = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "gu");

function visible(): string {
  return (screen?.lastFrame() ?? "").replace(ANSI_COLOR, "");
}

async function frameHas(text: string) {
  await vi.waitFor(() => {
    expect(visible()).toContain(text);
  });
}

function mockApi(overrides: Partial<ValidateApi> = {}): ValidateApi {
  const api: ValidateApi = {
    listScopes: vi.fn(async () => [
      UNVERIFIED_DOMAIN,
      VERIFIED_DOMAIN,
      VERIFIED_REPO
    ]),
    communitySuite: vi.fn(async (scopeId) => {
      if (scopeId === VERIFIED_REPO.scopeId) {
        return {
          cloudAwsAvailable: false,
          runnerAvailable: false,
          startableModuleIds: REPO_STARTABLE
        };
      }
      return {
        cloudAwsAvailable: false,
        runnerAvailable: false,
        startableModuleIds: DOMAIN_STARTABLE
      };
    }),
    previewPolicy: vi.fn(async (input) => ({
      ...ALLOWED_POLICY,
      scopeId: input.scopeId
    })),
    startCommunity: vi.fn(async () => QUEUED_START),
    ...overrides
  };
  return api;
}

function mount(api: ValidateApi) {
  screen = render(<ValidateScreen api={api} onStatus={vi.fn()} />);
  return api;
}

describe("ValidateScreen", () => {
  it("picks a verified scope and shows suite startableModuleIds", async () => {
    const api = mount(mockApi());

    await frameHas("lab.example.com");
    expect(visible()).not.toContain("pending.example.com");
    expect(visible()).toContain("periscan.dns_resolution_check");
    expect(visible()).toContain("periscan.tls_certificate_check");
    expect(visible()).toContain("periscan.http_health_check");
    expect(visible()).toContain("Nuclei is a second mission");
    expect(visible()).not.toContain("nuclei.external_exposure_safe");

    expect(api.communitySuite).toHaveBeenCalledWith(VERIFIED_DOMAIN.scopeId);
    const suiteIds = vi
      .mocked(api.communitySuite)
      .mock.calls.map((call) => call[0]);
    expect(suiteIds).not.toContain(UNVERIFIED_DOMAIN.scopeId);
  });

  it("moves to the next verified scope with j and reloads startableModuleIds", async () => {
    const api = mount(mockApi());
    await frameHas("lab.example.com");

    screen?.stdin.write("j");
    await frameHas("gitleaks.repo_secrets");
    expect(visible()).toContain("trivy.repo_dependency_scan");
    expect(visible()).not.toContain("periscan.dns_resolution_check");
    expect(api.communitySuite).toHaveBeenCalledWith(VERIFIED_REPO.scopeId);
  });

  it("previews policy for the Community start set, never ExternalPoA", async () => {
    const api = mount(mockApi());
    await frameHas("periscan.dns_resolution_check");

    screen?.stdin.write("p");
    await frameHas("Allowed");
    expect(visible()).toContain("Verified scope, non-invasive Community pack.");

    expect(api.previewPolicy).toHaveBeenCalledWith(
      expect.objectContaining({
        executionEnvironment: "ControlPlane",
        missionType: "ValidationSnapshot",
        safetyLevel: "ActiveNonInvasive",
        scopeId: VERIFIED_DOMAIN.scopeId,
        target: { value: "lab.example.com" }
      })
    );
    const preview = vi.mocked(api.previewPolicy).mock.calls[0]?.[0];
    expect(preview?.executionEnvironment).not.toBe("ExternalPoA");
  });

  it("displays policy Denied and never POSTs a Community run", async () => {
    const api = mount(
      mockApi({
        previewPolicy: vi.fn(async () => DENIED_POLICY)
      })
    );
    await frameHas("lab.example.com");

    screen?.stdin.write("p");
    await frameHas("Denied");
    expect(visible()).toContain("Denied never queues");

    screen?.stdin.write("r");
    await frameHas("Denied never queues");
    expect(api.startCommunity).not.toHaveBeenCalled();
  });

  it("shows jobsQueued honestly after HTTP 200 and labels Nuclei as a second mission", async () => {
    const api = mount(mockApi());
    await frameHas("lab.example.com");

    screen?.stdin.write("p");
    await frameHas("Allowed");
    screen?.stdin.write("r");
    await frameHas("jobsQueued 3");

    const frame = visible();
    expect(frame).toContain(
      "HTTP 200 is not jobs queued — read jobsQueued and mission.status."
    );
    expect(frame).toContain("Queued");
    expect(frame).toContain("55555555-5555-4555-8555-555555555555");
    expect(frame).toContain("Nuclei is a second mission");
    expect(frame).toContain("66666666-6666-4666-8666-666666666666");
    expect(api.startCommunity).toHaveBeenCalledWith({
      policyDecisionId: ALLOWED_POLICY.policyDecisionId,
      scopeId: VERIFIED_DOMAIN.scopeId
    });
  });

  it("treats jobsQueued 0 as never queued even when start returns", async () => {
    mount(
      mockApi({
        startCommunity: vi.fn(async () => DENIED_START)
      })
    );
    await frameHas("lab.example.com");

    screen?.stdin.write("p");
    await frameHas("Allowed");
    screen?.stdin.write("r");
    await frameHas("jobsQueued 0");

    const frame = visible();
    expect(frame).toContain(
      "HTTP 200 is not jobs queued — read jobsQueued and mission.status."
    );
    expect(frame).toContain("DeniedByPolicy");
    expect(frame).toContain("never queued");
    expect(frame).toContain("Nuclei is a second mission");
  });

  it("pins gitleaks.repo_secrets with g and passes moduleIds on start", async () => {
    const api = mount(mockApi());
    await frameHas("lab.example.com");
    screen?.stdin.write("j");
    await frameHas("gitleaks.repo_secrets");

    screen?.stdin.write("g");
    await frameHas("pinned gitleaks.repo_secrets");

    screen?.stdin.write("p");
    await frameHas("Allowed");
    screen?.stdin.write("r");
    await frameHas("jobsQueued");

    expect(api.startCommunity).toHaveBeenCalledWith({
      moduleIds: ["gitleaks.repo_secrets"],
      policyDecisionId: ALLOWED_POLICY.policyDecisionId,
      scopeId: VERIFIED_REPO.scopeId
    });
  });

  it("uses the first-hour Gitleaks set on unpinned Repository start", async () => {
    const api = mount(mockApi());
    await frameHas("lab.example.com");
    screen?.stdin.write("j");
    await frameHas("gitleaks.repo_secrets");
    expect(visible()).toContain("first-hour gitleaks.repo_secrets");
    expect(visible()).toContain("f full Community pack");

    screen?.stdin.write("p");
    await frameHas("Allowed");
    screen?.stdin.write("r");
    await frameHas("jobsQueued");

    expect(api.startCommunity).toHaveBeenCalledWith({
      moduleIds: ["gitleaks.repo_secrets"],
      policyDecisionId: ALLOWED_POLICY.policyDecisionId,
      scopeId: VERIFIED_REPO.scopeId
    });
  });

  it("starts the full Community pack with f sending startable moduleIds", async () => {
    const api = mount(mockApi());
    await frameHas("lab.example.com");
    screen?.stdin.write("j");
    await frameHas("gitleaks.repo_secrets");

    screen?.stdin.write("p");
    await frameHas("Allowed");
    screen?.stdin.write("f");
    await frameHas("jobsQueued");

    expect(api.startCommunity).toHaveBeenCalledWith({
      moduleIds: REPO_STARTABLE,
      policyDecisionId: ALLOWED_POLICY.policyDecisionId,
      scopeId: VERIFIED_REPO.scopeId
    });
  });

  it("asks for a verified scope instead of starting when none exist", async () => {
    const api = mount(
      mockApi({
        listScopes: vi.fn(async () => [UNVERIFIED_DOMAIN])
      })
    );
    await frameHas("No verified scope");
    expect(visible()).not.toContain("pending.example.com");
    expect(api.communitySuite).not.toHaveBeenCalled();
    expect(api.startCommunity).not.toHaveBeenCalled();
  });
});

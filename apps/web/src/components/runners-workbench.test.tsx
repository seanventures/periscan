import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isRunnerStale,
  RUNNER_STALE_AFTER_MS,
  RunnersWorkbench,
  taskStatusTone
} from "./runners-workbench";

function createJsonResponse(
  payload: unknown,
  init?: { ok?: boolean; status?: number }
) {
  return {
    json: async () => payload,
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    text: async () => JSON.stringify(payload)
  };
}

const TIMESTAMP = "2026-06-01T00:00:00.000Z";
const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const RUNNER_ID = "44444444-4444-4444-8444-444444444444";

function createAuthPayload() {
  return {
    membership: {
      createdAt: TIMESTAMP,
      membershipId: "22222222-2222-4222-8222-222222222222",
      role: "Owner",
      tenantId: TENANT_ID,
      updatedAt: TIMESTAMP,
      userId: USER_ID
    },
    tenant: {
      billingAccountId: null,
      createdAt: TIMESTAMP,
      dataRegion: "us-east-1",
      name: "Demo Tenant",
      parentTenantId: null,
      tenantId: TENANT_ID,
      type: "Organization",
      updatedAt: TIMESTAMP
    },
    user: {
      createdAt: TIMESTAMP,
      email: "demo@periscan.local",
      name: "Demo User",
      status: "Active",
      updatedAt: TIMESTAMP,
      userId: USER_ID
    }
  };
}

function createRunner() {
  return {
    arch: "amd64",
    certificateExpiresAt: TIMESTAMP,
    createdAt: TIMESTAMP,
    createdBy: USER_ID,
    deploymentMode: "Docker",
    hostname: "runner.corp.internal",
    killSwitchActivatedAt: null,
    killSwitchActivatedBy: null,
    killSwitchActive: false,
    killSwitchAcknowledgedAt: null,
    killSwitchReason: null,
    labels: ["primary"],
    lastSeenAt: TIMESTAMP,
    name: "Production Runner",
    networkProfile: {
      dnsResolutionRequired: true,
      gatewayHostnames: ["runner.periscan.cloud"],
      httpConnectProxySupported: true,
      outboundHttpsPorts: [443]
    },
    os: "linux",
    revokedAt: null,
    revocationAcknowledgedAt: null,
    runnerId: RUNNER_ID,
    status: "Active",
    tenantId: TENANT_ID,
    transportMode: "LongPollHttps",
    updatedAt: TIMESTAMP,
    version: "0.1.0"
  };
}

describe("taskStatusTone", () => {
  it("treats a completed task as success and in-progress states (incl. Accepted) as warning", () => {
    expect(taskStatusTone("Completed")).toBe("success");
    // Accepted = runner acknowledged, result not in yet → in-progress, not done.
    expect(taskStatusTone("Accepted")).toBe("warning");
    expect(taskStatusTone("Accepted")).not.toBe("success");
    expect(taskStatusTone("Running")).toBe("warning");
    expect(taskStatusTone("Failed")).toBe("danger");
    expect(taskStatusTone("Expired")).toBe("danger");
  });
});

describe("isRunnerStale", () => {
  it("flags a runner unseen longer than the threshold and not otherwise", () => {
    const now = Date.parse("2026-06-16T12:00:00.000Z");
    const justSeen = "2026-06-16T11:59:00.000Z"; // 1 min ago
    const longGone = "2026-06-16T11:00:00.000Z"; // 60 min ago

    expect(isRunnerStale(longGone, now)).toBe(true);
    expect(isRunnerStale(justSeen, now)).toBe(false);
    // Exactly at the threshold is not yet stale (strictly greater-than).
    expect(
      isRunnerStale(new Date(now - RUNNER_STALE_AFTER_MS).toISOString(), now)
    ).toBe(false);
    // No signal yet (never seen) is not treated as stale.
    expect(isRunnerStale(null, now)).toBe(false);
    expect(isRunnerStale("not-a-date", now)).toBe(false);
  });
});

describe("RunnersWorkbench", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prompts unauthenticated visitors to sign in", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string) => {
        if (input === "/api/v1/me") {
          return Promise.resolve(
            createJsonResponse(
              { error: "Authentication required" },
              { ok: false, status: 401 }
            )
          );
        }
        return Promise.resolve(createJsonResponse({ items: [] }));
      }) as unknown as typeof fetch
    );

    render(<RunnersWorkbench />);

    await waitFor(() => {
      expect(screen.getByText("Sign in to manage runners")).toBeInTheDocument();
    });
  });

  it("renders an authenticated empty state without fabricated data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string) => {
        if (input === "/api/v1/me") {
          return Promise.resolve(createJsonResponse(createAuthPayload()));
        }
        return Promise.resolve(createJsonResponse({ items: [] }));
      }) as unknown as typeof fetch
    );

    render(<RunnersWorkbench />);

    await waitFor(() => {
      expect(
        screen.getByText("No internal runners are registered.")
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Deploy a runner")).toBeInTheDocument();
  });

  it("lists registered runners with their status and trust copy", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string) => {
        if (input === "/api/v1/me") {
          return Promise.resolve(createJsonResponse(createAuthPayload()));
        }
        if (input === "/api/v1/runners") {
          return Promise.resolve(
            createJsonResponse({ items: [createRunner()] })
          );
        }
        return Promise.resolve(createJsonResponse({ items: [] }));
      }) as unknown as typeof fetch
    );

    render(<RunnersWorkbench />);

    await waitFor(() => {
      expect(screen.getByText("Production Runner")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("status", {
        name: "Runner Production Runner status: Active"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Outbound-only. No inbound firewall rule, no reverse SSH, no tunnel."
      )
    ).toBeInTheDocument();
    // Certificate expiry is surfaced so operators can plan re-enrollment before
    // the mTLS cert lapses and the runner can no longer authenticate.
    expect(screen.getByText(/Cert expires/)).toBeInTheDocument();
  });

  it("surfaces a halted runner's kill-switch state on the list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string) => {
        if (input === "/api/v1/me") {
          return Promise.resolve(createJsonResponse(createAuthPayload()));
        }
        if (input === "/api/v1/runners") {
          return Promise.resolve(
            createJsonResponse({
              items: [
                {
                  ...createRunner(),
                  killSwitchActivatedAt: TIMESTAMP,
                  killSwitchActive: true,
                  killSwitchReason: "Out-of-scope target detected"
                }
              ]
            })
          );
        }
        return Promise.resolve(createJsonResponse({ items: [] }));
      }) as unknown as typeof fetch
    );

    render(<RunnersWorkbench />);

    await waitFor(() => {
      expect(screen.getByText("Production Runner")).toBeInTheDocument();
    });
    expect(
      screen.getByLabelText("Runner Production Runner kill switch: active")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Halted: Out-of-scope target detected")
    ).toBeInTheDocument();
    expect(screen.getByText("Host ack pending")).toBeInTheDocument();
  });

  it("distinguishes server enforcement from host-confirmed kill-switch receipt", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string) => {
        if (input === "/api/v1/me") {
          return Promise.resolve(createJsonResponse(createAuthPayload()));
        }
        if (input === "/api/v1/runners") {
          return Promise.resolve(
            createJsonResponse({
              items: [
                {
                  ...createRunner(),
                  killSwitchAcknowledgedAt: TIMESTAMP,
                  killSwitchActivatedAt: TIMESTAMP,
                  killSwitchActive: true,
                  killSwitchReason: "Incident containment"
                }
              ]
            })
          );
        }
        return Promise.resolve(createJsonResponse({ items: [] }));
      }) as unknown as typeof fetch
    );

    render(<RunnersWorkbench />);

    expect(await screen.findByText("Host confirmed")).toBeInTheDocument();
    expect(screen.queryByText("Host ack pending")).not.toBeInTheDocument();
  });

  it("does not show a kill-switch badge for an active runner", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string) => {
        if (input === "/api/v1/me") {
          return Promise.resolve(createJsonResponse(createAuthPayload()));
        }
        if (input === "/api/v1/runners") {
          return Promise.resolve(
            createJsonResponse({ items: [createRunner()] })
          );
        }
        return Promise.resolve(createJsonResponse({ items: [] }));
      }) as unknown as typeof fetch
    );

    render(<RunnersWorkbench />);

    await waitFor(() => {
      expect(screen.getByText("Production Runner")).toBeInTheDocument();
    });
    expect(
      screen.queryByLabelText("Runner Production Runner kill switch: active")
    ).not.toBeInTheDocument();
  });

  it("flags an active runner that has gone silent as Stale, and a recent one not", async () => {
    const staleRunner = {
      ...createRunner(),
      lastSeenAt: "2020-01-01T00:00:00.000Z", // far in the past → stale
      name: "Silent Runner",
      runnerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      status: "Active"
    };
    const freshRunner = {
      ...createRunner(),
      lastSeenAt: new Date().toISOString(), // just polled → not stale
      name: "Live Runner",
      runnerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      status: "Active"
    };

    vi.stubGlobal(
      "fetch",
      vi.fn((input: string) => {
        if (input === "/api/v1/me") {
          return Promise.resolve(createJsonResponse(createAuthPayload()));
        }
        if (input === "/api/v1/runners") {
          return Promise.resolve(
            createJsonResponse({ items: [staleRunner, freshRunner] })
          );
        }
        return Promise.resolve(createJsonResponse({ items: [] }));
      }) as unknown as typeof fetch
    );

    render(<RunnersWorkbench />);

    await waitFor(() => {
      expect(screen.getByText("Silent Runner")).toBeInTheDocument();
    });
    // The silent runner is flagged stale; the just-polled one is not.
    expect(
      screen.getByLabelText("Runner Silent Runner connectivity: stale")
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Runner Live Runner connectivity: stale")
    ).not.toBeInTheDocument();
  });

  it("surfaces runner transport decisions from the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string) => {
        if (input === "/api/v1/me") {
          return Promise.resolve(createJsonResponse(createAuthPayload()));
        }
        if (input === "/api/v1/runners/transport-decisions") {
          return Promise.resolve(
            createJsonResponse({
              items: [
                {
                  channel: "LongPollHttps",
                  notes: ["Outbound only."],
                  reason: "Default outbound-only control channel.",
                  status: "Primary"
                },
                {
                  channel: "ReverseSsh",
                  notes: [],
                  reason: "Inbound tunnels are not permitted.",
                  status: "Disallowed"
                }
              ]
            })
          );
        }
        return Promise.resolve(createJsonResponse({ items: [] }));
      }) as unknown as typeof fetch
    );

    render(<RunnersWorkbench />);

    await waitFor(() => {
      expect(screen.getByText("Transport decisions")).toBeInTheDocument();
    });

    expect(
      screen.getByRole("status", {
        name: "Transport decision for LongPollHttps: Primary"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Transport decision for ReverseSsh: Disallowed"
      })
    ).toBeInTheDocument();

    const channelFigure = screen.getByRole("figure", {
      name: "Runner control channels by transport decision"
    });
    expect(
      within(channelFigure).getByRole("rowheader", { name: "Primary" })
    ).toBeInTheDocument();
  });

  it("dispatches a measured check from the runner detail launch form", async () => {
    const scopeId = "55555555-5555-4555-8555-555555555555";
    const taskId = "66666666-6666-4666-8666-666666666666";
    const verifiedScope = {
      createdAt: TIMESTAMP,
      scopeId,
      scopeType: "InternalNetwork",
      tenantId: TENANT_ID,
      updatedAt: TIMESTAMP,
      value: "corp.internal",
      verificationStatus: "Verified"
    };
    const scopeConstraints = {
      approvedCidrs: [],
      approvedDnsSuffixes: [],
      approvedHostnames: ["gateway-01.corp.internal"],
      approvedPorts: [443],
      forbidInternetEgress: false
    };
    const envelope = {
      artifactUpload: {
        artifactUploadUrl: "https://cp.periscan.test/artifacts",
        maxArtifactBytes: 1000000,
        resultCallbackUrl: "https://cp.periscan.test/result"
      },
      executionEnvironment: "InternalRunner",
      expiresAt: TIMESTAMP,
      inputs: { port: 443 },
      issuedAt: TIMESTAMP,
      missionId: "77777777-7777-4777-8777-777777777777",
      moduleId: "periscan.tls_protocol_audit",
      runId: "88888888-8888-4888-8888-888888888888",
      runnerId: RUNNER_ID,
      safetyLevel: "ActiveNonInvasive",
      scopeConstraints,
      scopeId,
      signature: {
        algorithm: "EdDSA",
        digestSha256: "digest",
        keyId: "key-1",
        nonce: "nonce-1",
        signature: "sig-1"
      },
      target: { hostname: "gateway-01.corp.internal" },
      taskId,
      tenantId: TENANT_ID
    };
    const dispatchedTask = {
      createdAt: TIMESTAMP,
      envelope,
      expiresAt: TIMESTAMP,
      inputs: { port: 443 },
      issuedAt: TIMESTAMP,
      missionId: envelope.missionId,
      moduleId: "periscan.tls_protocol_audit",
      redactedEvidenceIds: [],
      runId: envelope.runId,
      runnerId: RUNNER_ID,
      safetyLevel: "ActiveNonInvasive",
      scopeConstraints,
      scopeId,
      status: "Queued",
      target: { hostname: "gateway-01.corp.internal" },
      taskId,
      taskType: "periscan.tls_protocol_audit",
      tenantId: TENANT_ID,
      updatedAt: TIMESTAMP
    };

    const fetchImpl = vi.fn(
      (input: string, init?: { body?: string; method?: string }) => {
        if (input === "/api/v1/me") {
          return Promise.resolve(createJsonResponse(createAuthPayload()));
        }
        if (
          input === `/api/v1/runners/${RUNNER_ID}/tasks/measured` &&
          init?.method === "POST"
        ) {
          const request = JSON.parse(init.body ?? "{}") as {
            markerId?: string;
            moduleId: string;
            platform?: string;
          };
          return Promise.resolve(
            createJsonResponse({
              task: {
                ...dispatchedTask,
                envelope: {
                  ...dispatchedTask.envelope,
                  inputs: {
                    markerId: request.markerId,
                    platform: request.platform
                  },
                  moduleId: request.moduleId
                },
                inputs: {
                  markerId: request.markerId,
                  platform: request.platform
                },
                moduleId: request.moduleId,
                taskType: request.moduleId
              }
            })
          );
        }
        if (
          input === `/api/v1/runners/${RUNNER_ID}/tasks/discover` &&
          init?.method === "POST"
        ) {
          return Promise.resolve(
            createJsonResponse({
              task: {
                ...dispatchedTask,
                moduleId: "recon.host_discovery",
                taskType: "recon.host_discovery"
              }
            })
          );
        }
        if (input === `/api/v1/runners/${RUNNER_ID}/tasks`) {
          return Promise.resolve(
            createJsonResponse({
              items: [
                {
                  ...dispatchedTask,
                  result: {
                    outcome: "tls_deprecated_protocol",
                    validationState: "Validated"
                  },
                  status: "Completed"
                }
              ]
            })
          );
        }
        if (input === `/api/v1/runners/${RUNNER_ID}`) {
          return Promise.resolve(createJsonResponse(createRunner()));
        }
        if (input === "/api/v1/runners") {
          return Promise.resolve(
            createJsonResponse({ items: [createRunner()] })
          );
        }
        if (input === "/api/v1/scopes") {
          return Promise.resolve(
            createJsonResponse({ items: [verifiedScope] })
          );
        }
        return Promise.resolve(createJsonResponse({ items: [] }));
      }
    );
    vi.stubGlobal("fetch", fetchImpl as unknown as typeof fetch);

    render(<RunnersWorkbench />);

    await waitFor(() => {
      expect(screen.getByText("Production Runner")).toBeInTheDocument();
    });

    // Open the runner detail panel.
    fireEvent.click(screen.getByText("Production Runner"));
    await waitFor(() => {
      expect(
        screen.getByRole("status", {
          name: "Runner Production Runner detail status: Active"
        })
      ).toBeInTheDocument();
    });

    // A completed task surfaces its measured outcome/validationState.
    expect(
      screen.getByLabelText("Measured result for periscan.tls_protocol_audit")
    ).toHaveTextContent("tls_deprecated_protocol");

    // Select the governed endpoint stimulus. It exposes platform/marker fields
    // and removes the network port because the action is local to the runner.
    fireEvent.change(screen.getByLabelText("Measured module"), {
      target: { value: "periscan.endpoint_benign_marker_emit" }
    });
    expect(screen.queryByLabelText("Target port")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Endpoint platform"), {
      target: { value: "Linux" }
    });
    fireEvent.change(screen.getByLabelText("Endpoint marker"), {
      target: { value: "periscan-endpoint-ui-42" }
    });
    fireEvent.change(screen.getByLabelText("Verified scope"), {
      target: { value: scopeId }
    });
    fireEvent.change(screen.getByLabelText("Target host"), {
      target: { value: "gateway-01.corp.internal" }
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Dispatch measured check" })
    );

    await waitFor(() => {
      expect(
        screen.getByRole("status", {
          name: "Dispatched measured task: periscan.endpoint_benign_marker_emit"
        })
      ).toBeInTheDocument();
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      `/api/v1/runners/${RUNNER_ID}/tasks/measured`,
      expect.objectContaining({ method: "POST" })
    );
    const measuredRequest = fetchImpl.mock.calls.find(
      ([url]) => url === `/api/v1/runners/${RUNNER_ID}/tasks/measured`
    );
    expect(JSON.parse(measuredRequest?.[1]?.body ?? "{}")).toMatchObject({
      markerId: "periscan-endpoint-ui-42",
      moduleId: "periscan.endpoint_benign_marker_emit",
      platform: "Linux",
      scopeId,
      targetHost: "gateway-01.corp.internal"
    });

    // Dispatch an in-network discovery scan from the same detail panel.
    fireEvent.change(screen.getByLabelText("Discovery scope"), {
      target: { value: scopeId }
    });
    fireEvent.change(screen.getByLabelText("Discovery target"), {
      target: { value: "10.0.0.0/24" }
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Dispatch discovery scan" })
    );

    await waitFor(() => {
      expect(
        screen.getByRole("status", {
          name: "Dispatched discovery task: recon.host_discovery"
        })
      ).toBeInTheDocument();
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      `/api/v1/runners/${RUNNER_ID}/tasks/discover`,
      expect.objectContaining({ method: "POST" })
    );
  });
});

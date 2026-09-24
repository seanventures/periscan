import {
  createHash,
  generateKeyPairSync,
  sign as cryptoSign
} from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { BOUND_RUNNER_SIEM_MODULE_ID } from "@periscan/connectors/bound-runner-siem";
import { EnterpriseSiteSchema } from "@periscan/shared";

import { stringifyCanonicalJson } from "./canonical.js";
import {
  DEFAULT_ALLOWLISTED_MODULE_IDS,
  type RunnerAgentConfig
} from "./config.js";
import { processTask } from "./dispatch.js";
import { pollOnce } from "./poll.js";
import {
  planSiemSignedTaskDispatch,
  type SiemSignedTaskDispatchInput
} from "./siem-signed-task-dispatch.js";
import type { TaskEnvelope } from "./types.js";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const SIGNING_PUBLIC_KEY_PEM = publicKey
  .export({ format: "pem", type: "spki" })
  .toString();
const SIGNING_KEY_ID = "test-signing-key";
const RUNNER_ID = "33333333-3333-4333-8333-333333333333";
const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const INTEGRATION_ID = "22222222-2222-4222-8222-222222222222";
const SITE_ID = "44444444-4444-4444-8444-444444444444";
const MISSION_ID = "55555555-5555-4555-8555-555555555555";
const RUN_ID = "66666666-6666-4666-8666-666666666666";
const SCOPE_ID = "77777777-7777-4777-8777-777777777777";
const TASK_ID = "88888888-8888-4888-8888-888888888888";
const SPLUNK_TOKEN = "splunk-secret-api-token";
const ON_PREM_SPLUNK = "https://10.8.1.20:8089";
const CLOUD_SPLUNK = "https://splunk.example.com:8089";
const ON_PREM_ELASTIC = "https://10.8.2.15:9200";

type FetchArgs = [input: string | URL | Request, init?: RequestInit];

function chicagoDc(overrides?: Record<string, unknown>) {
  return EnterpriseSiteSchema.parse({
    adDomains: ["corp.contoso.local"],
    cidrs: ["10.8.0.0/16"],
    name: "Chicago DC",
    runnerIds: [RUNNER_ID],
    siteId: SITE_ID,
    ...overrides
  });
}

function inScopeConstraints(ports: number[] = [8089, 9200]) {
  return {
    approvedCidrs: ["10.8.0.0/16"],
    approvedDnsSuffixes: [] as string[],
    approvedHostnames: ["10.8.1.20", "10.8.2.15"],
    approvedPorts: ports,
    forbidInternetEgress: true
  };
}

function unscopedConstraints() {
  return {
    approvedCidrs: ["192.168.0.0/16"],
    approvedDnsSuffixes: [] as string[],
    approvedHostnames: [] as string[],
    approvedPorts: [8089],
    forbidInternetEgress: true
  };
}

function splunkContext(baseUrl: string) {
  return {
    authType: "apiToken",
    config: {
      baseUrl,
      connectorKey: "splunk",
      earliestTime: "-48h",
      index: "main",
      latestTime: "now",
      techniqueId: "T1059",
      token: SPLUNK_TOKEN
    },
    integrationId: INTEGRATION_ID,
    mockMode: false,
    tenantId: TENANT_ID
  };
}

function planInput(
  overrides: Partial<SiemSignedTaskDispatchInput> = {}
): SiemSignedTaskDispatchInput {
  return {
    connectorKey: "splunk",
    context: splunkContext(ON_PREM_SPLUNK),
    missionId: MISSION_ID,
    now: () => new Date("2026-09-18T12:00:00.000Z"),
    policyDecision: "Allow",
    runId: RUN_ID,
    runnerId: RUNNER_ID,
    scopeConstraints: inScopeConstraints(),
    scopeId: SCOPE_ID,
    sites: [chicagoDc()],
    taskId: TASK_ID,
    ...overrides
  };
}

function baseConfig(
  overrides: Partial<RunnerAgentConfig> = {}
): RunnerAgentConfig {
  return {
    allowedSafetyLevels: new Set(["PassiveReadOnly", "ActiveNonInvasive"]),
    allowlistedModuleIds: new Set([
      ...DEFAULT_ALLOWLISTED_MODULE_IDS,
      BOUND_RUNNER_SIEM_MODULE_ID
    ]),
    authToken: "runner-token",
    certificateExpiresAt: "2027-01-01T00:00:00.000Z",
    controlPlaneUrl: "https://control.periscan.test",
    killSwitch: false,
    pollIntervalSeconds: 30,
    proxyUrl: null,
    resultSigningPrivateKeyPem: null,
    runnerId: RUNNER_ID,
    signingKeyId: SIGNING_KEY_ID,
    signingPublicKeyPem: SIGNING_PUBLIC_KEY_PEM,
    tenantId: TENANT_ID,
    version: "0.1.0",
    ...overrides
  };
}

function signEnvelope(unsigned: Record<string, unknown>): TaskEnvelope {
  const canonical = stringifyCanonicalJson(unsigned);
  const digestSha256 = createHash("sha256")
    .update(canonical, "utf8")
    .digest("hex");
  const signature = cryptoSign(
    null,
    Buffer.from(canonical, "utf8"),
    privateKey
  ).toString("base64url");
  return {
    ...unsigned,
    signature: {
      algorithm: "EdDSA",
      digestSha256,
      keyId: SIGNING_KEY_ID,
      nonce: unsigned.taskId as string,
      signature
    }
  } as TaskEnvelope;
}

function siemTask(overrides: Record<string, unknown> = {}) {
  const taskId =
    (overrides.taskId as string) ?? "88888888-8888-4888-8888-888888888888";
  return {
    executionEnvironment: "InternalRunner",
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    inputs: {
      authType: "apiToken",
      config: {
        baseUrl: ON_PREM_SPLUNK,
        connectorKey: "splunk",
        earliestTime: "-48h",
        index: "main",
        latestTime: "now",
        techniqueId: "T1059",
        token: SPLUNK_TOKEN
      },
      connectorKey: "splunk",
      executionLocation: "BoundRunner",
      integrationId: INTEGRATION_ID,
      mockMode: false,
      siteId: SITE_ID
    },
    issuedAt: new Date().toISOString(),
    missionId: MISSION_ID,
    moduleId: BOUND_RUNNER_SIEM_MODULE_ID,
    runId: RUN_ID,
    runnerId: RUNNER_ID,
    safetyLevel: "PassiveReadOnly",
    scopeConstraints: inScopeConstraints(),
    scopeId: SCOPE_ID,
    target: { targetHost: "10.8.1.20", targetUrl: ON_PREM_SPLUNK },
    taskId,
    tenantId: TENANT_ID,
    ...overrides
  };
}

function splunkNotableExport() {
  const rows = [
    JSON.stringify({
      preview: false,
      result: {
        _raw: "2026-06-08 periscan validation event technique=T1059 host=fin-workstation-07",
        _time: "2026-06-08T12:00:00.000+00:00",
        "annotations.mitre_attack": ["T1059"],
        host: "fin-workstation-07",
        signature: "Suspicious PowerShell execution",
        src_ip: "10.4.2.7"
      }
    })
  ].join("\n");

  return new Response(rows, {
    headers: { "content-type": "application/json" },
    status: 200
  });
}

describe("planSiemSignedTaskDispatch", () => {
  it("refuses a denied policy with no queued task", () => {
    const plan = planSiemSignedTaskDispatch(
      planInput({ policyDecision: "Deny" })
    );

    expect(plan.action).toBe("refuse");
    expect(plan.code).toBe("denied_by_policy");
    expect(plan.task).toBeNull();
    expect(plan.rationale).toMatch(/denied/i);
  });

  it("refuses an unscoped RFC1918 SIEM host with no queued task", () => {
    const plan = planSiemSignedTaskDispatch(
      planInput({ scopeConstraints: unscopedConstraints() })
    );

    expect(plan.action).toBe("refuse");
    expect(plan.code).toBe("unscoped");
    expect(plan.task).toBeNull();
    expect(plan.rationale).toMatch(/scope/i);
  });

  it("queues an InternalRunner SIEM task for in-scope RFC1918 Splunk without fetching", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("planner must not fetch");
    });
    vi.stubGlobal("fetch", fetchMock);

    const plan = planSiemSignedTaskDispatch(planInput());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(plan.action).toBe("queue-bound-runner-task");
    expect(plan.task).toEqual(
      expect.objectContaining({
        executionEnvironment: "InternalRunner",
        moduleId: BOUND_RUNNER_SIEM_MODULE_ID,
        runnerId: RUNNER_ID,
        safetyLevel: "PassiveReadOnly",
        taskId: TASK_ID,
        tenantId: TENANT_ID
      })
    );
    expect(plan.task?.scopeConstraints).toEqual(inScopeConstraints());
    expect(plan.task?.target).toEqual({
      targetHost: "10.8.1.20",
      targetUrl: ON_PREM_SPLUNK
    });
    expect(plan.task?.inputs.executionLocation).toBe("BoundRunner");
  });

  it("does not queue internet-reachable Splunk; that stays control-plane sync", () => {
    const plan = planSiemSignedTaskDispatch(
      planInput({
        context: splunkContext(CLOUD_SPLUNK),
        scopeConstraints: {
          approvedCidrs: [],
          approvedDnsSuffixes: ["example.com"],
          approvedHostnames: ["splunk.example.com"],
          approvedPorts: [8089],
          forbidInternetEgress: false
        }
      })
    );

    expect(plan.action).toBe("control-plane-sync");
    expect(plan.task).toBeNull();
  });

  it("refuses on-prem SIEM when no site-bound runner exists", () => {
    const plan = planSiemSignedTaskDispatch(
      planInput({
        runnerId: null,
        sites: [chicagoDc({ runnerIds: [] })]
      })
    );

    expect(plan.action).toBe("refuse");
    expect(plan.code).toBe("no_bound_runner");
    expect(plan.task).toBeNull();
  });
});

describe("runner-agent signed SIEM task execution", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("executes a signed in-scope Splunk sync from inside the bound runner", async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request) =>
      splunkNotableExport()
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await processTask(signEnvelope(siemTask()), baseConfig());

    expect(result.status).toBe("Completed");
    expect(result.outcome).toBe("synced");
    const [onPremUrl] = fetchMock.mock.calls[0] as FetchArgs;
    expect(String(onPremUrl)).toBe(
      `${ON_PREM_SPLUNK}/services/search/jobs/export`
    );
    expect(JSON.stringify(result)).not.toContain(SPLUNK_TOKEN);
  }, 20_000);

  it("never fetches an unscoped RFC1918 SIEM host even when the envelope is signed", async () => {
    const fetchMock = vi.fn(async () => splunkNotableExport());
    vi.stubGlobal("fetch", fetchMock);

    const result = await processTask(
      signEnvelope(
        siemTask({
          scopeConstraints: unscopedConstraints()
        })
      ),
      baseConfig()
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.status).toBe("Failed");
    expect(result.errorSummary).toMatch(/scope/i);
    expect(result.signals).toEqual([]);
  });

  it("never fetches SIEM when the local kill switch is set", async () => {
    const fetchImpl = vi.fn();
    const outcome = await pollOnce(baseConfig({ killSwitch: true }), {
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(outcome.skippedForKillSwitch).toBe(true);
  });

  it("polls outbound HTTPS for a signed SIEM task and never opens inbound transport", async () => {
    const task = signEnvelope(siemTask());
    const siemFetch = vi.fn(async (input: string | URL | Request) => {
      if (String(input).includes("10.8.1.20")) {
        return splunkNotableExport();
      }
      throw new Error(`unexpected fetch ${String(input)}`);
    });
    vi.stubGlobal("fetch", siemFetch);

    const calls: string[] = [];
    const fetchImpl = vi.fn(
      async (url: string | URL | Request, init?: RequestInit) => {
        calls.push(`${init?.method ?? "GET"} ${String(url)}`);
        if (String(url).endsWith("/poll")) {
          expect(String(url)).toBe(
            `https://control.periscan.test/api/v1/runners/${RUNNER_ID}/poll`
          );
          expect(init?.method).toBe("POST");
          return new Response(
            JSON.stringify({
              killSwitchActive: false,
              nextPollAfterSeconds: 20,
              tasks: [task]
            }),
            { status: 200 }
          );
        }
        if (String(url).includes(`/tasks/${task.taskId}/artifacts`)) {
          return new Response(
            JSON.stringify({
              artifact: {
                evidenceId: "99999999-9999-4999-8999-999999999999",
                redactionStatus: "Redacted",
                sha256: "artifact-sha"
              }
            }),
            { status: 201 }
          );
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
    );

    const outcome = await pollOnce(baseConfig(), {
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    expect(outcome.skippedForKillSwitch).toBe(false);
    expect(outcome.submitted).toHaveLength(1);
    expect(outcome.submitted[0]!.status).toBe("Completed");
    expect(outcome.submitted[0]!.outcome).toBe("synced");
    expect(calls[0]).toMatch(/^POST https:\/\/control\.periscan\.test\//u);
    expect(calls.some((call) => call.includes("/result"))).toBe(true);
    expect(
      siemFetch.mock.calls.some((call) => String(call[0]).includes("10.8.1.20"))
    ).toBe(true);
    expect(JSON.stringify(outcome.submitted[0])).not.toContain(SPLUNK_TOKEN);
  });

  it("maps signed Elastic 401 on a site CIDR host to degraded empty findings", async () => {
    const fetchMock = vi.fn(
      async () => new Response("unauthorized", { status: 401 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await processTask(
      signEnvelope(
        siemTask({
          inputs: {
            authType: "apiToken",
            config: {
              apiKey: "elastic-secret-key",
              baseUrl: ON_PREM_ELASTIC,
              connectorKey: "elastic-security"
            },
            connectorKey: "elastic-security",
            executionLocation: "BoundRunner",
            integrationId: INTEGRATION_ID,
            mockMode: false,
            siteId: SITE_ID
          },
          target: { targetHost: "10.8.2.15", targetUrl: ON_PREM_ELASTIC }
        })
      ),
      baseConfig()
    );

    expect(result.status).toBe("Completed");
    expect(result.outcome).toBe("degraded");
    expect(result.signals).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("elastic-secret-key");
  });
});

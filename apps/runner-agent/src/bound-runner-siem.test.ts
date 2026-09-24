import {
  createHash,
  generateKeyPairSync,
  sign as cryptoSign
} from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { BOUND_RUNNER_SIEM_MODULE_ID } from "@periscan/connectors/bound-runner-siem";

import { stringifyCanonicalJson } from "./canonical.js";
import {
  DEFAULT_ALLOWLISTED_MODULE_IDS,
  type RunnerAgentConfig
} from "./config.js";
import { processTask } from "./dispatch.js";
import type { TaskEnvelope } from "./types.js";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const SIGNING_PUBLIC_KEY_PEM = publicKey
  .export({ format: "pem", type: "spki" })
  .toString();
const SIGNING_KEY_ID = "test-signing-key";
const RUNNER_ID = "33333333-3333-4333-8333-333333333333";
const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const INTEGRATION_ID = "22222222-2222-4222-8222-222222222222";
const SPLUNK_TOKEN = "splunk-secret-api-token";
const ELASTIC_KEY = "elastic-secret-key";
const ON_PREM_SPLUNK = "https://10.8.1.20:8089";
const ON_PREM_ELASTIC = "https://10.8.2.15:9200";

type FetchArgs = [input: string | URL | Request, init?: RequestInit];

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
      siteId: "44444444-4444-4444-8444-444444444444"
    },
    issuedAt: new Date().toISOString(),
    missionId: "55555555-5555-4555-8555-555555555555",
    moduleId: BOUND_RUNNER_SIEM_MODULE_ID,
    runId: "66666666-6666-4666-8666-666666666666",
    runnerId: RUNNER_ID,
    safetyLevel: "PassiveReadOnly",
    scopeConstraints: {
      approvedCidrs: ["10.8.0.0/16"],
      approvedDnsSuffixes: [],
      approvedHostnames: ["10.8.1.20", "10.8.2.15"],
      approvedPorts: [8089, 9200],
      forbidInternetEgress: true
    },
    scopeId: "77777777-7777-4777-8777-777777777777",
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

describe("runner-agent BoundRunner SIEM sync", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("allowlists connector.siem.sync as a PassiveReadOnly in-network module", () => {
    expect(DEFAULT_ALLOWLISTED_MODULE_IDS).toContain(
      BOUND_RUNNER_SIEM_MODULE_ID
    );
  });

  it("executes a signed Splunk sync task against RFC1918 from inside the runner", async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request) =>
      splunkNotableExport()
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await processTask(signEnvelope(siemTask()), baseConfig());

    expect(result.status).toBe("Completed");
    expect(result.outcome).toBe("synced");
    expect(
      result.signals.some(
        (signal) =>
          (signal as Record<string, unknown>).sourceType === "splunk.detection"
      )
    ).toBe(true);
    const [onPremUrl] = fetchMock.mock.calls[0] as FetchArgs;
    expect(String(onPremUrl)).toBe(
      `${ON_PREM_SPLUNK}/services/search/jobs/export`
    );
    expect(JSON.stringify(result)).not.toContain(SPLUNK_TOKEN);
  }, 20_000);

  it("never dials on-prem Splunk when the signed envelope is tampered", async () => {
    const fetchMock = vi.fn(async () => splunkNotableExport());
    vi.stubGlobal("fetch", fetchMock);

    const task = signEnvelope(siemTask());
    const tampered = {
      ...task,
      target: { targetHost: "attacker.example.com" }
    } as TaskEnvelope;

    const result = await processTask(tampered, baseConfig());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.status).toBe("Failed");
    expect(result.errorSummary).toMatch(
      /digest mismatch|invalid task signature/u
    );
  });

  it("maps vendor 401 to degraded empty findings without inventing detections", async () => {
    const fetchMock = vi.fn(
      async () => new Response("unauthorized", { status: 401 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await processTask(signEnvelope(siemTask()), baseConfig());

    expect(result.status).toBe("Completed");
    expect(result.outcome).toBe("degraded");
    expect(result.validationState).toBe("NoEvidence");
    expect(result.signals).toEqual([]);
    expect(JSON.stringify(result)).not.toContain(SPLUNK_TOKEN);
  });

  it("maps Elastic 401 on a site CIDR host to degraded empty findings", async () => {
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
              apiKey: ELASTIC_KEY,
              baseUrl: ON_PREM_ELASTIC,
              connectorKey: "elastic-security"
            },
            connectorKey: "elastic-security",
            executionLocation: "BoundRunner",
            integrationId: INTEGRATION_ID,
            mockMode: false,
            siteId: "44444444-4444-4444-8444-444444444444"
          },
          target: { targetHost: "10.8.2.15", targetUrl: ON_PREM_ELASTIC }
        })
      ),
      baseConfig()
    );

    expect(result.status).toBe("Completed");
    expect(result.outcome).toBe("degraded");
    expect(result.signals).toEqual([]);
    expect(JSON.stringify(result)).not.toContain(ELASTIC_KEY);
  });
});

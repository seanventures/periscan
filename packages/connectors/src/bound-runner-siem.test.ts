import { afterEach, describe, expect, it, vi } from "vitest";

import { EnterpriseSiteSchema } from "@periscan/shared";

import {
  BOUND_RUNNER_SIEM_CONNECTOR_KEYS,
  BOUND_RUNNER_SIEM_MODULE_ID,
  BOUND_RUNNER_SIEM_TRANSPORT_COPY,
  buildBoundRunnerSiemTask,
  connectorHostFromBaseUrl,
  hostRequiresBoundRunner,
  isRfc1918Ipv4,
  planOrExecuteSiemSync,
  resolveSiemExecutionLocation
} from "./bound-runner-siem.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const INTEGRATION_ID = "22222222-2222-4222-8222-222222222222";
const RUNNER_ID = "33333333-3333-4333-8333-333333333333";
const SITE_ID = "44444444-4444-4444-8444-444444444444";
const MISSION_ID = "55555555-5555-4555-8555-555555555555";
const RUN_ID = "66666666-6666-4666-8666-666666666666";
const SCOPE_ID = "77777777-7777-4777-8777-777777777777";
const TASK_ID = "88888888-8888-4888-8888-888888888888";

const SPLUNK_TOKEN = "splunk-secret-api-token";
const ELASTIC_KEY = "elastic-secret-key";
const ON_PREM_SPLUNK = "https://10.8.1.20:8089";
const CLOUD_SPLUNK = "https://splunk.example.com:8089";
const ON_PREM_ELASTIC = "https://10.8.2.15:9200";
const CLOUD_ELASTIC = "https://elastic.example.com";

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

function elasticContext(baseUrl: string) {
  return {
    authType: "apiToken",
    config: {
      apiKey: ELASTIC_KEY,
      baseUrl,
      connectorKey: "elastic-security"
    },
    integrationId: INTEGRATION_ID,
    mockMode: false,
    tenantId: TENANT_ID
  };
}

function splunkNotableExport() {
  const rows = [
    JSON.stringify({
      preview: false,
      result: {
        _raw: "2026-06-08 periscan validation event src_ip=10.4.2.7 host=fin-workstation-07",
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

describe("BoundRunner SIEM host routing", () => {
  it("treats RFC1918 literals as BoundRunner, not control-plane", () => {
    expect(isRfc1918Ipv4("10.8.1.20")).toBe(true);
    expect(isRfc1918Ipv4("192.168.10.5")).toBe(true);
    expect(isRfc1918Ipv4("172.16.4.8")).toBe(true);
    expect(isRfc1918Ipv4("172.15.0.1")).toBe(false);
    expect(isRfc1918Ipv4("11.0.0.1")).toBe(false);
    expect(isRfc1918Ipv4("splunk.example.com")).toBe(false);

    expect(connectorHostFromBaseUrl(ON_PREM_SPLUNK)).toBe("10.8.1.20");
    expect(hostRequiresBoundRunner("10.8.1.20", [chicagoDc()])).toBe(true);
    expect(hostRequiresBoundRunner("splunk.example.com", [chicagoDc()])).toBe(
      false
    );
    expect(hostRequiresBoundRunner("splunk.corp.internal", [])).toBe(true);
  });

  it("routes on-prem Splunk and Elastic to BoundRunner when the host matches a site CIDR", () => {
    const splunk = resolveSiemExecutionLocation({
      baseUrl: ON_PREM_SPLUNK,
      connectorKey: "splunk",
      sites: [chicagoDc()]
    });

    expect(splunk.allowed).toBe(true);
    expect(splunk.location).toBe("BoundRunner");
    expect(splunk.matchingSiteId).toBe(SITE_ID);
    expect(splunk.runnerId).toBe(RUNNER_ID);
    expect(splunk.code).toBeNull();

    const elastic = resolveSiemExecutionLocation({
      baseUrl: ON_PREM_ELASTIC,
      connectorKey: "elastic-security",
      sites: [chicagoDc()]
    });
    expect(elastic.location).toBe("BoundRunner");
    expect(elastic.matchingSiteId).toBe(SITE_ID);
    expect(BOUND_RUNNER_SIEM_CONNECTOR_KEYS).toEqual([
      "splunk",
      "elastic-security"
    ]);
  });

  it("keeps internet-reachable Splunk and Elastic Cloud on the control plane", () => {
    const splunk = resolveSiemExecutionLocation({
      baseUrl: CLOUD_SPLUNK,
      connectorKey: "splunk",
      sites: [chicagoDc()]
    });
    expect(splunk.allowed).toBe(true);
    expect(splunk.location).toBe("ControlPlane");
    expect(splunk.matchingSiteId).toBeNull();
    expect(splunk.runnerId).toBeNull();

    const elastic = resolveSiemExecutionLocation({
      baseUrl: CLOUD_ELASTIC,
      connectorKey: "elastic-security",
      sites: [chicagoDc()]
    });
    expect(elastic.location).toBe("ControlPlane");
  });

  it("fails closed when on-prem SIEM has no site-bound runner", () => {
    const decision = resolveSiemExecutionLocation({
      baseUrl: ON_PREM_SPLUNK,
      connectorKey: "splunk",
      sites: [chicagoDc({ runnerIds: [] })]
    });

    expect(decision.allowed).toBe(false);
    expect(decision.location).toBe("BoundRunner");
    expect(decision.code).toBe("no_bound_runner");
    expect(decision.runnerId).toBeNull();
    expect(decision.rationale).toMatch(/bound runner/i);
  });

  it("describes outbound HTTPS poll, not inbound VPN", () => {
    expect(BOUND_RUNNER_SIEM_TRANSPORT_COPY).toMatch(/outbound HTTPS/i);
    expect(BOUND_RUNNER_SIEM_TRANSPORT_COPY).toMatch(
      /does not require an inbound VPN/i
    );
    expect(BOUND_RUNNER_SIEM_MODULE_ID).toBe("connector.siem.sync");
  });
});

describe("planOrExecuteSiemSync", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("executes internet Splunk sync on the control plane", async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request) =>
      splunkNotableExport()
    );
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await planOrExecuteSiemSync({
      connectorKey: "splunk",
      context: splunkContext(CLOUD_SPLUNK),
      executionSide: "control-plane",
      sites: [chicagoDc()]
    });

    expect(outcome.decision.location).toBe("ControlPlane");
    expect(outcome.task).toBeNull();
    expect(outcome.result?.executionLocation).toBe("ControlPlane");
    expect(outcome.result?.health.status).toBe("Healthy");
    expect(
      outcome.result?.signals.some(
        (signal) => signal.sourceType === "splunk.detection"
      )
    ).toBe(true);
    expect(fetchMock).toHaveBeenCalled();
    const [cloudUrl] = fetchMock.mock.calls[0] as FetchArgs;
    expect(String(cloudUrl)).toBe(
      `${CLOUD_SPLUNK}/services/search/jobs/export`
    );
    expect(JSON.stringify(outcome.result)).not.toContain(SPLUNK_TOKEN);
  });

  it("does not dial RFC1918 Splunk from the control plane; returns a BoundRunner task", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("control plane must not fetch RFC1918");
    });
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await planOrExecuteSiemSync({
      connectorKey: "splunk",
      context: splunkContext(ON_PREM_SPLUNK),
      executionSide: "control-plane",
      missionId: MISSION_ID,
      runId: RUN_ID,
      scopeId: SCOPE_ID,
      sites: [chicagoDc()],
      taskId: TASK_ID
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(outcome.decision.location).toBe("BoundRunner");
    expect(outcome.result).toBeNull();
    expect(outcome.task).toEqual(
      expect.objectContaining({
        executionEnvironment: "InternalRunner",
        moduleId: BOUND_RUNNER_SIEM_MODULE_ID,
        runnerId: RUNNER_ID,
        safetyLevel: "PassiveReadOnly",
        taskId: TASK_ID,
        tenantId: TENANT_ID
      })
    );
    expect(outcome.task?.target).toEqual(
      expect.objectContaining({
        targetHost: "10.8.1.20",
        targetUrl: ON_PREM_SPLUNK
      })
    );
    expect(outcome.task?.inputs.executionLocation).toBe("BoundRunner");
    expect(outcome.task?.inputs.siteId).toBe(SITE_ID);
  });

  it("executes on-prem Splunk sync when the caller is the runner-agent", async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request) =>
      splunkNotableExport()
    );
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await planOrExecuteSiemSync({
      connectorKey: "splunk",
      context: splunkContext(ON_PREM_SPLUNK),
      executionSide: "runner-agent",
      runnerId: RUNNER_ID,
      sites: [chicagoDc()]
    });

    expect(outcome.decision.location).toBe("BoundRunner");
    expect(outcome.result?.executionLocation).toBe("BoundRunner");
    expect(outcome.result?.health.status).toBe("Healthy");
    expect(
      outcome.result?.signals.some(
        (signal) => signal.sourceType === "splunk.detection"
      )
    ).toBe(true);
    const [onPremUrl] = fetchMock.mock.calls[0] as FetchArgs;
    expect(String(onPremUrl)).toBe(
      `${ON_PREM_SPLUNK}/services/search/jobs/export`
    );
    expect(JSON.stringify(outcome.result)).not.toContain(SPLUNK_TOKEN);
  });

  it("maps vendor 401 to Degraded with empty findings on control-plane Splunk", async () => {
    const fetchMock = vi.fn(
      async () => new Response("unauthorized", { status: 401 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await planOrExecuteSiemSync({
      connectorKey: "splunk",
      context: splunkContext(CLOUD_SPLUNK),
      executionSide: "control-plane",
      sites: []
    });

    expect(outcome.result?.health.status).toBe("Degraded");
    expect(outcome.result?.health.authorizationVerified).toBe(false);
    expect(outcome.result?.findings).toEqual([]);
    expect(outcome.result?.assets).toEqual([]);
    expect(outcome.result?.signals).toEqual([]);
    expect(
      outcome.result?.signals.some(
        (signal) => signal.sourceType === "splunk.detection"
      )
    ).toBe(false);
    expect(JSON.stringify(outcome.result)).not.toContain(SPLUNK_TOKEN);
  });

  it("maps vendor 401 to Degraded with empty findings on BoundRunner Elastic", async () => {
    const fetchMock = vi.fn(
      async () => new Response("unauthorized", { status: 401 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await planOrExecuteSiemSync({
      connectorKey: "elastic-security",
      context: elasticContext(ON_PREM_ELASTIC),
      executionSide: "runner-agent",
      runnerId: RUNNER_ID,
      sites: [chicagoDc()]
    });

    expect(outcome.result?.executionLocation).toBe("BoundRunner");
    expect(outcome.result?.health.status).toBe("Degraded");
    expect(outcome.result?.findings).toEqual([]);
    expect(outcome.result?.signals).toEqual([]);
    expect(JSON.stringify(outcome.result)).not.toContain(ELASTIC_KEY);
  });

  it("does not invent findings when BoundRunner is required but no runner is bound", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("must not fetch");
    });
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await planOrExecuteSiemSync({
      connectorKey: "splunk",
      context: splunkContext(ON_PREM_SPLUNK),
      executionSide: "control-plane",
      sites: [chicagoDc({ runnerIds: [] })]
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(outcome.decision.allowed).toBe(false);
    expect(outcome.task).toBeNull();
    expect(outcome.result?.findings).toEqual([]);
    expect(outcome.result?.signals).toEqual([]);
    expect(outcome.result?.health.status).not.toBe("Healthy");
  });

  it("builds an InternalRunner SIEM task envelope for the signed poll path", () => {
    const task = buildBoundRunnerSiemTask({
      connectorKey: "splunk",
      context: splunkContext(ON_PREM_SPLUNK),
      expiresAt: "2026-09-17T12:05:00.000Z",
      issuedAt: "2026-09-17T12:00:00.000Z",
      missionId: MISSION_ID,
      runId: RUN_ID,
      runnerId: RUNNER_ID,
      scopeId: SCOPE_ID,
      siteId: SITE_ID,
      taskId: TASK_ID
    });

    expect(task.executionEnvironment).toBe("InternalRunner");
    expect(task.moduleId).toBe("connector.siem.sync");
    expect(task.safetyLevel).toBe("PassiveReadOnly");
    expect(task.taskType).toBe("discover");
    expect(task.inputs.connectorKey).toBe("splunk");
    expect(task.inputs.siteId).toBe(SITE_ID);
  });
});

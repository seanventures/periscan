/**
 * On-prem Splunk/Elastic sync runs on a site-bound runner. Internet SIEM stays
 * on the control plane. The control plane never dials RFC1918. Vendor 401/403
 * is Degraded with zero findings. Transport is outbound HTTPS poll, not VPN.
 */

import { randomUUID } from "node:crypto";

import {
  emptyFindingsOnVendorAuthFailure,
  ENTERPRISE_SITE_RUNNER_TRANSPORT_COPY,
  vendorAuthFailureHealthStatus,
  type EnterpriseSite
} from "@periscan/shared";

import type {
  ConnectorExecutionContext,
  ConnectorSyncResult
} from "./index.js";

export const BOUND_RUNNER_SIEM_MODULE_ID = "connector.siem.sync";

export const BOUND_RUNNER_SIEM_CONNECTOR_KEYS = [
  "splunk",
  "elastic-security"
] as const;

export type BoundRunnerSiemConnectorKey =
  (typeof BOUND_RUNNER_SIEM_CONNECTOR_KEYS)[number];

export const BOUND_RUNNER_SIEM_TRANSPORT_COPY =
  ENTERPRISE_SITE_RUNNER_TRANSPORT_COPY;

export type SiemExecutionLocation = "ControlPlane" | "BoundRunner";

export type SiemExecutionDenialCode =
  | "unsupported_connector"
  | "invalid_base_url"
  | "no_bound_runner";

export type SiemExecutionDecision = {
  allowed: boolean;
  code: SiemExecutionDenialCode | null;
  location: SiemExecutionLocation | null;
  matchingSiteId: string | null;
  rationale: string;
  runnerId: string | null;
};

export type BoundRunnerSiemSyncResult = ConnectorSyncResult & {
  executionLocation: SiemExecutionLocation;
  findings: [];
};

export type BoundRunnerSiemTask = {
  executionEnvironment: "InternalRunner";
  expiresAt: string;
  inputs: {
    authType: string;
    config: Record<string, unknown>;
    connectorKey: string;
    executionLocation: "BoundRunner";
    integrationId: string;
    mockMode: boolean;
    siteId: string | null;
  };
  issuedAt: string;
  missionId: string;
  moduleId: typeof BOUND_RUNNER_SIEM_MODULE_ID;
  runId: string;
  runnerId: string;
  safetyLevel: "PassiveReadOnly";
  scopeId: string;
  target: {
    targetHost: string;
    targetUrl: string;
  };
  taskId: string;
  taskType: "discover";
  tenantId: string;
};

export type BoundRunnerSiemSyncOutcome = {
  decision: SiemExecutionDecision;
  result: BoundRunnerSiemSyncResult | null;
  task: BoundRunnerSiemTask | null;
};

export type PlanOrExecuteSiemSyncInput = {
  connectorKey: string;
  context: ConnectorExecutionContext;
  executionSide: "control-plane" | "runner-agent";
  missionId?: string;
  now?: () => Date;
  runId?: string;
  runnerId?: string | null;
  scopeId?: string;
  sites?: readonly EnterpriseSite[] | null;
  taskId?: string;
};

const RFC1918_CIDRS = ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"];
const LOOPBACK_CIDR = "127.0.0.0/8";
const TASK_TTL_MS = 5 * 60_000;

export function isBoundRunnerSiemModuleId(moduleId: string): boolean {
  return moduleId === BOUND_RUNNER_SIEM_MODULE_ID;
}

export function isBoundRunnerSiemConnectorKey(
  connectorKey: string
): connectorKey is BoundRunnerSiemConnectorKey {
  return (BOUND_RUNNER_SIEM_CONNECTOR_KEYS as readonly string[]).includes(
    connectorKey
  );
}

export function connectorHostFromBaseUrl(baseUrl: string): string | null {
  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    const host = parsed.hostname.replace(/^\[|\]$/gu, "");
    return host.length > 0 ? host : null;
  } catch {
    return null;
  }
}

export function isRfc1918Ipv4(host: string): boolean {
  return RFC1918_CIDRS.some((cidr) => ipv4InCidr(host, cidr));
}

export function hostRequiresBoundRunner(
  host: string,
  sites: readonly EnterpriseSite[]
): boolean {
  const normalized = host.trim().toLowerCase();
  if (!normalized) return false;
  if (
    isRfc1918Ipv4(normalized) ||
    ipv4InCidr(normalized, LOOPBACK_CIDR) ||
    normalized === "localhost" ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal")
  ) {
    return true;
  }
  return sites.some((site) =>
    site.cidrs.some((cidr) => ipv4InCidr(normalized, cidr))
  );
}

export function resolveSiemExecutionLocation(input: {
  baseUrl: string;
  connectorKey: string;
  runnerId?: string | null;
  sites?: readonly EnterpriseSite[] | null;
}): SiemExecutionDecision {
  if (!isBoundRunnerSiemConnectorKey(input.connectorKey)) {
    return {
      allowed: false,
      code: "unsupported_connector",
      location: null,
      matchingSiteId: null,
      rationale:
        "BoundRunner SIEM execution applies to Splunk and Elastic Security only.",
      runnerId: null
    };
  }

  const host = connectorHostFromBaseUrl(input.baseUrl);
  if (!host) {
    return {
      allowed: false,
      code: "invalid_base_url",
      location: null,
      matchingSiteId: null,
      rationale: "SIEM connector baseUrl must be an http(s) URL.",
      runnerId: null
    };
  }

  const sites = input.sites ?? [];
  if (!hostRequiresBoundRunner(host, sites)) {
    return {
      allowed: true,
      code: null,
      location: "ControlPlane",
      matchingSiteId: null,
      rationale: "Internet-reachable SIEM sync runs on the control plane.",
      runnerId: null
    };
  }

  const matchingSite = bestSiteMatch(host, sites);
  const runnerId = pickRunner(matchingSite, input.runnerId);
  if (!runnerId) {
    return {
      allowed: false,
      code: "no_bound_runner",
      location: "BoundRunner",
      matchingSiteId: matchingSite?.siteId ?? null,
      rationale:
        "On-prem Splunk/Elastic must execute on a site-bound runner. Periscan does not dial RFC1918 from the control plane.",
      runnerId: null
    };
  }

  return {
    allowed: true,
    code: null,
    location: "BoundRunner",
    matchingSiteId: matchingSite?.siteId ?? null,
    rationale:
      "On-prem SIEM sync executes on the bound runner via outbound HTTPS signed-task poll.",
    runnerId
  };
}

export function buildBoundRunnerSiemTask(input: {
  connectorKey: string;
  context: ConnectorExecutionContext;
  expiresAt: string;
  issuedAt: string;
  missionId: string;
  runId: string;
  runnerId: string;
  scopeId: string;
  siteId: string | null;
  taskId: string;
}): BoundRunnerSiemTask {
  const baseUrl =
    typeof input.context.config.baseUrl === "string"
      ? input.context.config.baseUrl
      : "";
  const targetHost = connectorHostFromBaseUrl(baseUrl) ?? "";

  return {
    executionEnvironment: "InternalRunner",
    expiresAt: input.expiresAt,
    inputs: {
      authType: input.context.authType,
      config: input.context.config,
      connectorKey: input.connectorKey,
      executionLocation: "BoundRunner",
      integrationId: input.context.integrationId,
      mockMode: input.context.mockMode,
      siteId: input.siteId
    },
    issuedAt: input.issuedAt,
    missionId: input.missionId,
    moduleId: BOUND_RUNNER_SIEM_MODULE_ID,
    runId: input.runId,
    runnerId: input.runnerId,
    safetyLevel: "PassiveReadOnly",
    scopeId: input.scopeId,
    target: {
      targetHost,
      targetUrl: baseUrl
    },
    taskId: input.taskId,
    taskType: "discover",
    tenantId: input.context.tenantId
  };
}

export async function planOrExecuteSiemSync(
  input: PlanOrExecuteSiemSyncInput
): Promise<BoundRunnerSiemSyncOutcome> {
  const now = input.now?.() ?? new Date();
  const baseUrl =
    typeof input.context.config.baseUrl === "string"
      ? input.context.config.baseUrl
      : "";
  const decision = resolveSiemExecutionLocation({
    baseUrl,
    connectorKey: input.connectorKey,
    runnerId: input.runnerId,
    sites: input.sites
  });

  if (input.executionSide === "runner-agent") {
    if (!isBoundRunnerSiemConnectorKey(input.connectorKey)) {
      return {
        decision,
        result: blockedResult(decision, "BoundRunner", now),
        task: null
      };
    }

    const sync = await executeConnectorSync(input.connectorKey, input.context);
    return {
      decision,
      result: normalizeSiemSyncResult(sync, "BoundRunner"),
      task: null
    };
  }

  if (decision.location === "ControlPlane" && decision.allowed) {
    const sync = await executeConnectorSync(input.connectorKey, input.context);
    return {
      decision,
      result: normalizeSiemSyncResult(sync, "ControlPlane"),
      task: null
    };
  }

  if (decision.location === "BoundRunner" && decision.allowed && decision.runnerId) {
    return {
      decision,
      result: null,
      task: buildBoundRunnerSiemTask({
        connectorKey: input.connectorKey,
        context: input.context,
        expiresAt: new Date(now.getTime() + TASK_TTL_MS).toISOString(),
        issuedAt: now.toISOString(),
        missionId: input.missionId ?? randomUUID(),
        runId: input.runId ?? randomUUID(),
        runnerId: decision.runnerId,
        scopeId: input.scopeId ?? randomUUID(),
        siteId: decision.matchingSiteId,
        taskId: input.taskId ?? randomUUID()
      })
    };
  }

  return {
    decision,
    result: blockedResult(decision, decision.location ?? "BoundRunner", now),
    task: null
  };
}

async function executeConnectorSync(
  connectorKey: string,
  context: ConnectorExecutionContext
): Promise<ConnectorSyncResult> {
  const { getConnectorByKey } = await import("./index.js");
  const connector = getConnectorByKey(connectorKey);
  if (!connector) {
    throw new Error(`Unknown connector: ${connectorKey}`);
  }
  return connector.sync(context);
}

function normalizeSiemSyncResult(
  result: ConnectorSyncResult,
  executionLocation: SiemExecutionLocation
): BoundRunnerSiemSyncResult {
  const statusFromDetail = httpStatusFromDetail(result.health.detail);
  const authFailure =
    result.health.status === "Degraded" ||
    vendorAuthFailureHealthStatus(statusFromDetail ?? 0) === "Degraded";

  if (authFailure) {
    const empty = emptyFindingsOnVendorAuthFailure();
    return {
      assets: empty.assets,
      executionLocation,
      findings: empty.findings,
      health: {
        ...result.health,
        authorizationVerified: false,
        status: "Degraded"
      },
      signals: empty.signals
    };
  }

  return {
    ...result,
    executionLocation,
    findings: []
  };
}

function blockedResult(
  decision: SiemExecutionDecision,
  executionLocation: SiemExecutionLocation,
  now: Date
): BoundRunnerSiemSyncResult {
  const empty = emptyFindingsOnVendorAuthFailure();
  return {
    assets: empty.assets,
    executionLocation,
    findings: empty.findings,
    health: {
      authorizationVerified: false,
      checkedAt: now.toISOString(),
      detail: decision.rationale,
      latencyMs: null,
      status: "Unhealthy"
    },
    signals: empty.signals
  };
}

function httpStatusFromDetail(detail: string): number | null {
  const match = detail.match(/\b(?:status|HTTP)\s+(\d{3})\b/iu);
  if (!match?.[1]) return null;
  return Number(match[1]);
}

function pickRunner(
  site: EnterpriseSite | null,
  requested?: string | null
): string | null {
  if (!site) return null;
  if (requested && site.runnerIds.includes(requested)) return requested;
  return site.runnerIds[0] ?? null;
}

function bestSiteMatch(
  host: string,
  sites: readonly EnterpriseSite[]
): EnterpriseSite | null {
  let best: { prefix: number; site: EnterpriseSite } | null = null;
  for (const site of sites) {
    for (const cidr of site.cidrs) {
      if (!ipv4InCidr(host, cidr)) continue;
      const prefix = Number(cidr.split("/")[1]);
      if (!Number.isInteger(prefix)) continue;
      if (!best || prefix > best.prefix) {
        best = { prefix, site };
      }
    }
  }
  return best?.site ?? null;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    value = (value << 8) | octet;
  }
  return value >>> 0;
}

function ipv4InCidr(ip: string, cidr: string): boolean {
  const [network, prefixRaw] = cidr.split("/");
  const prefix = Number(prefixRaw);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
  const ipInt = ipv4ToInt(ip);
  const netInt = ipv4ToInt(network ?? "");
  if (ipInt === null || netInt === null) return false;
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (netInt & mask);
}

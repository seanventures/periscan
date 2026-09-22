import { randomUUID } from "node:crypto";

import type { ConnectorExecutionContext } from "@periscan/connectors";
import {
  buildBoundRunnerSiemTask,
  connectorHostFromBaseUrl,
  resolveSiemExecutionLocation,
  type BoundRunnerSiemTask
} from "@periscan/connectors/bound-runner-siem";
import {
  ModuleExecutionContextSchema,
  type ModuleOutput
} from "@periscan/modules";
import type { EnterpriseSite, RunnerScopeConstraint } from "@periscan/shared";

import { executeBoundRunnerSiemModule } from "./bound-runner-siem.js";
import type { RunnerAgentConfig } from "./config.js";
import { egressPolicyFromScopeConstraints, evaluateEgress } from "./egress.js";
import type { TaskEnvelope } from "./types.js";

const TASK_TTL_MS = 5 * 60_000;

export type SiemSignedTaskDispatchAction =
  | "queue-bound-runner-task"
  | "control-plane-sync"
  | "refuse";

export type SiemSignedTaskDispatchCode =
  | "denied_by_policy"
  | "unscoped"
  | "no_bound_runner"
  | "unsupported_connector"
  | "invalid_base_url";

export type DispatchableSiemSignedTask = BoundRunnerSiemTask & {
  scopeConstraints: RunnerScopeConstraint;
};

export type SiemSignedTaskDispatchPlan = {
  action: SiemSignedTaskDispatchAction;
  code: SiemSignedTaskDispatchCode | null;
  rationale: string;
  task: DispatchableSiemSignedTask | null;
};

export type SiemSignedTaskDispatchInput = {
  connectorKey: string;
  context: ConnectorExecutionContext;
  missionId?: string;
  now?: () => Date;
  policyDecision: "Allow" | "Deny";
  runId?: string;
  runnerId?: string | null;
  scopeConstraints: RunnerScopeConstraint;
  scopeId?: string;
  sites?: readonly EnterpriseSite[] | null;
  taskId?: string;
};

function portFromTargetUrl(url: string): number {
  try {
    const parsed = new URL(url);
    if (parsed.port) {
      const port = Number(parsed.port);
      return Number.isInteger(port) ? port : 0;
    }
    if (parsed.protocol === "https:") return 443;
    if (parsed.protocol === "http:") return 80;
  } catch {
    return 0;
  }
  return 0;
}

function refuse(
  code: SiemSignedTaskDispatchCode,
  rationale: string
): SiemSignedTaskDispatchPlan {
  return {
    action: "refuse",
    code,
    rationale,
    task: null
  };
}

function siemTargetInScope(
  host: string,
  targetUrl: string,
  scopeConstraints: RunnerScopeConstraint
): { allowed: boolean; reason?: string } {
  return evaluateEgress(
    { host, port: portFromTargetUrl(targetUrl) },
    egressPolicyFromScopeConstraints(scopeConstraints)
  );
}

/**
 * Queue planner for on-prem SIEM. Denied and unscoped never produce a task.
 * Internet SIEM stays control-plane; this function never fetches RFC1918.
 */
export function planSiemSignedTaskDispatch(
  input: SiemSignedTaskDispatchInput
): SiemSignedTaskDispatchPlan {
  if (input.policyDecision !== "Allow") {
    return refuse(
      "denied_by_policy",
      "Denied SIEM sync is not queued as a runner task."
    );
  }

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

  if (decision.code === "unsupported_connector") {
    return refuse("unsupported_connector", decision.rationale);
  }
  if (decision.code === "invalid_base_url") {
    return refuse("invalid_base_url", decision.rationale);
  }

  if (decision.location === "ControlPlane" && decision.allowed) {
    return {
      action: "control-plane-sync",
      code: null,
      rationale: decision.rationale,
      task: null
    };
  }

  const host = connectorHostFromBaseUrl(baseUrl) ?? "";
  const scoped = siemTargetInScope(host, baseUrl, input.scopeConstraints);
  if (!scoped.allowed) {
    return refuse(
      "unscoped",
      scoped.reason ?? "SIEM host is not in authorized scope."
    );
  }

  if (!decision.allowed || !decision.runnerId) {
    return refuse("no_bound_runner", decision.rationale);
  }

  const now = input.now?.() ?? new Date();
  const unsigned = buildBoundRunnerSiemTask({
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
  });

  return {
    action: "queue-bound-runner-task",
    code: null,
    rationale: decision.rationale,
    task: {
      ...unsigned,
      scopeConstraints: input.scopeConstraints
    }
  };
}

export async function executeSiemSignedTask(
  task: TaskEnvelope,
  config: RunnerAgentConfig
): Promise<ModuleOutput> {
  if (config.killSwitch) {
    throw new Error("kill switch active");
  }

  const targetUrl = String(task.target?.targetUrl ?? "");
  const targetHost =
    String(task.target?.targetHost ?? "") ||
    connectorHostFromBaseUrl(targetUrl) ||
    "";
  const scoped = evaluateEgress(
    { host: targetHost, port: portFromTargetUrl(targetUrl) },
    egressPolicyFromScopeConstraints(
      task.scopeConstraints as Record<string, unknown> | undefined
    ),
    { killSwitch: config.killSwitch }
  );
  if (!scoped.allowed) {
    throw new Error(scoped.reason ?? "target is not in authorized scope");
  }

  const context = ModuleExecutionContextSchema.parse({
    inputs: task.inputs ?? {},
    missionId: task.missionId,
    runId: task.runId,
    runnerId: config.runnerId,
    safetyLevel: task.safetyLevel,
    scopeId: task.scopeId,
    target: task.target ?? {},
    tenantId: task.tenantId
  });
  return executeBoundRunnerSiemModule(context);
}

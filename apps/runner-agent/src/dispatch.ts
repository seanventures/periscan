import { createHash } from "node:crypto";

import {
  executeModuleById,
  ModuleExecutionContextSchema,
  type ModuleExecutionContext,
  type ModuleOutput
} from "@periscan/modules";

import { stringifyCanonicalJson } from "./canonical.js";
import type { RunnerAgentConfig } from "./config.js";
import { verifyTaskEnvelope, type VerifyDeps } from "./verify.js";
import type { TaskEnvelope, TaskResult } from "./types.js";

// Injectable module executor so unit tests dispatch without ever invoking a live
// tool (CI never runs live tooling). Defaults to the real module registry.
export type ModuleExecutor = (
  moduleId: string,
  context: ModuleExecutionContext
) => Promise<ModuleOutput>;

export interface DispatchDeps extends VerifyDeps {
  executor?: ModuleExecutor;
  now?: Date;
}

function nowIso(deps: DispatchDeps): string {
  return (deps.now ?? new Date()).toISOString();
}

function buildResult(
  task: TaskEnvelope,
  status: TaskResult["status"],
  fields: {
    completedAt: string;
    errorSummary: string | null;
    outcome: string | null;
    signals?: ModuleOutput["signals"];
    startedAt: string;
    validationState: string | null;
  }
): TaskResult {
  const base = {
    completedAt: fields.completedAt,
    errorSummary: fields.errorSummary,
    evidenceManifest: [] as Array<Record<string, unknown>>,
    outcome: fields.outcome,
    runId: task.runId,
    runnerId: task.runnerId,
    // Forward the module's normalized signals so the control plane can persist
    // them and derive findings; the audit hash below covers them too.
    signals: (fields.signals ?? []) as Array<Record<string, unknown>>,
    startedAt: fields.startedAt,
    status,
    taskId: task.taskId,
    tenantId: task.tenantId,
    validationState: fields.validationState
  };

  // Tamper-evident local audit hash over the canonical result body.
  const localAuditSha256 = createHash("sha256")
    .update(stringifyCanonicalJson(base), "utf8")
    .digest("hex");

  return { ...base, localAuditSha256 };
}

// Verify the signed envelope, then (only if valid) dispatch the named module via
// the shared module framework. Verification failures and execution errors both
// return a result the agent submits back — the SaaS sees every outcome.
export async function processTask(
  task: TaskEnvelope,
  config: RunnerAgentConfig,
  deps: DispatchDeps = {}
): Promise<TaskResult> {
  const startedAt = nowIso(deps);
  const executor = deps.executor ?? executeModuleById;

  const verdict = verifyTaskEnvelope(task, config, deps);
  if (!verdict.ok) {
    return buildResult(task, "Failed", {
      completedAt: nowIso(deps),
      errorSummary: `task verification failed: ${verdict.reason ?? "unknown"}`,
      outcome: null,
      startedAt,
      validationState: null
    });
  }

  try {
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
    const output = await executor(task.moduleId, context);

    return buildResult(task, "Completed", {
      completedAt: nowIso(deps),
      errorSummary: output.errors.length > 0 ? output.errors.join("; ") : null,
      outcome: output.outcome,
      signals: output.signals,
      startedAt,
      validationState: output.validationState ?? null
    });
  } catch (error) {
    return buildResult(task, "Failed", {
      completedAt: nowIso(deps),
      errorSummary: error instanceof Error ? error.message : String(error),
      outcome: null,
      startedAt,
      validationState: null
    });
  }
}

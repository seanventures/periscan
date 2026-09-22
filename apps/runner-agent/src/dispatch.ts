import { createHash } from "node:crypto";

import {
  executeModuleById,
  ModuleExecutionContextSchema,
  type ModuleExecutionContext,
  type ModuleOutput
} from "@periscan/modules";

import {
  AtomicArgvDeniedError,
  executeAtomicArgv,
  isAtomicArgvTask,
  resolveAtomicArgvFromTask,
  type AtomicArgvExec
} from "./atomic-argv.js";
import {
  executeBoundRunnerSiemModule,
  isBoundRunnerSiemModuleId
} from "./bound-runner-siem.js";
import { stringifyCanonicalJson } from "./canonical.js";
import type { RunnerAgentConfig } from "./config.js";
import { executeSiemSignedTask } from "./siem-signed-task-dispatch.js";
import { verifyTaskEnvelope, type VerifyDeps } from "./verify.js";
import type { TaskEnvelope, TaskResult } from "./types.js";

// Injectable module executor so unit tests dispatch without ever invoking a live
// tool (CI never runs live tooling). Defaults to the real module registry.
export type ModuleExecutor = (
  moduleId: string,
  context: ModuleExecutionContext
) => Promise<ModuleOutput>;

export interface DispatchDeps extends VerifyDeps {
  atomicArgvExec?: AtomicArgvExec;
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

export async function executeRunnerAgentModule(
  moduleId: string,
  context: ModuleExecutionContext
): Promise<ModuleOutput> {
  if (isBoundRunnerSiemModuleId(moduleId)) {
    return executeBoundRunnerSiemModule(context);
  }
  return executeModuleById(moduleId, context);
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
  const executor = deps.executor ?? executeRunnerAgentModule;

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

  if (isAtomicArgvTask(task)) {
    try {
      const resolved = resolveAtomicArgvFromTask(task);
      const argvResult = await executeAtomicArgv({
        argv: resolved.argv,
        exec: deps.atomicArgvExec,
        guid: resolved.guid
      });
      if (!argvResult.executed) {
        return buildResult(task, "Failed", {
          completedAt: nowIso(deps),
          errorSummary: `atomic argv cleanup ${argvResult.cleanup}`,
          outcome: null,
          startedAt,
          validationState: null
        });
      }
      return buildResult(task, "Completed", {
        completedAt: nowIso(deps),
        errorSummary: null,
        outcome: "atomic_argv_executed",
        startedAt,
        validationState: "Executed"
      });
    } catch (error) {
      return buildResult(task, "Failed", {
        completedAt: nowIso(deps),
        errorSummary:
          error instanceof AtomicArgvDeniedError || error instanceof Error
            ? error.message
            : String(error),
        outcome: null,
        startedAt,
        validationState: null
      });
    }
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
    const output =
      !deps.executor && isBoundRunnerSiemModuleId(task.moduleId)
        ? await executeSiemSignedTask(task, config)
        : await executor(task.moduleId, context);

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

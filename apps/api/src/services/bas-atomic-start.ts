import { randomUUID } from "node:crypto";

import {
  isAtomicQualifiedExecutionPin,
  planAtomicQualifiedCampaignQueue,
  type AtomicQualifiedArgv,
  type AtomicQualifiedStartPin
} from "@periscan/modules";
import {
  RunnerTaskEnvelopeSchema,
  type RunnerTaskEnvelope
} from "@periscan/shared";

export const ATOMIC_QUALIFIED_START_MODULE_ID =
  "atomic.control_validation_safe";
export const ATOMIC_QUALIFIED_START_TASK_TYPE = "atomic.argv";
export const ATOMIC_QUALIFIED_START_RUNNER_REQUIRED =
  "Bound runner is required for Atomic argv start. Denied tasks are never queued.";

const QUALIFICATION_DELEGATE_KEYS = [
  "basPackQualification",
  "tenantBasPackAuthorization",
  "basAdapterQualification",
  "basAtomicQualification",
  "atomicLabQualification",
  "basQualification",
  "basCampaignQualification",
  "basLabQualification"
] as const;

export type AtomicQualifiedCampaignStartSelection =
  | "queue"
  | "deny"
  | "fallthrough";

export type AtomicQualifiedStartPersistInput = {
  argv: readonly [AtomicQualifiedArgv];
  envelope: RunnerTaskEnvelope;
  guid: string;
};

export type AtomicQualifiedStartLabInput = {
  argv: readonly [AtomicQualifiedArgv];
  envelope: RunnerTaskEnvelope | null;
  guid: string;
};

export type AtomicQualifiedStartResult = {
  denyReason: string | null;
  envelopes: RunnerTaskEnvelope[];
  jobsQueued: number;
  queued: boolean;
  yamlEval: false;
};

function isPrismaDelegate(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  const methods = value as Record<string, unknown>;
  return (
    typeof methods.findMany === "function" ||
    typeof methods.findFirst === "function" ||
    typeof methods.findUnique === "function"
  );
}

/** Feature-detect qualification tables. Missing tables keep deny. */
export function hasAtomicQualificationTables(prisma: unknown): boolean {
  if (!prisma || typeof prisma !== "object") {
    return false;
  }
  const client = prisma as Record<string, unknown>;
  return QUALIFICATION_DELEGATE_KEYS.some((key) =>
    isPrismaDelegate(client[key])
  );
}

export function selectAtomicQualifiedCampaignStart(input: {
  pins: ReadonlyArray<AtomicQualifiedStartPin>;
  qualificationTablesPresent: boolean;
  startable: boolean;
}): AtomicQualifiedCampaignStartSelection {
  if (!input.startable) {
    return "fallthrough";
  }
  if (!input.pins.some(isAtomicQualifiedExecutionPin)) {
    return "fallthrough";
  }
  const planned = planAtomicQualifiedCampaignQueue(input);
  return planned.queued ? "queue" : "deny";
}

function deniedStart(denyReason: string): AtomicQualifiedStartResult {
  return {
    denyReason,
    envelopes: [],
    jobsQueued: 0,
    queued: false,
    yamlEval: false
  };
}

export async function queueAtomicQualifiedStart(input: {
  context: {
    controlPlaneUrl?: string;
    missionId: string;
    now?: Date;
    runId?: string;
    runnerId: string | null;
    scopeConstraints: RunnerTaskEnvelope["scopeConstraints"];
    scopeId: string;
    tenantId: string;
  };
  executeInProcessLab?: (
    task: AtomicQualifiedStartLabInput
  ) => Promise<void> | void;
  persistTask?: (
    task: AtomicQualifiedStartPersistInput
  ) => Promise<void> | void;
  pins: ReadonlyArray<AtomicQualifiedStartPin>;
  qualificationTablesPresent: boolean;
  signEnvelope: (
    unsigned: Omit<RunnerTaskEnvelope, "signature">
  ) => Promise<RunnerTaskEnvelope> | RunnerTaskEnvelope;
  startable: boolean;
}): Promise<AtomicQualifiedStartResult> {
  const planned = planAtomicQualifiedCampaignQueue({
    pins: input.pins,
    qualificationTablesPresent: input.qualificationTablesPresent,
    startable: input.startable
  });
  if (!planned.queued) {
    return deniedStart(planned.denyReason);
  }

  const runnerId = input.context.runnerId;
  if (!runnerId && !input.executeInProcessLab) {
    return deniedStart(ATOMIC_QUALIFIED_START_RUNNER_REQUIRED);
  }

  const now = input.context.now ?? new Date();
  const expiresAt = new Date(now.getTime() + 900_000);
  const controlPlaneUrl =
    input.context.controlPlaneUrl ?? "https://runner.periscan.cloud";
  const envelopes: RunnerTaskEnvelope[] = [];

  for (const [index, task] of planned.argvTasks.entries()) {
    if (!runnerId) {
      await input.executeInProcessLab?.({
        argv: task.argv,
        envelope: null,
        guid: task.guid
      });
      continue;
    }

    const taskId = randomUUID();
    const runId =
      index === 0 && input.context.runId ? input.context.runId : randomUUID();
    const unsigned: Omit<RunnerTaskEnvelope, "signature"> = {
      artifactUpload: {
        artifactUploadUrl: `${controlPlaneUrl}/api/v1/runners/${runnerId}/tasks/${taskId}/artifacts`,
        maxArtifactBytes: 1_000_000,
        resultCallbackUrl: `${controlPlaneUrl}/api/v1/runners/${runnerId}/tasks/${taskId}/result`
      },
      executionEnvironment: "InternalRunner",
      expiresAt: expiresAt.toISOString(),
      inputs: {
        argv: [...task.argv],
        guid: task.guid,
        scenarioId: task.scenarioId,
        yamlEval: false
      },
      issuedAt: now.toISOString(),
      missionId: input.context.missionId,
      moduleId: ATOMIC_QUALIFIED_START_MODULE_ID,
      runId,
      runnerId,
      safetyLevel: "ActiveNonInvasive",
      scopeConstraints: input.context.scopeConstraints,
      scopeId: input.context.scopeId,
      target: {
        argv: [...task.argv],
        guid: task.guid,
        kind: "atomic-argv",
        scenarioId: task.scenarioId
      },
      taskId,
      tenantId: input.context.tenantId
    };
    const envelope = RunnerTaskEnvelopeSchema.parse(
      await input.signEnvelope(unsigned)
    );
    envelopes.push(envelope);
    await input.persistTask?.({
      argv: task.argv,
      envelope,
      guid: task.guid
    });
    await input.executeInProcessLab?.({
      argv: task.argv,
      envelope,
      guid: task.guid
    });
  }

  const jobsQueued =
    envelopes.length > 0 ? envelopes.length : planned.argvTasks.length;
  if (jobsQueued < 1) {
    return deniedStart(ATOMIC_QUALIFIED_START_RUNNER_REQUIRED);
  }

  return {
    denyReason: null,
    envelopes,
    jobsQueued,
    queued: true,
    yamlEval: false
  };
}

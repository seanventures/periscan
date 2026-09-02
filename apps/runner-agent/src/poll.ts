import { createHash, createPrivateKey, sign } from "node:crypto";

import type { RunnerAgentConfig } from "./config.js";
import { stringifyCanonicalJson } from "./canonical.js";
import { processTask, type DispatchDeps } from "./dispatch.js";
import {
  PollResponseSchema,
  type TaskEnvelope,
  type TaskResult
} from "./types.js";

export interface PollDeps extends DispatchDeps {
  fetchImpl?: typeof fetch;
}

export interface PollOutcome {
  killSwitchActive: boolean;
  nextPollAfterSeconds: number;
  submitted: TaskResult[];
  skippedForKillSwitch: boolean;
}

function authHeaders(config: RunnerAgentConfig): Record<string, string> {
  return {
    authorization: `Bearer ${config.authToken}`,
    "content-type": "application/json",
    "x-periscan-runner-token": config.authToken
  };
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function resultAuditHash(result: TaskResult): string {
  const canonicalResult: Record<string, unknown> = { ...result };
  delete canonicalResult.localAuditSha256;
  delete canonicalResult.resultSignature;
  return sha256Hex(stringifyCanonicalJson(canonicalResult));
}

// Sign the result's localAuditSha256 with the agent's registered Ed25519 key so
// the control plane can verify non-repudiable runner provenance. No-op (returns
// the result unchanged) when the agent has no result-signing key configured.
export function signResult(
  config: RunnerAgentConfig,
  result: TaskResult
): TaskResult {
  if (!config.resultSigningPrivateKeyPem) {
    return result;
  }
  const privateKey = createPrivateKey(config.resultSigningPrivateKeyPem);
  const resultSignature = sign(
    null,
    Buffer.from(result.localAuditSha256, "utf8"),
    privateKey
  ).toString("base64");
  return { ...result, resultSignature };
}

async function attachCompletedResultEvidence(
  base: string,
  config: RunnerAgentConfig,
  fetchImpl: typeof fetch,
  task: TaskEnvelope,
  result: TaskResult
): Promise<TaskResult> {
  if (result.status !== "Completed" || result.evidenceManifest.length > 0) {
    return result;
  }

  const content = JSON.stringify(
    {
      completedAt: result.completedAt,
      errorSummary: result.errorSummary,
      moduleId: task.moduleId,
      outcome: result.outcome,
      runId: result.runId,
      runnerId: result.runnerId,
      signals: result.signals,
      startedAt: result.startedAt,
      status: result.status,
      taskId: result.taskId,
      tenantId: result.tenantId,
      validationState: result.validationState
    },
    null,
    2
  );
  const uploadResponse = await fetchImpl(
    `${base}/tasks/${task.taskId}/artifacts`,
    {
      body: JSON.stringify({
        artifactType: "NormalizedEvidence",
        contentBase64: Buffer.from(content, "utf8").toString("base64"),
        contentType: "application/json",
        filename: `runner-result-${task.taskId}.json`,
        sha256: sha256Hex(content),
        sizeBytes: Buffer.byteLength(content, "utf8")
      }),
      headers: authHeaders(config),
      method: "POST"
    }
  );
  if (!uploadResponse.ok) {
    throw new Error(
      `runner evidence upload returned status ${uploadResponse.status}`
    );
  }
  const body = (await uploadResponse.json()) as {
    artifact?: {
      evidenceId?: string;
      redactionStatus?: string;
      sha256?: string;
    };
  };
  if (
    !body.artifact?.evidenceId ||
    !body.artifact.redactionStatus ||
    !body.artifact.sha256
  ) {
    throw new Error("runner evidence upload returned malformed artifact.");
  }

  const withEvidence: TaskResult = {
    ...result,
    evidenceManifest: [
      {
        artifactType: "NormalizedEvidence",
        evidenceId: body.artifact.evidenceId,
        redactionStatus: body.artifact.redactionStatus,
        sha256: body.artifact.sha256,
        sizeBytes: Buffer.byteLength(content, "utf8")
      }
    ]
  };

  return {
    ...withEvidence,
    localAuditSha256: resultAuditHash(withEvidence)
  };
}

// One outbound poll cycle over the proven transport: POST the poll endpoint,
// honor the server-driven kill switch, verify+execute each signed task, and
// submit each result. The agent NEVER opens an inbound port; it only dials out.
export async function pollOnce(
  config: RunnerAgentConfig,
  deps: PollDeps = {}
): Promise<PollOutcome> {
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;

  // Local kill switch: do not even poll for work.
  if (config.killSwitch) {
    return {
      killSwitchActive: true,
      nextPollAfterSeconds: config.pollIntervalSeconds,
      skippedForKillSwitch: true,
      submitted: []
    };
  }

  const base = `${config.controlPlaneUrl}/api/v1/runners/${config.runnerId}`;
  const pollResponse = await fetchImpl(`${base}/poll`, {
    body: JSON.stringify({
      health: {
        activeTaskId: null,
        certificateExpiresAt: config.certificateExpiresAt,
        lastTaskCompletedAt: null,
        observedAt: new Date().toISOString(),
        queueDepth: 0,
        runnerId: config.runnerId,
        status: "Active",
        tenantId: config.tenantId,
        version: config.version
      }
    }),
    headers: authHeaders(config),
    method: "POST"
  });
  if (!pollResponse.ok) {
    throw new Error(`runner poll returned status ${pollResponse.status}`);
  }
  const response = PollResponseSchema.parse(await pollResponse.json());

  // Server-driven kill switch: stop executing even if tasks were returned.
  if (response.killSwitchActive) {
    return {
      killSwitchActive: true,
      nextPollAfterSeconds: response.nextPollAfterSeconds,
      skippedForKillSwitch: true,
      submitted: []
    };
  }

  const submitted: TaskResult[] = [];
  for (const rawTask of response.tasks) {
    // Raw envelope preserved for signature verification (no schema defaults).
    const task = rawTask as unknown as TaskEnvelope;
    const result = signResult(
      config,
      await attachCompletedResultEvidence(
        base,
        config,
        fetchImpl,
        task,
        await processTask(task, config, deps)
      )
    );
    const submitResponse = await fetchImpl(
      `${base}/tasks/${task.taskId}/result`,
      {
        body: JSON.stringify(result),
        headers: authHeaders(config),
        method: "POST"
      }
    );
    if (!submitResponse.ok) {
      throw new Error(
        `runner result submit returned status ${submitResponse.status}`
      );
    }
    submitted.push(result);
  }

  return {
    killSwitchActive: false,
    nextPollAfterSeconds: response.nextPollAfterSeconds,
    skippedForKillSwitch: false,
    submitted
  };
}

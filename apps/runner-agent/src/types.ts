import { z } from "zod";

// Wire types for the runner transport contract. These mirror the proven Go
// runner (apps/runner/main.go) + the control-plane runner routes exactly — the
// Node agent is a drop-in over the SAME outbound signed-task poll protocol.
//
// IMPORTANT: task envelopes are treated as RAW received objects for signature
// verification — we never apply schema defaults to a signed envelope, because the
// canonical digest must be computed over exactly the bytes the server signed.

export interface RunnerTaskSignature {
  algorithm: string;
  digestSha256: string;
  keyId: string;
  nonce: string;
  signature: string;
}

// Task kind for the in-network agent: discover (recon/inventory), verify
// (re-test a remediation in-network), perform (active/offensive, approval-gated).
export type RunnerTaskType = "discover" | "verify" | "perform";

export interface TaskEnvelope {
  taskId: string;
  taskType?: RunnerTaskType;
  runId: string;
  runnerId: string;
  tenantId: string;
  missionId: string;
  scopeId: string;
  moduleId: string;
  safetyLevel?: string;
  executionEnvironment: string;
  issuedAt?: string;
  expiresAt: string;
  inputs?: Record<string, unknown>;
  target?: Record<string, unknown>;
  scopeConstraints?: Record<string, unknown>;
  artifactUpload?: Record<string, unknown> | null;
  signature: RunnerTaskSignature;
  [key: string]: unknown;
}

// Poll response is validated, but task envelopes stay raw (z.record passthrough)
// so verification canonicalizes the exact signed object.
export const PollResponseSchema = z.object({
  killSwitchActive: z.boolean().default(false),
  nextPollAfterSeconds: z.number().default(30),
  tasks: z.array(z.record(z.string(), z.unknown())).default([])
});

export const TaskResultStatusSchema = z.enum(["Completed", "Failed"]);

export const TaskResultSchema = z.object({
  completedAt: z.string(),
  errorSummary: z.string().nullable(),
  evidenceManifest: z.array(z.record(z.string(), z.unknown())).default([]),
  localAuditSha256: z.string(),
  outcome: z.string().nullable(),
  // Ed25519 signature (base64) over localAuditSha256; present when the agent has
  // a registered result-signing key. The control plane verifies it.
  resultSignature: z.string().optional(),
  runId: z.string(),
  runnerId: z.string(),
  // Module-produced normalized signals, forwarded verbatim to the control plane
  // (which validates them with the shared SignalEnvelope schema and persists
  // them tied to this signed task). Empty for reachability-only tasks.
  signals: z.array(z.record(z.string(), z.unknown())).default([]),
  startedAt: z.string(),
  status: TaskResultStatusSchema,
  taskId: z.string(),
  tenantId: z.string(),
  validationState: z.string().nullable()
});

export type PollResponse = z.infer<typeof PollResponseSchema>;
export type TaskResult = z.infer<typeof TaskResultSchema>;

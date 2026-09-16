import {
  createHash,
  createPublicKey,
  verify as cryptoVerify
} from "node:crypto";

import { stringifyCanonicalJson } from "./canonical.js";
import type { RunnerAgentConfig } from "./config.js";
import type { TaskEnvelope } from "./types.js";

export interface VerifyResult {
  ok: boolean;
  reason?: string;
}

export interface VerifyDeps {
  now?: Date;
  // Returns true if the nonce was already used (replay). Optional so unit checks
  // can omit replay tracking; the agent supplies a real seen-set in the loop.
  hasSeenNonce?: (nonce: string) => boolean;
  recordNonce?: (nonce: string) => void;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

// Faithful port of the Go runner's verifyTask (apps/runner/main.go): identity +
// envelope + signature checks, then the canonical-digest + Ed25519 verification
// against the control-plane signing key, then local allowlist/safety/replay
// guards. The agent NEVER executes a task that fails any of these.
export function verifyTaskEnvelope(
  task: TaskEnvelope,
  config: RunnerAgentConfig,
  deps: VerifyDeps = {}
): VerifyResult {
  const now = deps.now ?? new Date();

  if (task.runnerId !== config.runnerId) {
    return { ok: false, reason: "runnerId mismatch" };
  }
  if (config.tenantId && task.tenantId !== config.tenantId) {
    return { ok: false, reason: "tenantId mismatch" };
  }
  if (config.signingKeyId && task.signature.keyId !== config.signingKeyId) {
    return { ok: false, reason: "task signing keyId mismatch" };
  }
  if (task.executionEnvironment !== "InternalRunner") {
    return { ok: false, reason: "execution environment is not InternalRunner" };
  }
  if (task.signature.algorithm !== "EdDSA") {
    return {
      ok: false,
      reason: `unsupported task signature algorithm: ${task.signature.algorithm}`
    };
  }
  if (task.signature.nonce !== task.taskId) {
    return { ok: false, reason: "task signature nonce does not match taskId" };
  }

  const expiresAt = new Date(task.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) {
    return { ok: false, reason: "invalid task expiry" };
  }
  if (expiresAt.getTime() <= now.getTime()) {
    return { ok: false, reason: "task is expired" };
  }

  // Canonical digest over the envelope minus the signature, matching the signer.
  const unsigned: Record<string, unknown> = { ...task };
  delete unsigned.signature;
  const canonical = stringifyCanonicalJson(unsigned);
  if (task.signature.digestSha256 !== sha256Hex(canonical)) {
    return { ok: false, reason: "task digest mismatch" };
  }

  let signatureValid: boolean;
  try {
    const publicKey = createPublicKey(config.signingPublicKeyPem);
    signatureValid = cryptoVerify(
      null,
      Buffer.from(canonical, "utf8"),
      publicKey,
      Buffer.from(task.signature.signature, "base64url")
    );
  } catch (error) {
    return {
      ok: false,
      reason: `signature verification error: ${
        error instanceof Error ? error.message : String(error)
      }`
    };
  }
  if (!signatureValid) {
    return { ok: false, reason: "invalid task signature" };
  }

  if (!config.allowlistedModuleIds.has(task.moduleId)) {
    return {
      ok: false,
      reason: `module is not locally allowlisted: ${task.moduleId}`
    };
  }
  if (task.safetyLevel && !config.allowedSafetyLevels.has(task.safetyLevel)) {
    return {
      ok: false,
      reason: `task safety level is not permitted on this runner: ${task.safetyLevel}`
    };
  }

  // Replay rejection is last so only fully-valid tasks consume a nonce.
  if (deps.hasSeenNonce?.(task.signature.nonce)) {
    return { ok: false, reason: "task nonce replay detected" };
  }
  deps.recordNonce?.(task.signature.nonce);

  return { ok: true };
}

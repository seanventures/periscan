import { createHash, generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  ATOMIC_ARGV_MODULE_ID,
  AtomicArgvDeniedError,
  executeAtomicArgv,
  isAtomicArgvTask,
  resolveAtomicArgvFromTask
} from "./atomic-argv.js";
import { stringifyCanonicalJson } from "./canonical.js";
import type { RunnerAgentConfig } from "./config.js";
import { processTask } from "./dispatch.js";
import type { TaskEnvelope } from "./types.js";

const HOSTNAME_GUID = "486e88ea-4f56-470f-9b57-3f4d73f39133";
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const SIGNING_PUBLIC_KEY_PEM = publicKey
  .export({ format: "pem", type: "spki" })
  .toString();
const SIGNING_KEY_ID = "test-signing-key";
const RUNNER_ID = "runner-atomic";
const TENANT_ID = randomUUID();

function baseConfig(
  overrides: Partial<RunnerAgentConfig> = {}
): RunnerAgentConfig {
  return {
    allowedSafetyLevels: new Set(["PassiveReadOnly", "ActiveNonInvasive"]),
    allowlistedModuleIds: new Set([ATOMIC_ARGV_MODULE_ID]),
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

function atomicTask(overrides: Record<string, unknown> = {}) {
  const taskId = randomUUID();
  return {
    executionEnvironment: "InternalRunner",
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    inputs: {
      argv: ["/bin/hostname"],
      guid: HOSTNAME_GUID,
      scenarioId: `atomic:${HOSTNAME_GUID}`,
      yamlEval: false
    },
    issuedAt: new Date().toISOString(),
    missionId: randomUUID(),
    moduleId: ATOMIC_ARGV_MODULE_ID,
    runId: randomUUID(),
    runnerId: RUNNER_ID,
    safetyLevel: "ActiveNonInvasive",
    scopeId: randomUUID(),
    target: {
      argv: ["/bin/hostname"],
      guid: HOSTNAME_GUID,
      kind: "atomic-argv",
      scenarioId: `atomic:${HOSTNAME_GUID}`
    },
    taskId,
    tenantId: TENANT_ID,
    ...overrides
  };
}

describe("executeAtomicArgv", () => {
  it("executes allowlisted hostname argv and hashes stdout", async () => {
    const exec = vi.fn(async () => ({ stdout: "periscan-bas-lab\n", stderr: "" }));
    const result = await executeAtomicArgv({
      argv: ["/bin/hostname"],
      exec,
      guid: HOSTNAME_GUID
    });
    expect(exec).toHaveBeenCalledWith(
      "/bin/hostname",
      [],
      expect.objectContaining({ timeout: expect.any(Number) })
    );
    expect(result.executed).toBe(true);
    expect(result.cleanup).toBe("succeeded");
    expect(result.outputSha256).toBe(
      createHash("sha256").update("periscan-bas-lab\n", "utf8").digest("hex")
    );
  });

  it("denies non-allowlisted argv and never execs", async () => {
    const exec = vi.fn(async () => ({ stdout: "", stderr: "" }));
    await expect(
      executeAtomicArgv({
        argv: ["/bin/sh", "-c", "id"],
        exec,
        guid: HOSTNAME_GUID
      })
    ).rejects.toBeInstanceOf(AtomicArgvDeniedError);
    expect(exec).not.toHaveBeenCalled();
  });

  it("records cancelled cleanup when the abort signal fires", async () => {
    const exec = vi.fn(async () => {
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
    });
    const result = await executeAtomicArgv({
      argv: ["/bin/hostname"],
      exec,
      guid: HOSTNAME_GUID
    });
    expect(result.executed).toBe(false);
    expect(result.cleanup).toBe("cancelled");
  });
});

describe("isAtomicArgvTask", () => {
  it("accepts signed Atomic argv envelopes and rejects yaml-eval", () => {
    expect(isAtomicArgvTask(atomicTask())).toBe(true);
    expect(
      isAtomicArgvTask(
        atomicTask({
          inputs: {
            argv: ["/bin/hostname"],
            guid: HOSTNAME_GUID,
            yamlEval: true
          }
        })
      )
    ).toBe(false);
    expect(
      resolveAtomicArgvFromTask(atomicTask()).argv
    ).toEqual(["/bin/hostname"]);
  });
});

describe("processTask Atomic argv", () => {
  it("executes hostname without calling the dry-run module executor", async () => {
    const task = signEnvelope(atomicTask());
    const executor = vi.fn();
    const exec = vi.fn(async () => ({ stdout: "periscan-bas-lab\n", stderr: "" }));
    const result = await processTask(task, baseConfig(), {
      atomicArgvExec: exec,
      executor
    });
    expect(executor).not.toHaveBeenCalled();
    expect(result.status).toBe("Completed");
    expect(result.outcome).toBe("atomic_argv_executed");
    expect(result.validationState).toBe("Executed");
  });

  it("fails closed for shell argv and does not mark success", async () => {
    const task = signEnvelope(
      atomicTask({
        inputs: {
          argv: ["/bin/sh", "-c", "id"],
          guid: HOSTNAME_GUID,
          yamlEval: false
        }
      })
    );
    const exec = vi.fn(async () => ({ stdout: "uid=0\n", stderr: "" }));
    const result = await processTask(task, baseConfig(), {
      atomicArgvExec: exec
    });
    expect(exec).not.toHaveBeenCalled();
    expect(result.status).toBe("Failed");
    expect(result.errorSummary).toMatch(/allowlisted|never eval|denied/i);
  });
});

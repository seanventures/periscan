import {
  createHash,
  createPublicKey,
  generateKeyPairSync,
  sign as cryptoSign,
  verify as cryptoVerify
} from "node:crypto";
import { randomUUID } from "node:crypto";

import type { ModuleOutput } from "@periscan/modules";
import { describe, expect, it, vi } from "vitest";

import { stringifyCanonicalJson } from "./canonical.js";
import type { RunnerAgentConfig } from "./config.js";
import { processTask } from "./dispatch.js";
import { pollOnce, signResult } from "./poll.js";
import type { TaskEnvelope } from "./types.js";
import { verifyTaskEnvelope } from "./verify.js";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const SIGNING_PUBLIC_KEY_PEM = publicKey
  .export({ format: "pem", type: "spki" })
  .toString();
const SIGNING_KEY_ID = "test-signing-key";
const RUNNER_ID = "runner-123";
const TENANT_ID = randomUUID();

function baseConfig(
  overrides: Partial<RunnerAgentConfig> = {}
): RunnerAgentConfig {
  return {
    allowedSafetyLevels: new Set(["PassiveReadOnly", "ActiveNonInvasive"]),
    allowlistedModuleIds: new Set(["runner.reachability_check"]),
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

// Sign exactly as the control plane does: canonical JSON over the envelope minus
// signature, sha256 digest, Ed25519 signature (base64url).
function signEnvelope(
  unsigned: Record<string, unknown>,
  keyId = SIGNING_KEY_ID
): TaskEnvelope {
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
      keyId,
      nonce: unsigned.taskId as string,
      signature
    }
  } as TaskEnvelope;
}

function unsignedTask(overrides: Record<string, unknown> = {}) {
  const taskId = (overrides.taskId as string) ?? randomUUID();
  return {
    executionEnvironment: "InternalRunner",
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    inputs: {},
    issuedAt: new Date().toISOString(),
    missionId: randomUUID(),
    moduleId: "runner.reachability_check",
    runId: randomUUID(),
    runnerId: RUNNER_ID,
    safetyLevel: "ActiveNonInvasive",
    scopeId: randomUUID(),
    target: { ports: [443], targetHost: "host.internal" },
    taskId,
    tenantId: TENANT_ID,
    ...overrides
  };
}

describe("runner-agent verifyTaskEnvelope", () => {
  it("accepts a correctly signed, in-scope task", () => {
    const task = signEnvelope(unsignedTask());
    expect(verifyTaskEnvelope(task, baseConfig())).toEqual({ ok: true });
  });

  it("rejects a tampered envelope (digest/signature mismatch)", () => {
    const task = signEnvelope(unsignedTask());
    const tampered = {
      ...task,
      target: { targetHost: "attacker.example.com" }
    } as TaskEnvelope;
    const verdict = verifyTaskEnvelope(tampered, baseConfig());
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toMatch(/digest mismatch|invalid task signature/u);
  });

  it("rejects an expired task", () => {
    const task = signEnvelope(
      unsignedTask({ expiresAt: new Date(Date.now() - 1000).toISOString() })
    );
    expect(verifyTaskEnvelope(task, baseConfig())).toMatchObject({
      ok: false,
      reason: "task is expired"
    });
  });

  it("rejects a runnerId mismatch", () => {
    const task = signEnvelope(unsignedTask({ runnerId: "someone-else" }));
    expect(verifyTaskEnvelope(task, baseConfig())).toMatchObject({
      ok: false,
      reason: "runnerId mismatch"
    });
  });

  it("rejects a non-allowlisted module", () => {
    const task = signEnvelope(
      unsignedTask({ moduleId: "exploit.metasploit_check" })
    );
    expect(verifyTaskEnvelope(task, baseConfig())).toMatchObject({
      ok: false,
      reason: "module is not locally allowlisted: exploit.metasploit_check"
    });
  });

  it("rejects a safety level the runner does not permit", () => {
    const task = signEnvelope(
      unsignedTask({ safetyLevel: "AdvancedAdversarial" })
    );
    expect(verifyTaskEnvelope(task, baseConfig())).toMatchObject({
      ok: false
    });
  });

  it("rejects a non-InternalRunner execution environment", () => {
    const task = signEnvelope(
      unsignedTask({ executionEnvironment: "ControlPlane" })
    );
    expect(verifyTaskEnvelope(task, baseConfig())).toMatchObject({
      ok: false,
      reason: "execution environment is not InternalRunner"
    });
  });

  it("rejects a replayed nonce", () => {
    const task = signEnvelope(unsignedTask());
    const seen = new Set<string>();
    const deps = {
      hasSeenNonce: (n: string) => seen.has(n),
      recordNonce: (n: string) => seen.add(n)
    };
    expect(verifyTaskEnvelope(task, baseConfig(), deps)).toEqual({ ok: true });
    expect(verifyTaskEnvelope(task, baseConfig(), deps)).toMatchObject({
      ok: false,
      reason: "task nonce replay detected"
    });
  });
});

describe("runner-agent processTask", () => {
  const moduleOutput: ModuleOutput = {
    errors: [],
    evidence: [],
    outcome: "ports_observed",
    signals: [],
    summary: "Reachability observed",
    validationState: "Reachable"
  };

  it("dispatches a verified task and maps the module output to a signed result", async () => {
    const task = signEnvelope(unsignedTask());
    const executor = vi.fn(async () => moduleOutput);

    const result = await processTask(task, baseConfig(), { executor });

    expect(executor).toHaveBeenCalledTimes(1);
    expect(executor).toHaveBeenCalledWith(
      "runner.reachability_check",
      expect.anything()
    );
    expect(result.status).toBe("Completed");
    expect(result.outcome).toBe("ports_observed");
    expect(result.validationState).toBe("Reachable");
    expect(result.taskId).toBe(task.taskId);
    expect(result.runnerId).toBe(RUNNER_ID);
    expect(result.localAuditSha256).toMatch(/^[0-9a-f]{64}$/u);
    // Reachability output has no signals → result carries an empty list.
    expect(result.signals).toEqual([]);
  });

  it("forwards the module's measured signals on the result for control-plane ingestion", async () => {
    const task = signEnvelope(unsignedTask());
    const signal = {
      signalCategory: "Exposure",
      signalSubcategory: "TlsDeprecatedProtocol",
      sourceType: "tls_protocol_audit"
    };
    const executor = vi.fn(
      async () =>
        ({
          ...moduleOutput,
          outcome: "tls_deprecated_protocol",
          signals: [signal],
          validationState: "Validated"
        }) as unknown as typeof moduleOutput
    );

    const result = await processTask(task, baseConfig(), { executor });

    expect(result.status).toBe("Completed");
    expect(result.signals).toHaveLength(1);
    expect(
      (result.signals[0] as Record<string, unknown>).signalSubcategory
    ).toBe("TlsDeprecatedProtocol");
    // The audit hash covers the signals (tamper-evidence over the full body).
    expect(result.localAuditSha256).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("never executes a task that fails verification (Failed, no executor call)", async () => {
    const task = signEnvelope(
      unsignedTask({ moduleId: "exploit.metasploit_check" })
    );
    const executor = vi.fn(async () => moduleOutput);

    const result = await processTask(task, baseConfig(), { executor });

    expect(executor).not.toHaveBeenCalled();
    expect(result.status).toBe("Failed");
    expect(result.errorSummary).toMatch(/not locally allowlisted/u);
  });

  it("returns a Failed result when the module executor throws", async () => {
    const task = signEnvelope(unsignedTask());
    const executor = vi.fn(async () => {
      throw new Error("tool unavailable");
    });

    const result = await processTask(task, baseConfig(), { executor });

    expect(result.status).toBe("Failed");
    expect(result.errorSummary).toBe("tool unavailable");
  });
});

describe("runner-agent pollOnce", () => {
  it("does not poll or execute when the local kill switch is set", async () => {
    const fetchImpl = vi.fn();
    const outcome = await pollOnce(baseConfig({ killSwitch: true }), {
      fetchImpl: fetchImpl as unknown as typeof fetch
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(outcome.skippedForKillSwitch).toBe(true);
  });

  it("skips task execution when the control plane reports the kill switch active", async () => {
    const executor = vi.fn();
    let pollRequest: RequestInit | undefined;
    const fetchImpl = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) => {
        pollRequest = init;
        return new Response(
          JSON.stringify({
            killSwitchActive: true,
            nextPollAfterSeconds: 15,
            tasks: [signEnvelope(unsignedTask())]
          }),
          { status: 200 }
        );
      }
    );
    const outcome = await pollOnce(baseConfig(), {
      executor: executor as never,
      fetchImpl: fetchImpl as unknown as typeof fetch
    });
    expect(outcome.skippedForKillSwitch).toBe(true);
    expect(executor).not.toHaveBeenCalled();
    // Only the poll call, no result submission.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(JSON.parse(pollRequest?.body as string)).toMatchObject({
      health: {
        certificateExpiresAt: "2027-01-01T00:00:00.000Z",
        queueDepth: 0,
        runnerId: RUNNER_ID,
        status: "Active",
        tenantId: TENANT_ID,
        version: "0.1.0"
      }
    });
  });

  it("verifies, executes, and submits a signed result for each polled task", async () => {
    const task = signEnvelope(unsignedTask());
    const executor = vi.fn(async () => ({
      errors: [],
      evidence: [],
      outcome: "ports_observed",
      signals: [],
      summary: "ok",
      validationState: "Reachable"
    }));
    const calls: Array<{ url: string; body: unknown }> = [];
    const fetchImpl = vi.fn(
      async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({ body: init?.body, url: String(url) });
        if (String(url).endsWith("/poll")) {
          return new Response(
            JSON.stringify({
              killSwitchActive: false,
              nextPollAfterSeconds: 20,
              tasks: [task]
            }),
            { status: 200 }
          );
        }
        if (String(url).includes(`/tasks/${task.taskId}/artifacts`)) {
          return new Response(
            JSON.stringify({
              artifact: {
                evidenceId: "77777777-7777-4777-8777-777777777777",
                redactionStatus: "Redacted",
                sha256: "artifact-sha"
              }
            }),
            { status: 201 }
          );
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
    );

    const outcome = await pollOnce(baseConfig(), {
      executor: executor as never,
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    expect(executor).toHaveBeenCalledTimes(1);
    expect(outcome.submitted).toHaveLength(1);
    expect(outcome.submitted[0]!.status).toBe("Completed");
    expect(outcome.submitted[0]!.evidenceManifest).toHaveLength(1);
    // Poll + artifact upload + result submit, with auth headers and the result
    // POSTed to the task only after a redacted evidence artifact exists.
    const upload = calls.find((call) =>
      call.url.includes(`/tasks/${task.taskId}/artifacts`)
    );
    expect(upload).toBeDefined();
    const submit = calls.find((call) =>
      call.url.includes(`/tasks/${task.taskId}/result`)
    );
    expect(submit).toBeDefined();
    const submittedBody = JSON.parse(submit!.body as string);
    expect(submittedBody.status).toBe("Completed");
    expect(submittedBody.evidenceManifest[0]).toMatchObject({
      artifactType: "NormalizedEvidence",
      evidenceId: "77777777-7777-4777-8777-777777777777",
      redactionStatus: "Redacted"
    });
  });
});

describe("signResult", () => {
  const resultKeys = generateKeyPairSync("ed25519");
  const RESULT_PRIVATE_PEM = resultKeys.privateKey
    .export({ format: "pem", type: "pkcs8" })
    .toString();
  const RESULT_PUBLIC_PEM = resultKeys.publicKey
    .export({ format: "pem", type: "spki" })
    .toString();

  const baseResult = {
    completedAt: new Date(0).toISOString(),
    errorSummary: null,
    evidenceManifest: [],
    localAuditSha256: "a".repeat(64),
    outcome: "ok",
    runId: randomUUID(),
    runnerId: RUNNER_ID,
    signals: [],
    startedAt: new Date(0).toISOString(),
    status: "Completed" as const,
    taskId: randomUUID(),
    tenantId: TENANT_ID,
    validationState: "Validated"
  };

  it("signs localAuditSha256 with a verifiable Ed25519 signature when a key is configured", () => {
    const signed = signResult(
      baseConfig({ resultSigningPrivateKeyPem: RESULT_PRIVATE_PEM }),
      baseResult
    );
    expect(signed.resultSignature).toBeTruthy();
    // The control plane verifies exactly this way (verify over localAuditSha256).
    const verified = cryptoVerify(
      null,
      Buffer.from(signed.localAuditSha256, "utf8"),
      createPublicKey(RESULT_PUBLIC_PEM),
      Buffer.from(signed.resultSignature!, "base64")
    );
    expect(verified).toBe(true);
  });

  it("leaves the result unsigned in legacy mode (no key configured)", () => {
    const signed = signResult(baseConfig(), baseResult);
    expect(signed.resultSignature).toBeUndefined();
  });
});

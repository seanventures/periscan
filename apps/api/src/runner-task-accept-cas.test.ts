import { createHash, randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import type { RuntimeServiceDeps } from "./runtime-services.js";
import { createRunnerServices } from "./services/runner.js";

function hashSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

describe("acceptRunnerTask CAS + kill switch", () => {
  const runnerId = randomUUID();
  const taskId = randomUUID();
  const tenantId = randomUUID();
  const missionId = randomUUID();
  const runId = randomUUID();
  const scopeId = randomUUID();
  const authToken = "prra_accept_cas_token";
  const authTokenHash = hashSecret(authToken);
  const observedAt = new Date().toISOString();
  const now = new Date();

  function acceptedTaskRecord() {
    const expiresAt = new Date(Date.now() + 60_000);
    const scopeConstraints = {
      approvedCidrs: [],
      approvedDnsSuffixes: ["corp.internal"],
      approvedHostnames: ["gateway.corp.internal"],
      approvedPorts: [443],
      forbidInternetEgress: true
    };
    const target = { host: "gateway.corp.internal", ports: [443] };
    const signature = {
      algorithm: "EdDSA",
      digestSha256: "a".repeat(64),
      keyId: "task-signing-key",
      nonce: "nonce-1",
      signature: "sig-1"
    };
    const envelope = {
      artifactUpload: {
        artifactUploadUrl: "https://runner.periscan.cloud/artifacts",
        maxArtifactBytes: 1_048_576,
        resultCallbackUrl: "https://runner.periscan.cloud/results"
      },
      executionEnvironment: "InternalRunner",
      expiresAt: expiresAt.toISOString(),
      inputs: {},
      issuedAt: now.toISOString(),
      missionId,
      moduleId: "internal.reachability",
      runId,
      runnerId,
      safetyLevel: "BASLite",
      scopeConstraints,
      scopeId,
      signature,
      target,
      taskId,
      tenantId
    };

    return {
      acceptedAt: new Date(observedAt),
      completedAt: null,
      createdAt: now,
      envelope,
      errorSummary: null,
      expiresAt,
      inputPayloadHash: null,
      inputs: {},
      issuedAt: now,
      leasedAt: now,
      localAuditHash: null,
      missionId,
      moduleId: "internal.reachability",
      moduleVersion: "1.0.0",
      normalizedOutput: null,
      redactedEvidenceIds: [],
      rejectedReason: null,
      resourceUsage: null,
      result: null,
      runId,
      runnerId,
      safetyLevel: "BASLite",
      scopeConstraints,
      scopeId,
      status: "Accepted",
      target,
      taskId,
      taskType: "ReachabilityProbe",
      tenantId,
      updatedAt: now
    };
  }

  function buildServices(input: {
    killSwitchActive?: boolean;
    taskStatus: string;
    updateManyCount: number;
  }) {
    const updateMany = vi
      .fn()
      .mockResolvedValue({ count: input.updateManyCount });
    const findUniqueOrThrow = vi.fn().mockResolvedValue(acceptedTaskRecord());
    const auditCreate = vi.fn().mockResolvedValue({});

    const services = createRunnerServices({
      availableDataRegions: ["us-east-1"],
      dataRegion: "us-east-1",
      devMode: true,
      emailTransport: { send: vi.fn() },
      prisma: {
        auditEvent: { create: auditCreate },
        runner: {
          findUnique: vi.fn().mockResolvedValue({
            authTokenHash,
            certificateSha256: null,
            killSwitchActive: input.killSwitchActive ?? false,
            resultSigningPublicKeyPem: null,
            runnerId,
            status: input.killSwitchActive ? "KillSwitchActive" : "Active",
            tenantId
          })
        },
        runnerTask: {
          findFirst: vi.fn().mockResolvedValue({
            expiresAt: new Date(Date.now() + 60_000),
            runnerId,
            status: input.taskStatus,
            taskId,
            tenantId
          }),
          findUniqueOrThrow,
          updateMany
        }
      },
      webBaseUrl: "http://localhost:3000"
    } as unknown as RuntimeServiceDeps);

    return { auditCreate, findUniqueOrThrow, services, updateMany };
  }

  it("refuses accept while the runner kill switch is active", async () => {
    const { services, updateMany } = buildServices({
      killSwitchActive: true,
      taskStatus: "Leased",
      updateManyCount: 1
    });

    await expect(
      services.acceptRunnerTask(runnerId, taskId, authToken, {
        observedAt,
        runnerId,
        tenantId
      })
    ).rejects.toMatchObject({
      code: "runner_kill_switch_active",
      statusCode: 409
    });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("does not resurrect a kill-switched DeniedByServerPolicy task via soft-checked accept", async () => {
    const { services, updateMany, findUniqueOrThrow } = buildServices({
      taskStatus: "Leased",
      updateManyCount: 0
    });

    await expect(
      services.acceptRunnerTask(runnerId, taskId, authToken, {
        observedAt,
        runnerId,
        tenantId
      })
    ).rejects.toMatchObject({
      code: "runner_task_invalid_state",
      statusCode: 409
    });

    expect(updateMany).toHaveBeenCalledWith({
      data: {
        acceptedAt: expect.any(Date),
        status: "Accepted"
      },
      where: {
        expiresAt: { gt: expect.any(Date) },
        runnerId,
        status: { in: ["Queued", "Leased"] },
        taskId,
        tenantId
      }
    });
    expect(findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("accepts only when the CAS claim wins against Queued/Leased", async () => {
    const { services, updateMany, findUniqueOrThrow } = buildServices({
      taskStatus: "Leased",
      updateManyCount: 1
    });

    const accepted = await services.acceptRunnerTask(
      runnerId,
      taskId,
      authToken,
      {
        observedAt,
        runnerId,
        tenantId
      }
    );

    expect(accepted.status).toBe("Accepted");
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(findUniqueOrThrow).toHaveBeenCalledWith({ where: { taskId } });
  });
});

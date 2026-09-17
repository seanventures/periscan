import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { expireStaleRunnerTasks } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";

/**
 * Slice 10 release-qual — runner multi-node failure / lease recovery drill.
 *
 * Phase A gate (SLICE10_PATH_TO_95): multi-node lease recovery must be
 * exercised, not only documented. Scenario:
 *   - Silent runner A holds an overdue Leased task → reaper Expires task +
 *     Fails the stranded validation run.
 *   - Healthy runner B holds a still-valid Leased task → untouched.
 *
 * Complements runner-task-reaper-flow (single-runner stale vs live). This suite
 * proves isolation of reaper impact across runners in one tenant fleet.
 */
describe("Runner multi-node lease recovery drill", () => {
  it("expires only silent-runner overdue leases; healthy runner work continues", async () => {
    const prisma = createPrismaClient();

    try {
      const signup = await prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            dataRegion: "us-east-1",
            name: "Multi-Node Reaper Tenant",
            type: "Organization"
          }
        });
        const user = await tx.user.create({
          data: {
            email: `mn-reaper-${randomUUID()}@periscan.test`,
            name: "Multi-Node Reaper Owner",
            passwordHash: "x",
            status: "Active"
          }
        });
        const scope = await tx.scope.create({
          data: {
            createdBy: user.userId,
            scopeType: "Domain",
            tenantId: tenant.tenantId,
            value: `mn-reaper-${randomUUID()}.example.com`,
            verificationStatus: "Verified"
          }
        });
        const mission = await tx.validationMission.create({
          data: {
            evidenceIds: [],
            missionType: "ControlValidation",
            requestedBy: user.userId,
            safetyLevel: "PassiveReadOnly",
            scopeId: scope.scopeId,
            scopeIds: [scope.scopeId],
            status: "Running",
            tenantId: tenant.tenantId
          }
        });
        return { mission, scope, tenant };
      });
      const { mission, scope, tenant } = signup;

      const silentRunner = await prisma.runner.create({
        data: {
          arch: "amd64",
          authTokenHash: "hash-silent",
          capabilities: {},
          deploymentMode: "Docker",
          hostname: "silent-node",
          labels: [],
          name: "Silent Node",
          networkProfile: {},
          os: "linux",
          status: "Active",
          tenantId: tenant.tenantId,
          transportMode: "LongPollHttps",
          version: "1.0.0"
        }
      });
      const healthyRunner = await prisma.runner.create({
        data: {
          arch: "amd64",
          authTokenHash: "hash-healthy",
          capabilities: {},
          deploymentMode: "Docker",
          hostname: "healthy-node",
          labels: [],
          name: "Healthy Node",
          networkProfile: {},
          os: "linux",
          status: "Active",
          tenantId: tenant.tenantId,
          transportMode: "LongPollHttps",
          version: "1.0.0"
        }
      });

      async function makeTaskWithRun(input: {
        expiresAt: Date;
        runnerId: string;
      }) {
        const run = await prisma.validationRun.create({
          data: {
            evidenceIds: [],
            missionId: mission.missionId,
            moduleId: "atomic.control_validation_safe",
            runnerId: input.runnerId,
            safetyLevel: "PassiveReadOnly",
            scopeId: scope.scopeId,
            status: "Running",
            target: {},
            techniqueIds: [],
            tenantId: tenant.tenantId
          }
        });
        const task = await prisma.runnerTask.create({
          data: {
            envelope: {},
            expiresAt: input.expiresAt,
            inputs: {},
            issuedAt: new Date(Date.now() - 3_600_000),
            missionId: mission.missionId,
            moduleId: "atomic.control_validation_safe",
            nonce: randomUUID(),
            runId: run.runId,
            runnerId: input.runnerId,
            safetyLevel: "PassiveReadOnly",
            scopeConstraints: {},
            scopeId: scope.scopeId,
            status: "Leased",
            target: {},
            tenantId: tenant.tenantId
          }
        });
        return { run, task };
      }

      const staleOnSilent = await makeTaskWithRun({
        expiresAt: new Date(Date.now() - 60_000),
        runnerId: silentRunner.runnerId
      });
      const liveOnHealthy = await makeTaskWithRun({
        expiresAt: new Date(Date.now() + 600_000),
        runnerId: healthyRunner.runnerId
      });
      // Extra: overdue task already on the healthy runner should still expire
      // (reaper is task-expiry based, not "silence of lastSeen" alone) — proves
      // multi-node does not privilege a runner identity over lease expiry.
      const overdueOnHealthy = await makeTaskWithRun({
        expiresAt: new Date(Date.now() - 30_000),
        runnerId: healthyRunner.runnerId
      });

      const result = await expireStaleRunnerTasks(prisma);
      expect(result.expiredTaskCount).toBeGreaterThanOrEqual(0);
      expect(result.failedRunCount).toBeGreaterThanOrEqual(0);

      const staleTask = await prisma.runnerTask.findUniqueOrThrow({
        where: { taskId: staleOnSilent.task.taskId }
      });
      const staleRun = await prisma.validationRun.findUniqueOrThrow({
        where: { runId: staleOnSilent.run.runId }
      });
      expect(staleTask.status).toBe("Expired");
      expect(staleRun.status).toBe("Failed");
      expect(staleRun.errorSummary).toContain("expired");

      const liveTask = await prisma.runnerTask.findUniqueOrThrow({
        where: { taskId: liveOnHealthy.task.taskId }
      });
      const liveRun = await prisma.validationRun.findUniqueOrThrow({
        where: { runId: liveOnHealthy.run.runId }
      });
      expect(liveTask.status).toBe("Leased");
      expect(liveRun.status).toBe("Running");

      const overdueHealthyTask = await prisma.runnerTask.findUniqueOrThrow({
        where: { taskId: overdueOnHealthy.task.taskId }
      });
      const overdueHealthyRun = await prisma.validationRun.findUniqueOrThrow({
        where: { runId: overdueOnHealthy.run.runId }
      });
      expect(overdueHealthyTask.status).toBe("Expired");
      expect(overdueHealthyRun.status).toBe("Failed");
    } finally {
      await prisma.$disconnect();
    }
  }, 30_000);
});

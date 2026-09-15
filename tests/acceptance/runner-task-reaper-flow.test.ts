import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { expireStaleRunnerTasks } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";

/**
 * A runner task stuck on a dead/silent runner (its own poll never fires to
 * expire it) is reclaimed by the system-wide reaper, and the validation run it
 * stranded is failed so it does not hang forever. A still-valid task and its run
 * are left untouched.
 */
describe("Stale runner-task reaper", () => {
  it("expires overdue tasks from silent runners and fails their stranded runs", async () => {
    const prisma = createPrismaClient();

    try {
      const signup = await prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            dataRegion: "us-east-1",
            name: "Reaper Tenant",
            type: "Organization"
          }
        });
        const user = await tx.user.create({
          data: {
            email: `reaper-${randomUUID()}@periscan.test`,
            name: "Reaper Owner",
            passwordHash: "x",
            status: "Active"
          }
        });
        const scope = await tx.scope.create({
          data: {
            createdBy: user.userId,
            scopeType: "Domain",
            tenantId: tenant.tenantId,
            value: `reaper-${randomUUID()}.example.com`,
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

      const runner = await prisma.runner.create({
        data: {
          arch: "amd64",
          authTokenHash: "hash",
          capabilities: {},
          deploymentMode: "Docker",
          hostname: "silent-runner",
          labels: [],
          name: "Silent Runner",
          networkProfile: {},
          os: "linux",
          status: "Active",
          tenantId: tenant.tenantId,
          transportMode: "LongPollHttps",
          version: "1.0.0"
        }
      });

      async function makeTaskWithRun(expiresAt: Date) {
        const run = await prisma.validationRun.create({
          data: {
            evidenceIds: [],
            missionId: mission.missionId,
            moduleId: "atomic.control_validation_safe",
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
            expiresAt,
            inputs: {},
            issuedAt: new Date(Date.now() - 3_600_000),
            missionId: mission.missionId,
            moduleId: "atomic.control_validation_safe",
            nonce: randomUUID(),
            runId: run.runId,
            runnerId: runner.runnerId,
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

      // One task is overdue (the runner went silent); one is still valid.
      const stale = await makeTaskWithRun(new Date(Date.now() - 60_000));
      const live = await makeTaskWithRun(new Date(Date.now() + 600_000));

      // expireStaleRunnerTasks is GLOBAL; the continuous-validation sweep (driven
      // by sibling acceptance tests in parallel) also runs it, so a concurrent
      // reaper may have expired this task first — then this call's per-call
      // counts are 0. Assert the well-formed shape here and verify the DURABLE
      // per-entity outcome below, which holds regardless of which reaper call
      // did the work.
      const result = await expireStaleRunnerTasks(prisma);
      expect(result.expiredTaskCount).toBeGreaterThanOrEqual(0);
      expect(result.failedRunCount).toBeGreaterThanOrEqual(0);

      const staleTask = await prisma.runnerTask.findUniqueOrThrow({
        where: { taskId: stale.task.taskId }
      });
      const staleRun = await prisma.validationRun.findUniqueOrThrow({
        where: { runId: stale.run.runId }
      });
      expect(staleTask.status).toBe("Expired");
      expect(staleRun.status).toBe("Failed");
      expect(staleRun.errorSummary).toContain("expired");

      // The still-valid task and its run are untouched.
      const liveTask = await prisma.runnerTask.findUniqueOrThrow({
        where: { taskId: live.task.taskId }
      });
      const liveRun = await prisma.validationRun.findUniqueOrThrow({
        where: { runId: live.run.runId }
      });
      expect(liveTask.status).toBe("Leased");
      expect(liveRun.status).toBe("Running");
    } finally {
      await prisma.$disconnect();
    }
  }, 30_000);
});

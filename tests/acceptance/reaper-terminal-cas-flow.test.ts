import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  expireStaleRunnerTasks,
  failStuckRunningJobs
} from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";

/**
 * Reaper updateMany must CAS on status so a Completed task/job that lands in the
 * findMany→updateMany window is not clobbered to Expired/Failed.
 */
describe("Reaper terminal-state CAS", () => {
  it("does not overwrite tasks/jobs completed between findMany and updateMany", async () => {
    const prisma = createPrismaClient();

    try {
      const { mission, scope, tenant } = await prisma.$transaction(async (tx) => {
        const tenantRecord = await tx.tenant.create({
          data: {
            dataRegion: "us-east-1",
            name: "Reaper CAS Tenant",
            type: "Organization"
          }
        });
        const user = await tx.user.create({
          data: {
            email: `reaper-cas-${randomUUID()}@periscan.test`,
            name: "Reaper CAS Owner",
            passwordHash: "x",
            status: "Active"
          }
        });
        const scopeRecord = await tx.scope.create({
          data: {
            createdBy: user.userId,
            scopeType: "Domain",
            tenantId: tenantRecord.tenantId,
            value: `reaper-cas-${randomUUID()}.example.com`,
            verificationStatus: "Verified"
          }
        });
        const missionRecord = await tx.validationMission.create({
          data: {
            evidenceIds: [],
            missionType: "ControlValidation",
            requestedBy: user.userId,
            safetyLevel: "PassiveReadOnly",
            scopeId: scopeRecord.scopeId,
            scopeIds: [scopeRecord.scopeId],
            status: "Running",
            tenantId: tenantRecord.tenantId
          }
        });
        return {
          mission: missionRecord,
          scope: scopeRecord,
          tenant: tenantRecord
        };
      });

      const runner = await prisma.runner.create({
        data: {
          arch: "amd64",
          authTokenHash: "hash",
          capabilities: {},
          deploymentMode: "Docker",
          hostname: "cas-runner",
          labels: [],
          name: "CAS Runner",
          networkProfile: {},
          os: "linux",
          status: "Active",
          tenantId: tenant.tenantId,
          transportMode: "LongPollHttps",
          version: "1.0.0"
        }
      });

      const racingRun = await prisma.validationRun.create({
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
      const racingTask = await prisma.runnerTask.create({
        data: {
          envelope: {},
          expiresAt: new Date(Date.now() - 60_000),
          inputs: {},
          issuedAt: new Date(Date.now() - 3_600_000),
          missionId: mission.missionId,
          moduleId: "atomic.control_validation_safe",
          nonce: randomUUID(),
          runId: racingRun.runId,
          runnerId: runner.runnerId,
          safetyLevel: "PassiveReadOnly",
          scopeConstraints: {},
          scopeId: scope.scopeId,
          status: "Leased",
          target: {},
          tenantId: tenant.tenantId
        }
      });

      const racingJobRun = await prisma.validationRun.create({
        data: {
          evidenceIds: [],
          missionId: mission.missionId,
          moduleId: "atomic.control_validation_safe",
          safetyLevel: "PassiveReadOnly",
          scopeId: scope.scopeId,
          startedAt: new Date(Date.now() - 60 * 60 * 1000),
          status: "Running",
          target: {},
          techniqueIds: [],
          tenantId: tenant.tenantId
        }
      });
      const racingJob = await prisma.job.create({
        data: {
          missionId: mission.missionId,
          payload: { runId: racingJobRun.runId },
          queueName: "validation",
          startedAt: new Date(Date.now() - 60 * 60 * 1000),
          status: "Running",
          tenantId: tenant.tenantId,
          validationRunId: racingJobRun.runId
        }
      });

      // Simulate submit/worker completing in the findMany→updateMany window.
      const originalTaskFindMany = prisma.runnerTask.findMany.bind(
        prisma.runnerTask
      );
      prisma.runnerTask.findMany = (async (...args: unknown[]) => {
        const rows = await originalTaskFindMany(
          ...(args as Parameters<typeof originalTaskFindMany>)
        );
        const ours = rows.filter(
          (row: { taskId: string }) => row.taskId === racingTask.taskId
        );
        if (ours.length > 0) {
          await prisma.runnerTask.update({
            data: {
              completedAt: new Date(),
              status: "Completed"
            },
            where: { taskId: racingTask.taskId }
          });
          await prisma.validationRun.update({
            data: {
              completedAt: new Date(),
              status: "Completed"
            },
            where: { runId: racingRun.runId }
          });
        }
        return rows;
      }) as typeof prisma.runnerTask.findMany;

      const originalJobFindMany = prisma.job.findMany.bind(prisma.job);
      prisma.job.findMany = (async (...args: unknown[]) => {
        const rows = await originalJobFindMany(
          ...(args as Parameters<typeof originalJobFindMany>)
        );
        const ours = rows.filter(
          (row: { jobId: string }) => row.jobId === racingJob.jobId
        );
        if (ours.length > 0) {
          await prisma.job.update({
            data: {
              completedAt: new Date(),
              status: "Completed"
            },
            where: { jobId: racingJob.jobId }
          });
          await prisma.validationRun.update({
            data: {
              completedAt: new Date(),
              status: "Completed"
            },
            where: { runId: racingJobRun.runId }
          });
        }
        return rows;
      }) as typeof prisma.job.findMany;

      try {
        await expireStaleRunnerTasks(prisma);
        await failStuckRunningJobs(prisma);
      } finally {
        prisma.runnerTask.findMany = originalTaskFindMany;
        prisma.job.findMany = originalJobFindMany;
      }

      const taskAfter = await prisma.runnerTask.findUniqueOrThrow({
        where: { taskId: racingTask.taskId }
      });
      const runAfter = await prisma.validationRun.findUniqueOrThrow({
        where: { runId: racingRun.runId }
      });
      expect(taskAfter.status).toBe("Completed");
      expect(runAfter.status).toBe("Completed");

      const jobAfter = await prisma.job.findUniqueOrThrow({
        where: { jobId: racingJob.jobId }
      });
      const jobRunAfter = await prisma.validationRun.findUniqueOrThrow({
        where: { runId: racingJobRun.runId }
      });
      expect(jobAfter.status).toBe("Completed");
      expect(jobRunAfter.status).toBe("Completed");
    } finally {
      await prisma.$disconnect();
    }
  }, 30_000);
});

import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { failStuckRunningJobs } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";

/**
 * A validation job claimed as Running whose worker crashes mid-execution never
 * reports completion, so the job and its validation run would hang forever. The
 * system-wide stuck-job reaper fails jobs that exceed the execution window and
 * the runs they stranded; a recently-started job is left alone.
 */
describe("Stuck running-job reaper", () => {
  it("fails jobs stuck in Running past the window and their stranded runs", async () => {
    const prisma = createPrismaClient();

    try {
      const { mission, scope, tenant } = await prisma.$transaction(
        async (tx) => {
          const tenantRecord = await tx.tenant.create({
            data: {
              dataRegion: "us-east-1",
              name: "Stuck Job Tenant",
              type: "Organization"
            }
          });
          const user = await tx.user.create({
            data: {
              email: `stuck-${randomUUID()}@periscan.test`,
              name: "Stuck Owner",
              passwordHash: "x",
              status: "Active"
            }
          });
          const scopeRecord = await tx.scope.create({
            data: {
              createdBy: user.userId,
              scopeType: "Domain",
              tenantId: tenantRecord.tenantId,
              value: `stuck-${randomUUID()}.example.com`,
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
        }
      );

      async function makeRunningJob(startedAt: Date) {
        const run = await prisma.validationRun.create({
          data: {
            evidenceIds: [],
            missionId: mission.missionId,
            moduleId: "atomic.control_validation_safe",
            safetyLevel: "PassiveReadOnly",
            scopeId: scope.scopeId,
            startedAt,
            status: "Running",
            target: {},
            techniqueIds: [],
            tenantId: tenant.tenantId
          }
        });
        const job = await prisma.job.create({
          data: {
            missionId: mission.missionId,
            payload: { runId: run.runId },
            queueName: "validation",
            startedAt,
            status: "Running",
            tenantId: tenant.tenantId,
            validationRunId: run.runId
          }
        });
        return { job, run };
      }

      // One job has been Running for an hour (worker died); one just started.
      const stuck = await makeRunningJob(new Date(Date.now() - 60 * 60 * 1000));
      const fresh = await makeRunningJob(new Date());

      // failStuckRunningJobs is GLOBAL and also runs inside the
      // continuous-validation sweep (driven by sibling tests in parallel), so a
      // concurrent reaper may fail this job first and zero this call's counts.
      // Assert the shape here; the DURABLE per-entity outcome is verified below.
      const result = await failStuckRunningJobs(prisma);
      expect(result.failedJobCount).toBeGreaterThanOrEqual(0);
      expect(result.failedRunCount).toBeGreaterThanOrEqual(0);

      const stuckJob = await prisma.job.findUniqueOrThrow({
        where: { jobId: stuck.job.jobId }
      });
      const stuckRun = await prisma.validationRun.findUniqueOrThrow({
        where: { runId: stuck.run.runId }
      });
      expect(stuckJob.status).toBe("Failed");
      expect(stuckRun.status).toBe("Failed");
      expect(stuckRun.errorSummary).toContain("execution window");

      // The freshly-started job and its run are untouched.
      const freshJob = await prisma.job.findUniqueOrThrow({
        where: { jobId: fresh.job.jobId }
      });
      const freshRun = await prisma.validationRun.findUniqueOrThrow({
        where: { runId: fresh.run.runId }
      });
      expect(freshJob.status).toBe("Running");
      expect(freshRun.status).toBe("Running");
    } finally {
      await prisma.$disconnect();
    }
  }, 30_000);
});

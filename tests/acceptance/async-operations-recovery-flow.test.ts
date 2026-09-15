import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

const SESSION_COOKIE_NAME = "periscan_session";

describe("asynchronous operations recovery", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "async-operations-owner",
        "async-operations-outsider"
      ]);
      await prisma.$disconnect();
    }
  });

  it("reconciles only tenant-stale work and prepares a fresh policy-gated recovery draft", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        prisma
      })
    });

    try {
      const owner = await testHelpers.performSignup(
        app,
        "async-operations-owner",
        "Async Operations Tenant"
      );
      const outsider = await testHelpers.performSignup(
        app,
        "async-operations-outsider",
        "Async Operations Outsider"
      );
      const ownerCookies = { [SESSION_COOKIE_NAME]: owner.cookie };
      const outsiderCookies = { [SESSION_COOKIE_NAME]: outsider.cookie };
      const tenantId = owner.response.json().tenant.tenantId as string;
      const ownerUserId = owner.response.json().user.userId as string;
      const outsiderTenantId = outsider.response.json().tenant
        .tenantId as string;
      const outsiderUserId = outsider.response.json().user.userId as string;

      const empty = await app.inject({
        cookies: ownerCookies,
        method: "GET",
        url: "/api/v1/async-operations/workspace"
      });
      expect(empty.statusCode).toBe(200);
      expect(empty.json()).toMatchObject({
        events: [],
        policy: null,
        summary: { configured: false, health: "NotConfigured" },
        workItems: []
      });

      const scope = await prisma.scope.create({
        data: {
          createdBy: ownerUserId,
          maxSafetyLevel: "BASLite",
          scopeType: "Domain",
          tenantId,
          value: "async-operations.example.test",
          verificationMethod: "Acceptance fixture",
          verificationStatus: "Verified",
          verifiedAt: new Date(),
          verifiedBy: ownerUserId
        }
      });
      const mission = await prisma.validationMission.create({
        data: {
          evidenceIds: [],
          missionType: "ValidationSnapshot",
          requestedBy: ownerUserId,
          safetyLevel: "ActiveNonInvasive",
          scopeId: scope.scopeId,
          scopeIds: [scope.scopeId],
          status: "Running",
          tenantId
        }
      });
      const jobRun = await prisma.validationRun.create({
        data: {
          evidenceIds: [],
          missionId: mission.missionId,
          moduleId: "periscan.http_health_check",
          safetyLevel: "ActiveNonInvasive",
          scopeId: scope.scopeId,
          status: "Running",
          target: { hostname: "api.async-operations.example.test" },
          tenantId
        }
      });
      const staleJob = await prisma.job.create({
        data: {
          attempts: 2,
          missionId: mission.missionId,
          payload: { moduleId: "periscan.http_health_check" },
          queueName: "validation",
          startedAt: new Date(Date.now() - 2 * 60 * 60 * 1_000),
          status: "Running",
          tenantId,
          validationRunId: jobRun.runId
        }
      });
      const runnerRun = await prisma.validationRun.create({
        data: {
          evidenceIds: [],
          missionId: mission.missionId,
          moduleId: "periscan.tls_protocol_audit",
          safetyLevel: "ActiveNonInvasive",
          scopeId: scope.scopeId,
          status: "Running",
          target: { hostname: "tls.async-operations.example.test" },
          tenantId
        }
      });
      const runner = await prisma.runner.create({
        data: {
          arch: "amd64",
          authTokenHash: "acceptance-only-runner-token-hash",
          capabilities: { supportsLongPoll: true },
          createdBy: ownerUserId,
          deploymentMode: "Docker",
          hostname: "runner.async-operations.example.test",
          labels: ["acceptance"],
          name: "Async operations runner",
          networkProfile: { outboundHttpsPorts: [443] },
          os: "linux",
          status: "Active",
          tenantId,
          transportMode: "LongPollHttps",
          version: "0.1.0"
        }
      });
      const expiredRunnerTask = await prisma.runnerTask.create({
        data: {
          acceptedAt: new Date(Date.now() - 10 * 60 * 1_000),
          envelope: { signed: true },
          expiresAt: new Date(Date.now() - 60 * 1_000),
          inputs: {},
          issuedAt: new Date(Date.now() - 20 * 60 * 1_000),
          leasedAt: new Date(Date.now() - 15 * 60 * 1_000),
          missionId: mission.missionId,
          moduleId: "periscan.tls_protocol_audit",
          nonce: "async-operations-acceptance-nonce",
          redactedEvidenceIds: [],
          runId: runnerRun.runId,
          runnerId: runner.runnerId,
          safetyLevel: "ActiveNonInvasive",
          scopeConstraints: { approvedScopeIds: [scope.scopeId] },
          scopeId: scope.scopeId,
          status: "Accepted",
          target: { hostname: "tls.async-operations.example.test" },
          tenantId
        }
      });

      const outsiderScope = await prisma.scope.create({
        data: {
          createdBy: outsiderUserId,
          scopeType: "Domain",
          tenantId: outsiderTenantId,
          value: "outsider-async-operations.example.test",
          verificationStatus: "Verified",
          verifiedAt: new Date(),
          verifiedBy: outsiderUserId
        }
      });
      const outsiderMission = await prisma.validationMission.create({
        data: {
          evidenceIds: [],
          missionType: "ValidationSnapshot",
          requestedBy: outsiderUserId,
          safetyLevel: "ActiveNonInvasive",
          scopeId: outsiderScope.scopeId,
          scopeIds: [outsiderScope.scopeId],
          status: "Running",
          tenantId: outsiderTenantId
        }
      });
      const outsiderRun = await prisma.validationRun.create({
        data: {
          evidenceIds: [],
          missionId: outsiderMission.missionId,
          moduleId: "periscan.http_health_check",
          safetyLevel: "ActiveNonInvasive",
          scopeId: outsiderScope.scopeId,
          status: "Running",
          target: { hostname: outsiderScope.value },
          tenantId: outsiderTenantId
        }
      });
      const outsiderJob = await prisma.job.create({
        data: {
          missionId: outsiderMission.missionId,
          payload: { moduleId: "periscan.http_health_check" },
          queueName: "validation",
          startedAt: new Date(Date.now() - 2 * 60 * 60 * 1_000),
          status: "Running",
          tenantId: outsiderTenantId,
          validationRunId: outsiderRun.runId
        }
      });

      const configured = await app.inject({
        cookies: ownerCookies,
        method: "PUT",
        payload: {
          escalationChannel: "pagerduty://security-operations",
          queueAgeTargetSeconds: 60,
          reviewReference: "OPS-RUNBOOK-ASYNC-001",
          runnerLeaseWarningSeconds: 60,
          runningTimeoutSeconds: 60,
          supportOwner: "Security Operations"
        },
        url: "/api/v1/async-operations/policy"
      });
      expect(configured.statusCode).toBe(200);
      expect(configured.json()).toMatchObject({
        policy: {
          reviewReference: "OPS-RUNBOOK-ASYNC-001",
          runningTimeoutSeconds: 60
        },
        summary: { configured: true, health: "Critical", stalledCount: 2 }
      });
      expect(configured.json().limitations.join(" ")).toContain(
        "not externally audited availability SLOs"
      );

      const outsiderWorkspace = await app.inject({
        cookies: outsiderCookies,
        method: "GET",
        url: "/api/v1/async-operations/workspace"
      });
      expect(outsiderWorkspace.statusCode).toBe(200);
      expect(outsiderWorkspace.json().policy).toBeNull();
      expect(
        outsiderWorkspace
          .json()
          .workItems.some(
            (item: { workloadId: string }) =>
              item.workloadId === staleJob.jobId ||
              item.workloadId === expiredRunnerTask.taskId
          )
      ).toBe(false);

      const reconciled = await app.inject({
        cookies: ownerCookies,
        method: "POST",
        payload: {
          reason: "Terminalize work beyond reviewed operating boundaries.",
          reference: "INC-ASYNC-2026-001"
        },
        url: "/api/v1/async-operations/reconcile"
      });
      expect(reconciled.statusCode).toBe(200);
      expect(reconciled.json()).toMatchObject({
        event: { eventType: "Reconciled", integrityVerified: true },
        expiredRunnerTaskCount: 1,
        failedJobCount: 1,
        failedRunCount: 2
      });
      expect(
        await prisma.job.findUniqueOrThrow({ where: { jobId: staleJob.jobId } })
      ).toMatchObject({ status: "Failed" });
      expect(
        await prisma.runnerTask.findUniqueOrThrow({
          where: { taskId: expiredRunnerTask.taskId }
        })
      ).toMatchObject({ status: "Expired" });
      expect(
        await prisma.job.findUniqueOrThrow({
          where: { jobId: outsiderJob.jobId }
        })
      ).toMatchObject({ status: "Running" });

      const prepared = await app.inject({
        cookies: ownerCookies,
        method: "POST",
        payload: {
          decision: "PrepareRecovery",
          reason: "Prepare a fresh run for a newly reviewed policy decision.",
          reference: "INC-ASYNC-2026-001",
          workloadId: staleJob.jobId,
          workloadKind: "ValidationJob"
        },
        url: "/api/v1/async-operations/recovery-decisions"
      });
      expect(prepared.statusCode).toBe(200);
      expect(prepared.json()).toMatchObject({
        event: {
          eventType: "RecoveryPrepared",
          integrityVerified: true,
          result: { directReplay: false, policyDecisionCopied: false }
        }
      });
      const recoveryMissionId = prepared.json().recoveryMissionId as string;
      expect(
        await prisma.validationMission.findUniqueOrThrow({
          where: { missionId: recoveryMissionId }
        })
      ).toMatchObject({ policyDecisionId: null, status: "Draft" });
      expect(
        await prisma.validationRun.count({
          where: { missionId: recoveryMissionId }
        })
      ).toBe(0);
      expect(
        await prisma.job.count({ where: { missionId: recoveryMissionId } })
      ).toBe(0);
      expect(
        await prisma.runnerTask.count({
          where: { missionId: recoveryMissionId }
        })
      ).toBe(0);

      const duplicate = await app.inject({
        cookies: ownerCookies,
        method: "POST",
        payload: {
          decision: "PrepareRecovery",
          reason: "A duplicate recovery draft must never be created.",
          reference: "INC-ASYNC-2026-001-DUPLICATE",
          workloadId: staleJob.jobId,
          workloadKind: "ValidationJob"
        },
        url: "/api/v1/async-operations/recovery-decisions"
      });
      expect(duplicate.statusCode).toBe(409);

      const accepted = await app.inject({
        cookies: ownerCookies,
        method: "POST",
        payload: {
          decision: "AcceptTerminal",
          reason: "The expired runner task is superseded and needs no rerun.",
          reference: "INC-ASYNC-2026-001",
          workloadId: expiredRunnerTask.taskId,
          workloadKind: "RunnerTask"
        },
        url: "/api/v1/async-operations/recovery-decisions"
      });
      expect(accepted.statusCode).toBe(200);
      expect(accepted.json()).toMatchObject({
        event: { eventType: "TerminalAccepted", integrityVerified: true },
        recoveryMissionId: null
      });

      const crossTenantDecision = await app.inject({
        cookies: outsiderCookies,
        method: "POST",
        payload: {
          decision: "PrepareRecovery",
          reason: "This tenant must never see or recover the owner's work.",
          reference: "OUTSIDER-ATTEMPT",
          workloadId: expiredRunnerTask.taskId,
          workloadKind: "RunnerTask"
        },
        url: "/api/v1/async-operations/recovery-decisions"
      });
      expect(crossTenantDecision.statusCode).toBe(404);

      const finalWorkspace = await app.inject({
        cookies: ownerCookies,
        method: "GET",
        url: "/api/v1/async-operations/workspace"
      });
      expect(finalWorkspace.statusCode).toBe(200);
      expect(
        finalWorkspace
          .json()
          .events.every((event: { integrityVerified: boolean }) =>
            Boolean(event.integrityVerified)
          )
      ).toBe(true);
      expect(
        finalWorkspace
          .json()
          .events.map((event: { sequence: number }) => event.sequence)
      ).toEqual([4, 3, 2, 1]);

      const auditActions = await prisma.auditEvent.findMany({
        orderBy: { createdAt: "asc" },
        select: { action: true },
        where: {
          action: {
            in: [
              "async_operations_policy_configured",
              "async_operations_reconciled",
              "async_operations_recovery_prepared",
              "async_operations_terminal_accepted"
            ]
          },
          tenantId
        }
      });
      expect(auditActions.map((entry) => entry.action)).toEqual([
        "async_operations_policy_configured",
        "async_operations_reconciled",
        "async_operations_recovery_prepared",
        "async_operations_terminal_accepted"
      ]);

      const firstEvent = await prisma.asyncOperationsEvent.findFirstOrThrow({
        orderBy: { sequence: "asc" },
        where: { tenantId }
      });
      await expect(
        prisma.asyncOperationsEvent.update({
          data: { reason: "Attempted ledger tamper." },
          where: { eventId: firstEvent.eventId }
        })
      ).rejects.toThrow(/immutable/u);
    } finally {
      await app.close();
    }
  });
});

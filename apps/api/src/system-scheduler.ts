import { getPrismaClient } from "@periscan/db";

import {
  expireStaleRunnerTasks,
  failStuckRunningJobs,
  markStaleRunnersOffline,
  SCOPE_EDITOR_ROLES,
  type AppServices
} from "./runtime-services.js";

// The four due-runners ticked per tenant, plus the per-tenant context build —
// the distinct failure sites a sweep can hit. Per-runner attribution turns an
// opaque `failures: N` into an actionable "WHAT is failing" signal.
export type SweepRunner =
  | "context"
  | "executiveSnapshot"
  | "integrationSync"
  | "posture"
  | "reverification"
  | "schedules"
  | "threatFeed";

export interface SystemSweepFailure {
  message: string;
  runner: SweepRunner;
  tenantId: string;
}

export interface SystemSweepSummary {
  executiveSnapshotsCaptured: number;
  failures: number;
  failuresByRunner: Record<SweepRunner, number>;
  integrationsSynced: number;
  postureChecksRun: number;
  reverified: number;
  schedulesRun: number;
  tenantsSwept: number;
  threatFeedsIngested: number;
}

// Minimal structural logger so the sweep can raise an alerting hook without
// depending on the Fastify app type. `app.log` satisfies this shape.
export interface SweepLogger {
  warn: (details: Record<string, unknown>, message: string) => void;
}

function emptyFailuresByRunner(): Record<SweepRunner, number> {
  return {
    context: 0,
    executiveSnapshot: 0,
    integrationSync: 0,
    posture: 0,
    reverification: 0,
    schedules: 0,
    threatFeed: 0
  };
}

// Most recent sweep outcome, exposed via /api/v1/metrics for ops observability.
let lastValidationSweep: (SystemSweepSummary & { ranAt: string }) | null = null;

export function getLastValidationSweep(): typeof lastValidationSweep {
  return lastValidationSweep;
}

/**
 * Drives the continuous-validation loop. The due-runners (integration sync, fix
 * re-verification, mission schedules) are tenant-scoped, editor-role-gated service
 * methods, so nothing ran them automatically — "continuous validation" only
 * happened if an operator wired an external cron per tenant. This sweep ticks them
 * on a timer (started from the API server) by acting on behalf of a REAL
 * editor-role member of each tenant, so policy/role checks pass and audit events
 * attribute to an accountable identity. A failure for one tenant/runner never
 * aborts the sweep.
 */
export async function runSystemValidationSweep({
  logger,
  services,
  tenantIds
}: {
  logger?: SweepLogger;
  services: AppServices;
  tenantIds?: string[];
}): Promise<SystemSweepSummary> {
  const prisma = getPrismaClient();
  const summary: SystemSweepSummary = {
    executiveSnapshotsCaptured: 0,
    failures: 0,
    failuresByRunner: emptyFailuresByRunner(),
    integrationsSynced: 0,
    postureChecksRun: 0,
    reverified: 0,
    schedulesRun: 0,
    tenantsSwept: 0,
    threatFeedsIngested: 0
  };

  // Bounded per-failure samples for the alerting log — enough for operators to
  // see which tenant/runner is failing and why, without unbounded growth.
  const failureSamples: SystemSweepFailure[] = [];
  const recordFailure = (
    tenantId: string,
    runner: SweepRunner,
    error: unknown
  ) => {
    summary.failures += 1;
    summary.failuresByRunner[runner] += 1;
    if (failureSamples.length < 20) {
      failureSamples.push({
        message: error instanceof Error ? error.message : String(error),
        runner,
        tenantId
      });
    }
  };

  // Only visit tenants that actually have due work. Three cheap distinct queries
  // replace an O(all-tenants) sweep — idle tenants (the vast majority) are skipped
  // entirely, so the sweep scales with the amount of due work, not tenant count.
  const now = new Date();
  const tenantFilter = tenantIds ? { in: tenantIds } : undefined;

  // System-wide: reclaim runner tasks orphaned by dead/silent runners (their own
  // poll never fires to expire them) and fail the validation runs they stranded,
  // so validations don't hang forever. Runs every sweep, independent of due work.
  try {
    const expired = await expireStaleRunnerTasks(prisma, now);
    if (expired.expiredTaskCount > 0 && logger) {
      logger.warn(
        {
          failedRunCount: expired.failedRunCount,
          expiredTaskCount: expired.expiredTaskCount,
          op: "runner.tasks.expired"
        },
        `Reclaimed ${expired.expiredTaskCount} stale runner task(s).`
      );
    }
    const stuckJobs = await failStuckRunningJobs(prisma, now);
    if (stuckJobs.failedJobCount > 0 && logger) {
      logger.warn(
        {
          failedJobCount: stuckJobs.failedJobCount,
          failedRunCount: stuckJobs.failedRunCount,
          op: "jobs.stuck.failed"
        },
        `Failed ${stuckJobs.failedJobCount} stuck running job(s).`
      );
    }
    // Mark Active/Degraded runners that have gone silent past the staleness
    // window as Offline, so a dead in-network agent stops reading Active. A
    // runner's next poll restores it to Active.
    const offlinedRunners = await markStaleRunnersOffline(prisma, now);
    if (offlinedRunners.offlinedRunnerCount > 0 && logger) {
      logger.warn(
        {
          offlinedRunnerCount: offlinedRunners.offlinedRunnerCount,
          op: "runner.marked_offline"
        },
        `Marked ${offlinedRunners.offlinedRunnerCount} silent runner(s) Offline.`
      );
    }
  } catch (error) {
    if (logger) {
      logger.warn(
        {
          op: "runner.tasks.expired.error"
        },
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  const dueTenantIds = new Set<string>();
  for (const row of await prisma.integration.findMany({
    distinct: ["tenantId"],
    select: { tenantId: true },
    where: {
      nextSyncAt: { lte: now },
      status: "Connected",
      syncFrequency: { not: null },
      ...(tenantFilter ? { tenantId: tenantFilter } : {})
    }
  })) {
    dueTenantIds.add(row.tenantId);
  }
  for (const row of await prisma.remediationTask.findMany({
    distinct: ["tenantId"],
    select: { tenantId: true },
    where: {
      nextVerificationAt: { lte: now },
      status: { in: ["Fixed", "Mitigated", "PartiallyFixed"] },
      verificationRequired: true,
      ...(tenantFilter ? { tenantId: tenantFilter } : {})
    }
  })) {
    dueTenantIds.add(row.tenantId);
  }
  for (const row of await prisma.missionSchedule.findMany({
    distinct: ["tenantId"],
    select: { tenantId: true },
    where: {
      nextRunAt: { lte: now },
      status: "Active",
      ...(tenantFilter ? { tenantId: tenantFilter } : {})
    }
  })) {
    dueTenantIds.add(row.tenantId);
  }
  for (const row of await prisma.tenant.findMany({
    select: { tenantId: true },
    where: {
      nextThreatFeedIngestAt: { lte: now },
      threatFeedFrequency: { not: null },
      ...(tenantFilter ? { tenantId: tenantFilter } : {})
    }
  })) {
    dueTenantIds.add(row.tenantId);
  }
  for (const row of await prisma.scope.findMany({
    distinct: ["tenantId"],
    select: { tenantId: true },
    where: {
      nextPostureCheckAt: { lte: now },
      scopeType: { in: ["Domain", "Subdomain"] },
      verificationStatus: "Verified",
      ...(tenantFilter ? { tenantId: tenantFilter } : {})
    }
  })) {
    dueTenantIds.add(row.tenantId);
  }

  for (const tenantId of dueTenantIds) {
    const membership = await prisma.membership.findFirst({
      orderBy: { createdAt: "asc" },
      where: {
        role: { in: [...SCOPE_EDITOR_ROLES] },
        tenantId
      }
    });
    if (!membership) {
      continue;
    }

    let context: Awaited<ReturnType<AppServices["getSessionContext"]>>;
    try {
      context = await services.getSessionContext(
        {
          authMethod: "system",
          defaultTenantId: tenantId,
          userId: membership.userId
        },
        tenantId
      );
    } catch (error) {
      recordFailure(tenantId, "context", error);
      continue;
    }
    if (!context) {
      continue;
    }

    summary.tenantsSwept += 1;
    try {
      summary.integrationsSynced += (
        await services.runDueIntegrationSyncs(context)
      ).syncedCount;
    } catch (error) {
      recordFailure(tenantId, "integrationSync", error);
    }
    try {
      summary.reverified += (
        await services.runDueReverifications(context)
      ).reverifiedCount;
    } catch (error) {
      recordFailure(tenantId, "reverification", error);
    }
    try {
      summary.postureChecksRun += (
        await services.runDuePostureChecks(context)
      ).postureChecksRun;
    } catch (error) {
      recordFailure(tenantId, "posture", error);
    }
    try {
      await services.runDueSchedules(context);
      summary.schedulesRun += 1;
    } catch (error) {
      recordFailure(tenantId, "schedules", error);
    }
    try {
      if ((await services.runDueThreatFeedIngestion(context)).ingested) {
        summary.threatFeedsIngested += 1;
      }
    } catch (error) {
      recordFailure(tenantId, "threatFeed", error);
    }
    try {
      if ((await services.captureExecutiveTrendSnapshot(context)).captured) {
        summary.executiveSnapshotsCaptured += 1;
      }
    } catch (error) {
      recordFailure(tenantId, "executiveSnapshot", error);
    }
  }

  // Alerting hook: a single structured warning operators can alert on (by the
  // `validation.sweep.failures` op, or the per-runner prometheus gauges). The
  // continuous-validation loop silently swallowing failures would let it rot.
  if (summary.failures > 0 && logger) {
    logger.warn(
      {
        failuresByRunner: summary.failuresByRunner,
        op: "validation.sweep.failures",
        samples: failureSamples,
        tenantsSwept: summary.tenantsSwept,
        totalFailures: summary.failures
      },
      `Continuous-validation sweep had ${summary.failures} runner failure(s).`
    );
  }

  lastValidationSweep = { ...summary, ranAt: new Date().toISOString() };
  return summary;
}

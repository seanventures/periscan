import {
  RUNNER_FLEET_TASK_STATUSES,
  RunnerFleetWorkspaceSchema,
  RunnerHeartbeatSampleSchema,
  type RunnerFleetAlert,
  type RunnerFleetHealthState,
  type RunnerFleetPolicy,
  type RunnerFleetWorkspace,
  type RunnerTaskRecord
} from "@periscan/shared";

import { serializeRunner, serializeRunnerTask } from "../serializers/runner.js";
import {
  requireRole,
  RUNNER_ADMIN_ROLES,
  writeAuditEvent
} from "../runtime-services.js";
import type { AppServices, RuntimeServiceDeps } from "../runtime-services.js";
import { withEffectiveRunnerStatus } from "./runner.js";

const DAY_MS = 24 * 60 * 60 * 1_000;
const ACTIVE_TASK_STATUSES = new Set([
  "Queued",
  "Leased",
  "Running",
  "Accepted"
]);
const DENIED_TASK_STATUSES = new Set([
  "DeniedByLocalPolicy",
  "DeniedByServerPolicy",
  "Rejected"
]);
const TERMINAL_TASK_STATUSES = new Set([
  "Cancelled",
  "Completed",
  "DeniedByLocalPolicy",
  "DeniedByServerPolicy",
  "Expired",
  "Failed",
  "Rejected"
]);

const DEFAULT_POLICY: RunnerFleetPolicy = {
  attentionAfterSeconds: 90,
  certificateWarningDays: 14,
  configured: false,
  escalationReference: null,
  minimumAgentVersion: null,
  offlineAfterSeconds: 300,
  queueWarningDepth: 10,
  supportOwner: null,
  updatedAt: null,
  updatedBy: null
};

type FleetPolicyRecord = {
  attentionAfterSeconds: number;
  certificateWarningDays: number;
  escalationReference: string;
  minimumAgentVersion: string | null;
  offlineAfterSeconds: number;
  queueWarningDepth: number;
  supportOwner: string;
  updatedAt: Date;
  updatedBy: string;
};

function serializePolicy(record: FleetPolicyRecord | null): RunnerFleetPolicy {
  if (!record) return DEFAULT_POLICY;
  return {
    attentionAfterSeconds: record.attentionAfterSeconds,
    certificateWarningDays: record.certificateWarningDays,
    configured: true,
    escalationReference: record.escalationReference,
    minimumAgentVersion: record.minimumAgentVersion,
    offlineAfterSeconds: record.offlineAfterSeconds,
    queueWarningDepth: record.queueWarningDepth,
    supportOwner: record.supportOwner,
    updatedAt: record.updatedAt.toISOString(),
    updatedBy: record.updatedBy
  };
}

function compareVersions(left: string, right: string): number | null {
  const parse = (value: string) => {
    const match = /^(\d+)\.(\d+)\.(\d+)/u.exec(value.trim());
    return match ? match.slice(1, 4).map(Number) : null;
  };
  const a = parse(left);
  const b = parse(right);
  if (!a || !b) return null;
  for (let index = 0; index < 3; index += 1) {
    const delta = (a[index] ?? 0) - (b[index] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

export function deriveRunnerFleetHealth(input: {
  attentionAfterSeconds: number;
  killSwitchActive: boolean;
  lastSeenAt: Date | null;
  offlineAfterSeconds: number;
  revokedAt: Date | null;
  status: string;
  now?: Date;
}): {
  healthState: RunnerFleetHealthState;
  heartbeatAgeSeconds: number | null;
} {
  const now = input.now ?? new Date();
  const heartbeatAgeSeconds = input.lastSeenAt
    ? Math.max(
        0,
        Math.floor((now.getTime() - input.lastSeenAt.getTime()) / 1_000)
      )
    : null;
  if (input.revokedAt || input.status === "Revoked") {
    return { healthState: "Revoked", heartbeatAgeSeconds };
  }
  if (input.killSwitchActive || input.status === "KillSwitchActive") {
    return { healthState: "Halted", heartbeatAgeSeconds };
  }
  if (input.status === "Provisioning") {
    return { healthState: "Provisioning", heartbeatAgeSeconds };
  }
  if (
    heartbeatAgeSeconds === null ||
    heartbeatAgeSeconds >= input.offlineAfterSeconds ||
    input.status === "Offline"
  ) {
    return { healthState: "Offline", heartbeatAgeSeconds };
  }
  if (
    heartbeatAgeSeconds >= input.attentionAfterSeconds ||
    input.status === "Degraded"
  ) {
    return { healthState: "Attention", heartbeatAgeSeconds };
  }
  return { healthState: "Healthy", heartbeatAgeSeconds };
}

function serializeHeartbeat(record: {
  activeTaskId: string | null;
  certificateExpiresAt: Date | null;
  heartbeatSampleId: string;
  lastTaskCompletedAt: Date | null;
  observedAt: Date;
  queueDepth: number;
  receivedAt: Date;
  runnerId: string;
  status: string;
  tenantId: string;
  version: string;
}) {
  return RunnerHeartbeatSampleSchema.parse({
    activeTaskId: record.activeTaskId,
    certificateExpiresAt: record.certificateExpiresAt?.toISOString() ?? null,
    heartbeatSampleId: record.heartbeatSampleId,
    lastTaskCompletedAt: record.lastTaskCompletedAt?.toISOString() ?? null,
    observedAt: record.observedAt.toISOString(),
    queueDepth: record.queueDepth,
    receivedAt: record.receivedAt.toISOString(),
    runnerId: record.runnerId,
    status: record.status,
    tenantId: record.tenantId,
    version: record.version
  });
}

function taskSummary(tasks: RunnerTaskRecord[], now: Date) {
  const counts = Object.fromEntries(
    RUNNER_FLEET_TASK_STATUSES.map((status) => [status, 0])
  ) as Record<(typeof RUNNER_FLEET_TASK_STATUSES)[number], number>;
  const since = now.getTime() - DAY_MS;
  const durations: number[] = [];
  let terminal24h = 0;
  let completed24h = 0;
  let failed24h = 0;
  let denied24h = 0;
  let evidence24h = 0;
  let oldestQueuedSeconds: number | null = null;

  for (const task of tasks) {
    counts[task.status] += 1;
    if (task.status === "Queued") {
      const age = Math.max(
        0,
        Math.floor((now.getTime() - new Date(task.issuedAt).getTime()) / 1_000)
      );
      oldestQueuedSeconds = Math.max(oldestQueuedSeconds ?? 0, age);
    }
    const terminalAt = task.completedAt
      ? new Date(task.completedAt).getTime()
      : 0;
    if (terminalAt >= since && TERMINAL_TASK_STATUSES.has(task.status)) {
      terminal24h += 1;
      evidence24h += task.redactedEvidenceIds.length;
      if (task.status === "Completed") completed24h += 1;
      if (task.status === "Failed") failed24h += 1;
      if (DENIED_TASK_STATUSES.has(task.status)) denied24h += 1;
      const startedAt = new Date(task.leasedAt ?? task.issuedAt).getTime();
      if (terminalAt >= startedAt) {
        durations.push(Math.floor((terminalAt - startedAt) / 1_000));
      }
    }
  }
  durations.sort((a, b) => a - b);
  const p50 = durations.length
    ? (durations[Math.floor((durations.length - 1) / 2)] ?? null)
    : null;
  return {
    active: tasks.filter((task) => ACTIVE_TASK_STATUSES.has(task.status))
      .length,
    completionRate24h: terminal24h ? completed24h / terminal24h : null,
    counts,
    denied24h,
    evidence24h,
    failed24h,
    oldestQueuedSeconds,
    p50DurationSeconds24h: p50,
    terminal24h
  };
}

function buildAlerts(input: {
  certificateDaysRemaining: number | null;
  failed24h: number;
  healthState: RunnerFleetHealthState;
  killSwitchAcknowledgedAt: string | null | undefined;
  latestQueueDepth: number;
  policy: RunnerFleetPolicy;
  revocationAcknowledgedAt: string | null | undefined;
  versionCompliant: boolean | null;
}): RunnerFleetAlert[] {
  const alerts: RunnerFleetAlert[] = [];
  if (!input.policy.configured) {
    alerts.push({
      code: "policy_not_configured",
      detail:
        "Default liveness thresholds are active until an owner seals fleet policy.",
      severity: "Info",
      title: "Fleet policy not configured"
    });
  }
  if (input.healthState === "Offline") {
    alerts.push({
      code: "heartbeat_offline",
      detail: `No server-received heartbeat within ${input.policy.offlineAfterSeconds} seconds.`,
      severity: "Critical",
      title: "Runner is offline"
    });
  } else if (input.healthState === "Attention") {
    alerts.push({
      code: "heartbeat_late",
      detail: `The heartbeat is later than the ${input.policy.attentionAfterSeconds}-second attention target.`,
      severity: "Warning",
      title: "Heartbeat needs attention"
    });
  }
  if (input.healthState === "Halted" && !input.killSwitchAcknowledgedAt) {
    alerts.push({
      code: "kill_switch_ack_pending",
      detail:
        "Server enforcement is active; host acknowledgement is still pending its next outbound poll.",
      severity: "Warning",
      title: "Kill-switch acknowledgement pending"
    });
  }
  if (input.healthState === "Revoked" && !input.revocationAcknowledgedAt) {
    alerts.push({
      code: "revocation_ack_pending",
      detail:
        "Credentials are revoked; host acknowledgement has not yet been received.",
      severity: "Warning",
      title: "Revocation acknowledgement pending"
    });
  }
  if (
    input.certificateDaysRemaining !== null &&
    input.certificateDaysRemaining <= 0
  ) {
    alerts.push({
      code: "certificate_expired",
      detail: "The last reported mTLS certificate expiry is in the past.",
      severity: "Critical",
      title: "Runner certificate expired"
    });
  } else if (
    input.certificateDaysRemaining !== null &&
    input.certificateDaysRemaining <= input.policy.certificateWarningDays
  ) {
    alerts.push({
      code: "certificate_expiring",
      detail: `The runner certificate expires within ${input.policy.certificateWarningDays} days.`,
      severity: "Warning",
      title: "Rotate runner certificate"
    });
  }
  if (input.latestQueueDepth >= input.policy.queueWarningDepth) {
    alerts.push({
      code: "queue_pressure",
      detail: `The reported queue depth reached ${input.latestQueueDepth}; the warning threshold is ${input.policy.queueWarningDepth}.`,
      severity: "Warning",
      title: "Runner queue pressure"
    });
  }
  if (input.versionCompliant === false) {
    alerts.push({
      code: "version_below_minimum",
      detail: `The reported agent version is below the configured minimum ${input.policy.minimumAgentVersion}.`,
      severity: "Warning",
      title: "Runner upgrade required"
    });
  }
  if (input.failed24h > 0) {
    alerts.push({
      code: "recent_task_failures",
      detail: `${input.failed24h} task${input.failed24h === 1 ? "" : "s"} failed in the last 24 hours.`,
      severity: "Warning",
      title: "Recent runner failures"
    });
  }
  return alerts;
}

export function createRunnerFleetServices(
  deps: RuntimeServiceDeps
): Pick<AppServices, "getRunnerFleetWorkspace" | "updateRunnerFleetPolicy"> {
  const { prisma } = deps;
  return {
    async getRunnerFleetWorkspace(context): Promise<RunnerFleetWorkspace> {
      const now = new Date();
      const [policyRecord, runners, toolPolicies] = await Promise.all([
        prisma.runnerFleetPolicy.findUnique({
          where: { tenantId: context.tenant.tenantId }
        }),
        prisma.runner.findMany({
          include: {
            heartbeatSamples: {
              orderBy: { receivedAt: "desc" },
              take: 24
            },
            tasks: {
              orderBy: { createdAt: "desc" },
              take: 100
            }
          },
          orderBy: { createdAt: "desc" },
          where: { tenantId: context.tenant.tenantId }
        }),
        // Tenant tool-governance install posture (control-plane truth today —
        // not host package inventory). Surfaced next to runner health so
        // operators see Online ≠ nuclei installed (P14-7).
        prisma.thirdPartyToolPolicy.findMany({
          orderBy: { toolId: "asc" },
          take: 100,
          where: {
            OR: [
              { tenantId: context.tenant.tenantId },
              { tenantId: null, ownerKey: "global" }
            ]
          }
        })
      ]);
      const policy = serializePolicy(policyRecord);
      const engineInstallReadiness = toolPolicies.map((tool) => {
        const ready =
          tool.enabled &&
          tool.installStatus === "Installed" &&
          tool.runtimeAvailable;
        return {
          enabled: tool.enabled,
          href: `/registries?toolId=${encodeURIComponent(tool.toolId)}`,
          installStatus: tool.installStatus,
          ready,
          runtimeAvailable: tool.runtimeAvailable,
          toolId: tool.toolId
        };
      });
      const notReadyEngines = engineInstallReadiness.filter((item) => !item.ready);
      const fleetRunners = runners.map((record) => {
        const runner = serializeRunner(
          withEffectiveRunnerStatus(
            record,
            policy.offlineAfterSeconds,
            now
          )
        );
        const heartbeatSeries = [...record.heartbeatSamples]
          .reverse()
          .map(serializeHeartbeat);
        const latestHeartbeat = record.heartbeatSamples[0]
          ? serializeHeartbeat(record.heartbeatSamples[0])
          : null;
        const health = deriveRunnerFleetHealth({
          attentionAfterSeconds: policy.attentionAfterSeconds,
          killSwitchActive: runner.killSwitchActive,
          lastSeenAt: record.lastSeenAt,
          offlineAfterSeconds: policy.offlineAfterSeconds,
          revokedAt: record.revokedAt,
          status: record.status,
          now
        });
        const recentTasks = record.tasks.map(serializeRunnerTask);
        const summary = taskSummary(recentTasks, now);
        const certificateExpiresAt =
          latestHeartbeat?.certificateExpiresAt ?? runner.certificateExpiresAt;
        const certificateDaysRemaining = certificateExpiresAt
          ? (new Date(certificateExpiresAt).getTime() - now.getTime()) / DAY_MS
          : null;
        const versionComparison = policy.minimumAgentVersion
          ? compareVersions(runner.version, policy.minimumAgentVersion)
          : null;
        const versionCompliant =
          versionComparison === null ? null : versionComparison >= 0;
        const alerts = buildAlerts({
          certificateDaysRemaining,
          failed24h: summary.failed24h,
          healthState: health.healthState,
          killSwitchAcknowledgedAt: runner.killSwitchAcknowledgedAt,
          latestQueueDepth: latestHeartbeat?.queueDepth ?? 0,
          policy,
          revocationAcknowledgedAt: runner.revocationAcknowledgedAt,
          versionCompliant
        });
        if (
          notReadyEngines.length > 0 &&
          health.healthState === "Healthy"
        ) {
          alerts.push({
            code: "engine_install_incomplete",
            detail: `${notReadyEngines.length} governed tool(s) are enabled or installed incompletely — runner Online does not mean nuclei/zap-class engines are on the host. Open Registries to install.`,
            severity: "Warning",
            title: "Engine install readiness incomplete"
          });
        }
        return {
          alerts,
          certificateDaysRemaining,
          engineInstallReadiness,
          healthState: health.healthState,
          heartbeatAgeSeconds: health.heartbeatAgeSeconds,
          heartbeatSeries,
          latestHeartbeat,
          recentTasks,
          runner,
          taskSummary: summary,
          versionCompliant
        };
      });
      const totalTerminal = fleetRunners.reduce(
        (sum, item) => sum + item.taskSummary.terminal24h,
        0
      );
      const totalCompleted = fleetRunners.reduce(
        (sum, item) =>
          sum +
          (item.taskSummary.completionRate24h === null
            ? 0
            : item.taskSummary.terminal24h *
              item.taskSummary.completionRate24h),
        0
      );
      return RunnerFleetWorkspaceSchema.parse({
        generatedAt: now.toISOString(),
        policy,
        rulesVersion: "1.0",
        runners: fleetRunners,
        summary: {
          activeTasks: fleetRunners.reduce(
            (sum, item) => sum + item.taskSummary.active,
            0
          ),
          attention: fleetRunners.filter(
            (item) => item.healthState === "Attention"
          ).length,
          completionRate24h: totalTerminal
            ? Math.min(1, totalCompleted / totalTerminal)
            : null,
          evidence24h: fleetRunners.reduce(
            (sum, item) => sum + item.taskSummary.evidence24h,
            0
          ),
          halted: fleetRunners.filter((item) => item.healthState === "Halted")
            .length,
          healthy: fleetRunners.filter((item) => item.healthState === "Healthy")
            .length,
          offline: fleetRunners.filter((item) => item.healthState === "Offline")
            .length,
          revoked: fleetRunners.filter((item) => item.healthState === "Revoked")
            .length,
          total: fleetRunners.length
        }
      });
    },

    async updateRunnerFleetPolicy(context, input) {
      requireRole(
        context.membership.role,
        RUNNER_ADMIN_ROLES,
        "manage runner fleet policy"
      );
      const record = await prisma.runnerFleetPolicy.upsert({
        create: {
          ...input,
          tenantId: context.tenant.tenantId,
          updatedBy: context.user.userId
        },
        update: {
          ...input,
          updatedBy: context.user.userId
        },
        where: { tenantId: context.tenant.tenantId }
      });
      await writeAuditEvent(prisma, {
        action: "runner.fleet_policy.updated",
        actorType: "User",
        entityId: record.runnerFleetPolicyId,
        entityType: "Runner",
        metadata: {
          attentionAfterSeconds: record.attentionAfterSeconds,
          certificateWarningDays: record.certificateWarningDays,
          escalationReference: record.escalationReference,
          minimumAgentVersion: record.minimumAgentVersion,
          offlineAfterSeconds: record.offlineAfterSeconds,
          queueWarningDepth: record.queueWarningDepth,
          supportOwner: record.supportOwner
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
      return serializePolicy(record);
    }
  };
}

// @ts-nocheck
import { createHash, createPublicKey, randomUUID, verify } from "node:crypto";

import type { Prisma, PrismaClient } from "@prisma/client";

import { createPrismaEvidenceService } from "@periscan/evidence";
import { evaluatePolicy } from "@periscan/policy";
import { getModuleById } from "@periscan/modules";
import {
  assertRemediationFixedOnlyViaVerification,
  buildRunnerTaskRoutingHint,
  evaluateSegmentProfileTaskGate,
  isRunnerDiscoverModuleId,
  isRunnerMeasuredModuleId,
  runnerMatchesAffinityConstraints,
  RunnerCredentialRotationRequestSchema,
  RunnerHeartbeatSchema,
  RunnerRegistrationRequestSchema,
  RunnerTaskArtifactUploadRequestSchema,
  RunnerTaskEnvelopeSchema,
  type RunnerTaskEnvelope,
  type RunnerTaskResult
} from "@periscan/shared";

import {
  enforceExecutionPolicy,
  enforceFreshPolicyEvaluation
} from "../policy-enforcement-point.js";
import { tryAutoApplyPathEdgeReceiptFromCompletedRun } from "./findings.js";
import { reconcileMissionAggregateFromRuns } from "../mission-run-aggregate.js";
import { withMissionRunAggregateLock } from "../mission-run-aggregate-lock.js";
import {
  serializeScope,
  serializeValidationMission,
  serializeValidationRun
} from "../serializers/entities.js";
import {
  serializeRunner,
  serializeRunnerRegistrationToken,
  serializeRunnerTask
} from "../serializers/runner.js";
import {
  addSeconds,
  AppServiceError,
  attachEvidenceToSignals,
  buildScopeConstraints,
  calculateNextRunAt,
  createOpaqueToken,
  getRunnerControlPlaneUrl,
  hashSecret,
  isHostnameTargetAllowedByScope,
  issueRunnerCredentials,
  projectInlineValidationGraph,
  requireRole,
  RUNNER_ADMIN_ROLES,
  serializeEvidenceArtifact,
  signRunnerTaskEnvelope,
  timingSafeEqualHex,
  writeAuditEvent
} from "../runtime-services.js";
import type { AppServices, RuntimeServiceDeps } from "../runtime-services.js";

export { reconcileMissionAggregateFromRuns } from "../mission-run-aggregate.js";

// Internal-runner control-plane service group (D1 Phase 2 closure decomposition).
// SECURITY-CRITICAL: Ed25519 signed task envelopes, constant-time auth-token
// verification, nonce/replay + default-deny scope enforcement. The closure-local
// getAuthenticatedRunner helper is relocated here as the private
// authenticateRunner(prisma, ...) function; bodies are copied verbatim.

/**
 * Project Offline for runners that still claim Active/Degraded/Provisioning but
 * have not heartbeated within the fleet offline threshold. Terminal states
 * (Revoked, KillSwitchActive, already Offline) are left untouched.
 * Read-path only — does not rewrite the stored row (heartbeats remain source of truth).
 */
/**
 * P10-1 — Segment profile is lease-time policy, not inventory labels.
 * Unbound runners (no segmentProfileId) are unchanged hybrid fleet.
 */
export function assertRunnerSegmentProfileAllowsTask(
  runner: { segmentProfileId?: string | null },
  moduleId: string,
  safetyLevel: string
): { forbidInternetEgress: boolean } {
  const gate = evaluateSegmentProfileTaskGate({
    moduleId,
    profileId: runner.segmentProfileId ?? null,
    safetyLevel
  });
  if (!gate.allowed) {
    throw new AppServiceError(
      gate.rationale,
      403,
      gate.code ?? "runner_segment_denied"
    );
  }
  return { forbidInternetEgress: gate.forbidInternetEgress };
}

/**
 * P10-2 — Hard site/segment affinity when the task (or caller) requires it.
 * preferredRunnerId alone never hard-fails; wrong-site / wrong-segment does.
 */
export function assertRunnerAffinityAllowsTask(
  runner: {
    networkSegment?: string | null;
    runnerId: string;
    segmentProfileId?: string | null;
    siteId?: string | null;
    status: string;
  },
  routing?: {
    networkSegment?: string | null;
    preferredRunnerId?: string | null;
    siteId?: string | null;
    targetCidrs?: string[] | null;
  } | null
): void {
  if (!routing?.siteId && !routing?.networkSegment) {
    return;
  }
  const hint = buildRunnerTaskRoutingHint({
    networkSegment: routing.networkSegment,
    preferredRunnerId: routing.preferredRunnerId ?? runner.runnerId,
    siteId: routing.siteId,
    targetCidrs: routing.targetCidrs
  });
  const eligible = runnerMatchesAffinityConstraints(
    {
      affinity: {
        approvedCidrs: [],
        networkSegment: runner.networkSegment ?? null,
        segmentProfileId:
          runner.segmentProfileId === "campus-passive" ||
          runner.segmentProfileId === "dc-measured" ||
          runner.segmentProfileId === "ot-safe-baseline"
            ? runner.segmentProfileId
            : null,
        siteId: runner.siteId ?? null
      },
      runnerId: runner.runnerId,
      status: runner.status
    },
    hint
  );
  if (!eligible) {
    throw new AppServiceError(
      "Runner does not match required site/network-segment affinity for this task.",
      403,
      "runner_affinity_mismatch"
    );
  }
}

function withSegmentForbidInternetEgress<
  T extends { forbidInternetEgress: boolean }
>(constraints: T, forbidInternetEgress: boolean): T {
  if (!forbidInternetEgress) {
    return constraints;
  }
  return {
    ...constraints,
    forbidInternetEgress: true
  };
}

export function withEffectiveRunnerStatus<
  T extends {
    lastSeenAt: Date | null;
    status: string;
  }
>(runner: T, offlineAfterSeconds: number, now: Date = new Date()): T {
  if (
    runner.status === "Revoked" ||
    runner.status === "KillSwitchActive" ||
    runner.status === "Offline"
  ) {
    return runner;
  }
  const ageSeconds = runner.lastSeenAt
    ? Math.floor((now.getTime() - runner.lastSeenAt.getTime()) / 1_000)
    : Number.POSITIVE_INFINITY;
  if (ageSeconds >= offlineAfterSeconds) {
    return { ...runner, status: "Offline" };
  }
  return runner;
}

async function authenticateRunner(
  prisma: PrismaClient,
  runnerId: string,
  authToken: string | null,
  clientCertificateSha256: string | null = null,
  requireMtls = false,
  allowRevoked = false
) {
  if (!authToken) {
    throw new AppServiceError(
      "Runner authentication required.",
      401,
      "runner_unauthorized"
    );
  }

  const runner = await prisma.runner.findUnique({
    where: {
      runnerId
    }
  });

  if (
    !runner ||
    !timingSafeEqualHex(runner.authTokenHash, hashSecret(authToken))
  ) {
    throw new AppServiceError(
      "Runner authentication failed.",
      401,
      "runner_unauthorized"
    );
  }

  if (runner.status === "Revoked" && !allowRevoked) {
    throw new AppServiceError("Runner is revoked.", 403, "runner_revoked");
  }

  if (requireMtls) {
    const presentedFingerprint = clientCertificateSha256?.trim().toLowerCase();
    const storedFingerprint = runner.certificateSha256?.toLowerCase() ?? null;

    if (!presentedFingerprint) {
      throw new AppServiceError(
        "Runner mTLS client certificate fingerprint required.",
        401,
        "runner_mtls_required"
      );
    }

    if (!storedFingerprint) {
      throw new AppServiceError(
        "Runner is not enrolled with a client certificate.",
        403,
        "runner_mtls_not_enrolled"
      );
    }

    if (!timingSafeEqualHex(storedFingerprint, presentedFingerprint)) {
      throw new AppServiceError(
        "Runner mTLS client certificate fingerprint mismatch.",
        403,
        "runner_mtls_mismatch"
      );
    }
  }

  return runner;
}

/**
 * Production posture: runner mTLS fingerprint enforcement is default-on when
 * NODE_ENV=production. Explicit PERISCAN_RUNNER_REQUIRE_MTLS=true|false always
 * wins; unset outside production remains opt-in (false).
 */
export function shouldRequireRunnerMtls(): boolean {
  const flag = process.env.PERISCAN_RUNNER_REQUIRE_MTLS;
  if (flag === "true") {
    return true;
  }
  if (flag === "false") {
    return false;
  }
  return process.env.NODE_ENV === "production";
}

function canonicalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizeJson);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalizeJson(child)])
    );
  }

  return value;
}

function runnerResultAuditHash(input: RunnerTaskResult): string {
  const unsignedResult: Record<string, unknown> = { ...input };
  delete unsignedResult.localAuditSha256;
  delete unsignedResult.resultSignature;

  return createHash("sha256")
    .update(JSON.stringify(canonicalizeJson(unsignedResult)), "utf8")
    .digest("hex");
}

// Verify a runner's Ed25519 signature over its result's localAuditSha256 digest.
// This binds the measurement to the runner's registered key — non-repudiable
// provenance beyond the transport (mTLS/bearer) auth that only proves the
// connection. Returns true on a valid signature, false on any failure.
function verifyRunnerResultSignature(
  publicKeyPem: string,
  localAuditSha256: string,
  signatureBase64: string
): boolean {
  try {
    const key = createPublicKey(publicKeyPem);
    return verify(
      null,
      Buffer.from(localAuditSha256, "utf8"),
      key,
      Buffer.from(signatureBase64, "base64")
    );
  } catch {
    return false;
  }
}

// Terminal runner-task states: once a task reaches one of these its lifecycle is
// closed and no further result may be (re)submitted against it. acceptRunnerTask
// and rejectRunnerTask already gate their transitions on the task's current
// state. submitRunnerTaskResult also soft-checks, then compare-and-swaps
// ACTIVE_RUNNER_TASK_STATUSES → Completed/Failed via updateMany so concurrent
// result posts cannot both persist signals / VerificationEvents.
const TERMINAL_RUNNER_TASK_STATUSES = new Set<string>([
  "Cancelled",
  "Completed",
  "DeniedByLocalPolicy",
  "DeniedByServerPolicy",
  "Expired",
  "Failed",
  "Rejected"
]);

export function isTerminalRunnerTaskStatus(status: string): boolean {
  return TERMINAL_RUNNER_TASK_STATUSES.has(status);
}

const ACTIVE_RUNNER_TASK_STATUSES = [
  "Queued",
  "Leased",
  "Running",
  "Accepted"
] as const;

/** Stable unique union for evidence id arrays (preserves first-seen order). */
export function unionEvidenceIds(
  existing: readonly string[],
  incoming: readonly string[]
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of [...existing, ...incoming]) {
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push(id);
  }
  return out;
}

async function persistRunnerHeartbeat(
  prisma: PrismaClient,
  runner: Awaited<ReturnType<typeof authenticateRunner>>,
  input: ReturnType<typeof RunnerHeartbeatSchema.parse>,
  receivedAt = new Date()
) {
  const status = runner.killSwitchActive
    ? "KillSwitchActive"
    : input.status === "Revoked" || input.status === "KillSwitchActive"
      ? "Degraded"
      : input.status;
  const observedAt = new Date(input.observedAt);
  const certificateExpiresAt = input.certificateExpiresAt
    ? new Date(input.certificateExpiresAt)
    : runner.certificateExpiresAt;
  return prisma.$transaction(async (tx) => {
    const updated = await tx.runner.update({
      data: {
        certificateExpiresAt,
        lastSeenAt: receivedAt,
        status,
        version: input.version
      },
      where: { runnerId: runner.runnerId }
    });
    await tx.runnerHeartbeatSample.create({
      data: {
        activeTaskId: input.activeTaskId ?? null,
        certificateExpiresAt,
        lastTaskCompletedAt: input.lastTaskCompletedAt
          ? new Date(input.lastTaskCompletedAt)
          : null,
        observedAt,
        queueDepth: input.queueDepth,
        receivedAt,
        runnerId: runner.runnerId,
        status,
        tenantId: runner.tenantId,
        version: input.version
      }
    });
    return updated;
  });
}

export function createRunnerServices(
  deps: RuntimeServiceDeps
): Pick<
  AppServices,
  | "acceptRunnerTask"
  | "acknowledgeRunnerControlState"
  | "createRunnerCheckTask"
  | "createRunnerDiscoverTask"
  | "createRunnerMeasuredTask"
  | "createRunnerReachabilityTask"
  | "createRunnerRegistrationToken"
  | "getRunner"
  | "listRunnerTasks"
  | "listRunners"
  | "pollRunnerTasks"
  | "registerRunner"
  | "rejectRunnerTask"
  | "revokeRunner"
  | "rotateRunnerCredentials"
  | "runnerHeartbeat"
  | "setRunnerKillSwitch"
  | "submitRunnerTaskResult"
  | "uploadRunnerTaskArtifact"
> {
  const { devMode, emitTenantWebhook, prisma } = deps;

  return {
    async listRunners(context) {
      const [runners, fleetPolicy] = await Promise.all([
        prisma.runner.findMany({
          orderBy: {
            createdAt: "desc"
          },
          where: {
            tenantId: context.tenant.tenantId
          }
        }),
        prisma.runnerFleetPolicy.findUnique({
          where: { tenantId: context.tenant.tenantId }
        })
      ]);
      const offlineAfterSeconds = fleetPolicy?.offlineAfterSeconds ?? 300;
      const now = new Date();

      // Server-authoritative staleness: Active/Degraded with a silent heartbeat
      // projects as Offline so schedules and UI do not treat dead runners as ready.
      return runners.map((runner) =>
        serializeRunner(
          withEffectiveRunnerStatus(runner, offlineAfterSeconds, now)
        )
      );
    },

    async getRunner(context, runnerId) {
      const [runner, fleetPolicy] = await Promise.all([
        prisma.runner.findFirst({
          where: {
            runnerId,
            tenantId: context.tenant.tenantId
          }
        }),
        prisma.runnerFleetPolicy.findUnique({
          where: { tenantId: context.tenant.tenantId }
        })
      ]);

      if (!runner) {
        return null;
      }

      return serializeRunner(
        withEffectiveRunnerStatus(
          runner,
          fleetPolicy?.offlineAfterSeconds ?? 300,
          new Date()
        )
      );
    },

    async createRunnerRegistrationToken(context, input) {
      requireRole(
        context.membership.role,
        RUNNER_ADMIN_ROLES,
        "create runner registration tokens"
      );

      const issuedToken = createOpaqueToken("prrt_");
      const now = new Date();
      const token = await prisma.runnerRegistrationToken.create({
        data: {
          createdBy: context.user.userId,
          deploymentMode: input.deploymentMode,
          expiresAt: addSeconds(now, input.expiresInSeconds),
          labels: input.labels,
          runnerName: input.runnerName,
          status: "Active",
          tenantId: context.tenant.tenantId,
          tokenHash: hashSecret(issuedToken)
        }
      });

      await writeAuditEvent(prisma, {
        action: "runner.registered",
        actorType: "User",
        entityId: token.registrationTokenId,
        entityType: "Runner",
        metadata: {
          expiresAt: token.expiresAt.toISOString(),
          runnerName: token.runnerName,
          tokenIssued: true
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return {
        registrationToken: issuedToken,
        token: serializeRunnerRegistrationToken(token)
      };
    },

    async registerRunner(input) {
      const parsedInput = RunnerRegistrationRequestSchema.parse(input);
      const tokenHash = hashSecret(parsedInput.registrationToken);
      const now = new Date();
      const registrationToken = await prisma.runnerRegistrationToken.findUnique(
        {
          where: {
            tokenHash
          }
        }
      );

      if (!registrationToken) {
        throw new AppServiceError(
          "Runner registration token is invalid.",
          401,
          "runner_registration_invalid"
        );
      }

      if (
        registrationToken.status !== "Active" ||
        registrationToken.expiresAt.getTime() <= now.getTime()
      ) {
        await prisma.runnerRegistrationToken.update({
          where: {
            registrationTokenId: registrationToken.registrationTokenId
          },
          data: {
            status:
              registrationToken.status === "Active"
                ? "Expired"
                : registrationToken.status
          }
        });

        throw new AppServiceError(
          "Runner registration token is expired or unavailable.",
          401,
          "runner_registration_expired"
        );
      }

      const runnerAuthToken = createOpaqueToken("prra_");
      const runnerId = randomUUID();
      const certificateExpiresAt = addSeconds(now, 90 * 24 * 60 * 60);
      const credentialMaterial = await issueRunnerCredentials({
        certificateExpiresAt,
        csrPem: parsedInput.csrPem,
        devMode: devMode,
        prisma,
        runnerId,
        runnerName: parsedInput.runnerName,
        tenantId: registrationToken.tenantId
      });

      // Single-use enroll: claim Active→Used with CAS before creating the
      // runner. Soft Active checks above are racy under concurrency; without
      // this gate two parallel registerRunner calls can both mint runners and
      // auth material from one registration token.
      const { runner } = await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const claimed = await tx.runnerRegistrationToken.updateMany({
            where: {
              expiresAt: {
                gt: now
              },
              registrationTokenId: registrationToken.registrationTokenId,
              status: "Active"
            },
            data: {
              status: "Used",
              usedAt: now
            }
          });

          if (claimed.count !== 1) {
            throw new AppServiceError(
              "Runner registration token is expired or unavailable.",
              401,
              "runner_registration_expired"
            );
          }

          const createdRunner = await tx.runner.create({
            data: {
              arch: parsedInput.arch,
              authTokenHash: hashSecret(runnerAuthToken),
              resultSigningPublicKeyPem:
                parsedInput.resultSigningPublicKeyPem ?? null,
              capabilities: parsedInput.capabilities as Prisma.InputJsonValue,
              certificateExpiresAt,
              certificateSha256: credentialMaterial.mtlsCertificateSha256,
              createdBy: registrationToken.createdBy,
              deploymentMode: parsedInput.deploymentMode,
              hostname: parsedInput.hostname,
              labels: parsedInput.labels,
              lastSeenAt: now,
              name: parsedInput.runnerName,
              networkProfile:
                parsedInput.networkProfile as Prisma.InputJsonValue,
              networkSegment: parsedInput.networkSegment ?? null,
              os: parsedInput.os,
              runnerId,
              segmentProfileId: parsedInput.segmentProfileId ?? null,
              siteId: parsedInput.siteId ?? null,
              status: "Active",
              tenantId: registrationToken.tenantId,
              transportMode: "LongPollHttps",
              version: parsedInput.version
            }
          });

          await writeAuditEvent(tx, {
            action: "runner.registered",
            actorType: "Runner",
            entityId: createdRunner.runnerId,
            entityType: "Runner",
            metadata: {
              certificateSha256: createdRunner.certificateSha256,
              deploymentMode: createdRunner.deploymentMode,
              hostname: createdRunner.hostname,
              registrationTokenId: registrationToken.registrationTokenId,
              transportAuth: "mtls-client-cert-and-bearer-over-tls",
              transportMode: createdRunner.transportMode
            },
            tenantId: createdRunner.tenantId,
            userId: registrationToken.createdBy
          });

          return {
            runner: createdRunner
          };
        }
      );

      const controlPlaneUrl = getRunnerControlPlaneUrl();

      return {
        credentials: {
          caCertificatePem: credentialMaterial.caCertificatePem,
          certificateExpiresAt: credentialMaterial.certificateExpiresAt,
          controlChannel: "LongPollHttps",
          controlPlaneUrl,
          heartbeatIntervalSeconds: 30,
          mtlsCertificateSha256: credentialMaterial.mtlsCertificateSha256,
          mtlsClientCertificatePem: credentialMaterial.mtlsClientCertificatePem,
          mtlsClientPrivateKeyRequired: true as const,
          pollIntervalSeconds: 15,
          runnerAuthToken,
          runnerId: runner.runnerId,
          taskResultsUrl: `${controlPlaneUrl}/api/v1/runners/${runner.runnerId}/tasks`,
          taskSigningKeyId: credentialMaterial.taskSigningKeyId,
          taskSigningPublicKeyPem: credentialMaterial.taskSigningPublicKeyPem,
          tenantId: runner.tenantId,
          transportAuth: "mtls-client-cert-and-bearer-over-tls" as const
        },
        runner: serializeRunner(runner)
      };
    },

    async revokeRunner(context, runnerId) {
      requireRole(
        context.membership.role,
        RUNNER_ADMIN_ROLES,
        "revoke runners"
      );

      const runner = await prisma.runner.findFirst({
        where: {
          runnerId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!runner) {
        throw new AppServiceError("Runner not found.", 404, "runner_not_found");
      }

      const revoked = await prisma.runner.update({
        where: {
          runnerId
        },
        data: {
          revokedAt: new Date(),
          revocationAcknowledgedAt: null,
          status: "Revoked"
        }
      });

      await prisma.runnerTask.updateMany({
        where: {
          runnerId,
          status: {
            in: [...ACTIVE_RUNNER_TASK_STATUSES]
          }
        },
        data: {
          completedAt: new Date(),
          errorSummary: "Runner was revoked before task completion.",
          status: "Cancelled"
        }
      });

      await writeAuditEvent(prisma, {
        action: "runner.task.rejected",
        actorType: "User",
        entityId: runnerId,
        entityType: "Runner",
        metadata: {
          reason: "runner_revoked"
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return serializeRunner(revoked);
    },

    async setRunnerKillSwitch(context, runnerId, input) {
      requireRole(
        context.membership.role,
        RUNNER_ADMIN_ROLES,
        "manage runner kill switch"
      );

      const runner = await prisma.runner.findFirst({
        where: {
          runnerId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!runner) {
        throw new AppServiceError("Runner not found.", 404, "runner_not_found");
      }

      if (runner.status === "Revoked") {
        throw new AppServiceError("Runner is revoked.", 409, "runner_revoked");
      }

      const now = new Date();
      const updated = await prisma.runner.update({
        where: {
          runnerId
        },
        data: input.active
          ? {
              killSwitchActivatedAt: now,
              killSwitchActivatedBy: context.user.userId,
              killSwitchAcknowledgedAt: null,
              killSwitchActive: true,
              killSwitchReason:
                input.reason ?? "Customer-activated runner kill switch.",
              status: "KillSwitchActive"
            }
          : {
              killSwitchActivatedAt: null,
              killSwitchActivatedBy: null,
              killSwitchAcknowledgedAt: null,
              killSwitchActive: false,
              killSwitchReason: null,
              status: "Active"
            }
      });

      if (input.active) {
        await prisma.runnerTask.updateMany({
          where: {
            runnerId,
            status: {
              in: [...ACTIVE_RUNNER_TASK_STATUSES]
            }
          },
          data: {
            completedAt: now,
            errorSummary: "Runner kill switch activated before completion.",
            status: "DeniedByServerPolicy"
          }
        });
      }

      await writeAuditEvent(prisma, {
        action: "runner.task.rejected",
        actorType: "User",
        entityId: runnerId,
        entityType: "Runner",
        metadata: {
          reason: input.active
            ? "kill_switch_activated"
            : "kill_switch_deactivated"
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return serializeRunner(updated);
    },

    async acknowledgeRunnerControlState(
      runnerId,
      authToken,
      input,
      clientCertificateSha256
    ) {
      const runner = await authenticateRunner(
        prisma,
        runnerId,
        authToken,
        clientCertificateSha256 ?? null,
        shouldRequireRunnerMtls(),
        true
      );
      const expectedChangedAt =
        input.controlState === "Revoked"
          ? runner.revokedAt
          : runner.killSwitchActivatedAt;
      if (
        !expectedChangedAt ||
        (input.controlState === "Revoked"
          ? runner.status !== "Revoked"
          : !runner.killSwitchActive) ||
        expectedChangedAt.toISOString() !== input.stateChangedAt
      ) {
        throw new AppServiceError(
          "Runner control-state acknowledgement is stale or does not match the active server state.",
          409,
          "runner_control_ack_mismatch"
        );
      }

      const observedAt = new Date(input.observedAt);
      const updated = await prisma.runner.update({
        where: { runnerId },
        data: {
          lastSeenAt: observedAt,
          ...(input.controlState === "Revoked"
            ? { revocationAcknowledgedAt: observedAt }
            : { killSwitchAcknowledgedAt: observedAt })
        }
      });
      await writeAuditEvent(prisma, {
        action: "runner.task.rejected",
        actorType: "Runner",
        entityId: runnerId,
        entityType: "Runner",
        metadata: {
          acknowledgedAt: observedAt.toISOString(),
          controlState: input.controlState,
          reason: "host_control_state_acknowledged",
          stateChangedAt: input.stateChangedAt
        },
        tenantId: runner.tenantId,
        userId: null
      });

      return serializeRunner(updated);
    },

    async listRunnerTasks(context, runnerId) {
      requireRole(
        context.membership.role,
        RUNNER_ADMIN_ROLES,
        "list runner tasks"
      );

      const runner = await prisma.runner.findFirst({
        where: {
          runnerId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!runner) {
        throw new AppServiceError("Runner not found.", 404, "runner_not_found");
      }

      const tasks = await prisma.runnerTask.findMany({
        orderBy: {
          createdAt: "desc"
        },
        take: 100,
        where: {
          runnerId,
          tenantId: context.tenant.tenantId
        }
      });

      return tasks.map((task) => serializeRunnerTask(task));
    },

    async acceptRunnerTask(
      runnerId,
      taskId,
      authToken,
      input,
      clientCertificateSha256
    ) {
      const runner = await authenticateRunner(
        prisma,
        runnerId,
        authToken,
        clientCertificateSha256 ?? null,
        shouldRequireRunnerMtls()
      );

      if (runner.killSwitchActive) {
        await writeAuditEvent(prisma, {
          action: "runner.task.rejected",
          actorType: "Runner",
          entityId: taskId,
          entityType: "RunnerTask",
          metadata: {
            reason: "kill_switch_active",
            state: "accept_denied"
          },
          tenantId: runner.tenantId,
          userId: null
        });

        throw new AppServiceError(
          "Runner kill switch is active; tasks cannot be accepted.",
          409,
          "runner_kill_switch_active"
        );
      }

      if (
        input.runnerId !== runner.runnerId ||
        input.tenantId !== runner.tenantId
      ) {
        throw new AppServiceError(
          "Runner task accept identity mismatch.",
          403,
          "runner_identity_mismatch"
        );
      }

      const task = await prisma.runnerTask.findFirst({
        where: {
          runnerId,
          taskId,
          tenantId: runner.tenantId
        }
      });

      if (!task) {
        throw new AppServiceError(
          "Runner task not found.",
          404,
          "runner_task_not_found"
        );
      }

      const acceptableStates = new Set<string>(["Queued", "Leased"]);
      if (!acceptableStates.has(task.status)) {
        throw new AppServiceError(
          `Runner task cannot be accepted from state ${task.status}.`,
          409,
          "runner_task_invalid_state"
        );
      }

      if (task.expiresAt.getTime() <= Date.now()) {
        throw new AppServiceError(
          "Runner task has expired.",
          410,
          "runner_task_expired"
        );
      }

      // CAS: kill-switch activation marks active tasks DeniedByServerPolicy.
      // An in-flight soft-checked accept must not resurrect that denied task
      // via an unconditional update-by-taskId.
      const acceptedAt = new Date(input.observedAt);
      const claimed = await prisma.runnerTask.updateMany({
        where: {
          expiresAt: {
            gt: new Date()
          },
          runnerId,
          status: {
            in: ["Queued", "Leased"]
          },
          taskId,
          tenantId: runner.tenantId
        },
        data: {
          acceptedAt,
          status: "Accepted"
        }
      });

      if (claimed.count !== 1) {
        await writeAuditEvent(prisma, {
          action: "runner.task.rejected",
          actorType: "Runner",
          entityId: taskId,
          entityType: "RunnerTask",
          metadata: {
            reason: "accept_cas_miss",
            state: task.status
          },
          tenantId: runner.tenantId,
          userId: null
        });

        throw new AppServiceError(
          `Runner task cannot be accepted from state ${task.status}.`,
          409,
          "runner_task_invalid_state"
        );
      }

      const updated = await prisma.runnerTask.findUniqueOrThrow({
        where: { taskId }
      });

      await writeAuditEvent(prisma, {
        action: "runner.task.executed",
        actorType: "Runner",
        entityId: taskId,
        entityType: "RunnerTask",
        metadata: {
          state: "accepted"
        },
        tenantId: runner.tenantId,
        userId: null
      });

      return serializeRunnerTask(updated);
    },

    async rejectRunnerTask(
      runnerId,
      taskId,
      authToken,
      input,
      clientCertificateSha256
    ) {
      const runner = await authenticateRunner(
        prisma,
        runnerId,
        authToken,
        clientCertificateSha256 ?? null,
        shouldRequireRunnerMtls()
      );

      if (
        input.runnerId !== runner.runnerId ||
        input.tenantId !== runner.tenantId
      ) {
        throw new AppServiceError(
          "Runner task reject identity mismatch.",
          403,
          "runner_identity_mismatch"
        );
      }

      const task = await prisma.runnerTask.findFirst({
        where: {
          runnerId,
          taskId,
          tenantId: runner.tenantId
        }
      });

      if (!task) {
        throw new AppServiceError(
          "Runner task not found.",
          404,
          "runner_task_not_found"
        );
      }

      if (isTerminalRunnerTaskStatus(task.status)) {
        await writeAuditEvent(prisma, {
          action: "runner.task.rejected",
          actorType: "Runner",
          entityId: taskId,
          entityType: "RunnerTask",
          metadata: {
            reason: "reject_after_terminal_state",
            state: task.status
          },
          tenantId: runner.tenantId,
          userId: null
        });

        throw new AppServiceError(
          `Runner task cannot be rejected from state ${task.status}.`,
          409,
          "runner_task_invalid_state"
        );
      }

      const updated = await prisma.runnerTask.update({
        where: {
          taskId
        },
        data: {
          completedAt: new Date(input.observedAt),
          errorSummary: input.reason,
          rejectedReason: input.reason,
          status: "DeniedByLocalPolicy"
        }
      });

      await writeAuditEvent(prisma, {
        action: "runner.task.rejected",
        actorType: "Runner",
        entityId: taskId,
        entityType: "RunnerTask",
        metadata: {
          reason: input.reason,
          state: "rejected_by_local_policy"
        },
        tenantId: runner.tenantId,
        userId: null
      });

      return serializeRunnerTask(updated);
    },

    async runnerHeartbeat(runnerId, authToken, input, clientCertificateSha256) {
      const runner = await authenticateRunner(
        prisma,
        runnerId,
        authToken,
        clientCertificateSha256 ?? null,
        shouldRequireRunnerMtls()
      );

      if (
        input.runnerId !== runner.runnerId ||
        input.tenantId !== runner.tenantId
      ) {
        throw new AppServiceError(
          "Runner heartbeat identity mismatch.",
          403,
          "runner_identity_mismatch"
        );
      }

      const updated = await persistRunnerHeartbeat(prisma, runner, input);

      return serializeRunner(updated);
    },

    async rotateRunnerCredentials(
      runnerId,
      authToken,
      input,
      clientCertificateSha256
    ) {
      const parsedInput = RunnerCredentialRotationRequestSchema.parse(input);
      const runner = await authenticateRunner(
        prisma,
        runnerId,
        authToken,
        clientCertificateSha256 ?? null,
        shouldRequireRunnerMtls()
      );

      if (
        parsedInput.runnerId !== runner.runnerId ||
        parsedInput.tenantId !== runner.tenantId
      ) {
        await writeAuditEvent(prisma, {
          action: "runner.task.rejected",
          actorType: "Runner",
          entityId: runnerId,
          entityType: "Runner",
          metadata: {
            reason: "credential_rotation_identity_mismatch"
          },
          tenantId: runner.tenantId,
          userId: null
        });

        throw new AppServiceError(
          "Runner credential rotation identity mismatch.",
          403,
          "runner_identity_mismatch"
        );
      }

      const now = new Date();
      const certificateExpiresAt = addSeconds(now, 90 * 24 * 60 * 60);
      const credentialMaterial = await issueRunnerCredentials({
        certificateExpiresAt,
        csrPem: parsedInput.csrPem,
        devMode: devMode,
        prisma,
        runnerId,
        runnerName: runner.name,
        tenantId: runner.tenantId
      });
      const updated = await prisma.runner.update({
        data: {
          certificateExpiresAt,
          certificateSha256: credentialMaterial.mtlsCertificateSha256,
          lastSeenAt: new Date(parsedInput.observedAt),
          status: "Active",
          version: parsedInput.version
        },
        where: {
          runnerId
        }
      });

      await writeAuditEvent(prisma, {
        action: "runner.credentials.rotated",
        actorType: "Runner",
        entityId: runnerId,
        entityType: "Runner",
        metadata: {
          certificateExpiresAt: certificateExpiresAt.toISOString(),
          certificateSha256: credentialMaterial.mtlsCertificateSha256,
          previousCertificateExpiresAt:
            runner.certificateExpiresAt?.toISOString() ?? null,
          version: parsedInput.version
        },
        tenantId: runner.tenantId,
        userId: null
      });

      const controlPlaneUrl = getRunnerControlPlaneUrl();

      return {
        credentials: {
          caCertificatePem: credentialMaterial.caCertificatePem,
          certificateExpiresAt: credentialMaterial.certificateExpiresAt,
          controlChannel: "LongPollHttps",
          controlPlaneUrl,
          heartbeatIntervalSeconds: 30,
          mtlsCertificateSha256: credentialMaterial.mtlsCertificateSha256,
          mtlsClientCertificatePem: credentialMaterial.mtlsClientCertificatePem,
          mtlsClientPrivateKeyRequired: true as const,
          pollIntervalSeconds: 15,
          runnerId: updated.runnerId,
          taskResultsUrl: `${controlPlaneUrl}/api/v1/runners/${updated.runnerId}/tasks`,
          taskSigningKeyId: credentialMaterial.taskSigningKeyId,
          taskSigningPublicKeyPem: credentialMaterial.taskSigningPublicKeyPem,
          tenantId: updated.tenantId,
          transportAuth: "mtls-client-cert-and-bearer-over-tls" as const
        },
        runner: serializeRunner(updated)
      };
    },

    async pollRunnerTasks(runnerId, authToken, input, clientCertificateSha256) {
      const runner = await authenticateRunner(
        prisma,
        runnerId,
        authToken,
        clientCertificateSha256 ?? null,
        shouldRequireRunnerMtls(),
        true
      );
      const now = new Date();

      if (runner.status === "Revoked") {
        return {
          controlStateChangedAt: runner.revokedAt?.toISOString() ?? null,
          killSwitchActive: false,
          nextPollAfterSeconds: 15,
          runnerRevoked: true,
          tasks: []
        };
      }

      if (input.health?.runnerId && input.health.runnerId !== runner.runnerId) {
        throw new AppServiceError(
          "Runner poll identity mismatch.",
          403,
          "runner_identity_mismatch"
        );
      }
      if (input.health?.tenantId && input.health.tenantId !== runner.tenantId) {
        throw new AppServiceError(
          "Runner poll tenant mismatch.",
          403,
          "runner_identity_mismatch"
        );
      }

      if (input.health) {
        const health = RunnerHeartbeatSchema.parse({
          activeTaskId: input.health.activeTaskId ?? null,
          certificateExpiresAt:
            input.health.certificateExpiresAt ??
            runner.certificateExpiresAt?.toISOString() ??
            null,
          lastTaskCompletedAt: input.health.lastTaskCompletedAt ?? null,
          observedAt: input.health.observedAt ?? now.toISOString(),
          queueDepth: input.health.queueDepth ?? 0,
          runnerId,
          status: input.health.status ?? runner.status,
          tenantId: runner.tenantId,
          version: input.health.version ?? runner.version
        });
        await persistRunnerHeartbeat(prisma, runner, health, now);
      }

      // Kill switch fail-closed: never lease/dispatch tasks while active.
      if (runner.killSwitchActive) {
        await prisma.runner.update({
          where: {
            runnerId
          },
          data: {
            lastSeenAt: now,
            status: "KillSwitchActive"
          }
        });

        return {
          controlStateChangedAt:
            runner.killSwitchActivatedAt?.toISOString() ?? null,
          killSwitchActive: true,
          nextPollAfterSeconds: 15,
          runnerRevoked: false,
          tasks: []
        };
      }

      await prisma.runner.update({
        where: {
          runnerId
        },
        data: {
          lastSeenAt: now,
          status: "Active"
        }
      });

      const expiredOwnTasks = await prisma.runnerTask.findMany({
        select: {
          runId: true,
          taskId: true
        },
        where: {
          expiresAt: {
            lte: now
          },
          runnerId,
          status: {
            in: [...ACTIVE_RUNNER_TASK_STATUSES]
          }
        }
      });
      if (expiredOwnTasks.length > 0) {
        // CAS on active statuses so a concurrent Completed/Failed submit is not
        // overwritten to Expired by the poll reaper.
        await prisma.runnerTask.updateMany({
          data: {
            completedAt: now,
            errorSummary: "Runner task expired before completion.",
            status: "Expired"
          },
          where: {
            status: {
              in: [...ACTIVE_RUNNER_TASK_STATUSES]
            },
            taskId: {
              in: expiredOwnTasks.map((task) => task.taskId)
            }
          }
        });
        // Fail the stranded validation runs so they do not hang after a task
        // times out (a result will never arrive for an expired task).
        await prisma.validationRun.updateMany({
          data: {
            completedAt: now,
            errorSummary: "Runner task expired before completion.",
            status: "Failed"
          },
          where: {
            runId: {
              in: [...new Set(expiredOwnTasks.map((task) => task.runId))]
            },
            status: {
              in: ["Queued", "Running"]
            }
          }
        });
      }

      const tasks = await prisma.runnerTask.findMany({
        orderBy: {
          createdAt: "asc"
        },
        take: 5,
        where: {
          expiresAt: {
            gt: now
          },
          runnerId,
          status: "Queued"
        }
      });

      // P03-20: PEP re-check at runner task accept (lease). A decision that was
      // Allowed at create time may have been denied/expired/scope-revoked; deny
      // and never lease Denied work.
      const leasableTasks = [];
      for (const task of tasks) {
        const run = await prisma.validationRun.findFirst({
          where: {
            runId: task.runId,
            tenantId: runner.tenantId
          }
        });
        if (!run?.policyDecisionId) {
          // Legacy tasks without a bound decision: fail closed (do not lease).
          await prisma.runnerTask.update({
            data: {
              completedAt: now,
              errorSummary:
                "Runner task accept refused: missing policy decision (PEP fail-closed).",
              status: "DeniedByServerPolicy"
            },
            where: { taskId: task.taskId }
          });
          if (run) {
            await prisma.validationRun.updateMany({
              data: {
                completedAt: now,
                errorSummary:
                  "Runner task accept refused: missing policy decision (PEP fail-closed).",
                status: "DeniedByPolicy"
              },
              where: {
                runId: run.runId,
                status: { in: ["Queued", "Running"] }
              }
            });
          }
          continue;
        }

        const decision = await prisma.policyDecision.findFirst({
          where: {
            policyDecisionId: run.policyDecisionId,
            tenantId: runner.tenantId
          }
        });
        const scope = await prisma.scope.findFirst({
          where: {
            scopeId: task.scopeId,
            tenantId: runner.tenantId
          }
        });

        if (!decision || !scope) {
          await prisma.runnerTask.update({
            data: {
              completedAt: now,
              errorSummary:
                "Runner task accept refused: policy decision or scope missing (PEP).",
              status: "DeniedByServerPolicy"
            },
            where: { taskId: task.taskId }
          });
          await prisma.validationRun.updateMany({
            data: {
              completedAt: now,
              errorSummary:
                "Runner task accept refused: policy decision or scope missing (PEP).",
              status: "DeniedByPolicy"
            },
            where: {
              runId: task.runId,
              status: { in: ["Queued", "Running"] }
            }
          });
          continue;
        }

        // Use a synthetic Operator role for system-side recheck; prior approval
        // on the stored decision is still honored by the dual gate.
        const pep = await enforceExecutionPolicy({
          audit: true,
          decision,
          entrypoint: "runner_task_accept",
          missionId: task.missionId,
          prisma,
          scope,
          tenantId: runner.tenantId,
          userId: null,
          userRole: "Admin"
        });

        if (pep.verdict !== "Allowed" || !pep.allowance) {
          await prisma.runnerTask.update({
            data: {
              completedAt: now,
              errorSummary: `Runner task accept denied by PEP (${pep.code}).`,
              status: "DeniedByServerPolicy"
            },
            where: { taskId: task.taskId }
          });
          await prisma.validationRun.updateMany({
            data: {
              completedAt: now,
              errorSummary: `Runner task accept denied by PEP (${pep.code}).`,
              status: "DeniedByPolicy"
            },
            where: {
              runId: task.runId,
              status: { in: ["Queued", "Running"] }
            }
          });
          await writeAuditEvent(prisma, {
            action: "runner.task.rejected",
            actorType: "System",
            entityId: task.taskId,
            entityType: "Runner",
            metadata: {
              code: pep.code,
              entrypoint: "runner_task_accept",
              outcome: pep.liveOutcome,
              policyDecisionId: decision.policyDecisionId,
              reason: "pep_denied_at_accept",
              runId: task.runId
            },
            tenantId: runner.tenantId,
            userId: null
          });
          continue;
        }

        // P10-1 / P10-2: re-check segment profile + affinity at lease time.
        const segmentGate = evaluateSegmentProfileTaskGate({
          moduleId: task.moduleId,
          profileId: runner.segmentProfileId ?? null,
          safetyLevel: task.safetyLevel
        });
        if (!segmentGate.allowed) {
          await prisma.runnerTask.update({
            data: {
              completedAt: now,
              errorSummary: `Runner task accept denied by segment profile (${segmentGate.code}).`,
              status: "DeniedByServerPolicy"
            },
            where: { taskId: task.taskId }
          });
          await prisma.validationRun.updateMany({
            data: {
              completedAt: now,
              errorSummary: `Runner task accept denied by segment profile (${segmentGate.code}).`,
              status: "DeniedByPolicy"
            },
            where: {
              runId: task.runId,
              status: { in: ["Queued", "Running"] }
            }
          });
          await writeAuditEvent(prisma, {
            action: "runner.task.rejected",
            actorType: "System",
            entityId: task.taskId,
            entityType: "Runner",
            metadata: {
              code: segmentGate.code,
              entrypoint: "runner_task_accept",
              reason: "segment_profile_denied_at_accept",
              runId: task.runId
            },
            tenantId: runner.tenantId,
            userId: null
          });
          continue;
        }

        const taskInputs =
          task.inputs && typeof task.inputs === "object"
            ? (task.inputs as Record<string, unknown>)
            : {};
        const routingSiteId =
          typeof taskInputs.siteId === "string" ? taskInputs.siteId : null;
        const routingSegment =
          typeof taskInputs.networkSegment === "string"
            ? taskInputs.networkSegment
            : null;
        if (
          (routingSiteId || routingSegment) &&
          !runnerMatchesAffinityConstraints(
            {
              affinity: {
                approvedCidrs: [],
                networkSegment: runner.networkSegment ?? null,
                segmentProfileId:
                  runner.segmentProfileId === "campus-passive" ||
                  runner.segmentProfileId === "dc-measured" ||
                  runner.segmentProfileId === "ot-safe-baseline"
                    ? runner.segmentProfileId
                    : null,
                siteId: runner.siteId ?? null
              },
              runnerId: runner.runnerId,
              status: runner.status
            },
            buildRunnerTaskRoutingHint({
              networkSegment: routingSegment,
              preferredRunnerId: runner.runnerId,
              siteId: routingSiteId
            })
          )
        ) {
          await prisma.runnerTask.update({
            data: {
              completedAt: now,
              errorSummary:
                "Runner task accept denied: site/network-segment affinity mismatch.",
              status: "DeniedByServerPolicy"
            },
            where: { taskId: task.taskId }
          });
          await prisma.validationRun.updateMany({
            data: {
              completedAt: now,
              errorSummary:
                "Runner task accept denied: site/network-segment affinity mismatch.",
              status: "DeniedByPolicy"
            },
            where: {
              runId: task.runId,
              status: { in: ["Queued", "Running"] }
            }
          });
          await writeAuditEvent(prisma, {
            action: "runner.task.rejected",
            actorType: "System",
            entityId: task.taskId,
            entityType: "Runner",
            metadata: {
              code: "runner_affinity_mismatch",
              entrypoint: "runner_task_accept",
              reason: "affinity_denied_at_accept",
              runId: task.runId
            },
            tenantId: runner.tenantId,
            userId: null
          });
          continue;
        }

        leasableTasks.push(task);
      }

      // Compare-and-swap Queued → Leased so two concurrent pollers (or a
      // race with accept/cancel) cannot both observe the same Queued row and
      // both "lease" it. Only the winner of updateMany(status=Queued) returns
      // the task envelope.
      const leasedTasks = (
        await Promise.all(
          leasableTasks.map(async (task) => {
            const claimed = await prisma.runnerTask.updateMany({
              data: {
                leasedAt: now,
                status: "Leased"
              },
              where: {
                expiresAt: {
                  gt: now
                },
                runnerId,
                status: "Queued",
                taskId: task.taskId
              }
            });
            if (claimed.count !== 1) {
              return null;
            }
            return prisma.runnerTask.findUniqueOrThrow({
              where: {
                taskId: task.taskId
              }
            });
          })
        )
      ).filter((task): task is NonNullable<typeof task> => task !== null);

      return {
        controlStateChangedAt: null,
        killSwitchActive: false,
        nextPollAfterSeconds: 15,
        runnerRevoked: false,
        tasks: leasedTasks.map((task) => serializeRunnerTask(task).envelope)
      };
    },

    async createRunnerReachabilityTask(context, runnerId, input) {
      requireRole(
        context.membership.role,
        RUNNER_ADMIN_ROLES,
        "create runner reachability tasks"
      );

      const runner = await prisma.runner.findFirst({
        where: {
          runnerId,
          status: {
            not: "Revoked"
          },
          tenantId: context.tenant.tenantId
        }
      });

      if (!runner) {
        throw new AppServiceError("Runner not found.", 404, "runner_not_found");
      }

      if (runner.killSwitchActive) {
        await writeAuditEvent(prisma, {
          action: "runner.task.rejected",
          actorType: "User",
          entityId: runnerId,
          entityType: "Runner",
          metadata: {
            reason: "kill_switch_active"
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });

        throw new AppServiceError(
          "Runner kill switch is active; tasks cannot be dispatched.",
          409,
          "runner_kill_switch_active"
        );
      }

      // P10-1 / P10-2: segment profile + optional site/segment affinity at create.
      const segmentGate = assertRunnerSegmentProfileAllowsTask(
        runner,
        "runner.reachability_check",
        "ActiveNonInvasive"
      );
      assertRunnerAffinityAllowsTask(runner, {
        networkSegment: input.networkSegment,
        preferredRunnerId: runnerId,
        siteId: input.siteId
      });

      const scope = await prisma.scope.findFirst({
        where: {
          scopeId: input.scopeId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!scope) {
        throw new AppServiceError("Scope not found.", 404, "scope_not_found");
      }

      const serializedScope = serializeScope(scope);

      if (serializedScope.verificationStatus !== "Verified") {
        throw new AppServiceError(
          "Runner tasks require verified scope.",
          400,
          "verified_scope_required"
        );
      }

      if (!isHostnameTargetAllowedByScope(serializedScope, input.targetHost)) {
        throw new AppServiceError(
          "Runner target is outside the verified scope constraints.",
          400,
          "runner_scope_violation"
        );
      }

      const evaluated = evaluatePolicy({
        adminApproval: false,
        executionEnvironment: "InternalRunner",
        explicitMissionApproval: false,
        missionType: "ExposureValidation",
        requestedAction: {
          credentialTheft: false,
          destructive: false,
          persistence: false,
          realDataExfiltration: false,
          requiresInternalRunner: true,
          requiresTimeWindow: false,
          uncontrolledExploitChaining: false
        },
        safetyLevel: "ActiveNonInvasive",
        scopeContext: serializedScope,
        scopeVerificationStatus: serializedScope.verificationStatus,
        timeWindowApproved: false,
        userRole: context.membership.role
      });

      const decision = await prisma.policyDecision.create({
        data: {
          approvalState: evaluated.approvalState,
          executionEnvironment: "InternalRunner",
          missionType: "ExposureValidation",
          outcome: evaluated.outcome,
          rationale: evaluated.rationale,
          requestedAction: {
            credentialTheft: false,
            destructive: false,
            persistence: false,
            realDataExfiltration: false,
            requiresInternalRunner: true,
            requiresTimeWindow: false,
            uncontrolledExploitChaining: false
          } as Prisma.InputJsonValue,
          safetyLevel: "ActiveNonInvasive",
          scopeId: input.scopeId,
          target: {
            ports: input.ports,
            targetHost: input.targetHost
          } as Prisma.InputJsonValue,
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        }
      });

      await writeAuditEvent(prisma, {
        action: "policy.decision",
        actorType: "User",
        entityId: decision.policyDecisionId,
        entityType: "Scope",
        metadata: {
          executionEnvironment: "InternalRunner",
          outcome: decision.outcome,
          scopeId: input.scopeId
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      // P03-20: PEP — Denied never creates a runner task.
      const pep = enforceFreshPolicyEvaluation({
        entrypoint: "runner_task_create",
        outcome: decision.outcome,
        policyDecisionId: decision.policyDecisionId,
        rationale: decision.rationale,
        tenantId: context.tenant.tenantId
      });
      if (pep.verdict !== "Allowed" || !pep.allowance) {
        throw new AppServiceError(
          decision.rationale,
          400,
          "policy_denied"
        );
      }

      const now = new Date();
      const expiresAt = addSeconds(now, input.timeoutSeconds + 300);
      const mission = await prisma.validationMission.create({
        data: {
          evidenceIds: [],
          missionType: "ExposureValidation",
          policyDecisionId: decision.policyDecisionId,
          policyProfile: "runner-reachability",
          requestedBy: context.user.userId,
          safetyLevel: "ActiveNonInvasive",
          scopeId: input.scopeId,
          scopeIds: [input.scopeId],
          startedAt: now,
          status: "Queued",
          tenantId: context.tenant.tenantId
        }
      });
      const run = await prisma.validationRun.create({
        data: {
          evidenceIds: [],
          missionId: mission.missionId,
          moduleId: "runner.reachability_check",
          outcome: null,
          policyDecisionId: decision.policyDecisionId,
          runnerId,
          safetyLevel: "ActiveNonInvasive",
          scopeId: input.scopeId,
          startedAt: null,
          status: "Queued",
          target: {
            ports: input.ports,
            targetHost: input.targetHost,
            timeoutSeconds: input.timeoutSeconds
          } as Prisma.InputJsonValue,
          tenantId: context.tenant.tenantId,
          validationState: null
        }
      });
      const taskId = randomUUID();
      const scopeConstraints = withSegmentForbidInternetEgress(
        buildScopeConstraints(serializedScope, input.ports),
        segmentGate.forbidInternetEgress
      );
      const unsignedEnvelope: Omit<RunnerTaskEnvelope, "signature"> = {
        artifactUpload: {
          artifactUploadUrl: `${getRunnerControlPlaneUrl()}/api/v1/runners/${runnerId}/tasks/${taskId}/artifacts`,
          maxArtifactBytes: 1_000_000,
          resultCallbackUrl: `${getRunnerControlPlaneUrl()}/api/v1/runners/${runnerId}/tasks/${taskId}/result`
        },
        executionEnvironment: "InternalRunner",
        expiresAt: expiresAt.toISOString(),
        inputs: {
          networkSegment: input.networkSegment ?? null,
          rateLimitPerMinute: input.rateLimitPerMinute,
          siteId: input.siteId ?? null,
          timeoutSeconds: input.timeoutSeconds
        },
        issuedAt: now.toISOString(),
        missionId: mission.missionId,
        moduleId: "runner.reachability_check",
        runId: run.runId,
        runnerId,
        safetyLevel: "ActiveNonInvasive",
        scopeConstraints,
        scopeId: input.scopeId,
        target: {
          ports: input.ports,
          targetHost: input.targetHost
        },
        taskId,
        tenantId: context.tenant.tenantId
      };
      const envelope = await signRunnerTaskEnvelope(
        prisma,
        context.tenant.tenantId,
        devMode,
        unsignedEnvelope
      );
      const task = await prisma.runnerTask.create({
        data: {
          envelope: envelope as unknown as Prisma.InputJsonValue,
          expiresAt,
          inputs: unsignedEnvelope.inputs as Prisma.InputJsonValue,
          issuedAt: now,
          missionId: mission.missionId,
          moduleId: unsignedEnvelope.moduleId,
          nonce: envelope.signature.nonce,
          runId: run.runId,
          runnerId,
          safetyLevel: "ActiveNonInvasive",
          scopeConstraints: scopeConstraints as Prisma.InputJsonValue,
          scopeId: input.scopeId,
          status: "Queued",
          target: unsignedEnvelope.target as Prisma.InputJsonValue,
          taskId,
          taskType: "reachability",
          tenantId: context.tenant.tenantId
        }
      });

      return {
        envelope,
        mission: serializeValidationMission(mission),
        run: serializeValidationRun(run),
        task: serializeRunnerTask(task)
      };
    },

    // Generic dispatch for the additional passive internal modules (DNS / TLS /
    // HTTP health). Mirrors createRunnerReachabilityTask's policy/scope/sign path
    // deliberately (the proven signed-task flow is left untouched); only the
    // module id, single-port target, module inputs, and safety level differ.
    async createRunnerCheckTask(context, runnerId, input) {
      requireRole(
        context.membership.role,
        RUNNER_ADMIN_ROLES,
        "create runner internal-check tasks"
      );

      const runner = await prisma.runner.findFirst({
        where: {
          runnerId,
          status: {
            not: "Revoked"
          },
          tenantId: context.tenant.tenantId
        }
      });

      if (!runner) {
        throw new AppServiceError("Runner not found.", 404, "runner_not_found");
      }

      if (runner.killSwitchActive) {
        await writeAuditEvent(prisma, {
          action: "runner.task.rejected",
          actorType: "User",
          entityId: runnerId,
          entityType: "Runner",
          metadata: {
            reason: "kill_switch_active"
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });

        throw new AppServiceError(
          "Runner kill switch is active; tasks cannot be dispatched.",
          409,
          "runner_kill_switch_active"
        );
      }

      const segmentGate = assertRunnerSegmentProfileAllowsTask(
        runner,
        input.module,
        "PassiveReadOnly"
      );
      assertRunnerAffinityAllowsTask(runner, {
        networkSegment: input.networkSegment,
        preferredRunnerId: runnerId,
        siteId: input.siteId
      });

      const scope = await prisma.scope.findFirst({
        where: {
          scopeId: input.scopeId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!scope) {
        throw new AppServiceError("Scope not found.", 404, "scope_not_found");
      }

      const serializedScope = serializeScope(scope);

      if (serializedScope.verificationStatus !== "Verified") {
        throw new AppServiceError(
          "Runner tasks require verified scope.",
          400,
          "verified_scope_required"
        );
      }

      if (!isHostnameTargetAllowedByScope(serializedScope, input.targetHost)) {
        throw new AppServiceError(
          "Runner target is outside the verified scope constraints.",
          400,
          "runner_scope_violation"
        );
      }

      const requestedAction = {
        credentialTheft: false,
        destructive: false,
        persistence: false,
        realDataExfiltration: false,
        requiresInternalRunner: true,
        requiresTimeWindow: false,
        uncontrolledExploitChaining: false
      };
      const evaluated = evaluatePolicy({
        adminApproval: false,
        executionEnvironment: "InternalRunner",
        explicitMissionApproval: false,
        missionType: "ExposureValidation",
        requestedAction,
        safetyLevel: "PassiveReadOnly",
        scopeContext: serializedScope,
        scopeVerificationStatus: serializedScope.verificationStatus,
        timeWindowApproved: false,
        userRole: context.membership.role
      });

      const decision = await prisma.policyDecision.create({
        data: {
          approvalState: evaluated.approvalState,
          executionEnvironment: "InternalRunner",
          missionType: "ExposureValidation",
          outcome: evaluated.outcome,
          rationale: evaluated.rationale,
          requestedAction: requestedAction as Prisma.InputJsonValue,
          safetyLevel: "PassiveReadOnly",
          scopeId: input.scopeId,
          target: {
            module: input.module,
            targetHost: input.targetHost
          } as Prisma.InputJsonValue,
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        }
      });

      await writeAuditEvent(prisma, {
        action: "policy.decision",
        actorType: "User",
        entityId: decision.policyDecisionId,
        entityType: "Scope",
        metadata: {
          executionEnvironment: "InternalRunner",
          outcome: decision.outcome,
          scopeId: input.scopeId
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      {
        const pep = enforceFreshPolicyEvaluation({
          entrypoint: "runner_task_create",
          outcome: decision.outcome,
          policyDecisionId: decision.policyDecisionId,
          rationale: decision.rationale,
          tenantId: context.tenant.tenantId
        });
        if (pep.verdict !== "Allowed" || !pep.allowance) {
          throw new AppServiceError(decision.rationale, 400, "policy_denied");
        }
      }

      const isDns = input.module === "runner.dns_resolution_check";
      const scopePorts = isDns || input.port === undefined ? [] : [input.port];
      const taskTypeByModule = {
        "runner.dns_resolution_check": "dns_resolution",
        "runner.http_health_check": "http_health",
        "runner.tls_certificate_check": "tls_certificate",
        "runner.http_header_check": "http_header",
        "runner.cert_expiry_check": "cert_expiry",
        "runner.tcp_banner_check": "tcp_banner",
        "runner.tls_info_check": "tls_info"
      } as const;

      const taskInputs: Record<string, unknown> = {
        networkSegment: input.networkSegment ?? null,
        rateLimitPerMinute: input.rateLimitPerMinute,
        siteId: input.siteId ?? null,
        timeoutSeconds: input.timeoutSeconds
      };
      if (input.port !== undefined) {
        taskInputs.port = input.port;
      }
      if (input.path !== undefined) {
        taskInputs.path = input.path;
      }
      if (input.scheme !== undefined) {
        taskInputs.scheme = input.scheme;
      }
      const taskTarget: Record<string, unknown> = {
        targetHost: input.targetHost
      };
      if (input.port !== undefined) {
        taskTarget.ports = [input.port];
      }

      const now = new Date();
      const expiresAt = addSeconds(now, input.timeoutSeconds + 300);
      const mission = await prisma.validationMission.create({
        data: {
          evidenceIds: [],
          missionType: "ExposureValidation",
          policyDecisionId: decision.policyDecisionId,
          policyProfile: "runner-internal-check",
          requestedBy: context.user.userId,
          safetyLevel: "PassiveReadOnly",
          scopeId: input.scopeId,
          scopeIds: [input.scopeId],
          startedAt: now,
          status: "Queued",
          tenantId: context.tenant.tenantId
        }
      });
      const run = await prisma.validationRun.create({
        data: {
          evidenceIds: [],
          missionId: mission.missionId,
          moduleId: input.module,
          outcome: null,
          policyDecisionId: decision.policyDecisionId,
          runnerId,
          safetyLevel: "PassiveReadOnly",
          scopeId: input.scopeId,
          startedAt: null,
          status: "Queued",
          target: {
            ...taskTarget,
            timeoutSeconds: input.timeoutSeconds
          } as Prisma.InputJsonValue,
          tenantId: context.tenant.tenantId,
          validationState: null
        }
      });
      const taskId = randomUUID();
      const scopeConstraints = withSegmentForbidInternetEgress(
        buildScopeConstraints(serializedScope, scopePorts),
        segmentGate.forbidInternetEgress
      );
      const unsignedEnvelope: Omit<RunnerTaskEnvelope, "signature"> = {
        artifactUpload: {
          artifactUploadUrl: `${getRunnerControlPlaneUrl()}/api/v1/runners/${runnerId}/tasks/${taskId}/artifacts`,
          maxArtifactBytes: 1_000_000,
          resultCallbackUrl: `${getRunnerControlPlaneUrl()}/api/v1/runners/${runnerId}/tasks/${taskId}/result`
        },
        executionEnvironment: "InternalRunner",
        expiresAt: expiresAt.toISOString(),
        inputs: taskInputs,
        issuedAt: now.toISOString(),
        missionId: mission.missionId,
        moduleId: input.module,
        runId: run.runId,
        runnerId,
        safetyLevel: "PassiveReadOnly",
        scopeConstraints,
        scopeId: input.scopeId,
        target: taskTarget,
        taskId,
        tenantId: context.tenant.tenantId
      };
      const envelope = await signRunnerTaskEnvelope(
        prisma,
        context.tenant.tenantId,
        devMode,
        unsignedEnvelope
      );
      const task = await prisma.runnerTask.create({
        data: {
          envelope: envelope as unknown as Prisma.InputJsonValue,
          expiresAt,
          inputs: taskInputs as Prisma.InputJsonValue,
          issuedAt: now,
          missionId: mission.missionId,
          moduleId: input.module,
          nonce: envelope.signature.nonce,
          runId: run.runId,
          runnerId,
          safetyLevel: "PassiveReadOnly",
          scopeConstraints: scopeConstraints as Prisma.InputJsonValue,
          scopeId: input.scopeId,
          status: "Queued",
          target: taskTarget as Prisma.InputJsonValue,
          taskId,
          taskType: taskTypeByModule[input.module],
          tenantId: context.tenant.tenantId
        }
      });

      return {
        envelope,
        mission: serializeValidationMission(mission),
        run: serializeValidationRun(run),
        task: serializeRunnerTask(task)
      };
    },

    // Dispatch an ALLOWLISTED built-in measured (periscan.*) module to the
    // in-network Node runner-agent against an internal host. Mirrors
    // createRunnerCheckTask's proven policy/scope/sign path exactly; the only
    // differences are the allowlist guard, the module-derived safety level, and
    // that the envelope moduleId is the real periscan module the agent runs.
    async createRunnerMeasuredTask(context, runnerId, input) {
      requireRole(
        context.membership.role,
        RUNNER_ADMIN_ROLES,
        "create runner measured-check tasks"
      );

      // Authorization boundary: never dispatch a non-allowlisted/offensive
      // module to the runner, even if the schema were bypassed.
      if (!isRunnerMeasuredModuleId(input.moduleId)) {
        throw new AppServiceError(
          `${input.moduleId} is not an allowlisted runner-safe measured module.`,
          400,
          "module_not_runner_safe"
        );
      }
      const manifest = getModuleById(input.moduleId)?.manifest;
      if (!manifest) {
        throw new AppServiceError(
          `${input.moduleId} is not a registered module.`,
          400,
          "module_not_found"
        );
      }
      const safetyLevel = manifest.safetyLevel;

      // "Verify in-network" intent: a remediationId associates this task with a
      // remediation so its measured result can re-confirm the fix. Validate it
      // belongs to the tenant before dispatching.
      if (input.remediationId) {
        const remediation = await prisma.remediationTask.findFirst({
          where: {
            remediationId: input.remediationId,
            tenantId: context.tenant.tenantId
          }
        });
        if (!remediation) {
          throw new AppServiceError(
            "Remediation not found.",
            404,
            "remediation_not_found"
          );
        }
      }

      const runner = await prisma.runner.findFirst({
        where: {
          runnerId,
          status: { not: "Revoked" },
          tenantId: context.tenant.tenantId
        }
      });
      if (!runner) {
        throw new AppServiceError("Runner not found.", 404, "runner_not_found");
      }
      if (runner.killSwitchActive) {
        await writeAuditEvent(prisma, {
          action: "runner.task.rejected",
          actorType: "User",
          entityId: runnerId,
          entityType: "Runner",
          metadata: { reason: "kill_switch_active" },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
        throw new AppServiceError(
          "Runner kill switch is active; tasks cannot be dispatched.",
          409,
          "runner_kill_switch_active"
        );
      }

      const segmentGate = assertRunnerSegmentProfileAllowsTask(
        runner,
        input.moduleId,
        safetyLevel
      );
      assertRunnerAffinityAllowsTask(runner, {
        networkSegment: input.networkSegment,
        preferredRunnerId: runnerId,
        siteId: input.siteId
      });

      const scope = await prisma.scope.findFirst({
        where: { scopeId: input.scopeId, tenantId: context.tenant.tenantId }
      });
      if (!scope) {
        throw new AppServiceError("Scope not found.", 404, "scope_not_found");
      }
      const serializedScope = serializeScope(scope);
      if (serializedScope.verificationStatus !== "Verified") {
        throw new AppServiceError(
          "Runner tasks require verified scope.",
          400,
          "verified_scope_required"
        );
      }
      if (
        input.moduleId === "periscan.endpoint_benign_marker_emit" &&
        !manifest.requiredScopes.includes(serializedScope.scopeType)
      ) {
        throw new AppServiceError(
          `${input.moduleId} cannot run against ${serializedScope.scopeType} scope.`,
          400,
          "module_scope_mismatch"
        );
      }
      if (!isHostnameTargetAllowedByScope(serializedScope, input.targetHost)) {
        throw new AppServiceError(
          "Runner target is outside the verified scope constraints.",
          400,
          "runner_scope_violation"
        );
      }

      const requestedAction = {
        credentialTheft: false,
        destructive: false,
        persistence: false,
        realDataExfiltration: false,
        requiresInternalRunner: true,
        requiresTimeWindow: false,
        uncontrolledExploitChaining: false
      };
      const missionType =
        input.moduleId === "periscan.endpoint_benign_marker_emit"
          ? ("ControlValidation" as const)
          : ("ExposureValidation" as const);
      const evaluated = evaluatePolicy({
        adminApproval: false,
        executionEnvironment: "InternalRunner",
        explicitMissionApproval: false,
        missionType,
        requestedAction,
        safetyLevel,
        scopeContext: serializedScope,
        scopeVerificationStatus: serializedScope.verificationStatus,
        timeWindowApproved: false,
        userRole: context.membership.role
      });
      const decision = await prisma.policyDecision.create({
        data: {
          approvalState: evaluated.approvalState,
          executionEnvironment: "InternalRunner",
          missionType,
          outcome: evaluated.outcome,
          rationale: evaluated.rationale,
          requestedAction: requestedAction as Prisma.InputJsonValue,
          safetyLevel,
          scopeId: input.scopeId,
          target: {
            markerId: input.markerId,
            module: input.moduleId,
            platform: input.platform,
            targetHost: input.targetHost
          } as Prisma.InputJsonValue,
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        }
      });
      await writeAuditEvent(prisma, {
        action: "policy.decision",
        actorType: "User",
        entityId: decision.policyDecisionId,
        entityType: "Scope",
        metadata: {
          executionEnvironment: "InternalRunner",
          outcome: decision.outcome,
          scopeId: input.scopeId
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
      {
        const pep = enforceFreshPolicyEvaluation({
          entrypoint: "runner_task_create",
          outcome: decision.outcome,
          policyDecisionId: decision.policyDecisionId,
          rationale: decision.rationale,
          tenantId: context.tenant.tenantId
        });
        if (pep.verdict !== "Allowed" || !pep.allowance) {
          throw new AppServiceError(decision.rationale, 400, "policy_denied");
        }
      }

      const scopePorts = input.port === undefined ? [] : [input.port];
      const taskInputs: Record<string, unknown> = {
        networkSegment: input.networkSegment ?? null,
        rateLimitPerMinute: input.rateLimitPerMinute,
        siteId: input.siteId ?? null,
        timeoutSeconds: input.timeoutSeconds
      };
      if (input.port !== undefined) {
        taskInputs.port = input.port;
      }
      if (input.path !== undefined) {
        taskInputs.path = input.path;
      }
      if (input.scheme !== undefined) {
        taskInputs.scheme = input.scheme;
      }
      if (input.remediationId !== undefined) {
        // Carried so result-ingestion can record the in-network re-verification.
        taskInputs.remediationId = input.remediationId;
      }
      if (input.markerId !== undefined) {
        taskInputs.markerId = input.markerId;
      }
      if (input.platform !== undefined) {
        taskInputs.platform = input.platform;
      }
      // The measured modules accept a {hostname} target (plus optional port).
      const taskTarget: Record<string, unknown> = {
        hostname: input.targetHost,
        targetHost: input.targetHost
      };
      if (input.markerId !== undefined) {
        taskTarget.markerId = input.markerId;
      }
      if (input.platform !== undefined) {
        taskTarget.platform = input.platform;
      }
      if (input.port !== undefined) {
        taskTarget.port = input.port;
        taskTarget.ports = [input.port];
      }

      const now = new Date();
      const expiresAt = addSeconds(now, input.timeoutSeconds + 300);
      const mission = await prisma.validationMission.create({
        data: {
          evidenceIds: [],
          missionType,
          policyDecisionId: decision.policyDecisionId,
          policyProfile: "runner-measured-check",
          requestedBy: context.user.userId,
          safetyLevel,
          scopeId: input.scopeId,
          scopeIds: [input.scopeId],
          startedAt: now,
          status: "Queued",
          tenantId: context.tenant.tenantId
        }
      });
      const run = await prisma.validationRun.create({
        data: {
          evidenceIds: [],
          missionId: mission.missionId,
          moduleId: input.moduleId,
          outcome: null,
          policyDecisionId: decision.policyDecisionId,
          runnerId,
          safetyLevel,
          scopeId: input.scopeId,
          startedAt: null,
          status: "Queued",
          target: {
            ...taskTarget,
            timeoutSeconds: input.timeoutSeconds
          } as Prisma.InputJsonValue,
          tenantId: context.tenant.tenantId,
          validationState: null
        }
      });
      const taskId = randomUUID();
      const scopeConstraints = withSegmentForbidInternetEgress(
        buildScopeConstraints(serializedScope, scopePorts),
        segmentGate.forbidInternetEgress
      );
      const unsignedEnvelope: Omit<RunnerTaskEnvelope, "signature"> = {
        artifactUpload: {
          artifactUploadUrl: `${getRunnerControlPlaneUrl()}/api/v1/runners/${runnerId}/tasks/${taskId}/artifacts`,
          maxArtifactBytes: 1_000_000,
          resultCallbackUrl: `${getRunnerControlPlaneUrl()}/api/v1/runners/${runnerId}/tasks/${taskId}/result`
        },
        executionEnvironment: "InternalRunner",
        expiresAt: expiresAt.toISOString(),
        inputs: taskInputs,
        issuedAt: now.toISOString(),
        missionId: mission.missionId,
        moduleId: input.moduleId,
        runId: run.runId,
        runnerId,
        safetyLevel,
        scopeConstraints,
        scopeId: input.scopeId,
        target: taskTarget,
        taskId,
        tenantId: context.tenant.tenantId
      };
      const envelope = await signRunnerTaskEnvelope(
        prisma,
        context.tenant.tenantId,
        devMode,
        unsignedEnvelope
      );
      const task = await prisma.runnerTask.create({
        data: {
          envelope: envelope as unknown as Prisma.InputJsonValue,
          expiresAt,
          inputs: taskInputs as Prisma.InputJsonValue,
          issuedAt: now,
          missionId: mission.missionId,
          moduleId: input.moduleId,
          nonce: envelope.signature.nonce,
          runId: run.runId,
          runnerId,
          safetyLevel,
          scopeConstraints: scopeConstraints as Prisma.InputJsonValue,
          scopeId: input.scopeId,
          status: "Queued",
          target: taskTarget as Prisma.InputJsonValue,
          taskId,
          taskType: input.moduleId,
          tenantId: context.tenant.tenantId
        }
      });

      return {
        envelope,
        mission: serializeValidationMission(mission),
        run: serializeValidationRun(run),
        task: serializeRunnerTask(task)
      };
    },

    async uploadRunnerTaskArtifact(
      runnerId,
      taskId,
      authToken,
      input,
      clientCertificateSha256
    ) {
      const parsedInput = RunnerTaskArtifactUploadRequestSchema.parse(input);
      const runner = await authenticateRunner(
        prisma,
        runnerId,
        authToken,
        clientCertificateSha256 ?? null,
        shouldRequireRunnerMtls()
      );
      const task = await prisma.runnerTask.findFirst({
        where: {
          runnerId,
          taskId,
          tenantId: runner.tenantId
        }
      });

      if (!task) {
        throw new AppServiceError(
          "Runner task not found.",
          404,
          "runner_task_not_found"
        );
      }

      if (isTerminalRunnerTaskStatus(task.status)) {
        await writeAuditEvent(prisma, {
          action: "runner.task.rejected",
          actorType: "Runner",
          entityId: taskId,
          entityType: "RunnerTask",
          metadata: {
            reason: "artifact_after_terminal_state",
            state: task.status
          },
          tenantId: runner.tenantId,
          userId: null
        });

        throw new AppServiceError(
          `Runner task artifact cannot be uploaded from terminal state ${task.status}.`,
          409,
          "runner_task_invalid_state"
        );
      }

      if (task.expiresAt.getTime() <= Date.now()) {
        await writeAuditEvent(prisma, {
          action: "runner.task.rejected",
          actorType: "Runner",
          entityId: taskId,
          entityType: "RunnerTask",
          metadata: {
            reason: "expired_artifact_upload"
          },
          tenantId: runner.tenantId,
          userId: null
        });

        throw new AppServiceError(
          "Runner task artifact upload expired.",
          410,
          "runner_task_expired"
        );
      }

      const envelope = RunnerTaskEnvelopeSchema.parse(task.envelope);
      const content = Buffer.from(parsedInput.contentBase64, "base64");

      if (content.byteLength !== parsedInput.sizeBytes) {
        throw new AppServiceError(
          "Runner artifact size does not match manifest.",
          400,
          "runner_artifact_size_mismatch"
        );
      }

      if (content.byteLength > envelope.artifactUpload.maxArtifactBytes) {
        throw new AppServiceError(
          "Runner artifact exceeds signed task upload limit.",
          413,
          "runner_artifact_too_large"
        );
      }

      const rawSha256 = createHash("sha256").update(content).digest("hex");
      if (rawSha256 !== parsedInput.sha256.toLowerCase()) {
        throw new AppServiceError(
          "Runner artifact SHA-256 does not match manifest.",
          400,
          "runner_artifact_hash_mismatch"
        );
      }

      const evidenceService = createPrismaEvidenceService({
        prisma
      });
      const stored = await evidenceService.putEvidenceArtifact({
        artifactType: parsedInput.artifactType,
        content,
        contentType: parsedInput.contentType,
        filename: parsedInput.filename ?? `runner-${taskId}`,
        relatedEntityId: task.runId,
        relatedEntityType: "ValidationRun",
        sensitivityLevel: "Low",
        tenantId: runner.tenantId
      });

      await writeAuditEvent(prisma, {
        action: "evidence.created",
        actorType: "Runner",
        entityId: taskId,
        entityType: "RunnerTask",
        metadata: {
          evidenceId: stored.artifact.evidenceId,
          redactionStatus: stored.artifact.redactionStatus,
          runId: task.runId,
          taskId
        },
        tenantId: runner.tenantId,
        userId: null
      });

      return {
        artifact: stored.artifact
      };
    },

    // Dispatch an ALLOWLISTED in-network discovery module (recon.*) to the
    // runner-agent for host/service inventory. Mirrors createRunnerMeasuredTask's
    // proven policy/scope/sign path; differs only in the allowlist guard, the
    // network-target shaping per module, and the InternalRunner safety level.
    async createRunnerDiscoverTask(context, runnerId, input) {
      requireRole(
        context.membership.role,
        RUNNER_ADMIN_ROLES,
        "create runner discovery tasks"
      );

      if (!isRunnerDiscoverModuleId(input.moduleId)) {
        throw new AppServiceError(
          `${input.moduleId} is not an allowlisted runner-safe discovery module.`,
          400,
          "module_not_runner_safe"
        );
      }
      const manifest = getModuleById(input.moduleId)?.manifest;
      if (!manifest) {
        throw new AppServiceError(
          `${input.moduleId} is not a registered module.`,
          400,
          "module_not_found"
        );
      }
      const safetyLevel = manifest.safetyLevel;

      const runner = await prisma.runner.findFirst({
        where: {
          runnerId,
          status: { not: "Revoked" },
          tenantId: context.tenant.tenantId
        }
      });
      if (!runner) {
        throw new AppServiceError("Runner not found.", 404, "runner_not_found");
      }
      if (runner.killSwitchActive) {
        await writeAuditEvent(prisma, {
          action: "runner.task.rejected",
          actorType: "User",
          entityId: runnerId,
          entityType: "Runner",
          metadata: { reason: "kill_switch_active" },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
        throw new AppServiceError(
          "Runner kill switch is active; tasks cannot be dispatched.",
          409,
          "runner_kill_switch_active"
        );
      }

      const segmentGate = assertRunnerSegmentProfileAllowsTask(
        runner,
        input.moduleId,
        safetyLevel
      );
      assertRunnerAffinityAllowsTask(runner, {
        networkSegment: input.networkSegment,
        preferredRunnerId: runnerId,
        siteId: input.siteId
      });

      const scope = await prisma.scope.findFirst({
        where: { scopeId: input.scopeId, tenantId: context.tenant.tenantId }
      });
      if (!scope) {
        throw new AppServiceError("Scope not found.", 404, "scope_not_found");
      }
      const serializedScope = serializeScope(scope);
      if (serializedScope.verificationStatus !== "Verified") {
        throw new AppServiceError(
          "Runner tasks require verified scope.",
          400,
          "verified_scope_required"
        );
      }
      if (!isHostnameTargetAllowedByScope(serializedScope, input.target)) {
        throw new AppServiceError(
          "Runner target is outside the verified scope constraints.",
          400,
          "runner_scope_violation"
        );
      }

      const requestedAction = {
        credentialTheft: false,
        destructive: false,
        persistence: false,
        realDataExfiltration: false,
        requiresInternalRunner: true,
        requiresTimeWindow: false,
        uncontrolledExploitChaining: false
      };
      const evaluated = evaluatePolicy({
        adminApproval: false,
        executionEnvironment: "InternalRunner",
        explicitMissionApproval: false,
        missionType: "ExposureValidation",
        requestedAction,
        safetyLevel,
        scopeContext: serializedScope,
        scopeVerificationStatus: serializedScope.verificationStatus,
        timeWindowApproved: false,
        userRole: context.membership.role
      });
      const decision = await prisma.policyDecision.create({
        data: {
          approvalState: evaluated.approvalState,
          executionEnvironment: "InternalRunner",
          missionType: "ExposureValidation",
          outcome: evaluated.outcome,
          rationale: evaluated.rationale,
          requestedAction: requestedAction as Prisma.InputJsonValue,
          safetyLevel,
          scopeId: input.scopeId,
          target: {
            module: input.moduleId,
            target: input.target
          } as Prisma.InputJsonValue,
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        }
      });
      await writeAuditEvent(prisma, {
        action: "policy.decision",
        actorType: "User",
        entityId: decision.policyDecisionId,
        entityType: "Scope",
        metadata: {
          executionEnvironment: "InternalRunner",
          outcome: decision.outcome,
          scopeId: input.scopeId
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
      {
        const pep = enforceFreshPolicyEvaluation({
          entrypoint: "runner_task_create",
          outcome: decision.outcome,
          policyDecisionId: decision.policyDecisionId,
          rationale: decision.rationale,
          tenantId: context.tenant.tenantId
        });
        if (pep.verdict !== "Allowed" || !pep.allowance) {
          throw new AppServiceError(decision.rationale, 400, "policy_denied");
        }
      }

      const taskInputs: Record<string, unknown> = {
        networkSegment: input.networkSegment ?? null,
        rateLimitPerMinute: input.rateLimitPerMinute,
        siteId: input.siteId ?? null,
        timeoutSeconds: input.timeoutSeconds
      };
      // Shape the target per the module's input contract. These are all
      // server-allowlisted, runner-agent-default-safe recon modules.
      const taskTargetByModule: Record<string, Record<string, unknown>> = {
        "recon.dns_probe": { host: input.target },
        "recon.host_discovery": { targets: input.target },
        "recon.http_probe": { host: input.target },
        "recon.service_inventory": {
          targetHost: input.target,
          ...(input.topPorts !== undefined ? { topPorts: input.topPorts } : {})
        },
        "recon.subdomain_enum": { domain: input.target }
      };
      const taskTarget = taskTargetByModule[input.moduleId] ?? {
        targetHost: input.target
      };

      const now = new Date();
      const expiresAt = addSeconds(now, input.timeoutSeconds + 300);
      const mission = await prisma.validationMission.create({
        data: {
          evidenceIds: [],
          missionType: "ExposureValidation",
          policyDecisionId: decision.policyDecisionId,
          policyProfile: "runner-discover",
          requestedBy: context.user.userId,
          safetyLevel,
          scopeId: input.scopeId,
          scopeIds: [input.scopeId],
          startedAt: now,
          status: "Queued",
          tenantId: context.tenant.tenantId
        }
      });
      const run = await prisma.validationRun.create({
        data: {
          evidenceIds: [],
          missionId: mission.missionId,
          moduleId: input.moduleId,
          outcome: null,
          policyDecisionId: decision.policyDecisionId,
          runnerId,
          safetyLevel,
          scopeId: input.scopeId,
          startedAt: null,
          status: "Queued",
          target: {
            ...taskTarget,
            timeoutSeconds: input.timeoutSeconds
          } as Prisma.InputJsonValue,
          tenantId: context.tenant.tenantId,
          validationState: null
        }
      });
      const taskId = randomUUID();
      const scopeConstraints = withSegmentForbidInternetEgress(
        buildScopeConstraints(serializedScope, []),
        segmentGate.forbidInternetEgress
      );
      const unsignedEnvelope: Omit<RunnerTaskEnvelope, "signature"> = {
        artifactUpload: {
          artifactUploadUrl: `${getRunnerControlPlaneUrl()}/api/v1/runners/${runnerId}/tasks/${taskId}/artifacts`,
          maxArtifactBytes: 1_000_000,
          resultCallbackUrl: `${getRunnerControlPlaneUrl()}/api/v1/runners/${runnerId}/tasks/${taskId}/result`
        },
        executionEnvironment: "InternalRunner",
        expiresAt: expiresAt.toISOString(),
        inputs: taskInputs,
        issuedAt: now.toISOString(),
        missionId: mission.missionId,
        moduleId: input.moduleId,
        runId: run.runId,
        runnerId,
        safetyLevel,
        scopeConstraints,
        scopeId: input.scopeId,
        target: taskTarget,
        taskId,
        tenantId: context.tenant.tenantId
      };
      const envelope = await signRunnerTaskEnvelope(
        prisma,
        context.tenant.tenantId,
        devMode,
        unsignedEnvelope
      );
      const task = await prisma.runnerTask.create({
        data: {
          envelope: envelope as unknown as Prisma.InputJsonValue,
          expiresAt,
          inputs: taskInputs as Prisma.InputJsonValue,
          issuedAt: now,
          missionId: mission.missionId,
          moduleId: input.moduleId,
          nonce: envelope.signature.nonce,
          runId: run.runId,
          runnerId,
          safetyLevel,
          scopeConstraints: scopeConstraints as Prisma.InputJsonValue,
          scopeId: input.scopeId,
          status: "Queued",
          target: taskTarget as Prisma.InputJsonValue,
          taskId,
          taskType: input.moduleId,
          tenantId: context.tenant.tenantId
        }
      });

      return {
        envelope,
        mission: serializeValidationMission(mission),
        run: serializeValidationRun(run),
        task: serializeRunnerTask(task)
      };
    },

    async submitRunnerTaskResult(
      runnerId,
      taskId,
      authToken,
      input,
      clientCertificateSha256
    ) {
      const runner = await authenticateRunner(
        prisma,
        runnerId,
        authToken,
        clientCertificateSha256 ?? null,
        shouldRequireRunnerMtls()
      );
      const task = await prisma.runnerTask.findFirst({
        include: {
          validationRun: true
        },
        where: {
          runnerId,
          taskId,
          tenantId: runner.tenantId
        }
      });

      if (!task) {
        throw new AppServiceError(
          "Runner task not found.",
          404,
          "runner_task_not_found"
        );
      }

      if (
        input.runnerId !== runnerId ||
        input.tenantId !== runner.tenantId ||
        input.taskId !== taskId ||
        input.runId !== task.runId
      ) {
        await writeAuditEvent(prisma, {
          action: "runner.task.rejected",
          actorType: "Runner",
          entityId: taskId,
          entityType: "RunnerTask",
          metadata: {
            reason: "identity_mismatch"
          },
          tenantId: runner.tenantId,
          userId: null
        });

        throw new AppServiceError(
          "Runner task result identity mismatch.",
          403,
          "runner_task_identity_mismatch"
        );
      }

      // Result provenance: a runner that registered a result-signing key must
      // sign every result, and the control plane verifies that signature before
      // trusting the measurement. This makes runner provenance cryptographic and
      // non-repudiable, not merely transport-authenticated. MANDATORY: a runner
      // must have registered a result-signing key to submit any result — a runner
      // with no key cannot submit (closes the "keyless runner bypasses signature
      // verification" gap). Registration may omit the key, but result submission
      // may not proceed without one.
      if (!runner.resultSigningPublicKeyPem) {
        await writeAuditEvent(prisma, {
          action: "runner.task.rejected",
          actorType: "Runner",
          entityId: taskId,
          entityType: "RunnerTask",
          metadata: { reason: "result_signing_key_not_registered" },
          tenantId: runner.tenantId,
          userId: null
        });
        throw new AppServiceError(
          "This runner has no registered result-signing key; results cannot be submitted until one is registered.",
          403,
          "runner_result_signing_key_required"
        );
      }
      if (!input.resultSignature) {
        await writeAuditEvent(prisma, {
          action: "runner.task.rejected",
          actorType: "Runner",
          entityId: taskId,
          entityType: "RunnerTask",
          metadata: { reason: "result_signature_missing" },
          tenantId: runner.tenantId,
          userId: null
        });
        throw new AppServiceError(
          "Runner task result signature required.",
          403,
          "runner_result_signature_required"
        );
      }
      const expectedAuditSha256 = runnerResultAuditHash(input);
      if (
        !timingSafeEqualHex(expectedAuditSha256, input.localAuditSha256)
      ) {
        await writeAuditEvent(prisma, {
          action: "runner.task.rejected",
          actorType: "Runner",
          entityId: taskId,
          entityType: "RunnerTask",
          metadata: { reason: "result_audit_hash_mismatch" },
          tenantId: runner.tenantId,
          userId: null
        });
        throw new AppServiceError(
          "Runner task result does not match its signed audit hash.",
          403,
          "runner_result_audit_hash_mismatch"
        );
      }
      const verified = verifyRunnerResultSignature(
        runner.resultSigningPublicKeyPem,
        input.localAuditSha256,
        input.resultSignature
      );
      if (!verified) {
        await writeAuditEvent(prisma, {
          action: "runner.task.rejected",
          actorType: "Runner",
          entityId: taskId,
          entityType: "RunnerTask",
          metadata: { reason: "result_signature_invalid" },
          tenantId: runner.tenantId,
          userId: null
        });
        throw new AppServiceError(
          "Runner task result signature verification failed.",
          403,
          "runner_result_signature_invalid"
        );
      }
      // Every submitted result is now signature-verified (a keyless runner was
      // rejected above), so this is always a concrete timestamp.
      const resultSignatureVerifiedAt: Date = new Date();

      if (input.status !== "Completed" && input.status !== "Failed") {
        await writeAuditEvent(prisma, {
          action: "runner.task.rejected",
          actorType: "Runner",
          entityId: taskId,
          entityType: "RunnerTask",
          metadata: {
            reason: "invalid_result_status",
            status: String(input.status)
          },
          tenantId: runner.tenantId,
          userId: null
        });

        throw new AppServiceError(
          "Runner task result status must be Completed or Failed.",
          400,
          "runner_task_invalid_result_status"
        );
      }

      if (input.status === "Completed" && input.evidenceManifest.length === 0) {
        await writeAuditEvent(prisma, {
          action: "runner.task.rejected",
          actorType: "Runner",
          entityId: taskId,
          entityType: "RunnerTask",
          metadata: {
            reason: "missing_result_evidence"
          },
          tenantId: runner.tenantId,
          userId: null
        });

        throw new AppServiceError(
          "Completed runner task results must reference at least one uploaded evidence artifact.",
          400,
          "runner_result_evidence_required"
        );
      }

      if (isTerminalRunnerTaskStatus(task.status)) {
        await writeAuditEvent(prisma, {
          action: "runner.task.rejected",
          actorType: "Runner",
          entityId: taskId,
          entityType: "RunnerTask",
          metadata: {
            reason: "result_after_terminal_state",
            state: task.status
          },
          tenantId: runner.tenantId,
          userId: null
        });

        throw new AppServiceError(
          `Runner task result cannot be submitted from terminal state ${task.status}.`,
          409,
          "runner_task_invalid_state"
        );
      }

      if (task.expiresAt.getTime() <= Date.now()) {
        // CAS active → Expired so a concurrent result submit cannot race past
        // this soft-expiry check and still write Completed/Failed.
        const expiredClaim = await prisma.runnerTask.updateMany({
          data: {
            completedAt: new Date(),
            errorSummary: "Runner submitted task result after expiry.",
            status: "Expired"
          },
          where: {
            runnerId,
            status: {
              in: [...ACTIVE_RUNNER_TASK_STATUSES]
            },
            taskId,
            tenantId: runner.tenantId
          }
        });
        const expiredTask = await prisma.runnerTask.findUniqueOrThrow({
          where: {
            taskId
          }
        });

        await writeAuditEvent(prisma, {
          action: "runner.task.rejected",
          actorType: "Runner",
          entityId: taskId,
          entityType: "RunnerTask",
          metadata: {
            reason: "expired_task",
            claimed: expiredClaim.count === 1
          },
          tenantId: runner.tenantId,
          userId: null
        });

        return {
          evidence: [],
          run: serializeValidationRun(task.validationRun),
          task: serializeRunnerTask(expiredTask)
        };
      }

      const completedAt = new Date(input.completedAt);
      const evidenceArtifacts = await Promise.all(
        input.evidenceManifest.map(async (item) => {
          if (item.evidenceId) {
            const uploaded = await prisma.evidenceArtifact.findFirst({
              where: {
                evidenceId: item.evidenceId,
                relatedEntityId: task.runId,
                relatedEntityType: "ValidationRun",
                tenantId: runner.tenantId
              }
            });

            if (!uploaded) {
              throw new AppServiceError(
                "Runner evidence artifact was not uploaded for this task.",
                400,
                "runner_evidence_not_uploaded"
              );
            }

            if (uploaded.sha256 !== item.sha256) {
              throw new AppServiceError(
                "Runner evidence artifact hash does not match uploaded artifact.",
                400,
                "runner_evidence_hash_mismatch"
              );
            }

            return uploaded;
          }

          throw new AppServiceError(
            "Runner evidence manifest items must be uploaded through the redacting artifact endpoint before result submission.",
            400,
            "runner_evidence_not_uploaded"
          );
        })
      );
      const evidenceIds = evidenceArtifacts.map((item) => item.evidenceId);

      // Serialize CAS terminal claim + sibling read + mission aggregate so two
      // hybrid tasks completing in parallel cannot each miss the other's commit
      // and leave the mission stuck Running with partial evidenceIds.
      const locked = await withMissionRunAggregateLock(
        prisma,
        task.missionId,
        async (tx) => {
          const claimed = await tx.runnerTask.updateMany({
            data: {
              completedAt,
              errorSummary: input.errorSummary ?? null,
              localAuditHash: input.localAuditSha256,
              result: input as unknown as Prisma.InputJsonValue,
              resultSignature: input.resultSignature ?? null,
              resultSignatureVerifiedAt,
              status: input.status
            },
            where: {
              expiresAt: {
                gt: new Date()
              },
              runnerId,
              status: {
                in: [...ACTIVE_RUNNER_TASK_STATUSES]
              },
              taskId,
              tenantId: runner.tenantId
            }
          });

          if (claimed.count !== 1) {
            const current = await tx.runnerTask.findFirst({
              where: {
                runnerId,
                taskId,
                tenantId: runner.tenantId
              }
            });
            if (!current) {
              throw new AppServiceError(
                "Runner task not found.",
                404,
                "runner_task_not_found"
              );
            }
            if (current.expiresAt.getTime() <= Date.now()) {
              if (!isTerminalRunnerTaskStatus(current.status)) {
                await tx.runnerTask.updateMany({
                  data: {
                    completedAt: new Date(),
                    errorSummary: "Runner submitted task result after expiry.",
                    status: "Expired"
                  },
                  where: {
                    runnerId,
                    status: {
                      in: [...ACTIVE_RUNNER_TASK_STATUSES]
                    },
                    taskId,
                    tenantId: runner.tenantId
                  }
                });
              }
              const expiredTask = await tx.runnerTask.findUniqueOrThrow({
                where: {
                  taskId
                }
              });
              await writeAuditEvent(tx, {
                action: "runner.task.rejected",
                actorType: "Runner",
                entityId: taskId,
                entityType: "RunnerTask",
                metadata: {
                  reason: "expired_task"
                },
                tenantId: runner.tenantId,
                userId: null
              });
              return { kind: "expired" as const, expiredTask };
            }

            await writeAuditEvent(tx, {
              action: "runner.task.rejected",
              actorType: "Runner",
              entityId: taskId,
              entityType: "RunnerTask",
              metadata: {
                reason: "result_after_terminal_state",
                state: current.status
              },
              tenantId: runner.tenantId,
              userId: null
            });

            throw new AppServiceError(
              `Runner task result cannot be submitted from terminal state ${current.status}.`,
              409,
              "runner_task_invalid_state"
            );
          }

          const updatedTask = await tx.runnerTask.findUniqueOrThrow({
            where: {
              taskId
            }
          });

          const currentRun = await tx.validationRun.findUniqueOrThrow({
            where: {
              runId: task.runId
            }
          });
          const mergedRunEvidenceIds = unionEvidenceIds(
            currentRun.evidenceIds,
            evidenceIds
          );
          const updatedRun = await tx.validationRun.update({
            where: {
              runId: task.runId
            },
            data: {
              completedAt,
              errorSummary: input.errorSummary ?? null,
              evidenceIds: mergedRunEvidenceIds,
              outcome: input.outcome ?? null,
              startedAt: new Date(input.startedAt),
              status: input.status,
              validationState: input.validationState ?? null
            }
          });

          const siblingRuns = await tx.validationRun.findMany({
            select: {
              evidenceIds: true,
              runId: true,
              status: true
            },
            where: {
              missionId: task.missionId,
              tenantId: runner.tenantId
            }
          });
          const missionAggregate = reconcileMissionAggregateFromRuns(
            siblingRuns.map((run) =>
              run.runId === updatedRun.runId
                ? {
                    evidenceIds: updatedRun.evidenceIds as string[],
                    status: updatedRun.status
                  }
                : {
                    evidenceIds: run.evidenceIds as string[],
                    status: run.status
                  }
            )
          );
          await tx.validationMission.update({
            where: {
              missionId: task.missionId
            },
            data: {
              completedAt: missionAggregate.completedAt,
              evidenceIds: missionAggregate.evidenceIds,
              status: missionAggregate.status
            }
          });

          return { kind: "ok" as const, updatedRun, updatedTask };
        }
      );

      if (locked.kind === "expired") {
        return {
          evidence: [],
          run: serializeValidationRun(task.validationRun),
          task: serializeRunnerTask(locked.expiredTask)
        };
      }

      const { updatedRun, updatedTask } = locked;

      // Persist the measured signals the runner submitted for this verified,
      // signed task so they drive findings (listValidatedFindings derives
      // findings from tenant SignalEnvelope records). SECURITY: force the
      // authenticated runner's tenantId and mint a fresh server-side signalId
      // (never trust submitted identity/ids); attach this run's evidence. Only a
      // Completed task contributes signals. Mirrors the inline-validation
      // module-signal persistence (runtime-services executeInlineValidation).
      if (input.status === "Completed" && input.signals.length > 0) {
        const measuredSignals = attachEvidenceToSignals(
          input.signals.map((signal) => ({
            ...signal,
            signalId: randomUUID(),
            tenantId: runner.tenantId
          })),
          evidenceIds
        );
        await prisma.signalEnvelope.createMany({
          data: measuredSignals.map((signal) => ({
            confidence: signal.confidence ?? null,
            createdAt: completedAt,
            evidenceIds: signal.evidenceIds,
            freshness: signal.freshness ?? null,
            rawPayloadPointer: signal.rawPayloadPointer ?? null,
            redactionStatus: signal.redactionStatus,
            relatedAssetIds: signal.relatedAssetIds,
            relatedControlIds: signal.relatedControlIds,
            relatedEvidenceIds: signal.relatedEvidenceIds,
            relatedIdentityIds: signal.relatedIdentityIds,
            relatedPathIds: signal.relatedPathIds,
            sensitivityLevel: signal.sensitivityLevel,
            signalCategory: signal.signalCategory,
            signalId: signal.signalId,
            signalSubcategory: signal.signalSubcategory ?? null,
            sourceIntegrationId: signal.sourceIntegrationId ?? null,
            // Provenance: this signal was measured IN-NETWORK by this runner.
            sourceRunnerId: runnerId,
            sourceType: signal.sourceType,
            sourceVendor: signal.sourceVendor,
            tenantId: signal.tenantId,
            techniqueIds: signal.techniqueIds ?? [],
            timestampIngested: completedAt,
            timestampObserved: new Date(signal.timestampObserved),
            updatedAt: completedAt
          }))
        });

        // Project the in-network measured signals into the evidence graph so a
        // runner measurement becomes attack-path/asset graph evidence (in-network
        // reachability), exactly as control-plane validation does. Reuses
        // executeInlineValidation's projection — no duplicated graph logic.
        await projectInlineValidationGraph({
          evidenceArtifacts: evidenceArtifacts.map(serializeEvidenceArtifact),
          moduleId: task.moduleId,
          prisma,
          runId: task.runId,
          signals: measuredSignals,
          tenantId: runner.tenantId
        });
      }

      // P05-1: hop-bound completed runs auto-apply edge receipts (real-first).
      if (input.status === "Completed" && evidenceIds.length > 0) {
        try {
          const runRow = await prisma.validationRun.findFirst({
            select: { target: true },
            where: { runId: task.runId, tenantId: runner.tenantId }
          });
          await tryAutoApplyPathEdgeReceiptFromCompletedRun(prisma, {
            actor: `runner:${runnerId}`,
            evidenceIds,
            missionId: task.missionId,
            moduleId: task.moduleId,
            outcome: input.outcome ?? null,
            runId: task.runId,
            target: runRow?.target ?? task.inputs ?? null,
            tenantId: runner.tenantId,
            validationState: input.validationState ?? null
          });
        } catch {
          // Receipt auto-apply is best-effort; never fail the runner result path.
        }
      }

      // Runner-driven fix re-verification: a completed measured task dispatched
      // with a remediationId re-confirms the fix from INSIDE the network. Record
      // a measured VerificationEvent + update the remediation, mirroring
      // verifyRemediation (services/remediation.ts). The outcome is derived from
      // the measured result's validationState — never fabricated.
      const verifyRemediationId =
        typeof (task.inputs as { remediationId?: unknown } | null)
          ?.remediationId === "string"
          ? (task.inputs as { remediationId: string }).remediationId
          : null;
      if (input.status === "Completed" && verifyRemediationId) {
        const remediation = await prisma.remediationTask.findFirst({
          where: {
            remediationId: verifyRemediationId,
            tenantId: runner.tenantId
          }
        });
        if (remediation) {
          const measuredState = input.validationState ?? "Inconclusive";
          const outcome =
            measuredState === "Fixed"
              ? "Fixed"
              : [
                    "Validated",
                    "Exploitable",
                    "StillExposed",
                    "Reachable",
                    "Reopened"
                  ].includes(measuredState)
                ? "StillExposed"
                : "Inconclusive";
          // Only resolved/mitigated outcomes are auto-re-checked.
          const nextVerificationAt = [
            "Fixed",
            "Mitigated",
            "PartiallyFixed"
          ].includes(outcome)
            ? calculateNextRunAt("Weekly", completedAt)
            : null;
          // P09-12 Fixed multiverse: status Fixed only via measured verification.
          assertRemediationFixedOnlyViaVerification({
            measuredRevalidation: true,
            nextStatus: outcome,
            verificationOutcome: outcome
          });

          const verificationEvent = await prisma.verificationEvent.create({
            data: {
              evidenceIds,
              exposureReCorrelated: outcome === "StillExposed",
              measuredRevalidation: true,
              newState: measuredState,
              outcome,
              previousEvidenceBasis: null,
              previousState: null,
              reSyncedConnectorKeys: [],
              remediationId: remediation.remediationId,
              retestMethod: "in-network-runner",
              selectedModuleIds: [task.moduleId],
              tenantId: runner.tenantId,
              validationRunId: task.runId,
              verifiedAt: completedAt
            }
          });
          await prisma.remediationTask.update({
            where: {
              remediationId: remediation.remediationId
            },
            data: {
              lastVerifiedAt: completedAt,
              nextVerificationAt,
              status: outcome
            }
          });
          await writeAuditEvent(prisma, {
            action: "verification.run",
            actorType: "Runner",
            entityId: verificationEvent.verificationId,
            entityType: "VerificationEvent",
            metadata: {
              outcome,
              remediationId: remediation.remediationId,
              retestMethod: "in-network-runner"
            },
            tenantId: runner.tenantId,
            userId: null
          });
          await emitTenantWebhook(runner.tenantId, "remediation.verified", {
            evidenceIds: verificationEvent.evidenceIds,
            measuredRevalidation: true,
            newState: measuredState,
            outcome,
            previousState: null,
            relatedPathId: remediation.relatedPathId,
            remediationId: remediation.remediationId,
            retestMethod: "in-network-runner",
            verificationId: verificationEvent.verificationId,
            verifiedAt: completedAt.toISOString()
          });
        }
      }

      await writeAuditEvent(prisma, {
        action:
          input.status === "Completed"
            ? "runner.task.executed"
            : "runner.task.rejected",
        actorType: "Runner",
        entityId: taskId,
        entityType: "RunnerTask",
        metadata: {
          outcome: input.outcome,
          runId: task.runId,
          validationState: input.validationState
        },
        tenantId: runner.tenantId,
        userId: null
      });

      return {
        evidence: evidenceArtifacts.map(serializeEvidenceArtifact),
        run: serializeValidationRun(updatedRun),
        task: serializeRunnerTask(updatedTask)
      };
    }
  };
}

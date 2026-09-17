import type { Prisma } from "@prisma/client";

import {
  RunnerTaskEnvelopeSchema,
  type RunnerRecord,
  type RunnerRegistrationTokenRecord,
  type RunnerTaskRecord
} from "@periscan/shared";

// Pure record -> DTO serializers for the internal-runner subdomain. Extracted
// from runtime-services.ts (god-closure decomposition). Depends only on Prisma
// JSON typing, the shared runner DTO types, and the shared task-envelope schema.

export function serializeRunnerRegistrationToken(record: {
  createdAt: Date;
  createdBy: string;
  expiresAt: Date;
  labels: string[];
  registrationTokenId: string;
  runnerName: string;
  status: RunnerRegistrationTokenRecord["status"];
  tenantId: string;
  updatedAt: Date;
  usedAt: Date | null;
}): RunnerRegistrationTokenRecord {
  return {
    createdAt: record.createdAt.toISOString(),
    createdBy: record.createdBy,
    expiresAt: record.expiresAt.toISOString(),
    labels: record.labels,
    registrationTokenId: record.registrationTokenId,
    runnerName: record.runnerName,
    status: record.status,
    tenantId: record.tenantId,
    updatedAt: record.updatedAt.toISOString(),
    usedAt: record.usedAt?.toISOString() ?? null
  };
}

export function serializeRunner(record: {
  arch: string;
  certificateExpiresAt: Date | null;
  certificateSha256?: string | null;
  createdAt: Date;
  createdBy: string | null;
  deploymentMode: RunnerRecord["deploymentMode"];
  hostname: string;
  killSwitchActivatedAt?: Date | null;
  killSwitchActivatedBy?: string | null;
  killSwitchAcknowledgedAt?: Date | null;
  killSwitchActive?: boolean;
  killSwitchReason?: string | null;
  labels: string[];
  lastSeenAt: Date | null;
  name: string;
  networkProfile: Prisma.JsonValue;
  networkSegment?: string | null;
  os: string;
  revokedAt: Date | null;
  revocationAcknowledgedAt?: Date | null;
  runnerId: string;
  segmentProfileId?: string | null;
  siteId?: string | null;
  status: RunnerRecord["status"];
  tenantId: string;
  transportMode: RunnerRecord["transportMode"];
  updatedAt: Date;
  version: string;
}): RunnerRecord {
  const segmentProfileId =
    record.segmentProfileId === "campus-passive" ||
    record.segmentProfileId === "dc-measured" ||
    record.segmentProfileId === "ot-safe-baseline"
      ? record.segmentProfileId
      : null;
  return {
    arch: record.arch,
    certificateExpiresAt: record.certificateExpiresAt?.toISOString() ?? null,
    certificateSha256: record.certificateSha256 ?? null,
    createdAt: record.createdAt.toISOString(),
    createdBy: record.createdBy,
    deploymentMode: record.deploymentMode,
    hostname: record.hostname,
    killSwitchActivatedAt: record.killSwitchActivatedAt?.toISOString() ?? null,
    killSwitchActivatedBy: record.killSwitchActivatedBy ?? null,
    killSwitchAcknowledgedAt:
      record.killSwitchAcknowledgedAt?.toISOString() ?? null,
    killSwitchActive: record.killSwitchActive ?? false,
    killSwitchReason: record.killSwitchReason ?? null,
    labels: record.labels,
    lastSeenAt: record.lastSeenAt?.toISOString() ?? null,
    name: record.name,
    networkProfile:
      typeof record.networkProfile === "object" && record.networkProfile
        ? (record.networkProfile as RunnerRecord["networkProfile"])
        : {
            dnsResolutionRequired: true,
            gatewayHostnames: ["runner.periscan.cloud"],
            httpConnectProxySupported: true,
            outboundHttpsPorts: [443]
          },
    networkSegment: record.networkSegment ?? null,
    os: record.os,
    revokedAt: record.revokedAt?.toISOString() ?? null,
    revocationAcknowledgedAt:
      record.revocationAcknowledgedAt?.toISOString() ?? null,
    runnerId: record.runnerId,
    segmentProfileId,
    siteId: record.siteId ?? null,
    status: record.status,
    tenantId: record.tenantId,
    transportMode: record.transportMode,
    updatedAt: record.updatedAt.toISOString(),
    version: record.version
  };
}

export function serializeRunnerTask(record: {
  acceptedAt?: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  envelope: Prisma.JsonValue;
  errorSummary: string | null;
  expiresAt: Date;
  inputPayloadHash?: string | null;
  inputs: Prisma.JsonValue;
  issuedAt: Date;
  leasedAt: Date | null;
  localAuditHash?: string | null;
  missionId: string;
  moduleId: string;
  moduleVersion?: string | null;
  normalizedOutput?: Prisma.JsonValue | null;
  redactedEvidenceIds?: string[];
  rejectedReason?: string | null;
  resourceUsage?: Prisma.JsonValue | null;
  result: Prisma.JsonValue | null;
  runId: string;
  runnerId: string;
  safetyLevel: RunnerTaskRecord["safetyLevel"];
  scopeConstraints: Prisma.JsonValue;
  scopeId: string;
  status: RunnerTaskRecord["status"];
  target: Prisma.JsonValue;
  taskId: string;
  taskType?: string | null;
  tenantId: string;
  updatedAt: Date;
}): RunnerTaskRecord {
  return {
    acceptedAt: record.acceptedAt?.toISOString() ?? null,
    completedAt: record.completedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    envelope: RunnerTaskEnvelopeSchema.parse(record.envelope),
    errorSummary: record.errorSummary,
    expiresAt: record.expiresAt.toISOString(),
    inputPayloadHash: record.inputPayloadHash ?? null,
    inputs:
      typeof record.inputs === "object" && record.inputs
        ? (record.inputs as Record<string, unknown>)
        : {},
    issuedAt: record.issuedAt.toISOString(),
    leasedAt: record.leasedAt?.toISOString() ?? null,
    localAuditHash: record.localAuditHash ?? null,
    missionId: record.missionId,
    moduleId: record.moduleId,
    moduleVersion: record.moduleVersion ?? null,
    normalizedOutput:
      typeof record.normalizedOutput === "object" && record.normalizedOutput
        ? (record.normalizedOutput as Record<string, unknown>)
        : null,
    redactedEvidenceIds: record.redactedEvidenceIds ?? [],
    rejectedReason: record.rejectedReason ?? null,
    resourceUsage:
      typeof record.resourceUsage === "object" && record.resourceUsage
        ? (record.resourceUsage as Record<string, unknown>)
        : null,
    result:
      typeof record.result === "object" && record.result
        ? (record.result as Record<string, unknown>)
        : null,
    runId: record.runId,
    runnerId: record.runnerId,
    safetyLevel: record.safetyLevel,
    scopeConstraints:
      typeof record.scopeConstraints === "object" && record.scopeConstraints
        ? (record.scopeConstraints as RunnerTaskRecord["scopeConstraints"])
        : {
            approvedCidrs: [],
            approvedDnsSuffixes: [],
            approvedHostnames: [],
            approvedPorts: [],
            forbidInternetEgress: false
          },
    scopeId: record.scopeId,
    status: record.status,
    target:
      typeof record.target === "object" && record.target
        ? (record.target as Record<string, unknown>)
        : {},
    taskId: record.taskId,
    taskType: record.taskType ?? null,
    tenantId: record.tenantId,
    updatedAt: record.updatedAt.toISOString()
  };
}

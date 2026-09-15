import type {
  ContextBundle as PrismaContextBundle,
  ContextBundleItem as PrismaContextBundleItem,
  ModelGatewayAuditEvent as PrismaModelGatewayAuditEvent,
  ModelPolicyProfile as PrismaModelPolicyProfile,
  ModelProvider as PrismaModelProvider,
  ModelSession as PrismaModelSession,
  ModelToolRequest as PrismaModelToolRequest,
  ModelToolResult as PrismaModelToolResult
} from "@prisma/client";

import type {
  ContextBundle,
  ContextPruningManifest,
  ModelGatewayAuditEvent,
  ModelPolicyProfile,
  ModelProvider,
  ModelSession,
  ModelSessionMode,
  ModelToolRequest
} from "@periscan/shared";
import { ModelServingCapabilitiesSchema } from "@periscan/shared";

// Pure record -> DTO serializers for the model-gateway subdomain. Extracted from
// runtime-services.ts (god-closure decomposition): these depend only on Prisma
// row types and shared DTO types — no closure state, no DB access — so they live
// as a standalone, independently-testable module.

export function serializeModelProvider(
  record: PrismaModelProvider
): ModelProvider {
  return {
    allowedUseCases: record.allowedUseCases,
    authMethod: record.authMethod,
    createdAt: record.createdAt.toISOString(),
    createdBy: record.createdBy,
    dataResidency: record.dataResidency ?? null,
    deploymentType: record.deploymentType,
    endpointUrl: record.endpointUrl,
    hasCredential: Boolean(record.credentialRef),
    lastTestedAt: record.lastTestedAt?.toISOString() ?? null,
    modelProviderId: record.modelProviderId,
    providerName: record.providerName,
    providerType: record.providerType,
    servingCapabilities: ModelServingCapabilitiesSchema.parse(
      record.servingCapabilities ?? {}
    ),
    servingCapabilitiesVerifiedAt:
      record.servingCapabilitiesVerifiedAt?.toISOString() ?? null,
    status: record.status,
    tenantId: record.tenantId,
    updatedAt: record.updatedAt.toISOString()
  };
}

export function serializeModelPolicyProfile(
  record: PrismaModelPolicyProfile
): ModelPolicyProfile {
  return {
    allowExternalValidation: record.allowExternalValidation,
    allowInternalValidation: record.allowInternalValidation,
    allowRawEvidence: record.allowRawEvidence,
    allowRunnerTasks: record.allowRunnerTasks,
    allowSensitiveContext: record.allowSensitiveContext,
    allowTicketCreation: record.allowTicketCreation,
    allowedDataClasses: record.allowedDataClasses,
    allowedModes: record.allowedModes as ModelSessionMode[],
    allowedTools: record.allowedTools,
    approvalRequiredAboveLevel: record.approvalRequiredAboveLevel,
    blockedTools: record.blockedTools,
    createdAt: record.createdAt.toISOString(),
    createdBy: record.createdBy,
    description: record.description,
    maxSafetyLevel: record.maxSafetyLevel,
    modelPolicyProfileId: record.modelPolicyProfileId,
    name: record.name,
    redactionPolicy: record.redactionPolicy,
    sessionTimeoutMinutes: record.sessionTimeoutMinutes,
    tenantId: record.tenantId,
    updatedAt: record.updatedAt.toISOString()
  };
}

export function serializeModelSession(
  record: PrismaModelSession
): ModelSession {
  return {
    createdAt: record.createdAt.toISOString(),
    endedAt: record.endedAt?.toISOString() ?? null,
    expiresAt: record.expiresAt?.toISOString() ?? null,
    adapterAlias: record.adapterAlias ?? null,
    mode: record.mode,
    modelPolicyProfileId: record.modelPolicyProfileId,
    modelProviderId: record.modelProviderId,
    modelSessionId: record.modelSessionId,
    purpose: record.purpose,
    precisionMode: record.precisionMode as ModelSession["precisionMode"],
    requestedModel: record.requestedModel ?? null,
    scopeIds: record.scopeIds,
    startedAt: record.startedAt?.toISOString() ?? null,
    status: record.status,
    tenantId: record.tenantId,
    updatedAt: record.updatedAt.toISOString(),
    userId: record.userId
  };
}

export function serializeContextBundleItem(record: PrismaContextBundleItem) {
  return {
    contextBundleId: record.contextBundleId,
    contextBundleItemId: record.contextBundleItemId,
    createdAt: record.createdAt.toISOString(),
    entityId: record.entityId,
    entityType: record.entityType,
    evidenceIds: record.evidenceIds,
    includedReason: record.includedReason,
    redactionStatus: record.redactionStatus
  };
}

export function serializeContextBundle(
  record: PrismaContextBundle & { items: PrismaContextBundleItem[] }
): ContextBundle {
  return {
    contextBundleId: record.contextBundleId,
    createdAt: record.createdAt.toISOString(),
    expiresAt: record.expiresAt?.toISOString() ?? null,
    items: record.items.map(serializeContextBundleItem),
    modelSessionId: record.modelSessionId,
    redactionPolicy: record.redactionPolicy,
    scopeIds: record.scopeIds,
    sensitivityLevel: record.sensitivityLevel,
    pruningManifest:
      record.pruningManifest as unknown as ContextPruningManifest,
    sourceTokenEstimate: record.sourceTokenEstimate,
    tenantId: record.tenantId,
    tokenBudget: record.tokenBudget,
    tokenEstimate: record.tokenEstimate
  };
}

export function serializeModelToolResult(record: PrismaModelToolResult) {
  return {
    createdAt: record.createdAt.toISOString(),
    evidenceIds: record.evidenceIds,
    outputPayloadRedacted:
      (record.outputPayloadRedacted as Record<string, unknown>) ?? {},
    returnedToModel: record.returnedToModel,
    sensitivityLevel: record.sensitivityLevel,
    tenantId: record.tenantId,
    toolRequestId: record.toolRequestId,
    toolResultId: record.toolResultId,
    validationRunId: record.validationRunId ?? null
  };
}

export function serializeModelToolRequest(
  record: PrismaModelToolRequest & { result?: PrismaModelToolResult | null }
): ModelToolRequest {
  return {
    approvedAt: record.approvedAt?.toISOString() ?? null,
    approvedBy: record.approvedBy ?? null,
    completedAt: record.completedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    denialReason: record.denialReason ?? null,
    inputPayloadHash: record.inputPayloadHash,
    inputPayloadRedacted:
      (record.inputPayloadRedacted as Record<string, unknown>) ?? {},
    modelSessionId: record.modelSessionId,
    policyDecisionId: record.policyDecisionId ?? null,
    requestReason: record.requestReason,
    requestedByModel: record.requestedByModel,
    result: record.result ? serializeModelToolResult(record.result) : null,
    scopeIds: record.scopeIds,
    status: record.status,
    tenantId: record.tenantId,
    toolName: record.toolName,
    toolRequestId: record.toolRequestId,
    updatedAt: record.updatedAt.toISOString()
  };
}

export function serializeModelGatewayAuditEvent(
  record: PrismaModelGatewayAuditEvent
): ModelGatewayAuditEvent {
  return {
    createdAt: record.createdAt.toISOString(),
    eventId: record.eventId,
    eventType: record.eventType,
    evidenceIds: record.evidenceIds,
    metadata: (record.metadata as Record<string, unknown>) ?? {},
    modelProviderId: record.modelProviderId ?? null,
    modelSessionId: record.modelSessionId ?? null,
    policyDecisionId: record.policyDecisionId ?? null,
    tenantId: record.tenantId,
    toolName: record.toolName ?? null,
    toolRequestId: record.toolRequestId ?? null,
    userId: record.userId ?? null
  };
}

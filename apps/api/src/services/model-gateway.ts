import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual
} from "node:crypto";

import {
  buildModelContextBundle,
  createGatewayToolRequest,
  createModelProviderAdapter,
  decryptModelCredential,
  encryptModelCredential,
  executeReadOnlyGatewayTool,
  getModelToolDefinition,
  isModelGatewayEnvKillSwitchActive,
  listModelToolDefinitions,
  redactGatewayToolOutput,
  resolveTenantModelGatewayKillSwitch,
  writeModelGatewayAuditEvent,
  type GatewayToolExecutionDeps,
  type GatewayToolExecutionResult
} from "@periscan/model-gateway";
import {
  generateEvidenceGroundedSummary,
  generateOperatorRecommendations,
  type EvidenceSummaryUseCase
} from "@periscan/operators";
import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  DecideModelToolInterventionInput,
  InspectModelToolInterventionInput,
  IssueModelToolInterventionInput,
  IssueModelToolInterventionResult,
  KillSwitchResult,
  ModelToolIntervention,
  ModelToolInterventionDecisionResult,
  ModelToolInterventionQueue,
  ModelProviderConnectionTestResult,
  ModelSessionMode,
  ModelTool
} from "@periscan/shared";
import {
  ModelServingCapabilitiesSchema,
  ModelToolInterventionSchema
} from "@periscan/shared";

import {
  serializeContextBundle,
  serializeModelGatewayAuditEvent,
  serializeModelPolicyProfile,
  serializeModelProvider,
  serializeModelSession,
  serializeModelToolRequest
} from "../serializers/model-gateway.js";
import {
  AppServiceError,
  buildOperatorContextForTenant,
  ensureCorrelatedAttackPathsForTenant,
  gatewayPolicyDeps,
  requireRole,
  SCOPE_EDITOR_ROLES,
  serializeEvidenceArtifact,
  TENANT_ADMIN_ROLES,
  writeAuditEvent
} from "../runtime-services.js";
import type {
  AppServices,
  AuthenticatedContext,
  RuntimeServiceDeps
} from "../runtime-services.js";
import {
  reserveModelUsageTurn,
  serializeModelUsageEvent
} from "./model-finops.js";

// Frontier Gateway (model-gateway) service group (D1 Phase 2 closure decomposition).
// The closure-local createGatewayToolExecutionDeps is relocated here as
// buildGatewayToolExecutionDeps(prisma, context).
function buildGatewayToolExecutionDeps(
  prisma: PrismaClient,
  context: AuthenticatedContext
): GatewayToolExecutionDeps {
  return {
    buildOperatorContext: () => buildOperatorContextForTenant(prisma, context),
    createError: (message, statusCode, code) =>
      new AppServiceError(message, statusCode, code),
    ensureCorrelatedAttackPaths: (tenantId) =>
      ensureCorrelatedAttackPathsForTenant(prisma, tenantId),
    serializeEvidenceArtifact: (record) =>
      serializeEvidenceArtifact(
        record as Parameters<typeof serializeEvidenceArtifact>[0]
      )
  };
}

function modelPolicyAuditSnapshot(profile: {
  allowExternalValidation: boolean;
  allowInternalValidation: boolean;
  allowRawEvidence: boolean;
  allowRunnerTasks: boolean;
  allowSensitiveContext: boolean;
  allowTicketCreation: boolean;
  allowedDataClasses: string[];
  allowedModes: string[];
  allowedTools: string[];
  approvalRequiredAboveLevel: string;
  blockedTools: string[];
  description: string;
  maxSafetyLevel: string;
  name: string;
  redactionPolicy: string;
  sessionTimeoutMinutes: number;
}) {
  return {
    allowExternalValidation: profile.allowExternalValidation,
    allowInternalValidation: profile.allowInternalValidation,
    allowRawEvidence: profile.allowRawEvidence,
    allowRunnerTasks: profile.allowRunnerTasks,
    allowSensitiveContext: profile.allowSensitiveContext,
    allowTicketCreation: profile.allowTicketCreation,
    allowedDataClasses: profile.allowedDataClasses,
    allowedModes: profile.allowedModes,
    allowedTools: profile.allowedTools,
    approvalRequiredAboveLevel: profile.approvalRequiredAboveLevel,
    blockedTools: profile.blockedTools,
    description: profile.description,
    maxSafetyLevel: profile.maxSafetyLevel,
    name: profile.name,
    redactionPolicy: profile.redactionPolicy,
    sessionTimeoutMinutes: profile.sessionTimeoutMinutes
  };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

export interface InterventionTokenPayload {
  envelopeHash: string;
  expiresAt: string;
  interventionId: string;
  tenantId: string;
  toolRequestId: string;
  version: 1;
}

export function signModelToolInterventionToken(
  payload: InterventionTokenPayload,
  secret: string
): string {
  const encoded = Buffer.from(stableJson(payload), "utf8").toString(
    "base64url"
  );
  const signature = createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyModelToolInterventionToken(
  token: string,
  secret: string
): InterventionTokenPayload | null {
  const [encoded, signature, trailing] = token.split(".");
  if (!encoded || !signature || trailing !== undefined) return null;
  const expected = createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url");
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (
    actualBytes.length !== expectedBytes.length ||
    !timingSafeEqual(actualBytes, expectedBytes)
  ) {
    return null;
  }

  try {
    const value = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as Partial<InterventionTokenPayload>;
    if (
      value.version !== 1 ||
      typeof value.envelopeHash !== "string" ||
      typeof value.expiresAt !== "string" ||
      typeof value.interventionId !== "string" ||
      typeof value.tenantId !== "string" ||
      typeof value.toolRequestId !== "string"
    ) {
      return null;
    }
    return value as InterventionTokenPayload;
  } catch {
    return null;
  }
}

type InterventionRecord = Prisma.ModelToolInterventionGetPayload<object>;
type ToolRequestForIntervention = Prisma.ModelToolRequestGetPayload<{
  include: { session: { include: { policyProfile: true } } };
}>;

function buildModelToolInterventionEnvelope(
  request: ToolRequestForIntervention
) {
  return {
    policy: modelPolicyAuditSnapshot(request.session.policyProfile),
    request: {
      inputPayloadHash: request.inputPayloadHash,
      modelSessionId: request.modelSessionId,
      policyDecisionId: request.policyDecisionId,
      requestReason: request.requestReason,
      scopeIds: [...request.scopeIds].sort(),
      tenantId: request.tenantId,
      toolName: request.toolName,
      toolRequestId: request.toolRequestId
    },
    session: {
      mode: request.session.mode,
      modelPolicyProfileId: request.session.modelPolicyProfileId,
      purpose: request.session.purpose,
      scopeIds: [...request.session.scopeIds].sort()
    }
  };
}

function modelToolInterventionEnvelopeHash(
  request: ToolRequestForIntervention
): string {
  return sha256(stableJson(buildModelToolInterventionEnvelope(request)));
}

function serializeModelToolIntervention(
  record: InterventionRecord
): ModelToolIntervention {
  return ModelToolInterventionSchema.parse({
    decision: record.decision,
    decisionAt: record.decisionAt?.toISOString() ?? null,
    decisionBy: record.decisionBy,
    decisionReason: record.decisionReason,
    envelopeHash: record.envelopeHash,
    expiresAt: record.expiresAt.toISOString(),
    inputPayloadHash: record.inputPayloadHash,
    interventionId: record.interventionId,
    issuedAt: record.issuedAt.toISOString(),
    issuedBy: record.issuedBy,
    modelSessionId: record.modelSessionId,
    policyDecisionId: record.policyDecisionId,
    policyProfileName: record.policyProfileName,
    requestReason: record.requestReason,
    reviewReference: record.reviewReference,
    scopeIds: record.scopeIds,
    sessionMode: record.sessionMode,
    sessionPurpose: record.sessionPurpose,
    status: record.status,
    tenantId: record.tenantId,
    tokenFingerprint: record.tokenHash,
    toolName: record.toolName,
    toolRequestId: record.toolRequestId,
    transport: record.transport
  });
}

// A model session whose timeout window has elapsed must stop operating even if
// no reaper has flipped its status to Expired yet — guarding only on status
// would let a time-expired session keep materializing context and running tools
// past its window. Pure predicate so the expiry decision is unit-testable
// without a live session row.
export function isModelSessionTimedOut(
  session: { expiresAt: Date | null },
  now: Date = new Date()
): boolean {
  return (
    session.expiresAt !== null && session.expiresAt.getTime() <= now.getTime()
  );
}

export function createModelGatewayServices(
  deps: RuntimeServiceDeps
): Pick<
  AppServices,
  | "activateModelGatewayKillSwitch"
  | "approveModelToolRequest"
  | "cancelModelToolRequest"
  | "createContextBundle"
  | "createModelPolicyProfile"
  | "createModelProvider"
  | "createModelSession"
  | "createModelToolRequest"
  | "deleteModelPolicyProfile"
  | "deleteModelProvider"
  | "denyModelToolRequest"
  | "decideModelToolIntervention"
  | "enqueueModelSessionTurn"
  | "executeModelToolRequest"
  | "getContextBundle"
  | "getModelPolicyProfile"
  | "getModelProvider"
  | "getModelSession"
  | "getModelToolRequest"
  | "inspectModelToolIntervention"
  | "issueModelToolIntervention"
  | "listContextBundles"
  | "listModelGatewayAuditEvents"
  | "listModelPolicyProfiles"
  | "listModelProviders"
  | "listModelSessions"
  | "listModelSessionTurns"
  | "listModelToolRequests"
  | "listModelToolInterventions"
  | "listModelTools"
  | "pauseModelSession"
  | "startModelSession"
  | "terminateModelSession"
  | "testModelProviderConnection"
  | "updateModelPolicyProfile"
  | "updateModelProvider"
  | "updateModelTool"
> {
  const { modelGatewayTurnQueue, prisma } = deps;

  // Enforce the session timeout. A session past its expiresAt is ended even if no
  // reaper has flipped its status — guarding only on status would let a
  // time-expired session keep submitting/executing tool calls past its window.
  // Lazily transitions the status to Expired and rejects.
  async function assertModelSessionLive(
    session: {
      expiresAt: Date | null;
      modelSessionId: string;
      status: string;
      tenantId?: string;
    },
    endedMessage: string
  ): Promise<void> {
    if (session.status === "Terminated" || session.status === "Expired") {
      throw new AppServiceError(endedMessage, 409, "conflict");
    }
    if (isModelSessionTimedOut(session)) {
      await prisma.modelSession.update({
        data: { endedAt: new Date(), status: "Expired" },
        where: { modelSessionId: session.modelSessionId }
      });
      throw new AppServiceError(endedMessage, 409, "conflict");
    }
  }

  /**
   * Durable tenant (or env) model-gateway kill switch. Blocks new sessions and
   * tool execution even when a session row is still Active (defense in depth
   * alongside session Terminated status from activate).
   */
  async function assertModelGatewayKillSwitchInactive(
    tenantId: string,
    actionLabel: string
  ): Promise<void> {
    const kill = await resolveTenantModelGatewayKillSwitch(prisma, tenantId);
    if (!kill.active) {
      return;
    }
    throw new AppServiceError(
      `Model gateway kill switch is active; cannot ${actionLabel}${
        kill.reason ? `: ${kill.reason}` : "."
      }`,
      409,
      "model_gateway_kill_switch_active"
    );
  }

  async function loadVerifiedIntervention(
    context: AuthenticatedContext,
    interventionId: string,
    input: InspectModelToolInterventionInput
  ) {
    const record = await prisma.modelToolIntervention.findFirst({
      include: {
        toolRequest: {
          include: { session: { include: { policyProfile: true } } }
        }
      },
      where: { interventionId, tenantId: context.tenant.tenantId }
    });
    if (!record) {
      throw new AppServiceError("Intervention not found.", 404, "not_found");
    }

    const payload = verifyModelToolInterventionToken(
      input.token,
      deps.interventionSigningSecret
    );
    const fingerprint = sha256(input.token);
    const tokenMatches =
      payload !== null &&
      payload.interventionId === record.interventionId &&
      payload.tenantId === record.tenantId &&
      payload.toolRequestId === record.toolRequestId &&
      payload.envelopeHash === record.envelopeHash &&
      payload.expiresAt === record.expiresAt.toISOString() &&
      constantTimeEqual(fingerprint, record.tokenHash);

    if (!tokenMatches) {
      await writeModelGatewayAuditEvent(prisma, {
        eventType: "InterventionRejected",
        metadata: {
          interventionId,
          reason: "invalid_or_tampered_token"
        },
        modelSessionId: record.modelSessionId,
        tenantId: context.tenant.tenantId,
        toolName: record.toolName,
        toolRequestId: record.toolRequestId,
        userId: context.user.userId
      });
      throw new AppServiceError(
        "The intervention link is invalid or has been altered.",
        403,
        "intervention_token_invalid"
      );
    }

    const currentEnvelopeHash = modelToolInterventionEnvelopeHash(
      record.toolRequest
    );
    if (!constantTimeEqual(currentEnvelopeHash, record.envelopeHash)) {
      await writeModelGatewayAuditEvent(prisma, {
        eventType: "InterventionRejected",
        metadata: { interventionId, reason: "authorization_envelope_changed" },
        modelSessionId: record.modelSessionId,
        tenantId: context.tenant.tenantId,
        toolName: record.toolName,
        toolRequestId: record.toolRequestId,
        userId: context.user.userId
      });
      throw new AppServiceError(
        "The request, scope, or policy changed after this link was issued. Issue a new review link.",
        409,
        "intervention_envelope_changed"
      );
    }

    return record;
  }

  return {
    async listModelProviders(context) {
      const providers = await prisma.modelProvider.findMany({
        orderBy: { createdAt: "desc" },
        where: { tenantId: context.tenant.tenantId }
      });

      return providers.map(serializeModelProvider);
    },

    async getModelProvider(context, modelProviderId) {
      const provider = await prisma.modelProvider.findFirst({
        where: { modelProviderId, tenantId: context.tenant.tenantId }
      });

      return provider ? serializeModelProvider(provider) : null;
    },

    async createModelProvider(context, input) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "register a model provider"
      );

      if (input.providerType === "SpecializedCyberModel") {
        throw new AppServiceError(
          "Specialized cyber model providers are not customer-connectable yet.",
          409,
          "unsupported_model_provider"
        );
      }

      const created = await prisma.modelProvider.create({
        data: {
          allowedUseCases: input.allowedUseCases ?? [],
          authMethod: input.authMethod,
          createdBy: context.user.userId,
          credentialRef: input.apiKey
            ? encryptModelCredential(input.apiKey)
            : null,
          dataResidency: input.dataResidency ?? null,
          deploymentType: input.deploymentType,
          endpointUrl: input.endpointUrl,
          providerName: input.providerName,
          providerType: input.providerType,
          servingCapabilities: (input.servingCapabilities ??
            {}) as Prisma.InputJsonValue,
          tenantId: context.tenant.tenantId
        }
      });

      await writeAuditEvent(prisma, {
        action: "model_provider.created",
        actorType: "User",
        entityId: created.modelProviderId,
        entityType: "ModelProvider",
        metadata: {
          deploymentType: created.deploymentType,
          providerName: created.providerName,
          providerType: created.providerType
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return serializeModelProvider(created);
    },

    async updateModelProvider(context, modelProviderId, input) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "update a model provider"
      );

      const existing = await prisma.modelProvider.findFirst({
        where: { modelProviderId, tenantId: context.tenant.tenantId }
      });

      if (!existing) {
        throw new AppServiceError(
          "Model provider not found.",
          404,
          "not_found"
        );
      }

      const updated = await prisma.modelProvider.update({
        data: {
          allowedUseCases: input.allowedUseCases ?? undefined,
          authMethod: input.authMethod ?? undefined,
          credentialRef:
            input.apiKey === undefined
              ? undefined
              : input.apiKey === null
                ? null
                : encryptModelCredential(input.apiKey),
          dataResidency:
            input.dataResidency === undefined ? undefined : input.dataResidency,
          deploymentType: input.deploymentType ?? undefined,
          endpointUrl: input.endpointUrl ?? undefined,
          providerName: input.providerName ?? undefined,
          servingCapabilities:
            input.servingCapabilities === undefined
              ? undefined
              : (input.servingCapabilities as Prisma.InputJsonValue),
          servingCapabilitiesVerifiedAt:
            input.servingCapabilities === undefined ? undefined : null,
          status: input.status ?? undefined
        },
        where: { modelProviderId }
      });

      await writeAuditEvent(prisma, {
        action: "model_provider.updated",
        actorType: "User",
        entityId: modelProviderId,
        entityType: "ModelProvider",
        metadata: { rotatedCredential: input.apiKey !== undefined },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return serializeModelProvider(updated);
    },

    async deleteModelProvider(context, modelProviderId) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "delete a model provider"
      );

      const existing = await prisma.modelProvider.findFirst({
        where: { modelProviderId, tenantId: context.tenant.tenantId }
      });

      if (!existing) {
        throw new AppServiceError(
          "Model provider not found.",
          404,
          "not_found"
        );
      }

      const activeSessions = await prisma.modelSession.count({
        where: {
          modelProviderId,
          status: { in: ["Created", "Active", "Paused", "Blocked"] },
          tenantId: context.tenant.tenantId
        }
      });

      if (activeSessions > 0) {
        throw new AppServiceError(
          "Cannot delete a provider with active sessions. Terminate sessions first.",
          409,
          "conflict"
        );
      }

      await prisma.modelProvider.delete({ where: { modelProviderId } });

      await writeAuditEvent(prisma, {
        action: "model_provider.deleted",
        actorType: "User",
        entityId: modelProviderId,
        entityType: "ModelProvider",
        metadata: { providerName: existing.providerName },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
    },

    async testModelProviderConnection(context, modelProviderId) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "test a model provider connection"
      );

      const provider = await prisma.modelProvider.findFirst({
        where: { modelProviderId, tenantId: context.tenant.tenantId }
      });
      if (!provider) {
        throw new AppServiceError(
          "Model provider not found.",
          404,
          "not_found"
        );
      }

      const adapter = createModelProviderAdapter(provider.providerType, {
        apiKey: provider.credentialRef
          ? decryptModelCredential(provider.credentialRef)
          : null,
        authMethod: provider.authMethod,
        endpointUrl: provider.endpointUrl
      });

      // The connection test sends NO customer evidence or context.
      const result = await adapter.testConnection();
      const capabilities = ModelServingCapabilitiesSchema.parse(
        provider.servingCapabilities ?? {}
      );
      const declaredModels = capabilities.adapterAliases
        .filter((adapterAlias) => adapterAlias.status === "Active")
        .map((adapterAlias) => adapterAlias.model);
      const capabilitiesVerified =
        result.ok &&
        declaredModels.length > 0 &&
        Array.isArray(result.availableModels) &&
        declaredModels.every((model) =>
          result.availableModels?.includes(model)
        );

      await prisma.modelProvider.update({
        data: {
          lastTestedAt: new Date(),
          servingCapabilities: capabilitiesVerified
            ? ({
                ...capabilities,
                source: "ConnectionVerified"
              } as Prisma.InputJsonValue)
            : undefined,
          servingCapabilitiesVerifiedAt: capabilitiesVerified
            ? new Date()
            : null,
          status: result.ok ? "Active" : "Error"
        },
        where: { modelProviderId }
      });

      return {
        availableModels: result.availableModels,
        message: result.message,
        ok: result.ok,
        providerType: provider.providerType,
        testedAt: new Date().toISOString()
      } satisfies ModelProviderConnectionTestResult;
    },

    async listModelPolicyProfiles(context) {
      const profiles = await prisma.modelPolicyProfile.findMany({
        orderBy: { createdAt: "desc" },
        where: { tenantId: context.tenant.tenantId }
      });

      return profiles.map(serializeModelPolicyProfile);
    },

    async getModelPolicyProfile(context, modelPolicyProfileId) {
      const profile = await prisma.modelPolicyProfile.findFirst({
        where: { modelPolicyProfileId, tenantId: context.tenant.tenantId }
      });

      return profile ? serializeModelPolicyProfile(profile) : null;
    },

    async createModelPolicyProfile(context, input) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "create a model policy profile"
      );

      const created = await prisma.modelPolicyProfile.create({
        data: {
          allowExternalValidation: input.allowExternalValidation ?? false,
          allowInternalValidation: input.allowInternalValidation ?? false,
          allowRawEvidence: input.allowRawEvidence ?? false,
          allowRunnerTasks: input.allowRunnerTasks ?? false,
          allowSensitiveContext: input.allowSensitiveContext ?? false,
          allowTicketCreation: input.allowTicketCreation ?? false,
          allowedDataClasses: input.allowedDataClasses ?? [],
          allowedModes: input.allowedModes,
          allowedTools: input.allowedTools ?? [],
          approvalRequiredAboveLevel:
            input.approvalRequiredAboveLevel ?? "ActiveNonInvasive",
          blockedTools: input.blockedTools ?? [],
          createdBy: context.user.userId,
          description: input.description,
          maxSafetyLevel: input.maxSafetyLevel ?? "ActiveNonInvasive",
          name: input.name,
          redactionPolicy: input.redactionPolicy ?? "default",
          sessionTimeoutMinutes: input.sessionTimeoutMinutes ?? 60,
          tenantId: context.tenant.tenantId
        }
      });

      await writeAuditEvent(prisma, {
        action: "model_policy.created",
        actorType: "User",
        entityId: created.modelPolicyProfileId,
        entityType: "ModelPolicyProfile",
        metadata: { after: modelPolicyAuditSnapshot(created) },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return serializeModelPolicyProfile(created);
    },

    async updateModelPolicyProfile(context, modelPolicyProfileId, input) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "update a model policy profile"
      );

      const existing = await prisma.modelPolicyProfile.findFirst({
        where: { modelPolicyProfileId, tenantId: context.tenant.tenantId }
      });

      if (!existing) {
        throw new AppServiceError(
          "Model policy profile not found.",
          404,
          "not_found"
        );
      }

      const updated = await prisma.modelPolicyProfile.update({
        data: {
          allowExternalValidation: input.allowExternalValidation ?? undefined,
          allowInternalValidation: input.allowInternalValidation ?? undefined,
          allowRawEvidence: input.allowRawEvidence ?? undefined,
          allowRunnerTasks: input.allowRunnerTasks ?? undefined,
          allowSensitiveContext: input.allowSensitiveContext ?? undefined,
          allowTicketCreation: input.allowTicketCreation ?? undefined,
          allowedDataClasses: input.allowedDataClasses ?? undefined,
          allowedModes: input.allowedModes ?? undefined,
          allowedTools: input.allowedTools ?? undefined,
          approvalRequiredAboveLevel:
            input.approvalRequiredAboveLevel ?? undefined,
          blockedTools: input.blockedTools ?? undefined,
          description: input.description ?? undefined,
          maxSafetyLevel: input.maxSafetyLevel ?? undefined,
          name: input.name ?? undefined,
          redactionPolicy: input.redactionPolicy ?? undefined,
          sessionTimeoutMinutes: input.sessionTimeoutMinutes ?? undefined
        },
        where: { modelPolicyProfileId }
      });

      await writeAuditEvent(prisma, {
        action: "model_policy.updated",
        actorType: "User",
        entityId: updated.modelPolicyProfileId,
        entityType: "ModelPolicyProfile",
        metadata: {
          after: modelPolicyAuditSnapshot(updated),
          before: modelPolicyAuditSnapshot(existing)
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return serializeModelPolicyProfile(updated);
    },

    async deleteModelPolicyProfile(context, modelPolicyProfileId) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "delete a model policy profile"
      );

      const existing = await prisma.modelPolicyProfile.findFirst({
        where: { modelPolicyProfileId, tenantId: context.tenant.tenantId }
      });

      if (!existing) {
        throw new AppServiceError(
          "Model policy profile not found.",
          404,
          "not_found"
        );
      }

      const referencing = await prisma.modelSession.count({
        where: {
          modelPolicyProfileId,
          status: { in: ["Created", "Active", "Paused", "Blocked"] },
          tenantId: context.tenant.tenantId
        }
      });

      if (referencing > 0) {
        throw new AppServiceError(
          "Cannot delete a policy profile referenced by active sessions.",
          409,
          "conflict"
        );
      }

      await prisma.modelPolicyProfile.delete({
        where: { modelPolicyProfileId }
      });

      await writeAuditEvent(prisma, {
        action: "model_policy.deleted",
        actorType: "User",
        entityId: existing.modelPolicyProfileId,
        entityType: "ModelPolicyProfile",
        metadata: { before: modelPolicyAuditSnapshot(existing) },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
    },

    async listModelTools(context) {
      const overrides = await prisma.modelTool.findMany({
        where: { tenantId: context.tenant.tenantId }
      });
      const overrideByName = new Map(
        overrides.map((row) => [row.toolName, row])
      );

      return listModelToolDefinitions().map((definition) => {
        const override = overrideByName.get(definition.toolName);
        const now = new Date().toISOString();

        return {
          allowedSessionModes:
            override && override.allowedSessionModes.length > 0
              ? (override.allowedSessionModes as ModelSessionMode[])
              : definition.allowedModes,
          approvalRequired:
            override?.approvalRequired ?? definition.approvalRequiredByDefault,
          createdAt: override?.createdAt.toISOString() ?? now,
          definition,
          enabled: override?.enabled ?? true,
          tenantId: context.tenant.tenantId,
          toolName: definition.toolName,
          updatedAt: override?.updatedAt.toISOString() ?? now
        } satisfies ModelTool;
      });
    },

    async updateModelTool(context, toolName, input) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "configure a model tool"
      );

      const definition = getModelToolDefinition(toolName);
      if (!definition) {
        throw new AppServiceError("Unknown tool.", 404, "not_found");
      }

      const row = await prisma.modelTool.upsert({
        create: {
          allowedSessionModes: input.allowedSessionModes ?? [],
          approvalRequired:
            input.approvalRequired ?? definition.approvalRequiredByDefault,
          enabled: input.enabled ?? true,
          tenantId: context.tenant.tenantId,
          toolName
        },
        update: {
          allowedSessionModes: input.allowedSessionModes ?? undefined,
          approvalRequired: input.approvalRequired ?? undefined,
          enabled: input.enabled ?? undefined
        },
        where: {
          tenantId_toolName: { tenantId: context.tenant.tenantId, toolName }
        }
      });

      return {
        allowedSessionModes:
          row.allowedSessionModes.length > 0
            ? (row.allowedSessionModes as ModelSessionMode[])
            : definition.allowedModes,
        approvalRequired: row.approvalRequired,
        createdAt: row.createdAt.toISOString(),
        definition,
        enabled: row.enabled,
        tenantId: context.tenant.tenantId,
        toolName,
        updatedAt: row.updatedAt.toISOString()
      } satisfies ModelTool;
    },

    async listModelSessions(context) {
      const sessions = await prisma.modelSession.findMany({
        orderBy: { createdAt: "desc" },
        where: { tenantId: context.tenant.tenantId }
      });

      return sessions.map(serializeModelSession);
    },

    async getModelSession(context, modelSessionId) {
      const session = await prisma.modelSession.findFirst({
        where: { modelSessionId, tenantId: context.tenant.tenantId }
      });

      return session ? serializeModelSession(session) : null;
    },

    async createModelSession(context, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "create a model session"
      );

      await assertModelGatewayKillSwitchInactive(
        context.tenant.tenantId,
        "create a model session"
      );

      const provider = await prisma.modelProvider.findFirst({
        where: {
          modelProviderId: input.modelProviderId,
          tenantId: context.tenant.tenantId
        }
      });
      if (!provider) {
        throw new AppServiceError(
          "Model provider not found.",
          404,
          "not_found"
        );
      }
      if (provider.status !== "Active") {
        throw new AppServiceError(
          "Model provider is not active.",
          409,
          "conflict"
        );
      }
      const servingCapabilities = ModelServingCapabilitiesSchema.parse(
        provider.servingCapabilities ?? {}
      );
      const requestedAdapter = input.adapterAlias
        ? servingCapabilities.adapterAliases.find(
            (adapterAlias) =>
              adapterAlias.alias === input.adapterAlias &&
              adapterAlias.status === "Active"
          )
        : null;
      if (input.adapterAlias && !requestedAdapter) {
        throw new AppServiceError(
          `Adapter alias ${input.adapterAlias} is not active on this provider.`,
          422,
          "model_adapter_unavailable"
        );
      }
      const precisionMode =
        input.precisionMode ?? servingCapabilities.defaultPrecisionMode;
      if (!servingCapabilities.precisionModes.includes(precisionMode)) {
        throw new AppServiceError(
          `Precision mode ${precisionMode} is not declared by this provider.`,
          422,
          "model_precision_unavailable"
        );
      }

      const profile = await prisma.modelPolicyProfile.findFirst({
        where: {
          modelPolicyProfileId: input.modelPolicyProfileId,
          tenantId: context.tenant.tenantId
        }
      });
      if (!profile) {
        throw new AppServiceError(
          "Model policy profile not found.",
          404,
          "not_found"
        );
      }

      if (!profile.allowedModes.includes(input.mode)) {
        throw new AppServiceError(
          `Mode ${input.mode} is not permitted by the selected policy profile.`,
          422,
          "policy_violation"
        );
      }

      const scopeCount = await prisma.scope.count({
        where: {
          scopeId: { in: input.scopeIds },
          tenantId: context.tenant.tenantId
        }
      });
      if (scopeCount !== input.scopeIds.length) {
        throw new AppServiceError(
          "One or more scopes were not found for this tenant.",
          422,
          "invalid_scope"
        );
      }

      const created = await prisma.modelSession.create({
        data: {
          adapterAlias: requestedAdapter?.alias ?? null,
          mode: input.mode,
          modelPolicyProfileId: input.modelPolicyProfileId,
          modelProviderId: input.modelProviderId,
          purpose: input.purpose,
          precisionMode,
          requestedModel:
            input.requestedModel ?? requestedAdapter?.model ?? null,
          scopeIds: input.scopeIds,
          status: "Created",
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        }
      });

      await writeModelGatewayAuditEvent(prisma, {
        eventType: "SessionCreated",
        metadata: { mode: created.mode, purpose: created.purpose },
        modelProviderId: created.modelProviderId,
        modelSessionId: created.modelSessionId,
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      await writeAuditEvent(prisma, {
        action: "model_session.created",
        actorType: "User",
        entityId: created.modelSessionId,
        entityType: "ModelSession",
        metadata: { mode: created.mode },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return serializeModelSession(created);
    },

    async startModelSession(context, modelSessionId) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "start a model session"
      );

      const session = await prisma.modelSession.findFirst({
        include: { policyProfile: true },
        where: { modelSessionId, tenantId: context.tenant.tenantId }
      });
      if (!session) {
        throw new AppServiceError("Model session not found.", 404, "not_found");
      }
      if (session.status === "Terminated" || session.status === "Expired") {
        throw new AppServiceError(
          "Session has ended and cannot be restarted.",
          409,
          "conflict"
        );
      }

      const now = new Date();
      const expiresAt = new Date(
        now.getTime() + session.policyProfile.sessionTimeoutMinutes * 60 * 1000
      );

      const updated = await prisma.modelSession.update({
        data: {
          expiresAt,
          startedAt: session.startedAt ?? now,
          status: "Active"
        },
        where: { modelSessionId }
      });

      await writeModelGatewayAuditEvent(prisma, {
        eventType: "SessionStarted",
        metadata: { expiresAt: expiresAt.toISOString() },
        modelSessionId,
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return serializeModelSession(updated);
    },

    async pauseModelSession(context, modelSessionId) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "pause a model session"
      );

      const session = await prisma.modelSession.findFirst({
        where: { modelSessionId, tenantId: context.tenant.tenantId }
      });
      if (!session) {
        throw new AppServiceError("Model session not found.", 404, "not_found");
      }
      await assertModelSessionLive(session, "Session has ended.");

      const updated = await prisma.modelSession.update({
        data: { status: "Paused" },
        where: { modelSessionId }
      });

      await writeModelGatewayAuditEvent(prisma, {
        eventType: "SessionPaused",
        modelSessionId,
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return serializeModelSession(updated);
    },

    async terminateModelSession(context, modelSessionId) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "terminate a model session"
      );

      const session = await prisma.modelSession.findFirst({
        where: { modelSessionId, tenantId: context.tenant.tenantId }
      });
      if (!session) {
        throw new AppServiceError("Model session not found.", 404, "not_found");
      }

      const updated =
        session.status === "Terminated"
          ? session
          : await prisma.modelSession.update({
              data: { endedAt: new Date(), status: "Terminated" },
              where: { modelSessionId }
            });

      if (session.status !== "Terminated") {
        await prisma.modelToolRequest.updateMany({
          data: { denialReason: "Session terminated.", status: "Cancelled" },
          where: {
            modelSessionId,
            status: { in: ["Requested", "RequiresApproval", "Approved"] },
            tenantId: context.tenant.tenantId
          }
        });

        await writeModelGatewayAuditEvent(prisma, {
          eventType: "SessionTerminated",
          modelSessionId,
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });

        await writeAuditEvent(prisma, {
          action: "model_session.terminated",
          actorType: "User",
          entityId: modelSessionId,
          entityType: "ModelSession",
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
      }

      return serializeModelSession(updated);
    },

    async enqueueModelSessionTurn(context, modelSessionId, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "start a model session turn"
      );

      await assertModelGatewayKillSwitchInactive(
        context.tenant.tenantId,
        "start a model session turn"
      );

      const session = await prisma.modelSession.findFirst({
        where: { modelSessionId, tenantId: context.tenant.tenantId }
      });
      if (!session) {
        throw new AppServiceError("Model session not found.", 404, "not_found");
      }
      if (session.status !== "Active") {
        throw new AppServiceError(
          `Session must be Active to accept a turn (current: ${session.status}).`,
          409,
          "conflict"
        );
      }

      const turnId = randomUUID();
      const reservation = await reserveModelUsageTurn({
        modelSessionId,
        prompt: input.prompt,
        queueLane: input.queueLane,
        prisma,
        tenantId: context.tenant.tenantId,
        turnId
      });
      try {
        await modelGatewayTurnQueue.enqueueTurn({
          modelSessionId,
          prompt: input.prompt,
          queueLane: input.queueLane,
          tenantId: context.tenant.tenantId,
          turnId,
          userId: context.user.userId
        });
      } catch (error) {
        await prisma.modelUsageEvent.update({
          data: {
            completedAt: new Date(),
            failureCategory: "QueueEnqueueFailed",
            status: "Failed"
          },
          where: { turnId }
        });
        throw error;
      }

      await writeModelGatewayAuditEvent(prisma, {
        eventType: "SessionStarted",
        metadata: {
          event: "turn_enqueued",
          routedModelProviderId: reservation.modelProviderId,
          routingReason: reservation.routingReason,
          turnId
        },
        modelSessionId,
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return {
        enqueuedAt: new Date().toISOString(),
        jobId: turnId,
        modelSessionId,
        status: session.status
      };
    },

    async listModelSessionTurns(context, modelSessionId) {
      const session = await prisma.modelSession.findFirst({
        select: { modelSessionId: true },
        where: { modelSessionId, tenantId: context.tenant.tenantId }
      });
      if (!session) {
        throw new AppServiceError("Model session not found.", 404, "not_found");
      }
      const turns = await prisma.modelUsageEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        where: { modelSessionId, tenantId: context.tenant.tenantId }
      });
      return turns.map(serializeModelUsageEvent);
    },

    async createContextBundle(context, modelSessionId, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "build a context bundle"
      );

      const session = await prisma.modelSession.findFirst({
        include: { policyProfile: true },
        where: { modelSessionId, tenantId: context.tenant.tenantId }
      });
      if (!session) {
        throw new AppServiceError("Model session not found.", 404, "not_found");
      }
      // A context bundle materializes redacted scoped tenant data for the model;
      // it is session work bounded by the timeout window, so an ended/time-expired
      // session must not build a fresh bundle — same guard every other session
      // write path (tool request create/execute, pause) already enforces.
      await assertModelSessionLive(
        session,
        "Session has ended; no new context bundles are built."
      );

      const scopeIds =
        input.scopeIds && input.scopeIds.length > 0
          ? input.scopeIds
          : session.scopeIds;

      const built = await buildModelContextBundle({
        maxTokenEstimate: input.maxTokenEstimate,
        prisma,
        scopeIds,
        session,
        tenantId: context.tenant.tenantId
      });

      const created = await prisma.contextBundle.create({
        data: {
          expiresAt: session.expiresAt,
          items: { create: built.items },
          modelSessionId,
          pruningManifest: built.pruningManifest as Prisma.InputJsonValue,
          redactionPolicy: session.policyProfile.redactionPolicy,
          scopeIds,
          sensitivityLevel: built.sensitivityLevel,
          sourceTokenEstimate: built.sourceTokenEstimate,
          tenantId: context.tenant.tenantId,
          tokenBudget: built.tokenBudget,
          tokenEstimate: built.tokenEstimate
        },
        include: { items: true }
      });

      await writeModelGatewayAuditEvent(prisma, {
        eventType: "ContextBundleCreated",
        metadata: {
          itemCount: created.items.length,
          omittedItemCount: built.pruningManifest.omittedItems.length,
          sensitivityLevel: created.sensitivityLevel
        },
        modelSessionId,
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return serializeContextBundle(created);
    },

    async listContextBundles(context, modelSessionId) {
      const session = await prisma.modelSession.findFirst({
        where: { modelSessionId, tenantId: context.tenant.tenantId }
      });
      if (!session) {
        throw new AppServiceError("Model session not found.", 404, "not_found");
      }

      const bundles = await prisma.contextBundle.findMany({
        include: { items: true },
        orderBy: { createdAt: "desc" },
        where: { modelSessionId, tenantId: context.tenant.tenantId }
      });

      return bundles.map(serializeContextBundle);
    },

    async getContextBundle(context, contextBundleId) {
      const bundle = await prisma.contextBundle.findFirst({
        include: { items: true },
        where: { contextBundleId, tenantId: context.tenant.tenantId }
      });

      return bundle ? serializeContextBundle(bundle) : null;
    },

    async listModelToolRequests(context, modelSessionId) {
      const session = await prisma.modelSession.findFirst({
        where: { modelSessionId, tenantId: context.tenant.tenantId }
      });
      if (!session) {
        throw new AppServiceError("Model session not found.", 404, "not_found");
      }

      const requests = await prisma.modelToolRequest.findMany({
        include: { result: true },
        orderBy: { createdAt: "desc" },
        where: { modelSessionId, tenantId: context.tenant.tenantId }
      });

      return requests.map(serializeModelToolRequest);
    },

    async getModelToolRequest(context, toolRequestId) {
      const request = await prisma.modelToolRequest.findFirst({
        include: { result: true },
        where: { toolRequestId, tenantId: context.tenant.tenantId }
      });

      return request ? serializeModelToolRequest(request) : null;
    },

    async createModelToolRequest(context, modelSessionId, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "create a model tool request"
      );

      await assertModelGatewayKillSwitchInactive(
        context.tenant.tenantId,
        "create a model tool request"
      );

      const session = await prisma.modelSession.findFirst({
        include: { policyProfile: true },
        where: { modelSessionId, tenantId: context.tenant.tenantId }
      });
      if (!session) {
        throw new AppServiceError("Model session not found.", 404, "not_found");
      }
      await assertModelSessionLive(
        session,
        "Session has ended; no new tool requests are accepted."
      );

      const created = await createGatewayToolRequest({
        deps: gatewayPolicyDeps,
        input: {
          input: input.input ?? {},
          requestReason: input.requestReason,
          requestedByModel: false,
          scopeIds: input.scopeIds,
          toolName: input.toolName
        },
        prisma,
        session,
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return serializeModelToolRequest(created);
    },

    async listModelToolInterventions(
      context
    ): Promise<ModelToolInterventionQueue> {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "review model tool interventions"
      );

      const now = new Date();
      const expired = await prisma.modelToolIntervention.findMany({
        where: {
          expiresAt: { lte: now },
          status: "Pending",
          tenantId: context.tenant.tenantId
        }
      });
      if (expired.length > 0) {
        await prisma.modelToolIntervention.updateMany({
          data: { status: "Expired" },
          where: {
            interventionId: { in: expired.map((item) => item.interventionId) },
            status: "Pending",
            tenantId: context.tenant.tenantId
          }
        });
        await Promise.all(
          expired.map((item) =>
            writeModelGatewayAuditEvent(prisma, {
              eventType: "InterventionExpired",
              metadata: { interventionId: item.interventionId },
              modelSessionId: item.modelSessionId,
              tenantId: context.tenant.tenantId,
              toolName: item.toolName,
              toolRequestId: item.toolRequestId,
              userId: context.user.userId
            })
          )
        );
      }

      const requests = await prisma.modelToolRequest.findMany({
        include: {
          interventions: { orderBy: { issuedAt: "desc" }, take: 1 },
          session: { include: { policyProfile: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 100,
        where: {
          OR: [{ status: "RequiresApproval" }, { interventions: { some: {} } }],
          tenantId: context.tenant.tenantId
        }
      });

      const items = requests.map((request) => ({
        createdAt: request.createdAt.toISOString(),
        inputPayloadHash: request.inputPayloadHash,
        intervention: request.interventions[0]
          ? serializeModelToolIntervention(request.interventions[0])
          : null,
        modelSessionId: request.modelSessionId,
        policyDecisionId: request.policyDecisionId,
        policyProfileName: request.session.policyProfile.name,
        requestReason: request.requestReason,
        scopeIds: request.scopeIds,
        sessionMode: request.session.mode,
        sessionPurpose: request.session.purpose,
        status: request.status,
        toolName: request.toolName,
        toolRequestId: request.toolRequestId
      }));

      return {
        generatedAt: now.toISOString(),
        items,
        limitations: [
          "Slack and Teams may transport the signed link, but a channel message is never an approval.",
          "The reviewer must be signed in as a tenant administrator; the exact request, scope, policy, expiry, and one-time token are rechecked at decision time."
        ],
        pendingCount: items.filter((item) => item.status === "RequiresApproval")
          .length,
        reviewLinkCount: items.filter(
          (item) => item.intervention?.status === "Pending"
        ).length
      };
    },

    async issueModelToolIntervention(
      context,
      toolRequestId,
      input: IssueModelToolInterventionInput
    ): Promise<IssueModelToolInterventionResult> {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "issue a model tool intervention link"
      );

      const request = await prisma.modelToolRequest.findFirst({
        include: { session: { include: { policyProfile: true } } },
        where: { toolRequestId, tenantId: context.tenant.tenantId }
      });
      if (!request) {
        throw new AppServiceError("Tool request not found.", 404, "not_found");
      }
      if (request.status !== "RequiresApproval") {
        throw new AppServiceError(
          `Tool request is not awaiting intervention (status ${request.status}).`,
          409,
          "conflict"
        );
      }
      await assertModelSessionLive(
        request.session,
        "Session has ended; an intervention link cannot be issued."
      );

      const interventionId = randomUUID();
      const issuedAt = new Date();
      const expiresAt = new Date(
        issuedAt.getTime() + input.expiresInMinutes * 60_000
      );
      const envelopeHash = modelToolInterventionEnvelopeHash(request);
      const token = signModelToolInterventionToken(
        {
          envelopeHash,
          expiresAt: expiresAt.toISOString(),
          interventionId,
          tenantId: context.tenant.tenantId,
          toolRequestId,
          version: 1
        },
        deps.interventionSigningSecret
      );
      const tokenHash = sha256(token);

      const created = await prisma.$transaction(async (tx) => {
        await tx.modelToolIntervention.updateMany({
          data: { status: "Superseded" },
          where: {
            status: "Pending",
            tenantId: context.tenant.tenantId,
            toolRequestId
          }
        });
        return tx.modelToolIntervention.create({
          data: {
            envelopeHash,
            expiresAt,
            inputPayloadHash: request.inputPayloadHash,
            interventionId,
            issuedAt,
            issuedBy: context.user.userId,
            modelSessionId: request.modelSessionId,
            policyDecisionId: request.policyDecisionId,
            policyProfileName: request.session.policyProfile.name,
            requestReason: request.requestReason,
            scopeIds: request.scopeIds,
            sessionMode: request.session.mode,
            sessionPurpose: request.session.purpose,
            status: "Pending",
            tenantId: context.tenant.tenantId,
            tokenHash,
            toolName: request.toolName,
            toolRequestId,
            transport: input.transport
          }
        });
      });

      await writeModelGatewayAuditEvent(prisma, {
        eventType: "InterventionLinkIssued",
        metadata: {
          envelopeHash,
          expiresAt: expiresAt.toISOString(),
          interventionId,
          tokenFingerprint: tokenHash,
          transport: input.transport
        },
        modelSessionId: request.modelSessionId,
        tenantId: context.tenant.tenantId,
        toolName: request.toolName,
        toolRequestId,
        userId: context.user.userId
      });

      const fragment = new URLSearchParams({
        intervention: interventionId,
        token
      });
      return {
        intervention: serializeModelToolIntervention(created),
        rawTokenStored: false,
        reviewUrl: `${deps.webBaseUrl}/model-gateway#${fragment.toString()}`
      };
    },

    async inspectModelToolIntervention(
      context,
      interventionId,
      input: InspectModelToolInterventionInput
    ): Promise<ModelToolIntervention> {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "inspect a model tool intervention"
      );
      const record = await loadVerifiedIntervention(
        context,
        interventionId,
        input
      );
      if (record.status === "Pending" && record.expiresAt <= new Date()) {
        const expired = await prisma.modelToolIntervention.update({
          data: { status: "Expired" },
          where: { interventionId: record.interventionId }
        });
        await writeModelGatewayAuditEvent(prisma, {
          eventType: "InterventionExpired",
          metadata: { interventionId },
          modelSessionId: record.modelSessionId,
          tenantId: context.tenant.tenantId,
          toolName: record.toolName,
          toolRequestId: record.toolRequestId,
          userId: context.user.userId
        });
        return serializeModelToolIntervention(expired);
      }
      return serializeModelToolIntervention(record);
    },

    async decideModelToolIntervention(
      context,
      interventionId,
      input: DecideModelToolInterventionInput
    ): Promise<ModelToolInterventionDecisionResult> {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "decide a model tool intervention"
      );
      const record = await loadVerifiedIntervention(
        context,
        interventionId,
        input
      );
      const now = new Date();
      if (record.expiresAt <= now) {
        if (record.status === "Pending") {
          await prisma.modelToolIntervention.update({
            data: { status: "Expired" },
            where: { interventionId }
          });
        }
        await writeModelGatewayAuditEvent(prisma, {
          eventType: "InterventionExpired",
          metadata: { interventionId },
          modelSessionId: record.modelSessionId,
          tenantId: context.tenant.tenantId,
          toolName: record.toolName,
          toolRequestId: record.toolRequestId,
          userId: context.user.userId
        });
        throw new AppServiceError(
          "This intervention link expired. Issue a new review link.",
          410,
          "intervention_expired"
        );
      }
      if (record.status !== "Pending") {
        await writeModelGatewayAuditEvent(prisma, {
          eventType: "InterventionRejected",
          metadata: { interventionId, reason: "decision_replay" },
          modelSessionId: record.modelSessionId,
          tenantId: context.tenant.tenantId,
          toolName: record.toolName,
          toolRequestId: record.toolRequestId,
          userId: context.user.userId
        });
        throw new AppServiceError(
          `This intervention was already resolved (${record.status}).`,
          409,
          "intervention_replay_denied"
        );
      }

      const resumed = input.decision === "Resume";
      const updated = await prisma.$transaction(async (tx) => {
        const requestUpdate = await tx.modelToolRequest.updateMany({
          data: resumed
            ? {
                approvedAt: now,
                approvedBy: context.user.userId,
                status: "Approved"
              }
            : {
                denialReason: `Cancelled by intervention reviewer: ${input.reason}`,
                status: "Cancelled"
              },
          where: {
            status: "RequiresApproval",
            tenantId: context.tenant.tenantId,
            toolRequestId: record.toolRequestId
          }
        });
        if (requestUpdate.count !== 1) {
          throw new AppServiceError(
            "The tool request is no longer awaiting this decision.",
            409,
            "intervention_request_changed"
          );
        }

        const interventionUpdate = await tx.modelToolIntervention.updateMany({
          data: {
            decision: input.decision,
            decisionAt: now,
            decisionBy: context.user.userId,
            decisionReason: input.reason,
            reviewReference: input.reviewReference,
            status: resumed ? "Resumed" : "Cancelled"
          },
          where: {
            expiresAt: { gt: now },
            interventionId,
            status: "Pending",
            tenantId: context.tenant.tenantId,
            tokenHash: sha256(input.token)
          }
        });
        if (interventionUpdate.count !== 1) {
          throw new AppServiceError(
            "The intervention was resolved or expired before this decision completed.",
            409,
            "intervention_race_denied"
          );
        }
        return tx.modelToolIntervention.findUniqueOrThrow({
          where: { interventionId }
        });
      });

      await writeModelGatewayAuditEvent(prisma, {
        eventType: resumed ? "InterventionResumed" : "InterventionCancelled",
        metadata: {
          decision: input.decision,
          interventionId,
          reason: input.reason,
          reviewReference: input.reviewReference
        },
        modelSessionId: record.modelSessionId,
        tenantId: context.tenant.tenantId,
        toolName: record.toolName,
        toolRequestId: record.toolRequestId,
        userId: context.user.userId
      });
      await writeModelGatewayAuditEvent(prisma, {
        eventType: resumed ? "ToolAllowed" : "ToolDenied",
        metadata: {
          decision: resumed ? "resumed" : "cancelled",
          interventionId
        },
        modelSessionId: record.modelSessionId,
        tenantId: context.tenant.tenantId,
        toolName: record.toolName,
        toolRequestId: record.toolRequestId,
        userId: context.user.userId
      });

      return {
        intervention: serializeModelToolIntervention(updated),
        requestStatus: resumed ? "Approved" : "Cancelled"
      };
    },

    async approveModelToolRequest(context, toolRequestId) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "approve a model tool request"
      );

      const request = await prisma.modelToolRequest.findFirst({
        include: { result: true },
        where: { toolRequestId, tenantId: context.tenant.tenantId }
      });
      if (!request) {
        throw new AppServiceError("Tool request not found.", 404, "not_found");
      }
      if (request.status !== "RequiresApproval") {
        throw new AppServiceError(
          `Tool request is not awaiting approval (status ${request.status}).`,
          409,
          "conflict"
        );
      }

      const updated = await prisma.modelToolRequest.update({
        data: {
          approvedAt: new Date(),
          approvedBy: context.user.userId,
          status: "Approved"
        },
        include: { result: true },
        where: { toolRequestId }
      });

      await writeModelGatewayAuditEvent(prisma, {
        eventType: "ToolAllowed",
        metadata: { decision: "approved" },
        modelSessionId: request.modelSessionId,
        tenantId: context.tenant.tenantId,
        toolName: request.toolName,
        toolRequestId,
        userId: context.user.userId
      });

      return serializeModelToolRequest(updated);
    },

    async denyModelToolRequest(context, toolRequestId) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "deny a model tool request"
      );

      const request = await prisma.modelToolRequest.findFirst({
        include: { result: true },
        where: { toolRequestId, tenantId: context.tenant.tenantId }
      });
      if (!request) {
        throw new AppServiceError("Tool request not found.", 404, "not_found");
      }
      if (
        request.status === "Completed" ||
        request.status === "Denied" ||
        request.status === "Cancelled"
      ) {
        throw new AppServiceError(
          `Tool request cannot be denied (status ${request.status}).`,
          409,
          "conflict"
        );
      }

      const updated = await prisma.modelToolRequest.update({
        data: {
          denialReason: "Denied by administrator.",
          status: "Denied"
        },
        include: { result: true },
        where: { toolRequestId }
      });

      await writeModelGatewayAuditEvent(prisma, {
        eventType: "ToolDenied",
        metadata: { decision: "denied" },
        modelSessionId: request.modelSessionId,
        tenantId: context.tenant.tenantId,
        toolName: request.toolName,
        toolRequestId,
        userId: context.user.userId
      });

      await writeAuditEvent(prisma, {
        action: "model_tool.denied",
        actorType: "User",
        entityId: toolRequestId,
        entityType: "ModelToolRequest",
        metadata: { toolName: request.toolName },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return serializeModelToolRequest(updated);
    },

    async cancelModelToolRequest(context, toolRequestId) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "cancel a model tool request"
      );

      const request = await prisma.modelToolRequest.findFirst({
        include: { result: true },
        where: { toolRequestId, tenantId: context.tenant.tenantId }
      });
      if (!request) {
        throw new AppServiceError("Tool request not found.", 404, "not_found");
      }
      if (
        request.status === "Completed" ||
        request.status === "Denied" ||
        request.status === "Cancelled"
      ) {
        return serializeModelToolRequest(request);
      }

      const updated = await prisma.modelToolRequest.update({
        data: { denialReason: "Cancelled by requester.", status: "Cancelled" },
        include: { result: true },
        where: { toolRequestId }
      });

      return serializeModelToolRequest(updated);
    },

    async executeModelToolRequest(this: AppServices, context, toolRequestId) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "execute a model tool request"
      );

      await assertModelGatewayKillSwitchInactive(
        context.tenant.tenantId,
        "execute a model tool request"
      );

      const request = await prisma.modelToolRequest.findFirst({
        include: { result: true, session: true },
        where: { toolRequestId, tenantId: context.tenant.tenantId }
      });
      if (!request) {
        throw new AppServiceError("Tool request not found.", 404, "not_found");
      }
      // Only idempotent-complete returns early. A Cancelled/Failed row must not
      // surface an orphaned result created by a raced execute after kill-switch.
      if (request.result && request.status === "Completed") {
        return serializeModelToolRequest(request);
      }
      if (request.status !== "Allowed" && request.status !== "Approved") {
        throw new AppServiceError(
          `Tool request is not executable (status ${request.status}).`,
          409,
          "conflict"
        );
      }

      // Autonomous Phase 2 resume support: unblock a Blocked session when executing
      // an approved tool request (minimal continuation for model turns + manual).
      // Full conversation state replay across turns can be layered later.
      // CAS: never resurrect Terminated/Expired sessions if kill-switch raced.
      if (request.session && request.session.status === "Blocked") {
        const resumed = await prisma.modelSession.updateMany({
          data: { status: "Active" },
          where: {
            modelSessionId: request.session.modelSessionId,
            status: "Blocked",
            tenantId: context.tenant.tenantId
          }
        });
        if (resumed.count === 1) {
          request.session.status = "Active";
        }
      }

      await assertModelSessionLive(
        request.session,
        "Session has ended; tool cannot execute."
      );

      // CAS claim: kill-switch activate cancels Allowed/Approved/Running. An
      // unconditional update would resurrect Cancelled → Running and queue work
      // after the operator believed the gateway was stopped.
      const claimed = await prisma.modelToolRequest.updateMany({
        data: { status: "Running" },
        where: {
          status: { in: ["Allowed", "Approved"] },
          tenantId: context.tenant.tenantId,
          toolRequestId
        }
      });
      if (claimed.count !== 1) {
        throw new AppServiceError(
          "Tool request is no longer executable (cancelled, claimed, or completed).",
          409,
          "conflict"
        );
      }

      // Re-check kill switch + session liveness after the claim closes the
      // TOCTOU window with activateModelGatewayKillSwitch.
      try {
        await assertModelGatewayKillSwitchInactive(
          context.tenant.tenantId,
          "execute a model tool request"
        );
        const liveSession = await prisma.modelSession.findFirst({
          where: {
            modelSessionId: request.modelSessionId,
            tenantId: context.tenant.tenantId
          }
        });
        await assertModelSessionLive(
          liveSession ?? request.session,
          "Session has ended; tool cannot execute."
        );
      } catch (gateError) {
        await prisma.modelToolRequest.updateMany({
          data: {
            denialReason:
              gateError instanceof AppServiceError &&
              gateError.code === "model_gateway_kill_switch_active"
                ? `Kill switch activated before execution: ${gateError.message}`
                : "Execution aborted because the session ended or kill switch activated.",
            status: "Cancelled"
          },
          where: {
            status: "Running",
            tenantId: context.tenant.tenantId,
            toolRequestId
          }
        });
        throw gateError;
      }

      const toolInput =
        (request.inputPayloadRedacted as Record<string, unknown>) ?? {};
      const definition = getModelToolDefinition(request.toolName);
      const isActionTool =
        definition !== undefined &&
        (definition.safetyClass === "Validation" ||
          definition.safetyClass === "Remediation" ||
          definition.safetyClass === "Reporting");

      const runActionTool = async (): Promise<GatewayToolExecutionResult> => {
        const scopeId = request.scopeIds[0];
        switch (request.toolName) {
          case "request_exposure_validation":
          case "request_control_validation":
          case "request_attack_path_validation":
          case "request_fix_verification": {
            if (!scopeId) {
              throw new AppServiceError(
                "A verified scope is required to request validation.",
                400,
                "scope_required"
              );
            }
            const missionType =
              request.toolName === "request_control_validation"
                ? "ControlValidation"
                : request.toolName === "request_fix_verification"
                  ? "FixVerification"
                  : "ExposureValidation";
            // Re-preview with explicit human approval so the gateway request
            // reaches Allowed only through the same policy gate as the UI.
            const decision = await this.previewPolicyDecision(
              context,
              scopeId,
              {
                adminApproval: true,
                executionEnvironment: "ControlPlane",
                explicitMissionApproval: true,
                missionType,
                requestedAction: {
                  credentialTheft: false,
                  destructive: false,
                  persistence: false,
                  realDataExfiltration: false,
                  requiresInternalRunner: false,
                  requiresTimeWindow: false,
                  uncontrolledExploitChaining: false
                },
                safetyLevel: "ControlledValidation",
                target: {}
              }
            );
            if (decision.outcome !== "Allowed") {
              // Policy still blocks: record the decision; queue nothing.
              return {
                evidenceIds: [],
                output: {
                  outcome: decision.outcome,
                  policyDecisionId: decision.policyDecisionId,
                  queued: false
                },
                sensitivityLevel: "Low"
              };
            }
            // Deny mission queueing if kill-switch flipped during policy preview.
            await assertModelGatewayKillSwitchInactive(
              context.tenant.tenantId,
              "queue a model-gateway validation mission"
            );
            const mission = await this.createMission(context, {
              missionType,
              policyDecisionId: decision.policyDecisionId,
              policyProfile: "model-gateway",
              safetyLevel: "ControlledValidation",
              scopeId,
              scopeIds: [scopeId]
            });
            return {
              evidenceIds: [],
              output: {
                missionId: mission.missionId,
                outcome: decision.outcome,
                policyDecisionId: decision.policyDecisionId,
                queued: true
              },
              sensitivityLevel: "Low"
            };
          }

          case "create_remediation_plan": {
            const recommendations = generateOperatorRecommendations(
              await buildOperatorContextForTenant(prisma, context)
            );
            const objective =
              typeof toolInput.objective === "string"
                ? toolInput.objective
                : "Remediate the highest-risk validated findings in scope.";
            return {
              evidenceIds: [],
              output: {
                plan: {
                  objective,
                  steps: recommendations.slice(0, 10).map((rec, index) => ({
                    order: index + 1,
                    proposedActions: rec.proposedActions,
                    rationale: rec.rationale,
                    recommendationId: rec.recommendationId,
                    title: rec.title,
                    verificationRequired: true
                  }))
                }
              },
              sensitivityLevel: "Low"
            };
          }

          case "generate_evidence_pack_draft": {
            const artifacts = await prisma.evidenceArtifact.findMany({
              orderBy: { createdAt: "desc" },
              take: 25,
              where: { tenantId: context.tenant.tenantId }
            });
            const useCase =
              typeof toolInput.useCase === "string"
                ? (toolInput.useCase as EvidenceSummaryUseCase)
                : "ExecutiveSummary";
            const summary = generateEvidenceGroundedSummary({
              artifacts: artifacts.map(serializeEvidenceArtifact),
              generatedAt: new Date().toISOString(),
              useCase
            });
            return {
              evidenceIds: [
                ...new Set(summary.claims.flatMap((claim) => claim.evidenceIds))
              ],
              output: { summary },
              sensitivityLevel: "Low"
            };
          }

          default:
            throw new AppServiceError(
              `Tool ${request.toolName} is not an executable action tool.`,
              422,
              "tool_not_executable"
            );
        }
      };

      try {
        // Final pre-side-effect gate: activate may have Cancelled Running while
        // we were preparing the tool payload / read-only deps.
        await assertModelGatewayKillSwitchInactive(
          context.tenant.tenantId,
          "execute a model tool request"
        );
        const stillClaimed = await prisma.modelToolRequest.findFirst({
          select: { toolRequestId: true },
          where: {
            status: "Running",
            tenantId: context.tenant.tenantId,
            toolRequestId
          }
        });
        if (!stillClaimed) {
          throw new AppServiceError(
            "Tool request was cancelled before execution completed.",
            409,
            "conflict"
          );
        }

        const execution = isActionTool
          ? await runActionTool()
          : await executeReadOnlyGatewayTool({
              deps: buildGatewayToolExecutionDeps(prisma, context),
              input: toolInput,
              prisma,
              scopeIds: request.scopeIds,
              tenantId: context.tenant.tenantId,
              toolName: request.toolName
            });
        const redactedOutput = redactGatewayToolOutput(execution.output);

        // Do not persist Completed if kill-switch cancelled mid-flight.
        await assertModelGatewayKillSwitchInactive(
          context.tenant.tenantId,
          "complete a model tool request"
        );

        await prisma.modelToolResult.create({
          data: {
            evidenceIds: execution.evidenceIds,
            outputPayloadRedacted: redactedOutput as Prisma.InputJsonValue,
            returnedToModel: false,
            sensitivityLevel: execution.sensitivityLevel,
            tenantId: context.tenant.tenantId,
            toolRequestId
          }
        });

        const completedClaim = await prisma.modelToolRequest.updateMany({
          data: { completedAt: new Date(), status: "Completed" },
          where: {
            status: "Running",
            tenantId: context.tenant.tenantId,
            toolRequestId
          }
        });
        if (completedClaim.count !== 1) {
          await prisma.modelToolResult.deleteMany({
            where: { tenantId: context.tenant.tenantId, toolRequestId }
          });
          throw new AppServiceError(
            "Tool request was cancelled before completion could be recorded.",
            409,
            "conflict"
          );
        }

        const completed = await prisma.modelToolRequest.findFirstOrThrow({
          include: { result: true },
          where: { toolRequestId, tenantId: context.tenant.tenantId }
        });

        await writeModelGatewayAuditEvent(prisma, {
          eventType: "ToolExecuted",
          evidenceIds: execution.evidenceIds,
          metadata: { toolName: request.toolName },
          modelSessionId: request.modelSessionId,
          tenantId: context.tenant.tenantId,
          toolName: request.toolName,
          toolRequestId,
          userId: context.user.userId
        });

        await writeAuditEvent(prisma, {
          action: "model_tool.executed",
          actorType: "User",
          entityId: toolRequestId,
          entityType: "ModelToolRequest",
          metadata: {
            evidenceCount: execution.evidenceIds.length,
            toolName: request.toolName
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });

        return serializeModelToolRequest(completed);
      } catch (error) {
        // Never overwrite Cancelled (kill-switch) with Failed.
        const failed = await prisma.modelToolRequest.updateMany({
          data: {
            denialReason:
              error instanceof Error ? error.message : "Tool execution failed.",
            status: "Failed"
          },
          where: {
            status: "Running",
            tenantId: context.tenant.tenantId,
            toolRequestId
          }
        });
        if (failed.count === 1) {
          await writeModelGatewayAuditEvent(prisma, {
            eventType: "ToolFailed",
            metadata: {
              error:
                error instanceof Error
                  ? error.message
                  : "Tool execution failed."
            },
            modelSessionId: request.modelSessionId,
            tenantId: context.tenant.tenantId,
            toolName: request.toolName,
            toolRequestId,
            userId: context.user.userId
          });
        }
        throw error;
      }
    },

    async listModelGatewayAuditEvents(context, modelSessionId) {
      if (modelSessionId) {
        const session = await prisma.modelSession.findFirst({
          where: { modelSessionId, tenantId: context.tenant.tenantId }
        });
        if (!session) {
          throw new AppServiceError(
            "Model session not found.",
            404,
            "not_found"
          );
        }
      }

      const events = await prisma.modelGatewayAuditEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 500,
        where: {
          tenantId: context.tenant.tenantId,
          ...(modelSessionId ? { modelSessionId } : {})
        }
      });

      return events.map(serializeModelGatewayAuditEvent);
    },

    async activateModelGatewayKillSwitch(context, input) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "activate the model gateway kill switch"
      );

      const now = new Date();
      const enabled = input.enabled !== false;
      const envForceActive = isModelGatewayEnvKillSwitchActive();

      let terminatedCount = 0;
      let blockedCount = 0;

      if (enabled) {
        const terminated = await prisma.modelSession.updateMany({
          data: { endedAt: now, status: "Terminated" },
          where: {
            status: { in: ["Created", "Active", "Paused", "Blocked"] },
            tenantId: context.tenant.tenantId
          }
        });
        terminatedCount = terminated.count;

        const blocked = await prisma.modelToolRequest.updateMany({
          data: {
            denialReason: `Kill switch activated: ${input.reason}`,
            status: "Cancelled"
          },
          where: {
            // Every non-terminal tool request must be cancelled. "Allowed"
            // (auto-approved read-only tools awaiting execution) is executable by
            // executeModelToolRequest, so omitting it would leave an in-flight
            // request the kill switch claims to have stopped.
            status: {
              in: [
                "Requested",
                "Allowed",
                "RequiresApproval",
                "Approved",
                "Running"
              ]
            },
            tenantId: context.tenant.tenantId
          }
        });
        blockedCount = blocked.count;

        await prisma.tenant.update({
          data: {
            modelGatewayKillSwitchActivatedAt: now,
            modelGatewayKillSwitchActivatedBy: context.user.userId,
            modelGatewayKillSwitchActive: true,
            modelGatewayKillSwitchReason: input.reason
          },
          where: { tenantId: context.tenant.tenantId }
        });
      } else {
        // Clear durable tenant flag. Env force-on cannot be cleared here.
        // Sessions remain Terminated; operators create new sessions after clear.
        await prisma.tenant.update({
          data: {
            modelGatewayKillSwitchActive: false,
            modelGatewayKillSwitchReason: input.reason
          },
          where: { tenantId: context.tenant.tenantId }
        });
      }

      await writeModelGatewayAuditEvent(prisma, {
        eventType: "KillSwitchActivated",
        metadata: {
          blockedToolRequests: blockedCount,
          enabled,
          envForceActive,
          reason: input.reason,
          terminatedSessions: terminatedCount
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      await writeAuditEvent(prisma, {
        action: "model.kill_switch_activated",
        actorType: "User",
        entityId: context.tenant.tenantId,
        entityType: "Tenant",
        metadata: {
          blockedToolRequests: blockedCount,
          enabled,
          envForceActive,
          reason: input.reason,
          terminatedSessions: terminatedCount
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return {
        activatedAt: now.toISOString(),
        blockedToolRequests: blockedCount,
        enabled,
        envForceActive,
        reason: input.reason,
        tenantId: context.tenant.tenantId,
        terminatedSessions: terminatedCount
      } satisfies KillSwitchResult;
    }
  };
}

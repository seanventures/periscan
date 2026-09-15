import type { Prisma } from "@prisma/client";

import {
  ExpectedControlBehaviorSchema,
  resolveScopeSafetyEnvelope,
  ScopeClassificationSchema
} from "@periscan/shared";

import type {
  AIApplication,
  ControlSource,
  Membership,
  MembershipRole,
  PolicyDecision,
  PolicyRequestedAction,
  Scope,
  User,
  ValidationMission,
  ValidationRun
} from "@periscan/shared";

// Pure record -> DTO serializers for core tenant-scoped entities. Extracted from
// runtime-services.ts (god-closure decomposition). Pure field/date mapping with
// no closure state or local-helper dependencies. Helper-coupled entity
// serializers (e.g. integration config redaction, evidence-id merging) are
// extracted in later slices once their shared helpers are factored out.

export function serializeUser(record: {
  createdAt: Date;
  email: string;
  emailVerifiedAt?: Date | null;
  mfaEnabledAt?: Date | null;
  name: string;
  status: User["status"];
  updatedAt: Date;
  userId: string;
}): User {
  return {
    createdAt: record.createdAt.toISOString(),
    email: record.email,
    emailVerifiedAt: record.emailVerifiedAt?.toISOString() ?? null,
    mfaEnabledAt: record.mfaEnabledAt?.toISOString() ?? null,
    name: record.name,
    status: record.status,
    updatedAt: record.updatedAt.toISOString(),
    userId: record.userId
  };
}

export function serializeMembership(record: {
  createdAt: Date;
  experienceProfileCompletedAt?: Date | null;
  membershipId: string;
  primaryOutcome?: Membership["primaryOutcome"] | null;
  productPersona?: Membership["productPersona"] | null;
  role: MembershipRole;
  tenantId: string;
  updatedAt: Date;
  userId: string;
}): Membership {
  return {
    createdAt: record.createdAt.toISOString(),
    experienceProfileCompletedAt:
      record.experienceProfileCompletedAt?.toISOString() ?? null,
    membershipId: record.membershipId,
    primaryOutcome: record.primaryOutcome ?? null,
    productPersona: record.productPersona ?? null,
    role: record.role,
    tenantId: record.tenantId,
    updatedAt: record.updatedAt.toISOString(),
    userId: record.userId
  };
}

const SCOPE_VERIFICATION_MS_PER_DAY = 86_400_000;

// Customer authorization to validate a scope should not be trusted forever — a
// domain ownership proven long ago may no longer be authorized. The max age is
// operator-configurable; default 90 days. Read per-call so it can be tuned.
function scopeVerificationMaxAgeDays(): number {
  const raw = Number(process.env.PERISCAN_SCOPE_VERIFICATION_MAX_AGE_DAYS);
  return Number.isFinite(raw) && raw > 0 ? raw : 90;
}

export function serializeScope(record: {
  assetClass: Scope["assetClass"];
  businessCriticality: Scope["businessCriticality"];
  createdAt: Date;
  createdBy: string | null;
  externalValidationProfileId: string | null;
  maxSafetyLevel: string;
  purdueLevel: string | null;
  scopeId: string;
  scopeType: Scope["scopeType"];
  segmentName: string | null;
  sensitivity: Scope["sensitivity"];
  tags: string[];
  tenantId: string;
  updatedAt: Date;
  value: string;
  verificationMethod: string | null;
  verificationStatus: Scope["verificationStatus"];
  verificationToken: string | null;
  verifiedAt: Date | null;
  verifiedBy: string | null;
  lastPostureCheckAt?: Date | null;
  nextPostureCheckAt?: Date | null;
}): Scope {
  const classification = ScopeClassificationSchema.parse({
    assetClass: record.assetClass,
    businessCriticality: record.businessCriticality,
    externalValidationProfileId: record.externalValidationProfileId,
    maxSafetyLevel: record.maxSafetyLevel,
    purdueLevel: record.purdueLevel,
    segmentName: record.segmentName,
    sensitivity: record.sensitivity,
    tags: record.tags
  });
  const safetyEnvelope = resolveScopeSafetyEnvelope(classification);
  // Surface when a verified scope's authorization is aging: expiresAt = verifiedAt
  // + max age; stale once now passes it. Informational only — this does not block
  // validation (the auth model is unchanged), it makes re-confirmation visible.
  const verifiedAtMs =
    record.verificationStatus === "Verified"
      ? (record.verifiedAt?.getTime() ?? null)
      : null;
  const expiresAtMs =
    verifiedAtMs === null
      ? null
      : verifiedAtMs +
        scopeVerificationMaxAgeDays() * SCOPE_VERIFICATION_MS_PER_DAY;

  return {
    ...classification,
    ...safetyEnvelope,
    createdAt: record.createdAt.toISOString(),
    createdBy: record.createdBy,
    lastPostureCheckAt: record.lastPostureCheckAt?.toISOString() ?? null,
    nextPostureCheckAt: record.nextPostureCheckAt?.toISOString() ?? null,
    scopeId: record.scopeId,
    scopeType: record.scopeType,
    tenantId: record.tenantId,
    updatedAt: record.updatedAt.toISOString(),
    value: record.value,
    verificationExpiresAt:
      expiresAtMs === null ? null : new Date(expiresAtMs).toISOString(),
    verificationMethod: record.verificationMethod,
    verificationStale: expiresAtMs !== null && Date.now() > expiresAtMs,
    verificationStatus: record.verificationStatus,
    verificationToken: record.verificationToken,
    verifiedAt: record.verifiedAt?.toISOString() ?? null,
    verifiedBy: record.verifiedBy
  };
}

export function serializeControlSource(record: {
  controlSourceId: string;
  controlType: ControlSource["controlType"];
  createdAt: Date;
  expectedBehaviors: string[];
  healthStatus: ControlSource["healthStatus"];
  integrationId: string;
  lastValidatedAt: Date | null;
  provider: string;
  telemetryStatus: ControlSource["telemetryStatus"];
  tenantId: string;
  updatedAt: Date;
}): ControlSource {
  return {
    controlSourceId: record.controlSourceId,
    controlType: record.controlType,
    createdAt: record.createdAt.toISOString(),
    expectedBehaviors: ExpectedControlBehaviorSchema.array()
      .min(1)
      .parse(record.expectedBehaviors),
    healthStatus: record.healthStatus,
    integrationId: record.integrationId,
    lastValidatedAt: record.lastValidatedAt?.toISOString() ?? null,
    provider: record.provider,
    telemetryStatus: record.telemetryStatus,
    tenantId: record.tenantId,
    updatedAt: record.updatedAt.toISOString()
  };
}

export function serializeAIApplication(record: {
  aiAppId: string;
  appType: AIApplication["appType"];
  authMethod: string;
  createdAt: Date;
  dataSourcesDescription: string;
  endpointUrl: string;
  guardrailsDescription: string;
  lastValidatedAt: Date | null;
  latestValidationRun?: {
    completedAt: Date | null;
    moduleId: string;
    outcome: string | null;
    runId: string;
    status: NonNullable<AIApplication["latestValidation"]>["status"];
    validationState: NonNullable<
      AIApplication["latestValidation"]
    >["validationState"];
  } | null;
  name: string;
  owner: string;
  ragEnabled: boolean;
  scopeId: string;
  tenantId: string;
  testAccountNotes?: string | null;
  toolsEnabled: boolean;
  updatedAt: Date;
  validationKillSwitchActivatedAt: Date | null;
  validationKillSwitchActivatedBy: string | null;
  validationKillSwitchEnabled: boolean;
  validationKillSwitchReason: string | null;
}): AIApplication {
  return {
    aiAppId: record.aiAppId,
    appType: record.appType,
    authMethod: record.authMethod,
    createdAt: record.createdAt.toISOString(),
    dataSourcesDescription: record.dataSourcesDescription,
    endpointUrl: record.endpointUrl,
    guardrailsDescription: record.guardrailsDescription,
    lastValidatedAt: record.lastValidatedAt?.toISOString() ?? null,
    latestValidation: record.latestValidationRun
      ? {
          completedAt:
            record.latestValidationRun.completedAt?.toISOString() ?? null,
          moduleId: record.latestValidationRun.moduleId,
          outcome: record.latestValidationRun.outcome,
          runId: record.latestValidationRun.runId,
          status: record.latestValidationRun.status,
          validationState: record.latestValidationRun.validationState
        }
      : null,
    name: record.name,
    owner: record.owner,
    ragEnabled: record.ragEnabled,
    scopeId: record.scopeId,
    tenantId: record.tenantId,
    testAccountNotes: record.testAccountNotes ?? null,
    toolsEnabled: record.toolsEnabled,
    updatedAt: record.updatedAt.toISOString(),
    validationKillSwitch: {
      activatedAt:
        record.validationKillSwitchActivatedAt?.toISOString() ?? null,
      activatedBy: record.validationKillSwitchActivatedBy,
      enabled: record.validationKillSwitchEnabled,
      reason: record.validationKillSwitchReason
    }
  };
}

export function serializePolicyDecision(record: {
  approvalState: PolicyDecision["approvalState"];
  approvedAt: Date | null;
  approvedBy: string | null;
  createdAt: Date;
  executionEnvironment: PolicyDecision["executionEnvironment"];
  expiresAt: Date | null;
  missionType: PolicyDecision["missionType"];
  outcome: PolicyDecision["outcome"];
  policyDecisionId: string;
  rationale: string;
  requestedAction: Prisma.JsonValue;
  safetyLevel: PolicyDecision["safetyLevel"];
  scopeId: string;
  target: Prisma.JsonValue;
  tenantId: string;
  updatedAt: Date;
  userId: string | null;
}): PolicyDecision {
  return {
    approvalState: record.approvalState,
    approvedAt: record.approvedAt?.toISOString() ?? null,
    approvedBy: record.approvedBy,
    createdAt: record.createdAt.toISOString(),
    executionEnvironment: record.executionEnvironment,
    expiresAt: record.expiresAt?.toISOString() ?? null,
    missionType: record.missionType,
    outcome: record.outcome,
    policyDecisionId: record.policyDecisionId,
    rationale: record.rationale,
    requestedAction: record.requestedAction as PolicyRequestedAction,
    safetyLevel: record.safetyLevel,
    scopeId: record.scopeId,
    target:
      typeof record.target === "object" && record.target
        ? (record.target as Record<string, unknown>)
        : {},
    tenantId: record.tenantId,
    updatedAt: record.updatedAt.toISOString(),
    userId: record.userId
  };
}

export function serializeValidationMission(record: {
  completedAt: Date | null;
  createdAt: Date;
  evidenceIds: string[];
  missionId: string;
  missionType: ValidationMission["missionType"];
  policyDecisionId: string | null;
  policyProfile: string | null;
  requestedBy: string;
  safetyLevel: ValidationMission["safetyLevel"];
  scopeId: string;
  scopeIds: string[];
  startedAt: Date | null;
  status: ValidationMission["status"];
  tenantId: string;
  updatedAt: Date;
}): ValidationMission {
  return {
    completedAt: record.completedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    evidenceIds: record.evidenceIds,
    missionId: record.missionId,
    missionType: record.missionType,
    policyDecisionId: record.policyDecisionId,
    policyProfile: record.policyProfile,
    requestedBy: record.requestedBy,
    safetyLevel: record.safetyLevel,
    scopeId: record.scopeId,
    scopeIds: record.scopeIds,
    startedAt: record.startedAt?.toISOString() ?? null,
    status: record.status,
    tenantId: record.tenantId,
    updatedAt: record.updatedAt.toISOString()
  };
}

export function serializeValidationRun(record: {
  completedAt: Date | null;
  createdAt: Date;
  errorSummary: string | null;
  evidenceIds: string[];
  missionId: string;
  moduleId: string;
  outcome: string | null;
  policyDecisionId: string | null;
  runId: string;
  runnerId: string | null;
  safetyLevel: ValidationRun["safetyLevel"];
  scopeId: string;
  startedAt: Date | null;
  status: ValidationRun["status"];
  target: Prisma.JsonValue;
  tenantId: string;
  techniqueIds: string[];
  updatedAt: Date;
  validationState: ValidationRun["validationState"] | null;
}): ValidationRun {
  return {
    completedAt: record.completedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    errorSummary: record.errorSummary,
    evidenceIds: record.evidenceIds,
    missionId: record.missionId,
    moduleId: record.moduleId,
    outcome: record.outcome,
    policyDecisionId: record.policyDecisionId,
    runId: record.runId,
    runnerId: record.runnerId,
    safetyLevel: record.safetyLevel,
    scopeId: record.scopeId,
    startedAt: record.startedAt?.toISOString() ?? null,
    status: record.status,
    target:
      typeof record.target === "object" && record.target
        ? (record.target as Record<string, unknown>)
        : {},
    tenantId: record.tenantId,
    techniqueIds: record.techniqueIds,
    updatedAt: record.updatedAt.toISOString(),
    validationState: record.validationState ?? null
  };
}

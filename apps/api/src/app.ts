import { randomUUID } from "node:crypto";

import Fastify, { type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import {
  enterTenantRlsContext,
  getPrismaClient,
  resetTenantRlsContext,
  runWithoutTenantRls
} from "@periscan/db";
import { getAvailableEvidenceDataRegions } from "@periscan/evidence";
import {
  CreateOperatorRecommendationRecordInputSchema,
  EvidenceSummaryUseCaseSchema
} from "@periscan/operators";
import { z } from "zod";

import {
  AIAppValidationCategorySchema,
  AIAppValidationOutcomeSchema,
  AIApplicationTypeSchema,
  AgentBehaviorAnalysisSchema,
  AgentWorkflowQualityEvaluationSchema,
  AgentWorkflowVariableAnalysisSchema,
  AssetLineageSchema,
  AssetOwnershipReviewSchema,
  AssetOwnershipSurfaceSchema,
  AsyncOperationsPolicyInputSchema,
  AsyncOperationsReasonInputSchema,
  AsyncOperationsReconcileResultSchema,
  AsyncOperationsWorkspaceSchema,
  AsyncRecoveryDecisionInputSchema,
  AsyncRecoveryDecisionResultSchema,
  DataFabricQualitySurfaceSchema,
  ImportScanFileInputSchema,
  ScanImportResultSchema,
  ReviewAssetOwnershipCandidateInputSchema,
  AssetValuationVersionSchema,
  BusinessImpactPreviewSchema,
  BusinessImpactWorkspaceSchema,
  ReviewAssetValuationVersionInputSchema,
  SubmitAssetValuationVersionInputSchema,
  ClaimAwsMarketplaceRegistrationInputSchema,
  ApiErrorSchema,
  AuditEventActionSchema,
  ControlValidationOutcomeSchema,
  BatchComplianceGovernanceInputSchema,
  ComplianceFrameworkKeySchema,
  MultiFrameworkComplianceExportInputSchema,
  UpdateComplianceControlGovernanceInputSchema,
  CreateValidationStimulusInputSchema,
  DetectionMarkerProofInputSchema,
  DnsExfilCanaryProofInputSchema,
  ControlSourceTypeSchema,
  ExpectedControlBehaviorSchema,
  DataResidencyOptionsSchema,
  EngagementRunRequestSchema,
  InitializeEngagementWorkspaceInputSchema,
  UpsertEngagementCollaboratorInputSchema,
  CreateEngagementCollaborationEventInputSchema,
  CompileScenarioInputSchema,
  CompileHybridExecutionInputSchema,
  AssemblePassiveMultiAgentPlanInputSchema,
  ConvertMissionDraftToHybridCompileInputSchema,
  CreateConversationalMissionDraftInputSchema,
  ExecuteScenarioInputSchema,
  StopScenarioFeedbackInputSchema,
  CreateTenantApiKeyInputSchema,
  CreateTenantWebhookInputSchema,
  CreateScopeInputSchema as SharedCreateScopeInputSchema,
  UpdateTenantWebhookInputSchema,
  ActivateKillSwitchInputSchema,
  AppendAgentWorkflowEventInputSchema,
  CreateAgentExchangeObjectInputSchema,
  CreateAgentDidTrustProfileInputSchema,
  CreateConfidentialAttestationChallengeInputSchema,
  CreateTeeAssuranceRequirementInputSchema,
  EvaluateTeeAssuranceInputSchema,
  RevokeTeeAssuranceInputSchema,
  CreateVeraisonAttestationSessionInputSchema,
  CreateAgentWorkflowCheckpointInputSchema,
  CreateAgentWorkflowDefinitionInputSchema,
  CreateAgentWorkflowRunInputSchema,
  CreateExtensionProjectInputSchema,
  CreateSubscriptionLifecycleInputSchema,
  ExtensionLifecycleReasonInputSchema,
  ExtensionExecutionContractSchema,
  CreateContextBundleInputSchema,
  CreateModelPolicyProfileInputSchema,
  CreateModelProviderInputSchema,
  CreateModelSessionInputSchema,
  CreateModelSessionTurnInputSchema,
  CreateModelToolRequestInputSchema,
  DecideModelToolInterventionInputSchema,
  InspectModelToolInterventionInputSchema,
  IssueModelToolInterventionInputSchema,
  ReplayAgentWorkflowInputSchema,
  ReviewExtensionReleaseInputSchema,
  RecordSubscriptionRenewalInputSchema,
  ResolveSubscriptionGraceInputSchema,
  RollbackExtensionProjectInputSchema,
  RunA2ATckInputSchema,
  RegisterAgentProtocolEndpointInputSchema,
  RefreshAgentDidTrustProfileInputSchema,
  RevokeAgentDidTrustProfileInputSchema,
  ReviewAgentProtocolEndpointInputSchema,
  UpdateAgentExchangeObjectStateInputSchema,
  SubmitExtensionReleaseInputSchema,
  ScheduleSubscriptionCancellationInputSchema,
  StartSubscriptionGraceInputSchema,
  SubscriptionReasonInputSchema,
  VerifyAgentSignedReceiptInputSchema,
  VerifyAgentVerifiableCredentialInputSchema,
  VerifyConfidentialAttestationInputSchema,
  VerifyVeraisonAttestationInputSchema,
  UpdateModelPolicyProfileInputSchema,
  UpdateModelProviderInputSchema,
  UpdateModelToolInputSchema,
  UpdateModelGatewayFinOpsInputSchema,
  EvidencePackTypeSchema,
  HEALTH_ROUTE,
  HealthResponseSchema,
  JobStatusSchema,
  MetricsResponseSchema,
  ImportThreatAdvisoryInputSchema,
  ThreatFeedIngestionInputSchema,
  AcceptToolLicenseRequestSchema,
  ListToolLicenseAcceptancesQuerySchema,
  ThirdPartyToolDisableRequestSchema,
  ThirdPartyToolEnableRequestSchema,
  ThirdPartyToolInstallRequestSchema,
  ThirdPartyToolCandidateImportRequestSchema,
  ThirdPartyToolRefreshDueRequestSchema,
  ThirdPartyToolRunnerDispatchRequestSchema,
  ApplyThirdPartyToolUpdateRequestSchema,
  DismissThirdPartyToolUpdateRequestSchema,
  ReviewThirdPartyToolCandidateRequestSchema,
  ToolIntakeManifestRequestSchema,
  MembershipRoleSchema,
  MissionTypeSchema,
  CommunityValidationSuiteResponseSchema,
  CommunityMissionRemediationsResultSchema,
  CommunityValidationCompanionSchema,
  CommunityValidationStartResultSchema,
  StartCommunityValidationRequestSchema,
  OpenSourceToolIdSchema,
  OPENAPI_ROUTE,
  PolicyDecisionOutcomeSchema,
  PolicyRequestedActionSchema,
  BlueShiftBriefSchema,
  ProductActivationStateSchema,
  ProductExperienceProfileSchema,
  ProductFeedbackSchema,
  ProductWorkQueueSchema,
  RelatedEntityTypeSchema,
  ReportExportFormatSchema,
  ReportShareGrantSchema,
  RunnerCredentialRotationRequestSchema,
  RunnerControlStateAcknowledgementSchema,
  RunnerHeartbeatSchema,
  RunnerKillSwitchRequestSchema,
  RunnerPollRequestSchema,
  RunnerCheckTaskRequestSchema,
  RunnerDiscoverTaskRequestSchema,
  RunnerMeasuredTaskRequestSchema,
  RunnerReachabilityTaskRequestSchema,
  RunnerRegistrationRequestSchema,
  RunnerRegistrationTokenIssueRequestSchema,
  RunnerTaskAcceptRequestSchema,
  RunnerTaskArtifactUploadRequestSchema,
  RunnerTaskRejectRequestSchema,
  RunnerTaskResultSchema,
  RunnerTransportDecisionSchema,
  UpdateRunnerFleetPolicyInputSchema,
  CreateControlGapRemediationInputSchema,
  CreateRemediationInputSchema,
  CreateRemediationTicketInputSchema,
  DispositionFeedbackSummarySchema,
  SyncRemediationTicketInputSchema,
  RegisterNonHumanIdentityInputSchema,
  PreviewRemediationActionInputSchema,
  ConfirmRemediationActionInputSchema,
  PreviewInfrastructureChangeInputSchema,
  ConfirmInfrastructureChangeInputSchema,
  CreateMissionScheduleInputSchema,
  UpdateMissionScheduleInputSchema,
  ScheduleFrequencySchema,
  UpdateScopeClassificationInputSchema,
  SafetyLevelSchema,
  ValidatedFindingFilterSchema,
  TransitionFindingInputSchema,
  SetDestructiveValidationInputSchema,
  SetOffensiveValidationInputSchema,
  SetTenantRequireMfaInputSchema,
  SubmitProductFeedbackInputSchema,
  VerifyAttackPathInputSchema,
  ApplyPathEdgeReceiptInputSchema,
  LaunchPathEdgeValidationInputSchema,
  ThreatCatalogQuerySchema,
  SetThreatAlertStatusInputSchema,
  TenantThreatAlertStatusSchema,
  CompleteTenantSsoLoginInputSchema,
  StartTenantSsoLoginInputSchema,
  StartTenantTrialInputSchema,
  ConvertTenantTrialInputSchema,
  CancelTenantTrialInputSchema,
  TenantSsoAuthorizationUrlInputSchema,
  UpdateTenantSsoConfigInputSchema,
  UpdateProductExperienceProfileInputSchema,
  PreviewTenantLocalizationInputSchema,
  UpdateTenantLocalizationInputSchema,
  AppendDesignPartnerSessionNoteInputSchema,
  listAIAppValidationSuites,
  listDefaultRunnerTransportDecisions,
  listControlValidationScenarios,
  type HealthResponse,
  type MetricsResponse
} from "@periscan/shared";
import { evaluateExtensionCompatibility } from "@periscan/modules";
import { SARIF_CONTENT_TYPE } from "@periscan/reports";

import {
  AppServiceError,
  createRuntimeServices,
  normalizeCorsOriginsForDeployment,
  writeAuditEvent,
  type AppServices,
  type AuthenticatedContext
} from "./runtime-services.js";
import { toSarif } from "./services/findings.js";
import {
  isMfaRequiredForPasswordAuth,
  isMfaSetupAllowedPath,
  isPasswordSessionMfaSetupRestricted,
  isRequireMfaEnabled
} from "./mfa-policy.js";
import { augmentOpenApiDocument } from "./openapi-payloads.js";
import { handleMcpMessage, type JsonRpcMessage } from "./mcp/protocol.js";
import { runDueThreatFeedPolls } from "./threat-feeds/poller.js";
import { buildEnterpriseBreadthReadiness } from "./services/enterprise-readiness.js";
import {
  getLastValidationSweep,
  runSystemValidationSweep
} from "./system-scheduler.js";
import {
  createMemoryIdempotencyStore,
  createPrismaIdempotencyStore,
  IDEMPOTENT_ROUTES,
  readIdempotencyKeyFromRequest,
  withIdempotencyKey,
  type IdempotencyStore
} from "./idempotency.js";
import {
  assertCsrfProductionConfig,
  createCsrfToken,
  createSessionToken,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  hashRateLimitApiKey,
  isCsrfEnforced,
  resolveSessionJwtKeyring,
  SESSION_COOKIE_NAME,
  verifyCsrfDoubleSubmit,
  verifySessionToken,
  type JwtSigningMaterial
} from "./security.js";

// Distributed request tracing: every request carries a `traceId` used to
// correlate structured log lines end to end (and echoed back to the caller).
// Populated by the onRequest hook in buildApp; declared here so handlers and
// hooks can read `request.traceId` in a type-safe way.
declare module "fastify" {
  interface FastifyRequest {
    traceId: string;
  }
}

const healthResponseJsonSchema = {
  type: "object",
  required: ["service", "status", "timestamp"],
  properties: {
    service: {
      const: "api",
      type: "string"
    },
    status: {
      const: "ok",
      type: "string"
    },
    timestamp: {
      format: "date-time",
      type: "string"
    }
  }
} as const;

function buildMetricsPayload(): MetricsResponse {
  const mem = process.memoryUsage();

  return MetricsResponseSchema.parse({
    lastValidationSweep: getLastValidationSweep(),
    memory: {
      heapTotal: mem.heapTotal,
      heapUsed: mem.heapUsed,
      rss: mem.rss
    },
    node: process.version,
    pid: process.pid,
    service: "api",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime())
  });
}

function escapePrometheusLabelValue(value: string) {
  return value
    .replace(/\\/gu, "\\\\")
    .replace(/\n/gu, "\\n")
    .replace(/"/gu, '\\"');
}

function renderPrometheusMetrics(metrics: MetricsResponse) {
  const nodeVersion = escapePrometheusLabelValue(metrics.node);
  const timestampMs = Date.parse(metrics.timestamp);

  const lines = [
    "# HELP periscan_api_uptime_seconds Process uptime for the Periscan API.",
    "# TYPE periscan_api_uptime_seconds gauge",
    `periscan_api_uptime_seconds ${metrics.uptimeSeconds}`,
    "# HELP periscan_api_process_memory_bytes Process memory usage for the Periscan API.",
    "# TYPE periscan_api_process_memory_bytes gauge",
    `periscan_api_process_memory_bytes{area="rss"} ${metrics.memory.rss}`,
    `periscan_api_process_memory_bytes{area="heap_total"} ${metrics.memory.heapTotal}`,
    `periscan_api_process_memory_bytes{area="heap_used"} ${metrics.memory.heapUsed}`,
    "# HELP periscan_api_process_info Static process info for the Periscan API.",
    "# TYPE periscan_api_process_info gauge",
    `periscan_api_process_info{service="${metrics.service}",node_version="${nodeVersion}",pid="${metrics.pid}"} 1`,
    "# HELP periscan_api_metrics_generated_timestamp_seconds Unix timestamp when API metrics were generated.",
    "# TYPE periscan_api_metrics_generated_timestamp_seconds gauge",
    `periscan_api_metrics_generated_timestamp_seconds ${Number.isFinite(timestampMs) ? Math.floor(timestampMs / 1000) : 0}`
  ];

  const sweep = metrics.lastValidationSweep;
  if (sweep) {
    lines.push(
      "# HELP periscan_validation_sweep Outcome counts from the most recent continuous-validation sweep.",
      "# TYPE periscan_validation_sweep gauge",
      `periscan_validation_sweep{outcome="tenants_swept"} ${sweep.tenantsSwept}`,
      `periscan_validation_sweep{outcome="integrations_synced"} ${sweep.integrationsSynced}`,
      `periscan_validation_sweep{outcome="posture_checks_run"} ${sweep.postureChecksRun}`,
      `periscan_validation_sweep{outcome="reverified"} ${sweep.reverified}`,
      `periscan_validation_sweep{outcome="schedules_run"} ${sweep.schedulesRun}`,
      `periscan_validation_sweep{outcome="threat_feeds_ingested"} ${sweep.threatFeedsIngested}`,
      `periscan_validation_sweep{outcome="failures"} ${sweep.failures}`,
      "# HELP periscan_validation_sweep_failures Most-recent sweep failures broken down by due-runner.",
      "# TYPE periscan_validation_sweep_failures gauge",
      `periscan_validation_sweep_failures{runner="context"} ${sweep.failuresByRunner.context}`,
      `periscan_validation_sweep_failures{runner="integration_sync"} ${sweep.failuresByRunner.integrationSync}`,
      `periscan_validation_sweep_failures{runner="posture"} ${sweep.failuresByRunner.posture}`,
      `periscan_validation_sweep_failures{runner="reverification"} ${sweep.failuresByRunner.reverification}`,
      `periscan_validation_sweep_failures{runner="schedules"} ${sweep.failuresByRunner.schedules}`,
      `periscan_validation_sweep_failures{runner="threat_feed"} ${sweep.failuresByRunner.threatFeed}`
    );
  }

  return `${lines.join("\n")}\n`;
}

export const SignupInputSchema = z.object({
  dataRegion: z.string().min(1).optional(),
  email: z.email(),
  name: z.string().min(1),
  password: z.string().min(12),
  tenantName: z.string().min(1),
  tenantType: z.enum(["Organization", "MSSP"]).optional()
});

export const LoginInputSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  // Required only when the account has activated MFA; enforced server-side.
  // Either a TOTP code or a single-use recovery code satisfies the second factor.
  totpCode: z.string().min(1).optional(),
  recoveryCode: z.string().min(1).optional()
});

export const PasswordResetRequestSchema = z.object({
  email: z.email()
});

export const PasswordResetConfirmSchema = z.object({
  password: z.string().min(12),
  token: z.string().min(1)
});

export const ChangePasswordInputSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12),
  totpCode: z.string().min(1).optional()
});

export const AcceptInviteSchema = z.object({
  password: z.string().min(12),
  token: z.string().min(1)
});

export const VerifyEmailSchema = z.object({
  token: z.string().min(1)
});

export const MfaVerifyInputSchema = z.object({
  code: z.string().min(1)
});

export const MfaReauthenticationInputSchema = z.object({
  password: z.string().min(1).optional(),
  totpCode: z.string().min(1).optional()
});

export const InviteInputSchema = z.object({
  email: z.email(),
  name: z.string().min(1),
  role: MembershipRoleSchema
});

export const UpdateTenantMemberRoleInputSchema = z.object({
  role: MembershipRoleSchema
});

export const CreateClientTenantInputSchema = z.object({
  billingAccountId: z.string().min(1).nullable().optional(),
  clientAdminEmail: z.email().nullable().optional(),
  clientAdminName: z.string().min(1).nullable().optional(),
  dataRegion: z.string().min(1).nullable().optional(),
  name: z.string().min(1)
});

export const UpdateTenantBrandingInputSchema = z.object({
  logoUrl: z.url().nullable().optional(),
  organizationName: z.string().min(1).nullable().optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  reportFooter: z.string().min(1).nullable().optional(),
  supportEmail: z.email().nullable().optional(),
  whiteLabelEnabled: z.boolean()
});

export const UpdateDesignPartnerSettingsInputSchema = z.object({
  enabled: z.boolean()
});

export { AppendDesignPartnerSessionNoteInputSchema };

export const UpdateSignalTriggerRoutingSettingsInputSchema = z.object({
  defaultOwnerRole: MembershipRoleSchema.optional(),
  enabled: z.boolean().optional(),
  notificationIntegrationIds: z.array(z.string().uuid()).optional(),
  workflowDestinationIntegrationIds: z.array(z.string().uuid()).optional()
});

export const UpdateReportAnalystNoteInputSchema = z.object({
  authorLabel: z.string().min(1).optional(),
  body: z.string().min(1),
  title: z.string().min(1).nullable().optional()
});

const AuditEventQuerySchema = z.object({
  action: AuditEventActionSchema.optional(),
  actorType: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  entityId: z.string().uuid().optional(),
  entityType: RelatedEntityTypeSchema.optional(),
  from: z.string().datetime().optional(),
  offset: z.coerce.number().int().nonnegative().max(1_000_000).default(0),
  search: z.string().trim().min(1).max(200).optional(),
  to: z.string().datetime().optional(),
  userId: z.string().uuid().optional()
});

const PolicyDecisionQuerySchema = z.object({
  missionType: MissionTypeSchema.optional(),
  outcome: PolicyDecisionOutcomeSchema.optional(),
  scopeId: z.string().uuid().optional()
});

const JobsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).optional(),
  missionId: z.string().uuid().optional(),
  status: JobStatusSchema.optional()
});

const MissionListQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(200).optional()
});

/** Long-poll wait for a mission run; server caps at 60s. */
const MissionRunWaitQuerySchema = z.object({
  timeoutMs: z.coerce.number().int().nonnegative().max(60_000).default(30_000)
});

const WebhookDeliveryQuerySchema = z.object({
  webhookId: z.string().uuid().optional()
});

export const AuditExportInputSchema = z.object({
  action: AuditEventActionSchema.optional(),
  actorType: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  format: z.enum(["json", "csv"]).default("json"),
  from: z.string().datetime().optional(),
  search: z.string().trim().min(1).max(200).optional(),
  to: z.string().datetime().optional()
});

export const CreateScopeInputSchema = SharedCreateScopeInputSchema;

export const CreateIntegrationInputSchema = z.object({
  authType: z.string().min(1).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  connectorKey: z.string().min(1),
  mockMode: z.boolean().optional()
});

export const GitHubConnectInputSchema = CreateIntegrationInputSchema.omit({
  connectorKey: true
});
export const AwsConnectInputSchema = CreateIntegrationInputSchema.omit({
  connectorKey: true
});
export const JiraConnectInputSchema = CreateIntegrationInputSchema.omit({
  connectorKey: true
});

export const VerifyScopeInputSchema = z.object({
  devModeManual: z.boolean().default(false),
  operatorAttestation: z.boolean().default(false)
});

export const LightExternalScanInputSchema = z.object({
  domain: z.string().min(1),
  consent: z.literal(true)
});

const SimulateRemediationInputSchema = z.object({
  currentRiskScore: z.number().optional(),
  fix: z.string().min(1).optional(),
  proposedFix: z.string().min(1).optional()
});

const BooleanQueryParamSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  if (value.toLowerCase() === "true") {
    return true;
  }

  if (value.toLowerCase() === "false") {
    return false;
  }

  return value;
}, z.boolean());

const OpenSourceCatalogFilterSchema = z.object({
  includeDeferred: BooleanQueryParamSchema.default(false),
  includeLegalReview: BooleanQueryParamSchema.default(false),
  phase: z
    .enum(["all", "Current", "CurrentMvp", "NearTerm", "LaterPhase"])
    .default("Current")
});

export const CreateMissionInputSchema = z.object({
  missionType: MissionTypeSchema,
  policyDecisionId: z.string().uuid().optional(),
  policyProfile: z.string().min(1).optional(),
  safetyLevel: SafetyLevelSchema,
  scopeId: z.string().uuid(),
  scopeIds: z.array(z.string().uuid()).min(1).optional()
});

export const StartMissionInputSchema = z.object({
  moduleIds: z.array(z.string().min(1)).min(1),
  runnerId: z.string().min(1).optional(),
  target: z.record(z.string(), z.unknown()).optional()
});

// Remediation input schemas are imported from @periscan/shared.
const VerifyRemediationInputSchema = z.object({});

export const CreateSnapshotInputSchema = z
  .object({
    audience: z.string().min(1).optional(),
    maxTopItems: z.number().int().min(3).max(5).optional(),
    policyDecisionId: z.string().uuid().optional(),
    scopeId: z.string().uuid().optional()
  })
  .refine(
    (input) => Boolean(input.policyDecisionId) === Boolean(input.scopeId),
    {
      message: "scopeId and policyDecisionId must be provided together."
    }
  );

export const ThreatFeedScheduleInputSchema = z.object({
  frequency: ScheduleFrequencySchema.nullable().optional()
});

export const CreateAIApplicationInputSchema = z.object({
  appType: AIApplicationTypeSchema,
  authMethod: z.string().min(1),
  dataSourcesDescription: z.string().min(1),
  endpointUrl: z.url(),
  guardrailsDescription: z.string().min(1),
  name: z.string().min(1),
  owner: z.string().min(1),
  ragEnabled: z.boolean(),
  scopeId: z.string().uuid(),
  testAccountNotes: z.string().min(1).max(2_000).optional(),
  toolsEnabled: z.boolean()
});

export const ValidateAIApplicationInputSchema = z
  .object({
    corpusVersion: z.string().min(1).max(100).default("periscan-benign-v1"),
    executionMode: z
      .enum(["LiveSafe", "LiveSuite", "Fixture"])
      .default("LiveSafe"),
    fixtureOutcome: AIAppValidationOutcomeSchema.optional(),
    harness: z.enum(["periscan", "promptfoo", "pyrit", "garak"]).optional(),
    maxRequests: z.number().int().min(1).max(10).default(4),
    maxResponseBytes: z.number().int().min(256).max(16_384).default(4_096),
    safeTestCases: z
      .array(
        z.object({
          category: AIAppValidationCategorySchema,
          input: z.string().min(1).max(2_000),
          testCaseId: z.string().min(1)
        })
      )
      .max(10)
      .optional(),
    timeoutSeconds: z.number().int().min(1).max(30).optional(),
    validationCategory: AIAppValidationCategorySchema.optional()
  })
  .superRefine((input, context) => {
    if (input.fixtureOutcome && input.executionMode !== "Fixture") {
      context.addIssue({
        code: "custom",
        message: "fixtureOutcome requires executionMode Fixture.",
        path: ["fixtureOutcome"]
      });
    }
    if (
      input.executionMode === "LiveSuite" &&
      input.harness &&
      input.harness !== "periscan"
    ) {
      context.addIssue({
        code: "custom",
        message:
          "LiveSuite currently uses the Periscan bounded harness. Promptfoo, PyRIT, and Garak remain report-import adapters until their isolated workers are configured.",
        path: ["harness"]
      });
    }
  });

export const SetAIValidationKillSwitchInputSchema = z.object({
  enabled: z.boolean(),
  reason: z.string().trim().min(3).max(500)
});

export const CreateControlSourceInputSchema = z.object({
  controlType: ControlSourceTypeSchema,
  expectedBehaviors: z.array(ExpectedControlBehaviorSchema).min(1),
  integrationId: z.string().uuid(),
  provider: z.string().min(1)
});

export const UpdateControlSourceInputSchema = z.object({
  expectedBehaviors: z.array(ExpectedControlBehaviorSchema).min(1)
});

export const ValidateControlSourceInputSchema = z.object({
  dryRun: z.boolean().optional(),
  executionMode: z.enum(["DryRun", "LiveRunner"]).default("DryRun"),
  fixtureOutcome: ControlValidationOutcomeSchema.optional(),
  runnerId: z.string().uuid().optional(),
  techniqueId: z.string().min(1).optional()
});

/** Wave B: re-export shared benign-marker emit→observe DRV proof input. */
export { DetectionMarkerProofInputSchema };
/** Phase C: re-export DNS-exfil detection canary proof input. */
export { DnsExfilCanaryProofInputSchema };

export const CreateReportInputSchema = z.object({
  audience: z.string().min(1).optional(),
  maxTopItems: z.number().int().min(3).max(5).optional(),
  packType: EvidencePackTypeSchema.optional(),
  snapshotId: z.string().uuid().optional(),
  title: z.string().min(1).optional()
});
const RunnerTransportDecisionResponseSchema = z.object({
  items: z.array(RunnerTransportDecisionSchema)
});
export const ExportReportInputSchema = z.object({
  format: ReportExportFormatSchema.default("html")
});
export const GenerateEvidenceSummaryInputSchema = z.object({
  evidenceIds: z.array(z.string().uuid()).default([]),
  useCase: EvidenceSummaryUseCaseSchema
});

export const ScopePostureCheckInputSchema = z.object({
  executionMode: z.enum(["LiveSafe", "Fixture"]).optional(),
  fixtures: z.record(z.string(), z.record(z.string(), z.unknown())).optional()
});

export const PolicyPreviewInputSchema = z.object({
  executionEnvironment: z.enum([
    "ControlPlane",
    "ExternalPoA",
    "InternalRunner"
  ]),
  explicitMissionApproval: z.boolean().optional(),
  adminApproval: z.boolean().optional(),
  missionType: MissionTypeSchema,
  requestedAction: PolicyRequestedActionSchema,
  safetyLevel: SafetyLevelSchema,
  target: z.record(z.string(), z.unknown()),
  timeWindowApproved: z.boolean().optional()
});

const COOKIE_OPTIONS = {
  httpOnly: true,
  path: "/",
  sameSite: "lax" as const,
  secure: false
};

/** Mutating methods that may require double-submit CSRF for cookie sessions. */
const MUTATING_HTTP_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Auth bootstrap / public mutation paths that establish or tear down a session
 * before a CSRF cookie can exist, or that are intentionally CSRF-exempt.
 */
const CSRF_EXEMPT_PATHS = new Set<string>([
  "/api/v1/auth/signup",
  "/api/v1/auth/login",
  "/api/v1/auth/logout",
  "/api/v1/auth/password-reset/request",
  "/api/v1/auth/password-reset/confirm",
  "/api/v1/auth/accept-invite",
  "/api/v1/auth/sso/start",
  "/api/v1/auth/sso/callback"
]);

const DOCUMENTED_HTTP_METHODS = [
  "get",
  "post",
  "put",
  "patch",
  "delete"
] as const;

type DocumentedHttpMethod = (typeof DOCUMENTED_HTTP_METHODS)[number];

type OpenApiOperation = {
  operationId?: string;
  parameters?: Array<{
    in?: string;
    name?: string;
  }>;
  requestBody?: {
    content?: Record<string, { schema?: unknown }>;
  };
  responses?: Record<
    string,
    { content?: Record<string, { schema?: unknown }> }
  >;
  summary?: string;
  tags?: string[];
};

type OpenApiDocumentForReference = {
  info?: {
    title?: string;
    version?: string;
  };
  paths?: Record<
    string,
    Partial<Record<DocumentedHttpMethod, OpenApiOperation>>
  >;
};

type JsonSchemaForReference = {
  anyOf?: unknown[];
  const?: unknown;
  enum?: unknown[];
  example?: unknown;
  examples?: unknown[];
  format?: string;
  items?: unknown;
  oneOf?: unknown[];
  properties?: Record<string, unknown>;
  required?: string[];
  type?: string | string[];
};

function getRequestedTenantId(request: FastifyRequest) {
  const header = request.headers["x-periscan-tenant-id"];

  if (Array.isArray(header)) {
    return header[0];
  }

  return header;
}

function getRunnerAuthToken(request: FastifyRequest) {
  const authorization = request.headers.authorization;

  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  const header = request.headers["x-periscan-runner-token"];

  if (Array.isArray(header)) {
    return header[0] ?? null;
  }

  return header ?? null;
}

function getRunnerClientCertificateSha256(request: FastifyRequest) {
  const header =
    request.headers["x-periscan-runner-client-cert-sha256"] ??
    request.headers["x-forwarded-client-cert-sha256"];

  if (Array.isArray(header)) {
    return header[0] ?? null;
  }

  return header ?? null;
}

function parseLimit(value: unknown, max = 100) {
  const parsed = Number(value ?? 50);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 50;
  }

  return Math.min(Math.trunc(parsed), max);
}

function parseRateLimitMax(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

const RATE_LIMIT_ALLOWLIST = new Set<string>([
  HEALTH_ROUTE,
  "/health",
  "/api/v1/health/ready",
  "/api/v1/metrics",
  "/api/v1/metrics/prometheus",
  OPENAPI_ROUTE,
  "/api/v1/api-reference"
]);

function getApiKeyToken(request: FastifyRequest) {
  const authorization = request.headers.authorization;

  if (authorization?.startsWith("Bearer ")) {
    const value = authorization.slice("Bearer ".length).trim();

    return value.startsWith("psk_") ? value : null;
  }

  return null;
}

async function getAuthContext(
  request: FastifyRequest,
  services: AppServices,
  sessionMaterial: JwtSigningMaterial
) {
  const apiKeyToken = getApiKeyToken(request);

  if (apiKeyToken) {
    // API keys are bound to a single tenant; the tenant header is ignored.
    return services.authenticateApiKey(apiKeyToken);
  }

  const token = request.cookies[SESSION_COOKIE_NAME];

  if (!token) {
    return null;
  }

  try {
    const session = await verifySessionToken(token, sessionMaterial);
    return services.getSessionContext(session, getRequestedTenantId(request));
  } catch {
    // Malformed/expired/invalid session cookie: treat as unauthenticated.
    // This prevents 500s on protected routes and allows logout to clear the bad cookie.
    return null;
  }
}

async function requireAuthContext(
  request: FastifyRequest,
  services: AppServices,
  sessionMaterial: JwtSigningMaterial
) {
  const context = await getAuthContext(request, services, sessionMaterial);

  if (!context) {
    throw new AppServiceError("Authentication required.", 401, "unauthorized");
  }

  // Force-MFA gate: password sessions without enrolled MFA may only use the
  // MFA setup path when env PERISCAN_REQUIRE_MFA or tenant.requireMfa is on.
  // SSO / API-key / system sessions are not restricted by this policy.
  const mfaRequired = isMfaRequiredForPasswordAuth({
    envRequireMfa: isRequireMfaEnabled(),
    tenantRequireMfa: Boolean(context.tenant.requireMfa)
  });
  if (
    isPasswordSessionMfaSetupRestricted({
      authMethod: context.session.authMethod,
      mfaEnabled: Boolean(context.user.mfaEnabledAt),
      mfaRequired
    }) &&
    !isMfaSetupAllowedPath(request.url, request.method)
  ) {
    throw new AppServiceError(
      "Multi-factor authentication enrollment is required before continuing.",
      403,
      "mfa_enrollment_required"
    );
  }

  // Bind the rest of this request to the authenticated tenant so the Postgres
  // RLS write-path backstop enforces on interactive `$transaction` mutations
  // (SET LOCAL ROLE + app.current_tenant). Standalone reads still rely on
  // explicit `where: { tenantId }` filters (see packages/db/src/client.ts);
  // handlers that need active read-path RLS use runWithTenantRls. Cross-tenant
  // handlers (e.g. MSSP portfolio) opt out with runWithoutTenantRls. Auth
  // resolution above ran unbound on purpose — it must look up the
  // session/api-key across tenants before the tenant is known.
  enterTenantRlsContext(context.tenant.tenantId);

  return context;
}

function formatAuthPayload(context: AuthenticatedContext) {
  const mfaRequired = isMfaRequiredForPasswordAuth({
    envRequireMfa: isRequireMfaEnabled(),
    tenantRequireMfa: Boolean(context.tenant.requireMfa)
  });
  const mfaEnrollmentRequired = isPasswordSessionMfaSetupRestricted({
    authMethod: context.session.authMethod,
    mfaEnabled: Boolean(context.user.mfaEnabledAt),
    mfaRequired
  });

  return {
    membership: context.membership,
    ...(mfaEnrollmentRequired ? { mfaEnrollmentRequired: true as const } : {}),
    tenant: context.tenant,
    user: context.user
  };
}

function normalizeSsoCallbackPayload(payload: unknown) {
  const record =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};

  return {
    code: record.code,
    samlResponse: record.samlResponse ?? record.SAMLResponse,
    state: record.state ?? record.RelayState
  };
}

function getApiReferenceGroup(path: string) {
  if (path.includes("/auth") || path === "/api/v1/me") {
    return "Auth";
  }

  if (path.includes("/experience")) {
    return "Experience";
  }

  if (path.includes("/model-gateway")) {
    return "Model Gateway";
  }

  if (path.includes("/agent-workflows")) {
    return "Agent Workflows";
  }

  if (path.includes("/agent-trust")) {
    return "Agent Trust";
  }

  if (path.includes("/compliance")) {
    return "Compliance";
  }

  if (path.includes("/non-human-identities")) {
    return "Identities";
  }

  if (path.includes("/packs")) {
    return "Readiness";
  }

  if (path.includes("/scenarios")) {
    return "Validation";
  }

  if (
    path.includes("/threat-advisories") ||
    path.includes("/threat-feeds") ||
    path.includes("/threat-intel")
  ) {
    return "Threat Center";
  }

  if (path.includes("/approvals")) {
    return "Approvals";
  }

  if (path.includes("/policy-decisions")) {
    return "Policy";
  }

  if (path.includes("/audit-events")) {
    return "Audit";
  }

  if (path.includes("/jobs")) {
    return "Jobs";
  }

  if (path.includes("/async-operations")) {
    return "Async Operations";
  }

  if (path.includes("/attack-techniques")) {
    return "MITRE ATT&CK";
  }

  if (path.includes("/system/deployment-status")) {
    return "Deployment";
  }

  if (path.includes("/search")) {
    return "Search";
  }

  if (path.includes("/mcp")) {
    return "MCP";
  }

  if (path.includes("/tenants")) {
    return "Tenants";
  }

  if (path.includes("/integrations")) {
    return "Integrations";
  }

  if (path.includes("/scopes")) {
    return "Scopes";
  }

  if (path.includes("/business-impact")) {
    return "Business Impact";
  }

  if (path.includes("/assets")) {
    return "Assets";
  }

  if (path.includes("/data-fabric")) {
    return "Assets";
  }

  if (
    path.includes("/missions") ||
    path.includes("/snapshots") ||
    path.includes("/light-external-scans")
  ) {
    return "Validation";
  }

  if (path.includes("/findings")) {
    return "Findings";
  }

  if (path.includes("/attack-paths")) {
    return "Attack Paths";
  }

  if (
    path.includes("/remediations") ||
    path.includes("/remediation-actions") ||
    path.includes("/infrastructure-changes")
  ) {
    return "Remediation";
  }

  if (
    path.includes("/operators") ||
    path.includes("/operator-recommendations") ||
    path.includes("/engagements") ||
    path.includes("/evidence-summaries")
  ) {
    return "Operators";
  }

  if (path.includes("/evidence")) {
    return "Evidence";
  }

  if (path.includes("/ai-apps")) {
    return "AI Apps";
  }

  if (path.includes("/control-sources")) {
    return "Controls";
  }

  if (path.includes("/runners")) {
    return "Runners";
  }

  if (path.includes("/billing")) {
    return "Billing";
  }

  if (
    path.includes("/third-party-tools") ||
    path.includes("/open-source") ||
    path.includes("/modules") ||
    path.includes("/extensions") ||
    path.includes("/external-validation")
  ) {
    return "Modules and OSS";
  }

  if (path.includes("/reports")) {
    return "Reports";
  }

  if (path.includes("/schedules") || path.includes("/ctem")) {
    return "Continuous Validation";
  }

  if (path.includes("/signal-triggers")) {
    return "Signal Triggers";
  }

  return "System";
}

function getApiReferenceAuthentication(path: string) {
  if (
    path === HEALTH_ROUTE ||
    path === "/health" ||
    path === "/api/v1/health/ready" ||
    path === OPENAPI_ROUTE ||
    path === "/api/v1/api-reference" ||
    path === "/api/v1/metrics" ||
    path === "/api/v1/metrics/prometheus" ||
    path === "/api/v1/auth/signup" ||
    path === "/api/v1/auth/data-residency-options" ||
    path === "/api/v1/auth/login" ||
    path === "/api/v1/auth/sso/start" ||
    path === "/api/v1/auth/sso/callback" ||
    path === "/api/v1/auth/password-reset/request" ||
    path === "/api/v1/auth/password-reset/confirm" ||
    path === "/api/v1/auth/accept-invite" ||
    path === "/api/v1/auth/verify-email" ||
    path === "/api/v1/billing/aws-marketplace/register" ||
    path.startsWith("/api/v1/public/")
  ) {
    return "Public";
  }

  if (
    path === "/api/v1/runners/register" ||
    path.includes("/heartbeat") ||
    path.includes("/poll") ||
    path.includes("/tasks/{taskId}/result") ||
    path.includes("/tasks/{taskId}/accept") ||
    path.includes("/tasks/{taskId}/reject") ||
    path.includes("/tasks/{taskId}/artifacts") ||
    path.endsWith("/evidence")
  ) {
    return "RunnerToken";
  }

  return "SessionCookie";
}

function fallbackOperationSummary(method: string, path: string) {
  const action =
    method === "get"
      ? "Read"
      : method === "post"
        ? "Create or execute"
        : method === "put"
          ? "Update"
          : method === "delete"
            ? "Delete"
            : "Use";
  const label = path
    .replace(/^\/api\/v1\//, "")
    .replace(/[{}]/g, "")
    .replaceAll("/", " ")
    .replaceAll("-", " ");

  return `${action} ${label || "system resource"}`;
}

function hasJsonRequestSchema(operation: OpenApiOperation) {
  return Boolean(operation.requestBody?.content?.["application/json"]?.schema);
}

function getRequestContentTypes(operation: OpenApiOperation) {
  return Object.keys(operation.requestBody?.content ?? {}).sort((left, right) =>
    left.localeCompare(right)
  );
}

function hasResponseSchema(operation: OpenApiOperation) {
  return Object.values(operation.responses ?? {}).some((response) =>
    Object.values(response.content ?? {}).some((content) =>
      Boolean(content.schema)
    )
  );
}

function getSuccessStatuses(operation: OpenApiOperation) {
  return Object.keys(operation.responses ?? {})
    .filter((status) => /^[23]\d\d$/u.test(status))
    .sort((left, right) => Number(left) - Number(right));
}

function getResponseContentTypes(operation: OpenApiOperation) {
  const contentTypes = new Set<string>();

  for (const status of getSuccessStatuses(operation)) {
    const response = operation.responses?.[status];

    for (const contentType of Object.keys(response?.content ?? {})) {
      contentTypes.add(contentType);
    }
  }

  return [...contentTypes].sort((left, right) => left.localeCompare(right));
}

function asReferenceSchema(value: unknown): JsonSchemaForReference | null {
  return value && typeof value === "object"
    ? (value as JsonSchemaForReference)
    : null;
}

function unwrapReferenceSchema(value: unknown): JsonSchemaForReference | null {
  const schema = asReferenceSchema(value);
  if (!schema) return null;

  const alternatives = schema.anyOf ?? schema.oneOf;
  if (!alternatives?.length) return schema;

  return (
    alternatives
      .map(asReferenceSchema)
      .find((alternative) => alternative?.type !== "null") ?? schema
  );
}

function referenceSchemaType(value: unknown): string {
  const schema = unwrapReferenceSchema(value);
  if (!schema) return "unknown";

  if (Array.isArray(schema.type)) return schema.type.join(" | ");
  if (schema.type === "array") {
    return `array<${referenceSchemaType(schema.items)}>`;
  }

  return schema.format
    ? `${schema.type ?? "string"}:${schema.format}`
    : (schema.type ?? "unknown");
}

function referenceSchemaFields(value: unknown) {
  const schema = unwrapReferenceSchema(value);
  const required = new Set(schema?.required ?? []);

  return Object.entries(schema?.properties ?? {}).map(([name, property]) => {
    const propertySchema = unwrapReferenceSchema(property);
    return {
      allowedValues: (propertySchema?.enum ?? []).map(String),
      name,
      required: required.has(name),
      type: referenceSchemaType(property)
    };
  });
}

function referenceStringExample(name: string, schema: JsonSchemaForReference) {
  const normalized = name.toLowerCase();
  if (/password|secret|token|api.?key/u.test(normalized))
    return "REPLACE_WITH_SECRET";
  if (schema.format === "email") return "security@example.com";
  if (schema.format === "uuid") return "00000000-0000-4000-8000-000000000000";
  if (schema.format === "date-time") return "2026-01-15T12:00:00.000Z";
  if (schema.format === "date") return "2026-01-15";
  if (schema.format === "uri" || schema.format === "url")
    return "https://example.com";
  if (/email/u.test(normalized)) return "security@example.com";
  if (/url|uri|endpoint/u.test(normalized)) return "https://example.com";
  if (/name/u.test(normalized)) return "Example";
  if (/host/u.test(normalized)) return "host.example.com";
  return "string";
}

function referenceSchemaExample(
  value: unknown,
  name = "value",
  depth = 0
): unknown {
  const schema = unwrapReferenceSchema(value);
  if (!schema) return null;
  if (schema.example !== undefined) return schema.example;
  if (schema.examples?.length) return schema.examples[0];
  if (schema.const !== undefined) return schema.const;
  if (schema.enum?.length) return schema.enum[0];

  if (schema.type === "object" || schema.properties) {
    if (depth >= 2) return {};
    const required = new Set(schema.required ?? []);
    const properties = Object.entries(schema.properties ?? {})
      .sort(
        ([left], [right]) =>
          Number(required.has(right)) - Number(required.has(left))
      )
      .slice(0, 8);
    return Object.fromEntries(
      properties.map(([propertyName, property]) => [
        propertyName,
        referenceSchemaExample(property, propertyName, depth + 1)
      ])
    );
  }

  if (schema.type === "array") {
    return depth >= 2
      ? []
      : [referenceSchemaExample(schema.items, name, depth + 1)];
  }
  if (schema.type === "integer" || schema.type === "number") return 1;
  if (schema.type === "boolean") return true;
  if (schema.type === "null") return null;
  return referenceStringExample(name, schema);
}

function getJsonRequestSchema(operation: OpenApiOperation) {
  return operation.requestBody?.content?.["application/json"]?.schema ?? null;
}

function getPrimaryResponseSchema(operation: OpenApiOperation) {
  for (const status of getSuccessStatuses(operation)) {
    const content = operation.responses?.[status]?.content ?? {};
    const schema =
      content["application/json"]?.schema ??
      Object.values(content).find((candidate) => candidate.schema)?.schema;
    if (schema) return schema;
  }
  return null;
}

function hasQueryParameters(operation: OpenApiOperation) {
  return (operation.parameters ?? []).some(
    (parameter) => parameter.in === "query"
  );
}

function getQueryParameterNames(operation: OpenApiOperation) {
  return (operation.parameters ?? [])
    .filter(
      (parameter): parameter is { in: string; name: string } =>
        parameter.in === "query" &&
        typeof parameter.name === "string" &&
        parameter.name.length > 0
    )
    .map((parameter) => parameter.name)
    .sort((left, right) => left.localeCompare(right));
}

function buildApiReferenceDocument(
  openApiDocument: OpenApiDocumentForReference
) {
  const endpoints = Object.entries(openApiDocument.paths ?? {})
    .flatMap(([path, operations]) =>
      DOCUMENTED_HTTP_METHODS.flatMap((method) => {
        const operation = operations[method];

        if (!operation) {
          return [];
        }

        const requestSchema = getJsonRequestSchema(operation);
        const responseSchema = getPrimaryResponseSchema(operation);

        return [
          {
            authentication: getApiReferenceAuthentication(path),
            group: getApiReferenceGroup(path),
            hasQueryParameters: hasQueryParameters(operation),
            hasRequestSchema: hasJsonRequestSchema(operation),
            hasResponseSchema: hasResponseSchema(operation),
            method: method.toUpperCase(),
            operationId: operation.operationId ?? null,
            path,
            queryParameters: getQueryParameterNames(operation),
            requestContentTypes: getRequestContentTypes(operation),
            requestExample: requestSchema
              ? referenceSchemaExample(requestSchema)
              : null,
            requestFields: referenceSchemaFields(requestSchema),
            responseContentTypes: getResponseContentTypes(operation),
            responseExample: responseSchema
              ? referenceSchemaExample(responseSchema)
              : null,
            responseFields: referenceSchemaFields(responseSchema),
            summary:
              operation.summary ?? fallbackOperationSummary(method, path),
            successStatuses: getSuccessStatuses(operation),
            tags: operation.tags ?? []
          }
        ];
      })
    )
    .sort((left, right) =>
      `${left.group}:${left.path}:${left.method}`.localeCompare(
        `${right.group}:${right.path}:${right.method}`
      )
    );

  const groups = Object.entries(
    endpoints.reduce<Record<string, number>>((accumulator, endpoint) => {
      accumulator[endpoint.group] = (accumulator[endpoint.group] ?? 0) + 1;

      return accumulator;
    }, {})
  )
    .map(([name, endpointCount]) => ({
      endpointCount,
      name
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    endpoints,
    generatedAt: new Date().toISOString(),
    groups,
    openApiPath: OPENAPI_ROUTE,
    title: openApiDocument.info?.title ?? "Periscan API",
    totalEndpoints: endpoints.length,
    version: openApiDocument.info?.version ?? "unknown"
  };
}

export interface BuildAppOptions {
  dataRegion?: string;
  devMode?: boolean;
  // Start the continuous-validation sweep timer (integration sync + fix
  // re-verification + mission schedules across all tenants). Only the real server
  // entrypoint sets this; tests never do, so the timer never runs in CI.
  enableScheduler?: boolean;
  services?: AppServices;
  sessionSecret?: string;
}

export async function buildApp(options: BuildAppOptions = {}) {
  const isTest =
    process.env.NODE_ENV === "test" || process.env.VITEST === "true";
  const app = Fastify({
    // Request correlation: honor an inbound x-request-id (e.g. from an upstream
    // proxy or the web app) so a single request is traceable end to end; mint a
    // uuid when absent. The id is echoed back on the response (onSend below).
    genReqId: () => randomUUID(),
    requestIdHeader: "x-request-id",
    logger: isTest
      ? false
      : {
          level:
            process.env.LOG_LEVEL ||
            (process.env.NODE_ENV === "production" ? "info" : "info")
        }
  });

  const isProduction =
    process.env.PERISCAN_DEPLOYMENT_ENVIRONMENT === "production";
  // Session JWT material: explicit option (tests) or env keyring with kid +
  // optional previous secret for dual-verify rotation. Report-share uses a
  // separate PERISCAN_REPORT_SHARE_SECRET (see getReportShareSecret).
  const sessionSecret: JwtSigningMaterial =
    options.sessionSecret ?? resolveSessionJwtKeyring(process.env);
  const sessionActiveSecret =
    typeof sessionSecret === "string"
      ? sessionSecret
      : sessionSecret.secrets[sessionSecret.activeKid]!;

  if (isProduction && sessionActiveSecret === "periscan-dev-session-secret") {
    throw new Error(
      "PERISCAN_JWT_SECRET must be set to a non-default value when PERISCAN_DEPLOYMENT_ENVIRONMENT=production."
    );
  }
  const devMode = options.devMode ?? process.env.PERISCAN_DEV_MODE === "true";

  if (isProduction && devMode) {
    throw new Error(
      "PERISCAN_DEV_MODE must be false when PERISCAN_DEPLOYMENT_ENVIRONMENT=production."
    );
  }

  // P03-16: production must not disable CSRF via PERISCAN_CSRF_ENFORCE=false.
  assertCsrfProductionConfig(process.env);

  const cookieSecure = isProduction
    ? true
    : process.env.PERISCAN_COOKIE_SECURE === "true";
  const cookieOptions = {
    ...COOKIE_OPTIONS,
    secure: cookieSecure
  };
  // CSRF cookie must be readable by the browser (double-submit); not HttpOnly.
  const csrfCookieOptions = {
    ...cookieOptions,
    httpOnly: false
  };

  const setSessionCookies = (
    reply: { setCookie: (name: string, value: string, opts: typeof cookieOptions) => unknown },
    sessionJwt: string
  ) => {
    reply.setCookie(SESSION_COOKIE_NAME, sessionJwt, cookieOptions);
    reply.setCookie(
      CSRF_COOKIE_NAME,
      createCsrfToken(sessionJwt, sessionSecret),
      csrfCookieOptions
    );
  };

  const clearSessionCookies = (reply: {
    clearCookie: (name: string, opts: typeof cookieOptions) => unknown;
  }) => {
    reply.clearCookie(SESSION_COOKIE_NAME, cookieOptions);
    reply.clearCookie(CSRF_COOKIE_NAME, csrfCookieOptions);
  };

  // Durable store in multi-instance deploys; in-memory for unit tests / inject stubs.
  const idempotencyStore: IdempotencyStore =
    isTest || process.env.PERISCAN_IDEMPOTENCY_STORE === "memory"
      ? createMemoryIdempotencyStore()
      : createPrismaIdempotencyStore(getPrismaClient());

  const requestedDataRegion =
    options.dataRegion ?? process.env.PERISCAN_DATA_REGION ?? "us-east-1";
  const availableDataRegions = getAvailableEvidenceDataRegions();
  const dataRegion = availableDataRegions.includes(requestedDataRegion)
    ? requestedDataRegion
    : (availableDataRegions[0] ?? requestedDataRegion);
  const services =
    options.services ??
    createRuntimeServices({
      availableDataRegions,
      dataRegion,
      devMode,
      // Intervention tokens remain on the session secret ring until a dedicated
      // PERISCAN_INTERVENTION_SIGNING_SECRET is introduced; still purpose-split
      // from report-share.
      interventionSigningSecret: sessionActiveSecret
    });

  app.setErrorHandler((error, request, reply) => {
    // Log via the request-scoped child logger so error lines carry `traceId`
    // (bound by the onRequest hook) for end-to-end correlation.
    const log = request.log ?? app.log;
    if (error instanceof AppServiceError) {
      const isDeny =
        error.code === "policy_denied" || error.code.includes("denied");
      const level = isDeny ? "warn" : "error";
      log[level](
        {
          op: "request.error",
          code: error.code,
          statusCode: error.statusCode,
          isPolicyDeny: isDeny
        },
        error.message
      );
      return reply.status(error.statusCode).send({
        code: error.code,
        error: error.message
      });
    }

    if (error instanceof z.ZodError) {
      log.warn(
        { op: "request.error", code: "validation_error" },
        "zod validation failed"
      );
      return reply.status(400).send({
        code: "validation_error",
        details: error.issues.map((issue) => ({
          message: issue.message,
          path: issue.path.join(".")
        })),
        error: error.issues.map((issue) => issue.message).join("; ")
      });
    }

    const statusCode = (error as { statusCode?: number }).statusCode;

    if (statusCode === 429) {
      const message =
        error instanceof Error
          ? error.message
          : "Rate limit exceeded. Please retry later.";
      log.warn({ op: "request.error", code: "rate_limited" }, message);

      return reply.status(429).send({
        code: "rate_limited",
        error: message
      });
    }

    log.error({
      op: "request.error",
      code: "internal",
      err: error instanceof Error ? error.message : String(error)
    });

    return reply.status(500).send({
      code: "internal",
      error: "Internal server error."
    });
  });

  await app.register(cookie);
  await app.register(formbody);

  // SCIM clients (RFC 7644) send application/scim+json. Without a parser Fastify
  // throws Unsupported Media Type before the honesty 501 handler runs — which
  // looks like a broken SCIM server rather than an honest NotConfigured residual.
  // Parse as JSON (or empty object) so every SCIM verb reaches the 501 stub.
  app.addContentTypeParser(
    "application/scim+json",
    { parseAs: "string" },
    (request, body, done) => {
      void request;
      if (!body || body.length === 0) {
        done(null, {});
        return;
      }
      try {
        done(null, JSON.parse(String(body)) as unknown);
      } catch (error) {
        done(error as Error, undefined);
      }
    }
  );

  // Security response headers (defense-in-depth). Applied to every response via
  // onSend. CSP is skipped only for the api-reference HTML route, whose embedded
  // Swagger UI needs inline scripts/styles; everywhere else a strict default-src
  // 'none' policy applies (the API otherwise serves JSON). HSTS is emitted in
  // production only — browsers ignore it over plain HTTP, and emitting it in dev
  // could pin localhost to HTTPS unexpectedly.
  const cspExemptPaths = new Set<string>(["/api/v1/api-reference"]);
  const isProductionDeployment =
    process.env.PERISCAN_DEPLOYMENT_ENVIRONMENT === "production";

  // Lightweight distributed request tracing (no OpenTelemetry dependency).
  // On every request we honor an inbound `x-trace-id` (e.g. propagated from the
  // web app or an upstream service) so a single logical operation is traceable
  // across process boundaries; when absent we fall back to the Fastify request
  // id (itself a uuid, or an honored inbound x-request-id). The trace id is
  // bound into this request's child logger so every log line it emits carries
  // `traceId`, and echoed back on the response by the onSend hook below.
  app.decorateRequest("traceId", "");
  app.addHook("onRequest", async (request) => {
    // Start every request explicitly unbound so a sticky tenant binding from a
    // prior request on this async context cannot leak in. Auth re-binds once the
    // tenant is resolved (requireAuthContext → enterTenantRlsContext).
    resetTenantRlsContext();

    const inbound = request.headers["x-trace-id"];
    const provided = (Array.isArray(inbound) ? inbound[0] : inbound)?.trim();
    const traceId = provided && provided.length > 0 ? provided : request.id;

    request.traceId = traceId;
    // Rebind the per-request child logger so traceId rides on every line.
    request.log = request.log.child({ traceId });
  });

  // CSRF double-submit for cookie-authenticated mutations (P03-1).
  // Bearer API keys skip CSRF; bootstrap auth paths are exempt.
  app.addHook("preHandler", async (request) => {
    if (!isCsrfEnforced()) {
      return;
    }
    if (!MUTATING_HTTP_METHODS.has(request.method)) {
      return;
    }
    const path = request.url.split("?")[0] ?? request.url;
    if (CSRF_EXEMPT_PATHS.has(path)) {
      return;
    }
    // API key / Bearer auth is not subject to browser CSRF.
    if (getApiKeyToken(request)) {
      return;
    }
    const sessionJwt = request.cookies[SESSION_COOKIE_NAME];
    if (!sessionJwt) {
      // No cookie session — requireAuth will 401 later; nothing to CSRF-check.
      return;
    }
    const cookieToken = request.cookies[CSRF_COOKIE_NAME];
    const headerRaw = request.headers[CSRF_HEADER_NAME];
    const headerToken = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
    if (
      !verifyCsrfDoubleSubmit({
        cookieToken,
        headerToken,
        material: sessionSecret,
        sessionJwt
      })
    ) {
      throw new AppServiceError(
        "CSRF validation failed. Reload the page and retry.",
        403,
        "csrf_rejected"
      );
    }
  });

  app.addHook("onSend", async (request, reply, payload) => {
    // Echo the request correlation id so callers (and logs) can tie the
    // response back to the request.
    reply.header("x-request-id", request.id);
    // Echo the trace id for end-to-end correlation across services.
    reply.header("x-trace-id", request.traceId);
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("Cross-Origin-Opener-Policy", "same-origin");
    reply.header("X-DNS-Prefetch-Control", "off");
    if (isProductionDeployment) {
      reply.header(
        "Strict-Transport-Security",
        "max-age=63072000; includeSubDomains"
      );
    }
    const path = request.url.split("?")[0] ?? request.url;
    if (!cspExemptPaths.has(path)) {
      reply.header(
        "Content-Security-Policy",
        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
      );
    }
    return payload;
  });

  const corsOrigins = normalizeCorsOriginsForDeployment(
    process.env.PERISCAN_CORS_ORIGINS,
    isProduction
  );

  if (corsOrigins.length > 0) {
    await app.register(cors, {
      credentials: true,
      origin: corsOrigins
    });
  }

  // API-wide rate limiting keyed per API key/tenant, falling back to IP.
  // Health, readiness, metrics and the OpenAPI document are always allowed so
  // probes and dashboards are never throttled. Defaults are generous; tune via
  // PERISCAN_RATE_LIMIT_MAX / PERISCAN_RATE_LIMIT_WINDOW.
  const rateLimitMax =
    parseRateLimitMax(process.env.PERISCAN_RATE_LIMIT_MAX) ??
    (isTest ? 100_000 : 600);
  const rateLimitWindow = process.env.PERISCAN_RATE_LIMIT_WINDOW ?? "1 minute";
  const authRateLimitMax =
    parseRateLimitMax(process.env.PERISCAN_AUTH_RATE_LIMIT_MAX) ??
    (isTest ? 100_000 : 20);

  await app.register(rateLimit, {
    allowList: (request) =>
      RATE_LIMIT_ALLOWLIST.has(request.url.split("?")[0] ?? request.url),
    keyGenerator: (request) => {
      // P20-8: never store raw API key material as the rate-limit identity.
      const apiKey = getApiKeyToken(request);

      if (apiKey) {
        return `key:${hashRateLimitApiKey(apiKey)}`;
      }

      const tenant = getRequestedTenantId(request);

      if (tenant) {
        return `tenant:${tenant}`;
      }

      return `ip:${request.ip}`;
    },
    max: rateLimitMax,
    timeWindow: rateLimitWindow
  });

  await app.register(swagger, {
    openapi: {
      components: {
        securitySchemes: {
          bearerAuth: {
            bearerFormat: "psk",
            description:
              "Tenant API key for machine clients. Send `Authorization: Bearer psk_<secret>`. Keys are minted under `/api/v1/tenants/current/api-keys` (secret returned once on create/rotate). API keys bind a single tenant and ignore tenant-switch headers.",
            scheme: "bearer",
            type: "http"
          },
          sessionCookie: {
            description:
              "Browser session cookie `periscan_session` set by `/api/v1/auth/login` or `/api/v1/auth/signup`. Prefer API keys for headless automation; session auth supports interactive UI and optional tenant selection.",
            in: "cookie",
            name: "periscan_session",
            type: "apiKey"
          }
        }
      },
      info: {
        description:
          "Periscan API-first control plane. Auth: Bearer `psk_` API key (automation) or `periscan_session` cookie (browser). Webhook catalog (HMAC-signed) emits all nine events: `mission.started`, `mission.completed`, `mission.failed`, `snapshot.ready`, `remediation.created`, `remediation.verified`, `finding.disposition_changed`, `policy.denied`, and `schedule.failed`. Discover types + progressive data field summaries via GET /api/v1/tenants/current/webhooks/event-catalog. List envelopes are per-operation (cursor, offset page, or bare items) — see each operationId schema.",
        title: "Periscan API",
        // Bump when security schemes, webhook catalog, list envelopes, or
        // customer-visible product routes/payload honesty change (see CHANGELOG-API).
        version: "0.4.0"
      },
      // Document both automation and browser credential paths. Public system
      // routes still work without a key; clients that ignore security metadata
      // are unchanged. Either scheme satisfies the global requirement.
      security: [{ bearerAuth: [] }, { sessionCookie: [] }]
    }
  });

  app.get(
    HEALTH_ROUTE,
    {
      schema: {
        operationId: "getHealth",
        response: {
          200: healthResponseJsonSchema
        },
        summary: "Read API health",
        tags: ["system"]
      }
    },
    async () => {
      const payload: HealthResponse = {
        service: "api",
        status: "ok",
        timestamp: new Date().toISOString()
      };

      return HealthResponseSchema.parse(payload);
    }
  );

  app.get(
    "/health",
    {
      schema: {
        operationId: "redirectHealth",
        summary: "Redirect to the canonical health route",
        tags: ["system"]
      }
    },
    async (_request, reply) => reply.redirect(HEALTH_ROUTE, 307)
  );

  app.get(
    "/api/v1/health/ready",
    {
      schema: {
        operationId: "getReadiness",
        summary: "Read API readiness including dependency checks",
        tags: ["system"]
      }
    },
    async (_request, reply) => {
      const readiness = await services.checkReadiness();

      return reply
        .status(readiness.status === "ready" ? 200 : 503)
        .send(readiness);
    }
  );

  // P2 observability: simple process metrics endpoint (no external deps; complements structured logs + DB audit)
  app.get(
    "/api/v1/metrics",
    {
      schema: {
        operationId: "getMetrics",
        summary: "Read basic API process metrics for observability",
        tags: ["system"]
      }
    },
    async () => {
      return buildMetricsPayload();
    }
  );

  app.get(
    "/api/v1/metrics/prometheus",
    {
      schema: {
        operationId: "getPrometheusMetrics",
        summary: "Read Prometheus text metrics for API observability",
        tags: ["system"]
      }
    },
    async (_request, reply) => {
      return reply
        .type("text/plain; version=0.0.4; charset=utf-8")
        .send(renderPrometheusMetrics(buildMetricsPayload()));
    }
  );

  app.get(
    OPENAPI_ROUTE,
    {
      schema: {
        operationId: "getOpenApiDocument",
        summary: "Read the public OpenAPI document",
        tags: ["system"]
      }
    },
    async () => augmentOpenApiDocument(app.swagger())
  );

  app.get(
    "/api/v1/auth/data-residency-options",
    {
      schema: {
        operationId: "getDataResidencyOptions",
        summary: "List data regions backed by configured evidence storage",
        tags: ["auth", "trust"]
      }
    },
    async () =>
      DataResidencyOptionsSchema.parse({
        defaultRegion: dataRegion,
        regions: availableDataRegions.map((region) => ({
          id: region,
          label:
            (
              {
                "ap-southeast-1": "Asia Pacific · Singapore",
                "eu-central-1": "European Union · Frankfurt",
                "uk-south-1": "United Kingdom · London",
                "us-east-1": "United States · East"
              } as Record<string, string>
            )[region] ?? region
        }))
      })
  );

  app.get(
    "/api/v1/api-reference",
    {
      schema: {
        operationId: "getApiReference",
        summary: "Read the grouped API reference document",
        tags: ["system"]
      }
    },
    async () =>
      buildApiReferenceDocument(
        augmentOpenApiDocument(app.swagger()) as OpenApiDocumentForReference
      )
  );

  app.post(
    "/api/v1/auth/signup",
    {
      config: {
        rateLimit: {
          max: authRateLimitMax,
          timeWindow: rateLimitWindow
        }
      },
      schema: {
        operationId: "signup",
        summary: "Create a tenant and the first owner account",
        tags: ["auth"]
      }
    },
    async (request, reply) => {
      const input = SignupInputSchema.parse(request.body);
      const result = await services.signup(input);
      const token = await createSessionToken(result.session, sessionSecret);

      setSessionCookies(reply, token);

      return reply.status(201).send(formatAuthPayload(result));
    }
  );

  app.post(
    "/api/v1/auth/login",
    {
      config: {
        rateLimit: {
          max: authRateLimitMax,
          timeWindow: rateLimitWindow
        }
      },
      schema: {
        operationId: "login",
        summary: "Authenticate a user and start a session",
        tags: ["auth"]
      }
    },
    async (request, reply) => {
      const input = LoginInputSchema.parse(request.body);
      const result = await services.login(input);

      if (!result) {
        return reply.status(401).send({
          error: "Invalid email or password."
        });
      }

      const token = await createSessionToken(result.session, sessionSecret);

      setSessionCookies(reply, token);

      return reply.send(formatAuthPayload(result));
    }
  );

  app.post(
    "/api/v1/auth/sso/start",
    {
      config: {
        rateLimit: {
          max: authRateLimitMax,
          timeWindow: rateLimitWindow
        }
      },
      schema: {
        operationId: "startTenantSsoLogin",
        summary: "Start a tenant OIDC or SAML SSO login",
        tags: ["auth"]
      }
    },
    async (request, reply) => {
      const input = StartTenantSsoLoginInputSchema.parse(request.body);

      return reply.send(await services.startTenantSsoLogin(input));
    }
  );

  app.get(
    "/api/v1/auth/sso/callback",
    {
      config: {
        rateLimit: {
          max: authRateLimitMax,
          timeWindow: rateLimitWindow
        }
      },
      schema: {
        operationId: "completeTenantSsoLogin",
        summary: "Complete a tenant OIDC or SAML SSO login callback",
        tags: ["auth"]
      }
    },
    async (request, reply) => {
      const input = CompleteTenantSsoLoginInputSchema.parse(
        normalizeSsoCallbackPayload(request.query)
      );
      const result = await services.completeTenantSsoLogin(input);
      const token = await createSessionToken(result.session, sessionSecret);

      setSessionCookies(reply, token);

      if (request.headers.accept?.includes("text/html")) {
        const webBaseUrl = (
          process.env.PERISCAN_WEB_BASE_URL ?? "http://localhost:3000"
        ).replace(/\/+$/u, "");
        return reply.redirect(`${webBaseUrl}/dashboard`, 303);
      }

      return reply.send(formatAuthPayload(result));
    }
  );

  app.post(
    "/api/v1/auth/sso/callback",
    {
      config: {
        rateLimit: {
          max: authRateLimitMax,
          timeWindow: rateLimitWindow
        }
      },
      schema: {
        operationId: "completeTenantSsoLoginPost",
        summary: "Complete a tenant OIDC or SAML SSO login callback",
        tags: ["auth"]
      }
    },
    async (request, reply) => {
      const input = CompleteTenantSsoLoginInputSchema.parse(
        normalizeSsoCallbackPayload(request.body)
      );
      const result = await services.completeTenantSsoLogin(input);
      const token = await createSessionToken(result.session, sessionSecret);

      setSessionCookies(reply, token);

      if (request.headers.accept?.includes("text/html")) {
        const webBaseUrl = (
          process.env.PERISCAN_WEB_BASE_URL ?? "http://localhost:3000"
        ).replace(/\/+$/u, "");
        return reply.redirect(`${webBaseUrl}/dashboard`, 303);
      }

      return reply.send(formatAuthPayload(result));
    }
  );

  app.post(
    "/api/v1/auth/logout",
    {
      schema: {
        operationId: "logout",
        summary: "End the current session",
        tags: ["auth"]
      }
    },
    async (request, reply) => {
      const context = await getAuthContext(request, services, sessionSecret);

      if (context) {
        await services.recordLogout(context);
      }

      clearSessionCookies(reply);

      return reply.status(204).send();
    }
  );

  app.post(
    "/api/v1/auth/password-reset/request",
    {
      config: {
        rateLimit: {
          max: authRateLimitMax,
          timeWindow: rateLimitWindow
        }
      },
      schema: {
        operationId: "requestPasswordReset",
        summary: "Request a password reset email",
        tags: ["auth"]
      }
    },
    async (request, reply) => {
      const input = PasswordResetRequestSchema.parse(request.body);
      await services.requestPasswordReset(input);

      // Always 202 regardless of whether the email exists (no account
      // enumeration). The email is sent only when the account is real.
      return reply.status(202).send({
        message:
          "If an account exists for that email, a password reset link has been sent."
      });
    }
  );

  app.post(
    "/api/v1/auth/password-reset/confirm",
    {
      config: {
        rateLimit: {
          max: authRateLimitMax,
          timeWindow: rateLimitWindow
        }
      },
      schema: {
        operationId: "confirmPasswordReset",
        summary: "Set a new password using a reset token",
        tags: ["auth"]
      }
    },
    async (request, reply) => {
      const input = PasswordResetConfirmSchema.parse(request.body);
      await services.confirmPasswordReset(input);

      return reply.send({ message: "Your password has been updated." });
    }
  );

  app.post(
    "/api/v1/auth/password/change",
    {
      config: {
        rateLimit: {
          max: authRateLimitMax,
          timeWindow: rateLimitWindow
        }
      },
      schema: {
        operationId: "changePassword",
        summary:
          "Change the current user's local password and revoke older sessions",
        tags: ["auth"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = ChangePasswordInputSchema.parse(request.body ?? {});
      const result = await services.changePassword(context, input);
      const token = await createSessionToken(result.session, sessionSecret);
      setSessionCookies(reply, token);

      return reply.send({
        message: "Your password was updated and older sessions were revoked."
      });
    }
  );

  app.post(
    "/api/v1/auth/sessions/revoke-others",
    {
      schema: {
        operationId: "revokeOtherSessions",
        summary: "Revoke older signed sessions while preserving this browser",
        tags: ["auth"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const result = await services.revokeOtherSessions(context);
      const token = await createSessionToken(result.session, sessionSecret);
      setSessionCookies(reply, token);

      return reply.send({
        message: "Other signed-in browsers and devices were signed out."
      });
    }
  );

  app.post(
    "/api/v1/auth/accept-invite",
    {
      config: {
        rateLimit: {
          max: authRateLimitMax,
          timeWindow: rateLimitWindow
        }
      },
      schema: {
        operationId: "acceptInvite",
        summary: "Accept a tenant invite by setting a password",
        tags: ["auth"]
      }
    },
    async (request, reply) => {
      const input = AcceptInviteSchema.parse(request.body);
      await services.acceptInvite(input);

      return reply.send({
        message: "Your account is active. You can now sign in."
      });
    }
  );

  app.post(
    "/api/v1/auth/verify-email",
    {
      config: {
        rateLimit: {
          max: authRateLimitMax,
          timeWindow: rateLimitWindow
        }
      },
      schema: {
        operationId: "verifyEmail",
        summary: "Verify an email address using a verification token",
        tags: ["auth"]
      }
    },
    async (request, reply) => {
      const input = VerifyEmailSchema.parse(request.body);
      await services.verifyEmail(input);

      return reply.send({ message: "Your email address has been verified." });
    }
  );

  app.post(
    "/api/v1/auth/mfa/enroll",
    {
      schema: {
        operationId: "enrollMfa",
        summary: "Begin TOTP MFA enrollment (returns a secret + otpauth URI)",
        tags: ["auth"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send(await services.enrollMfa(context));
    }
  );

  app.post(
    "/api/v1/auth/mfa/verify",
    {
      schema: {
        operationId: "verifyMfa",
        summary: "Verify a TOTP code and activate MFA for the user",
        tags: ["auth"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = MfaVerifyInputSchema.parse(request.body ?? {});

      return reply.send(await services.verifyMfa(context, input));
    }
  );

  app.post(
    "/api/v1/auth/mfa/recovery-codes/regenerate",
    {
      schema: {
        operationId: "regenerateMfaRecoveryCodes",
        summary: "Regenerate single-use MFA recovery codes (re-auth required)",
        tags: ["auth"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = MfaReauthenticationInputSchema.parse(request.body ?? {});

      return reply.send(
        await services.regenerateMfaRecoveryCodes(context, input)
      );
    }
  );

  app.post(
    "/api/v1/auth/mfa/disable",
    {
      schema: {
        operationId: "disableMfa",
        summary: "Disable MFA for the user (re-auth required)",
        tags: ["auth"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = MfaReauthenticationInputSchema.parse(request.body ?? {});

      return reply.send(await services.disableMfa(context, input));
    }
  );

  app.get(
    "/api/v1/me",
    {
      schema: {
        operationId: "getCurrentUser",
        summary: "Read the authenticated user and tenant context",
        tags: ["auth"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send(formatAuthPayload(context));
    }
  );

  app.get(
    "/api/v1/experience/activation",
    {
      schema: {
        operationId: "getProductActivationState",
        summary: "Read evidence-backed product activation progress",
        tags: ["experience"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send(
        ProductActivationStateSchema.parse(
          await services.getProductActivationState(context)
        )
      );
    }
  );

  app.get(
    "/api/v1/experience/work-queue",
    {
      schema: {
        operationId: "getProductWorkQueue",
        summary: "Read the tenant's cross-workflow operator queue",
        tags: ["experience"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send(
        ProductWorkQueueSchema.parse(
          await services.getProductWorkQueue(context)
        )
      );
    }
  );

  app.get(
    "/api/v1/experience/shift-brief",
    {
      schema: {
        operationId: "getBlueShiftBrief",
        summary:
          "Read the blue-shift morning program brief (validated health buckets)",
        tags: ["experience"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send(
        BlueShiftBriefSchema.parse(await services.getBlueShiftBrief(context))
      );
    }
  );

  app.put(
    "/api/v1/experience/profile",
    {
      schema: {
        operationId: "updateProductExperienceProfile",
        summary: "Set the current member's product role and first outcome",
        tags: ["experience"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = UpdateProductExperienceProfileInputSchema.parse(
        request.body ?? {}
      );
      return reply.send(
        ProductExperienceProfileSchema.parse(
          await services.updateProductExperienceProfile(context, input)
        )
      );
    }
  );

  app.post(
    "/api/v1/experience/feedback",
    {
      schema: {
        operationId: "submitProductFeedback",
        summary: "Record product feedback in proof-loop context",
        tags: ["experience"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = SubmitProductFeedbackInputSchema.parse(request.body ?? {});
      return reply
        .status(201)
        .send(
          ProductFeedbackSchema.parse(
            await services.submitProductFeedback(context, input)
          )
        );
    }
  );

  app.get(
    "/api/v1/tenants/current",
    {
      schema: {
        operationId: "getCurrentTenant",
        summary: "Read the current tenant context",
        tags: ["tenant"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send(await services.getTenantContext(context));
    }
  );

  app.post(
    "/api/v1/tenants/current/invite",
    {
      schema: {
        operationId: "inviteToTenant",
        summary: "Invite a member to the current tenant",
        tags: ["tenant"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      const input = InviteInputSchema.parse(request.body);
      const result = await services.inviteToCurrentTenant(context, input);

      return reply.status(201).send(result);
    }
  );

  app.get(
    "/api/v1/search",
    {
      schema: {
        operationId: "globalSearch",
        summary: "Cross-entity search over the current tenant",
        tags: ["search"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { q } = z
        .object({ q: z.string().default("") })
        .parse(request.query);

      return reply.send(await services.globalSearch(context, q));
    }
  );

  // --- MCP server ---
  // The Model Context Protocol endpoint. A customer's AI client connects here
  // with a tenant API key (Bearer psk_…) and calls read-only, tenant-scoped
  // tools. JSON-RPC 2.0 over HTTP; auth is the same API-key path as the REST API.
  // P20-9: share the global rate-limit (API key hash / tenant / IP). Do not
  // disable rate limiting on MCP — unlimited JSON-RPC can amplify DB load.
  app.post(
    "/mcp",
    {
      schema: {
        operationId: "mcpJsonRpc",
        summary: "Model Context Protocol JSON-RPC endpoint",
        tags: ["mcp"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      const body = request.body as JsonRpcMessage | JsonRpcMessage[];
      const messages = Array.isArray(body) ? body : [body];
      const responses: Record<string, unknown>[] = [];
      for (const message of messages) {
        const response = await handleMcpMessage(
          services,
          context,
          message ?? {}
        );
        if (response) {
          responses.push(response);
        }
      }

      // Notifications-only payloads get 202 with no body per the transport.
      if (responses.length === 0) {
        return reply.status(202).send();
      }
      return reply.send(Array.isArray(body) ? responses : responses[0]);
    }
  );

  // MCP streamable HTTP uses GET only for a server→client SSE stream, which this
  // stateless server does not offer; 405 tells the client to use POST.
  app.get(
    "/mcp",
    {
      schema: {
        operationId: "mcpStream",
        summary: "MCP SSE stream (unused)",
        tags: ["mcp"]
      }
    },
    async (_request, reply) => {
      return reply.header("Allow", "POST").status(405).send({
        error:
          "Use POST for JSON-RPC; this server does not offer an SSE stream."
      });
    }
  );

  app.get(
    "/api/v1/mcp/tools",
    {
      schema: {
        operationId: "listMcpTools",
        summary: "List the read-only tools exposed over MCP",
        tags: ["mcp"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send({ items: await services.listMcpTools(context) });
    }
  );

  app.get(
    "/api/v1/mcp/activity",
    {
      schema: {
        operationId: "listMcpActivity",
        summary: "Recent MCP tool invocations for the tenant",
        tags: ["mcp"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send({ items: await services.listMcpActivity(context) });
    }
  );

  app.get(
    "/api/v1/tenants/current/members",
    {
      schema: {
        operationId: "listTenantMembers",
        summary: "List members of the current tenant",
        tags: ["tenant"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send({
        items: await services.listTenantMembers(context)
      });
    }
  );

  app.get(
    "/api/v1/tenants/current/safety-settings",
    {
      schema: {
        operationId: "getTenantSafetySettings",
        summary: "Read the tenant's validation safety settings",
        tags: ["tenant"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send(await services.getTenantSafetySettings(context));
    }
  );

  app.put(
    "/api/v1/tenants/current/safety-settings/offensive-validation",
    {
      schema: {
        operationId: "setOffensiveValidation",
        summary:
          "Authorize or revoke offensive (adversarial) validation for the tenant",
        tags: ["tenant"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = SetOffensiveValidationInputSchema.parse(request.body);
      return reply.send(await services.setOffensiveValidation(context, input));
    }
  );

  app.put(
    "/api/v1/tenants/current/safety-settings/destructive-validation",
    {
      schema: {
        operationId: "setDestructiveValidation",
        summary:
          "Authorize or revoke destructive (real-payload) validation for the tenant",
        tags: ["tenant"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = SetDestructiveValidationInputSchema.parse(request.body);
      return reply.send(
        await services.setDestructiveValidation(context, input)
      );
    }
  );

  app.get(
    "/api/v1/tenants/current/security-settings/require-mfa",
    {
      schema: {
        operationId: "getTenantRequireMfa",
        summary:
          "Read force-MFA policy for password auth (tenant flag + deployment env)",
        tags: ["tenant"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send(await services.getTenantRequireMfa(context));
    }
  );

  app.put(
    "/api/v1/tenants/current/security-settings/require-mfa",
    {
      schema: {
        operationId: "setTenantRequireMfa",
        summary:
          "Enable or disable force-MFA for password auth on the current tenant",
        tags: ["tenant"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = SetTenantRequireMfaInputSchema.parse(request.body);
      return reply.send(await services.setTenantRequireMfa(context, input));
    }
  );

  app.patch(
    "/api/v1/tenants/current/members/:membershipId",
    {
      schema: {
        operationId: "updateTenantMemberRole",
        summary: "Change a member's role in the current tenant",
        tags: ["tenant"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { membershipId } = z
        .object({ membershipId: z.string().uuid() })
        .parse(request.params);
      const input = UpdateTenantMemberRoleInputSchema.parse(request.body);

      return reply.send(
        await services.updateTenantMemberRole(context, membershipId, input.role)
      );
    }
  );

  app.get(
    "/api/v1/business-impact/workspace",
    {
      schema: {
        operationId: "getBusinessImpactWorkspace",
        summary:
          "Read governed financial assumptions, scenario prompts, and immutable review history",
        tags: ["business-impact"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send(
        BusinessImpactWorkspaceSchema.parse(
          await services.getBusinessImpactWorkspace(context)
        )
      );
    }
  );

  app.get(
    "/api/v1/async-operations/workspace",
    {
      schema: {
        operationId: "getAsyncOperationsWorkspace",
        summary:
          "Read tenant queue health, reviewed operating targets, recovery decisions, and ledger integrity",
        tags: ["async-operations"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send(
        AsyncOperationsWorkspaceSchema.parse(
          await services.getAsyncOperationsWorkspace(context)
        )
      );
    }
  );

  app.put(
    "/api/v1/async-operations/policy",
    {
      schema: {
        operationId: "updateAsyncOperationsPolicy",
        summary: "Review and configure tenant asynchronous operating targets",
        tags: ["async-operations"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = AsyncOperationsPolicyInputSchema.parse(request.body);
      return reply.send(
        AsyncOperationsWorkspaceSchema.parse(
          await services.updateAsyncOperationsPolicy(context, input)
        )
      );
    }
  );

  app.post(
    "/api/v1/async-operations/reconcile",
    {
      schema: {
        operationId: "reconcileAsyncOperations",
        summary:
          "Terminalize only tenant work that crossed a reviewed staleness boundary",
        tags: ["async-operations"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = AsyncOperationsReasonInputSchema.parse(request.body);
      return reply.send(
        AsyncOperationsReconcileResultSchema.parse(
          await services.reconcileAsyncOperations(context, input)
        )
      );
    }
  );

  app.post(
    "/api/v1/async-operations/recovery-decisions",
    {
      schema: {
        operationId: "recordAsyncRecoveryDecision",
        summary:
          "Prepare a fresh policy-gated recovery draft or accept a failed terminal outcome",
        tags: ["async-operations"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = AsyncRecoveryDecisionInputSchema.parse(request.body);
      return reply.send(
        AsyncRecoveryDecisionResultSchema.parse(
          await services.recordAsyncRecoveryDecision(context, input)
        )
      );
    }
  );

  app.post(
    "/api/v1/assets/:id/valuation/preview",
    {
      schema: {
        operationId: "previewAssetValuation",
        summary:
          "Preview a source-backed PERT estimate without changing current path exposure",
        tags: ["business-impact"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = SubmitAssetValuationVersionInputSchema.parse(request.body);
      return reply.send(
        BusinessImpactPreviewSchema.parse(
          await services.previewAssetValuation(context, params.id, input)
        )
      );
    }
  );

  app.post(
    "/api/v1/assets/:id/valuation/versions",
    {
      schema: {
        operationId: "submitAssetValuationVersion",
        summary:
          "Submit an immutable, source-backed financial-assumption version for review",
        tags: ["business-impact"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = SubmitAssetValuationVersionInputSchema.parse(request.body);
      return reply
        .code(201)
        .send(
          AssetValuationVersionSchema.parse(
            await services.submitAssetValuationVersion(
              context,
              params.id,
              input
            )
          )
        );
    }
  );

  app.post(
    "/api/v1/assets/:id/valuation/versions/:versionId/review",
    {
      schema: {
        operationId: "reviewAssetValuationVersion",
        summary:
          "Approve or reject a financial-assumption version with durable review provenance",
        tags: ["business-impact"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({ id: z.string().uuid(), versionId: z.string().uuid() })
        .parse(request.params);
      const input = ReviewAssetValuationVersionInputSchema.parse(request.body);
      return reply.send(
        AssetValuationVersionSchema.parse(
          await services.reviewAssetValuationVersion(
            context,
            params.id,
            params.versionId,
            input
          )
        )
      );
    }
  );

  app.delete(
    "/api/v1/tenants/current/members/:membershipId",
    {
      schema: {
        operationId: "removeTenantMember",
        summary: "Remove a member from the current tenant",
        tags: ["tenant"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { membershipId } = z
        .object({ membershipId: z.string().uuid() })
        .parse(request.params);

      await services.removeTenantMember(context, membershipId);

      return reply.status(204).send();
    }
  );

  app.get(
    "/api/v1/tenants/current/clients",
    {
      schema: {
        operationId: "listClientTenants",
        summary: "List client tenants managed by the current tenant",
        tags: ["tenant"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send({
        items: await services.listClientTenants(context)
      });
    }
  );

  app.get(
    "/api/v1/tenants/current/client-portfolio",
    {
      schema: {
        operationId: "getClientPortfolio",
        summary: "Read the MSSP client portfolio summary",
        tags: ["tenant"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      // Cross-tenant read: an MSSP parent aggregates its child tenants' data, so
      // it must run with the RLS tenant binding cleared (the code scopes strictly
      // by parentTenantId / per-client tenantId).
      return reply.send(
        await runWithoutTenantRls(() => services.getClientPortfolio(context))
      );
    }
  );

  app.post(
    "/api/v1/tenants/current/clients",
    {
      schema: {
        operationId: "createClientTenant",
        summary: "Create a managed client tenant",
        tags: ["tenant"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = CreateClientTenantInputSchema.parse(request.body);

      return reply
        .status(201)
        .send(
          await runWithoutTenantRls(() =>
            services.createClientTenant(context, input)
          )
        );
    }
  );

  app.get(
    "/api/v1/tenants/current/branding",
    {
      schema: {
        operationId: "getTenantBranding",
        summary: "Read the tenant report branding",
        tags: ["tenant"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send(await services.getTenantBranding(context));
    }
  );

  app.get(
    "/api/v1/tenants/current/localization",
    {
      schema: {
        operationId: "getTenantLocalization",
        summary: "Read the tenant UI and report locale policy",
        tags: ["tenant"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send(await services.getTenantLocalization(context));
    }
  );

  app.get(
    "/api/v1/tenants/current/localization/workspace",
    {
      schema: {
        operationId: "getTenantLocalizationWorkspace",
        summary: "Read localization catalogs, preview, and activation history",
        tags: ["tenant"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send(await services.getTenantLocalizationWorkspace(context));
    }
  );

  app.post(
    "/api/v1/tenants/current/localization/preview",
    {
      schema: {
        operationId: "previewTenantLocalization",
        summary: "Preview locale and timezone formatting without activation",
        tags: ["tenant"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = PreviewTenantLocalizationInputSchema.parse(request.body);

      return reply.send(
        await services.previewTenantLocalization(context, input)
      );
    }
  );

  app.put(
    "/api/v1/tenants/current/localization",
    {
      schema: {
        operationId: "updateTenantLocalization",
        summary: "Update the tenant UI and report locale",
        tags: ["tenant"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = UpdateTenantLocalizationInputSchema.parse(request.body);

      return reply.send(
        await services.updateTenantLocalization(context, input)
      );
    }
  );

  app.put(
    "/api/v1/tenants/current/branding",
    {
      schema: {
        operationId: "updateTenantBranding",
        summary: "Update the tenant report branding",
        tags: ["tenant"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = UpdateTenantBrandingInputSchema.parse(request.body);

      return reply.send(await services.updateTenantBranding(context, input));
    }
  );

  app.get(
    "/api/v1/tenants/current/sso",
    {
      schema: {
        operationId: "getTenantSsoConfig",
        summary: "Read the tenant SSO configuration without secrets",
        tags: ["tenant"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send({
        config: await services.getTenantSsoConfig(context)
      });
    }
  );

  app.put(
    "/api/v1/tenants/current/sso",
    {
      schema: {
        operationId: "updateTenantSsoConfig",
        summary: "Create or update the tenant OIDC or SAML SSO configuration",
        tags: ["tenant"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = UpdateTenantSsoConfigInputSchema.parse(request.body);

      return reply.send(await services.updateTenantSsoConfig(context, input));
    }
  );

  app.delete(
    "/api/v1/tenants/current/sso",
    {
      schema: {
        operationId: "disableTenantSsoConfig",
        summary: "Disable tenant SSO",
        tags: ["tenant"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      await services.disableTenantSsoConfig(context);

      return reply.status(204).send();
    }
  );

  app.get(
    "/api/v1/tenants/current/sso/authorization-url",
    {
      schema: {
        operationId: "buildTenantSsoAuthorizationUrl",
        summary: "Build a tenant OIDC authorization URL from configured SSO",
        tags: ["tenant"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = TenantSsoAuthorizationUrlInputSchema.parse(request.query);

      return reply.send(
        await services.buildTenantSsoAuthorizationUrl(context, input)
      );
    }
  );

  app.get(
    "/api/v1/tenants/current/sso/metadata",
    {
      schema: {
        operationId: "getTenantSsoMetadata",
        summary: "Read SAML service-provider metadata for this tenant",
        tags: ["tenant"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const metadata = await services.getTenantSsoMetadata(context);

      return reply
        .header("content-type", "application/samlmetadata+xml; charset=utf-8")
        .send(metadata);
    }
  );

  app.get(
    "/api/v1/tenants/current/design-partner",
    {
      schema: {
        operationId: "getDesignPartnerWorkspace",
        summary: "Read the design-partner workspace",
        tags: ["tenant"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send(await services.getDesignPartnerWorkspace(context));
    }
  );

  app.put(
    "/api/v1/tenants/current/design-partner",
    {
      schema: {
        operationId: "updateDesignPartnerSettings",
        summary: "Update design-partner workspace settings",
        tags: ["tenant"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = UpdateDesignPartnerSettingsInputSchema.parse(request.body);

      return reply.send(
        await services.updateDesignPartnerSettings(context, input)
      );
    }
  );

  app.post(
    "/api/v1/tenants/current/design-partner/session-notes",
    {
      schema: {
        operationId: "appendDesignPartnerSessionNote",
        summary:
          "Append an internal design-partner session learning note (not a public reference)",
        tags: ["tenant"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = AppendDesignPartnerSessionNoteInputSchema.parse(
        request.body
      );

      return reply
        .code(201)
        .send(await services.appendDesignPartnerSessionNote(context, input));
    }
  );

  app.get(
    "/api/v1/tenants/current/executive-trends",
    {
      schema: {
        operationId: "getExecutiveTrends",
        summary: "Read executive trend metrics for the tenant",
        tags: ["tenant"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send(await services.getExecutiveTrends(context));
    }
  );

  app.get(
    "/api/v1/tenants/current/executive-trends/series",
    {
      schema: {
        operationId: "getExecutiveTrendSeries",
        summary: "Read the executive trend metric time series for the tenant",
        tags: ["tenant"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send(await services.getExecutiveTrendSeries(context));
    }
  );

  app.get(
    "/api/v1/tenants/current/operational-metrics",
    {
      schema: {
        operationId: "getOperationalMetrics",
        summary: "Read operational metrics for the tenant",
        tags: ["tenant"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send(await services.getOperationalMetrics(context));
    }
  );

  app.post(
    "/api/v1/tenants/current/api-keys",
    {
      schema: {
        operationId: "createApiKey",
        summary: "Create a tenant API key and return its secret once",
        tags: ["api-keys"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = CreateTenantApiKeyInputSchema.parse(request.body);

      return reply
        .status(201)
        .send(await services.createApiKey(context, input));
    }
  );

  app.get(
    "/api/v1/tenants/current/api-keys",
    {
      schema: {
        operationId: "listApiKeys",
        summary: "List tenant API keys without secrets",
        tags: ["api-keys"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send({
        items: await services.listApiKeys(context)
      });
    }
  );

  app.delete(
    "/api/v1/tenants/current/api-keys/:apiKeyId",
    {
      schema: {
        operationId: "revokeApiKey",
        summary: "Revoke a tenant API key",
        tags: ["api-keys"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { apiKeyId } = request.params as { apiKeyId: string };

      return reply.send(await services.revokeApiKey(context, apiKeyId));
    }
  );

  app.post(
    "/api/v1/tenants/current/api-keys/:apiKeyId/rotate",
    {
      schema: {
        operationId: "rotateApiKey",
        summary: "Rotate a tenant API key and return the new secret",
        tags: ["api-keys"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { apiKeyId } = request.params as { apiKeyId: string };

      return reply.send(await services.rotateApiKey(context, apiKeyId));
    }
  );

  app.get(
    "/api/v1/tenants/current/webhooks",
    {
      schema: {
        operationId: "listWebhooks",
        summary: "List tenant outbound webhooks",
        tags: ["webhooks"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send({
        items: await services.listWebhooks(context)
      });
    }
  );

  // P20-5 / O13: discoverable event catalog (must stay static path, not under :webhookId).
  app.get(
    "/api/v1/tenants/current/webhooks/event-catalog",
    {
      schema: {
        operationId: "getWebhookEventCatalog",
        summary:
          "List outbound webhook event types and signature header contract for receivers",
        tags: ["webhooks"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send(await services.getWebhookEventCatalog(context));
    }
  );

  app.post(
    "/api/v1/tenants/current/webhooks",
    {
      schema: {
        operationId: "createWebhook",
        summary: "Create a tenant outbound webhook",
        tags: ["webhooks"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = CreateTenantWebhookInputSchema.parse(request.body);

      return reply
        .status(201)
        .send(await services.createWebhook(context, input));
    }
  );

  app.put(
    "/api/v1/tenants/current/webhooks/:webhookId",
    {
      schema: {
        operationId: "updateWebhook",
        summary: "Update a tenant outbound webhook",
        tags: ["webhooks"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { webhookId } = request.params as { webhookId: string };
      const input = UpdateTenantWebhookInputSchema.parse(request.body);

      return reply.send(
        await services.updateWebhook(context, webhookId, input)
      );
    }
  );

  app.delete(
    "/api/v1/tenants/current/webhooks/:webhookId",
    {
      schema: {
        operationId: "deleteWebhook",
        summary: "Delete a tenant outbound webhook",
        tags: ["webhooks"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { webhookId } = request.params as { webhookId: string };

      await services.deleteWebhook(context, webhookId);

      return reply.status(204).send();
    }
  );

  app.post(
    "/api/v1/tenants/current/webhooks/:webhookId/test",
    {
      schema: {
        operationId: "testWebhook",
        summary: "Send a test event to a tenant outbound webhook",
        tags: ["webhooks"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { webhookId } = request.params as { webhookId: string };

      return reply
        .status(202)
        .send(await services.testWebhook(context, webhookId));
    }
  );

  app.get(
    "/api/v1/tenants/current/webhook-deliveries",
    {
      schema: {
        operationId: "listWebhookDeliveries",
        summary: "List recent webhook delivery attempts for debugging",
        tags: ["webhooks"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const query = WebhookDeliveryQuerySchema.parse(request.query ?? {});

      return reply.send({
        items: await services.listWebhookDeliveries(context, query.webhookId)
      });
    }
  );

  app.get(
    "/api/v1/tenants/current/webhook-deliveries/dead-letter",
    {
      schema: {
        operationId: "listDeadLetteredWebhookDeliveries",
        summary: "List permanently-failed (dead-lettered) webhook deliveries",
        tags: ["webhooks"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send({
        items: await services.listDeadLetteredWebhookDeliveries(context)
      });
    }
  );

  // P20-4: service methods existed without HTTP; mount rotate + redrive.
  app.post(
    "/api/v1/tenants/current/webhooks/:webhookId/rotate-secret",
    {
      schema: {
        operationId: "rotateWebhookSecret",
        summary:
          "Rotate a tenant outbound webhook signing secret (returns new secret once)",
        tags: ["webhooks"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { webhookId } = request.params as { webhookId: string };

      return reply.send(await services.rotateWebhookSecret(context, webhookId));
    }
  );

  app.post(
    "/api/v1/tenants/current/webhook-deliveries/:deliveryId/redrive",
    {
      schema: {
        operationId: "redriveWebhookDelivery",
        summary:
          "Redrive a failed or dead-lettered webhook delivery (resets attempts and re-enqueues)",
        tags: ["webhooks"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { deliveryId } = request.params as { deliveryId: string };

      return reply
        .status(202)
        .send(await services.redriveWebhookDelivery(context, deliveryId));
    }
  );

  app.get(
    "/api/v1/approvals/pending",
    {
      schema: {
        operationId: "listPendingApprovals",
        summary: "List policy decisions awaiting approval",
        tags: ["approvals"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send({
        items: await services.listPendingApprovals(context)
      });
    }
  );

  app.get(
    "/api/v1/policy-decisions",
    {
      schema: {
        operationId: "listPolicyDecisions",
        summary: "List the tenant's policy decision history (governance trail)",
        tags: ["approvals"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const query = PolicyDecisionQuerySchema.parse(request.query ?? {});

      return reply.send({
        items: await services.listPolicyDecisions(context, {
          ...query,
          limit: parseLimit(
            request.query && (request.query as Record<string, unknown>).limit
          )
        })
      });
    }
  );

  app.post(
    "/api/v1/approvals/:policyDecisionId/approve",
    {
      schema: {
        operationId: "approvePolicyDecision",
        summary: "Approve a pending policy decision",
        tags: ["approvals"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { policyDecisionId } = request.params as {
        policyDecisionId: string;
      };

      return reply.send(
        await services.approvePolicyDecision(context, policyDecisionId)
      );
    }
  );

  app.post(
    "/api/v1/approvals/:policyDecisionId/deny",
    {
      schema: {
        operationId: "denyPolicyDecision",
        summary: "Deny a pending policy decision",
        tags: ["approvals"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { policyDecisionId } = request.params as {
        policyDecisionId: string;
      };

      return reply.send(
        await services.denyPolicyDecision(context, policyDecisionId)
      );
    }
  );

  app.get(
    "/api/v1/billing/limits",
    {
      schema: {
        operationId: "getBillingLimits",
        summary: "Read tenant usage against configured limits",
        tags: ["billing"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send(await services.getBillingLimits(context));
    }
  );

  app.post(
    "/api/v1/audit-events/export",
    {
      schema: {
        operationId: "createAuditExport",
        summary: "Export tenant audit events as an evidence artifact",
        tags: ["audit"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = AuditExportInputSchema.parse(request.body ?? {});

      return reply
        .status(201)
        .send(await services.createAuditExport(context, input));
    }
  );

  app.get(
    "/api/v1/audit-events/export/:exportId",
    {
      schema: {
        operationId: "getAuditExport",
        summary: "Download a previously generated audit export",
        tags: ["audit"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { exportId } = z
        .object({
          exportId: z.string().uuid()
        })
        .parse(request.params);
      const result = await services.getAuditExport(context, exportId);

      if (!result) {
        return reply.status(404).send({
          code: "not_found",
          error: "Audit export not found."
        });
      }

      return reply.type(result.contentType).send(result.content);
    }
  );

  app.get(
    "/api/v1/model-gateway/providers",
    {
      schema: {
        operationId: "listModelProviders",
        summary: "List registered frontier-model providers",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send({ items: await services.listModelProviders(context) });
    }
  );

  app.post(
    "/api/v1/model-gateway/providers",
    {
      schema: {
        operationId: "createModelProvider",
        summary: "Register a customer-supplied (BYO key) model provider",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = CreateModelProviderInputSchema.parse(request.body ?? {});

      return reply
        .status(201)
        .send(await services.createModelProvider(context, input));
    }
  );

  app.get(
    "/api/v1/model-gateway/providers/:modelProviderId",
    {
      schema: {
        operationId: "getModelProvider",
        summary: "Read a single model provider",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { modelProviderId } = request.params as {
        modelProviderId: string;
      };
      const provider = await services.getModelProvider(
        context,
        modelProviderId
      );

      if (!provider) {
        return reply
          .status(404)
          .send({ code: "not_found", error: "Model provider not found." });
      }

      return reply.send(provider);
    }
  );

  app.patch(
    "/api/v1/model-gateway/providers/:modelProviderId",
    {
      schema: {
        operationId: "updateModelProvider",
        summary: "Update a model provider (including rotating its API key)",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { modelProviderId } = request.params as {
        modelProviderId: string;
      };
      const input = UpdateModelProviderInputSchema.parse(request.body ?? {});

      return reply.send(
        await services.updateModelProvider(context, modelProviderId, input)
      );
    }
  );

  app.delete(
    "/api/v1/model-gateway/providers/:modelProviderId",
    {
      schema: {
        operationId: "deleteModelProvider",
        summary: "Delete a model provider",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { modelProviderId } = request.params as {
        modelProviderId: string;
      };
      await services.deleteModelProvider(context, modelProviderId);

      return reply.status(204).send();
    }
  );

  app.post(
    "/api/v1/model-gateway/providers/:modelProviderId/test-connection",
    {
      schema: {
        operationId: "testModelProviderConnection",
        summary: "Test connectivity to a provider (sends no customer evidence)",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { modelProviderId } = request.params as {
        modelProviderId: string;
      };

      return reply.send(
        await services.testModelProviderConnection(context, modelProviderId)
      );
    }
  );

  app.get(
    "/api/v1/model-gateway/policies",
    {
      schema: {
        operationId: "listModelPolicyProfiles",
        summary: "List model gateway policy profiles",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send({
        items: await services.listModelPolicyProfiles(context)
      });
    }
  );

  app.post(
    "/api/v1/model-gateway/policies",
    {
      schema: {
        operationId: "createModelPolicyProfile",
        summary: "Create a model gateway policy profile",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = CreateModelPolicyProfileInputSchema.parse(
        request.body ?? {}
      );

      return reply
        .status(201)
        .send(await services.createModelPolicyProfile(context, input));
    }
  );

  app.get(
    "/api/v1/model-gateway/policies/:modelPolicyProfileId",
    {
      schema: {
        operationId: "getModelPolicyProfile",
        summary: "Read a single model gateway policy profile",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { modelPolicyProfileId } = request.params as {
        modelPolicyProfileId: string;
      };
      const profile = await services.getModelPolicyProfile(
        context,
        modelPolicyProfileId
      );

      if (!profile) {
        return reply.status(404).send({
          code: "not_found",
          error: "Model policy profile not found."
        });
      }

      return reply.send(profile);
    }
  );

  app.patch(
    "/api/v1/model-gateway/policies/:modelPolicyProfileId",
    {
      schema: {
        operationId: "updateModelPolicyProfile",
        summary: "Update a model gateway policy profile",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { modelPolicyProfileId } = request.params as {
        modelPolicyProfileId: string;
      };
      const input = UpdateModelPolicyProfileInputSchema.parse(
        request.body ?? {}
      );

      return reply.send(
        await services.updateModelPolicyProfile(
          context,
          modelPolicyProfileId,
          input
        )
      );
    }
  );

  app.delete(
    "/api/v1/model-gateway/policies/:modelPolicyProfileId",
    {
      schema: {
        operationId: "deleteModelPolicyProfile",
        summary: "Delete a model gateway policy profile",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { modelPolicyProfileId } = request.params as {
        modelPolicyProfileId: string;
      };
      await services.deleteModelPolicyProfile(context, modelPolicyProfileId);

      return reply.status(204).send();
    }
  );

  app.get(
    "/api/v1/model-gateway/tools",
    {
      schema: {
        operationId: "listModelTools",
        summary:
          "List the model gateway tool catalog with tenant configuration",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send({ items: await services.listModelTools(context) });
    }
  );

  app.patch(
    "/api/v1/model-gateway/tools/:toolName",
    {
      schema: {
        operationId: "updateModelTool",
        summary: "Configure a model gateway tool for the tenant",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { toolName } = request.params as { toolName: string };
      const input = UpdateModelToolInputSchema.parse(request.body ?? {});

      return reply.send(
        await services.updateModelTool(context, toolName, input)
      );
    }
  );

  app.get(
    "/api/v1/model-gateway/sessions",
    {
      schema: {
        operationId: "listModelSessions",
        summary: "List model gateway sessions",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send({ items: await services.listModelSessions(context) });
    }
  );

  app.post(
    "/api/v1/model-gateway/sessions",
    {
      schema: {
        operationId: "createModelSession",
        summary: "Create a model gateway session",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = CreateModelSessionInputSchema.parse(request.body ?? {});

      return reply
        .status(201)
        .send(await services.createModelSession(context, input));
    }
  );

  app.get(
    "/api/v1/model-gateway/sessions/:modelSessionId",
    {
      schema: {
        operationId: "getModelSession",
        summary: "Read a single model gateway session",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { modelSessionId } = request.params as { modelSessionId: string };
      const session = await services.getModelSession(context, modelSessionId);

      if (!session) {
        return reply
          .status(404)
          .send({ code: "not_found", error: "Model session not found." });
      }

      return reply.send(session);
    }
  );

  app.post(
    "/api/v1/model-gateway/sessions/:modelSessionId/start",
    {
      schema: {
        operationId: "startModelSession",
        summary: "Start a model gateway session",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { modelSessionId } = request.params as { modelSessionId: string };

      return reply.send(
        await services.startModelSession(context, modelSessionId)
      );
    }
  );

  app.post(
    "/api/v1/model-gateway/sessions/:modelSessionId/pause",
    {
      schema: {
        operationId: "pauseModelSession",
        summary: "Pause a model gateway session",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { modelSessionId } = request.params as { modelSessionId: string };

      return reply.send(
        await services.pauseModelSession(context, modelSessionId)
      );
    }
  );

  app.post(
    "/api/v1/model-gateway/sessions/:modelSessionId/terminate",
    {
      schema: {
        operationId: "terminateModelSession",
        summary: "Terminate a model gateway session",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { modelSessionId } = request.params as { modelSessionId: string };

      return reply.send(
        await services.terminateModelSession(context, modelSessionId)
      );
    }
  );

  app.post(
    "/api/v1/model-gateway/sessions/:modelSessionId/turns",
    {
      schema: {
        operationId: "enqueueModelSessionTurn",
        summary: "Submit a prompt turn to a model gateway session",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { modelSessionId } = request.params as { modelSessionId: string };
      const input = CreateModelSessionTurnInputSchema.parse(request.body ?? {});

      return reply.send(
        await services.enqueueModelSessionTurn(context, modelSessionId, input)
      );
    }
  );

  app.get(
    "/api/v1/model-gateway/sessions/:modelSessionId/turns",
    {
      schema: {
        operationId: "listModelSessionTurns",
        summary: "List durable model turn results for a session",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { modelSessionId } = request.params as { modelSessionId: string };
      return reply.send({
        items: await services.listModelSessionTurns(context, modelSessionId)
      });
    }
  );

  app.get(
    "/api/v1/model-gateway/sessions/:modelSessionId/context-bundles",
    {
      schema: {
        operationId: "listContextBundles",
        summary: "List context bundles built for a session",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { modelSessionId } = request.params as { modelSessionId: string };

      return reply.send({
        items: await services.listContextBundles(context, modelSessionId)
      });
    }
  );

  app.post(
    "/api/v1/model-gateway/sessions/:modelSessionId/context-bundles",
    {
      schema: {
        operationId: "createContextBundle",
        summary: "Build a redacted context bundle for a session",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { modelSessionId } = request.params as { modelSessionId: string };
      const input = CreateContextBundleInputSchema.parse(request.body ?? {});

      return reply
        .status(201)
        .send(
          await services.createContextBundle(context, modelSessionId, input)
        );
    }
  );

  app.get(
    "/api/v1/model-gateway/context-bundles/:contextBundleId",
    {
      schema: {
        operationId: "getContextBundle",
        summary: "Read a single context bundle",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { contextBundleId } = request.params as {
        contextBundleId: string;
      };
      const bundle = await services.getContextBundle(context, contextBundleId);

      if (!bundle) {
        return reply
          .status(404)
          .send({ code: "not_found", error: "Context bundle not found." });
      }

      return reply.send(bundle);
    }
  );

  app.get(
    "/api/v1/model-gateway/sessions/:modelSessionId/tool-requests",
    {
      schema: {
        operationId: "listModelToolRequests",
        summary: "List tool requests for a session",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { modelSessionId } = request.params as { modelSessionId: string };

      return reply.send({
        items: await services.listModelToolRequests(context, modelSessionId)
      });
    }
  );

  app.post(
    "/api/v1/model-gateway/sessions/:modelSessionId/tool-requests",
    {
      schema: {
        operationId: "createModelToolRequest",
        summary: "Create a (manual) tool request and run the policy check",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { modelSessionId } = request.params as { modelSessionId: string };
      const input = CreateModelToolRequestInputSchema.parse(request.body ?? {});

      return reply
        .status(201)
        .send(
          await services.createModelToolRequest(context, modelSessionId, input)
        );
    }
  );

  app.get(
    "/api/v1/model-gateway/tool-requests/:toolRequestId",
    {
      schema: {
        operationId: "getModelToolRequest",
        summary: "Read a single tool request",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { toolRequestId } = request.params as { toolRequestId: string };
      const toolRequest = await services.getModelToolRequest(
        context,
        toolRequestId
      );

      if (!toolRequest) {
        return reply
          .status(404)
          .send({ code: "not_found", error: "Tool request not found." });
      }

      return reply.send(toolRequest);
    }
  );

  app.get(
    "/api/v1/model-gateway/interventions",
    {
      schema: {
        operationId: "listModelToolInterventions",
        summary: "List approval-gated requests and their intervention state",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send(await services.listModelToolInterventions(context));
    }
  );

  app.post(
    "/api/v1/model-gateway/tool-requests/:toolRequestId/intervention-link",
    {
      schema: {
        operationId: "issueModelToolIntervention",
        summary: "Issue a signed, expiring, one-time intervention link",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { toolRequestId } = request.params as { toolRequestId: string };
      const input = IssueModelToolInterventionInputSchema.parse(
        request.body ?? {}
      );
      return reply
        .status(201)
        .send(
          await services.issueModelToolIntervention(
            context,
            toolRequestId,
            input
          )
        );
    }
  );

  app.post(
    "/api/v1/model-gateway/interventions/:interventionId/inspect",
    {
      schema: {
        operationId: "inspectModelToolIntervention",
        summary: "Verify and inspect an intervention authorization envelope",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { interventionId } = request.params as { interventionId: string };
      const input = InspectModelToolInterventionInputSchema.parse(
        request.body ?? {}
      );
      return reply.send(
        await services.inspectModelToolIntervention(
          context,
          interventionId,
          input
        )
      );
    }
  );

  app.post(
    "/api/v1/model-gateway/interventions/:interventionId/decision",
    {
      schema: {
        operationId: "decideModelToolIntervention",
        summary: "Resume or cancel a paused tool request exactly once",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { interventionId } = request.params as { interventionId: string };
      const input = DecideModelToolInterventionInputSchema.parse(
        request.body ?? {}
      );
      return reply.send(
        await services.decideModelToolIntervention(
          context,
          interventionId,
          input
        )
      );
    }
  );

  app.post(
    "/api/v1/model-gateway/tool-requests/:toolRequestId/approve",
    {
      schema: {
        operationId: "approveModelToolRequest",
        summary: "Approve a tool request that requires approval",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { toolRequestId } = request.params as { toolRequestId: string };

      return reply.send(
        await services.approveModelToolRequest(context, toolRequestId)
      );
    }
  );

  app.post(
    "/api/v1/model-gateway/tool-requests/:toolRequestId/deny",
    {
      schema: {
        operationId: "denyModelToolRequest",
        summary: "Deny a tool request",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { toolRequestId } = request.params as { toolRequestId: string };

      return reply.send(
        await services.denyModelToolRequest(context, toolRequestId)
      );
    }
  );

  app.post(
    "/api/v1/model-gateway/tool-requests/:toolRequestId/cancel",
    {
      schema: {
        operationId: "cancelModelToolRequest",
        summary: "Cancel a tool request",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { toolRequestId } = request.params as { toolRequestId: string };

      return reply.send(
        await services.cancelModelToolRequest(context, toolRequestId)
      );
    }
  );

  app.post(
    "/api/v1/model-gateway/tool-requests/:toolRequestId/execute",
    {
      schema: {
        operationId: "executeModelToolRequest",
        summary: "Execute an allowed/approved read-only or plan tool request",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { toolRequestId } = request.params as { toolRequestId: string };

      return reply.send(
        await services.executeModelToolRequest(context, toolRequestId)
      );
    }
  );

  app.get(
    "/api/v1/model-gateway/audit-events",
    {
      schema: {
        operationId: "listModelGatewayAuditEvents",
        summary: "List model gateway audit events (optionally by session)",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const query = z
        .object({ modelSessionId: z.string().uuid().optional() })
        .parse(request.query ?? {});

      return reply.send({
        items: await services.listModelGatewayAuditEvents(
          context,
          query.modelSessionId
        )
      });
    }
  );

  app.post(
    "/api/v1/model-gateway/kill-switch",
    {
      schema: {
        operationId: "activateModelGatewayKillSwitch",
        summary:
          "Activate or clear the durable model-gateway kill switch (terminates sessions and blocks LLM tool calls when enabled)",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = ActivateKillSwitchInputSchema.parse(request.body ?? {});

      return reply.send(
        await services.activateModelGatewayKillSwitch(context, input)
      );
    }
  );

  app.get(
    "/api/v1/model-gateway/finops",
    {
      schema: {
        operationId: "getModelGatewayFinOps",
        summary: "Read model usage, budget, pricing, and routing truth",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send(await services.getModelGatewayFinOps(context));
    }
  );

  app.put(
    "/api/v1/model-gateway/finops",
    {
      schema: {
        operationId: "updateModelGatewayFinOps",
        summary: "Configure enforced model budgets, prices, and safe routes",
        tags: ["model-gateway"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = UpdateModelGatewayFinOpsInputSchema.parse(
        request.body ?? {}
      );
      return reply.send(
        await services.updateModelGatewayFinOps(context, input)
      );
    }
  );

  app.get(
    "/api/v1/agent-workflows/definitions",
    {
      schema: {
        operationId: "listAgentWorkflowDefinitions",
        summary: "List versioned agent workflow definitions",
        tags: ["agent-workflows"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send({
        items: await services.listAgentWorkflowDefinitions(context)
      });
    }
  );

  app.post(
    "/api/v1/agent-workflows/definitions",
    {
      schema: {
        operationId: "createAgentWorkflowDefinition",
        summary: "Create an immutable agent workflow definition version",
        tags: ["agent-workflows"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = CreateAgentWorkflowDefinitionInputSchema.parse(
        request.body ?? {}
      );
      return reply
        .status(201)
        .send(await services.createAgentWorkflowDefinition(context, input));
    }
  );

  app.get(
    "/api/v1/agent-workflows/runs",
    {
      schema: {
        operationId: "listAgentWorkflowRuns",
        summary: "List durable agent workflow runs",
        tags: ["agent-workflows"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send({
        items: await services.listAgentWorkflowRuns(context)
      });
    }
  );

  app.get(
    "/api/v1/agent-workflows/behavior-analysis",
    {
      schema: {
        operationId: "getAgentBehaviorAnalysis",
        summary:
          "Analyze workflow behavior against explainable tenant baselines",
        tags: ["agent-workflows"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send(
        AgentBehaviorAnalysisSchema.parse(
          await services.getAgentBehaviorAnalysis(context)
        )
      );
    }
  );

  app.post(
    "/api/v1/agent-workflows/runs",
    {
      schema: {
        operationId: "createAgentWorkflowRun",
        summary: "Create a durable agent workflow run",
        tags: ["agent-workflows"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = CreateAgentWorkflowRunInputSchema.parse(request.body ?? {});
      return reply
        .status(201)
        .send(await services.createAgentWorkflowRun(context, input));
    }
  );

  app.get(
    "/api/v1/agent-workflows/runs/:workflowRunId",
    {
      schema: {
        operationId: "getAgentWorkflowRun",
        summary: "Read a run and verify its append-only flight recorder",
        tags: ["agent-workflows"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { workflowRunId } = request.params as { workflowRunId: string };
      return reply.send(
        await services.getAgentWorkflowRun(context, workflowRunId)
      );
    }
  );

  app.get(
    "/api/v1/agent-workflows/runs/:workflowRunId/evaluation",
    {
      schema: {
        operationId: "evaluateAgentWorkflowRunQuality",
        summary:
          "Evaluate workflow integrity, grounding, policy traceability, and model identity",
        tags: ["agent-workflows"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { workflowRunId } = request.params as { workflowRunId: string };
      return reply.send(
        AgentWorkflowQualityEvaluationSchema.parse(
          await services.evaluateAgentWorkflowRunQuality(context, workflowRunId)
        )
      );
    }
  );

  app.get(
    "/api/v1/agent-workflows/runs/:workflowRunId/variable-analysis",
    {
      schema: {
        operationId: "getAgentWorkflowVariableAnalysis",
        summary:
          "Compare redacted workflow variables across verified recorder moments",
        tags: ["agent-workflows"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { workflowRunId } = request.params as { workflowRunId: string };
      return reply.send(
        AgentWorkflowVariableAnalysisSchema.parse(
          await services.getAgentWorkflowVariableAnalysis(
            context,
            workflowRunId
          )
        )
      );
    }
  );

  app.post(
    "/api/v1/agent-workflows/runs/:workflowRunId/events",
    {
      schema: {
        operationId: "appendAgentWorkflowEvent",
        summary: "Append a redacted hash-chained workflow event",
        tags: ["agent-workflows"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { workflowRunId } = request.params as { workflowRunId: string };
      const input = AppendAgentWorkflowEventInputSchema.parse(
        request.body ?? {}
      );
      return reply
        .status(201)
        .send(
          await services.appendAgentWorkflowEvent(context, workflowRunId, input)
        );
    }
  );

  app.post(
    "/api/v1/agent-workflows/runs/:workflowRunId/checkpoints",
    {
      schema: {
        operationId: "createAgentWorkflowCheckpoint",
        summary: "Seal a validated workflow replay checkpoint",
        tags: ["agent-workflows"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { workflowRunId } = request.params as { workflowRunId: string };
      const input = CreateAgentWorkflowCheckpointInputSchema.parse(
        request.body ?? {}
      );
      return reply
        .status(201)
        .send(
          await services.createAgentWorkflowCheckpoint(
            context,
            workflowRunId,
            input
          )
        );
    }
  );

  app.post(
    "/api/v1/agent-workflows/runs/:workflowRunId/replay",
    {
      schema: {
        operationId: "replayAgentWorkflowRun",
        summary: "Fork a run from a still-valid checkpoint",
        tags: ["agent-workflows"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { workflowRunId } = request.params as { workflowRunId: string };
      const input = ReplayAgentWorkflowInputSchema.parse(request.body ?? {});
      return reply
        .status(201)
        .send(
          await services.replayAgentWorkflowRun(context, workflowRunId, input)
        );
    }
  );

  app.get(
    "/api/v1/agent-trust/endpoints",
    {
      schema: {
        operationId: "listAgentProtocolEndpoints",
        summary: "List tenant-reviewed MCP and A2A endpoints",
        tags: ["agent-trust"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send({
        items: await services.listAgentProtocolEndpoints(context)
      });
    }
  );

  app.post(
    "/api/v1/agent-trust/endpoints",
    {
      schema: {
        operationId: "registerAgentProtocolEndpoint",
        summary: "Register a disabled-by-default MCP or A2A endpoint",
        tags: ["agent-trust"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = RegisterAgentProtocolEndpointInputSchema.parse(
        request.body ?? {}
      );
      return reply
        .status(201)
        .send(await services.registerAgentProtocolEndpoint(context, input));
    }
  );

  app.post(
    "/api/v1/agent-trust/endpoints/:endpointId/review",
    {
      schema: {
        operationId: "reviewAgentProtocolEndpoint",
        summary: "Approve, revoke, or capability-allowlist an agent endpoint",
        tags: ["agent-trust"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { endpointId } = request.params as { endpointId: string };
      const input = ReviewAgentProtocolEndpointInputSchema.parse(
        request.body ?? {}
      );
      return reply.send(
        await services.reviewAgentProtocolEndpoint(context, endpointId, input)
      );
    }
  );

  app.post(
    "/api/v1/agent-trust/endpoints/:endpointId/discover",
    {
      schema: {
        operationId: "discoverAgentProtocolEndpoint",
        summary: "Discover capabilities without automatically importing them",
        tags: ["agent-trust"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { endpointId } = request.params as { endpointId: string };
      return reply.send(
        await services.discoverAgentProtocolEndpoint(context, endpointId)
      );
    }
  );

  app.get(
    "/api/v1/agent-trust/tck-runs",
    {
      schema: {
        operationId: "listA2ATckRuns",
        summary: "List governed official A2A TCK conformance runs",
        tags: ["agent-trust"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send({ items: await services.listA2ATckRuns(context) });
    }
  );

  app.post(
    "/api/v1/agent-trust/endpoints/:endpointId/tck-runs",
    {
      schema: {
        operationId: "runA2ATck",
        summary: "Run the official A2A TCK against an approved scoped endpoint",
        tags: ["agent-trust"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { endpointId } = request.params as { endpointId: string };
      const input = RunA2ATckInputSchema.parse(request.body ?? {});
      return reply
        .status(201)
        .send(await services.runA2ATck(context, endpointId, input));
    }
  );

  app.get(
    "/api/v1/agent-trust/did/profiles",
    {
      schema: {
        operationId: "listAgentDidTrustProfiles",
        summary:
          "List tenant-approved AgentDID issuer and subject trust profiles",
        tags: ["agent-trust"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send({
        items: await services.listAgentDidTrustProfiles(context)
      });
    }
  );

  app.post(
    "/api/v1/agent-trust/did/profiles",
    {
      schema: {
        operationId: "createAgentDidTrustProfile",
        summary:
          "Establish governed did:web trust for an approved A2A endpoint",
        tags: ["agent-trust"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = CreateAgentDidTrustProfileInputSchema.parse(
        request.body ?? {}
      );
      return reply
        .status(201)
        .send(await services.createAgentDidTrustProfile(context, input));
    }
  );

  app.post(
    "/api/v1/agent-trust/did/profiles/:profileId/refresh",
    {
      schema: {
        operationId: "refreshAgentDidTrustProfile",
        summary:
          "Re-resolve a profile and revoke credentials on DID key change",
        tags: ["agent-trust"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { profileId } = request.params as { profileId: string };
      const input = RefreshAgentDidTrustProfileInputSchema.parse(
        request.body ?? {}
      );
      return reply.send(
        await services.refreshAgentDidTrustProfile(context, profileId, input)
      );
    }
  );

  app.post(
    "/api/v1/agent-trust/did/profiles/:profileId/revoke",
    {
      schema: {
        operationId: "revokeAgentDidTrustProfile",
        summary: "Revoke an AgentDID profile and its active credentials",
        tags: ["agent-trust"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { profileId } = request.params as { profileId: string };
      const input = RevokeAgentDidTrustProfileInputSchema.parse(
        request.body ?? {}
      );
      return reply.send(
        await services.revokeAgentDidTrustProfile(context, profileId, input)
      );
    }
  );

  app.get(
    "/api/v1/agent-trust/did/credentials",
    {
      schema: {
        operationId: "listAgentVerifiableCredentials",
        summary: "List normalized AgentDID credential verification results",
        tags: ["agent-trust"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send({
        items: await services.listAgentVerifiableCredentials(context)
      });
    }
  );

  app.post(
    "/api/v1/agent-trust/did/credentials/verify",
    {
      schema: {
        operationId: "verifyAgentVerifiableCredential",
        summary: "Verify a short-lived vc+jwt delegation against did:web",
        tags: ["agent-trust"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = VerifyAgentVerifiableCredentialInputSchema.parse(
        request.body ?? {}
      );
      return reply
        .status(201)
        .send(await services.verifyAgentVerifiableCredential(context, input));
    }
  );

  app.post(
    "/api/v1/agent-trust/receipts/verify",
    {
      schema: {
        operationId: "verifyAgentSignedReceipt",
        summary: "Verify a fresh sender-bound message or artifact receipt",
        tags: ["agent-trust"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = VerifyAgentSignedReceiptInputSchema.parse(
        request.body ?? {}
      );
      return reply
        .status(201)
        .send(await services.verifyAgentSignedReceipt(context, input));
    }
  );

  app.get(
    "/api/v1/agent-trust/exchange",
    {
      schema: {
        operationId: "listAgentExchangeObjects",
        summary: "List typed A2A task, message, and artifact objects",
        tags: ["agent-trust"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send({
        items: await services.listAgentExchangeObjects(context)
      });
    }
  );

  app.get(
    "/api/v1/agent-trust/exchange/:objectId/events",
    {
      schema: {
        operationId: "streamAgentExchangeObjectState",
        summary: "Read an authenticated A2A lifecycle SSE snapshot",
        tags: ["agent-trust"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { objectId } = request.params as { objectId: string };
      const object = await services.getAgentExchangeObject(context, objectId);
      const data = JSON.stringify({
        agentExchangeObjectId: object.agentExchangeObjectId,
        kind: object.kind,
        state: object.state,
        stateReason: object.stateReason,
        updatedAt: object.updatedAt
      });
      return reply
        .header("cache-control", "no-cache, no-store")
        .header("x-accel-buffering", "no")
        .type("text/event-stream; charset=utf-8")
        .send(
          `retry: 3000\nid: ${object.updatedAt}\nevent: state\ndata: ${data}\n\n`
        );
    }
  );

  app.post(
    "/api/v1/agent-trust/exchange",
    {
      schema: {
        operationId: "createAgentExchangeObject",
        summary: "Create an idempotent redacted A2A exchange object",
        tags: ["agent-trust"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = CreateAgentExchangeObjectInputSchema.parse(
        request.body ?? {}
      );
      return reply
        .status(201)
        .send(await services.createAgentExchangeObject(context, input));
    }
  );

  app.post(
    "/api/v1/agent-trust/exchange/:objectId/state",
    {
      schema: {
        operationId: "updateAgentExchangeObjectState",
        summary: "Apply a validated A2A lifecycle transition",
        tags: ["agent-trust"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { objectId } = request.params as { objectId: string };
      const input = UpdateAgentExchangeObjectStateInputSchema.parse(
        request.body ?? {}
      );
      return reply.send(
        await services.updateAgentExchangeObjectState(context, objectId, input)
      );
    }
  );

  app.get(
    "/api/v1/agent-trust/tee-assurance",
    {
      schema: {
        operationId: "getTeeAssuranceWorkspace",
        summary: "Read the tenant TEE deployment-assurance register",
        tags: ["agent-trust"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send(await services.getTeeAssuranceWorkspace(context));
    }
  );

  app.post(
    "/api/v1/agent-trust/tee-assurance",
    {
      schema: {
        operationId: "createTeeAssuranceRequirement",
        summary: "Create an immutable TEE deployment-assurance requirement",
        tags: ["agent-trust"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = CreateTeeAssuranceRequirementInputSchema.parse(
        request.body ?? {}
      );
      return reply
        .status(201)
        .send(await services.createTeeAssuranceRequirement(context, input));
    }
  );

  app.post(
    "/api/v1/agent-trust/tee-assurance/:requirementId/evaluate",
    {
      schema: {
        operationId: "evaluateTeeAssurance",
        summary: "Seal a deterministic TEE qualification decision",
        tags: ["agent-trust"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { requirementId } = request.params as { requirementId: string };
      const input = EvaluateTeeAssuranceInputSchema.parse(request.body ?? {});
      return reply
        .status(201)
        .send(
          await services.evaluateTeeAssurance(context, requirementId, input)
        );
    }
  );

  app.post(
    "/api/v1/agent-trust/tee-assurance/:requirementId/revoke",
    {
      schema: {
        operationId: "revokeTeeAssurance",
        summary: "Append a terminal revocation receipt to a TEE qualification",
        tags: ["agent-trust"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { requirementId } = request.params as { requirementId: string };
      const input = RevokeTeeAssuranceInputSchema.parse(request.body ?? {});
      return reply
        .status(201)
        .send(await services.revokeTeeAssurance(context, requirementId, input));
    }
  );

  app.get(
    "/api/v1/agent-trust/attestations",
    {
      schema: {
        operationId: "listConfidentialAttestations",
        summary: "List persisted confidential-compute verifier results",
        tags: ["agent-trust"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send({
        items: await services.listConfidentialAttestations(context)
      });
    }
  );

  app.get(
    "/api/v1/agent-trust/attestations/veraison/sessions",
    {
      schema: {
        operationId: "listVeraisonAttestationSessions",
        summary: "List persisted Veraison challenge-response sessions",
        tags: ["agent-trust"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send({
        items: await services.listVeraisonAttestationSessions(context)
      });
    }
  );

  app.post(
    "/api/v1/agent-trust/attestations/veraison/sessions",
    {
      schema: {
        operationId: "createVeraisonAttestationSession",
        summary:
          "Create a nonce-bound session with a configured Veraison verifier",
        tags: ["agent-trust"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = CreateVeraisonAttestationSessionInputSchema.parse(
        request.body ?? {}
      );
      return reply
        .status(201)
        .send(await services.createVeraisonAttestationSession(context, input));
    }
  );

  app.post(
    "/api/v1/agent-trust/attestations/veraison/verify",
    {
      schema: {
        operationId: "verifyVeraisonAttestation",
        summary: "Submit nonce-bound evidence to a Veraison session",
        tags: ["agent-trust"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = VerifyVeraisonAttestationInputSchema.parse(
        request.body ?? {}
      );
      return reply
        .status(201)
        .send(await services.verifyVeraisonAttestation(context, input));
    }
  );

  app.post(
    "/api/v1/agent-trust/attestations/challenges",
    {
      schema: {
        operationId: "createConfidentialAttestationChallenge",
        summary: "Create a one-use confidential attestation challenge",
        tags: ["agent-trust"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = CreateConfidentialAttestationChallengeInputSchema.parse(
        request.body ?? {}
      );
      return reply
        .status(201)
        .send(
          await services.createConfidentialAttestationChallenge(context, input)
        );
    }
  );

  app.post(
    "/api/v1/agent-trust/attestations/verify",
    {
      schema: {
        operationId: "verifyConfidentialAttestation",
        summary: "Verify signed TEE or confidential-GPU deployment claims",
        tags: ["agent-trust"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = VerifyConfidentialAttestationInputSchema.parse(
        request.body ?? {}
      );
      return reply
        .status(201)
        .send(await services.verifyConfidentialAttestation(context, input));
    }
  );

  app.post(
    "/api/v1/agent-trust/extensions/compatibility",
    {
      schema: {
        operationId: "validateExtensionCompatibility",
        summary: "Validate a signed OCI extension execution contract",
        tags: ["agent-trust"]
      }
    },
    async (request, reply) => {
      await requireAuthContext(request, services, sessionSecret);
      const input = ExtensionExecutionContractSchema.parse(request.body ?? {});
      return reply.send(evaluateExtensionCompatibility(input));
    }
  );

  app.get(
    "/api/v1/extensions/workspace",
    {
      schema: {
        operationId: "getExtensionDeveloperWorkspace",
        summary: "Read tenant extension projects and immutable release state",
        tags: ["extensions"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send(await services.getExtensionDeveloperWorkspace(context));
    }
  );

  app.post(
    "/api/v1/extensions/projects",
    {
      schema: {
        operationId: "createExtensionProject",
        summary: "Create a tenant extension developer project",
        tags: ["extensions"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = CreateExtensionProjectInputSchema.parse(request.body ?? {});
      return reply
        .status(201)
        .send(await services.createExtensionProject(context, input));
    }
  );

  app.get(
    "/api/v1/extensions/projects/:projectId/scaffold",
    {
      schema: {
        operationId: "getExtensionScaffold",
        summary: "Generate a non-executing extension SDK scaffold",
        tags: ["extensions"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { projectId } = z
        .object({ projectId: z.string().uuid() })
        .parse(request.params);
      return reply.send(
        await services.getExtensionScaffold(context, projectId)
      );
    }
  );

  app.post(
    "/api/v1/extensions/projects/:projectId/releases",
    {
      schema: {
        operationId: "submitExtensionRelease",
        summary: "Submit and persist a signed immutable extension release",
        tags: ["extensions"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { projectId } = z
        .object({ projectId: z.string().uuid() })
        .parse(request.params);
      const input = SubmitExtensionReleaseInputSchema.parse(request.body ?? {});
      return reply
        .status(201)
        .send(await services.submitExtensionRelease(context, projectId, input));
    }
  );

  app.post(
    "/api/v1/extensions/releases/:releaseId/review",
    {
      schema: {
        operationId: "reviewExtensionRelease",
        summary: "Record a human extension certification decision",
        tags: ["extensions"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { releaseId } = z
        .object({ releaseId: z.string().uuid() })
        .parse(request.params);
      const input = ReviewExtensionReleaseInputSchema.parse(request.body ?? {});
      return reply.send(
        await services.reviewExtensionRelease(context, releaseId, input)
      );
    }
  );

  app.post(
    "/api/v1/extensions/releases/:releaseId/activate",
    {
      schema: {
        operationId: "activateExtensionRelease",
        summary: "Select a certified release for the tenant review catalog",
        tags: ["extensions"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { releaseId } = z
        .object({ releaseId: z.string().uuid() })
        .parse(request.params);
      const input = ExtensionLifecycleReasonInputSchema.parse(
        request.body ?? {}
      );
      return reply.send(
        await services.activateExtensionRelease(context, releaseId, input)
      );
    }
  );

  app.post(
    "/api/v1/extensions/projects/:projectId/rollback",
    {
      schema: {
        operationId: "rollbackExtensionProject",
        summary: "Roll the tenant catalog back to a certified prior release",
        tags: ["extensions"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { projectId } = z
        .object({ projectId: z.string().uuid() })
        .parse(request.params);
      const input = RollbackExtensionProjectInputSchema.parse(
        request.body ?? {}
      );
      return reply.send(
        await services.rollbackExtensionProject(context, projectId, input)
      );
    }
  );

  app.post(
    "/api/v1/extensions/releases/:releaseId/revoke",
    {
      schema: {
        operationId: "revokeExtensionRelease",
        summary: "Revoke an extension release and remove active catalog state",
        tags: ["extensions"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { releaseId } = z
        .object({ releaseId: z.string().uuid() })
        .parse(request.params);
      const input = ExtensionLifecycleReasonInputSchema.parse(
        request.body ?? {}
      );
      return reply.send(
        await services.revokeExtensionRelease(context, releaseId, input)
      );
    }
  );

  app.get(
    "/api/v1/jobs",
    {
      schema: {
        operationId: "listJobs",
        summary:
          "List tenant validation queue jobs with optional status filter",
        tags: ["system"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const query = JobsQuerySchema.parse(request.query ?? {});

      return reply.send({
        items: await services.listJobs(context, {
          limit: query.limit,
          missionId: query.missionId,
          status: query.status
        })
      });
    }
  );

  app.get(
    "/api/v1/system/deployment-status",
    {
      schema: {
        operationId: "getDeploymentStatus",
        summary: "Read production deployment configuration readiness",
        tags: ["system"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send(await services.getDeploymentStatus(context));
    }
  );

  app.get(
    "/api/v1/tenants/current/trust-safety",
    {
      schema: {
        operationId: "getTrustSafetySummary",
        summary: "Read the tenant trust and safety summary",
        tags: ["tenant"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send(await services.getTrustSafetySummary(context));
    }
  );

  // Inbound SCIM discovery stub (P17-1 / PERISCAN-30 honesty): always 501 /
  // NotConfigured with actionable residual — never silent 404, never Production.
  // Full SCIM user lifecycle is not shipped. Distinct from CyberArk connector
  // read-only inventory SCIM under packages/connectors.
  const scimNotConfiguredBody = {
    detail:
      "Inbound SCIM 2.0 provisioning of Periscan users and groups is NotConfigured and not shipped. Use admin invites or sales-assisted provisioning. Attach the sales-assisted provisioning SLA (docs/ENTERPRISE_IDENTITY_LIFECYCLE.md) to enterprise order forms. CyberArk Identity SCIM connectors are read-only inventory only — not Periscan membership lifecycle. Do not point customer IdP SCIM at this path.",
    nextSteps: [
      "Provision seats via Admin invite or sales-assisted onboarding",
      "Paste sales-assisted provisioning SLA from docs/ENTERPRISE_IDENTITY_LIFECYCLE.md into the enterprise order form / DPA annex",
      "Read residual status in docs/ops/ENTERPRISE_TRUST_RESIDUAL_2026-07-31.md",
      "Do not claim SCIM Production or full IdP lifecycle until acceptance tests exercise real membership SCIM"
    ],
    orderFormDoc: "docs/ENTERPRISE_IDENTITY_LIFECYCLE.md",
    residualDoc: "docs/ops/ENTERPRISE_TRUST_RESIDUAL_2026-07-31.md",
    schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
    scimType: "invalidValue",
    status: "501",
    statusName: "NotConfigured" as const,
    trustSafetyPath: "/api/v1/tenants/current/trust-safety"
  };

  const registerScimNotConfiguredRoute = (path: string, operationId: string) => {
    app.all(
      path,
      {
        schema: {
          hide: true,
          operationId,
          summary:
            "Inbound SCIM is NotConfigured (honest discovery stub; not a SCIM server)",
          tags: ["tenant"]
        }
      },
      async (request, reply) => {
        const context = await getAuthContext(request, services, sessionSecret);
        if (context) {
          try {
            await writeAuditEvent(getPrismaClient(), {
              action: "policy.decision",
              actorType: "User",
              entityId: context.tenant.tenantId,
              entityType: "Tenant",
              metadata: {
                decision: "Denied",
                path: request.url,
                reason: "inbound_scim_not_configured",
                status: "NotConfigured"
              },
              tenantId: context.tenant.tenantId,
              userId: context.user.userId
            });
          } catch {
            // Honesty stub must still return 501 when audit persistence is
            // unavailable (unit tests / degraded deploy).
          }
        }

        return reply
          .status(501)
          .header("content-type", "application/scim+json")
          .send(scimNotConfiguredBody);
      }
    );
  };

  registerScimNotConfiguredRoute(
    "/api/v1/scim/v2/ServiceProviderConfig",
    "scimServiceProviderConfigNotConfigured"
  );
  // Additional SCIM discovery documents (RFC 7644 §4) — same NotConfigured honesty
  // as ServiceProviderConfig so IdP probes never see silent 404 on standard paths.
  registerScimNotConfiguredRoute(
    "/api/v1/scim/v2/ResourceTypes",
    "scimResourceTypesNotConfigured"
  );
  registerScimNotConfiguredRoute(
    "/api/v1/scim/v2/Schemas",
    "scimSchemasNotConfigured"
  );
  registerScimNotConfiguredRoute(
    "/api/v1/scim/v2/Users",
    "scimUsersNotConfigured"
  );
  registerScimNotConfiguredRoute(
    "/api/v1/scim/v2/Users/:id",
    "scimUserByIdNotConfigured"
  );
  registerScimNotConfiguredRoute(
    "/api/v1/scim/v2/Groups",
    "scimGroupsNotConfigured"
  );
  registerScimNotConfiguredRoute(
    "/api/v1/scim/v2/Groups/:id",
    "scimGroupByIdNotConfigured"
  );

  app.get(
    "/api/v1/modules",
    {
      schema: {
        operationId: "listModules",
        summary: "List the available product module catalog",
        tags: ["system"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      void context;

      return reply.send({
        items: await services.getModuleCatalog()
      });
    }
  );

  app.get(
    "/api/v1/external-validation/profiles",
    {
      schema: {
        operationId: "listExternalValidationProfiles",
        summary: "List external validation template profiles",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      void context;

      return reply.send({
        items: await services.getExternalValidationProfiles()
      });
    }
  );

  app.post(
    "/api/v1/control-sources/detection-eng-tasks",
    {
      schema: {
        operationId: "createControlGapRemediation",
        summary:
          "Create a detection-eng remediation task from Logged-only / Needs tuning / Missed control coverage",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = CreateControlGapRemediationInputSchema.parse(request.body);
      return reply
        .status(201)
        .send(await services.createControlGapRemediation(context, input));
    }
  );

  app.get(
    "/api/v1/external-validation/attempts",
    {
      schema: {
        operationId: "listExternalValidationAttempts",
        summary:
          "List persisted external point-of-presence validation attempts",
        tags: ["missions"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send({
        items: await services.listExternalValidationAttempts(context)
      });
    }
  );

  app.get(
    "/api/v1/open-source-tools",
    {
      schema: {
        operationId: "listOpenSourceTools",
        summary: "List the open-source tool catalog",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const query = OpenSourceCatalogFilterSchema.parse(request.query);

      void context;

      return reply.send({
        items: await services.getOpenSourceToolCatalog(query)
      });
    }
  );

  app.get(
    "/api/v1/community/validation-suite",
    {
      schema: {
        operationId: "getCommunityValidationSuite",
        summary:
          "List the Community edition OSS/first-party validation suite (Apache-2.0 product source)",
        tags: ["missions"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const query = z
        .object({
          includeExternalPoa: z
            .union([BooleanQueryParamSchema, z.undefined()])
            .optional(),
          scopeId: z.string().uuid().optional()
        })
        .parse(request.query);
      return reply.send(
        CommunityValidationSuiteResponseSchema.parse(
          await services.getCommunityValidationSuite(context, query)
        )
      );
    }
  );

  app.get(
    "/api/v1/community/validation-runs",
    {
      schema: {
        operationId: "getCommunityValidationCompanion",
        summary:
          "Reconstruct the Nuclei second mission for a Community primary mission",
        tags: ["missions"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { missionId } = z
        .object({
          missionId: z.string().uuid()
        })
        .parse(request.query);
      return reply.send(
        CommunityValidationCompanionSchema.parse(
          await services.getCommunityValidationCompanion(context, missionId)
        )
      );
    }
  );

  app.post(
    "/api/v1/community/validation-runs/:missionId/remediations",
    {
      schema: {
        operationId: "createCommunityMissionRemediations",
        summary:
          "Create remediations from Community mission findings (Fixed still requires verification)",
        tags: ["missions"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { missionId } = z
        .object({
          missionId: z.string().uuid()
        })
        .parse(request.params);
      return reply.status(201).send(
        CommunityMissionRemediationsResultSchema.parse(
          await services.createCommunityMissionRemediations(context, missionId)
        )
      );
    }
  );

  app.post(
    "/api/v1/community/validation-runs",
    {
      schema: {
        operationId: "startCommunityValidation",
        summary:
          "Start a Community edition Validation Snapshot using the OSS/first-party suite",
        tags: ["missions"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = StartCommunityValidationRequestSchema.parse(request.body);
      return reply.send(
        CommunityValidationStartResultSchema.parse(
          await services.startCommunityValidation(context, input)
        )
      );
    }
  );

  app.get(
    "/api/v1/open-source-tools/:toolId",
    {
      schema: {
        operationId: "getOpenSourceTool",
        summary: "Read a single open-source tool catalog entry",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { toolId } = z
        .object({
          toolId: OpenSourceToolIdSchema
        })
        .parse(request.params);

      void context;

      const item = await services.getOpenSourceTool(toolId);

      if (!item) {
        return reply.status(404).send({
          error: "Open source tool not found."
        });
      }

      return reply.send(item);
    }
  );

  app.get(
    "/api/v1/open-source-capabilities",
    {
      schema: {
        operationId: "listOpenSourceCapabilities",
        summary: "List open-source tool capabilities",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const query = OpenSourceCatalogFilterSchema.parse(request.query);

      void context;

      return reply.send({
        items: await services.getOpenSourceCapabilities(query)
      });
    }
  );

  app.get(
    "/api/v1/third-party-tools/licenses",
    {
      schema: {
        operationId: "getThirdPartyToolLicenseSummary",
        summary: "Summarize governed third-party tool licenses",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send(
        await services.getThirdPartyToolLicenseSummary(context)
      );
    }
  );

  app.get(
    "/api/v1/third-party-tools/license-acceptances",
    {
      schema: {
        operationId: "listToolLicenseAcceptances",
        summary: "List tenant tool license acceptances for audit",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const query = ListToolLicenseAcceptancesQuerySchema.parse(
        request.query ?? {}
      );

      return reply.send({
        items: await services.listToolLicenseAcceptances(context, query)
      });
    }
  );

  app.post(
    "/api/v1/third-party-tools/license-acceptances",
    {
      schema: {
        operationId: "acceptToolLicense",
        summary:
          "Record tenant acceptance of an upstream tool license for a pin",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = AcceptToolLicenseRequestSchema.parse(request.body ?? {});

      return reply
        .status(201)
        .send(await services.acceptToolLicense(context, input));
    }
  );

  app.get(
    "/api/v1/third-party-tools",
    {
      schema: {
        operationId: "listThirdPartyTools",
        summary: "List governed third-party validation tools",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send({
        items: await services.listThirdPartyTools(context)
      });
    }
  );

  app.get(
    "/api/v1/third-party-tools/coverage-audit",
    {
      schema: {
        operationId: "getThirdPartyToolCoverageAudit",
        summary: "Audit reviewed third-party validation tool coverage",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send(await services.getThirdPartyToolCoverageAudit(context));
    }
  );

  app.post(
    "/api/v1/third-party-tools/refresh-due",
    {
      schema: {
        operationId: "refreshDueThirdPartyTools",
        summary: "Refresh due reviewed third-party tool metadata",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = ThirdPartyToolRefreshDueRequestSchema.parse(
        request.body ?? {}
      );

      return reply
        .status(201)
        .send(await services.refreshDueThirdPartyTools(context, input));
    }
  );

  app.post(
    "/api/v1/third-party-tools/intake/validate",
    {
      schema: {
        operationId: "validateThirdPartyToolIntake",
        summary:
          "Validate a proposed third-party tool manifest for catalog intake",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = ToolIntakeManifestRequestSchema.parse(request.body ?? {});

      return reply.send(
        await services.validateThirdPartyToolIntake(context, input)
      );
    }
  );

  app.get(
    "/api/v1/third-party-tools/intake/candidates",
    {
      schema: {
        operationId: "listThirdPartyToolCandidates",
        summary: "List third-party tool intake candidates",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send({
        items: await services.listThirdPartyToolCandidates(context)
      });
    }
  );

  app.post(
    "/api/v1/third-party-tools/intake/candidates",
    {
      schema: {
        operationId: "submitThirdPartyToolCandidate",
        summary: "Submit a third-party tool candidate for reviewed intake",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = ToolIntakeManifestRequestSchema.parse(request.body ?? {});

      return reply
        .status(201)
        .send(await services.submitThirdPartyToolCandidate(context, input));
    }
  );

  app.post(
    "/api/v1/third-party-tools/intake/candidates/import",
    {
      schema: {
        operationId: "importThirdPartyToolCandidates",
        summary:
          "Import a batch of third-party tool candidates for reviewed intake",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = ThirdPartyToolCandidateImportRequestSchema.parse(
        request.body ?? {}
      );

      return reply
        .status(201)
        .send(await services.importThirdPartyToolCandidates(context, input));
    }
  );

  app.get(
    "/api/v1/third-party-tools/intake/candidates/readiness-summary",
    {
      schema: {
        operationId: "getThirdPartyToolCandidateReadinessSummary",
        summary:
          "Summarize third-party tool candidate implementation readiness",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send(
        await services.getThirdPartyToolCandidateReadinessSummary(context)
      );
    }
  );

  app.get(
    "/api/v1/third-party-tools/intake/candidates/:candidateId/readiness",
    {
      schema: {
        operationId: "getThirdPartyToolCandidateReadiness",
        summary: "Read third-party tool candidate implementation readiness",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { candidateId } = z
        .object({
          candidateId: z.string().uuid()
        })
        .parse(request.params);
      const readiness = await services.getThirdPartyToolCandidateReadiness(
        context,
        candidateId
      );

      if (!readiness) {
        return reply.status(404).send({
          error: "Third-party tool candidate not found."
        });
      }

      return reply.send(readiness);
    }
  );

  app.post(
    "/api/v1/third-party-tools/intake/candidates/:candidateId/review",
    {
      schema: {
        operationId: "reviewThirdPartyToolCandidate",
        summary: "Review a third-party tool candidate for implementation",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { candidateId } = z
        .object({
          candidateId: z.string().uuid()
        })
        .parse(request.params);
      const input = ReviewThirdPartyToolCandidateRequestSchema.parse(
        request.body ?? {}
      );
      const candidate = await services.reviewThirdPartyToolCandidate(
        context,
        candidateId,
        input
      );

      if (!candidate) {
        return reply.status(404).send({
          error: "Third-party tool candidate not found."
        });
      }

      return reply.send(candidate);
    }
  );

  app.get(
    "/api/v1/third-party-tools/intake/candidates/:candidateId/work-orders",
    {
      schema: {
        operationId: "listThirdPartyToolImplementationWorkOrders",
        summary: "List third-party tool candidate implementation work orders",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { candidateId } = z
        .object({
          candidateId: z.string().uuid()
        })
        .parse(request.params);
      const workOrders =
        await services.listThirdPartyToolImplementationWorkOrders(
          context,
          candidateId
        );

      if (!workOrders) {
        return reply.status(404).send({
          error: "Third-party tool candidate not found."
        });
      }

      return reply.send({
        items: workOrders
      });
    }
  );

  app.post(
    "/api/v1/third-party-tools/intake/candidates/:candidateId/work-orders",
    {
      schema: {
        operationId: "generateThirdPartyToolImplementationWorkOrder",
        summary: "Generate a third-party tool implementation work order",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { candidateId } = z
        .object({
          candidateId: z.string().uuid()
        })
        .parse(request.params);
      const workOrder =
        await services.generateThirdPartyToolImplementationWorkOrder(
          context,
          candidateId
        );

      if (!workOrder) {
        return reply.status(404).send({
          error: "Third-party tool candidate not found."
        });
      }

      return reply.status(201).send(workOrder);
    }
  );

  app.get(
    "/api/v1/third-party-tools/intake/candidates/:candidateId/work-orders/:workOrderId/implementation-bundle",
    {
      schema: {
        operationId: "getThirdPartyToolImplementationBundle",
        summary:
          "Download a non-executing implementation bundle for a third-party tool work order",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { candidateId, workOrderId } = z
        .object({
          candidateId: z.string().uuid(),
          workOrderId: z.string().uuid()
        })
        .parse(request.params);
      const bundle = await services.getThirdPartyToolImplementationBundle(
        context,
        candidateId,
        workOrderId
      );

      if (!bundle) {
        return reply.status(404).send({
          error: "Third-party tool implementation work order not found."
        });
      }

      return reply.send(bundle);
    }
  );

  app.get(
    "/api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages",
    {
      schema: {
        operationId: "listThirdPartyToolPromotionPackages",
        summary: "List third-party tool candidate promotion packages",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { candidateId } = z
        .object({
          candidateId: z.string().uuid()
        })
        .parse(request.params);
      const packages = await services.listThirdPartyToolPromotionPackages(
        context,
        candidateId
      );

      if (!packages) {
        return reply.status(404).send({
          error: "Third-party tool candidate not found."
        });
      }

      return reply.send({
        items: packages
      });
    }
  );

  app.post(
    "/api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages",
    {
      schema: {
        operationId: "generateThirdPartyToolPromotionPackage",
        summary: "Generate a third-party tool promotion package",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { candidateId } = z
        .object({
          candidateId: z.string().uuid()
        })
        .parse(request.params);
      const promotionPackage =
        await services.generateThirdPartyToolPromotionPackage(
          context,
          candidateId
        );

      if (!promotionPackage) {
        return reply.status(404).send({
          error: "Third-party tool candidate not found."
        });
      }

      return reply.status(201).send(promotionPackage);
    }
  );

  app.get(
    "/api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages/:promotionPackageId/governance-handoff",
    {
      schema: {
        operationId: "getThirdPartyToolPromotionHandoff",
        summary: "Read the governed next actions for a promoted tool package",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { candidateId, promotionPackageId } = z
        .object({
          candidateId: z.string().uuid(),
          promotionPackageId: z.string().uuid()
        })
        .parse(request.params);
      const handoff = await services.getThirdPartyToolPromotionHandoff(
        context,
        candidateId,
        promotionPackageId
      );

      if (!handoff) {
        return reply.status(404).send({
          error: "Third-party tool promotion package not found."
        });
      }

      return reply.send(handoff);
    }
  );

  app.get(
    "/api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages/:promotionPackageId/certification-report",
    {
      schema: {
        operationId: "getThirdPartyToolPromotionCertification",
        summary:
          "Read current certification checks for a promoted third-party tool package",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { candidateId, promotionPackageId } = z
        .object({
          candidateId: z.string().uuid(),
          promotionPackageId: z.string().uuid()
        })
        .parse(request.params);
      const certification =
        await services.getThirdPartyToolPromotionCertification(
          context,
          candidateId,
          promotionPackageId
        );

      if (!certification) {
        return reply.status(404).send({
          error: "Third-party tool promotion package not found."
        });
      }

      return reply.send(certification);
    }
  );

  app.get(
    "/api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages/:promotionPackageId/certifications",
    {
      schema: {
        operationId: "listThirdPartyToolPromotionCertifications",
        summary:
          "List persisted certification snapshots for a promoted third-party tool package",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { candidateId, promotionPackageId } = z
        .object({
          candidateId: z.string().uuid(),
          promotionPackageId: z.string().uuid()
        })
        .parse(request.params);
      const certifications =
        await services.listThirdPartyToolPromotionCertifications(
          context,
          candidateId,
          promotionPackageId
        );

      if (!certifications) {
        return reply.status(404).send({
          error: "Third-party tool promotion package not found."
        });
      }

      return reply.send({
        items: certifications
      });
    }
  );

  app.post(
    "/api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages/:promotionPackageId/certifications",
    {
      schema: {
        operationId: "generateThirdPartyToolPromotionCertification",
        summary:
          "Persist a certification snapshot for a promoted third-party tool package",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { candidateId, promotionPackageId } = z
        .object({
          candidateId: z.string().uuid(),
          promotionPackageId: z.string().uuid()
        })
        .parse(request.params);
      const certification =
        await services.generateThirdPartyToolPromotionCertification(
          context,
          candidateId,
          promotionPackageId
        );

      if (!certification) {
        return reply.status(404).send({
          error: "Third-party tool promotion package not found."
        });
      }

      return reply.status(201).send(certification);
    }
  );

  app.get(
    "/api/v1/third-party-tools/intake/candidates/:candidateId",
    {
      schema: {
        operationId: "getThirdPartyToolCandidate",
        summary: "Read a third-party tool intake candidate",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { candidateId } = z
        .object({
          candidateId: z.string().uuid()
        })
        .parse(request.params);
      const candidate = await services.getThirdPartyToolCandidate(
        context,
        candidateId
      );

      if (!candidate) {
        return reply.status(404).send({
          error: "Third-party tool candidate not found."
        });
      }

      return reply.send(candidate);
    }
  );

  app.get(
    "/api/v1/third-party-tools/:toolId",
    {
      schema: {
        operationId: "getThirdPartyTool",
        summary: "Read a governed third-party validation tool",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { toolId } = z
        .object({
          toolId: OpenSourceToolIdSchema
        })
        .parse(request.params);
      const item = await services.getThirdPartyTool(context, toolId);

      if (!item) {
        return reply.status(404).send({
          error: "Third-party tool not found."
        });
      }

      return reply.send(item);
    }
  );

  app.get(
    "/api/v1/third-party-tools/:toolId/upstream-version-checks",
    {
      schema: {
        operationId: "listThirdPartyToolUpstreamVersionChecks",
        summary: "List trusted upstream version checks for a tool",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { toolId } = z
        .object({
          toolId: OpenSourceToolIdSchema
        })
        .parse(request.params);

      return reply.send({
        items: await services.listThirdPartyToolUpstreamVersionChecks(
          context,
          toolId
        )
      });
    }
  );

  app.post(
    "/api/v1/third-party-tools/:toolId/upstream-version-checks/check",
    {
      schema: {
        operationId: "checkThirdPartyToolUpstreamVersion",
        summary: "Check trusted upstream metadata for a tool version candidate",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { toolId } = z
        .object({
          toolId: OpenSourceToolIdSchema
        })
        .parse(request.params);

      return reply
        .status(201)
        .send(
          await services.checkThirdPartyToolUpstreamVersion(context, toolId)
        );
    }
  );

  app.get(
    "/api/v1/third-party-tools/:toolId/update-recommendations",
    {
      schema: {
        operationId: "listThirdPartyToolUpdateRecommendations",
        summary: "List reviewed-version update recommendations for a tool",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { toolId } = z
        .object({
          toolId: OpenSourceToolIdSchema
        })
        .parse(request.params);

      return reply.send({
        items: await services.listThirdPartyToolUpdateRecommendations(
          context,
          toolId
        )
      });
    }
  );

  app.post(
    "/api/v1/third-party-tools/:toolId/update-recommendations/check",
    {
      schema: {
        operationId: "checkThirdPartyToolUpdateRecommendation",
        summary: "Check for a reviewed tool version update",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { toolId } = z
        .object({
          toolId: OpenSourceToolIdSchema
        })
        .parse(request.params);

      return reply
        .status(201)
        .send(
          await services.checkThirdPartyToolUpdateRecommendation(
            context,
            toolId
          )
        );
    }
  );

  app.post(
    "/api/v1/third-party-tools/:toolId/update-recommendations/:recommendationId/apply",
    {
      schema: {
        operationId: "applyThirdPartyToolUpdateRecommendation",
        summary: "Apply a reviewed tool version recommendation",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { recommendationId, toolId } = z
        .object({
          recommendationId: z.string().uuid(),
          toolId: OpenSourceToolIdSchema
        })
        .parse(request.params);
      const input = ApplyThirdPartyToolUpdateRequestSchema.parse(
        request.body ?? {}
      );
      const recommendation =
        await services.applyThirdPartyToolUpdateRecommendation(
          context,
          toolId,
          recommendationId,
          input
        );

      if (!recommendation) {
        return reply.status(404).send({
          error: "Third-party tool update recommendation not found."
        });
      }

      return reply.send(recommendation);
    }
  );

  app.post(
    "/api/v1/third-party-tools/:toolId/update-recommendations/:recommendationId/dismiss",
    {
      schema: {
        operationId: "dismissThirdPartyToolUpdateRecommendation",
        summary: "Dismiss a reviewed tool version recommendation",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { recommendationId, toolId } = z
        .object({
          recommendationId: z.string().uuid(),
          toolId: OpenSourceToolIdSchema
        })
        .parse(request.params);
      const input = DismissThirdPartyToolUpdateRequestSchema.parse(
        request.body ?? {}
      );
      const recommendation =
        await services.dismissThirdPartyToolUpdateRecommendation(
          context,
          toolId,
          recommendationId,
          input.reason
        );

      if (!recommendation) {
        return reply.status(404).send({
          error: "Third-party tool update recommendation not found."
        });
      }

      return reply.send(recommendation);
    }
  );

  app.post(
    "/api/v1/third-party-tools/:toolId/check",
    {
      schema: {
        operationId: "checkThirdPartyTool",
        summary: "Check third-party tool runtime readiness",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { toolId } = z
        .object({
          toolId: OpenSourceToolIdSchema
        })
        .parse(request.params);

      return reply.send(await services.checkThirdPartyTool(context, toolId));
    }
  );

  app.post(
    "/api/v1/third-party-tools/:toolId/install",
    {
      schema: {
        operationId: "installThirdPartyTool",
        summary: "Request or run a governed third-party tool install",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { toolId } = z
        .object({
          toolId: OpenSourceToolIdSchema
        })
        .parse(request.params);
      const input = ThirdPartyToolInstallRequestSchema.parse(
        request.body ?? {}
      );

      return reply.send(
        await services.installThirdPartyTool(context, toolId, input)
      );
    }
  );

  app.get(
    "/api/v1/third-party-tools/:toolId/install-plan",
    {
      schema: {
        operationId: "getThirdPartyToolInstallPlan",
        summary:
          "Preview the allowlisted upstream install plan without executing it",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { toolId } = z
        .object({
          toolId: OpenSourceToolIdSchema
        })
        .parse(request.params);

      return reply.send(
        await services.getThirdPartyToolInstallPlan(context, toolId)
      );
    }
  );

  app.post(
    "/api/v1/third-party-tools/:toolId/enable",
    {
      schema: {
        operationId: "enableThirdPartyTool",
        summary: "Enable a third-party validation tool for this tenant",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { toolId } = z
        .object({
          toolId: OpenSourceToolIdSchema
        })
        .parse(request.params);
      const input = ThirdPartyToolEnableRequestSchema.parse(request.body ?? {});

      return reply.send(
        await services.enableThirdPartyTool(context, toolId, input)
      );
    }
  );

  app.post(
    "/api/v1/third-party-tools/:toolId/uninstall",
    {
      schema: {
        operationId: "uninstallThirdPartyTool",
        summary: "Uninstall a third-party tool runtime for this tenant",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { toolId } = z
        .object({
          toolId: OpenSourceToolIdSchema
        })
        .parse(request.params);
      return reply.send(
        await services.uninstallThirdPartyTool(context, toolId)
      );
    }
  );

  app.post(
    "/api/v1/third-party-tools/:toolId/disable",
    {
      schema: {
        operationId: "disableThirdPartyTool",
        summary: "Disable a third-party validation tool for this tenant",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { toolId } = z
        .object({
          toolId: OpenSourceToolIdSchema
        })
        .parse(request.params);
      const input = ThirdPartyToolDisableRequestSchema.parse(
        request.body ?? {}
      );

      return reply.send(
        await services.disableThirdPartyTool(context, toolId, input)
      );
    }
  );

  app.get(
    "/api/v1/third-party-tools/:toolId/jobs",
    {
      schema: {
        operationId: "listThirdPartyToolJobs",
        summary: "List third-party tool check/install jobs",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { toolId } = z
        .object({
          toolId: OpenSourceToolIdSchema
        })
        .parse(request.params);

      return reply.send({
        items: await services.listThirdPartyToolJobs(context, toolId)
      });
    }
  );

  app.get(
    "/api/v1/third-party-tools/:toolId/activity",
    {
      schema: {
        operationId: "listThirdPartyToolActivity",
        summary: "List third-party tool lifecycle and execution activity",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { toolId } = z
        .object({
          toolId: OpenSourceToolIdSchema
        })
        .parse(request.params);

      return reply.send({
        items: await services.listThirdPartyToolActivity(
          context,
          toolId,
          parseLimit(
            request.query && (request.query as Record<string, unknown>).limit
          )
        )
      });
    }
  );

  app.get(
    "/api/v1/third-party-tools/:toolId/runner-eligibility",
    {
      schema: {
        operationId: "getThirdPartyToolRunnerEligibility",
        summary: "Read runner execution eligibility for a governed tool",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { toolId } = z
        .object({
          toolId: OpenSourceToolIdSchema
        })
        .parse(request.params);

      return reply.send(
        await services.getThirdPartyToolRunnerEligibility(context, toolId)
      );
    }
  );

  app.post(
    "/api/v1/third-party-tools/:toolId/runner-dispatch",
    {
      schema: {
        operationId: "dispatchThirdPartyToolRunnerTask",
        summary: "Dispatch a governed third-party tool capability to a runner",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const { toolId } = z
        .object({
          toolId: OpenSourceToolIdSchema
        })
        .parse(request.params);
      const input = ThirdPartyToolRunnerDispatchRequestSchema.parse(
        request.body ?? {}
      );

      return reply
        .status(201)
        .send(
          await services.dispatchThirdPartyToolRunnerTask(
            context,
            toolId,
            input
          )
        );
    }
  );

  app.get(
    "/api/v1/signal-triggers",
    {
      schema: {
        operationId: "listSignalTriggers",
        summary: "List configured signal trigger rules",
        tags: ["signal-triggers"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      void context;

      return reply.send({
        items: await services.listSignalTriggers(context)
      });
    }
  );

  app.post(
    "/api/v1/signal-triggers/evaluate",
    {
      schema: {
        operationId: "evaluateSignalTriggers",
        summary: "Evaluate signal triggers against current signals",
        tags: ["signal-triggers"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send(await services.evaluateSignalTriggers(context));
    }
  );

  app.get(
    "/api/v1/signal-triggers/routing",
    {
      schema: {
        operationId: "getSignalTriggerRouting",
        summary: "Read signal trigger routing settings",
        tags: ["signal-triggers"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send(
        await services.getSignalTriggerRoutingSettings(context)
      );
    }
  );

  app.put(
    "/api/v1/signal-triggers/routing",
    {
      schema: {
        operationId: "updateSignalTriggerRouting",
        summary: "Update signal trigger routing settings",
        tags: ["signal-triggers"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = UpdateSignalTriggerRoutingSettingsInputSchema.parse(
        request.body
      );

      return reply.send(
        await services.updateSignalTriggerRoutingSettings(context, input)
      );
    }
  );

  app.post(
    "/api/v1/signal-triggers/:id/approve",
    {
      schema: {
        operationId: "approveSignalTrigger",
        summary: "Approve a pending signal trigger",
        tags: ["signal-triggers"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().min(1)
        })
        .parse(request.params);

      return reply
        .status(201)
        .send(await services.approveSignalTrigger(context, params.id));
    }
  );

  app.get(
    "/api/v1/signal-triggers/activity",
    {
      schema: {
        operationId: "listSignalTriggerActivity",
        summary: "List recent signal trigger activity",
        tags: ["signal-triggers"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const rawLimit =
        request.query && (request.query as Record<string, unknown>).limit;

      return reply.send({
        items: await services.listSignalTriggerActivity(context, {
          limit: parseLimit(rawLimit)
        })
      });
    }
  );

  app.post(
    "/api/v1/threat-advisories",
    {
      schema: {
        operationId: "importThreatAdvisory",
        summary: "Import a threat advisory",
        tags: ["threat-center"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = ImportThreatAdvisoryInputSchema.parse(request.body);

      return reply
        .status(201)
        .send(await services.importThreatAdvisory(context, input));
    }
  );

  app.get(
    "/api/v1/threat-advisories",
    {
      schema: {
        operationId: "listThreatAdvisories",
        summary: "List threat advisories",
        tags: ["threat-center"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const rawLimit =
        request.query && (request.query as Record<string, unknown>).limit;

      return reply.send({
        items: await services.listThreatAdvisories(context, {
          limit: parseLimit(rawLimit)
        })
      });
    }
  );

  app.post(
    "/api/v1/threat-feeds/ingest",
    {
      schema: {
        operationId: "ingestThreatFeed",
        summary: "Ingest advisories from a threat feed",
        tags: ["threat-center"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = ThreatFeedIngestionInputSchema.parse(request.body ?? {});

      return reply
        .status(201)
        .send(await services.ingestThreatFeed(context, input));
    }
  );

  app.post(
    "/api/v1/threat-feeds/schedule",
    {
      schema: {
        operationId: "setThreatFeedSchedule",
        summary:
          "Set a recurring threat-feed ingestion schedule (continuous threat center)",
        tags: ["threat-center"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = ThreatFeedScheduleInputSchema.parse(request.body ?? {});
      return reply.send(
        await services.setThreatFeedSchedule(context, {
          frequency: input.frequency ?? null
        })
      );
    }
  );

  app.get(
    "/api/v1/threat-feeds/schedule",
    {
      schema: {
        operationId: "getThreatFeedSchedule",
        summary:
          "Read the tenant's current recurring threat-feed ingestion schedule",
        tags: ["threat-center"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send(await services.getThreatFeedSchedule(context));
    }
  );

  app.post(
    "/api/v1/threat-feeds/ingest-due",
    {
      schema: {
        operationId: "runDueThreatFeedIngestion",
        summary: "Ingest the threat feed if the tenant's schedule is due",
        tags: ["threat-center"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send(await services.runDueThreatFeedIngestion(context));
    }
  );

  app.get(
    "/api/v1/threat-advisories/:id/readiness-report",
    {
      schema: {
        operationId: "getAdvisoryReadinessReport",
        summary: "Read a threat advisory readiness report",
        tags: ["threat-center"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const report = await services.getAdvisoryReadinessReport(
        context,
        params.id
      );

      if (!report) {
        return reply.status(404).send({
          error: "Threat advisory readiness report not found."
        });
      }

      return reply.send(report);
    }
  );

  app.post(
    "/api/v1/threat-advisories/:id/readiness-report/export",
    {
      schema: {
        operationId: "exportAdvisoryReadinessReport",
        summary: "Export a threat advisory readiness report",
        tags: ["threat-center"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const input = ExportReportInputSchema.parse(request.body ?? {});
      const reportExport = await services.exportAdvisoryReadinessReport(
        context,
        params.id,
        input
      );

      if (!reportExport) {
        return reply.status(404).send({
          error: "Threat advisory readiness report not found."
        });
      }

      const payload =
        reportExport.format === "pdf"
          ? Buffer.from(reportExport.content, "utf8")
          : reportExport.content;

      return reply
        .header("content-type", reportExport.contentType)
        .header(
          "content-disposition",
          `attachment; filename="${reportExport.filename}"`
        )
        .send(payload);
    }
  );

  app.get(
    "/api/v1/threat-advisories/:id",
    {
      schema: {
        operationId: "getThreatAdvisory",
        summary: "Read a single threat advisory",
        tags: ["threat-center"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const advisory = await services.getThreatAdvisory(context, params.id);

      if (!advisory) {
        return reply.status(404).send({
          error: "Threat advisory not found."
        });
      }

      return reply.send(advisory);
    }
  );

  // --- Super feed: global deduped catalog + feed health + realtime alerts ---

  app.get(
    "/api/v1/threat-intel/catalog",
    {
      schema: {
        operationId: "listThreatCatalog",
        summary: "Search the global deduped threat-intel catalog",
        tags: ["threat-intel"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const raw = (request.query ?? {}) as Record<string, unknown>;
      const kev =
        raw.kev === "true" ? true : raw.kev === "false" ? false : undefined;
      const query = ThreatCatalogQuerySchema.parse({
        kind: typeof raw.kind === "string" ? raw.kind : undefined,
        severity: typeof raw.severity === "string" ? raw.severity : undefined,
        kev,
        q: typeof raw.q === "string" && raw.q.length > 0 ? raw.q : undefined,
        limit: raw.limit === undefined ? undefined : parseLimit(raw.limit, 200)
      });
      return reply.send({
        items: await services.listThreatCatalog(context, query)
      });
    }
  );

  app.get(
    "/api/v1/threat-intel/feeds",
    {
      schema: {
        operationId: "getThreatFeedStatus",
        summary: "List super-feed sources and their poll health",
        tags: ["threat-intel"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send({ items: await services.getThreatFeedStatus(context) });
    }
  );

  app.get(
    "/api/v1/threat-intel/alerts",
    {
      schema: {
        operationId: "listThreatAlerts",
        summary: "List this tenant's realtime threat alerts",
        tags: ["threat-intel"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const raw = (request.query ?? {}) as Record<string, unknown>;
      const status =
        typeof raw.status === "string"
          ? TenantThreatAlertStatusSchema.parse(raw.status)
          : undefined;
      return reply.send({
        items: await services.listThreatAlerts(context, {
          status,
          limit:
            raw.limit === undefined ? undefined : parseLimit(raw.limit, 200)
        })
      });
    }
  );

  app.post(
    "/api/v1/threat-intel/alerts/:id/status",
    {
      schema: {
        operationId: "setThreatAlertStatus",
        summary: "Acknowledge or dismiss a tenant threat alert",
        tags: ["threat-intel"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = SetThreatAlertStatusInputSchema.parse(request.body);
      return reply.send(
        await services.setThreatAlertStatus(context, params.id, body.status)
      );
    }
  );

  app.get(
    "/api/v1/attack-techniques",
    {
      schema: {
        operationId: "listAttackTechniques",
        summary: "List ATT&CK attack techniques",
        tags: ["threat-center"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      void context;

      return reply.send({
        items: await services.listAttackTechniques()
      });
    }
  );

  app.get(
    "/api/v1/attack-techniques/:id",
    {
      schema: {
        operationId: "getAttackTechnique",
        summary: "Read a single attack technique",
        tags: ["threat-center"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      void context;

      const params = z
        .object({
          id: z.string().min(1)
        })
        .parse(request.params);
      const technique = await services.getAttackTechnique(params.id);

      if (!technique) {
        return reply.status(404).send({
          error: "Attack technique not found."
        });
      }

      return reply.send(technique);
    }
  );

  app.get(
    "/api/v1/operators",
    {
      schema: {
        operationId: "listOperators",
        summary: "List operator profiles",
        tags: ["operators"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      void context;

      return reply.send({
        items: await services.getOperatorProfiles()
      });
    }
  );

  app.get(
    "/api/v1/operators/recommendations",
    {
      schema: {
        operationId: "listOperatorRecommendationRecords",
        summary: "List persisted operator recommendation records",
        tags: ["operators"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send({
        items: await services.listOperatorRecommendationRecords(context)
      });
    }
  );

  app.post(
    "/api/v1/operators/recommendations",
    {
      schema: {
        operationId: "createOperatorRecommendationRecord",
        summary: "Create a persisted operator recommendation record",
        tags: ["operators"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = CreateOperatorRecommendationRecordInputSchema.parse(
        request.body ?? {}
      );

      return reply
        .status(201)
        .send(await services.createOperatorRecommendationRecord(context, input));
    }
  );

  app.get(
    "/api/v1/operator-recommendations",
    {
      schema: {
        operationId: "listOperatorRecommendations",
        summary: "List operator recommendations",
        tags: ["operators"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send({
        items: await services.getOperatorRecommendations(context)
      });
    }
  );

  app.post(
    "/api/v1/operator-recommendations/:id/approve",
    {
      schema: {
        operationId: "approveOperatorRecommendation",
        summary: "Approve an operator recommendation",
        tags: ["operators"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().min(1)
        })
        .parse(request.params);

      return reply
        .status(201)
        .send(await services.approveOperatorRecommendation(context, params.id));
    }
  );

  app.post(
    "/api/v1/evidence-summaries",
    {
      schema: {
        operationId: "generateEvidenceSummary",
        summary: "Generate an evidence-grounded summary",
        tags: ["evidence"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = GenerateEvidenceSummaryInputSchema.parse(
        request.body ?? {}
      );

      return reply
        .status(201)
        .send(await services.generateEvidenceSummary(context, input));
    }
  );

  app.get(
    "/api/v1/integrations/catalog",
    {
      schema: {
        operationId: "getIntegrationCatalog",
        summary: "List the integration connector catalog",
        tags: ["integrations"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      void context;

      return reply.send({
        items: await services.getIntegrationCatalog()
      });
    }
  );

  app.get(
    "/api/v1/packs/enterprise-readiness",
    {
      schema: {
        operationId: "getEnterpriseBreadthReadiness",
        summary: "Read tenant-specific enterprise breadth readiness",
        tags: ["integrations", "reports"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const [integrations, nonHumanIdentities, attestations] =
        await Promise.all([
          services.listIntegrations(context),
          services.listNonHumanIdentities(context),
          services.listConfidentialAttestations(context)
        ]);

      return reply.send(
        buildEnterpriseBreadthReadiness({
          confidentialAttestation: attestations[0] ?? null,
          integrations,
          nonHumanIdentityCount: nonHumanIdentities.identities.length
        })
      );
    }
  );

  app.get(
    "/api/v1/integrations",
    {
      schema: {
        operationId: "listIntegrations",
        summary: "List configured integrations",
        tags: ["integrations"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send({
        items: await services.listIntegrations(context)
      });
    }
  );

  app.get(
    "/api/v1/non-human-identities",
    {
      schema: {
        operationId: "listNonHumanIdentities",
        summary: "List the secret-free non-human identity risk inventory",
        tags: ["identities"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send(await services.listNonHumanIdentities(context));
    }
  );

  app.post(
    "/api/v1/non-human-identities",
    {
      schema: {
        operationId: "registerNonHumanIdentity",
        summary: "Register or update secret-free non-human identity metadata",
        tags: ["identities"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = RegisterNonHumanIdentityInputSchema.parse(request.body);
      return reply
        .status(201)
        .send(await services.registerNonHumanIdentity(context, input));
    }
  );

  app.get(
    "/api/v1/integrations/:id",
    {
      schema: {
        operationId: "getIntegration",
        summary: "Read a single integration",
        tags: ["integrations"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const integration = await services.getIntegration(context, params.id);

      if (!integration) {
        return reply.status(404).send({
          error: "Integration not found."
        });
      }

      return reply.send(integration);
    }
  );

  app.post(
    "/api/v1/integrations",
    {
      schema: {
        operationId: "createIntegration",
        summary: "Create an integration",
        tags: ["integrations"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = CreateIntegrationInputSchema.parse(request.body);

      return reply
        .status(201)
        .send(await services.createIntegration(context, input));
    }
  );

  app.post(
    "/api/v1/integrations/sync-due",
    {
      schema: {
        operationId: "runDueIntegrationSyncs",
        summary: "Run all integration syncs that are due",
        tags: ["integrations"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply
        .status(200)
        .send(await services.runDueIntegrationSyncs(context));
    }
  );

  app.post(
    "/api/v1/integrations/:id/sync-schedule",
    {
      schema: {
        operationId: "setIntegrationSyncSchedule",
        summary: "Set the sync schedule for an integration",
        tags: ["integrations"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = z
        .object({ frequency: ScheduleFrequencySchema.nullable() })
        .parse(request.body);

      return reply
        .status(200)
        .send(
          await services.setIntegrationSyncSchedule(context, params.id, input)
        );
    }
  );

  app.post(
    "/api/v1/integrations/github/connect",
    {
      schema: {
        operationId: "connectGithubIntegration",
        summary: "Connect a GitHub integration",
        tags: ["integrations"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = GitHubConnectInputSchema.parse(request.body);

      return reply.status(201).send(
        await services.createIntegration(context, {
          ...input,
          connectorKey: "github"
        })
      );
    }
  );

  app.post(
    "/api/v1/integrations/aws/connect",
    {
      schema: {
        operationId: "connectAwsIntegration",
        summary: "Connect an AWS integration",
        tags: ["integrations"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = AwsConnectInputSchema.parse(request.body);

      return reply.status(201).send(
        await services.createIntegration(context, {
          ...input,
          connectorKey: "aws"
        })
      );
    }
  );

  app.post(
    "/api/v1/integrations/jira/mock-connect",
    {
      schema: {
        operationId: "connectJiraMockIntegration",
        summary: "Connect a mock Jira integration",
        tags: ["integrations"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = JiraConnectInputSchema.parse(request.body ?? {});

      return reply.status(201).send(
        await services.createIntegration(context, {
          ...input,
          connectorKey: "jira",
          mockMode: input.mockMode ?? true
        })
      );
    }
  );

  app.get(
    "/api/v1/integrations/:id/health",
    {
      schema: {
        operationId: "getIntegrationHealth",
        summary: "Read the health of an integration",
        tags: ["integrations"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);

      const t0 = Date.now();
      const result = await services.getIntegrationHealth(context, params.id);
      const durationMs = Date.now() - t0;
      app.log.info(
        {
          op: "connector.health",
          integrationId: params.id,
          durationMs,
          tenantId: context.tenant.tenantId
        },
        "connector health checked"
      );
      return reply.send(result);
    }
  );

  app.post(
    "/api/v1/integrations/:id/sync",
    {
      schema: {
        operationId: "syncIntegration",
        summary: "Trigger a sync for an integration",
        tags: ["integrations"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);

      const t0 = Date.now();
      const result = await services.syncIntegration(context, params.id);
      const durationMs = Date.now() - t0;
      app.log.info(
        {
          op: "connector.sync",
          integrationId: params.id,
          durationMs,
          tenantId: context.tenant.tenantId
        },
        "connector sync completed"
      );
      return reply.send(result);
    }
  );

  app.delete(
    "/api/v1/integrations/:id",
    {
      schema: {
        operationId: "deleteIntegration",
        summary: "Delete an integration",
        tags: ["integrations"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);

      await services.deleteIntegration(context, params.id);

      return reply.status(204).send();
    }
  );

  app.get(
    "/api/v1/audit-events",
    {
      schema: {
        operationId: "listAuditEvents",
        summary: "List tenant audit events",
        tags: ["audit"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const query = AuditEventQuerySchema.parse(request.query ?? {});
      const requestedLimit = parseLimit(
        request.query && (request.query as Record<string, unknown>).limit
      );
      const fetchLimit = requestedLimit + 1;
      const fetched = await services.listAuditEvents(context, {
        ...query,
        limit: fetchLimit
      });

      return reply.send({
        items: fetched.slice(0, requestedLimit),
        page: {
          hasMore: fetched.length > requestedLimit,
          limit: requestedLimit,
          offset: query.offset
        }
      });
    }
  );

  app.get(
    "/api/v1/scopes",
    {
      schema: {
        operationId: "listScopes",
        summary: "List engagement scopes",
        tags: ["scopes"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send({
        items: await services.listScopes(context)
      });
    }
  );

  app.post(
    "/api/v1/scopes",
    {
      schema: {
        operationId: "createScope",
        summary: "Create an engagement scope",
        tags: ["scopes"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      const input = CreateScopeInputSchema.parse(request.body);
      const result = await withIdempotencyKey({
        body: input,
        execute: async () => ({
          body: await services.createScope(context, input),
          statusCode: 201
        }),
        key: readIdempotencyKeyFromRequest(request.headers),
        route: IDEMPOTENT_ROUTES.createScope,
        store: idempotencyStore,
        tenantId: context.tenant.tenantId
      });
      if (result.replayed) {
        reply.header("idempotency-replayed", "true");
      }
      return reply.status(result.statusCode).send(result.body);
    }
  );

  app.get(
    "/api/v1/scopes/:id",
    {
      schema: {
        operationId: "getScope",
        summary: "Read a single scope",
        tags: ["scopes"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const scope = await services.getScope(context, params.id);

      if (!scope) {
        return reply.status(404).send({
          error: "Scope not found."
        });
      }

      return reply.send(scope);
    }
  );

  app.patch(
    "/api/v1/scopes/:id/classification",
    {
      schema: {
        operationId: "updateScopeClassification",
        summary: "Update a scope safety classification and enforced ceiling",
        tags: ["scopes"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = UpdateScopeClassificationInputSchema.parse(request.body);

      return reply.send(
        await services.updateScopeClassification(context, params.id, input)
      );
    }
  );

  app.delete(
    "/api/v1/scopes/:id",
    {
      schema: {
        operationId: "deleteScope",
        summary: "Delete a scope",
        tags: ["scopes"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);

      await services.deleteScope(context, params.id);

      return reply.status(204).send();
    }
  );

  app.post(
    "/api/v1/scopes/:id/verify",
    {
      schema: {
        operationId: "verifyScope",
        summary: "Verify ownership of a scope",
        tags: ["scopes"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const input = VerifyScopeInputSchema.parse(request.body ?? {});

      return reply.send(await services.verifyScope(context, params.id, input));
    }
  );

  // Freemium / LightExternalScan: Domain-only entry with consent. Domain
  // verify is DNS TXT (SETTLED PERISCAN-506); do not skip via devModeManual.
  app.post(
    "/api/v1/light-external-scans",
    {
      schema: {
        operationId: "createLightExternalScan",
        summary:
          "Create light external ASV/EASM scan (freemium tier, domain only, consent required)",
        tags: ["scopes"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      const input = LightExternalScanInputSchema.parse(request.body ?? {});

      // domain only
      const scope = await services.createScope(
        context,
        CreateScopeInputSchema.parse({
          assetClass: "BusinessApplication",
          businessCriticality: "Moderate",
          externalValidationProfileId: "safe-baseline",
          maxSafetyLevel: "PassiveReadOnly",
          scopeType: "Domain",
          sensitivity: "Moderate",
          tags: ["internet-facing", "light-external-scan"],
          value: input.domain
        })
      );

      const verifiedScope = await services.verifyScope(context, scope.scopeId, {
        devModeManual: false
      });

      if (verifiedScope.verificationStatus !== "Verified") {
        throw new AppServiceError(
          "DNS TXT verification is required before a light external scan can start.",
          400,
          "dns_verification_failed"
        );
      }

      // limited schedule create (ValidationSnapshot for external ASV/EASM; weekly; small config)
      const schedule = await services.createSchedule(context, {
        frequency: "Weekly",
        missionType: "ValidationSnapshot",
        scopeIds: [verifiedScope.scopeId],
        config: {
          maxTopItems: 3,
          audience: "Light External Scan"
        }
      });

      return reply.status(201).send({
        scope: verifiedScope,
        schedule,
        note: "Light external scan (freemium LightExternalScan tier) created. Domain only; limited ASV/EASM external. No full swarm."
      });
    }
  );

  app.post(
    "/api/v1/scopes/:id/posture-check",
    {
      schema: {
        operationId: "runScopePostureChecks",
        summary:
          "Run measured posture checks (TLS/DNS/HTTP/email) against a verified scope",
        tags: ["scopes"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const input = ScopePostureCheckInputSchema.parse(request.body ?? {});

      return reply
        .status(201)
        .send(await services.runScopePostureChecks(context, params.id, input));
    }
  );

  app.post(
    "/api/v1/scopes/:id/policy-decisions/preview",
    {
      schema: {
        operationId: "previewScopePolicyDecision",
        summary: "Preview a policy decision for a scope",
        tags: ["scopes"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const input = PolicyPreviewInputSchema.parse(request.body);

      const t0 = Date.now();
      const decision = await services.previewPolicyDecision(
        context,
        params.id,
        input
      );
      const durationMs = Date.now() - t0;
      app.log.info(
        {
          op: "policy.preview",
          scopeId: params.id,
          durationMs,
          requestedAction: input.requestedAction,
          safetyLevel: input.safetyLevel,
          missionType: input.missionType,
          tenantId: context.tenant.tenantId
        },
        "policy preview completed"
      );
      return reply.status(201).send(decision);
    }
  );

  app.post(
    "/api/v1/missions",
    {
      schema: {
        operationId: "createMission",
        summary: "Create a validation mission",
        tags: ["missions"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = CreateMissionInputSchema.parse(request.body);

      const result = await withIdempotencyKey({
        body: input,
        execute: async () => {
          const t0 = Date.now();
          const mission = await services.createMission(context, input);
          const durationMs = Date.now() - t0;
          app.log.info(
            {
              op: "mission.create",
              missionId: mission.missionId,
              status: mission.status,
              durationMs,
              tenantId: context.tenant.tenantId
            },
            "mission created"
          );
          return { body: mission, statusCode: 201 };
        },
        key: readIdempotencyKeyFromRequest(request.headers),
        route: IDEMPOTENT_ROUTES.createMission,
        store: idempotencyStore,
        tenantId: context.tenant.tenantId
      });
      if (result.replayed) {
        reply.header("idempotency-replayed", "true");
      }
      return reply.status(result.statusCode).send(result.body);
    }
  );

  app.get(
    "/api/v1/missions",
    {
      schema: {
        operationId: "listMissions",
        summary: "List validation missions",
        tags: ["missions"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const query = MissionListQuerySchema.parse(request.query ?? {});

      return reply.send(
        await services.listMissions(context, {
          cursor: query.cursor,
          limit: query.limit
        })
      );
    }
  );

  app.get(
    "/api/v1/missions/:id/runs/:runId",
    {
      schema: {
        operationId: "getMissionRun",
        summary: "Read a validation run status, errors, and evidence ids",
        tags: ["missions"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid(),
          runId: z.string().uuid()
        })
        .parse(request.params);
      const run = await services.getMissionRun(
        context,
        params.id,
        params.runId
      );

      if (!run) {
        return reply.status(404).send({
          code: "not_found",
          error: "Validation run not found."
        });
      }

      return reply.send(run);
    }
  );

  app.get(
    "/api/v1/missions/:id/runs/:runId/wait",
    {
      schema: {
        operationId: "waitMissionRun",
        summary:
          "Long-poll a validation run until terminal status or timeout (max 60s)",
        tags: ["missions"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid(),
          runId: z.string().uuid()
        })
        .parse(request.params);
      const query = MissionRunWaitQuerySchema.parse(request.query ?? {});
      const result = await services.waitMissionRun(
        context,
        params.id,
        params.runId,
        { timeoutMs: query.timeoutMs }
      );

      if (!result) {
        return reply.status(404).send({
          code: "not_found",
          error: "Validation run not found."
        });
      }

      if (result.timedOut) {
        reply.header("Retry-After", "1");
        return reply.status(408).send(result.run);
      }

      return reply.send(result.run);
    }
  );

  app.get(
    "/api/v1/jobs/:jobId",
    {
      schema: {
        operationId: "getJob",
        summary: "Read a single validation queue job by id",
        tags: ["system"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          jobId: z.string().uuid()
        })
        .parse(request.params);
      const job = await services.getJob(context, params.jobId);

      if (!job) {
        return reply.status(404).send({
          code: "not_found",
          error: "Job not found."
        });
      }

      return reply.send(job);
    }
  );

  app.get(
    "/api/v1/missions/:id",
    {
      schema: {
        operationId: "getMission",
        summary: "Read a single validation mission",
        tags: ["missions"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const mission = await services.getMission(context, params.id);

      if (!mission) {
        return reply.status(404).send({
          error: "Mission not found."
        });
      }

      return reply.send(mission);
    }
  );

  app.post(
    "/api/v1/missions/:id/start",
    {
      schema: {
        operationId: "startMission",
        summary: "Start a validation mission",
        tags: ["missions"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const input = StartMissionInputSchema.parse(request.body);

      const result = await withIdempotencyKey({
        body: { ...input, missionId: params.id },
        execute: async () => {
          const t0 = Date.now();
          const start = await services.startMission(
            context,
            params.id,
            input,
            request.id
          );
          const durationMs = Date.now() - t0;
          app.log.info(
            {
              op: "mission.start",
              missionId: params.id,
              durationMs,
              jobsQueued: start.jobsQueued,
              runs: start.runs.length,
              tenantId: context.tenant.tenantId
            },
            "mission start processed"
          );
          const startResult = start as {
            jobsQueued: number;
            mission?: { status?: string };
            runs: unknown[];
          };
          if (
            startResult.jobsQueued === 0 &&
            startResult.mission?.status?.includes("Denied")
          ) {
            app.log.warn(
              {
                op: "mission.denied",
                missionId: params.id,
                status: startResult.mission?.status,
                tenantId: context.tenant.tenantId
              },
              "mission start denied by policy"
            );
          }
          return { body: start, statusCode: 200 };
        },
        key: readIdempotencyKeyFromRequest(request.headers),
        route: IDEMPOTENT_ROUTES.startMission,
        store: idempotencyStore,
        tenantId: context.tenant.tenantId
      });
      if (result.replayed) {
        reply.header("idempotency-replayed", "true");
      }
      return reply.status(result.statusCode).send(result.body);
    }
  );

  app.post(
    "/api/v1/missions/:id/cancel",
    {
      schema: {
        operationId: "cancelMission",
        summary: "Cancel a validation mission",
        tags: ["missions"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);

      const mission = await services.cancelMission(context, params.id);
      app.log.info(
        {
          missionId: params.id,
          op: "mission.cancel",
          tenantId: context.tenant.tenantId
        },
        "mission cancelled"
      );

      return reply.send(mission);
    }
  );

  app.get(
    "/api/v1/missions/:id/runs",
    {
      schema: {
        operationId: "listMissionRuns",
        summary: "List validation runs for a mission",
        tags: ["missions"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);

      return reply.send({
        items: await services.listMissionRuns(context, params.id)
      });
    }
  );

  app.get(
    "/api/v1/findings",
    {
      schema: {
        operationId: "listFindings",
        summary: "List validated findings",
        tags: ["findings"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const filters = ValidatedFindingFilterSchema.parse(request.query);
      const limit = filters.limit ?? 100;
      const items = await services.listValidatedFindings(context, {
        ...filters,
        limit: limit + 1,
        offset: filters.offset ?? 0
      });

      return reply.send({
        items: items.slice(0, limit),
        page: {
          hasMore: items.length > limit,
          limit,
          offset: filters.offset ?? 0
        }
      });
    }
  );

  app.get(
    "/api/v1/findings.sarif",
    {
      schema: {
        operationId: "exportFindingsSarif",
        summary:
          "Export evidence-backed findings as Community SARIF 2.1.0",
        tags: ["findings"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const query = z
        .object({
          missionId: z.string().uuid().optional()
        })
        .parse(request.query);
      const items = await services.listValidatedFindings(context, {
        missionId: query.missionId
      });

      return reply.type(SARIF_CONTENT_TYPE).send(toSarif(items));
    }
  );

  // Register before /findings/:id so "disposition-feedback" is not parsed as a UUID.
  app.get(
    "/api/v1/findings/disposition-feedback",
    {
      schema: {
        operationId: "listDispositionFeedback",
        summary:
          "Aggregate FalsePositive/Suppressed dispositions by reason, fingerprint, and source",
        tags: ["findings"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send(
        DispositionFeedbackSummarySchema.parse(
          await services.listDispositionFeedback(context)
        )
      );
    }
  );

  app.get(
    "/api/v1/findings/:id",
    {
      schema: {
        operationId: "getFinding",
        summary: "Read a single validated finding",
        tags: ["findings"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const finding = await services.getValidatedFinding(context, params.id);

      if (!finding) {
        return reply.status(404).send({
          error: "Finding not found."
        });
      }

      return reply.send(finding);
    }
  );

  app.post(
    "/api/v1/findings/:id/transition",
    {
      schema: {
        operationId: "transitionFinding",
        summary: "Set or clear an analyst disposition on a finding",
        tags: ["findings"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = TransitionFindingInputSchema.parse(request.body);

      return reply.send(
        await services.transitionFinding(context, params.id, input)
      );
    }
  );

  app.post(
    "/api/v1/findings/:id/approve-risk",
    {
      schema: {
        operationId: "approveFindingRisk",
        summary: "Approve a pending risk acceptance as a distinct reviewer",
        tags: ["findings"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      return reply.send(await services.approveFindingRisk(context, params.id));
    }
  );

  app.get(
    "/api/v1/assets",
    {
      schema: {
        operationId: "listAssets",
        summary: "List discovered tenant assets and financial assumptions",
        tags: ["assets"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send({ items: await services.listAssets(context) });
    }
  );

  app.get(
    "/api/v1/data-fabric/ownership-surface",
    {
      schema: {
        operationId: "getAssetOwnershipSurface",
        summary:
          "Map internet-facing assets to verified ownership roots with evidence provenance",
        tags: ["data-fabric"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send(
        AssetOwnershipSurfaceSchema.parse(
          await services.getAssetOwnershipSurface(context)
        )
      );
    }
  );

  app.get(
    "/api/v1/data-fabric/quality-surface",
    {
      schema: {
        operationId: "getDataFabricQualitySurface",
        summary:
          "Read connector freshness, health, and normalized-evidence quality posture",
        tags: ["data-fabric"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send(
        DataFabricQualitySurfaceSchema.parse(
          await services.getDataFabricQualitySurface(context)
        )
      );
    }
  );

  app.post(
    "/api/v1/data-fabric/scan-import",
    {
      schema: {
        operationId: "importScanFile",
        summary:
          "Import a scoped Nessus/CSV/SARIF scan file as Imported signals (not Measured)",
        tags: ["data-fabric"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = ImportScanFileInputSchema.parse(request.body ?? {});
      return reply.status(201).send(
        ScanImportResultSchema.parse(
          await services.importScanFile(context, input)
        )
      );
    }
  );

  app.patch(
    "/api/v1/data-fabric/ownership-candidates/:id/review",
    {
      schema: {
        operationId: "reviewAssetOwnershipCandidate",
        summary:
          "Record a governed review without promoting an ownership candidate into authorized scope",
        tags: ["data-fabric"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = ReviewAssetOwnershipCandidateInputSchema.parse(
        request.body
      );
      return reply.send(
        AssetOwnershipReviewSchema.parse(
          await services.reviewAssetOwnershipCandidate(
            context,
            params.id,
            input
          )
        )
      );
    }
  );

  app.get(
    "/api/v1/data-fabric/assets/:id/lineage",
    {
      schema: {
        operationId: "getAssetLineage",
        summary:
          "Inspect canonical asset resolution, source observations, and conflicts",
        tags: ["data-fabric"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const lineage = await services.getAssetLineage(context, params.id);
      if (!lineage) {
        throw new AppServiceError(
          "Asset lineage not found.",
          404,
          "asset_lineage_not_found"
        );
      }
      return reply.send(AssetLineageSchema.parse(lineage));
    }
  );

  app.patch(
    "/api/v1/assets/:id/valuation",
    {
      schema: {
        operationId: "updateAssetValuationLegacy",
        summary:
          "Retired direct-update route; use governed valuation versions instead",
        tags: ["assets"]
      }
    },
    async (request) => {
      await requireAuthContext(request, services, sessionSecret);
      throw new AppServiceError(
        "Direct valuation updates are retired. Preview and submit a governed assumption version for review.",
        410,
        "asset_valuation_direct_update_retired"
      );
    }
  );

  app.get(
    "/api/v1/attack-paths",
    {
      schema: {
        operationId: "listAttackPaths",
        summary: "List attack path assessments",
        tags: ["attack-paths"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      // Limit-capped bare `{ items }` only (P20-2). No page/offset envelope —
      // OAS documents optional ?limit= (default 50, max 200).
      const rawLimit =
        request.query && (request.query as Record<string, unknown>).limit;
      const limit = parseLimit(rawLimit, 200);
      const items = await services.listAttackPaths(context);

      return reply.send({
        items: items.slice(0, limit)
      });
    }
  );

  app.get(
    "/api/v1/attack-paths/choke-points",
    {
      schema: {
        operationId: "getAttackPathChokePointAnalysis",
        summary: "Optimize graph-wide attack-path control points",
        tags: ["attack-paths"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send(
        await services.getAttackPathChokePointAnalysis(context)
      );
    }
  );

  app.get(
    "/api/v1/attack-paths/:id",
    {
      schema: {
        operationId: "getAttackPath",
        summary: "Read a single attack path assessment",
        tags: ["attack-paths"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const attackPath = await services.getAttackPath(context, params.id);

      if (!attackPath) {
        return reply.status(404).send({
          error: "Attack path not found."
        });
      }

      return reply.send(attackPath);
    }
  );

  app.post(
    "/api/v1/attack-paths/:id/verify",
    {
      schema: {
        operationId: "requestAttackPathVerification",
        summary: "Request policy-gated verification for an attack path",
        tags: ["attack-paths"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const input = VerifyAttackPathInputSchema.parse(request.body ?? {});

      return reply
        .status(201)
        .send(
          await services.requestAttackPathVerification(
            context,
            params.id,
            input
          )
        );
    }
  );

  app.get(
    "/api/v1/attack-paths/:id/evidence",
    {
      schema: {
        operationId: "listAttackPathEvidence",
        summary: "List evidence for an attack path",
        tags: ["attack-paths"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);

      return reply.send({
        items: await services.listAttackPathEvidence(context, params.id)
      });
    }
  );

  app.get(
    "/api/v1/attack-paths/:id/validation-plan",
    {
      schema: {
        operationId: "getAttackPathValidationPlan",
        summary: "Build an edge-level validation plan for an attack path",
        tags: ["attack-paths"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);

      return reply.send(
        await services.getAttackPathValidationPlan(context, params.id)
      );
    }
  );

  app.get(
    "/api/v1/attack-paths/:id/edge-receipts",
    {
      schema: {
        operationId: "listAttackPathEdgeReceipts",
        summary: "List path-edge measurement receipts for an attack path",
        tags: ["attack-paths"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);

      return reply.send({
        items: await services.listAttackPathEdgeReceipts(context, params.id)
      });
    }
  );

  app.get(
    "/api/v1/attack-paths/:id/measurement-state",
    {
      schema: {
        operationId: "getAttackPathMeasurementState",
        summary: "Read edge measurement state for an attack path",
        tags: ["attack-paths"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);

      return reply.send(
        await services.getAttackPathMeasurementState(context, params.id)
      );
    }
  );

  app.get(
    "/api/v1/attack-paths/:id/next-mission",
    {
      schema: {
        operationId: "getAttackPathNextMission",
        summary:
          "Signal-driven next recommended mission for a path (advisory, human-gated)",
        tags: ["attack-paths"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);

      const recommendation = await services.getAttackPathNextMission(
        context,
        params.id
      );

      // Always 200 with nullable recommendation so UI can render honest empty
      // state without treating "no evidence yet" as a hard error.
      return reply.send({ recommendation });
    }
  );

  app.post(
    "/api/v1/attack-paths/:id/next-mission/approve",
    {
      schema: {
        operationId: "approveAttackPathNextMission",
        summary:
          "Approve the path next recommended mission (creates Draft; never auto-queues)",
        tags: ["attack-paths"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);

      return reply
        .status(201)
        .send(await services.approveAttackPathNextMission(context, params.id));
    }
  );

  app.post(
    "/api/v1/attack-paths/:id/edges/:edgeId/receipts",
    {
      schema: {
        operationId: "applyPathEdgeReceipt",
        summary: "Apply a measurement receipt to a single attack-path edge",
        tags: ["attack-paths"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          edgeId: z.string().uuid(),
          id: z.string().uuid()
        })
        .parse(request.params);
      const input = ApplyPathEdgeReceiptInputSchema.parse({
        ...(request.body && typeof request.body === "object"
          ? request.body
          : {}),
        pathEdgeId: params.edgeId,
        pathId: params.id
      });

      return reply
        .status(201)
        .send(
          await services.applyPathEdgeReceipt(
            context,
            params.id,
            params.edgeId,
            input
          )
        );
    }
  );

  app.post(
    "/api/v1/attack-paths/:id/edges/:edgeId/validate",
    {
      schema: {
        operationId: "launchPathEdgeValidation",
        summary:
          "Request policy-gated validation for a single attack-path edge",
        tags: ["attack-paths"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          edgeId: z.string().uuid(),
          id: z.string().uuid()
        })
        .parse(request.params);
      const input = LaunchPathEdgeValidationInputSchema.parse({
        ...(request.body && typeof request.body === "object"
          ? request.body
          : {}),
        pathEdgeId: params.edgeId,
        pathId: params.id
      });

      return reply
        .status(201)
        .send(
          await services.launchPathEdgeValidation(
            context,
            params.id,
            params.edgeId,
            input
          )
        );
    }
  );

  app.get(
    "/api/v1/compliance/governance",
    {
      schema: {
        operationId: "getComplianceGovernance",
        summary: "Read versioned compliance control governance",
        tags: ["compliance"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const query = z
        .object({ framework: ComplianceFrameworkKeySchema })
        .parse(request.query);
      return reply.send(
        await services.getComplianceGovernance(context, query.framework)
      );
    }
  );

  app.get(
    "/api/v1/compliance/governance/summary",
    {
      schema: {
        operationId: "getComplianceGovernanceSummary",
        summary:
          "Multi-framework compliance governance rollup (evidence-support only; not certification)",
        tags: ["compliance"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send(await services.getComplianceGovernanceSummary(context));
    }
  );

  app.post(
    "/api/v1/compliance/governance",
    {
      schema: {
        operationId: "updateComplianceControlGovernance",
        summary:
          "Update compliance ownership, evidence request, exception, and sign-off",
        tags: ["compliance"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = UpdateComplianceControlGovernanceInputSchema.parse(
        request.body
      );
      return reply.send(
        await services.updateComplianceControlGovernance(context, input)
      );
    }
  );

  app.post(
    "/api/v1/compliance/governance/batch",
    {
      schema: {
        operationId: "batchUpdateComplianceGovernance",
        summary:
          "Batch compliance governance sign-off across frameworks (requires not-certification acknowledgement)",
        tags: ["compliance"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = BatchComplianceGovernanceInputSchema.parse(request.body);
      return reply.send(
        await services.batchUpdateComplianceGovernance(context, input)
      );
    }
  );

  app.post(
    "/api/v1/compliance/exports/multi-framework",
    {
      schema: {
        operationId: "exportMultiFrameworkCompliancePacks",
        summary:
          "Create multi-framework compliance evidence packs for one snapshot (not certification)",
        tags: ["compliance"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = MultiFrameworkComplianceExportInputSchema.parse(
        request.body
      );
      return reply
        .status(201)
        .send(
          await services.exportMultiFrameworkCompliancePacks(context, input)
        );
    }
  );

  app.get(
    "/api/v1/compliance/governance/history",
    {
      schema: {
        operationId: "listComplianceGovernanceChanges",
        summary: "Read append-only compliance governance history",
        tags: ["compliance"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const query = z
        .object({
          controlId: z.string().min(1).optional(),
          framework: ComplianceFrameworkKeySchema
        })
        .parse(request.query);
      return reply.send({
        items: await services.listComplianceGovernanceChanges(
          context,
          query.framework,
          query.controlId
        )
      });
    }
  );

  app.get(
    "/api/v1/remediations",
    {
      schema: {
        operationId: "listRemediations",
        summary: "List remediation tasks",
        tags: ["remediation"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      // Limit-capped bare `{ items }` only (P20-2). No page/offset envelope —
      // OAS documents optional ?limit= (default 50, max 200).
      const rawLimit =
        request.query && (request.query as Record<string, unknown>).limit;
      const limit = parseLimit(rawLimit, 200);
      const items = await services.listRemediations(context);

      return reply.send({
        items: items.slice(0, limit)
      });
    }
  );

  app.post(
    "/api/v1/remediations",
    {
      schema: {
        operationId: "createRemediation",
        summary: "Create a remediation task",
        tags: ["remediation"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = CreateRemediationInputSchema.parse(request.body);
      const result = await withIdempotencyKey({
        body: input,
        execute: async () => ({
          body: await services.createRemediation(context, input),
          statusCode: 201
        }),
        key: readIdempotencyKeyFromRequest(request.headers),
        route: IDEMPOTENT_ROUTES.createRemediation,
        store: idempotencyStore,
        tenantId: context.tenant.tenantId
      });
      if (result.replayed) {
        reply.header("idempotency-replayed", "true");
      }
      return reply.status(result.statusCode).send(result.body);
    }
  );

  app.get(
    "/api/v1/remediations/:id",
    {
      schema: {
        operationId: "getRemediation",
        summary: "Read a single remediation task",
        tags: ["remediation"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const remediation = await services.getRemediation(context, params.id);

      if (!remediation) {
        return reply.status(404).send({
          error: "Remediation not found."
        });
      }

      return reply.send(remediation);
    }
  );

  app.post(
    "/api/v1/remediations/:id/create-ticket",
    {
      schema: {
        operationId: "createRemediationTicket",
        summary: "Create an external ticket for a remediation",
        tags: ["remediation"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const input = CreateRemediationTicketInputSchema.parse(
        request.body ?? {}
      );
      const result = await withIdempotencyKey({
        body: { ...input, remediationId: params.id },
        execute: async () => ({
          body: await services.createRemediationTicket(
            context,
            params.id,
            input
          ),
          statusCode: 200
        }),
        key: readIdempotencyKeyFromRequest(request.headers),
        route: IDEMPOTENT_ROUTES.createRemediationTicket,
        store: idempotencyStore,
        tenantId: context.tenant.tenantId
      });
      if (result.replayed) {
        reply.header("idempotency-replayed", "true");
      }
      return reply.status(result.statusCode).send(result.body);
    }
  );

  app.post(
    "/api/v1/remediations/:id/sync-ticket",
    {
      schema: {
        operationId: "syncRemediationTicket",
        summary: "Read and synchronize external ticket state",
        tags: ["remediation"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = SyncRemediationTicketInputSchema.parse(request.body ?? {});
      return reply.send(
        await services.syncRemediationTicket(context, params.id, input)
      );
    }
  );

  app.get(
    "/api/v1/remediations/:id/actions",
    {
      schema: {
        operationId: "listRemediationActions",
        summary: "List governed action manifests for a remediation",
        tags: ["remediation"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      return reply.send({
        items: await services.listRemediationActions(context, params.id)
      });
    }
  );

  app.post(
    "/api/v1/remediations/:id/actions/preview",
    {
      schema: {
        operationId: "previewRemediationAction",
        summary: "Preview and hash an exact governed remediation action",
        tags: ["remediation"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = PreviewRemediationActionInputSchema.parse(request.body);
      return reply
        .status(201)
        .send(
          await services.previewRemediationAction(context, params.id, input)
        );
    }
  );

  for (const operation of ["approve", "execute", "rollback"] as const) {
    app.post(
      `/api/v1/remediation-actions/:id/${operation}`,
      {
        schema: {
          operationId: `${operation}RemediationAction`,
          summary: `${operation} the exact governed remediation action`,
          tags: ["remediation"]
        }
      },
      async (request, reply) => {
        const context = await requireAuthContext(
          request,
          services,
          sessionSecret
        );
        const params = z
          .object({ id: z.string().uuid() })
          .parse(request.params);
        const input = ConfirmRemediationActionInputSchema.parse(request.body);
        if (operation === "approve") {
          return reply.send(
            await services.approveRemediationAction(context, params.id, input)
          );
        }
        if (operation === "execute") {
          return reply.send(
            await services.executeRemediationAction(context, params.id, input)
          );
        }
        return reply.send(
          await services.rollbackRemediationAction(context, params.id, input)
        );
      }
    );
  }

  app.get(
    "/api/v1/remediations/:id/infrastructure-changes",
    {
      schema: {
        operationId: "listInfrastructureChanges",
        summary:
          "List pull-request-only infrastructure changes for a remediation",
        tags: ["remediation"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      return reply.send({
        items: await services.listInfrastructureChanges(context, params.id)
      });
    }
  );

  app.post(
    "/api/v1/remediations/:id/infrastructure-changes",
    {
      schema: {
        operationId: "previewInfrastructureChange",
        summary: "Preview and hash an exact infrastructure pull request",
        tags: ["remediation"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = PreviewInfrastructureChangeInputSchema.parse(request.body);
      return reply
        .status(201)
        .send(
          await services.previewInfrastructureChange(context, params.id, input)
        );
    }
  );

  for (const operation of ["approve", "execute", "rollback"] as const) {
    app.post(
      `/api/v1/infrastructure-changes/:id/${operation}`,
      {
        schema: {
          operationId: `${operation}InfrastructureChange`,
          summary: `${operation} an exact pull-request-only infrastructure change`,
          tags: ["remediation"]
        }
      },
      async (request, reply) => {
        const context = await requireAuthContext(
          request,
          services,
          sessionSecret
        );
        const params = z
          .object({ id: z.string().uuid() })
          .parse(request.params);
        const input = ConfirmInfrastructureChangeInputSchema.parse(
          request.body
        );
        if (operation === "approve") {
          return reply.send(
            await services.approveInfrastructureChange(
              context,
              params.id,
              input
            )
          );
        }
        if (operation === "execute") {
          return reply.send(
            await services.executeInfrastructureChange(
              context,
              params.id,
              input
            )
          );
        }
        return reply.send(
          await services.rollbackInfrastructureChange(context, params.id, input)
        );
      }
    );
  }

  app.post(
    "/api/v1/infrastructure-changes/:id/refresh",
    {
      schema: {
        operationId: "refreshInfrastructureChange",
        summary: "Refresh pull request, CI, and merge state",
        tags: ["remediation"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      return reply.send(
        await services.refreshInfrastructureChange(context, params.id)
      );
    }
  );

  // Remediation simulator, review-only exports, tripwires, and re-test trends.
  // Integrate w/ FixVerification, RemOps, reports. Uses real rem data + sim.
  app.post(
    "/api/v1/remediations/:id/simulate",
    {
      schema: {
        operationId: "simulateRemediation",
        summary: "Run what-if simulator for proposed fix (D-track)",
        tags: ["remediation"]
      }
    },
    async (request, reply) => {
      await requireAuthContext(request, services, sessionSecret);
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = SimulateRemediationInputSchema.parse(request.body ?? {});
      const proposed =
        body.proposedFix ?? body.fix ?? "apply recommended remediation";

      return reply.send(
        services.simulateRemediation(params.id, proposed, body.currentRiskScore)
      );
    }
  );

  app.get(
    "/api/v1/remediations/:id/playbooks",
    {
      schema: {
        operationId: "getRemediationPlaybooks",
        summary: "Get review-only remediation templates and ticket payloads",
        tags: ["remediation"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const remediation = await services.getRemediation(context, params.id);

      return reply.send(
        services.generatePlaybooks(remediation ?? { remediationId: params.id })
      );
    }
  );

  app.post(
    "/api/v1/remediations/:id/tripwire",
    {
      schema: {
        operationId: "createTripwire",
        summary:
          "Install behavioral tripwire detector for regression (instant re-test trigger)",
        tags: ["remediation"]
      }
    },
    async (request, reply) => {
      await requireAuthContext(request, services, sessionSecret);
      const params = z.object({ id: z.string().uuid() }).parse(request.params);

      return reply.send(services.createTripwire(params.id));
    }
  );

  app.get(
    "/api/v1/remediations/trends",
    {
      schema: {
        operationId: "getFixTrends",
        summary: "Fix effectiveness trending + continuous assurance",
        tags: ["remediation"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const remediations = await services.listRemediations(context);
      const eventGroups = await Promise.all(
        remediations.map((remediation) =>
          services.listVerificationEvents(context, remediation.remediationId)
        )
      );
      const observations = eventGroups.flatMap((events) =>
        events.map((event) => ({
          remediationId: event.remediationId,
          riskDelta:
            event.outcome === "Fixed"
              ? -25
              : event.outcome === "PartiallyFixed" ||
                  event.outcome === "Mitigated"
                ? -10
                : event.outcome === "Reopened"
                  ? 10
                  : 0,
          verificationOutcome: event.outcome
        }))
      );

      return reply.send(services.getFixTrends(observations));
    }
  );

  app.post(
    "/api/v1/remediations/:id/mark-ready-for-verification",
    {
      schema: {
        operationId: "markRemediationReadyForVerification",
        summary: "Mark a remediation ready for verification",
        tags: ["remediation"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);

      return reply.send(
        await services.markRemediationReadyForVerification(context, params.id)
      );
    }
  );

  app.get(
    "/api/v1/remediations/:id/plan",
    {
      schema: {
        operationId: "getPrescriptivePlan",
        summary: "Get prescriptive mitigation plan (step-by-step from verdict)",
        tags: ["remediation", "planner"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      return reply.send(await services.getPrescriptivePlan(context, params.id));
    }
  );

  app.post(
    "/api/v1/remediations/:id/auto-revalidate",
    {
      schema: {
        operationId: "autoRevalidate",
        summary:
          "Build a prescriptive plan and revalidate (no config push; actionApplied is always false)",
        description:
          "Preferred RemOps closed-loop path: planner → mark-ready → targeted re-test. " +
          "Does not apply WAF/firewall/security-group/control changes. " +
          "Fixed status still requires measured verification evidence.",
        tags: ["remediation", "planner"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      return reply.send(await services.autoRevalidate(context, params.id));
    }
  );

  app.post(
    "/api/v1/remediations/:id/auto-mitigate",
    {
      schema: {
        operationId: "autoMitigate",
        deprecated: true,
        summary:
          "Deprecated alias of auto-revalidate: plan + revalidate without applying a fix",
        description:
          "Legacy path kept for API clients. Prefer POST …/auto-revalidate. " +
          "Does not push customer configuration; actionApplied is always false.",
        tags: ["remediation", "planner"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      // Same service as preferred route; name only differs for back-compat.
      return reply.send(await services.autoRevalidate(context, params.id));
    }
  );

  app.post(
    "/api/v1/remediations/:id/verify",
    {
      schema: {
        operationId: "verifyRemediation",
        summary: "Verify a remediation task",
        tags: ["remediation"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const input = VerifyRemediationInputSchema.parse(request.body ?? {});
      const result = await withIdempotencyKey({
        body: { ...input, remediationId: params.id },
        execute: async () => ({
          body: await services.verifyRemediation(
            context,
            params.id,
            request.id
          ),
          statusCode: 200
        }),
        key: readIdempotencyKeyFromRequest(request.headers),
        route: IDEMPOTENT_ROUTES.verifyRemediation,
        store: idempotencyStore,
        tenantId: context.tenant.tenantId
      });
      if (result.replayed) {
        reply.header("idempotency-replayed", "true");
      }
      return reply.status(result.statusCode).send(result.body);
    }
  );

  app.post(
    "/api/v1/remediations/reverify-due",
    {
      schema: {
        operationId: "runDueReverifications",
        summary:
          "Re-verify settled remediations whose recurring re-check is due (continuous validation)",
        tags: ["remediation"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send(await services.runDueReverifications(context));
    }
  );

  app.get(
    "/api/v1/remediations/:id/verification-events",
    {
      schema: {
        operationId: "listRemediationVerificationEvents",
        summary: "List verification events for a remediation",
        tags: ["remediation"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);

      return reply.send({
        items: await services.listVerificationEvents(context, params.id)
      });
    }
  );

  app.get(
    "/api/v1/ai-apps",
    {
      schema: {
        operationId: "listAIApplications",
        summary: "List AI applications",
        tags: ["ai-applications"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send({
        items: await services.listAIApplications(context)
      });
    }
  );

  app.get(
    "/api/v1/ai-apps/validation-suites",
    {
      schema: {
        operationId: "listAIAppValidationSuites",
        summary: "List AI application validation suites",
        tags: ["ai-applications"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      void context;

      return reply.send({
        items: listAIAppValidationSuites()
      });
    }
  );

  app.post(
    "/api/v1/ai-apps",
    {
      schema: {
        operationId: "createAIApplication",
        summary: "Create an AI application",
        tags: ["ai-applications"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = CreateAIApplicationInputSchema.parse(request.body);

      return reply
        .status(201)
        .send(await services.createAIApplication(context, input));
    }
  );

  app.get(
    "/api/v1/ai-apps/:id",
    {
      schema: {
        operationId: "getAIApplication",
        summary: "Read a single AI application",
        tags: ["ai-applications"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const aiApp = await services.getAIApplication(context, params.id);

      if (!aiApp) {
        return reply.status(404).send({
          error: "AI application not found."
        });
      }

      return reply.send(aiApp);
    }
  );

  app.post(
    "/api/v1/ai-apps/:id/validate",
    {
      schema: {
        operationId: "validateAIApplication",
        summary: "Run validation for an AI application",
        tags: ["ai-applications"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const input = ValidateAIApplicationInputSchema.parse(request.body ?? {});

      return reply.send(
        await services.validateAIApplication(context, params.id, input)
      );
    }
  );

  app.put(
    "/api/v1/ai-apps/:id/kill-switch",
    {
      schema: {
        operationId: "setAIValidationKillSwitch",
        summary: "Activate or release an AI application validation kill switch",
        tags: ["ai-applications"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = SetAIValidationKillSwitchInputSchema.parse(request.body);

      return reply.send(
        await services.setAIValidationKillSwitch(context, params.id, input)
      );
    }
  );

  app.get(
    "/api/v1/ai-apps/:id/history",
    {
      schema: {
        operationId: "listAIApplicationHistory",
        summary: "List validation history for an AI application",
        tags: ["ai-applications"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);

      return reply.send({
        items: await services.listAIApplicationHistory(context, params.id)
      });
    }
  );

  app.get(
    "/api/v1/control-sources",
    {
      schema: {
        operationId: "listControlSources",
        summary: "List control sources",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send({
        items: await services.listControlSources(context)
      });
    }
  );

  app.get(
    "/api/v1/control-sources/validation-scenarios",
    {
      schema: {
        operationId: "listControlValidationScenarios",
        summary: "List control validation scenarios",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      void context;

      return reply.send({
        items: listControlValidationScenarios()
      });
    }
  );

  app.get(
    "/api/v1/control-sources/rule-coverage",
    {
      schema: {
        operationId: "getControlRuleCoverage",
        summary: "Read aggregate control rule coverage",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send(await services.getControlRuleCoverage(context));
    }
  );

  app.get(
    "/api/v1/control-sources/stimuli",
    {
      schema: {
        operationId: "listValidationStimuli",
        summary: "List governed safe control-validation stimuli",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send({
        items: await services.listValidationStimuli(context)
      });
    }
  );

  app.post(
    "/api/v1/control-sources/stimuli",
    {
      schema: {
        operationId: "createValidationStimulus",
        summary: "Create a policy-bound safe control-validation stimulus",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = CreateValidationStimulusInputSchema.parse(request.body);
      return reply
        .status(201)
        .send(await services.createValidationStimulus(context, input));
    }
  );

  for (const [action, operationId] of [
    ["dispatch", "dispatchValidationStimulus"],
    ["observe", "observeValidationStimulus"],
    ["cancel", "cancelValidationStimulus"]
  ] as const) {
    app.post(
      `/api/v1/control-sources/stimuli/:id/${action}`,
      {
        schema: {
          operationId,
          summary: `${action[0]!.toUpperCase()}${action.slice(1)} a governed safe control-validation stimulus`,
          tags: ["control-sources"]
        }
      },
      async (request, reply) => {
        const context = await requireAuthContext(
          request,
          services,
          sessionSecret
        );
        const params = z
          .object({ id: z.string().uuid() })
          .parse(request.params);
        const result =
          action === "dispatch"
            ? await services.dispatchValidationStimulus(context, params.id)
            : action === "observe"
              ? await services.observeValidationStimulus(context, params.id)
              : await services.cancelValidationStimulus(context, params.id);
        return reply.send(result);
      }
    );
  }

  app.post(
    "/api/v1/control-sources",
    {
      schema: {
        operationId: "createControlSource",
        summary: "Create a control source",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = CreateControlSourceInputSchema.parse(request.body);

      return reply
        .status(201)
        .send(await services.createControlSource(context, input));
    }
  );

  app.post(
    "/api/v1/scenarios/compile",
    {
      schema: {
        operationId: "compileScenario",
        summary:
          "Compile operator intent into a signed deterministic validation graph",
        tags: ["scenarios"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = CompileScenarioInputSchema.parse(request.body ?? {});
      return reply
        .status(201)
        .send(await services.compileScenario(context, input));
    }
  );

  app.post(
    "/api/v1/hybrid-compiler/compile",
    {
      schema: {
        operationId: "compileHybridExecution",
        summary:
          "Compile a mission plan into Ed25519-signed runner task payloads for allowlisted passive measured modules only (not full BAS / live APT)",
        tags: ["hybrid-compiler"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = CompileHybridExecutionInputSchema.parse(request.body ?? {});
      return reply
        .status(201)
        .send(await services.compileHybridExecution(context, input));
    }
  );

  app.post(
    "/api/v1/hybrid-compiler/assemble-passive-multi-agent",
    {
      schema: {
        operationId: "assemblePassiveMultiAgentPlan",
        summary:
          "Assemble a role-tagged passive multi-step mission plan under policy (not multi-agent BAS swarm)",
        tags: ["hybrid-compiler"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = AssemblePassiveMultiAgentPlanInputSchema.parse(
        request.body ?? {}
      );
      return reply
        .status(201)
        .send(await services.assemblePassiveMultiAgentPlan(context, input));
    }
  );

  app.post(
    "/api/v1/mission-drafts/conversational",
    {
      schema: {
        operationId: "createConversationalMissionDraft",
        summary:
          "Create a typed conversational mission draft (not executable BAS)",
        tags: ["mission-drafts"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = CreateConversationalMissionDraftInputSchema.parse(
        request.body ?? {}
      );
      return reply
        .status(201)
        .send(await services.createConversationalMissionDraft(context, input));
    }
  );

  app.post(
    "/api/v1/mission-drafts/conversational/to-hybrid-compile-input",
    {
      schema: {
        operationId: "convertConversationalMissionDraftToHybridCompileInput",
        summary:
          "Convert a conversational mission draft into Hybrid Execution Compiler input (draft remains non-executable BAS)",
        tags: ["mission-drafts", "hybrid-compiler"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = ConvertMissionDraftToHybridCompileInputSchema.parse(
        request.body ?? {}
      );
      return reply
        .status(200)
        .send(
          await services.convertConversationalMissionDraftToHybridCompileInput(
            context,
            input
          )
        );
    }
  );

  app.get(
    "/api/v1/scenarios",
    {
      schema: {
        operationId: "listScenarioBundles",
        summary: "List signed scenario bundles for the current tenant",
        tags: ["scenarios"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send({ items: await services.listScenarioBundles(context) });
    }
  );

  app.get(
    "/api/v1/scenarios/:id",
    {
      schema: {
        operationId: "getScenarioBundle",
        summary: "Read a signed scenario bundle",
        tags: ["scenarios"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const bundle = await services.getScenarioBundle(context, params.id);
      if (!bundle) {
        return reply.status(404).send({ error: "Scenario bundle not found." });
      }
      return reply.send(bundle);
    }
  );

  app.post(
    "/api/v1/scenarios/:id/approve",
    {
      schema: {
        operationId: "approveScenarioBundle",
        summary: "Approve the exact signed scenario preview for execution",
        tags: ["scenarios"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      return reply.send(
        await services.approveScenarioBundle(context, params.id)
      );
    }
  );

  app.post(
    "/api/v1/scenarios/:id/execute",
    {
      schema: {
        operationId: "executeScenarioBundle",
        summary:
          "Execute an approved scenario whose hash matches the signed preview",
        tags: ["scenarios"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = ExecuteScenarioInputSchema.parse(request.body ?? {});
      return reply
        .status(201)
        .send(await services.executeScenarioBundle(context, params.id, input));
    }
  );

  app.post(
    "/api/v1/scenarios/:id/feedback/stop",
    {
      schema: {
        operationId: "stopScenarioFeedback",
        summary:
          "Stop a bounded scenario feedback loop before its signed iteration limit",
        tags: ["scenarios"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = StopScenarioFeedbackInputSchema.parse(request.body ?? {});
      return reply.send(
        await services.stopScenarioFeedback(context, params.id, input)
      );
    }
  );

  app.post(
    "/api/v1/engagements",
    {
      schema: {
        operationId: "runEngagement",
        summary: "Run a governed autonomous engagement over a verified scope",
        tags: ["engagements"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = EngagementRunRequestSchema.parse(request.body ?? {});

      return reply
        .status(201)
        .send(await services.runEngagement(context, input));
    }
  );

  app.get(
    "/api/v1/engagements",
    {
      schema: {
        operationId: "listEngagements",
        summary: "List recent persisted autonomous engagements",
        tags: ["engagements"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const items = await services.listEngagements(context);

      return reply.send({ items });
    }
  );

  app.get(
    "/api/v1/engagements/:id",
    {
      schema: {
        operationId: "getEngagement",
        summary: "Read a persisted autonomous engagement by id",
        tags: ["engagements"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const engagement = await services.getEngagement(context, params.id);

      if (!engagement) {
        return reply.status(404).send({ error: "Engagement not found." });
      }

      return reply.send(engagement);
    }
  );

  app.get(
    "/api/v1/engagements/:id/collaboration",
    {
      schema: {
        operationId: "getEngagementCollaboration",
        summary: "Read the shared engagement workspace and replay ledger",
        tags: ["engagements"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      return reply.send({
        collaboration: await services.getEngagementCollaboration(
          context,
          params.id
        )
      });
    }
  );

  app.post(
    "/api/v1/engagements/:id/collaboration",
    {
      schema: {
        operationId: "initializeEngagementCollaboration",
        summary: "Initialize a shared engagement workspace",
        tags: ["engagements"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = InitializeEngagementWorkspaceInputSchema.parse(
        request.body
      );
      return reply
        .status(201)
        .send(
          await services.initializeEngagementCollaboration(
            context,
            params.id,
            input
          )
        );
    }
  );

  app.post(
    "/api/v1/engagements/:id/collaboration/collaborators",
    {
      schema: {
        operationId: "upsertEngagementCollaborator",
        summary: "Add or update a tenant member in an engagement workspace",
        tags: ["engagements"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = UpsertEngagementCollaboratorInputSchema.parse(request.body);
      return reply.send(
        await services.upsertEngagementCollaborator(context, params.id, input)
      );
    }
  );

  app.post(
    "/api/v1/engagements/:id/collaboration/events",
    {
      schema: {
        operationId: "appendEngagementCollaborationEvent",
        summary: "Append a note, assignment, status, or evidence event",
        tags: ["engagements"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = CreateEngagementCollaborationEventInputSchema.parse(
        request.body
      );
      return reply
        .status(201)
        .send(
          await services.appendEngagementCollaborationEvent(
            context,
            params.id,
            input
          )
        );
    }
  );

  app.get(
    "/api/v1/control-sources/:id/rule-coverage",
    {
      schema: {
        operationId: "getControlSourceRuleCoverage",
        summary: "Read rule coverage for a control source",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const coverage = await services.getControlSourceRuleCoverage(
        context,
        params.id
      );

      if (!coverage) {
        return reply.status(404).send({
          error: "Control source not found."
        });
      }

      return reply.send(coverage);
    }
  );

  app.get(
    "/api/v1/control-sources/:id",
    {
      schema: {
        operationId: "getControlSource",
        summary: "Read a single control source",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const controlSource = await services.getControlSource(context, params.id);

      if (!controlSource) {
        return reply.status(404).send({
          error: "Control source not found."
        });
      }

      return reply.send(controlSource);
    }
  );

  app.patch(
    "/api/v1/control-sources/:id",
    {
      schema: {
        operationId: "updateControlSource",
        summary: "Tune a control source's expected behaviors",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = UpdateControlSourceInputSchema.parse(request.body);

      return reply.send(
        await services.updateControlSource(context, params.id, input)
      );
    }
  );

  app.post(
    "/api/v1/control-sources/:id/validate",
    {
      schema: {
        operationId: "validateControlSource",
        summary: "Validate a control source",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const input = ValidateControlSourceInputSchema.parse(request.body ?? {});

      return reply.send(
        await services.validateControlSource(context, params.id, input)
      );
    }
  );

  app.post(
    "/api/v1/control-sources/:id/detection-marker-proof",
    {
      schema: {
        operationId: "runDetectionMarkerProof",
        summary:
          "Run Wave B benign-marker emit→observe DRV proof (allowlisted canary only; not full ATT&CK BAS)",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const input = DetectionMarkerProofInputSchema.parse(request.body ?? {});

      return reply.send(
        await services.runDetectionMarkerProof(context, params.id, input)
      );
    }
  );

  app.post(
    "/api/v1/control-sources/:id/dns-exfil-canary-proof",
    {
      schema: {
        operationId: "runDnsExfilCanaryProof",
        summary:
          "Run Phase C DNS-exfil detection canary (benign marker only; never real data exfiltration)",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const input = DnsExfilCanaryProofInputSchema.parse(request.body ?? {});

      return reply.send(
        await services.runDnsExfilCanaryProof(context, params.id, input)
      );
    }
  );

  app.get(
    "/api/v1/safety-equivalent-packs",
    {
      schema: {
        operationId: "listSafetyEquivalentPacks",
        summary:
          "List safety-equivalent specialist pack inventory (honesty labels; no live offense)",
        tags: ["trust-safety"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send(await services.listSafetyEquivalentPacks(context));
    }
  );

  app.get(
    "/api/v1/execution-integrity/honesty",
    {
      schema: {
        operationId: "getExecutionIntegrityHonesty",
        summary:
          "Execution integrity honesty (scorecard #47) — verifier role; no host TEE claims",
        tags: ["trust-safety"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send(await services.getExecutionIntegrityHonesty(context));
    }
  );

  app.get(
    "/api/v1/model-extraction-resistance/honesty",
    {
      schema: {
        operationId: "getModelExtractionHonesty",
        summary:
          "Model extraction resistance honesty (scorecard #64) — abuse resistance only; never weight theft",
        tags: ["ai-apps"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send(await services.getModelExtractionHonesty(context));
    }
  );

  app.get(
    "/api/v1/partner-capabilities/honesty",
    {
      schema: {
        operationId: "getPartnerCapabilityHonesty",
        summary:
          "Partner residual honesty (scorecard #2/#26/#28/#38/#51) — never invent partners",
        tags: ["trust-safety"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send(await services.getPartnerCapabilityHonesty(context));
    }
  );

  app.get(
    "/api/v1/control-sources/:id/history",
    {
      schema: {
        operationId: "listControlSourceHistory",
        summary: "List validation history for a control source",
        tags: ["control-sources"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);

      return reply.send({
        items: await services.listControlSourceHistory(context, params.id)
      });
    }
  );

  app.get(
    "/api/v1/evidence",
    {
      schema: {
        operationId: "listEvidence",
        summary: "List evidence artifacts",
        tags: ["evidence"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const rawLimit =
        request.query && (request.query as Record<string, unknown>).limit;

      return reply.send({
        items: await services.listEvidence(context, {
          limit: parseLimit(rawLimit)
        })
      });
    }
  );

  app.get(
    "/api/v1/evidence/verify-chain",
    {
      schema: {
        operationId: "verifyEvidenceChain",
        summary: "Verify the tenant evidence hash chain",
        tags: ["evidence"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send(await services.verifyEvidenceChain(context));
    }
  );

  app.get(
    "/api/v1/evidence/:id",
    {
      schema: {
        operationId: "getEvidence",
        summary: "Read a single evidence artifact",
        tags: ["evidence"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const artifact = await services.getEvidence(context, params.id);

      if (!artifact) {
        return reply.status(404).send({
          error: "Evidence not found."
        });
      }

      return reply.send(artifact);
    }
  );

  app.get(
    "/api/v1/evidence/:id/verify",
    {
      schema: {
        operationId: "verifyEvidenceIntegrity",
        summary: "Verify an evidence artifact and its chain link",
        tags: ["evidence"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const verification = await services.verifyEvidenceIntegrity(
        context,
        params.id
      );

      if (!verification) {
        return reply.status(404).send({
          error: "Evidence not found."
        });
      }

      return reply.send(verification);
    }
  );

  app.post(
    "/api/v1/evidence/:id/redact",
    {
      schema: {
        operationId: "redactEvidence",
        summary: "Redact an evidence artifact",
        tags: ["evidence"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);

      return reply.send(await services.redactEvidence(context, params.id));
    }
  );

  app.get(
    "/api/v1/evidence/:id/download",
    {
      schema: {
        operationId: "downloadEvidence",
        summary: "Download an evidence artifact",
        tags: ["evidence"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const download = await services.downloadEvidence(context, params.id);

      if (!download) {
        return reply.status(404).send({
          error: "Evidence not found."
        });
      }

      return reply.send(download);
    }
  );

  app.post(
    "/api/v1/reports/tenant-isolation-proof",
    {
      schema: {
        operationId: "createTenantIsolationProof",
        summary:
          "Generate a live tenant-isolation and data-protection proof pack",
        tags: ["reports"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply
        .status(201)
        .send(await services.createTenantIsolationProof(context));
    }
  );

  app.get(
    "/api/v1/reports",
    {
      schema: {
        operationId: "listReports",
        summary: "List reports",
        tags: ["reports"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const rawLimit =
        request.query && (request.query as Record<string, unknown>).limit;

      return reply.send({
        items: await services.listReports(context, {
          limit: parseLimit(rawLimit)
        })
      });
    }
  );

  app.post(
    "/api/v1/reports",
    {
      schema: {
        operationId: "createReport",
        summary: "Create a report",
        tags: ["reports"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = CreateReportInputSchema.parse(request.body ?? {});

      return reply
        .status(201)
        .send(await services.createReport(context, input));
    }
  );

  app.get(
    "/api/v1/reports/:id",
    {
      schema: {
        operationId: "getReport",
        summary: "Read a single report",
        tags: ["reports"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const report = await services.getReport(context, params.id);

      if (!report) {
        return reply.status(404).send({
          error: "Report not found."
        });
      }

      return reply.send(report);
    }
  );

  app.get(
    "/api/v1/evidence-packs/:id",
    {
      schema: {
        operationId: "getEvidencePack",
        summary: "Read a single evidence pack (full Q3 direct pack support)",
        tags: ["reports", "evidence"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const pack = await services.getEvidencePack(context, params.id);

      if (!pack) {
        return reply.status(404).send({
          error: "Evidence pack not found."
        });
      }

      return reply.send(pack);
    }
  );

  app.post(
    "/api/v1/reports/:id/export",
    {
      schema: {
        operationId: "exportReport",
        summary: "Export a report",
        tags: ["reports"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const input = ExportReportInputSchema.parse(request.body ?? {});
      const reportExport = await services.exportReport(
        context,
        params.id,
        input
      );

      if (!reportExport) {
        return reply.status(404).send({
          error: "Report not found."
        });
      }

      const payload =
        reportExport.format === "pdf"
          ? Buffer.from(reportExport.content, "utf8")
          : reportExport.content;

      return reply
        .header("content-type", reportExport.contentType)
        .header(
          "content-disposition",
          `attachment; filename="${reportExport.filename}"`
        )
        .send(payload);
    }
  );

  app.post(
    "/api/v1/reports/:id/share-link",
    {
      schema: {
        operationId: "createReportShareLink",
        summary: "Create a share link for a report",
        tags: ["reports"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const shareLink = await services.createReportShareLink(
        context,
        params.id
      );

      if (!shareLink) {
        return reply.status(404).send({
          error: "Report not found."
        });
      }

      return reply.status(201).send(shareLink);
    }
  );

  app.get(
    "/api/v1/reports/:id/share-links",
    {
      schema: {
        operationId: "listReportShareLinks",
        summary: "List share grants for a report",
        tags: ["reports"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      return reply.send({
        items: (await services.listReportShareLinks(context, params.id)).map(
          (item) => ReportShareGrantSchema.parse(item)
        )
      });
    }
  );

  app.delete(
    "/api/v1/reports/:id/share-links/:shareId",
    {
      schema: {
        operationId: "revokeReportShareLink",
        summary: "Revoke a report share grant",
        tags: ["reports"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid(),
          shareId: z.string().uuid()
        })
        .parse(request.params);
      const share = await services.revokeReportShareLink(
        context,
        params.id,
        params.shareId
      );

      if (!share) {
        return reply.status(404).send({ error: "Report share not found." });
      }

      return reply.send(ReportShareGrantSchema.parse(share));
    }
  );

  app.get(
    "/api/v1/reports/:id/analyst-note",
    {
      schema: {
        operationId: "getReportAnalystNote",
        summary: "Read the analyst note for a report",
        tags: ["reports"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);

      return reply.send(
        await services.getReportAnalystNote(context, params.id)
      );
    }
  );

  app.put(
    "/api/v1/reports/:id/analyst-note",
    {
      schema: {
        operationId: "updateReportAnalystNote",
        summary: "Update the analyst note for a report",
        tags: ["reports"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const input = UpdateReportAnalystNoteInputSchema.parse(request.body);

      return reply.send(
        await services.updateReportAnalystNote(context, params.id, input)
      );
    }
  );

  app.get(
    "/api/v1/public/reports/share/:token",
    {
      schema: {
        operationId: "getSharedReport",
        summary: "Read a publicly shared report by token",
        tags: ["reports"]
      }
    },
    async (request, reply) => {
      const params = z
        .object({
          token: z.string().min(1)
        })
        .parse(request.params);
      const sharedReport = await services.getSharedReportByToken(params.token);

      if (!sharedReport) {
        return reply.status(404).send({
          error: "Shared report not found."
        });
      }

      return reply
        .header("content-type", "text/html; charset=utf-8")
        .send(sharedReport.html);
    }
  );

  app.post(
    "/api/v1/runners/registration-tokens",
    {
      schema: {
        operationId: "createRunnerRegistrationToken",
        summary: "Issue a runner registration token",
        tags: ["runners"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = RunnerRegistrationTokenIssueRequestSchema.parse(
        request.body ?? {}
      );

      return reply
        .status(201)
        .send(await services.createRunnerRegistrationToken(context, input));
    }
  );

  app.post(
    "/api/v1/runners/register",
    {
      schema: {
        operationId: "registerRunner",
        summary: "Register a runner using a registration token",
        tags: ["runners"]
      }
    },
    async (request, reply) => {
      const input = RunnerRegistrationRequestSchema.parse(request.body);

      return reply.status(201).send(await services.registerRunner(input));
    }
  );

  app.get(
    "/api/v1/runners",
    {
      schema: {
        operationId: "listRunners",
        summary: "List runners",
        tags: ["runners"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send({
        items: await services.listRunners(context)
      });
    }
  );

  app.get(
    "/api/v1/runners/transport-decisions",
    {
      schema: {
        operationId: "listRunnerTransportDecisions",
        summary: "List default runner transport decisions",
        tags: ["runners"]
      }
    },
    async (request, reply) => {
      await requireAuthContext(request, services, sessionSecret);

      return reply.send(
        RunnerTransportDecisionResponseSchema.parse({
          items: listDefaultRunnerTransportDecisions()
        })
      );
    }
  );

  app.get(
    "/api/v1/runners/fleet",
    {
      schema: {
        operationId: "getRunnerFleetWorkspace",
        summary: "Read runner fleet health and task operations",
        tags: ["runners"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send(await services.getRunnerFleetWorkspace(context));
    }
  );

  app.put(
    "/api/v1/runners/fleet/policy",
    {
      schema: {
        operationId: "updateRunnerFleetPolicy",
        summary: "Update runner fleet operating thresholds and ownership",
        tags: ["runners"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = UpdateRunnerFleetPolicyInputSchema.parse(request.body);
      return reply.send(await services.updateRunnerFleetPolicy(context, input));
    }
  );

  app.get(
    "/api/v1/runners/:id",
    {
      schema: {
        operationId: "getRunner",
        summary: "Read a single runner",
        tags: ["runners"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const runner = await services.getRunner(context, params.id);

      if (!runner) {
        return reply.status(404).send({
          error: "Runner not found."
        });
      }

      return reply.send(runner);
    }
  );

  app.post(
    "/api/v1/runners/:id/revoke",
    {
      schema: {
        operationId: "revokeRunner",
        summary: "Revoke a runner",
        tags: ["runners"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);

      return reply.send(await services.revokeRunner(context, params.id));
    }
  );

  app.post(
    "/api/v1/runners/:id/heartbeat",
    {
      schema: {
        operationId: "runnerHeartbeat",
        summary: "Record a runner heartbeat",
        tags: ["runners"]
      }
    },
    async (request, reply) => {
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const input = RunnerHeartbeatSchema.parse(request.body);

      return reply.send(
        await services.runnerHeartbeat(
          params.id,
          getRunnerAuthToken(request),
          input,
          getRunnerClientCertificateSha256(request)
        )
      );
    }
  );

  app.post(
    "/api/v1/runners/:id/control-state/acknowledge",
    {
      schema: {
        operationId: "acknowledgeRunnerControlState",
        summary: "Acknowledge a runner kill-switch or revocation state",
        tags: ["runners"]
      }
    },
    async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = RunnerControlStateAcknowledgementSchema.parse(request.body);

      return reply.send(
        await services.acknowledgeRunnerControlState(
          params.id,
          getRunnerAuthToken(request),
          input,
          getRunnerClientCertificateSha256(request)
        )
      );
    }
  );

  app.post(
    "/api/v1/runners/:id/credentials/rotate",
    {
      schema: {
        operationId: "rotateRunnerCredentials",
        summary: "Rotate a runner's credentials",
        tags: ["runners"]
      }
    },
    async (request, reply) => {
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const input = RunnerCredentialRotationRequestSchema.parse(request.body);

      return reply.send(
        await services.rotateRunnerCredentials(
          params.id,
          getRunnerAuthToken(request),
          input,
          getRunnerClientCertificateSha256(request)
        )
      );
    }
  );

  app.post(
    "/api/v1/runners/:id/poll",
    {
      schema: {
        operationId: "pollRunnerTasks",
        summary: "Poll for pending runner tasks",
        tags: ["runners"]
      }
    },
    async (request, reply) => {
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const input = RunnerPollRequestSchema.parse(request.body ?? {});

      return reply.send(
        await services.pollRunnerTasks(
          params.id,
          getRunnerAuthToken(request),
          input,
          getRunnerClientCertificateSha256(request)
        )
      );
    }
  );

  app.post(
    "/api/v1/runners/:id/tasks/reachability",
    {
      schema: {
        operationId: "createRunnerReachabilityTask",
        summary: "Create a runner reachability task",
        tags: ["runners"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const input = RunnerReachabilityTaskRequestSchema.parse(request.body);

      return reply
        .status(201)
        .send(
          await services.createRunnerReachabilityTask(context, params.id, input)
        );
    }
  );

  app.post(
    "/api/v1/runners/:id/tasks/check",
    {
      schema: {
        operationId: "createRunnerCheckTask",
        summary: "Create a runner check task",
        tags: ["runners"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const input = RunnerCheckTaskRequestSchema.parse(request.body);

      return reply
        .status(201)
        .send(await services.createRunnerCheckTask(context, params.id, input));
    }
  );

  app.post(
    "/api/v1/runners/:id/tasks/measured",
    {
      schema: {
        operationId: "createRunnerMeasuredTask",
        summary: "Dispatch an allowlisted measured module to a runner",
        tags: ["runners"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const input = RunnerMeasuredTaskRequestSchema.parse(request.body);

      return reply
        .status(201)
        .send(
          await services.createRunnerMeasuredTask(context, params.id, input)
        );
    }
  );

  app.post(
    "/api/v1/runners/:id/tasks/discover",
    {
      schema: {
        operationId: "createRunnerDiscoverTask",
        summary: "Dispatch an in-network discovery module to a runner",
        tags: ["runners"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const input = RunnerDiscoverTaskRequestSchema.parse(request.body);

      return reply
        .status(201)
        .send(
          await services.createRunnerDiscoverTask(context, params.id, input)
        );
    }
  );

  app.post(
    "/api/v1/runners/:id/tasks/:taskId/artifacts",
    {
      schema: {
        operationId: "uploadRunnerTaskArtifact",
        summary: "Upload an artifact for a runner task",
        tags: ["runners"]
      }
    },
    async (request, reply) => {
      const params = z
        .object({
          id: z.string().uuid(),
          taskId: z.string().uuid()
        })
        .parse(request.params);
      const input = RunnerTaskArtifactUploadRequestSchema.parse(request.body);

      return reply
        .status(201)
        .send(
          await services.uploadRunnerTaskArtifact(
            params.id,
            params.taskId,
            getRunnerAuthToken(request),
            input,
            getRunnerClientCertificateSha256(request)
          )
        );
    }
  );

  app.post(
    "/api/v1/runners/:id/tasks/:taskId/result",
    {
      schema: {
        operationId: "submitRunnerTaskResult",
        summary: "Submit the result for a runner task",
        tags: ["runners"]
      }
    },
    async (request, reply) => {
      const params = z
        .object({
          id: z.string().uuid(),
          taskId: z.string().uuid()
        })
        .parse(request.params);
      const input = RunnerTaskResultSchema.parse(request.body);

      return reply.send(
        await services.submitRunnerTaskResult(
          params.id,
          params.taskId,
          getRunnerAuthToken(request),
          input,
          getRunnerClientCertificateSha256(request)
        )
      );
    }
  );

  app.post(
    "/api/v1/runners/:id/kill-switch",
    {
      schema: {
        operationId: "setRunnerKillSwitch",
        summary: "Set the kill switch state for a runner",
        tags: ["runners"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const input = RunnerKillSwitchRequestSchema.parse(request.body ?? {});

      return reply.send({
        runner: await services.setRunnerKillSwitch(context, params.id, input)
      });
    }
  );

  app.get(
    "/api/v1/runners/:id/tasks",
    {
      schema: {
        operationId: "listRunnerTasks",
        summary: "List tasks for a runner",
        tags: ["runners"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);

      return reply.send({
        items: await services.listRunnerTasks(context, params.id)
      });
    }
  );

  app.post(
    "/api/v1/runners/:id/tasks/:taskId/accept",
    {
      schema: {
        operationId: "acceptRunnerTask",
        summary: "Accept a runner task",
        tags: ["runners"]
      }
    },
    async (request, reply) => {
      const params = z
        .object({
          id: z.string().uuid(),
          taskId: z.string().uuid()
        })
        .parse(request.params);
      const input = RunnerTaskAcceptRequestSchema.parse(request.body);

      return reply.send({
        task: await services.acceptRunnerTask(
          params.id,
          params.taskId,
          getRunnerAuthToken(request),
          input,
          getRunnerClientCertificateSha256(request)
        )
      });
    }
  );

  app.post(
    "/api/v1/runners/:id/tasks/:taskId/reject",
    {
      schema: {
        operationId: "rejectRunnerTask",
        summary: "Reject a runner task",
        tags: ["runners"]
      }
    },
    async (request, reply) => {
      const params = z
        .object({
          id: z.string().uuid(),
          taskId: z.string().uuid()
        })
        .parse(request.params);
      const input = RunnerTaskRejectRequestSchema.parse(request.body);

      return reply.send({
        task: await services.rejectRunnerTask(
          params.id,
          params.taskId,
          getRunnerAuthToken(request),
          input,
          getRunnerClientCertificateSha256(request)
        )
      });
    }
  );

  app.post(
    "/api/v1/runners/:id/evidence",
    {
      schema: {
        operationId: "uploadRunnerEvidence",
        summary: "Upload evidence for a runner task",
        tags: ["runners"]
      }
    },
    async (request, reply) => {
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const body = z
        .object({
          taskId: z.string().uuid()
        })
        .parse(request.body);
      const input = RunnerTaskArtifactUploadRequestSchema.parse(request.body);

      return reply
        .status(201)
        .send(
          await services.uploadRunnerTaskArtifact(
            params.id,
            body.taskId,
            getRunnerAuthToken(request),
            input,
            getRunnerClientCertificateSha256(request)
          )
        );
    }
  );

  app.get(
    "/api/v1/schedules",
    {
      schema: {
        operationId: "listSchedules",
        summary: "List mission schedules",
        tags: ["schedules"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send({
        items: await services.listSchedules(context)
      });
    }
  );

  app.post(
    "/api/v1/schedules",
    {
      schema: {
        operationId: "createSchedule",
        summary: "Create a mission schedule",
        tags: ["schedules"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = CreateMissionScheduleInputSchema.parse(request.body ?? {});

      return reply
        .status(201)
        .send(await services.createSchedule(context, input));
    }
  );

  app.get(
    "/api/v1/schedules/:id",
    {
      schema: {
        operationId: "getSchedule",
        summary: "Read a single mission schedule",
        tags: ["schedules"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const schedule = await services.getSchedule(context, params.id);

      if (!schedule) {
        return reply.status(404).send({
          error: "Schedule not found."
        });
      }

      return reply.send(schedule);
    }
  );

  app.patch(
    "/api/v1/schedules/:id",
    {
      schema: {
        operationId: "updateSchedule",
        summary: "Update a mission schedule",
        tags: ["schedules"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = UpdateMissionScheduleInputSchema.parse(request.body ?? {});
      return reply.send(
        await services.updateSchedule(context, params.id, input)
      );
    }
  );

  app.delete(
    "/api/v1/schedules/:id",
    {
      schema: {
        operationId: "deleteSchedule",
        summary: "Delete a mission schedule",
        tags: ["schedules"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      await services.deleteSchedule(context, params.id);
      return reply.status(204).send();
    }
  );

  app.post(
    "/api/v1/schedules/:id/run",
    {
      schema: {
        operationId: "runSchedule",
        summary: "Run a mission schedule now",
        tags: ["schedules"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);

      return reply
        .status(201)
        .send(await services.runSchedule(context, params.id));
    }
  );

  app.post(
    "/api/v1/schedules/:id/pause",
    {
      schema: {
        operationId: "pauseSchedule",
        summary: "Pause a mission schedule",
        tags: ["schedules"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);

      return reply.send(await services.pauseSchedule(context, params.id));
    }
  );

  app.post(
    "/api/v1/schedules/:id/resume",
    {
      schema: {
        operationId: "resumeSchedule",
        summary: "Resume a mission schedule",
        tags: ["schedules"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);

      return reply.send(await services.resumeSchedule(context, params.id));
    }
  );

  app.post(
    "/api/v1/schedules/run-due",
    {
      schema: {
        operationId: "runDueSchedules",
        summary: "Run all mission schedules that are due",
        tags: ["schedules"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send(await services.runDueSchedules(context));
    }
  );

  app.post(
    "/api/v1/snapshots",
    {
      schema: {
        operationId: "createSnapshot",
        summary: "Create a validation snapshot",
        tags: ["snapshots"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = CreateSnapshotInputSchema.parse(request.body ?? {});

      return reply
        .status(201)
        .send(await services.createSnapshot(context, input));
    }
  );

  app.get(
    "/api/v1/snapshots",
    {
      schema: {
        operationId: "listSnapshots",
        summary: "List validation snapshots",
        tags: ["snapshots"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send({
        items: await services.listSnapshots(context)
      });
    }
  );

  app.get(
    "/api/v1/snapshots/:id",
    {
      schema: {
        operationId: "getSnapshot",
        summary: "Read a single validation snapshot",
        tags: ["snapshots"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const snapshot = await services.getSnapshot(context, params.id);

      if (!snapshot) {
        return reply.status(404).send({
          error: "Snapshot not found."
        });
      }

      return reply.send(snapshot);
    }
  );

  app.get(
    "/api/v1/snapshots/:id/report",
    {
      schema: {
        operationId: "getSnapshotReport",
        summary: "Read the HTML report for a snapshot",
        tags: ["snapshots"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const reportHtml = await services.getSnapshotReportHtml(
        context,
        params.id
      );

      if (!reportHtml) {
        return reply.status(404).send({
          error: "Snapshot report not found."
        });
      }

      return reply
        .header("content-type", "text/html; charset=utf-8")
        .send(reportHtml);
    }
  );

  app.post(
    "/api/v1/snapshots/:id/export",
    {
      schema: {
        operationId: "exportSnapshot",
        summary: "Export a validation snapshot report",
        tags: ["snapshots"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const params = z
        .object({
          id: z.string().uuid()
        })
        .parse(request.params);
      const input = ExportReportInputSchema.parse(request.body ?? {});
      const reportExport = await services.exportReport(
        context,
        params.id,
        input
      );

      if (!reportExport) {
        return reply.status(404).send({
          error: "Snapshot report not found."
        });
      }

      const payload =
        reportExport.format === "pdf"
          ? Buffer.from(reportExport.content, "utf8")
          : reportExport.content;

      return reply
        .header("content-type", reportExport.contentType)
        .header(
          "content-disposition",
          `attachment; filename="${reportExport.filename}"`
        )
        .send(payload);
    }
  );

  app.get(
    "/api/v1/ctem/program",
    {
      schema: {
        operationId: "getCtemProgram",
        summary: "Read the CTEM program summary",
        tags: ["system"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send(await services.getCTEMProgramSummary(context));
    }
  );

  app.get(
    "/api/v1/billing/meters",
    {
      schema: {
        operationId: "listBillingMeters",
        summary: "List billing usage meter definitions",
        tags: ["billing"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send({
        items: await services.getBillingMeters(context)
      });
    }
  );

  app.get(
    "/api/v1/billing/packages",
    {
      schema: {
        operationId: "listBillingPackages",
        summary:
          "List public Periscan package metadata without price or payment processing fields",
        tags: ["billing"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send({
        items: await services.getBillingPackages(context)
      });
    }
  );

  app.get(
    "/api/v1/billing/usage",
    {
      schema: {
        operationId: "getBillingUsage",
        summary: "Read current tenant billing usage meters",
        tags: ["billing"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send(await services.getBillingUsage(context));
    }
  );

  app.get(
    "/api/v1/billing/active-package",
    {
      schema: {
        operationId: "getActiveBillingPackage",
        summary: "Read the tenant's active subscription package",
        tags: ["billing"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );

      return reply.send(await services.getActiveBillingPackage(context));
    }
  );

  app.get(
    "/api/v1/billing/subscription",
    {
      schema: {
        operationId: "getSubscriptionOperationsWorkspace",
        summary: "Read the tenant subscription term and renewal ledger",
        tags: ["billing"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send(
        await services.getSubscriptionOperationsWorkspace(context)
      );
    }
  );

  app.post(
    "/api/v1/billing/subscription",
    {
      schema: {
        operationId: "createSubscriptionLifecycle",
        summary: "Start a reviewed direct-agreement subscription lifecycle",
        tags: ["billing"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = CreateSubscriptionLifecycleInputSchema.parse(
        request.body ?? {}
      );
      return reply
        .status(201)
        .send(await services.createSubscriptionLifecycle(context, input));
    }
  );

  app.post(
    "/api/v1/billing/subscription/renewal",
    {
      schema: {
        operationId: "recordSubscriptionRenewal",
        summary: "Record an approved renewal or non-renewal decision",
        tags: ["billing"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = RecordSubscriptionRenewalInputSchema.parse(
        request.body ?? {}
      );
      return reply.send(
        await services.recordSubscriptionRenewal(context, input)
      );
    }
  );

  app.post(
    "/api/v1/billing/subscription/grace",
    {
      schema: {
        operationId: "startSubscriptionGrace",
        summary: "Start a bounded subscription grace exception",
        tags: ["billing"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = StartSubscriptionGraceInputSchema.parse(request.body ?? {});
      return reply.send(await services.startSubscriptionGrace(context, input));
    }
  );

  app.post(
    "/api/v1/billing/subscription/grace/resolve",
    {
      schema: {
        operationId: "resolveSubscriptionGrace",
        summary: "Resolve a subscription grace exception",
        tags: ["billing"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = ResolveSubscriptionGraceInputSchema.parse(
        request.body ?? {}
      );
      return reply.send(
        await services.resolveSubscriptionGrace(context, input)
      );
    }
  );

  app.post(
    "/api/v1/billing/subscription/cancellation",
    {
      schema: {
        operationId: "scheduleSubscriptionCancellation",
        summary: "Schedule subscription cancellation at the current term end",
        tags: ["billing"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = ScheduleSubscriptionCancellationInputSchema.parse(
        request.body ?? {}
      );
      return reply.send(
        await services.scheduleSubscriptionCancellation(context, input)
      );
    }
  );

  app.post(
    "/api/v1/billing/subscription/cancellation/revoke",
    {
      schema: {
        operationId: "revokeSubscriptionCancellation",
        summary: "Revoke a scheduled subscription cancellation",
        tags: ["billing"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = SubscriptionReasonInputSchema.parse(request.body ?? {});
      return reply.send(
        await services.revokeSubscriptionCancellation(context, input)
      );
    }
  );

  app.post(
    "/api/v1/billing/subscription/reconcile",
    {
      schema: {
        operationId: "reconcileSubscriptionLifecycle",
        summary: "Apply a due renewal or close a due non-renewing term",
        tags: ["billing"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = SubscriptionReasonInputSchema.parse(request.body ?? {});
      return reply.send(
        await services.reconcileSubscriptionLifecycle(context, input)
      );
    }
  );

  app.post(
    "/api/v1/billing/aws-marketplace/register",
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "1 minute"
        }
      },
      schema: {
        operationId: "resolveAwsMarketplaceRegistration",
        summary: "Resolve an AWS Marketplace buyer registration token",
        tags: ["billing"]
      }
    },
    async (request, reply) => {
      const body = z
        .object({
          "x-amzn-marketplace-token": z.string().min(10).max(4_096)
        })
        .passthrough()
        .parse(request.body ?? {});
      const registration = await services.resolveAwsMarketplaceRegistration(
        body["x-amzn-marketplace-token"]
      );
      return reply.status(303).redirect(registration.redirectUrl);
    }
  );

  app.get(
    "/api/v1/billing/aws-marketplace",
    {
      schema: {
        operationId: "getAwsMarketplaceStatus",
        summary: "Read AWS Marketplace listing and subscription status",
        tags: ["billing"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send(await services.getAwsMarketplaceStatus(context));
    }
  );

  app.post(
    "/api/v1/billing/aws-marketplace/claim",
    {
      schema: {
        operationId: "claimAwsMarketplaceRegistration",
        summary: "Attach a resolved AWS Marketplace purchase to this tenant",
        tags: ["billing"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = ClaimAwsMarketplaceRegistrationInputSchema.parse(
        request.body ?? {}
      );
      return reply.send(
        await services.claimAwsMarketplaceRegistration(context, input)
      );
    }
  );

  app.post(
    "/api/v1/billing/aws-marketplace/entitlements/refresh",
    {
      schema: {
        operationId: "refreshAwsMarketplaceEntitlements",
        summary: "Refresh AWS Marketplace entitlements and access state",
        tags: ["billing"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send(
        await services.refreshAwsMarketplaceEntitlements(context)
      );
    }
  );

  app.post(
    "/api/v1/billing/aws-marketplace/metering/sync",
    {
      schema: {
        operationId: "syncAwsMarketplaceMetering",
        summary: "Submit the previous completed hour to AWS Marketplace",
        tags: ["billing"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send(await services.syncAwsMarketplaceMetering(context));
    }
  );

  app.get(
    "/api/v1/billing/trial",
    {
      schema: {
        operationId: "getTenantTrial",
        summary: "Read the tenant trial lifecycle",
        tags: ["billing"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      return reply.send(await services.getTenantTrial(context));
    }
  );

  app.post(
    "/api/v1/billing/trial/start",
    {
      schema: {
        operationId: "startTenantTrial",
        summary: "Start the tenant's one-time, time-boxed trial",
        tags: ["billing"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = StartTenantTrialInputSchema.parse(request.body ?? {});
      return reply
        .status(201)
        .send(await services.startTenantTrial(context, input));
    }
  );

  app.post(
    "/api/v1/billing/trial/convert",
    {
      schema: {
        operationId: "convertTenantTrial",
        summary: "Convert an active trial after commercial approval",
        tags: ["billing"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = ConvertTenantTrialInputSchema.parse(request.body);
      return reply.send(await services.convertTenantTrial(context, input));
    }
  );

  app.post(
    "/api/v1/billing/trial/cancel",
    {
      schema: {
        operationId: "cancelTenantTrial",
        summary: "Cancel an active trial and restore the prior entitlement",
        tags: ["billing"]
      }
    },
    async (request, reply) => {
      const context = await requireAuthContext(
        request,
        services,
        sessionSecret
      );
      const input = CancelTenantTrialInputSchema.parse(request.body);
      return reply.send(await services.cancelTenantTrial(context, input));
    }
  );

  // Continuous-validation driver: tick the due-runners across all tenants on a
  // timer so re-verification / connector sync / mission schedules actually run.
  // Only the real server entrypoint enables this; tests never do.
  if (options.enableScheduler && !isTest) {
    const parsedInterval = Number.parseInt(
      process.env.PERISCAN_VALIDATION_SWEEP_INTERVAL_MS ?? "",
      10
    );
    const sweepIntervalMs =
      Number.isFinite(parsedInterval) && parsedInterval > 0
        ? parsedInterval
        : 15 * 60 * 1000;
    // Single-flight: overlapping setInterval ticks must not stack concurrent
    // sweeps (amplifies schedule double-fire and connector sync races).
    let sweepInFlight = false;
    const runSweep = async () => {
      if (sweepInFlight) {
        app.log.warn(
          { op: "validation.sweep.skipped" },
          "Continuous validation sweep skipped; prior sweep still in flight."
        );
        return;
      }
      sweepInFlight = true;
      try {
        const sweep = await runSystemValidationSweep({
          logger: app.log,
          services
        });
        app.log.info(
          { op: "validation.sweep", ...sweep },
          "Continuous validation sweep complete."
        );
      } catch (error) {
        app.log.error(
          { op: "validation.sweep.error" },
          error instanceof Error ? error.message : String(error)
        );
      } finally {
        sweepInFlight = false;
      }
    };
    const sweepTimer = setInterval(() => {
      void runSweep();
    }, sweepIntervalMs);
    sweepTimer.unref();
    const initialKick = setTimeout(() => {
      void runSweep();
    }, 5000);
    initialKick.unref();
    app.addHook("onClose", () => {
      clearInterval(sweepTimer);
      clearTimeout(initialKick);
    });

    // Super-feed poller: a higher-frequency tick than the tenant sweep, since
    // public feeds move fast (phishing/malware IOCs every ~15 min). Each tick
    // only fetches feeds whose per-feed cadence is due; dedup makes re-fetches
    // idempotent, and key-required feeds without a key are skipped, not errored.
    const parsedPollInterval = Number.parseInt(
      process.env.PERISCAN_THREAT_FEED_POLL_INTERVAL_MS ?? "",
      10
    );
    const pollIntervalMs =
      Number.isFinite(parsedPollInterval) && parsedPollInterval > 0
        ? parsedPollInterval
        : 2 * 60 * 1000;
    const runFeedPolls = async () => {
      try {
        const result = await runDueThreatFeedPolls(getPrismaClient());
        if (result.polled > 0) {
          app.log.info(
            { op: "threat-feed.poll", ...result, outcomes: undefined },
            "Super-feed poll complete."
          );
        }
      } catch (error) {
        app.log.error(
          { op: "threat-feed.poll.error" },
          error instanceof Error ? error.message : String(error)
        );
      }
    };
    const pollTimer = setInterval(() => {
      void runFeedPolls();
    }, pollIntervalMs);
    pollTimer.unref();
    const initialPollKick = setTimeout(() => {
      void runFeedPolls();
    }, 8000);
    initialPollKick.unref();
    app.addHook("onClose", () => {
      clearInterval(pollTimer);
      clearTimeout(initialPollKick);
    });
  }

  return app;
}

export { ApiErrorSchema };

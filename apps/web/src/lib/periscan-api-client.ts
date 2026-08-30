import {
  clearWorkingTenant,
  resolveTenantHeaderForPath
} from "./working-tenant";
import {
  AIApplicationSchema,
  AgentBehaviorAnalysisSchema,
  AgentWorkflowCheckpointSchema,
  AgentWorkflowDefinitionSchema,
  AgentWorkflowEventSchema,
  AgentWorkflowRunDetailSchema,
  AgentWorkflowRunSchema,
  AgentWorkflowQualityEvaluationSchema,
  AgentWorkflowVariableAnalysisSchema,
  AgentExchangeObjectSchema,
  AgentDidTrustProfileSchema,
  AgentProtocolEndpointSchema,
  AgentSignedReceiptSchema,
  AgentVerifiableCredentialSchema,
  A2ATckRunSchema,
  ConfidentialAttestationSchema,
  ConfidentialAttestationChallengeSchema,
  TeeAssuranceRequirementSchema,
  TeeAssuranceWorkspaceSchema,
  VeraisonAttestationSessionSchema,
  VerifyVeraisonAttestationResultSchema,
  DiscoverAgentProtocolEndpointResultSchema,
  ExtensionCompatibilityReportSchema,
  ExtensionDeveloperWorkspaceSchema,
  ExtensionProjectSchema,
  ExtensionReleaseSchema,
  ExtensionScaffoldSchema,
  ApiErrorSchema,
  ApiReferenceDocumentSchema,
  ApplyPathEdgeReceiptInputSchema,
  ApplyPathEdgeReceiptResultSchema,
  AttackPathAssessmentSchema,
  AttackPathChokePointAnalysisSchema,
  AttackPathMeasurementStateSchema,
  AttackPathValidationPlanSchema,
  AttackPathVerificationRequestSchema,
  AttackTechniqueSchema,
  LaunchPathEdgeValidationInputSchema,
  PathEdgeReceiptSchema,
  PathEdgeValidationLaunchResultSchema,
  AssetLineageSchema,
  AssetOwnershipReviewSchema,
  AssetOwnershipSurfaceSchema,
  DataFabricQualitySurfaceSchema,
  ImportScanFileInputSchema,
  ScanImportResultSchema,
  AssetSchema,
  AssetValuationVersionSchema,
  AsyncOperationsReconcileResultSchema,
  AsyncOperationsWorkspaceSchema,
  AsyncRecoveryDecisionResultSchema,
  BusinessImpactPreviewSchema,
  BusinessImpactWorkspaceSchema,
  type AttackTechnique,
  AuditEventSchema,
  AdvisoryReadinessReportSchema,
  AwsMarketplaceMeteringSyncResultSchema,
  AwsMarketplaceStatusSchema,
  BillingPackageSchema,
  BillingUsageSchema,
  SubscriptionOperationsWorkspaceSchema,
  CTEMProgramSummarySchema,
  ControlRuleCoverageSummarySchema,
  BatchComplianceGovernanceInputSchema,
  BatchComplianceGovernanceResultSchema,
  ComplianceGovernanceChangeSchema,
  ComplianceGovernanceInventorySchema,
  ComplianceGovernanceMultiFrameworkSummarySchema,
  MultiFrameworkComplianceExportInputSchema,
  MultiFrameworkComplianceExportResultSchema,
  PartnerCapabilityHonestySchema,
  ControlSourceSchema,
  CreateValidationStimulusResponseSchema,
  DetectionMarkerProofResultSchema,
  DnsExfilCanaryProofResultSchema,
  DataResidencyOptionsSchema,
  EngagementResultSchema,
  EngagementCollaborationReadResponseSchema,
  EngagementCollaborationSnapshotSchema,
  CompileScenarioResponseSchema,
  CompileHybridExecutionResponseSchema,
  AssemblePassiveMultiAgentPlanResponseSchema,
  HybridCompileInputFromDraftSchema,
  ConversationalMissionDraftSchema,
  ScenarioBundleSchema,
  ScenarioExecutionResultSchema,
  JobSchema,
  RemediationTaskSchema,
  RemediationActionSchema,
  InfrastructureChangeRequestSchema,
  SignalEnvelopeSchema,
  SignalTriggerActivitySchema,
  SignalTriggerApprovalResponseSchema,
  SignalTriggerEvaluationResponseSchema,
  ValidatedFindingSchema,
  DispositionFeedbackSummarySchema,
  ValidationMissionSchema,
  ValidationRunSchema,
  ValidationStimulusSchema,
  VerificationEventSchema,
  AppendDesignPartnerSessionNoteInputSchema,
  DesignPartnerReportNoteSchema,
  DesignPartnerSessionNoteSchema,
  DesignPartnerWorkspaceSchema,
  type AppendDesignPartnerSessionNoteInput,
  type DesignPartnerSessionNote,
  EvidenceArtifactSchema,
  ExternalValidationAttemptSchema,
  EvidenceArtifactVerificationSchema,
  EvidenceChainVerificationReportSchema,
  EvidencePackSchema,
  EnterpriseBreadthReadinessSchema,
  ExecutionIntegrityHonestySchema,
  ModelExtractionHonestySchema,
  SafetyEquivalentPacksResponseSchema,
  ExecutiveTrendSummarySchema,
  ExecutiveTrendSeriesSchema,
  HEALTH_ROUTE,
  HealthResponseSchema,
  ContextBundleSchema,
  KillSwitchResultSchema,
  ModelGatewayAuditEventSchema,
  ModelGatewayFinOpsSummarySchema,
  ModelPolicyProfileSchema,
  ModelProviderConnectionTestResultSchema,
  ModelProviderSchema,
  ModelSessionSchema,
  ModelSessionTurnAcceptedSchema,
  ModelUsageEventSchema,
  MissionStartResultSchema,
  CommunityValidationSuiteResponseSchema,
  CommunityMissionRemediationsResultSchema,
  CommunityValidationCompanionSchema,
  CommunityValidationStartResultSchema,
  type CommunityMissionRemediationsResult,
  type CommunityValidationSuiteResponse,
  type CommunityValidationCompanion,
  type CommunityValidationStartResult,
  ModelToolRequestSchema,
  IssueModelToolInterventionResultSchema,
  ModelToolInterventionDecisionResultSchema,
  ModelToolInterventionQueueSchema,
  ModelToolInterventionSchema,
  ModelToolSchema,
  NonHumanIdentityInventorySchema,
  NonHumanIdentitySchema,
  MSSPClientPortfolioSchema,
  OpenSourceCapabilitySchema,
  OpenSourceToolCatalogEntrySchema,
  PUBLIC_API_PREFIX,
  ReportShareGrantSchema,
  ReportShareLinkSchema,
  RunnerRecordSchema,
  RunnerFleetPolicySchema,
  RunnerFleetWorkspaceSchema,
  RunnerTransportDecisionSchema,
  type RunnerTransportDecision,
  RunnerRegistrationTokenIssueResponseSchema,
  RunnerTaskRecordSchema,
  ScopeSchema,
  PolicyDecisionSchema,
  ProductActivationStateSchema,
  ProductExperienceProfileSchema,
  ProductFeedbackSchema,
  ProductWorkQueueSchema,
  BlueShiftBriefSchema,
  TenantSsoConfigSchema,
  TenantSsoLoginStartResultSchema,
  TenantApiKeySchema,
  TenantApiKeyWithSecretSchema,
  TenantMemberSchema,
  GlobalSearchResponseSchema,
  McpToolInfoSchema,
  McpActivityEntrySchema,
  TenantSafetySettingsSchema,
  TenantRequireMfaSettingsSchema,
  TenantWebhookSchema,
  TenantWebhookWithSecretSchema,
  WebhookDeliverySchema,
  WebhookEventCatalogSchema,
  TenantOperationalMetricsSchema,
  TenantReportBrandingSchema,
  TenantThreatAlertSchema,
  TenantTrialSchema,
  TenantIsolationProofSchema,
  LocalizationFormatPreviewSchema,
  TenantLocalizationSchema,
  TenantLocalizationWorkspaceSchema,
  ThirdPartyToolActivityEventSchema,
  ThirdPartyToolCandidateImportRequestSchema,
  ThirdPartyToolCandidateImportResponseSchema,
  ThirdPartyToolCandidateSchema,
  ThirdPartyToolCandidateReadinessSchema,
  ThirdPartyToolCandidateReadinessSummarySchema,
  ThirdPartyToolCoverageAuditSchema,
  ThirdPartyToolImplementationBundleSchema,
  ThirdPartyToolImplementationWorkOrderSchema,
  ThirdPartyToolPromotionCertificationSchema,
  ThirdPartyToolPromotionHandoffSchema,
  ThirdPartyToolPromotionPackageSchema,
  ThirdPartyToolRefreshDueResponseSchema,
  ThirdPartyToolRunnerDispatchRequestSchema,
  ThirdPartyToolRunnerDispatchResponseSchema,
  ThirdPartyToolUpstreamVersionCheckSchema,
  ThirdPartyToolUpdateRecommendationSchema,
  ThirdPartyToolRunnerEligibilitySchema,
  ReviewThirdPartyToolCandidateRequestSchema,
  ThirdPartyToolInstallPlanSchema,
  ThirdPartyToolLicenseSummarySchema,
  ThirdPartyToolSchema,
  ToolIntakeValidationReportSchema,
  ToolInstallJobSchema,
  ToolLicenseAcceptanceSchema,
  ThreatAdvisoryDetailSchema,
  ThreatAdvisorySchema,
  ThreatFeedIngestionResultSchema,
  ThreatFeedStatusSchema,
  ThreatIntelItemSchema,
  type TenantThreatAlert,
  type TenantThreatAlertStatus,
  type TenantTrial,
  type AwsMarketplaceMeteringSyncResult,
  type AwsMarketplaceStatus,
  type ClaimAwsMarketplaceRegistrationInput,
  type TenantIsolationProof,
  type StartTenantTrialInput,
  type ConvertTenantTrialInput,
  type CancelTenantTrialInput,
  type ThreatCatalogQuery,
  type ThreatFeedStatus,
  type ThreatIntelItem,
  type ThreatFeedIngestionInput,
  type ThreatFeedIngestionResult,
  type ScheduleFrequency,
  TrustSafetySummarySchema,
  UsageMeterDefinitionSchema,
  ValidationSnapshotSchema,
  type AIApplication,
  type AgentBehaviorAnalysis,
  type AgentWorkflowCheckpoint,
  type AgentWorkflowDefinition,
  type AgentWorkflowEvent,
  type AgentWorkflowRun,
  type AgentWorkflowRunDetail,
  type AgentWorkflowQualityEvaluation,
  type AgentWorkflowVariableAnalysis,
  type AgentExchangeObject,
  type AgentDidTrustProfile,
  type AgentProtocolEndpoint,
  type AgentSignedReceipt,
  type AgentVerifiableCredential,
  type A2ATckRun,
  type AppendAgentWorkflowEventInput,
  type ConfidentialAttestation,
  type ConfidentialAttestationChallenge,
  type CreateConfidentialAttestationChallengeInput,
  type CreateTeeAssuranceRequirementInput,
  type EvaluateTeeAssuranceInput,
  type RevokeTeeAssuranceInput,
  type TeeAssuranceRequirement,
  type TeeAssuranceWorkspace,
  type CreateVeraisonAttestationSessionInput,
  type AIAppValidationCategory,
  type AdvisoryReadinessReport,
  type ApplyPathEdgeReceiptInput,
  type ApplyPathEdgeReceiptResult,
  type AttackPathAssessment,
  type AttackPathChokePointAnalysis,
  type AttackPathMeasurementState,
  type AttackPathValidationPlan,
  type AttackPathVerificationRequest,
  type LaunchPathEdgeValidationInput,
  type PathEdgeReceipt,
  type PathEdgeValidationLaunchResult,
  type Asset,
  type AssetLineage,
  type AssetOwnershipReview,
  type AssetOwnershipSurface,
  type DataFabricQualitySurface,
  type ImportScanFileInput,
  type ReviewAssetOwnershipCandidateInput,
  type ScanImportResult,
  type AssetValuationInput,
  type AssetValuationVersion,
  type AsyncOperationsPolicyInput,
  type AsyncOperationsReasonInput,
  type AsyncOperationsReconcileResult,
  type AsyncOperationsWorkspace,
  type AsyncRecoveryDecisionInput,
  type AsyncRecoveryDecisionResult,
  type BusinessImpactPreview,
  type BusinessImpactWorkspace,
  type ReviewAssetValuationVersionInput,
  type SubmitAssetValuationVersionInput,
  type AuditEvent,
  type BillingPackage,
  type BillingUsage,
  type CreateSubscriptionLifecycleInput,
  type RecordSubscriptionRenewalInput,
  type ResolveSubscriptionGraceInput,
  type ScheduleSubscriptionCancellationInput,
  type StartSubscriptionGraceInput,
  type SubscriptionOperationsWorkspace,
  type SubscriptionReasonInput,
  type CTEMProgramSummary,
  type ControlRuleCoverageSummary,
  type BatchComplianceGovernanceInput,
  type BatchComplianceGovernanceResult,
  type ComplianceFrameworkKey,
  type ComplianceGovernanceChange,
  type ComplianceGovernanceInventory,
  type ComplianceGovernanceMultiFrameworkSummary,
  type MultiFrameworkComplianceExportInput,
  type MultiFrameworkComplianceExportResult,
  type PartnerCapabilityHonesty,
  type UpdateComplianceControlGovernanceInput,
  type ControlSource,
  type CreateValidationStimulusInput,
  type CreateValidationStimulusResponse,
  type DetectionMarkerProofInput,
  type DetectionMarkerProofResult,
  type DnsExfilCanaryProofInput,
  type DnsExfilCanaryProofResult,
  type CreateScopeInput,
  type CreateRemediationInput,
  type CreateMissionScheduleInput,
  type EngagementResult,
  type EngagementCollaborationSnapshot,
  type InitializeEngagementWorkspaceInput,
  type UpsertEngagementCollaboratorInput,
  type CreateEngagementCollaborationEventInput,
  type CompileScenarioInput,
  type CompileScenarioResponse,
  type CompileHybridExecutionInput,
  type CompileHybridExecutionResponse,
  type AssemblePassiveMultiAgentPlanInput,
  type AssemblePassiveMultiAgentPlanResponse,
  type ConvertMissionDraftToHybridCompileInputRequest,
  type CreateConversationalMissionDraftInput,
  type ConversationalMissionDraft,
  type HybridCompileInputFromDraft,
  type ExecuteScenarioInput,
  type ScenarioBundle,
  type ScenarioExecutionResult,
  type StopScenarioFeedbackInput,
  type DesignPartnerReportNote,
  type DesignPartnerWorkspace,
  type EvidenceArtifact,
  type ExternalValidationAttempt,
  type EvidenceArtifactVerification,
  type EvidenceChainVerificationReport,
  type EvidencePack,
  type EvidencePackType,
  type ExecutiveTrendSummary,
  type ExecutiveTrendSeries,
  type HealthResponse,
  type Integration,
  type Job,
  type Membership,
  type MissionStartResult,
  type MSSPClientPortfolio,
  type NonHumanIdentity,
  type NonHumanIdentityInventory,
  type EnterpriseBreadthReadiness,
  type RegisterNonHumanIdentityInput,
  type OpenSourceCapability,
  type OpenSourceToolCatalogEntry,
  type OpenSourceToolId,
  type RemediationTask,
  type RemediationAction,
  type InfrastructureChangeRequest,
  type PreviewInfrastructureChangeInput,
  type PreviewRemediationActionInput,
  type ReportExportFormat,
  type ReportShareGrant,
  type ReportShareLink,
  type RunnerRecord,
  type RunnerFleetPolicy,
  type RunnerFleetWorkspace,
  type RunnerRegistrationTokenIssueResponse,
  type RunnerTaskRecord,
  type UpdateRunnerFleetPolicyInput,
  type Scope,
  type UpdateScopeClassificationInput,
  type SignalEnvelope,
  type SignalTriggerActivity,
  type SignalTriggerApprovalResponse,
  type SignalTriggerEvaluationResponse,
  type Tenant,
  type TenantLocalization,
  type TenantLocalizationWorkspace,
  type LocalizationFormatPreview,
  type PreviewTenantLocalizationInput,
  type UpdateTenantLocalizationInput,
  type PolicyDecision,
  type ProductActivationState,
  type ProductExperienceProfile,
  type ProductFeedback,
  type ProductWorkQueue,
  type BlueShiftBrief,
  type SubmitProductFeedbackInput,
  type TenantSsoConfig,
  type StartTenantSsoLoginInput,
  type TenantSsoLoginStartResult,
  type UpdateTenantSsoConfigInput,
  type UpdateProductExperienceProfileInput,
  type TenantApiKey,
  type TenantApiKeyWithSecret,
  type CreateTenantApiKeyInput,
  type TenantMember,
  type MembershipRole,
  type GlobalSearchResponse,
  type McpToolInfo,
  type McpActivityEntry,
  type TenantSafetySettings,
  type TenantRequireMfaSettings,
  type SetTenantRequireMfaInput,
  type TenantWebhook,
  type TenantWebhookWithSecret,
  type WebhookDelivery,
  type WebhookEventCatalog,
  type CreateTenantWebhookInput,
  type UpdateTenantWebhookInput,
  type TenantOperationalMetrics,
  type TenantReportBranding,
  type ThirdPartyTool,
  type ThirdPartyToolActivityEvent,
  type ThirdPartyToolCandidate,
  type ThirdPartyToolCandidateImportRequest,
  type ThirdPartyToolCandidateImportResponse,
  type ThirdPartyToolCandidateReadiness,
  type ThirdPartyToolCandidateReadinessSummary,
  type ThirdPartyToolCoverageAudit,
  type ThirdPartyToolImplementationBundle,
  type ThirdPartyToolImplementationWorkOrder,
  type ThirdPartyToolPromotionCertification,
  type ThirdPartyToolPromotionHandoff,
  type ThirdPartyToolPromotionPackage,
  type ThirdPartyToolRefreshDueRequest,
  type ThirdPartyToolRefreshDueResponse,
  type ThirdPartyToolRunnerDispatchRequestInput,
  type ThirdPartyToolRunnerDispatchResponse,
  type ThirdPartyToolUpstreamVersionCheck,
  type ThirdPartyToolUpdateRecommendation,
  type ThirdPartyToolRunnerEligibility,
  type ThirdPartyToolInstallRequest,
  type ThirdPartyToolInstallPlan,
  type ThirdPartyToolLicenseSummary,
  type AcceptToolLicenseRequestInput,
  type ListToolLicenseAcceptancesQuery,
  type ToolLicenseAcceptance,
  type ReviewThirdPartyToolCandidateRequest,
  type ToolIntakeManifestRequest,
  type ToolIntakeValidationReport,
  type ThreatAdvisory,
  type ThreatAdvisoryDetail,
  type TrustSafetySummary,
  type DataResidencyOptions,
  type UsageMeterDefinition,
  type User,
  type ValidatedFinding,
  type DispositionFeedbackSummary,
  type FindingDisposition,
  type ValidatedFindingStatus,
  type ValidationMission,
  type ValidationRun,
  type ValidationStimulus,
  type ValidationSnapshot,
  type VerificationEvent,
  type MissionSchedule,
  type ScheduledRunResult,
  RemediationTicketSchema,
  RemediationTicketStateSchema,
  type ApiReferenceDocument,
  type CreateRemediationTicketInput,
  type RemediationTicketResult,
  type SyncRemediationTicketInput,
  type RemediationTicketStateResult,
  type ActivateKillSwitchInput,
  type ContextBundle,
  type CreateModelPolicyProfileInput,
  type CreateAgentWorkflowCheckpointInput,
  type CreateAgentWorkflowDefinitionInput,
  type CreateAgentWorkflowRunInput,
  type CreateAgentExchangeObjectInput,
  type CreateAgentDidTrustProfileInput,
  type DiscoverAgentProtocolEndpointResult,
  type ExtensionCompatibilityReport,
  type CreateExtensionProjectInput,
  type ExtensionDeveloperWorkspace,
  type ExtensionExecutionContract,
  type ExtensionLifecycleReasonInput,
  type ExtensionProject,
  type ExtensionRelease,
  type ExtensionScaffold,
  type ReviewExtensionReleaseInput,
  type RollbackExtensionProjectInput,
  type SubmitExtensionReleaseInput,
  type CreateModelProviderInput,
  type CreateModelSessionInput,
  type CreateModelToolRequestInput,
  type DecideModelToolInterventionInput,
  type InspectModelToolInterventionInput,
  type IssueModelToolInterventionInput,
  type IssueModelToolInterventionResult,
  type KillSwitchResult,
  type ModelGatewayAuditEvent,
  type ModelGatewayFinOpsSummary,
  type ModelPolicyProfile,
  type ModelProvider,
  type ModelProviderConnectionTestResult,
  type ModelSession,
  type ModelSessionTurnAccepted,
  type ModelUsageEvent,
  type ModelTool,
  type ModelToolIntervention,
  type ModelToolInterventionDecisionResult,
  type ModelToolInterventionQueue,
  type ModelToolRequest,
  type ReplayAgentWorkflowInput,
  type RegisterAgentProtocolEndpointInput,
  type RefreshAgentDidTrustProfileInput,
  type RevokeAgentDidTrustProfileInput,
  type ReviewAgentProtocolEndpointInput,
  type UpdateAgentExchangeObjectStateInput,
  type VerifyAgentSignedReceiptInput,
  type VerifyAgentVerifiableCredentialInput,
  type VerifyConfidentialAttestationInput,
  type RunA2ATckInput,
  type VeraisonAttestationSession,
  type VerifyVeraisonAttestationInput,
  type VerifyVeraisonAttestationResult,
  type ToolInstallJob,
  type UpdateModelPolicyProfileInput,
  type UpdateModelProviderInput,
  type UpdateModelToolInput,
  type UpdateModelGatewayFinOpsInput,
  type UpdateMissionScheduleInput
} from "@periscan/shared";

export interface AIApplicationValidationResult {
  attackTechniques: AttackTechnique[];
  decision: PolicyDecision;
  evidence: EvidenceArtifact[];
  mission: ValidationMission;
  run: ValidationRun;
  signals: SignalEnvelope[];
}

export interface AIApplicationValidationInput {
  corpusVersion?: string;
  executionMode?: "LiveSafe" | "LiveSuite" | "Fixture";
  harness?: "periscan" | "promptfoo" | "pyrit" | "garak";
  maxRequests?: number;
  maxResponseBytes?: number;
  safeTestCases?: Array<{
    category: AIAppValidationCategory;
    input: string;
    testCaseId: string;
  }>;
  timeoutSeconds?: number;
  validationCategory?: AIAppValidationCategory;
}
import { z } from "zod";

import type {
  ConnectorCatalogEntry,
  ConnectorHealth
} from "@periscan/connectors";
// Type-only import: @periscan/policy's source uses .js re-exports the web
// bundler can't resolve, so the runtime shape is validated with a local schema
// (structural mirror of ExternalValidationTemplateProfileMetadataSchema).
import type { ExternalValidationTemplateProfileMetadata } from "@periscan/policy";

const ExternalValidationProfileMetadataSchema = z.object({
  defaultRateLimit: z.number(),
  description: z.string(),
  displayName: z.string(),
  maxRequestsPerTarget: z.number(),
  profile: z.string(),
  safetyNotes: z.array(z.string()),
  templateIds: z.array(z.string())
});
import type { ModuleManifest } from "@periscan/modules";
// Type-only: @periscan/operators imports node:crypto, so it must never be
// bundled into the web client — the runtime shape is validated with a local
// schema mirroring EvidenceGroundedSummarySchema.
import type {
  DynamicPathMissionRecommendation,
  EvidenceGroundedSummary,
  EvidenceSummaryUseCase,
  OperatorProfile,
  OperatorRecommendation
} from "@periscan/operators";

/** Local structural mirror of DynamicPathMissionRecommendationSchema (no node:crypto). */
const DynamicPathMissionRecommendationSchema = z.object({
  approvalRequired: z.literal(true),
  createdAt: z.string(),
  drivers: z.array(z.string()).min(1),
  evidenceIds: z.array(z.string()).min(1),
  honestyNotes: z.array(z.string()).min(1),
  kind: z.literal("DynamicPathNextMission"),
  matchedSignalIds: z.array(z.string()),
  matchedTriggerIds: z.array(z.string()),
  measuredEdgeCount: z.number().int().nonnegative(),
  missionPlan: z.object({
    approvalRequired: z.literal(true),
    executionEnvironment: z.enum([
      "ControlPlane",
      "ExternalPoA",
      "InternalRunner"
    ]),
    missionType: z.string(),
    moduleIds: z.array(z.string()),
    requestedAction: z.record(z.string(), z.unknown()),
    safetyLevel: z.string(),
    scopeId: z.string().nullish(),
    target: z.record(z.string(), z.unknown())
  }),
  pathId: z.string(),
  pathName: z.string(),
  rationale: z.string(),
  recommendationId: z.string(),
  status: z.enum(["Proposed", "Approved", "NotActionable"]),
  tenantId: z.string(),
  title: z.string(),
  totalEdgeCount: z.number().int().nonnegative(),
  unmeasuredEdgeCount: z.number().int().nonnegative()
});

const EvidenceGroundedSummarySchema = z.object({
  claims: z.array(
    z.object({
      evidenceIds: z.array(z.string()),
      text: z.string()
    })
  ),
  evidenceIds: z.array(z.string()),
  generatedAt: z.string(),
  redactionApplied: z.boolean(),
  summary: z.string(),
  useCase: z.string(),
  warnings: z.array(z.string())
});

export interface AuthSessionPayload {
  membership: Membership;
  /**
   * Present when force-MFA policy is on and this password session has not yet
   * enrolled MFA. Product APIs return 403 mfa_enrollment_required until then.
   */
  mfaEnrollmentRequired?: boolean;
  tenant: Tenant;
  user: User;
}

export type ClientPortfolioPayload = MSSPClientPortfolio;

/** Input for POST /tenants/current/clients (MSSP parent only). */
export interface CreateClientTenantInput {
  billingAccountId?: string | null;
  clientAdminEmail?: string | null;
  clientAdminName?: string | null;
  dataRegion?: string | null;
  name: string;
}

export interface CreateClientTenantResult {
  clientAdminMembership: Membership | null;
  clientAdminUser: User | null;
  msspMembership: Membership;
  tenant: Tenant;
}

export type ThreatAdvisoryDetailPayload = ThreatAdvisoryDetail;

export interface UpdateTenantBrandingPayload {
  logoUrl?: string | null;
  organizationName?: string | null;
  primaryColor?: string | null;
  reportFooter?: string | null;
  supportEmail?: string | null;
  whiteLabelEnabled: boolean;
}

export interface ImportThreatAdvisoryPayload {
  cveIds?: string[];
  iocValues?: string[];
  publishedAt?: string | null;
  rawContent: string;
  sourceName: string;
  sourceUrl?: string | null;
  summary: string;
  techniqueIds?: string[];
  title: string;
}

export interface ReportDownloadPayload {
  content: ArrayBuffer | string;
  contentType: string;
  filename: string;
  format: ReportExportFormat;
}

export interface ListFindingsQuery {
  assetId?: string;
  exploitability?: string;
  severity?: string;
  sourceMotion?: string;
  status?: ValidatedFindingStatus;
  missionId?: string;
  validationState?: string;
  owner?: string;
  disposition?: string;
  /** Comma-separated dispositions to drop (e.g. Active = FalsePositive,Suppressed). */
  excludeDisposition?: string;
  priorityMin?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface FindingsPage {
  items: ValidatedFinding[];
  page: {
    hasMore: boolean;
    limit: number;
    offset: number;
  };
}

/** Community SARIF 2.1.0 download from GET /api/v1/findings.sarif. */
export interface FindingsSarifDownload {
  content: string;
  contentType: string;
  filename: string;
}

export interface AuditEventPage {
  items: AuditEvent[];
  page: {
    hasMore: boolean;
    limit: number;
    offset: number;
  };
}

export interface AuditEventQuery {
  action?: AuditEvent["action"];
  actorType?: string;
  category?: string;
  from?: string;
  limit?: number;
  offset?: number;
  search?: string;
  to?: string;
  userId?: string;
}

/**
 * Shape returned by `POST /api/v1/remediations/:id/verify`.
 *
 * The backend remediation verify route returns a verification event plus the
 * refreshed remediation, mission, run, and (optionally) the re-assessed attack
 * path. A parallel worker is improving the verification logic but is keeping
 * this contract; we parse defensively so an additive backend change (extra
 * fields) does not break the UI. `attackPath` is null when the remediation is
 * not linked to an attack path.
 */
export interface RemediationVerificationResult {
  attackPath: AttackPathAssessment | null;
  mission: ValidationMission;
  remediation: RemediationTask;
  run: ValidationRun;
  verificationEvent: VerificationEvent;
}

export interface OpenSourceCatalogQuery {
  includeDeferred?: boolean;
  includeLegalReview?: boolean;
  phase?: "Current" | "CurrentMvp" | "NearTerm" | "LaterPhase" | "all";
}

export interface ScopePostureCheck {
  moduleId: string;
  outcome: string;
  validationState: string | null;
  exposure: boolean;
  signalCount: number;
}

export interface ScopePostureCheckResult {
  scopeId: string;
  checks: ScopePostureCheck[];
}

export class PeriscanApiClientError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "PeriscanApiClientError";
    this.status = status;
  }
}

function toErrorMessage(status: number, payload: unknown, fallback: string) {
  const parsed = ApiErrorSchema.safeParse(payload);

  if (parsed.success) {
    return parsed.data.error;
  }

  return `${fallback} (${status})`;
}

function joinRoute(path: string) {
  return path.startsWith(PUBLIC_API_PREFIX)
    ? path
    : `${PUBLIC_API_PREFIX}${path}`;
}

function buildQueryString(
  entries: Record<string, string | number | null | undefined>
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(entries)) {
    if (value == null || value === "") {
      continue;
    }

    params.set(key, String(value));
  }

  const query = params.toString();

  return query ? `?${query}` : "";
}

function parseThreatAdvisoryDetail(
  payload: unknown
): ThreatAdvisoryDetailPayload {
  return ThreatAdvisoryDetailSchema.parse(payload);
}

/** Browser-readable double-submit CSRF cookie (matches API CSRF_COOKIE_NAME). */
const CSRF_COOKIE_NAME = "periscan_csrf";
const CSRF_HEADER_NAME = "x-csrf-token";
const TENANT_HEADER_NAME = "x-periscan-tenant-id";

function readBrowserCsrfToken(): string | undefined {
  if (typeof document === "undefined") {
    return undefined;
  }
  const parts = document.cookie.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${CSRF_COOKIE_NAME}=`)) {
      return decodeURIComponent(trimmed.slice(CSRF_COOKIE_NAME.length + 1));
    }
  }
  return undefined;
}

export class PeriscanApiClient {
  constructor(private readonly fetchImpl?: typeof fetch) {}

  private async request(path: string, init?: RequestInit): Promise<Response> {
    const fetcher = this.fetchImpl ?? fetch;
    const method = (init?.method ?? "GET").toUpperCase();
    const mutating =
      method === "POST" ||
      method === "PUT" ||
      method === "PATCH" ||
      method === "DELETE";
    const csrfToken = mutating ? readBrowserCsrfToken() : undefined;
    const tenantHeader = resolveTenantHeaderForPath(path);
    const response = await fetcher(joinRoute(path), {
      cache: "no-store",
      credentials: "include",
      ...init,
      headers: {
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...(csrfToken ? { [CSRF_HEADER_NAME]: csrfToken } : {}),
        ...(tenantHeader ? { [TENANT_HEADER_NAME]: tenantHeader } : {}),
        ...(init?.headers ?? {})
      }
    });

    return response;
  }

  private async requestJson<T>(
    path: string,
    init: RequestInit | undefined,
    parse: (payload: unknown) => T,
    fallbackError: string
  ): Promise<T> {
    const response = await this.request(path, init);
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new PeriscanApiClientError(
        response.status,
        toErrorMessage(response.status, payload, fallbackError)
      );
    }

    return parse(payload);
  }

  private async requestDownload(
    path: string,
    init: RequestInit | undefined,
    format: ReportExportFormat,
    fallbackError: string
  ): Promise<ReportDownloadPayload> {
    const response = await this.request(path, init);

    if (!response.ok) {
      const payload = await response.json().catch(() => null);

      throw new PeriscanApiClientError(
        response.status,
        toErrorMessage(response.status, payload, fallbackError)
      );
    }

    const disposition = response.headers.get("content-disposition") ?? "";
    const filenameMatch = /filename="([^"]+)"/u.exec(disposition);

    return {
      content:
        format === "pdf" ? await response.arrayBuffer() : await response.text(),
      contentType:
        response.headers.get("content-type") ??
        (format === "pdf" ? "application/pdf" : "text/html; charset=utf-8"),
      filename:
        filenameMatch?.[1] ??
        `periscan-report.${format === "pdf" ? "pdf" : "html"}`,
      format
    };
  }

  async getHealth(): Promise<HealthResponse> {
    return this.requestJson(
      HEALTH_ROUTE,
      undefined,
      (payload) => HealthResponseSchema.parse(payload),
      "Health check failed"
    );
  }

  async getApiReference(): Promise<ApiReferenceDocument> {
    return this.requestJson(
      "/api-reference",
      undefined,
      (payload) => ApiReferenceDocumentSchema.parse(payload),
      "API reference unavailable"
    );
  }

  async getDataResidencyOptions(): Promise<DataResidencyOptions> {
    return this.requestJson(
      "/auth/data-residency-options",
      undefined,
      (payload) => DataResidencyOptionsSchema.parse(payload),
      "Data residency options unavailable"
    );
  }

  async signup(input: {
    dataRegion?: string;
    email: string;
    name: string;
    password: string;
    tenantName: string;
  }): Promise<AuthSessionPayload> {
    return this.requestJson(
      "/auth/signup",
      {
        body: JSON.stringify(input),
        method: "POST"
      },
      (payload) => payload as AuthSessionPayload,
      "Signup failed"
    );
  }

  async login(input: {
    email: string;
    password: string;
    totpCode?: string;
    recoveryCode?: string;
  }): Promise<AuthSessionPayload> {
    return this.requestJson(
      "/auth/login",
      {
        body: JSON.stringify(input),
        method: "POST"
      },
      (payload) => payload as AuthSessionPayload,
      "Login failed"
    );
  }

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    return this.requestJson(
      "/auth/password-reset/request",
      { body: JSON.stringify({ email }), method: "POST" },
      (payload) => payload as { message: string },
      "Unable to request a password reset"
    );
  }

  async confirmPasswordReset(input: {
    password: string;
    token: string;
  }): Promise<{ message: string }> {
    return this.requestJson(
      "/auth/password-reset/confirm",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => payload as { message: string },
      "Unable to reset your password"
    );
  }

  async acceptInvite(input: {
    password: string;
    token: string;
  }): Promise<{ message: string }> {
    return this.requestJson(
      "/auth/accept-invite",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => payload as { message: string },
      "Unable to accept the invitation"
    );
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    return this.requestJson(
      "/auth/verify-email",
      { body: JSON.stringify({ token }), method: "POST" },
      (payload) => payload as { message: string },
      "Unable to verify your email"
    );
  }

  async startSsoLogin(
    input: StartTenantSsoLoginInput
  ): Promise<TenantSsoLoginStartResult> {
    return this.requestJson(
      "/auth/sso/start",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => TenantSsoLoginStartResultSchema.parse(payload),
      "Unable to start single sign-on"
    );
  }

  async logout(): Promise<void> {
    const response = await this.request("/auth/logout", {
      method: "POST"
    });

    if (!response.ok && response.status !== 204) {
      const payload = await response.json().catch(() => null);

      throw new PeriscanApiClientError(
        response.status,
        toErrorMessage(response.status, payload, "Logout failed")
      );
    }

    // Drop working-tenant context so the next session cannot inherit it.
    try {
      clearWorkingTenant();
    } catch {
      // ignore storage failures on logout
    }
  }

  async getMe(): Promise<AuthSessionPayload> {
    return this.requestJson(
      "/me",
      undefined,
      (payload) => payload as AuthSessionPayload,
      "Unable to read current session"
    );
  }

  async getProductActivationState(): Promise<ProductActivationState> {
    return this.requestJson(
      "/experience/activation",
      undefined,
      (payload) => ProductActivationStateSchema.parse(payload),
      "Unable to read activation progress"
    );
  }

  async getProductWorkQueue(): Promise<ProductWorkQueue> {
    return this.requestJson(
      "/experience/work-queue",
      undefined,
      (payload) => ProductWorkQueueSchema.parse(payload),
      "Unable to read the operator work queue"
    );
  }

  async getBlueShiftBrief(): Promise<BlueShiftBrief> {
    return this.requestJson(
      "/experience/shift-brief",
      undefined,
      (payload) => BlueShiftBriefSchema.parse(payload),
      "Unable to read the blue shift brief"
    );
  }

  /**
   * P11-7 object workspace + hop neighborhood for risk-partition entity types.
   * Platform types should not call this (client returns a friendly error path).
   */
  async getObjectWorkspace(
    entityType: string,
    entityId: string
  ): Promise<{
    edges: Array<{
      graphEdgeId: string;
      relationship: string;
      evidenceBasis?: string | null;
      measurementMethod?: string | null;
    }>;
    neighbors: Array<{
      graphNodeId: string;
      label: string;
      nodeType: string;
      evidenceIds: string[];
      relatedEntityType?: string | null;
      relatedEntityId?: string | null;
    }>;
    node: {
      graphNodeId: string;
      label: string;
      nodeType: string;
      evidenceIds: string[];
    } | null;
    relatedEntity: {
      entityId: string;
      entityType: string;
      found: boolean;
    };
  }> {
    return this.requestJson(
      `/objects/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`,
      undefined,
      (payload) => {
        const body = payload as Record<string, unknown>;
        const nodeRaw = body.node as Record<string, unknown> | null | undefined;
        const neighborsRaw = Array.isArray(body.neighbors)
          ? (body.neighbors as Array<Record<string, unknown>>)
          : [];
        const edgesRaw = Array.isArray(body.edges)
          ? (body.edges as Array<Record<string, unknown>>)
          : [];
        return {
          edges: edgesRaw.map((e) => ({
            graphEdgeId: String(e.graphEdgeId ?? ""),
            relationship: String(e.relationship ?? ""),
            evidenceBasis:
              typeof e.evidenceBasis === "string" ? e.evidenceBasis : null,
            measurementMethod:
              typeof e.measurementMethod === "string"
                ? e.measurementMethod
                : null
          })),
          neighbors: neighborsRaw.map((n) => ({
            graphNodeId: String(n.graphNodeId ?? ""),
            label: String(n.label ?? ""),
            nodeType: String(n.nodeType ?? ""),
            evidenceIds: Array.isArray(n.evidenceIds)
              ? (n.evidenceIds as string[])
              : [],
            relatedEntityType:
              typeof n.relatedEntityType === "string"
                ? n.relatedEntityType
                : null,
            relatedEntityId:
              typeof n.relatedEntityId === "string" ? n.relatedEntityId : null
          })),
          node: nodeRaw
            ? {
                graphNodeId: String(nodeRaw.graphNodeId ?? ""),
                label: String(nodeRaw.label ?? ""),
                nodeType: String(nodeRaw.nodeType ?? ""),
                evidenceIds: Array.isArray(nodeRaw.evidenceIds)
                  ? (nodeRaw.evidenceIds as string[])
                  : []
              }
            : null,
          relatedEntity:
            body.relatedEntity && typeof body.relatedEntity === "object"
              ? (body.relatedEntity as {
                  entityId: string;
                  entityType: string;
                  found: boolean;
                })
              : {
                  entityId,
                  entityType,
                  found: false
                }
        };
      },
      "Unable to load object workspace"
    );
  }

  async getGraphNeighborhood(graphNodeId: string): Promise<{
    edges: Array<Record<string, unknown>>;
    neighbors: Array<Record<string, unknown>>;
    node: Record<string, unknown> | null;
  }> {
    return this.requestJson(
      `/graph/nodes/${encodeURIComponent(graphNodeId)}/neighbors`,
      undefined,
      (payload) => {
        const body = payload as Record<string, unknown>;
        return {
          edges: Array.isArray(body.edges)
            ? (body.edges as Array<Record<string, unknown>>)
            : [],
          neighbors: Array.isArray(body.neighbors)
            ? (body.neighbors as Array<Record<string, unknown>>)
            : [],
          node:
            body.node && typeof body.node === "object"
              ? (body.node as Record<string, unknown>)
              : null
        };
      },
      "Unable to load graph neighborhood"
    );
  }

  async updateProductExperienceProfile(
    input: UpdateProductExperienceProfileInput
  ): Promise<ProductExperienceProfile> {
    return this.requestJson(
      "/experience/profile",
      { body: JSON.stringify(input), method: "PUT" },
      (payload) => ProductExperienceProfileSchema.parse(payload),
      "Unable to save your starting view"
    );
  }

  async submitProductFeedback(
    input: SubmitProductFeedbackInput
  ): Promise<ProductFeedback> {
    return this.requestJson(
      "/experience/feedback",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => ProductFeedbackSchema.parse(payload),
      "Unable to save feedback"
    );
  }

  async changePassword(input: {
    currentPassword: string;
    newPassword: string;
    totpCode?: string;
  }): Promise<{ message: string }> {
    return this.requestJson(
      "/auth/password/change",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => payload as { message: string },
      "Unable to update password"
    );
  }

  async revokeOtherSessions(): Promise<{ message: string }> {
    return this.requestJson(
      "/auth/sessions/revoke-others",
      { body: JSON.stringify({}), method: "POST" },
      (payload) => payload as { message: string },
      "Unable to revoke other sessions"
    );
  }

  async enrollMfa(): Promise<{ secret: string; otpauthUri: string }> {
    return this.requestJson(
      "/auth/mfa/enroll",
      { body: JSON.stringify({}), method: "POST" },
      (payload) => payload as { secret: string; otpauthUri: string },
      "Unable to begin MFA enrollment"
    );
  }

  async verifyMfa(code: string): Promise<{
    activated: boolean;
    mfaEnabledAt: string;
    recoveryCodes: string[];
  }> {
    return this.requestJson(
      "/auth/mfa/verify",
      { body: JSON.stringify({ code }), method: "POST" },
      (payload) =>
        payload as {
          activated: boolean;
          mfaEnabledAt: string;
          recoveryCodes: string[];
        },
      "Unable to verify the MFA code"
    );
  }

  async regenerateMfaRecoveryCodes(input: {
    password?: string;
    totpCode?: string;
  }): Promise<{ recoveryCodes: string[] }> {
    return this.requestJson(
      "/auth/mfa/recovery-codes/regenerate",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => payload as { recoveryCodes: string[] },
      "Unable to regenerate recovery codes"
    );
  }

  async disableMfa(input: {
    password?: string;
    totpCode?: string;
  }): Promise<{ disabled: boolean }> {
    return this.requestJson(
      "/auth/mfa/disable",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => payload as { disabled: boolean },
      "Unable to disable MFA"
    );
  }

  async listScopes(): Promise<Scope[]> {
    return this.requestJson(
      "/scopes",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          ScopeSchema.parse(item)
        ),
      "Unable to read scopes"
    );
  }

  async createScope(
    input: Pick<CreateScopeInput, "scopeType" | "value"> &
      Partial<Omit<CreateScopeInput, "scopeType" | "value">>
  ): Promise<Scope> {
    return this.requestJson(
      "/scopes",
      {
        body: JSON.stringify(input),
        method: "POST"
      },
      (payload) => ScopeSchema.parse(payload),
      "Unable to create scope"
    );
  }

  async updateScopeClassification(
    scopeId: string,
    input: UpdateScopeClassificationInput
  ): Promise<Scope> {
    return this.requestJson(
      `/scopes/${scopeId}/classification`,
      {
        body: JSON.stringify(input),
        method: "PATCH"
      },
      (payload) => ScopeSchema.parse(payload),
      "Unable to update scope classification"
    );
  }

  async verifyScope(
    scopeId: string,
    input: { devModeManual?: boolean; operatorAttestation?: boolean } = {}
  ): Promise<Scope> {
    return this.requestJson(
      `/scopes/${scopeId}/verify`,
      {
        body: JSON.stringify(input),
        method: "POST"
      },
      (payload) => ScopeSchema.parse(payload),
      "Unable to verify scope"
    );
  }

  async runScopePostureCheck(
    scopeId: string
  ): Promise<ScopePostureCheckResult> {
    return this.requestJson(
      `/scopes/${scopeId}/posture-check`,
      {
        body: JSON.stringify({ executionMode: "LiveSafe" }),
        method: "POST"
      },
      (payload) => payload as ScopePostureCheckResult,
      "Unable to run posture check"
    );
  }

  async listIntegrations(): Promise<Integration[]> {
    return this.requestJson(
      "/integrations",
      undefined,
      (payload) => (payload as { items: Integration[] }).items,
      "Unable to read integrations"
    );
  }

  async listIntegrationCatalog(): Promise<ConnectorCatalogEntry[]> {
    return this.requestJson(
      "/integrations/catalog",
      undefined,
      (payload) => (payload as { items: ConnectorCatalogEntry[] }).items,
      "Unable to read integration catalog"
    );
  }

  async getEnterpriseBreadthReadiness(): Promise<EnterpriseBreadthReadiness> {
    return this.requestJson(
      "/packs/enterprise-readiness",
      undefined,
      (payload) => EnterpriseBreadthReadinessSchema.parse(payload),
      "Unable to read enterprise breadth readiness"
    );
  }

  async getExecutionIntegrityHonesty(): Promise<
    import("@periscan/shared").ExecutionIntegrityHonesty
  > {
    return this.requestJson(
      "/execution-integrity/honesty",
      undefined,
      (payload) => ExecutionIntegrityHonestySchema.parse(payload),
      "Unable to read execution integrity honesty"
    );
  }

  async getModelExtractionHonesty(): Promise<
    import("@periscan/shared").ModelExtractionHonesty
  > {
    return this.requestJson(
      "/model-extraction-resistance/honesty",
      undefined,
      (payload) => ModelExtractionHonestySchema.parse(payload),
      "Unable to read model extraction honesty"
    );
  }

  async listSafetyEquivalentPacks(): Promise<
    import("@periscan/shared").SafetyEquivalentPacksResponse
  > {
    return this.requestJson(
      "/safety-equivalent-packs",
      undefined,
      (payload) => SafetyEquivalentPacksResponseSchema.parse(payload),
      "Unable to read safety-equivalent packs"
    );
  }

  async createIntegration(input: {
    authType?: string;
    config?: Record<string, unknown>;
    connectorKey: string;
    mockMode?: boolean;
  }): Promise<Integration> {
    return this.requestJson(
      "/integrations",
      {
        body: JSON.stringify(input),
        method: "POST"
      },
      (payload) => payload as Integration,
      "Unable to create integration"
    );
  }

  async deleteIntegration(integrationId: string): Promise<void> {
    const response = await this.request(`/integrations/${integrationId}`, {
      method: "DELETE"
    });

    if (!response.ok && response.status !== 204) {
      const payload = await response.json().catch(() => null);

      throw new PeriscanApiClientError(
        response.status,
        toErrorMessage(response.status, payload, "Unable to delete integration")
      );
    }
  }

  async getIntegrationHealth(
    integrationId: string
  ): Promise<{ health: ConnectorHealth; integration: Integration }> {
    return this.requestJson(
      `/integrations/${integrationId}/health`,
      undefined,
      (payload) =>
        payload as { health: ConnectorHealth; integration: Integration },
      "Unable to read integration health"
    );
  }

  async syncIntegration(integrationId: string): Promise<{
    assetCount: number;
    health: ConnectorHealth;
    integration: Integration;
    signalCount: number;
    signals: SignalEnvelope[];
  }> {
    return this.requestJson(
      `/integrations/${integrationId}/sync`,
      { method: "POST" },
      (payload) =>
        payload as {
          assetCount: number;
          health: ConnectorHealth;
          integration: Integration;
          signalCount: number;
          signals: SignalEnvelope[];
        },
      "Unable to sync integration"
    );
  }

  async setIntegrationSyncSchedule(
    integrationId: string,
    frequency: ScheduleFrequency | null
  ): Promise<Integration> {
    return this.requestJson(
      `/integrations/${integrationId}/sync-schedule`,
      {
        body: JSON.stringify({ frequency }),
        method: "POST"
      },
      (payload) => payload as Integration,
      "Unable to set the integration sync schedule"
    );
  }

  async listAttackPaths(): Promise<AttackPathAssessment[]> {
    // Offset-paginated server-side (default 50). Workbench loads pages until complete.
    const items: AttackPathAssessment[] = [];
    let offset = 0;
    const limit = 200;
    for (;;) {
      const page = await this.requestJson(
        `/attack-paths?limit=${limit}&offset=${offset}`,
        undefined,
        (payload) =>
          payload as {
            items: AttackPathAssessment[];
            page?: { hasMore?: boolean; limit?: number; offset?: number };
          },
        "Unable to read attack paths"
      );
      items.push(...(page.items ?? []));
      if (!page.page?.hasMore || (page.items?.length ?? 0) === 0) break;
      offset += page.items.length;
    }
    return items;
  }

  async getAttackPathChokePointAnalysis(): Promise<AttackPathChokePointAnalysis> {
    return this.requestJson(
      "/attack-paths/choke-points",
      undefined,
      (payload) => AttackPathChokePointAnalysisSchema.parse(payload),
      "Unable to optimize attack-path control points"
    );
  }

  async listAssets(): Promise<Asset[]> {
    return this.requestJson(
      "/assets",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          AssetSchema.parse(item)
        ),
      "Unable to read assets"
    );
  }

  async getAssetLineage(assetId: string): Promise<AssetLineage> {
    return this.requestJson(
      `/data-fabric/assets/${assetId}/lineage`,
      undefined,
      (payload) => AssetLineageSchema.parse(payload),
      "Unable to read asset source lineage"
    );
  }

  async getAssetOwnershipSurface(): Promise<AssetOwnershipSurface> {
    return this.requestJson(
      "/data-fabric/ownership-surface",
      undefined,
      (payload) => AssetOwnershipSurfaceSchema.parse(payload),
      "Unable to read asset ownership confidence"
    );
  }

  async getDataFabricQualitySurface(): Promise<DataFabricQualitySurface> {
    return this.requestJson(
      "/data-fabric/quality-surface",
      undefined,
      (payload) => DataFabricQualitySurfaceSchema.parse(payload),
      "Unable to read data source quality"
    );
  }

  /**
   * BYO scan-file import (P11R-4 / P19-r4). Writes Imported signals only —
   * never Measured. Raw EvidenceArtifact chain may still be Partial.
   */
  async importScanFile(input: ImportScanFileInput): Promise<ScanImportResult> {
    const body = ImportScanFileInputSchema.parse(input);
    return this.requestJson(
      "/data-fabric/scan-import",
      {
        body: JSON.stringify(body),
        method: "POST"
      },
      (payload) => ScanImportResultSchema.parse(payload),
      "Unable to import scan file"
    );
  }

  async reviewAssetOwnershipCandidate(
    assetId: string,
    input: ReviewAssetOwnershipCandidateInput
  ): Promise<AssetOwnershipReview> {
    return this.requestJson(
      `/data-fabric/ownership-candidates/${assetId}/review`,
      {
        body: JSON.stringify(input),
        method: "PATCH"
      },
      (payload) => AssetOwnershipReviewSchema.parse(payload),
      "Unable to record the ownership review"
    );
  }

  async updateAssetValuation(
    assetId: string,
    input: AssetValuationInput
  ): Promise<Asset> {
    return this.requestJson(
      `/assets/${assetId}/valuation`,
      {
        body: JSON.stringify(input),
        method: "PATCH"
      },
      (payload) => AssetSchema.parse(payload),
      "Unable to update asset financial assumptions"
    );
  }

  async getBusinessImpactWorkspace(): Promise<BusinessImpactWorkspace> {
    return this.requestJson(
      "/business-impact/workspace",
      undefined,
      (payload) => BusinessImpactWorkspaceSchema.parse(payload),
      "Unable to read business-impact governance"
    );
  }

  async getAsyncOperationsWorkspace(): Promise<AsyncOperationsWorkspace> {
    return this.requestJson(
      "/async-operations/workspace",
      undefined,
      (payload) => AsyncOperationsWorkspaceSchema.parse(payload),
      "Unable to read asynchronous operations"
    );
  }

  async updateAsyncOperationsPolicy(
    input: AsyncOperationsPolicyInput
  ): Promise<AsyncOperationsWorkspace> {
    return this.requestJson(
      "/async-operations/policy",
      { body: JSON.stringify(input), method: "PUT" },
      (payload) => AsyncOperationsWorkspaceSchema.parse(payload),
      "Unable to update asynchronous operating targets"
    );
  }

  async reconcileAsyncOperations(
    input: AsyncOperationsReasonInput
  ): Promise<AsyncOperationsReconcileResult> {
    return this.requestJson(
      "/async-operations/reconcile",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => AsyncOperationsReconcileResultSchema.parse(payload),
      "Unable to reconcile asynchronous work"
    );
  }

  async recordAsyncRecoveryDecision(
    input: AsyncRecoveryDecisionInput
  ): Promise<AsyncRecoveryDecisionResult> {
    return this.requestJson(
      "/async-operations/recovery-decisions",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => AsyncRecoveryDecisionResultSchema.parse(payload),
      "Unable to record the recovery decision"
    );
  }

  async previewAssetValuation(
    assetId: string,
    input: SubmitAssetValuationVersionInput
  ): Promise<BusinessImpactPreview> {
    return this.requestJson(
      `/assets/${assetId}/valuation/preview`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => BusinessImpactPreviewSchema.parse(payload),
      "Unable to preview financial assumptions"
    );
  }

  async submitAssetValuationVersion(
    assetId: string,
    input: SubmitAssetValuationVersionInput
  ): Promise<AssetValuationVersion> {
    return this.requestJson(
      `/assets/${assetId}/valuation/versions`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => AssetValuationVersionSchema.parse(payload),
      "Unable to submit financial assumptions for review"
    );
  }

  async reviewAssetValuationVersion(
    assetId: string,
    valuationVersionId: string,
    input: ReviewAssetValuationVersionInput
  ): Promise<AssetValuationVersion> {
    return this.requestJson(
      `/assets/${assetId}/valuation/versions/${valuationVersionId}/review`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => AssetValuationVersionSchema.parse(payload),
      "Unable to review financial assumptions"
    );
  }

  async listRemediations(): Promise<RemediationTask[]> {
    // Offset-paginated server-side (default 50). Workbench loads pages until complete.
    const items: RemediationTask[] = [];
    let offset = 0;
    const limit = 200;
    for (;;) {
      const page = await this.requestJson(
        `/remediations?limit=${limit}&offset=${offset}`,
        undefined,
        (payload) =>
          payload as {
            items: RemediationTask[];
            page?: { hasMore?: boolean; limit?: number; offset?: number };
          },
        "Unable to read remediations"
      );
      items.push(...(page.items ?? []));
      if (!page.page?.hasMore || (page.items?.length ?? 0) === 0) break;
      offset += page.items.length;
    }
    return items;
  }

  /** Single-id read for remediation detail deep links (P14-15). */
  async getRemediation(remediationId: string): Promise<RemediationTask> {
    return this.requestJson(
      `/remediations/${remediationId}`,
      undefined,
      (payload) => RemediationTaskSchema.parse(payload),
      "Unable to read remediation"
    );
  }

  async getComplianceGovernance(
    framework: ComplianceFrameworkKey
  ): Promise<ComplianceGovernanceInventory> {
    return this.requestJson(
      `/compliance/governance?framework=${encodeURIComponent(framework)}`,
      undefined,
      (payload) => ComplianceGovernanceInventorySchema.parse(payload),
      "Unable to read compliance governance"
    );
  }

  async updateComplianceControlGovernance(
    input: UpdateComplianceControlGovernanceInput
  ): Promise<ComplianceGovernanceInventory> {
    return this.requestJson(
      "/compliance/governance",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => ComplianceGovernanceInventorySchema.parse(payload),
      "Unable to update compliance governance"
    );
  }

  async listComplianceGovernanceChanges(
    framework: ComplianceFrameworkKey,
    controlId?: string
  ): Promise<ComplianceGovernanceChange[]> {
    const query = new URLSearchParams({ framework });
    if (controlId) query.set("controlId", controlId);
    return this.requestJson(
      `/compliance/governance/history?${query.toString()}`,
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          ComplianceGovernanceChangeSchema.parse(item)
        ),
      "Unable to read compliance governance history"
    );
  }

  async getComplianceGovernanceSummary(): Promise<ComplianceGovernanceMultiFrameworkSummary> {
    return this.requestJson(
      "/compliance/governance/summary",
      undefined,
      (payload) =>
        ComplianceGovernanceMultiFrameworkSummarySchema.parse(payload),
      "Unable to read multi-framework compliance governance summary"
    );
  }

  async batchUpdateComplianceGovernance(
    input: BatchComplianceGovernanceInput
  ): Promise<BatchComplianceGovernanceResult> {
    return this.requestJson(
      "/compliance/governance/batch",
      {
        body: JSON.stringify(BatchComplianceGovernanceInputSchema.parse(input)),
        method: "POST"
      },
      (payload) => BatchComplianceGovernanceResultSchema.parse(payload),
      "Unable to batch-update compliance governance"
    );
  }

  async exportMultiFrameworkCompliancePacks(
    input: MultiFrameworkComplianceExportInput
  ): Promise<MultiFrameworkComplianceExportResult> {
    return this.requestJson(
      "/compliance/exports/multi-framework",
      {
        body: JSON.stringify(
          MultiFrameworkComplianceExportInputSchema.parse(input)
        ),
        method: "POST"
      },
      (payload) => MultiFrameworkComplianceExportResultSchema.parse(payload),
      "Unable to export multi-framework compliance packs"
    );
  }

  async getPartnerCapabilityHonesty(): Promise<PartnerCapabilityHonesty> {
    return this.requestJson(
      "/partner-capabilities/honesty",
      undefined,
      (payload) => PartnerCapabilityHonestySchema.parse(payload),
      "Unable to read partner capability honesty"
    );
  }

  async listNonHumanIdentities(): Promise<NonHumanIdentityInventory> {
    return this.requestJson(
      "/non-human-identities",
      undefined,
      (payload) => NonHumanIdentityInventorySchema.parse(payload),
      "Unable to read the non-human identity inventory"
    );
  }

  async registerNonHumanIdentity(
    input: RegisterNonHumanIdentityInput
  ): Promise<NonHumanIdentity> {
    return this.requestJson(
      "/non-human-identities",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => NonHumanIdentitySchema.parse(payload),
      "Unable to register non-human identity metadata"
    );
  }

  async createRemediation(
    input: CreateRemediationInput
  ): Promise<RemediationTask> {
    return this.requestJson(
      "/remediations",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => RemediationTaskSchema.parse(payload),
      "Unable to create remediation task"
    );
  }

  async createControlGapRemediation(input: {
    controlSourceId?: string;
    coverageStatus: "LoggedOnly" | "NeedsTuning" | "Missed";
    dueAt?: string;
    note?: string;
    owner?: string | null;
    techniqueId: string;
    techniqueName?: string;
  }): Promise<RemediationTask> {
    return this.requestJson(
      "/control-sources/detection-eng-tasks",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => RemediationTaskSchema.parse(payload),
      "Unable to create detection-eng task"
    );
  }

  async listRemediationActions(
    remediationId: string
  ): Promise<RemediationAction[]> {
    return this.requestJson(
      `/remediations/${remediationId}/actions`,
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          RemediationActionSchema.parse(item)
        ),
      "Unable to read governed remediation actions"
    );
  }

  async previewRemediationAction(
    remediationId: string,
    input: PreviewRemediationActionInput
  ): Promise<RemediationAction> {
    return this.requestJson(
      `/remediations/${remediationId}/actions/preview`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => RemediationActionSchema.parse(payload),
      "Unable to preview the remediation action"
    );
  }

  async confirmRemediationAction(
    remediationActionId: string,
    operation: "approve" | "execute" | "rollback",
    previewHash: string
  ): Promise<RemediationAction> {
    return this.requestJson(
      `/remediation-actions/${remediationActionId}/${operation}`,
      { body: JSON.stringify({ previewHash }), method: "POST" },
      (payload) => RemediationActionSchema.parse(payload),
      `Unable to ${operation} the remediation action`
    );
  }

  async listInfrastructureChanges(
    remediationId: string
  ): Promise<InfrastructureChangeRequest[]> {
    return this.requestJson(
      `/remediations/${remediationId}/infrastructure-changes`,
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          InfrastructureChangeRequestSchema.parse(item)
        ),
      "Unable to read infrastructure pull requests"
    );
  }

  async previewInfrastructureChange(
    remediationId: string,
    input: PreviewInfrastructureChangeInput
  ): Promise<InfrastructureChangeRequest> {
    return this.requestJson(
      `/remediations/${remediationId}/infrastructure-changes`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => InfrastructureChangeRequestSchema.parse(payload),
      "Unable to preview the infrastructure pull request"
    );
  }

  async confirmInfrastructureChange(
    infrastructureChangeRequestId: string,
    operation: "approve" | "execute" | "rollback",
    previewHash: string
  ): Promise<InfrastructureChangeRequest> {
    return this.requestJson(
      `/infrastructure-changes/${infrastructureChangeRequestId}/${operation}`,
      { body: JSON.stringify({ previewHash }), method: "POST" },
      (payload) => InfrastructureChangeRequestSchema.parse(payload),
      `Unable to ${operation} the infrastructure pull request`
    );
  }

  async refreshInfrastructureChange(
    infrastructureChangeRequestId: string
  ): Promise<InfrastructureChangeRequest> {
    return this.requestJson(
      `/infrastructure-changes/${infrastructureChangeRequestId}/refresh`,
      { method: "POST" },
      (payload) => InfrastructureChangeRequestSchema.parse(payload),
      "Unable to refresh pull request and CI status"
    );
  }

  async getPrescriptivePlan(remediationId: string): Promise<any> {
    return this.requestJson(
      `/remediations/${remediationId}/plan`,
      undefined,
      (p) => p,
      "Unable to load prescriptive plan"
    );
  }

  /**
   * Preferred RemOps closed loop: plan → mark-ready → revalidate.
   * Response always includes actionApplied: false (no config push).
   */
  async autoRevalidate(remediationId: string): Promise<{
    actionApplied: false;
    autoExecuted: boolean;
    closedLoop: string;
    plan: unknown;
    verification: unknown;
  }> {
    return this.requestJson(
      `/remediations/${remediationId}/auto-revalidate`,
      { method: "POST", body: "{}" },
      (p) => p as {
        actionApplied: false;
        autoExecuted: boolean;
        closedLoop: string;
        plan: unknown;
        verification: unknown;
      },
      "Auto-revalidate failed"
    );
  }

  /** @deprecated Prefer autoRevalidate — name implied control push. */
  async autoMitigate(remediationId: string) {
    return this.autoRevalidate(remediationId);
  }

  // D/E: remediation simulator (what-if), playbooks, tripwires, trends, AI chat sim, retest
  async simulateRemediation(
    remediationId: string,
    proposedFix: string,
    currentRiskScore?: number
  ): Promise<any> {
    return this.requestJson(
      `/remediations/${remediationId}/simulate`,
      {
        method: "POST",
        body: JSON.stringify({ proposedFix, currentRiskScore })
      },
      (p) => p,
      "Simulator failed"
    );
  }

  async getPlaybooks(remediationId: string): Promise<any> {
    return this.requestJson(
      `/remediations/${remediationId}/playbooks`,
      undefined,
      (p) => p,
      "Playbooks load failed"
    );
  }

  async createTripwire(remediationId: string): Promise<any> {
    return this.requestJson(
      `/remediations/${remediationId}/tripwire`,
      { method: "POST", body: "{}" },
      (p) => p,
      "Tripwire failed"
    );
  }

  async getFixTrends(): Promise<any[]> {
    return this.requestJson(
      "/remediations/trends",
      undefined,
      (p) => (p as any[]) || [],
      "Trends failed"
    );
  }

  async listExternalValidationProfiles(): Promise<
    ExternalValidationTemplateProfileMetadata[]
  > {
    return this.requestJson(
      "/external-validation/profiles",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map(
          (item) =>
            ExternalValidationProfileMetadataSchema.parse(
              item
            ) as ExternalValidationTemplateProfileMetadata
        ),
      "Unable to read external validation profiles"
    );
  }

  async listExternalValidationAttempts(): Promise<ExternalValidationAttempt[]> {
    return this.requestJson(
      "/external-validation/attempts",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          ExternalValidationAttemptSchema.parse(item)
        ),
      "Unable to read external validation attempts"
    );
  }

  async listAttackTechniques(): Promise<AttackTechnique[]> {
    return this.requestJson(
      "/attack-techniques",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          AttackTechniqueSchema.parse(item)
        ),
      "Unable to read attack techniques"
    );
  }

  async listEvidence(): Promise<EvidenceArtifact[]> {
    return this.requestJson(
      "/evidence",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          EvidenceArtifactSchema.parse(item)
        ),
      "Unable to read evidence"
    );
  }

  async verifyEvidenceChain(): Promise<EvidenceChainVerificationReport> {
    return this.requestJson(
      "/evidence/verify-chain",
      undefined,
      (payload) => EvidenceChainVerificationReportSchema.parse(payload),
      "Unable to verify the evidence chain"
    );
  }

  async verifyEvidenceIntegrity(
    evidenceId: string
  ): Promise<EvidenceArtifactVerification> {
    return this.requestJson(
      `/evidence/${evidenceId}/verify`,
      undefined,
      (payload) => EvidenceArtifactVerificationSchema.parse(payload),
      "Unable to verify evidence integrity"
    );
  }

  async downloadEvidence(evidenceId: string): Promise<{
    artifact: EvidenceArtifact;
    content: string;
    computedSha256: string;
    integrityVerified: boolean;
    recordedSha256: string;
  }> {
    return this.requestJson(
      `/evidence/${evidenceId}/download`,
      undefined,
      (payload) =>
        payload as {
          artifact: EvidenceArtifact;
          content: string;
          computedSha256: string;
          integrityVerified: boolean;
          recordedSha256: string;
        },
      "Unable to download evidence"
    );
  }

  async redactEvidence(evidenceId: string): Promise<EvidenceArtifact> {
    return this.requestJson(
      `/evidence/${evidenceId}/redact`,
      { method: "POST" },
      (payload) => EvidenceArtifactSchema.parse(payload),
      "Unable to redact evidence"
    );
  }

  async listReports(input?: { limit?: number }): Promise<EvidencePack[]> {
    return this.requestJson(
      `/reports${buildQueryString({ limit: input?.limit })}`,
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          EvidencePackSchema.parse(item)
        ),
      "Unable to read reports"
    );
  }

  async createReport(input: {
    audience?: string;
    maxTopItems?: number;
    packType?: EvidencePackType;
    snapshotId?: string;
    title?: string;
  }): Promise<EvidencePack> {
    return this.requestJson(
      "/reports",
      {
        body: JSON.stringify(input),
        method: "POST"
      },
      (payload) => EvidencePackSchema.parse(payload),
      "Unable to create report"
    );
  }

  async createTenantIsolationProof(): Promise<TenantIsolationProof> {
    return this.requestJson(
      "/reports/tenant-isolation-proof",
      { method: "POST" },
      (payload) => TenantIsolationProofSchema.parse(payload),
      "Unable to generate tenant-isolation proof"
    );
  }

  async getReport(reportId: string): Promise<EvidencePack> {
    // Direct pack evidence fetch for Q2 release-grade depth on dedicated pages (beyond CTEM summary)
    return this.requestJson(
      `/reports/${reportId}`,
      undefined,
      (payload) => EvidencePackSchema.parse(payload),
      "Unable to load report pack"
    );
  }

  async getEvidencePack(packId: string): Promise<EvidencePack> {
    // full getEvidencePack support (Q3 Direct pack + model depth + pack viewer); calls dedicated /evidence-packs for API parity; use over getReport where specific pack load prioritized over CTEM
    return this.requestJson(
      `/evidence-packs/${packId}`,
      undefined,
      (payload) => EvidencePackSchema.parse(payload),
      "Unable to load evidence pack"
    );
  }

  async listAIApplications(): Promise<AIApplication[]> {
    return this.requestJson(
      "/ai-apps",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          AIApplicationSchema.parse(item)
        ),
      "Unable to read AI applications"
    );
  }

  async createAIApplication(input: {
    appType: string;
    authMethod: string;
    dataSourcesDescription: string;
    endpointUrl: string;
    guardrailsDescription: string;
    name: string;
    owner: string;
    ragEnabled: boolean;
    scopeId: string;
    testAccountNotes?: string;
    toolsEnabled: boolean;
  }): Promise<AIApplication> {
    return this.requestJson(
      "/ai-apps",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => AIApplicationSchema.parse(payload),
      "Unable to register AI application"
    );
  }

  async validateAIApplication(
    aiAppId: string,
    input: AIApplicationValidationInput = {}
  ): Promise<AIApplicationValidationResult> {
    return this.requestJson(
      `/ai-apps/${aiAppId}/validate`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => {
        const result = payload as Record<string, unknown>;
        return {
          attackTechniques: (result.attackTechniques as unknown[]).map(
            (technique) => AttackTechniqueSchema.parse(technique)
          ),
          decision: PolicyDecisionSchema.parse(result.decision),
          evidence: (result.evidence as unknown[]).map((artifact) =>
            EvidenceArtifactSchema.parse(artifact)
          ),
          mission: ValidationMissionSchema.parse(result.mission),
          run: ValidationRunSchema.parse(result.run),
          signals: (result.signals as unknown[]).map((signal) =>
            SignalEnvelopeSchema.parse(signal)
          )
        };
      },
      "Unable to validate AI application"
    );
  }

  async setAIValidationKillSwitch(
    aiAppId: string,
    input: { enabled: boolean; reason: string }
  ): Promise<AIApplication> {
    return this.requestJson(
      `/ai-apps/${aiAppId}/kill-switch`,
      { body: JSON.stringify(input), method: "PUT" },
      (payload) => AIApplicationSchema.parse(payload),
      "Unable to change the AI validation kill switch"
    );
  }

  async listControlSources(): Promise<ControlSource[]> {
    return this.requestJson(
      "/control-sources",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          ControlSourceSchema.parse(item)
        ),
      "Unable to read control sources"
    );
  }

  async listValidationStimuli(): Promise<ValidationStimulus[]> {
    return this.requestJson(
      "/control-sources/stimuli",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          ValidationStimulusSchema.parse(item)
        ),
      "Unable to read control-validation stimuli"
    );
  }

  async createValidationStimulus(
    input: CreateValidationStimulusInput
  ): Promise<CreateValidationStimulusResponse> {
    return this.requestJson(
      "/control-sources/stimuli",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => CreateValidationStimulusResponseSchema.parse(payload),
      "Unable to create the control-validation stimulus"
    );
  }

  async listPolicyDecisions(input?: {
    missionType?: string;
    outcome?: string;
    scopeId?: string;
    limit?: number;
  }): Promise<PolicyDecision[]> {
    const query = new URLSearchParams();
    if (input?.missionType) query.set("missionType", input.missionType);
    if (input?.outcome) query.set("outcome", input.outcome);
    if (input?.scopeId) query.set("scopeId", input.scopeId);
    if (input?.limit != null) query.set("limit", String(input.limit));
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    return this.requestJson(
      `/policy-decisions${suffix}`,
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          PolicyDecisionSchema.parse(item)
        ),
      "Unable to read policy decisions"
    );
  }

  async listPendingApprovals(): Promise<PolicyDecision[]> {
    return this.requestJson(
      "/approvals/pending",
      undefined,
      (payload) => {
        const body = payload as { items?: unknown[] };
        return (body.items ?? []).map((item) =>
          PolicyDecisionSchema.parse(item)
        );
      },
      "Unable to list pending policy approvals"
    );
  }

  async approvePolicyDecision(
    policyDecisionId: string
  ): Promise<PolicyDecision> {
    return this.requestJson(
      `/approvals/${policyDecisionId}/approve`,
      { method: "POST" },
      (payload) => PolicyDecisionSchema.parse(payload),
      "Unable to approve the policy decision"
    );
  }

  async denyPolicyDecision(
    policyDecisionId: string
  ): Promise<PolicyDecision> {
    return this.requestJson(
      `/approvals/${policyDecisionId}/deny`,
      { method: "POST" },
      (payload) => PolicyDecisionSchema.parse(payload),
      "Unable to deny the policy decision"
    );
  }

  async dispatchValidationStimulus(
    stimulusId: string
  ): Promise<ValidationStimulus> {
    return this.requestJson(
      `/control-sources/stimuli/${stimulusId}/dispatch`,
      { method: "POST" },
      (payload) => ValidationStimulusSchema.parse(payload),
      "Unable to dispatch the control-validation stimulus"
    );
  }

  async observeValidationStimulus(
    stimulusId: string
  ): Promise<ValidationStimulus> {
    return this.requestJson(
      `/control-sources/stimuli/${stimulusId}/observe`,
      { method: "POST" },
      (payload) => ValidationStimulusSchema.parse(payload),
      "Unable to observe the control-validation stimulus"
    );
  }

  async cancelValidationStimulus(
    stimulusId: string
  ): Promise<ValidationStimulus> {
    return this.requestJson(
      `/control-sources/stimuli/${stimulusId}/cancel`,
      { method: "POST" },
      (payload) => ValidationStimulusSchema.parse(payload),
      "Unable to cancel the control-validation stimulus"
    );
  }

  async createControlSource(input: {
    controlType: string;
    expectedBehaviors: ControlSource["expectedBehaviors"];
    integrationId: string;
    provider: string;
  }): Promise<ControlSource> {
    return this.requestJson(
      "/control-sources",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => ControlSourceSchema.parse(payload),
      "Unable to register control source"
    );
  }

  async updateControlSource(
    controlSourceId: string,
    input: { expectedBehaviors: ControlSource["expectedBehaviors"] }
  ): Promise<ControlSource> {
    return this.requestJson(
      `/control-sources/${controlSourceId}`,
      { body: JSON.stringify(input), method: "PATCH" },
      (payload) => ControlSourceSchema.parse(payload),
      "Unable to tune control source"
    );
  }

  async validateControlSource(
    controlSourceId: string,
    input: { executionMode?: "DryRun"; techniqueId?: string } = {}
  ): Promise<ValidationRun> {
    return this.requestJson(
      `/control-sources/${controlSourceId}/validate`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => ValidationRunSchema.parse((payload as { run: unknown }).run),
      "Unable to validate control source"
    );
  }

  /**
   * Wave B DRV product path: allowlisted benign marker emit→observe.
   * Benign-marker class only — not full ATT&CK BAS library inject.
   */
  async runDetectionMarkerProof(
    controlSourceId: string,
    input: DetectionMarkerProofInput = {}
  ): Promise<DetectionMarkerProofResult> {
    return this.requestJson(
      `/control-sources/${controlSourceId}/detection-marker-proof`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => DetectionMarkerProofResultSchema.parse(payload),
      "Unable to run detection marker proof"
    );
  }

  /**
   * Phase C DNS-exfil *detection* canary product path.
   * Allowlisted label only — never real data exfiltration / bulk tunnel.
   * measured is false unless emit + liveTelemetry both hold.
   */
  async runDnsExfilCanaryProof(
    controlSourceId: string,
    input: DnsExfilCanaryProofInput = {}
  ): Promise<DnsExfilCanaryProofResult> {
    return this.requestJson(
      `/control-sources/${controlSourceId}/dns-exfil-canary-proof`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => DnsExfilCanaryProofResultSchema.parse(payload),
      "Unable to run DNS exfil canary proof"
    );
  }

  async listRunners(): Promise<RunnerRecord[]> {
    return this.requestJson(
      "/runners",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          RunnerRecordSchema.parse(item)
        ),
      "Unable to read runners"
    );
  }

  async getRunnerFleetWorkspace(): Promise<RunnerFleetWorkspace> {
    return this.requestJson(
      "/runners/fleet",
      undefined,
      (payload) => RunnerFleetWorkspaceSchema.parse(payload),
      "Unable to read runner fleet health"
    );
  }

  async updateRunnerFleetPolicy(
    input: UpdateRunnerFleetPolicyInput
  ): Promise<RunnerFleetPolicy> {
    return this.requestJson(
      "/runners/fleet/policy",
      { body: JSON.stringify(input), method: "PUT" },
      (payload) => RunnerFleetPolicySchema.parse(payload),
      "Unable to update runner fleet policy"
    );
  }

  async listRunnerTransportDecisions(): Promise<RunnerTransportDecision[]> {
    return this.requestJson(
      "/runners/transport-decisions",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          RunnerTransportDecisionSchema.parse(item)
        ),
      "Unable to read runner transport decisions"
    );
  }

  async getRunner(runnerId: string): Promise<RunnerRecord> {
    return this.requestJson(
      `/runners/${runnerId}`,
      undefined,
      (payload) => RunnerRecordSchema.parse(payload),
      "Unable to read runner"
    );
  }

  async listRunnerTasks(runnerId: string): Promise<RunnerTaskRecord[]> {
    return this.requestJson(
      `/runners/${runnerId}/tasks`,
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          RunnerTaskRecordSchema.parse(item)
        ),
      "Unable to read runner tasks"
    );
  }

  // Dispatch an allowlisted in-network discovery module (recon.*) to a runner
  // against an internal-network target. moduleId must be a RUNNER_DISCOVER
  // module; the server enforces the allowlist + policy + verified scope.
  async createRunnerDiscoverTask(
    runnerId: string,
    input: {
      moduleId: string;
      scopeId: string;
      target: string;
      topPorts?: number;
    }
  ): Promise<RunnerTaskRecord> {
    return this.requestJson(
      `/runners/${runnerId}/tasks/discover`,
      {
        body: JSON.stringify(input),
        method: "POST"
      },
      (payload) =>
        RunnerTaskRecordSchema.parse((payload as { task: unknown }).task),
      "Unable to dispatch a discovery runner task"
    );
  }

  // Dispatch an allowlisted measured (periscan.*) module to a runner against an
  // internal host. moduleId must be one of RUNNER_MEASURED_MODULE_IDS; the
  // server enforces the allowlist + policy + verified scope. Returns the signed
  // dispatched task.
  async createRunnerMeasuredTask(
    runnerId: string,
    input: {
      markerId?: string;
      moduleId: string;
      path?: string;
      platform?: "macOS" | "Linux";
      port?: number;
      scheme?: "http" | "https";
      scopeId: string;
      targetHost: string;
    }
  ): Promise<RunnerTaskRecord> {
    return this.requestJson(
      `/runners/${runnerId}/tasks/measured`,
      {
        body: JSON.stringify(input),
        method: "POST"
      },
      (payload) =>
        RunnerTaskRecordSchema.parse((payload as { task: unknown }).task),
      "Unable to dispatch a measured runner task"
    );
  }

  async createRunnerRegistrationToken(input: {
    deploymentMode: string;
    labels?: string[];
    runnerName: string;
  }): Promise<RunnerRegistrationTokenIssueResponse> {
    return this.requestJson(
      "/runners/registration-tokens",
      {
        body: JSON.stringify(input),
        method: "POST"
      },
      (payload) => RunnerRegistrationTokenIssueResponseSchema.parse(payload),
      "Unable to issue a runner registration token"
    );
  }

  async setRunnerKillSwitch(
    runnerId: string,
    input: { active: boolean; reason?: string | null }
  ): Promise<RunnerRecord> {
    return this.requestJson(
      `/runners/${runnerId}/kill-switch`,
      {
        body: JSON.stringify(input),
        method: "POST"
      },
      (payload) =>
        RunnerRecordSchema.parse((payload as { runner: unknown }).runner),
      "Unable to update the runner kill switch"
    );
  }

  async revokeRunner(runnerId: string): Promise<RunnerRecord> {
    return this.requestJson(
      `/runners/${runnerId}/revoke`,
      {
        method: "POST"
      },
      (payload) => RunnerRecordSchema.parse(payload),
      "Unable to revoke the runner"
    );
  }

  async getCTEMProgram(): Promise<CTEMProgramSummary> {
    return this.requestJson(
      "/ctem/program",
      undefined,
      (payload) => CTEMProgramSummarySchema.parse(payload),
      "Unable to read CTEM program"
    );
  }

  async getControlRuleCoverage(): Promise<ControlRuleCoverageSummary> {
    return this.requestJson(
      "/control-sources/rule-coverage",
      undefined,
      (payload) => ControlRuleCoverageSummarySchema.parse(payload),
      "Unable to read control rule coverage"
    );
  }

  async runEngagement(input: {
    approvalId?: string;
    authorizedOffensive?: boolean;
    mode?: "PlanOnly" | "Execute";
    plan?: Array<{ moduleId: string; target?: Record<string, unknown> }>;
    scopeId: string;
  }): Promise<EngagementResult> {
    return this.requestJson(
      "/engagements",
      {
        body: JSON.stringify(input),
        method: "POST"
      },
      (payload) => EngagementResultSchema.parse(payload),
      "Unable to run engagement"
    );
  }

  async compileScenario(
    input: CompileScenarioInput
  ): Promise<CompileScenarioResponse> {
    return this.requestJson(
      "/scenarios/compile",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => CompileScenarioResponseSchema.parse(payload),
      "Unable to compile scenario"
    );
  }

  async compileHybridExecution(
    input: CompileHybridExecutionInput
  ): Promise<CompileHybridExecutionResponse> {
    return this.requestJson(
      "/hybrid-compiler/compile",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => CompileHybridExecutionResponseSchema.parse(payload),
      "Unable to compile hybrid execution plan"
    );
  }

  async assemblePassiveMultiAgentPlan(
    input: AssemblePassiveMultiAgentPlanInput
  ): Promise<AssemblePassiveMultiAgentPlanResponse> {
    return this.requestJson(
      "/hybrid-compiler/assemble-passive-multi-agent",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => AssemblePassiveMultiAgentPlanResponseSchema.parse(payload),
      "Unable to assemble passive multi-agent plan"
    );
  }

  async createConversationalMissionDraft(
    input: CreateConversationalMissionDraftInput
  ): Promise<ConversationalMissionDraft> {
    return this.requestJson(
      "/mission-drafts/conversational",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => ConversationalMissionDraftSchema.parse(payload),
      "Unable to create conversational mission draft"
    );
  }

  async convertConversationalMissionDraftToHybridCompileInput(
    input: ConvertMissionDraftToHybridCompileInputRequest
  ): Promise<HybridCompileInputFromDraft> {
    return this.requestJson(
      "/mission-drafts/conversational/to-hybrid-compile-input",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => HybridCompileInputFromDraftSchema.parse(payload),
      "Unable to convert mission draft to hybrid compile input"
    );
  }

  async approveScenarioBundle(
    scenarioBundleId: string
  ): Promise<ScenarioBundle> {
    return this.requestJson(
      `/scenarios/${scenarioBundleId}/approve`,
      { method: "POST" },
      (payload) => ScenarioBundleSchema.parse(payload),
      "Unable to approve scenario"
    );
  }

  async executeScenarioBundle(
    scenarioBundleId: string,
    input: ExecuteScenarioInput
  ): Promise<ScenarioExecutionResult> {
    return this.requestJson(
      `/scenarios/${scenarioBundleId}/execute`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => ScenarioExecutionResultSchema.parse(payload),
      "Unable to execute scenario"
    );
  }

  async stopScenarioFeedback(
    scenarioBundleId: string,
    input: StopScenarioFeedbackInput
  ): Promise<ScenarioBundle> {
    return this.requestJson(
      `/scenarios/${scenarioBundleId}/feedback/stop`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => ScenarioBundleSchema.parse(payload),
      "Unable to stop scenario feedback"
    );
  }

  async listScenarioBundles(): Promise<ScenarioBundle[]> {
    return this.requestJson(
      "/scenarios",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          ScenarioBundleSchema.parse(item)
        ),
      "Unable to list scenarios"
    );
  }

  async getEngagement(engagementId: string): Promise<EngagementResult> {
    return this.requestJson(
      `/engagements/${engagementId}`,
      undefined,
      (payload) => EngagementResultSchema.parse(payload),
      "Unable to load engagement"
    );
  }

  async listEngagements(): Promise<EngagementResult[]> {
    return this.requestJson(
      "/engagements",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          EngagementResultSchema.parse(item)
        ),
      "Unable to list engagements"
    );
  }

  async getEngagementCollaboration(
    engagementId: string
  ): Promise<EngagementCollaborationSnapshot | null> {
    return this.requestJson(
      `/engagements/${engagementId}/collaboration`,
      undefined,
      (payload) =>
        EngagementCollaborationReadResponseSchema.parse(payload).collaboration,
      "Unable to read the engagement collaboration workspace"
    );
  }

  async initializeEngagementCollaboration(
    engagementId: string,
    input: InitializeEngagementWorkspaceInput
  ): Promise<EngagementCollaborationSnapshot> {
    return this.requestJson(
      `/engagements/${engagementId}/collaboration`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => EngagementCollaborationSnapshotSchema.parse(payload),
      "Unable to initialize the engagement collaboration workspace"
    );
  }

  async upsertEngagementCollaborator(
    engagementId: string,
    input: UpsertEngagementCollaboratorInput
  ): Promise<EngagementCollaborationSnapshot> {
    return this.requestJson(
      `/engagements/${engagementId}/collaboration/collaborators`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => EngagementCollaborationSnapshotSchema.parse(payload),
      "Unable to update the engagement collaborator"
    );
  }

  async appendEngagementCollaborationEvent(
    engagementId: string,
    input: CreateEngagementCollaborationEventInput
  ): Promise<EngagementCollaborationSnapshot> {
    return this.requestJson(
      `/engagements/${engagementId}/collaboration/events`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => EngagementCollaborationSnapshotSchema.parse(payload),
      "Unable to append engagement collaboration activity"
    );
  }

  async getBillingMeters(): Promise<UsageMeterDefinition[]> {
    return this.requestJson(
      "/billing/meters",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          UsageMeterDefinitionSchema.parse(item)
        ),
      "Unable to read billing meters"
    );
  }

  async getBillingPackages(): Promise<BillingPackage[]> {
    return this.requestJson(
      "/billing/packages",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          BillingPackageSchema.parse(item)
        ),
      "Unable to read billing packages"
    );
  }

  async getBillingUsage(): Promise<BillingUsage> {
    return this.requestJson(
      "/billing/usage",
      undefined,
      (payload) => BillingUsageSchema.parse(payload),
      "Unable to read billing usage"
    );
  }

  async getActiveBillingPackage(): Promise<BillingPackage | null> {
    return this.requestJson(
      "/billing/active-package",
      undefined,
      (payload) =>
        payload === null ? null : BillingPackageSchema.parse(payload),
      "Unable to read active billing package"
    );
  }

  async getSubscriptionOperationsWorkspace(): Promise<SubscriptionOperationsWorkspace> {
    return this.requestJson(
      "/billing/subscription",
      undefined,
      (payload) => SubscriptionOperationsWorkspaceSchema.parse(payload),
      "Unable to read subscription operations"
    );
  }

  async createSubscriptionLifecycle(
    input: CreateSubscriptionLifecycleInput
  ): Promise<SubscriptionOperationsWorkspace> {
    return this.requestJson(
      "/billing/subscription",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => SubscriptionOperationsWorkspaceSchema.parse(payload),
      "Unable to create the subscription lifecycle"
    );
  }

  async recordSubscriptionRenewal(
    input: RecordSubscriptionRenewalInput
  ): Promise<SubscriptionOperationsWorkspace> {
    return this.requestJson(
      "/billing/subscription/renewal",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => SubscriptionOperationsWorkspaceSchema.parse(payload),
      "Unable to record the renewal decision"
    );
  }

  async startSubscriptionGrace(
    input: StartSubscriptionGraceInput
  ): Promise<SubscriptionOperationsWorkspace> {
    return this.requestJson(
      "/billing/subscription/grace",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => SubscriptionOperationsWorkspaceSchema.parse(payload),
      "Unable to start the grace exception"
    );
  }

  async resolveSubscriptionGrace(
    input: ResolveSubscriptionGraceInput
  ): Promise<SubscriptionOperationsWorkspace> {
    return this.requestJson(
      "/billing/subscription/grace/resolve",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => SubscriptionOperationsWorkspaceSchema.parse(payload),
      "Unable to resolve the grace exception"
    );
  }

  async scheduleSubscriptionCancellation(
    input: ScheduleSubscriptionCancellationInput
  ): Promise<SubscriptionOperationsWorkspace> {
    return this.requestJson(
      "/billing/subscription/cancellation",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => SubscriptionOperationsWorkspaceSchema.parse(payload),
      "Unable to schedule cancellation"
    );
  }

  async revokeSubscriptionCancellation(
    input: SubscriptionReasonInput
  ): Promise<SubscriptionOperationsWorkspace> {
    return this.requestJson(
      "/billing/subscription/cancellation/revoke",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => SubscriptionOperationsWorkspaceSchema.parse(payload),
      "Unable to revoke cancellation"
    );
  }

  async reconcileSubscriptionLifecycle(
    input: SubscriptionReasonInput
  ): Promise<SubscriptionOperationsWorkspace> {
    return this.requestJson(
      "/billing/subscription/reconcile",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => SubscriptionOperationsWorkspaceSchema.parse(payload),
      "Unable to reconcile the subscription"
    );
  }

  async getTenantTrial(): Promise<TenantTrial> {
    return this.requestJson(
      "/billing/trial",
      undefined,
      (payload) => TenantTrialSchema.parse(payload),
      "Unable to read trial status"
    );
  }

  async startTenantTrial(input: StartTenantTrialInput): Promise<TenantTrial> {
    return this.requestJson(
      "/billing/trial/start",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => TenantTrialSchema.parse(payload),
      "Unable to start the trial"
    );
  }

  async convertTenantTrial(
    input: ConvertTenantTrialInput
  ): Promise<TenantTrial> {
    return this.requestJson(
      "/billing/trial/convert",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => TenantTrialSchema.parse(payload),
      "Unable to convert the trial"
    );
  }

  async cancelTenantTrial(input: CancelTenantTrialInput): Promise<TenantTrial> {
    return this.requestJson(
      "/billing/trial/cancel",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => TenantTrialSchema.parse(payload),
      "Unable to cancel the trial"
    );
  }

  async getAwsMarketplaceStatus(): Promise<AwsMarketplaceStatus> {
    return this.requestJson(
      "/billing/aws-marketplace",
      undefined,
      (payload) => AwsMarketplaceStatusSchema.parse(payload),
      "Unable to read AWS Marketplace status"
    );
  }

  async claimAwsMarketplaceRegistration(
    input: ClaimAwsMarketplaceRegistrationInput
  ): Promise<AwsMarketplaceStatus> {
    return this.requestJson(
      "/billing/aws-marketplace/claim",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => AwsMarketplaceStatusSchema.parse(payload),
      "Unable to attach the AWS Marketplace purchase"
    );
  }

  async refreshAwsMarketplaceEntitlements(): Promise<AwsMarketplaceStatus> {
    return this.requestJson(
      "/billing/aws-marketplace/entitlements/refresh",
      { method: "POST" },
      (payload) => AwsMarketplaceStatusSchema.parse(payload),
      "Unable to refresh AWS Marketplace entitlements"
    );
  }

  async syncAwsMarketplaceMetering(): Promise<AwsMarketplaceMeteringSyncResult> {
    return this.requestJson(
      "/billing/aws-marketplace/metering/sync",
      { method: "POST" },
      (payload) => AwsMarketplaceMeteringSyncResultSchema.parse(payload),
      "Unable to sync AWS Marketplace metering"
    );
  }

  async getExecutiveTrends(): Promise<ExecutiveTrendSummary> {
    return this.requestJson(
      "/tenants/current/executive-trends",
      undefined,
      (payload) => ExecutiveTrendSummarySchema.parse(payload),
      "Unable to read executive trends"
    );
  }

  async getOperationalMetrics(): Promise<TenantOperationalMetrics> {
    return this.requestJson(
      "/tenants/current/operational-metrics",
      undefined,
      (payload) => TenantOperationalMetricsSchema.parse(payload),
      "Unable to read operational metrics"
    );
  }

  async listModules(): Promise<ModuleManifest[]> {
    return this.requestJson(
      "/modules",
      undefined,
      (payload) => (payload as { items: ModuleManifest[] }).items,
      "Unable to read module registry"
    );
  }

  async listOpenSourceTools(
    input: OpenSourceCatalogQuery = {}
  ): Promise<OpenSourceToolCatalogEntry[]> {
    return this.requestJson(
      `/open-source-tools${buildQueryString({
        includeDeferred:
          input.includeDeferred == null
            ? undefined
            : String(input.includeDeferred),
        includeLegalReview:
          input.includeLegalReview == null
            ? undefined
            : String(input.includeLegalReview),
        phase: input.phase
      })}`,
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          OpenSourceToolCatalogEntrySchema.parse(item)
        ),
      "Unable to read open source tool catalog"
    );
  }

  async listOpenSourceCapabilities(
    input: OpenSourceCatalogQuery = {}
  ): Promise<OpenSourceCapability[]> {
    return this.requestJson(
      `/open-source-capabilities${buildQueryString({
        includeDeferred:
          input.includeDeferred == null
            ? undefined
            : String(input.includeDeferred),
        includeLegalReview:
          input.includeLegalReview == null
            ? undefined
            : String(input.includeLegalReview),
        phase: input.phase
      })}`,
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          OpenSourceCapabilitySchema.parse(item)
        ),
      "Unable to read open source capabilities"
    );
  }

  async listThirdPartyTools(): Promise<ThirdPartyTool[]> {
    return this.requestJson(
      "/third-party-tools",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          ThirdPartyToolSchema.parse(item)
        ),
      "Unable to read third-party tool governance"
    );
  }

  async getThirdPartyToolCoverageAudit(): Promise<ThirdPartyToolCoverageAudit> {
    return this.requestJson(
      "/third-party-tools/coverage-audit",
      undefined,
      (payload) => ThirdPartyToolCoverageAuditSchema.parse(payload),
      "Unable to read third-party tool coverage audit"
    );
  }

  async getThirdPartyTool(toolId: OpenSourceToolId): Promise<ThirdPartyTool> {
    return this.requestJson(
      `/third-party-tools/${toolId}`,
      undefined,
      (payload) => ThirdPartyToolSchema.parse(payload),
      "Unable to read third-party tool"
    );
  }

  async checkThirdPartyTool(toolId: OpenSourceToolId): Promise<ThirdPartyTool> {
    return this.requestJson(
      `/third-party-tools/${toolId}/check`,
      { method: "POST" },
      (payload) => ThirdPartyToolSchema.parse(payload),
      "Unable to check third-party tool readiness"
    );
  }

  async installThirdPartyTool(
    toolId: OpenSourceToolId,
    input: ThirdPartyToolInstallRequest = {}
  ): Promise<ToolInstallJob> {
    return this.requestJson(
      `/third-party-tools/${toolId}/install`,
      {
        body: JSON.stringify(input),
        method: "POST"
      },
      (payload) => ToolInstallJobSchema.parse(payload),
      "Unable to request third-party tool install"
    );
  }

  async getThirdPartyToolInstallPlan(
    toolId: OpenSourceToolId
  ): Promise<ThirdPartyToolInstallPlan> {
    return this.requestJson(
      `/third-party-tools/${toolId}/install-plan`,
      undefined,
      (payload) => ThirdPartyToolInstallPlanSchema.parse(payload),
      "Unable to preview third-party tool install plan"
    );
  }

  async acceptToolLicense(
    input: AcceptToolLicenseRequestInput
  ): Promise<ToolLicenseAcceptance> {
    return this.requestJson(
      "/third-party-tools/license-acceptances",
      {
        body: JSON.stringify(input),
        method: "POST"
      },
      (payload) => ToolLicenseAcceptanceSchema.parse(payload),
      "Unable to record tool license acceptance"
    );
  }

  async listToolLicenseAcceptances(
    query: ListToolLicenseAcceptancesQuery = {}
  ): Promise<ToolLicenseAcceptance[]> {
    const params = new URLSearchParams();
    if (query.toolId) {
      params.set("toolId", query.toolId);
    }
    const qs = params.toString();
    return this.requestJson(
      `/third-party-tools/license-acceptances${qs ? `?${qs}` : ""}`,
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          ToolLicenseAcceptanceSchema.parse(item)
        ),
      "Unable to list tool license acceptances"
    );
  }

  async enableThirdPartyTool(
    toolId: OpenSourceToolId,
    reason = "Enabled from Engine Lab"
  ): Promise<ThirdPartyTool> {
    return this.requestJson(
      `/third-party-tools/${toolId}/enable`,
      {
        body: JSON.stringify({ reason }),
        method: "POST"
      },
      (payload) => ThirdPartyToolSchema.parse(payload),
      "Unable to enable third-party tool"
    );
  }

  async uninstallThirdPartyTool(
    toolId: OpenSourceToolId
  ): Promise<ToolInstallJob> {
    return this.requestJson(
      `/third-party-tools/${toolId}/uninstall`,
      { method: "POST" },
      (payload) => ToolInstallJobSchema.parse(payload),
      "Unable to uninstall third-party tool"
    );
  }

  async disableThirdPartyTool(
    toolId: OpenSourceToolId,
    reason = "Disabled from Registry Center"
  ): Promise<ThirdPartyTool> {
    return this.requestJson(
      `/third-party-tools/${toolId}/disable`,
      {
        body: JSON.stringify({ reason }),
        method: "POST"
      },
      (payload) => ThirdPartyToolSchema.parse(payload),
      "Unable to disable third-party tool"
    );
  }

  async listThirdPartyToolJobs(
    toolId: OpenSourceToolId
  ): Promise<ToolInstallJob[]> {
    return this.requestJson(
      `/third-party-tools/${toolId}/jobs`,
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          ToolInstallJobSchema.parse(item)
        ),
      "Unable to read third-party tool jobs"
    );
  }

  async listThirdPartyToolActivity(
    toolId: OpenSourceToolId,
    limit = 25
  ): Promise<ThirdPartyToolActivityEvent[]> {
    return this.requestJson(
      `/third-party-tools/${toolId}/activity?limit=${encodeURIComponent(String(limit))}`,
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          ThirdPartyToolActivityEventSchema.parse(item)
        ),
      "Unable to read third-party tool activity"
    );
  }

  async getThirdPartyToolRunnerEligibility(
    toolId: OpenSourceToolId
  ): Promise<ThirdPartyToolRunnerEligibility> {
    return this.requestJson(
      `/third-party-tools/${toolId}/runner-eligibility`,
      undefined,
      (payload) => ThirdPartyToolRunnerEligibilitySchema.parse(payload),
      "Unable to read third-party tool runner eligibility"
    );
  }

  async dispatchThirdPartyToolRunnerTask(
    toolId: OpenSourceToolId,
    input: ThirdPartyToolRunnerDispatchRequestInput
  ): Promise<ThirdPartyToolRunnerDispatchResponse> {
    return this.requestJson(
      `/third-party-tools/${toolId}/runner-dispatch`,
      {
        body: JSON.stringify(
          ThirdPartyToolRunnerDispatchRequestSchema.parse(input)
        ),
        method: "POST"
      },
      (payload) => ThirdPartyToolRunnerDispatchResponseSchema.parse(payload),
      "Unable to dispatch third-party tool runner task"
    );
  }

  async getThirdPartyToolLicenseSummary(): Promise<ThirdPartyToolLicenseSummary> {
    return this.requestJson(
      "/third-party-tools/licenses",
      undefined,
      (payload) => ThirdPartyToolLicenseSummarySchema.parse(payload),
      "Unable to read third-party tool license summary"
    );
  }

  async validateThirdPartyToolIntake(
    input: ToolIntakeManifestRequest
  ): Promise<ToolIntakeValidationReport> {
    return this.requestJson(
      "/third-party-tools/intake/validate",
      {
        body: JSON.stringify(input),
        method: "POST"
      },
      (payload) => ToolIntakeValidationReportSchema.parse(payload),
      "Unable to validate third-party tool intake"
    );
  }

  async submitThirdPartyToolCandidate(
    input: ToolIntakeManifestRequest
  ): Promise<ThirdPartyToolCandidate> {
    return this.requestJson(
      "/third-party-tools/intake/candidates",
      {
        body: JSON.stringify(input),
        method: "POST"
      },
      (payload) => ThirdPartyToolCandidateSchema.parse(payload),
      "Unable to submit third-party tool candidate"
    );
  }

  async importThirdPartyToolCandidates(
    input: ThirdPartyToolCandidateImportRequest
  ): Promise<ThirdPartyToolCandidateImportResponse> {
    return this.requestJson(
      "/third-party-tools/intake/candidates/import",
      {
        body: JSON.stringify(
          ThirdPartyToolCandidateImportRequestSchema.parse(input)
        ),
        method: "POST"
      },
      (payload) => ThirdPartyToolCandidateImportResponseSchema.parse(payload),
      "Unable to import third-party tool candidates"
    );
  }

  async listThirdPartyToolCandidates(): Promise<ThirdPartyToolCandidate[]> {
    return this.requestJson(
      "/third-party-tools/intake/candidates",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          ThirdPartyToolCandidateSchema.parse(item)
        ),
      "Unable to read third-party tool candidates"
    );
  }

  async getThirdPartyToolCandidateReadiness(
    candidateId: string
  ): Promise<ThirdPartyToolCandidateReadiness> {
    return this.requestJson(
      `/third-party-tools/intake/candidates/${candidateId}/readiness`,
      undefined,
      (payload) => ThirdPartyToolCandidateReadinessSchema.parse(payload),
      "Unable to read third-party tool candidate readiness"
    );
  }

  async getThirdPartyToolCandidateReadinessSummary(): Promise<ThirdPartyToolCandidateReadinessSummary> {
    return this.requestJson(
      "/third-party-tools/intake/candidates/readiness-summary",
      undefined,
      (payload) => ThirdPartyToolCandidateReadinessSummarySchema.parse(payload),
      "Unable to read third-party tool candidate readiness summary"
    );
  }

  async reviewThirdPartyToolCandidate(
    candidateId: string,
    input: ReviewThirdPartyToolCandidateRequest
  ): Promise<ThirdPartyToolCandidate> {
    return this.requestJson(
      `/third-party-tools/intake/candidates/${candidateId}/review`,
      {
        body: JSON.stringify(
          ReviewThirdPartyToolCandidateRequestSchema.parse(input)
        ),
        method: "POST"
      },
      (payload) => ThirdPartyToolCandidateSchema.parse(payload),
      "Unable to review third-party tool candidate"
    );
  }

  async listThirdPartyToolImplementationWorkOrders(
    candidateId: string
  ): Promise<ThirdPartyToolImplementationWorkOrder[]> {
    return this.requestJson(
      `/third-party-tools/intake/candidates/${candidateId}/work-orders`,
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          ThirdPartyToolImplementationWorkOrderSchema.parse(item)
        ),
      "Unable to read third-party tool implementation work orders"
    );
  }

  async generateThirdPartyToolImplementationWorkOrder(
    candidateId: string
  ): Promise<ThirdPartyToolImplementationWorkOrder> {
    return this.requestJson(
      `/third-party-tools/intake/candidates/${candidateId}/work-orders`,
      {
        method: "POST"
      },
      (payload) => ThirdPartyToolImplementationWorkOrderSchema.parse(payload),
      "Unable to generate third-party tool implementation work order"
    );
  }

  async getThirdPartyToolImplementationBundle(
    candidateId: string,
    workOrderId: string
  ): Promise<ThirdPartyToolImplementationBundle> {
    return this.requestJson(
      `/third-party-tools/intake/candidates/${candidateId}/work-orders/${workOrderId}/implementation-bundle`,
      undefined,
      (payload) => ThirdPartyToolImplementationBundleSchema.parse(payload),
      "Unable to read third-party tool implementation bundle"
    );
  }

  async listThirdPartyToolPromotionPackages(
    candidateId: string
  ): Promise<ThirdPartyToolPromotionPackage[]> {
    return this.requestJson(
      `/third-party-tools/intake/candidates/${candidateId}/promotion-packages`,
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          ThirdPartyToolPromotionPackageSchema.parse(item)
        ),
      "Unable to read third-party tool promotion packages"
    );
  }

  async generateThirdPartyToolPromotionPackage(
    candidateId: string
  ): Promise<ThirdPartyToolPromotionPackage> {
    return this.requestJson(
      `/third-party-tools/intake/candidates/${candidateId}/promotion-packages`,
      {
        method: "POST"
      },
      (payload) => ThirdPartyToolPromotionPackageSchema.parse(payload),
      "Unable to generate third-party tool promotion package"
    );
  }

  async getThirdPartyToolPromotionHandoff(
    candidateId: string,
    promotionPackageId: string
  ): Promise<ThirdPartyToolPromotionHandoff> {
    return this.requestJson(
      `/third-party-tools/intake/candidates/${candidateId}/promotion-packages/${promotionPackageId}/governance-handoff`,
      undefined,
      (payload) => ThirdPartyToolPromotionHandoffSchema.parse(payload),
      "Unable to read third-party tool promotion handoff"
    );
  }

  async getThirdPartyToolPromotionCertification(
    candidateId: string,
    promotionPackageId: string
  ): Promise<ThirdPartyToolPromotionCertification> {
    return this.requestJson(
      `/third-party-tools/intake/candidates/${candidateId}/promotion-packages/${promotionPackageId}/certification-report`,
      undefined,
      (payload) => ThirdPartyToolPromotionCertificationSchema.parse(payload),
      "Unable to read third-party tool promotion certification"
    );
  }

  async listThirdPartyToolPromotionCertifications(
    candidateId: string,
    promotionPackageId: string
  ): Promise<ThirdPartyToolPromotionCertification[]> {
    return this.requestJson(
      `/third-party-tools/intake/candidates/${candidateId}/promotion-packages/${promotionPackageId}/certifications`,
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          ThirdPartyToolPromotionCertificationSchema.parse(item)
        ),
      "Unable to list third-party tool promotion certifications"
    );
  }

  async generateThirdPartyToolPromotionCertification(
    candidateId: string,
    promotionPackageId: string
  ): Promise<ThirdPartyToolPromotionCertification> {
    return this.requestJson(
      `/third-party-tools/intake/candidates/${candidateId}/promotion-packages/${promotionPackageId}/certifications`,
      {
        method: "POST"
      },
      (payload) => ThirdPartyToolPromotionCertificationSchema.parse(payload),
      "Unable to generate third-party tool promotion certification"
    );
  }

  async listThirdPartyToolUpdateRecommendations(
    toolId: OpenSourceToolId
  ): Promise<ThirdPartyToolUpdateRecommendation[]> {
    return this.requestJson(
      `/third-party-tools/${toolId}/update-recommendations`,
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          ThirdPartyToolUpdateRecommendationSchema.parse(item)
        ),
      "Unable to read third-party tool update recommendations"
    );
  }

  async listThirdPartyToolUpstreamVersionChecks(
    toolId: OpenSourceToolId
  ): Promise<ThirdPartyToolUpstreamVersionCheck[]> {
    return this.requestJson(
      `/third-party-tools/${toolId}/upstream-version-checks`,
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          ThirdPartyToolUpstreamVersionCheckSchema.parse(item)
        ),
      "Unable to read third-party tool upstream checks"
    );
  }

  async checkThirdPartyToolUpstreamVersion(
    toolId: OpenSourceToolId
  ): Promise<ThirdPartyToolUpstreamVersionCheck> {
    return this.requestJson(
      `/third-party-tools/${toolId}/upstream-version-checks/check`,
      {
        method: "POST"
      },
      (payload) => ThirdPartyToolUpstreamVersionCheckSchema.parse(payload),
      "Unable to check third-party tool upstream version"
    );
  }

  async checkThirdPartyToolUpdateRecommendation(
    toolId: OpenSourceToolId
  ): Promise<ThirdPartyToolUpdateRecommendation> {
    return this.requestJson(
      `/third-party-tools/${toolId}/update-recommendations/check`,
      {
        method: "POST"
      },
      (payload) => ThirdPartyToolUpdateRecommendationSchema.parse(payload),
      "Unable to check third-party tool update recommendation"
    );
  }

  async refreshDueThirdPartyTools(
    input: Partial<ThirdPartyToolRefreshDueRequest> = {}
  ): Promise<ThirdPartyToolRefreshDueResponse> {
    return this.requestJson(
      "/third-party-tools/refresh-due",
      {
        body: JSON.stringify(input),
        method: "POST"
      },
      (payload) => ThirdPartyToolRefreshDueResponseSchema.parse(payload),
      "Unable to refresh due third-party tools"
    );
  }

  async applyThirdPartyToolUpdateRecommendation(
    toolId: OpenSourceToolId,
    recommendationId: string,
    input: {
      queueInstall?: boolean;
      reason?: string;
      runtimeKind?: string;
    } = {}
  ): Promise<ThirdPartyToolUpdateRecommendation> {
    return this.requestJson(
      `/third-party-tools/${toolId}/update-recommendations/${recommendationId}/apply`,
      {
        body: JSON.stringify(input),
        method: "POST"
      },
      (payload) => ThirdPartyToolUpdateRecommendationSchema.parse(payload),
      "Unable to apply third-party tool update recommendation"
    );
  }

  async listOperatorProfiles(): Promise<OperatorProfile[]> {
    return this.requestJson(
      "/operators",
      undefined,
      (payload) => (payload as { items: OperatorProfile[] }).items,
      "Unable to read operator profiles"
    );
  }

  async listOperatorRecommendations(): Promise<OperatorRecommendation[]> {
    return this.requestJson(
      "/operator-recommendations",
      undefined,
      (payload) => (payload as { items: OperatorRecommendation[] }).items,
      "Unable to read operator recommendations"
    );
  }

  async approveOperatorRecommendation(
    recommendationId: string
  ): Promise<{ recommendation: OperatorRecommendation; mission?: any }> {
    return this.requestJson(
      `/operator-recommendations/${recommendationId}/approve`,
      { method: "POST" },
      (payload) =>
        payload as { recommendation: OperatorRecommendation; mission?: any },
      "Unable to approve operator recommendation"
    );
  }

  async createRemediationTicket(
    remediationId: string,
    input: CreateRemediationTicketInput = {}
  ): Promise<RemediationTicketResult> {
    return this.requestJson(
      `/remediations/${remediationId}/create-ticket`,
      {
        body: JSON.stringify(input),
        method: "POST"
      },
      (payload) =>
        RemediationTicketSchema.parse(payload) as RemediationTicketResult,
      "Unable to create remediation ticket"
    );
  }

  async syncRemediationTicket(
    remediationId: string,
    input: SyncRemediationTicketInput = {}
  ): Promise<RemediationTicketStateResult> {
    return this.requestJson(
      `/remediations/${remediationId}/sync-ticket`,
      {
        body: JSON.stringify(input),
        method: "POST"
      },
      (payload) =>
        RemediationTicketStateSchema.parse(
          payload
        ) as RemediationTicketStateResult,
      "Unable to synchronize remediation ticket state"
    );
  }

  async listSnapshots(): Promise<ValidationSnapshot[]> {
    return this.requestJson(
      "/snapshots",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          ValidationSnapshotSchema.parse(item)
        ),
      "Unable to read snapshots"
    );
  }

  async createSnapshot(input?: {
    audience?: string;
    maxTopItems?: number;
    policyDecisionId?: string;
    scopeId?: string;
  }): Promise<ValidationSnapshot> {
    return this.requestJson(
      "/snapshots",
      {
        body: JSON.stringify(input ?? {}),
        method: "POST"
      },
      (payload) => ValidationSnapshotSchema.parse(payload),
      "Unable to create validation snapshot"
    );
  }

  async getSnapshot(snapshotId: string): Promise<ValidationSnapshot> {
    return this.requestJson(
      `/snapshots/${snapshotId}`,
      undefined,
      (payload) => ValidationSnapshotSchema.parse(payload),
      "Unable to read validation snapshot"
    );
  }

  async getSnapshotReportHtml(snapshotId: string): Promise<string> {
    const response = await this.request(`/snapshots/${snapshotId}/report`);

    if (!response.ok) {
      const payload = await response.json().catch(() => null);

      throw new PeriscanApiClientError(
        response.status,
        toErrorMessage(
          response.status,
          payload,
          "Unable to read snapshot report"
        )
      );
    }

    return response.text();
  }

  // --- Schedules (full support for ValidationSnapshot, ContinuousValidation, AIAppValidation, ControlValidation, FixVerification) ---
  async listSchedules(): Promise<{ items: MissionSchedule[] }> {
    return this.requestJson(
      "/schedules",
      undefined,
      (payload) => ({
        items: ((payload as any)?.items ?? []).map(
          (item: unknown) => item as MissionSchedule
        )
      }),
      "Unable to list schedules"
    );
  }

  async createSchedule(
    input: CreateMissionScheduleInput
  ): Promise<MissionSchedule> {
    return this.requestJson(
      "/schedules",
      {
        body: JSON.stringify(input),
        method: "POST"
      },
      (payload) => payload as MissionSchedule,
      "Unable to create schedule"
    );
  }

  async updateSchedule(
    scheduleId: string,
    input: UpdateMissionScheduleInput
  ): Promise<MissionSchedule> {
    return this.requestJson(
      `/schedules/${scheduleId}`,
      { body: JSON.stringify(input), method: "PATCH" },
      (payload) => payload as MissionSchedule,
      "Unable to update schedule"
    );
  }

  async deleteSchedule(scheduleId: string): Promise<void> {
    const response = await this.request(`/schedules/${scheduleId}`, {
      method: "DELETE"
    });
    if (!response.ok && response.status !== 204) {
      throw new PeriscanApiClientError(
        response.status,
        "Unable to delete schedule"
      );
    }
  }

  async getSchedule(scheduleId: string): Promise<MissionSchedule | null> {
    const response = await this.request(`/schedules/${scheduleId}`);
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new PeriscanApiClientError(
        response.status,
        "Unable to read schedule"
      );
    }
    const payload = await response.json();
    return payload as MissionSchedule;
  }

  async runSchedule(scheduleId: string): Promise<ScheduledRunResult> {
    return this.requestJson(
      `/schedules/${scheduleId}/run`,
      { method: "POST" },
      (payload) => payload as ScheduledRunResult,
      "Unable to run schedule"
    );
  }

  async pauseSchedule(scheduleId: string): Promise<MissionSchedule> {
    return this.requestJson(
      `/schedules/${scheduleId}/pause`,
      { method: "POST" },
      (payload) => payload as MissionSchedule,
      "Unable to pause schedule"
    );
  }

  async resumeSchedule(scheduleId: string): Promise<MissionSchedule> {
    return this.requestJson(
      `/schedules/${scheduleId}/resume`,
      { method: "POST" },
      (payload) => payload as MissionSchedule,
      "Unable to resume schedule"
    );
  }

  async getDesignPartnerWorkspace(): Promise<DesignPartnerWorkspace> {
    return this.requestJson(
      "/tenants/current/design-partner",
      undefined,
      (payload) => DesignPartnerWorkspaceSchema.parse(payload),
      "Unable to read design partner workspace"
    );
  }

  async appendDesignPartnerSessionNote(
    input: AppendDesignPartnerSessionNoteInput
  ): Promise<DesignPartnerSessionNote> {
    return this.requestJson(
      "/tenants/current/design-partner/session-notes",
      {
        body: JSON.stringify(AppendDesignPartnerSessionNoteInputSchema.parse(input)),
        method: "POST"
      },
      (payload) => DesignPartnerSessionNoteSchema.parse(payload),
      "Unable to append design partner session note"
    );
  }

  async getTrustSafetySummary(): Promise<TrustSafetySummary> {
    return this.requestJson(
      "/tenants/current/trust-safety",
      undefined,
      (payload) => TrustSafetySummarySchema.parse(payload),
      "Unable to read trust and safety summary"
    );
  }

  async getClientPortfolio(): Promise<ClientPortfolioPayload> {
    return this.requestJson(
      "/tenants/current/client-portfolio",
      undefined,
      (payload) => MSSPClientPortfolioSchema.parse(payload),
      "Unable to read MSSP client portfolio"
    );
  }

  async listClientTenants(): Promise<Tenant[]> {
    return this.requestJson(
      "/tenants/current/clients",
      undefined,
      (payload) => {
        const items = (payload as { items?: Tenant[] }).items;
        return Array.isArray(items) ? items : [];
      },
      "Unable to list client tenants"
    );
  }

  async createClientTenant(
    input: CreateClientTenantInput
  ): Promise<CreateClientTenantResult> {
    return this.requestJson(
      "/tenants/current/clients",
      {
        body: JSON.stringify({
          billingAccountId: input.billingAccountId ?? null,
          clientAdminEmail: input.clientAdminEmail ?? null,
          clientAdminName: input.clientAdminName ?? null,
          dataRegion: input.dataRegion ?? null,
          name: input.name
        }),
        method: "POST"
      },
      (payload) => payload as CreateClientTenantResult,
      "Unable to create client tenant"
    );
  }

  async getTenantBranding(): Promise<TenantReportBranding> {
    return this.requestJson(
      "/tenants/current/branding",
      undefined,
      (payload) => TenantReportBrandingSchema.parse(payload),
      "Unable to read tenant report branding"
    );
  }

  async getTenantLocalization(): Promise<TenantLocalization> {
    return this.requestJson(
      "/tenants/current/localization",
      undefined,
      (payload) => TenantLocalizationSchema.parse(payload),
      "Unable to read tenant localization"
    );
  }

  async getTenantLocalizationWorkspace(): Promise<TenantLocalizationWorkspace> {
    return this.requestJson(
      "/tenants/current/localization/workspace",
      undefined,
      (payload) => TenantLocalizationWorkspaceSchema.parse(payload),
      "Unable to read localization operations"
    );
  }

  async previewTenantLocalization(
    input: PreviewTenantLocalizationInput
  ): Promise<LocalizationFormatPreview> {
    return this.requestJson(
      "/tenants/current/localization/preview",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => LocalizationFormatPreviewSchema.parse(payload),
      "Unable to preview localization"
    );
  }

  async updateTenantLocalization(
    input: UpdateTenantLocalizationInput
  ): Promise<TenantLocalization> {
    return this.requestJson(
      "/tenants/current/localization",
      { body: JSON.stringify(input), method: "PUT" },
      (payload) => TenantLocalizationSchema.parse(payload),
      "Unable to update tenant localization"
    );
  }

  async updateTenantBranding(
    input: UpdateTenantBrandingPayload
  ): Promise<TenantReportBranding> {
    return this.requestJson(
      "/tenants/current/branding",
      {
        body: JSON.stringify(input),
        method: "PUT"
      },
      (payload) => TenantReportBrandingSchema.parse(payload),
      "Unable to update tenant report branding"
    );
  }

  async listAuditEventPage(input?: AuditEventQuery): Promise<AuditEventPage> {
    return this.requestJson(
      `/audit-events${buildQueryString({
        action: input?.action,
        actorType: input?.actorType,
        category: input?.category,
        from: input?.from,
        limit: input?.limit,
        offset: input?.offset,
        search: input?.search,
        to: input?.to,
        userId: input?.userId
      })}`,
      undefined,
      (payload) => {
        const page = payload as {
          items: unknown[];
          page?: { hasMore?: unknown; limit?: unknown; offset?: unknown };
        };
        return {
          items: page.items.map((item) => AuditEventSchema.parse(item)),
          page: {
            hasMore: page.page?.hasMore === true,
            limit:
              typeof page.page?.limit === "number"
                ? page.page.limit
                : (input?.limit ?? 50),
            offset:
              typeof page.page?.offset === "number"
                ? page.page.offset
                : (input?.offset ?? 0)
          }
        };
      },
      "Unable to read audit events"
    );
  }

  async listAuditEvents(input?: AuditEventQuery): Promise<AuditEvent[]> {
    return (await this.listAuditEventPage(input)).items;
  }

  async listThreatAdvisories(): Promise<ThreatAdvisory[]> {
    return this.requestJson(
      "/threat-advisories",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          ThreatAdvisorySchema.parse(item)
        ),
      "Unable to read threat advisories"
    );
  }

  async listThreatCatalog(
    query: ThreatCatalogQuery = {}
  ): Promise<ThreatIntelItem[]> {
    const params = new URLSearchParams();
    if (query.kind) {
      params.set("kind", query.kind);
    }
    if (query.severity) {
      params.set("severity", query.severity);
    }
    if (query.kev !== undefined) {
      params.set("kev", String(query.kev));
    }
    if (query.q) {
      params.set("q", query.q);
    }
    if (query.limit !== undefined) {
      params.set("limit", String(query.limit));
    }
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return this.requestJson(
      `/threat-intel/catalog${suffix}`,
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          ThreatIntelItemSchema.parse(item)
        ),
      "Unable to read the threat catalog"
    );
  }

  async getThreatFeedStatus(): Promise<ThreatFeedStatus[]> {
    return this.requestJson(
      "/threat-intel/feeds",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          ThreatFeedStatusSchema.parse(item)
        ),
      "Unable to read threat feed health"
    );
  }

  async listThreatAlerts(
    status?: TenantThreatAlertStatus
  ): Promise<TenantThreatAlert[]> {
    const suffix = status ? `?status=${status}` : "";
    return this.requestJson(
      `/threat-intel/alerts${suffix}`,
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          TenantThreatAlertSchema.parse(item)
        ),
      "Unable to read threat alerts"
    );
  }

  async setThreatAlertStatus(
    alertId: string,
    status: TenantThreatAlertStatus
  ): Promise<TenantThreatAlert> {
    return this.requestJson(
      `/threat-intel/alerts/${alertId}/status`,
      { body: JSON.stringify({ status }), method: "POST" },
      (payload) => TenantThreatAlertSchema.parse(payload),
      "Unable to update the threat alert"
    );
  }

  async generateEvidenceSummary(input: {
    useCase: EvidenceSummaryUseCase;
    evidenceIds?: string[];
  }): Promise<EvidenceGroundedSummary> {
    return this.requestJson(
      "/evidence-summaries",
      {
        body: JSON.stringify({
          evidenceIds: input.evidenceIds ?? [],
          useCase: input.useCase
        }),
        method: "POST"
      },
      (payload) =>
        EvidenceGroundedSummarySchema.parse(payload) as EvidenceGroundedSummary,
      "Unable to generate the evidence summary"
    );
  }

  async ingestThreatFeed(
    input: Partial<ThreatFeedIngestionInput> = {}
  ): Promise<ThreatFeedIngestionResult> {
    return this.requestJson(
      "/threat-feeds/ingest",
      {
        body: JSON.stringify(input),
        method: "POST"
      },
      (payload) => ThreatFeedIngestionResultSchema.parse(payload),
      "Unable to ingest the threat feed"
    );
  }

  async setThreatFeedSchedule(frequency: ScheduleFrequency | null): Promise<{
    frequency: string | null;
    nextThreatFeedIngestAt: string | null;
  }> {
    return this.requestJson(
      "/threat-feeds/schedule",
      {
        body: JSON.stringify({ frequency }),
        method: "POST"
      },
      (payload) =>
        z
          .object({
            frequency: z.string().nullable(),
            nextThreatFeedIngestAt: z.string().nullable()
          })
          .parse(payload),
      "Unable to set the threat-feed schedule"
    );
  }

  async getThreatFeedSchedule(): Promise<{
    frequency: string | null;
    nextThreatFeedIngestAt: string | null;
  }> {
    return this.requestJson(
      "/threat-feeds/schedule",
      undefined,
      (payload) =>
        z
          .object({
            frequency: z.string().nullable(),
            nextThreatFeedIngestAt: z.string().nullable()
          })
          .parse(payload),
      "Unable to read the threat-feed schedule"
    );
  }

  async importThreatAdvisory(
    input: ImportThreatAdvisoryPayload
  ): Promise<ThreatAdvisoryDetailPayload> {
    return this.requestJson(
      "/threat-advisories",
      {
        body: JSON.stringify(input),
        method: "POST"
      },
      parseThreatAdvisoryDetail,
      "Unable to import threat advisory"
    );
  }

  async getThreatAdvisory(
    advisoryId: string
  ): Promise<ThreatAdvisoryDetailPayload> {
    return this.requestJson(
      `/threat-advisories/${advisoryId}`,
      undefined,
      parseThreatAdvisoryDetail,
      "Unable to read threat advisory"
    );
  }

  async getThreatAdvisoryReadinessReport(
    advisoryId: string
  ): Promise<AdvisoryReadinessReport> {
    return this.requestJson(
      `/threat-advisories/${advisoryId}/readiness-report`,
      undefined,
      (payload) => AdvisoryReadinessReportSchema.parse(payload),
      "Unable to read threat advisory readiness report"
    );
  }

  async exportThreatAdvisoryReadinessReport(
    advisoryId: string,
    input: {
      format?: ReportExportFormat;
    } = {}
  ): Promise<ReportDownloadPayload> {
    const format = input.format ?? "html";

    return this.requestDownload(
      `/threat-advisories/${advisoryId}/readiness-report/export`,
      {
        body: JSON.stringify({
          format
        }),
        method: "POST"
      },
      format,
      "Unable to export threat advisory readiness report"
    );
  }

  async exportReport(
    reportId: string,
    input: {
      format?: ReportExportFormat;
    } = {}
  ): Promise<ReportDownloadPayload> {
    const format = input.format ?? "html";

    return this.requestDownload(
      `/reports/${reportId}/export`,
      {
        body: JSON.stringify({
          format
        }),
        method: "POST"
      },
      format,
      "Unable to export report"
    );
  }

  async createReportShareLink(reportId: string): Promise<ReportShareLink> {
    return this.requestJson(
      `/reports/${reportId}/share-link`,
      {
        method: "POST"
      },
      (payload) => ReportShareLinkSchema.parse(payload),
      "Unable to create report share link"
    );
  }

  async listReportShareLinks(reportId: string): Promise<ReportShareGrant[]> {
    return this.requestJson(
      `/reports/${reportId}/share-links`,
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          ReportShareGrantSchema.parse(item)
        ),
      "Unable to read report share links"
    );
  }

  async revokeReportShareLink(
    reportId: string,
    reportShareId: string
  ): Promise<ReportShareGrant> {
    return this.requestJson(
      `/reports/${reportId}/share-links/${reportShareId}`,
      { method: "DELETE" },
      (payload) => ReportShareGrantSchema.parse(payload),
      "Unable to revoke report share link"
    );
  }

  async updateDesignPartnerSettings(input: {
    enabled: boolean;
  }): Promise<DesignPartnerWorkspace["settings"]> {
    return this.requestJson(
      "/tenants/current/design-partner",
      {
        body: JSON.stringify(input),
        method: "PUT"
      },
      (payload) => DesignPartnerWorkspaceSchema.shape.settings.parse(payload),
      "Unable to update design partner settings"
    );
  }

  async getReportAnalystNote(
    reportId: string
  ): Promise<DesignPartnerReportNote | null> {
    return this.requestJson(
      `/reports/${reportId}/analyst-note`,
      undefined,
      (payload) =>
        payload == null ? null : DesignPartnerReportNoteSchema.parse(payload),
      "Unable to read report analyst note"
    );
  }

  async updateReportAnalystNote(
    reportId: string,
    input: {
      authorLabel?: string;
      body: string;
      title?: string | null;
    }
  ): Promise<DesignPartnerReportNote> {
    return this.requestJson(
      `/reports/${reportId}/analyst-note`,
      {
        body: JSON.stringify(input),
        method: "PUT"
      },
      (payload) => DesignPartnerReportNoteSchema.parse(payload),
      "Unable to update report analyst note"
    );
  }

  async listModelProviders(): Promise<ModelProvider[]> {
    return this.requestJson(
      "/model-gateway/providers",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          ModelProviderSchema.parse(item)
        ),
      "Unable to read model providers"
    );
  }

  async createModelProvider(
    input: CreateModelProviderInput
  ): Promise<ModelProvider> {
    return this.requestJson(
      "/model-gateway/providers",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => ModelProviderSchema.parse(payload),
      "Unable to register model provider"
    );
  }

  async updateModelProvider(
    modelProviderId: string,
    input: UpdateModelProviderInput
  ): Promise<ModelProvider> {
    return this.requestJson(
      `/model-gateway/providers/${modelProviderId}`,
      { body: JSON.stringify(input), method: "PATCH" },
      (payload) => ModelProviderSchema.parse(payload),
      "Unable to update model provider"
    );
  }

  async deleteModelProvider(modelProviderId: string): Promise<void> {
    const response = await this.request(
      `/model-gateway/providers/${modelProviderId}`,
      { method: "DELETE" }
    );

    if (!response.ok && response.status !== 204) {
      const payload = await response.json().catch(() => null);

      throw new PeriscanApiClientError(
        response.status,
        toErrorMessage(
          response.status,
          payload,
          "Unable to delete model provider"
        )
      );
    }
  }

  async testModelProviderConnection(
    modelProviderId: string
  ): Promise<ModelProviderConnectionTestResult> {
    return this.requestJson(
      `/model-gateway/providers/${modelProviderId}/test-connection`,
      { method: "POST" },
      (payload) => ModelProviderConnectionTestResultSchema.parse(payload),
      "Unable to test model provider connection"
    );
  }

  async listModelPolicyProfiles(): Promise<ModelPolicyProfile[]> {
    return this.requestJson(
      "/model-gateway/policies",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          ModelPolicyProfileSchema.parse(item)
        ),
      "Unable to read model policy profiles"
    );
  }

  async createModelPolicyProfile(
    input: CreateModelPolicyProfileInput
  ): Promise<ModelPolicyProfile> {
    return this.requestJson(
      "/model-gateway/policies",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => ModelPolicyProfileSchema.parse(payload),
      "Unable to create model policy profile"
    );
  }

  async updateModelPolicyProfile(
    modelPolicyProfileId: string,
    input: UpdateModelPolicyProfileInput
  ): Promise<ModelPolicyProfile> {
    return this.requestJson(
      `/model-gateway/policies/${modelPolicyProfileId}`,
      { body: JSON.stringify(input), method: "PATCH" },
      (payload) => ModelPolicyProfileSchema.parse(payload),
      "Unable to update model policy profile"
    );
  }

  async deleteModelPolicyProfile(modelPolicyProfileId: string): Promise<void> {
    const response = await this.request(
      `/model-gateway/policies/${modelPolicyProfileId}`,
      { method: "DELETE" }
    );

    if (!response.ok && response.status !== 204) {
      const payload = await response.json().catch(() => null);

      throw new PeriscanApiClientError(
        response.status,
        toErrorMessage(
          response.status,
          payload,
          "Unable to delete model policy profile"
        )
      );
    }
  }

  async listModelTools(): Promise<ModelTool[]> {
    return this.requestJson(
      "/model-gateway/tools",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          ModelToolSchema.parse(item)
        ),
      "Unable to read model tools"
    );
  }

  async updateModelTool(
    toolName: string,
    input: UpdateModelToolInput
  ): Promise<ModelTool> {
    return this.requestJson(
      `/model-gateway/tools/${encodeURIComponent(toolName)}`,
      { body: JSON.stringify(input), method: "PATCH" },
      (payload) => ModelToolSchema.parse(payload),
      "Unable to update model tool"
    );
  }

  async listModelSessions(): Promise<ModelSession[]> {
    return this.requestJson(
      "/model-gateway/sessions",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          ModelSessionSchema.parse(item)
        ),
      "Unable to read model sessions"
    );
  }

  async getModelSession(modelSessionId: string): Promise<ModelSession> {
    return this.requestJson(
      `/model-gateway/sessions/${modelSessionId}`,
      undefined,
      (payload) => ModelSessionSchema.parse(payload),
      "Unable to read model session"
    );
  }

  async createModelSession(
    input: CreateModelSessionInput
  ): Promise<ModelSession> {
    return this.requestJson(
      "/model-gateway/sessions",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => ModelSessionSchema.parse(payload),
      "Unable to create model session"
    );
  }

  async startModelSession(modelSessionId: string): Promise<ModelSession> {
    return this.requestJson(
      `/model-gateway/sessions/${modelSessionId}/start`,
      { method: "POST" },
      (payload) => ModelSessionSchema.parse(payload),
      "Unable to start model session"
    );
  }

  async pauseModelSession(modelSessionId: string): Promise<ModelSession> {
    return this.requestJson(
      `/model-gateway/sessions/${modelSessionId}/pause`,
      { method: "POST" },
      (payload) => ModelSessionSchema.parse(payload),
      "Unable to pause model session"
    );
  }

  async terminateModelSession(modelSessionId: string): Promise<ModelSession> {
    return this.requestJson(
      `/model-gateway/sessions/${modelSessionId}/terminate`,
      { method: "POST" },
      (payload) => ModelSessionSchema.parse(payload),
      "Unable to terminate model session"
    );
  }

  async submitModelSessionTurn(
    modelSessionId: string,
    input: { prompt: string; queueLane?: "Standard" | "Priority" }
  ): Promise<ModelSessionTurnAccepted> {
    return this.requestJson(
      `/model-gateway/sessions/${modelSessionId}/turns`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => ModelSessionTurnAcceptedSchema.parse(payload),
      "Unable to submit model session turn"
    );
  }

  async listModelSessionTurns(
    modelSessionId: string
  ): Promise<ModelUsageEvent[]> {
    return this.requestJson(
      `/model-gateway/sessions/${modelSessionId}/turns`,
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          ModelUsageEventSchema.parse(item)
        ),
      "Unable to read model session turns"
    );
  }

  async listModelSessionContextBundles(
    modelSessionId: string
  ): Promise<ContextBundle[]> {
    return this.requestJson(
      `/model-gateway/sessions/${modelSessionId}/context-bundles`,
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          ContextBundleSchema.parse(item)
        ),
      "Unable to read context bundles"
    );
  }

  async buildModelSessionContextBundle(
    modelSessionId: string,
    input: { scopeIds?: string[] } = {}
  ): Promise<ContextBundle> {
    return this.requestJson(
      `/model-gateway/sessions/${modelSessionId}/context-bundles`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => ContextBundleSchema.parse(payload),
      "Unable to build context bundle"
    );
  }

  async listModelToolRequests(
    modelSessionId: string
  ): Promise<ModelToolRequest[]> {
    return this.requestJson(
      `/model-gateway/sessions/${modelSessionId}/tool-requests`,
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          ModelToolRequestSchema.parse(item)
        ),
      "Unable to read tool requests"
    );
  }

  async createModelToolRequest(
    modelSessionId: string,
    input: CreateModelToolRequestInput
  ): Promise<ModelToolRequest> {
    return this.requestJson(
      `/model-gateway/sessions/${modelSessionId}/tool-requests`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => ModelToolRequestSchema.parse(payload),
      "Unable to create tool request"
    );
  }

  async listModelToolInterventions(): Promise<ModelToolInterventionQueue> {
    return this.requestJson(
      "/model-gateway/interventions",
      undefined,
      (payload) => ModelToolInterventionQueueSchema.parse(payload),
      "Unable to read intervention queue"
    );
  }

  async issueModelToolIntervention(
    toolRequestId: string,
    input: IssueModelToolInterventionInput
  ): Promise<IssueModelToolInterventionResult> {
    return this.requestJson(
      `/model-gateway/tool-requests/${toolRequestId}/intervention-link`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => IssueModelToolInterventionResultSchema.parse(payload),
      "Unable to issue intervention link"
    );
  }

  async inspectModelToolIntervention(
    interventionId: string,
    input: InspectModelToolInterventionInput
  ): Promise<ModelToolIntervention> {
    return this.requestJson(
      `/model-gateway/interventions/${interventionId}/inspect`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => ModelToolInterventionSchema.parse(payload),
      "Unable to verify intervention link"
    );
  }

  async decideModelToolIntervention(
    interventionId: string,
    input: DecideModelToolInterventionInput
  ): Promise<ModelToolInterventionDecisionResult> {
    return this.requestJson(
      `/model-gateway/interventions/${interventionId}/decision`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => ModelToolInterventionDecisionResultSchema.parse(payload),
      "Unable to record intervention decision"
    );
  }

  async approveModelToolRequest(
    toolRequestId: string
  ): Promise<ModelToolRequest> {
    return this.requestJson(
      `/model-gateway/tool-requests/${toolRequestId}/approve`,
      { method: "POST" },
      (payload) => ModelToolRequestSchema.parse(payload),
      "Unable to approve tool request"
    );
  }

  async denyModelToolRequest(toolRequestId: string): Promise<ModelToolRequest> {
    return this.requestJson(
      `/model-gateway/tool-requests/${toolRequestId}/deny`,
      { method: "POST" },
      (payload) => ModelToolRequestSchema.parse(payload),
      "Unable to deny tool request"
    );
  }

  async cancelModelToolRequest(
    toolRequestId: string
  ): Promise<ModelToolRequest> {
    return this.requestJson(
      `/model-gateway/tool-requests/${toolRequestId}/cancel`,
      { method: "POST" },
      (payload) => ModelToolRequestSchema.parse(payload),
      "Unable to cancel tool request"
    );
  }

  async executeModelToolRequest(
    toolRequestId: string
  ): Promise<ModelToolRequest> {
    return this.requestJson(
      `/model-gateway/tool-requests/${toolRequestId}/execute`,
      { method: "POST" },
      (payload) => ModelToolRequestSchema.parse(payload),
      "Unable to execute tool request"
    );
  }

  async listModelGatewayAuditEvents(
    modelSessionId?: string
  ): Promise<ModelGatewayAuditEvent[]> {
    return this.requestJson(
      `/model-gateway/audit-events${buildQueryString({ modelSessionId })}`,
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          ModelGatewayAuditEventSchema.parse(item)
        ),
      "Unable to read model gateway audit events"
    );
  }

  async activateModelGatewayKillSwitch(
    input: ActivateKillSwitchInput
  ): Promise<KillSwitchResult> {
    return this.requestJson(
      "/model-gateway/kill-switch",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => KillSwitchResultSchema.parse(payload),
      "Unable to activate kill switch"
    );
  }

  async getModelGatewayFinOps(): Promise<ModelGatewayFinOpsSummary> {
    return this.requestJson(
      "/model-gateway/finops",
      undefined,
      (payload) => ModelGatewayFinOpsSummarySchema.parse(payload),
      "Unable to read model gateway FinOps"
    );
  }

  async updateModelGatewayFinOps(
    input: UpdateModelGatewayFinOpsInput
  ): Promise<ModelGatewayFinOpsSummary> {
    return this.requestJson(
      "/model-gateway/finops",
      { body: JSON.stringify(input), method: "PUT" },
      (payload) => ModelGatewayFinOpsSummarySchema.parse(payload),
      "Unable to update model gateway FinOps"
    );
  }

  async listAgentWorkflowDefinitions(): Promise<AgentWorkflowDefinition[]> {
    return this.requestJson(
      "/agent-workflows/definitions",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          AgentWorkflowDefinitionSchema.parse(item)
        ),
      "Unable to read workflow definitions"
    );
  }

  async createAgentWorkflowDefinition(
    input: CreateAgentWorkflowDefinitionInput
  ): Promise<AgentWorkflowDefinition> {
    return this.requestJson(
      "/agent-workflows/definitions",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => AgentWorkflowDefinitionSchema.parse(payload),
      "Unable to create workflow definition"
    );
  }

  async listAgentWorkflowRuns(): Promise<AgentWorkflowRun[]> {
    return this.requestJson(
      "/agent-workflows/runs",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          AgentWorkflowRunSchema.parse(item)
        ),
      "Unable to read durable workflow runs"
    );
  }

  async getAgentBehaviorAnalysis(): Promise<AgentBehaviorAnalysis> {
    return this.requestJson(
      "/agent-workflows/behavior-analysis",
      undefined,
      (payload) => AgentBehaviorAnalysisSchema.parse(payload),
      "Unable to analyze agent behavior"
    );
  }

  async createAgentWorkflowRun(
    input: CreateAgentWorkflowRunInput
  ): Promise<AgentWorkflowRun> {
    return this.requestJson(
      "/agent-workflows/runs",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => AgentWorkflowRunSchema.parse(payload),
      "Unable to create durable workflow run"
    );
  }

  async getAgentWorkflowRun(
    workflowRunId: string
  ): Promise<AgentWorkflowRunDetail> {
    return this.requestJson(
      `/agent-workflows/runs/${workflowRunId}`,
      undefined,
      (payload) => AgentWorkflowRunDetailSchema.parse(payload),
      "Unable to read the workflow flight recorder"
    );
  }

  async evaluateAgentWorkflowRunQuality(
    workflowRunId: string
  ): Promise<AgentWorkflowQualityEvaluation> {
    return this.requestJson(
      `/agent-workflows/runs/${workflowRunId}/evaluation`,
      undefined,
      (payload) => AgentWorkflowQualityEvaluationSchema.parse(payload),
      "Unable to evaluate workflow quality"
    );
  }

  async getAgentWorkflowVariableAnalysis(
    workflowRunId: string
  ): Promise<AgentWorkflowVariableAnalysis> {
    return this.requestJson(
      `/agent-workflows/runs/${workflowRunId}/variable-analysis`,
      undefined,
      (payload) => AgentWorkflowVariableAnalysisSchema.parse(payload),
      "Unable to analyze workflow variables"
    );
  }

  async appendAgentWorkflowEvent(
    workflowRunId: string,
    input: AppendAgentWorkflowEventInput
  ): Promise<AgentWorkflowEvent> {
    return this.requestJson(
      `/agent-workflows/runs/${workflowRunId}/events`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => AgentWorkflowEventSchema.parse(payload),
      "Unable to append workflow activity"
    );
  }

  async createAgentWorkflowCheckpoint(
    workflowRunId: string,
    input: CreateAgentWorkflowCheckpointInput
  ): Promise<AgentWorkflowCheckpoint> {
    return this.requestJson(
      `/agent-workflows/runs/${workflowRunId}/checkpoints`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => AgentWorkflowCheckpointSchema.parse(payload),
      "Unable to seal workflow checkpoint"
    );
  }

  async replayAgentWorkflowRun(
    workflowRunId: string,
    input: ReplayAgentWorkflowInput
  ): Promise<AgentWorkflowRun> {
    return this.requestJson(
      `/agent-workflows/runs/${workflowRunId}/replay`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => AgentWorkflowRunSchema.parse(payload),
      "Unable to fork workflow checkpoint"
    );
  }

  async listAgentProtocolEndpoints(): Promise<AgentProtocolEndpoint[]> {
    return this.requestJson(
      "/agent-trust/endpoints",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          AgentProtocolEndpointSchema.parse(item)
        ),
      "Unable to read agent protocol endpoints"
    );
  }

  async registerAgentProtocolEndpoint(
    input: RegisterAgentProtocolEndpointInput
  ): Promise<AgentProtocolEndpoint> {
    return this.requestJson(
      "/agent-trust/endpoints",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => AgentProtocolEndpointSchema.parse(payload),
      "Unable to register agent protocol endpoint"
    );
  }

  async reviewAgentProtocolEndpoint(
    endpointId: string,
    input: ReviewAgentProtocolEndpointInput
  ): Promise<AgentProtocolEndpoint> {
    return this.requestJson(
      `/agent-trust/endpoints/${endpointId}/review`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => AgentProtocolEndpointSchema.parse(payload),
      "Unable to review agent protocol endpoint"
    );
  }

  async discoverAgentProtocolEndpoint(
    endpointId: string
  ): Promise<DiscoverAgentProtocolEndpointResult> {
    return this.requestJson(
      `/agent-trust/endpoints/${endpointId}/discover`,
      { method: "POST" },
      (payload) => DiscoverAgentProtocolEndpointResultSchema.parse(payload),
      "Unable to discover protocol capabilities"
    );
  }

  async listAgentDidTrustProfiles(): Promise<AgentDidTrustProfile[]> {
    return this.requestJson(
      "/agent-trust/did/profiles",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          AgentDidTrustProfileSchema.parse(item)
        ),
      "Unable to read AgentDID trust profiles"
    );
  }

  async createAgentDidTrustProfile(
    input: CreateAgentDidTrustProfileInput
  ): Promise<AgentDidTrustProfile> {
    return this.requestJson(
      "/agent-trust/did/profiles",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => AgentDidTrustProfileSchema.parse(payload),
      "Unable to establish AgentDID trust"
    );
  }

  async refreshAgentDidTrustProfile(
    profileId: string,
    input: RefreshAgentDidTrustProfileInput
  ): Promise<AgentDidTrustProfile> {
    return this.requestJson(
      `/agent-trust/did/profiles/${profileId}/refresh`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => AgentDidTrustProfileSchema.parse(payload),
      "Unable to refresh AgentDID trust"
    );
  }

  async revokeAgentDidTrustProfile(
    profileId: string,
    input: RevokeAgentDidTrustProfileInput
  ): Promise<AgentDidTrustProfile> {
    return this.requestJson(
      `/agent-trust/did/profiles/${profileId}/revoke`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => AgentDidTrustProfileSchema.parse(payload),
      "Unable to revoke AgentDID trust"
    );
  }

  async listAgentVerifiableCredentials(): Promise<AgentVerifiableCredential[]> {
    return this.requestJson(
      "/agent-trust/did/credentials",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          AgentVerifiableCredentialSchema.parse(item)
        ),
      "Unable to read agent credentials"
    );
  }

  async verifyAgentVerifiableCredential(
    input: VerifyAgentVerifiableCredentialInput
  ): Promise<AgentVerifiableCredential> {
    return this.requestJson(
      "/agent-trust/did/credentials/verify",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => AgentVerifiableCredentialSchema.parse(payload),
      "Unable to verify the agent credential"
    );
  }

  async verifyAgentSignedReceipt(
    input: VerifyAgentSignedReceiptInput
  ): Promise<AgentSignedReceipt> {
    return this.requestJson(
      "/agent-trust/receipts/verify",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => AgentSignedReceiptSchema.parse(payload),
      "Unable to verify the signed receipt"
    );
  }

  async listAgentExchangeObjects(): Promise<AgentExchangeObject[]> {
    return this.requestJson(
      "/agent-trust/exchange",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          AgentExchangeObjectSchema.parse(item)
        ),
      "Unable to read agent exchange objects"
    );
  }

  async createAgentExchangeObject(
    input: CreateAgentExchangeObjectInput
  ): Promise<AgentExchangeObject> {
    return this.requestJson(
      "/agent-trust/exchange",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => AgentExchangeObjectSchema.parse(payload),
      "Unable to create agent exchange object"
    );
  }

  async updateAgentExchangeObjectState(
    objectId: string,
    input: UpdateAgentExchangeObjectStateInput
  ): Promise<AgentExchangeObject> {
    return this.requestJson(
      `/agent-trust/exchange/${objectId}/state`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => AgentExchangeObjectSchema.parse(payload),
      "Unable to transition agent exchange object"
    );
  }

  async listConfidentialAttestations(): Promise<ConfidentialAttestation[]> {
    return this.requestJson(
      "/agent-trust/attestations",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          ConfidentialAttestationSchema.parse(item)
        ),
      "Unable to read confidential attestations"
    );
  }

  async getTeeAssuranceWorkspace(): Promise<TeeAssuranceWorkspace> {
    return this.requestJson(
      "/agent-trust/tee-assurance",
      undefined,
      (payload) => TeeAssuranceWorkspaceSchema.parse(payload),
      "Unable to read the TEE assurance register"
    );
  }

  async createTeeAssuranceRequirement(
    input: CreateTeeAssuranceRequirementInput
  ): Promise<TeeAssuranceRequirement> {
    return this.requestJson(
      "/agent-trust/tee-assurance",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => TeeAssuranceRequirementSchema.parse(payload),
      "Unable to create the TEE assurance requirement"
    );
  }

  async evaluateTeeAssurance(
    teeAssuranceRequirementId: string,
    input: EvaluateTeeAssuranceInput
  ): Promise<TeeAssuranceRequirement> {
    return this.requestJson(
      `/agent-trust/tee-assurance/${teeAssuranceRequirementId}/evaluate`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => TeeAssuranceRequirementSchema.parse(payload),
      "Unable to seal the TEE assurance decision"
    );
  }

  async revokeTeeAssurance(
    teeAssuranceRequirementId: string,
    input: RevokeTeeAssuranceInput
  ): Promise<TeeAssuranceRequirement> {
    return this.requestJson(
      `/agent-trust/tee-assurance/${teeAssuranceRequirementId}/revoke`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => TeeAssuranceRequirementSchema.parse(payload),
      "Unable to revoke the TEE assurance qualification"
    );
  }

  async listA2ATckRuns(): Promise<A2ATckRun[]> {
    return this.requestJson(
      "/agent-trust/tck-runs",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          A2ATckRunSchema.parse(item)
        ),
      "Unable to read A2A TCK runs"
    );
  }

  async runA2ATck(
    endpointId: string,
    input: RunA2ATckInput
  ): Promise<A2ATckRun> {
    return this.requestJson(
      `/agent-trust/endpoints/${endpointId}/tck-runs`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => A2ATckRunSchema.parse(payload),
      "Unable to run the A2A TCK"
    );
  }

  async listVeraisonAttestationSessions(): Promise<
    VeraisonAttestationSession[]
  > {
    return this.requestJson(
      "/agent-trust/attestations/veraison/sessions",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          VeraisonAttestationSessionSchema.parse(item)
        ),
      "Unable to read Veraison sessions"
    );
  }

  async createVeraisonAttestationSession(
    input: CreateVeraisonAttestationSessionInput
  ): Promise<VeraisonAttestationSession> {
    return this.requestJson(
      "/agent-trust/attestations/veraison/sessions",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => VeraisonAttestationSessionSchema.parse(payload),
      "Unable to create a Veraison session"
    );
  }

  async verifyVeraisonAttestation(
    input: VerifyVeraisonAttestationInput
  ): Promise<VerifyVeraisonAttestationResult> {
    return this.requestJson(
      "/agent-trust/attestations/veraison/verify",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => VerifyVeraisonAttestationResultSchema.parse(payload),
      "Unable to verify evidence with Veraison"
    );
  }

  async createConfidentialAttestationChallenge(
    input: CreateConfidentialAttestationChallengeInput
  ): Promise<ConfidentialAttestationChallenge> {
    return this.requestJson(
      "/agent-trust/attestations/challenges",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => ConfidentialAttestationChallengeSchema.parse(payload),
      "Unable to create confidential attestation challenge"
    );
  }

  async verifyConfidentialAttestation(
    input: VerifyConfidentialAttestationInput
  ): Promise<ConfidentialAttestation> {
    return this.requestJson(
      "/agent-trust/attestations/verify",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => ConfidentialAttestationSchema.parse(payload),
      "Unable to verify confidential attestation"
    );
  }

  async validateExtensionCompatibility(
    input: ExtensionExecutionContract
  ): Promise<ExtensionCompatibilityReport> {
    return this.requestJson(
      "/agent-trust/extensions/compatibility",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => ExtensionCompatibilityReportSchema.parse(payload),
      "Unable to validate extension compatibility"
    );
  }

  async getExtensionDeveloperWorkspace(): Promise<ExtensionDeveloperWorkspace> {
    return this.requestJson(
      "/extensions/workspace",
      undefined,
      (payload) => ExtensionDeveloperWorkspaceSchema.parse(payload),
      "Unable to read the extension developer workspace"
    );
  }

  async createExtensionProject(
    input: CreateExtensionProjectInput
  ): Promise<ExtensionProject> {
    return this.requestJson(
      "/extensions/projects",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => ExtensionProjectSchema.parse(payload),
      "Unable to create the extension project"
    );
  }

  async getExtensionScaffold(projectId: string): Promise<ExtensionScaffold> {
    return this.requestJson(
      `/extensions/projects/${projectId}/scaffold`,
      undefined,
      (payload) => ExtensionScaffoldSchema.parse(payload),
      "Unable to generate the extension scaffold"
    );
  }

  async submitExtensionRelease(
    projectId: string,
    input: SubmitExtensionReleaseInput
  ): Promise<ExtensionRelease> {
    return this.requestJson(
      `/extensions/projects/${projectId}/releases`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => ExtensionReleaseSchema.parse(payload),
      "Unable to submit the extension release"
    );
  }

  async reviewExtensionRelease(
    releaseId: string,
    input: ReviewExtensionReleaseInput
  ): Promise<ExtensionRelease> {
    return this.requestJson(
      `/extensions/releases/${releaseId}/review`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => ExtensionReleaseSchema.parse(payload),
      "Unable to review the extension release"
    );
  }

  async activateExtensionRelease(
    releaseId: string,
    input: ExtensionLifecycleReasonInput
  ): Promise<ExtensionRelease> {
    return this.requestJson(
      `/extensions/releases/${releaseId}/activate`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => ExtensionReleaseSchema.parse(payload),
      "Unable to activate the extension catalog release"
    );
  }

  async rollbackExtensionProject(
    projectId: string,
    input: RollbackExtensionProjectInput
  ): Promise<ExtensionRelease> {
    return this.requestJson(
      `/extensions/projects/${projectId}/rollback`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => ExtensionReleaseSchema.parse(payload),
      "Unable to roll back the extension catalog release"
    );
  }

  async revokeExtensionRelease(
    releaseId: string,
    input: ExtensionLifecycleReasonInput
  ): Promise<ExtensionRelease> {
    return this.requestJson(
      `/extensions/releases/${releaseId}/revoke`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => ExtensionReleaseSchema.parse(payload),
      "Unable to revoke the extension release"
    );
  }

  async listFindingsPage(
    query: ListFindingsQuery = {}
  ): Promise<FindingsPage> {
    return this.requestJson(
      `/findings${buildQueryString({
        assetId: query.assetId,
        exploitability: query.exploitability,
        severity: query.severity,
        sourceMotion: query.sourceMotion,
        status: query.status,
        missionId: query.missionId,
        validationState: query.validationState,
        owner: query.owner,
        disposition: query.disposition,
        excludeDisposition: query.excludeDisposition,
        priorityMin: query.priorityMin,
        search: query.search,
        limit: query.limit,
        offset: query.offset
      })}`,
      undefined,
      (payload) => {
        const page = payload as {
          items: unknown[];
          page?: { hasMore?: unknown; limit?: unknown; offset?: unknown };
        };
        return {
          items: page.items.map((item) => ValidatedFindingSchema.parse(item)),
          page: {
            hasMore: page.page?.hasMore === true,
            limit:
              typeof page.page?.limit === "number"
                ? page.page.limit
                : (query.limit ?? 100),
            offset:
              typeof page.page?.offset === "number"
                ? page.page.offset
                : (query.offset ?? 0)
          }
        };
      },
      "Unable to read findings"
    );
  }

  async listFindings(
    query: ListFindingsQuery = {}
  ): Promise<ValidatedFinding[]> {
    return (await this.listFindingsPage(query)).items;
  }

  /**
   * Evidence-backed Community SARIF 2.1.0. Empty-evidence rows are omitted by
   * the API. Optional missionId scopes the export; other workbench filters are
   * not forwarded. Not a certification or pentest report.
   */
  async fetchFindingsSarif(
    query: { missionId?: string } = {}
  ): Promise<FindingsSarifDownload> {
    const response = await this.request(
      `/findings.sarif${buildQueryString({ missionId: query.missionId })}`,
      {
        headers: {
          Accept: "application/sarif+json, application/json"
        }
      }
    );

    if (!response.ok) {
      const payload = await response.json().catch(() => null);

      throw new PeriscanApiClientError(
        response.status,
        toErrorMessage(
          response.status,
          payload,
          "Unable to export findings SARIF"
        )
      );
    }

    const disposition = response.headers.get("content-disposition") ?? "";
    const filenameMatch = /filename="([^"]+)"/u.exec(disposition);
    const stamp = new Date().toISOString().slice(0, 10);

    return {
      content: await response.text(),
      contentType:
        response.headers.get("content-type") ?? "application/sarif+json",
      filename: filenameMatch?.[1] ?? `periscan-findings-${stamp}.sarif`
    };
  }

  async listDispositionFeedback(): Promise<DispositionFeedbackSummary> {
    return this.requestJson(
      "/findings/disposition-feedback",
      undefined,
      (payload) => DispositionFeedbackSummarySchema.parse(payload),
      "Unable to read disposition feedback"
    );
  }

  async getFinding(findingId: string): Promise<ValidatedFinding> {
    return this.requestJson(
      `/findings/${findingId}`,
      undefined,
      (payload) => ValidatedFindingSchema.parse(payload),
      "Unable to read finding"
    );
  }

  async transitionFinding(
    findingId: string,
    input: {
      disposition: FindingDisposition | null;
      expiresAt?: string;
      note?: string;
      ownerId?: string;
      reasonCode?:
        | "OutOfScope"
        | "DuplicateObservation"
        | "Benign"
        | "Lab"
        | "ToolNoise"
        | "Other";
      /**
       * FP/Suppressed: mute the cause fingerprint (server default true when
       * omitted). Explicit false = this finding only.
       */
      applyToFingerprint?: boolean;
    }
  ): Promise<ValidatedFinding> {
    return this.requestJson(
      `/findings/${findingId}/transition`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => ValidatedFindingSchema.parse(payload),
      "Unable to change finding disposition"
    );
  }

  async approveFindingRisk(findingId: string): Promise<ValidatedFinding> {
    return this.requestJson(
      `/findings/${findingId}/approve-risk`,
      { method: "POST" },
      (payload) => ValidatedFindingSchema.parse(payload),
      "Unable to approve accepted risk"
    );
  }

  async getSignalTriggers(): Promise<SignalTriggerEvaluationResponse> {
    return this.requestJson(
      "/signal-triggers",
      undefined,
      (payload) => SignalTriggerEvaluationResponseSchema.parse(payload),
      "Unable to read signal triggers"
    );
  }

  async listSignalTriggerActivity(): Promise<SignalTriggerActivity[]> {
    return this.requestJson(
      "/signal-triggers/activity",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          SignalTriggerActivitySchema.parse(item)
        ),
      "Unable to read signal trigger activity"
    );
  }

  async approveSignalTrigger(
    triggerId: string
  ): Promise<SignalTriggerApprovalResponse> {
    return this.requestJson(
      `/signal-triggers/${triggerId}/approve`,
      { method: "POST" },
      (payload) => SignalTriggerApprovalResponseSchema.parse(payload),
      "Unable to approve signal trigger"
    );
  }

  async listMissions(): Promise<ValidationMission[]> {
    return this.requestJson(
      "/missions",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          ValidationMissionSchema.parse(item)
        ),
      "Unable to read missions"
    );
  }

  async getMission(missionId: string): Promise<ValidationMission> {
    return this.requestJson(
      `/missions/${missionId}`,
      undefined,
      (payload) => ValidationMissionSchema.parse(payload),
      "Unable to read mission"
    );
  }

  async createMission(input: {
    missionType: string;
    scopeId: string;
    safetyLevel?: string;
    target?: Record<string, unknown>;
    policyDecisionId?: string;
  }): Promise<ValidationMission> {
    return this.requestJson(
      "/missions",
      {
        body: JSON.stringify(input),
        method: "POST"
      },
      (payload) => ValidationMissionSchema.parse(payload),
      "Unable to create mission"
    );
  }

  async listMissionRuns(missionId: string): Promise<ValidationRun[]> {
    return this.requestJson(
      `/missions/${missionId}/runs`,
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          ValidationRunSchema.parse(item)
        ),
      "Unable to read mission runs"
    );
  }

  async getCommunityValidationSuite(input?: {
    includeExternalPoa?: boolean;
    scopeId?: string;
  }): Promise<CommunityValidationSuiteResponse> {
    return this.requestJson(
      `/community/validation-suite${buildQueryString({
        includeExternalPoa: input?.includeExternalPoa ? "true" : undefined,
        scopeId: input?.scopeId
      })}`,
      undefined,
      (payload) => CommunityValidationSuiteResponseSchema.parse(payload),
      "Unable to read Community validation suite"
    );
  }

  async getCommunityValidationCompanion(
    missionId: string
  ): Promise<CommunityValidationCompanion> {
    return this.requestJson(
      `/community/validation-runs${buildQueryString({ missionId })}`,
      undefined,
      (payload) => CommunityValidationCompanionSchema.parse(payload),
      "Unable to read Community validation companion"
    );
  }

  async createCommunityMissionRemediations(
    missionId: string
  ): Promise<CommunityMissionRemediationsResult> {
    return this.requestJson(
      `/community/validation-runs/${missionId}/remediations`,
      { method: "POST" },
      (payload) => CommunityMissionRemediationsResultSchema.parse(payload),
      "Unable to create remediations from this Community mission"
    );
  }

  async startCommunityValidation(input: {
    includeCopyleftOptIn?: boolean;
    includeExternalPoa?: boolean;
    moduleIds?: string[];
    policyDecisionId: string;
    runnerId?: string;
    scopeId: string;
  }): Promise<CommunityValidationStartResult> {
    return this.requestJson(
      "/community/validation-runs",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => CommunityValidationStartResultSchema.parse(payload),
      "Unable to start Community validation"
    );
  }

  async startMission(
    missionId: string,
    input: {
      moduleIds: string[];
      runnerId?: string;
      target?: Record<string, unknown>;
    }
  ): Promise<MissionStartResult> {
    return this.requestJson(
      `/missions/${missionId}/start`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => MissionStartResultSchema.parse(payload),
      "Unable to start mission"
    );
  }

  async cancelMission(missionId: string): Promise<ValidationMission> {
    return this.requestJson(
      `/missions/${missionId}/cancel`,
      { method: "POST" },
      (payload) => ValidationMissionSchema.parse(payload),
      "Unable to cancel mission"
    );
  }

  async getMissionRun(
    missionId: string,
    runId: string
  ): Promise<ValidationRun> {
    return this.requestJson(
      `/missions/${missionId}/runs/${runId}`,
      undefined,
      (payload) => ValidationRunSchema.parse(payload),
      "Unable to read mission run"
    );
  }

  async getJob(jobId: string): Promise<Job> {
    return this.requestJson(
      `/jobs/${jobId}`,
      undefined,
      (payload) => JobSchema.parse(payload),
      "Unable to read job"
    );
  }

  async getAttackPath(pathId: string): Promise<AttackPathAssessment> {
    return this.requestJson(
      `/attack-paths/${pathId}`,
      undefined,
      (payload) => AttackPathAssessmentSchema.parse(payload),
      "Unable to read attack path"
    );
  }

  async listAttackPathEvidence(pathId: string): Promise<EvidenceArtifact[]> {
    return this.requestJson(
      `/attack-paths/${pathId}/evidence`,
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          EvidenceArtifactSchema.parse(item)
        ),
      "Unable to read attack path evidence"
    );
  }

  async requestAttackPathVerification(
    pathId: string,
    input: { reason?: string; scopeId?: string }
  ): Promise<AttackPathVerificationRequest> {
    return this.requestJson(
      `/attack-paths/${pathId}/verify`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => AttackPathVerificationRequestSchema.parse(payload),
      "Unable to request attack path verification"
    );
  }

  async getAttackPathValidationPlan(
    pathId: string
  ): Promise<AttackPathValidationPlan> {
    return this.requestJson(
      `/attack-paths/${pathId}/validation-plan`,
      undefined,
      (payload) => AttackPathValidationPlanSchema.parse(payload),
      "Unable to read attack path validation plan"
    );
  }

  async listAttackPathEdgeReceipts(
    pathId: string
  ): Promise<PathEdgeReceipt[]> {
    return this.requestJson(
      `/attack-paths/${pathId}/edge-receipts`,
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          PathEdgeReceiptSchema.parse(item)
        ),
      "Unable to read attack path edge receipts"
    );
  }

  async getAttackPathMeasurementState(
    pathId: string
  ): Promise<AttackPathMeasurementState> {
    return this.requestJson(
      `/attack-paths/${pathId}/measurement-state`,
      undefined,
      (payload) => AttackPathMeasurementStateSchema.parse(payload),
      "Unable to read attack path measurement state"
    );
  }

  async getAttackPathNextMission(
    pathId: string
  ): Promise<DynamicPathMissionRecommendation | null> {
    return this.requestJson(
      `/attack-paths/${pathId}/next-mission`,
      undefined,
      (payload) => {
        const body = payload as { recommendation?: unknown };
        if (body.recommendation == null) {
          return null;
        }
        return DynamicPathMissionRecommendationSchema.parse(
          body.recommendation
        ) as DynamicPathMissionRecommendation;
      },
      "Unable to read path next recommended mission"
    );
  }

  async approveAttackPathNextMission(
    pathId: string
  ): Promise<{
    decision: unknown;
    mission: unknown;
    queued: false;
    recommendation: DynamicPathMissionRecommendation;
  }> {
    return this.requestJson(
      `/attack-paths/${pathId}/next-mission/approve`,
      { method: "POST" },
      (payload) => {
        const body = payload as {
          decision: unknown;
          mission: unknown;
          queued: false;
          recommendation: unknown;
        };
        return {
          decision: body.decision,
          mission: body.mission,
          queued: false as const,
          recommendation: DynamicPathMissionRecommendationSchema.parse(
            body.recommendation
          ) as DynamicPathMissionRecommendation
        };
      },
      "Unable to approve path next recommended mission"
    );
  }

  async applyPathEdgeReceipt(
    pathId: string,
    edgeId: string,
    input: Omit<ApplyPathEdgeReceiptInput, "pathId" | "pathEdgeId">
  ): Promise<ApplyPathEdgeReceiptResult> {
    const body = ApplyPathEdgeReceiptInputSchema.parse({
      ...input,
      pathEdgeId: edgeId,
      pathId
    });
    return this.requestJson(
      `/attack-paths/${pathId}/edges/${edgeId}/receipts`,
      { body: JSON.stringify(body), method: "POST" },
      (payload) => ApplyPathEdgeReceiptResultSchema.parse(payload),
      "Unable to apply path edge receipt"
    );
  }

  async launchPathEdgeValidation(
    pathId: string,
    edgeId: string,
    input: Omit<LaunchPathEdgeValidationInput, "pathId" | "pathEdgeId">
  ): Promise<PathEdgeValidationLaunchResult> {
    const body = LaunchPathEdgeValidationInputSchema.parse({
      ...input,
      pathEdgeId: edgeId,
      pathId
    });
    return this.requestJson(
      `/attack-paths/${pathId}/edges/${edgeId}/validate`,
      { body: JSON.stringify(body), method: "POST" },
      (payload) => PathEdgeValidationLaunchResultSchema.parse(payload),
      "Unable to launch path edge validation"
    );
  }

  async markRemediationReadyForVerification(
    remediationId: string
  ): Promise<RemediationTask> {
    return this.requestJson(
      `/remediations/${remediationId}/mark-ready-for-verification`,
      { method: "POST" },
      (payload) => RemediationTaskSchema.parse(payload),
      "Unable to mark remediation ready for verification"
    );
  }

  async verifyRemediation(
    remediationId: string
  ): Promise<RemediationVerificationResult> {
    return this.requestJson(
      `/remediations/${remediationId}/verify`,
      { body: JSON.stringify({}), method: "POST" },
      (payload) => {
        const record = (payload ?? {}) as Record<string, unknown>;

        return {
          attackPath:
            record.attackPath == null
              ? null
              : AttackPathAssessmentSchema.parse(record.attackPath),
          mission: ValidationMissionSchema.parse(record.mission),
          remediation: RemediationTaskSchema.parse(record.remediation),
          run: ValidationRunSchema.parse(record.run),
          verificationEvent: VerificationEventSchema.parse(
            record.verificationEvent
          )
        };
      },
      "Unable to verify remediation"
    );
  }

  async listVerificationEvents(
    remediationId: string
  ): Promise<VerificationEvent[]> {
    return this.requestJson(
      `/remediations/${remediationId}/verification-events`,
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          VerificationEventSchema.parse(item)
        ),
      "Unable to read verification events"
    );
  }

  async listTenantMembers(): Promise<TenantMember[]> {
    return this.requestJson(
      "/tenants/current/members",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          TenantMemberSchema.parse(item)
        ),
      "Unable to read members"
    );
  }

  async getExecutiveTrendSeries(): Promise<ExecutiveTrendSeries> {
    return this.requestJson(
      "/tenants/current/executive-trends/series",
      undefined,
      (payload) => ExecutiveTrendSeriesSchema.parse(payload),
      "Unable to read executive trend history"
    );
  }

  async getTenantSafetySettings(): Promise<TenantSafetySettings> {
    return this.requestJson(
      "/tenants/current/safety-settings",
      undefined,
      (payload) => TenantSafetySettingsSchema.parse(payload),
      "Unable to read safety settings"
    );
  }

  async getTenantRequireMfa(): Promise<TenantRequireMfaSettings> {
    return this.requestJson(
      "/tenants/current/security-settings/require-mfa",
      undefined,
      (payload) => TenantRequireMfaSettingsSchema.parse(payload),
      "Unable to read force-MFA policy"
    );
  }

  async setTenantRequireMfa(
    input: SetTenantRequireMfaInput
  ): Promise<TenantRequireMfaSettings> {
    return this.requestJson(
      "/tenants/current/security-settings/require-mfa",
      { body: JSON.stringify(input), method: "PUT" },
      (payload) => TenantRequireMfaSettingsSchema.parse(payload),
      "Unable to update force-MFA policy"
    );
  }

  async setOffensiveValidation(input: {
    enabled: boolean;
    authorizationReference?: string;
  }): Promise<TenantSafetySettings> {
    return this.requestJson(
      "/tenants/current/safety-settings/offensive-validation",
      { body: JSON.stringify(input), method: "PUT" },
      (payload) => TenantSafetySettingsSchema.parse(payload),
      "Unable to update offensive validation authorization"
    );
  }

  async listMcpTools(): Promise<McpToolInfo[]> {
    return this.requestJson(
      "/mcp/tools",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          McpToolInfoSchema.parse(item)
        ),
      "Unable to read MCP tools"
    );
  }

  async listMcpActivity(): Promise<McpActivityEntry[]> {
    return this.requestJson(
      "/mcp/activity",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          McpActivityEntrySchema.parse(item)
        ),
      "Unable to read MCP activity"
    );
  }

  async globalSearch(query: string): Promise<GlobalSearchResponse> {
    return this.requestJson(
      `/search?q=${encodeURIComponent(query)}`,
      undefined,
      (payload) => GlobalSearchResponseSchema.parse(payload),
      "Unable to search"
    );
  }

  async updateTenantMemberRole(
    membershipId: string,
    role: MembershipRole
  ): Promise<TenantMember> {
    return this.requestJson(
      `/tenants/current/members/${membershipId}`,
      { body: JSON.stringify({ role }), method: "PATCH" },
      (payload) => TenantMemberSchema.parse(payload),
      "Unable to update member role"
    );
  }

  async removeTenantMember(membershipId: string): Promise<void> {
    const response = await this.request(
      `/tenants/current/members/${membershipId}`,
      { method: "DELETE" }
    );
    if (!response.ok && response.status !== 204) {
      const payload = await response.json().catch(() => null);
      throw new PeriscanApiClientError(
        response.status,
        toErrorMessage(response.status, payload, "Unable to remove member")
      );
    }
  }

  // --- Tenant API keys (admin) ---
  async listApiKeys(): Promise<TenantApiKey[]> {
    return this.requestJson(
      "/tenants/current/api-keys",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          TenantApiKeySchema.parse(item)
        ),
      "Unable to read API keys"
    );
  }

  async previewPolicyDecision(
    scopeId: string,
    input: {
      executionEnvironment: "ControlPlane" | "ExternalPoA" | "InternalRunner";
      missionType: string;
      safetyLevel: string;
      requestedAction: {
        destructive: boolean;
        realDataExfiltration: boolean;
        persistence: boolean;
        credentialTheft: boolean;
        uncontrolledExploitChaining: boolean;
        requiresInternalRunner?: boolean;
        requiresTimeWindow?: boolean;
      };
      target: Record<string, unknown>;
    }
  ): Promise<PolicyDecision> {
    return this.requestJson(
      `/scopes/${scopeId}/policy-decisions/preview`,
      { body: JSON.stringify(input), method: "POST" },
      (payload) => PolicyDecisionSchema.parse(payload),
      "Unable to preview policy decision"
    );
  }

  async getSsoConfig(): Promise<TenantSsoConfig | null> {
    return this.requestJson(
      "/tenants/current/sso",
      undefined,
      (payload) => {
        const config = (payload as { config: unknown }).config;
        return config == null ? null : TenantSsoConfigSchema.parse(config);
      },
      "Unable to read SSO configuration"
    );
  }

  async updateSsoConfig(
    input: UpdateTenantSsoConfigInput
  ): Promise<TenantSsoConfig> {
    return this.requestJson(
      "/tenants/current/sso",
      { body: JSON.stringify(input), method: "PUT" },
      (payload) => TenantSsoConfigSchema.parse(payload),
      "Unable to update SSO configuration"
    );
  }

  async disableSso(): Promise<void> {
    const response = await this.request("/tenants/current/sso", {
      method: "DELETE"
    });
    if (!response.ok && response.status !== 204) {
      const payload = await response.json().catch(() => null);
      throw new PeriscanApiClientError(
        response.status,
        toErrorMessage(response.status, payload, "Unable to disable SSO")
      );
    }
  }

  async inviteMember(input: {
    email: string;
    name: string;
    role: string;
  }): Promise<unknown> {
    return this.requestJson(
      "/tenants/current/invite",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => payload,
      "Unable to invite teammate"
    );
  }

  async createApiKey(
    input: CreateTenantApiKeyInput
  ): Promise<TenantApiKeyWithSecret> {
    return this.requestJson(
      "/tenants/current/api-keys",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => TenantApiKeyWithSecretSchema.parse(payload),
      "Unable to create API key"
    );
  }

  async revokeApiKey(apiKeyId: string): Promise<void> {
    const response = await this.request(
      `/tenants/current/api-keys/${apiKeyId}`,
      { method: "DELETE" }
    );
    if (!response.ok && response.status !== 204) {
      const payload = await response.json().catch(() => null);
      throw new PeriscanApiClientError(
        response.status,
        toErrorMessage(response.status, payload, "Unable to revoke API key")
      );
    }
  }

  async rotateApiKey(apiKeyId: string): Promise<TenantApiKeyWithSecret> {
    return this.requestJson(
      `/tenants/current/api-keys/${apiKeyId}/rotate`,
      { method: "POST" },
      (payload) => TenantApiKeyWithSecretSchema.parse(payload),
      "Unable to rotate API key"
    );
  }

  // --- Billing limits (usage vs configured soft limits) ---
  async getBillingLimits(): Promise<{
    limits: {
      evidenceArtifacts: number | null;
      missionsPerMonth: number | null;
      runners: number | null;
    };
    usage: {
      evidenceArtifacts: number;
      missionsThisMonth: number;
      runners: number;
    };
    withinLimits: boolean;
  }> {
    return this.requestJson(
      "/billing/limits",
      undefined,
      (payload) =>
        payload as {
          limits: {
            evidenceArtifacts: number | null;
            missionsPerMonth: number | null;
            runners: number | null;
          };
          usage: {
            evidenceArtifacts: number;
            missionsThisMonth: number;
            runners: number;
          };
          withinLimits: boolean;
        },
      "Unable to read billing limits"
    );
  }

  // --- Audit export (admin) ---
  async createAuditExport(
    format: "json" | "csv" = "json",
    filters: Omit<AuditEventQuery, "limit" | "offset"> = {}
  ): Promise<{
    downloadPath: string;
    exportId: string;
    eventCount: number;
    format: string;
    generatedAt: string;
    totalEventCount: number;
    truncated: boolean;
  }> {
    return this.requestJson(
      "/audit-events/export",
      { body: JSON.stringify({ ...filters, format }), method: "POST" },
      (payload) =>
        payload as {
          downloadPath: string;
          exportId: string;
          eventCount: number;
          format: string;
          generatedAt: string;
          totalEventCount: number;
          truncated: boolean;
        },
      "Unable to export audit events"
    );
  }

  // --- Outbound webhooks (admin) ---
  async listWebhooks(): Promise<TenantWebhook[]> {
    return this.requestJson(
      "/tenants/current/webhooks",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          TenantWebhookSchema.parse(item)
        ),
      "Unable to read webhooks"
    );
  }

  /** Discoverable event types + signature headers (P20-5 / O13). */
  async getWebhookEventCatalog(): Promise<WebhookEventCatalog> {
    return this.requestJson(
      "/tenants/current/webhooks/event-catalog",
      undefined,
      (payload) => WebhookEventCatalogSchema.parse(payload),
      "Unable to read webhook event catalog"
    );
  }

  async createWebhook(
    input: CreateTenantWebhookInput
  ): Promise<TenantWebhookWithSecret> {
    return this.requestJson(
      "/tenants/current/webhooks",
      { body: JSON.stringify(input), method: "POST" },
      (payload) => TenantWebhookWithSecretSchema.parse(payload),
      "Unable to create webhook"
    );
  }

  async updateWebhook(
    webhookId: string,
    input: UpdateTenantWebhookInput
  ): Promise<TenantWebhook> {
    return this.requestJson(
      `/tenants/current/webhooks/${webhookId}`,
      { body: JSON.stringify(input), method: "PUT" },
      (payload) => TenantWebhookSchema.parse(payload),
      "Unable to update webhook"
    );
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    const response = await this.request(
      `/tenants/current/webhooks/${webhookId}`,
      { method: "DELETE" }
    );
    if (!response.ok && response.status !== 204) {
      const payload = await response.json().catch(() => null);
      throw new PeriscanApiClientError(
        response.status,
        toErrorMessage(response.status, payload, "Unable to delete webhook")
      );
    }
  }

  async testWebhook(webhookId: string): Promise<void> {
    const response = await this.request(
      `/tenants/current/webhooks/${webhookId}/test`,
      { method: "POST" }
    );
    if (!response.ok && response.status !== 204) {
      const payload = await response.json().catch(() => null);
      throw new PeriscanApiClientError(
        response.status,
        toErrorMessage(response.status, payload, "Unable to send test event")
      );
    }
  }

  /**
   * Rotate webhook signing secret (P20-4). Returns the new secret once —
   * same contract as createWebhook.
   */
  async rotateWebhookSecret(
    webhookId: string
  ): Promise<TenantWebhookWithSecret> {
    return this.requestJson(
      `/tenants/current/webhooks/${webhookId}/rotate-secret`,
      { method: "POST" },
      (payload) => TenantWebhookWithSecretSchema.parse(payload),
      "Unable to rotate webhook secret"
    );
  }

  /**
   * Redrive a failed or dead-lettered delivery (P20-4). Resets attempts and
   * re-enqueues; non-redrivable deliveries return 409.
   */
  async redriveWebhookDelivery(
    deliveryId: string
  ): Promise<{ deliveryId: string; status: string }> {
    return this.requestJson(
      `/tenants/current/webhook-deliveries/${deliveryId}/redrive`,
      { method: "POST" },
      (payload) => {
        const body = payload as { deliveryId?: unknown; status?: unknown };
        if (
          typeof body.deliveryId !== "string" ||
          typeof body.status !== "string"
        ) {
          throw new Error("Invalid redrive response");
        }
        return { deliveryId: body.deliveryId, status: body.status };
      },
      "Unable to redrive webhook delivery"
    );
  }

  async listWebhookDeliveries(): Promise<WebhookDelivery[]> {
    return this.requestJson(
      "/tenants/current/webhook-deliveries",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          WebhookDeliverySchema.parse(item)
        ),
      "Unable to read webhook deliveries"
    );
  }

  async listDeadLetteredWebhookDeliveries(): Promise<WebhookDelivery[]> {
    return this.requestJson(
      "/tenants/current/webhook-deliveries/dead-letter",
      undefined,
      (payload) =>
        (payload as { items: unknown[] }).items.map((item) =>
          WebhookDeliverySchema.parse(item)
        ),
      "Unable to read dead-lettered webhook deliveries"
    );
  }

  // Freemium light external scan support (modular; domain only + consent)
  async createLightExternalScan(input: {
    domain: string;
    consent: true;
  }): Promise<{
    scope: any;
    schedule: any;
    note?: string;
  }> {
    return this.requestJson(
      "/light-external-scans",
      {
        body: JSON.stringify(input),
        method: "POST"
      },
      (payload) => payload as any,
      "Unable to create light external scan"
    );
  }
}

export const browserPeriscanApiClient = new PeriscanApiClient();

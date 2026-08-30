import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  randomUUID,
  sign,
  timingSafeEqual,
  type KeyObject
} from "node:crypto";

import type { Prisma, PrismaClient } from "@prisma/client";
import forge from "node-forge";
import type {
  Connector,
  ConnectorHealth,
  ConnectorManifest
} from "@periscan/connectors";
// getConnectorCatalog is value-imported because the AppServices interface
// references its inferred return type via `typeof getConnectorCatalog` (no named
// type exists to import); a type-only import cannot back a `typeof` query.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  getConnectorByKey,
  getConnectorCatalog,
  getConnectorCatalogEntryByKey
} from "@periscan/connectors";
import {
  absorbContributingSignalsIntoPathFindings,
  assessAttackPathRisk,
  computePathFindingMaterial,
  computeSignalFindingMaterial,
  correlateAttackPathsFromSignals,
  createPrismaEvidenceGraphService,
  createPrismaEvidenceService,
  estimateFinancialExposure,
  generateRemediationTaskDraft,
  getAvailableEvidenceDataRegions,
  groupFindingsByFingerprint,
  buildHopKey,
  hopKeyForPathEdge,
  reattachPathEdgeReceiptsByHopKey,
  recomputeAttackPathFromReceipts,
  resolveDraftEdgeEvidenceBasis,
  resolveDraftPathEvidenceBasis,
  resolveAssetObservation
} from "@periscan/evidence";
import {
  getPrismaClient,
  resolveConfiguredDatabaseUrlFromEnv
} from "@periscan/db";
import { type GatewayPolicyDeps } from "@periscan/model-gateway";
import {
  executeA2ATck,
  executeModuleById,
  getModuleById,
  type A2ATckExecutor,
  type ModuleManifest
} from "@periscan/modules";
import {
  type DynamicPathMissionRecommendation,
  type EvidenceGroundedSummary,
  type EvidenceSummaryUseCase,
  type OperatorProfile,
  type CreateOperatorRecommendationRecordInput,
  type OperatorRecommendation,
  type OperatorRecommendationRecord
} from "@periscan/operators";
import {
  evaluateExternalValidationGuard,
  evaluateExternalValidationResolvedTarget,
  evaluatePolicy,
  isPolicyDecisionExpired,
  type ExternalValidationTemplateProfileMetadata
} from "@periscan/policy";
import {
  buildCTEMProgramSummary,
  renderAdvisoryReadinessReportHtml,
  renderAdvisoryReadinessReportPdf,
  renderValidationSnapshotReportHtml,
  renderValidationSnapshotReportPdf,
  type AcceptedRiskAttestationEntry
} from "@periscan/reports";
import {
  buildEnterpriseCommercialHonesty,
  buildHonestyTrustMetrics,
  buildIdentityProvisioningHonesty,
  buildMarketPresenceReadiness,
  buildVendorAssurance,
  countFixedSurvival,
  countMeasuredClaims,
  DEFAULT_DATA_CATEGORIES_PROCESSED,
  DEFAULT_DATA_SUBJECT_REQUEST_PROCESS,
  EMPTY_SUBPROCESSORS_HONESTY,
  CONFIGURED_SUBPROCESSORS_HONESTY,
  expandApiKeyCapabilities,
  buildTrustSafetyOperationalReadiness,
  resolveHttpsReferenceUrl,
  buildAttackPathRiskSummary,
  buildValidationSnapshotPathLanguage,
  claimSafePathValidationStateForWrite,
  countStaleVerifications,
  ControlRuleCoverageSummarySchema,
  deriveFindingSourceMotion,
  SETTLED_REMEDIATION_STATUSES,
  evaluateCapabilityEntitlement,
  projectPathValidationState,
  getAttackTechniqueById,
  AssetValuationSchema,
  listControlValidationScenarios,
  PathEdgeReceiptSchema,
  RunnerTaskEnvelopeSchema,
  IntegrationExecutionReadinessSchema,
  IntegrationImplementationTierSchema,
  mapAttackTechniqueIds,
  mapDetectionRuleCoverageStatusToEffectiveness,
  redisConnectionOptionsFromUrl,
  resolveExternalTicketClosedRemediationStatus as resolveExternalTicketClosedRemediationStatusShared,
  resolveGraphNodeType,
  TenantOperationalMetricsSchema,
  SupportedLocaleSchema,
  TrustSafetySummarySchema,
  ValidationSnapshotSchema
} from "@periscan/shared";
import type {
  AIApplication,
  Asset,
  AssetLineage,
  AssetOwnershipReview,
  AssetOwnershipSurface,
  DataFabricQualitySurface,
  ImportScanFileInput,
  ScanImportResult,
  ReviewAssetOwnershipCandidateInput,
  AssetValuationInput,
  AssetValuationVersion,
  AsyncOperationsPolicyInput,
  AsyncOperationsReasonInput,
  AsyncOperationsReconcileResult,
  AsyncOperationsWorkspace,
  AsyncRecoveryDecisionInput,
  AsyncRecoveryDecisionResult,
  BusinessImpactPreview,
  BusinessImpactWorkspace,
  ReviewAssetValuationVersionInput,
  SubmitAssetValuationVersionInput,
  AdvisoryExposure,
  AdvisoryImpactAssessment,
  AdvisoryReadinessReport,
  AttackTechnique,
  AuditEvent,
  AuditEventFilter,
  ApplyPathEdgeReceiptInput,
  ApplyPathEdgeReceiptResult,
  AttackPath,
  AttackPathAssessment,
  AttackPathChokePointAnalysis,
  AttackPathMeasurementState,
  AttackPathValidationPlan,
  AttackPathVerificationRequest,
  AuditEventAction,
  LaunchPathEdgeValidationInput,
  PathEdgeReceipt,
  PathEdgeValidationLaunchResult,
  ControlSource,
  CreateValidationStimulusInput,
  CreateValidationStimulusResponse,
  CreateScopeInput,
  CreateMissionScheduleInput,
  CreateControlGapRemediationInput,
  CreateRemediationInput,
  CreateRemediationTicketInput,
  SyncRemediationTicketInput,
  ConfirmInfrastructureChangeInput,
  ConfirmRemediationActionInput,
  RemediationTicketStateResult,
  RemediationTicketResult,
  FixEffectivenessTrend,
  FinancialExposureEstimate,
  ControlRuleCoverageSummary,
  DetectionRuleBehavior,
  DetectionRuleCoverageItem,
  DetectionRuleCoverageStatus,
  CTEMProgramSummary,
  ClientPortfolioReadinessStatus,
  ClientPortfolioSummary,
  DeploymentConfigItem,
  DeploymentStatusResponse,
  EvidenceArtifact,
  EvidenceArtifactVerification,
  EvidenceChainVerificationReport,
  EvidencePack,
  CreateExtensionProjectInput,
  ExtensionDeveloperWorkspace,
  ExtensionLifecycleReasonInput,
  ExtensionProject,
  ExtensionRelease,
  ExtensionScaffold,
  ReviewExtensionReleaseInput,
  RollbackExtensionProjectInput,
  SubmitExtensionReleaseInput,
  CreateSubscriptionLifecycleInput,
  RecordSubscriptionRenewalInput,
  ResolveSubscriptionGraceInput,
  ScheduleSubscriptionCancellationInput,
  StartSubscriptionGraceInput,
  SubscriptionOperationsWorkspace,
  SubscriptionReasonInput,
  ExecutiveTrendSummary,
  ExecutiveTrendSeries,
  Integration,
  InfrastructureChangeRequest,
  ImportThreatAdvisoryInput,
  ThreatFeedIngestionInput,
  ThreatFeedIngestionResult,
  ThreatCatalogQuery,
  ThreatFeedStatus,
  ThreatIntelItem,
  TenantThreatAlert,
  TenantThreatAlertStatus,
  Job,
  JobStatus,
  Membership,
  MembershipRole,
  MissingSignal,
  NonHumanIdentity,
  NonHumanIdentityInventory,
  RegisterNonHumanIdentityInput,
  MissionSchedule,
  MissionScheduleDetail,
  ReadinessResponse,
  MSSPClientPortfolio,
  OpenSourceCapability,
  OpenSourceToolCatalogEntry,
  OpenSourceToolId,
  PlaybookArtifacts,
  PolicyDecision,
  PolicyRequestedAction,
  PrescriptivePlan,
  ProductActivationState,
  ProductExperienceProfile,
  ProductFeedback,
  BlueShiftBrief,
  ProductWorkQueue,
  DispositionFeedbackSummary,
  ReportExportFormat,
  ReportShareGrant,
  ReportShareLink,
  RemediationTask,
  RemediationAction,
  PreviewInfrastructureChangeInput,
  PreviewRemediationActionInput,
  RemediationSimulationResult,
  RunnerHeartbeat,
  RunnerControlStateAcknowledgement,
  RunnerCredentialRotationRequest,
  RunnerCredentialRotationResponse,
  RunnerFleetPolicy,
  RunnerFleetWorkspace,
  RunnerIssuedCredential,
  RunnerKillSwitchRequest,
  RunnerPollRequest,
  RunnerRecord,
  RunnerCheckTaskRequest,
  RunnerDiscoverTaskRequest,
  RunnerMeasuredTaskRequest,
  RunnerReachabilityTaskRequest,
  RunnerTaskAcceptRequest,
  RunnerTaskRejectRequest,
  RunnerRegistrationRequest,
  RunnerRegistrationTokenIssueRequest,
  RunnerRegistrationTokenIssueResponse,
  RunnerTaskArtifactUploadRequest,
  RunnerTaskArtifactUploadResponse,
  RunnerTaskEnvelope,
  RunnerTaskRecord,
  RunnerTaskResult,
  UpdateRunnerFleetPolicyInput,
  Scope,
  ScopeType,
  DueScheduleRunSummary,
  SignalEnvelope,
  SubmitProductFeedbackInput,
  SignalTriggerApprovalResponse,
  SignalTriggerActivity,
  SignalTriggerEvaluation,
  SignalTriggerEvaluationResponse,
  SignalTriggerEvaluationStatus,
  SignalTriggerRoutingDecision,
  SignalTriggerRoutingSettings,
  SignalTriggerRule,
  ScheduledRunResult,
  ScheduleFrequency,
  ScheduleTiming,
  UpdateMissionScheduleInput,
  UpdateScopeClassificationInput,
  ValidationMission,
  ValidationSnapshot,
  ValidationRun,
  ValidationStimulus,
  VerificationEvent,
  VerifyAttackPathInput,
  ThreatAdvisory,
  ThreatPackage,
  ThreatValidationPlan,
  ThreatValidationPlanItem,
  ThirdPartyTool,
  ThirdPartyToolActivityEvent,
  ThirdPartyToolCoverageAudit,
  ThirdPartyToolRunnerEligibility,
  ThirdPartyToolRunnerDispatchRequest,
  ThirdPartyToolRunnerDispatchResponse,
  ApplyThirdPartyToolUpdateRequest,
  ThirdPartyToolCandidate,
  ThirdPartyToolCandidateImportRequest,
  ThirdPartyToolCandidateImportResponse,
  ThirdPartyToolCandidateReadiness,
  ThirdPartyToolCandidateReadinessSummary,
  ThirdPartyToolImplementationBundle,
  ThirdPartyToolImplementationWorkOrder,
  ThirdPartyToolPromotionCertification,
  ThirdPartyToolPromotionHandoff,
  ThirdPartyToolPromotionPackage,
  ThirdPartyToolRefreshDueRequest,
  ThirdPartyToolRefreshDueResponse,
  ThirdPartyToolUpstreamVersionCheck,
  ThirdPartyToolUpdateRecommendation,
  AcceptToolLicenseRequest,
  ListToolLicenseAcceptancesQuery,
  ThirdPartyToolDisableRequest,
  ThirdPartyToolEnableRequest,
  ThirdPartyToolInstallRequest,
  ThirdPartyToolInstallPlan,
  ThirdPartyToolLicenseSummary,
  ToolLicenseAcceptance,
  ReviewThirdPartyToolCandidateRequest,
  ToolIntakeManifestRequest,
  ToolIntakeValidationReport,
  ToolInstallJob,
  AppendDesignPartnerSessionNoteInput,
  DesignPartnerReportNote,
  DesignPartnerSessionLearning,
  DesignPartnerSessionNote,
  DesignPartnerWorkspace,
  Tenant,
  UpdateProductExperienceProfileInput,
  TenantApiKey,
  TenantApiKeyCapability,
  TenantApiKeyScope,
  TenantApiKeyWithSecret,
  TenantMember,
  GlobalSearchResponse,
  McpToolInfo,
  McpActivityEntry,
  TenantSafetySettings,
  TenantRequireMfaSettings,
  SetDestructiveValidationInput,
  SetOffensiveValidationInput,
  SetTenantRequireMfaInput,
  CreateTenantApiKeyInput,
  CompleteTenantSsoLoginInput,
  StartTenantSsoLoginInput,
  TenantSsoAuthorizationUrl,
  TenantSsoAuthorizationUrlInput,
  TenantSsoConfig,
  TenantSsoLoginStartResult,
  UpdateTenantSsoConfigInput,
  TenantWebhook,
  TenantWebhookWithSecret,
  WebhookDelivery,
  WebhookEventCatalog,
  WebhookEventType,
  CreateTenantWebhookInput,
  UpdateTenantWebhookInput,
  ActivateKillSwitchInput,
  AgentWorkflowCheckpoint,
  AgentBehaviorAnalysis,
  AgentWorkflowDefinition,
  AgentWorkflowEvent,
  AgentWorkflowRun,
  AgentWorkflowRunDetail,
  AgentWorkflowQualityEvaluation,
  AgentWorkflowVariableAnalysis,
  AgentExchangeObject,
  AgentDidTrustProfile,
  AgentProtocolEndpoint,
  AgentSignedReceipt,
  AgentVerifiableCredential,
  A2ATckRun,
  AppendAgentWorkflowEventInput,
  CreateAgentWorkflowCheckpointInput,
  CreateAgentWorkflowDefinitionInput,
  CreateAgentWorkflowRunInput,
  CreateAgentExchangeObjectInput,
  CreateAgentDidTrustProfileInput,
  ContextBundle,
  CreateContextBundleInput,
  CreateModelPolicyProfileInput,
  CreateModelProviderInput,
  CreateModelSessionInput,
  CreateModelSessionTurnInput,
  CreateModelToolRequestInput,
  ReplayAgentWorkflowInput,
  RegisterAgentProtocolEndpointInput,
  RefreshAgentDidTrustProfileInput,
  RevokeAgentDidTrustProfileInput,
  ReviewAgentProtocolEndpointInput,
  UpdateAgentExchangeObjectStateInput,
  VerifyAgentSignedReceiptInput,
  VerifyAgentVerifiableCredentialInput,
  VerifyConfidentialAttestationInput,
  CreateConfidentialAttestationChallengeInput,
  ConfidentialAttestationChallenge,
  ConfidentialAttestation,
  CreateTeeAssuranceRequirementInput,
  EvaluateTeeAssuranceInput,
  RevokeTeeAssuranceInput,
  TeeAssuranceRequirement,
  TeeAssuranceWorkspace,
  CreateVeraisonAttestationSessionInput,
  DiscoverAgentProtocolEndpointResult,
  RunA2ATckInput,
  VeraisonAttestationSession,
  VerifyVeraisonAttestationInput,
  VerifyVeraisonAttestationResult,
  KillSwitchResult,
  ModelSessionTurnAccepted,
  ModelUsageEvent,
  ModelGatewayAuditEvent,
  ModelGatewayFinOpsSummary,
  ModelPolicyProfile,
  ModelProvider,
  ModelProviderConnectionTestResult,
  ModelSession,
  ModelTool,
  ModelToolIntervention,
  ModelToolInterventionDecisionResult,
  ModelToolInterventionQueue,
  ModelToolRequest,
  DecideModelToolInterventionInput,
  InspectModelToolInterventionInput,
  IssueModelToolInterventionInput,
  IssueModelToolInterventionResult,
  UpdateModelPolicyProfileInput,
  UpdateModelProviderInput,
  UpdateModelToolInput,
  UpdateModelGatewayFinOpsInput,
  TenantDesignPartnerSettings,
  TenantOperationalMetrics,
  LocalizationFormatPreview,
  PreviewTenantLocalizationInput,
  TenantLocalization,
  TenantLocalizationWorkspace,
  TenantReportBranding,
  TrustSafetySummary,
  TripwireConfig,
  ValidatedFinding,
  ValidatedFindingFilter,
  TransitionFindingInput,
  ValidatedFindingMissingSignalImpact,
  ValidatedFindingStatus,
  ExploitabilityState,
  Severity,
  User,
  BillingPackage,
  BillingUsage,
  CancelTenantTrialInput,
  UpdateTenantLocalizationInput,
  ComplianceFrameworkKey,
  ComplianceGovernanceChange,
  ComplianceGovernanceInventory,
  UpdateComplianceControlGovernanceInput,
  ConvertTenantTrialInput,
  StartTenantTrialInput,
  TenantTrial,
  TenantIsolationProof,
  UsageMeter,
  UsageMeterDefinition,
  UsageMeterName,
  AwsMarketplaceMeteringSyncResult,
  AwsMarketplaceRegistrationResolution,
  AwsMarketplaceStatus,
  ClaimAwsMarketplaceRegistrationInput
} from "@periscan/shared";

export { buildScheduleDiff } from "./schedule-diff.js";

import {
  createBullMqWebhookDeliveryQueue,
  emitWebhookEvent,
  type WebhookDeliveryQueue
} from "@periscan/webhooks";

import {
  createBullMqMissionQueue,
  type MissionQueue
} from "./mission-queue.js";
import {
  createBullMqModelGatewayTurnQueue,
  type ModelGatewayTurnQueue
} from "./model-gateway-queue.js";
import {
  serializeAdvisoryImpactAssessment,
  serializeAdvisoryReadinessReport,
  serializeMissingSignal,
  serializeThreatAdvisory,
  serializeThreatPackage,
  serializeThreatValidationPlan,
  // Used only in a `typeof` type position (Parameters<typeof ...>).
  type serializeThreatValidationPlanItem
} from "./serializers/threat-center.js";
import {
  serializeDesignPartnerReportNote,
  serializeDesignPartnerSessionNote,
  serializeSignalTriggerRoutingSettings,
  serializeTenant,
  serializeTenantDesignPartnerSettings,
  serializeTenantReportBranding
} from "./serializers/tenant.js";
import {
  serializePolicyDecision,
  serializeValidationMission,
  serializeValidationRun
} from "./serializers/entities.js";
import { createRegistryServices } from "./services/registry.js";
import { withPathEdgeReceiptLock } from "./path-receipt-lock.js";
import { createFindingsServices } from "./services/findings.js";
import { createScheduleServices } from "./services/schedules.js";
import { createScopeServices } from "./services/scopes.js";
import { createIntegrationServices } from "./services/integrations.js";
import { createSsoServices } from "./services/sso.js";
import { createRunnerServices } from "./services/runner.js";
import { createRunnerFleetServices } from "./services/runner-fleet.js";
import { createWebhookServices } from "./services/webhooks.js";
import { createAuthServices } from "./services/auth.js";
import { createSnapshotReportEvidenceServices } from "./services/snapshots.js";
import { createModelGatewayServices } from "./services/model-gateway.js";
import { createAgentWorkflowServices } from "./services/agent-workflows.js";
import { createAgentBehaviorServices } from "./services/agent-behavior.js";
import { createAgentTrustServices } from "./services/agent-trust.js";
import { createExtensionServices } from "./services/extensions.js";
import { createSubscriptionServices } from "./services/subscriptions.js";
import { createLocalizationServices } from "./services/localization.js";
import { createBusinessImpactServices } from "./services/business-impact.js";
import { createAsyncOperationsServices } from "./services/async-operations.js";
import {
  AwsSdkMarketplaceProvider,
  awsMarketplaceConfigFromEnv,
  createAwsMarketplaceServices,
  type AwsMarketplaceConfig,
  type AwsMarketplaceProvider
} from "./services/aws-marketplace.js";
import { createModelFinOpsServices } from "./services/model-finops.js";
import { createControlAiServices } from "./services/control-ai.js";
import { createControlStimulusServices } from "./services/control-stimuli.js";
import {
  decryptIntegrationConfig,
  integrationSecretFieldKeys
} from "./integration-credentials.js";
import { createValidationServices } from "./services/validation.js";
import { createEngagementServices } from "./services/engagements.js";
import { createEngagementCollaborationServices } from "./services/engagement-collaboration.js";
import { createScenarioServices } from "./services/scenarios.js";
import { createHybridExecutionCompilerServices } from "./services/hybrid-execution-compiler.js";
import type {
  CompileScenarioInput,
  CompileScenarioResponse,
  CreateEngagementCollaborationEventInput,
  EngagementCollaborationSnapshot,
  EngagementResult,
  EngagementRunRequest,
  ExecuteScenarioInput,
  InitializeEngagementWorkspaceInput,
  ScenarioBundle,
  ScenarioExecutionResult,
  StopScenarioFeedbackInput,
  UpsertEngagementCollaboratorInput
} from "@periscan/shared";
import { createRemediationServices } from "./services/remediation.js";
import { createRemediationActionServices } from "./services/remediation-actions.js";
import { createInfrastructureChangeServices } from "./services/infrastructure-changes.js";
import { createNonHumanIdentityServices } from "./services/non-human-identities.js";
import { createTrialServices } from "./services/trials.js";
import { createComplianceGovernanceServices } from "./services/compliance-governance.js";
import { createTenantIsolationProofServices } from "./services/tenant-isolation-proof.js";
import { createDataFabricServices } from "./services/data-fabric.js";
import {
  simulateFixWhatIf,
  getOneClickPlaybooks,
  createRemediationTripwire,
  computeRemediationTrends
} from "./services/remediation.js";
import { createSuperFeedServices } from "./services/super-feed.js";
import { createThreatCenterServices } from "./services/threat-center.js";
import { createMcpServices } from "./services/mcp.js";
import { createSearchServices } from "./services/search.js";
import { createSignalOperatorServices } from "./services/signal-triggers.js";
import { createTenantServices } from "./services/tenant.js";
import { createThirdPartyToolServices } from "./services/third-party-tools.js";
import { createEmailTransportFromEnv, type EmailTransport } from "./email.js";

export interface SessionClaims {
  userId: string;
  defaultTenantId: string;
  authMethod?: "api_key" | "password" | "sso" | "system";
  // Incremented for revocable password/SSO cookies. API keys and system jobs do
  // not use this field and keep their existing authentication lifecycle.
  sessionVersion?: number;
}

export interface AuthenticatedContext {
  membership: Membership;
  session: SessionClaims;
  tenant: Tenant;
  user: User;
  /**
   * Present only for API-key authentication. Raw scopes stored on the key
   * (coarse + fine-grained). Used by requireApiKeyCapability for least-privilege
   * enforcement beyond role mapping (P20-17). Session users leave this undefined
   * so capability checks no-op (role gates remain authoritative).
   */
  apiKeyScopes?: TenantApiKeyScope[];
}

export interface SignupInput {
  dataRegion?: string;
  email: string;
  name: string;
  password: string;
  tenantName: string;
  tenantType?: "Organization" | "MSSP";
}

export interface LoginInput {
  email: string;
  password: string;
  // Optional second factor, required only when the user has activated MFA.
  // Either a TOTP code or a single-use recovery code may be supplied.
  totpCode?: string;
  recoveryCode?: string;
}

export interface PasswordResetRequestInput {
  email: string;
}

export interface PasswordResetConfirmInput {
  token: string;
  password: string;
}

export interface PasswordResetConfirmResult {
  ok: boolean;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  totpCode?: string;
}

export interface SessionRotationResult {
  changed: boolean;
  session: SessionClaims;
}

export interface AcceptInviteInput {
  token: string;
  password: string;
}

export interface VerifyEmailInput {
  token: string;
}

export interface MfaEnrollResult {
  // The base32 secret + otpauth URI for the user to add to an authenticator app.
  // Returned once at enrollment; MFA is not active until a code is verified.
  secret: string;
  otpauthUri: string;
}

export interface MfaVerifyInput {
  code: string;
}

export interface MfaVerifyResult {
  // True once a valid code has activated MFA for this user.
  activated: boolean;
  mfaEnabledAt: string;
  // Plaintext single-use recovery codes — returned ONCE, only on first
  // activation (empty when re-verifying an already-active enrollment).
  recoveryCodes: string[];
}

export interface RegenerateMfaRecoveryCodesInput {
  // Re-auth: the caller's current password OR a current TOTP code.
  password?: string;
  totpCode?: string;
}

export interface RegenerateMfaRecoveryCodesResult {
  // Fresh plaintext recovery codes — returned ONCE; the previous set is voided.
  recoveryCodes: string[];
}

export interface DisableMfaInput {
  // Re-auth: the caller's current password OR a current TOTP code.
  password?: string;
  totpCode?: string;
}

export interface DisableMfaResult {
  disabled: boolean;
}

export interface InviteInput {
  email: string;
  name: string;
  role: MembershipRole;
}

export interface CreateIntegrationInput {
  authType?: string;
  config?: Record<string, unknown>;
  connectorKey: string;
  mockMode?: boolean;
}

export interface VerifyScopeInput {
  devModeManual: boolean;
  operatorAttestation?: boolean;
}

export interface CreateMissionInput {
  missionType: ValidationMission["missionType"];
  policyDecisionId?: string;
  policyProfile?: string;
  safetyLevel: ValidationMission["safetyLevel"];
  scopeId: string;
  scopeIds?: string[];
}

export interface StartMissionInput {
  moduleIds: string[];
  runnerId?: string | null;
  target?: Record<string, unknown>;
}

export type {
  CreateRemediationInput,
  CreateRemediationTicketInput
} from "@periscan/shared";

export interface CreateSnapshotInput {
  audience?: string;
  maxTopItems?: number;
  policyDecisionId?: string;
  scopeId?: string;
}

export type CreateScheduleInput = CreateMissionScheduleInput;
export type UpdateScheduleInput = UpdateMissionScheduleInput;

export type RunnerRegistrationTokenInput = RunnerRegistrationTokenIssueRequest;

export interface RunnerRegisterResult {
  credentials: RunnerIssuedCredential;
  runner: RunnerRecord;
}

export type RunnerCredentialRotationInput = RunnerCredentialRotationRequest;

export interface RunnerPollResult {
  controlStateChangedAt: string | null;
  killSwitchActive: boolean;
  nextPollAfterSeconds: number;
  runnerRevoked: boolean;
  tasks: RunnerTaskEnvelope[];
}

export interface RunnerTaskCreationResult {
  envelope: RunnerTaskEnvelope;
  mission: ValidationMission;
  run: ValidationRun;
  task: RunnerTaskRecord;
}

export interface RunnerTaskResultReceipt {
  evidence: EvidenceArtifact[];
  run: ValidationRun;
  task: RunnerTaskRecord;
}

export type RunnerTaskArtifactUploadInput = RunnerTaskArtifactUploadRequest;

export interface CreateAIApplicationInput {
  appType: AIApplication["appType"];
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
}

export interface ValidateAIApplicationInput {
  corpusVersion?: string;
  executionMode?: "Fixture" | "LiveSafe" | "LiveSuite";
  fixtureOutcome?:
    | "Passed"
    | "Failed"
    | "Inconclusive"
    | "LeakageObserved"
    | "UnauthorizedRetrievalObserved"
    | "UnsafeToolCallAttempted"
    | "UnsafeToolCallBlocked"
    | "GuardrailBypassed"
    | "GuardrailHeld"
    | "SyntheticPoisoningObserved"
    | "ExtractionResistanceHeld"
    | "ExtractionResistanceWeak"
    | "Regressed";
  validationCategory?:
    | "PromptInjection"
    | "IndirectPromptInjection"
    | "JailbreakGuardrailBypass"
    | "RAGAuthorization"
    | "SensitiveDataLeakage"
    | "UnsafeToolInvocation"
    | "AgentOverPermissioning"
    | "SystemPromptExposure"
    | "CrossTenantRetrieval"
    | "GuardrailDrift"
    | "RateAbuseControls"
    | "RAGPoisoningResistance"
    | "ModelExtractionResistance"
    | "AISecurityReviewEvidence";
  harness?: "periscan" | "promptfoo" | "pyrit" | "garak";
  maxRequests?: number;
  maxResponseBytes?: number;
  safeTestCases?: Array<{
    category:
      | "PromptInjection"
      | "IndirectPromptInjection"
      | "JailbreakGuardrailBypass"
      | "RAGAuthorization"
      | "SensitiveDataLeakage"
      | "UnsafeToolInvocation"
      | "AgentOverPermissioning"
      | "SystemPromptExposure"
      | "CrossTenantRetrieval"
      | "GuardrailDrift"
      | "RateAbuseControls"
      | "RAGPoisoningResistance"
      | "ModelExtractionResistance"
      | "AISecurityReviewEvidence";
    input: string;
    testCaseId: string;
  }>;
  timeoutSeconds?: number;
}

export interface SetAIValidationKillSwitchInput {
  enabled: boolean;
  reason: string;
}

export interface CreateControlSourceInput {
  controlType: ControlSource["controlType"];
  expectedBehaviors: ControlSource["expectedBehaviors"];
  integrationId: string;
  provider: string;
}

export interface UpdateControlSourceInput {
  expectedBehaviors: ControlSource["expectedBehaviors"];
}

export interface ValidateControlSourceInput {
  dryRun?: boolean;
  executionMode?: "DryRun" | "LiveRunner";
  fixtureOutcome?:
    | "Detected"
    | "Blocked"
    | "Logged"
    | "Alerted"
    | "Routed"
    | "Missed"
    | "NoEvidence"
    | "NeedsTuning";
  runnerId?: string;
  techniqueId?: string;
}

/**
 * Wave B: signed DRV benign-marker emit→observe product path.
 * Accepts allowlisted marker + optional mock SIEM events or connector observe.
 */
export interface DetectionMarkerProofInput {
  expectedRule?: string;
  fixtureMode?: boolean;
  /**
   * When true (default in tests/dev), include mock SIEM events containing the
   * marker so the observe half can close. Live paths should pass false and
   * rely on connector observe / supplied observedEvents.
   */
  injectMockObservation?: boolean;
  markerId?: string;
  observedEvents?: Array<string | Record<string, unknown>>;
  performEmit?: boolean;
  platform?: "macOS" | "Linux";
  platformAnalytics?: "macOS" | "Linux";
  scopeId?: string;
  techniqueId?: string;
}

/**
 * Phase C: bounded DNS-exfil detection canary product path.
 * Allowlisted label only — never real data exfiltration.
 */
export interface DnsExfilCanaryProofInput {
  fixtureMode?: boolean;
  injectMockObservation?: boolean;
  markerId?: string;
  observedEvents?: Array<string | Record<string, unknown>>;
  scopeId?: string;
  hostname?: string;
  techniqueId?: string;
}

export interface CreateReportInput {
  audience?: string;
  maxTopItems?: number;
  packType?: EvidencePack["packType"];
  snapshotId?: string;
  title?: string;
}

export interface ExportReportInput {
  format?: ReportExportFormat;
}

export interface GenerateEvidenceSummaryInput {
  evidenceIds: string[];
  useCase: EvidenceSummaryUseCase;
}

export interface OperatorRecommendationApprovalResult {
  decision: PolicyDecision;
  mission: ValidationMission;
  recommendation: OperatorRecommendation;
}

/** Dynamic Attack Paths (id 23): human-gated next mission for a single path. */
export interface DynamicPathMissionApprovalResult {
  decision: PolicyDecision;
  mission: ValidationMission;
  /** Always false — approval creates Draft only; never auto-queues. */
  queued: false;
  recommendation: DynamicPathMissionRecommendation;
}

export interface CreateClientTenantInput {
  billingAccountId?: string | null;
  clientAdminEmail?: string | null;
  clientAdminName?: string | null;
  dataRegion?: string | null;
  name: string;
}

export interface UpdateTenantBrandingInput {
  logoUrl?: string | null;
  organizationName?: string | null;
  primaryColor?: string | null;
  reportFooter?: string | null;
  supportEmail?: string | null;
  whiteLabelEnabled: boolean;
}

export interface UpdateDesignPartnerSettingsInput {
  enabled: boolean;
}

export interface UpdateSignalTriggerRoutingSettingsInput {
  defaultOwnerRole?: MembershipRole;
  enabled?: boolean;
  notificationIntegrationIds?: string[];
  workflowDestinationIntegrationIds?: string[];
}

export interface UpdateReportAnalystNoteInput {
  authorLabel?: string;
  body: string;
  title?: string | null;
}

export interface ListAuditEventsInput {
  action?: AuditEventFilter["action"];
  actorType?: string;
  category?: string;
  entityId?: string;
  entityType?: AuditEvent["entityType"];
  from?: string;
  limit: number;
  offset?: number;
  search?: string;
  to?: string;
  userId?: string;
}

export interface ListPolicyDecisionsInput {
  limit: number;
  missionType?: PolicyDecision["missionType"];
  outcome?: PolicyDecision["outcome"];
  scopeId?: string;
}

// Decide whether a (scope/type/safety-bound) policy decision may start its
// mission. The policy engine couples outcome+approvalState at evaluation time
// ("Allowed"/"Approved" or "RequiresApproval"/"Pending"), but a decision can
// ALSO reach approval out-of-band: an admin calling approvePolicyDecision flips
// approvalState to "Approved" while leaving outcome "RequiresApproval". That
// admin grant is authoritative (admin-only, audited) and must be honored —
// otherwise the approval control is decorative and the mission stays stuck in
// RequiresApproval forever. Conversely, any non-Allowed/unapproved decision is
// never startable, so denial remains fail-closed.
//
// A decision also carries an optional expiresAt that is serialized into the
// public DTO, so clients see a time-boxed authorization. An expired
// Allowed/Approved decision is no longer current and must NOT start — the
// operator has to obtain a fresh decision. The gate is the single point that
// turns a stored decision into a start/block verdict, so it is the one place
// expiry can be honored; leaving it unchecked made expiresAt a decorative
// expiry (serialized as if approvals were time-boxed while the gate ran an
// expired authorization anyway). Expiry is fail-closed to "denied" and checked
// right after the rejection short-circuit so every block reason is resolved
// before any "start". A null expiresAt means "no expiry recorded" and never
// blocks, so decisions written without one are unaffected.
export function evaluatePolicyDecisionGate(decision: {
  approvalState: PolicyDecision["approvalState"];
  outcome: PolicyDecision["outcome"];
  expiresAt?: Date | string | null;
}): "start" | "pending" | "denied" {
  // An explicit admin rejection is authoritative regardless of the original
  // evaluation outcome. denyPolicyDecision sets approvalState "Rejected" but
  // leaves outcome "RequiresApproval", so gating on outcome alone would wrongly
  // treat a denied decision as still-pending/re-approvable.
  if (decision.approvalState === "Rejected") {
    return "denied";
  }
  // A lapsed authorization is no longer current; fail closed regardless of
  // outcome (RequiresApproval cannot be re-satisfied for an expired
  // Allowed/NotRequired decision, so "denied" is the only valid verdict here).
  if (isPolicyDecisionExpired(decision.expiresAt)) {
    return "denied";
  }
  if (decision.outcome === "Allowed") {
    return "start";
  }
  // approvePolicyDecision flips approvalState→Approved while leaving outcome
  // "RequiresApproval"; that admin grant must be honored or the approval is
  // decorative and the mission stays stuck in RequiresApproval forever.
  if (
    decision.outcome === "RequiresApproval" &&
    decision.approvalState === "Approved"
  ) {
    return "start";
  }
  if (decision.outcome === "RequiresApproval") {
    return "pending";
  }
  return "denied";
}

export interface ClientTenantResult {
  clientAdminMembership: Membership | null;
  clientAdminUser: User | null;
  msspMembership: Membership;
  tenant: Tenant;
}

export interface PolicyPreviewInput {
  executionEnvironment: PolicyDecision["executionEnvironment"];
  explicitMissionApproval?: boolean;
  adminApproval?: boolean;
  missionType: PolicyDecision["missionType"];
  requestedAction: PolicyRequestedAction;
  safetyLevel: PolicyDecision["safetyLevel"];
  target: PolicyDecision["target"];
  timeWindowApproved?: boolean;
}

export interface AuthResult {
  membership: Membership;
  session: SessionClaims;
  tenant: Tenant;
  user: User;
}

export interface IntegrationHealthResult {
  health: ConnectorHealth;
  integration: Integration;
  manifest: ConnectorManifest;
}

export interface IntegrationSyncResult extends IntegrationHealthResult {
  assetCount: number;
  signalCount: number;
  signals: SignalEnvelope[];
}

export interface ThreatAdvisoryDetail {
  advisory: ThreatAdvisory;
  exposure?: AdvisoryExposure | null;
  impactAssessment: AdvisoryImpactAssessment;
  missingSignals: MissingSignal[];
  package: ThreatPackage;
  readinessReport: AdvisoryReadinessReport;
  rawEvidenceId: string;
  validationPlan: ThreatValidationPlan;
}

export interface MissionStartResult {
  jobsQueued: number;
  mission: ValidationMission;
  runs: ValidationRun[];
}

export type { RemediationTicketResult } from "@periscan/shared";

export interface RemediationVerificationResult {
  attackPath: AttackPathAssessment | null;
  mission: ValidationMission;
  remediation: RemediationTask;
  run: ValidationRun;
  verificationEvent: VerificationEvent;
}

/**
 * Closed-loop planner → mark-ready → revalidate result.
 * `actionApplied` is always false: this path never pushes customer config
 * (WAF/SG/firewall). Prefer product language "auto-revalidate".
 */
export interface AutoRevalidateResult {
  actionApplied: false;
  autoExecuted: boolean;
  closedLoop: string;
  plan: PrescriptivePlan;
  verification: RemediationVerificationResult;
}

/** @deprecated Prefer AutoRevalidateResult — legacy name implied config push. */
export type AutoMitigationResult = AutoRevalidateResult;

export interface RemediationPlaybookInput {
  remediationId: string;
  recommendedAction?: string | null;
  technicalSteps?: string[] | null;
}

export interface RemediationTrendInput {
  remediationId: string;
  riskDelta?: number;
  verificationOutcome?: string;
}

type EvidencePackWithModelSession = EvidencePack & {
  modelSessionId?: string | null;
};

interface ModelGatewayTurnReadModel {
  findMany(args: {
    orderBy: { createdAt: "desc" };
    select: { output: true; turnId: true };
    take: number;
    where: { modelSessionId: string };
  }): Promise<Array<{ output: unknown; turnId: string }>>;
}

type PrismaWithOptionalModelGatewayTurn = PrismaClient & {
  modelGatewayTurn?: ModelGatewayTurnReadModel;
};

export interface EvidenceDownloadResult {
  artifact: EvidenceArtifact;
  computedSha256: string;
  content: string;
  integrityVerified: boolean;
  recordedSha256: string;
}

export interface ReportExportResult {
  artifact: EvidenceArtifact;
  content: string;
  contentType: string;
  filename: string;
  format: ReportExportFormat;
  html?: string;
  report: EvidencePack;
}

export interface PublicSharedReportResult {
  html: string;
  report: EvidencePack;
}

export interface InlineValidationResult {
  attackTechniques: AttackTechnique[];
  decision: PolicyDecision;
  evidence: EvidenceArtifact[];
  mission: ValidationMission;
  run: ValidationRun;
  signals: SignalEnvelope[];
}

export const SIGNAL_TRIGGER_RULES: SignalTriggerRule[] = [
  {
    description:
      "Plans passive exposure validation when CVE or dependency advisory signals appear in tenant evidence.",
    enabled: true,
    name: "CVE advisory trigger",
    recommendedMissionType: "ExposureValidation",
    requiredIntegrationCategories: ["Code"],
    requiredScopeTypes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategories: ["Exposure"],
    signalSubcategories: [
      "DependencyAdvisory",
      "CloudMisconfiguration",
      "ExternalExposure"
    ],
    triggerId: "trigger.cve",
    triggerType: "CVE"
  },
  {
    description:
      "Plans validation review when new asset, cloud, or repository signals change the tenant attack surface.",
    enabled: true,
    name: "Asset change trigger",
    recommendedMissionType: "ValidationSnapshot",
    requiredIntegrationCategories: [],
    requiredScopeTypes: ["Domain", "CloudAccount", "Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategories: ["Asset", "Repository", "Cloud"],
    signalSubcategories: [
      "CloudAccount",
      "CloudAsset",
      "Repository",
      "ServiceObservation",
      "StorageBucket"
    ],
    triggerId: "trigger.asset_change",
    triggerType: "AssetChange"
  },
  {
    description:
      "Plans validation review when policy decisions change validation eligibility or approval state.",
    enabled: true,
    name: "Policy change trigger",
    recommendedMissionType: "ValidationSnapshot",
    requiredIntegrationCategories: [],
    requiredScopeTypes: ["Domain"],
    safetyLevel: "PassiveReadOnly",
    signalCategories: ["Audit"],
    signalSubcategories: ["PolicyDecision"],
    triggerId: "trigger.policy_change",
    triggerType: "PolicyChange"
  },
  {
    description:
      "Plans control validation review when telemetry indicates missed, absent, or weak detection evidence.",
    enabled: true,
    name: "Missed detection trigger",
    recommendedMissionType: "ControlValidation",
    requiredIntegrationCategories: ["SecurityControl"],
    requiredScopeTypes: ["ControlSource"],
    safetyLevel: "BASLite",
    signalCategories: ["ControlObservation"],
    signalSubcategories: ["Missed", "NeedsTuning", "NoEvidence", "Logged"],
    triggerId: "trigger.missed_detection",
    triggerType: "MissedDetection"
  }
];

export type SignalTriggerEvaluationState = {
  auditEvents: AuditEvent[];
  connectedIntegrationCategories: Set<Integration["category"]>;
  controlSourceCount: number;
  evaluatedAt: string;
  hasActiveRunner: boolean;
  hasAnyIntegration: boolean;
  hasVerifiedScope: boolean;
  signals: SignalEnvelope[];
  tenantId: string;
};

export function uniqueSignalTriggerValues(
  values: Array<string | null | undefined>
) {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value)))
  ];
}

function signalText(signal: SignalEnvelope) {
  return [
    signal.sourceType,
    signal.sourceVendor,
    signal.signalCategory,
    signal.signalSubcategory,
    signal.freshness,
    signal.rawPayloadPointer
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function auditActionText(event: AuditEvent) {
  return event.action.replace(/[_-]/g, ".").toLowerCase();
}

function matchedSignalsForTrigger(
  rule: SignalTriggerRule,
  signals: SignalEnvelope[]
) {
  if (rule.triggerType === "CVE") {
    return signals.filter((signal) => {
      const text = signalText(signal);

      return (
        signal.signalCategory === "Exposure" &&
        (rule.signalSubcategories.includes(signal.signalSubcategory ?? "") ||
          /\b(cve|advisory|vulnerab)/i.test(text))
      );
    });
  }

  if (rule.triggerType === "AssetChange") {
    return signals.filter(
      (signal) =>
        signal.signalCategory === "Asset" ||
        signal.signalCategory === "Repository" ||
        signal.signalCategory === "Cloud"
    );
  }

  if (rule.triggerType === "MissedDetection") {
    return signals.filter(
      (signal) =>
        signal.signalCategory === "ControlObservation" &&
        (rule.signalSubcategories.includes(signal.signalSubcategory ?? "") ||
          /\b(missed|noevidence|no evidence|needs tuning|logged)\b/i.test(
            signalText(signal)
          ))
    );
  }

  return [];
}

function matchedAuditEventsForTrigger(
  rule: SignalTriggerRule,
  auditEvents: AuditEvent[]
) {
  if (rule.triggerType !== "PolicyChange") {
    return [];
  }

  return auditEvents.filter(
    (event) => auditActionText(event) === "policy.decision"
  );
}

function triggerModulesForRule(rule: SignalTriggerRule) {
  if (rule.triggerType === "CVE") {
    return ["osv.repo_dependency_scan", "trivy.repo_dependency_scan"];
  }

  if (rule.triggerType === "AssetChange") {
    return [
      "mock.external_exposure",
      "nuclei.external_exposure_safe",
      "prowler.aws_posture"
    ];
  }

  if (rule.triggerType === "PolicyChange") {
    return ["mock.external_exposure", "mock.cloud_posture"];
  }

  if (rule.triggerType === "MissedDetection") {
    return ["atomic.control_validation_safe"];
  }

  return [];
}

function prerequisiteStatusForTrigger(
  rule: SignalTriggerRule,
  state: SignalTriggerEvaluationState
): {
  missingPrerequisites: string[];
  status: SignalTriggerEvaluationStatus | null;
} {
  if (!state.hasVerifiedScope) {
    return {
      missingPrerequisites: ["verified_scope"],
      status: "RequiresVerifiedScope"
    };
  }

  const missingPrerequisites: string[] = [];

  if (rule.triggerType === "CVE") {
    if (!state.connectedIntegrationCategories.has("Code")) {
      missingPrerequisites.push("integration:Code");
    }
  } else if (rule.triggerType === "AssetChange") {
    if (!state.hasAnyIntegration) {
      missingPrerequisites.push("integration:any_signal_source");
    }
  } else if (rule.triggerType === "MissedDetection") {
    if (
      !state.connectedIntegrationCategories.has("SecurityControl") &&
      state.controlSourceCount === 0
    ) {
      missingPrerequisites.push("integration:SecurityControls");
    }

    if (!state.hasActiveRunner) {
      missingPrerequisites.push("internal_runner");
    }
  }

  if (missingPrerequisites.some((item) => item.startsWith("integration:"))) {
    return {
      missingPrerequisites,
      status: "RequiresIntegration"
    };
  }

  if (missingPrerequisites.includes("internal_runner")) {
    return {
      missingPrerequisites,
      status: "RequiresInternalRunner"
    };
  }

  return {
    missingPrerequisites,
    status: null
  };
}

export function buildSignalTriggerEvaluationResponse(
  state: SignalTriggerEvaluationState
): SignalTriggerEvaluationResponse {
  const evaluations = SIGNAL_TRIGGER_RULES.map((rule) => {
    const matchedSignals = matchedSignalsForTrigger(rule, state.signals);
    const matchedAuditEvents = matchedAuditEventsForTrigger(
      rule,
      state.auditEvents
    );
    const evidenceIds = uniqueSignalTriggerValues(
      matchedSignals.flatMap((signal) => [
        ...signal.evidenceIds,
        ...signal.relatedEvidenceIds
      ])
    );
    const prerequisite = prerequisiteStatusForTrigger(rule, state);
    const hasMatches =
      matchedSignals.length > 0 || matchedAuditEvents.length > 0;
    const status: SignalTriggerEvaluationStatus =
      prerequisite.status ?? (hasMatches ? "NeedsApproval" : "NotConfigured");
    const reason =
      status === "NeedsApproval"
        ? `${rule.name} matched tenant evidence and requires policy approval before any validation mission can run.`
        : status === "NotConfigured"
          ? `${rule.name} has no matching tenant signal yet.`
          : `${rule.name} cannot recommend execution until ${prerequisite.missingPrerequisites.join(", ")} is configured.`;

    return {
      evidenceIds,
      matchedAuditEventIds: matchedAuditEvents.map(
        (event) => event.auditEventId
      ),
      matchedSignalIds: matchedSignals.map((signal) => signal.signalId),
      missingPrerequisites: prerequisite.missingPrerequisites,
      reason,
      recommendedMissionType: rule.recommendedMissionType,
      recommendedModuleIds: triggerModulesForRule(rule),
      requiresApproval: status === "NeedsApproval",
      status,
      triggerId: rule.triggerId,
      triggerType: rule.triggerType
    } satisfies SignalTriggerEvaluation;
  });
  const activity = evaluations
    .filter(
      (evaluation) =>
        evaluation.matchedSignalIds.length > 0 ||
        evaluation.matchedAuditEventIds.length > 0
    )
    .map((evaluation) => {
      const rule = SIGNAL_TRIGGER_RULES.find(
        (candidate) => candidate.triggerId === evaluation.triggerId
      )!;

      return {
        activityId: `${evaluation.triggerId}:${
          evaluation.matchedSignalIds[0] ??
          evaluation.matchedAuditEventIds[0] ??
          "pending"
        }`,
        auditEventIds: evaluation.matchedAuditEventIds,
        createdAt: state.evaluatedAt,
        evidenceIds: evaluation.evidenceIds,
        recommendedMissionType: evaluation.recommendedMissionType,
        signalIds: evaluation.matchedSignalIds,
        status: evaluation.status,
        summary: evaluation.reason,
        title: rule.name,
        triggerId: evaluation.triggerId,
        triggerType: evaluation.triggerType
      } satisfies SignalTriggerActivity;
    });
  const summary = evaluations.reduce(
    (counts, evaluation) => {
      if (evaluation.status === "NeedsApproval") {
        counts.needsApproval += 1;
      } else if (evaluation.status === "NotConfigured") {
        counts.notConfigured += 1;
      } else if (evaluation.status === "RequiresIntegration") {
        counts.requiresIntegration += 1;
      } else if (evaluation.status === "RequiresInternalRunner") {
        counts.requiresInternalRunner += 1;
      } else if (evaluation.status === "RequiresVerifiedScope") {
        counts.requiresVerifiedScope += 1;
      }

      return counts;
    },
    {
      needsApproval: 0,
      notConfigured: 0,
      requiresIntegration: 0,
      requiresInternalRunner: 0,
      requiresVerifiedScope: 0
    }
  );

  return {
    activity,
    evaluatedAt: state.evaluatedAt,
    evaluations,
    rules: SIGNAL_TRIGGER_RULES,
    summary,
    tenantId: state.tenantId
  };
}

const CONTROL_RULE_COVERAGE_STALE_MS = 30 * 24 * 60 * 60 * 1000;
const DETECTION_RULE_BEHAVIORS = new Set<DetectionRuleBehavior>([
  "Alerted",
  "Blocked",
  "Detected",
  "Logged",
  "Missed",
  "NeedsTuning",
  "NoEvidence",
  "Routed"
]);

export type ControlRuleCoverageInput = {
  controlSourceId?: string | null;
  controlSources: ControlSource[];
  generatedAt: string;
  signals: SignalEnvelope[];
  tenantId: string;
};

function isDetectionRuleBehavior(
  value: string | null | undefined
): value is DetectionRuleBehavior {
  return Boolean(
    value && DETECTION_RULE_BEHAVIORS.has(value as DetectionRuleBehavior)
  );
}

function latestControlSignal(signals: SignalEnvelope[]) {
  return signals.sort((left, right) =>
    right.timestampObserved.localeCompare(left.timestampObserved)
  )[0];
}

function ruleCoverageStatus(input: {
  expectedBehaviors: DetectionRuleBehavior[];
  generatedAt: string;
  latest: SignalEnvelope | undefined;
}): DetectionRuleCoverageStatus {
  if (!input.latest) {
    return "NotTested";
  }

  const observedAt = new Date(input.latest.timestampObserved).getTime();
  const generatedAt = new Date(input.generatedAt).getTime();

  if (
    Number.isFinite(observedAt) &&
    Number.isFinite(generatedAt) &&
    generatedAt - observedAt > CONTROL_RULE_COVERAGE_STALE_MS
  ) {
    return "Stale";
  }

  if (input.latest.signalSubcategory === "Blocked") {
    return "Blocked";
  }

  if (
    input.latest.signalSubcategory === "Detected" ||
    input.latest.signalSubcategory === "Alerted" ||
    input.latest.signalSubcategory === "Routed"
  ) {
    if (
      input.expectedBehaviors.length > 0 &&
      input.expectedBehaviors.every((behavior) => behavior === "Blocked")
    ) {
      return "NeedsTuning";
    }
    return "Covered";
  }

  if (input.latest.signalSubcategory === "Logged") {
    return input.expectedBehaviors.every((behavior) => behavior === "Logged")
      ? "Covered"
      : "LoggedOnly";
  }

  if (input.latest.signalSubcategory === "Missed") {
    return "Missed";
  }

  if (input.latest.signalSubcategory === "NoEvidence") {
    return "NoEvidence";
  }

  if (input.latest.signalSubcategory === "NeedsTuning") {
    return "NeedsTuning";
  }

  // Vendor connectors emit descriptive subcategories (e.g. "EndpointThreatBlocked",
  // "XdrDetectionEvidence", "IncidentDetected") rather than the canonical tokens
  // above. Classify those by their action so real EDR/XDR/SIEM telemetry produces
  // a coverage status instead of reading as NotTested.
  //
  // Order is deliberately conservative — the truthful claim is the WEAKER one
  // when a string is ambiguous: prevention (Blocked) is a concrete control action
  // and ranks first, but a logged event must NOT be promoted to active detection,
  // so /log/ is checked before /detect|alert/. Otherwise a SIEM "...Logged"
  // subcategory (e.g. Splunk, whose only capabilities are Logged/NoEvidence) would
  // over-claim as Covered rather than the honest LoggedOnly.
  const subcategory = input.latest.signalSubcategory ?? "";
  if (
    /block|prevent|contain|quarantin|remediat|mitigat|kill|rollback/iu.test(
      subcategory
    )
  ) {
    return "Blocked";
  }
  if (/log/iu.test(subcategory)) {
    return "LoggedOnly";
  }
  if (/detect|alert/iu.test(subcategory)) {
    return "Covered";
  }

  return "NotTested";
}

function ruleCoverageRecommendation(status: DetectionRuleCoverageStatus) {
  if (status === "Blocked") {
    return "Keep prevention enabled and confirm the block also creates evidence for analyst review.";
  }

  if (status === "Covered") {
    return "Maintain the current detection path and include this evidence in control trend reporting.";
  }

  if (status === "LoggedOnly") {
    return "Tune alert routing so logged evidence creates an actionable alert or routed workflow.";
  }

  if (status === "Missed") {
    return "Add or tune detection logic for this technique and rerun dry-run control validation.";
  }

  if (status === "NoEvidence") {
    return "Confirm telemetry ingestion and observer access before rerunning this scenario.";
  }

  if (status === "NeedsTuning") {
    return "Tune rule thresholds or expected behavior mapping, then rerun validation.";
  }

  if (status === "Stale") {
    return "Rerun this dry-run control scenario because the latest evidence is stale.";
  }

  return "Run the dry-run scenario to establish initial control coverage evidence.";
}

export function buildControlRuleCoverageSummary(
  input: ControlRuleCoverageInput
): ControlRuleCoverageSummary {
  const scenarios = listControlValidationScenarios();
  const items: DetectionRuleCoverageItem[] = input.controlSources.flatMap(
    (controlSource) =>
      scenarios.map((scenario) => {
        const expectedBehaviors = controlSource.expectedBehaviors.filter(
          isDetectionRuleBehavior
        );
        const matchedSignals = input.signals.filter(
          (signal) =>
            signal.signalCategory === "ControlObservation" &&
            signal.relatedControlIds.includes(controlSource.controlSourceId) &&
            (signal.techniqueIds ?? []).includes(scenario.techniqueId)
        );
        const latest = latestControlSignal([...matchedSignals]);
        const status = ruleCoverageStatus({
          expectedBehaviors,
          generatedAt: input.generatedAt,
          latest
        });
        const attackTechnique = getAttackTechniqueById(scenario.techniqueId);
        // Canonical Slice 5 effectiveness state — same denominator used by
        // Controls, Dashboard, Findings, Reports, and Schedules. Mapped from
        // the legacy coverage status; never invents Prevented/Missed without
        // the underlying signal path that already produced status.
        const effectivenessState =
          mapDetectionRuleCoverageStatusToEffectiveness(status);

        return {
          confidence:
            status === "NotTested"
              ? 0
              : Math.max(
                  0,
                  Math.min(
                    1,
                    latest?.confidence ?? (status === "Stale" ? 0.35 : 0.5)
                  )
                ),
          controlSourceId: controlSource.controlSourceId,
          effectivenessState,
          evidenceIds: uniqueSignalTriggerValues(
            matchedSignals.flatMap((signal) => [
              ...signal.evidenceIds,
              ...signal.relatedEvidenceIds
            ])
          ),
          expectedBehaviors:
            expectedBehaviors.length > 0
              ? expectedBehaviors
              : scenario.expectedBehaviors.filter(isDetectionRuleBehavior),
          lastObservedAt: latest?.timestampObserved ?? null,
          observedBehaviors: uniqueSignalTriggerValues(
            matchedSignals.map((signal) => signal.signalSubcategory)
          ).filter(isDetectionRuleBehavior),
          observedSources: uniqueSignalTriggerValues(
            matchedSignals.map((signal) => signal.sourceVendor)
          ),
          previousStatus: null,
          recommendation: ruleCoverageRecommendation(status),
          scenarioId: scenario.scenarioId,
          signalIds: matchedSignals.map((signal) => signal.signalId),
          status,
          tacticName: attackTechnique?.tacticName ?? "Unknown",
          techniqueId: scenario.techniqueId,
          techniqueName: attackTechnique?.techniqueName ?? scenario.techniqueId,
          title: scenario.title,
          trend: "New" as const
        };
      })
  );
  const count = (status: DetectionRuleCoverageStatus) =>
    items.filter((item) => item.status === status).length;
  const recommendations = uniqueSignalTriggerValues(
    items
      .filter((item) => item.status !== "Covered" && item.status !== "Blocked")
      .map((item) => item.recommendation)
  );

  if (input.controlSources.length === 0) {
    recommendations.push(
      "Add a control source integration before calculating detection-rule coverage."
    );
  }

  return {
    blockedTechniques: count("Blocked"),
    controlSourceId: input.controlSourceId ?? null,
    coveredTechniques: count("Covered"),
    generatedAt: input.generatedAt,
    history: [],
    improvedTechniques: 0,
    items,
    loggedOnlyTechniques: count("LoggedOnly"),
    missedTechniques: count("Missed"),
    needsTuningTechniques: count("NeedsTuning"),
    noEvidenceTechniques: count("NoEvidence"),
    notTestedTechniques: count("NotTested"),
    recommendations,
    regressedTechniques: 0,
    snapshotId: null,
    staleTechniques: count("Stale"),
    tenantId: input.tenantId,
    totalTechniques: items.length
  };
}

const CONTROL_COVERAGE_STRENGTH: Record<DetectionRuleCoverageStatus, number> = {
  Blocked: 5,
  Covered: 4,
  LoggedOnly: 3,
  NeedsTuning: 2,
  Missed: 1,
  NoEvidence: 1,
  Stale: 0,
  NotTested: 0
};

function controlCoverageItemKey(item: DetectionRuleCoverageItem): string {
  return `${item.controlSourceId}:${item.scenarioId}:${item.techniqueId}`;
}

/**
 * Compare immutable control-coverage snapshots. The ordering is deliberately
 * conservative: prevention is stronger than detection, logging is weaker than
 * an actionable detection, and stale/not-tested evidence cannot count as an
 * improvement. This keeps the UI from claiming progress merely because a label
 * changed.
 */
export function compareControlRuleCoverageSummary(
  current: ControlRuleCoverageSummary,
  previous: ControlRuleCoverageSummary | null
): ControlRuleCoverageSummary {
  const previousItems = new Map(
    (previous?.items ?? []).map((item) => [controlCoverageItemKey(item), item])
  );
  const items = current.items.map((item) => {
    const prior = previousItems.get(controlCoverageItemKey(item));

    if (!prior) {
      return {
        ...item,
        previousStatus: null,
        trend: "New" as const
      };
    }

    const currentStrength = CONTROL_COVERAGE_STRENGTH[item.status];
    const previousStrength = CONTROL_COVERAGE_STRENGTH[prior.status];

    return {
      ...item,
      previousStatus: prior.status,
      trend:
        currentStrength > previousStrength
          ? ("Improved" as const)
          : currentStrength < previousStrength
            ? ("Regressed" as const)
            : ("Unchanged" as const)
    };
  });

  return ControlRuleCoverageSummarySchema.parse({
    ...current,
    improvedTechniques: items.filter((item) => item.trend === "Improved")
      .length,
    items,
    regressedTechniques: items.filter((item) => item.trend === "Regressed")
      .length
  });
}

export type ExecutiveTrendInput = {
  attackPaths?: AttackPathAssessment[];
  /**
   * Policy decisions Denied before queue (fail-closed). Optional so unit tests
   * and partial callers can omit; honest zero when absent.
   */
  deniedNeverQueuedCount?: number;
  evidenceArtifacts: EvidenceArtifact[];
  findings: ValidatedFinding[];
  generatedAt: string;
  integrations: Integration[];
  missingSignals: MissingSignal[];
  remediations: RemediationTask[];
  reports: EvidencePack[];
  scopes: Scope[];
  /**
   * Runner/task result signature checks in the window. Optional; null rate when
   * signatureCheckedCount is 0 (honest empty, not 100%).
   */
  signatureCheckedCount?: number;
  signatureVerifiedCount?: number;
  tenantId: string;
  verificationEvents: VerificationEvent[];
};

function executiveMetric(input: {
  evidenceIds?: string[];
  label: string;
  metricId: string;
  unit: string;
  value: number;
}) {
  return {
    delta: 0,
    evidenceIds: input.evidenceIds ?? [],
    label: input.label,
    metricId: input.metricId,
    previousValue: null,
    trendDirection: "NotAvailable" as const,
    unit: input.unit,
    value: input.value
  };
}

const CONFIDENCE_REDUCING_MISSING_SIGNAL_STATUSES = [
  "NotConfigured",
  "RequiresIntegration",
  "RequiresVerifiedScope",
  "RequiresInternalRunner",
  "NotImplemented"
] satisfies MissingSignal["status"][];

const CONFIDENCE_REDUCING_MISSING_SIGNAL_STATUS_SET = new Set<
  MissingSignal["status"]
>(CONFIDENCE_REDUCING_MISSING_SIGNAL_STATUSES);

function getConfidenceReducingMissingSignals(missingSignals: MissingSignal[]) {
  return missingSignals.filter((signal) =>
    CONFIDENCE_REDUCING_MISSING_SIGNAL_STATUS_SET.has(signal.status)
  );
}

export function buildExecutiveTrendSummary(
  input: ExecutiveTrendInput
): ExecutiveTrendSummary {
  const financiallyValuedPaths = (input.attackPaths ?? []).filter(
    (path) => path.financialExposure
  );
  const annualizedExposureUsd = financiallyValuedPaths.reduce(
    (total, path) =>
      total + (path.financialExposure?.annualizedLossExposureUsd ?? 0),
    0
  );
  const criticalHighFindings = input.findings.filter(
    (finding) => finding.severity === "Critical" || finding.severity === "High"
  );
  // PartiallyFixed and Inconclusive both count as open active work, NOT settled
  // fixes. A partial fix has reduced — not eliminated — the exposure, and an
  // Inconclusive verification never proved the exposure closed, so both remain
  // unresolved (mapRemediationStatusToFindingStatus treats PartiallyFixed like
  // InProgress and maps Inconclusive to the "Inconclusive" active finding state,
  // and the canonical open/resolved split — RESOLVED is Fixed/Mitigated ONLY —
  // counts both as still-open work). The other non-resolved statuses
  // (VerificationPending, Reopened, ClosedWithoutEvidence) are broken out into
  // their own velocity buckets below, but Inconclusive has none — so omitting it
  // here under-claimed the "Open remediations" metric and silently dropped these
  // items from every velocity bucket while still counting them in
  // totalRemediations, leaving the breakdown unable to reconcile to the total.
  const openRemediations = input.remediations.filter((remediation) =>
    [
      "Open",
      "InProgress",
      "PartiallyFixed",
      "StillExposed",
      "Inconclusive"
    ].includes(remediation.status)
  );
  const readyForVerification = input.remediations.filter(
    (remediation) => remediation.status === "VerificationPending"
  );
  const fixedRemediations = input.remediations.filter(
    (remediation) =>
      remediation.status === "Fixed" || remediation.status === "Mitigated"
  );
  const measuredClosureEvents = input.verificationEvents.filter(
    (event) =>
      event.measuredRevalidation === true &&
      (event.outcome === "Fixed" || event.outcome === "Mitigated")
  );
  const measuredClosureRemediationIds = new Set(
    measuredClosureEvents.map((event) => event.remediationId)
  );
  const verifiedFixedRemediations = fixedRemediations.filter((remediation) =>
    measuredClosureRemediationIds.has(remediation.remediationId)
  );
  const verifiedFixedRemediationIds = new Set(
    verifiedFixedRemediations.map((remediation) => remediation.remediationId)
  );
  const reopenedRemediations = input.remediations.filter(
    (remediation) => remediation.status === "Reopened"
  );
  const closedWithoutEvidence = input.remediations.filter(
    (remediation) => remediation.status === "ClosedWithoutEvidence"
  );
  const remediationCreatedAt = new Map(
    input.remediations.map((remediation) => [
      remediation.remediationId,
      new Date(remediation.createdAt).getTime()
    ])
  );
  const verificationDurations = input.verificationEvents
    .map((event) => {
      const createdAt = remediationCreatedAt.get(event.remediationId);
      const verifiedAt = new Date(event.verifiedAt).getTime();

      if (
        typeof createdAt !== "number" ||
        !Number.isFinite(createdAt) ||
        !Number.isFinite(verifiedAt) ||
        verifiedAt < createdAt
      ) {
        return null;
      }

      return (verifiedAt - createdAt) / (60 * 60 * 1000);
    })
    .filter((duration): duration is number => duration !== null);
  const averageVerificationHours =
    verificationDurations.length === 0
      ? null
      : verificationDurations.reduce((total, duration) => total + duration, 0) /
        verificationDurations.length;
  const readyReports = input.reports.filter(
    (report) => report.status === "Ready" || report.status === "Exported"
  );
  const latestReport = [...input.reports].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  )[0];
  const reportExports = input.evidenceArtifacts.filter(
    (artifact) => artifact.artifactType === "ReportExport"
  );
  const verifiedScopes = input.scopes.filter(
    (scope) => scope.verificationStatus === "Verified"
  );
  const connectedIntegrations = input.integrations.filter(
    (integration) => integration.status === "Connected"
  );
  const healthyIntegrations = connectedIntegrations.filter(
    (integration) => integration.healthStatus === "Healthy"
  );
  const confidenceReducingMissingSignals = getConfidenceReducingMissingSignals(
    input.missingSignals
  );
  const recommendations = [
    criticalHighFindings.length > 0
      ? "Prioritize Critical and High validated findings before expanding validation scope."
      : null,
    readyForVerification.length > 0
      ? "Run fix verification for remediation work that is ready for proof."
      : null,
    closedWithoutEvidence.length > 0
      ? "Reopen or verify remediations that were closed without evidence."
      : null,
    readyReports.length === 0
      ? "Generate an evidence pack for executive and customer review."
      : null,
    verifiedScopes.length === 0
      ? "Verify customer-authorized scope before expanding validation."
      : null,
    connectedIntegrations.length === 0
      ? "Connect at least one signal source to improve executive trend quality."
      : null,
    confidenceReducingMissingSignals.length > 0
      ? "Close missing proof inputs before presenting risk reduction as fully validated."
      : null
  ].filter((recommendation): recommendation is string =>
    Boolean(recommendation)
  );

  // ICP-P1-6 / P12-17: hop-level Measured share when edges exist; else path basis.
  const hopBases = (input.attackPaths ?? []).flatMap((assessment) =>
    (assessment.attackPath.pathEdges ?? []).map((edge) => edge.evidenceBasis)
  );
  const pathBases = (input.attackPaths ?? []).map(
    (assessment) => assessment.attackPath.evidenceBasis
  );
  const claimBases = hopBases.length > 0 ? hopBases : pathBases;
  const measuredClaims = countMeasuredClaims(claimBases);
  // Attempted = currently Fixed/Mitigated + reopened (once Fixed, later reopened).
  // Survived = currently Fixed/Mitigated with measured verification — reopened
  // rows are already excluded from fixedRemediations, so do not double-subtract.
  const fixedAttempted =
    fixedRemediations.length + reopenedRemediations.length;
  const survival = countFixedSurvival({
    fixedWithMeasuredVerification: verifiedFixedRemediations.length,
    fixedOrMitigatedTotal: fixedAttempted,
    reopenedAfterFixed: 0
  });
  const honestyTrust = buildHonestyTrustMetrics({
    measuredClaimCount: measuredClaims.measuredClaimCount,
    totalClaimCount: measuredClaims.totalClaimCount,
    fixedSurvivedCount: survival.fixedSurvivedCount,
    fixedAttemptedCount: survival.fixedAttemptedCount,
    deniedNeverQueuedCount: input.deniedNeverQueuedCount ?? 0,
    signatureVerifiedCount: input.signatureVerifiedCount ?? 0,
    signatureCheckedCount: input.signatureCheckedCount ?? 0
  });

  return {
    generatedAt: input.generatedAt,
    honestyTrust,
    metrics: [
      ...(financiallyValuedPaths.length > 0
        ? [
            executiveMetric({
              evidenceIds: financiallyValuedPaths.flatMap(
                (path) => path.attackPath.evidenceIds
              ),
              label: "Assumption-based annualized exposure",
              metricId: "annualized_loss_exposure_usd",
              unit: "USD",
              value: annualizedExposureUsd
            })
          ]
        : []),
      executiveMetric({
        evidenceIds: criticalHighFindings.flatMap(
          (finding) => finding.evidenceIds
        ),
        label: "Critical and high validated findings",
        metricId: "critical_high_findings",
        unit: "findings",
        value: criticalHighFindings.length
      }),
      executiveMetric({
        // A current Fixed/Mitigated status is only a recorded workflow state.
        // Count it as verified only when a measured closure event exists, and
        // attach evidence from those exact events rather than unrelated runs.
        evidenceIds: measuredClosureEvents
          .filter((event) =>
            verifiedFixedRemediationIds.has(event.remediationId)
          )
          .flatMap((event) => event.evidenceIds),
        label: "Verified fixes",
        metricId: "verified_fixes",
        unit: "fixes",
        value: verifiedFixedRemediations.length
      }),
      executiveMetric({
        evidenceIds: openRemediations.flatMap(
          (remediation) => remediation.evidenceIds
        ),
        label: "Open remediations",
        metricId: "open_remediations",
        unit: "tasks",
        value: openRemediations.length
      }),
      executiveMetric({
        evidenceIds: readyReports.flatMap((report) => report.evidenceIds),
        label: "Evidence packs ready",
        metricId: "evidence_packs_ready",
        unit: "packs",
        value: readyReports.length
      }),
      executiveMetric({
        label: "Healthy connected integrations",
        metricId: "healthy_integrations",
        unit: "integrations",
        value: healthyIntegrations.length
      }),
      executiveMetric({
        evidenceIds: [],
        label: "Missing proof inputs",
        metricId: "missing_signal_gaps",
        unit: "signals",
        value: confidenceReducingMissingSignals.length
      })
    ],
    proofDelivery: {
      evidencePacksReady: readyReports.length,
      latestReportCreatedAt: latestReport?.createdAt ?? null,
      latestReportId: latestReport?.evidencePackId ?? null,
      reportExports: reportExports.length
    },
    recommendations,
    remediationVelocity: {
      averageVerificationHours,
      closedWithoutEvidence: closedWithoutEvidence.length,
      fixedRemediations: fixedRemediations.length,
      openRemediations: openRemediations.length,
      readyForVerification: readyForVerification.length,
      reopenedRemediations: reopenedRemediations.length,
      totalRemediations: input.remediations.length
    },
    tenantId: input.tenantId
  };
}

export const OPERATIONAL_METRICS_WINDOW_DAYS = 30;
const OPERATIONAL_METRICS_RECENT_LIMIT = 10;

export type OperationalMetricsInput = {
  auditEvents: AuditEvent[];
  generatedAt: string;
  integrations: Integration[];
  missions: ValidationMission[];
  policyDecisions: PolicyDecision[];
  tenantId: string;
  windowDays?: number;
};

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function percentile(values: number[], percentileValue: number) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(percentileValue * sorted.length) - 1)
  );

  return sorted[index] ?? null;
}

function metadataRecord(event: AuditEvent) {
  return event.metadata && typeof event.metadata === "object"
    ? event.metadata
    : {};
}

function metadataNumber(
  metadata: Record<string, unknown>,
  key: string
): number | null {
  const value = metadata[key];

  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : null;
}

function metadataString(
  metadata: Record<string, unknown>,
  key: string
): string | null {
  const value = metadata[key];

  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function metadataStringArray(
  metadata: Record<string, unknown>,
  key: string
): string[] {
  const value = metadata[key];

  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function isPolicyDenialAuditEvent(event: AuditEvent) {
  if (event.action !== "policy.decision") {
    return false;
  }

  const metadata = metadataRecord(event);
  const outcome = metadataString(metadata, "outcome");
  const code = metadataString(metadata, "code");

  return (
    outcome === "Denied" ||
    Boolean(code?.includes("denied")) ||
    Boolean(code?.includes("mismatch")) ||
    metadata.moduleStartGuard === true ||
    metadata.externalValidationGuard === true
  );
}

export function buildOperationalMetricsSummary(
  input: OperationalMetricsInput
): TenantOperationalMetrics {
  const generatedAt = new Date(input.generatedAt);
  const windowDays = input.windowDays ?? OPERATIONAL_METRICS_WINDOW_DAYS;
  const since = new Date(
    generatedAt.getTime() - windowDays * 24 * 60 * 60 * 1000
  );
  const auditEvents = input.auditEvents.filter(
    (event) => new Date(event.createdAt).getTime() >= since.getTime()
  );
  const integrationsById = new Map(
    input.integrations.map((integration) => [
      integration.integrationId,
      integration
    ])
  );
  const missionStartEvents = auditEvents
    .filter((event) => event.action === "mission.started" && event.entityId)
    .map((event) => {
      const metadata = metadataRecord(event);
      const moduleIds = metadataStringArray(metadata, "moduleIds");

      return {
        durationMs: metadataNumber(metadata, "durationMs") ?? 0,
        jobsQueued: metadataNumber(metadata, "jobsQueued") ?? 0,
        missionId: event.entityId!,
        moduleCount:
          metadataNumber(metadata, "moduleCount") ?? moduleIds.length,
        startedAt: event.createdAt
      };
    })
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
  const missionDurations = missionStartEvents.map((event) => event.durationMs);
  const policyDenialEventsFromAudit = auditEvents
    .filter(isPolicyDenialAuditEvent)
    .map((event) => {
      const metadata = metadataRecord(event);

      return {
        code: metadataString(metadata, "code") ?? null,
        createdAt: event.createdAt,
        missionId: metadataString(metadata, "missionId"),
        policyDecisionId: event.entityId,
        rationale: metadataString(metadata, "rationale")
      };
    });
  const auditPolicyDecisionIds = new Set(
    policyDenialEventsFromAudit
      .map((event) => event.policyDecisionId)
      .filter((policyDecisionId): policyDecisionId is string =>
        Boolean(policyDecisionId)
      )
  );
  const synthesizedDeniedDecisions = input.policyDecisions
    .filter(
      (decision) =>
        decision.outcome === "Denied" &&
        !auditPolicyDecisionIds.has(decision.policyDecisionId)
    )
    .map((decision) => ({
      code: "policy_denied",
      createdAt: decision.createdAt,
      missionId: null,
      policyDecisionId: decision.policyDecisionId,
      rationale: decision.rationale
    }));
  const policyDenialEvents = [
    ...policyDenialEventsFromAudit,
    ...synthesizedDeniedDecisions
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const deniedDecisionIds = new Set(
    policyDenialEvents
      .map((event) => event.policyDecisionId)
      .filter((policyDecisionId): policyDecisionId is string =>
        Boolean(policyDecisionId)
      )
  );
  const deniedDecisionCount = Math.max(
    deniedDecisionIds.size,
    policyDenialEvents.length
  );
  const totalPolicyDecisionCount = Math.max(
    input.policyDecisions.length,
    deniedDecisionCount
  );
  const connectorSyncEvents = auditEvents
    .filter((event) => event.action === "integration.synced" && event.entityId)
    .map((event) => {
      const metadata = metadataRecord(event);
      const integration = integrationsById.get(event.entityId!);
      const healthStatus =
        metadataString(metadata, "healthStatus") ??
        integration?.healthStatus ??
        "Unknown";
      const status =
        metadataString(metadata, "status") === "Failed"
          ? "Failed"
          : "Succeeded";

      return {
        assetCount: metadataNumber(metadata, "assetCount") ?? 0,
        durationMs: metadataNumber(metadata, "durationMs") ?? 0,
        healthStatus:
          healthStatus === "Healthy" ||
          healthStatus === "Degraded" ||
          healthStatus === "Unhealthy" ||
          healthStatus === "Unknown"
            ? healthStatus
            : "Unknown",
        integrationId: event.entityId!,
        product:
          metadataString(metadata, "product") ??
          integration?.product ??
          "Unknown integration",
        signalCount: metadataNumber(metadata, "signalCount") ?? 0,
        status,
        syncedAt: event.createdAt,
        vendor:
          metadataString(metadata, "vendor") ??
          integration?.vendor ??
          "Unknown vendor"
      };
    })
    .sort((left, right) => right.syncedAt.localeCompare(left.syncedAt));
  const connectorDurations = connectorSyncEvents.map(
    (event) => event.durationMs
  );
  const failedSyncCount = connectorSyncEvents.filter(
    (event) => event.status === "Failed" || event.healthStatus === "Unhealthy"
  ).length;
  const recommendations = [
    missionStartEvents.length === 0
      ? "Run a policy-approved mission to collect mission start latency telemetry."
      : null,
    totalPolicyDecisionCount > 0 &&
    deniedDecisionCount / totalPolicyDecisionCount >= 0.25
      ? "Review recent policy denials before expanding validation scope."
      : null,
    input.integrations.length > 0 && connectorSyncEvents.length === 0
      ? "Sync connected integrations to establish connector timing telemetry."
      : null,
    failedSyncCount > 0
      ? "Investigate failed or unhealthy connector syncs before customer reporting."
      : null
  ].filter((recommendation): recommendation is string =>
    Boolean(recommendation)
  );

  return TenantOperationalMetricsSchema.parse({
    connectorSyncs: {
      averageDurationMs: average(connectorDurations),
      failedSyncCount,
      p95DurationMs: percentile(connectorDurations, 0.95),
      recentSyncs: connectorSyncEvents.slice(
        0,
        OPERATIONAL_METRICS_RECENT_LIMIT
      ),
      totalSyncCount: connectorSyncEvents.length
    },
    generatedAt: generatedAt.toISOString(),
    missionStartLatency: {
      averageDurationMs: average(missionDurations),
      maxDurationMs:
        missionDurations.length === 0 ? null : Math.max(...missionDurations),
      p95DurationMs: percentile(missionDurations, 0.95),
      queuedMissionCount: input.missions.filter(
        (mission) => mission.status === "Queued"
      ).length,
      recentStarts: missionStartEvents.slice(
        0,
        OPERATIONAL_METRICS_RECENT_LIMIT
      ),
      startedMissionCount: missionStartEvents.length
    },
    policyDenials: {
      denialRate:
        totalPolicyDecisionCount === 0
          ? 0
          : deniedDecisionCount / totalPolicyDecisionCount,
      deniedDecisionCount,
      recentDenials: policyDenialEvents.slice(
        0,
        OPERATIONAL_METRICS_RECENT_LIMIT
      ),
      totalPolicyDecisionCount
    },
    recommendations:
      recommendations.length > 0
        ? recommendations
        : ["Operational telemetry is within the current expected range."],
    tenantId: input.tenantId,
    window: {
      since: since.toISOString(),
      until: generatedAt.toISOString()
    }
  });
}

export interface ListJobsInput {
  status?: JobStatus;
  missionId?: string;
  limit?: number;
}

export interface ListMissionsInput {
  limit?: number;
  cursor?: string;
}

export interface PaginatedResult<TItem> {
  items: TItem[];
  nextCursor: string | null;
}

export interface BillingLimitsResponse {
  limits: {
    missionsPerMonth: number | null;
    runners: number | null;
    evidenceArtifacts: number | null;
  };
  usage: {
    missionsThisMonth: number;
    runners: number;
    evidenceArtifacts: number;
  };
  withinLimits: boolean;
}

export interface AuditExportInput {
  action?: AuditEventAction;
  actorType?: string;
  category?: string;
  format: "json" | "csv";
  from?: string;
  search?: string;
  to?: string;
}

// Hard cap on how many audit events a single export materializes, to bound
// memory/artifact size. An export beyond this is TRUNCATED and must say so —
// a silently-capped audit trail reads as complete to a compliance reviewer.
export const AUDIT_EXPORT_MAX_EVENTS = 5000;

// Describe an audit export's completeness honestly: eventCount is what was
// actually written, totalEventCount is what exists for the tenant, and
// truncated is true when the export does not cover the full trail.
export function buildAuditExportCompleteness(input: {
  exportedCount: number;
  totalCount: number;
}): { eventCount: number; totalEventCount: number; truncated: boolean } {
  return {
    eventCount: input.exportedCount,
    totalEventCount: input.totalCount,
    truncated: input.totalCount > input.exportedCount
  };
}

export interface AuditExportResult {
  exportId: string;
  evidenceId: string;
  format: "json" | "csv";
  eventCount: number;
  totalEventCount: number;
  truncated: boolean;
  generatedAt: string;
  downloadPath: string;
}

export interface AuditExportContent {
  content: string;
  contentType: string;
}

export type InternalEngagementRunRequest = EngagementRunRequest & {
  feedbackCycleNumber?: number;
};

export interface AppServices {
  authenticateApiKey(rawKey: string): Promise<AuthenticatedContext | null>;
  runEngagement(
    context: AuthenticatedContext,
    input: InternalEngagementRunRequest
  ): Promise<EngagementResult>;
  getEngagement(
    context: AuthenticatedContext,
    engagementId: string
  ): Promise<EngagementResult | null>;
  listEngagements(context: AuthenticatedContext): Promise<EngagementResult[]>;
  getEngagementCollaboration(
    context: AuthenticatedContext,
    engagementId: string
  ): Promise<EngagementCollaborationSnapshot | null>;
  initializeEngagementCollaboration(
    context: AuthenticatedContext,
    engagementId: string,
    input: InitializeEngagementWorkspaceInput
  ): Promise<EngagementCollaborationSnapshot>;
  upsertEngagementCollaborator(
    context: AuthenticatedContext,
    engagementId: string,
    input: UpsertEngagementCollaboratorInput
  ): Promise<EngagementCollaborationSnapshot>;
  appendEngagementCollaborationEvent(
    context: AuthenticatedContext,
    engagementId: string,
    input: CreateEngagementCollaborationEventInput
  ): Promise<EngagementCollaborationSnapshot>;
  compileScenario(
    context: AuthenticatedContext,
    input: CompileScenarioInput
  ): Promise<CompileScenarioResponse>;
  /** Hybrid Execution Compiler (#30): mission plan → signed passive runner tasks. */
  compileHybridExecution(
    context: AuthenticatedContext,
    input: import("@periscan/shared").CompileHybridExecutionInput
  ): Promise<import("@periscan/shared").CompileHybridExecutionResponse>;
  /** Passive multi-agent mission assembly (#29) — not BAS swarm. */
  assemblePassiveMultiAgentPlan(
    context: AuthenticatedContext,
    input: import("@periscan/shared").AssemblePassiveMultiAgentPlanInput
  ): Promise<import("@periscan/shared").AssemblePassiveMultiAgentPlanResponse>;
  /** Conversational builder (#33): typed mission draft, never executable BAS. */
  createConversationalMissionDraft(
    context: AuthenticatedContext,
    input: import("@periscan/shared").CreateConversationalMissionDraftInput
  ): Promise<import("@periscan/shared").ConversationalMissionDraft>;
  /** Convert conversational draft → hybrid compile input (draft stays non-BAS). */
  convertConversationalMissionDraftToHybridCompileInput(
    context: AuthenticatedContext,
    input: import("@periscan/shared").ConvertMissionDraftToHybridCompileInputRequest
  ): Promise<import("@periscan/shared").HybridCompileInputFromDraft>;
  approveScenarioBundle(
    context: AuthenticatedContext,
    scenarioBundleId: string
  ): Promise<ScenarioBundle>;
  executeScenarioBundle(
    context: AuthenticatedContext,
    scenarioBundleId: string,
    input: ExecuteScenarioInput
  ): Promise<ScenarioExecutionResult>;
  stopScenarioFeedback(
    context: AuthenticatedContext,
    scenarioBundleId: string,
    input: StopScenarioFeedbackInput
  ): Promise<ScenarioBundle>;
  getScenarioBundle(
    context: AuthenticatedContext,
    scenarioBundleId: string
  ): Promise<ScenarioBundle | null>;
  listScenarioBundles(context: AuthenticatedContext): Promise<ScenarioBundle[]>;
  createApiKey(
    context: AuthenticatedContext,
    input: CreateTenantApiKeyInput
  ): Promise<TenantApiKeyWithSecret>;
  listApiKeys(context: AuthenticatedContext): Promise<TenantApiKey[]>;
  revokeApiKey(
    context: AuthenticatedContext,
    apiKeyId: string
  ): Promise<TenantApiKey>;
  rotateApiKey(
    context: AuthenticatedContext,
    apiKeyId: string
  ): Promise<TenantApiKeyWithSecret>;
  listWebhooks(context: AuthenticatedContext): Promise<TenantWebhook[]>;
  /**
   * Discoverable outbound event types + signature headers (P20-5 / O13).
   * Pure catalog — no tenant secrets.
   */
  getWebhookEventCatalog(
    context: AuthenticatedContext
  ): Promise<WebhookEventCatalog>;
  createWebhook(
    context: AuthenticatedContext,
    input: CreateTenantWebhookInput
  ): Promise<TenantWebhookWithSecret>;
  updateWebhook(
    context: AuthenticatedContext,
    webhookId: string,
    input: UpdateTenantWebhookInput
  ): Promise<TenantWebhook>;
  deleteWebhook(
    context: AuthenticatedContext,
    webhookId: string
  ): Promise<void>;
  testWebhook(
    context: AuthenticatedContext,
    webhookId: string
  ): Promise<{ deliveryIds: string[] }>;
  listWebhookDeliveries(
    context: AuthenticatedContext,
    webhookId?: string
  ): Promise<WebhookDelivery[]>;
  listDeadLetteredWebhookDeliveries(
    context: AuthenticatedContext
  ): Promise<WebhookDelivery[]>;
  /** Rotate signing secret; returns one-time secret (P20-4). */
  rotateWebhookSecret(
    context: AuthenticatedContext,
    webhookId: string
  ): Promise<TenantWebhookWithSecret>;
  /**
   * Reset a failed/dead-lettered delivery to Pending and re-enqueue (P20-4).
   * Only Failed or dead-lettered rows are redrivable.
   */
  redriveWebhookDelivery(
    context: AuthenticatedContext,
    deliveryId: string
  ): Promise<{ deliveryId: string; status: string }>;
  listPendingApprovals(
    context: AuthenticatedContext
  ): Promise<PolicyDecision[]>;
  listPolicyDecisions(
    context: AuthenticatedContext,
    input: ListPolicyDecisionsInput
  ): Promise<PolicyDecision[]>;
  approvePolicyDecision(
    context: AuthenticatedContext,
    policyDecisionId: string
  ): Promise<PolicyDecision>;
  denyPolicyDecision(
    context: AuthenticatedContext,
    policyDecisionId: string
  ): Promise<PolicyDecision>;
  getBillingLimits(
    context: AuthenticatedContext
  ): Promise<BillingLimitsResponse>;
  listTenantMembers(context: AuthenticatedContext): Promise<TenantMember[]>;
  getTenantSafetySettings(
    context: AuthenticatedContext
  ): Promise<TenantSafetySettings>;
  setOffensiveValidation(
    context: AuthenticatedContext,
    input: SetOffensiveValidationInput
  ): Promise<TenantSafetySettings>;
  setDestructiveValidation(
    context: AuthenticatedContext,
    input: SetDestructiveValidationInput
  ): Promise<TenantSafetySettings>;
  getTenantRequireMfa(
    context: AuthenticatedContext
  ): Promise<TenantRequireMfaSettings>;
  setTenantRequireMfa(
    context: AuthenticatedContext,
    input: SetTenantRequireMfaInput
  ): Promise<TenantRequireMfaSettings>;
  globalSearch(
    context: AuthenticatedContext,
    query: string
  ): Promise<GlobalSearchResponse>;
  listMcpTools(context: AuthenticatedContext): Promise<McpToolInfo[]>;
  listMcpActivity(context: AuthenticatedContext): Promise<McpActivityEntry[]>;
  callMcpTool(
    context: AuthenticatedContext,
    toolName: string,
    args: unknown
  ): Promise<unknown>;
  updateTenantMemberRole(
    context: AuthenticatedContext,
    membershipId: string,
    role: MembershipRole
  ): Promise<TenantMember>;
  removeTenantMember(
    context: AuthenticatedContext,
    membershipId: string
  ): Promise<void>;
  createAuditExport(
    context: AuthenticatedContext,
    input: AuditExportInput
  ): Promise<AuditExportResult>;
  getAuditExport(
    context: AuthenticatedContext,
    exportId: string
  ): Promise<AuditExportContent | null>;
  listModelProviders(context: AuthenticatedContext): Promise<ModelProvider[]>;
  getModelProvider(
    context: AuthenticatedContext,
    modelProviderId: string
  ): Promise<ModelProvider | null>;
  createModelProvider(
    context: AuthenticatedContext,
    input: CreateModelProviderInput
  ): Promise<ModelProvider>;
  updateModelProvider(
    context: AuthenticatedContext,
    modelProviderId: string,
    input: UpdateModelProviderInput
  ): Promise<ModelProvider>;
  deleteModelProvider(
    context: AuthenticatedContext,
    modelProviderId: string
  ): Promise<void>;
  testModelProviderConnection(
    context: AuthenticatedContext,
    modelProviderId: string
  ): Promise<ModelProviderConnectionTestResult>;
  listModelPolicyProfiles(
    context: AuthenticatedContext
  ): Promise<ModelPolicyProfile[]>;
  getModelPolicyProfile(
    context: AuthenticatedContext,
    modelPolicyProfileId: string
  ): Promise<ModelPolicyProfile | null>;
  createModelPolicyProfile(
    context: AuthenticatedContext,
    input: CreateModelPolicyProfileInput
  ): Promise<ModelPolicyProfile>;
  updateModelPolicyProfile(
    context: AuthenticatedContext,
    modelPolicyProfileId: string,
    input: UpdateModelPolicyProfileInput
  ): Promise<ModelPolicyProfile>;
  deleteModelPolicyProfile(
    context: AuthenticatedContext,
    modelPolicyProfileId: string
  ): Promise<void>;
  listModelTools(context: AuthenticatedContext): Promise<ModelTool[]>;
  updateModelTool(
    context: AuthenticatedContext,
    toolName: string,
    input: UpdateModelToolInput
  ): Promise<ModelTool>;
  listModelSessions(context: AuthenticatedContext): Promise<ModelSession[]>;
  getModelSession(
    context: AuthenticatedContext,
    modelSessionId: string
  ): Promise<ModelSession | null>;
  createModelSession(
    context: AuthenticatedContext,
    input: CreateModelSessionInput
  ): Promise<ModelSession>;
  startModelSession(
    context: AuthenticatedContext,
    modelSessionId: string
  ): Promise<ModelSession>;
  pauseModelSession(
    context: AuthenticatedContext,
    modelSessionId: string
  ): Promise<ModelSession>;
  terminateModelSession(
    context: AuthenticatedContext,
    modelSessionId: string
  ): Promise<ModelSession>;
  enqueueModelSessionTurn(
    context: AuthenticatedContext,
    modelSessionId: string,
    input: CreateModelSessionTurnInput
  ): Promise<ModelSessionTurnAccepted>;
  listModelSessionTurns(
    context: AuthenticatedContext,
    modelSessionId: string
  ): Promise<ModelUsageEvent[]>;
  createContextBundle(
    context: AuthenticatedContext,
    modelSessionId: string,
    input: CreateContextBundleInput
  ): Promise<ContextBundle>;
  listContextBundles(
    context: AuthenticatedContext,
    modelSessionId: string
  ): Promise<ContextBundle[]>;
  getContextBundle(
    context: AuthenticatedContext,
    contextBundleId: string
  ): Promise<ContextBundle | null>;
  listModelToolRequests(
    context: AuthenticatedContext,
    modelSessionId: string
  ): Promise<ModelToolRequest[]>;
  getModelToolRequest(
    context: AuthenticatedContext,
    toolRequestId: string
  ): Promise<ModelToolRequest | null>;
  createModelToolRequest(
    context: AuthenticatedContext,
    modelSessionId: string,
    input: CreateModelToolRequestInput
  ): Promise<ModelToolRequest>;
  listModelToolInterventions(
    context: AuthenticatedContext
  ): Promise<ModelToolInterventionQueue>;
  issueModelToolIntervention(
    context: AuthenticatedContext,
    toolRequestId: string,
    input: IssueModelToolInterventionInput
  ): Promise<IssueModelToolInterventionResult>;
  inspectModelToolIntervention(
    context: AuthenticatedContext,
    interventionId: string,
    input: InspectModelToolInterventionInput
  ): Promise<ModelToolIntervention>;
  decideModelToolIntervention(
    context: AuthenticatedContext,
    interventionId: string,
    input: DecideModelToolInterventionInput
  ): Promise<ModelToolInterventionDecisionResult>;
  approveModelToolRequest(
    context: AuthenticatedContext,
    toolRequestId: string
  ): Promise<ModelToolRequest>;
  denyModelToolRequest(
    context: AuthenticatedContext,
    toolRequestId: string
  ): Promise<ModelToolRequest>;
  cancelModelToolRequest(
    context: AuthenticatedContext,
    toolRequestId: string
  ): Promise<ModelToolRequest>;
  executeModelToolRequest(
    context: AuthenticatedContext,
    toolRequestId: string
  ): Promise<ModelToolRequest>;
  listModelGatewayAuditEvents(
    context: AuthenticatedContext,
    modelSessionId?: string
  ): Promise<ModelGatewayAuditEvent[]>;
  activateModelGatewayKillSwitch(
    context: AuthenticatedContext,
    input: ActivateKillSwitchInput
  ): Promise<KillSwitchResult>;
  listAgentWorkflowDefinitions(
    context: AuthenticatedContext
  ): Promise<AgentWorkflowDefinition[]>;
  createAgentWorkflowDefinition(
    context: AuthenticatedContext,
    input: CreateAgentWorkflowDefinitionInput
  ): Promise<AgentWorkflowDefinition>;
  listAgentWorkflowRuns(
    context: AuthenticatedContext
  ): Promise<AgentWorkflowRun[]>;
  getAgentBehaviorAnalysis(
    context: AuthenticatedContext
  ): Promise<AgentBehaviorAnalysis>;
  createAgentWorkflowRun(
    context: AuthenticatedContext,
    input: CreateAgentWorkflowRunInput
  ): Promise<AgentWorkflowRun>;
  getAgentWorkflowRun(
    context: AuthenticatedContext,
    workflowRunId: string
  ): Promise<AgentWorkflowRunDetail>;
  getAgentWorkflowVariableAnalysis(
    context: AuthenticatedContext,
    workflowRunId: string
  ): Promise<AgentWorkflowVariableAnalysis>;
  evaluateAgentWorkflowRunQuality(
    context: AuthenticatedContext,
    workflowRunId: string
  ): Promise<AgentWorkflowQualityEvaluation>;
  appendAgentWorkflowEvent(
    context: AuthenticatedContext,
    workflowRunId: string,
    input: AppendAgentWorkflowEventInput
  ): Promise<AgentWorkflowEvent>;
  createAgentWorkflowCheckpoint(
    context: AuthenticatedContext,
    workflowRunId: string,
    input: CreateAgentWorkflowCheckpointInput
  ): Promise<AgentWorkflowCheckpoint>;
  replayAgentWorkflowRun(
    context: AuthenticatedContext,
    workflowRunId: string,
    input: ReplayAgentWorkflowInput
  ): Promise<AgentWorkflowRun>;
  listAgentProtocolEndpoints(
    context: AuthenticatedContext
  ): Promise<AgentProtocolEndpoint[]>;
  registerAgentProtocolEndpoint(
    context: AuthenticatedContext,
    input: RegisterAgentProtocolEndpointInput
  ): Promise<AgentProtocolEndpoint>;
  reviewAgentProtocolEndpoint(
    context: AuthenticatedContext,
    endpointId: string,
    input: ReviewAgentProtocolEndpointInput
  ): Promise<AgentProtocolEndpoint>;
  discoverAgentProtocolEndpoint(
    context: AuthenticatedContext,
    endpointId: string
  ): Promise<DiscoverAgentProtocolEndpointResult>;
  listA2ATckRuns(context: AuthenticatedContext): Promise<A2ATckRun[]>;
  runA2ATck(
    context: AuthenticatedContext,
    endpointId: string,
    input: RunA2ATckInput
  ): Promise<A2ATckRun>;
  listAgentDidTrustProfiles(
    context: AuthenticatedContext
  ): Promise<AgentDidTrustProfile[]>;
  createAgentDidTrustProfile(
    context: AuthenticatedContext,
    input: CreateAgentDidTrustProfileInput
  ): Promise<AgentDidTrustProfile>;
  refreshAgentDidTrustProfile(
    context: AuthenticatedContext,
    profileId: string,
    input: RefreshAgentDidTrustProfileInput
  ): Promise<AgentDidTrustProfile>;
  revokeAgentDidTrustProfile(
    context: AuthenticatedContext,
    profileId: string,
    input: RevokeAgentDidTrustProfileInput
  ): Promise<AgentDidTrustProfile>;
  listAgentVerifiableCredentials(
    context: AuthenticatedContext
  ): Promise<AgentVerifiableCredential[]>;
  verifyAgentVerifiableCredential(
    context: AuthenticatedContext,
    input: VerifyAgentVerifiableCredentialInput
  ): Promise<AgentVerifiableCredential>;
  verifyAgentSignedReceipt(
    context: AuthenticatedContext,
    input: VerifyAgentSignedReceiptInput
  ): Promise<AgentSignedReceipt>;
  getExtensionDeveloperWorkspace(
    context: AuthenticatedContext
  ): Promise<ExtensionDeveloperWorkspace>;
  createExtensionProject(
    context: AuthenticatedContext,
    input: CreateExtensionProjectInput
  ): Promise<ExtensionProject>;
  getExtensionScaffold(
    context: AuthenticatedContext,
    projectId: string
  ): Promise<ExtensionScaffold>;
  submitExtensionRelease(
    context: AuthenticatedContext,
    projectId: string,
    input: SubmitExtensionReleaseInput
  ): Promise<ExtensionRelease>;
  reviewExtensionRelease(
    context: AuthenticatedContext,
    releaseId: string,
    input: ReviewExtensionReleaseInput
  ): Promise<ExtensionRelease>;
  activateExtensionRelease(
    context: AuthenticatedContext,
    releaseId: string,
    input: ExtensionLifecycleReasonInput
  ): Promise<ExtensionRelease>;
  rollbackExtensionProject(
    context: AuthenticatedContext,
    projectId: string,
    input: RollbackExtensionProjectInput
  ): Promise<ExtensionRelease>;
  revokeExtensionRelease(
    context: AuthenticatedContext,
    releaseId: string,
    input: ExtensionLifecycleReasonInput
  ): Promise<ExtensionRelease>;
  getSubscriptionOperationsWorkspace(
    context: AuthenticatedContext
  ): Promise<SubscriptionOperationsWorkspace>;
  createSubscriptionLifecycle(
    context: AuthenticatedContext,
    input: CreateSubscriptionLifecycleInput
  ): Promise<SubscriptionOperationsWorkspace>;
  recordSubscriptionRenewal(
    context: AuthenticatedContext,
    input: RecordSubscriptionRenewalInput
  ): Promise<SubscriptionOperationsWorkspace>;
  startSubscriptionGrace(
    context: AuthenticatedContext,
    input: StartSubscriptionGraceInput
  ): Promise<SubscriptionOperationsWorkspace>;
  resolveSubscriptionGrace(
    context: AuthenticatedContext,
    input: ResolveSubscriptionGraceInput
  ): Promise<SubscriptionOperationsWorkspace>;
  scheduleSubscriptionCancellation(
    context: AuthenticatedContext,
    input: ScheduleSubscriptionCancellationInput
  ): Promise<SubscriptionOperationsWorkspace>;
  revokeSubscriptionCancellation(
    context: AuthenticatedContext,
    input: SubscriptionReasonInput
  ): Promise<SubscriptionOperationsWorkspace>;
  reconcileSubscriptionLifecycle(
    context: AuthenticatedContext,
    input: SubscriptionReasonInput
  ): Promise<SubscriptionOperationsWorkspace>;
  listAgentExchangeObjects(
    context: AuthenticatedContext
  ): Promise<AgentExchangeObject[]>;
  getAgentExchangeObject(
    context: AuthenticatedContext,
    objectId: string
  ): Promise<AgentExchangeObject>;
  createAgentExchangeObject(
    context: AuthenticatedContext,
    input: CreateAgentExchangeObjectInput
  ): Promise<AgentExchangeObject>;
  updateAgentExchangeObjectState(
    context: AuthenticatedContext,
    objectId: string,
    input: UpdateAgentExchangeObjectStateInput
  ): Promise<AgentExchangeObject>;
  listConfidentialAttestations(
    context: AuthenticatedContext
  ): Promise<ConfidentialAttestation[]>;
  createConfidentialAttestationChallenge(
    context: AuthenticatedContext,
    input: CreateConfidentialAttestationChallengeInput
  ): Promise<ConfidentialAttestationChallenge>;
  verifyConfidentialAttestation(
    context: AuthenticatedContext,
    input: VerifyConfidentialAttestationInput
  ): Promise<ConfidentialAttestation>;
  getTeeAssuranceWorkspace(
    context: AuthenticatedContext
  ): Promise<TeeAssuranceWorkspace>;
  createTeeAssuranceRequirement(
    context: AuthenticatedContext,
    input: CreateTeeAssuranceRequirementInput
  ): Promise<TeeAssuranceRequirement>;
  evaluateTeeAssurance(
    context: AuthenticatedContext,
    teeAssuranceRequirementId: string,
    input: EvaluateTeeAssuranceInput
  ): Promise<TeeAssuranceRequirement>;
  revokeTeeAssurance(
    context: AuthenticatedContext,
    teeAssuranceRequirementId: string,
    input: RevokeTeeAssuranceInput
  ): Promise<TeeAssuranceRequirement>;
  listVeraisonAttestationSessions(
    context: AuthenticatedContext
  ): Promise<VeraisonAttestationSession[]>;
  createVeraisonAttestationSession(
    context: AuthenticatedContext,
    input: CreateVeraisonAttestationSessionInput
  ): Promise<VeraisonAttestationSession>;
  verifyVeraisonAttestation(
    context: AuthenticatedContext,
    input: VerifyVeraisonAttestationInput
  ): Promise<VerifyVeraisonAttestationResult>;
  getModelGatewayFinOps(
    context: AuthenticatedContext
  ): Promise<ModelGatewayFinOpsSummary>;
  updateModelGatewayFinOps(
    context: AuthenticatedContext,
    input: UpdateModelGatewayFinOpsInput
  ): Promise<ModelGatewayFinOpsSummary>;
  checkReadiness(): Promise<ReadinessResponse>;
  getDeploymentStatus(
    context: AuthenticatedContext
  ): Promise<DeploymentStatusResponse>;
  listJobs(context: AuthenticatedContext, input: ListJobsInput): Promise<Job[]>;
  createClientTenant(
    context: AuthenticatedContext,
    input: CreateClientTenantInput
  ): Promise<ClientTenantResult>;
  createRunnerRegistrationToken(
    context: AuthenticatedContext,
    input: RunnerRegistrationTokenInput
  ): Promise<RunnerRegistrationTokenIssueResponse>;
  createRunnerReachabilityTask(
    context: AuthenticatedContext,
    runnerId: string,
    input: RunnerReachabilityTaskRequest
  ): Promise<RunnerTaskCreationResult>;
  createRunnerCheckTask(
    context: AuthenticatedContext,
    runnerId: string,
    input: RunnerCheckTaskRequest
  ): Promise<RunnerTaskCreationResult>;
  createRunnerMeasuredTask(
    context: AuthenticatedContext,
    runnerId: string,
    input: RunnerMeasuredTaskRequest
  ): Promise<RunnerTaskCreationResult>;
  createRunnerDiscoverTask(
    context: AuthenticatedContext,
    runnerId: string,
    input: RunnerDiscoverTaskRequest
  ): Promise<RunnerTaskCreationResult>;
  createAIApplication(
    context: AuthenticatedContext,
    input: CreateAIApplicationInput
  ): Promise<AIApplication>;
  createControlSource(
    context: AuthenticatedContext,
    input: CreateControlSourceInput
  ): Promise<ControlSource>;
  updateControlSource(
    context: AuthenticatedContext,
    controlSourceId: string,
    input: UpdateControlSourceInput
  ): Promise<ControlSource>;
  createSnapshot(
    context: AuthenticatedContext,
    input: CreateSnapshotInput
  ): Promise<ValidationSnapshot>;
  createRemediation(
    context: AuthenticatedContext,
    input: CreateRemediationInput
  ): Promise<RemediationTask>;
  createControlGapRemediation(
    context: AuthenticatedContext,
    input: CreateControlGapRemediationInput
  ): Promise<RemediationTask>;
  previewRemediationAction(
    context: AuthenticatedContext,
    remediationId: string,
    input: PreviewRemediationActionInput
  ): Promise<RemediationAction>;
  approveRemediationAction(
    context: AuthenticatedContext,
    remediationActionId: string,
    input: ConfirmRemediationActionInput
  ): Promise<RemediationAction>;
  executeRemediationAction(
    context: AuthenticatedContext,
    remediationActionId: string,
    input: ConfirmRemediationActionInput
  ): Promise<RemediationAction>;
  rollbackRemediationAction(
    context: AuthenticatedContext,
    remediationActionId: string,
    input: ConfirmRemediationActionInput
  ): Promise<RemediationAction>;
  previewInfrastructureChange(
    context: AuthenticatedContext,
    remediationId: string,
    input: PreviewInfrastructureChangeInput
  ): Promise<InfrastructureChangeRequest>;
  approveInfrastructureChange(
    context: AuthenticatedContext,
    infrastructureChangeRequestId: string,
    input: ConfirmInfrastructureChangeInput
  ): Promise<InfrastructureChangeRequest>;
  executeInfrastructureChange(
    context: AuthenticatedContext,
    infrastructureChangeRequestId: string,
    input: ConfirmInfrastructureChangeInput
  ): Promise<InfrastructureChangeRequest>;
  refreshInfrastructureChange(
    context: AuthenticatedContext,
    infrastructureChangeRequestId: string
  ): Promise<InfrastructureChangeRequest>;
  rollbackInfrastructureChange(
    context: AuthenticatedContext,
    infrastructureChangeRequestId: string,
    input: ConfirmInfrastructureChangeInput
  ): Promise<InfrastructureChangeRequest>;
  getPrescriptivePlan(
    context: AuthenticatedContext,
    remediationId: string
  ): Promise<PrescriptivePlan>;
  /**
   * Preferred: plan + mark-ready + revalidate. Never applies config
   * (`actionApplied` is always false).
   */
  autoRevalidate(
    context: AuthenticatedContext,
    remediationId: string
  ): Promise<AutoRevalidateResult>;
  /** @deprecated Prefer autoRevalidate — legacy alias for API back-compat. */
  autoMitigate(
    context: AuthenticatedContext,
    remediationId: string
  ): Promise<AutoRevalidateResult>;
  createRemediationTicket(
    context: AuthenticatedContext,
    remediationId: string,
    input: CreateRemediationTicketInput
  ): Promise<RemediationTicketResult>;
  syncRemediationTicket(
    context: AuthenticatedContext,
    remediationId: string,
    input: SyncRemediationTicketInput
  ): Promise<RemediationTicketStateResult>;
  // Simulator, review-only playbook exports, ticket payloads, tripwires, and trends.
  simulateRemediation(
    remediationId: string,
    proposedFix: string,
    currentRiskScore?: number
  ): RemediationSimulationResult;
  generatePlaybooks(remediation: RemediationPlaybookInput): PlaybookArtifacts;
  createTripwire(remediationId: string): TripwireConfig;
  getFixTrends(pastVerifs: RemediationTrendInput[]): FixEffectivenessTrend[];
  createMission(
    context: AuthenticatedContext,
    input: CreateMissionInput
  ): Promise<ValidationMission>;
  getCommunityValidationSuite(
    context: AuthenticatedContext,
    input: { includeExternalPoa?: boolean; scopeId?: string }
  ): Promise<import("@periscan/shared").CommunityValidationSuiteResponse>;
  getCommunityValidationCompanion(
    context: AuthenticatedContext,
    missionId: string
  ): Promise<import("@periscan/shared").CommunityValidationCompanion>;
  createCommunityMissionRemediations(
    context: AuthenticatedContext,
    missionId: string
  ): Promise<import("@periscan/shared").CommunityMissionRemediationsResult>;
  startCommunityValidation(
    context: AuthenticatedContext,
    input: import("@periscan/shared").StartCommunityValidationRequest
  ): Promise<import("@periscan/shared").CommunityValidationStartResult>;
  cancelMission(
    context: AuthenticatedContext,
    missionId: string
  ): Promise<ValidationMission>;
  createIntegration(
    context: AuthenticatedContext,
    input: CreateIntegrationInput
  ): Promise<Integration>;
  importThreatAdvisory(
    context: AuthenticatedContext,
    input: ImportThreatAdvisoryInput
  ): Promise<ThreatAdvisoryDetail>;
  ingestThreatFeed(
    context: AuthenticatedContext,
    input: ThreatFeedIngestionInput
  ): Promise<ThreatFeedIngestionResult>;
  setThreatFeedSchedule(
    context: AuthenticatedContext,
    input: { frequency: MissionSchedule["frequency"] | null }
  ): Promise<{
    frequency: string | null;
    nextThreatFeedIngestAt: string | null;
  }>;
  getThreatFeedSchedule(context: AuthenticatedContext): Promise<{
    frequency: string | null;
    nextThreatFeedIngestAt: string | null;
  }>;
  runDueThreatFeedIngestion(context: AuthenticatedContext): Promise<{
    advisoryCount: number;
    ingested: boolean;
    ranAt: string;
  }>;
  createScope(
    context: AuthenticatedContext,
    input: CreateScopeInput
  ): Promise<Scope>;
  updateScopeClassification(
    context: AuthenticatedContext,
    scopeId: string,
    input: UpdateScopeClassificationInput
  ): Promise<Scope>;
  createReport(
    context: AuthenticatedContext,
    input: CreateReportInput
  ): Promise<EvidencePack>;
  createSchedule(
    context: AuthenticatedContext,
    input: CreateScheduleInput
  ): Promise<MissionSchedule>;
  updateSchedule(
    context: AuthenticatedContext,
    scheduleId: string,
    input: UpdateScheduleInput
  ): Promise<MissionSchedule>;
  deleteSchedule(
    context: AuthenticatedContext,
    scheduleId: string
  ): Promise<void>;
  createReportShareLink(
    context: AuthenticatedContext,
    reportId: string
  ): Promise<ReportShareLink | null>;
  listReportShareLinks(
    context: AuthenticatedContext,
    reportId: string
  ): Promise<ReportShareGrant[]>;
  revokeReportShareLink(
    context: AuthenticatedContext,
    reportId: string,
    reportShareId: string
  ): Promise<ReportShareGrant | null>;
  deleteIntegration(
    context: AuthenticatedContext,
    integrationId: string
  ): Promise<void>;
  deleteScope(context: AuthenticatedContext, scopeId: string): Promise<void>;
  downloadEvidence(
    context: AuthenticatedContext,
    evidenceId: string
  ): Promise<EvidenceDownloadResult | null>;
  exportReport(
    context: AuthenticatedContext,
    reportId: string,
    input?: ExportReportInput
  ): Promise<ReportExportResult | null>;
  exportAdvisoryReadinessReport(
    context: AuthenticatedContext,
    threatAdvisoryId: string,
    input?: ExportReportInput
  ): Promise<ReportExportResult | null>;
  getEvidence(
    context: AuthenticatedContext,
    evidenceId: string
  ): Promise<EvidenceArtifact | null>;
  verifyEvidenceChain(
    context: AuthenticatedContext
  ): Promise<EvidenceChainVerificationReport>;
  verifyEvidenceIntegrity(
    context: AuthenticatedContext,
    evidenceId: string
  ): Promise<EvidenceArtifactVerification | null>;
  getAIApplication(
    context: AuthenticatedContext,
    aiAppId: string
  ): Promise<AIApplication | null>;
  getMission(
    context: AuthenticatedContext,
    missionId: string
  ): Promise<ValidationMission | null>;
  getMissionRun(
    context: AuthenticatedContext,
    missionId: string,
    runId: string
  ): Promise<ValidationRun | null>;
  /**
   * Long-poll a validation run until it reaches a terminal status or the
   * timeout elapses. timeoutMs is capped at 60s (default 30s).
   */
  waitMissionRun(
    context: AuthenticatedContext,
    missionId: string,
    runId: string,
    input?: { timeoutMs?: number }
  ): Promise<{ run: ValidationRun; timedOut: boolean } | null>;
  getJob(context: AuthenticatedContext, jobId: string): Promise<Job | null>;
  getIntegration(
    context: AuthenticatedContext,
    integrationId: string
  ): Promise<Integration | null>;
  getReport(
    context: AuthenticatedContext,
    reportId: string
  ): Promise<EvidencePack | null>;
  getEvidencePack(
    context: AuthenticatedContext,
    packId: string
  ): Promise<EvidencePack | null>;
  getRunner(
    context: AuthenticatedContext,
    runnerId: string
  ): Promise<RunnerRecord | null>;
  getAttackPath(
    context: AuthenticatedContext,
    pathId: string
  ): Promise<AttackPathAssessment | null>;
  requestAttackPathVerification(
    context: AuthenticatedContext,
    pathId: string,
    input: VerifyAttackPathInput
  ): Promise<AttackPathVerificationRequest>;
  getAttackPathValidationPlan(
    context: AuthenticatedContext,
    pathId: string
  ): Promise<AttackPathValidationPlan>;
  listAttackPathEdgeReceipts(
    context: AuthenticatedContext,
    pathId: string
  ): Promise<PathEdgeReceipt[]>;
  getAttackPathMeasurementState(
    context: AuthenticatedContext,
    pathId: string
  ): Promise<AttackPathMeasurementState>;
  /**
   * Signal + hop-measurement driven next recommended mission for a path.
   * Persists an advisory proposal; never queues. Null when no honest evidence.
   */
  getAttackPathNextMission(
    context: AuthenticatedContext,
    pathId: string
  ): Promise<DynamicPathMissionRecommendation | null>;
  /**
   * Human approval gate for the path next-mission recommendation.
   * Creates a Draft mission only (queued=false).
   */
  approveAttackPathNextMission(
    context: AuthenticatedContext,
    pathId: string
  ): Promise<DynamicPathMissionApprovalResult>;
  applyPathEdgeReceipt(
    context: AuthenticatedContext,
    pathId: string,
    edgeId: string,
    input: ApplyPathEdgeReceiptInput
  ): Promise<ApplyPathEdgeReceiptResult>;
  launchPathEdgeValidation(
    context: AuthenticatedContext,
    pathId: string,
    edgeId: string,
    input: LaunchPathEdgeValidationInput
  ): Promise<PathEdgeValidationLaunchResult>;
  getAttackTechnique(techniqueId: string): Promise<AttackTechnique | null>;
  getControlSource(
    context: AuthenticatedContext,
    controlSourceId: string
  ): Promise<ControlSource | null>;
  getControlRuleCoverage(
    context: AuthenticatedContext
  ): Promise<ControlRuleCoverageSummary>;
  getControlSourceRuleCoverage(
    context: AuthenticatedContext,
    controlSourceId: string
  ): Promise<ControlRuleCoverageSummary | null>;
  getIntegrationCatalog(): Promise<ReturnType<typeof getConnectorCatalog>>;
  getExternalValidationProfiles(): Promise<
    ExternalValidationTemplateProfileMetadata[]
  >;
  listExternalValidationAttempts(
    context: AuthenticatedContext
  ): Promise<Array<{ mission: ValidationMission; runs: ValidationRun[] }>>;
  getIntegrationHealth(
    context: AuthenticatedContext,
    integrationId: string
  ): Promise<IntegrationHealthResult>;
  getModuleCatalog(): Promise<ModuleManifest[]>;
  getOpenSourceCapabilities(filters?: {
    includeDeferred?: boolean;
    includeLegalReview?: boolean;
    phase?: "Current" | "CurrentMvp" | "NearTerm" | "LaterPhase" | "all";
  }): Promise<OpenSourceCapability[]>;
  getOpenSourceTool(
    toolId: OpenSourceToolId
  ): Promise<OpenSourceToolCatalogEntry | null>;
  getOpenSourceToolCatalog(filters?: {
    includeDeferred?: boolean;
    includeLegalReview?: boolean;
    phase?: "Current" | "CurrentMvp" | "NearTerm" | "LaterPhase" | "all";
  }): Promise<OpenSourceToolCatalogEntry[]>;
  listThirdPartyTools(context: AuthenticatedContext): Promise<ThirdPartyTool[]>;
  getThirdPartyTool(
    context: AuthenticatedContext,
    toolId: OpenSourceToolId
  ): Promise<ThirdPartyTool | null>;
  getThirdPartyToolCoverageAudit(
    context: AuthenticatedContext
  ): Promise<ThirdPartyToolCoverageAudit>;
  checkThirdPartyTool(
    context: AuthenticatedContext,
    toolId: OpenSourceToolId
  ): Promise<ThirdPartyTool>;
  installThirdPartyTool(
    context: AuthenticatedContext,
    toolId: OpenSourceToolId,
    input: ThirdPartyToolInstallRequest
  ): Promise<ToolInstallJob>;
  acceptToolLicense(
    context: AuthenticatedContext,
    input: AcceptToolLicenseRequest
  ): Promise<ToolLicenseAcceptance>;
  listToolLicenseAcceptances(
    context: AuthenticatedContext,
    query?: ListToolLicenseAcceptancesQuery
  ): Promise<ToolLicenseAcceptance[]>;
  getThirdPartyToolInstallPlan(
    context: AuthenticatedContext,
    toolId: OpenSourceToolId
  ): Promise<ThirdPartyToolInstallPlan>;
  enableThirdPartyTool(
    context: AuthenticatedContext,
    toolId: OpenSourceToolId,
    input: ThirdPartyToolEnableRequest
  ): Promise<ThirdPartyTool>;
  uninstallThirdPartyTool(
    context: AuthenticatedContext,
    toolId: OpenSourceToolId
  ): Promise<ToolInstallJob>;
  disableThirdPartyTool(
    context: AuthenticatedContext,
    toolId: OpenSourceToolId,
    input: ThirdPartyToolDisableRequest
  ): Promise<ThirdPartyTool>;
  listThirdPartyToolJobs(
    context: AuthenticatedContext,
    toolId: OpenSourceToolId
  ): Promise<ToolInstallJob[]>;
  listThirdPartyToolActivity(
    context: AuthenticatedContext,
    toolId: OpenSourceToolId,
    limit?: number
  ): Promise<ThirdPartyToolActivityEvent[]>;
  getThirdPartyToolRunnerEligibility(
    context: AuthenticatedContext,
    toolId: OpenSourceToolId
  ): Promise<ThirdPartyToolRunnerEligibility>;
  dispatchThirdPartyToolRunnerTask(
    context: AuthenticatedContext,
    toolId: OpenSourceToolId,
    input: ThirdPartyToolRunnerDispatchRequest
  ): Promise<ThirdPartyToolRunnerDispatchResponse>;
  submitThirdPartyToolCandidate(
    context: AuthenticatedContext,
    input: ToolIntakeManifestRequest
  ): Promise<ThirdPartyToolCandidate>;
  importThirdPartyToolCandidates(
    context: AuthenticatedContext,
    input: ThirdPartyToolCandidateImportRequest
  ): Promise<ThirdPartyToolCandidateImportResponse>;
  listThirdPartyToolCandidates(
    context: AuthenticatedContext
  ): Promise<ThirdPartyToolCandidate[]>;
  getThirdPartyToolCandidate(
    context: AuthenticatedContext,
    candidateId: string
  ): Promise<ThirdPartyToolCandidate | null>;
  getThirdPartyToolCandidateReadiness(
    context: AuthenticatedContext,
    candidateId: string
  ): Promise<ThirdPartyToolCandidateReadiness | null>;
  getThirdPartyToolCandidateReadinessSummary(
    context: AuthenticatedContext
  ): Promise<ThirdPartyToolCandidateReadinessSummary>;
  reviewThirdPartyToolCandidate(
    context: AuthenticatedContext,
    candidateId: string,
    input: ReviewThirdPartyToolCandidateRequest
  ): Promise<ThirdPartyToolCandidate | null>;
  listThirdPartyToolImplementationWorkOrders(
    context: AuthenticatedContext,
    candidateId: string
  ): Promise<ThirdPartyToolImplementationWorkOrder[] | null>;
  generateThirdPartyToolImplementationWorkOrder(
    context: AuthenticatedContext,
    candidateId: string
  ): Promise<ThirdPartyToolImplementationWorkOrder | null>;
  getThirdPartyToolImplementationBundle(
    context: AuthenticatedContext,
    candidateId: string,
    workOrderId: string
  ): Promise<ThirdPartyToolImplementationBundle | null>;
  listThirdPartyToolPromotionPackages(
    context: AuthenticatedContext,
    candidateId: string
  ): Promise<ThirdPartyToolPromotionPackage[] | null>;
  generateThirdPartyToolPromotionPackage(
    context: AuthenticatedContext,
    candidateId: string
  ): Promise<ThirdPartyToolPromotionPackage | null>;
  getThirdPartyToolPromotionHandoff(
    context: AuthenticatedContext,
    candidateId: string,
    promotionPackageId: string
  ): Promise<ThirdPartyToolPromotionHandoff | null>;
  getThirdPartyToolPromotionCertification(
    context: AuthenticatedContext,
    candidateId: string,
    promotionPackageId: string
  ): Promise<ThirdPartyToolPromotionCertification | null>;
  listThirdPartyToolPromotionCertifications(
    context: AuthenticatedContext,
    candidateId: string,
    promotionPackageId: string
  ): Promise<ThirdPartyToolPromotionCertification[] | null>;
  generateThirdPartyToolPromotionCertification(
    context: AuthenticatedContext,
    candidateId: string,
    promotionPackageId: string
  ): Promise<ThirdPartyToolPromotionCertification | null>;
  listThirdPartyToolUpstreamVersionChecks(
    context: AuthenticatedContext,
    toolId: OpenSourceToolId
  ): Promise<ThirdPartyToolUpstreamVersionCheck[]>;
  checkThirdPartyToolUpstreamVersion(
    context: AuthenticatedContext,
    toolId: OpenSourceToolId
  ): Promise<ThirdPartyToolUpstreamVersionCheck>;
  listThirdPartyToolUpdateRecommendations(
    context: AuthenticatedContext,
    toolId: OpenSourceToolId
  ): Promise<ThirdPartyToolUpdateRecommendation[]>;
  checkThirdPartyToolUpdateRecommendation(
    context: AuthenticatedContext,
    toolId: OpenSourceToolId
  ): Promise<ThirdPartyToolUpdateRecommendation>;
  refreshDueThirdPartyTools(
    context: AuthenticatedContext,
    input?: Partial<ThirdPartyToolRefreshDueRequest>
  ): Promise<ThirdPartyToolRefreshDueResponse>;
  applyThirdPartyToolUpdateRecommendation(
    context: AuthenticatedContext,
    toolId: OpenSourceToolId,
    recommendationId: string,
    input: ApplyThirdPartyToolUpdateRequest
  ): Promise<ThirdPartyToolUpdateRecommendation | null>;
  dismissThirdPartyToolUpdateRecommendation(
    context: AuthenticatedContext,
    toolId: OpenSourceToolId,
    recommendationId: string,
    reason?: string
  ): Promise<ThirdPartyToolUpdateRecommendation | null>;
  getThirdPartyToolLicenseSummary(
    context: AuthenticatedContext
  ): Promise<ThirdPartyToolLicenseSummary>;
  validateThirdPartyToolIntake(
    context: AuthenticatedContext,
    input: ToolIntakeManifestRequest
  ): Promise<ToolIntakeValidationReport>;
  getOperatorProfiles(): Promise<OperatorProfile[]>;
  getOperatorRecommendations(
    context: AuthenticatedContext
  ): Promise<OperatorRecommendation[]>;
  listOperatorRecommendationRecords(
    context: AuthenticatedContext
  ): Promise<OperatorRecommendationRecord[]>;
  createOperatorRecommendationRecord(
    context: AuthenticatedContext,
    input: CreateOperatorRecommendationRecordInput
  ): Promise<OperatorRecommendationRecord>;
  approveOperatorRecommendation(
    context: AuthenticatedContext,
    recommendationId: string
  ): Promise<OperatorRecommendationApprovalResult>;
  generateEvidenceSummary(
    context: AuthenticatedContext,
    input: GenerateEvidenceSummaryInput
  ): Promise<EvidenceGroundedSummary>;
  getScope(
    context: AuthenticatedContext,
    scopeId: string
  ): Promise<Scope | null>;
  getRemediation(
    context: AuthenticatedContext,
    remediationId: string
  ): Promise<RemediationTask | null>;
  getSchedule(
    context: AuthenticatedContext,
    scheduleId: string
  ): Promise<MissionScheduleDetail | null>;
  listVerificationEvents(
    context: AuthenticatedContext,
    remediationId: string
  ): Promise<VerificationEvent[]>;
  markRemediationReadyForVerification(
    context: AuthenticatedContext,
    remediationId: string
  ): Promise<RemediationTask>;
  pauseSchedule(
    context: AuthenticatedContext,
    scheduleId: string
  ): Promise<MissionSchedule>;
  resumeSchedule(
    context: AuthenticatedContext,
    scheduleId: string
  ): Promise<MissionSchedule>;
  runDueSchedules(
    context: AuthenticatedContext
  ): Promise<DueScheduleRunSummary>;
  runSchedule(
    context: AuthenticatedContext,
    scheduleId: string
  ): Promise<ScheduledRunResult>;
  getSnapshot(
    context: AuthenticatedContext,
    snapshotId: string
  ): Promise<ValidationSnapshot | null>;
  getSnapshotReportHtml(
    context: AuthenticatedContext,
    snapshotId: string
  ): Promise<string | null>;
  getSharedReportByToken(
    token: string
  ): Promise<PublicSharedReportResult | null>;
  getSessionContext(
    session: SessionClaims,
    requestedTenantId?: string
  ): Promise<AuthenticatedContext | null>;
  getTenantContext(
    context: AuthenticatedContext
  ): Promise<Pick<AuthenticatedContext, "membership" | "tenant">>;
  getProductActivationState(
    context: AuthenticatedContext
  ): Promise<ProductActivationState>;
  getProductWorkQueue(context: AuthenticatedContext): Promise<ProductWorkQueue>;
  getBlueShiftBrief(context: AuthenticatedContext): Promise<BlueShiftBrief>;
  updateProductExperienceProfile(
    context: AuthenticatedContext,
    input: UpdateProductExperienceProfileInput
  ): Promise<ProductExperienceProfile>;
  submitProductFeedback(
    context: AuthenticatedContext,
    input: SubmitProductFeedbackInput
  ): Promise<ProductFeedback>;
  getClientPortfolio(
    context: AuthenticatedContext
  ): Promise<MSSPClientPortfolio>;
  getTenantBranding(
    context: AuthenticatedContext
  ): Promise<TenantReportBranding>;
  getTenantLocalization(
    context: AuthenticatedContext
  ): Promise<TenantLocalization>;
  getTenantLocalizationWorkspace(
    context: AuthenticatedContext
  ): Promise<TenantLocalizationWorkspace>;
  previewTenantLocalization(
    context: AuthenticatedContext,
    input: PreviewTenantLocalizationInput
  ): Promise<LocalizationFormatPreview>;
  getTenantSsoConfig(
    context: AuthenticatedContext
  ): Promise<TenantSsoConfig | null>;
  getTenantSsoMetadata(context: AuthenticatedContext): Promise<string>;
  updateTenantSsoConfig(
    context: AuthenticatedContext,
    input: UpdateTenantSsoConfigInput
  ): Promise<TenantSsoConfig>;
  disableTenantSsoConfig(context: AuthenticatedContext): Promise<void>;
  buildTenantSsoAuthorizationUrl(
    context: AuthenticatedContext,
    input: TenantSsoAuthorizationUrlInput
  ): Promise<TenantSsoAuthorizationUrl>;
  startTenantSsoLogin(
    input: StartTenantSsoLoginInput
  ): Promise<TenantSsoLoginStartResult>;
  completeTenantSsoLogin(
    input: CompleteTenantSsoLoginInput
  ): Promise<AuthenticatedContext>;
  getDesignPartnerWorkspace(
    context: AuthenticatedContext
  ): Promise<DesignPartnerWorkspace>;
  appendDesignPartnerSessionNote(
    context: AuthenticatedContext,
    input: AppendDesignPartnerSessionNoteInput
  ): Promise<DesignPartnerSessionNote>;
  getExecutiveTrends(
    context: AuthenticatedContext
  ): Promise<ExecutiveTrendSummary>;
  getExecutiveTrendSeries(
    context: AuthenticatedContext
  ): Promise<ExecutiveTrendSeries>;
  captureExecutiveTrendSnapshot(
    context: AuthenticatedContext
  ): Promise<{ captured: boolean }>;
  getOperationalMetrics(
    context: AuthenticatedContext
  ): Promise<TenantOperationalMetrics>;
  getReportAnalystNote(
    context: AuthenticatedContext,
    reportId: string
  ): Promise<DesignPartnerReportNote | null>;
  updateTenantBranding(
    context: AuthenticatedContext,
    input: UpdateTenantBrandingInput
  ): Promise<TenantReportBranding>;
  updateTenantLocalization(
    context: AuthenticatedContext,
    input: UpdateTenantLocalizationInput
  ): Promise<TenantLocalization>;
  updateDesignPartnerSettings(
    context: AuthenticatedContext,
    input: UpdateDesignPartnerSettingsInput
  ): Promise<TenantDesignPartnerSettings>;
  getSignalTriggerRoutingSettings(
    context: AuthenticatedContext
  ): Promise<SignalTriggerRoutingSettings>;
  updateSignalTriggerRoutingSettings(
    context: AuthenticatedContext,
    input: UpdateSignalTriggerRoutingSettingsInput
  ): Promise<SignalTriggerRoutingSettings>;
  updateReportAnalystNote(
    context: AuthenticatedContext,
    reportId: string,
    input: UpdateReportAnalystNoteInput
  ): Promise<DesignPartnerReportNote>;
  getBillingMeters(
    context: AuthenticatedContext
  ): Promise<UsageMeterDefinition[]>;
  getBillingPackages(context: AuthenticatedContext): Promise<BillingPackage[]>;
  getBillingUsage(context: AuthenticatedContext): Promise<BillingUsage>;
  getActiveBillingPackage(
    context: AuthenticatedContext
  ): Promise<BillingPackage | null>;
  getTenantTrial(context: AuthenticatedContext): Promise<TenantTrial>;
  startTenantTrial(
    context: AuthenticatedContext,
    input: StartTenantTrialInput
  ): Promise<TenantTrial>;
  convertTenantTrial(
    context: AuthenticatedContext,
    input: ConvertTenantTrialInput
  ): Promise<TenantTrial>;
  cancelTenantTrial(
    context: AuthenticatedContext,
    input: CancelTenantTrialInput
  ): Promise<TenantTrial>;
  resolveAwsMarketplaceRegistration(
    registrationToken: string
  ): Promise<AwsMarketplaceRegistrationResolution>;
  getAwsMarketplaceStatus(
    context: AuthenticatedContext
  ): Promise<AwsMarketplaceStatus>;
  claimAwsMarketplaceRegistration(
    context: AuthenticatedContext,
    input: ClaimAwsMarketplaceRegistrationInput
  ): Promise<AwsMarketplaceStatus>;
  refreshAwsMarketplaceEntitlements(
    context: AuthenticatedContext
  ): Promise<AwsMarketplaceStatus>;
  syncAwsMarketplaceMetering(
    context: AuthenticatedContext
  ): Promise<AwsMarketplaceMeteringSyncResult>;
  getComplianceGovernance(
    context: AuthenticatedContext,
    framework: ComplianceFrameworkKey
  ): Promise<ComplianceGovernanceInventory>;
  getComplianceGovernanceSummary(
    context: AuthenticatedContext
  ): Promise<
    import("@periscan/shared").ComplianceGovernanceMultiFrameworkSummary
  >;
  updateComplianceControlGovernance(
    context: AuthenticatedContext,
    input: UpdateComplianceControlGovernanceInput
  ): Promise<ComplianceGovernanceInventory>;
  batchUpdateComplianceGovernance(
    context: AuthenticatedContext,
    input: import("@periscan/shared").BatchComplianceGovernanceInput
  ): Promise<import("@periscan/shared").BatchComplianceGovernanceResult>;
  exportMultiFrameworkCompliancePacks(
    context: AuthenticatedContext,
    input: import("@periscan/shared").MultiFrameworkComplianceExportInput
  ): Promise<import("@periscan/shared").MultiFrameworkComplianceExportResult>;
  listComplianceGovernanceChanges(
    context: AuthenticatedContext,
    framework: ComplianceFrameworkKey,
    controlId?: string
  ): Promise<ComplianceGovernanceChange[]>;
  createTenantIsolationProof(
    context: AuthenticatedContext
  ): Promise<TenantIsolationProof>;
  inviteToCurrentTenant(
    context: AuthenticatedContext,
    input: InviteInput
  ): Promise<{
    membership: Membership;
    user: User;
  }>;
  listAuditEvents(
    context: AuthenticatedContext,
    input: ListAuditEventsInput
  ): Promise<AuditEvent[]>;
  listValidatedFindings(
    context: AuthenticatedContext,
    filters?: ValidatedFindingFilter
  ): Promise<ValidatedFinding[]>;
  getValidatedFinding(
    context: AuthenticatedContext,
    findingId: string
  ): Promise<ValidatedFinding | null>;
  transitionFinding(
    context: AuthenticatedContext,
    findingId: string,
    input: TransitionFindingInput
  ): Promise<ValidatedFinding>;
  listDispositionFeedback(
    context: AuthenticatedContext
  ): Promise<DispositionFeedbackSummary>;
  approveFindingRisk(
    context: AuthenticatedContext,
    findingId: string
  ): Promise<ValidatedFinding>;
  getTrustSafetySummary(
    context: AuthenticatedContext
  ): Promise<TrustSafetySummary>;
  listAttackPaths(
    context: AuthenticatedContext
  ): Promise<AttackPathAssessment[]>;
  getAttackPathChokePointAnalysis(
    context: AuthenticatedContext
  ): Promise<AttackPathChokePointAnalysis>;
  listAssets(context: AuthenticatedContext): Promise<Asset[]>;
  getAssetOwnershipSurface(
    context: AuthenticatedContext
  ): Promise<AssetOwnershipSurface>;
  getDataFabricQualitySurface(
    context: AuthenticatedContext
  ): Promise<DataFabricQualitySurface>;
  importScanFile(
    context: AuthenticatedContext,
    input: ImportScanFileInput
  ): Promise<ScanImportResult>;
  reviewAssetOwnershipCandidate(
    context: AuthenticatedContext,
    assetId: string,
    input: ReviewAssetOwnershipCandidateInput
  ): Promise<AssetOwnershipReview>;
  getAssetLineage(
    context: AuthenticatedContext,
    assetId: string
  ): Promise<AssetLineage | null>;
  updateAssetValuation(
    context: AuthenticatedContext,
    assetId: string,
    input: AssetValuationInput
  ): Promise<Asset>;
  getBusinessImpactWorkspace(
    context: AuthenticatedContext
  ): Promise<BusinessImpactWorkspace>;
  previewAssetValuation(
    context: AuthenticatedContext,
    assetId: string,
    input: SubmitAssetValuationVersionInput
  ): Promise<BusinessImpactPreview>;
  submitAssetValuationVersion(
    context: AuthenticatedContext,
    assetId: string,
    input: SubmitAssetValuationVersionInput
  ): Promise<AssetValuationVersion>;
  reviewAssetValuationVersion(
    context: AuthenticatedContext,
    assetId: string,
    valuationVersionId: string,
    input: ReviewAssetValuationVersionInput
  ): Promise<AssetValuationVersion>;
  getAsyncOperationsWorkspace(
    context: AuthenticatedContext
  ): Promise<AsyncOperationsWorkspace>;
  updateAsyncOperationsPolicy(
    context: AuthenticatedContext,
    input: AsyncOperationsPolicyInput
  ): Promise<AsyncOperationsWorkspace>;
  reconcileAsyncOperations(
    context: AuthenticatedContext,
    input: AsyncOperationsReasonInput
  ): Promise<AsyncOperationsReconcileResult>;
  recordAsyncRecoveryDecision(
    context: AuthenticatedContext,
    input: AsyncRecoveryDecisionInput
  ): Promise<AsyncRecoveryDecisionResult>;
  listAttackPathEvidence(
    context: AuthenticatedContext,
    pathId: string
  ): Promise<EvidenceArtifact[]>;
  listAIApplicationHistory(
    context: AuthenticatedContext,
    aiAppId: string
  ): Promise<ValidationRun[]>;
  listAIApplications(context: AuthenticatedContext): Promise<AIApplication[]>;
  listAttackTechniques(): Promise<AttackTechnique[]>;
  listControlSourceHistory(
    context: AuthenticatedContext,
    controlSourceId: string
  ): Promise<ValidationRun[]>;
  listControlSources(context: AuthenticatedContext): Promise<ControlSource[]>;
  runDetectionMarkerProof(
    context: AuthenticatedContext,
    controlSourceId: string,
    input: DetectionMarkerProofInput
  ): Promise<{
    closedLoop: boolean;
    drvClaimClass: "benign_marker_only";
    fullAttackLibrary: false;
    markerId: string;
    mission: ValidationMission;
    outcome: string;
    runs: ValidationRun[];
    summary: string;
    validationState: string | null;
  }>;
  runDnsExfilCanaryProof(
    context: AuthenticatedContext,
    controlSourceId: string,
    input: DnsExfilCanaryProofInput
  ): Promise<{
    canaryFqdn: string;
    canaryLabel: string;
    closedLoop: boolean;
    exfilClaimClass: "benign_marker_only";
    fullExfilLibrary: false;
    markerId: string;
    measured: boolean;
    mission: ValidationMission;
    outcome: string;
    realDataExfiltrated: false;
    runs: ValidationRun[];
    summary: string;
    validationState: string | null;
  }>;
  listSafetyEquivalentPacks(
    context: AuthenticatedContext
  ): Promise<import("@periscan/shared").SafetyEquivalentPacksResponse>;
  getExecutionIntegrityHonesty(
    context: AuthenticatedContext
  ): Promise<import("@periscan/shared").ExecutionIntegrityHonesty>;
  getModelExtractionHonesty(
    context: AuthenticatedContext
  ): Promise<import("@periscan/shared").ModelExtractionHonesty>;
  getPartnerCapabilityHonesty(
    context: AuthenticatedContext
  ): Promise<import("@periscan/shared").PartnerCapabilityHonesty>;
  listValidationStimuli(
    context: AuthenticatedContext
  ): Promise<ValidationStimulus[]>;
  createValidationStimulus(
    context: AuthenticatedContext,
    input: CreateValidationStimulusInput
  ): Promise<CreateValidationStimulusResponse>;
  dispatchValidationStimulus(
    context: AuthenticatedContext,
    stimulusId: string
  ): Promise<ValidationStimulus>;
  observeValidationStimulus(
    context: AuthenticatedContext,
    stimulusId: string
  ): Promise<ValidationStimulus>;
  cancelValidationStimulus(
    context: AuthenticatedContext,
    stimulusId: string
  ): Promise<ValidationStimulus>;
  listIntegrations(context: AuthenticatedContext): Promise<Integration[]>;
  listNonHumanIdentities(
    context: AuthenticatedContext
  ): Promise<NonHumanIdentityInventory>;
  registerNonHumanIdentity(
    context: AuthenticatedContext,
    input: RegisterNonHumanIdentityInput
  ): Promise<NonHumanIdentity>;
  listEvidence(
    context: AuthenticatedContext,
    options?: { limit?: number }
  ): Promise<EvidenceArtifact[]>;
  listMissionRuns(
    context: AuthenticatedContext,
    missionId: string
  ): Promise<ValidationRun[]>;
  listMissions(
    context: AuthenticatedContext,
    input?: ListMissionsInput
  ): Promise<PaginatedResult<ValidationMission>>;
  listRemediations(context: AuthenticatedContext): Promise<RemediationTask[]>;
  listRemediationActions(
    context: AuthenticatedContext,
    remediationId: string
  ): Promise<RemediationAction[]>;
  listInfrastructureChanges(
    context: AuthenticatedContext,
    remediationId: string
  ): Promise<InfrastructureChangeRequest[]>;
  listReports(
    context: AuthenticatedContext,
    options?: { limit?: number }
  ): Promise<EvidencePack[]>;
  listRunners(context: AuthenticatedContext): Promise<RunnerRecord[]>;
  listSchedules(context: AuthenticatedContext): Promise<MissionSchedule[]>;
  listSignalTriggerActivity(
    context: AuthenticatedContext,
    options?: { limit?: number }
  ): Promise<SignalTriggerActivity[]>;
  listSignalTriggers(
    context: AuthenticatedContext
  ): Promise<SignalTriggerRule[]>;
  approveSignalTrigger(
    context: AuthenticatedContext,
    triggerId: string
  ): Promise<SignalTriggerApprovalResponse>;
  listSnapshots(context: AuthenticatedContext): Promise<ValidationSnapshot[]>;
  listClientTenants(context: AuthenticatedContext): Promise<Tenant[]>;
  listScopes(context: AuthenticatedContext): Promise<Scope[]>;
  listThreatAdvisories(
    context: AuthenticatedContext,
    options?: { limit?: number }
  ): Promise<ThreatAdvisory[]>;
  getThreatAdvisory(
    context: AuthenticatedContext,
    threatAdvisoryId: string
  ): Promise<ThreatAdvisoryDetail | null>;
  getAdvisoryReadinessReport(
    context: AuthenticatedContext,
    threatAdvisoryId: string
  ): Promise<AdvisoryReadinessReport | null>;
  // Super-feed: global deduped catalog + feed health (read by any member) and
  // tenant-scoped realtime alerts (status operator-mutable).
  listThreatCatalog(
    context: AuthenticatedContext,
    query: ThreatCatalogQuery
  ): Promise<ThreatIntelItem[]>;
  getThreatFeedStatus(
    context: AuthenticatedContext
  ): Promise<ThreatFeedStatus[]>;
  listThreatAlerts(
    context: AuthenticatedContext,
    options?: { status?: TenantThreatAlertStatus; limit?: number }
  ): Promise<TenantThreatAlert[]>;
  setThreatAlertStatus(
    context: AuthenticatedContext,
    alertId: string,
    status: TenantThreatAlertStatus
  ): Promise<TenantThreatAlert>;
  getCTEMProgramSummary(
    context: AuthenticatedContext
  ): Promise<CTEMProgramSummary>;
  evaluateSignalTriggers(
    context: AuthenticatedContext
  ): Promise<SignalTriggerEvaluationResponse>;
  login(input: LoginInput): Promise<AuthResult | null>;
  previewPolicyDecision(
    context: AuthenticatedContext,
    scopeId: string,
    input: PolicyPreviewInput
  ): Promise<PolicyDecision>;
  recordLogout(context: AuthenticatedContext): Promise<void>;
  requestPasswordReset(input: PasswordResetRequestInput): Promise<void>;
  confirmPasswordReset(
    input: PasswordResetConfirmInput
  ): Promise<PasswordResetConfirmResult>;
  changePassword(
    context: AuthenticatedContext,
    input: ChangePasswordInput
  ): Promise<SessionRotationResult>;
  revokeOtherSessions(
    context: AuthenticatedContext
  ): Promise<SessionRotationResult>;
  acceptInvite(input: AcceptInviteInput): Promise<PasswordResetConfirmResult>;
  verifyEmail(input: VerifyEmailInput): Promise<PasswordResetConfirmResult>;
  enrollMfa(context: AuthenticatedContext): Promise<MfaEnrollResult>;
  verifyMfa(
    context: AuthenticatedContext,
    input: MfaVerifyInput
  ): Promise<MfaVerifyResult>;
  regenerateMfaRecoveryCodes(
    context: AuthenticatedContext,
    input: RegenerateMfaRecoveryCodesInput
  ): Promise<RegenerateMfaRecoveryCodesResult>;
  disableMfa(
    context: AuthenticatedContext,
    input: DisableMfaInput
  ): Promise<DisableMfaResult>;
  registerRunner(
    input: RunnerRegistrationRequest
  ): Promise<RunnerRegisterResult>;
  revokeRunner(
    context: AuthenticatedContext,
    runnerId: string
  ): Promise<RunnerRecord>;
  getRunnerFleetWorkspace(
    context: AuthenticatedContext
  ): Promise<RunnerFleetWorkspace>;
  updateRunnerFleetPolicy(
    context: AuthenticatedContext,
    input: UpdateRunnerFleetPolicyInput
  ): Promise<RunnerFleetPolicy>;
  acknowledgeRunnerControlState(
    runnerId: string,
    authToken: string | null,
    input: RunnerControlStateAcknowledgement,
    clientCertificateSha256?: string | null
  ): Promise<RunnerRecord>;
  runnerHeartbeat(
    runnerId: string,
    authToken: string | null,
    input: RunnerHeartbeat,
    clientCertificateSha256?: string | null
  ): Promise<RunnerRecord>;
  rotateRunnerCredentials(
    runnerId: string,
    authToken: string | null,
    input: RunnerCredentialRotationInput,
    clientCertificateSha256?: string | null
  ): Promise<RunnerCredentialRotationResponse>;
  pollRunnerTasks(
    runnerId: string,
    authToken: string | null,
    input: RunnerPollRequest,
    clientCertificateSha256?: string | null
  ): Promise<RunnerPollResult>;
  setRunnerKillSwitch(
    context: AuthenticatedContext,
    runnerId: string,
    input: RunnerKillSwitchRequest
  ): Promise<RunnerRecord>;
  listRunnerTasks(
    context: AuthenticatedContext,
    runnerId: string
  ): Promise<RunnerTaskRecord[]>;
  acceptRunnerTask(
    runnerId: string,
    taskId: string,
    authToken: string | null,
    input: RunnerTaskAcceptRequest,
    clientCertificateSha256?: string | null
  ): Promise<RunnerTaskRecord>;
  rejectRunnerTask(
    runnerId: string,
    taskId: string,
    authToken: string | null,
    input: RunnerTaskRejectRequest,
    clientCertificateSha256?: string | null
  ): Promise<RunnerTaskRecord>;
  uploadRunnerTaskArtifact(
    runnerId: string,
    taskId: string,
    authToken: string | null,
    input: RunnerTaskArtifactUploadInput,
    clientCertificateSha256?: string | null
  ): Promise<RunnerTaskArtifactUploadResponse>;
  signup(input: SignupInput): Promise<AuthResult>;
  submitRunnerTaskResult(
    runnerId: string,
    taskId: string,
    authToken: string | null,
    input: RunnerTaskResult,
    clientCertificateSha256?: string | null
  ): Promise<RunnerTaskResultReceipt>;
  startMission(
    context: AuthenticatedContext,
    missionId: string,
    input: StartMissionInput,
    // Optional originating request id, threaded onto enqueued job payloads for
    // cross-process log correlation.
    requestId?: string
  ): Promise<MissionStartResult>;
  syncIntegration(
    context: AuthenticatedContext,
    integrationId: string
  ): Promise<IntegrationSyncResult>;
  setIntegrationSyncSchedule(
    context: AuthenticatedContext,
    integrationId: string,
    input: { frequency: ScheduleFrequency | null }
  ): Promise<Integration>;
  runDueIntegrationSyncs(context: AuthenticatedContext): Promise<{
    integrationIds: string[];
    ranAt: string;
    syncedCount: number;
  }>;
  runDueReverifications(context: AuthenticatedContext): Promise<{
    ranAt: string;
    results: Array<{ outcome: string; remediationId: string }>;
    reverifiedCount: number;
  }>;
  validateAIApplication(
    context: AuthenticatedContext,
    aiAppId: string,
    input: ValidateAIApplicationInput
  ): Promise<InlineValidationResult>;
  setAIValidationKillSwitch(
    context: AuthenticatedContext,
    aiAppId: string,
    input: SetAIValidationKillSwitchInput
  ): Promise<AIApplication>;
  validateControlSource(
    context: AuthenticatedContext,
    controlSourceId: string,
    input: ValidateControlSourceInput
  ): Promise<InlineValidationResult>;
  verifyRemediation(
    context: AuthenticatedContext,
    remediationId: string,
    // Optional originating request id, threaded onto the re-validation job.
    requestId?: string
  ): Promise<RemediationVerificationResult>;
  redactEvidence(
    context: AuthenticatedContext,
    evidenceId: string
  ): Promise<EvidenceArtifact>;
  verifyScope(
    context: AuthenticatedContext,
    scopeId: string,
    input: VerifyScopeInput
  ): Promise<Scope>;
  runScopePostureChecks(
    context: AuthenticatedContext,
    scopeId: string,
    input?: ScopePostureCheckInput
  ): Promise<ScopePostureCheckResult>;
  runDuePostureChecks(
    context: AuthenticatedContext
  ): Promise<ScopePostureDueResult>;
}

export interface ScopePostureDueResult {
  postureChecksRun: number;
}

// Built-in measured ControlPlane modules that posture-check a verified external
// (Domain/Subdomain) scope and persist their measured signals as findings.
// Built-in measured ControlPlane modules auto-run against each verified scope by
// the posture sweep. All take a {hostname} target. Most raise Exposure-category
// signals on a measured finding; periscan.well_known_security_txt is an
// informational ControlObservation (a missing disclosure channel is NOT an
// exposure) — it is included for measured coverage, and the posture `exposure`
// flag correctly counts only Exposure-category signals so it is never mislabeled.
export const MEASURED_POSTURE_MODULE_IDS = [
  "periscan.tls_certificate_check",
  "periscan.tls_protocol_audit",
  "periscan.dns_resolution_check",
  "periscan.http_health_check",
  "periscan.http_cookie_security",
  "periscan.http_redirect_enforcement",
  "periscan.http_cors_audit",
  "periscan.dns_email_security_check",
  "periscan.dns_caa_check",
  "periscan.well_known_security_txt"
] as const;

export interface ScopePostureCheckInput {
  // "LiveSafe" runs the real non-invasive network checks. Any other value (or
  // omitted) requests fixture mode, which is ONLY honored in devMode — in
  // production the checks always run live so results cannot be faked.
  executionMode?: "LiveSafe" | "Fixture";
  fixtures?: Record<string, Record<string, unknown>>;
}

export interface ScopePostureCheckResult {
  scopeId: string;
  checks: Array<{
    moduleId: string;
    outcome: string;
    validationState: string | null;
    exposure: boolean;
    signalCount: number;
  }>;
}

type OpenSourceCatalogFilterOptions = {
  includeDeferred?: boolean;
  includeLegalReview?: boolean;
  phase?: "Current" | "CurrentMvp" | "NearTerm" | "LaterPhase" | "all";
};

type OpenSourceCatalogFilters = {
  includeDeferred: boolean;
  includeLegalReview: boolean;
  phase: "Current" | "NearTerm" | "LaterPhase" | "all";
};

export function normalizeOpenSourceCatalogFilters(
  filters: OpenSourceCatalogFilterOptions = {}
): OpenSourceCatalogFilters {
  const phase =
    filters.phase === "CurrentMvp" ? "Current" : (filters.phase ?? "Current");

  return {
    includeDeferred: filters.includeDeferred ?? false,
    includeLegalReview: filters.includeLegalReview ?? false,
    phase
  };
}

export class AppServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string
  ) {
    super(message);
  }
}

interface ExternalValidationRuntimeConfig {
  blockedTargets: string[];
  globalWindowLimit: number;
  killSwitchEnabled: boolean;
  tenantWindowLimit: number;
  windowMs: number;
}

interface ExternalValidationRateState {
  globalTimestamps: number[];
  tenantTimestamps: Map<string, number[]>;
}

function parseIntegerEnv(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getReportShareSecret(env: NodeJS.ProcessEnv = process.env) {
  if (env.PERISCAN_REPORT_SHARE_SECRET) {
    return env.PERISCAN_REPORT_SHARE_SECRET;
  }

  if (env.PERISCAN_DEPLOYMENT_ENVIRONMENT === "production") {
    throw new AppServiceError(
      "Set PERISCAN_REPORT_SHARE_SECRET in production; refusing to sign public report share links with a fallback key.",
      503,
      "report_share_secret_missing"
    );
  }

  return env.PERISCAN_JWT_SECRET ?? "periscan-dev-session-secret";
}

function parseExternalValidationConfig(
  env: NodeJS.ProcessEnv = process.env
): ExternalValidationRuntimeConfig {
  return {
    blockedTargets: (env.PERISCAN_EXTERNAL_VALIDATION_BLOCKED_TARGETS ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    globalWindowLimit: parseIntegerEnv(
      env.PERISCAN_EXTERNAL_VALIDATION_GLOBAL_LIMIT,
      100
    ),
    killSwitchEnabled: env.PERISCAN_EXTERNAL_VALIDATION_KILL_SWITCH === "true",
    tenantWindowLimit: parseIntegerEnv(
      env.PERISCAN_EXTERNAL_VALIDATION_TENANT_LIMIT,
      25
    ),
    windowMs: parseIntegerEnv(
      env.PERISCAN_EXTERNAL_VALIDATION_WINDOW_MS,
      60_000
    )
  };
}

function pruneRateWindow(timestamps: number[], now: number, windowMs: number) {
  return timestamps.filter((timestamp) => now - timestamp < windowMs);
}

function getExternalValidationTargetHostname(target: Record<string, unknown>) {
  return typeof target.hostname === "string" ? target.hostname : null;
}

export function resolveExternalValidationTemplateProfile(
  target: Record<string, unknown>,
  scope: Pick<Scope, "externalValidationProfileId">
) {
  return (
    scope.externalValidationProfileId ??
    (typeof target.templateProfile === "string"
      ? target.templateProfile
      : "safe-baseline")
  );
}

export async function evaluateExternalValidationExecution(input: {
  config: ExternalValidationRuntimeConfig;
  decision: PolicyDecision;
  modules: ModuleManifest[];
  rateState: ExternalValidationRateState;
  scope: Scope;
  target: Record<string, unknown>;
  tenantId: string;
}) {
  const guardedModules = input.modules.filter(
    (module) => module.executionMode === "ExternalPoA"
  );

  if (guardedModules.length === 0) {
    return {
      allowed: true,
      rationale: "No external validation modules selected."
    } as const;
  }

  const hostname = getExternalValidationTargetHostname(input.target);

  if (!hostname) {
    return {
      allowed: false,
      rationale: "External validation requires a target hostname."
    } as const;
  }

  const now = Date.now();
  const globalTimestamps = pruneRateWindow(
    input.rateState.globalTimestamps,
    now,
    input.config.windowMs
  );
  const tenantTimestamps = pruneRateWindow(
    input.rateState.tenantTimestamps.get(input.tenantId) ?? [],
    now,
    input.config.windowMs
  );
  const result = evaluateExternalValidationGuard({
    blockedTargets: input.config.blockedTargets,
    executionEnvironment: input.decision.executionEnvironment,
    globalWindowLimit: input.config.globalWindowLimit,
    globalWindowRequestCount: globalTimestamps.length,
    killSwitchEnabled: input.config.killSwitchEnabled,
    scopeType: input.scope.scopeType,
    scopeValue: input.scope.value,
    scopeVerificationStatus: input.scope.verificationStatus,
    targetHostname: hostname,
    templateProfile: resolveExternalValidationTemplateProfile(
      input.target,
      input.scope
    ),
    tenantWindowLimit: input.config.tenantWindowLimit,
    tenantWindowRequestCount: tenantTimestamps.length
  });

  input.rateState.globalTimestamps = globalTimestamps;
  input.rateState.tenantTimestamps.set(input.tenantId, tenantTimestamps);

  if (!result.allowed) {
    return result;
  }

  // Post-resolve DNS rebinding guard: hostname may look public at string-check
  // time but resolve to 169.254.169.254 / RFC1918 when the executor connects.
  const resolved = await evaluateExternalValidationResolvedTarget(hostname);
  if (!resolved.allowed) {
    return resolved;
  }

  globalTimestamps.push(now);
  tenantTimestamps.push(now);
  input.rateState.globalTimestamps = globalTimestamps;
  input.rateState.tenantTimestamps.set(input.tenantId, tenantTimestamps);

  return result;
}

export const AUDIT_ACTION_TO_DB = {
  signup: "signup",
  login: "login",
  logout: "logout",
  "tenant.created": "tenant_created",
  "tenant.updated": "tenant_updated",
  "tenant.localization_activated": "tenant_localization_activated",
  "integration.connected": "integration_connected",
  "integration.disconnected": "integration_disconnected",
  "integration.synced": "integration_synced",
  "scope.created": "scope_created",
  "scope.classification_updated": "scope_classification_updated",
  "scope.deleted": "scope_deleted",
  "scope.verified": "scope_verified",
  "asset.ownership_reviewed": "asset_ownership_reviewed",
  "asset.valuation_updated": "asset_valuation_updated",
  "asset.valuation_submitted": "asset_valuation_submitted",
  "asset.valuation_reviewed": "asset_valuation_reviewed",
  "policy.decision": "policy_decision",
  "mission.created": "mission_created",
  "mission.started": "mission_started",
  "mission.cancelled": "mission_cancelled",
  "module.executed": "module_executed",
  "evidence.created": "evidence_created",
  "evidence.redacted": "evidence_redacted",
  "report.generated": "report_generated",
  "report.updated": "report_updated",
  "report.shared": "report_shared",
  "report.share_revoked": "report_share_revoked",
  "report.accessed": "report_accessed",
  "remediation.created": "remediation_created",
  "remediation.ticket.created": "remediation_ticket_created",
  "remediation.ticket.synced": "remediation_ticket_synced",
  "remediation.closed_without_evidence": "remediation_closed_without_evidence",
  "non_human_identity.registered": "non_human_identity_registered",
  "non_human_identity.updated": "non_human_identity_updated",
  "remediation.ready_for_verification": "remediation_ready_for_verification",
  "remediation.auto_mitigated": "remediation_auto_mitigated",
  "verification.run": "verification_run",
  "tee_assurance.requirement_created": "tee_assurance_requirement_created",
  "tee_assurance.evaluated": "tee_assurance_evaluated",
  "tee_assurance.revoked": "tee_assurance_revoked",
  "runner.registered": "runner_registered",
  "runner.credentials.rotated": "runner_credentials_rotated",
  "runner.fleet_policy.updated": "runner_fleet_policy_updated",
  "runner.task.executed": "runner_task_executed",
  "runner.task.rejected": "runner_task_rejected",
  "threat_advisory.imported": "threat_advisory_imported",
  "user.invited": "user_invited",
  "role.changed": "role_changed",
  "member.removed": "member_removed",
  "finding.disposition_changed": "finding_disposition_changed",
  "finding.risk_approved": "finding_risk_approved",
  // @ts-expect-error schedule.failed residual audit map key
  "schedule.failed": "schedule_failed",
  "mcp.tool_invoked": "mcp_tool_invoked",
  "offensive_validation.changed": "offensive_validation_changed",
  "destructive_validation.changed": "destructive_validation_changed",
  "api_key.created": "api_key_created",
  "api_key.revoked": "api_key_revoked",
  "api_key.rotated": "api_key_rotated",
  "model_provider.created": "model_provider_created",
  "model_provider.updated": "model_provider_updated",
  "model_provider.deleted": "model_provider_deleted",
  "model_policy.created": "model_policy_created",
  "model_policy.updated": "model_policy_updated",
  "model_policy.deleted": "model_policy_deleted",
  "model_session.created": "model_session_created",
  "model_session.terminated": "model_session_terminated",
  "model_tool.requested": "model_tool_requested",
  "model_tool.allowed": "model_tool_allowed",
  "model_tool.denied": "model_tool_denied",
  "model_tool.executed": "model_tool_executed",
  "model.kill_switch_activated": "model_kill_switch_activated",
  "evidence.retention.purged": "evidence_retention_purged",
  "engagement.run": "engagement_run",
  "engagement.read": "engagement_read",
  "engagement.workspace.created": "engagement_workspace_created",
  "engagement.collaborator.updated": "engagement_collaborator_updated",
  "engagement.collaboration.event_added":
    "engagement_collaboration_event_added",
  "scenario.compiled": "scenario_compiled",
  "scenario.approved": "scenario_approved",
  "scenario.executed": "scenario_executed",
  "scenario.feedback_cycle.started": "scenario_feedback_cycle_started",
  "scenario.feedback_cycle.completed": "scenario_feedback_cycle_completed",
  "scenario.feedback_cycle.failed": "scenario_feedback_cycle_failed",
  "scenario.feedback.stopped": "scenario_feedback_stopped",
  "ai_validation.kill_switch_changed": "ai_validation_kill_switch_changed",
  "remediation_action.previewed": "remediation_action_previewed",
  "remediation_action.approved": "remediation_action_approved",
  "remediation_action.applied": "remediation_action_applied",
  "remediation_action.rolled_back": "remediation_action_rolled_back",
  "password_reset.requested": "password_reset_requested",
  "password_reset.completed": "password_reset_completed",
  "password.changed": "password_changed",
  "sessions.revoked": "sessions_revoked",
  "invite.accepted": "invite_accepted",
  "email.verified": "email_verified",
  "login.failed": "login_failed",
  "queue.tenant_limited": "queue_tenant_limited",
  "mfa.enrolled": "mfa_enrolled",
  "mfa.activated": "mfa_activated",
  "mfa.recovery_used": "mfa_recovery_used",
  "mfa.recovery_regenerated": "mfa_recovery_regenerated",
  "mfa.disabled": "mfa_disabled",
  "webhook.created": "webhook_created",
  "webhook.updated": "webhook_updated",
  "webhook.deleted": "webhook_deleted",
  "webhook.tested": "webhook_tested",
  "webhook.dead_lettered": "webhook_dead_lettered",
  "billing.entitlement_denied": "billing_entitlement_denied",
  "trial.started": "trial_started",
  "trial.expired": "trial_expired",
  "trial.converted": "trial_converted",
  "trial.cancelled": "trial_cancelled",
  "subscription.started": "subscription_started",
  "subscription.renewal_decided": "subscription_renewal_decided",
  "subscription.reconciled": "subscription_reconciled",
  "subscription.grace_started": "subscription_grace_started",
  "subscription.grace_resolved": "subscription_grace_resolved",
  "subscription.cancellation_scheduled": "subscription_cancellation_scheduled",
  "subscription.cancellation_revoked": "subscription_cancellation_revoked",
  "compliance.governance.updated": "compliance_governance_updated",
  "sso_config.updated": "sso_config_updated",
  "sso_config.disabled": "sso_config_disabled",
  "sso.login_started": "sso_login_started",
  "sso.login_completed": "sso_login_completed",
  "sso.login_failed": "sso_login_failed",
  "third_party_tool.checked": "third_party_tool_checked",
  "third_party_tool.install_requested": "third_party_tool_install_requested",
  "third_party_tool.installed": "third_party_tool_installed",
  "third_party_tool.install_failed": "third_party_tool_install_failed",
  "third_party_tool.enabled": "third_party_tool_enabled",
  "third_party_tool.disabled": "third_party_tool_disabled",
  "third_party_tool.enable_denied": "third_party_tool_enable_denied",
  "third_party_tool.intake_validated": "third_party_tool_intake_validated",
  "third_party_tool.intake_submitted": "third_party_tool_intake_submitted",
  "third_party_tool.candidate_batch_imported":
    "third_party_tool_candidate_batch_imported",
  "third_party_tool.candidate_reviewed": "third_party_tool_candidate_reviewed",
  "third_party_tool.work_order_generated":
    "third_party_tool_work_order_generated",
  "third_party_tool.implementation_bundle_generated":
    "third_party_tool_implementation_bundle_generated",
  "third_party_tool.promotion_package_generated":
    "third_party_tool_promotion_package_generated",
  "third_party_tool.promotion_certified":
    "third_party_tool_promotion_certified",
  "third_party_tool.upstream_checked": "third_party_tool_upstream_checked",
  "third_party_tool.update_checked": "third_party_tool_update_checked",
  "third_party_tool.update_applied": "third_party_tool_update_applied",
  "third_party_tool.update_dismissed": "third_party_tool_update_dismissed",
  "third_party_tool.refresh_due_checked":
    "third_party_tool_refresh_due_checked",
  "third_party_tool.runner_dispatched": "third_party_tool_runner_dispatched",
  "third_party_tool.runner_dispatch_denied":
    "third_party_tool_runner_dispatch_denied",
  "third_party_tool.license_accepted": "third_party_tool_license_accepted",
  "extension.project_created": "extension_project_created",
  "extension.release_submitted": "extension_release_submitted",
  "extension.release_reviewed": "extension_release_reviewed",
  "extension.release_activated": "extension_release_activated",
  "extension.release_revoked": "extension_release_revoked",
  "control_source.tuning_changed": "control_source_tuning_changed",
  "validation_stimulus.created": "validation_stimulus_created",
  "validation_stimulus.dispatched": "validation_stimulus_dispatched",
  "validation_stimulus.observed": "validation_stimulus_observed",
  "validation_stimulus.cancelled": "validation_stimulus_cancelled",
  "experience.profile_updated": "experience_profile_updated",
  "experience.feedback_submitted": "experience_feedback_submitted",
  "async_operations.policy_configured": "async_operations_policy_configured",
  "async_operations.reconciled": "async_operations_reconciled",
  "async_operations.recovery_prepared": "async_operations_recovery_prepared",
  "async_operations.terminal_accepted": "async_operations_terminal_accepted"
} as const satisfies Record<AuditEventAction, string>;

const AUDIT_ACTION_FROM_DB = Object.fromEntries(
  Object.entries(AUDIT_ACTION_TO_DB).map(([key, value]) => [value, key])
) as Record<string, AuditEventAction>;

export const INVITE_ROLES = new Set<MembershipRole>([
  "Owner",
  "Admin",
  "MSSPOwner",
  "ClientAdmin"
]);
export const SCOPE_EDITOR_ROLES = new Set<MembershipRole>([
  "Owner",
  "Admin",
  "SecurityEngineer",
  "MSSPOwner",
  "ClientAdmin"
]);
export const INTEGRATION_EDITOR_ROLES = new Set<MembershipRole>([
  "Owner",
  "Admin",
  "SecurityEngineer",
  "MSSPOwner",
  "ClientAdmin"
]);
export const RUNNER_ADMIN_ROLES = new Set<MembershipRole>([
  "Owner",
  "Admin",
  "MSSPOwner",
  "ClientAdmin"
]);
export const TENANT_ADMIN_ROLES = new Set<MembershipRole>([
  "Owner",
  "Admin",
  "MSSPOwner",
  "ClientAdmin"
]);
export const MSSP_ADMIN_ROLES = new Set<MembershipRole>([
  "Owner",
  "Admin",
  "MSSPOwner"
]);

interface DeploymentConfigDefinition {
  key: string;
  label: string;
  category: DeploymentConfigItem["category"];
  required: boolean;
  isConfigured?: (rawValue: string | null, env: NodeJS.ProcessEnv) => boolean;
  requiredWhen?: (env: NodeJS.ProcessEnv) => boolean;
}

function isPublicHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);

    return (
      parsed.protocol === "https:" &&
      !["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)
    );
  } catch {
    return false;
  }
}

function normalizeProductionCorsOrigin(origin: string): string {
  if (origin === "*" || origin.includes("*")) {
    throw new Error(
      "PERISCAN_CORS_ORIGINS must not include wildcard origins in production."
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new Error(
      "PERISCAN_CORS_ORIGINS must contain valid browser origins."
    );
  }

  const hasPath = parsed.pathname !== "/" && parsed.pathname !== "";
  const hasUnsafeParts =
    parsed.username.length > 0 ||
    parsed.password.length > 0 ||
    parsed.search.length > 0 ||
    parsed.hash.length > 0 ||
    hasPath;

  if (
    parsed.protocol !== "https:" ||
    ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname) ||
    hasUnsafeParts
  ) {
    throw new Error(
      "PERISCAN_CORS_ORIGINS must contain public HTTPS origins without paths, credentials, queries, or fragments in production."
    );
  }

  return parsed.origin;
}

export function normalizeCorsOriginsForDeployment(
  rawValue: string | null | undefined,
  isProduction: boolean
): string[] {
  const origins = (rawValue ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  const normalized = isProduction
    ? origins.map((origin) => normalizeProductionCorsOrigin(origin))
    : origins;

  return [...new Set(normalized)];
}

const DEPLOYMENT_CONFIG_DEFINITIONS: DeploymentConfigDefinition[] = [
  {
    key: "DATABASE_URL",
    label: "Primary database connection",
    category: "Reliability",
    required: true,
    isConfigured: (_rawValue, env) =>
      Boolean(resolveConfiguredDatabaseUrlFromEnv(env)?.trim().length)
  },
  {
    key: "REDIS_URL",
    label: "Queue/Redis connection",
    category: "Reliability",
    required: true,
    isConfigured: (rawValue) => {
      if (!rawValue?.trim().length) {
        return false;
      }

      try {
        redisConnectionOptionsFromUrl(rawValue);
        return true;
      } catch {
        return false;
      }
    }
  },
  {
    key: "PERISCAN_JWT_SECRET",
    label: "Session and token signing secret",
    category: "Security",
    required: true,
    isConfigured: (rawValue, env) => {
      const value = rawValue?.trim() ?? "";

      if (!value) {
        return false;
      }

      return env.PERISCAN_DEPLOYMENT_ENVIRONMENT === "production"
        ? value !== "periscan-dev-session-secret"
        : true;
    }
  },
  {
    key: "PERISCAN_DEV_MODE",
    label: "Development fixture mode disabled",
    category: "Security",
    required: false,
    requiredWhen: (env) =>
      env.PERISCAN_DEPLOYMENT_ENVIRONMENT === "production" &&
      env.PERISCAN_DEV_MODE?.trim().toLowerCase() === "true",
    isConfigured: (rawValue, env) => {
      if (env.PERISCAN_DEPLOYMENT_ENVIRONMENT !== "production") {
        return Boolean(rawValue?.trim().length);
      }

      return rawValue?.trim().toLowerCase() !== "true";
    }
  },
  {
    // Dedicated key for encrypting tenant integration/model credentials at rest
    // (AES-256-GCM). Production refuses fallback keys so customer integration
    // credential rotation is separated from auth-token and model-provider keys.
    key: "PERISCAN_INTEGRATION_CREDENTIAL_KEY",
    label: "Credential encryption key (secrets at rest)",
    category: "Security",
    required: true
  },
  {
    key: "PERISCAN_MODEL_CREDENTIAL_KEY",
    label: "Model-provider credential encryption key",
    category: "Security",
    required: true
  },
  {
    key: "PERISCAN_REPORT_SHARE_SECRET",
    label: "Public report-share token signing secret",
    category: "Security",
    required: true
  },
  {
    key: "PERISCAN_EVIDENCE_S3_ENDPOINT",
    label: "Evidence object storage endpoint",
    category: "Reliability",
    required: true
  },
  {
    key: "PERISCAN_EVIDENCE_S3_BUCKET",
    label: "Evidence object storage bucket",
    category: "Reliability",
    required: true
  },
  {
    key: "PERISCAN_EVIDENCE_S3_ACCESS_KEY_ID",
    label: "Evidence object storage access key",
    category: "Security",
    required: true
  },
  {
    key: "PERISCAN_EVIDENCE_S3_SECRET_ACCESS_KEY",
    label: "Evidence object storage secret key",
    category: "Security",
    required: true
  },
  {
    key: "PERISCAN_EMAIL_TRANSPORT",
    label: "Transactional email transport",
    category: "Reliability",
    required: true,
    isConfigured: (rawValue, env) => {
      const selected = rawValue?.trim().toLowerCase() ?? "";

      if (!selected) {
        return false;
      }

      return env.PERISCAN_DEPLOYMENT_ENVIRONMENT === "production"
        ? selected === "smtp" || selected === "noop"
        : true;
    }
  },
  {
    key: "PERISCAN_WEB_BASE_URL",
    label: "Public web base URL for onboarding links",
    category: "Reliability",
    required: true,
    isConfigured: (rawValue, env) => {
      const value = rawValue?.trim() ?? "";

      if (!value) {
        return false;
      }

      return env.PERISCAN_DEPLOYMENT_ENVIRONMENT === "production"
        ? isPublicHttpsUrl(value)
        : true;
    }
  },
  {
    key: "PERISCAN_CORS_ORIGINS",
    label: "Direct-browser API CORS origin allowlist",
    category: "Security",
    required: false,
    requiredWhen: (env) => Boolean(env.PERISCAN_CORS_ORIGINS?.trim().length),
    isConfigured: (rawValue, env) => {
      const isProduction = env.PERISCAN_DEPLOYMENT_ENVIRONMENT === "production";

      try {
        return (
          normalizeCorsOriginsForDeployment(rawValue, isProduction).length > 0
        );
      } catch {
        return false;
      }
    }
  },
  {
    key: "PERISCAN_EMAIL_FROM",
    label: "Transactional email sender address",
    category: "Reliability",
    required: false,
    requiredWhen: (env) =>
      env.PERISCAN_EMAIL_TRANSPORT?.trim().toLowerCase() === "smtp"
  },
  {
    key: "PERISCAN_SMTP_HOST",
    label: "SMTP host for transactional email",
    category: "Reliability",
    required: false,
    requiredWhen: (env) =>
      env.PERISCAN_EMAIL_TRANSPORT?.trim().toLowerCase() === "smtp"
  },
  {
    key: "PERISCAN_DATABASE_BACKUP_CADENCE",
    label: "Database backup cadence",
    category: "Reliability",
    required: true
  },
  {
    key: "PERISCAN_DATABASE_RESTORE_TESTED_AT",
    label: "Last tested database restore",
    category: "Reliability",
    required: false
  },
  {
    key: "PERISCAN_OBJECT_STORAGE_RETENTION_DAYS",
    label: "Evidence retention window (days)",
    category: "Compliance",
    required: true
  },
  {
    key: "PERISCAN_OBJECT_STORAGE_BACKUP_POLICY",
    label: "Object storage backup policy",
    category: "Reliability",
    required: false
  },
  {
    key: "PERISCAN_REDIS_PERSISTENCE_MODE",
    label: "Redis persistence mode",
    category: "Reliability",
    required: false
  },
  {
    key: "PERISCAN_LOG_AGGREGATION_TARGET",
    label: "Log aggregation target",
    category: "Observability",
    required: true
  },
  {
    key: "PERISCAN_ALERT_ROUTING_TARGET",
    label: "Alert routing target",
    category: "Observability",
    required: true
  },
  {
    key: "PERISCAN_INCIDENT_CONTACT",
    label: "Incident response contact",
    category: "Observability",
    required: true
  },
  {
    key: "PERISCAN_RUNNER_TASK_SIGNING_PRIVATE_KEY_PEM",
    label: "Runner task signing key (Ed25519 PEM)",
    category: "Security",
    required: false,
    requiredWhen: (env) => env.PERISCAN_DEPLOYMENT_ENVIRONMENT === "production",
    isConfigured: (_rawValue, env) => {
      try {
        return Boolean(resolveConfiguredRunnerTaskSigningKeys(env));
      } catch {
        return false;
      }
    }
  },
  {
    key: "PERISCAN_RUNNER_TASK_SIGNING_KEY_ID",
    label: "Runner task signing key ID",
    category: "Security",
    required: false
  }
];

export function resolveEvidenceEndpointEnv(env: NodeJS.ProcessEnv) {
  return (
    env.PERISCAN_EVIDENCE_S3_ENDPOINT ?? env.SUPABASE_STORAGE_ENDPOINT ?? null
  );
}

export function resolveEvidenceBucketEnv(env: NodeJS.ProcessEnv) {
  return env.PERISCAN_EVIDENCE_S3_BUCKET ?? env.SUPABASE_STORAGE_BUCKET ?? null;
}

export function resolveEvidenceAccessKeyEnv(env: NodeJS.ProcessEnv) {
  return (
    env.PERISCAN_EVIDENCE_S3_ACCESS_KEY_ID ??
    env.SUPABASE_STORAGE_ACCESS_KEY_ID ??
    null
  );
}

export function resolveEvidenceSecretKeyEnv(env: NodeJS.ProcessEnv) {
  return (
    env.PERISCAN_EVIDENCE_S3_SECRET_ACCESS_KEY ??
    env.SUPABASE_STORAGE_SECRET_ACCESS_KEY ??
    null
  );
}

function resolveDeploymentConfigValue(
  key: string,
  env: NodeJS.ProcessEnv
): string | null {
  switch (key) {
    case "DATABASE_URL":
      return resolveConfiguredDatabaseUrlFromEnv(env);
    case "PERISCAN_EVIDENCE_S3_ACCESS_KEY_ID":
      return resolveEvidenceAccessKeyEnv(env);
    case "PERISCAN_EVIDENCE_S3_BUCKET":
      return resolveEvidenceBucketEnv(env);
    case "PERISCAN_EVIDENCE_S3_ENDPOINT":
      return resolveEvidenceEndpointEnv(env);
    case "PERISCAN_EVIDENCE_S3_SECRET_ACCESS_KEY":
      return resolveEvidenceSecretKeyEnv(env);
    default:
      return env[key] ?? null;
  }
}

export function parseOptionalLimitEnv(key: string): number | null {
  const parsed = Number.parseInt(process.env[key] ?? "", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text =
    typeof value === "object" ? JSON.stringify(value) : String(value);

  return `"${text.replace(/"/g, '""')}"`;
}

export function auditEventsToCsv(
  events: Array<Record<string, unknown>>
): string {
  const columns = [
    "auditEventId",
    "action",
    "actorType",
    "entityType",
    "entityId",
    "tenantId",
    "userId",
    "createdAt",
    "metadata"
  ];
  const header = columns.join(",");
  const rows = events.map((event) =>
    columns.map((column) => toCsvValue(event[column])).join(",")
  );

  return [header, ...rows].join("\n");
}

export const API_KEY_TOKEN_PREFIX = "psk_";

export function generateApiKeyToken() {
  const secret = createOpaqueToken(API_KEY_TOKEN_PREFIX);

  return {
    keyHash: hashSecret(secret),
    keyPrefix: secret.slice(0, 12),
    secret
  };
}

/**
 * Map API key scopes onto the membership role matrix used by requireRole.
 * Coarse scopes dominate; fine-grained-only keys get the minimum role needed
 * for their capability set (P20-17 / ICP-P1-9).
 *
 * Least privilege: `webhook:admin` and `audit:read` alone do NOT elevate to
 * Admin. Those surfaces use capability gates for API keys (and Admin role for
 * session users). Mapping fine-grained-only keys to Admin would let them pass
 * any requireRole(TENANT_ADMIN_ROLES) surface without matching capabilities
 * (e.g. mint a full `admin` API key).
 */
export function apiKeyRoleForScopes(
  scopes: TenantApiKeyScope[]
): MembershipRole {
  if (scopes.includes("admin")) {
    return "Admin";
  }

  if (
    scopes.includes("write") ||
    scopes.includes("mission:run") ||
    scopes.includes("remediation:write")
  ) {
    return "SecurityEngineer";
  }

  // audit:read / webhook:admin alone (or with read) → Viewer; capability gate
  // is authoritative (requireAuditExportAccess / requireWebhookAdminAccess).
  return "Viewer";
}

/**
 * Enforce fine-grained API key capability for automation least privilege.
 * No-op for session/SSO/password users (apiKeyScopes undefined) — role gates
 * remain authoritative for interactive operators.
 */
export function requireApiKeyCapability(
  context: AuthenticatedContext,
  capability: TenantApiKeyCapability,
  action: string
): void {
  if (!context.apiKeyScopes) {
    return;
  }
  const caps = expandApiKeyCapabilities(context.apiKeyScopes);
  if (!caps.has(capability)) {
    throw new AppServiceError(
      `API key lacks capability ${capability} required to ${action}. Grant ${capability} (or a coarse scope that expands to it: write→mission:run+remediation:write, admin→all).`,
      403,
      "api_key_capability_denied"
    );
  }
}

/**
 * Webhook admin surface (ICP-P1-9):
 * - Session users: Tenant Admin role (Owner/Admin/MSSPOwner/ClientAdmin).
 * - API keys: `webhook:admin` (or coarse `admin`) capability only — role may be
 *   Viewer so webhook-only keys cannot pass other Admin-only requireRole gates.
 */
export function requireWebhookAdminAccess(
  context: AuthenticatedContext,
  action: string
): void {
  if (context.apiKeyScopes) {
    requireApiKeyCapability(context, "webhook:admin", action);
    return;
  }
  requireRole(context.membership.role, TENANT_ADMIN_ROLES, action);
}

/**
 * Audit export surface (ICP-P1-9 residual):
 * - Session users: Tenant Admin role.
 * - API keys: `audit:read` (or coarse `admin`) capability only — role stays
 *   Viewer so audit-only keys cannot pass other Admin-only requireRole gates
 *   (create API keys, force-MFA, invites, SSO, etc.).
 */
export function requireAuditExportAccess(
  context: AuthenticatedContext,
  action: string
): void {
  if (context.apiKeyScopes) {
    requireApiKeyCapability(context, "audit:read", action);
    return;
  }
  requireRole(context.membership.role, TENANT_ADMIN_ROLES, action);
}

export function buildDeploymentStatus(
  env: NodeJS.ProcessEnv = process.env
): DeploymentStatusResponse {
  const items = DEPLOYMENT_CONFIG_DEFINITIONS.map((definition) => {
    const rawValue = resolveDeploymentConfigValue(definition.key, env);
    const isSecret =
      definition.category === "Security" || definition.key === "DATABASE_URL";
    const configured = definition.isConfigured
      ? definition.isConfigured(rawValue, env)
      : Boolean(rawValue && rawValue.trim().length > 0);
    const required =
      definition.required || definition.requiredWhen?.(env) === true;

    return {
      category: definition.category,
      configured,
      key: definition.key,
      label: definition.label,
      required,
      value: configured && !isSecret ? rawValue : null
    };
  });

  const missingRequired = items
    .filter((item) => item.required && !item.configured)
    .map((item) => item.key);

  return {
    environment: env.PERISCAN_DEPLOYMENT_ENVIRONMENT ?? "development",
    generatedAt: new Date().toISOString(),
    items,
    missingRequired,
    ready: missingRequired.length === 0
  };
}

const TRUST_SAFETY_PRINCIPLES = [
  {
    description:
      "Periscan requires validated customer-authorized scope before any external or internal validation is queued.",
    principleId: "verified-scope",
    title: "Verified scope required"
  },
  {
    description:
      "Destructive actions, persistence, credential theft, and uncontrolled exploit chaining are denied by policy.",
    principleId: "non-destructive",
    title: "Non-destructive validation"
  },
  {
    description:
      "Real data exfiltration is disallowed. Evidence is redacted before customer-facing exports and summaries.",
    principleId: "no-exfiltration",
    title: "No real data exfiltration"
  },
  {
    description:
      "External validation is rate-limited, respects blocked targets, and denies private or reserved IP ranges from the external point of attack.",
    principleId: "external-guardrails",
    title: "External validation guardrails"
  },
  {
    description:
      "Every mission, report update, and runner task is auditable through tenant-scoped audit events.",
    principleId: "auditability",
    title: "Auditable workflows"
  },
  {
    description:
      "Internal runner tasks are signed, scoped, outbound-only, and enforced through tenant-specific task envelopes.",
    principleId: "runner-controls",
    title: "Scoped internal runner controls"
  }
] as const;

export const USAGE_METER_DEFINITIONS = [
  {
    description:
      "Tenant assets observed or validated through connectors and modules.",
    label: "Validated assets",
    meterName: "ValidatedAssets",
    unit: "assets"
  },
  {
    description:
      "Identities observed through identity, cloud, and SaaS signals.",
    label: "Identities",
    meterName: "Identities",
    unit: "identities"
  },
  {
    description:
      "Security controls registered for detection, blocking, logging, or routing validation.",
    label: "Control sources",
    meterName: "ControlSources",
    unit: "controls"
  },
  {
    description:
      "AI applications and workflows registered for safe validation.",
    label: "AI apps",
    meterName: "AIApplications",
    unit: "apps"
  },
  {
    description:
      "Validation missions created by users, schedules, modules, or verification workflows.",
    label: "Validation missions",
    meterName: "ValidationMissions",
    unit: "missions"
  },
  {
    description:
      "Individual validation runs executed or queued under missions.",
    label: "Validation runs",
    meterName: "ValidationRuns",
    unit: "runs"
  },
  {
    description:
      "Rounded runner execution minutes from completed internal-runner validation runs.",
    label: "Runner minutes",
    meterName: "RunnerMinutes",
    unit: "minutes"
  },
  {
    description:
      "Evidence packs and reports generated from normalized evidence.",
    label: "Evidence packs",
    meterName: "EvidencePacks",
    unit: "packs"
  },
  {
    description:
      "Deployment-managed evidence retention window configured for the tenant environment.",
    label: "Evidence retention",
    meterName: "EvidenceRetention",
    unit: "days"
  },
  {
    description: "Child client tenants attached to an MSSP tenant.",
    label: "Client tenants",
    meterName: "ClientTenants",
    unit: "tenants"
  },
  {
    description: "Security-relevant audited API actions for the tenant.",
    label: "API usage",
    meterName: "APIUsage",
    unit: "events"
  },
  {
    description:
      "Short-term assessment packs (marketplace time-boxed packs for emerging/edge validation and co-managed ASV/MSSP).",
    label: "Short-term assessments",
    meterName: "ShortTermAssessments",
    unit: "packs"
  }
] satisfies UsageMeterDefinition[];

export const BILLING_PACKAGE_CATALOG = [
  {
    apiAccess: "Included",
    audiences: ["Prospects (teaser only)", "Design partners evaluating Snapshot"],
    description:
      "Limited external domain teaser (not a public scanner product). Ends in Validation Snapshot upgrade — never compete on scan volume. No full swarm, internal validation, continuous schedules, or path proof loop.",
    includedCapabilities: ["Safe external validation", "ValidationRuns"],
    includedMeterNames: ["ValidatedAssets", "ValidationRuns", "APIUsage"],
    label: "Light External Scan",
    packageKey: "LightExternalScan",
    paymentProcessorStatus: "NotConfigured",
    publicPricingLanguage:
      "Teaser freemium only — upgrade path is Validation Snapshot (invoice / approval-reference). Not Tenable-lite.",
    status: "Available",
    supportedOutcomes: [
      "Quick external domain attack surface teaser",
      "Force Snapshot upgrade CTA for measured path proof"
    ]
  },
  {
    apiAccess: "Included",
    audiences: ["Security teams", "SaaS companies", "Design partners"],
    description:
      "Focused first proof loop for verified scope, connected systems, priority attack paths with explicit evidence certainty, remediation guidance, and evidence export.",
    includedCapabilities: [
      "Validation Snapshot",
      "Safe external validation",
      "AI app registry",
      "Evidence-backed report",
      "Remediation priorities",
      "Fix verification plan",
      "ValidationRuns",
      "EvidencePacks"
    ],
    includedMeterNames: [
      "ValidatedAssets",
      "AIApplications",
      "ValidationMissions",
      "ValidationRuns",
      "EvidencePacks",
      "EvidenceRetention",
      "APIUsage"
    ],
    label: "Validation Snapshot",
    packageKey: "ValidationSnapshot",
    paymentProcessorStatus: "NotConfigured",
    publicPricingLanguage: "Contact us for usage-based pricing.",
    status: "Available",
    supportedOutcomes: [
      "Prioritize path hypotheses and measured paths",
      "Prioritize remediation",
      "Export proof for customers, auditors, or leadership"
    ]
  },
  {
    apiAccess: "Included",
    audiences: ["Security engineering", "Exposure management"],
    description:
      "Continuous exposure and attack-path validation across assets, identities, code, cloud, and verified external scope.",
    includedCapabilities: [
      "Continuous validation schedules",
      "Attack-path correlation",
      "Risk scoring",
      "Reopened-risk detection",
      "CTEM program view",
      "ValidationRuns",
      "EvidencePacks"
    ],
    includedMeterNames: [
      "ValidatedAssets",
      "Identities",
      "ValidationMissions",
      "ValidationRuns",
      "EvidenceRetention",
      "APIUsage"
    ],
    label: "Core Validation",
    packageKey: "CoreValidation",
    paymentProcessorStatus: "NotConfigured",
    publicPricingLanguage: "Contact us for usage-based pricing.",
    status: "Available",
    supportedOutcomes: [
      "Separate theoretical findings from validated risk",
      "Track drift and reopened exposure",
      "Show CTEM progress"
    ]
  },
  {
    apiAccess: "Available",
    audiences: ["Blue teams", "SOC teams", "Security operations"],
    description:
      "Policy-gated control validation, Atomic dry-run/import scenario library (not live inject BAS), MITRE ATT&CK mapping, and observer-backed verdicts.",
    includedCapabilities: [
      "Control source registry",
      "Atomic dry-run scenario import (not live inject)",
      "SIEM/EDR/WAF observer verdicts",
      "MITRE ATT&CK mapping",
      "Control evidence reports",
      "ValidationRuns",
      "EvidencePacks"
    ],
    includedMeterNames: [
      "ControlSources",
      "ValidationMissions",
      "ValidationRuns",
      "EvidencePacks",
      "EvidenceRetention",
      "APIUsage"
    ],
    label: "Control Validation",
    packageKey: "ControlValidation",
    paymentProcessorStatus: "NotConfigured",
    publicPricingLanguage: "Contact us for usage-based pricing.",
    status: "Available",
    supportedOutcomes: [
      "Correlate observer telemetry and dry-run scenario imports to control verdicts",
      "Identify tuning gaps",
      "Produce control validation evidence (measured inject-and-observe only when a canary or live observer path is used)"
    ]
  },
  {
    apiAccess: "Available",
    audiences: ["AI product teams", "AppSec", "Security reviewers"],
    description:
      "Safe AI application, RAG, guardrail, and tool-calling validation with redacted evidence and policy-bounded execution.",
    includedCapabilities: [
      "AI app registry",
      "Safe AI validation suites",
      "Promptfoo/PyRIT harness metadata",
      "AI evidence pack sections",
      "Output redaction",
      "ValidationRuns",
      "EvidencePacks"
    ],
    includedMeterNames: [
      "AIApplications",
      "ValidationMissions",
      "ValidationRuns",
      "EvidencePacks",
      "EvidenceRetention",
      "APIUsage"
    ],
    label: "AI Security Validation",
    packageKey: "AISecurityValidation",
    paymentProcessorStatus: "NotConfigured",
    publicPricingLanguage: "Contact us for usage-based pricing.",
    status: "Beta",
    supportedOutcomes: [
      "Validate AI app risk safely",
      "Show guardrail and RAG authorization evidence",
      "Track AI validation drift"
    ]
  },
  {
    apiAccess: "Included",
    audiences: ["GRC", "Customer security", "Auditors", "Insurers"],
    description:
      "Audience-specific evidence packs generated from normalized evidence, with redaction and export controls.",
    includedCapabilities: [
      "Executive and technical evidence packs",
      "Customer security review packs",
      "Cyber insurance evidence",
      "HTML/PDF export",
      "Share-link delivery audit",
      "EvidencePacks"
    ],
    includedMeterNames: ["EvidencePacks", "EvidenceRetention", "APIUsage"],
    label: "Evidence Packs",
    packageKey: "EvidencePacks",
    paymentProcessorStatus: "NotConfigured",
    publicPricingLanguage: "Contact us for usage-based pricing.",
    status: "Available",
    supportedOutcomes: [
      "Turn validation into proof",
      "Share redacted evidence by audience",
      "Audit report generation and sharing"
    ]
  },
  {
    apiAccess: "Available",
    audiences: ["MSSPs", "vCISOs", "Managed security providers"],
    description:
      "Parent/child tenant operations, client portfolios, white-label report branding, and PSA/RMM workflow delivery.",
    includedCapabilities: [
      "MSSP tenant hierarchy",
      "Client portfolio dashboard",
      "White-label report fields",
      "PSA/RMM ticket workflows",
      "Client tenant usage meters",
      "EvidencePacks",
      "Short-term assessment packs (co-managed ASV)"
    ],
    includedMeterNames: [
      "ClientTenants",
      "ValidatedAssets",
      "ValidationMissions",
      "EvidencePacks",
      "EvidenceRetention",
      "APIUsage",
      // 3.13 MSSP short-term assessment packs + co-managed ASV licensing
      "ShortTermAssessments"
    ],
    label: "MSSP / Partner",
    packageKey: "MSSPPartner",
    paymentProcessorStatus: "NotConfigured",
    publicPricingLanguage:
      "Partner invoice desk — priced primarily on ClientTenants + EvidencePacks + ShortTermAssessments (private unit sheet). Not public rate card.",
    status: "Available",
    supportedOutcomes: [
      "Manage multiple isolated clients after single-org loop is boring",
      "Deliver white-labeled proof without altering evidence",
      "Track client validation meter burn for partner QBRs"
    ]
  },
  {
    apiAccess: "Enterprise",
    audiences: ["Enterprise security programs", "Platform teams"],
    // GTM honesty (P08-5/P08-16): sell as governance / deployment posture on
    // top of Core/Control — not "everything unlocked." Capability list remains
    // a technical superset for entitlement evaluation only; deal desk prices
    // SSO/private runners/retention/API, not every pillar as a free add-on.
    description:
      "Enterprise governance and deployment posture (private runners, advanced API, tenant governance, retention) on top of Core validation. Sales desk prices governance value — not a kitchen-sink public catalog dump. Payment processor NotConfigured.",
    includedCapabilities: [
      "Validation Snapshot",
      "Safe external validation",
      "Evidence-backed report",
      "Remediation priorities",
      "Fix verification plan",
      "Continuous validation schedules",
      "Attack-path correlation",
      "Risk scoring",
      "Reopened-risk detection",
      "CTEM program view",
      "Control source registry",
      "Atomic dry-run scenario import (not live inject)",
      "SIEM/EDR/WAF observer verdicts",
      "MITRE ATT&CK mapping",
      "Control evidence reports",
      "AI app registry",
      "Model-assisted remediation",
      "Safe AI validation suites",
      "Promptfoo/PyRIT harness metadata",
      "AI evidence pack sections",
      "Output redaction",
      "Executive and technical evidence packs",
      "Customer security review packs",
      "Cyber insurance evidence",
      "HTML/PDF export",
      "Share-link delivery audit",
      "MSSP tenant hierarchy",
      "Client portfolio dashboard",
      "White-label report fields",
      "PSA/RMM ticket workflows",
      "Client tenant usage meters",
      "Short-term assessment packs (co-managed ASV)",
      "Private runner support",
      "Model-assisted remediation",
      "Advanced RBAC and audit exports",
      "Tenant governance",
      "Deployment-managed retention and observability",
      "Enterprise API operations",
      "ValidationRuns",
      "EvidencePacks"
    ],
    includedMeterNames: [
      "ValidatedAssets",
      "Identities",
      "ControlSources",
      "AIApplications",
      "ValidationMissions",
      "ValidationRuns",
      "RunnerMinutes",
      "EvidencePacks",
      "EvidenceRetention",
      "ClientTenants",
      "APIUsage",
      "ShortTermAssessments"
    ],
    label: "Enterprise",
    packageKey: "Enterprise",
    paymentProcessorStatus: "NotConfigured",
    publicPricingLanguage:
      "Contact sales — governance / deployment posture band (invoice / approval-reference). Not a public full-catalog dump.",
    status: "ContactSales",
    supportedOutcomes: [
      "Govern multi-BU deployment posture",
      "Run private validation infrastructure",
      "Support security review programs with measured proof"
    ]
  }
] satisfies BillingPackage[];

interface RunnerTaskSigningKeys {
  keyId: string;
  privateKeyPem: string;
  publicKeyPem: string;
}

export function hashSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

// Constant-time comparison for secret-derived hex digests (e.g. SHA-256
// hashes). Guards for equal length first, since timingSafeEqual throws when
// the buffers differ in length; unequal-length inputs can never be equal.
// Exported only so it can be unit-tested; treat as internal.
export function timingSafeEqualHex(a: string, b: string) {
  const bufferA = Buffer.from(a, "hex");
  const bufferB = Buffer.from(b, "hex");

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return timingSafeEqual(bufferA, bufferB);
}

export function createOpaqueToken(prefix: string) {
  return `${prefix}${randomBytes(32).toString("base64url")}`;
}

export function addSeconds(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000);
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

export function stringifyCanonicalJson(value: unknown) {
  return JSON.stringify(canonicalizeJson(value));
}

function exportEd25519PublicKeyPem(publicKey: KeyObject) {
  return publicKey
    .export({
      format: "pem",
      type: "spki"
    })
    .toString();
}

function exportEd25519PrivateKeyPem(privateKey: KeyObject) {
  return privateKey
    .export({
      format: "pem",
      type: "pkcs8"
    })
    .toString();
}

function resolveConfiguredRunnerTaskSigningKeys(
  env: NodeJS.ProcessEnv = process.env
): RunnerTaskSigningKeys | null {
  const configuredPrivateKey =
    env.PERISCAN_RUNNER_TASK_SIGNING_PRIVATE_KEY_PEM?.trim();

  if (!configuredPrivateKey) {
    return null;
  }

  const privateKey = createPrivateKey(configuredPrivateKey);

  if (privateKey.asymmetricKeyType !== "ed25519") {
    throw new Error(
      "PERISCAN_RUNNER_TASK_SIGNING_PRIVATE_KEY_PEM must be an Ed25519 private key."
    );
  }

  const derivedPublicKeyPem = createPublicKey(privateKey)
    .export({
      format: "pem",
      type: "spki"
    })
    .toString();
  const configuredPublicKey =
    env.PERISCAN_RUNNER_TASK_SIGNING_PUBLIC_KEY_PEM?.trim();

  if (configuredPublicKey) {
    const normalizedConfiguredPublicKey = createPublicKey(configuredPublicKey)
      .export({
        format: "pem",
        type: "spki"
      })
      .toString();

    if (normalizedConfiguredPublicKey !== derivedPublicKeyPem) {
      throw new Error(
        "PERISCAN_RUNNER_TASK_SIGNING_PUBLIC_KEY_PEM must match PERISCAN_RUNNER_TASK_SIGNING_PRIVATE_KEY_PEM."
      );
    }
  }

  return {
    keyId:
      env.PERISCAN_RUNNER_TASK_SIGNING_KEY_ID ??
      `runner-task-${hashSecret(derivedPublicKeyPem).slice(0, 16)}`,
    privateKeyPem: configuredPrivateKey,
    publicKeyPem: derivedPublicKeyPem
  };
}

async function ensureRunnerTaskSigningKeys(
  prisma: PrismaClient | Prisma.TransactionClient,
  tenantId: string,
  devMode: boolean,
  env: NodeJS.ProcessEnv = process.env
): Promise<RunnerTaskSigningKeys> {
  const existing = await prisma.runnerTaskSigningKey.findUnique({
    where: {
      tenantId
    }
  });

  if (existing) {
    return {
      keyId: existing.keyId,
      privateKeyPem: existing.privateKeyPem,
      publicKeyPem: existing.publicKeyPem
    };
  }

  const configuredKeys = resolveConfiguredRunnerTaskSigningKeys(env);

  if (configuredKeys) {
    const created = await prisma.runnerTaskSigningKey.create({
      data: {
        keyId: configuredKeys.keyId,
        privateKeyPem: configuredKeys.privateKeyPem,
        publicKeyPem: configuredKeys.publicKeyPem,
        tenantId
      }
    });

    return {
      keyId: created.keyId,
      privateKeyPem: created.privateKeyPem,
      publicKeyPem: created.publicKeyPem
    };
  }

  if (!devMode) {
    throw new AppServiceError(
      "Runner task signing key is required in production.",
      500,
      "runner_signing_key_missing"
    );
  }

  const keyPair = generateKeyPairSync("ed25519");
  const privateKeyPem = exportEd25519PrivateKeyPem(keyPair.privateKey);
  const publicKeyPem = exportEd25519PublicKeyPem(keyPair.publicKey);
  const keyId = `runner-task-dev-${hashSecret(publicKeyPem).slice(0, 16)}`;
  const created = await prisma.runnerTaskSigningKey.create({
    data: {
      keyId,
      privateKeyPem,
      publicKeyPem,
      tenantId
    }
  });

  return {
    keyId: created.keyId,
    privateKeyPem: created.privateKeyPem,
    publicKeyPem: created.publicKeyPem
  };
}

export async function issueRunnerCredentials(input: {
  certificateExpiresAt: Date;
  csrPem: string;
  devMode: boolean;
  prisma: PrismaClient | Prisma.TransactionClient;
  runnerId: string;
  runnerName: string;
  tenantId: string;
}) {
  const signingKeys = await ensureRunnerTaskSigningKeys(
    input.prisma,
    input.tenantId,
    input.devMode
  );
  const certificateAuthority = await ensureRunnerCertificateAuthority(
    input.prisma,
    input.tenantId
  );
  const clientCertificatePem = issueRunnerClientCertificate({
    certificateAuthority,
    certificateExpiresAt: input.certificateExpiresAt,
    csrPem: input.csrPem,
    runnerId: input.runnerId,
    runnerName: input.runnerName,
    tenantId: input.tenantId
  });

  return {
    caCertificatePem: certificateAuthority.certificatePem,
    certificateExpiresAt: input.certificateExpiresAt.toISOString(),
    mtlsCertificateSha256: hashPem(clientCertificatePem),
    mtlsClientCertificatePem: clientCertificatePem,
    taskSigningKeyId: signingKeys.keyId,
    taskSigningPublicKeyPem: signingKeys.publicKeyPem
  };
}

async function ensureRunnerCertificateAuthority(
  prisma: PrismaClient | Prisma.TransactionClient,
  tenantId: string
) {
  const existing = await prisma.runnerCertificateAuthority.findUnique({
    where: {
      tenantId
    }
  });

  if (existing) {
    return existing;
  }

  const keys = forge.pki.rsa.generateKeyPair({ bits: 3072, workers: 0 });
  const certificate = forge.pki.createCertificate();
  const now = new Date();
  certificate.publicKey = keys.publicKey;
  certificate.serialNumber = randomBytes(16).toString("hex");
  certificate.validity.notBefore = addSeconds(now, -300);
  certificate.validity.notAfter = addSeconds(now, 10 * 365 * 24 * 60 * 60);
  const subject = [
    {
      name: "commonName",
      value: `Periscan Runner CA ${tenantId}`
    },
    {
      name: "organizationName",
      value: "Periscan"
    }
  ];
  certificate.setSubject(subject);
  certificate.setIssuer(subject);
  certificate.setExtensions([
    {
      cA: true,
      name: "basicConstraints"
    },
    {
      digitalSignature: true,
      keyCertSign: true,
      name: "keyUsage"
    },
    {
      name: "subjectKeyIdentifier"
    }
  ]);
  certificate.sign(keys.privateKey, forge.md.sha256.create());

  const certificatePem = forge.pki.certificateToPem(certificate);
  const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);

  try {
    return await prisma.runnerCertificateAuthority.create({
      data: {
        certificatePem,
        certificateSha256: hashPem(certificatePem),
        keyId: `runner-ca-${tenantId}`,
        privateKeyPem,
        tenantId
      }
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      const createdByAnotherRequest =
        await prisma.runnerCertificateAuthority.findUnique({
          where: {
            tenantId
          }
        });

      if (createdByAnotherRequest) {
        return createdByAnotherRequest;
      }
    }

    throw error;
  }
}

function issueRunnerClientCertificate(input: {
  certificateAuthority: {
    certificatePem: string;
    privateKeyPem: string;
  };
  certificateExpiresAt: Date;
  csrPem: string;
  runnerId: string;
  runnerName: string;
  tenantId: string;
}) {
  let csr: ReturnType<typeof forge.pki.certificationRequestFromPem>;
  try {
    csr = forge.pki.certificationRequestFromPem(input.csrPem);
  } catch {
    throw new AppServiceError(
      "Runner CSR is invalid.",
      400,
      "runner_csr_invalid"
    );
  }

  if (!csr.verify()) {
    throw new AppServiceError(
      "Runner CSR signature could not be verified.",
      400,
      "runner_csr_invalid"
    );
  }
  if (!csr.publicKey) {
    throw new AppServiceError(
      "Runner CSR is missing a public key.",
      400,
      "runner_csr_invalid"
    );
  }

  const caCertificate = forge.pki.certificateFromPem(
    input.certificateAuthority.certificatePem
  );
  const caPrivateKey = forge.pki.privateKeyFromPem(
    input.certificateAuthority.privateKeyPem
  );
  const certificate = forge.pki.createCertificate();
  const now = new Date();
  certificate.publicKey = csr.publicKey;
  certificate.serialNumber = randomBytes(16).toString("hex");
  certificate.validity.notBefore = addSeconds(now, -300);
  certificate.validity.notAfter = input.certificateExpiresAt;
  const requestedSubject = csr.subject.attributes;
  certificate.setSubject(
    requestedSubject.length > 0
      ? requestedSubject
      : [
          {
            name: "commonName",
            value: input.runnerName
          }
        ]
  );
  certificate.setIssuer(caCertificate.subject.attributes);
  certificate.setExtensions([
    {
      cA: false,
      name: "basicConstraints"
    },
    {
      digitalSignature: true,
      keyEncipherment: true,
      name: "keyUsage"
    },
    {
      clientAuth: true,
      name: "extKeyUsage"
    },
    {
      altNames: [
        {
          type: 6,
          value: `urn:periscan:tenant:${input.tenantId}:runner:${input.runnerId}`
        },
        {
          type: 2,
          value: input.runnerName
        }
      ],
      name: "subjectAltName"
    }
  ]);
  certificate.sign(caPrivateKey, forge.md.sha256.create());

  return forge.pki.certificateToPem(certificate);
}

function hashPem(pem: string) {
  return createHash("sha256").update(pem).digest("hex");
}

export async function signTenantArtifact(
  prisma: PrismaClient | Prisma.TransactionClient,
  tenantId: string,
  devMode: boolean,
  payload: unknown
) {
  const keys = await ensureRunnerTaskSigningKeys(prisma, tenantId, devMode);
  const canonicalPayload = stringifyCanonicalJson(payload);

  return {
    algorithm: "EdDSA" as const,
    digestSha256: hashSecret(canonicalPayload),
    keyId: keys.keyId,
    signature: sign(
      null,
      Buffer.from(canonicalPayload),
      keys.privateKeyPem
    ).toString("base64url")
  };
}

export async function signRunnerTaskEnvelope(
  prisma: PrismaClient | Prisma.TransactionClient,
  tenantId: string,
  devMode: boolean,
  unsignedEnvelope: Omit<RunnerTaskEnvelope, "signature">
): Promise<RunnerTaskEnvelope> {
  const keys = await ensureRunnerTaskSigningKeys(prisma, tenantId, devMode);
  const canonicalPayload = stringifyCanonicalJson(unsignedEnvelope);
  const signature = sign(
    null,
    Buffer.from(canonicalPayload),
    keys.privateKeyPem
  ).toString("base64url");

  return RunnerTaskEnvelopeSchema.parse({
    ...unsignedEnvelope,
    signature: {
      algorithm: "EdDSA",
      digestSha256: hashSecret(canonicalPayload),
      keyId: keys.keyId,
      nonce: unsignedEnvelope.taskId,
      signature
    }
  });
}

export function getRunnerControlPlaneUrl(env: NodeJS.ProcessEnv = process.env) {
  return (
    env.PERISCAN_RUNNER_CONTROL_PLANE_URL ??
    env.PERISCAN_PUBLIC_API_URL ??
    "https://runner.periscan.cloud"
  );
}

function getRunnerGatewayHostnames(env: NodeJS.ProcessEnv = process.env) {
  try {
    return [new URL(getRunnerControlPlaneUrl(env)).hostname];
  } catch {
    return ["runner.periscan.cloud"];
  }
}

function getEvidenceRetentionDays(env: NodeJS.ProcessEnv = process.env) {
  const parsed = Number.parseInt(
    env.PERISCAN_EVIDENCE_RETENTION_DAYS ?? "",
    10
  );

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function buildIntegrationRevokeInstructions(integration: Integration) {
  return `Disconnect this integration in Periscan and revoke the ${integration.vendor} ${integration.authType.toLowerCase()} credential or token used for ${integration.product}.`;
}

export function requireRole(
  role: MembershipRole,
  allowedRoles: ReadonlySet<MembershipRole>,
  action: string
) {
  if (!allowedRoles.has(role)) {
    throw new AppServiceError(
      `Role ${role} cannot ${action}.`,
      403,
      "forbidden"
    );
  }
}

/** Roles that may grant or modify Owner / MSSPOwner memberships. */
export const OWNERSHIP_GRANT_ROLES = new Set<MembershipRole>([
  "Owner",
  "MSSPOwner"
]);

const OWNERSHIP_ROLES = new Set<MembershipRole>(["Owner", "MSSPOwner"]);

/**
 * Prevent privilege escalation through member invites / role changes.
 * Tenant admins (Admin, ClientAdmin) may manage non-owner roles, but only an
 * Owner or MSSPOwner may assign or alter Owner / MSSPOwner memberships.
 */
export function assertCanAssignMembershipRole(input: {
  actorRole: MembershipRole;
  newRole: MembershipRole;
  previousRole?: MembershipRole | null;
}) {
  const touchesOwnership =
    OWNERSHIP_ROLES.has(input.newRole) ||
    (input.previousRole != null && OWNERSHIP_ROLES.has(input.previousRole));

  if (touchesOwnership && !OWNERSHIP_GRANT_ROLES.has(input.actorRole)) {
    throw new AppServiceError(
      `Role ${input.actorRole} cannot assign or modify Owner/MSSPOwner memberships.`,
      403,
      "forbidden_role_assignment"
    );
  }
}

export interface TenantQueueCapacityCheck {
  tenantId: string;
  // Null/<=0 disables the guard.
  limit: number | null;
  // Returns the tenant's current pending-job count.
  countPending: () => Promise<number>;
  // Optional side effect (e.g. audit) invoked only when the enqueue is denied.
  onDenied?: (pending: number) => Promise<void>;
}

// Per-tenant queue backpressure: deny an enqueue when the tenant already has at
// least `limit` pending validation jobs, so one tenant can't starve the shared
// queue. Injectable counter + onDenied keep it unit-testable without Redis.
export async function assertTenantQueueCapacity(
  check: TenantQueueCapacityCheck
): Promise<void> {
  if (check.limit === null || check.limit <= 0) {
    return;
  }
  const pending = await check.countPending();
  if (pending >= check.limit) {
    if (check.onDenied) {
      await check.onDenied(pending);
    }
    throw new AppServiceError(
      `This tenant has too many queued validation jobs (limit ${check.limit}). Try again once running jobs complete.`,
      429,
      "queue_tenant_limit"
    );
  }
}

function defaultTenantReportBranding(tenantId: string): TenantReportBranding {
  const timestamp = new Date().toISOString();

  return {
    createdAt: timestamp,
    logoUrl: null,
    organizationName: null,
    primaryColor: null,
    reportFooter: null,
    supportEmail: null,
    tenantId,
    updatedAt: timestamp,
    whiteLabelEnabled: false
  };
}

function defaultTenantDesignPartnerSettings(
  tenantId: string
): TenantDesignPartnerSettings {
  const timestamp = new Date().toISOString();

  return {
    createdAt: timestamp,
    enabled: false,
    tenantId,
    updatedAt: timestamp
  };
}

function defaultSignalTriggerRoutingSettings(
  tenantId: string
): SignalTriggerRoutingSettings {
  const timestamp = new Date().toISOString();

  return {
    createdAt: timestamp,
    defaultOwnerRole: "SecurityEngineer",
    enabled: false,
    notificationIntegrationIds: [],
    tenantId,
    updatedAt: timestamp,
    workflowDestinationIntegrationIds: []
  };
}

export function buildSignalTriggerRoutingDecision(input: {
  connectedNotificationIntegrationIds: string[];
  connectedWorkflowDestinationIntegrationIds: string[];
  deliveries?: SignalTriggerRoutingDecision["deliveries"];
  settings: SignalTriggerRoutingSettings;
}): SignalTriggerRoutingDecision {
  const workflowDestinationIntegrationIds = uniqueSignalTriggerValues(
    input.connectedWorkflowDestinationIntegrationIds
  );
  const notificationIntegrationIds = uniqueSignalTriggerValues(
    input.connectedNotificationIntegrationIds
  );
  const deliveries = input.deliveries ?? [];

  if (!input.settings.enabled) {
    return {
      deliveries: [],
      enabled: false,
      escalationRole: input.settings.defaultOwnerRole,
      notificationIntegrationIds: [],
      nextActions: [
        "Enable signal-trigger routing and select connected workflow destinations."
      ],
      status: "Disabled",
      summary:
        "Signal-trigger routing is disabled; the approved trigger created only a draft mission.",
      workflowDestinationIntegrationIds: []
    };
  }

  if (
    workflowDestinationIntegrationIds.length === 0 &&
    notificationIntegrationIds.length === 0
  ) {
    return {
      deliveries: [],
      enabled: true,
      escalationRole: input.settings.defaultOwnerRole,
      notificationIntegrationIds: [],
      nextActions: [
        "Connect Jira, Slack, or another workflow destination and add it to the routing settings."
      ],
      status: "NotConfigured",
      summary:
        "Signal-trigger routing is enabled, but no connected workflow or notification destinations are configured.",
      workflowDestinationIntegrationIds: []
    };
  }

  if (deliveries.length > 0) {
    const hasFailedDelivery = deliveries.some(
      (delivery) => delivery.status !== "Delivered"
    );

    return {
      deliveries,
      enabled: true,
      escalationRole: input.settings.defaultOwnerRole,
      notificationIntegrationIds,
      nextActions: hasFailedDelivery
        ? [
            "Review failed workflow delivery details and retry after correcting the destination."
          ]
        : ["Review the draft mission before starting policy-gated execution."],
      status: hasFailedDelivery ? "Failed" : "Delivered",
      summary: hasFailedDelivery
        ? "Signal-trigger routing attempted delivery, but one or more workflow destinations failed."
        : "Signal-trigger routing delivered workflow notifications to configured destinations.",
      workflowDestinationIntegrationIds
    };
  }

  return {
    deliveries: [],
    enabled: true,
    escalationRole: input.settings.defaultOwnerRole,
    notificationIntegrationIds,
    nextActions: [
      "Review the draft mission before starting policy-gated execution.",
      "Route this recommendation through the configured workflow destinations."
    ],
    status: "Ready",
    summary:
      "Signal-trigger routing is configured for connected workflow or notification destinations.",
    workflowDestinationIntegrationIds
  };
}

const INTEGRATION_SECRET_CONFIG_KEY_PATTERN =
  /(^pat$|app.?key|app.?password|application.?key|access.?id|access.?key|access.?token|api.?integration.?code|api.?key|client.?secret|external.?id|integration.?code|integration.?key|password|private.?key|routing.?key|secret|session.?token|token|webhook)/iu;
const INTEGRATION_PUBLIC_CONFIG_KEYS = new Set(["tokenendpointauthmethod"]);

function shouldRedactIntegrationConfigKey(key: string) {
  const normalized = key.replace(/[-_\s]/gu, "").toLowerCase();

  if (INTEGRATION_PUBLIC_CONFIG_KEYS.has(normalized)) {
    return false;
  }

  if (normalized.endsWith("url") && !normalized.includes("webhook")) {
    return false;
  }

  return INTEGRATION_SECRET_CONFIG_KEY_PATTERN.test(key);
}

function redactIntegrationConfigValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactIntegrationConfigValue(item));
  }

  if (value && typeof value === "object") {
    return redactIntegrationConfigForResponse(value as Record<string, unknown>);
  }

  return value;
}

export function redactIntegrationConfigForResponse(
  config: Record<string, unknown> | null,
  authType?: string
): Record<string, unknown> | null {
  if (!config) {
    return null;
  }

  const connectorKey =
    typeof config.connectorKey === "string" ? config.connectorKey : null;

  // Authoritative redaction: any field the connector manifest marks `secret`
  // (the same set that gets encrypted at rest) MUST be redacted on read, even
  // if the key-name heuristic below doesn't recognize it. Without this, the
  // redaction set silently drifts from the encryption set as connectors add
  // fields — the connectwise publicKey special case is exactly that drift.
  const manifestSecretKeys = new Set<string>();
  if (connectorKey && authType) {
    const connector = getConnectorByKey(connectorKey);
    if (connector) {
      for (const secretKey of integrationSecretFieldKeys(connector, authType)) {
        manifestSecretKeys.add(secretKey.replace(/[-_\s]/gu, "").toLowerCase());
      }
    }
  }

  return Object.fromEntries(
    Object.entries(config).map(([key, value]) => {
      const normalized = key.replace(/[-_\s]/gu, "").toLowerCase();

      return [
        key,
        shouldRedactIntegrationConfigKey(key) ||
        manifestSecretKeys.has(normalized) ||
        (connectorKey === "connectwise-manage" && normalized === "publickey")
          ? "[redacted]"
          : redactIntegrationConfigValue(value)
      ];
    })
  );
}

export function serializeIntegration(record: {
  authType: string;
  category: Integration["category"];
  config: Prisma.JsonValue | null;
  createdAt: Date;
  healthStatus: Integration["healthStatus"];
  integrationId: string;
  lastSyncAt: Date | null;
  nextSyncAt: Date | null;
  permissionsSummary: Prisma.JsonValue;
  product: string;
  status: Integration["status"];
  syncFrequency: Integration["syncFrequency"];
  tenantId: string;
  updatedAt: Date;
  vendor: string;
}): Integration {
  return {
    authType: record.authType,
    category: record.category,
    config:
      typeof record.config === "object" && record.config
        ? redactIntegrationConfigForResponse(
            record.config as Record<string, unknown>,
            record.authType
          )
        : null,
    createdAt: record.createdAt.toISOString(),
    healthStatus: record.healthStatus,
    integrationId: record.integrationId,
    lastSyncAt: record.lastSyncAt?.toISOString() ?? null,
    nextSyncAt: record.nextSyncAt?.toISOString() ?? null,
    permissionsSummary:
      typeof record.permissionsSummary === "object" && record.permissionsSummary
        ? (record.permissionsSummary as Record<string, unknown>)
        : {},
    product: record.product,
    status: record.status,
    syncFrequency: record.syncFrequency,
    tenantId: record.tenantId,
    updatedAt: record.updatedAt.toISOString(),
    vendor: record.vendor
  };
}

function readSummaryString(
  summary: Record<string, unknown>,
  key: string
): string | null {
  const value = summary[key];

  return typeof value === "string" && value.length > 0 ? value : null;
}

function readSummaryBoolean(
  summary: Record<string, unknown>,
  key: string
): boolean | null {
  const value = summary[key];

  return typeof value === "boolean" ? value : null;
}

function readImplementationTier(summary: Record<string, unknown>) {
  const parsed = IntegrationImplementationTierSchema.safeParse(
    summary.implementationTier
  );

  return parsed.success ? parsed.data : null;
}

function readExecutionReadiness(summary: Record<string, unknown>) {
  const parsed = IntegrationExecutionReadinessSchema.safeParse(
    summary.executionReadiness
  );

  return parsed.success ? parsed.data : null;
}

function getIntegrationTrustSafetyMetadata(integration: Integration) {
  const summary =
    integration.permissionsSummary &&
    typeof integration.permissionsSummary === "object"
      ? (integration.permissionsSummary as Record<string, unknown>)
      : {};
  const connectorKey =
    readSummaryString(summary, "connectorKey") ??
    getConnectorKey(integration.config ?? null);
  const catalogEntry = connectorKey
    ? getConnectorCatalogEntryByKey(connectorKey)
    : null;

  return {
    connectorKey,
    dedicatedClient:
      readSummaryBoolean(summary, "dedicatedClient") ??
      catalogEntry?.dedicatedClient ??
      null,
    executionReadiness:
      readExecutionReadiness(summary) ??
      catalogEntry?.executionReadiness ??
      null,
    executionReadinessReason:
      readSummaryString(summary, "executionReadinessReason") ??
      catalogEntry?.executionReadinessReason ??
      null,
    implementationTier:
      readImplementationTier(summary) ??
      catalogEntry?.implementationTier ??
      null,
    live: readSummaryBoolean(summary, "live") ?? catalogEntry?.live ?? null
  };
}

export function serializeAuditEvent(record: {
  action: string;
  actorType: string;
  auditEventId: string;
  createdAt: Date;
  entityId: string | null;
  entityType: AuditEvent["entityType"];
  metadata: Prisma.JsonValue;
  tenantId: string | null;
  userId: string | null;
}): AuditEvent {
  return {
    action: AUDIT_ACTION_FROM_DB[record.action]!,
    actorType: record.actorType,
    auditEventId: record.auditEventId,
    createdAt: record.createdAt.toISOString(),
    entityId: record.entityId,
    entityType: record.entityType,
    metadata:
      typeof record.metadata === "object" && record.metadata
        ? (record.metadata as Record<string, unknown>)
        : {},
    tenantId: record.tenantId,
    userId: record.userId
  };
}

export function serializeApiKey(record: {
  apiKeyId: string;
  tenantId: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  createdBy: string;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): TenantApiKey {
  return {
    apiKeyId: record.apiKeyId,
    createdAt: record.createdAt.toISOString(),
    createdBy: record.createdBy,
    expiresAt: record.expiresAt?.toISOString() ?? null,
    keyPrefix: record.keyPrefix,
    lastUsedAt: record.lastUsedAt?.toISOString() ?? null,
    name: record.name,
    revokedAt: record.revokedAt?.toISOString() ?? null,
    scopes: record.scopes as TenantApiKeyScope[],
    tenantId: record.tenantId,
    updatedAt: record.updatedAt.toISOString()
  };
}

export function serializeWebhook(record: {
  webhookId: string;
  tenantId: string;
  url: string;
  events: string[];
  enabled: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}): TenantWebhook {
  return {
    createdAt: record.createdAt.toISOString(),
    createdBy: record.createdBy,
    enabled: record.enabled,
    events: record.events as WebhookEventType[],
    tenantId: record.tenantId,
    updatedAt: record.updatedAt.toISOString(),
    url: record.url,
    webhookId: record.webhookId
  };
}

export function serializeWebhookDelivery(record: {
  deliveryId: string;
  webhookId: string;
  tenantId: string;
  eventType: string;
  status: WebhookDelivery["status"];
  attempts: number;
  lastError: string | null;
  responseStatus: number | null;
  nextRetryAt: Date | null;
  deliveredAt: Date | null;
  deadLetteredAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): WebhookDelivery {
  return {
    attempts: record.attempts,
    createdAt: record.createdAt.toISOString(),
    deadLetteredAt: record.deadLetteredAt?.toISOString() ?? null,
    deliveredAt: record.deliveredAt?.toISOString() ?? null,
    deliveryId: record.deliveryId,
    eventType: record.eventType as WebhookEventType,
    lastError: record.lastError,
    nextRetryAt: record.nextRetryAt?.toISOString() ?? null,
    responseStatus: record.responseStatus,
    status: record.status,
    tenantId: record.tenantId,
    updatedAt: record.updatedAt.toISOString(),
    webhookId: record.webhookId
  };
}

export function serializeJob(record: {
  attempts: number;
  availableAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  dedupeKey: string | null;
  errorMessage: string | null;
  jobId: string;
  missionId: string | null;
  payload: Prisma.JsonValue;
  queueName: string;
  startedAt: Date | null;
  status: Job["status"];
  tenantId: string;
  updatedAt: Date;
  validationRunId: string | null;
}): Job {
  return {
    attempts: record.attempts,
    availableAt: record.availableAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    dedupeKey: record.dedupeKey,
    errorMessage: record.errorMessage,
    jobId: record.jobId,
    missionId: record.missionId,
    payload:
      typeof record.payload === "object" && record.payload
        ? (record.payload as Record<string, unknown>)
        : {},
    queueName: record.queueName,
    startedAt: record.startedAt?.toISOString() ?? null,
    status: record.status,
    tenantId: record.tenantId,
    updatedAt: record.updatedAt.toISOString(),
    validationRunId: record.validationRunId
  };
}

export function serializeAttackPath(record: {
  confidence: number;
  createdAt: Date;
  evidenceBasis: AttackPath["evidenceBasis"];
  evidenceIds: string[];
  impactScore: number;
  methodology: string | null;
  name: string;
  pathBreakers: Array<{
    createdAt: Date;
    description: string;
    evidenceIds: string[];
    pathBreakerId: string;
    pathId: string;
    priority: number;
    relatedNodeId: string | null;
    tenantId: string;
    title: string;
    updatedAt: Date;
  }>;
  pathEdges: Array<{
    createdAt: Date;
    evidenceBasis: AttackPath["pathEdges"][number]["evidenceBasis"];
    evidenceIds: string[];
    measurementMethod: string | null;
    pathEdgeId: string;
    pathId: string;
    rationale: string | null;
    relationship: AttackPath["pathEdges"][number]["relationship"];
    sourceNodeId: string;
    targetNodeId: string;
    tenantId: string;
    updatedAt: Date;
  }>;
  pathId: string;
  pathNodes: Array<{
    createdAt: Date;
    entityId: string;
    entityType: AttackPath["pathNodes"][number]["entityType"];
    evidenceIds: string[];
    label: string;
    pathId: string;
    pathNodeId: string;
    sequence: number;
    tenantId: string;
    updatedAt: Date;
  }>;
  tenantId: string;
  updatedAt: Date;
  validationState: AttackPath["validationState"];
}): AttackPath {
  return {
    confidence: record.confidence,
    createdAt: record.createdAt.toISOString(),
    entryNodeId: record.pathNodes[0]!.pathNodeId,
    evidenceBasis: record.evidenceBasis,
    evidenceIds: record.evidenceIds,
    impactNodeId:
      record.pathNodes[record.pathNodes.length - 1]?.pathNodeId ??
      record.pathNodes[0]!.pathNodeId,
    impactScore: record.impactScore,
    methodology: record.methodology,
    name: record.name,
    pathBreakers: record.pathBreakers.map((breaker) => ({
      createdAt: breaker.createdAt.toISOString(),
      description: breaker.description,
      evidenceIds: breaker.evidenceIds,
      pathBreakerId: breaker.pathBreakerId,
      pathId: breaker.pathId,
      priority: breaker.priority,
      relatedNodeId: breaker.relatedNodeId,
      tenantId: breaker.tenantId,
      title: breaker.title,
      updatedAt: breaker.updatedAt.toISOString()
    })),
    pathEdges: record.pathEdges.map((edge) => ({
      createdAt: edge.createdAt.toISOString(),
      evidenceBasis: edge.evidenceBasis,
      evidenceIds: edge.evidenceIds,
      measurementMethod: edge.measurementMethod,
      pathEdgeId: edge.pathEdgeId,
      pathId: edge.pathId,
      rationale: edge.rationale,
      relationship: edge.relationship,
      sourceNodeId: edge.sourceNodeId,
      targetNodeId: edge.targetNodeId,
      tenantId: edge.tenantId,
      updatedAt: edge.updatedAt.toISOString()
    })),
    pathId: record.pathId,
    pathNodes: record.pathNodes.map((node) => ({
      createdAt: node.createdAt.toISOString(),
      entityId: node.entityId,
      entityType: node.entityType,
      evidenceIds: node.evidenceIds,
      label: node.label,
      pathId: node.pathId,
      pathNodeId: node.pathNodeId,
      sequence: node.sequence,
      tenantId: node.tenantId,
      updatedAt: node.updatedAt.toISOString()
    })),
    tenantId: record.tenantId,
    updatedAt: record.updatedAt.toISOString(),
    validationState: record.validationState
  };
}

export function serializeAsset(record: {
  assetId: string;
  assetType: Asset["assetType"];
  businessCriticality: Asset["businessCriticality"];
  createdAt: Date;
  environment: string | null;
  firstSeenAt: Date | null;
  identifiers: Prisma.JsonValue;
  internetExposed: boolean;
  lastSeenAt: Date | null;
  name: string;
  owner: string | null;
  status: Asset["status"];
  tags: string[];
  tenantId: string;
  updatedAt: Date;
  valuation: Prisma.JsonValue | null;
}): Asset {
  const valuation = AssetValuationSchema.safeParse(record.valuation);

  return {
    assetId: record.assetId,
    assetType: record.assetType,
    businessCriticality: record.businessCriticality,
    createdAt: record.createdAt.toISOString(),
    environment: record.environment,
    firstSeenAt: record.firstSeenAt?.toISOString() ?? null,
    identifiers:
      record.identifiers && typeof record.identifiers === "object"
        ? (record.identifiers as Record<string, unknown>)
        : {},
    internetExposed: record.internetExposed,
    lastSeenAt: record.lastSeenAt?.toISOString() ?? null,
    name: record.name,
    owner: record.owner,
    status: record.status,
    tags: record.tags,
    tenantId: record.tenantId,
    updatedAt: record.updatedAt.toISOString(),
    valuation: valuation.success ? valuation.data : null
  };
}

export async function assessAttackPathsWithFinancialExposure(input: {
  paths: AttackPath[];
  prisma: PrismaClient;
  tenantId: string;
}): Promise<AttackPathAssessment[]> {
  const assetIds = [
    ...new Set(
      input.paths.flatMap((path) =>
        path.pathNodes
          .filter((node) => node.entityType === "Asset")
          .map((node) => node.entityId)
      )
    )
  ];
  const assets =
    assetIds.length === 0
      ? []
      : await input.prisma.asset.findMany({
          select: {
            assetId: true,
            name: true,
            valuation: true
          },
          where: {
            assetId: { in: assetIds },
            tenantId: input.tenantId
          }
        });
  const financialByAssetId = new Map<string, FinancialExposureEstimate>();

  for (const asset of assets) {
    const valuation = AssetValuationSchema.safeParse(asset.valuation);
    if (!valuation.success) {
      continue;
    }
    financialByAssetId.set(
      asset.assetId,
      estimateFinancialExposure({
        assetId: asset.assetId,
        assetName: asset.name,
        valuation: valuation.data
      })
    );
  }

  return input.paths.map((path) => {
    const estimates = path.pathNodes
      .map((node) => financialByAssetId.get(node.entityId))
      .filter((estimate): estimate is FinancialExposureEstimate =>
        Boolean(estimate)
      )
      .sort(
        (left, right) =>
          right.annualizedLossExposureUsd - left.annualizedLossExposureUsd
      );

    return assessAttackPathRisk(path, estimates[0] ?? null);
  });
}

export function serializeRemediationTask(record: {
  attackPath?: {
    evidenceBasis: RemediationTask["relatedPathEvidenceBasis"];
  } | null;
  createdAt: Date;
  dueAt: Date | null;
  evidenceIds: string[];
  lastVerifiedAt: Date | null;
  latestVerificationEvent?: {
    exposureReCorrelated: boolean | null;
    measuredRevalidation: boolean;
    outcome: VerificationEvent["outcome"];
    retestMethod: string | null;
    verifiedAt: Date;
  } | null;
  nextVerificationAt: Date | null;
  owner: string | null;
  recommendedAction: string;
  relatedExposureId: string | null;
  relatedFindingFingerprint?: string | null;
  relatedPathId: string | null;
  remediationId: string;
  status: RemediationTask["status"];
  technicalSteps: string[];
  tenantId: string;
  ticketId: string | null;
  ticketIntegrationId?: string | null;
  ticketState?: string | null;
  ticketStateLabel?: string | null;
  ticketSyncedAt?: Date | null;
  ticketSystem: string | null;
  updatedAt: Date;
  verificationMethod: string;
  verificationRequired: boolean;
}): RemediationTask {
  return {
    createdAt: record.createdAt.toISOString(),
    dueAt: record.dueAt?.toISOString() ?? null,
    evidenceIds: record.evidenceIds,
    lastVerifiedAt: record.lastVerifiedAt?.toISOString() ?? null,
    latestVerification: record.latestVerificationEvent
      ? {
          exposureReCorrelated:
            record.latestVerificationEvent.exposureReCorrelated,
          measuredRevalidation:
            record.latestVerificationEvent.measuredRevalidation,
          outcome: record.latestVerificationEvent.outcome,
          retestMethod: record.latestVerificationEvent.retestMethod,
          verifiedAt: record.latestVerificationEvent.verifiedAt.toISOString()
        }
      : null,
    nextVerificationAt: record.nextVerificationAt?.toISOString() ?? null,
    relatedPathEvidenceBasis: record.attackPath?.evidenceBasis ?? null,
    owner: record.owner,
    recommendedAction: record.recommendedAction,
    relatedExposureId: record.relatedExposureId,
    relatedFindingFingerprint: record.relatedFindingFingerprint ?? null,
    relatedPathId: record.relatedPathId,
    remediationId: record.remediationId,
    status: record.status,
    technicalSteps: record.technicalSteps,
    tenantId: record.tenantId,
    ticketId: record.ticketId,
    ticketIntegrationId: record.ticketIntegrationId ?? null,
    ticketState:
      record.ticketState === "Open" ||
      record.ticketState === "InProgress" ||
      record.ticketState === "Closed" ||
      record.ticketState === "Unknown"
        ? record.ticketState
        : null,
    ticketStateLabel: record.ticketStateLabel ?? null,
    ticketSyncedAt: record.ticketSyncedAt?.toISOString() ?? null,
    ticketSystem: record.ticketSystem,
    updatedAt: record.updatedAt.toISOString(),
    verificationMethod: record.verificationMethod,
    verificationRequired: record.verificationRequired
  };
}

// PERISCAN-7 — statuses that still represent operational work (not settled closure).
// Settled Fixed/Mitigated/ClosedWithoutEvidence do not block a new open task when
// the same fingerprint reappears; path-id idempotency still returns the path's row.
export const OPEN_REMEDIATION_STATUSES = [
  "Open",
  "InProgress",
  "VerificationPending",
  "StillExposed",
  "PartiallyFixed",
  "Inconclusive",
  "Reopened"
] as const satisfies readonly RemediationTask["status"][];

export function isOpenRemediationStatus(
  status: RemediationTask["status"] | string
): boolean {
  return (OPEN_REMEDIATION_STATUSES as readonly string[]).includes(status);
}

/**
 * Derive the stable path-finding fingerprint for remediation reuse.
 * Uses the same material as buildValidatedFindings (template family + assets).
 */
export function computeAttackPathFindingFingerprint(path: {
  methodology?: string | null;
  name: string;
  pathNodes: ReadonlyArray<{ entityId: string; entityType: string }>;
}): string {
  const relatedAssetIds = path.pathNodes
    .filter(
      (node) => node.entityType === "Asset" || node.entityType === "Exposure"
    )
    .map((node) => node.entityId);
  return computePathFindingMaterial({
    assetCorrelationKeys: [...new Set(relatedAssetIds)],
    methodology: path.methodology,
    name: path.name
  }).fingerprint;
}

/**
 * Project operational owner/SLA onto a finding from its primary linked
 * remediation. Never invents values — omit fields when remediation has none.
 * ownerId is not projected from free-text remediation.owner.
 */
export function projectFindingOwnerSlaFromRemediation(
  remediation:
    | Pick<RemediationTask, "dueAt" | "owner">
    | null
    | undefined
): Partial<Pick<ValidatedFinding, "ownerDisplay" | "slaDueAt">> {
  const projected: Partial<Pick<ValidatedFinding, "ownerDisplay" | "slaDueAt">> = {};
  const ownerDisplay = remediation?.owner?.trim();
  if (ownerDisplay) {
    projected.ownerDisplay = ownerDisplay;
  }
  if (remediation?.dueAt) {
    projected.slaDueAt = remediation.dueAt;
  }
  return projected;
}

/**
 * Operational ownership for triage queues (Priority · unowned, owner=unassigned).
 *
 * Primary: remediation-projected finding.ownerId / ownerDisplay.
 * disposition.ownerId is AcceptedRisk acceptor only and does NOT count as
 * operational ownership for unowned queues (P18-3).
 */
export function isUnownedValidatedFinding(
  finding: Pick<ValidatedFinding, "ownerDisplay" | "ownerId">
): boolean {
  return !finding.ownerId && !finding.ownerDisplay?.trim();
}

/**
 * Resolve a member owner id for owner=UUID filters.
 * Primary: finding.ownerId; secondary: disposition.ownerId (AcceptedRisk).
 * Free-text ownerDisplay alone never yields an id.
 */
export function resolveFindingOwnerMemberId(
  finding: Pick<ValidatedFinding, "disposition" | "ownerId">
): string | null {
  return finding.ownerId ?? finding.disposition?.ownerId ?? null;
}

/**
 * Prefer path-linked remediation; fall back to an open remediation for the
 * same finding fingerprint so grouped causes share one work item.
 */
export function resolvePrimaryRemediationForFinding(input: {
  fingerprint: string;
  pathId: string;
  remediationsByFingerprint: Map<string, RemediationTask>;
  remediationsByPathId: Map<string, RemediationTask>;
}): RemediationTask | null {
  return (
    input.remediationsByPathId.get(input.pathId) ??
    input.remediationsByFingerprint.get(input.fingerprint) ??
    null
  );
}

/**
 * Index remediations for path + open-fingerprint lookup. For each fingerprint,
 * prefer the newest open task; settled tasks are ignored for fingerprint reuse
 * so a re-opened cause can mint a new open remediation.
 */
export function indexRemediationsForFindings(
  remediations: RemediationTask[]
): {
  remediationsByFingerprint: Map<string, RemediationTask>;
  remediationsByPathId: Map<string, RemediationTask>;
} {
  const remediationsByPathId = new Map<string, RemediationTask>();
  for (const remediation of remediations) {
    if (remediation.relatedPathId) {
      remediationsByPathId.set(remediation.relatedPathId, remediation);
    }
  }

  const remediationsByFingerprint = new Map<string, RemediationTask>();
  const openByFingerprint = remediations
    .filter(
      (remediation) =>
        remediation.relatedFindingFingerprint &&
        isOpenRemediationStatus(remediation.status)
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  for (const remediation of openByFingerprint) {
    const fingerprint = remediation.relatedFindingFingerprint!;
    if (!remediationsByFingerprint.has(fingerprint)) {
      remediationsByFingerprint.set(fingerprint, remediation);
    }
  }

  return { remediationsByFingerprint, remediationsByPathId };
}

// One-line continuous-re-verification status for the snapshot/report narrative:
// flags settled fixes that are overdue for re-verification, or confirms they are
// within the re-check window. Empty when there are no settled fixes yet. Operates
// on the TENANT-WIDE remediation set (not just the snapshot's embedded top-path
// priorities) so the "are our Fixed claims still true?" narrative matches the
// staleVerificationCount metric and cannot quietly ignore stale fixes outside the
// display slice.
export function buildVerificationFreshnessNote(
  remediations: ReadonlyArray<{
    nextVerificationAt?: string | null;
    status: string;
  }>
): string {
  const settled = remediations.filter((remediation) =>
    SETTLED_REMEDIATION_STATUSES.has(remediation.status)
  ).length;
  if (settled === 0) {
    return "";
  }
  const stale = countStaleVerifications(remediations, new Date());
  if (stale > 0) {
    return ` ${stale} settled fix${stale === 1 ? " is" : "es are"} overdue for re-verification and should be re-checked.`;
  }
  return ` All ${settled} settled fix${settled === 1 ? " is" : "es are"} within the continuous re-verification window.`;
}

export function serializeVerificationEvent(record: {
  createdAt: Date;
  evidenceIds: string[];
  measuredRevalidation: boolean;
  newState: VerificationEvent["newState"];
  outcome: VerificationEvent["outcome"];
  previousEvidenceBasis: VerificationEvent["previousEvidenceBasis"];
  previousState: VerificationEvent["previousState"];
  remediationId: string;
  retestMethod: string | null;
  selectedModuleIds: string[];
  reSyncedConnectorKeys: string[];
  exposureReCorrelated: boolean | null;
  tenantId: string;
  updatedAt: Date;
  validationRunId: string | null;
  verificationId: string;
  verifiedAt: Date;
}): VerificationEvent {
  return {
    createdAt: record.createdAt.toISOString(),
    evidenceIds: record.evidenceIds,
    exposureReCorrelated: record.exposureReCorrelated,
    measuredRevalidation: record.measuredRevalidation,
    newState: record.newState,
    outcome: record.outcome,
    previousEvidenceBasis: record.previousEvidenceBasis,
    previousState: record.previousState,
    reSyncedConnectorKeys: record.reSyncedConnectorKeys,
    remediationId: record.remediationId,
    retestMethod: record.retestMethod,
    selectedModuleIds: record.selectedModuleIds,
    tenantId: record.tenantId,
    updatedAt: record.updatedAt.toISOString(),
    validationRunId: record.validationRunId,
    verificationId: record.verificationId,
    verifiedAt: record.verifiedAt.toISOString()
  };
}

export function serializeSignalEnvelope(record: {
  confidence: number | null;
  createdAt: Date;
  evidenceIds: string[];
  freshness: string | null;
  rawPayloadPointer: string | null;
  redactionStatus: SignalEnvelope["redactionStatus"];
  relatedAssetIds: string[];
  relatedControlIds: string[];
  relatedEvidenceIds: string[];
  relatedIdentityIds: string[];
  relatedPathIds: string[];
  sensitivityLevel: SignalEnvelope["sensitivityLevel"];
  signalCategory: SignalEnvelope["signalCategory"];
  signalId: string;
  signalSubcategory: string | null;
  sourceIntegrationId: string | null;
  sourceRunnerId?: string | null;
  sourceType: string;
  sourceVendor: string;
  tenantId: string;
  techniqueIds: string[];
  timestampIngested: Date;
  timestampObserved: Date;
  updatedAt: Date;
}): SignalEnvelope {
  return {
    confidence: record.confidence ?? null,
    createdAt: record.createdAt.toISOString(),
    evidenceIds: record.evidenceIds,
    freshness: record.freshness ?? null,
    rawPayloadPointer: record.rawPayloadPointer ?? null,
    redactionStatus: record.redactionStatus,
    relatedAssetIds: record.relatedAssetIds,
    relatedControlIds: record.relatedControlIds,
    relatedEvidenceIds: record.relatedEvidenceIds,
    relatedIdentityIds: record.relatedIdentityIds,
    relatedPathIds: record.relatedPathIds,
    sensitivityLevel: record.sensitivityLevel,
    signalCategory: record.signalCategory,
    signalId: record.signalId,
    signalSubcategory: record.signalSubcategory ?? null,
    sourceIntegrationId: record.sourceIntegrationId,
    sourceRunnerId: record.sourceRunnerId ?? null,
    sourceType: record.sourceType,
    sourceVendor: record.sourceVendor,
    tenantId: record.tenantId,
    techniqueIds: record.techniqueIds,
    timestampIngested: record.timestampIngested.toISOString(),
    timestampObserved: record.timestampObserved.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

export function serializeEvidencePack(record: {
  audience: string;
  createdAt: Date;
  evidenceIds: string[];
  evidencePackId: string;
  packType: EvidencePack["packType"];
  redactionLevel: EvidencePack["redactionLevel"];
  status: EvidencePack["status"];
  storageUri: string | null;
  tenantId: string;
  title: string;
  updatedAt: Date;
}): EvidencePack {
  return {
    audience: record.audience,
    createdAt: record.createdAt.toISOString(),
    evidenceIds: record.evidenceIds,
    evidencePackId: record.evidencePackId,
    packType: record.packType,
    redactionLevel: record.redactionLevel,
    status: record.status,
    storageUri: record.storageUri,
    tenantId: record.tenantId,
    title: record.title,
    updatedAt: record.updatedAt.toISOString()
  };
}

type EvidencePackRecord = Parameters<typeof serializeEvidencePack>[0];

export function serializeEvidenceArtifact(record: {
  artifactType: EvidenceArtifact["artifactType"];
  createdAt: Date;
  evidenceId: string;
  redactedAt?: Date | null;
  redactedSha256?: string | null;
  redactionStatus: EvidenceArtifact["redactionStatus"];
  relatedEntityId: string;
  relatedEntityType: EvidenceArtifact["relatedEntityType"];
  sensitivityLevel: EvidenceArtifact["sensitivityLevel"];
  sha256: string;
  storageUri: string;
  tenantId: string;
  updatedAt: Date;
}): EvidenceArtifact {
  return {
    artifactType: record.artifactType,
    createdAt: record.createdAt.toISOString(),
    evidenceId: record.evidenceId,
    redactedAt: record.redactedAt ? record.redactedAt.toISOString() : null,
    redactedSha256: record.redactedSha256 ?? null,
    redactionStatus: record.redactionStatus,
    relatedEntityId: record.relatedEntityId,
    relatedEntityType: record.relatedEntityType,
    sensitivityLevel: record.sensitivityLevel,
    sha256: record.sha256,
    storageUri: record.storageUri,
    tenantId: record.tenantId,
    updatedAt: record.updatedAt.toISOString()
  };
}

/** P06-10: max retained schedule run records in config (newest first). */
export const SCHEDULE_RUN_HISTORY_LIMIT = 10;

export type ScheduleConfigRunHistoryEntry = {
  blackoutSkip?: boolean;
  denyReason?: string | null;
  errorSummary?: string | null;
  missionId?: string | null;
  outcome: string;
  scheduledAt: string;
  snapshotId?: string | null;
};

/**
 * Read config.runHistory for schedule fire audit trail (P06-10).
 * Shape is schedule-config local (scheduledAt/outcome), distinct from the
 * API MissionScheduleDetail.runHistory rows built from ValidationRun rows.
 */
export function extractScheduleRunHistory(
  config: Record<string, unknown> | Prisma.JsonValue | null | undefined
): ScheduleConfigRunHistoryEntry[] {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return [];
  }
  const raw = (config as Record<string, unknown>).runHistory;
  if (!Array.isArray(raw)) {
    return [];
  }
  const records: ScheduleConfigRunHistoryEntry[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    if (typeof row.scheduledAt !== "string" || typeof row.outcome !== "string") {
      continue;
    }
    records.push({
      blackoutSkip: row.blackoutSkip === true,
      denyReason: typeof row.denyReason === "string" ? row.denyReason : null,
      errorSummary:
        typeof row.errorSummary === "string" ? row.errorSummary : null,
      missionId: typeof row.missionId === "string" ? row.missionId : null,
      outcome: row.outcome,
      scheduledAt: row.scheduledAt,
      snapshotId: typeof row.snapshotId === "string" ? row.snapshotId : null
    });
  }
  return records.slice(0, SCHEDULE_RUN_HISTORY_LIMIT);
}

export function appendScheduleRunHistory(
  config: Record<string, unknown>,
  record: ScheduleConfigRunHistoryEntry
): Record<string, unknown> {
  const existing = extractScheduleRunHistory(config);
  const next = [record, ...existing].slice(0, SCHEDULE_RUN_HISTORY_LIMIT);
  return {
    ...config,
    runHistory: next
  };
}

export function serializeMissionSchedule(record: {
  config: Prisma.JsonValue;
  createdAt: Date;
  createdBy: string;
  frequency: MissionSchedule["frequency"];
  lastDiff: Prisma.JsonValue | null;
  lastMissionId: string | null;
  lastRunAt: Date | null;
  lastSnapshotId: string | null;
  missionType: MissionSchedule["missionType"];
  nextRunAt: Date;
  scheduleId: string;
  scopeIds: string[];
  status: MissionSchedule["status"];
  tenantId: string;
  updatedAt: Date;
}): MissionSchedule {
  return {
    config:
      typeof record.config === "object" && record.config
        ? (record.config as Record<string, unknown>)
        : {},
    createdAt: record.createdAt.toISOString(),
    createdBy: record.createdBy,
    frequency: record.frequency,
    lastDiff:
      typeof record.lastDiff === "object" && record.lastDiff
        ? (record.lastDiff as Record<string, unknown>)
        : null,
    lastMissionId: record.lastMissionId,
    lastRunAt: record.lastRunAt?.toISOString() ?? null,
    lastSnapshotId: record.lastSnapshotId,
    missionType: record.missionType,
    nextRunAt: record.nextRunAt.toISOString(),
    scheduleId: record.scheduleId,
    scopeIds: record.scopeIds,
    status: record.status,
    tenantId: record.tenantId,
    updatedAt: record.updatedAt.toISOString()
  };
}

export async function writeAuditEvent(
  prisma: Prisma.TransactionClient | PrismaClient,
  input: {
    action: AuditEventAction;
    actorType: string;
    entityId?: string | null;
    entityType: AuditEvent["entityType"];
    metadata?: Record<string, unknown>;
    tenantId?: string | null;
    userId?: string | null;
  }
) {
  await prisma.auditEvent.create({
    data: {
      action: AUDIT_ACTION_TO_DB[input.action] as never,
      actorType: input.actorType,
      entityId: input.entityId ?? null,
      entityType: input.entityType,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      tenantId: input.tenantId ?? null,
      userId: input.userId ?? null
    }
  });
}

/**
 * Server-side billing-entitlement enforcement boundary. Resolves the tenant's
 * active subscription package and asserts it includes the capability a gated
 * action requires. When the package does not include it (or the tenant is
 * unsubscribed), the denial is audited (`billing.entitlement_denied`) and a
 * 402 AppServiceError is thrown BEFORE the action runs — no payment SDK, the
 * decision is derived from the package's declared inclusions, never inferred.
 */
export async function expireTenantTrialIfNeeded(
  prisma: Prisma.TransactionClient | PrismaClient,
  tenantId: string,
  now = new Date()
) {
  let tenant = await prisma.tenant.findUnique({
    select: {
      billingPackageKey: true,
      trialActivatedBy: true,
      trialCancellationReason: true,
      trialCancelledAt: true,
      trialConversionApprovalRef: true,
      trialConvertedAt: true,
      trialDeletionScheduledAt: true,
      trialEndsAt: true,
      trialPreviousBillingPackageKey: true,
      trialRetentionDays: true,
      trialStartedAt: true,
      trialStatus: true,
      tenantId: true
    },
    where: { tenantId }
  });
  if (
    tenant?.trialStatus === "Active" &&
    tenant.trialEndsAt &&
    tenant.trialEndsAt.getTime() <= now.getTime()
  ) {
    const deletionScheduledAt = new Date(
      now.getTime() + tenant.trialRetentionDays * 24 * 60 * 60 * 1_000
    );
    const expired = await prisma.tenant.updateMany({
      data: {
        billingPackageKey: tenant.trialPreviousBillingPackageKey,
        trialDeletionScheduledAt: deletionScheduledAt,
        trialStatus: "Expired"
      },
      where: {
        tenantId,
        trialEndsAt: { lte: now },
        trialStatus: "Active"
      }
    });
    if (expired.count > 0) {
      await writeAuditEvent(prisma, {
        action: "trial.expired",
        actorType: "System",
        entityId: tenantId,
        entityType: "Tenant",
        metadata: {
          deletionScheduledAt: deletionScheduledAt.toISOString(),
          restoredPackageKey: tenant.trialPreviousBillingPackageKey,
          retentionDays: tenant.trialRetentionDays
        },
        tenantId
      });
      tenant = await prisma.tenant.findUnique({
        select: {
          billingPackageKey: true,
          trialActivatedBy: true,
          trialCancellationReason: true,
          trialCancelledAt: true,
          trialConversionApprovalRef: true,
          trialConvertedAt: true,
          trialDeletionScheduledAt: true,
          trialEndsAt: true,
          trialPreviousBillingPackageKey: true,
          trialRetentionDays: true,
          trialStartedAt: true,
          trialStatus: true,
          tenantId: true
        },
        where: { tenantId }
      });
    }
  }
  return tenant;
}

export async function requireCapability(
  prisma: Prisma.TransactionClient | PrismaClient,
  context: AuthenticatedContext,
  requiredCapability: string
): Promise<void> {
  const tenant = await expireTenantTrialIfNeeded(
    prisma,
    context.tenant.tenantId
  );
  const packageKey = tenant?.billingPackageKey ?? null;
  const activePackage =
    BILLING_PACKAGE_CATALOG.find((pkg) => pkg.packageKey === packageKey) ??
    null;

  const decision = evaluateCapabilityEntitlement({
    package: activePackage,
    requiredCapability
  });

  if (!decision.entitled) {
    await writeAuditEvent(prisma, {
      action: "billing.entitlement_denied",
      actorType: "User",
      entityId: context.tenant.tenantId,
      entityType: "Tenant",
      metadata: {
        packageKey,
        reason: decision.reason,
        requiredCapability
      },
      tenantId: context.tenant.tenantId,
      userId: context.user.userId
    });

    throw new AppServiceError(decision.reason, 402, "entitlement_denied");
  }
}

/**
 * Dependency bundle the shared model-gateway Policy Enforcement Point uses to
 * record tenant-level audit events and raise typed API errors.
 */
export const gatewayPolicyDeps: GatewayPolicyDeps = {
  createError: (message, statusCode, code) =>
    new AppServiceError(message, statusCode, code),
  writeTenantAuditEvent: (client, auditInput) =>
    writeAuditEvent(client, auditInput as Parameters<typeof writeAuditEvent>[1])
};

export async function writePolicyBindingMismatchAudit(
  prisma: Prisma.TransactionClient | PrismaClient,
  context: AuthenticatedContext,
  decision: {
    missionType: string;
    policyDecisionId: string;
    safetyLevel: string;
    scopeId: string;
  },
  input: {
    attemptedMissionType: string;
    attemptedSafetyLevel: string;
    attemptedScopeId: string;
    code: string;
    missionId?: string | null;
    stage: "create" | "start";
  }
) {
  await writeAuditEvent(prisma, {
    action: "policy.decision",
    actorType: "User",
    entityId: decision.policyDecisionId,
    entityType: "Scope",
    metadata: {
      attemptedMissionType: input.attemptedMissionType,
      attemptedSafetyLevel: input.attemptedSafetyLevel,
      attemptedScopeId: input.attemptedScopeId,
      code: input.code,
      decisionMissionType: decision.missionType,
      decisionSafetyLevel: decision.safetyLevel,
      decisionScopeId: decision.scopeId,
      missionBindingGuard: true,
      missionId: input.missionId ?? null,
      outcome: "Denied",
      stage: input.stage
    },
    tenantId: context.tenant.tenantId,
    userId: context.user.userId
  });
}

export function buildVerificationMethod(scopeType: ScopeType) {
  if (scopeType === "Domain" || scopeType === "Subdomain") {
    return "DNS_TXT";
  }
  if (scopeType === "Repository") {
    return "REPO_TOKEN_FILE";
  }
  if (scopeType === "CloudAccount") {
    return "AWS_INTEGRATION";
  }
  if (scopeType === "IPRange" || scopeType === "InternalNetwork") {
    return "OPERATOR_ATTESTATION";
  }

  return "MANUAL";
}

export function createScopeVerificationToken() {
  return `periscan-${randomBytes(12).toString("hex")}`;
}

export function isHostnameTargetAllowedByScope(
  scope: Scope,
  targetHost: string
) {
  const normalizedTarget = targetHost.toLowerCase();
  const normalizedValue = scope.value.toLowerCase();

  if (scope.scopeType === "Domain" || scope.scopeType === "Subdomain") {
    return (
      normalizedTarget === normalizedValue ||
      normalizedTarget.endsWith(`.${normalizedValue}`)
    );
  }

  if (scope.scopeType === "InternalNetwork") {
    return true;
  }

  if (scope.scopeType === "IPRange") {
    return normalizedTarget === normalizedValue;
  }

  return false;
}

export function buildScopeConstraints(
  scope: Scope,
  ports: number[]
): RunnerTaskEnvelope["scopeConstraints"] {
  if (scope.scopeType === "Domain" || scope.scopeType === "Subdomain") {
    return {
      approvedCidrs: [],
      approvedDnsSuffixes: [scope.value],
      approvedHostnames: [scope.value],
      approvedPorts: ports,
      forbidInternetEgress: false
    };
  }

  if (scope.scopeType === "IPRange") {
    return {
      approvedCidrs: [scope.value],
      approvedDnsSuffixes: [],
      approvedHostnames: [],
      approvedPorts: ports,
      forbidInternetEgress: true
    };
  }

  return {
    approvedCidrs: [],
    approvedDnsSuffixes: [],
    approvedHostnames: [scope.value],
    approvedPorts: ports,
    forbidInternetEgress: true
  };
}

function zonedScheduleParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric"
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const year = read("year");
  const month = read("month");
  const day = read("day");
  return {
    day,
    dayOfWeek: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
    hour: read("hour"),
    minute: read("minute"),
    month,
    year
  };
}

function localScheduleDate(
  input: {
    day: number;
    hour: number;
    minute: number;
    month: number;
    year: number;
  },
  timeZone: string
) {
  let candidate = new Date(
    Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute)
  );
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const actual = zonedScheduleParts(candidate, timeZone);
    const desiredAsUtc = Date.UTC(
      input.year,
      input.month - 1,
      input.day,
      input.hour,
      input.minute
    );
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute
    );
    candidate = new Date(candidate.getTime() + desiredAsUtc - actualAsUtc);
  }
  return candidate;
}

function shiftLocalScheduleDate(
  input: { day: number; month: number; year: number },
  days: number
) {
  const shifted = new Date(
    Date.UTC(input.year, input.month - 1, input.day + days)
  );
  return {
    day: shifted.getUTCDate(),
    month: shifted.getUTCMonth() + 1,
    year: shifted.getUTCFullYear()
  };
}

function timeMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

function moveScheduleOutsideBlackout(candidate: Date, timing: ScheduleTiming) {
  let next = candidate;
  for (let iteration = 0; iteration < 10; iteration += 1) {
    const local = zonedScheduleParts(next, timing.timeZone);
    const minuteOfDay = local.hour * 60 + local.minute;
    const previousDay = (local.dayOfWeek + 6) % 7;
    let moved = false;
    for (const window of timing.blackoutWindows) {
      const start = timeMinutes(window.startTime);
      const end = timeMinutes(window.endTime);
      let endDayOffset = 0;
      let blocked = false;
      if (start < end) {
        blocked =
          window.daysOfWeek.includes(local.dayOfWeek) &&
          minuteOfDay >= start &&
          minuteOfDay < end;
      } else if (start > end) {
        if (
          window.daysOfWeek.includes(local.dayOfWeek) &&
          minuteOfDay >= start
        ) {
          blocked = true;
          endDayOffset = 1;
        } else if (
          window.daysOfWeek.includes(previousDay) &&
          minuteOfDay < end
        ) {
          blocked = true;
        }
      }
      if (!blocked) continue;
      const date = shiftLocalScheduleDate(local, endDayOffset);
      next = localScheduleDate(
        {
          ...date,
          hour: Math.floor(end / 60),
          minute: end % 60
        },
        timing.timeZone
      );
      moved = true;
      break;
    }
    if (!moved) return next;
  }
  return next;
}

export function calculateNextRunAt(
  frequency: MissionSchedule["frequency"],
  from: Date,
  timing?: ScheduleTiming
) {
  if (timing) {
    const local = zonedScheduleParts(from, timing.timeZone);
    const [hour, minute] = timing.runAtLocalTime.split(":").map(Number);
    let date = { day: local.day, month: local.month, year: local.year };

    if (frequency === "Weekly") {
      const targetDay = timing.dayOfWeek ?? local.dayOfWeek;
      date = shiftLocalScheduleDate(
        date,
        (targetDay - local.dayOfWeek + 7) % 7
      );
    } else if (frequency === "Monthly") {
      date.day = timing.dayOfMonth ?? Math.min(local.day, 28);
    }

    let candidate = localScheduleDate(
      { ...date, hour: hour ?? 0, minute: minute ?? 0 },
      timing.timeZone
    );
    if (candidate.getTime() <= from.getTime()) {
      if (frequency === "Daily") {
        date = shiftLocalScheduleDate(date, 1);
      } else if (frequency === "Weekly") {
        date = shiftLocalScheduleDate(date, 7);
      } else {
        const shiftedMonth = new Date(Date.UTC(date.year, date.month, 1));
        date = {
          day: timing.dayOfMonth ?? Math.min(local.day, 28),
          month: shiftedMonth.getUTCMonth() + 1,
          year: shiftedMonth.getUTCFullYear()
        };
      }
      candidate = localScheduleDate(
        { ...date, hour: hour ?? 0, minute: minute ?? 0 },
        timing.timeZone
      );
    }
    return moveScheduleOutsideBlackout(candidate, timing);
  }

  const next = new Date(from);

  if (frequency === "Daily") {
    next.setUTCDate(next.getUTCDate() + 1);
  } else if (frequency === "Weekly") {
    next.setUTCDate(next.getUTCDate() + 7);
  } else {
    next.setUTCMonth(next.getUTCMonth() + 1);
  }

  return next;
}

function riskBandToSeverity(
  band: AttackPathAssessment["risk"]["band"]
): Severity {
  if (band === "Fixed") {
    return "Informational";
  }

  return band;
}

function mapValidationStateToExploitability(
  state: AttackPathAssessment["attackPath"]["validationState"]
): ExploitabilityState {
  switch (state) {
    case "Exploitable":
      return "Exploitable";
    case "Reachable":
      return "Reachable";
    case "Validated":
    case "Detected":
    case "Logged":
    case "Alerted":
      return "Validated";
    case "Blocked":
    case "Mitigated":
    case "Fixed":
      return "Blocked";
    case "Inconclusive":
    case "ClosedWithoutEvidence":
      return "Inconclusive";
    default:
      return "Unknown";
  }
}

function mapPathObjectiveState(
  state: AttackPathAssessment["attackPath"]["validationState"]
): NonNullable<ValidatedFinding["pathProof"]>["objectiveState"] {
  if (state === "Blocked" || state === "Mitigated" || state === "Fixed") {
    return "Blocked";
  }

  if (
    state === "Validated" ||
    state === "Exploitable" ||
    state === "Reachable"
  ) {
    return "Reached";
  }

  if (state === "Inconclusive") {
    return "Unknown";
  }

  return "NotReached";
}

export function mapRemediationStatusToFindingStatus(
  remediation: RemediationTask | null,
  fallback: ValidatedFindingStatus = "Validated"
): ValidatedFindingStatus {
  if (!remediation) {
    return fallback;
  }

  switch (remediation.status) {
    case "Fixed":
    case "Mitigated":
      return remediation.latestVerification?.measuredRevalidation === true &&
        (remediation.latestVerification.outcome === "Fixed" ||
          remediation.latestVerification.outcome === "Mitigated")
        ? "Revalidated"
        : "Inconclusive";
    case "PartiallyFixed":
      // A partial fix has reduced — not eliminated — the exposure, so the
      // finding is still active. Reporting it as "Fixed" would over-claim
      // resolution (a partial fix is not more resolved than a full one).
      return remediation.ticketId ? "Routed" : "InProgress";
    case "StillExposed":
    case "Reopened":
      return "Reopened";
    case "VerificationPending":
      return "Routed";
    case "InProgress":
      return remediation.ticketId ? "Routed" : "InProgress";
    case "Inconclusive":
    case "ClosedWithoutEvidence":
      return "Inconclusive";
    default:
      return fallback;
  }
}

function parseImportSignalMeta(signal: SignalEnvelope): {
  severity: Severity | null;
  title: string | null;
} {
  const pointer = signal.rawPayloadPointer ?? "";
  if (
    signal.signalSubcategory !== "ImportedScanFinding" &&
    !pointer.startsWith("periscan-import://")
  ) {
    return { severity: null, title: null };
  }
  try {
    const url = new URL(pointer);
    const severityRaw = url.searchParams.get("severity");
    const severity: Severity | null =
      severityRaw === "Critical" ||
      severityRaw === "High" ||
      severityRaw === "Medium" ||
      severityRaw === "Low" ||
      severityRaw === "Info"
        ? severityRaw
        : null;
    return { severity, title: url.searchParams.get("title") };
  } catch {
    return { severity: null, title: null };
  }
}

function isImportedScanSignal(signal: SignalEnvelope): boolean {
  return (
    signal.signalSubcategory === "ImportedScanFinding" ||
    (signal.sourceType?.startsWith("import.") ?? false)
  );
}

function mapSignalSeverity(signal: SignalEnvelope): Severity {
  const subcategory = signal.signalSubcategory ?? "";
  const importMeta = parseImportSignalMeta(signal);
  if (importMeta.severity) {
    return importMeta.severity;
  }

  if (
    [
      "Missed",
      "NoEvidence",
      "NeedsTuning",
      "GuardrailBypassed",
      "LeakageObserved",
      "UnauthorizedRetrievalObserved",
      "UnsafeToolCallAttempted",
      "Regressed"
    ].includes(subcategory)
  ) {
    return "High";
  }

  if (["Blocked", "GuardrailHeld", "Passed"].includes(subcategory)) {
    return "Low";
  }

  // Defense-in-depth / hardening-hygiene exposures are Low — a missing CAA
  // record is a recommended issuance-control hardening, not an active exposure,
  // so it must not be inflated to the generic Exposure default (High). Honest
  // severity keeps operator prioritization accurate.
  if (["DnsCaaMissing"].includes(subcategory)) {
    return "Low";
  }

  if (signal.signalCategory === "Exposure") {
    return "High";
  }

  return "Medium";
}

function isBenignAIEndpointProbeSignal(
  signal: Pick<SignalEnvelope, "signalCategory" | "sourceType">
) {
  return (
    signal.signalCategory === "AIApplication" &&
    signal.sourceType === "endpoint_probe.benign_policy_boundary"
  );
}

function mapSignalExploitability(signal: SignalEnvelope): ExploitabilityState {
  const subcategory = signal.signalSubcategory ?? "";

  // Imported scan files are not Periscan-measured. Do not claim Reachable/Validated.
  if (isImportedScanSignal(signal)) {
    return "Unknown";
  }

  if (subcategory === "Blocked" || subcategory === "GuardrailHeld") {
    return "Blocked";
  }

  if (subcategory === "NoEvidence" || subcategory === "Inconclusive") {
    return "Inconclusive";
  }

  if (
    [
      "Missed",
      "GuardrailBypassed",
      "LeakageObserved",
      "UnauthorizedRetrievalObserved",
      "UnsafeToolCallAttempted",
      "Regressed"
    ].includes(subcategory)
  ) {
    return "Exploitable";
  }

  if (signal.signalCategory === "Exposure") {
    return "Reachable";
  }

  return "Validated";
}

function mapSignalSourceMotion(
  signal: SignalEnvelope
): ValidatedFinding["sourceMotion"] | null {
  if (isBenignAIEndpointProbeSignal(signal)) {
    return null;
  }

  if (signal.signalCategory === "ControlObservation") {
    return "BAS";
  }

  if (signal.signalCategory === "AIApplication") {
    return "AIApp";
  }

  if (signal.signalCategory === "Exposure") {
    return "EXV";
  }

  if (signal.signalCategory === "Cloud") {
    return "Cloud";
  }

  if (
    signal.signalCategory === "Repository" &&
    (signal.signalSubcategory ?? "").toLowerCase().includes("secret")
  ) {
    return "Secrets";
  }

  return null;
}

function getSignalSourceEntityType(
  signal: SignalEnvelope
): ValidatedFinding["sourceEntityType"] {
  if (signal.signalCategory === "ControlObservation") {
    return "ControlSource";
  }

  if (signal.signalCategory === "AIApplication") {
    return "AIApplication";
  }

  if (signal.signalCategory === "Exposure") {
    return "Exposure";
  }

  if (
    signal.signalCategory === "Cloud" ||
    signal.signalCategory === "Repository"
  ) {
    return "Asset";
  }

  return "ValidationRun";
}

function buildMissingSignalImpact(
  missingSignals: MissingSignal[]
): ValidatedFindingMissingSignalImpact | null {
  const confidenceReducingMissingSignals =
    getConfidenceReducingMissingSignals(missingSignals);

  if (confidenceReducingMissingSignals.length === 0) {
    return null;
  }

  const statuses = [
    ...new Set(confidenceReducingMissingSignals.map((signal) => signal.status))
  ];
  const integrationCategories = [
    ...new Set(
      confidenceReducingMissingSignals.flatMap((signal) =>
        signal.requiredIntegrationCategory
          ? [signal.requiredIntegrationCategory]
          : []
      )
    )
  ];
  const count = confidenceReducingMissingSignals.length;
  const adjustment = -Math.min(0.35, count * 0.05);
  const recommendation = statuses.includes("RequiresVerifiedScope")
    ? "Verify authorized scope before treating this finding as fully bounded."
    : statuses.includes("RequiresInternalRunner")
      ? "Deploy an internal runner before claiming internal reachability or control proof."
      : integrationCategories.length > 0
        ? `Connect ${integrationCategories.join(", ")} telemetry before presenting this finding as fully evidenced.`
        : "Resolve missing proof inputs before presenting this finding as complete.";

  return {
    confidenceAdjustment: Number(adjustment.toFixed(2)),
    missingSignalCount: count,
    missingSignalIds: confidenceReducingMissingSignals.map(
      (signal) => signal.missingSignalId
    ),
    missingSignalStatuses: statuses,
    recommendation,
    summary:
      count === 1
        ? "One missing proof input reduces confidence in this finding's completeness."
        : `${count} missing proof inputs reduce confidence in this finding's completeness.`
  };
}

function selectMissingSignalsForFinding(input: {
  missingSignals: MissingSignal[];
  relatedEntityIds: string[];
}) {
  const relatedEntityIds = new Set(input.relatedEntityIds);
  const directlyRelated = input.missingSignals.filter((signal) =>
    relatedEntityIds.has(signal.relatedEntityId)
  );

  return directlyRelated.length > 0 ? directlyRelated : input.missingSignals;
}

export function filterValidatedFindings(
  findings: ValidatedFinding[],
  filters: ValidatedFindingFilter = {}
) {
  return findings.filter((finding) => {
    if (filters.sourceMotion && finding.sourceMotion !== filters.sourceMotion) {
      return false;
    }

    if (filters.assetId && !finding.relatedAssetIds.includes(filters.assetId)) {
      return false;
    }

    if (filters.severity && finding.severity !== filters.severity) {
      return false;
    }

    if (
      filters.exploitability &&
      finding.exploitability !== filters.exploitability
    ) {
      return false;
    }

    if (filters.status && finding.status !== filters.status) {
      return false;
    }

    if (
      filters.validationState &&
      finding.validationState !== filters.validationState
    ) {
      return false;
    }

    if (
      filters.priorityMin != null &&
      finding.priorityScore < filters.priorityMin
    ) {
      return false;
    }

    // owner=unassigned uses operational ownership (ownerId/ownerDisplay), not
    // AcceptedRisk-only disposition.ownerId (P18-3).
    if (filters.owner === "unassigned" && !isUnownedValidatedFinding(finding)) {
      return false;
    }

    if (
      filters.owner &&
      filters.owner !== "unassigned" &&
      resolveFindingOwnerMemberId(finding) !== filters.owner
    ) {
      return false;
    }

    if (filters.disposition === "none" && finding.disposition) {
      return false;
    }

    if (
      filters.disposition &&
      filters.disposition !== "none" &&
      finding.disposition?.disposition !== filters.disposition
    ) {
      return false;
    }

    if (
      filters.excludeDisposition &&
      filters.excludeDisposition.length > 0 &&
      finding.disposition?.disposition &&
      filters.excludeDisposition.includes(finding.disposition.disposition)
    ) {
      return false;
    }

    if (
      filters.search &&
      !`${finding.title} ${finding.impact} ${finding.remediation}`
        .toLowerCase()
        .includes(filters.search.toLowerCase())
    ) {
      return false;
    }

    return true;
  });
}

/**
 * Slice 4 Phase C–D: build derived findings, stamp stable fingerprints, then
 * path-primary absorb + fingerprint group so the queue returns unique work
 * items when possible.
 *
 * Disposition keys: findingDisposition rows remain keyed by findingId (no
 * schema migration). P06-17: grouping keeps memberFindingIds on the public
 * DTO; overlay matches the representative id OR any group member id, and
 * transitionFinding copies the disposition onto every member id so triage
 * is not orphaned when absorb/group changes the representative.
 *
 * SAFETY: absorb + group never upgrade validationState / exploitability /
 * evidenceBasis claim language; they only union assets/evidence/timestamps and
 * sum occurrence counts onto the representative.
 */

/**
 * Extract correlation keys from a signal payload when present.
 * Looks only at known carrier shapes (correlationKeys, attributes, metadata);
 * never invents keys from category/source alone.
 */
export function extractSignalCorrelationKeys(
  signal: SignalEnvelope & {
    attributes?: unknown;
    correlationKeys?: unknown;
    metadata?: unknown;
  }
): string[] {
  const collected: string[] = [];

  const pushKeys = (value: unknown) => {
    if (!Array.isArray(value)) {
      return;
    }
    for (const entry of value) {
      if (typeof entry === "string" && entry.trim().length > 0) {
        collected.push(entry.trim());
      }
    }
  };

  pushKeys(signal.correlationKeys);

  const bags: unknown[] = [signal.attributes, signal.metadata];
  for (const bag of bags) {
    if (!bag || typeof bag !== "object" || Array.isArray(bag)) {
      continue;
    }
    const record = bag as Record<string, unknown>;
    pushKeys(record.correlationKeys);
    pushKeys(record.correlation_keys);
    if (
      typeof record.correlationKey === "string" &&
      record.correlationKey.trim().length > 0
    ) {
      collected.push(record.correlationKey.trim());
    }
    if (
      typeof record.correlation_key === "string" &&
      record.correlation_key.trim().length > 0
    ) {
      collected.push(record.correlation_key.trim());
    }
  }

  return [...new Set(collected)].sort((left, right) =>
    left.localeCompare(right)
  );
}

/**
 * Prefer an explicit patternId on the path row when present; otherwise leave
 * unset so computePathFindingMaterial can still use methodology suffix / name.
 */
export function extractPathPatternId(
  path: Pick<AttackPath, "methodology" | "name"> & {
    patternId?: string | null;
  }
): string | null {
  const explicit = path.patternId?.trim();
  if (explicit) {
    return explicit;
  }
  return null;
}

/** Finding row with fingerprint fields always set (pre/post group). */
type FingerprintedValidatedFinding = ValidatedFinding & {
  affectedAssetCount: number;
  fingerprint: string;
  firstSeenAt: string;
  groupKey: string;
  lastSeenAt: string;
  occurrenceCount: number;
  rootCauseSummary: string;
};

export function buildValidatedFindings(input: {
  attackPaths: AttackPathAssessment[];
  missingSignals: MissingSignal[];
  remediations: RemediationTask[];
  signals: SignalEnvelope[];
  tenantId: string;
}): ValidatedFinding[] {
  const { remediationsByFingerprint, remediationsByPathId } =
    indexRemediationsForFindings(input.remediations);
  const findings: FingerprintedValidatedFinding[] = [];

  for (const pathAssessment of input.attackPaths) {
    const path = pathAssessment.attackPath;
    // P09-2: explicit claim-safe projection — never silently keep overclaiming
    // Reachable/Validated/Exploitable when hop measurement does not support it.
    const pathProjection = projectPathValidationState(path);
    const pathClaim = pathProjection.claim;
    const claimValidationState = pathProjection.claimSafeValidationState;
    const pathRiskSummary = buildAttackPathRiskSummary(
      path,
      pathAssessment.risk.band
    );
    const claimExploitability: ExploitabilityState =
      pathClaim.canClaimExploitable
        ? "Exploitable"
        : pathClaim.canClaimValidated
          ? "Validated"
          : pathClaim.canClaimReachable
            ? "Reachable"
            : pathClaim.fullyMeasured
              ? mapValidationStateToExploitability(claimValidationState)
              : "Unknown";
    const enrichedPath = path as AttackPath & { nonSnapPack?: unknown };
    const pathNodeLabels = path.pathNodes
      .sort((left, right) => left.sequence - right.sequence)
      .map((node) => node.label);
    const relatedAssetIds = path.pathNodes
      .filter(
        (node) => node.entityType === "Asset" || node.entityType === "Exposure"
      )
      .map((node) => node.entityId);
    const uniqueRelatedAssetIds = [...new Set(relatedAssetIds)];
    const relatedControlIds = path.pathEdges
      .filter((edge) =>
        ["DETECTED_BY", "BLOCKED_BY", "MISSED_BY"].includes(edge.relationship)
      )
      .map((edge) => edge.targetNodeId);
    // Fingerprint from template family (methodology suffix / name) + assets —
    // never path UUID — so re-correlated paths of the same cause collapse.
    const pathFingerprint = computePathFindingMaterial({
      assetCorrelationKeys: uniqueRelatedAssetIds,
      methodology: path.methodology,
      name: path.name,
      patternId: extractPathPatternId(
        path as AttackPath & { patternId?: string | null }
      )
    });
    // PERISCAN-7: path-linked remediation first, else open task for same cause.
    const remediation = resolvePrimaryRemediationForFinding({
      fingerprint: pathFingerprint.fingerprint,
      pathId: path.pathId,
      remediationsByFingerprint,
      remediationsByPathId
    });
    const ownerSla = projectFindingOwnerSlaFromRemediation(remediation);
    const missingSignalImpact = buildMissingSignalImpact(
      selectMissingSignalsForFinding({
        missingSignals: input.missingSignals,
        relatedEntityIds: [
          path.pathId,
          ...relatedAssetIds,
          ...relatedControlIds,
          ...(remediation ? [remediation.remediationId] : [])
        ]
      })
    );

    findings.push({
      createdAt: path.createdAt,
      // Attack-path findings are correlated control-plane-side, not in-network.
      measuredInNetwork: false,
      crossLinks: [
        {
          entityId: path.pathId,
          entityType: "AttackPath",
          label: pathClaim.displayLabel,
          relationship: "priority_attack_path"
        },
        ...(remediation
          ? [
              {
                entityId: remediation.remediationId,
                entityType: "RemediationTask" as const,
                label: "Remediation task",
                relationship: remediation.ticketId ? "routed_to" : "remediates"
              }
            ]
          : [])
      ],
      evidenceIds: path.evidenceIds,
      exploitability: claimExploitability,
      // Keep findingId = pathId so disposition overlays keyed by pathId still match.
      findingId: path.pathId,
      fingerprint: pathFingerprint.fingerprint,
      groupKey: pathFingerprint.groupKey,
      rootCauseSummary: pathFingerprint.rootCauseSummary,
      firstSeenAt: path.createdAt,
      lastSeenAt: remediation?.updatedAt ?? path.updatedAt,
      occurrenceCount: 1,
      affectedAssetCount: uniqueRelatedAssetIds.length,
      impact: pathRiskSummary,
      missingSignalImpact,
      pathProof: {
        blastRadiusSummary:
          relatedAssetIds.length > 0
            ? `${relatedAssetIds.length} asset${relatedAssetIds.length === 1 ? "" : "s"} linked to this path.`
            : "Blast radius is limited to the current path evidence available.",
        // Evidence-backed path breakers only — never exact min-cut / Leading claims.
        chokePoints:
          path.pathBreakers.length > 0
            ? path.pathBreakers.map((breaker) => breaker.title)
            : ["Investigate the first evidence-backed path breaker."],
        claimDisplayLabel: pathClaim.displayLabel,
        entryPoint: pathNodeLabels[0] ?? path.name,
        fullyMeasured: pathClaim.fullyMeasured,
        intermediateSteps: pathNodeLabels.slice(1, -1),
        measuredEdgeCount: pathClaim.measuredEdgeCount,
        objective: pathNodeLabels[pathNodeLabels.length - 1] ?? path.name,
        objectiveState: pathClaim.fullyMeasured
          ? mapPathObjectiveState(claimValidationState)
          : "Unknown",
        totalEdgeCount: pathClaim.totalEdgeCount
      },
      priorityReason: {
        businessContext:
          "Prioritization includes the path impact score and available asset context.",
        controlEffectiveness:
          relatedControlIds.length > 0
            ? "Control interactions are linked on this path."
            : "No blocking control evidence is linked to this path.",
        exploitability: pathProjection.remapped
          ? `Exploitability is ${claimExploitability.toLowerCase()} after claim-safe remap: ${pathProjection.remapReason} Claim-safe state: ${claimValidationState}.`
          : pathClaim.fullyMeasured
            ? `Exploitability is ${claimExploitability.toLowerCase()} from measured path evidence and recorded state ${path.validationState}.`
            : `Exploitability is unknown because ${pathClaim.displayLabel.toLowerCase()} does not have every hop measured. Recorded workflow state: ${path.validationState}.`,
        pathContext:
          pathClaim.totalEdgeCount > 0
            ? `${pathClaim.measuredEdgeCount}/${pathClaim.totalEdgeCount} hops measured (${pathClaim.displayLabel}). Path breakers are evidence-backed recommendations, not exact global min-cut science.`
            : "Path context is based on the current evidence-labeled path record; no hop edges to measure yet.",
        summary: pathRiskSummary
      },
      priorityFormula:
        "Priority = clamp(sum of atomic path-risk contributions, 0, 100).",
      priorityScore: pathAssessment.risk.score,
      riskFactors: pathAssessment.risk.factors,
      relatedAssetIds: uniqueRelatedAssetIds,
      relatedControlIds: [...new Set(relatedControlIds)],
      relatedPathIds: [path.pathId],
      relatedRemediationIds: remediation ? [remediation.remediationId] : [],
      remediation:
        remediation?.recommendedAction ??
        path.pathBreakers[0]?.description ??
        "Create a path breaker remediation and rerun validation.",
      disposition: null,
      severity: riskBandToSeverity(pathAssessment.risk.band),
      source: "AttackPath",
      sourceEntityId: path.pathId,
      sourceEntityType: "AttackPath",
      // P09-5 / P09-10: derive sourceMotion from path methodology/name — never hardcode APT.
      sourceMotion: deriveFindingSourceMotion({
        methodology: path.methodology,
        pathName: path.name
      }),
      status: mapRemediationStatusToFindingStatus(
        remediation,
        pathClaim.canClaimValidated ? "Validated" : "NeedsReview"
      ),
      tenantId: input.tenantId,
      title: path.name,
      updatedAt: remediation?.updatedAt ?? path.updatedAt,
      validationState: claimValidationState,
      // Operational owner/SLA from primary remediation only (never invented).
      ...ownerSla,
      // Propagate non-snap enrichment from path (for findings list when non-snap evidence)
      ...(enrichedPath.nonSnapPack
        ? { nonSnapPack: enrichedPath.nonSnapPack }
        : {})
    });
  }

  for (const signal of input.signals) {
    const sourceMotion = mapSignalSourceMotion(signal);

    if (!sourceMotion) {
      continue;
    }

    // Same category/subcategory/source + assets (+ techniques) → same fingerprint
    // so duplicate signal observations collapse into one queue item.
    const signalFingerprint = computeSignalFindingMaterial({
      correlationKeys: extractSignalCorrelationKeys(signal),
      relatedAssetIds: signal.relatedAssetIds,
      signalCategory: signal.signalCategory,
      signalSubcategory: signal.signalSubcategory,
      sourceType: signal.sourceType,
      sourceVendor: signal.sourceVendor,
      techniqueIds: signal.techniqueIds
    });
    const evidenceLinkedRemediations = input.remediations.filter(
      (remediation) =>
        remediation.evidenceIds.some((evidenceId) =>
          signal.evidenceIds.includes(evidenceId)
        )
    );
    const fingerprintRemediation =
      remediationsByFingerprint.get(signalFingerprint.fingerprint) ?? null;
    // Prefer evidence-linked remediations; fall back to open task for same cause.
    const relatedRemediations =
      evidenceLinkedRemediations.length > 0
        ? evidenceLinkedRemediations
        : fingerprintRemediation
          ? [fingerprintRemediation]
          : [];
    const primaryRemediation = relatedRemediations[0] ?? null;
    const ownerSla = projectFindingOwnerSlaFromRemediation(primaryRemediation);
    const severity = mapSignalSeverity(signal);
    const exploitability = mapSignalExploitability(signal);
    const missingSignalImpact = buildMissingSignalImpact(
      selectMissingSignalsForFinding({
        missingSignals: input.missingSignals,
        relatedEntityIds: [
          signal.signalId,
          ...signal.relatedAssetIds,
          ...signal.relatedControlIds,
          ...signal.relatedPathIds,
          ...relatedRemediations.map((remediation) => remediation.remediationId)
        ]
      })
    );
    const imported = isImportedScanSignal(signal);
    const importMeta = parseImportSignalMeta(signal);
    const status = imported
      ? "NeedsReview"
      : signal.signalSubcategory === "Blocked" ||
          signal.signalSubcategory === "GuardrailHeld"
        ? "Validated"
        : signal.signalSubcategory === "NoEvidence"
          ? "NeedsReview"
          : mapRemediationStatusToFindingStatus(primaryRemediation);
    const confidence = signal.confidence ?? 0.5;
    const confidenceContribution = Math.round(confidence * 100);
    const severityContribution =
      severity === "Critical" ? 20 : severity === "High" ? 10 : 0;
    const signalRiskFactors = [
      {
        contribution: confidenceContribution,
        key: "signal-confidence",
        label: "Signal confidence",
        rationale:
          "The source confidence is converted to percentage points with round(confidence × 100).",
        value: confidence.toFixed(2)
      },
      ...(severityContribution > 0
        ? [
            {
              contribution: severityContribution,
              key: "severity-uplift",
              label: "Severity uplift",
              rationale:
                "Critical signals add 20 points and high-severity signals add 10 before the score is bounded.",
              value: severity
            }
          ]
        : [])
    ];

    findings.push({
      createdAt: signal.createdAt,
      // In-network vantage when the signal was runner-measured.
      measuredInNetwork: Boolean(signal.sourceRunnerId),
      crossLinks: [
        ...signal.relatedPathIds.map((pathId) => ({
          entityId: pathId,
          entityType: "AttackPath" as const,
          label: "Related path",
          relationship: "relates_to_path"
        })),
        ...relatedRemediations.map((remediation) => ({
          entityId: remediation.remediationId,
          entityType: "RemediationTask" as const,
          label: "Remediation task",
          relationship: remediation.ticketId ? "routed_to" : "remediates"
        }))
      ],
      evidenceIds: signal.evidenceIds,
      exploitability,
      // Keep findingId = signalId so disposition overlays keyed by signalId match
      // when this row remains the representative (or when not absorbed into a path).
      findingId: signal.signalId,
      fingerprint: signalFingerprint.fingerprint,
      groupKey: signalFingerprint.groupKey,
      rootCauseSummary: signalFingerprint.rootCauseSummary,
      firstSeenAt: signal.createdAt,
      lastSeenAt: signal.updatedAt,
      occurrenceCount: 1,
      affectedAssetCount: signal.relatedAssetIds.length,
      impact: imported
        ? `Imported scan finding from ${signal.sourceVendor} (evidenceBasis=Imported; not Periscan-measured).`
        : sourceMotion === "BAS"
          ? `Control validation observed ${signal.signalSubcategory ?? "control evidence"}.`
          : sourceMotion === "AIApp"
            ? `AI validation observed ${signal.signalSubcategory ?? "AI application risk"}.`
            : `Exposure validation observed ${signal.signalSubcategory ?? signal.signalCategory}.`,
      missingSignalImpact,
      pathProof: null,
      priorityReason: {
        businessContext:
          "Prioritization includes source confidence and related asset context where available.",
        controlEffectiveness:
          sourceMotion === "BAS"
            ? `Control outcome is ${signal.signalSubcategory ?? "observed"}.`
            : "Control context is included when related controls or paths are linked.",
        exploitability: imported
          ? "Exploitability is unknown because this row is an imported scan finding, not a Periscan-measured path."
          : `Exploitability is ${exploitability.toLowerCase()} from ${signal.signalSubcategory ?? signal.signalCategory}.`,
        pathContext:
          signal.relatedPathIds.length > 0
            ? `${signal.relatedPathIds.length} related path${signal.relatedPathIds.length === 1 ? "" : "s"} linked.`
            : "No attack path link is currently present.",
        summary: imported
          ? `Imported ${signal.sourceVendor} finding (evidenceBasis=Imported).`
          : `${sourceMotion} finding from ${signal.sourceVendor} ${signal.sourceType}.`
      },
      priorityFormula:
        "Priority = clamp(round(signal confidence × 100) + severity uplift, 1, 100).",
      priorityScore: Math.min(
        100,
        Math.max(1, confidenceContribution + severityContribution)
      ),
      riskFactors: signalRiskFactors,
      disposition: null,
      relatedAssetIds: signal.relatedAssetIds,
      relatedControlIds: signal.relatedControlIds,
      relatedPathIds: signal.relatedPathIds,
      relatedRemediationIds: relatedRemediations.map(
        (remediation) => remediation.remediationId
      ),
      remediation:
        primaryRemediation?.recommendedAction ??
        (imported
          ? "Correlate against authorized scope, then run Periscan validation before treating as measured exposure."
          : sourceMotion === "BAS"
            ? "Tune the control and rerun the BAS validation scenario."
            : "Review the validated evidence, apply the recommended control change, and rerun validation."),
      severity,
      source: signal.sourceType,
      sourceEntityId: signal.signalId,
      sourceEntityType: getSignalSourceEntityType(signal),
      sourceMotion,
      status,
      tenantId: input.tenantId,
      title: imported
        ? (importMeta.title ??
          `Imported · ${signal.sourceVendor} · ${signal.signalSubcategory ?? "scan"}`)
        : `${sourceMotion} ${signal.signalSubcategory ?? signal.signalCategory}`,
      updatedAt: signal.updatedAt,
      // Imported scans: Discovered only — never Validated/Measured from file alone.
      validationState: imported
        ? "Discovered"
        : exploitability === "Blocked"
          ? "Blocked"
          : exploitability === "Exploitable"
            ? "Exploitable"
            : exploitability === "Inconclusive"
              ? "Inconclusive"
              : "Validated",
      // Operational owner/SLA from primary remediation only (never invented).
      ...ownerSla
    });
  }

  // Path-primary absorb then fingerprint group. Claim language stays on the
  // representative (path preferred). memberFindingIds is retained (P06-17) so
  // disposition overlay/write can cover the whole fingerprint group.
  const absorbed =
    absorbContributingSignalsIntoPathFindings<FingerprintedValidatedFinding>(
      findings
    );
  const grouped: FingerprintedValidatedFinding[] = groupFindingsByFingerprint(
    absorbed
  ).map((finding) => ({
    ...finding,
    // GroupedFindingRow may widen optional timestamps; re-assert required fields.
    firstSeenAt: finding.firstSeenAt,
    lastSeenAt: finding.lastSeenAt,
    groupKey: finding.groupKey,
    rootCauseSummary: finding.rootCauseSummary ?? finding.groupKey,
    occurrenceCount: finding.occurrenceCount,
    affectedAssetCount: finding.affectedAssetCount,
    fingerprint: finding.fingerprint,
    memberFindingIds:
      finding.memberFindingIds.length > 0
        ? finding.memberFindingIds
        : finding.findingId
          ? [finding.findingId]
          : undefined
  }));

  return grouped.sort((left, right) => {
    if (right.priorityScore !== left.priorityScore) {
      return right.priorityScore - left.priorityScore;
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

export function getConnectorKey(
  config: Prisma.JsonValue | Record<string, unknown> | null
) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return null;
  }

  const connectorKey = (config as Record<string, unknown>).connectorKey;

  return typeof connectorKey === "string" ? connectorKey : null;
}

export function isMockMode(
  config: Prisma.JsonValue | Record<string, unknown> | null
) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return false;
  }

  return (config as Record<string, unknown>).mockMode === true;
}

const SENSITIVITY_LEVEL_ORDER: Record<
  EvidenceArtifact["sensitivityLevel"],
  number
> = {
  Low: 0,
  Moderate: 1,
  High: 2,
  Restricted: 3
};

function getHighestSensitivityLevel(
  signals: Array<Pick<SignalEnvelope, "sensitivityLevel">>
): EvidenceArtifact["sensitivityLevel"] {
  if (signals.length === 0) {
    return "Moderate";
  }

  return signals.reduce<EvidenceArtifact["sensitivityLevel"]>(
    (highest, signal) =>
      SENSITIVITY_LEVEL_ORDER[signal.sensitivityLevel] >
      SENSITIVITY_LEVEL_ORDER[highest]
        ? signal.sensitivityLevel
        : highest,
    "Low"
  );
}

export function attachEvidenceToSignals(
  signals: SignalEnvelope[],
  evidenceIds: string[]
): SignalEnvelope[] {
  return signals.map((signal) => ({
    ...signal,
    evidenceIds: appendUniqueIds(signal.evidenceIds, evidenceIds),
    relatedEvidenceIds: appendUniqueIds(signal.relatedEvidenceIds, evidenceIds)
  }));
}

async function persistConnectorAssets(input: {
  assets: Array<{
    assetType:
      | "Repository"
      | "Service"
      | "Host"
      | "Container"
      | "Kubernetes"
      | "CloudResource"
      | "Domain"
      | "Application"
      | "IdentityStore"
      | "Other";
    businessCriticality: "Low" | "Moderate" | "High" | "Critical";
    environment?: string | null;
    identifiers: Record<string, unknown>;
    internetExposed: boolean;
    name: string;
    owner?: string | null;
    status: "Active" | "Inactive" | "Archived";
    tags: string[];
  }>;
  evidenceId: string;
  integrationId: string;
  prisma: PrismaClient;
  tenantId: string;
}) {
  let assetCount = 0;
  const observedAt = new Date();
  const criticalityRank = { Critical: 3, High: 2, Low: 0, Moderate: 1 };
  const candidates = (
    await input.prisma.asset.findMany({ where: { tenantId: input.tenantId } })
  ).map((asset) => ({
    assetId: asset.assetId,
    assetType: asset.assetType,
    identifiers:
      asset.identifiers &&
      typeof asset.identifiers === "object" &&
      !Array.isArray(asset.identifiers)
        ? (asset.identifiers as Record<string, unknown>)
        : {},
    name: asset.name
  }));

  for (const asset of input.assets) {
    const resolution = resolveAssetObservation({
      candidates,
      observed: {
        assetType: asset.assetType,
        identifiers: asset.identifiers,
        name: asset.name
      }
    });
    const existing = resolution.matchedAssetId
      ? await input.prisma.asset.findUnique({
          where: { assetId: resolution.matchedAssetId }
        })
      : null;
    let assetId: string;

    if (existing) {
      const existingCriticality = existing.businessCriticality;
      const updated = await input.prisma.asset.update({
        where: {
          assetId: existing.assetId
        },
        data: {
          businessCriticality:
            criticalityRank[asset.businessCriticality] >
            criticalityRank[existingCriticality]
              ? asset.businessCriticality
              : existingCriticality,
          environment: existing.environment ?? asset.environment ?? null,
          identifiers: resolution.mergedIdentifiers as Prisma.InputJsonValue,
          internetExposed: existing.internetExposed || asset.internetExposed,
          lastSeenAt: observedAt,
          owner: existing.owner ?? asset.owner ?? null,
          status:
            existing.status === "Active" || asset.status === "Active"
              ? "Active"
              : asset.status,
          tags: [...new Set([...existing.tags, ...asset.tags])]
        }
      });
      assetId = updated.assetId;
      const candidate = candidates.find(
        (item) => item.assetId === updated.assetId
      );
      if (candidate) candidate.identifiers = resolution.mergedIdentifiers;
    } else {
      const created = await input.prisma.asset.create({
        data: {
          assetType: asset.assetType,
          businessCriticality: asset.businessCriticality,
          environment: asset.environment ?? null,
          firstSeenAt: new Date(),
          identifiers: asset.identifiers as Prisma.InputJsonValue,
          internetExposed: asset.internetExposed,
          lastSeenAt: observedAt,
          name: asset.name,
          owner: asset.owner ?? null,
          status: asset.status,
          tags: asset.tags,
          tenantId: input.tenantId
        }
      });
      assetId = created.assetId;
      candidates.push({
        assetId: created.assetId,
        assetType: created.assetType,
        identifiers: asset.identifiers,
        name: created.name
      });
    }

    const sourceAssetKey = createHash("sha256")
      .update(
        JSON.stringify({
          canonicalKeys: resolution.canonicalKeys,
          integrationId: input.integrationId,
          name: asset.name,
          type: asset.assetType
        })
      )
      .digest("hex");
    await input.prisma.assetSourceObservation.create({
      data: {
        assetId,
        canonicalKeys: resolution.canonicalKeys,
        conflictFields: resolution.conflictFields,
        evidenceId: input.evidenceId,
        integrationId: input.integrationId,
        observedAt,
        observedIdentifiers: asset.identifiers as Prisma.InputJsonValue,
        observedName: asset.name,
        observedType: asset.assetType,
        resolutionConfidence: resolution.confidence,
        resolutionStatus: resolution.status,
        sourceAssetKey,
        tenantId: input.tenantId
      }
    });

    assetCount += 1;
  }

  return assetCount;
}

export async function syncPersistedIntegration(input: {
  actorType?: string;
  actorUserId?: string | null;
  connector: Connector;
  integration: {
    authType: string;
    config: Prisma.JsonValue | null;
    integrationId: string;
    tenantId: string;
  };
  prisma: PrismaClient;
}): Promise<IntegrationSyncResult> {
  const connectorKey = getConnectorKey(input.integration.config);
  const operationStartedAt = Date.now();
  let result: Awaited<ReturnType<Connector["sync"]>>;

  try {
    result = await input.connector.sync({
      authType: input.integration.authType,
      config: decryptIntegrationConfig(
        input.integration.config,
        integrationSecretFieldKeys(input.connector, input.integration.authType)
      ),
      integrationId: input.integration.integrationId,
      mockMode: isMockMode(input.integration.config),
      tenantId: input.integration.tenantId
    });
  } catch (error) {
    await writeAuditEvent(input.prisma, {
      action: "integration.synced",
      actorType: input.actorType ?? "System",
      entityId: input.integration.integrationId,
      entityType: "Integration",
      metadata: {
        assetCount: 0,
        connectorKey,
        durationMs: Date.now() - operationStartedAt,
        errorMessage:
          error instanceof Error
            ? error.message.slice(0, 160)
            : "Connector sync failed.",
        healthStatus: "Unhealthy",
        product: input.connector.manifest.product,
        signalCount: 0,
        status: "Failed",
        vendor: input.connector.manifest.vendor
      },
      tenantId: input.integration.tenantId,
      userId: input.actorUserId ?? null
    });

    throw error;
  }
  const evidenceService = createPrismaEvidenceService({
    prisma: input.prisma
  });
  const syncArtifact = await evidenceService.putEvidenceArtifact({
    artifactType: "NormalizedEvidence",
    content: {
      assets: result.assets,
      connectorKey,
      health: result.health,
      signals: result.signals
    },
    filename: connectorKey ? `${connectorKey}-sync` : "integration-sync",
    relatedEntityId: input.integration.integrationId,
    relatedEntityType: "Integration",
    sensitivityLevel: getHighestSensitivityLevel(result.signals),
    tenantId: input.integration.tenantId
  });
  const normalizedSignals = attachEvidenceToSignals(result.signals, [
    syncArtifact.artifact.evidenceId
  ]);

  // Correlate ingested ControlObservation telemetry to the control sources this
  // integration backs, so technique-tagged signals drive control-rule coverage.
  // buildControlRuleCoverageSummary matches a signal to a control+scenario only
  // when it has BOTH relatedControlIds (the control source) AND the scenario's
  // techniqueId; sync'd signals previously had neither, so they were inert.
  const backingControlSources = await input.prisma.controlSource.findMany({
    select: { controlSourceId: true },
    where: {
      integrationId: input.integration.integrationId,
      tenantId: input.integration.tenantId
    }
  });
  const backingControlIds = backingControlSources.map(
    (row) => row.controlSourceId
  );
  if (backingControlIds.length > 0) {
    for (const signal of normalizedSignals) {
      if (
        signal.signalCategory === "ControlObservation" &&
        signal.relatedControlIds.length === 0
      ) {
        signal.relatedControlIds = backingControlIds;
      }
    }
  }

  const assetCount = await persistConnectorAssets({
    assets: result.assets,
    evidenceId: syncArtifact.artifact.evidenceId,
    integrationId: input.integration.integrationId,
    prisma: input.prisma,
    tenantId: input.integration.tenantId
  });

  if (connectorKey === "jira") {
    await applyMockJiraWorkflowSync({
      integration: input.integration,
      prisma: input.prisma
    });
  }

  // Resolve transient host/IP hints (hostnames/IPs carried on connector
  // telemetry) to the tenant's asset ids, so ingested signals are attributed to
  // the right asset and surface on that asset's findings. Matches a hint
  // case-insensitively against each asset's name or any string value in its
  // identifiers JSON. Mirrors the relatedControlIds backing above; runs after
  // persistConnectorAssets so freshly-synced assets are matchable too.
  const signalsWithAssetHints = normalizedSignals.filter(
    (signal) => (signal.relatedAssetHints ?? []).length > 0
  );
  if (signalsWithAssetHints.length > 0) {
    const tenantAssets = await input.prisma.asset.findMany({
      select: { assetId: true, identifiers: true, name: true },
      where: { tenantId: input.integration.tenantId }
    });
    const assetIdByHint = new Map<string, string>();
    const indexHint = (value: unknown, assetId: string) => {
      if (typeof value === "string" && value.trim().length > 0) {
        assetIdByHint.set(value.trim().toLowerCase(), assetId);
      }
    };
    for (const asset of tenantAssets) {
      indexHint(asset.name, asset.assetId);
      if (asset.identifiers && typeof asset.identifiers === "object") {
        for (const value of Object.values(
          asset.identifiers as Record<string, unknown>
        )) {
          indexHint(value, asset.assetId);
        }
      }
    }
    for (const signal of signalsWithAssetHints) {
      const matched = new Set(signal.relatedAssetIds);
      for (const hint of signal.relatedAssetHints ?? []) {
        const assetId = assetIdByHint.get(hint.trim().toLowerCase());
        if (assetId) {
          matched.add(assetId);
        }
      }
      signal.relatedAssetIds = [...matched];
    }
  }
  // Hints are transient — never persist or surface them once resolved.
  for (const signal of normalizedSignals) {
    signal.relatedAssetHints = undefined;
  }

  await input.prisma.signalEnvelope.deleteMany({
    where: {
      sourceIntegrationId: input.integration.integrationId,
      tenantId: input.integration.tenantId
    }
  });

  if (normalizedSignals.length > 0) {
    await input.prisma.signalEnvelope.createMany({
      data: normalizedSignals.map((signal) => ({
        confidence: signal.confidence ?? null,
        createdAt: new Date(signal.createdAt),
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
        sourceIntegrationId: signal.sourceIntegrationId,
        sourceType: signal.sourceType,
        sourceVendor: signal.sourceVendor,
        tenantId: signal.tenantId,
        techniqueIds: signal.techniqueIds ?? [],
        timestampIngested: new Date(signal.timestampIngested),
        timestampObserved: new Date(signal.timestampObserved),
        updatedAt: new Date(signal.updatedAt)
      }))
    });
  }

  const updatedIntegration = await input.prisma.integration.update({
    where: {
      integrationId: input.integration.integrationId
    },
    data: {
      healthStatus: result.health.status,
      lastSyncAt: new Date(),
      status:
        result.health.status === "Unhealthy" ||
        !result.health.authorizationVerified
          ? "Error"
          : "Connected"
    }
  });

  await writeAuditEvent(input.prisma, {
    action: "integration.synced",
    actorType: input.actorType ?? "System",
    entityId: input.integration.integrationId,
    entityType: "Integration",
    metadata: {
      assetCount,
      connectorKey,
      durationMs: Date.now() - operationStartedAt,
      healthStatus: result.health.status,
      product: input.connector.manifest.product,
      signalCount: normalizedSignals.length,
      status: "Succeeded",
      vendor: input.connector.manifest.vendor
    },
    tenantId: input.integration.tenantId,
    userId: input.actorUserId ?? null
  });

  return {
    assetCount,
    health: result.health,
    integration: serializeIntegration(updatedIntegration),
    manifest: input.connector.manifest,
    signalCount: normalizedSignals.length,
    signals: normalizedSignals
  };
}

const SAFETY_LEVEL_ORDER: Record<ValidationMission["safetyLevel"], number> = {
  PassiveReadOnly: 0,
  ActiveNonInvasive: 1,
  ControlledValidation: 2,
  BASLite: 3,
  AdvancedAdversarial: 4,
  Disallowed: 5
};

export function isSafetyLevelAllowedForMission(
  missionSafetyLevel: ValidationMission["safetyLevel"],
  moduleSafetyLevel: ValidationMission["safetyLevel"]
) {
  return (
    SAFETY_LEVEL_ORDER[moduleSafetyLevel] <=
    SAFETY_LEVEL_ORDER[missionSafetyLevel]
  );
}

export function appendUniqueIds(existing: string[], incoming: string[]) {
  return [...new Set([...existing, ...incoming])];
}

/**
 * Honest copy for synthesized non-snapshot scheduled reports.
 * Packs without pack-linked evidence/observations must not claim measured proof.
 */
export function describeNonSnapshotPackEvidenceState(input: {
  linkedObservationCount: number;
  packEvidenceIds: string[];
}): {
  overview: string;
  topRiskBand: "Low" | "Medium";
} {
  if (input.packEvidenceIds.length === 0) {
    return {
      overview:
        "No measured evidence is attached to this scheduled validation pack yet.",
      topRiskBand: "Low"
    };
  }

  if (input.linkedObservationCount <= 0) {
    return {
      overview:
        "Scheduled validation pack has attached evidence, but no linked control or AI observation signals were found.",
      topRiskBand: "Low"
    };
  }

  return {
    overview:
      "Evidence-backed scheduled validation with attached observations.",
    topRiskBand: "Medium"
  };
}

export async function loadVerificationScopedSignals(
  prisma: PrismaClient,
  tenantId: string,
  verificationRunIds: string[]
): Promise<SignalEnvelope[]> {
  if (verificationRunIds.length === 0) {
    return [];
  }

  const evidenceArtifacts = await prisma.evidenceArtifact.findMany({
    where: {
      relatedEntityId: {
        in: verificationRunIds
      },
      relatedEntityType: "ValidationRun",
      tenantId
    }
  });
  const evidenceIds = evidenceArtifacts.map((artifact) => artifact.evidenceId);

  if (evidenceIds.length === 0) {
    return [];
  }

  const signals = await prisma.signalEnvelope.findMany({
    orderBy: {
      createdAt: "asc"
    },
    where: {
      tenantId,
      OR: [
        {
          evidenceIds: {
            hasSome: evidenceIds
          }
        },
        {
          relatedEvidenceIds: {
            hasSome: evidenceIds
          }
        }
      ]
    }
  });

  return signals.map((signal) => ({
    confidence: signal.confidence ?? 0.5,
    createdAt: signal.createdAt.toISOString(),
    evidenceIds: signal.evidenceIds,
    freshness: signal.freshness ?? "Fresh",
    rawPayloadPointer: signal.rawPayloadPointer,
    redactionStatus: signal.redactionStatus,
    relatedAssetIds: signal.relatedAssetIds,
    relatedControlIds: signal.relatedControlIds,
    relatedEvidenceIds: signal.relatedEvidenceIds,
    relatedIdentityIds: signal.relatedIdentityIds,
    relatedPathIds: signal.relatedPathIds,
    sensitivityLevel: signal.sensitivityLevel,
    signalCategory: signal.signalCategory,
    signalSubcategory: signal.signalSubcategory ?? null,
    sourceIntegrationId: signal.sourceIntegrationId,
    sourceType: signal.sourceType,
    sourceVendor: signal.sourceVendor,
    tenantId: signal.tenantId,
    signalId: signal.signalId,
    techniqueIds: signal.techniqueIds,
    timestampIngested: signal.timestampIngested.toISOString(),
    timestampObserved: signal.timestampObserved.toISOString(),
    updatedAt: signal.updatedAt.toISOString()
  }));
}

export async function correlateVerificationAttackPathDrafts(
  prisma: PrismaClient,
  tenantId: string,
  verificationRunIds: string[]
) {
  const signals = await loadVerificationScopedSignals(
    prisma,
    tenantId,
    verificationRunIds
  );

  return correlateAttackPathsFromSignals({
    signals
  });
}

// Mission types whose connectors produce MEASURED exposures from authoritative
// configuration via a read-only sync. For a path measured this way, the honest
// retest is to re-fetch the live configuration (re-run the connector sync), then
// re-correlate — not to run a fix-verification module that has no target.
const RESYNC_VERIFIABLE_MISSION_TYPES = [
  "ValidationSnapshot",
  "ExposureValidation",
  "ContinuousValidation"
] as const;

/**
 * Decide which integrations may be re-synced as measured fix verification.
 * Prefer live contributing signals; otherwise recover from path-linked
 * Integration evidence. Never expand to "all connected integrations" — that
 * lets an unrelated sync success forge a Fixed outcome.
 */
export function resolveConnectorResyncIntegrationIds(input: {
  evidenceLinkedIntegrationIds: readonly string[];
  signalLinkedIntegrationIds: readonly string[];
}): string[] {
  const fromSignals = [...new Set(input.signalLinkedIntegrationIds)];
  if (fromSignals.length > 0) {
    return fromSignals;
  }
  return [...new Set(input.evidenceLinkedIntegrationIds)];
}

// Option (b) for verifying connector-sourced exposures: re-run the connector
// sync(s) that contributed to a measured path so the path is re-validated against
// fresh authoritative configuration. Returns the connectors actually re-synced
// (a failed sync yields no fix evidence and is skipped, keeping the outcome
// honest/Inconclusive).
export async function reSyncConnectorsForVerification(
  prisma: PrismaClient,
  tenantId: string,
  previousPath: AttackPath
): Promise<{ connectorKeys: string[]; integrationIds: string[] }> {
  const pathEvidence = new Set(previousPath.evidenceIds);
  const candidateSignals = await prisma.signalEnvelope.findMany({
    where: {
      sourceIntegrationId: {
        not: null
      },
      tenantId
    }
  });
  const signalLinkedIntegrationIds: string[] = [];

  for (const signal of candidateSignals) {
    const contributes =
      signal.relatedPathIds.includes(previousPath.pathId) ||
      signal.evidenceIds.some((evidenceId) => pathEvidence.has(evidenceId));

    if (contributes && signal.sourceIntegrationId) {
      signalLinkedIntegrationIds.push(signal.sourceIntegrationId);
    }
  }

  // Fallback for RE-VERIFYING an already-settled Measured path: once a fix closed
  // the exposure, the contributing signal is gone, so no current signal links back
  // to the path. Recover the original connector(s) from path-linked Integration
  // evidence artifacts (sync evidence stores relatedEntityId = integrationId).
  let evidenceLinkedIntegrationIds: string[] = [];
  if (
    signalLinkedIntegrationIds.length === 0 &&
    previousPath.evidenceIds.length > 0
  ) {
    const integrationEvidence = await prisma.evidenceArtifact.findMany({
      select: { relatedEntityId: true },
      where: {
        evidenceId: {
          in: previousPath.evidenceIds
        },
        relatedEntityType: "Integration",
        tenantId
      }
    });
    evidenceLinkedIntegrationIds = integrationEvidence.map(
      (artifact) => artifact.relatedEntityId
    );
  }

  const contributingIntegrationIds = new Set(
    resolveConnectorResyncIntegrationIds({
      evidenceLinkedIntegrationIds,
      signalLinkedIntegrationIds
    })
  );

  const connectorKeys: string[] = [];
  const reSyncedIntegrationIds: string[] = [];

  for (const integrationId of contributingIntegrationIds) {
    const integration = await prisma.integration.findFirst({
      where: {
        integrationId,
        tenantId
      }
    });

    if (!integration) {
      continue;
    }

    const connectorKey = getConnectorKey(integration.config);
    const connector = connectorKey ? getConnectorByKey(connectorKey) : null;

    if (
      !connector ||
      !connector.manifest.supportedMissionTypes.some((missionType) =>
        RESYNC_VERIFIABLE_MISSION_TYPES.includes(
          missionType as (typeof RESYNC_VERIFIABLE_MISSION_TYPES)[number]
        )
      )
    ) {
      continue;
    }

    try {
      await syncPersistedIntegration({
        actorType: "System",
        connector,
        integration,
        prisma
      });
      reSyncedIntegrationIds.push(integrationId);

      if (connectorKey) {
        connectorKeys.push(connectorKey);
      }
    } catch {
      // A failed re-sync provides no evidence of a fix; skip it so the outcome
      // stays honest (it will not count as a real retest).
    }
  }

  return {
    connectorKeys: [...new Set(connectorKeys)],
    integrationIds: reSyncedIntegrationIds
  };
}

export async function correlateAllTenantAttackPathDrafts(
  prisma: PrismaClient,
  tenantId: string
) {
  const signals = await prisma.signalEnvelope.findMany({
    orderBy: {
      createdAt: "asc"
    },
    where: {
      tenantId
    }
  });

  return correlateAttackPathsFromSignals({
    signals: signals.map(serializeSignalEnvelope)
  });
}

export function resolveFixVerificationModules(selectedModuleIds: string[]) {
  const modules = selectedModuleIds
    .map((moduleId) => getModuleById(moduleId))
    .filter(
      (module): module is NonNullable<ReturnType<typeof getModuleById>> =>
        module !== null &&
        module.manifest.executionMode !== "InternalRunner" &&
        module.manifest.supportedMissionTypes.includes("FixVerification")
    );

  if (modules.length > 0) {
    return modules;
  }

  const compareModule = getModuleById("periscan.fix_verification.compare");

  return compareModule ? [compareModule] : [];
}

function buildJiraTicketId(remediationId: string) {
  return `PSCAN-${remediationId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export function buildVerificationResult(input: {
  currentDraft:
    | ReturnType<typeof correlateAttackPathsFromSignals>[number]
    | null
    | undefined;
  previousPath: AttackPath | null;
  /**
   * True only when a real validation/retest module actually executed during the
   * retest and produced fresh evidence. The no-op
   * `periscan.fix_verification.compare` module does NOT count: it runs no test,
   * yields no signals, and reports `Inconclusive` by design. When this is false
   * we have no honest basis to claim the exposure was fixed, so the outcome can
   * never be `Fixed` (Real-First Rule / no fabricated validation).
   */
  executedRealRetest: boolean;
}) {
  const previousImpact = input.previousPath?.impactScore ?? 0;
  const currentImpact = input.currentDraft?.impactScore ?? 0;

  // Honesty gate: with no real retest evidence we cannot conclude anything about
  // whether the exposure is gone. Never default to "Fixed".
  if (!input.executedRealRetest) {
    return {
      newState: "Inconclusive" as const,
      outcome: "Inconclusive" as const
    };
  }

  // A real retest ran and the previously-correlated path no longer re-correlates
  // from fresh signals: the exposure is genuinely gone.
  if (!input.currentDraft) {
    // ...but you cannot "fix" an exposure that was never measured. With no prior
    // path there is no correlated exposure whose disappearance proves a fix, so
    // the honest conclusion is Inconclusive, never Fixed.
    if (!input.previousPath) {
      return {
        newState: "Inconclusive" as const,
        outcome: "Inconclusive" as const
      };
    }
    // ...and a Heuristic exposure was inferred from attack-pattern templates, not
    // measured against an authoritative source, so its disappearance from
    // re-correlation does not prove the real exposure is closed. Only a MEASURED
    // exposure — re-validated by re-fetching its authoritative configuration —
    // can honestly become "Fixed"; a non-measured one stays Inconclusive.
    if (input.previousPath.evidenceBasis !== "Measured") {
      return {
        newState: "Inconclusive" as const,
        outcome: "Inconclusive" as const
      };
    }
    return {
      newState: "Fixed" as const,
      outcome: "Fixed" as const
    };
  }

  if (input.previousPath?.validationState === "Fixed") {
    return {
      newState: "Reopened" as const,
      outcome: "Reopened" as const
    };
  }

  if (
    input.currentDraft.validationState === "Mitigated" ||
    (previousImpact > 0 && currentImpact <= previousImpact * 0.7)
  ) {
    return {
      newState: "Mitigated" as const,
      outcome: "Mitigated" as const
    };
  }

  if (previousImpact > 0 && currentImpact < previousImpact) {
    return {
      newState: input.currentDraft.validationState,
      outcome: "PartiallyFixed" as const
    };
  }

  return {
    newState: input.currentDraft.validationState,
    outcome: "StillExposed" as const
  };
}

// VerificationEvent payload for a path reopened by a scheduled snapshot diff.
// A schedule diff only reopens paths that were previously Fixed, so previousState
// is "Fixed" by definition — NOT the now-re-correlated exposed state the attack
// path record was just updated to during snapshot generation. measuredRevalidation
// is false because a snapshot diff is not a measured re-fetch.
export function buildReopenVerificationEventData(input: {
  pathEvidenceBasis: AttackPath["evidenceBasis"] | null;
  remediation: { evidenceIds: string[]; remediationId: string };
  tenantId: string;
  verifiedAt: Date;
}) {
  return {
    evidenceIds: input.remediation.evidenceIds,
    exposureReCorrelated: true,
    measuredRevalidation: false,
    newState: "Reopened" as const,
    outcome: "Reopened" as const,
    previousEvidenceBasis: input.pathEvidenceBasis,
    previousState: "Fixed" as const,
    remediationId: input.remediation.remediationId,
    retestMethod: "schedule-diff",
    tenantId: input.tenantId,
    validationRunId: null,
    verifiedAt: input.verifiedAt
  };
}

/**
 * Ticket-close honesty: delegates to the shared Fixed multiverse helper so
 * writers and unit tests share one chokepoint (P09-12).
 */
export function resolveExternalTicketClosedRemediationStatus(input: {
  currentStatus: RemediationTask["status"];
  verificationRequired: boolean;
}): RemediationTask["status"] {
  return resolveExternalTicketClosedRemediationStatusShared(
    input
  ) as RemediationTask["status"];
}

export async function resolveWorkflowIntegration(input: {
  integrationId?: string;
  prisma: PrismaClient;
  tenantId: string;
}) {
  if (input.integrationId) {
    return input.prisma.integration.findFirst({
      where: {
        integrationId: input.integrationId,
        tenantId: input.tenantId
      }
    });
  }

  return input.prisma.integration.findFirst({
    orderBy: {
      createdAt: "asc"
    },
    where: {
      product: "Jira Cloud",
      tenantId: input.tenantId,
      vendor: "Atlassian"
    }
  });
}

export function getWorkflowConnectorKey(input: {
  config: Prisma.JsonValue | null;
  product: string;
  vendor: string;
}) {
  const configured = getConnectorKey(input.config);

  if (configured) {
    return configured;
  }

  if (input.vendor === "Atlassian" && input.product === "Jira Cloud") {
    return "jira";
  }

  if (input.product === "Syncro") {
    return "syncro";
  }

  if (input.product === "HaloPSA") {
    return "halopsa";
  }

  if (input.product === "Autotask PSA") {
    return "autotask";
  }

  if (input.product === "ConnectWise Manage") {
    return "connectwise-manage";
  }

  return null;
}

export function getWorkflowSystemName(input: {
  connectorKey: string;
  product: string;
}) {
  return input.connectorKey === "jira" ? "Jira" : input.product;
}

export async function createWorkflowTicket(input: {
  context: AuthenticatedContext;
  integration: NonNullable<
    Awaited<ReturnType<typeof resolveWorkflowIntegration>>
  >;
  remediation: {
    evidenceIds: string[];
    recommendedAction: string;
    remediationId: string;
    ticketId: string | null;
  };
}) {
  const integration = input.integration;
  const connectorKey = getWorkflowConnectorKey(integration);
  const connector = connectorKey ? getConnectorByKey(connectorKey) : null;

  if (!connector?.sendWorkflowEvent) {
    throw new AppServiceError(
      `${connectorKey ?? integration.product} connector cannot create workflow tickets.`,
      400,
      "workflow_unavailable"
    );
  }

  const config =
    typeof integration.config === "object" && integration.config
      ? (integration.config as Record<string, unknown>)
      : {};
  const delivery = await connector.sendWorkflowEvent({
    authType: integration.authType,
    config: {
      ...config,
      workflowEvent: {
        evidenceIds: input.remediation.evidenceIds,
        remediationId: input.remediation.remediationId,
        summary: input.remediation.recommendedAction,
        title: "Periscan remediation ticket",
        type: "remediation.ticket.create",
        // Deep ITSM: include full pack/attestation links for closed-loop (RemOps 3.7)
        attestationLinks: {
          remediation: `/remediation?remediationId=${input.remediation.remediationId}`,
          evidencePackBase: "/reports",
          verificationEvents: `/api/v1/remediations/${input.remediation.remediationId}/verification-events`,
          planner: `/api/v1/remediations/${input.remediation.remediationId}/plan`
        }
      }
    },
    integrationId: integration.integrationId,
    mockMode: isMockMode(integration.config),
    tenantId: input.context.tenant.tenantId
  });

  if (delivery.status !== "Delivered") {
    throw new AppServiceError(
      typeof delivery.detail === "string"
        ? delivery.detail
        : `${getWorkflowSystemName({
            connectorKey: connector.manifest.connectorKey,
            product: integration.product
          })} ticket creation failed.`,
      502,
      "workflow_ticket_creation_failed"
    );
  }

  return typeof delivery.ticketId === "string" && delivery.ticketId.length > 0
    ? delivery.ticketId
    : (input.remediation.ticketId ??
        buildJiraTicketId(input.remediation.remediationId));
}

export async function readWorkflowTicketState(input: {
  context: AuthenticatedContext;
  integration: NonNullable<
    Awaited<ReturnType<typeof resolveWorkflowIntegration>>
  >;
  ticketId: string;
}) {
  const connectorKey = getWorkflowConnectorKey(input.integration);
  const connector = connectorKey ? getConnectorByKey(connectorKey) : null;
  if (!connector?.readWorkflowState) {
    throw new AppServiceError(
      `${connectorKey ?? input.integration.product} connector cannot read workflow ticket state.`,
      400,
      "workflow_state_unavailable"
    );
  }
  const config =
    typeof input.integration.config === "object" && input.integration.config
      ? (input.integration.config as Record<string, unknown>)
      : {};
  const observation = await connector.readWorkflowState({
    authType: input.integration.authType,
    config: {
      ...config,
      workflowEvent: {
        fixtureTicketState: config.fixtureTicketState,
        ticketId: input.ticketId
      }
    },
    integrationId: input.integration.integrationId,
    mockMode: isMockMode(input.integration.config),
    tenantId: input.context.tenant.tenantId
  });
  const state = observation.state;
  const stateLabel = observation.stateLabel;
  const observedAt = observation.observedAt;
  if (
    !["Open", "InProgress", "Closed", "Unknown"].includes(
      typeof state === "string" ? state : ""
    ) ||
    typeof stateLabel !== "string" ||
    typeof observedAt !== "string"
  ) {
    throw new AppServiceError(
      `${connector.manifest.product} returned an invalid ticket-state observation.`,
      502,
      "workflow_state_invalid"
    );
  }
  return {
    observedAt,
    state: state as "Open" | "InProgress" | "Closed" | "Unknown",
    stateLabel
  };
}

async function applyMockJiraWorkflowSync(input: {
  integration: {
    config: Prisma.JsonValue | null;
    tenantId: string;
  };
  prisma: PrismaClient;
}) {
  const config =
    typeof input.integration.config === "object" && input.integration.config
      ? (input.integration.config as Record<string, unknown>)
      : {};
  const autoCloseTickets = config.autoCloseTickets === true;

  if (!autoCloseTickets) {
    return 0;
  }

  const closedWithoutProof = await input.prisma.remediationTask.findMany({
    where: {
      status: {
        in: ["Open", "InProgress"]
      },
      tenantId: input.integration.tenantId,
      ticketId: {
        not: null
      },
      ticketSystem: "Jira",
      verificationRequired: true
    }
  });

  if (closedWithoutProof.length === 0) {
    return 0;
  }

  await input.prisma.remediationTask.updateMany({
    where: {
      remediationId: {
        in: closedWithoutProof.map((remediation) => remediation.remediationId)
      },
      tenantId: input.integration.tenantId
    },
    data: {
      status: "ClosedWithoutEvidence"
    }
  });

  await Promise.all(
    closedWithoutProof.map((remediation) =>
      writeAuditEvent(input.prisma, {
        action: "remediation.closed_without_evidence",
        actorType: "System",
        entityId: remediation.remediationId,
        entityType: "RemediationTask",
        metadata: {
          previousStatus: remediation.status,
          relatedPathId: remediation.relatedPathId,
          status: "ClosedWithoutEvidence",
          ticketId: remediation.ticketId,
          ticketSystem: remediation.ticketSystem
        },
        tenantId: input.integration.tenantId,
        userId: null
      })
    )
  );

  return closedWithoutProof.length;
}

function getSignalGraphProjection(signal: SignalEnvelope) {
  const label =
    signal.signalSubcategory ?? `${signal.signalCategory} observation`;

  if (signal.signalCategory === "Exposure") {
    // P11R-1: closed Exposure leaves — free subcategories collapse to bare Exposure
    return {
      label,
      nodeKey: `exposure:${signal.signalId}`,
      nodeType: resolveGraphNodeType(
        "Exposure",
        signal.signalSubcategory ?? "Observed"
      )
    };
  }

  return {
    label,
    nodeKey: `signal:${signal.signalId}`,
    nodeType: `Signal.${signal.signalCategory}`
  };
}

export function buildSafeRequestedAction(
  executionMode: ModuleManifest["executionMode"]
): PolicyRequestedAction {
  return {
    credentialTheft: false,
    destructive: false,
    persistence: false,
    realDataExfiltration: false,
    requiresInternalRunner: executionMode === "InternalRunner",
    requiresTimeWindow: false,
    uncontrolledExploitChaining: false
  };
}

// Whether a tenant has authorized offensive (adversarial) validation. Threaded
// into evaluatePolicy: when true, AdvancedAdversarial becomes permittable
// (subject to per-run admin approval). The hard policy floor
// (destructive/exfiltration/persistence/credential-theft/uncontrolled chaining)
// is enforced by evaluatePolicy independently and is never lifted.
export async function loadOffensiveValidationAuthorized(
  prisma: Prisma.TransactionClient | PrismaClient,
  tenantId: string
): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({
    select: { offensiveValidationEnabled: true },
    where: { tenantId }
  });
  return tenant?.offensiveValidationEnabled ?? false;
}

export async function loadDestructiveValidationAuthorized(
  prisma: Prisma.TransactionClient | PrismaClient,
  tenantId: string
): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({
    select: { destructiveValidationEnabled: true },
    where: { tenantId }
  });
  return tenant?.destructiveValidationEnabled ?? false;
}

type ThreatIndicatorSet = Pick<
  ThreatAdvisory,
  "cveIds" | "iocValues" | "techniqueIds"
>;

interface ThreatTenantPrerequisites {
  hasAiAppScope: boolean;
  hasCloudIntegration: boolean;
  hasCodeIntegration: boolean;
  hasControlIntegration: boolean;
  hasInternalRunner: boolean;
  hasVerifiedScope: boolean;
}

interface MissingSignalDraft {
  reason: string;
  requiredIntegrationCategory: MissingSignal["requiredIntegrationCategory"];
  signalType: string;
  status: MissingSignal["status"];
}

interface ThreatPlanItemDraft {
  missingSignalTypes: string[];
  missionType: ThreatValidationPlanItem["missionType"];
  rationale: string;
  requiredIntegrationCategories: ThreatValidationPlanItem["requiredIntegrationCategories"];
  requiredScopeTypes: ThreatValidationPlanItem["requiredScopeTypes"];
  safetyLevel: ThreatValidationPlanItem["safetyLevel"];
  status: ThreatValidationPlanItem["status"];
  title: string;
}

export function dedupeNormalized(values: string[]) {
  return [
    ...new Set(
      values.map((value) => value.trim()).filter((value) => value.length > 0)
    )
  ];
}

function extractMatches(value: string, pattern: RegExp) {
  return Array.from(value.matchAll(pattern), (match) => match[0]);
}

function normalizeCveIds(values: string[]) {
  return dedupeNormalized(values.map((value) => value.toUpperCase())).filter(
    (value) => /^CVE-\d{4}-\d{4,}$/u.test(value)
  );
}

function normalizeTechniqueIds(values: string[]) {
  return dedupeNormalized(values.map((value) => value.toUpperCase())).filter(
    (value) => /^T\d{4}(?:\.\d{3})?$/u.test(value)
  );
}

function stripTrailingIndicatorPunctuation(value: string) {
  return value.replace(/[),.;\]}]+$/u, "");
}

function isValidIPv4(value: string) {
  const octets = value.split(".");

  return (
    octets.length === 4 &&
    octets.every((octet) => {
      if (!/^\d{1,3}$/u.test(octet)) {
        return false;
      }

      const numeric = Number(octet);

      return numeric >= 0 && numeric <= 255;
    })
  );
}

function normalizeIocValues(values: string[]) {
  return dedupeNormalized(
    values.map((value) =>
      stripTrailingIndicatorPunctuation(value).toLowerCase()
    )
  ).filter((value) => {
    if (value.startsWith("http://") || value.startsWith("https://")) {
      try {
        void new URL(value);
        return true;
      } catch {
        return false;
      }
    }

    if (/^(?:\d{1,3}\.){3}\d{1,3}$/u.test(value)) {
      return isValidIPv4(value);
    }

    return (
      /^[a-f0-9]{32}$/u.test(value) ||
      /^[a-f0-9]{40}$/u.test(value) ||
      /^[a-f0-9]{64}$/u.test(value) ||
      /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/u.test(value)
    );
  });
}

export function extractThreatIndicators(input: ImportThreatAdvisoryInput) {
  const corpus = [
    input.title,
    input.sourceName,
    input.summary,
    input.rawContent
  ].join("\n");

  return {
    cveIds: normalizeCveIds([
      ...(input.cveIds ?? []),
      ...extractMatches(corpus, /\bCVE-\d{4}-\d{4,}\b/giu)
    ]),
    iocValues: normalizeIocValues([
      ...(input.iocValues ?? []),
      ...extractMatches(corpus, /https?:\/\/[^\s"'<>]+/giu),
      ...extractMatches(corpus, /\b(?:\d{1,3}\.){3}\d{1,3}\b/gu),
      ...extractMatches(corpus, /\b[a-fA-F0-9]{64}\b/gu),
      ...extractMatches(corpus, /\b[a-fA-F0-9]{40}\b/gu),
      ...extractMatches(corpus, /\b[a-fA-F0-9]{32}\b/gu),
      ...extractMatches(
        corpus,
        /\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b/gu
      )
    ]),
    techniqueIds: normalizeTechniqueIds([
      ...(input.techniqueIds ?? []),
      ...extractMatches(corpus, /\bT\d{4}(?:\.\d{3})?\b/giu)
    ])
  } satisfies ThreatIndicatorSet;
}

export function mentionsAiApplication(input: ImportThreatAdvisoryInput) {
  return /\b(ai|llm|rag|copilot|agent|prompt|model|tool(?:ing|s)?|vector database)\b/iu.test(
    `${input.title}\n${input.summary}\n${input.rawContent}`
  );
}

export function mentionsInternalValidationContext(
  input: ImportThreatAdvisoryInput
) {
  return /\b(internal|lateral|active directory|entra|segmentation|vpn|intranet|east-west)\b/iu.test(
    `${input.title}\n${input.summary}\n${input.rawContent}`
  );
}

export async function loadThreatTenantPrerequisites(
  prisma: PrismaClient,
  tenantId: string
): Promise<ThreatTenantPrerequisites> {
  const [
    verifiedScopes,
    integrations,
    controlSourceCount,
    runnerCount,
    aiApplicationScopes
  ] = await Promise.all([
    prisma.scope.findMany({
      select: {
        scopeType: true
      },
      where: {
        tenantId,
        verificationStatus: "Verified"
      }
    }),
    prisma.integration.findMany({
      select: {
        category: true,
        product: true,
        status: true,
        vendor: true
      },
      where: {
        tenantId,
        status: "Connected"
      }
    }),
    prisma.controlSource.count({
      where: {
        tenantId
      }
    }),
    prisma.runner.count({
      where: {
        status: "Active",
        tenantId
      }
    }),
    prisma.aIApplication.findMany({
      select: {
        scope: {
          select: {
            scopeType: true,
            verificationStatus: true
          }
        }
      },
      where: {
        tenantId
      }
    })
  ]);
  const hasIntegrationCategory = (category: Integration["category"]) =>
    integrations.some((integration) => integration.category === category);
  const normalizedIntegrations = integrations.map((integration) =>
    `${integration.vendor} ${integration.product}`.toLowerCase()
  );
  const hasNamedIntegration = (patterns: RegExp[]) =>
    normalizedIntegrations.some((value) =>
      patterns.some((pattern) => pattern.test(value))
    );

  return {
    hasAiAppScope:
      verifiedScopes.some(
        (scope) => scope.scopeType === "AIApplicationEndpoint"
      ) ||
      aiApplicationScopes.some(
        (aiApp) =>
          aiApp.scope.scopeType === "AIApplicationEndpoint" &&
          aiApp.scope.verificationStatus === "Verified"
      ),
    hasCloudIntegration:
      hasIntegrationCategory("Cloud") ||
      hasNamedIntegration([/\baws\b/u, /\bazure\b/u, /\bgcp\b/u]),
    hasCodeIntegration:
      hasIntegrationCategory("Code") ||
      hasNamedIntegration([/\bgithub\b/u, /\bgitlab\b/u, /\bbitbucket\b/u]),
    hasControlIntegration:
      controlSourceCount > 0 ||
      hasIntegrationCategory("SecurityControl") ||
      hasNamedIntegration([
        /\bsplunk\b/u,
        /\bcrowdstrike\b/u,
        /\bsentinel\b/u,
        /\bedr\b/u,
        /\bsiem\b/u
      ]),
    hasInternalRunner: runnerCount > 0,
    hasVerifiedScope: verifiedScopes.length > 0
  };
}

export function buildMissingSignalDrafts(input: {
  mentionsAi: boolean;
  prerequisites: ThreatTenantPrerequisites;
}) {
  const drafts: MissingSignalDraft[] = [];

  if (!input.prerequisites.hasVerifiedScope) {
    drafts.push({
      reason:
        "No verified customer-authorized scope exists, so Periscan cannot validate advisory relevance.",
      requiredIntegrationCategory: null,
      signalType: "verified_scope",
      status: "RequiresVerifiedScope"
    });
  }

  if (!input.prerequisites.hasCodeIntegration) {
    drafts.push({
      reason:
        "No connected code repository integration is available for repository, dependency, or secret advisory checks.",
      requiredIntegrationCategory: "Code",
      signalType: "code_repository_signals",
      status: "RequiresIntegration"
    });
  }

  if (!input.prerequisites.hasCloudIntegration) {
    drafts.push({
      reason:
        "No connected cloud integration is available for cloud asset, IAM, or posture advisory checks.",
      requiredIntegrationCategory: "Cloud",
      signalType: "cloud_signals",
      status: "RequiresIntegration"
    });
  }

  if (!input.prerequisites.hasControlIntegration) {
    drafts.push({
      reason:
        "No SIEM, EDR, or control source telemetry is available to prove detection, logging, or blocking.",
      requiredIntegrationCategory: "SecurityControl",
      signalType: "control_telemetry",
      status: "RequiresIntegration"
    });
  }

  if (!input.prerequisites.hasInternalRunner) {
    drafts.push({
      reason:
        "No active internal runner is available for internal reachability or segmentation validation.",
      requiredIntegrationCategory: null,
      signalType: "internal_runner",
      status: "RequiresInternalRunner"
    });
  }

  if (input.mentionsAi && !input.prerequisites.hasAiAppScope) {
    drafts.push({
      reason:
        "The advisory mentions AI, RAG, agent, prompt, or tooling risk but no verified AI app scope or AI stack integration exists.",
      requiredIntegrationCategory: "AIStack",
      signalType: "ai_app_scope",
      status: "RequiresIntegration"
    });
  }

  return drafts;
}

function statusFromMissingSignals(
  requiredMissingSignalTypes: string[],
  missingSignals: MissingSignalDraft[]
): ThreatValidationPlanItem["status"] {
  const statuses = missingSignals
    .filter((signal) => requiredMissingSignalTypes.includes(signal.signalType))
    .map((signal) => signal.status);

  if (statuses.includes("RequiresVerifiedScope")) {
    return "RequiresVerifiedScope";
  }

  if (statuses.includes("RequiresInternalRunner")) {
    return "RequiresInternalRunner";
  }

  if (statuses.includes("RequiresIntegration")) {
    return "RequiresIntegration";
  }

  if (statuses.includes("NotConfigured")) {
    return "NotConfigured";
  }

  return "NeedsApproval";
}

export function buildThreatPlanDrafts(input: {
  indicators: ThreatIndicatorSet;
  mentionsAi: boolean;
  mentionsInternal: boolean;
  missingSignals: MissingSignalDraft[];
}) {
  const drafts: ThreatPlanItemDraft[] = [];

  drafts.push({
    missingSignalTypes: ["verified_scope"],
    missionType: "ExposureValidation",
    rationale:
      "Safely assess whether the advisory maps to any verified external or internal customer scope before any validation runs.",
    requiredIntegrationCategories: [],
    requiredScopeTypes: ["Domain", "Subdomain", "IPRange", "CloudAccount"],
    safetyLevel: "PassiveReadOnly",
    status: statusFromMissingSignals(["verified_scope"], input.missingSignals),
    title: "Assess advisory relevance against verified scope"
  });

  if (
    input.indicators.cveIds.length > 0 ||
    input.indicators.iocValues.length > 0
  ) {
    drafts.push({
      missingSignalTypes: [
        "verified_scope",
        "code_repository_signals",
        "cloud_signals"
      ],
      missionType: "ExposureValidation",
      rationale:
        "Map extracted CVEs and IoCs to connected repository and cloud signals without treating the advisory as exploit proof.",
      requiredIntegrationCategories: ["Code", "Cloud"],
      requiredScopeTypes: ["Repository", "CloudAccount", "Domain", "Subdomain"],
      safetyLevel: "PassiveReadOnly",
      status: statusFromMissingSignals(
        ["verified_scope", "code_repository_signals", "cloud_signals"],
        input.missingSignals
      ),
      title: "Correlate extracted CVEs and IoCs with tenant signals"
    });
  }

  if (input.indicators.techniqueIds.length > 0) {
    drafts.push({
      missingSignalTypes: ["verified_scope", "control_telemetry"],
      missionType: "ControlValidation",
      rationale:
        "Prepare a policy-gated control validation plan for mapped MITRE techniques; execution still requires explicit approval.",
      requiredIntegrationCategories: ["SecurityControl"],
      requiredScopeTypes: ["ControlSource"],
      safetyLevel: "BASLite",
      status: statusFromMissingSignals(
        ["verified_scope", "control_telemetry"],
        input.missingSignals
      ),
      title: "Plan detection coverage validation for mapped techniques"
    });
  }

  if (input.mentionsAi) {
    drafts.push({
      missingSignalTypes: ["verified_scope", "ai_app_scope"],
      missionType: "AIAppValidation",
      rationale:
        "Prepare safe AI app checks only for customer-authorized AI endpoints; execution requires approval and evidence capture.",
      requiredIntegrationCategories: ["AIStack"],
      requiredScopeTypes: ["AIApplicationEndpoint"],
      safetyLevel: "ControlledValidation",
      status: statusFromMissingSignals(
        ["verified_scope", "ai_app_scope"],
        input.missingSignals
      ),
      title: "Plan safe AI application validation"
    });
  }

  if (input.mentionsInternal) {
    drafts.push({
      missingSignalTypes: ["verified_scope", "internal_runner"],
      missionType: "ExposureValidation",
      rationale:
        "Prepare internal reachability validation through an outbound-only runner; no internal validation can run without an active runner.",
      requiredIntegrationCategories: [],
      requiredScopeTypes: ["InternalNetwork"],
      safetyLevel: "ActiveNonInvasive",
      status: statusFromMissingSignals(
        ["verified_scope", "internal_runner"],
        input.missingSignals
      ),
      title: "Plan internal runner reachability validation"
    });
  }

  return drafts;
}

function normalizeTargetIndicatorKey(key: string) {
  return key.replace(/[-_\s]/gu, "").toLowerCase();
}

function collectTargetIndicatorStrings(input: {
  key?: string;
  targetKeys: Set<string>;
  value: unknown;
}): string[] {
  if (Array.isArray(input.value)) {
    return input.value.flatMap((item) =>
      collectTargetIndicatorStrings({
        key: input.key,
        targetKeys: input.targetKeys,
        value: item
      })
    );
  }

  if (input.value && typeof input.value === "object") {
    return Object.entries(input.value as Record<string, unknown>).flatMap(
      ([key, value]) =>
        collectTargetIndicatorStrings({
          key,
          targetKeys: input.targetKeys,
          value
        })
    );
  }

  if (
    typeof input.value === "string" &&
    input.key &&
    input.targetKeys.has(normalizeTargetIndicatorKey(input.key))
  ) {
    return [input.value];
  }

  return [];
}

const THREAT_CVE_TARGET_KEYS = new Set(["cve", "cveid", "cveids", "cves"]);
const THREAT_IOC_TARGET_KEYS = new Set([
  "domain",
  "domains",
  "hash",
  "hashes",
  "indicator",
  "indicators",
  "ioc",
  "iocs",
  "iocvalue",
  "iocvalues",
  "ip",
  "ips",
  "ipv4",
  "md5",
  "sha1",
  "sha256",
  "url",
  "urls"
]);

function runTargetCveIds(target: Prisma.JsonValue) {
  return normalizeCveIds(
    collectTargetIndicatorStrings({
      targetKeys: THREAT_CVE_TARGET_KEYS,
      value: target
    })
  );
}

function runTargetIocValues(target: Prisma.JsonValue) {
  return normalizeIocValues(
    collectTargetIndicatorStrings({
      targetKeys: THREAT_IOC_TARGET_KEYS,
      value: target
    })
  );
}

function validationRunMatchesThreatIndicators(input: {
  indicators: ThreatIndicatorSet;
  run: {
    target: Prisma.JsonValue;
    techniqueIds: string[];
  };
}) {
  if (
    input.indicators.techniqueIds.length > 0 &&
    input.run.techniqueIds.some((techniqueId) =>
      input.indicators.techniqueIds.includes(techniqueId)
    )
  ) {
    return true;
  }

  const targetCveIds = runTargetCveIds(input.run.target);

  if (
    input.indicators.cveIds.length > 0 &&
    targetCveIds.some((cveId) => input.indicators.cveIds.includes(cveId))
  ) {
    return true;
  }

  const targetIocValues = runTargetIocValues(input.run.target);

  return (
    input.indicators.iocValues.length > 0 &&
    targetIocValues.some((iocValue) =>
      input.indicators.iocValues.includes(iocValue)
    )
  );
}

const DEFAULT_THREAT_CORRELATION_RUN_SCAN_LIMIT = 500;

function resolveThreatCorrelationRunScanLimit(explicit?: number): number {
  if (explicit !== undefined && explicit > 0) {
    return explicit;
  }
  const fromEnv = parseOptionalLimitEnv(
    "PERISCAN_THREAT_CORRELATION_RUN_SCAN_LIMIT"
  );
  return fromEnv && fromEnv > 0
    ? fromEnv
    : DEFAULT_THREAT_CORRELATION_RUN_SCAN_LIMIT;
}

// Load the completed runs that could correlate to threat indicators. Technique
// matches are fetched AUTHORITATIVELY via a DB hasSome filter (every matching
// run, regardless of age) so exposure is never under-reported just because the
// matching run fell outside a recency window. CVE/IoC indicators live inside the
// run.target JSON, which can't be index-filtered, so those still rely on a
// bounded most-recent scan (capped by scanLimit). The union is de-duplicated by
// runId — strictly a superset of the old recency-only scan, so the change can
// only surface previously-missed correlations, never drop a real one.
async function loadThreatCorrelationCandidateRuns(input: {
  prisma: PrismaClient;
  requireEvidence: boolean;
  scanLimit: number;
  techniqueIds: string[];
  tenantId: string;
}) {
  const where = {
    status: "Completed" as const,
    tenantId: input.tenantId,
    ...(input.requireEvidence ? { evidenceIds: { isEmpty: false } } : {})
  };
  const select = {
    evidenceIds: true,
    runId: true,
    target: true,
    techniqueIds: true
  };
  const uniqueTechniqueIds = [...new Set(input.techniqueIds)];
  const [techniqueRuns, recentRuns] = await Promise.all([
    uniqueTechniqueIds.length > 0
      ? input.prisma.validationRun.findMany({
          select,
          where: { ...where, techniqueIds: { hasSome: uniqueTechniqueIds } }
        })
      : Promise.resolve([]),
    input.prisma.validationRun.findMany({
      orderBy: { createdAt: "desc" },
      select,
      take: input.scanLimit,
      where
    })
  ]);
  const byRunId = new Map<string, (typeof recentRuns)[number]>();
  for (const run of techniqueRuns) {
    byRunId.set(run.runId, run);
  }
  for (const run of recentRuns) {
    byRunId.set(run.runId, run);
  }
  return [...byRunId.values()];
}

export async function findEvidenceBackedThreatValidation(input: {
  indicators: ThreatIndicatorSet;
  prisma: PrismaClient;
  tenantId: string;
}): Promise<{ evidenceIds: string[]; ready: boolean }> {
  if (
    input.indicators.cveIds.length === 0 &&
    input.indicators.iocValues.length === 0 &&
    input.indicators.techniqueIds.length === 0
  ) {
    return {
      evidenceIds: [],
      ready: false
    };
  }

  const runs = await loadThreatCorrelationCandidateRuns({
    prisma: input.prisma,
    requireEvidence: true,
    scanLimit: resolveThreatCorrelationRunScanLimit(),
    techniqueIds: input.indicators.techniqueIds,
    tenantId: input.tenantId
  });
  const matchingRuns = runs.filter((run) =>
    validationRunMatchesThreatIndicators({
      indicators: input.indicators,
      run
    })
  );

  return {
    evidenceIds: dedupeNormalized(
      matchingRuns.flatMap((run) => run.evidenceIds)
    ),
    ready: matchingRuns.length > 0
  };
}

// Per-advisory "why am I exposed?" evidence: the specific indicators that
// correlate this advisory to the tenant's completed, evidence-backed validation
// runs, plus how many runs matched. Distinct from countCorrelatedThreatAdvisories
// (a tenant-wide count) — this explains a SINGLE advisory's exposure.
export async function assessThreatAdvisoryExposure(input: {
  indicators: ThreatIndicatorSet;
  prisma: PrismaClient;
  tenantId: string;
}): Promise<AdvisoryExposure> {
  const empty: AdvisoryExposure = {
    correlated: false,
    evidenceIds: [],
    matchedCveIds: [],
    matchedIocValues: [],
    matchedTechniqueIds: [],
    matchingRunCount: 0
  };

  if (
    input.indicators.cveIds.length === 0 &&
    input.indicators.iocValues.length === 0 &&
    input.indicators.techniqueIds.length === 0
  ) {
    return empty;
  }

  const runs = await loadThreatCorrelationCandidateRuns({
    prisma: input.prisma,
    requireEvidence: true,
    scanLimit: resolveThreatCorrelationRunScanLimit(),
    techniqueIds: input.indicators.techniqueIds,
    tenantId: input.tenantId
  });
  const matchingRuns = runs.filter((run) =>
    validationRunMatchesThreatIndicators({
      indicators: input.indicators,
      run
    })
  );

  if (matchingRuns.length === 0) {
    return empty;
  }

  const matchedTechniqueIds = new Set<string>();
  const matchedCveIds = new Set<string>();
  const matchedIocValues = new Set<string>();
  for (const run of matchingRuns) {
    for (const techniqueId of run.techniqueIds) {
      if (input.indicators.techniqueIds.includes(techniqueId)) {
        matchedTechniqueIds.add(techniqueId);
      }
    }
    for (const cveId of runTargetCveIds(run.target)) {
      if (input.indicators.cveIds.includes(cveId)) {
        matchedCveIds.add(cveId);
      }
    }
    for (const iocValue of runTargetIocValues(run.target)) {
      if (input.indicators.iocValues.includes(iocValue)) {
        matchedIocValues.add(iocValue);
      }
    }
  }

  return {
    correlated: true,
    evidenceIds: dedupeNormalized(
      matchingRuns.flatMap((run) => run.evidenceIds)
    ),
    matchedCveIds: [...matchedCveIds],
    matchedIocValues: [...matchedIocValues],
    matchedTechniqueIds: [...matchedTechniqueIds],
    matchingRunCount: matchingRuns.length
  };
}

// Genuine "are we exposed?" signal: count OPEN advisories whose indicators
// (CVE / MITRE technique / IoC) actually correlate to the tenant's completed
// validation evidence — i.e. the threat's TTPs/CVEs are present in what we've
// validated, not merely "an advisory we imported". Loads runs once and matches
// in memory, so it stays cheap for the snapshot path.
export async function countCorrelatedThreatAdvisories(
  prisma: PrismaClient,
  tenantId: string,
  scanLimit?: number
): Promise<number> {
  const advisories = await prisma.threatAdvisory.findMany({
    select: { cveIds: true, iocValues: true, techniqueIds: true },
    where: {
      status: { not: "Closed" },
      tenantId
    }
  });
  const withIndicators = advisories.filter(
    (advisory) =>
      advisory.cveIds.length > 0 ||
      advisory.iocValues.length > 0 ||
      advisory.techniqueIds.length > 0
  );
  if (withIndicators.length === 0) {
    return 0;
  }

  const runs = await loadThreatCorrelationCandidateRuns({
    prisma,
    requireEvidence: true,
    scanLimit: resolveThreatCorrelationRunScanLimit(scanLimit),
    techniqueIds: withIndicators.flatMap((advisory) => advisory.techniqueIds),
    tenantId
  });

  return withIndicators.filter((advisory) =>
    runs.some((run) =>
      validationRunMatchesThreatIndicators({
        indicators: {
          cveIds: advisory.cveIds,
          iocValues: advisory.iocValues,
          techniqueIds: advisory.techniqueIds
        },
        run
      })
    )
  ).length;
}

export function buildAdvisoryPackageSummary(input: {
  indicators: ThreatIndicatorSet;
  summary: string;
}) {
  const parts = [
    `${input.indicators.cveIds.length} CVE(s)`,
    `${input.indicators.iocValues.length} IoC(s)`,
    `${input.indicators.techniqueIds.length} MITRE technique(s)`
  ];

  return `${input.summary} Extracted advisory context includes ${parts.join(
    ", "
  )}.`;
}

export function buildImpactSummary(input: {
  missingSignalCount: number;
  validationReady: boolean;
}) {
  if (input.missingSignalCount > 0) {
    return `Periscan imported the advisory but cannot complete an evidence-backed impact assessment because ${input.missingSignalCount} required signal source(s) are missing.`;
  }

  if (input.validationReady) {
    return "Current tenant evidence includes completed validation mapped to advisory techniques; review evidence before marking response ready.";
  }

  return "Prerequisite signal sources are present, but advisory validation still requires explicit policy approval before execution.";
}

export function buildReadinessSummary(input: {
  missingSignalCount: number;
  readinessStatus: AdvisoryReadinessReport["readinessStatus"];
}) {
  switch (input.readinessStatus) {
    case "Ready":
      return "Evidence-backed validation exists for this advisory context in the current tenant.";
    case "RequiresApproval":
      return "Prerequisites are configured, but no policy-approved validation has run for this advisory.";
    case "NotConfigured":
      return "Threat Center import is available, but no validation prerequisites are configured.";
    case "MissingSignals":
      return `Readiness is blocked by ${input.missingSignalCount} missing signal source(s).`;
    default:
      return "Threat advisory readiness could not be determined from current tenant data.";
  }
}

export function serializeThreatAdvisoryDetail(
  record: {
    impactAssessment:
      | Parameters<typeof serializeAdvisoryImpactAssessment>[0]
      | null;
    missingSignals: Parameters<typeof serializeMissingSignal>[0][];
    readinessReport:
      | Parameters<typeof serializeAdvisoryReadinessReport>[0]
      | null;
    threatPackage: Parameters<typeof serializeThreatPackage>[0] | null;
    validationPlan:
      | (Omit<
          Parameters<typeof serializeThreatValidationPlan>[0],
          "planItems"
        > & {
          planItems: Parameters<typeof serializeThreatValidationPlanItem>[0][];
        })
      | null;
  } & Parameters<typeof serializeThreatAdvisory>[0],
  exposure: AdvisoryExposure | null = null
): ThreatAdvisoryDetail | null {
  if (
    !record.threatPackage ||
    !record.impactAssessment ||
    !record.validationPlan ||
    !record.readinessReport
  ) {
    return null;
  }

  const advisory = serializeThreatAdvisory(record);

  return {
    advisory,
    exposure,
    impactAssessment: serializeAdvisoryImpactAssessment(
      record.impactAssessment
    ),
    missingSignals: record.missingSignals.map(serializeMissingSignal),
    package: serializeThreatPackage(record.threatPackage),
    readinessReport: serializeAdvisoryReadinessReport(record.readinessReport),
    rawEvidenceId: advisory.rawEvidenceId,
    validationPlan: serializeThreatValidationPlan(record.validationPlan)
  };
}

export async function loadThreatAdvisoryDetailRecord(
  prisma: PrismaClient,
  tenantId: string,
  threatAdvisoryId: string
) {
  return prisma.threatAdvisory.findFirst({
    include: {
      impactAssessment: true,
      missingSignals: {
        orderBy: {
          createdAt: "asc"
        }
      },
      readinessReport: true,
      threatPackage: true,
      validationPlan: {
        include: {
          planItems: {
            orderBy: {
              createdAt: "asc"
            }
          }
        }
      }
    },
    where: {
      tenantId,
      threatAdvisoryId
    }
  });
}

function collectThreatAdvisoryDetailEvidenceIds(detail: ThreatAdvisoryDetail) {
  return [
    ...new Set([
      ...detail.advisory.evidenceIds,
      ...detail.package.evidenceIds,
      ...detail.impactAssessment.evidenceIds,
      ...detail.readinessReport.evidenceIds,
      ...detail.validationPlan.evidenceIds,
      ...detail.validationPlan.planItems.flatMap((item) => item.evidenceIds)
    ])
  ];
}

function attachReadinessEvidencePackId(
  detail: ThreatAdvisoryDetail,
  evidencePackId: string
): ThreatAdvisoryDetail {
  return {
    ...detail,
    readinessReport: {
      ...detail.readinessReport,
      evidencePackId
    }
  };
}

export async function exportAdvisoryReadinessReportFromDetail(input: {
  context: AuthenticatedContext;
  detail: ThreatAdvisoryDetail;
  format: ReportExportFormat;
  pack?: EvidencePackRecord | null;
  prisma: PrismaClient;
}): Promise<ReportExportResult> {
  const evidenceService = createPrismaEvidenceService({
    prisma: input.prisma
  });
  const baseEvidenceIds = collectThreatAdvisoryDetailEvidenceIds(input.detail);
  const existingPack =
    input.pack ??
    (input.detail.readinessReport.evidencePackId
      ? await input.prisma.evidencePack.findFirst({
          where: {
            evidencePackId: input.detail.readinessReport.evidencePackId,
            packType: "ThreatAdvisoryReadinessReport",
            tenantId: input.context.tenant.tenantId
          }
        })
      : null);
  const pack =
    existingPack ??
    (await input.prisma.evidencePack.create({
      data: {
        audience: "Security operations and incident response",
        evidenceIds: baseEvidenceIds,
        packType: "ThreatAdvisoryReadinessReport",
        redactionLevel: "Moderate",
        status: "Draft",
        tenantId: input.context.tenant.tenantId,
        title: `Advisory readiness: ${input.detail.advisory.title}`
      }
    }));
  const detail = attachReadinessEvidencePackId(
    input.detail,
    pack.evidencePackId
  );
  const branding = await loadTenantReportBranding(
    input.prisma,
    input.context.tenant.tenantId
  );
  const content =
    input.format === "pdf"
      ? renderAdvisoryReadinessReportPdf(detail)
      : renderAdvisoryReadinessReportHtml(detail, {
          branding
        });
  const contentType =
    input.format === "pdf" ? "application/pdf" : "text/html; charset=utf-8";
  const artifact = await evidenceService.putEvidenceArtifact({
    artifactType: "ReportExport",
    content,
    contentType,
    filename: "threat-advisory-readiness-report",
    relatedEntityId: pack.evidencePackId,
    relatedEntityType: "EvidencePack",
    sensitivityLevel: "Moderate",
    tenantId: input.context.tenant.tenantId
  });
  const normalizedArtifact = existingPack
    ? null
    : await evidenceService.putEvidenceArtifact({
        artifactType: "NormalizedEvidence",
        content: JSON.parse(JSON.stringify(detail)) as Record<string, unknown>,
        contentType: "application/json",
        filename: "threat-advisory-readiness-report",
        relatedEntityId: pack.evidencePackId,
        relatedEntityType: "EvidencePack",
        sensitivityLevel: "Moderate",
        tenantId: input.context.tenant.tenantId
      });
  const readinessEvidenceIds = [
    ...new Set([
      ...detail.readinessReport.evidenceIds,
      artifact.artifact.evidenceId,
      ...(normalizedArtifact ? [normalizedArtifact.artifact.evidenceId] : [])
    ])
  ];

  await input.prisma.advisoryReadinessReport.update({
    data: {
      evidenceIds: readinessEvidenceIds,
      evidencePackId: pack.evidencePackId
    },
    where: {
      advisoryReadinessReportId:
        detail.readinessReport.advisoryReadinessReportId
    }
  });

  const updatedPack = await input.prisma.evidencePack.update({
    data: {
      evidenceIds: [
        ...new Set([
          ...pack.evidenceIds,
          ...baseEvidenceIds,
          artifact.artifact.evidenceId,
          ...(normalizedArtifact
            ? [normalizedArtifact.artifact.evidenceId]
            : [])
        ])
      ],
      status: "Exported",
      storageUri:
        input.format === "html" ? artifact.artifact.storageUri : pack.storageUri
    },
    where: {
      evidencePackId: pack.evidencePackId
    }
  });

  await writeAuditEvent(input.prisma, {
    action: existingPack ? "report.updated" : "report.generated",
    actorType: "User",
    entityId: updatedPack.evidencePackId,
    entityType: "EvidencePack",
    metadata: {
      format: input.format,
      readinessReportId: detail.readinessReport.advisoryReadinessReportId,
      sourceThreatAdvisoryId: detail.advisory.threatAdvisoryId
    },
    tenantId: input.context.tenant.tenantId,
    userId: input.context.user.userId
  });

  return {
    artifact: artifact.artifact,
    content,
    contentType,
    filename: getReportExportFilename(updatedPack, input.format),
    format: input.format,
    ...(input.format === "html"
      ? {
          html: content
        }
      : {}),
    report: serializeEvidencePack(updatedPack)
  };
}

async function persistInlineModuleEvidence(input: {
  moduleId: string;
  prisma: PrismaClient;
  result: Awaited<ReturnType<typeof executeModuleById>>;
  runId: string;
  tenantId: string;
}) {
  const evidenceService = createPrismaEvidenceService({
    prisma: input.prisma
  });
  const rawArtifact = await evidenceService.putEvidenceArtifact({
    artifactType: "RawModuleOutput",
    content: {
      evidence: input.result.evidence,
      outcome: input.result.outcome,
      signals: input.result.signals,
      summary: input.result.summary,
      validationState: input.result.validationState
    },
    filename: `${input.moduleId}-raw-output`,
    relatedEntityId: input.runId,
    relatedEntityType: "ValidationRun",
    sensitivityLevel: "High",
    tenantId: input.tenantId
  });
  const artifacts = [rawArtifact.artifact];

  for (const [index, evidence] of input.result.evidence.entries()) {
    const stored = await evidenceService.putEvidenceArtifact({
      artifactType: evidence.artifactType,
      content: evidence.attributes,
      filename: `${input.moduleId}-normalized-${index + 1}`,
      relatedEntityId: input.runId,
      relatedEntityType: "ValidationRun",
      sensitivityLevel: evidence.sensitivityLevel,
      tenantId: input.tenantId
    });

    artifacts.push(stored.artifact);
  }

  return artifacts;
}

export function parseObserverOutcome(result: Record<string, unknown>): {
  confidence: number;
  detail: string;
  outcome: NonNullable<ValidateControlSourceInput["fixtureOutcome"]>;
  sourceType: string;
} {
  const rawOutcome = result.outcome;
  const outcome: NonNullable<ValidateControlSourceInput["fixtureOutcome"]> =
    rawOutcome === "Blocked" ||
    rawOutcome === "Detected" ||
    rawOutcome === "Logged" ||
    rawOutcome === "Alerted" ||
    rawOutcome === "Routed" ||
    rawOutcome === "Missed" ||
    rawOutcome === "NoEvidence" ||
    rawOutcome === "NeedsTuning"
      ? rawOutcome
      : "NoEvidence";

  return {
    confidence:
      typeof result.confidence === "number" &&
      result.confidence >= 0 &&
      result.confidence <= 1
        ? result.confidence
        : outcome === "NoEvidence"
          ? 0.58
          : 0.8,
    detail:
      typeof result.detail === "string" && result.detail.length > 0
        ? result.detail
        : "Mock control observer verdict.",
    outcome,
    sourceType:
      typeof result.sourceType === "string" && result.sourceType.length > 0
        ? result.sourceType
        : "periscan.control.observer"
  };
}

export function createObservedControlSignal(input: {
  confidence: number;
  controlSourceId: string;
  detail: string;
  outcome: NonNullable<ValidateControlSourceInput["fixtureOutcome"]>;
  sourceIntegrationId: string;
  sourceType: string;
  sourceVendor: string;
  techniqueId?: string;
  tenantId: string;
}) {
  const timestamp = new Date().toISOString();

  return {
    confidence: input.confidence,
    createdAt: timestamp,
    evidenceIds: [],
    freshness: "Fresh",
    rawPayloadPointer: null,
    redactionStatus: "Redacted",
    relatedAssetIds: [],
    relatedControlIds: [input.controlSourceId],
    relatedEvidenceIds: [],
    relatedIdentityIds: [],
    relatedPathIds: [],
    sensitivityLevel: "Moderate" as const,
    signalCategory: "ControlObservation" as const,
    signalId: randomUUID(),
    signalSubcategory: input.outcome,
    sourceIntegrationId: input.sourceIntegrationId,
    sourceType: input.sourceType,
    sourceVendor: input.sourceVendor,
    techniqueIds: input.techniqueId ? [input.techniqueId] : [],
    tenantId: input.tenantId,
    timestampIngested: timestamp,
    timestampObserved: timestamp,
    updatedAt: timestamp
  } satisfies SignalEnvelope;
}

export async function projectInlineValidationGraph(input: {
  evidenceArtifacts: EvidenceArtifact[];
  moduleId: string;
  prisma: PrismaClient;
  runId: string;
  signals: SignalEnvelope[];
  tenantId: string;
}) {
  const graph = createPrismaEvidenceGraphService(input.prisma);
  const runNode = await graph.upsertNode({
    evidenceIds: input.evidenceArtifacts.map((artifact) => artifact.evidenceId),
    label: `Validation run ${input.moduleId}`,
    nodeKey: `validation-run:${input.runId}`,
    nodeType: "ValidationRun",
    properties: {
      moduleId: input.moduleId,
      source: "api-inline-validation"
    },
    relatedEntityId: input.runId,
    relatedEntityType: "ValidationRun",
    tenantId: input.tenantId
  });
  const evidenceNodes = new Map<string, { graphNodeId: string }>();

  for (const artifact of input.evidenceArtifacts) {
    evidenceNodes.set(
      artifact.evidenceId,
      await graph.upsertNode({
        evidenceIds: [artifact.evidenceId],
        label: `${artifact.artifactType} ${artifact.evidenceId.slice(0, 8)}`,
        nodeKey: `evidence:${artifact.evidenceId}`,
        nodeType: "EvidenceArtifact",
        properties: {
          artifactType: artifact.artifactType,
          storageUri: artifact.storageUri
        },
        tenantId: artifact.tenantId
      })
    );
  }

  for (const signal of input.signals) {
    const projection = getSignalGraphProjection(signal);
    const signalNode = await graph.upsertNode({
      evidenceIds: signal.evidenceIds,
      label: projection.label,
      nodeKey: projection.nodeKey,
      nodeType: projection.nodeType,
      properties: {
        signalCategory: signal.signalCategory,
        signalSubcategory: signal.signalSubcategory,
        sourceType: signal.sourceType
      },
      tenantId: signal.tenantId
    });

    await graph.upsertEdge({
      evidenceIds: signal.evidenceIds,
      properties: {
        source: "api-inline-validation"
      },
      rationale: "Inline validation run emitted normalized signal evidence.",
      relationship: "RELATES_TO",
      sourceNodeId: runNode.graphNodeId,
      targetNodeId: signalNode.graphNodeId,
      tenantId: signal.tenantId
    });

    for (const evidenceId of signal.evidenceIds) {
      const evidenceNode = evidenceNodes.get(evidenceId);

      if (!evidenceNode) {
        continue;
      }

      await graph.upsertEdge({
        evidenceIds: [evidenceId],
        properties: {
          source: "api-inline-validation"
        },
        rationale: "Signal is backed by stored evidence artifact.",
        relationship: "OBSERVED_BY",
        sourceNodeId: signalNode.graphNodeId,
        targetNodeId: evidenceNode.graphNodeId,
        tenantId: signal.tenantId
      });
    }
  }
}

export async function executeInlineValidation(input: {
  adminApproval: boolean;
  augmentResult?: (
    result: Awaited<ReturnType<typeof executeModuleById>>
  ) => Promise<Awaited<ReturnType<typeof executeModuleById>>>;
  context: AuthenticatedContext;
  executionEnvironment: PolicyDecision["executionEnvironment"];
  explicitMissionApproval: boolean;
  missionType: ValidationMission["missionType"];
  moduleId: string;
  onCompleted?: (
    prisma: PrismaClient,
    result: Awaited<ReturnType<typeof executeModuleById>>
  ) => Promise<void>;
  prisma: PrismaClient;
  relatedControlIds?: string[];
  scopeId: string;
  target: Record<string, unknown>;
}) {
  const module = getModuleById(input.moduleId);

  if (!module) {
    throw new AppServiceError(
      `Module ${input.moduleId} not found.`,
      404,
      "module_not_found"
    );
  }

  const scope = await input.prisma.scope.findFirst({
    where: {
      scopeId: input.scopeId,
      tenantId: input.context.tenant.tenantId
    }
  });

  if (!scope) {
    throw new AppServiceError("Scope not found.", 404, "scope_not_found");
  }

  const evaluated = evaluatePolicy({
    adminApproval: input.adminApproval,
    executionEnvironment: input.executionEnvironment,
    explicitMissionApproval: input.explicitMissionApproval,
    missionType: input.missionType,
    requestedAction: buildSafeRequestedAction(module.manifest.executionMode),
    safetyLevel: module.manifest.safetyLevel,
    scopeContext: scope,
    scopeVerificationStatus: scope.verificationStatus,
    offensiveValidationAuthorized: await loadOffensiveValidationAuthorized(
      input.prisma,
      input.context.tenant.tenantId
    ),
    destructiveValidationAuthorized: await loadDestructiveValidationAuthorized(
      input.prisma,
      input.context.tenant.tenantId
    ),
    timeWindowApproved: false,
    userRole: input.context.membership.role
  });
  const decisionRecord = await input.prisma.policyDecision.create({
    data: {
      approvalState: evaluated.approvalState,
      approvedAt: evaluated.approvalState === "Approved" ? new Date() : null,
      approvedBy:
        evaluated.approvalState === "Approved"
          ? input.context.user.userId
          : null,
      executionEnvironment: input.executionEnvironment,
      missionType: input.missionType,
      outcome: evaluated.outcome,
      rationale: evaluated.rationale,
      requestedAction: buildSafeRequestedAction(
        module.manifest.executionMode
      ) as Prisma.InputJsonValue,
      safetyLevel: module.manifest.safetyLevel,
      scopeId: input.scopeId,
      target: input.target as Prisma.InputJsonValue,
      tenantId: input.context.tenant.tenantId,
      userId: input.context.user.userId
    }
  });
  const decision = serializePolicyDecision(decisionRecord);

  await writeAuditEvent(input.prisma, {
    action: "policy.decision",
    actorType: "User",
    entityId: decision.policyDecisionId,
    entityType: "Scope",
    metadata: {
      missionType: decision.missionType,
      outcome: decision.outcome,
      scopeId: decision.scopeId
    },
    tenantId: input.context.tenant.tenantId,
    userId: input.context.user.userId
  });

  if (decision.outcome !== "Allowed") {
    throw new AppServiceError(decision.rationale, 400, "policy_denied");
  }

  const missionRecord = await input.prisma.validationMission.create({
    data: {
      evidenceIds: [],
      missionType: input.missionType,
      policyDecisionId: decision.policyDecisionId,
      policyProfile: "inline-validation",
      requestedBy: input.context.user.userId,
      safetyLevel: module.manifest.safetyLevel,
      scopeId: input.scopeId,
      scopeIds: [input.scopeId],
      startedAt: new Date(),
      status: "Running",
      tenantId: input.context.tenant.tenantId
    }
  });

  await writeAuditEvent(input.prisma, {
    action: "mission.created",
    actorType: "User",
    entityId: missionRecord.missionId,
    entityType: "ValidationMission",
    metadata: {
      missionType: missionRecord.missionType,
      scopeId: missionRecord.scopeId
    },
    tenantId: input.context.tenant.tenantId,
    userId: input.context.user.userId
  });

  await writeAuditEvent(input.prisma, {
    action: "mission.started",
    actorType: "User",
    entityId: missionRecord.missionId,
    entityType: "ValidationMission",
    metadata: {
      durationMs: 0,
      jobsQueued: 0,
      moduleCount: 1,
      moduleIds: [module.manifest.moduleId]
    },
    tenantId: input.context.tenant.tenantId,
    userId: input.context.user.userId
  });

  const runRecord = await input.prisma.validationRun.create({
    data: {
      evidenceIds: [],
      missionId: missionRecord.missionId,
      moduleId: module.manifest.moduleId,
      outcome: null,
      policyDecisionId: decision.policyDecisionId,
      runnerId: null,
      safetyLevel: module.manifest.safetyLevel,
      scopeId: input.scopeId,
      startedAt: new Date(),
      status: "Running",
      target: input.target as Prisma.InputJsonValue,
      tenantId: input.context.tenant.tenantId,
      techniqueIds: [],
      validationState: null
    }
  });

  try {
    const result = await executeModuleById(module.manifest.moduleId, {
      integrationIds: [],
      inputs: {},
      missionId: missionRecord.missionId,
      policyDecisionId: decision.policyDecisionId,
      runId: runRecord.runId,
      runnerId: null,
      safetyLevel: module.manifest.safetyLevel,
      scopeId: input.scopeId,
      target: input.target,
      tenantId: input.context.tenant.tenantId
    });
    const finalResult = input.augmentResult
      ? await input.augmentResult(result)
      : result;
    const evidenceArtifacts = await persistInlineModuleEvidence({
      moduleId: module.manifest.moduleId,
      prisma: input.prisma,
      result: finalResult,
      runId: runRecord.runId,
      tenantId: input.context.tenant.tenantId
    });
    const evidenceIds = evidenceArtifacts.map(
      (artifact) => artifact.evidenceId
    );
    const techniqueIds = [
      ...new Set(
        finalResult.signals.flatMap((signal) => signal.techniqueIds ?? [])
      )
    ];
    const signals = finalResult.signals.map((signal) => ({
      ...signal,
      evidenceIds: appendUniqueIds(signal.evidenceIds, evidenceIds),
      relatedControlIds: appendUniqueIds(
        signal.relatedControlIds,
        input.relatedControlIds ?? []
      ),
      relatedEvidenceIds: appendUniqueIds(
        signal.relatedEvidenceIds,
        evidenceIds
      ),
      techniqueIds: signal.techniqueIds ?? []
    }));

    if (signals.length > 0) {
      await input.prisma.signalEnvelope.createMany({
        data: signals.map((signal) => ({
          confidence: signal.confidence ?? null,
          createdAt: new Date(signal.createdAt),
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
          sourceIntegrationId: signal.sourceIntegrationId,
          sourceType: signal.sourceType,
          sourceVendor: signal.sourceVendor,
          tenantId: signal.tenantId,
          techniqueIds: signal.techniqueIds ?? [],
          timestampIngested: new Date(signal.timestampIngested),
          timestampObserved: new Date(signal.timestampObserved),
          updatedAt: new Date(signal.updatedAt)
        }))
      });
    }

    await projectInlineValidationGraph({
      evidenceArtifacts,
      moduleId: module.manifest.moduleId,
      prisma: input.prisma,
      runId: runRecord.runId,
      signals,
      tenantId: input.context.tenant.tenantId
    });

    const completedAt = new Date();
    const updatedRun = await input.prisma.validationRun.update({
      where: {
        runId: runRecord.runId
      },
      data: {
        completedAt,
        errorSummary: null,
        evidenceIds,
        outcome: finalResult.outcome,
        status: "Completed",
        techniqueIds,
        validationState: finalResult.validationState ?? null
      }
    });
    const updatedMission = await input.prisma.validationMission.update({
      where: {
        missionId: missionRecord.missionId
      },
      data: {
        completedAt,
        evidenceIds,
        status: "Completed"
      }
    });

    // P05-1: control-plane hop probes also auto-apply receipts when hop-bound.
    if (evidenceIds.length > 0) {
      try {
        const { tryAutoApplyPathEdgeReceiptFromCompletedRun } = await import(
          "./services/findings.js"
        );
        await tryAutoApplyPathEdgeReceiptFromCompletedRun(input.prisma, {
          actor: input.context.user.userId,
          evidenceIds,
          missionId: missionRecord.missionId,
          moduleId: module.manifest.moduleId,
          outcome: finalResult.outcome ?? null,
          runId: runRecord.runId,
          target: runRecord.target ?? null,
          tenantId: input.context.tenant.tenantId,
          validationState: finalResult.validationState ?? null
        });
      } catch {
        // Best-effort; never fail the validation path on receipt auto-apply.
      }
    }

    if (input.onCompleted) {
      await input.onCompleted(input.prisma, finalResult);
    }

    await writeAuditEvent(input.prisma, {
      action: "module.executed",
      actorType: "System",
      entityId: updatedRun.runId,
      entityType: "ValidationRun",
      metadata: {
        moduleId: updatedRun.moduleId,
        outcome: finalResult.outcome,
        signalCount: signals.length
      },
      tenantId: input.context.tenant.tenantId,
      userId: input.context.user.userId
    });

    return {
      attackTechniques: mapAttackTechniqueIds(techniqueIds),
      decision,
      evidence: evidenceArtifacts,
      mission: serializeValidationMission(updatedMission),
      run: serializeValidationRun(updatedRun),
      signals
    } satisfies InlineValidationResult;
  } catch (error) {
    const completedAt = new Date();

    await input.prisma.validationRun.update({
      where: {
        runId: runRecord.runId
      },
      data: {
        completedAt,
        errorSummary:
          error instanceof Error ? error.message : "Validation failed.",
        outcome: "failed",
        status: "Failed"
      }
    });
    await input.prisma.validationMission.update({
      where: {
        missionId: missionRecord.missionId
      },
      data: {
        completedAt,
        status: "Failed"
      }
    });

    throw error;
  }
}

const correlatedAttackPathRefreshes = new Map<string, Promise<AttackPath[]>>();

export async function ensureCorrelatedAttackPathsForTenant(
  prisma: PrismaClient,
  tenantId: string
): Promise<AttackPath[]> {
  const inFlight = correlatedAttackPathRefreshes.get(tenantId);
  if (inFlight) {
    return inFlight;
  }

  const refresh = refreshCorrelatedAttackPathsForTenant(prisma, tenantId);
  correlatedAttackPathRefreshes.set(tenantId, refresh);

  try {
    return await refresh;
  } finally {
    if (correlatedAttackPathRefreshes.get(tenantId) === refresh) {
      correlatedAttackPathRefreshes.delete(tenantId);
    }
  }
}

async function refreshCorrelatedAttackPathsForTenant(
  prisma: PrismaClient,
  tenantId: string
): Promise<AttackPath[]> {
  const existingPaths = await prisma.attackPath.findMany({
    include: {
      pathBreakers: {
        orderBy: {
          priority: "asc"
        }
      },
      pathEdges: {
        orderBy: {
          createdAt: "asc"
        }
      },
      pathNodes: {
        orderBy: {
          sequence: "asc"
        }
      }
    },
    orderBy: {
      createdAt: "asc"
    },
    where: {
      tenantId
    }
  });
  const existingByName = new Map(
    existingPaths.map((path) => [path.name, path])
  );

  const signals = await prisma.signalEnvelope.findMany({
    orderBy: {
      createdAt: "asc"
    },
    where: {
      tenantId
    }
  });

  const drafts = correlateAttackPathsFromSignals({
    signals: signals.map((signal) => ({
      confidence: signal.confidence ?? 0.5,
      createdAt: signal.createdAt.toISOString(),
      evidenceIds: signal.evidenceIds,
      freshness: signal.freshness ?? "Fresh",
      rawPayloadPointer: signal.rawPayloadPointer,
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
      sourceIntegrationId: signal.sourceIntegrationId,
      sourceType: signal.sourceType,
      sourceVendor: signal.sourceVendor,
      tenantId: signal.tenantId,
      techniqueIds: signal.techniqueIds,
      timestampIngested: signal.timestampIngested.toISOString(),
      timestampObserved: signal.timestampObserved.toISOString(),
      updatedAt: signal.updatedAt.toISOString()
    }))
  });

  if (drafts.length === 0) {
    return [];
  }

  const graph = createPrismaEvidenceGraphService(prisma);
  const created: AttackPath[] = [];

  for (const draft of drafts) {
    const existingPath = existingByName.get(draft.name) ?? null;

    const persistedNodes = new Map<string, { graphNodeId: string }>();
    // Real, discovered asset anchor for this path (set from the first exposure
    // node's backing asset). Heuristic hypothesis nodes bind to a REAL asset and
    // are never persisted as fabricated Asset rows (P0.3, Real-First Rule).
    let primaryRealAssetId: string | null = null;

    for (const node of draft.nodes) {
      if (node.entityType === "Asset") {
        // Resolve a REAL asset first: an explicit relatedAssetId from a
        // contributing signal, otherwise a previously discovered asset matching
        // this node. We only create a new Asset row for non-hypothesis nodes.
        let asset =
          (node.relatedAssetId
            ? await prisma.asset.findFirst({
                where: {
                  assetId: node.relatedAssetId,
                  tenantId
                }
              })
            : null) ??
          (await prisma.asset.findFirst({
            where: {
              assetType: node.assetType,
              name: node.label,
              tenantId
            }
          }));

        if (!asset && !node.hypothesis) {
          asset = await prisma.asset.create({
            data: {
              assetType: node.assetType,
              businessCriticality: node.businessCriticality,
              environment: "production",
              firstSeenAt: new Date(),
              identifiers: {
                correlationKey: node.key
              } as Prisma.InputJsonValue,
              internetExposed: node.internetExposed,
              lastSeenAt: new Date(),
              name: node.label,
              status: "Active",
              tags: node.tags,
              tenantId
            }
          });
        }

        // Heuristic hypothesis with no real backing asset: anchor to the path's
        // real source asset instead of minting a placeholder "Production ..." row.
        const isHypothesis = node.hypothesis && !asset;

        if (isHypothesis && primaryRealAssetId) {
          asset = await prisma.asset.findFirst({
            where: {
              assetId: primaryRealAssetId,
              tenantId
            }
          });
        }

        if (!asset) {
          // No real anchor exists; refuse to fabricate an asset for this node.
          throw new AppServiceError(
            "Cannot persist a correlated path node without a real backing asset.",
            500,
            "attack_path_missing_real_asset"
          );
        }

        primaryRealAssetId ??= asset.assetId;

        const graphNode = await graph.upsertNode({
          evidenceIds: draft.evidenceIds,
          label: node.label,
          nodeKey: node.key,
          nodeType: isHypothesis
            ? `HeuristicHypothesis.${node.assetType}`
            : `Asset.${node.assetType}`,
          properties: {
            businessCriticality: node.businessCriticality,
            heuristic: isHypothesis || draft.heuristic,
            hypothesis: isHypothesis,
            internetExposed: node.internetExposed,
            methodology: draft.methodology,
            tags: node.tags
          },
          relatedEntityId: asset.assetId,
          relatedEntityType: "Asset",
          tenantId
        });

        persistedNodes.set(node.key, graphNode);
        continue;
      }

      const supportingAsset =
        (await prisma.asset.findFirst({
          where: {
            assetType: node.asset.assetType,
            name: node.asset.label,
            tenantId
          }
        })) ??
        (await prisma.asset.create({
          data: {
            assetType: node.asset.assetType,
            businessCriticality: node.asset.businessCriticality,
            environment: "production",
            firstSeenAt: new Date(),
            identifiers: {
              correlationKey: node.asset.key
            } as Prisma.InputJsonValue,
            internetExposed: node.asset.internetExposed,
            lastSeenAt: new Date(),
            name: node.asset.label,
            status: "Active",
            tags: node.asset.tags,
            tenantId
          }
        }));

      // Anchor heuristic hypothesis nodes to this real, discovered asset.
      primaryRealAssetId ??= supportingAsset.assetId;

      const exposure =
        (await prisma.exposure.findFirst({
          where: {
            assetId: supportingAsset.assetId,
            exposureType: node.exposureType,
            source: node.source,
            tenantId
          }
        })) ??
        (await prisma.exposure.create({
          data: {
            assetId: supportingAsset.assetId,
            confidence: node.confidence,
            evidenceIds: draft.evidenceIds,
            exposureType: node.exposureType,
            firstSeenAt: new Date(),
            lastSeenAt: new Date(),
            severity: node.severity,
            source: node.source,
            status: "Open",
            tenantId,
            validationState: node.validationState
          }
        }));

      if (exposure.evidenceIds.length !== draft.evidenceIds.length) {
        await prisma.exposure.update({
          where: {
            exposureId: exposure.exposureId
          },
          data: {
            confidence: Math.max(exposure.confidence, node.confidence),
            evidenceIds: appendUniqueIds(
              exposure.evidenceIds,
              draft.evidenceIds
            ),
            lastSeenAt: new Date(),
            severity: exposure.severity,
            validationState: node.validationState
          }
        });
      }

      await graph.upsertNode({
        evidenceIds: draft.evidenceIds,
        label: node.asset.label,
        nodeKey: node.asset.key,
        nodeType: resolveGraphNodeType("Asset", node.asset.assetType),
        properties: {
          businessCriticality: node.asset.businessCriticality,
          internetExposed: node.asset.internetExposed,
          tags: node.asset.tags
        },
        relatedEntityId: supportingAsset.assetId,
        relatedEntityType: "Asset",
        tenantId
      });

      const graphNode = await graph.upsertNode({
        evidenceIds: draft.evidenceIds,
        label: node.label,
        nodeKey: node.key,
        // P11R-1: free exposureType collapses to bare Exposure when not allowlisted
        nodeType: resolveGraphNodeType("Exposure", node.exposureType),
        properties: {
          exposureType: node.exposureType,
          severity: node.severity,
          source: node.source
        },
        relatedEntityId: exposure.exposureId,
        relatedEntityType: "Exposure",
        tenantId
      });

      persistedNodes.set(node.key, graphNode);
    }

    const persistedEdges = new Map<
      string,
      {
        graphEdgeId: string;
        sourceNodeId: string;
        targetNodeId: string;
      }
    >();

    for (const edge of draft.edges) {
      const graphEdge = await graph.upsertEdge({
        evidenceIds: edge.evidenceIds,
        properties: {
          evidenceBasis: resolveDraftEdgeEvidenceBasis(edge),
          measurementMethod: edge.measurementMethod ?? draft.methodology,
          patternId: draft.patternId
        },
        rationale: edge.rationale,
        relationship: edge.relationship,
        sourceNodeId: persistedNodes.get(edge.sourceKey)!.graphNodeId,
        targetNodeId: persistedNodes.get(edge.targetKey)!.graphNodeId,
        tenantId
      });

      persistedEdges.set(`${edge.sourceKey}:${edge.targetKey}`, {
        graphEdgeId: graphEdge.graphEdgeId,
        sourceNodeId: persistedNodes.get(edge.sourceKey)!.graphNodeId,
        targetNodeId: persistedNodes.get(edge.targetKey)!.graphNodeId
      });
    }

    // Path-level draft basis from honest edge resolution (not draft.heuristic).
    // Hop receipts reattach+recompute may upgrade to Measured afterward.
    const draftPathEvidenceBasis = resolveDraftPathEvidenceBasis(draft.edges);

    if (!existingPath) {
      created.push(
        await graph.createAttackPath({
          confidence: draft.confidence,
          edgeIds: draft.edges.map(
            (edge) =>
              persistedEdges.get(`${edge.sourceKey}:${edge.targetKey}`)!
                .graphEdgeId
          ),
          evidenceBasis: draftPathEvidenceBasis /* provisional; receipt reattach may upgrade */,
          evidenceIds: draft.evidenceIds,
          impactScore: draft.impactScore,
          methodology: draft.methodology,
          name: draft.name,
          nodeIds: draft.nodes.map(
            (node) => persistedNodes.get(node.key)!.graphNodeId
          ),
          pathBreakers: draft.pathBreakers.map((breaker) => ({
            description: breaker.description,
            evidenceIds: breaker.evidenceIds,
            priority: breaker.priority,
            relatedNodeId: breaker.relatedNodeKey
              ? (persistedNodes.get(breaker.relatedNodeKey)?.graphNodeId ??
                null)
              : null,
            title: breaker.title
          })),
          tenantId,
          validationState: draft.validationState
        })
      );
      continue;
    }

    // Hold a path-scoped advisory lock across snapshot→delete→reattach so a
    // concurrent pathEdgeReceipt.create cannot be cascade-wiped mid-refresh.
    const refreshedPath = await withPathEdgeReceiptLock(
      prisma,
      existingPath.pathId,
      async (tx) => {
      // Snapshot hop receipts before pathEdge deleteMany (cascade would drop them).
      // hopKey is stable across edge id rewrites so measured hops can reattach.
      // Also preserve pathEdgeId by hopKey so clients that hold edge IDs from a
      // prior GET (Measure hop / apply receipt) do not 404 after correlation refresh.
      const preservedReceiptRows = await tx.pathEdgeReceipt.findMany({
        orderBy: {
          measuredAt: "desc"
        },
        where: {
          pathId: existingPath.pathId,
          tenantId
        }
      });
      const preservedReceipts: PathEdgeReceipt[] = preservedReceiptRows.map(
        (row) =>
          PathEdgeReceiptSchema.parse({
            actor: row.actor,
            evidenceIds: row.evidenceIds,
            hopKey: row.hopKey,
            integrityHash: row.integrityHash,
            measuredAt: row.measuredAt.toISOString(),
            measurementMethod: row.measurementMethod,
            missionId: row.missionId,
            moduleId: row.moduleId,
            outcome: row.outcome,
            pathEdgeId: row.pathEdgeId,
            pathId: row.pathId,
            policyDecisionId: row.policyDecisionId,
            receiptId: row.receiptId,
            tenantId: row.tenantId,
            validationRunId: row.validationRunId,
            validationState: row.validationState
          })
      );
      const existingSerialized = serializeAttackPath(existingPath);
      const hopKeyToPreservedEdgeId = new Map<string, string>();
      for (const edge of existingSerialized.pathEdges) {
        const hopKey = hopKeyForPathEdge(edge, existingSerialized.pathNodes);
        if (hopKey && !hopKeyToPreservedEdgeId.has(hopKey)) {
          hopKeyToPreservedEdgeId.set(hopKey, edge.pathEdgeId);
        }
      }

      await tx.attackPath.update({
        where: {
          pathId: existingPath.pathId
        },
        data: {
          confidence: draft.confidence,
          // Draft basis is provisional; after edge recreation we recompute from
          // reattached hop receipts (weakest-edge) so Measured hops survive refresh.
          evidenceBasis: draftPathEvidenceBasis /* provisional; receipt reattach may upgrade */,
          evidenceIds: draft.evidenceIds,
          impactScore: draft.impactScore,

          methodology: draft.methodology,
          validationState: draft.validationState
        }
      });
      await tx.pathBreaker.deleteMany({
        where: {
          pathId: existingPath.pathId
        }
      });
      await tx.pathEdge.deleteMany({
        where: {
          pathId: existingPath.pathId
        }
      });
      await tx.pathNode.deleteMany({
        where: {
          pathId: existingPath.pathId
        }
      });

      const graphNodeIdToPathNodeId = new Map<string, string>();

      for (const [index, node] of draft.nodes.entries()) {
        const graphNodeId = persistedNodes.get(node.key)!.graphNodeId;
        const graphNode = await tx.graphNode.findUniqueOrThrow({
          where: {
            graphNodeId
          }
        });
        const pathNode = await tx.pathNode.create({
          data: {
            entityId: graphNode.relatedEntityId!,
            entityType: graphNode.relatedEntityType!,
            evidenceIds: appendUniqueIds(
              graphNode.evidenceIds,
              draft.evidenceIds
            ),
            label: graphNode.label,
            pathId: existingPath.pathId,
            sequence: index,
            tenantId
          }
        });

        graphNodeIdToPathNodeId.set(graphNodeId, pathNode.pathNodeId);
      }

      const orderedPathNodes = await tx.pathNode.findMany({
        orderBy: {
          sequence: "asc"
        },
        where: {
          pathId: existingPath.pathId
        }
      });
      await tx.attackPath.update({
        where: {
          pathId: existingPath.pathId
        },
        data: {
          entryNodeId: orderedPathNodes[0]!.pathNodeId,
          impactNodeId: orderedPathNodes[orderedPathNodes.length - 1]!.pathNodeId
        }
      });

      const claimedPreservedEdgeIds = new Set<string>();
      for (const edge of draft.edges) {
        const graphEdge = persistedEdges.get(
          `${edge.sourceKey}:${edge.targetKey}`
        )!;

        const sourcePathNodeId = graphNodeIdToPathNodeId.get(
          graphEdge.sourceNodeId
        )!;
        const targetPathNodeId = graphNodeIdToPathNodeId.get(
          graphEdge.targetNodeId
        )!;
        const sourceEntityId = orderedPathNodes.find(
          (node) => node.pathNodeId === sourcePathNodeId
        )?.entityId;
        const targetEntityId = orderedPathNodes.find(
          (node) => node.pathNodeId === targetPathNodeId
        )?.entityId;
        const hopKey =
          sourceEntityId && targetEntityId
            ? buildHopKey(sourceEntityId, targetEntityId, edge.relationship)
            : null;
        const preservedEdgeId =
          hopKey != null ? hopKeyToPreservedEdgeId.get(hopKey) : undefined;
        // Only reuse a pathEdgeId once per refresh (duplicate hopKeys would collide).
        const pathEdgeId =
          preservedEdgeId && !claimedPreservedEdgeIds.has(preservedEdgeId)
            ? preservedEdgeId
            : undefined;
        if (pathEdgeId) {
          claimedPreservedEdgeIds.add(pathEdgeId);
        }

        // New edges start from draft certainty only. Hop measurement is restored
        // below from reattached receipts — never upgrade unmeasured hops here.
        // When hopKey matches a prior edge, reuse pathEdgeId so Measure hop / receipt
        // apply against a just-listed pathEdgeId still resolves after refresh.
        await tx.pathEdge.create({
          data: {
            ...(pathEdgeId ? { pathEdgeId } : {}),
            evidenceBasis: resolveDraftEdgeEvidenceBasis(edge),
            evidenceIds: appendUniqueIds(edge.evidenceIds, draft.evidenceIds),
            measurementMethod: edge.measurementMethod ?? draft.methodology,
            pathId: existingPath.pathId,
            rationale: edge.rationale,
            relationship: edge.relationship,
            sourceNodeId: sourcePathNodeId,
            targetNodeId: targetPathNodeId,
            tenantId
          }
        });
      }

      for (const breaker of draft.pathBreakers) {
        await tx.pathBreaker.create({
          data: {
            description: breaker.description,
            evidenceIds: breaker.evidenceIds,
            pathId: existingPath.pathId,
            priority: breaker.priority,
            relatedNodeId: breaker.relatedNodeKey
              ? (graphNodeIdToPathNodeId.get(
                  persistedNodes.get(breaker.relatedNodeKey)!.graphNodeId
                ) ?? null)
              : null,
            tenantId,
            title: breaker.title
          }
        });
      }

      let refreshedPath = await tx.attackPath.findUniqueOrThrow({
        include: {
          pathBreakers: {
            orderBy: {
              priority: "asc"
            }
          },
          pathEdges: {
            orderBy: {
              createdAt: "asc"
            }
          },
          pathNodes: {
            orderBy: {
              sequence: "asc"
            }
          }
        },
        where: {
          pathId: existingPath.pathId
        }
      });

      // Re-attach hop receipts by hopKey onto new pathEdgeIds, then recompute
      // per-edge evidenceBasis from those receipts (weakest edge wins at path).
      if (preservedReceipts.length > 0) {
        const pathAfterRecreate = serializeAttackPath(refreshedPath);
        const { reattachedReceipts } = reattachPathEdgeReceiptsByHopKey({
          pathEdges: pathAfterRecreate.pathEdges,
          pathId: existingPath.pathId,
          pathNodes: pathAfterRecreate.pathNodes,
          receipts: preservedReceipts
        });

        for (const receipt of reattachedReceipts) {
          await tx.pathEdgeReceipt.create({
            data: {
              actor: receipt.actor ?? null,
              evidenceIds: receipt.evidenceIds,
              hopKey: receipt.hopKey,
              integrityHash: receipt.integrityHash ?? null,
              measuredAt: new Date(receipt.measuredAt),
              measurementMethod: receipt.measurementMethod,
              missionId: receipt.missionId ?? null,
              moduleId: receipt.moduleId,
              outcome: receipt.outcome,
              pathEdgeId: receipt.pathEdgeId,
              pathId: receipt.pathId,
              policyDecisionId: receipt.policyDecisionId ?? null,
              receiptId: receipt.receiptId,
              tenantId: receipt.tenantId ?? tenantId,
              validationRunId: receipt.validationRunId ?? null,
              validationState: receipt.validationState
            }
          });
        }

        const recomputed = recomputeAttackPathFromReceipts({
          path: pathAfterRecreate,
          receipts: reattachedReceipts
        });

        // Persist only receipt-driven edge/path fields. Unmeasured edges keep the
        // draft basis from create (never upgraded without a matching receipt).
        for (const edge of recomputed.pathEdges) {
          const before = pathAfterRecreate.pathEdges.find(
            (candidate) => candidate.pathEdgeId === edge.pathEdgeId
          );
          if (
            !before ||
            (before.evidenceBasis === edge.evidenceBasis &&
              JSON.stringify(before.evidenceIds) ===
                JSON.stringify(edge.evidenceIds) &&
              (before.measurementMethod ?? null) ===
                (edge.measurementMethod ?? null))
          ) {
            continue;
          }
          await tx.pathEdge.update({
            data: {
              evidenceBasis: edge.evidenceBasis,
              evidenceIds: edge.evidenceIds,
              measurementMethod: edge.measurementMethod ?? null
            },
            where: {
              pathEdgeId: edge.pathEdgeId
            }
          });
        }

        if (
          recomputed.evidenceBasis !== pathAfterRecreate.evidenceBasis ||
          JSON.stringify(recomputed.evidenceIds) !==
            JSON.stringify(pathAfterRecreate.evidenceIds) ||
          recomputed.validationState !== pathAfterRecreate.validationState
        ) {
          await tx.attackPath.update({
            data: {
              evidenceBasis: recomputed.evidenceBasis,
              evidenceIds: recomputed.evidenceIds,
              // Wave A3: claim-safe validationState from receipt-backed hops only.
              validationState: recomputed.validationState
            },
            where: {
              pathId: existingPath.pathId
            }
          });
        }

        refreshedPath = await tx.attackPath.findUniqueOrThrow({
          include: {
            pathBreakers: {
              orderBy: {
                priority: "asc"
              }
            },
            pathEdges: {
              orderBy: {
                createdAt: "asc"
              }
            },
            pathNodes: {
              orderBy: {
                sequence: "asc"
              }
            }
          },
          where: {
            pathId: existingPath.pathId
          }
        });
      }

      // P09-2: persist claim-safe path validationState after hop edges (and any
      // receipt reattach) exist. Never leave Reachable/Validated/Exploitable on a
      // path whose measurement does not support the claim.
      {
        const serialized = serializeAttackPath(refreshedPath);
        const claimSafe = claimSafePathValidationStateForWrite({
          evidenceBasis: serialized.evidenceBasis,
          pathEdges: serialized.pathEdges,
          requestedValidationState: draft.validationState
        });
        if (claimSafe !== refreshedPath.validationState) {
          refreshedPath = await tx.attackPath.update({
            data: {
              validationState: claimSafe
            },
            include: {
              pathBreakers: {
                orderBy: {
                  priority: "asc"
                }
              },
              pathEdges: {
                orderBy: {
                  createdAt: "asc"
                }
              },
              pathNodes: {
                orderBy: {
                  sequence: "asc"
                }
              }
            },
            where: {
              pathId: existingPath.pathId
            }
          });
        }
      }

      return refreshedPath;
      }
    );

    created.push(serializeAttackPath(refreshedPath));

  }

  return created;
}

async function ensureSnapshotRemediationForPath(input: {
  context: AuthenticatedContext;
  path: AttackPath;
  prisma: PrismaClient;
}): Promise<RemediationTask> {
  const draft = generateRemediationTaskDraft(
    input.path,
    assessAttackPathRisk(input.path).risk
  );
  const pathFingerprint = computeAttackPathFindingFingerprint(input.path);

  const existingByPath = await input.prisma.remediationTask.findFirst({
    where: {
      relatedPathId: input.path.pathId,
      tenantId: input.context.tenant.tenantId
    }
  });

  if (existingByPath) {
    const refreshed = await input.prisma.remediationTask.update({
      where: {
        remediationId: existingByPath.remediationId
      },
      data: {
        evidenceIds: appendUniqueIds(
          existingByPath.evidenceIds,
          input.path.evidenceIds
        ),
        owner: existingByPath.owner ?? draft.owner,
        recommendedAction: draft.recommendedAction,
        relatedExposureId: draft.relatedExposureId,
        // Backfill fingerprint on legacy rows; never clear an existing value.
        relatedFindingFingerprint:
          existingByPath.relatedFindingFingerprint ?? pathFingerprint,
        technicalSteps: draft.technicalSteps,
        verificationMethod: draft.verificationMethod,
        verificationRequired: draft.verificationRequired
      }
    });

    return serializeRemediationTask(refreshed);
  }

  // PERISCAN-7: reuse an open remediation for the same grouped finding cause
  // so snapshot generation does not mint duplicate work items.
  const existingByFingerprint = await input.prisma.remediationTask.findFirst({
    orderBy: { updatedAt: "desc" },
    where: {
      relatedFindingFingerprint: pathFingerprint,
      status: {
        in: [
          "Open",
          "InProgress",
          "VerificationPending",
          "StillExposed",
          "PartiallyFixed",
          "Inconclusive",
          "Reopened"
        ]
      },
      tenantId: input.context.tenant.tenantId
    }
  });

  if (existingByFingerprint) {
    const refreshed = await input.prisma.remediationTask.update({
      where: {
        remediationId: existingByFingerprint.remediationId
      },
      data: {
        evidenceIds: appendUniqueIds(
          existingByFingerprint.evidenceIds,
          input.path.evidenceIds
        )
        // Keep relatedPathId and verification history intact.
      }
    });
    return serializeRemediationTask(refreshed);
  }

  const remediation = await input.prisma.remediationTask.create({
    data: {
      evidenceIds: input.path.evidenceIds,
      owner: draft.owner,
      recommendedAction: draft.recommendedAction,
      relatedExposureId: draft.relatedExposureId,
      relatedFindingFingerprint: pathFingerprint,
      relatedPathId: input.path.pathId,
      status: "Open",
      technicalSteps: draft.technicalSteps,
      tenantId: input.context.tenant.tenantId,
      verificationMethod: draft.verificationMethod,
      verificationRequired: draft.verificationRequired
    }
  });

  await writeAuditEvent(input.prisma, {
    action: "remediation.created",
    actorType: "System",
    entityId: remediation.remediationId,
    entityType: "RemediationTask",
    metadata: {
      relatedFindingFingerprint: remediation.relatedFindingFingerprint,
      relatedPathId: remediation.relatedPathId,
      source: "validation_snapshot"
    },
    tenantId: input.context.tenant.tenantId,
    userId: input.context.user.userId
  });

  return serializeRemediationTask(remediation);
}

// Count Critical/High paths across the FULL assessed set. Kept separate from the
// `topAttackPaths` display slice so the metric reflects the tenant's real
// high-risk exposure instead of being silently capped at maxTopItems (the
// v0.1.127 cap bug, here in the risk-understating direction).
export function countHighRiskPaths(
  assessments: Array<{ risk: { band: AttackPathAssessment["risk"]["band"] } }>
): number {
  return assessments.filter(
    (assessment) =>
      assessment.risk.band === "Critical" || assessment.risk.band === "High"
  ).length;
}

export async function buildValidationSnapshotPayload(input: {
  audience?: string;
  context: AuthenticatedContext;
  maxTopItems: number;
  prisma: PrismaClient;
}): Promise<{
  aiAppRisks: SignalEnvelope[];
  aiRiskCount: number;
  controlObservations: SignalEnvelope[];
  controlObservationCount: number;
  correlatedThreatAdvisoryCount: number;
  evidenceIds: string[];
  highRiskPathCount: number;
  integrationIds: string[];
  openThreatAdvisoryCount: number;
  remediations: RemediationTask[];
  scopeIds: string[];
  staleVerificationCount: number;
  summary: ValidationSnapshot["summary"];
  topAttackPaths: AttackPathAssessment[];
}> {
  const [integrations, scopes] = await Promise.all([
    input.prisma.integration.findMany({
      orderBy: {
        createdAt: "asc"
      },
      where: {
        status: "Connected",
        tenantId: input.context.tenant.tenantId
      }
    }),
    input.prisma.scope.findMany({
      orderBy: {
        createdAt: "asc"
      },
      where: {
        tenantId: input.context.tenant.tenantId,
        verificationStatus: "Verified"
      }
    })
  ]);

  for (const integration of integrations) {
    const connectorKey = getConnectorKey(integration.config);
    const connector = connectorKey ? getConnectorByKey(connectorKey) : null;

    if (
      !connector ||
      !connector.manifest.supportedMissionTypes.includes("ValidationSnapshot")
    ) {
      continue;
    }

    await syncPersistedIntegration({
      connector,
      integration,
      prisma: input.prisma
    });
  }

  const signals = await input.prisma.signalEnvelope.findMany({
    orderBy: {
      createdAt: "desc"
    },
    where: {
      tenantId: input.context.tenant.tenantId
    }
  });
  const assessedPaths = (
    await assessAttackPathsWithFinancialExposure({
      paths: await ensureCorrelatedAttackPathsForTenant(
        input.prisma,
        input.context.tenant.tenantId
      ),
      prisma: input.prisma,
      tenantId: input.context.tenant.tenantId
    })
  ).sort((left, right) => right.risk.score - left.risk.score);
  // topAttackPaths is a DISPLAY slice; high-risk COUNT must reflect the full
  // assessed set or it silently caps at maxTopItems and under-states the
  // tenant's real Critical/High exposure (the v0.1.127 cap bug, here in the
  // risk-understating direction).
  const topAttackPaths = assessedPaths.slice(0, Math.min(input.maxTopItems, 5));
  const highRiskPathCount = countHighRiskPaths(assessedPaths);
  // Full sets drive the COUNT metrics; the embedded preview arrays are sliced
  // for display. Counting the sliced arrays would silently cap the metrics at 5.
  const controlObservationSignals = signals.filter(
    (signal) => signal.signalCategory === "ControlObservation"
  );
  const aiRiskSignals = signals.filter(
    (signal) =>
      signal.signalCategory === "AIApplication" &&
      !isBenignAIEndpointProbeSignal(signal) &&
      !["GuardrailHeld", "Passed"].includes(signal.signalSubcategory ?? "")
  );
  const controlObservations = controlObservationSignals
    .slice(0, 5)
    .map(serializeSignalEnvelope);
  const aiAppRisks = aiRiskSignals.slice(0, 5).map(serializeSignalEnvelope);
  const remediations: RemediationTask[] = [];

  for (const path of topAttackPaths) {
    remediations.push(
      await ensureSnapshotRemediationForPath({
        context: input.context,
        path: path.attackPath,
        prisma: input.prisma
      })
    );
  }

  const pathLanguage = buildValidationSnapshotPathLanguage(topAttackPaths);
  const scopeIds = scopes.map((scope) => scope.scopeId);
  const integrationIds = integrations.map(
    (integration) => integration.integrationId
  );
  const evidenceIds = [
    ...new Set([
      ...topAttackPaths.flatMap((path) => path.attackPath.evidenceIds),
      ...controlObservations.flatMap((signal) => signal.evidenceIds),
      ...aiAppRisks.flatMap((signal) => signal.evidenceIds),
      ...remediations.flatMap((remediation) => remediation.evidenceIds)
    ])
  ];

  // Threat-center posture: open (non-Closed) advisories the tenant is tracking,
  // and how many of those actually CORRELATE to the tenant's validation evidence
  // (genuine "are we exposed?" — indicator overlap, not just imported advisories).
  const openThreatAdvisoryCount = await input.prisma.threatAdvisory.count({
    where: {
      status: { not: "Closed" },
      tenantId: input.context.tenant.tenantId
    }
  });
  const correlatedThreatAdvisoryCount = await countCorrelatedThreatAdvisories(
    input.prisma,
    input.context.tenant.tenantId
  );

  // staleVerificationCount and the freshness narrative answer a TENANT-WIDE
  // question — "are our 'Fixed' claims still true?" — so they must be measured
  // against ALL the tenant's settled remediations, not just the handful of
  // top-path priorities embedded in this snapshot. Those embedded remediations
  // are (re)created right here, so their nextVerificationAt is freshly scheduled
  // and almost never overdue; scoping the metric to that subset made the
  // executive "Fixes overdue for re-verification" metric systematically
  // under-claim and hid genuinely stale fixes living outside the display slice.
  // (The [tenantId, status, nextVerificationAt] index exists for this query.)
  const tenantRemediations = (
    await input.prisma.remediationTask.findMany({
      select: {
        nextVerificationAt: true,
        status: true
      },
      where: {
        tenantId: input.context.tenant.tenantId
      }
    })
  ).map((remediation) => ({
    nextVerificationAt: remediation.nextVerificationAt?.toISOString() ?? null,
    status: remediation.status
  }));
  const staleVerificationCount = countStaleVerifications(
    tenantRemediations,
    new Date()
  );

  return {
    aiAppRisks,
    aiRiskCount: aiRiskSignals.length,
    controlObservations,
    controlObservationCount: controlObservationSignals.length,
    correlatedThreatAdvisoryCount,
    evidenceIds,
    highRiskPathCount,
    integrationIds,
    openThreatAdvisoryCount,
    remediations,
    scopeIds,
    staleVerificationCount,
    summary: {
      headline: pathLanguage.headline,
      overview: `${pathLanguage.overview}${buildVerificationFreshnessNote(tenantRemediations)}`,
      topRiskBand: topAttackPaths[0]?.risk.band ?? "Informational"
    },
    topAttackPaths
  };
}

export async function loadValidationSnapshot(
  prisma: PrismaClient,
  context: AuthenticatedContext,
  snapshotId: string
): Promise<ValidationSnapshot | null> {
  const pack = await prisma.evidencePack.findFirst({
    where: {
      evidencePackId: snapshotId,
      packType: "ValidationSnapshotReport",
      tenantId: context.tenant.tenantId
    }
  });

  if (!pack) {
    return null;
  }

  return loadSnapshotFromEvidencePack(prisma, context, pack);
}

export async function loadSnapshotFromEvidencePack(
  prisma: PrismaClient,
  context: AuthenticatedContext,
  pack: EvidencePackRecord
): Promise<ValidationSnapshot | null> {
  const artifacts = await prisma.evidenceArtifact.findMany({
    orderBy: {
      createdAt: "asc"
    },
    where: {
      relatedEntityId: pack.evidencePackId,
      relatedEntityType: "EvidencePack",
      tenantId: context.tenant.tenantId
    }
  });
  const snapshotArtifact = artifacts.find(
    (artifact) => artifact.artifactType === "NormalizedEvidence"
  );

  if (!snapshotArtifact) {
    // Support non-snapshot scheduled packs (Control/AI/Fix) for report export/CTEM.
    // Synthesize a minimal but valid snapshot payload so render + artifact generation succeeds.
    // Evidence attached by processor is available via pack.evidenceIds for appendix.
    // Future: populate controlObservations/aiAppRisks/top paths by loading signals for the evidenceIds.
    const isNonSnapshotPack = [
      "ControlValidationReport",
      "AIAppValidationReport",
      "FixVerificationReport"
    ].includes(pack.packType as string);
    if (isNonSnapshotPack) {
      const now = new Date().toISOString();
      // Enrich synth ONLY with observations linked to this pack's evidenceIds.
      // Never fall back to unrelated recent tenant signals — that fabricates
      // evidence-backed report content for unmeasured / empty packs.
      const packEvidenceIds = Array.isArray(pack.evidenceIds)
        ? pack.evidenceIds
        : [];
      const signals =
        packEvidenceIds.length > 0
          ? await prisma.signalEnvelope.findMany({
              where: {
                tenantId: context.tenant.tenantId,
                evidenceIds: { hasSome: packEvidenceIds }
              },
              orderBy: { createdAt: "desc" },
              take: 50
            })
          : [];
      const controlObservationSignals = signals.filter(
        (s) => s.signalCategory === "ControlObservation"
      );
      const aiRiskSignals = signals.filter(
        (s) =>
          s.signalCategory === "AIApplication" &&
          !["GuardrailHeld", "Passed"].includes(s.signalSubcategory ?? "")
      );
      const controlObservations = controlObservationSignals
        .slice(0, 8)
        .map(serializeSignalEnvelope);
      const aiAppRisks = aiRiskSignals.slice(0, 8).map(serializeSignalEnvelope);
      const honesty = describeNonSnapshotPackEvidenceState({
        linkedObservationCount:
          controlObservations.length + aiAppRisks.length,
        packEvidenceIds
      });

      const synth: Partial<ValidationSnapshot> = {
        aiAppRisks,
        controlObservations,
        createdAt: now,
        evidenceIds: packEvidenceIds,
        evidencePack: serializeEvidencePack(pack),
        integrationIds: [],
        metrics: {
          aiRiskCount: aiAppRisks.length,
          controlObservationCount: controlObservations.length,
          highRiskPathCount: 0,
          correlatedThreatAdvisoryCount: 0,
          integrationCount: 0,
          openThreatAdvisoryCount: 0,
          remediationCount: 0,
          staleVerificationCount: 0,
          topPathCount: 0,
          verifiedScopeCount: 0
        },
        missionId: null,
        remediationPriorities: [],
        scopeIds: [],
        snapshotId: pack.evidencePackId,
        summary: {
          headline: `${pack.packType} (scheduled)`,
          overview: honesty.overview,
          topRiskBand: honesty.topRiskBand
        },
        tenantId: context.tenant.tenantId,
        topAttackPaths: [],
        updatedAt: now,
        verificationPlan: [
          packEvidenceIds.length > 0
            ? "Review attached evidence for this validation type."
            : "Attach measured validation evidence before treating this report as proof.",
          "Re-run schedule or targeted mission for drift comparison.",
          "Export report for proof and sharing."
        ]
      };

      // BUILD-O: Deepen G-wire model consumption for non-snap (Control/AI/Fix packs).
      // Load modelSessionId + best-effort latest ModelGatewayTurn excerpt into synth/verificationPlan
      // so exportReport, CTEM, and UI pack details surface real model analysis (not just ID).
      // Mirrors logic in snapshots.ts; safe if table/rows absent.
      const packWithModelSession =
        pack as unknown as EvidencePackWithModelSession;
      const modelSessId =
        packWithModelSession.modelSessionId ||
        (typeof pack.title === "string" && pack.title.includes("model:")
          ? pack.title.split("model:")[1]?.slice(0, 12)
          : null);
      if (modelSessId) {
        const synthWithModel = synth as Partial<ValidationSnapshot> & {
          modelExcerpt?: string;
          modelSessionId?: string;
          verificationOutcome?: string;
        };
        synthWithModel.modelSessionId = modelSessId;
        synth.verificationPlan = [
          ...(synth.verificationPlan || []),
          `Frontier model session ${modelSessId} linked for scheduled analysis.`,
          "Review model turn outputs in Model Gateway for AI-grounded observations (redacted)."
        ];
        try {
          const prismaWithModelTurns =
            prisma as PrismaWithOptionalModelGatewayTurn;
          const turns = prismaWithModelTurns.modelGatewayTurn
            ? await prismaWithModelTurns.modelGatewayTurn.findMany({
                where: { modelSessionId: modelSessId },
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { output: true, turnId: true }
              })
            : [];
          const t = turns.length ? turns[0] : null;
          if (t?.output) {
            const out =
              typeof t.output === "string"
                ? t.output
                : JSON.stringify(t.output);
            const excerpt = out.replace(/[\r\n]/g, " ").slice(0, 180);
            synth.verificationPlan.push(
              `Model analysis excerpt (turn ${String(t.turnId || "").slice(0, 8)}): ${excerpt}...`
            );
          }
        } catch {
          // best-effort only; non-snap pack remains usable
        }
      }
      const snapshot = ValidationSnapshotSchema.parse(synth);
      // attach pack for render
      return {
        ...snapshot,
        evidencePack: serializeEvidencePack(pack)
      } as ValidationSnapshot;
    }
    return null;
  }

  const evidenceService = createPrismaEvidenceService({
    prisma
  });
  const stored = await evidenceService.getEvidenceArtifact(
    snapshotArtifact.evidenceId
  );

  if (!stored) {
    return null;
  }

  const parsed = ValidationSnapshotSchema.parse(JSON.parse(stored.content));
  const snapshot: ValidationSnapshot = {
    ...parsed,
    evidenceIds: [...new Set([...parsed.evidenceIds, ...pack.evidenceIds])],
    evidencePack: serializeEvidencePack(pack),
    snapshotId: pack.evidencePackId,
    tenantId: context.tenant.tenantId
  };

  return refreshSnapshotRemediationPriorities(prisma, context, snapshot);
}

async function refreshSnapshotRemediationPriorities(
  prisma: PrismaClient,
  context: AuthenticatedContext,
  snapshot: ValidationSnapshot
): Promise<ValidationSnapshot> {
  const remediationIds = snapshot.remediationPriorities.map(
    (remediation) => remediation.remediationId
  );

  if (remediationIds.length === 0) {
    return snapshot;
  }

  const remediations = await prisma.remediationTask.findMany({
    include: {
      attackPath: {
        select: {
          evidenceBasis: true
        }
      }
    },
    where: {
      remediationId: { in: remediationIds },
      tenantId: context.tenant.tenantId
    }
  });
  const latestEvents = await prisma.verificationEvent.findMany({
    orderBy: {
      verifiedAt: "desc"
    },
    where: {
      remediationId: { in: remediationIds },
      tenantId: context.tenant.tenantId
    }
  });
  const latestByRemediation = new Map<string, (typeof latestEvents)[number]>();

  for (const event of latestEvents) {
    if (!latestByRemediation.has(event.remediationId)) {
      latestByRemediation.set(event.remediationId, event);
    }
  }

  const refreshedById = new Map(
    remediations.map((remediation) => [
      remediation.remediationId,
      serializeRemediationTask({
        ...remediation,
        latestVerificationEvent:
          latestByRemediation.get(remediation.remediationId) ?? null
      })
    ])
  );
  const remediationPriorities = snapshot.remediationPriorities.map(
    (remediation) => refreshedById.get(remediation.remediationId) ?? remediation
  );
  const evidenceIds = [
    ...new Set([
      ...snapshot.evidenceIds,
      ...remediationPriorities.flatMap((remediation) => remediation.evidenceIds)
    ])
  ];

  return {
    ...snapshot,
    evidenceIds,
    evidencePack: {
      ...snapshot.evidencePack,
      evidenceIds
    },
    remediationPriorities
  };
}

async function loadEvidencePackArtifacts(
  prisma: PrismaClient,
  tenantId: string,
  reportId: string
) {
  return prisma.evidenceArtifact.findMany({
    orderBy: {
      createdAt: "asc"
    },
    where: {
      relatedEntityId: reportId,
      relatedEntityType: "EvidencePack",
      tenantId
    }
  });
}

function isPdfReportExportArtifact(artifact: {
  artifactType: EvidenceArtifact["artifactType"];
  storageUri: string;
}) {
  return (
    artifact.artifactType === "ReportExport" &&
    artifact.storageUri.endsWith(".pdf")
  );
}

function isHtmlReportExportArtifact(artifact: {
  artifactType: EvidenceArtifact["artifactType"];
  storageUri: string;
}) {
  return (
    artifact.artifactType === "ReportExport" &&
    !isPdfReportExportArtifact(artifact)
  );
}

function getLatestMatchingArtifact<T>(
  artifacts: T[],
  matcher: (artifact: T) => boolean
) {
  return [...artifacts].reverse().find(matcher) ?? null;
}

function isAcceptedRiskAttestationEntry(
  value: unknown
): value is AcceptedRiskAttestationEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Record<string, unknown>;
  return (
    ["Pending", "Approved", "Expired"].includes(String(entry.approvalState)) &&
    typeof entry.evidenceId === "string" &&
    typeof entry.expiresAt === "string" &&
    typeof entry.findingId === "string" &&
    typeof entry.ownerLabel === "string" &&
    typeof entry.requestedByLabel === "string" &&
    typeof entry.updatedAt === "string"
  );
}

export async function loadEvidencePackRiskAcceptances(
  prisma: PrismaClient,
  tenantId: string,
  reportId: string
): Promise<AcceptedRiskAttestationEntry[]> {
  const artifacts = await loadEvidencePackArtifacts(prisma, tenantId, reportId);
  const riskArtifact = getLatestMatchingArtifact(
    artifacts,
    (artifact) =>
      artifact.artifactType === "NormalizedEvidence" &&
      artifact.storageUri.includes("accepted-risk-decisions")
  );

  if (!riskArtifact) {
    return [];
  }

  const evidenceService = createPrismaEvidenceService({ prisma });
  const stored = await evidenceService.getEvidenceArtifact(
    riskArtifact.evidenceId
  );

  if (!stored) {
    return [];
  }

  try {
    const payload = JSON.parse(stored.content) as { decisions?: unknown };
    return Array.isArray(payload.decisions)
      ? payload.decisions.filter(isAcceptedRiskAttestationEntry)
      : [];
  } catch {
    return [];
  }
}

export function getReportExportFilename(
  pack: EvidencePackRecord,
  format: ReportExportFormat
) {
  const slug = pack.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return `${slug || "periscan-evidence-pack"}.${format}`;
}

export async function loadEvidencePackHtml(
  prisma: PrismaClient,
  tenantId: string,
  reportId: string
) {
  const evidenceService = createPrismaEvidenceService({
    prisma
  });
  const artifacts = await loadEvidencePackArtifacts(prisma, tenantId, reportId);
  const htmlArtifact = getLatestMatchingArtifact(
    artifacts,
    isHtmlReportExportArtifact
  );

  if (!htmlArtifact) {
    return null;
  }

  const stored = await evidenceService.getEvidenceArtifact(
    htmlArtifact.evidenceId
  );

  if (!stored) {
    return null;
  }

  return {
    artifact: serializeEvidenceArtifact(htmlArtifact),
    html: stored.content
  };
}

export async function loadOrCreateEvidencePackPdf(input: {
  context: AuthenticatedContext;
  pack: EvidencePackRecord;
  prisma: PrismaClient;
}) {
  const evidenceService = createPrismaEvidenceService({
    prisma: input.prisma
  });
  const existingArtifacts = await loadEvidencePackArtifacts(
    input.prisma,
    input.context.tenant.tenantId,
    input.pack.evidencePackId
  );
  const existingPdfArtifact = getLatestMatchingArtifact(
    existingArtifacts,
    isPdfReportExportArtifact
  );

  if (existingPdfArtifact) {
    const stored = await evidenceService.getEvidenceArtifact(
      existingPdfArtifact.evidenceId
    );

    if (stored) {
      return {
        artifact: serializeEvidenceArtifact(existingPdfArtifact),
        pdf: stored.content
      };
    }
  }

  const snapshot = await loadSnapshotFromEvidencePack(
    input.prisma,
    input.context,
    input.pack
  );

  if (!snapshot) {
    return null;
  }

  const analystNote = await loadEvidencePackAnalystNote(
    input.prisma,
    input.context.tenant.tenantId,
    input.pack.evidencePackId
  );
  const riskAcceptances = await loadEvidencePackRiskAcceptances(
    input.prisma,
    input.context.tenant.tenantId,
    input.pack.evidencePackId
  );
  const pdf = renderValidationSnapshotReportPdf(snapshot, {
    analystNote,
    locale: await loadTenantPreferredLocale(
      input.prisma,
      input.context.tenant.tenantId
    ),
    packType: input.pack.packType,
    riskAcceptances
  });
  const stored = await evidenceService.putEvidenceArtifact({
    artifactType: "ReportExport",
    content: pdf,
    contentType: "application/pdf",
    filename: getReportExportFilename(input.pack, "pdf").replace(/\.pdf$/, ""),
    relatedEntityId: input.pack.evidencePackId,
    relatedEntityType: "EvidencePack",
    sensitivityLevel: input.pack.redactionLevel,
    tenantId: input.context.tenant.tenantId
  });

  return {
    artifact: stored.artifact,
    pdf: stored.content
  };
}

export async function loadTenantReportBranding(
  prisma: PrismaClient,
  tenantId: string
) {
  const branding = await prisma.tenantReportBranding.findUnique({
    where: {
      tenantId
    }
  });

  return branding
    ? serializeTenantReportBranding(branding)
    : defaultTenantReportBranding(tenantId);
}

export async function loadTenantPreferredLocale(
  prisma: PrismaClient,
  tenantId: string
) {
  const tenant = await prisma.tenant.findUnique({
    select: { preferredLocale: true },
    where: { tenantId }
  });

  return SupportedLocaleSchema.catch("en-US").parse(tenant?.preferredLocale);
}

export async function loadTenantDesignPartnerSettings(
  prisma: PrismaClient,
  tenantId: string
) {
  const settings = await prisma.tenantDesignPartnerSettings.findUnique({
    where: {
      tenantId
    }
  });

  return settings
    ? serializeTenantDesignPartnerSettings(settings)
    : defaultTenantDesignPartnerSettings(tenantId);
}

export async function loadSignalTriggerRoutingSettings(
  prisma: PrismaClient,
  tenantId: string
) {
  const settings = await prisma.signalTriggerRoutingSettings.findUnique({
    where: {
      tenantId
    }
  });

  return settings
    ? serializeSignalTriggerRoutingSettings(settings)
    : defaultSignalTriggerRoutingSettings(tenantId);
}

export async function resolveSignalTriggerRoutingIntegrationIds(
  prisma: PrismaClient,
  tenantId: string,
  settings: SignalTriggerRoutingSettings
) {
  const configuredIds = uniqueSignalTriggerValues([
    ...settings.workflowDestinationIntegrationIds,
    ...settings.notificationIntegrationIds
  ]);

  if (configuredIds.length === 0) {
    return {
      notificationIntegrationIds: [],
      workflowDestinationIntegrationIds: []
    };
  }

  const connectedIntegrations = await prisma.integration.findMany({
    select: {
      integrationId: true
    },
    where: {
      category: {
        in: ["Ticketing", "MSSP"]
      },
      integrationId: {
        in: configuredIds
      },
      status: "Connected",
      tenantId
    }
  });
  const connectedIds = new Set(
    connectedIntegrations.map((integration) => integration.integrationId)
  );

  return {
    notificationIntegrationIds: settings.notificationIntegrationIds.filter(
      (integrationId) => connectedIds.has(integrationId)
    ),
    workflowDestinationIntegrationIds:
      settings.workflowDestinationIntegrationIds.filter((integrationId) =>
        connectedIds.has(integrationId)
      )
  };
}

export async function assertSignalTriggerRoutingIntegrations(
  prisma: PrismaClient,
  tenantId: string,
  integrationIds: string[]
) {
  const uniqueIds = uniqueSignalTriggerValues(integrationIds);

  if (uniqueIds.length === 0) {
    return;
  }

  const connectedIntegrations = await prisma.integration.findMany({
    select: {
      integrationId: true
    },
    where: {
      category: {
        in: ["Ticketing", "MSSP"]
      },
      integrationId: {
        in: uniqueIds
      },
      status: "Connected",
      tenantId
    }
  });
  const connectedIds = new Set(
    connectedIntegrations.map((integration) => integration.integrationId)
  );
  const missingIds = uniqueIds.filter(
    (integrationId) => !connectedIds.has(integrationId)
  );

  if (missingIds.length > 0) {
    throw new AppServiceError(
      "Signal-trigger routing integrations must be connected workflow destinations for this tenant.",
      400,
      "routing_integration_not_connected"
    );
  }
}

export async function deliverSignalTriggerRouting(input: {
  integrationIds: string[];
  prisma: PrismaClient;
  tenantId: string;
  workflowEvent: Record<string, unknown>;
}): Promise<SignalTriggerRoutingDecision["deliveries"]> {
  const uniqueIds = uniqueSignalTriggerValues(input.integrationIds);

  if (uniqueIds.length === 0) {
    return [];
  }

  const integrations = await input.prisma.integration.findMany({
    where: {
      category: {
        in: ["Ticketing", "MSSP"]
      },
      integrationId: {
        in: uniqueIds
      },
      status: "Connected",
      tenantId: input.tenantId
    }
  });
  const integrationsById = new Map(
    integrations.map((integration) => [integration.integrationId, integration])
  );

  return Promise.all(
    uniqueIds.map(async (integrationId) => {
      const integration = integrationsById.get(integrationId);
      const config =
        integration &&
        typeof integration.config === "object" &&
        integration.config
          ? (integration.config as Record<string, unknown>)
          : {};
      const connectorKey = getConnectorKey(config);
      const connector = connectorKey ? getConnectorByKey(connectorKey) : null;

      if (!integration || !connector?.sendWorkflowEvent) {
        return {
          connectorKey,
          deliveredAt: null,
          detail:
            "Configured workflow destination is unavailable or does not support delivery.",
          integrationId,
          status: "Skipped" as const
        };
      }

      try {
        const result = await connector.sendWorkflowEvent({
          authType: integration.authType,
          config: {
            ...config,
            workflowEvent: input.workflowEvent
          },
          integrationId,
          mockMode: isMockMode(config),
          tenantId: input.tenantId
        });
        const status =
          result.status === "Delivered"
            ? "Delivered"
            : result.status === "Skipped"
              ? "Skipped"
              : "Failed";

        return {
          connectorKey,
          deliveredAt:
            typeof result.deliveredAt === "string" ? result.deliveredAt : null,
          detail:
            typeof result.detail === "string"
              ? result.detail
              : status === "Delivered"
                ? "Workflow notification delivered."
                : "Workflow notification was not delivered.",
          integrationId,
          status
        };
      } catch {
        return {
          connectorKey,
          deliveredAt: null,
          detail: "Workflow notification failed without exposing credentials.",
          integrationId,
          status: "Failed" as const
        };
      }
    })
  );
}

export async function loadEvidencePackAnalystNote(
  prisma: PrismaClient,
  tenantId: string,
  reportId: string
) {
  const note = await prisma.evidencePackAnalystNote.findFirst({
    where: {
      evidencePackId: reportId,
      tenantId
    }
  });

  return note ? serializeDesignPartnerReportNote(note) : null;
}

// Canonical billing month window (UTC) — the single source of truth for "this
// month" so /billing/usage and /billing/limits never disagree.
export function getMeteringPeriod(reference = new Date()) {
  const meteringPeriodStart = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1)
  );
  const meteringPeriodEnd = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 1)
  );

  return {
    meteringPeriodEnd,
    meteringPeriodStart
  };
}

const RUNNER_TASK_EXPIRED_SUMMARY =
  "Runner task expired before completion (no result received).";

// Reap runner tasks that blew past their deadline WITHOUT being reported, and
// fail the validation run they belonged to so it does not hang forever. The
// per-runner poll reaper only runs when THAT runner polls — but a task gets
// stuck precisely when its runner dies and stops polling, so a system-wide
// reaper (driven by the continuous-validation sweep) is required to reclaim
// tasks from dead/silent runners.
export async function expireStaleRunnerTasks(
  prisma: PrismaClient,
  now: Date = new Date()
): Promise<{ expiredTaskCount: number; failedRunCount: number }> {
  const staleTasks = await prisma.runnerTask.findMany({
    select: {
      missionId: true,
      runId: true,
      taskId: true
    },
    where: {
      expiresAt: {
        lte: now
      },
      status: {
        in: ["Queued", "Leased", "Running", "Accepted"]
      }
    }
  });

  if (staleTasks.length === 0) {
    return { expiredTaskCount: 0, failedRunCount: 0 };
  }

  // CAS on status: never overwrite Completed/Failed/Expired that landed between
  // findMany and updateMany (runner result submit TOCTOU). Without this, a
  // completed measured task can be clobbered to Expired while remediation may
  // already be Fixed — or a late submit can race the other direction.
  const expiredTasks = await prisma.runnerTask.updateMany({
    data: {
      completedAt: now,
      errorSummary: RUNNER_TASK_EXPIRED_SUMMARY,
      status: "Expired"
    },
    where: {
      status: {
        in: ["Queued", "Leased", "Running", "Accepted"]
      },
      taskId: {
        in: staleTasks.map((task) => task.taskId)
      }
    }
  });

  // Only non-terminal runs are failed — a run that already reported a result is
  // left untouched.
  const failedRuns = await prisma.validationRun.updateMany({
    data: {
      completedAt: now,
      errorSummary: RUNNER_TASK_EXPIRED_SUMMARY,
      status: "Failed"
    },
    where: {
      runId: {
        in: [...new Set(staleTasks.map((task) => task.runId))]
      },
      status: {
        in: ["Queued", "Running"]
      }
    }
  });

  // Hybrid / multi-run missions: failing expired runs must close (or keep open)
  // the parent mission from the sibling aggregate. Otherwise a dead runner leaves
  // missions stuck Queued/Running forever after all child runs are Failed.
  const { reconcileMissionAggregateFromRuns } = await import(
    "./mission-run-aggregate.js"
  );
  const { withMissionRunAggregateLock } = await import(
    "./mission-run-aggregate-lock.js"
  );
  const missionIds = [
    ...new Set(
      staleTasks
        .map((task) => task.missionId)
        .filter((missionId): missionId is string => Boolean(missionId))
    )
  ];
  for (const missionId of missionIds) {
    await withMissionRunAggregateLock(prisma, missionId, async (tx) => {
      const siblingRuns = await tx.validationRun.findMany({
        select: {
          evidenceIds: true,
          status: true
        },
        where: { missionId }
      });
      const aggregate = reconcileMissionAggregateFromRuns(siblingRuns);
      // Do not overwrite an already-terminal mission (Completed must not flip to
      // Failed via expiry races — complements reaper status CAS in draft #59).
      await tx.validationMission.updateMany({
        data: {
          completedAt: aggregate.completedAt,
          evidenceIds: aggregate.evidenceIds,
          status: aggregate.status
        },
        where: {
          missionId,
          status: {
            in: ["Draft", "Queued", "Running", "RequiresApproval"]
          }
        }
      });
    });
  }

  return {
    expiredTaskCount: expiredTasks.count,
    failedRunCount: failedRuns.count
  };
}

const DEFAULT_RUNNER_STALE_TIMEOUT_MS = 15 * 60 * 1000;

function getRunnerStaleTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const parsed = Number(env.PERISCAN_RUNNER_STALE_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_RUNNER_STALE_TIMEOUT_MS;
}

// Mark runners that should be live (Active/Degraded) but have not polled within
// the staleness window as Offline. The control plane stamps lastSeenAt on every
// poll but never derives Offline from silence, so a dead/disconnected runner
// would otherwise read Active forever. Mirrors expireStaleRunnerTasks (global,
// idempotent, returns a count). Recovery is automatic: a runner's next poll
// sets its status back to Active, so Offline is never sticky. Runners that have
// never been seen (lastSeenAt null) are left alone — there is no silence signal
// yet. Kill-switched / revoked runners keep their own status (not in scope).
export async function markStaleRunnersOffline(
  prisma: PrismaClient,
  now: Date = new Date(),
  env: NodeJS.ProcessEnv = process.env
): Promise<{ offlinedRunnerCount: number }> {
  const threshold = new Date(now.getTime() - getRunnerStaleTimeoutMs(env));
  const result = await prisma.runner.updateMany({
    data: {
      status: "Offline"
    },
    where: {
      lastSeenAt: {
        lte: threshold,
        not: null
      },
      status: {
        in: ["Active", "Degraded"]
      }
    }
  });

  return { offlinedRunnerCount: result.count };
}

const JOB_STUCK_SUMMARY =
  "Validation job exceeded its execution window (worker did not report completion).";
const DEFAULT_JOB_STUCK_TIMEOUT_MS = 30 * 60 * 1000;

function getJobStuckTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const parsed = Number(env.PERISCAN_JOB_STUCK_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_JOB_STUCK_TIMEOUT_MS;
}

// Fail jobs that have sat in `Running` past their execution window — a worker
// that crashes mid-job never calls markCompleted/markFailed, so the job and its
// validation run would otherwise hang forever. Parallel to expireStaleRunnerTasks
// (which covers the runner-task path); this covers the worker/control-plane path.
export async function failStuckRunningJobs(
  prisma: PrismaClient,
  now: Date = new Date(),
  env: NodeJS.ProcessEnv = process.env
): Promise<{ failedJobCount: number; failedRunCount: number }> {
  const threshold = new Date(now.getTime() - getJobStuckTimeoutMs(env));
  const stuckJobs = await prisma.job.findMany({
    select: {
      jobId: true,
      missionId: true,
      validationRunId: true
    },
    where: {
      startedAt: {
        lte: threshold
      },
      status: "Running"
    }
  });

  if (stuckJobs.length === 0) {
    return { failedJobCount: 0, failedRunCount: 0 };
  }

  // CAS on status: a worker that completed between findMany and updateMany must
  // not have its Completed job overwritten to Failed.
  const failedJobs = await prisma.job.updateMany({
    data: {
      completedAt: now,
      errorMessage: JOB_STUCK_SUMMARY,
      status: "Failed"
    },
    where: {
      jobId: {
        in: stuckJobs.map((job) => job.jobId)
      },
      status: "Running"
    }
  });

  const runIds = [
    ...new Set(
      stuckJobs
        .map((job) => job.validationRunId)
        .filter((runId): runId is string => Boolean(runId))
    )
  ];
  const failedRuns =
    runIds.length > 0
      ? await prisma.validationRun.updateMany({
          data: {
            completedAt: now,
            errorSummary: JOB_STUCK_SUMMARY,
            status: "Failed"
          },
          where: {
            runId: {
              in: runIds
            },
            status: {
              in: ["Queued", "Running"]
            }
          }
        })
      : { count: 0 };

  // Multi-run missions: stuck-job failures must reconcile the parent mission or
  // it stays Queued/Running after every child run is already Failed.
  const missionIds = [
    ...new Set(
      stuckJobs
        .map((job) => job.missionId)
        .filter((missionId): missionId is string => Boolean(missionId))
    )
  ];
  if (missionIds.length > 0) {
    const { reconcileMissionAggregateFromRuns } = await import(
      "./mission-run-aggregate.js"
    );
    const { withMissionRunAggregateLock } = await import(
      "./mission-run-aggregate-lock.js"
    );
    for (const missionId of missionIds) {
      await withMissionRunAggregateLock(prisma, missionId, async (tx) => {
        const siblingRuns = await tx.validationRun.findMany({
          select: {
            evidenceIds: true,
            status: true
          },
          where: { missionId }
        });
        const aggregate = reconcileMissionAggregateFromRuns(siblingRuns);
        await tx.validationMission.updateMany({
          data: {
            completedAt: aggregate.completedAt,
            evidenceIds: aggregate.evidenceIds,
            status: aggregate.status
          },
          where: {
            missionId,
            status: {
              in: ["Draft", "Queued", "Running", "RequiresApproval"]
            }
          }
        });
      });
    }
  }

  return {
    failedJobCount: failedJobs.count,
    failedRunCount: failedRuns.count
  };
}

function createUsageMeter(
  meterName: UsageMeterName,
  quantity: number,
  measuredAt: Date
): UsageMeter {
  const definition = USAGE_METER_DEFINITIONS.find(
    (candidate) => candidate.meterName === meterName
  );

  if (!definition) {
    throw new Error(`Unknown usage meter: ${meterName}`);
  }

  return {
    ...definition,
    measuredAt: measuredAt.toISOString(),
    quantity
  };
}

async function calculateRunnerMinutes(
  prisma: PrismaClient,
  tenantId: string,
  period?: { meteringPeriodEnd: Date; meteringPeriodStart: Date }
) {
  const runs = await prisma.validationRun.findMany({
    select: {
      completedAt: true,
      startedAt: true
    },
    where: {
      // Consumption is billed per period: only count minutes from runs that
      // completed within the current metering window.
      ...(period
        ? {
            completedAt: {
              gte: period.meteringPeriodStart,
              lt: period.meteringPeriodEnd
            }
          }
        : {
            completedAt: {
              not: null
            }
          }),
      runnerId: {
        not: null
      },
      startedAt: {
        not: null
      },
      status: "Completed",
      tenantId
    }
  });

  return runs.reduce((total, run) => {
    if (!run.startedAt || !run.completedAt) {
      return total;
    }

    const elapsedMs = Math.max(
      0,
      run.completedAt.getTime() - run.startedAt.getTime()
    );

    return total + Math.ceil(elapsedMs / 60_000);
  }, 0);
}

export async function buildBillingUsage(
  prisma: PrismaClient,
  tenant: Pick<Tenant, "billingAccountId" | "tenantId" | "type">,
  period?: { meteringPeriodEnd: Date; meteringPeriodStart: Date }
): Promise<BillingUsage> {
  const measuredAt = period?.meteringPeriodEnd ?? new Date();
  const { meteringPeriodEnd, meteringPeriodStart } =
    period ?? getMeteringPeriod(measuredAt);
  // Consumption meters (missions, runs, evidence packs, runner minutes, API
  // usage) bill per metering period, so they must only count activity within
  // the current period — not all-time, which would over-bill every month. The
  // createdAt window matches the declared meteringPeriodStart/End.
  const periodWindow = {
    gte: meteringPeriodStart,
    lt: meteringPeriodEnd
  };
  const [
    assets,
    identities,
    controlSources,
    aiApplications,
    validationMissions,
    validationRuns,
    runnerMinutes,
    evidencePacks,
    clientTenants,
    apiUsage
  ] = await Promise.all([
    // Inventory meters: current totals (how many resources the tenant has now).
    prisma.asset.count({
      where: {
        tenantId: tenant.tenantId
      }
    }),
    prisma.identity.count({
      where: {
        tenantId: tenant.tenantId
      }
    }),
    prisma.controlSource.count({
      where: {
        tenantId: tenant.tenantId
      }
    }),
    prisma.aIApplication.count({
      where: {
        tenantId: tenant.tenantId
      }
    }),
    // Consumption meters: scoped to the current metering period.
    prisma.validationMission.count({
      where: {
        createdAt: periodWindow,
        tenantId: tenant.tenantId
      }
    }),
    prisma.validationRun.count({
      where: {
        createdAt: periodWindow,
        tenantId: tenant.tenantId
      }
    }),
    calculateRunnerMinutes(prisma, tenant.tenantId, {
      meteringPeriodEnd,
      meteringPeriodStart
    }),
    prisma.evidencePack.count({
      where: {
        createdAt: periodWindow,
        tenantId: tenant.tenantId
      }
    }),
    tenant.type === "MSSP"
      ? prisma.tenant.count({
          where: {
            parentTenantId: tenant.tenantId,
            type: "Client"
          }
        })
      : Promise.resolve(0),
    prisma.auditEvent.count({
      where: {
        createdAt: periodWindow,
        tenantId: tenant.tenantId
      }
    })
  ]);
  const evidenceRetentionDays = getEvidenceRetentionDays() ?? 0;

  return {
    billingAccountId: tenant.billingAccountId,
    meteringPeriodEnd: meteringPeriodEnd.toISOString(),
    meteringPeriodStart: meteringPeriodStart.toISOString(),
    meters: [
      createUsageMeter("ValidatedAssets", assets, measuredAt),
      createUsageMeter("Identities", identities, measuredAt),
      createUsageMeter("ControlSources", controlSources, measuredAt),
      createUsageMeter("AIApplications", aiApplications, measuredAt),
      createUsageMeter("ValidationMissions", validationMissions, measuredAt),
      createUsageMeter("ValidationRuns", validationRuns, measuredAt),
      createUsageMeter("RunnerMinutes", runnerMinutes, measuredAt),
      createUsageMeter("EvidencePacks", evidencePacks, measuredAt),
      createUsageMeter("EvidenceRetention", evidenceRetentionDays, measuredAt),
      createUsageMeter("ClientTenants", clientTenants, measuredAt),
      createUsageMeter("APIUsage", apiUsage, measuredAt)
    ],
    tenantId: tenant.tenantId
  };
}

function classifyClientReadiness(input: {
  connectedIntegrations: number;
  criticalPaths: number;
  highPaths: number;
  openRemediations: number;
  totalValidationRuns: number;
  unhealthyIntegrations: number;
  verifiedScopes: number;
  evidencePacks: number;
  missingProofInputs: number;
}): ClientPortfolioReadinessStatus {
  if (input.verifiedScopes === 0) {
    return "NeedsScope";
  }

  if (input.connectedIntegrations === 0) {
    return "NeedsIntegration";
  }

  if (input.totalValidationRuns === 0 && input.evidencePacks === 0) {
    return "NeedsValidation";
  }

  if (
    input.criticalPaths > 0 ||
    input.highPaths > 0 ||
    input.openRemediations > 0 ||
    input.missingProofInputs > 0 ||
    input.unhealthyIntegrations > 0
  ) {
    return "Attention";
  }

  return "Active";
}

function countMeter(usage: BillingUsage, meterName: UsageMeterName) {
  return (
    usage.meters.find((meter) => meter.meterName === meterName)?.quantity ?? 0
  );
}

async function buildClientPortfolioSummary(
  prisma: PrismaClient,
  tenant: Tenant
): Promise<ClientPortfolioSummary> {
  const [
    totalScopes,
    verifiedScopes,
    connectedIntegrations,
    healthyIntegrations,
    unhealthyIntegrations,
    controlSources,
    aiApplications,
    runners,
    missingProofInputs,
    attackPaths,
    openRemediations,
    verificationPending,
    latestSnapshot,
    latestReport,
    latestRun,
    lifetimeValidationRuns,
    lifetimeEvidencePacks,
    usage,
    branding
  ] = await Promise.all([
    prisma.scope.count({
      where: {
        tenantId: tenant.tenantId
      }
    }),
    prisma.scope.count({
      where: {
        tenantId: tenant.tenantId,
        verificationStatus: "Verified"
      }
    }),
    prisma.integration.count({
      where: {
        tenantId: tenant.tenantId
      }
    }),
    prisma.integration.count({
      where: {
        healthStatus: "Healthy",
        tenantId: tenant.tenantId
      }
    }),
    prisma.integration.count({
      where: {
        healthStatus: {
          in: ["Degraded", "Unhealthy"]
        },
        tenantId: tenant.tenantId
      }
    }),
    prisma.controlSource.count({
      where: {
        tenantId: tenant.tenantId
      }
    }),
    prisma.aIApplication.count({
      where: {
        tenantId: tenant.tenantId
      }
    }),
    prisma.runner.count({
      where: {
        tenantId: tenant.tenantId
      }
    }),
    prisma.missingSignal.count({
      where: {
        status: {
          in: [...CONFIDENCE_REDUCING_MISSING_SIGNAL_STATUSES]
        },
        tenantId: tenant.tenantId
      }
    }),
    // Load paths with relations so risk bands are computed via the CANONICAL
    // assessAttackPathRisk (validation-adjusted score) — matching the snapshot
    // and attack-path views — instead of a divergent raw-impactScore bucketing.
    prisma.attackPath.findMany({
      include: {
        pathBreakers: {
          orderBy: {
            priority: "asc"
          }
        },
        pathEdges: {
          orderBy: {
            createdAt: "asc"
          }
        },
        pathNodes: {
          orderBy: {
            sequence: "asc"
          }
        }
      },
      where: {
        tenantId: tenant.tenantId
      }
    }),
    prisma.remediationTask.count({
      where: {
        status: {
          in: [
            "Open",
            "InProgress",
            "PartiallyFixed",
            "StillExposed",
            "Inconclusive",
            "Reopened",
            "ClosedWithoutEvidence"
          ]
        },
        tenantId: tenant.tenantId
      }
    }),
    prisma.remediationTask.count({
      where: {
        status: "VerificationPending",
        tenantId: tenant.tenantId
      }
    }),
    prisma.validationMission.findFirst({
      orderBy: {
        createdAt: "desc"
      },
      select: {
        createdAt: true,
        missionId: true
      },
      where: {
        missionType: "ValidationSnapshot",
        tenantId: tenant.tenantId
      }
    }),
    prisma.evidencePack.findFirst({
      orderBy: {
        createdAt: "desc"
      },
      select: {
        createdAt: true,
        evidencePackId: true
      },
      where: {
        tenantId: tenant.tenantId
      }
    }),
    prisma.validationRun.findFirst({
      orderBy: {
        createdAt: "desc"
      },
      select: {
        createdAt: true
      },
      where: {
        tenantId: tenant.tenantId
      }
    }),
    // Lifetime counts for the portfolio HEALTH view. These must NOT come from
    // billing usage (which is scoped to the current metering period) — a client
    // that validated last month is still past the "NeedsValidation" stage and
    // should not be demoted to it every billing rollover.
    prisma.validationRun.count({
      where: {
        tenantId: tenant.tenantId
      }
    }),
    prisma.evidencePack.count({
      where: {
        tenantId: tenant.tenantId
      }
    }),
    buildBillingUsage(prisma, tenant),
    loadTenantReportBranding(prisma, tenant.tenantId)
  ]);
  const evidencePacks = lifetimeEvidencePacks;
  const totalValidationRuns = lifetimeValidationRuns;
  // Canonical risk bands (same scoring used by the snapshot/attack-path views),
  // so the portfolio severity roll-up is consistent across surfaces.
  const pathBands = attackPaths.map(
    (path) => assessAttackPathRisk(serializeAttackPath(path)).risk.band
  );
  const criticalPaths = pathBands.filter((band) => band === "Critical").length;
  const highPaths = pathBands.filter((band) => band === "High").length;
  const mediumPaths = pathBands.filter((band) => band === "Medium").length;
  const lowPaths = pathBands.filter((band) => band === "Low").length;
  const fixedPaths = pathBands.filter((band) => band === "Fixed").length;

  return {
    branding,
    coverage: {
      aiApplications,
      connectedIntegrations,
      controlSources,
      healthyIntegrations,
      missingProofInputs,
      runners,
      totalScopes,
      unhealthyIntegrations,
      verifiedScopes
    },
    latestActivity: {
      latestEvidencePackAt: latestReport?.createdAt.toISOString() ?? null,
      latestReportId: latestReport?.evidencePackId ?? null,
      latestSnapshotAt: latestSnapshot?.createdAt.toISOString() ?? null,
      latestSnapshotId: latestSnapshot?.missionId ?? null,
      latestValidationRunAt: latestRun?.createdAt.toISOString() ?? null
    },
    readinessStatus: classifyClientReadiness({
      connectedIntegrations,
      criticalPaths,
      evidencePacks,
      highPaths,
      missingProofInputs,
      openRemediations,
      totalValidationRuns,
      unhealthyIntegrations,
      verifiedScopes
    }),
    risk: {
      criticalPaths,
      fixedPaths,
      highPaths,
      lowPaths,
      mediumPaths,
      openRemediations,
      verificationPending
    },
    tenant,
    usage
  };
}

export async function buildMSSPClientPortfolio(
  prisma: PrismaClient,
  context: AuthenticatedContext
): Promise<MSSPClientPortfolio> {
  requireRole(
    context.membership.role,
    MSSP_ADMIN_ROLES,
    "view MSSP client portfolio"
  );

  if (context.tenant.type !== "MSSP") {
    throw new AppServiceError(
      "Only MSSP tenants can view the client portfolio.",
      400,
      "mssp_tenant_required"
    );
  }

  const clients = await prisma.tenant.findMany({
    orderBy: {
      name: "asc"
    },
    where: {
      parentTenantId: context.tenant.tenantId,
      type: "Client"
    }
  });
  const clientSummaries = await Promise.all(
    clients.map((client) =>
      buildClientPortfolioSummary(prisma, serializeTenant(client))
    )
  );

  return {
    clients: clientSummaries,
    generatedAt: new Date().toISOString(),
    parentTenant: context.tenant,
    totals: {
      activeClients: clientSummaries.filter(
        (client) => client.readinessStatus === "Active"
      ).length,
      attentionClients: clientSummaries.filter(
        (client) => client.readinessStatus === "Attention"
      ).length,
      clientTenants: clientSummaries.length,
      evidencePacks: clientSummaries.reduce(
        (total, client) => total + countMeter(client.usage, "EvidencePacks"),
        0
      ),
      needsIntegrationClients: clientSummaries.filter(
        (client) => client.readinessStatus === "NeedsIntegration"
      ).length,
      needsScopeClients: clientSummaries.filter(
        (client) => client.readinessStatus === "NeedsScope"
      ).length,
      needsValidationClients: clientSummaries.filter(
        (client) => client.readinessStatus === "NeedsValidation"
      ).length,
      openRemediations: clientSummaries.reduce(
        (total, client) => total + client.risk.openRemediations,
        0
      ),
      validationRuns: clientSummaries.reduce(
        (total, client) => total + countMeter(client.usage, "ValidationRuns"),
        0
      ),
      verifiedScopes: clientSummaries.reduce(
        (total, client) => total + client.coverage.verifiedScopes,
        0
      ),
      missingProofInputs: clientSummaries.reduce(
        (total, client) => total + client.coverage.missingProofInputs,
        0
      ),
      // 3.13: co-managed short-term assessment packs surfaced in MSSP portfolio for licensing/views
      shortTermAssessments: clientSummaries.reduce(
        (total, client) =>
          total + countMeter(client.usage, "ShortTermAssessments"),
        0
      )
    }
  };
}

export async function loadAcceptedRiskAttestationEntries(input: {
  evidenceId: string;
  prisma: PrismaClient;
  tenantId: string;
}): Promise<AcceptedRiskAttestationEntry[]> {
  const decisions = await input.prisma.findingDisposition.findMany({
    orderBy: { updatedAt: "desc" },
    where: {
      disposition: "AcceptedRisk",
      tenantId: input.tenantId
    }
  });
  const userIds = [
    ...new Set(
      decisions.flatMap((decision) =>
        [decision.ownerId, decision.updatedBy, decision.approvedBy].filter(
          (userId): userId is string => Boolean(userId)
        )
      )
    )
  ];
  const users = await input.prisma.user.findMany({
    select: { name: true, userId: true },
    where: { userId: { in: userIds } }
  });
  const userNameById = new Map(users.map((user) => [user.userId, user.name]));
  const now = Date.now();
  const label = (userId: string | null) =>
    userId
      ? (userNameById.get(userId) ?? `User ${userId.slice(0, 8)}`)
      : "Unassigned";

  return decisions.flatMap((decision): AcceptedRiskAttestationEntry[] => {
    if (!decision.ownerId || !decision.expiresAt) {
      return [];
    }

    return [
      {
        approvalState:
          decision.expiresAt.getTime() <= now
            ? "Expired"
            : decision.approvedAt
              ? "Approved"
              : "Pending",
        approvedAt: decision.approvedAt?.toISOString() ?? null,
        approvedByLabel: decision.approvedBy
          ? label(decision.approvedBy)
          : null,
        evidenceId: input.evidenceId,
        expiresAt: decision.expiresAt.toISOString(),
        findingId: decision.findingId,
        note: decision.note,
        ownerLabel: label(decision.ownerId),
        requestedByLabel: label(decision.updatedBy),
        updatedAt: decision.updatedAt.toISOString()
      }
    ];
  });
}

export async function createReportPackFromSnapshot(input: {
  audience?: string;
  context: AuthenticatedContext;
  packType?: EvidencePack["packType"];
  prisma: PrismaClient;
  snapshot: ValidationSnapshot;
  title?: string;
}): Promise<EvidencePack> {
  const evidenceService = createPrismaEvidenceService({
    prisma: input.prisma
  });
  const htmlEvidenceId = randomUUID();
  const jsonEvidenceId = randomUUID();
  const packType = input.packType ?? input.snapshot.evidencePack.packType;
  const acceptedRiskEvidenceId = packType.endsWith("Attestation")
    ? randomUUID()
    : null;
  const riskAcceptances = acceptedRiskEvidenceId
    ? await loadAcceptedRiskAttestationEntries({
        evidenceId: acceptedRiskEvidenceId,
        prisma: input.prisma,
        tenantId: input.context.tenant.tenantId
      })
    : [];
  const report = await input.prisma.evidencePack.create({
    data: {
      audience: input.audience ?? input.snapshot.evidencePack.audience,
      evidenceIds: [
        ...new Set([
          ...input.snapshot.evidenceIds,
          htmlEvidenceId,
          jsonEvidenceId,
          ...(acceptedRiskEvidenceId ? [acceptedRiskEvidenceId] : [])
        ])
      ],
      packType,
      redactionLevel: input.snapshot.evidencePack.redactionLevel,
      status: "Draft",
      tenantId: input.context.tenant.tenantId,
      title: input.title ?? input.snapshot.evidencePack.title
    }
  });
  const [branding, locale] = await Promise.all([
    loadTenantReportBranding(input.prisma, input.context.tenant.tenantId),
    loadTenantPreferredLocale(input.prisma, input.context.tenant.tenantId)
  ]);
  const reportHtml = renderValidationSnapshotReportHtml(
    {
      ...input.snapshot,
      evidencePack: serializeEvidencePack(report)
    },
    {
      branding,
      ctemProgram:
        packType === "CTEMProgramSummary"
          ? buildCTEMProgramSummary(input.snapshot)
          : null,
      packType,
      locale,
      riskAcceptances
    }
  );
  const htmlArtifact = await evidenceService.putEvidenceArtifact({
    artifactType: "ReportExport",
    content: reportHtml,
    contentType: "text/html",
    evidenceId: htmlEvidenceId,
    filename: "validation-snapshot-report",
    relatedEntityId: report.evidencePackId,
    relatedEntityType: "EvidencePack",
    sensitivityLevel: "Moderate",
    tenantId: input.context.tenant.tenantId
  });

  await evidenceService.putEvidenceArtifact({
    artifactType: "NormalizedEvidence",
    content: input.snapshot,
    contentType: "application/json",
    evidenceId: jsonEvidenceId,
    filename: "validation-snapshot",
    relatedEntityId: report.evidencePackId,
    relatedEntityType: "EvidencePack",
    sensitivityLevel: "Moderate",
    tenantId: input.context.tenant.tenantId
  });

  if (acceptedRiskEvidenceId) {
    await evidenceService.putEvidenceArtifact({
      artifactType: "NormalizedEvidence",
      content: {
        capturedAt: new Date().toISOString(),
        decisions: riskAcceptances
      },
      contentType: "application/json",
      evidenceId: acceptedRiskEvidenceId,
      filename: "accepted-risk-decisions",
      relatedEntityId: report.evidencePackId,
      relatedEntityType: "EvidencePack",
      sensitivityLevel: "Moderate",
      tenantId: input.context.tenant.tenantId
    });
  }

  const finalized = await input.prisma.evidencePack.update({
    where: {
      evidencePackId: report.evidencePackId
    },
    data: {
      status: "Ready",
      storageUri: htmlArtifact.artifact.storageUri
    }
  });

  await writeAuditEvent(input.prisma, {
    action: "report.generated",
    actorType: "System",
    entityId: finalized.evidencePackId,
    entityType: "EvidencePack",
    metadata: {
      sourceSnapshotId: input.snapshot.snapshotId
    },
    tenantId: input.context.tenant.tenantId,
    userId: input.context.user.userId
  });

  return serializeEvidencePack(finalized);
}

export async function rebuildEvidencePackRenderArtifacts(input: {
  context: AuthenticatedContext;
  pack: EvidencePackRecord;
  prisma: PrismaClient;
}) {
  const snapshot = await loadSnapshotFromEvidencePack(
    input.prisma,
    input.context,
    input.pack
  );

  if (!snapshot) {
    throw new AppServiceError("Report not found.", 404, "report_not_found");
  }

  const [branding, locale] = await Promise.all([
    loadTenantReportBranding(input.prisma, input.context.tenant.tenantId),
    loadTenantPreferredLocale(input.prisma, input.context.tenant.tenantId)
  ]);
  const analystNote = await loadEvidencePackAnalystNote(
    input.prisma,
    input.context.tenant.tenantId,
    input.pack.evidencePackId
  );
  const evidenceService = createPrismaEvidenceService({
    prisma: input.prisma
  });
  const riskAcceptances = await loadEvidencePackRiskAcceptances(
    input.prisma,
    input.context.tenant.tenantId,
    input.pack.evidencePackId
  );
  const renderedSnapshot = {
    ...snapshot,
    evidencePack: serializeEvidencePack(input.pack)
  };
  const html = renderValidationSnapshotReportHtml(renderedSnapshot, {
    analystNote,
    branding,
    locale,
    ctemProgram:
      input.pack.packType === "CTEMProgramSummary"
        ? buildCTEMProgramSummary(snapshot)
        : null,
    packType: input.pack.packType,
    riskAcceptances
  });
  const pdf = renderValidationSnapshotReportPdf(renderedSnapshot, {
    analystNote,
    locale,
    packType: input.pack.packType,
    riskAcceptances
  });
  const htmlArtifact = await evidenceService.putEvidenceArtifact({
    artifactType: "ReportExport",
    content: html,
    contentType: "text/html",
    filename: "validation-snapshot-report",
    relatedEntityId: input.pack.evidencePackId,
    relatedEntityType: "EvidencePack",
    sensitivityLevel: input.pack.redactionLevel,
    tenantId: input.context.tenant.tenantId
  });
  const pdfArtifact = await evidenceService.putEvidenceArtifact({
    artifactType: "ReportExport",
    content: pdf,
    contentType: "application/pdf",
    filename: getReportExportFilename(input.pack, "pdf").replace(/\.pdf$/, ""),
    relatedEntityId: input.pack.evidencePackId,
    relatedEntityType: "EvidencePack",
    sensitivityLevel: input.pack.redactionLevel,
    tenantId: input.context.tenant.tenantId
  });
  const updatedPack = await input.prisma.evidencePack.update({
    where: {
      evidencePackId: input.pack.evidencePackId
    },
    data: {
      evidenceIds: [
        ...new Set([
          ...input.pack.evidenceIds,
          htmlArtifact.artifact.evidenceId,
          pdfArtifact.artifact.evidenceId
        ])
      ],
      storageUri: htmlArtifact.artifact.storageUri
    }
  });

  return {
    analystNote,
    pack: serializeEvidencePack(updatedPack)
  };
}

function toChecklistStatus(value: boolean): "Complete" | "Pending" {
  return value ? "Complete" : "Pending";
}

const DESIGN_PARTNER_SESSIONS_REQUIRED = 5 as const;

export function buildDesignPartnerSessionLearning(
  sessions: DesignPartnerSessionNote[]
): DesignPartnerSessionLearning {
  const sessionCount = sessions.length;
  const sessionsGateMet = sessionCount >= DESIGN_PARTNER_SESSIONS_REQUIRED;
  return {
    message: sessionsGateMet
      ? `Internal session notes logged (${sessionCount}/${DESIGN_PARTNER_SESSIONS_REQUIRED}). Need external reference consent before Wave market presence — product still reports waveMarketPresenceReady: false.`
      : `Need ${DESIGN_PARTNER_SESSIONS_REQUIRED} sessions before Wave. Internal notes only; public references remain zero until written consent outside this product.`,
    sessionCount,
    sessions,
    sessionsGateMet,
    sessionsRequired: DESIGN_PARTNER_SESSIONS_REQUIRED,
    sourceDoc: "docs/DESIGN_PARTNER/SESSION_LEARNING_LOG.md",
    waveMarketPresenceReady: false
  };
}

export async function buildDesignPartnerWorkspace(
  prisma: PrismaClient,
  context: AuthenticatedContext
): Promise<DesignPartnerWorkspace> {
  const tenantId = context.tenant.tenantId;
  const [
    settings,
    verifiedScopes,
    integrations,
    latestSnapshotPack,
    measuredRun,
    verificationEvent,
    completedRunsWithEvidence,
    verificationEventCount,
    firstExportedPack,
    firstReportShare,
    exportedPackCount,
    reportShareCount,
    sessionNoteRecords
  ] = await Promise.all([
    loadTenantDesignPartnerSettings(prisma, tenantId),
    prisma.scope.findMany({
      where: {
        tenantId,
        verificationStatus: "Verified"
      }
    }),
    prisma.integration.findMany({
      where: {
        tenantId
      }
    }),
    prisma.evidencePack.findFirst({
      orderBy: {
        createdAt: "desc"
      },
      where: {
        packType: "ValidationSnapshotReport",
        tenantId
      }
    }),
    prisma.validationRun.findFirst({
      orderBy: { completedAt: "asc" },
      where: {
        completedAt: { not: null },
        evidenceIds: { isEmpty: false },
        status: "Completed",
        tenantId
      }
    }),
    prisma.verificationEvent.findFirst({
      orderBy: { verifiedAt: "asc" },
      where: { tenantId }
    }),
    prisma.validationRun.count({
      where: {
        completedAt: { not: null },
        evidenceIds: { isEmpty: false },
        status: "Completed",
        tenantId
      }
    }),
    prisma.verificationEvent.count({
      where: { tenantId }
    }),
    prisma.evidencePack.findFirst({
      orderBy: { updatedAt: "asc" },
      where: { status: "Exported", tenantId }
    }),
    prisma.reportShare.findFirst({
      orderBy: { createdAt: "asc" },
      where: { tenantId }
    }),
    prisma.evidencePack.count({
      where: { status: "Exported", tenantId }
    }),
    prisma.reportShare.count({
      where: { tenantId }
    }),
    prisma.designPartnerSessionNote.findMany({
      orderBy: { createdAt: "asc" },
      where: { tenantId }
    })
  ]);
  const latestSnapshot = latestSnapshotPack
    ? await loadValidationSnapshot(
        prisma,
        context,
        latestSnapshotPack.evidencePackId
      )
    : null;
  const latestAnalystNote =
    latestSnapshot != null
      ? await loadEvidencePackAnalystNote(
          prisma,
          tenantId,
          latestSnapshot.snapshotId
        )
      : null;
  const connectedKeys = new Set(
    integrations
      .map((integration) => getConnectorKey(integration.config))
      .filter((connectorKey): connectorKey is string => Boolean(connectorKey))
  );
  const connectedIntegrations = integrations.filter(
    (integration) => integration.status === "Connected"
  ).length;
  const hasGithub = connectedKeys.has("github");
  const hasAws = connectedKeys.has("aws");
  const hasJira = connectedKeys.has("jira");
  const hasLatestSnapshot = latestSnapshot != null;
  const hasVerifiedScope = verifiedScopes.length > 0;
  const hasConnectedSource = connectedIntegrations > 0;
  const hasMissionOrSnapshot = hasLatestSnapshot;

  const integrationChecklist = [
    {
      description:
        "Connect GitHub so repository evidence can seed attack paths.",
      itemId: "github-connected",
      label: "GitHub connected",
      status: toChecklistStatus(hasGithub)
    },
    {
      description: "Connect AWS so cloud access and posture can be validated.",
      itemId: "aws-connected",
      label: "AWS connected",
      status: toChecklistStatus(hasAws)
    },
    {
      description:
        "Connect Jira so remediation tickets can move into verification.",
      itemId: "jira-connected",
      label: "Jira connected",
      status: toChecklistStatus(hasJira)
    }
  ];
  const onboardingChecklist = [
    {
      description:
        "Periscan tenant is provisioned and ready for guided onboarding.",
      itemId: "tenant-ready",
      label: "Tenant ready",
      status: "Complete" as const
    },
    {
      description:
        "Verify at least one customer-authorized scope before validation.",
      itemId: "verified-scope",
      label: "Verified scope",
      status: toChecklistStatus(hasVerifiedScope)
    },
    {
      description:
        "Connect the core systems required for the first Snapshot story.",
      itemId: "core-systems",
      label: "Core systems connected",
      status: toChecklistStatus(hasGithub && hasAws)
    },
    {
      description:
        "Run or request a Validation Snapshot for the design partner.",
      itemId: "snapshot-requested",
      label: "Snapshot requested",
      status: toChecklistStatus(hasLatestSnapshot)
    },
    {
      description: "Preview the latest report before sending it externally.",
      itemId: "report-preview",
      label: "Report preview ready",
      status: toChecklistStatus(hasLatestSnapshot)
    },
    {
      description:
        "Attach Periscan analyst notes when founder or operator context is needed.",
      itemId: "analyst-note",
      label: "Analyst note attached",
      status: toChecklistStatus(latestAnalystNote != null)
    }
  ];

  // Lightweight proof-loop milestone model (Account → … → Proof) for analyst export.
  // Aligns with activation keys without re-running full activation diagnostics.
  const measuredResultAt = measuredRun?.completedAt?.toISOString() ?? null;
  const revalidatedAt = verificationEvent?.verifiedAt?.toISOString() ?? null;
  const proofDeliveredAt =
    [firstReportShare?.createdAt, firstExportedPack?.updatedAt]
      .filter((value): value is Date => Boolean(value))
      .sort((a, b) => a.getTime() - b.getTime())[0]
      ?.toISOString() ?? null;
  const proofLoopFlags = [
    true, // AccountCreated (tenant exists)
    hasConnectedSource,
    hasVerifiedScope,
    hasMissionOrSnapshot, // policy/mission proxy: snapshot requested
    hasMissionOrSnapshot,
    Boolean(measuredResultAt),
    Boolean(measuredResultAt), // remediation optional proxy via measured
    Boolean(revalidatedAt),
    Boolean(proofDeliveredAt) || Boolean(latestAnalystNote)
  ];
  const completedMilestones = proofLoopFlags.filter(Boolean).length;
  const maturity = verificationEvent
    ? ("Operating" as const)
    : measuredRun
      ? ("Measured" as const)
      : hasConnectedSource || hasVerifiedScope || hasMissionOrSnapshot
        ? ("Activating" as const)
        : ("New" as const);

  const onboardingComplete = onboardingChecklist.filter(
    (item) => item.status === "Complete"
  ).length;
  const integrationComplete = integrationChecklist.filter(
    (item) => item.status === "Complete"
  ).length;

  const sessions = sessionNoteRecords.map(serializeDesignPartnerSessionNote);
  const sessionLearning = buildDesignPartnerSessionLearning(sessions);

  return {
    analystEvidence: {
      modeEnabled: settings.enabled,
      measuredAt: new Date().toISOString(),
      checklist: {
        onboardingComplete,
        onboardingTotal: onboardingChecklist.length,
        integrationComplete,
        integrationTotal: integrationChecklist.length
      },
      proofLoop: {
        maturity,
        completedMilestones,
        totalMilestones: proofLoopFlags.length,
        measuredResultAt,
        revalidatedAt,
        proofDeliveredAt
      },
      counts: {
        verifiedScopes: verifiedScopes.length,
        connectedIntegrations,
        completedRunsWithEvidence,
        verificationEvents: verificationEventCount,
        exportedOrSharedPacks: exportedPackCount + reportShareCount
      },
      honesty: {
        marketPresenceEligible: false,
        publicReferenceCount: 0,
        sessionLearningEvidenceInProduct:
          sessions.length > 0 ? "InternalSessionNotes" : "ChecklistOnly",
        disclaimer:
          "Tenant checklist and proof-loop counts are not customer references, Wave/MQ market presence, or five-session research scorecards. Public references require written consent outside this product. sessionLearning.sessionCount is honest internal-note tally only."
      }
    },
    integrationChecklist,
    latestAnalystNote,
    onboardingChecklist,
    sessionLearning,
    settings,
    snapshotRequest: {
      latestReportId: latestSnapshot?.snapshotId ?? null,
      latestSnapshotId: latestSnapshot?.snapshotId ?? null,
      previewPath: latestSnapshot
        ? `/snapshots/${latestSnapshot.snapshotId}`
        : null,
      requestedAt: latestSnapshot?.createdAt ?? null,
      status: hasLatestSnapshot ? "Ready" : "NotRequested"
    },
    tenantId
  };
}

export async function appendDesignPartnerSessionNote(
  prisma: PrismaClient,
  context: AuthenticatedContext,
  input: AppendDesignPartnerSessionNoteInput
): Promise<DesignPartnerSessionNote> {
  const record = await prisma.designPartnerSessionNote.create({
    data: {
      createdBy: context.user.userId,
      note: input.note,
      outcome: input.outcome ?? null,
      partnerCode: input.partnerCode,
      roleBand: input.roleBand ?? null,
      sessionDate: input.sessionDate ? new Date(input.sessionDate) : null,
      tenantId: context.tenant.tenantId
    }
  });

  await writeAuditEvent(prisma, {
    action: "tenant.updated",
    actorType: "User",
    entityId: record.sessionNoteId,
    entityType: "Tenant",
    metadata: {
      field: "designPartnerSessionNote",
      isPublicReference: false,
      outcome: record.outcome,
      partnerCode: record.partnerCode
    },
    tenantId: context.tenant.tenantId,
    userId: context.user.userId
  });

  return serializeDesignPartnerSessionNote(record);
}

function dataRegionLabel(region: string) {
  return (
    {
      "ap-southeast-1": "Asia Pacific · Singapore",
      "eu-central-1": "European Union · Frankfurt",
      "uk-south-1": "United Kingdom · London",
      "us-east-1": "United States · East"
    }[region] ?? region
  );
}

function configuredSubprocessors(env: NodeJS.ProcessEnv) {
  const raw = env.PERISCAN_SUBPROCESSORS_JSON?.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((candidate) => {
      if (!candidate || typeof candidate !== "object") return [];
      const record = candidate as Record<string, unknown>;
      if (
        typeof record.name !== "string" ||
        typeof record.purpose !== "string"
      ) {
        return [];
      }
      const privacyUrl =
        typeof record.privacyUrl === "string" &&
        /^https:\/\//u.test(record.privacyUrl)
          ? record.privacyUrl
          : null;
      return [{ name: record.name, privacyUrl, purpose: record.purpose }];
    });
  } catch {
    return [];
  }
}

export async function buildTrustSafetySummary(
  prisma: PrismaClient,
  context: AuthenticatedContext
): Promise<TrustSafetySummary> {
  const integrations = (
    await prisma.integration.findMany({
      orderBy: [
        {
          category: "asc"
        },
        {
          vendor: "asc"
        },
        {
          product: "asc"
        }
      ],
      where: {
        tenantId: context.tenant.tenantId
      }
    })
  ).map(serializeIntegration);
  const retentionDays = getEvidenceRetentionDays();
  const availableDataRegions = getAvailableEvidenceDataRegions();
  const encryptionDetails =
    process.env.PERISCAN_EVIDENCE_ENCRYPTION_AT_REST?.trim();
  const baaReferenceUrl = resolveHttpsReferenceUrl(
    process.env.PERISCAN_BAA_REFERENCE_URL
  );
  const dpaReferenceUrl = resolveHttpsReferenceUrl(
    process.env.PERISCAN_DPA_REFERENCE_URL
  );
  const subprocessors = configuredSubprocessors(process.env);
  const routingStatus =
    availableDataRegions.length > 1
      ? ("RegionRouted" as const)
      : ("SingleRegion" as const);

  return TrustSafetySummarySchema.parse({
    auditLogPath: "/api/v1/audit-events",
    connectedIntegrations: integrations.map((integration) => {
      const metadata = getIntegrationTrustSafetyMetadata(integration);
      const connectorKey = metadata.connectorKey;
      const connector = connectorKey ? getConnectorByKey(connectorKey) : null;

      return {
        category: integration.category,
        connectorKey,
        controlObservationCapabilities:
          connector?.manifest.controlObservationCapabilities ?? [],
        dataReadCategories: connector?.manifest.signalCategories ?? [],
        dataSensitivity: connector?.manifest.dataSensitivity ?? "Moderate",
        dedicatedClient: metadata.dedicatedClient,
        disconnectPath: `/api/v1/integrations/${integration.integrationId}`,
        executionReadiness: metadata.executionReadiness,
        executionReadinessReason: metadata.executionReadinessReason,
        healthStatus: integration.healthStatus,
        implementationTier: metadata.implementationTier,
        integrationId: integration.integrationId,
        lastSyncAt: integration.lastSyncAt ?? null,
        live: metadata.live,
        permissionsUsed: connector?.manifest.requiredPermissions ?? [],
        product: integration.product,
        revokeInstructions: buildIntegrationRevokeInstructions(integration),
        status: integration.status,
        supportedMissionTypes: connector?.manifest.supportedMissionTypes ?? [],
        validationCapabilities:
          connector?.manifest.validationCapabilities ?? [],
        vendor: integration.vendor,
        workflowCapabilities: connector?.manifest.workflowCapabilities ?? []
      };
    }),
    identityProvisioning: buildIdentityProvisioningHonesty(),
    enterpriseCommercial: buildEnterpriseCommercialHonesty({
      routingStatus
    }),
    marketPresence: buildMarketPresenceReadiness(),
    vendorAssurance: buildVendorAssurance(process.env),
    dataGovernance: {
      availableRegions: availableDataRegions.map((region) => ({
        id: region,
        label: dataRegionLabel(region)
      })),
      baaReferenceUrl,
      baaStatus: baaReferenceUrl ? "Available" : "NotConfigured",
      dataCategoriesProcessed: [...DEFAULT_DATA_CATEGORIES_PROCESSED],
      dataSubjectRequestProcess: DEFAULT_DATA_SUBJECT_REQUEST_PROCESS,
      dpaReferenceUrl,
      dpaStatus: dpaReferenceUrl ? "Available" : "NotConfigured",
      encryptionAtRestDetails:
        encryptionDetails ??
        "Deployment-managed. Confirm encryption-at-rest controls with the configured object-storage provider before production use.",
      encryptionAtRestStatus: encryptionDetails
        ? "Configured"
        : "DeploymentManaged",
      routingStatus,
      selectedRegion: context.tenant.dataRegion,
      selectedRegionStorageConfigured: availableDataRegions.includes(
        context.tenant.dataRegion
      ),
      subprocessors,
      subprocessorsHonesty:
        subprocessors.length > 0
          ? CONFIGURED_SUBPROCESSORS_HONESTY
          : EMPTY_SUBPROCESSORS_HONESTY,
      subprocessorsStatus:
        subprocessors.length > 0 ? "Configured" : "NotConfigured"
    },
    evidenceRetention: {
      artifactStorage: "S3-compatible object storage (MinIO locally)",
      notes:
        retentionDays == null
          ? "Evidence retention is deployment-managed. Configure object-storage lifecycle and backup policy before production."
          : `Evidence retention is configured for ${retentionDays} days in the deployment environment.`,
      redactionEnabled: true,
      retentionPeriodDays: retentionDays,
      retentionPolicyStatus:
        retentionDays == null ? "DeploymentManaged" : "Configured",
      tenantScopedAccess: true
    },
    operationalReadiness: buildTrustSafetyOperationalReadiness(process.env),
    runnerSecurityModel: {
      gatewayHostnames: getRunnerGatewayHostnames(),
      inboundFirewallRuleRequired: false,
      killSwitchAvailable: true,
      localAuditLogsRequired: true,
      outboundOnly: true,
      scopeEnforcementRequired: true,
      taskSigningRequired: true,
      transport: `Outbound HTTPS long polling via ${getRunnerControlPlaneUrl()}`
    },
    tenantId: context.tenant.tenantId,
    validationSafetyPrinciples: [...TRUST_SAFETY_PRINCIPLES]
  });
}

export async function buildOperatorContextForTenant(
  prisma: PrismaClient,
  context: AuthenticatedContext
) {
  const now = new Date().toISOString();
  const [
    verifiedScopes,
    latestSnapshotPack,
    attackPaths,
    remediations,
    evidenceArtifacts,
    controlSignals,
    aiSignals,
    aiAppCount,
    controlSourceCount,
    integrationCount
  ] = await Promise.all([
    prisma.scope.findMany({
      orderBy: {
        createdAt: "asc"
      },
      where: {
        tenantId: context.tenant.tenantId,
        verificationStatus: "Verified"
      }
    }),
    prisma.evidencePack.findFirst({
      orderBy: {
        createdAt: "desc"
      },
      where: {
        packType: "ValidationSnapshotReport",
        tenantId: context.tenant.tenantId
      }
    }),
    ensureCorrelatedAttackPathsForTenant(prisma, context.tenant.tenantId),
    prisma.remediationTask.findMany({
      orderBy: {
        createdAt: "desc"
      },
      where: {
        tenantId: context.tenant.tenantId
      }
    }),
    prisma.evidenceArtifact.findMany({
      orderBy: {
        createdAt: "desc"
      },
      take: 25,
      where: {
        tenantId: context.tenant.tenantId
      }
    }),
    prisma.signalEnvelope.findMany({
      orderBy: {
        createdAt: "desc"
      },
      take: 25,
      where: {
        signalCategory: "ControlObservation",
        tenantId: context.tenant.tenantId
      }
    }),
    prisma.signalEnvelope.findMany({
      orderBy: {
        createdAt: "desc"
      },
      take: 25,
      where: {
        signalCategory: "AIApplication",
        tenantId: context.tenant.tenantId
      }
    }),
    prisma.aIApplication.count({
      where: {
        tenantId: context.tenant.tenantId
      }
    }),
    prisma.controlSource.count({
      where: {
        tenantId: context.tenant.tenantId
      }
    }),
    prisma.integration.count({
      where: {
        tenantId: context.tenant.tenantId
      }
    })
  ]);
  const latestSnapshot = latestSnapshotPack
    ? await loadValidationSnapshot(
        prisma,
        context,
        latestSnapshotPack.evidencePackId
      )
    : null;

  return {
    aiAppCount,
    aiAppRisks: latestSnapshot?.aiAppRisks.length
      ? latestSnapshot.aiAppRisks
      : aiSignals.map(serializeSignalEnvelope),
    attackPaths: attackPaths
      .map((path) => assessAttackPathRisk(path))
      .sort((left, right) => right.risk.score - left.risk.score),
    controlObservations: latestSnapshot?.controlObservations.length
      ? latestSnapshot.controlObservations
      : controlSignals.map(serializeSignalEnvelope),
    controlSourceCount,
    defaultTargetHostname:
      verifiedScopes.find(
        (scope) =>
          scope.scopeType === "Domain" || scope.scopeType === "Subdomain"
      )?.value ?? null,
    evidenceArtifacts: evidenceArtifacts.map(serializeEvidenceArtifact),
    generatedAt: now,
    integrationCount,
    latestSnapshot,
    remediations: remediations.map(serializeRemediationTask),
    tenantId: context.tenant.tenantId,
    verifiedScopeIds: verifiedScopes.map((scope) => scope.scopeId)
  };
}

export interface RuntimeServicesOptions {
  a2aTckExecutor?: A2ATckExecutor;
  availableDataRegions?: string[];
  awsMarketplaceConfig?: AwsMarketplaceConfig;
  awsMarketplaceProvider?: AwsMarketplaceProvider;
  dataRegion: string;
  devMode: boolean;
  emailTransport?: EmailTransport;
  webBaseUrl?: string;
  fetchImpl?: typeof fetch;
  interventionSigningSecret?: string;
  missionQueue?: MissionQueue;
  modelGatewayTurnQueue?: ModelGatewayTurnQueue;
  webhookQueue?: WebhookDeliveryQueue | null;
  prisma?: PrismaClient;
}

// Shared dependencies passed to each extracted per-domain service factory
// (D1 Phase 2 closure decomposition). Intentionally minimal; fields are added as
// later slices need them (queues, config, emitTenantWebhook, etc.).
export interface RuntimeServiceDeps {
  a2aTckExecutor: A2ATckExecutor;
  availableDataRegions: string[];
  awsMarketplaceConfig: AwsMarketplaceConfig;
  awsMarketplaceProvider?: AwsMarketplaceProvider;
  dataRegion: string;
  devMode: boolean;
  emailTransport: EmailTransport;
  emitTenantWebhook: (
    tenantId: string,
    eventType: WebhookEventType,
    payload: Record<string, unknown>
  ) => Promise<void>;
  externalValidationConfig: ReturnType<typeof parseExternalValidationConfig>;
  externalValidationRateState: ExternalValidationRateState;
  fetchImpl: typeof fetch;
  interventionSigningSecret: string;
  missionQueue: MissionQueue;
  modelGatewayTurnQueue: ModelGatewayTurnQueue;
  prisma: PrismaClient;
  webBaseUrl: string;
  webhookQueue: WebhookDeliveryQueue | null;
}

const DEFAULT_WEB_BASE_URL = "http://localhost:3000";

export function resolveWebBaseUrl(
  env: NodeJS.ProcessEnv = process.env
): string {
  const configured = env.PERISCAN_WEB_BASE_URL?.trim().replace(/\/+$/u, "");

  if (env.PERISCAN_DEPLOYMENT_ENVIRONMENT === "production") {
    if (!configured) {
      throw new AppServiceError(
        "Set PERISCAN_WEB_BASE_URL in production; refusing to generate onboarding or recovery links with a localhost fallback.",
        503,
        "web_base_url_missing"
      );
    }

    if (!isPublicHttpsUrl(configured)) {
      throw new AppServiceError(
        "PERISCAN_WEB_BASE_URL must be a public HTTPS URL in production.",
        503,
        "web_base_url_invalid"
      );
    }
  }

  return configured || DEFAULT_WEB_BASE_URL;
}

export function createRuntimeServices(
  options: RuntimeServicesOptions
): AppServices {
  const prisma = options.prisma ?? getPrismaClient();
  const missionQueue = options.missionQueue ?? createBullMqMissionQueue();
  const modelGatewayTurnQueue =
    options.modelGatewayTurnQueue ?? createBullMqModelGatewayTurnQueue();
  const webhookQueue =
    options.webhookQueue === undefined
      ? createBullMqWebhookDeliveryQueue()
      : options.webhookQueue;
  const awsMarketplaceConfig =
    options.awsMarketplaceConfig ?? awsMarketplaceConfigFromEnv();

  async function emitTenantWebhook(
    tenantId: string,
    eventType: WebhookEventType,
    payload: Record<string, unknown>
  ) {
    await emitWebhookEvent({
      eventType,
      payload,
      prisma,
      queue: webhookQueue,
      tenantId
    });
  }
  const externalValidationConfig = parseExternalValidationConfig();
  const externalValidationRateState: ExternalValidationRateState = {
    globalTimestamps: [],
    tenantTimestamps: new Map()
  };

  const deps: RuntimeServiceDeps = {
    a2aTckExecutor: options.a2aTckExecutor ?? executeA2ATck,
    availableDataRegions:
      options.availableDataRegions ?? getAvailableEvidenceDataRegions(),
    awsMarketplaceConfig,
    awsMarketplaceProvider:
      options.awsMarketplaceProvider ??
      (awsMarketplaceConfig.productCode
        ? new AwsSdkMarketplaceProvider()
        : undefined),
    dataRegion: options.dataRegion,
    devMode: options.devMode,
    emailTransport: options.emailTransport ?? createEmailTransportFromEnv(),
    webBaseUrl: options.webBaseUrl ?? resolveWebBaseUrl(),
    emitTenantWebhook,
    externalValidationConfig,
    externalValidationRateState,
    fetchImpl: options.fetchImpl ?? globalThis.fetch,
    interventionSigningSecret:
      options.interventionSigningSecret ??
      process.env.PERISCAN_INTERVENTION_SIGNING_SECRET ??
      process.env.PERISCAN_JWT_SECRET ??
      "periscan-dev-intervention-secret",
    missionQueue,
    modelGatewayTurnQueue,
    prisma,
    webhookQueue
  };

  const runnerServices = createRunnerServices(deps);
  const thirdPartyToolServices = createThirdPartyToolServices(
    deps,
    runnerServices
  );

  const services = {
    ...createRegistryServices(),

    ...createSignalOperatorServices(deps),

    ...thirdPartyToolServices,

    ...createIntegrationServices(deps),

    ...createControlAiServices(deps),

    ...createControlStimulusServices(deps),

    ...runnerServices,
    ...createRunnerFleetServices(deps),

    ...createScheduleServices(deps),

    ...createValidationServices(deps),

    ...createFindingsServices(deps),
    ...createBusinessImpactServices(deps),
    ...createAsyncOperationsServices(deps),

    ...createRemediationServices(deps),
    ...createRemediationActionServices(deps),
    ...createInfrastructureChangeServices(deps),
    ...createNonHumanIdentityServices(deps),

    // D: Remediation simulator, playbooks, tripwires, trending (integrated with FixVerification + RemOps + reports)
    simulateRemediation: (
      remediationId: string,
      proposedFix: string,
      risk?: number
    ) => simulateFixWhatIf(remediationId, proposedFix, risk),
    generatePlaybooks: (remediation: RemediationPlaybookInput) =>
      getOneClickPlaybooks(remediation),
    createTripwire: (remediationId: string) =>
      createRemediationTripwire(remediationId),
    getFixTrends: (past: RemediationTrendInput[]) =>
      computeRemediationTrends(past),

    ...createSnapshotReportEvidenceServices(deps),

    ...createTenantServices(deps),
    ...createLocalizationServices(deps),
    ...createTrialServices(deps),
    ...createAwsMarketplaceServices(deps),
    ...createComplianceGovernanceServices(deps),
    ...createTenantIsolationProofServices(deps),
    ...createDataFabricServices(deps),

    ...createSsoServices(deps),

    ...createAuthServices(deps),

    ...createWebhookServices(deps),

    ...createModelGatewayServices(deps),
    ...createAgentWorkflowServices(deps),
    ...createAgentBehaviorServices(deps),
    ...createAgentTrustServices(deps),
    ...createExtensionServices(deps),
    ...createSubscriptionServices(deps),
    ...createModelFinOpsServices(deps),

    ...createScopeServices(deps),
    ...createScenarioServices(deps),
    ...createHybridExecutionCompilerServices(deps),
    ...createEngagementServices(deps),
    ...createEngagementCollaborationServices(deps),
    ...createThreatCenterServices(deps),
    ...createSuperFeedServices(deps),
    ...createSearchServices(deps),
    ...createMcpServices(deps)
  };

  return services as any as AppServices;
}

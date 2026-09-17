/**
 * Payload-level OpenAPI enrichment.
 *
 * The Fastify routes intentionally declare only operation metadata
 * (operationId/summary/tags) and do NOT register `schema.body` /
 * `schema.response`. That keeps Fastify from validating requests or
 * serializing/stripping responses at runtime. To still publish useful
 * request/response payload schemas in the served OpenAPI document, we AUGMENT
 * the document produced by `app.swagger()` after the fact — a doc-only change
 * with zero runtime behavior impact.
 *
 * Each entry maps an `operationId` to JSON Schema objects produced from the
 * real Zod schemas the handlers parse (`request`) and the service return types
 * (`response`). Schemas come from `@periscan/shared` (converted with
 * `zodToJsonSchema`) or from the app-local Zod schemas exported by `app.ts`
 * (converted with the same shared helper — both share one `zod` instance).
 *
 * Coverage is deliberately partial-but-honest: an operation only appears here
 * when its request and/or response schema can be mapped with confidence.
 */
import {
  AIApplicationSchema,
  AIAppValidationSuiteDefinitionSchema,
  AgentBehaviorAnalysisSchema,
  AdvisoryReadinessReportSchema,
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
  AssetSchema,
  AssetLineageSchema,
  AssetValuationVersionSchema,
  AsyncOperationsPolicyInputSchema,
  AsyncOperationsReasonInputSchema,
  AsyncOperationsReconcileResultSchema,
  AsyncOperationsWorkspaceSchema,
  AsyncRecoveryDecisionInputSchema,
  AsyncRecoveryDecisionResultSchema,
  BusinessImpactPreviewSchema,
  BusinessImpactWorkspaceSchema,
  ReviewAssetValuationVersionInputSchema,
  SubmitAssetValuationVersionInputSchema,
  AuditEventSchema,
  BillingPackageSchema,
  BillingUsageSchema,
  CTEMProgramSummarySchema,
  ContextBundleSchema,
  ControlRuleCoverageSummarySchema,
  ControlSourceSchema,
  CreateValidationStimulusInputSchema,
  CreateValidationStimulusResponseSchema,
  ValidationStimulusSchema,
  ControlValidationScenarioDefinitionSchema,
  ApplyThirdPartyToolUpdateRequestSchema,
  CreateContextBundleInputSchema,
  DismissThirdPartyToolUpdateRequestSchema,
  CreateModelPolicyProfileInputSchema,
  CreateModelProviderInputSchema,
  CreateModelSessionInputSchema,
  CreateModelSessionTurnInputSchema,
  CreateModelToolRequestInputSchema,
  CreateControlGapRemediationInputSchema,
  CreateRemediationInputSchema,
  PreviewRemediationActionInputSchema,
  ConfirmRemediationActionInputSchema,
  PreviewInfrastructureChangeInputSchema,
  ConfirmInfrastructureChangeInputSchema,
  CreateRemediationTicketInputSchema,
  SyncRemediationTicketInputSchema,
  RemediationTicketSchema,
  RemediationTicketStateSchema,
  CreateMissionScheduleInputSchema,
  UpdateMissionScheduleInputSchema,
  CreateTenantApiKeyInputSchema,
  CreateTenantWebhookInputSchema,
  DesignPartnerReportNoteSchema,
  DesignPartnerSessionNoteSchema,
  DesignPartnerWorkspaceSchema,
  DetectionMarkerProofInputSchema,
  DetectionMarkerProofResultSchema,
  DnsExfilCanaryProofInputSchema,
  DnsExfilCanaryProofResultSchema,
  SafetyEquivalentPacksResponseSchema,
  ExecutionIntegrityHonestySchema,
  ModelExtractionHonestySchema,
  PartnerCapabilityHonestySchema,
  BatchComplianceGovernanceInputSchema,
  BatchComplianceGovernanceResultSchema,
  ComplianceGovernanceMultiFrameworkSummarySchema,
  MultiFrameworkComplianceExportInputSchema,
  MultiFrameworkComplianceExportResultSchema,
  DeploymentStatusResponseSchema,
  DataResidencyOptionsSchema,
  DueScheduleRunSummarySchema,
  EngagementRunRequestSchema,
  EngagementResultSchema,
  EngagementCollaborationReadResponseSchema,
  EngagementCollaborationSnapshotSchema,
  InitializeEngagementWorkspaceInputSchema,
  UpsertEngagementCollaboratorInputSchema,
  CreateEngagementCollaborationEventInputSchema,
  CompileScenarioInputSchema,
  CompileScenarioResponseSchema,
  ExecuteScenarioInputSchema,
  StopScenarioFeedbackInputSchema,
  ScenarioBundleSchema,
  ScenarioExecutionResultSchema,
  EvidenceArtifactSchema,
  EvidenceArtifactVerificationSchema,
  EvidenceChainVerificationReportSchema,
  EvidencePackSchema,
  CreateExtensionProjectInputSchema,
  ExtensionDeveloperWorkspaceSchema,
  ExtensionLifecycleReasonInputSchema,
  ExtensionProjectSchema,
  ExtensionReleaseSchema,
  ExtensionScaffoldSchema,
  ReviewExtensionReleaseInputSchema,
  RollbackExtensionProjectInputSchema,
  SubmitExtensionReleaseInputSchema,
  CreateSubscriptionLifecycleInputSchema,
  RecordSubscriptionRenewalInputSchema,
  ResolveSubscriptionGraceInputSchema,
  ScheduleSubscriptionCancellationInputSchema,
  StartSubscriptionGraceInputSchema,
  SubscriptionOperationsWorkspaceSchema,
  SubscriptionReasonInputSchema,
  ExecutiveTrendSummarySchema,
  HealthResponseSchema,
  ImportThreatAdvisoryInputSchema,
  IntegrationSchema,
  JobSchema,
  KillSwitchResultSchema,
  LocalizationFormatPreviewSchema,
  MSSPClientPortfolioSchema,
  MembershipSchema,
  MissionScheduleSchema,
  MissionScheduleDetailSchema,
  DispositionFeedbackSummarySchema,
  ModelGatewayAuditEventSchema,
  ModelPolicyProfileSchema,
  ModelProviderConnectionTestResultSchema,
  ModelProviderSchema,
  ModelSessionSchema,
  ModelSessionTurnAcceptedSchema,
  ModelUsageEventSchema,
  ModelToolRequestSchema,
  ModelToolSchema,
  OpenSourceCapabilitySchema,
  OpenSourceToolCatalogEntrySchema,
  CommunityValidationSuiteResponseSchema,
  CommunityMissionRemediationsResultSchema,
  CommunityValidationCompanionSchema,
  CommunityValidationStartResultSchema,
  StartCommunityValidationRequestSchema,
  AcceptToolLicenseRequestSchema,
  ReviewThirdPartyToolCandidateRequestSchema,
  ThirdPartyToolDisableRequestSchema,
  ThirdPartyToolEnableRequestSchema,
  ThirdPartyToolInstallRequestSchema,
  ThirdPartyToolInstallPlanSchema,
  ToolLicenseAcceptanceSchema,
  ThirdPartyToolLicenseSummarySchema,
  ThirdPartyToolRefreshDueRequestSchema,
  ThirdPartyToolRefreshDueResponseSchema,
  ThirdPartyToolActivityEventSchema,
  ThirdPartyToolCandidateSchema,
  ThirdPartyToolCandidateImportRequestSchema,
  ThirdPartyToolCandidateImportResponseSchema,
  ThirdPartyToolCandidateReadinessSchema,
  ThirdPartyToolCandidateReadinessSummarySchema,
  ThirdPartyToolCoverageAuditSchema,
  ThirdPartyToolImplementationBundleSchema,
  ThirdPartyToolImplementationWorkOrderSchema,
  ThirdPartyToolPromotionCertificationSchema,
  ThirdPartyToolPromotionHandoffSchema,
  ThirdPartyToolPromotionPackageSchema,
  ThirdPartyToolRunnerDispatchRequestSchema,
  ThirdPartyToolRunnerDispatchResponseSchema,
  ThirdPartyToolRunnerEligibilitySchema,
  ThirdPartyToolUpstreamVersionCheckSchema,
  ThirdPartyToolUpdateRecommendationSchema,
  ThirdPartyToolSchema,
  ToolIntakeManifestRequestSchema,
  ToolIntakeValidationReportSchema,
  ToolInstallJobSchema,
  PolicyDecisionSchema,
  PrescriptivePlanSchema,
  ProductActivationStateSchema,
  ProductExperienceProfileSchema,
  ProductFeedbackSchema,
  BlueShiftBriefSchema,
  ProductWorkQueueSchema,
  PreviewTenantLocalizationInputSchema,
  UpdateTenantLocalizationInputSchema,
  ReadinessResponseSchema,
  RemediationTaskSchema,
  RemediationActionSchema,
  InfrastructureChangeRequestSchema,
  ReportShareLinkSchema,
  ReportShareGrantSchema,
  RunnerCredentialRotationRequestSchema,
  RunnerCredentialRotationResponseSchema,
  RunnerControlStateAcknowledgementSchema,
  RunnerDiscoverTaskRequestSchema,
  RunnerHeartbeatSchema,
  RunnerKillSwitchRequestSchema,
  RunnerMeasuredTaskRequestSchema,
  RunnerPollRequestSchema,
  RunnerPollResponseSchema,
  RunnerCheckTaskRequestSchema,
  RunnerReachabilityTaskRequestSchema,
  RunnerRecordSchema,
  RunnerRegistrationRequestSchema,
  RunnerRegistrationTokenIssueRequestSchema,
  RunnerRegistrationTokenIssueResponseSchema,
  RunnerTaskAcceptRequestSchema,
  RunnerTaskArtifactUploadRequestSchema,
  RunnerTaskArtifactUploadResponseSchema,
  RunnerTaskRecordSchema,
  RunnerTaskRejectRequestSchema,
  RunnerTaskResultSchema,
  RunnerTransportDecisionSchema,
  ScheduledRunResultSchema,
  ScopeSchema,
  UpdateScopeClassificationInputSchema,
  SetThreatAlertStatusInputSchema,
  SignalEnvelopeSchema,
  SignalTriggerActivitySchema,
  SignalTriggerApprovalResponseSchema,
  SignalTriggerEvaluationResponseSchema,
  SignalTriggerRoutingSettingsSchema,
  SignalTriggerRuleSchema,
  TenantApiKeySchema,
  TenantApiKeyWithSecretSchema,
  TenantDesignPartnerSettingsSchema,
  TenantOperationalMetricsSchema,
  TenantReportBrandingSchema,
  TenantLocalizationSchema,
  TenantLocalizationWorkspaceSchema,
  TenantSchema,
  SetTenantRequireMfaInputSchema,
  TenantRequireMfaSettingsSchema,
  CompleteTenantSsoLoginInputSchema,
  StartTenantSsoLoginInputSchema,
  TenantSsoAuthorizationUrlSchema,
  TenantSsoConfigResponseSchema,
  TenantSsoConfigSchema,
  TenantSsoLoginStartResultSchema,
  ThreatAdvisoryDetailSchema,
  ThreatAdvisorySchema,
  ThreatFeedIngestionInputSchema,
  ThreatFeedIngestionResultSchema,
  ThreatFeedStatusSchema,
  ThreatIntelItemSchema,
  TrustSafetySummarySchema,
  SubmitProductFeedbackInputSchema,
  UpdateProductExperienceProfileInputSchema,
  UpdateModelPolicyProfileInputSchema,
  UpdateModelProviderInputSchema,
  UpdateModelToolInputSchema,
  UpdateTenantSsoConfigInputSchema,
  UpdateTenantWebhookInputSchema,
  UsageMeterDefinitionSchema,
  UserSchema,
  ValidatedFindingSchema,
  ValidationMissionSchema,
  ValidationRunSchema,
  ValidationSnapshotSchema,
  VerificationEventSchema,
  VerifyAttackPathInputSchema,
  WebhookDeliverySchema,
  WebhookEventCatalogSchema,
  TenantWebhookSchema,
  TenantWebhookWithSecretSchema,
  TenantThreatAlertSchema,
  MetricsResponseSchema,
  CursorPaginatedListEnvelopeSchema,
  OffsetPaginatedListEnvelopeSchema,
  UnpaginatedListEnvelopeSchema,
  zodToJsonSchema
} from "@periscan/shared";
import {
  ConnectorHealthSchema,
  ConnectorCatalogEntrySchema,
  ConnectorManifestSchema
} from "@periscan/connectors";
import { ModuleManifestSchema } from "@periscan/modules";
import {
  CreateOperatorRecommendationRecordInputSchema,
  DynamicPathMissionRecommendationSchema,
  OperatorProfileSchema,
  OperatorRecommendationRecordSchema,
  OperatorRecommendationSchema
} from "@periscan/operators";
import { ExternalValidationTemplateProfileMetadataSchema } from "@periscan/policy";

import {
  AuditExportInputSchema,
  AwsConnectInputSchema,
  AcceptInviteSchema,
  CreateAIApplicationInputSchema,
  ChangePasswordInputSchema,
  CreateClientTenantInputSchema,
  CreateControlSourceInputSchema,
  CreateIntegrationInputSchema,
  CreateMissionInputSchema,
  CreateReportInputSchema,
  CreateScopeInputSchema,
  CreateSnapshotInputSchema,
  ExportReportInputSchema,
  GenerateEvidenceSummaryInputSchema,
  GitHubConnectInputSchema,
  InviteInputSchema,
  JiraConnectInputSchema,
  LoginInputSchema,
  MfaReauthenticationInputSchema,
  MfaVerifyInputSchema,
  PasswordResetConfirmSchema,
  PasswordResetRequestSchema,
  PolicyPreviewInputSchema,
  ScopePostureCheckInputSchema,
  SetAIValidationKillSwitchInputSchema,
  SignupInputSchema,
  StartMissionInputSchema,
  ThreatFeedScheduleInputSchema,
  AppendDesignPartnerSessionNoteInputSchema,
  UpdateDesignPartnerSettingsInputSchema,
  UpdateReportAnalystNoteInputSchema,
  UpdateSignalTriggerRoutingSettingsInputSchema,
  UpdateTenantBrandingInputSchema,
  ValidateAIApplicationInputSchema,
  ValidateControlSourceInputSchema,
  VerifyEmailSchema,
  VerifyScopeInputSchema
} from "./app.js";

type JsonSchema = Record<string, unknown>;
type OpenApiQueryParameter = {
  description?: string;
  in: "query" | "header" | "path";
  name: string;
  required?: boolean;
  schema: JsonSchema;
};

function queryParameter(input: OpenApiQueryParameter): OpenApiQueryParameter {
  return {
    required: false,
    ...input
  };
}

/** Optional Idempotency-Key header for core proof-loop POSTs (P20-7). */
function idempotencyKeyHeaderParameter(): OpenApiQueryParameter {
  return {
    description:
      "Optional client-supplied Idempotency-Key (8–200 printable ASCII chars). Replays with the same key and request body return the first response; same key with a different body yields 409 idempotency_key_conflict. Response header Idempotency-Replayed=true marks a replay.",
    in: "header",
    name: "Idempotency-Key",
    required: false,
    schema: {
      maxLength: 200,
      minLength: 8,
      type: "string"
    }
  };
}

function limitQueryParameter({
  defaultValue = 50,
  maximum = 100
}: {
  defaultValue?: number;
  maximum?: number;
} = {}) {
  return queryParameter({
    description:
      "Maximum number of items to return. Defaults to the documented value and is clamped by the endpoint.",
    in: "query",
    name: "limit",
    schema: {
      default: defaultValue,
      maximum,
      minimum: 1,
      type: "integer"
    }
  });
}

function offsetQueryParameter({
  defaultValue = 0,
  maximum
}: {
  defaultValue?: number;
  maximum?: number;
} = {}) {
  return queryParameter({
    description:
      "Zero-based offset into the result set. Defaults to 0. Use with `limit` for offset pagination.",
    in: "query",
    name: "offset",
    schema: {
      default: defaultValue,
      minimum: 0,
      ...(maximum !== undefined ? { maximum } : {}),
      type: "integer"
    }
  });
}

/**
 * Specialize the `items` array element schema on a shared list envelope.
 * Envelope keys/required fields come from `@periscan/shared` so OpenAPI cannot
 * drift from the Zod contracts used by fixture tests and clients.
 */
function listEnvelopeOf(
  envelopeSchema: Parameters<typeof zodToJsonSchema>[0],
  itemSchema: JsonSchema,
  description: string
): JsonSchema {
  const envelope = out(envelopeSchema) as {
    properties?: Record<string, unknown>;
    required?: string[];
    type?: string;
  };
  const itemsProperty = (envelope.properties?.items ?? {}) as Record<
    string,
    unknown
  >;

  return {
    ...envelope,
    description,
    properties: {
      ...envelope.properties,
      items: {
        ...itemsProperty,
        type: "array",
        items: itemSchema
      }
    },
    required: envelope.required ?? ["items"],
    type: "object"
  };
}

/**
 * Unpaginated / limit-capped list envelope `{ items }`.
 * No `page` or `nextCursor` — clients must not invent pagination metadata.
 * Matches `UnpaginatedListEnvelopeSchema` in `@periscan/shared`.
 */
function listOf(itemSchema: JsonSchema): JsonSchema {
  return listEnvelopeOf(
    UnpaginatedListEnvelopeSchema,
    itemSchema,
    "List response with an `items` array only. Some routes accept `?limit=` to cap the array size but still omit page/cursor metadata."
  );
}

/**
 * Cursor-paginated list envelope `{ items, nextCursor }` (listMissions).
 * Matches `CursorPaginatedListEnvelopeSchema` in `@periscan/shared`.
 */
function cursorListOf(itemSchema: JsonSchema): JsonSchema {
  return listEnvelopeOf(
    CursorPaginatedListEnvelopeSchema,
    itemSchema,
    "Cursor-paginated list. Pass the previous response's `nextCursor` as `?cursor=` to fetch the next page. `nextCursor` is null on the last page."
  );
}

/**
 * Offset-paginated list envelope `{ items, page }` (listFindings, listAuditEvents).
 * Matches `OffsetPaginatedListEnvelopeSchema` in `@periscan/shared`.
 */
function offsetListOf(itemSchema: JsonSchema): JsonSchema {
  return listEnvelopeOf(
    OffsetPaginatedListEnvelopeSchema,
    itemSchema,
    "Offset-paginated list. Use `?limit=` and `?offset=` query params; response `page.hasMore` indicates another page exists."
  );
}

/** Convert a Zod schema to a JSON Schema for the response (output) view. */
function out(schema: Parameters<typeof zodToJsonSchema>[0]): JsonSchema {
  return zodToJsonSchema(schema, "output");
}

/** Convert a Zod schema to a JSON Schema for the request (input) view. */
function inp(schema: Parameters<typeof zodToJsonSchema>[0]): JsonSchema {
  return zodToJsonSchema(schema, "input");
}

export type OpenApiPayloadEntry = {
  parameters?: OpenApiQueryParameter[];
  request?: JsonSchema;
  response?: JsonSchema;
  responseContentTypes?: string[];
  requestDescription?: string;
  responseDescription?: string;
  /** Success status code to attach the response schema to. Defaults to 200. */
  responseStatus?: "200" | "201" | "202" | "204" | "307";
};

function withIdempotencyKey(entry: OpenApiPayloadEntry): OpenApiPayloadEntry {
  return {
    ...entry,
    parameters: [...(entry.parameters ?? []), idempotencyKeyHeaderParameter()]
  };
}

function withQueryParameters(
  response: JsonSchema,
  parameters: OpenApiQueryParameter[]
): OpenApiPayloadEntry {
  return {
    parameters,
    response
  };
}

function withLimitQuery(
  response: JsonSchema,
  options?: Parameters<typeof limitQueryParameter>[0]
): OpenApiPayloadEntry {
  return withQueryParameters(response, [limitQueryParameter(options)]);
}

const uuidQuerySchema: JsonSchema = { format: "uuid", type: "string" };
const dateTimeQuerySchema: JsonSchema = {
  format: "date-time",
  type: "string"
};

const openSourceCatalogQueryParameters: OpenApiQueryParameter[] = [
  queryParameter({
    description:
      "Catalog phase filter. `CurrentMvp` is accepted as a legacy alias for `Current`.",
    in: "query",
    name: "phase",
    schema: {
      default: "Current",
      enum: ["all", "Current", "CurrentMvp", "NearTerm", "LaterPhase"],
      type: "string"
    }
  }),
  queryParameter({
    description: "Include deferred OSS tools or capabilities.",
    in: "query",
    name: "includeDeferred",
    schema: { default: false, type: "boolean" }
  }),
  queryParameter({
    description: "Include legal-review-only OSS tools or capabilities.",
    in: "query",
    name: "includeLegalReview",
    schema: { default: false, type: "boolean" }
  })
];

function stringQueryParameter(name: string, description: string) {
  return queryParameter({
    description,
    in: "query",
    name,
    schema: { type: "string" }
  });
}

function uuidQueryParameter(name: string, description: string) {
  return queryParameter({
    description,
    in: "query",
    name,
    schema: uuidQuerySchema
  });
}

/**
 * Operations whose handlers respond with HTTP 201. The augmenter attaches the
 * response schema to the matching status code so the document mirrors runtime.
 */
const CREATED_OPERATIONS = new Set<string>([
  "signup",
  "inviteToTenant",
  "createClientTenant",
  "createApiKey",
  "createWebhook",
  "createAuditExport",
  "createModelProvider",
  "createModelPolicyProfile",
  "createModelSession",
  "createContextBundle",
  "createModelToolRequest",
  "approveSignalTrigger",
  "importThreatAdvisory",
  "ingestThreatFeed",
  "approveOperatorRecommendation",
  "generateEvidenceSummary",
  "createIntegration",
  "connectGithubIntegration",
  "connectAwsIntegration",
  "connectJiraMockIntegration",
  "createScope",
  "previewScopePolicyDecision",
  "createMission",
  "createRemediation",
  "createAIApplication",
  "createControlSource",
  "createReport",
  "createReportShareLink",
  "createRunnerRegistrationToken",
  "registerRunner",
  "createRunnerReachabilityTask",
  "createRunnerCheckTask",
  "uploadRunnerTaskArtifact",
  "uploadRunnerEvidence",
  "createSchedule",
  "updateSchedule",
  "deleteSchedule",
  "runSchedule",
  "createSnapshot",
  "acceptToolLicense"
]);

/**
 * Build the payload registry. Keys are operationIds present in the served
 * document. Only confidently-mapped operations are included.
 *
 * This is a function (not a module-level constant) because `openapi-payloads`
 * and `app.ts` import each other (app uses `augmentOpenApiDocument`; this module
 * uses app-local Zod schemas). Building the registry eagerly at import time
 * would read the app-local schema exports before they are initialized in the
 * circular-import cycle. Deferring construction until first use guarantees all
 * imported schemas are initialized.
 */
function buildPayloadRegistry(): Record<string, OpenApiPayloadEntry> {
  const authPayloadResponse: JsonSchema = {
    type: "object",
    properties: {
      membership: out(MembershipSchema),
      tenant: out(TenantSchema),
      user: out(UserSchema)
    }
  };
  const billingLimitsResponse: JsonSchema = {
    type: "object",
    required: ["limits", "usage", "withinLimits"],
    properties: {
      limits: {
        type: "object",
        required: ["missionsPerMonth", "runners", "evidenceArtifacts"],
        properties: {
          evidenceArtifacts: { nullable: true, type: "integer", minimum: 0 },
          missionsPerMonth: { nullable: true, type: "integer", minimum: 0 },
          runners: { nullable: true, type: "integer", minimum: 0 }
        }
      },
      usage: {
        type: "object",
        required: ["missionsThisMonth", "runners", "evidenceArtifacts"],
        properties: {
          evidenceArtifacts: { type: "integer", minimum: 0 },
          missionsThisMonth: { type: "integer", minimum: 0 },
          runners: { type: "integer", minimum: 0 }
        }
      },
      withinLimits: { type: "boolean" }
    }
  };
  const operatorRecommendationApprovalResponse: JsonSchema = {
    type: "object",
    required: ["decision", "mission", "recommendation"],
    properties: {
      decision: out(PolicyDecisionSchema),
      mission: out(ValidationMissionSchema),
      recommendation: out(OperatorRecommendationSchema)
    }
  };
  const messageResponse: JsonSchema = {
    type: "object",
    required: ["message"],
    properties: {
      message: { type: "string" }
    }
  };
  const mfaEnrollResponse: JsonSchema = {
    type: "object",
    required: ["secret", "otpauthUri"],
    properties: {
      otpauthUri: { type: "string" },
      secret: { type: "string" }
    }
  };
  const mfaVerifyResponse: JsonSchema = {
    type: "object",
    required: ["activated", "mfaEnabledAt", "recoveryCodes"],
    properties: {
      activated: { type: "boolean" },
      mfaEnabledAt: { format: "date-time", type: "string" },
      recoveryCodes: { type: "array", items: { type: "string" } }
    }
  };
  const mfaRecoveryCodesResponse: JsonSchema = {
    type: "object",
    required: ["recoveryCodes"],
    properties: {
      recoveryCodes: { type: "array", items: { type: "string" } }
    }
  };
  const mfaDisableResponse: JsonSchema = {
    type: "object",
    required: ["disabled"],
    properties: {
      disabled: { type: "boolean" }
    }
  };
  const webhookTestResponse: JsonSchema = {
    type: "object",
    required: ["deliveryIds"],
    properties: {
      deliveryIds: {
        type: "array",
        items: { format: "uuid", type: "string" }
      }
    }
  };
  const threatFeedScheduleResponse: JsonSchema = {
    type: "object",
    required: ["frequency", "nextThreatFeedIngestAt"],
    properties: {
      frequency: { nullable: true, type: "string" },
      nextThreatFeedIngestAt: {
        format: "date-time",
        nullable: true,
        type: "string"
      }
    }
  };
  const threatFeedDueIngestionResponse: JsonSchema = {
    type: "object",
    required: ["advisoryCount", "ingested", "ranAt"],
    properties: {
      advisoryCount: { type: "integer", minimum: 0 },
      ingested: { type: "boolean" },
      ranAt: { format: "date-time", type: "string" }
    }
  };
  const integrationSyncResultResponse: JsonSchema = {
    type: "object",
    required: [
      "assetCount",
      "health",
      "integration",
      "manifest",
      "signalCount",
      "signals"
    ],
    properties: {
      assetCount: { type: "integer", minimum: 0 },
      health: out(ConnectorHealthSchema),
      integration: out(IntegrationSchema),
      manifest: out(ConnectorManifestSchema),
      signalCount: { type: "integer", minimum: 0 },
      signals: { type: "array", items: out(SignalEnvelopeSchema) }
    }
  };
  const dueIntegrationSyncsResponse: JsonSchema = {
    type: "object",
    required: ["integrationIds", "ranAt", "syncedCount"],
    properties: {
      integrationIds: {
        type: "array",
        items: { format: "uuid", type: "string" }
      },
      ranAt: { format: "date-time", type: "string" },
      syncedCount: { type: "integer", minimum: 0 }
    }
  };
  const dueReverificationsResponse: JsonSchema = {
    type: "object",
    required: ["ranAt", "results", "reverifiedCount"],
    properties: {
      ranAt: { format: "date-time", type: "string" },
      results: {
        type: "array",
        items: {
          type: "object",
          required: ["outcome", "remediationId"],
          properties: {
            outcome: { type: "string" },
            remediationId: { format: "uuid", type: "string" }
          }
        }
      },
      reverifiedCount: { type: "integer", minimum: 0 }
    }
  };
  const scopePostureCheckResponse: JsonSchema = {
    type: "object",
    required: ["scopeId", "checks"],
    properties: {
      checks: {
        type: "array",
        items: {
          type: "object",
          required: [
            "exposure",
            "moduleId",
            "outcome",
            "signalCount",
            "validationState"
          ],
          properties: {
            exposure: { type: "boolean" },
            moduleId: { type: "string" },
            outcome: { type: "string" },
            signalCount: { type: "integer", minimum: 0 },
            validationState: { nullable: true, type: "string" }
          }
        }
      },
      scopeId: { format: "uuid", type: "string" }
    }
  };
  const remediationVerificationResponse: JsonSchema = {
    type: "object",
    required: [
      "attackPath",
      "mission",
      "remediation",
      "run",
      "verificationEvent"
    ],
    properties: {
      attackPath: {
        anyOf: [out(AttackPathAssessmentSchema), { type: "null" }]
      },
      mission: out(ValidationMissionSchema),
      remediation: out(RemediationTaskSchema),
      run: out(ValidationRunSchema),
      verificationEvent: out(VerificationEventSchema)
    }
  };
  // Wave E: plan + revalidate only. actionApplied is always false (no config push).
  const autoRevalidateResponse: JsonSchema = {
    type: "object",
    required: [
      "actionApplied",
      "autoExecuted",
      "closedLoop",
      "plan",
      "verification"
    ],
    properties: {
      actionApplied: {
        description:
          "Always false. Auto-revalidate never pushes WAF, security-group, firewall, or other customer configuration.",
        enum: [false],
        type: "boolean"
      },
      autoExecuted: { type: "boolean" },
      closedLoop: { type: "string" },
      plan: out(PrescriptivePlanSchema),
      verification: remediationVerificationResponse
    }
  };
  const evidenceDownloadResponse: JsonSchema = {
    type: "object",
    required: [
      "artifact",
      "computedSha256",
      "content",
      "integrityVerified",
      "recordedSha256"
    ],
    properties: {
      artifact: out(EvidenceArtifactSchema),
      computedSha256: { type: "string" },
      content: { type: "string" },
      integrityVerified: { type: "boolean" },
      recordedSha256: { type: "string" }
    }
  };
  const textResponse: JsonSchema = { type: "string" };
  const objectResponse: JsonSchema = {
    type: "object",
    additionalProperties: true
  };

  return {
    // --- System & public reference ---
    getHealth: { response: out(HealthResponseSchema) },
    getReadiness: { response: out(ReadinessResponseSchema) },
    getMetrics: { response: out(MetricsResponseSchema) },
    getApiReference: { response: out(ApiReferenceDocumentSchema) },
    getDataResidencyOptions: { response: out(DataResidencyOptionsSchema) },
    getDeploymentStatus: { response: out(DeploymentStatusResponseSchema) },
    redirectHealth: {
      responseDescription: "Temporary redirect to the canonical health route.",
      responseStatus: "307"
    },
    getPrometheusMetrics: {
      response: textResponse,
      responseContentTypes: ["text/plain"],
      responseDescription: "Prometheus text exposition metrics."
    },
    getOpenApiDocument: {
      response: objectResponse,
      responseDescription: "OpenAPI 3 document for the Periscan API."
    },

    // --- Product experience ---
    getProductActivationState: {
      response: out(ProductActivationStateSchema)
    },
    getProductWorkQueue: { response: out(ProductWorkQueueSchema) },
    getBlueShiftBrief: { response: out(BlueShiftBriefSchema) },
    updateProductExperienceProfile: {
      request: inp(UpdateProductExperienceProfileInputSchema),
      response: out(ProductExperienceProfileSchema)
    },
    submitProductFeedback: {
      request: inp(SubmitProductFeedbackInputSchema),
      response: out(ProductFeedbackSchema),
      responseStatus: "201"
    },

    // --- Auth & current session ---
    signup: { request: inp(SignupInputSchema), response: authPayloadResponse },
    login: { request: inp(LoginInputSchema), response: authPayloadResponse },
    startTenantSsoLogin: {
      request: inp(StartTenantSsoLoginInputSchema),
      response: out(TenantSsoLoginStartResultSchema)
    },
    completeTenantSsoLogin: {
      request: inp(CompleteTenantSsoLoginInputSchema),
      response: authPayloadResponse
    },
    completeTenantSsoLoginPost: {
      request: inp(CompleteTenantSsoLoginInputSchema),
      response: authPayloadResponse
    },
    requestPasswordReset: {
      request: inp(PasswordResetRequestSchema),
      response: messageResponse,
      responseStatus: "202"
    },
    confirmPasswordReset: {
      request: inp(PasswordResetConfirmSchema),
      response: messageResponse
    },
    changePassword: {
      request: inp(ChangePasswordInputSchema),
      response: messageResponse
    },
    revokeOtherSessions: { response: messageResponse },
    acceptInvite: {
      request: inp(AcceptInviteSchema),
      response: messageResponse
    },
    verifyEmail: {
      request: inp(VerifyEmailSchema),
      response: messageResponse
    },
    enrollMfa: { response: mfaEnrollResponse },
    verifyMfa: {
      request: inp(MfaVerifyInputSchema),
      response: mfaVerifyResponse
    },
    regenerateMfaRecoveryCodes: {
      request: inp(MfaReauthenticationInputSchema),
      response: mfaRecoveryCodesResponse
    },
    disableMfa: {
      request: inp(MfaReauthenticationInputSchema),
      response: mfaDisableResponse
    },
    logout: {
      responseDescription: "Session cookie cleared.",
      responseStatus: "204"
    },
    getCurrentUser: { response: authPayloadResponse },
    inviteToTenant: {
      request: inp(InviteInputSchema),
      response: {
        type: "object",
        properties: {
          membership: out(MembershipSchema),
          user: out(UserSchema)
        }
      }
    },

    // --- Tenant ---
    getCurrentTenant: { response: out(TenantSchema) },
    listClientTenants: { response: listOf(out(TenantSchema)) },
    getClientPortfolio: { response: out(MSSPClientPortfolioSchema) },
    createClientTenant: { request: inp(CreateClientTenantInputSchema) },
    getTenantBranding: { response: out(TenantReportBrandingSchema) },
    getTenantLocalization: { response: out(TenantLocalizationSchema) },
    getTenantLocalizationWorkspace: {
      response: out(TenantLocalizationWorkspaceSchema)
    },
    previewTenantLocalization: {
      request: inp(PreviewTenantLocalizationInputSchema),
      response: out(LocalizationFormatPreviewSchema)
    },
    updateTenantLocalization: {
      request: inp(UpdateTenantLocalizationInputSchema),
      response: out(TenantLocalizationSchema)
    },
    updateTenantBranding: {
      request: inp(UpdateTenantBrandingInputSchema),
      response: out(TenantReportBrandingSchema)
    },
    getTenantRequireMfa: { response: out(TenantRequireMfaSettingsSchema) },
    setTenantRequireMfa: {
      request: inp(SetTenantRequireMfaInputSchema),
      response: out(TenantRequireMfaSettingsSchema)
    },
    getTenantSsoConfig: { response: out(TenantSsoConfigResponseSchema) },
    updateTenantSsoConfig: {
      request: inp(UpdateTenantSsoConfigInputSchema),
      response: out(TenantSsoConfigSchema)
    },
    disableTenantSsoConfig: {
      responseDescription: "Tenant SSO configuration disabled.",
      responseStatus: "204"
    },
    buildTenantSsoAuthorizationUrl: {
      parameters: [
        stringQueryParameter(
          "loginHint",
          "Optional user email hint passed to the OIDC provider."
        ),
        queryParameter({
          description:
            "Caller-generated nonce that must be persisted for callback verification.",
          in: "query",
          name: "nonce",
          required: true,
          schema: { maxLength: 512, minLength: 8, type: "string" }
        }),
        queryParameter({
          description: "Optional OIDC prompt value.",
          in: "query",
          name: "prompt",
          schema: {
            enum: ["none", "login", "consent", "select_account"],
            type: "string"
          }
        }),
        queryParameter({
          description: "Optional callback redirect URI override.",
          in: "query",
          name: "redirectUri",
          schema: { format: "uri", type: "string" }
        }),
        queryParameter({
          description:
            "Caller-generated state that must be persisted for callback verification.",
          in: "query",
          name: "state",
          required: true,
          schema: { maxLength: 512, minLength: 8, type: "string" }
        })
      ],
      response: out(TenantSsoAuthorizationUrlSchema)
    },
    getTenantSsoMetadata: {
      response: {
        type: "string",
        description: "SAML 2.0 service-provider metadata XML."
      }
    },
    getDesignPartnerWorkspace: { response: out(DesignPartnerWorkspaceSchema) },
    updateDesignPartnerSettings: {
      request: inp(UpdateDesignPartnerSettingsInputSchema),
      response: out(TenantDesignPartnerSettingsSchema)
    },
    appendDesignPartnerSessionNote: {
      request: inp(AppendDesignPartnerSessionNoteInputSchema),
      response: out(DesignPartnerSessionNoteSchema)
    },
    getExecutiveTrends: { response: out(ExecutiveTrendSummarySchema) },
    getOperationalMetrics: { response: out(TenantOperationalMetricsSchema) },
    getTrustSafetySummary: { response: out(TrustSafetySummarySchema) },

    // --- Modules and OSS ---
    listModules: { response: listOf(out(ModuleManifestSchema)) },
    // getLabCapabilities intentionally omitted: no HTTP route yet (NotConfigured /
    // not shipped). Do not re-add a success payload until `app.ts` mounts it.
    listExternalValidationProfiles: {
      response: listOf(out(ExternalValidationTemplateProfileMetadataSchema))
    },
    getCommunityValidationSuite: {
      response: out(CommunityValidationSuiteResponseSchema)
    },
    getCommunityValidationCompanion: withQueryParameters(
      out(CommunityValidationCompanionSchema),
      [
        uuidQueryParameter(
          "missionId",
          "Community primary mission to reconstruct a Nuclei sibling for."
        )
      ]
    ),
    startCommunityValidation: {
      request: inp(StartCommunityValidationRequestSchema),
      response: out(CommunityValidationStartResultSchema)
    },
    createCommunityMissionRemediations: {
      response: out(CommunityMissionRemediationsResultSchema)
    },
    listOpenSourceTools: withQueryParameters(
      listOf(out(OpenSourceToolCatalogEntrySchema)),
      openSourceCatalogQueryParameters
    ),
    getOpenSourceTool: { response: out(OpenSourceToolCatalogEntrySchema) },
    listOpenSourceCapabilities: withQueryParameters(
      listOf(out(OpenSourceCapabilitySchema)),
      openSourceCatalogQueryParameters
    ),
    listThirdPartyTools: { response: listOf(out(ThirdPartyToolSchema)) },
    getThirdPartyToolCoverageAudit: {
      response: out(ThirdPartyToolCoverageAuditSchema)
    },
    getThirdPartyTool: { response: out(ThirdPartyToolSchema) },
    checkThirdPartyTool: { response: out(ThirdPartyToolSchema) },
    validateThirdPartyToolIntake: {
      request: inp(ToolIntakeManifestRequestSchema),
      response: out(ToolIntakeValidationReportSchema)
    },
    submitThirdPartyToolCandidate: {
      request: inp(ToolIntakeManifestRequestSchema),
      response: out(ThirdPartyToolCandidateSchema)
    },
    importThirdPartyToolCandidates: {
      request: inp(ThirdPartyToolCandidateImportRequestSchema),
      response: out(ThirdPartyToolCandidateImportResponseSchema)
    },
    listThirdPartyToolCandidates: {
      response: listOf(out(ThirdPartyToolCandidateSchema))
    },
    getThirdPartyToolCandidate: {
      response: out(ThirdPartyToolCandidateSchema)
    },
    getThirdPartyToolCandidateReadiness: {
      response: out(ThirdPartyToolCandidateReadinessSchema)
    },
    getThirdPartyToolCandidateReadinessSummary: {
      response: out(ThirdPartyToolCandidateReadinessSummarySchema)
    },
    reviewThirdPartyToolCandidate: {
      request: inp(ReviewThirdPartyToolCandidateRequestSchema),
      response: out(ThirdPartyToolCandidateSchema)
    },
    listThirdPartyToolImplementationWorkOrders: {
      response: listOf(out(ThirdPartyToolImplementationWorkOrderSchema))
    },
    generateThirdPartyToolImplementationWorkOrder: {
      response: out(ThirdPartyToolImplementationWorkOrderSchema)
    },
    getThirdPartyToolImplementationBundle: {
      response: out(ThirdPartyToolImplementationBundleSchema)
    },
    listThirdPartyToolPromotionPackages: {
      response: listOf(out(ThirdPartyToolPromotionPackageSchema))
    },
    generateThirdPartyToolPromotionPackage: {
      response: out(ThirdPartyToolPromotionPackageSchema)
    },
    getThirdPartyToolPromotionHandoff: {
      response: out(ThirdPartyToolPromotionHandoffSchema)
    },
    getThirdPartyToolPromotionCertification: {
      response: out(ThirdPartyToolPromotionCertificationSchema)
    },
    listThirdPartyToolPromotionCertifications: {
      response: listOf(out(ThirdPartyToolPromotionCertificationSchema))
    },
    generateThirdPartyToolPromotionCertification: {
      response: out(ThirdPartyToolPromotionCertificationSchema)
    },
    listThirdPartyToolUpstreamVersionChecks: {
      response: listOf(out(ThirdPartyToolUpstreamVersionCheckSchema))
    },
    checkThirdPartyToolUpstreamVersion: {
      response: out(ThirdPartyToolUpstreamVersionCheckSchema)
    },
    listThirdPartyToolUpdateRecommendations: {
      response: listOf(out(ThirdPartyToolUpdateRecommendationSchema))
    },
    checkThirdPartyToolUpdateRecommendation: {
      response: out(ThirdPartyToolUpdateRecommendationSchema)
    },
    refreshDueThirdPartyTools: {
      request: inp(ThirdPartyToolRefreshDueRequestSchema),
      response: out(ThirdPartyToolRefreshDueResponseSchema)
    },
    applyThirdPartyToolUpdateRecommendation: {
      request: inp(ApplyThirdPartyToolUpdateRequestSchema),
      response: out(ThirdPartyToolUpdateRecommendationSchema)
    },
    dismissThirdPartyToolUpdateRecommendation: {
      request: inp(DismissThirdPartyToolUpdateRequestSchema),
      response: out(ThirdPartyToolUpdateRecommendationSchema)
    },
    installThirdPartyTool: {
      request: inp(ThirdPartyToolInstallRequestSchema),
      response: out(ToolInstallJobSchema)
    },
    uninstallThirdPartyTool: {
      response: out(ToolInstallJobSchema)
    },
    getThirdPartyToolInstallPlan: {
      response: out(ThirdPartyToolInstallPlanSchema)
    },
    acceptToolLicense: {
      request: inp(AcceptToolLicenseRequestSchema),
      response: out(ToolLicenseAcceptanceSchema),
      responseStatus: "201"
    },
    listToolLicenseAcceptances: {
      response: listOf(out(ToolLicenseAcceptanceSchema))
    },
    enableThirdPartyTool: {
      request: inp(ThirdPartyToolEnableRequestSchema),
      response: out(ThirdPartyToolSchema)
    },
    disableThirdPartyTool: {
      request: inp(ThirdPartyToolDisableRequestSchema),
      response: out(ThirdPartyToolSchema)
    },
    listThirdPartyToolJobs: { response: listOf(out(ToolInstallJobSchema)) },
    listThirdPartyToolActivity: withLimitQuery(
      listOf(out(ThirdPartyToolActivityEventSchema))
    ),
    getThirdPartyToolRunnerEligibility: {
      response: out(ThirdPartyToolRunnerEligibilitySchema)
    },
    dispatchThirdPartyToolRunnerTask: {
      request: inp(ThirdPartyToolRunnerDispatchRequestSchema),
      response: out(ThirdPartyToolRunnerDispatchResponseSchema)
    },
    getThirdPartyToolLicenseSummary: {
      response: out(ThirdPartyToolLicenseSummarySchema)
    },
    getExtensionDeveloperWorkspace: {
      response: out(ExtensionDeveloperWorkspaceSchema)
    },
    createExtensionProject: {
      request: inp(CreateExtensionProjectInputSchema),
      response: out(ExtensionProjectSchema),
      responseStatus: "201"
    },
    getExtensionScaffold: { response: out(ExtensionScaffoldSchema) },
    submitExtensionRelease: {
      request: inp(SubmitExtensionReleaseInputSchema),
      response: out(ExtensionReleaseSchema),
      responseStatus: "201"
    },
    reviewExtensionRelease: {
      request: inp(ReviewExtensionReleaseInputSchema),
      response: out(ExtensionReleaseSchema)
    },
    activateExtensionRelease: {
      request: inp(ExtensionLifecycleReasonInputSchema),
      response: out(ExtensionReleaseSchema)
    },
    rollbackExtensionProject: {
      request: inp(RollbackExtensionProjectInputSchema),
      response: out(ExtensionReleaseSchema)
    },
    revokeExtensionRelease: {
      request: inp(ExtensionLifecycleReasonInputSchema),
      response: out(ExtensionReleaseSchema)
    },

    // --- API keys ---
    createApiKey: {
      request: inp(CreateTenantApiKeyInputSchema),
      response: out(TenantApiKeyWithSecretSchema)
    },
    listApiKeys: { response: listOf(out(TenantApiKeySchema)) },
    revokeApiKey: { response: out(TenantApiKeySchema) },
    rotateApiKey: { response: out(TenantApiKeyWithSecretSchema) },

    // --- Webhooks ---
    listWebhooks: { response: listOf(out(TenantWebhookSchema)) },
    // P20-5 / O13: event catalog mounted (discoverable event types + headers).
    getWebhookEventCatalog: { response: out(WebhookEventCatalogSchema) },
    // rotateWebhookSecret + redriveWebhookDelivery are mounted (P20-4 closeout).
    createWebhook: {
      request: inp(CreateTenantWebhookInputSchema),
      response: out(TenantWebhookWithSecretSchema)
    },
    updateWebhook: {
      request: inp(UpdateTenantWebhookInputSchema),
      response: out(TenantWebhookSchema)
    },
    testWebhook: {
      response: webhookTestResponse,
      responseStatus: "202"
    },
    rotateWebhookSecret: {
      response: out(TenantWebhookWithSecretSchema)
    },
    redriveWebhookDelivery: {
      response: {
        type: "object",
        required: ["deliveryId", "status"],
        properties: {
          deliveryId: { format: "uuid", type: "string" },
          status: {
            enum: ["Pending", "Delivered", "Failed"],
            type: "string"
          }
        }
      } satisfies JsonSchema,
      responseStatus: "202"
    },
    listWebhookDeliveries: withQueryParameters(
      listOf(out(WebhookDeliverySchema)),
      [
        uuidQueryParameter(
          "webhookId",
          "Optional webhook ID to filter delivery attempts."
        )
      ]
    ),
    listDeadLetteredWebhookDeliveries: {
      response: listOf(out(WebhookDeliverySchema))
    },
    deleteWebhook: {
      responseDescription: "Webhook deleted.",
      responseStatus: "204"
    },

    // --- Approvals ---
    listPendingApprovals: { response: listOf(out(PolicyDecisionSchema)) },
    listPolicyDecisions: withQueryParameters(
      listOf(out(PolicyDecisionSchema)),
      [
        limitQueryParameter(),
        queryParameter({
          description: "Optional validation mission type filter.",
          in: "query",
          name: "missionType",
          schema: {
            enum: [
              "ValidationSnapshot",
              "ExposureValidation",
              "ControlValidation",
              "AIAppValidation",
              "FixVerification",
              "ContinuousValidation"
            ],
            type: "string"
          }
        }),
        queryParameter({
          description: "Optional policy decision outcome filter.",
          in: "query",
          name: "outcome",
          schema: {
            enum: [
              "Allowed",
              "Denied",
              "RequiresApproval",
              "RequiresVerifiedScope",
              "RequiresInternalRunner",
              "RequiresTimeWindow"
            ],
            type: "string"
          }
        }),
        uuidQueryParameter("scopeId", "Optional scope ID filter.")
      ]
    ),
    approvePolicyDecision: { response: out(PolicyDecisionSchema) },
    denyPolicyDecision: { response: out(PolicyDecisionSchema) },
    createAuditExport: { request: inp(AuditExportInputSchema) },
    getAuditExport: {
      response: textResponse,
      responseContentTypes: ["application/json", "text/csv"],
      responseDescription: "Previously generated audit export content."
    },

    // --- Model gateway: providers ---
    listModelProviders: { response: listOf(out(ModelProviderSchema)) },
    createModelProvider: {
      request: inp(CreateModelProviderInputSchema),
      response: out(ModelProviderSchema)
    },
    getModelProvider: { response: out(ModelProviderSchema) },
    updateModelProvider: {
      request: inp(UpdateModelProviderInputSchema),
      response: out(ModelProviderSchema)
    },
    deleteModelProvider: {
      responseDescription: "Model provider deleted.",
      responseStatus: "204"
    },
    testModelProviderConnection: {
      response: out(ModelProviderConnectionTestResultSchema)
    },

    // --- Model gateway: policies & tools ---
    listModelPolicyProfiles: {
      response: listOf(out(ModelPolicyProfileSchema))
    },
    createModelPolicyProfile: {
      request: inp(CreateModelPolicyProfileInputSchema),
      response: out(ModelPolicyProfileSchema)
    },
    getModelPolicyProfile: { response: out(ModelPolicyProfileSchema) },
    updateModelPolicyProfile: {
      request: inp(UpdateModelPolicyProfileInputSchema),
      response: out(ModelPolicyProfileSchema)
    },
    deleteModelPolicyProfile: {
      responseDescription: "Model policy profile deleted.",
      responseStatus: "204"
    },
    listModelTools: { response: listOf(out(ModelToolSchema)) },
    updateModelTool: {
      request: inp(UpdateModelToolInputSchema),
      response: out(ModelToolSchema)
    },

    // --- Model gateway: sessions ---
    listModelSessions: { response: listOf(out(ModelSessionSchema)) },
    createModelSession: {
      request: inp(CreateModelSessionInputSchema),
      response: out(ModelSessionSchema)
    },
    getModelSession: { response: out(ModelSessionSchema) },
    startModelSession: { response: out(ModelSessionSchema) },
    pauseModelSession: { response: out(ModelSessionSchema) },
    terminateModelSession: { response: out(ModelSessionSchema) },
    enqueueModelSessionTurn: {
      request: inp(CreateModelSessionTurnInputSchema),
      response: out(ModelSessionTurnAcceptedSchema)
    },
    listModelSessionTurns: { response: listOf(out(ModelUsageEventSchema)) },
    listContextBundles: { response: listOf(out(ContextBundleSchema)) },
    createContextBundle: {
      request: inp(CreateContextBundleInputSchema),
      response: out(ContextBundleSchema)
    },
    getContextBundle: { response: out(ContextBundleSchema) },

    // --- Model gateway: tool requests ---
    listModelToolRequests: { response: listOf(out(ModelToolRequestSchema)) },
    createModelToolRequest: {
      request: inp(CreateModelToolRequestInputSchema),
      response: out(ModelToolRequestSchema)
    },
    getModelToolRequest: { response: out(ModelToolRequestSchema) },
    approveModelToolRequest: { response: out(ModelToolRequestSchema) },
    denyModelToolRequest: { response: out(ModelToolRequestSchema) },
    cancelModelToolRequest: { response: out(ModelToolRequestSchema) },
    executeModelToolRequest: { response: out(ModelToolRequestSchema) },
    listModelGatewayAuditEvents: withQueryParameters(
      listOf(out(ModelGatewayAuditEventSchema)),
      [
        uuidQueryParameter(
          "modelSessionId",
          "Optional model session ID to filter gateway audit events."
        )
      ]
    ),
    activateModelGatewayKillSwitch: { response: out(KillSwitchResultSchema) },
    getAgentBehaviorAnalysis: { response: out(AgentBehaviorAnalysisSchema) },

    // --- Jobs ---
    listJobs: withQueryParameters(listOf(out(JobSchema)), [
      limitQueryParameter({ maximum: 200 }),
      uuidQueryParameter("missionId", "Optional mission ID filter."),
      queryParameter({
        description: "Optional validation job status filter.",
        in: "query",
        name: "status",
        schema: {
          enum: [
            "Queued",
            "Running",
            "Completed",
            "Failed",
            "DeniedByPolicy",
            "RequiresApproval",
            "Cancelled"
          ],
          type: "string"
        }
      })
    ]),
    getJob: { response: out(JobSchema) },

    // --- Signal triggers ---
    listSignalTriggers: { response: listOf(out(SignalTriggerRuleSchema)) },
    evaluateSignalTriggers: {
      response: out(SignalTriggerEvaluationResponseSchema)
    },
    getSignalTriggerRouting: {
      response: out(SignalTriggerRoutingSettingsSchema)
    },
    updateSignalTriggerRouting: {
      request: inp(UpdateSignalTriggerRoutingSettingsInputSchema),
      response: out(SignalTriggerRoutingSettingsSchema)
    },
    approveSignalTrigger: {
      response: out(SignalTriggerApprovalResponseSchema)
    },
    listSignalTriggerActivity: withLimitQuery(
      listOf(out(SignalTriggerActivitySchema))
    ),

    // --- Threat advisories / feeds ---
    importThreatAdvisory: {
      request: inp(ImportThreatAdvisoryInputSchema),
      response: out(ThreatAdvisoryDetailSchema)
    },
    listThreatAdvisories: withLimitQuery(listOf(out(ThreatAdvisorySchema))),
    ingestThreatFeed: {
      request: inp(ThreatFeedIngestionInputSchema),
      response: out(ThreatFeedIngestionResultSchema)
    },
    setThreatFeedSchedule: {
      request: inp(ThreatFeedScheduleInputSchema),
      response: threatFeedScheduleResponse
    },
    getThreatFeedSchedule: { response: threatFeedScheduleResponse },
    runDueThreatFeedIngestion: {
      response: threatFeedDueIngestionResponse
    },
    getAdvisoryReadinessReport: {
      response: out(AdvisoryReadinessReportSchema)
    },
    exportAdvisoryReadinessReport: {
      request: inp(ExportReportInputSchema),
      response: textResponse,
      responseContentTypes: ["text/html", "application/pdf"],
      responseDescription: "Threat advisory readiness report export attachment."
    },
    getThreatAdvisory: { response: out(ThreatAdvisoryDetailSchema) },
    listThreatCatalog: withQueryParameters(listOf(out(ThreatIntelItemSchema)), [
      queryParameter({
        description: "Optional threat-intel item kind filter.",
        in: "query",
        name: "kind",
        schema: {
          enum: ["Vulnerability", "Indicator", "Advisory"],
          type: "string"
        }
      }),
      queryParameter({
        description: "Optional severity filter.",
        in: "query",
        name: "severity",
        schema: {
          enum: ["Critical", "High", "Medium", "Low", "None", "Unknown"],
          type: "string"
        }
      }),
      queryParameter({
        description: "Filter catalog items by CISA KEV status.",
        in: "query",
        name: "kev",
        schema: { type: "boolean" }
      }),
      stringQueryParameter(
        "q",
        "Optional search text for title, canonical key, IoC, or CVE."
      ),
      limitQueryParameter({ maximum: 200 })
    ]),
    getThreatFeedStatus: { response: listOf(out(ThreatFeedStatusSchema)) },
    listThreatAlerts: withQueryParameters(
      listOf(out(TenantThreatAlertSchema)),
      [
        queryParameter({
          description: "Optional tenant threat-alert status filter.",
          in: "query",
          name: "status",
          schema: {
            enum: ["New", "Acknowledged", "Dismissed"],
            type: "string"
          }
        }),
        limitQueryParameter({ defaultValue: 100, maximum: 200 })
      ]
    ),
    setThreatAlertStatus: {
      request: inp(SetThreatAlertStatusInputSchema),
      response: out(TenantThreatAlertSchema)
    },

    // --- MITRE ATT&CK and operators ---
    listAttackTechniques: { response: listOf(out(AttackTechniqueSchema)) },
    getAttackTechnique: { response: out(AttackTechniqueSchema) },
    listOperators: { response: listOf(out(OperatorProfileSchema)) },
    listOperatorRecommendationRecords: {
      response: listOf(out(OperatorRecommendationRecordSchema))
    },
    createOperatorRecommendationRecord: {
      request: inp(CreateOperatorRecommendationRecordInputSchema),
      response: out(OperatorRecommendationRecordSchema)
    },
    listOperatorRecommendations: {
      response: listOf(out(OperatorRecommendationSchema))
    },
    approveOperatorRecommendation: {
      response: operatorRecommendationApprovalResponse
    },

    // --- Evidence summaries ---
    generateEvidenceSummary: {
      request: inp(GenerateEvidenceSummaryInputSchema)
    },

    // --- Integrations ---
    getIntegrationCatalog: {
      response: listOf(out(ConnectorCatalogEntrySchema))
    },
    listIntegrations: { response: listOf(out(IntegrationSchema)) },
    getIntegration: { response: out(IntegrationSchema) },
    getIntegrationHealth: { response: out(ConnectorHealthSchema) },
    createIntegration: {
      request: inp(CreateIntegrationInputSchema),
      response: out(IntegrationSchema)
    },
    setIntegrationSyncSchedule: { response: out(IntegrationSchema) },
    connectGithubIntegration: {
      request: inp(GitHubConnectInputSchema),
      response: out(IntegrationSchema)
    },
    connectAwsIntegration: {
      request: inp(AwsConnectInputSchema),
      response: out(IntegrationSchema)
    },
    connectJiraMockIntegration: {
      request: inp(JiraConnectInputSchema),
      response: out(IntegrationSchema)
    },
    syncIntegration: { response: integrationSyncResultResponse },
    runDueIntegrationSyncs: { response: dueIntegrationSyncsResponse },
    deleteIntegration: {},

    // --- Audit events ---
    listAuditEvents: withQueryParameters(
      offsetListOf(out(AuditEventSchema)),
      [
        limitQueryParameter(),
        offsetQueryParameter({ maximum: 1_000_000 }),
        stringQueryParameter("action", "Optional audit action filter."),
        stringQueryParameter("actorType", "Optional actor type filter."),
        uuidQueryParameter("entityId", "Optional related entity ID filter."),
        stringQueryParameter(
          "entityType",
          "Optional related entity type filter."
        ),
        queryParameter({
          description: "Optional lower bound for audit event creation time.",
          in: "query",
          name: "from",
          schema: dateTimeQuerySchema
        }),
        queryParameter({
          description: "Optional upper bound for audit event creation time.",
          in: "query",
          name: "to",
          schema: dateTimeQuerySchema
        }),
        uuidQueryParameter("userId", "Optional actor user ID filter.")
      ]
    ),

    // --- Scopes ---
    listScopes: { response: listOf(out(ScopeSchema)) },
    createScope: withIdempotencyKey({
      request: inp(CreateScopeInputSchema),
      response: out(ScopeSchema),
      responseStatus: "201"
    }),
    getScope: { response: out(ScopeSchema) },
    updateScopeClassification: {
      request: inp(UpdateScopeClassificationInputSchema),
      response: out(ScopeSchema)
    },
    verifyScope: {
      request: inp(VerifyScopeInputSchema),
      response: out(ScopeSchema)
    },
    deleteScope: {
      responseDescription: "Scope deleted.",
      responseStatus: "204"
    },
    previewScopePolicyDecision: {
      request: inp(PolicyPreviewInputSchema),
      response: out(PolicyDecisionSchema)
    },
    runScopePostureChecks: {
      request: inp(ScopePostureCheckInputSchema),
      response: scopePostureCheckResponse,
      responseStatus: "201"
    },

    // --- Missions & runs ---
    createMission: withIdempotencyKey({
      request: inp(CreateMissionInputSchema),
      response: out(ValidationMissionSchema),
      responseStatus: "201"
    }),
    listMissions: withQueryParameters(
      cursorListOf(out(ValidationMissionSchema)),
      [
        uuidQueryParameter(
          "cursor",
          "Optional mission ID cursor from a previous response's nextCursor."
        ),
        limitQueryParameter({ maximum: 200 })
      ]
    ),
    getMission: { response: out(ValidationMissionSchema) },
    getMissionRun: { response: out(ValidationRunSchema) },
    waitMissionRun: withQueryParameters(out(ValidationRunSchema), [
      queryParameter({
        description:
          "Maximum time to wait for a terminal run status in milliseconds. Defaults to 30000; capped at 60000. Returns 200 with the run when terminal, or 408 with the current run state on timeout.",
        in: "query",
        name: "timeoutMs",
        schema: {
          default: 30_000,
          maximum: 60_000,
          minimum: 0,
          type: "integer"
        }
      })
    ]),
    startMission: withIdempotencyKey({
      request: inp(StartMissionInputSchema)
    }),
    cancelMission: { response: out(ValidationMissionSchema) },
    listMissionRuns: { response: listOf(out(ValidationRunSchema)) },

    // --- Findings ---
    listFindings: withQueryParameters(
      offsetListOf(out(ValidatedFindingSchema)),
      [
        limitQueryParameter({ defaultValue: 100, maximum: 100 }),
        offsetQueryParameter(),
        stringQueryParameter(
          "assetId",
          "Optional related asset ID filter (UUID)."
        ),
        stringQueryParameter(
          "disposition",
          "Optional disposition filter. Use a disposition enum value, or `none` for un-dispositioned findings."
        ),
        stringQueryParameter(
          "excludeDisposition",
          "Optional comma-separated dispositions to exclude (e.g. Active queue: FalsePositive,Suppressed)."
        ),
        stringQueryParameter(
          "exploitability",
          "Optional exploitability state filter."
        ),
        stringQueryParameter(
          "owner",
          "Optional operational owner filter: member UUID, or `unassigned` (no finding.ownerId / ownerDisplay; disposition.ownerId alone does not count)."
        ),
        stringQueryParameter(
          "priorityMin",
          "Optional minimum priority score (0-100)."
        ),
        stringQueryParameter(
          "search",
          "Optional free-text search over title, impact, and remediation."
        ),
        stringQueryParameter("severity", "Optional severity filter."),
        stringQueryParameter("sourceMotion", "Optional source motion filter."),
        stringQueryParameter("status", "Optional finding workflow status filter."),
        stringQueryParameter(
          "validationState",
          "Optional evidence-strength validation state filter."
        )
      ]
    ),
    getFinding: { response: out(ValidatedFindingSchema) },
    listDispositionFeedback: {
      response: out(DispositionFeedbackSummarySchema)
    },
    approveFindingRisk: { response: out(ValidatedFindingSchema) },
    // bulkTransitionFindings omitted: no public HTTP route (UI loops single
    // transitionFinding). Schema remains in @periscan/shared for a future mount.
    createControlGapRemediation: {
      request: inp(CreateControlGapRemediationInputSchema),
      response: out(RemediationTaskSchema),
      responseStatus: "201"
    },

    // --- Assets & financial assumptions ---
    listAssets: { response: listOf(out(AssetSchema)) },
    getAssetLineage: { response: out(AssetLineageSchema) },
    getBusinessImpactWorkspace: {
      response: out(BusinessImpactWorkspaceSchema)
    },
    getAsyncOperationsWorkspace: {
      response: out(AsyncOperationsWorkspaceSchema)
    },
    updateAsyncOperationsPolicy: {
      request: inp(AsyncOperationsPolicyInputSchema),
      response: out(AsyncOperationsWorkspaceSchema)
    },
    reconcileAsyncOperations: {
      request: inp(AsyncOperationsReasonInputSchema),
      response: out(AsyncOperationsReconcileResultSchema)
    },
    recordAsyncRecoveryDecision: {
      request: inp(AsyncRecoveryDecisionInputSchema),
      response: out(AsyncRecoveryDecisionResultSchema)
    },
    previewAssetValuation: {
      request: inp(SubmitAssetValuationVersionInputSchema),
      response: out(BusinessImpactPreviewSchema)
    },
    submitAssetValuationVersion: {
      request: inp(SubmitAssetValuationVersionInputSchema),
      response: out(AssetValuationVersionSchema),
      responseStatus: "201"
    },
    reviewAssetValuationVersion: {
      request: inp(ReviewAssetValuationVersionInputSchema),
      response: out(AssetValuationVersionSchema)
    },

    // --- Attack paths ---
    // Runtime returns bare `{ items }` (no page/offset). Keep OAS honest (P20-2).
    listAttackPaths: withQueryParameters(
      listOf(out(AttackPathAssessmentSchema)),
      [limitQueryParameter({ defaultValue: 50, maximum: 200 })]
    ),
    getAttackPathChokePointAnalysis: {
      response: out(AttackPathChokePointAnalysisSchema)
    },
    getAttackPath: { response: out(AttackPathAssessmentSchema) },
    requestAttackPathVerification: {
      request: inp(VerifyAttackPathInputSchema),
      response: out(AttackPathVerificationRequestSchema),
      responseStatus: "201"
    },
    listAttackPathEvidence: { response: listOf(out(EvidenceArtifactSchema)) },
    getAttackPathValidationPlan: {
      response: out(AttackPathValidationPlanSchema)
    },
    listAttackPathEdgeReceipts: {
      response: listOf(out(PathEdgeReceiptSchema))
    },
    getAttackPathMeasurementState: {
      response: out(AttackPathMeasurementStateSchema)
    },
    getAttackPathNextMission: {
      response: {
        type: "object",
        additionalProperties: false,
        required: ["recommendation"],
        properties: {
          recommendation: {
            anyOf: [
              out(DynamicPathMissionRecommendationSchema),
              { type: "null" }
            ]
          }
        }
      }
    },
    approveAttackPathNextMission: {
      response: {
        type: "object",
        additionalProperties: false,
        required: ["decision", "mission", "queued", "recommendation"],
        properties: {
          decision: { type: "object", additionalProperties: true },
          mission: { type: "object", additionalProperties: true },
          queued: { type: "boolean", const: false },
          recommendation: out(DynamicPathMissionRecommendationSchema)
        }
      },
      responseStatus: "201"
    },
    applyPathEdgeReceipt: {
      request: inp(ApplyPathEdgeReceiptInputSchema),
      response: out(ApplyPathEdgeReceiptResultSchema),
      responseStatus: "201"
    },
    launchPathEdgeValidation: {
      request: inp(LaunchPathEdgeValidationInputSchema),
      response: out(PathEdgeValidationLaunchResultSchema),
      responseStatus: "201"
    },

    // --- Remediations ---
    // Runtime returns bare `{ items }` (no page/offset). Keep OAS honest (P20-2).
    listRemediations: withQueryParameters(
      listOf(out(RemediationTaskSchema)),
      [limitQueryParameter({ defaultValue: 50, maximum: 200 })]
    ),
    createRemediation: withIdempotencyKey({
      request: inp(CreateRemediationInputSchema),
      response: out(RemediationTaskSchema),
      responseStatus: "201"
    }),
    getRemediation: { response: out(RemediationTaskSchema) },
    createRemediationTicket: withIdempotencyKey({
      request: inp(CreateRemediationTicketInputSchema),
      response: out(RemediationTicketSchema)
    }),
    syncRemediationTicket: {
      request: inp(SyncRemediationTicketInputSchema),
      response: out(RemediationTicketStateSchema)
    },
    listRemediationActions: {
      response: listOf(out(RemediationActionSchema))
    },
    previewRemediationAction: {
      request: inp(PreviewRemediationActionInputSchema),
      response: out(RemediationActionSchema),
      responseStatus: "201"
    },
    approveRemediationAction: {
      request: inp(ConfirmRemediationActionInputSchema),
      response: out(RemediationActionSchema)
    },
    executeRemediationAction: {
      request: inp(ConfirmRemediationActionInputSchema),
      response: out(RemediationActionSchema)
    },
    rollbackRemediationAction: {
      request: inp(ConfirmRemediationActionInputSchema),
      response: out(RemediationActionSchema)
    },
    listInfrastructureChanges: {
      response: listOf(out(InfrastructureChangeRequestSchema))
    },
    previewInfrastructureChange: {
      request: inp(PreviewInfrastructureChangeInputSchema),
      response: out(InfrastructureChangeRequestSchema),
      responseStatus: "201"
    },
    approveInfrastructureChange: {
      request: inp(ConfirmInfrastructureChangeInputSchema),
      response: out(InfrastructureChangeRequestSchema)
    },
    executeInfrastructureChange: {
      request: inp(ConfirmInfrastructureChangeInputSchema),
      response: out(InfrastructureChangeRequestSchema)
    },
    refreshInfrastructureChange: {
      response: out(InfrastructureChangeRequestSchema)
    },
    rollbackInfrastructureChange: {
      request: inp(ConfirmInfrastructureChangeInputSchema),
      response: out(InfrastructureChangeRequestSchema)
    },
    markRemediationReadyForVerification: {
      response: out(RemediationTaskSchema)
    },
    // Wave E: preferred auto-revalidate + deprecated auto-mitigate alias.
    // Both return actionApplied:false (plan + re-measure only; no config push).
    getPrescriptivePlan: { response: out(PrescriptivePlanSchema) },
    autoRevalidate: { response: autoRevalidateResponse },
    autoMitigate: { response: autoRevalidateResponse },
    verifyRemediation: withIdempotencyKey({
      response: remediationVerificationResponse
    }),
    runDueReverifications: { response: dueReverificationsResponse },
    listRemediationVerificationEvents: {
      response: listOf(out(VerificationEventSchema))
    },

    // --- AI applications ---
    listAIApplications: { response: listOf(out(AIApplicationSchema)) },
    listAIAppValidationSuites: {
      response: listOf(out(AIAppValidationSuiteDefinitionSchema))
    },
    createAIApplication: {
      request: inp(CreateAIApplicationInputSchema),
      response: out(AIApplicationSchema)
    },
    getAIApplication: { response: out(AIApplicationSchema) },
    validateAIApplication: { request: inp(ValidateAIApplicationInputSchema) },
    setAIValidationKillSwitch: {
      request: inp(SetAIValidationKillSwitchInputSchema),
      response: out(AIApplicationSchema)
    },
    listAIApplicationHistory: { response: listOf(out(ValidationRunSchema)) },

    // --- Control sources ---
    listControlSources: { response: listOf(out(ControlSourceSchema)) },
    listValidationStimuli: { response: listOf(out(ValidationStimulusSchema)) },
    createValidationStimulus: {
      request: inp(CreateValidationStimulusInputSchema),
      response: out(CreateValidationStimulusResponseSchema),
      responseStatus: "201"
    },
    dispatchValidationStimulus: { response: out(ValidationStimulusSchema) },
    observeValidationStimulus: { response: out(ValidationStimulusSchema) },
    cancelValidationStimulus: { response: out(ValidationStimulusSchema) },
    listControlValidationScenarios: {
      response: listOf(out(ControlValidationScenarioDefinitionSchema))
    },
    getControlRuleCoverage: {
      response: out(ControlRuleCoverageSummarySchema)
    },
    createControlSource: {
      request: inp(CreateControlSourceInputSchema),
      response: out(ControlSourceSchema)
    },
    getControlSource: { response: out(ControlSourceSchema) },
    getControlSourceRuleCoverage: {
      response: out(ControlRuleCoverageSummarySchema)
    },
    validateControlSource: { request: inp(ValidateControlSourceInputSchema) },
    // Wave B: allowlisted benign-marker emit→observe DRV proof (not full BAS).
    // Shared Zod pins drvClaimClass=benign_marker_only and fullAttackLibrary=false.
    runDetectionMarkerProof: {
      request: inp(DetectionMarkerProofInputSchema),
      response: out(DetectionMarkerProofResultSchema)
    },
    // Phase C: DNS-exfil detection canary (benign marker only; never real exfil).
    runDnsExfilCanaryProof: {
      request: inp(DnsExfilCanaryProofInputSchema),
      response: out(DnsExfilCanaryProofResultSchema)
    },
    listSafetyEquivalentPacks: {
      response: out(SafetyEquivalentPacksResponseSchema)
    },
    getExecutionIntegrityHonesty: {
      response: out(ExecutionIntegrityHonestySchema)
    },
    getModelExtractionHonesty: {
      response: out(ModelExtractionHonestySchema)
    },
    getPartnerCapabilityHonesty: {
      response: out(PartnerCapabilityHonestySchema)
    },
    getComplianceGovernanceSummary: {
      response: out(ComplianceGovernanceMultiFrameworkSummarySchema)
    },
    batchUpdateComplianceGovernance: {
      request: inp(BatchComplianceGovernanceInputSchema),
      response: out(BatchComplianceGovernanceResultSchema)
    },
    exportMultiFrameworkCompliancePacks: {
      request: inp(MultiFrameworkComplianceExportInputSchema),
      response: out(MultiFrameworkComplianceExportResultSchema),
      responseStatus: "201"
    },
    listControlSourceHistory: { response: listOf(out(ValidationRunSchema)) },

    // --- Engagements ---
    runEngagement: {
      request: inp(EngagementRunRequestSchema),
      response: out(EngagementResultSchema)
    },
    listEngagements: { response: listOf(out(EngagementResultSchema)) },
    getEngagement: { response: out(EngagementResultSchema) },
    getEngagementCollaboration: {
      response: out(EngagementCollaborationReadResponseSchema)
    },
    initializeEngagementCollaboration: {
      request: inp(InitializeEngagementWorkspaceInputSchema),
      response: out(EngagementCollaborationSnapshotSchema),
      responseStatus: "201"
    },
    upsertEngagementCollaborator: {
      request: inp(UpsertEngagementCollaboratorInputSchema),
      response: out(EngagementCollaborationSnapshotSchema)
    },
    appendEngagementCollaborationEvent: {
      request: inp(CreateEngagementCollaborationEventInputSchema),
      response: out(EngagementCollaborationSnapshotSchema),
      responseStatus: "201"
    },

    // --- Scenario compiler ---
    compileScenario: {
      request: inp(CompileScenarioInputSchema),
      response: out(CompileScenarioResponseSchema),
      responseStatus: "201"
    },
    listScenarioBundles: { response: listOf(out(ScenarioBundleSchema)) },
    getScenarioBundle: { response: out(ScenarioBundleSchema) },
    approveScenarioBundle: { response: out(ScenarioBundleSchema) },
    executeScenarioBundle: {
      request: inp(ExecuteScenarioInputSchema),
      response: out(ScenarioExecutionResultSchema),
      responseStatus: "201"
    },
    stopScenarioFeedback: {
      request: inp(StopScenarioFeedbackInputSchema),
      response: out(ScenarioBundleSchema)
    },

    // --- Evidence ---
    // Runtime accepts optional `?limit=` and returns bare `{ items }` (P20-2).
    listEvidence: withQueryParameters(
      listOf(out(EvidenceArtifactSchema)),
      [limitQueryParameter()]
    ),
    getEvidence: { response: out(EvidenceArtifactSchema) },
    verifyEvidenceChain: {
      response: out(EvidenceChainVerificationReportSchema)
    },
    verifyEvidenceIntegrity: {
      response: out(EvidenceArtifactVerificationSchema)
    },
    downloadEvidence: { response: evidenceDownloadResponse },
    redactEvidence: { response: out(EvidenceArtifactSchema) },

    // --- Reports ---
    listReports: withLimitQuery(listOf(out(EvidencePackSchema))),
    createReport: {
      request: inp(CreateReportInputSchema),
      response: out(EvidencePackSchema)
    },
    getReport: { response: out(EvidencePackSchema) },
    getEvidencePack: { response: out(EvidencePackSchema) },
    exportReport: {
      request: inp(ExportReportInputSchema),
      response: textResponse,
      responseContentTypes: ["text/html", "application/pdf"],
      responseDescription: "Report export attachment."
    },
    createReportShareLink: { response: out(ReportShareLinkSchema) },
    listReportShareLinks: { response: listOf(out(ReportShareGrantSchema)) },
    revokeReportShareLink: { response: out(ReportShareGrantSchema) },
    getSharedReport: {
      response: textResponse,
      responseContentTypes: ["text/html"],
      responseDescription: "Public shared report HTML."
    },
    getReportAnalystNote: { response: out(DesignPartnerReportNoteSchema) },
    updateReportAnalystNote: {
      request: inp(UpdateReportAnalystNoteInputSchema),
      response: out(DesignPartnerReportNoteSchema)
    },

    // --- Runners ---
    createRunnerRegistrationToken: {
      request: inp(RunnerRegistrationTokenIssueRequestSchema),
      response: out(RunnerRegistrationTokenIssueResponseSchema)
    },
    registerRunner: { request: inp(RunnerRegistrationRequestSchema) },
    listRunners: { response: listOf(out(RunnerRecordSchema)) },
    listRunnerTransportDecisions: {
      response: listOf(out(RunnerTransportDecisionSchema))
    },
    getRunner: { response: out(RunnerRecordSchema) },
    revokeRunner: { response: out(RunnerRecordSchema) },
    runnerHeartbeat: {
      request: inp(RunnerHeartbeatSchema),
      response: out(RunnerRecordSchema)
    },
    acknowledgeRunnerControlState: {
      request: inp(RunnerControlStateAcknowledgementSchema),
      response: out(RunnerRecordSchema)
    },
    rotateRunnerCredentials: {
      request: inp(RunnerCredentialRotationRequestSchema),
      response: out(RunnerCredentialRotationResponseSchema)
    },
    pollRunnerTasks: {
      request: inp(RunnerPollRequestSchema),
      response: out(RunnerPollResponseSchema)
    },
    createRunnerReachabilityTask: {
      request: inp(RunnerReachabilityTaskRequestSchema),
      response: out(RunnerTaskRecordSchema),
      responseStatus: "201"
    },
    createRunnerCheckTask: {
      request: inp(RunnerCheckTaskRequestSchema),
      response: out(RunnerTaskRecordSchema),
      responseStatus: "201"
    },
    createRunnerDiscoverTask: {
      request: inp(RunnerDiscoverTaskRequestSchema),
      response: out(RunnerTaskRecordSchema),
      responseStatus: "201"
    },
    createRunnerMeasuredTask: {
      request: inp(RunnerMeasuredTaskRequestSchema),
      response: out(RunnerTaskRecordSchema),
      responseStatus: "201"
    },
    uploadRunnerTaskArtifact: {
      request: inp(RunnerTaskArtifactUploadRequestSchema),
      response: out(RunnerTaskArtifactUploadResponseSchema)
    },
    submitRunnerTaskResult: { request: inp(RunnerTaskResultSchema) },
    setRunnerKillSwitch: {
      request: inp(RunnerKillSwitchRequestSchema),
      response: out(RunnerRecordSchema)
    },
    listRunnerTasks: { response: listOf(out(RunnerTaskRecordSchema)) },
    acceptRunnerTask: {
      request: inp(RunnerTaskAcceptRequestSchema),
      response: out(RunnerTaskRecordSchema)
    },
    rejectRunnerTask: {
      request: inp(RunnerTaskRejectRequestSchema),
      response: out(RunnerTaskRecordSchema)
    },
    uploadRunnerEvidence: {
      request: inp(RunnerTaskArtifactUploadRequestSchema),
      response: out(RunnerTaskArtifactUploadResponseSchema)
    },

    // --- Schedules ---
    listSchedules: { response: listOf(out(MissionScheduleSchema)) },
    createSchedule: {
      request: inp(CreateMissionScheduleInputSchema),
      response: out(MissionScheduleSchema)
    },
    updateSchedule: {
      request: inp(UpdateMissionScheduleInputSchema),
      response: out(MissionScheduleSchema)
    },
    deleteSchedule: {},
    getSchedule: { response: out(MissionScheduleDetailSchema) },
    runSchedule: { response: out(ScheduledRunResultSchema) },
    runDueSchedules: { response: out(DueScheduleRunSummarySchema) },
    pauseSchedule: { response: out(MissionScheduleSchema) },
    resumeSchedule: { response: out(MissionScheduleSchema) },

    // --- Snapshots ---
    createSnapshot: {
      request: inp(CreateSnapshotInputSchema),
      response: out(ValidationSnapshotSchema)
    },
    listSnapshots: { response: listOf(out(ValidationSnapshotSchema)) },
    getSnapshot: { response: out(ValidationSnapshotSchema) },
    getSnapshotReport: {
      response: textResponse,
      responseContentTypes: ["text/html"],
      responseDescription: "Validation snapshot report HTML."
    },
    exportSnapshot: {
      request: inp(ExportReportInputSchema),
      response: textResponse,
      responseContentTypes: ["text/html", "application/pdf"],
      responseDescription: "Validation snapshot report export attachment."
    },

    // --- CTEM & billing ---
    getCtemProgram: { response: out(CTEMProgramSummarySchema) },
    listBillingMeters: { response: listOf(out(UsageMeterDefinitionSchema)) },
    listBillingPackages: { response: listOf(out(BillingPackageSchema)) },
    getActiveBillingPackage: { response: out(BillingPackageSchema) },
    getBillingUsage: { response: out(BillingUsageSchema) },
    getSubscriptionOperationsWorkspace: {
      response: out(SubscriptionOperationsWorkspaceSchema)
    },
    createSubscriptionLifecycle: {
      request: inp(CreateSubscriptionLifecycleInputSchema),
      response: out(SubscriptionOperationsWorkspaceSchema),
      responseStatus: "201"
    },
    recordSubscriptionRenewal: {
      request: inp(RecordSubscriptionRenewalInputSchema),
      response: out(SubscriptionOperationsWorkspaceSchema)
    },
    startSubscriptionGrace: {
      request: inp(StartSubscriptionGraceInputSchema),
      response: out(SubscriptionOperationsWorkspaceSchema)
    },
    resolveSubscriptionGrace: {
      request: inp(ResolveSubscriptionGraceInputSchema),
      response: out(SubscriptionOperationsWorkspaceSchema)
    },
    scheduleSubscriptionCancellation: {
      request: inp(ScheduleSubscriptionCancellationInputSchema),
      response: out(SubscriptionOperationsWorkspaceSchema)
    },
    revokeSubscriptionCancellation: {
      request: inp(SubscriptionReasonInputSchema),
      response: out(SubscriptionOperationsWorkspaceSchema)
    },
    reconcileSubscriptionLifecycle: {
      request: inp(SubscriptionReasonInputSchema),
      response: out(SubscriptionOperationsWorkspaceSchema)
    },
    getBillingLimits: { response: billingLimitsResponse }
  };
}

let cachedRegistry: Record<string, OpenApiPayloadEntry> | undefined;

/**
 * Return the memoized payload registry, building it on first use. See
 * {@link buildPayloadRegistry} for why construction is deferred.
 */
export function getOpenApiOperationPayloads(): Record<
  string,
  OpenApiPayloadEntry
> {
  cachedRegistry ??= buildPayloadRegistry();

  return cachedRegistry;
}

type MutableOperation = {
  operationId?: string;
  parameters?: OpenApiQueryParameter[];
  requestBody?: {
    content?: Record<string, { schema?: JsonSchema }>;
  };
  responses?: Record<
    string,
    { description?: string; content?: Record<string, { schema?: JsonSchema }> }
  >;
};

type MutableDocument = {
  paths?: Record<string, Record<string, MutableOperation>>;
};

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;

/**
 * Pick the success status code to attach the response schema to. Prefer an
 * existing 201/200 entry in the generated document; otherwise fall back to the
 * known-201 operation set, defaulting to 200.
 */
function pickSuccessStatus(
  operationId: string,
  operation: MutableOperation
): "200" | "201" | "202" | "204" | "307" {
  const responses = operation.responses ?? {};

  if (responses["307"]) {
    return "307";
  }

  if (responses["204"]) {
    return "204";
  }

  if (responses["202"]) {
    return "202";
  }

  if (responses["201"]) {
    return "201";
  }

  if (responses["200"]) {
    return "200";
  }

  return CREATED_OPERATIONS.has(operationId) ? "201" : "200";
}

function mergeOperationParameters(
  existing: OpenApiQueryParameter[] | undefined,
  next: OpenApiQueryParameter[]
) {
  const nextKeys = new Set(
    next.map((parameter) => `${parameter.in}:${parameter.name}`)
  );

  return [
    ...(existing ?? []).filter(
      (parameter) => !nextKeys.has(`${parameter.in}:${parameter.name}`)
    ),
    ...next
  ];
}

/**
 * Augment a served OpenAPI document with request/response payload schemas from
 * the registry. Mutates and returns the same document. Existing response
 * entries are preserved; only the targeted success status' JSON content schema
 * is set/merged. This never touches the Fastify route schemas, so it has zero
 * runtime request-validation or response-serialization impact.
 */
/**
 * Machine-readable OpenAPI extension (P20-18): true when this operation has a
 * request and/or response payload schema registered in the enrichment table.
 * Consumers and CI can count `x-periscan-payload-documented` without guessing.
 */
export const OPENAPI_PAYLOAD_DOCUMENTED_EXTENSION =
  "x-periscan-payload-documented" as const;

export function augmentOpenApiDocument<T>(doc: T): T {
  const document = doc as MutableDocument;
  const paths = document.paths;

  if (!paths) {
    return doc;
  }

  const registry = getOpenApiOperationPayloads();

  for (const methods of Object.values(paths)) {
    for (const method of HTTP_METHODS) {
      const operation = methods[method];
      const operationId = operation?.operationId;

      if (!operation || !operationId) {
        continue;
      }

      const entry = registry[operationId];
      const hasPayload =
        Boolean(entry?.request) ||
        Boolean(entry?.response) ||
        Boolean(entry?.responseStatus && entry?.responseDescription);

      // Always emit the marker so partial coverage is machine-readable.
      (operation as Record<string, unknown>)[OPENAPI_PAYLOAD_DOCUMENTED_EXTENSION] =
        hasPayload;

      if (!entry) {
        continue;
      }

      if (entry.parameters) {
        operation.parameters = mergeOperationParameters(
          operation.parameters,
          entry.parameters
        );
      }

      if (entry.request) {
        operation.requestBody = {
          ...operation.requestBody,
          content: {
            ...operation.requestBody?.content,
            "application/json": {
              ...operation.requestBody?.content?.["application/json"],
              schema: entry.request,
              ...(entry.requestDescription
                ? { description: entry.requestDescription }
                : {})
            }
          }
        };
      }

      if (entry.response || entry.responseStatus) {
        const status =
          entry.responseStatus ?? pickSuccessStatus(operationId, operation);
        const responses = (operation.responses ??= {});

        if (entry.responseStatus && entry.responseStatus !== "200") {
          delete responses["200"];
        }

        const existing = responses[status] ?? {
          description: entry.responseDescription ?? "Successful response"
        };
        const responseContentTypes =
          entry.responseContentTypes?.length === 0
            ? undefined
            : (entry.responseContentTypes ?? ["application/json"]);

        responses[status] = {
          ...existing,
          description:
            entry.responseDescription ??
            existing.description ??
            "Successful response",
          ...(entry.response
            ? {
                content: Object.fromEntries(
                  (responseContentTypes ?? ["application/json"]).map(
                    (contentType) => [
                      contentType,
                      {
                        ...existing.content?.[contentType],
                        schema: entry.response
                      }
                    ]
                  )
                )
              }
            : {})
        };
      }
    }
  }

  // Document-level coverage metric for CI / API consumers (P20-18).
  let documented = 0;
  let total = 0;
  for (const methods of Object.values(paths)) {
    for (const method of HTTP_METHODS) {
      const operation = methods[method];
      if (!operation?.operationId) continue;
      total += 1;
      if (
        (operation as Record<string, unknown>)[
          OPENAPI_PAYLOAD_DOCUMENTED_EXTENSION
        ] === true
      ) {
        documented += 1;
      }
    }
  }
  (document as Record<string, unknown>)["x-periscan-payload-coverage"] = {
    documented,
    total,
    ratio: total === 0 ? 0 : Number((documented / total).toFixed(4))
  };

  return doc;
}

import { createHash } from "node:crypto";

import {
  buildOpenSourceToolInstallPlan,
  buildOpenSourceToolUninstallPlan,
  executeOpenSourceToolInstallPlan,
  compareToolVersions,
  discoverTrustedUpstreamToolVersion,
  evaluateToolIntakeManifest,
  getOpenSourceToolCatalogEntryWithRuntime,
  listModuleManifests,
  listOpenSourceToolCatalogWithRuntime,
  resolveOpenSourceToolRuntime,
  selectOpenSourceToolInstallRuntime
} from "@periscan/modules";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  ApplyThirdPartyToolUpdateRequestSchema,
  ReviewThirdPartyToolCandidateRequestSchema,
  ThirdPartyToolCandidateImportRequestSchema,
  ThirdPartyToolCandidateImportResponseSchema,
  ThirdPartyToolImplementationBundleSchema,
  ThirdPartyToolImplementationWorkOrderSchema,
  ThirdPartyToolCandidateSchema,
  ThirdPartyToolCandidateReadinessSchema,
  ThirdPartyToolCandidateReadinessSummarySchema,
  ThirdPartyToolCoverageAuditSchema,
  ThirdPartyToolPromotionCertificationSchema,
  ThirdPartyToolPromotionHandoffSchema,
  ThirdPartyToolPromotionPackageSchema,
  ThirdPartyToolRefreshDueRequestSchema,
  ThirdPartyToolRefreshDueResponseSchema,
  RunnerInternalCheckModuleSchema,
  RunnerCheckTaskRequestSchema,
  RunnerDiscoverTaskRequestSchema,
  RunnerMeasuredTaskRequestSchema,
  RUNNER_DISCOVER_MODULE_IDS,
  RUNNER_MEASURED_MODULE_IDS,
  ThirdPartyToolRunnerDispatchRequestSchema,
  ThirdPartyToolRunnerDispatchResponseSchema,
  ThirdPartyToolUpstreamVersionCheckSchema,
  ThirdPartyToolUpdateRecommendationSchema,
  ThirdPartyToolInstallPlanSchema,
  ToolLicenseAcceptanceSchema,
  ToolIntakeManifestRequestSchema,
  ToolIntakeValidationReportSchema,
  isEngineLabTheaterToolId
} from "@periscan/shared";
import type {
  AcceptToolLicenseRequest,
  ApplyThirdPartyToolUpdateRequest,
  ListToolLicenseAcceptancesQuery,
  OpenSourceToolCatalogEntry,
  OpenSourceToolId,
  OpenSourceToolRuntime,
  ReviewThirdPartyToolCandidateRequest,
  OpenSourceCapability,
  ScopeType,
  ThirdPartyToolImplementationWorkOrder,
  ThirdPartyToolImplementationBundle,
  ThirdPartyToolPromotionHandoff,
  ThirdPartyToolPromotionPackage,
  ThirdPartyToolPromotionCertification,
  ThirdPartyToolRefreshDueResponse,
  ThirdPartyToolActivityEvent,
  ThirdPartyToolCandidate,
  ThirdPartyToolCandidateImportResponse,
  ThirdPartyToolCandidateReadiness,
  ThirdPartyToolCandidateReadinessSummary,
  ThirdPartyToolCoverageAudit,
  ThirdPartyToolCoverageDisposition,
  ThirdPartyToolInstallPlan,
  ThirdPartyToolRunnerEligibility,
  ToolCandidateReadinessCheck,
  ToolImplementationScaffoldFile,
  ToolImplementationBundleFile,
  ToolImplementationWorkOrderTask,
  ThirdPartyTool,
  ThirdPartyToolLicenseSummary,
  ThirdPartyToolUpstreamVersionCheck,
  ThirdPartyToolUpdateRecommendation,
  ToolLicenseAcceptance,
  ToolPromotionHandoffAction,
  ToolPromotionCertificationCheck,
  ToolRunnerCapabilityEligibility,
  ToolRunnerEligibilityStatus,
  ToolUpstreamVersionCheckStatus,
  ToolIntakeManifestRequest,
  ToolIntakeValidationReport,
  ToolGovernancePolicy,
  ToolInstallJob,
  ToolRuntimeInstallation
} from "@periscan/shared";

import {
  AppServiceError,
  requireRole,
  TENANT_ADMIN_ROLES,
  writeAuditEvent
} from "../runtime-services.js";
import type {
  AppServices,
  AuthenticatedContext,
  RuntimeServiceDeps
} from "../runtime-services.js";

type DbClient = PrismaClient | Prisma.TransactionClient;

type RunnerDispatchServices = Pick<
  AppServices,
  | "createRunnerCheckTask"
  | "createRunnerDiscoverTask"
  | "createRunnerMeasuredTask"
>;

const GLOBAL_OWNER_KEY = "global";

type PersistedPolicy = {
  allowedRuntimes: string[];
  disabledReason: string | null;
  enabled: boolean;
  installedAt: Date | null;
  installedVersion: string | null;
  installStatus: string;
  lastCheckedAt: Date | null;
  legalReviewStatus: string;
  ownerKey: string;
  pinnedGitRef: string | null;
  pinnedImageRef: string | null;
  pinnedVersion: string;
  runtimeAvailable: boolean;
  runtimeKind: string | null;
  runtimeReason: string;
  status: string;
  tenantId: string | null;
  toolId: string;
  updatedAt: Date;
};

type PersistedInstallJob = {
  action: string;
  completedAt: Date | null;
  createdAt: Date;
  outputRedacted: string | null;
  reason: string | null;
  requestedByUserId: string | null;
  runtimeKind: string | null;
  startedAt: Date | null;
  status: string;
  tenantId: string | null;
  thirdPartyToolInstallJobId: string;
  toolId: string;
};

type PersistedToolCandidate = {
  category: string;
  createdAt: Date;
  displayName: string;
  implementationOwner: string | null;
  manifest: Prisma.JsonValue;
  requestedByUserId: string | null;
  reviewedAt: Date | null;
  reviewedByUserId: string | null;
  reviewNotes: string | null;
  reviewStatus: string;
  status: string;
  tenantId: string;
  thirdPartyToolCandidateId: string;
  toolId: string;
  updatedAt: Date;
  validationReport: Prisma.JsonValue;
};

type PersistedToolImplementationWorkOrder = {
  candidateId: string;
  createdAt: Date;
  generatedByUserId: string | null;
  readinessStatus: string;
  requiredActions: string[];
  reviewStatus: string;
  scaffoldFiles: Prisma.JsonValue;
  status: string;
  summary: string;
  tasks: Prisma.JsonValue;
  tenantId: string;
  thirdPartyToolImplementationWorkOrderId: string;
  toolId: string;
  updatedAt: Date;
};

type PersistedToolPromotionPackage = {
  capabilityIds: string[];
  candidateId: string;
  catalogSnapshot: Prisma.JsonValue;
  createdAt: Date;
  governanceSnapshot: Prisma.JsonValue;
  implementationOwner: string | null;
  moduleIds: string[];
  promotedAt: Date;
  promotedByUserId: string | null;
  readinessReport: Prisma.JsonValue;
  requiredEvidence: string[];
  reviewStatus: string;
  runtimeInstallation: Prisma.JsonValue;
  safetyNotes: string[];
  status: string;
  summary: string;
  tenantId: string;
  thirdPartyToolPromotionPackageId: string;
  toolId: string;
  updatedAt: Date;
};

type PersistedToolPromotionCertification = {
  candidateId: string;
  certifiedForGovernance: boolean;
  certifiedForMissionStart: boolean;
  certifiedForRunnerDispatch: boolean;
  certifiedForRuntimeManagement: boolean;
  checks: Prisma.JsonValue;
  createdAt: Date;
  displayName: string;
  generatedAt: Date;
  generatedByUserId: string | null;
  governanceStatus: string;
  packageStatus: string;
  promotionPackageId: string;
  readinessStatus: string;
  requiredActions: string[];
  runnerStatus: string;
  runtimeStatus: string;
  safetyNotes: string[];
  status: string;
  summary: string;
  tenantId: string;
  thirdPartyToolPromotionCertificationId: string;
  toolId: string;
};

type PersistedToolUpdateRecommendation = {
  appliedAt: Date | null;
  appliedByUserId: string | null;
  createdAt: Date;
  currentInstalledVersion: string | null;
  currentPinnedVersion: string;
  dismissedAt: Date | null;
  dismissedByUserId: string | null;
  generatedAt: Date;
  generatedByUserId: string | null;
  installJobId: string | null;
  policyBlocked: boolean;
  reason: string;
  requiredActions: string[];
  reviewedVersion: string;
  runtimeKind: string | null;
  source: string;
  status: string;
  tenantId: string;
  thirdPartyToolUpdateRecommendationId: string;
  toolId: string;
  updatedAt: Date;
};

type PersistedToolUpstreamVersionCheck = {
  catalogVersion: string;
  checkedAt: Date;
  checkedByUserId: string | null;
  createdAt: Date;
  discoveredVersion: string | null;
  metadata: Prisma.JsonValue;
  reason: string;
  requiredActions: string[];
  sourceKind: string;
  sourceUrl: string | null;
  status: string;
  tenantId: string;
  thirdPartyToolUpstreamVersionCheckId: string;
  toolId: string;
  updateAvailable: boolean;
};

type PersistedToolAuditEvent = {
  action: string;
  actorType: string;
  auditEventId: string;
  createdAt: Date;
  entityId: string | null;
  entityType: string;
  metadata: Prisma.JsonValue;
  tenantId: string | null;
  userId: string | null;
};

type PersistedToolValidationRun = {
  completedAt: Date | null;
  createdAt: Date;
  evidenceIds: string[];
  moduleId: string;
  outcome: string | null;
  runId: string;
  startedAt: Date | null;
  status: string;
  tenantId: string;
  updatedAt: Date;
};

type PersistedRunnerTask = {
  completedAt: Date | null;
  createdAt: Date;
  errorSummary: string | null;
  moduleId: string;
  redactedEvidenceIds: string[];
  runId: string;
  runnerId: string;
  scopeId: string;
  status: string;
  taskId: string;
  taskType: string | null;
  tenantId: string;
  updatedAt: Date;
};

function nowIso() {
  return new Date().toISOString();
}

function toRuntime(value: string | null): OpenSourceToolRuntime | null {
  if (
    value === "binary" ||
    value === "docker" ||
    value === "npx" ||
    value === "pip" ||
    value === "git"
  ) {
    return value;
  }

  return null;
}

function defaultGovernanceStatus(entry: OpenSourceToolCatalogEntry) {
  if (entry.tool.policyStatus === "RequiresLegalReview") {
    return {
      disabledReason:
        "This tool requires legal review before tenant enablement.",
      enabled: false,
      legalReviewStatus: "RequiresLegalReview",
      status: "LegalReviewRequired" as const
    };
  }

  if (entry.readiness === "Blocked" || entry.executionReadiness === "Blocked") {
    return {
      disabledReason: "This tool is blocked by Periscan safety policy.",
      enabled: false,
      legalReviewStatus: "Blocked",
      status: "Blocked" as const
    };
  }

  return {
    disabledReason: null,
    enabled: true,
    legalReviewStatus: "Approved",
    status: "Enabled" as const
  };
}

function defaultPolicyForEntry(
  entry: OpenSourceToolCatalogEntry,
  tenantId: string | null = null
): ToolGovernancePolicy {
  const defaults = defaultGovernanceStatus(entry);
  return {
    allowedRuntimes: entry.tool.runtimePreference,
    disabledReason: defaults.disabledReason,
    enabled: defaults.enabled,
    legalReviewStatus: defaults.legalReviewStatus,
    pinnedGitRef: entry.tool.gitRepo ? entry.tool.defaultVersion : null,
    pinnedImageRef: entry.tool.dockerImage
      ? `${entry.tool.dockerImage}:${entry.tool.defaultVersion}`
      : null,
    pinnedVersion: entry.tool.defaultVersion,
    source: "Default",
    status: defaults.status,
    tenantId,
    toolId: entry.tool.toolId,
    updatedAt: nowIso()
  };
}

function serializePolicy(
  entry: OpenSourceToolCatalogEntry,
  record: PersistedPolicy | null,
  tenantId: string
): ToolGovernancePolicy {
  if (!record) {
    return defaultPolicyForEntry(entry, tenantId);
  }

  return {
    allowedRuntimes: record.allowedRuntimes
      .map(toRuntime)
      .filter((runtime): runtime is OpenSourceToolRuntime => runtime !== null),
    disabledReason: record.disabledReason,
    enabled: record.enabled,
    legalReviewStatus: record.legalReviewStatus,
    pinnedGitRef: record.pinnedGitRef,
    pinnedImageRef: record.pinnedImageRef,
    pinnedVersion: record.pinnedVersion,
    source: record.ownerKey === GLOBAL_OWNER_KEY ? "Default" : "TenantOverride",
    status: record.status as ToolGovernancePolicy["status"],
    tenantId: record.tenantId ?? tenantId,
    toolId: entry.tool.toolId,
    updatedAt: record.updatedAt.toISOString()
  };
}

function runtimeInstallStatus(entry: OpenSourceToolCatalogEntry) {
  if (entry.runtimeAvailable) {
    return "Available" as const;
  }

  if (
    entry.executionReadiness === "Blocked" ||
    entry.executionReadiness === "Deferred"
  ) {
    return "Skipped" as const;
  }

  return "Missing" as const;
}

function serializeRuntimeInstallation(
  entry: OpenSourceToolCatalogEntry,
  record: PersistedPolicy | null
): ToolRuntimeInstallation {
  if (!record) {
    return {
      installedAt: null,
      installedVersion: null,
      installStatus: runtimeInstallStatus(entry),
      lastCheckedAt: entry.lastCheckedAt ?? null,
      runtimeAvailable: Boolean(entry.runtimeAvailable),
      runtimeKind: entry.runtimeKind ?? null,
      runtimeReason:
        entry.runtimeReason ??
        (entry.runtimeAvailable
          ? "Runtime is available."
          : "Runtime readiness has not been checked."),
      toolId: entry.tool.toolId
    };
  }

  return {
    installedAt: record.installedAt?.toISOString() ?? null,
    installedVersion: record.installedVersion,
    installStatus:
      record.installStatus as ToolRuntimeInstallation["installStatus"],
    lastCheckedAt: record.lastCheckedAt?.toISOString() ?? null,
    runtimeAvailable: record.runtimeAvailable,
    runtimeKind: toRuntime(record.runtimeKind),
    runtimeReason: record.runtimeReason,
    toolId: entry.tool.toolId
  };
}

function isExecutableCapability(capability: OpenSourceCapability) {
  return (
    capability.status === "Implemented" &&
    capability.interfaceKind !== "ContentPack" &&
    capability.interfaceKind !== "KnowledgePack" &&
    capability.executionMode !== "ContentPack"
  );
}

function classifyToolCoverage(input: {
  entry: OpenSourceToolCatalogEntry;
  missingModuleIds: string[];
  presentModuleIds: string[];
}): {
  disposition: ThirdPartyToolCoverageDisposition;
  requiredActions: string[];
  safetyNotes: string[];
} {
  const { entry, missingModuleIds, presentModuleIds } = input;
  const requiredActions: string[] = [];
  const safetyNotes = [
    "Coverage audit is read-only and does not execute, install, enable, queue, or dispatch this tool."
  ];

  if (missingModuleIds.length > 0) {
    requiredActions.push(
      `Add reviewed module manifests for declared modules: ${missingModuleIds.join(", ")}.`
    );
  }

  if (entry.capabilities.length === 0) {
    requiredActions.push(
      "Add reviewed capability metadata or explicitly block/defer this tool."
    );
  }

  if (entry.capabilityCounts.planned > 0) {
    requiredActions.push(
      "Implement, defer, or block planned capabilities before claiming feature completion."
    );
  }

  if (entry.tool.policyStatus === "RequiresLegalReview") {
    requiredActions.push(
      "Keep disabled until legal and safety review explicitly approve tenant enablement."
    );
    return {
      disposition: "Blocked",
      requiredActions,
      safetyNotes
    };
  }

  if (
    entry.tool.policyStatus === "Deferred" ||
    entry.executionReadiness === "Deferred" ||
    entry.capabilityCounts.deferred > 0
  ) {
    requiredActions.push(
      "Resolve deferred governance review before enabling live execution."
    );
    return {
      disposition: "Deferred",
      requiredActions,
      safetyNotes
    };
  }

  if (
    missingModuleIds.length > 0 ||
    entry.capabilities.length === 0 ||
    entry.capabilityCounts.planned > 0
  ) {
    return {
      disposition: "NeedsImplementation",
      requiredActions,
      safetyNotes
    };
  }

  if (
    entry.readiness === "Blocked" ||
    entry.executionReadiness === "Blocked" ||
    entry.capabilityCounts.blocked > 0
  ) {
    requiredActions.push(
      "Keep blocked capabilities non-executable and visible with policy/legal reason."
    );
    return {
      disposition: "Blocked",
      requiredActions,
      safetyNotes
    };
  }

  if (
    presentModuleIds.length === 0 ||
    !entry.capabilities.some(isExecutableCapability) ||
    entry.capabilityCounts.fixtureOnly > 0
  ) {
    requiredActions.push(
      "Use only as safe content, import, fixture, or planning evidence until live execution is reviewed."
    );
    return {
      disposition: "ContentOrImportOnly",
      requiredActions,
      safetyNotes
    };
  }

  return {
    disposition: "Executable",
    requiredActions,
    safetyNotes
  };
}

function buildThirdPartyToolCoverageAudit(
  tools: ThirdPartyTool[],
  tenantId: string
): ThirdPartyToolCoverageAudit {
  const moduleIds = new Set(
    listModuleManifests().map((manifest) => manifest.moduleId)
  );
  const items = tools.map((tool) => {
    const entry = tool.tool;
    const moduleIdsDeclared = entry.tool.moduleIds;
    const moduleIdsPresent = moduleIdsDeclared.filter((moduleId) =>
      moduleIds.has(moduleId)
    );
    const missingModuleIds = moduleIdsDeclared.filter(
      (moduleId) => !moduleIds.has(moduleId)
    );
    const classification = classifyToolCoverage({
      entry,
      missingModuleIds,
      presentModuleIds: moduleIdsPresent
    });

    return {
      capabilityCounts: entry.capabilityCounts,
      capabilityIds: entry.capabilities.map(
        (capability) => capability.capabilityId
      ),
      category: entry.tool.category,
      displayName: entry.tool.displayName,
      disposition: classification.disposition,
      executionReadiness: entry.executionReadiness ?? null,
      missingModuleIds,
      moduleIdsDeclared,
      moduleIdsPresent,
      phase: entry.tool.phase,
      policyStatus: entry.tool.policyStatus,
      readiness: entry.readiness,
      requiredActions: classification.requiredActions,
      runtimeAvailable: entry.runtimeAvailable ?? null,
      runtimeKind: entry.runtimeKind ?? null,
      runtimeReason: entry.runtimeReason ?? null,
      safetyNotes: classification.safetyNotes,
      toolId: entry.tool.toolId
    };
  });

  const countDisposition = (disposition: ThirdPartyToolCoverageDisposition) =>
    items.filter((item) => item.disposition === disposition).length;
  const requiredActions = items.flatMap((item) =>
    item.requiredActions.map((action) => `${item.toolId}: ${action}`)
  );
  const response = {
    blockedTools: countDisposition("Blocked"),
    contentOrImportOnlyTools: countDisposition("ContentOrImportOnly"),
    coverageComplete: countDisposition("NeedsImplementation") === 0,
    deferredTools: countDisposition("Deferred"),
    doesNotDispatchRunnerTasks: true,
    doesNotEnable: true,
    doesNotExecute: true,
    doesNotInstall: true,
    doesNotQueueMissions: true,
    executableTools: countDisposition("Executable"),
    generatedAt: nowIso(),
    needsImplementationTools: countDisposition("NeedsImplementation"),
    requiredActions,
    tenantId,
    tools: items.sort((left, right) => left.toolId.localeCompare(right.toolId)),
    totalTools: items.length
  };

  return ThirdPartyToolCoverageAuditSchema.parse(response);
}

function serializeJob(record: PersistedInstallJob): ToolInstallJob {
  return {
    action: record.action as ToolInstallJob["action"],
    completedAt: record.completedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    jobId: record.thirdPartyToolInstallJobId,
    outputRedacted: record.outputRedacted,
    reason: record.reason,
    requestedBy: record.requestedByUserId,
    runtimeKind: toRuntime(record.runtimeKind),
    startedAt: record.startedAt?.toISOString() ?? null,
    status: record.status as ToolInstallJob["status"],
    tenantId: record.tenantId,
    toolId: record.toolId as OpenSourceToolId
  };
}

function serializeUpdateRecommendation(
  record: PersistedToolUpdateRecommendation
): ThirdPartyToolUpdateRecommendation {
  return ThirdPartyToolUpdateRecommendationSchema.parse({
    appliedAt: record.appliedAt?.toISOString() ?? null,
    appliedBy: record.appliedByUserId,
    createdAt: record.createdAt.toISOString(),
    currentInstalledVersion: record.currentInstalledVersion,
    currentPinnedVersion: record.currentPinnedVersion,
    dismissedAt: record.dismissedAt?.toISOString() ?? null,
    dismissedBy: record.dismissedByUserId,
    generatedAt: record.generatedAt.toISOString(),
    generatedBy: record.generatedByUserId,
    installJobId: record.installJobId,
    policyBlocked: record.policyBlocked,
    reason: record.reason,
    recommendationId: record.thirdPartyToolUpdateRecommendationId,
    requiredActions: record.requiredActions,
    reviewedVersion: record.reviewedVersion,
    runtimeKind: toRuntime(record.runtimeKind),
    source: record.source,
    status: record.status,
    tenantId: record.tenantId,
    toolId: record.toolId,
    updatedAt: record.updatedAt.toISOString()
  });
}

function serializeUpstreamVersionCheck(
  record: PersistedToolUpstreamVersionCheck
): ThirdPartyToolUpstreamVersionCheck {
  return ThirdPartyToolUpstreamVersionCheckSchema.parse({
    catalogVersion: record.catalogVersion,
    checkedAt: record.checkedAt.toISOString(),
    checkedBy: record.checkedByUserId,
    checkId: record.thirdPartyToolUpstreamVersionCheckId,
    discoveredVersion: record.discoveredVersion,
    metadata:
      record.metadata && typeof record.metadata === "object"
        ? record.metadata
        : {},
    reason: record.reason,
    requiredActions: record.requiredActions,
    sourceKind: record.sourceKind,
    sourceUrl: record.sourceUrl,
    status: record.status,
    tenantId: record.tenantId,
    toolId: record.toolId,
    updateAvailable: record.updateAvailable
  });
}

function activityMetadata(value: Prisma.JsonValue | Record<string, unknown>) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function activityEvent(input: {
  activityId: string;
  actorUserId?: string | null;
  category: ThirdPartyToolActivityEvent["category"];
  entityId?: string | null;
  entityType: string;
  metadata?: Record<string, unknown>;
  occurredAt: Date | string;
  source: ThirdPartyToolActivityEvent["source"];
  status: string;
  summary: string;
  tenantId?: string | null;
  title: string;
  toolId: OpenSourceToolId;
}): ThirdPartyToolActivityEvent {
  return {
    activityId: input.activityId,
    actorUserId: input.actorUserId ?? null,
    category: input.category,
    entityId: input.entityId ?? null,
    entityType: input.entityType,
    metadata: input.metadata ?? {},
    occurredAt:
      input.occurredAt instanceof Date
        ? input.occurredAt.toISOString()
        : input.occurredAt,
    source: input.source,
    status: input.status,
    summary: input.summary,
    tenantId: input.tenantId ?? null,
    title: input.title,
    toolId: input.toolId
  };
}

function auditActivityTitle(action: string) {
  const titles: Record<string, string> = {
    third_party_tool_candidate_reviewed: "Candidate reviewed",
    third_party_tool_checked: "Runtime checked",
    third_party_tool_disabled: "Tool disabled",
    third_party_tool_enabled: "Tool enabled",
    third_party_tool_enable_denied: "Enable denied",
    third_party_tool_install_failed: "Install failed",
    third_party_tool_install_requested: "Install requested",
    third_party_tool_installed: "Tool installed",
    third_party_tool_intake_submitted: "Candidate submitted",
    third_party_tool_intake_validated: "Intake validated",
    third_party_tool_implementation_bundle_generated:
      "Implementation bundle generated",
    third_party_tool_promotion_package_generated: "Promotion package generated",
    third_party_tool_promotion_certified:
      "Promotion certification snapshot generated",
    third_party_tool_refresh_due_checked: "Due refresh checked",
    third_party_tool_update_applied: "Reviewed update applied",
    third_party_tool_update_checked: "Reviewed update checked",
    third_party_tool_update_dismissed: "Reviewed update dismissed",
    third_party_tool_upstream_checked: "Trusted upstream checked",
    third_party_tool_work_order_generated: "Work order generated",
    third_party_tool_license_accepted: "License accepted"
  };

  return titles[action] ?? "Third-party tool audit event";
}

function auditActivityCategory(
  action: string
): ThirdPartyToolActivityEvent["category"] {
  if (action.includes("install") || action.includes("checked")) {
    return "Runtime";
  }

  if (action.includes("update") || action.includes("upstream")) {
    return "Update";
  }

  if (action.includes("promotion_certified")) {
    return "Governance";
  }

  if (
    action.includes("intake") ||
    action.includes("candidate") ||
    action.includes("work_order") ||
    action.includes("promotion_package")
  ) {
    return "Onboarding";
  }

  return "Governance";
}

function auditBelongsToTool(record: PersistedToolAuditEvent, toolId: string) {
  const metadata = activityMetadata(record.metadata);
  return (
    metadata.toolId === toolId ||
    metadata.candidateToolId === toolId ||
    metadata.normalizedToolId === toolId ||
    (Array.isArray(metadata.toolIds) && metadata.toolIds.includes(toolId))
  );
}

const runnerInternalCheckModuleIds = RunnerInternalCheckModuleSchema.options;
const serverRunnerAllowlistedModuleIds = [
  ...new Set([
    ...RUNNER_DISCOVER_MODULE_IDS,
    ...RUNNER_MEASURED_MODULE_IDS,
    ...runnerInternalCheckModuleIds
  ])
];
const serverRunnerAllowlistedModuleIdSet = new Set<string>(
  serverRunnerAllowlistedModuleIds
);

function getRunnerDispatchRoute(moduleId: string | null | undefined) {
  if (!moduleId || !serverRunnerAllowlistedModuleIdSet.has(moduleId)) {
    return null;
  }

  if ((RUNNER_DISCOVER_MODULE_IDS as readonly string[]).includes(moduleId)) {
    return "/api/v1/runners/:runnerId/tasks/discover";
  }

  if ((RUNNER_MEASURED_MODULE_IDS as readonly string[]).includes(moduleId)) {
    return "/api/v1/runners/:runnerId/tasks/measured";
  }

  return "/api/v1/runners/:runnerId/tasks/check";
}

function runnerStatusPriority(status: ToolRunnerEligibilityStatus) {
  const priority: Record<ToolRunnerEligibilityStatus, number> = {
    Blocked: 90,
    RequiresEnablement: 80,
    NeedsImplementation: 70,
    RequiresRuntime: 60,
    RequiresRunner: 50,
    RequiresVerifiedScope: 40,
    RequiresApproval: 30,
    FixtureOnly: 20,
    ControlPlaneOnly: 10,
    Ready: 0
  };

  return priority[status];
}

function selectAggregateRunnerStatus(
  statuses: ToolRunnerEligibilityStatus[]
): ToolRunnerEligibilityStatus {
  if (!statuses.length) {
    return "ControlPlaneOnly";
  }

  if (statuses.includes("Ready")) {
    return "Ready";
  }

  const selected = [...statuses].sort(
    (left, right) => runnerStatusPriority(right) - runnerStatusPriority(left)
  )[0];
  return selected ?? "ControlPlaneOnly";
}

function requiresRunnerApproval(capability: OpenSourceCapability) {
  return (
    capability.safetyLevels.includes("ControlledValidation") ||
    capability.safetyLevels.includes("BASLite")
  );
}

function evaluateRunnerCapability(input: {
  activeRunnerCount: number;
  capability: OpenSourceCapability;
  tool: ThirdPartyTool;
  verifiedScopeTypes: ScopeType[];
}): ToolRunnerCapabilityEligibility {
  const { activeRunnerCount, capability, tool, verifiedScopeTypes } = input;
  const reasons: string[] = [];
  const requiredActions: string[] = [];
  const dispatchRoute = getRunnerDispatchRoute(capability.moduleId);
  const hasCompatibleVerifiedScope =
    capability.requiredScopes.length === 0 ||
    capability.requiredScopes.some((scopeType) =>
      verifiedScopeTypes.includes(scopeType)
    );
  let status: ToolRunnerEligibilityStatus = "Ready";

  if (capability.executionMode !== "InternalRunner") {
    return {
      capabilityId: capability.capabilityId,
      dispatchRoute: null,
      dispatchable: false,
      executionMode: capability.executionMode,
      moduleId: capability.moduleId,
      name: capability.name,
      reasons: [
        `Capability executes through ${capability.executionMode}, not the internal runner.`
      ],
      requiredActions: [],
      requiredScopes: capability.requiredScopes,
      safetyLevels: capability.safetyLevels,
      status: "ControlPlaneOnly"
    };
  }

  if (
    tool.governance.status === "Blocked" ||
    tool.governance.status === "LegalReviewRequired" ||
    capability.status === "BlockedLegalReview" ||
    capability.safetyLevels.includes("AdvancedAdversarial")
  ) {
    status = "Blocked";
    reasons.push(
      "Capability is blocked by legal review, safety policy, or advanced-adversarial restrictions."
    );
    requiredActions.push(
      "Complete documented legal and safety review before runner execution can be considered."
    );
  } else if (!tool.governance.enabled || tool.governance.status !== "Enabled") {
    status = "RequiresEnablement";
    reasons.push("Tenant governance has disabled this tool.");
    requiredActions.push("Enable the tool for this tenant before runner use.");
  } else if (capability.status === "FixtureOnly") {
    status = "FixtureOnly";
    reasons.push("Capability is fixture-only and cannot execute live.");
    requiredActions.push(
      "Implement and validate the live runner execution path before dispatch."
    );
  } else if (capability.status !== "Implemented" || !dispatchRoute) {
    status = "NeedsImplementation";
    reasons.push(
      dispatchRoute
        ? "Capability is not implemented for live runner dispatch."
        : "Capability module is not in the server-side runner dispatch allowlist."
    );
    requiredActions.push(
      "Add a reviewed module manifest, parser tests, local runner allowlist entry, and signed-task API route before dispatch."
    );
  } else if (!tool.runtimeInstallation.runtimeAvailable) {
    status = "RequiresRuntime";
    reasons.push("Required tool runtime is not available.");
    requiredActions.push(
      "Check or install the reviewed runtime through Third-Party Tool Governance."
    );
  } else if (activeRunnerCount === 0) {
    status = "RequiresRunner";
    reasons.push("No active internal runner is registered for this tenant.");
    requiredActions.push(
      "Register and activate an outbound-only internal runner before dispatch."
    );
  } else if (!hasCompatibleVerifiedScope) {
    status = "RequiresVerifiedScope";
    reasons.push("No verified tenant scope matches this runner capability.");
    requiredActions.push(
      `Verify one of these scope types before dispatch: ${capability.requiredScopes.join(", ")}.`
    );
  } else if (requiresRunnerApproval(capability)) {
    status = "RequiresApproval";
    reasons.push(
      "Capability requires explicit approval before a runner task can be created."
    );
    requiredActions.push(
      "Create a policy-approved mission or approval state before runner dispatch."
    );
  } else {
    reasons.push("Capability is server-allowlisted for runner dispatch.");
  }

  return {
    capabilityId: capability.capabilityId,
    dispatchRoute,
    dispatchable: status === "Ready",
    executionMode: capability.executionMode,
    moduleId: capability.moduleId,
    name: capability.name,
    reasons,
    requiredActions,
    requiredScopes: capability.requiredScopes,
    safetyLevels: capability.safetyLevels,
    status
  };
}

function buildRunnerEligibilityReport(input: {
  activeRunnerCount: number;
  tenantId: string;
  tool: ThirdPartyTool;
  verifiedScopeCount: number;
  verifiedScopeTypes: ScopeType[];
}): ThirdPartyToolRunnerEligibility {
  const capabilities = input.tool.tool.capabilities.map((capability) =>
    evaluateRunnerCapability({
      activeRunnerCount: input.activeRunnerCount,
      capability,
      tool: input.tool,
      verifiedScopeTypes: input.verifiedScopeTypes
    })
  );
  const runnerCapabilities = capabilities.filter(
    (capability) => capability.executionMode === "InternalRunner"
  );
  const status = selectAggregateRunnerStatus(
    runnerCapabilities.map((capability) => capability.status)
  );
  const eligible = runnerCapabilities.some(
    (capability) => capability.dispatchable
  );
  const reasons = eligible
    ? ["At least one capability is ready for runner dispatch."]
    : runnerCapabilities.length === 0
      ? ["This tool has no InternalRunner capability in the reviewed catalog."]
      : uniqueStrings(
          runnerCapabilities.flatMap((capability) => capability.reasons)
        );
  const requiredActions = uniqueStrings(
    runnerCapabilities.flatMap((capability) => capability.requiredActions)
  );

  return {
    activeRunnerCount: input.activeRunnerCount,
    capabilities,
    eligible,
    generatedAt: nowIso(),
    governanceStatus: input.tool.governance.status,
    reasons,
    requiredActions,
    runtimeAvailable: input.tool.runtimeInstallation.runtimeAvailable,
    runtimeKind: input.tool.runtimeInstallation.runtimeKind,
    serverAllowlistedModuleIds: serverRunnerAllowlistedModuleIds,
    status,
    tenantId: input.tenantId,
    toolId: input.tool.tool.tool.toolId,
    verifiedScopeCount: input.verifiedScopeCount
  };
}

function runnerDispatchErrorMessage(
  capability: ToolRunnerCapabilityEligibility
) {
  return (
    capability.reasons[0] ??
    `Capability ${capability.capabilityId} is not ready for runner dispatch.`
  );
}

function getRunnerDispatchKind(moduleId: string) {
  if ((RUNNER_DISCOVER_MODULE_IDS as readonly string[]).includes(moduleId)) {
    return "discover" as const;
  }

  if ((RUNNER_MEASURED_MODULE_IDS as readonly string[]).includes(moduleId)) {
    return "measured" as const;
  }

  if ((runnerInternalCheckModuleIds as readonly string[]).includes(moduleId)) {
    return "check" as const;
  }

  return null;
}

async function writeToolRunnerDispatchAudit(input: {
  capabilityId: string;
  code?: string;
  context: AuthenticatedContext;
  moduleId?: string | null;
  prisma: DbClient;
  reason?: string;
  runnerId: string;
  scopeId: string;
  status: "denied" | "dispatched";
  taskId?: string;
  toolId: OpenSourceToolId;
}) {
  await writeAuditEvent(input.prisma, {
    action:
      input.status === "dispatched"
        ? "third_party_tool.runner_dispatched"
        : "third_party_tool.runner_dispatch_denied",
    actorType: "User",
    entityId: input.toolId,
    entityType: "ThirdPartyTool",
    metadata: {
      capabilityId: input.capabilityId,
      code: input.code ?? null,
      moduleId: input.moduleId ?? null,
      reason: input.reason ?? null,
      runnerId: input.runnerId,
      scopeId: input.scopeId,
      taskId: input.taskId ?? null,
      toolId: input.toolId
    },
    tenantId: input.context.tenant.tenantId,
    userId: input.context.user.userId
  });
}

function buildUpdateRecommendationFields(input: {
  entry: OpenSourceToolCatalogEntry;
  policy: ToolGovernancePolicy;
  runtime: ToolRuntimeInstallation;
}) {
  const { entry, policy, runtime } = input;
  const reviewedVersion = entry.tool.defaultVersion;
  const policyBlocked = !canEnableEntry(entry) || policy.status !== "Enabled";
  const hasVersionDrift = policy.pinnedVersion !== reviewedVersion;
  const status = policyBlocked
    ? "Blocked"
    : hasVersionDrift
      ? "UpdateAvailable"
      : "UpToDate";
  const requiredActions: string[] = [];

  if (policyBlocked) {
    requiredActions.push(
      "Resolve legal or safety disposition before changing this tool version."
    );
  } else if (hasVersionDrift) {
    requiredActions.push(
      "Review upstream release notes for the catalog version."
    );
    requiredActions.push(
      "Apply the reviewed pin and queue an install job before runtime use."
    );
  } else {
    requiredActions.push("No tool version update is required.");
  }

  const reason = policyBlocked
    ? `${entry.tool.displayName} is blocked by legal or safety policy.`
    : hasVersionDrift
      ? `Reviewed catalog version ${reviewedVersion} differs from pinned version ${policy.pinnedVersion}.`
      : `${entry.tool.displayName} is pinned to the reviewed catalog version ${reviewedVersion}.`;

  return {
    currentInstalledVersion: runtime.installedVersion,
    currentPinnedVersion: policy.pinnedVersion,
    policyBlocked,
    reason,
    requiredActions,
    reviewedVersion,
    runtimeKind: runtime.runtimeKind,
    source: "ReviewedCatalog",
    status
  } as const;
}

function serializeCandidate(
  record: PersistedToolCandidate
): ThirdPartyToolCandidate {
  return ThirdPartyToolCandidateSchema.parse({
    candidateId: record.thirdPartyToolCandidateId,
    category: record.category,
    createdAt: record.createdAt.toISOString(),
    displayName: record.displayName,
    implementationOwner: record.implementationOwner,
    manifest: ToolIntakeManifestRequestSchema.parse(record.manifest),
    requestedBy: record.requestedByUserId,
    reviewedAt: record.reviewedAt?.toISOString() ?? null,
    reviewedBy: record.reviewedByUserId,
    reviewNotes: record.reviewNotes,
    reviewStatus: record.reviewStatus,
    status: record.status,
    tenantId: record.tenantId,
    toolId: record.toolId,
    updatedAt: record.updatedAt.toISOString(),
    validationReport: ToolIntakeValidationReportSchema.parse(
      record.validationReport
    )
  });
}

function readStringField(value: unknown, field: string) {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = (value as Record<string, unknown>)[field];
  return typeof candidate === "string" ? candidate : null;
}

function serializeWorkOrder(
  record: PersistedToolImplementationWorkOrder,
  candidate: ThirdPartyToolCandidate
): ThirdPartyToolImplementationWorkOrder {
  return ThirdPartyToolImplementationWorkOrderSchema.parse({
    candidateId: record.candidateId,
    createdAt: record.createdAt.toISOString(),
    displayName: candidate.displayName,
    generatedBy: record.generatedByUserId,
    readinessStatus: record.readinessStatus,
    requiredActions: record.requiredActions,
    reviewStatus: record.reviewStatus,
    scaffoldFiles: record.scaffoldFiles,
    status: record.status,
    summary: record.summary,
    tasks: record.tasks,
    tenantId: record.tenantId,
    toolId: record.toolId,
    updatedAt: record.updatedAt.toISOString(),
    workOrderId: record.thirdPartyToolImplementationWorkOrderId
  });
}

function serializePromotionPackage(
  record: PersistedToolPromotionPackage,
  candidate: ThirdPartyToolCandidate
): ThirdPartyToolPromotionPackage {
  return ThirdPartyToolPromotionPackageSchema.parse({
    capabilityIds: record.capabilityIds,
    candidateId: record.candidateId,
    catalogSnapshot: record.catalogSnapshot,
    createdAt: record.createdAt.toISOString(),
    displayName: candidate.displayName,
    governanceSnapshot: record.governanceSnapshot,
    implementationOwner: record.implementationOwner,
    moduleIds: record.moduleIds,
    promotedAt: record.promotedAt.toISOString(),
    promotedBy: record.promotedByUserId,
    promotionPackageId: record.thirdPartyToolPromotionPackageId,
    readinessReport: record.readinessReport,
    requiredEvidence: record.requiredEvidence,
    reviewStatus: record.reviewStatus,
    runtimeInstallation: record.runtimeInstallation,
    safetyNotes: record.safetyNotes,
    status: record.status,
    summary: record.summary,
    tenantId: record.tenantId,
    toolId: record.toolId,
    updatedAt: record.updatedAt.toISOString()
  });
}

function serializePromotionCertification(
  record: PersistedToolPromotionCertification
): ThirdPartyToolPromotionCertification {
  return ThirdPartyToolPromotionCertificationSchema.parse({
    candidateId: record.candidateId,
    certificationId: record.thirdPartyToolPromotionCertificationId,
    certifiedForGovernance: record.certifiedForGovernance,
    certifiedForMissionStart: record.certifiedForMissionStart,
    certifiedForRuntimeManagement: record.certifiedForRuntimeManagement,
    certifiedForRunnerDispatch: record.certifiedForRunnerDispatch,
    checks: record.checks,
    createdAt: record.createdAt.toISOString(),
    displayName: record.displayName,
    doesNotDispatchRunnerTasks: true,
    doesNotEnable: true,
    doesNotExecute: true,
    doesNotInstall: true,
    doesNotQueueMissions: true,
    generatedAt: record.generatedAt.toISOString(),
    generatedBy: record.generatedByUserId,
    governanceStatus: record.governanceStatus,
    packageStatus: record.packageStatus,
    promotionPackageId: record.promotionPackageId,
    readinessStatus: record.readinessStatus,
    requiredActions: record.requiredActions,
    runnerStatus: record.runnerStatus,
    runtimeStatus: record.runtimeStatus,
    safetyNotes: record.safetyNotes,
    status: record.status,
    summary: record.summary,
    tenantId: record.tenantId,
    toolId: record.toolId
  });
}

function buildPromotionRequiredEvidence(input: {
  candidate: ThirdPartyToolCandidate;
  readiness: ThirdPartyToolCandidateReadiness;
}) {
  const readinessEvidence = input.readiness.checks.flatMap((check) =>
    check.status === "Satisfied" ? check.evidence : []
  );

  return uniqueStrings([
    "Reviewed catalog entry exists for the tool.",
    "Registered module manifest declares the promoted tool ID.",
    "Tenant/global governance policy is available.",
    "Runtime readiness is captured in the promotion package snapshot.",
    "Safety and license posture passed readiness checks.",
    ...readinessEvidence,
    ...input.candidate.validationReport.moduleScaffold.requiredFiles,
    ...input.candidate.validationReport.moduleScaffold.requiredTests
  ]);
}

function buildPromotionSafetyNotes(input: {
  catalogEntry: OpenSourceToolCatalogEntry;
  candidate: ThirdPartyToolCandidate;
}) {
  const safetyLevels = uniqueStrings(
    input.catalogEntry.capabilities.flatMap(
      (capability) => capability.safetyLevels
    )
  );
  return uniqueStrings([
    "Promotion packages are non-executing governance artifacts.",
    "Actual tool execution remains gated by tenant enablement, verified scope, policy decisions, runtime readiness, and runner/task allowlists.",
    `Candidate requested safety level ${input.candidate.manifest.safetyLevel}.`,
    safetyLevels.length
      ? `Reviewed capabilities declare safety levels: ${safetyLevels.join(", ")}.`
      : "No reviewed capability safety levels were present in the catalog snapshot.",
    input.candidate.validationReport.governance.liveExecutionAllowed
      ? "Live execution was accepted by intake only within declared safety gates."
      : "Live execution was not accepted by automated intake."
  ]);
}

function buildPromotionPackage(input: {
  catalogEntry: OpenSourceToolCatalogEntry;
  candidate: ThirdPartyToolCandidate;
  governance: ToolGovernancePolicy;
  promotedAt?: Date;
  promotedBy: string | null;
  readiness: ThirdPartyToolCandidateReadiness;
  runtime: ToolRuntimeInstallation;
}): ThirdPartyToolPromotionPackage {
  const promotedAt = (input.promotedAt ?? new Date()).toISOString();
  const capabilityIds = input.catalogEntry.capabilities.map(
    (capability) => capability.capabilityId
  );
  const moduleIds = uniqueStrings([
    ...input.catalogEntry.tool.moduleIds,
    ...input.catalogEntry.capabilities.map((capability) => capability.moduleId)
  ]);
  const status = input.readiness.readyForGovernance
    ? "ReadyForGovernance"
    : "Blocked";

  return ThirdPartyToolPromotionPackageSchema.parse({
    capabilityIds,
    candidateId: input.candidate.candidateId,
    catalogSnapshot: input.catalogEntry,
    createdAt: promotedAt,
    displayName: input.candidate.displayName,
    governanceSnapshot: input.governance,
    implementationOwner: input.candidate.implementationOwner,
    moduleIds,
    promotedAt,
    promotedBy: input.promotedBy,
    promotionPackageId: "00000000-0000-4000-8000-000000000000",
    readinessReport: input.readiness,
    requiredEvidence: buildPromotionRequiredEvidence({
      candidate: input.candidate,
      readiness: input.readiness
    }),
    reviewStatus: input.candidate.reviewStatus,
    runtimeInstallation: input.runtime,
    safetyNotes: buildPromotionSafetyNotes({
      catalogEntry: input.catalogEntry,
      candidate: input.candidate
    }),
    status,
    summary:
      status === "ReadyForGovernance"
        ? `${input.candidate.displayName} has reviewed catalog, module, governance, runtime, and safety evidence captured for governed enablement.`
        : `${input.candidate.displayName} is not ready for governed enablement; resolve readiness actions before execution.`,
    tenantId: input.candidate.tenantId,
    toolId: input.catalogEntry.tool.toolId,
    updatedAt: promotedAt
  });
}

function hasInternalRunnerCapabilities(tool: ThirdPartyTool) {
  return tool.tool.capabilities.some(
    (capability) => capability.executionMode === "InternalRunner"
  );
}

function hasImplementedMissionCapabilities(tool: ThirdPartyTool) {
  return tool.tool.capabilities.some(
    (capability) =>
      capability.status === "Implemented" &&
      capability.executionMode !== "InternalRunner"
  );
}

function buildPromotionHandoffAction(input: {
  actionId: string;
  apiMethod: "GET" | "POST" | null;
  apiPath: string | null;
  blockedBy?: string[];
  createsExecution?: boolean;
  kind: ToolPromotionHandoffAction["kind"];
  policyGateRequired?: boolean;
  reasons?: string[];
  requiredActions?: string[];
  status: ToolPromotionHandoffAction["status"];
  summary: string;
  title: string;
}): ToolPromotionHandoffAction {
  return {
    actionId: input.actionId,
    apiMethod: input.apiMethod,
    apiPath: input.apiPath,
    blockedBy: input.blockedBy ?? [],
    createsExecution: input.createsExecution ?? false,
    kind: input.kind,
    policyGateRequired: input.policyGateRequired ?? false,
    reasons: input.reasons ?? [],
    requiredActions: input.requiredActions ?? [],
    status: input.status,
    summary: input.summary,
    title: input.title
  };
}

function buildPromotionHandoff(input: {
  generatedAt?: Date;
  promotionPackage: ThirdPartyToolPromotionPackage;
  runnerEligibility: ThirdPartyToolRunnerEligibility;
  tool: ThirdPartyTool;
}): ThirdPartyToolPromotionHandoff {
  const generatedAt = (input.generatedAt ?? new Date()).toISOString();
  const { promotionPackage, runnerEligibility, tool } = input;
  const packageReady =
    promotionPackage.status === "ReadyForGovernance" &&
    promotionPackage.readinessReport.readyForGovernance;
  const governanceBlocked =
    tool.governance.status === "Blocked" ||
    tool.governance.status === "LegalReviewRequired";
  const governanceEnabled =
    tool.governance.enabled && tool.governance.status === "Enabled";
  const runtimeAvailable = tool.runtimeInstallation.runtimeAvailable;
  const internalRunnerCapable = hasInternalRunnerCapabilities(tool);
  const missionCapable = hasImplementedMissionCapabilities(tool);
  const runnerReady =
    runnerEligibility.status === "Ready" ||
    runnerEligibility.status === "ControlPlaneOnly";
  const packageBlockers = packageReady
    ? []
    : [
        "Promotion package is not readiness-satisfied; resolve readiness actions before tenant governance can use it."
      ];
  const governanceBlockers = governanceBlocked
    ? [
        "Tenant governance is blocked by legal review or platform safety policy."
      ]
    : [];
  const blockingReasons = [...packageBlockers, ...governanceBlockers];
  const canUseGovernance = packageReady && !governanceBlocked;
  const installableRuntime = tool.governance.allowedRuntimes.length > 0;
  const runnerDispatchableCapabilities = runnerEligibility.capabilities.filter(
    (capability) => capability.dispatchable
  );
  const runnerExecutionBlocked =
    internalRunnerCapable &&
    !runnerReady &&
    ["Blocked", "FixtureOnly", "NeedsImplementation"].includes(
      runnerEligibility.status
    );

  const actions: ToolPromotionHandoffAction[] = [
    buildPromotionHandoffAction({
      actionId: "enable-tool",
      apiMethod: "POST",
      apiPath: `/api/v1/third-party-tools/${promotionPackage.toolId}/enable`,
      blockedBy: blockingReasons,
      kind: "EnableTool",
      reasons: governanceEnabled
        ? ["Tenant governance already enables this reviewed tool."]
        : blockingReasons,
      requiredActions: governanceEnabled
        ? []
        : canUseGovernance
          ? ["Call the enable endpoint with an operator reason."]
          : promotionPackage.readinessReport.requiredActions,
      status: !canUseGovernance
        ? "Blocked"
        : governanceEnabled
          ? "AlreadySatisfied"
          : "Ready",
      summary: governanceEnabled
        ? "Tool is enabled for this tenant."
        : "Enable the reviewed tool for this tenant before missions or runner dispatch use it.",
      title: "Enable tenant governance"
    }),
    buildPromotionHandoffAction({
      actionId: "check-runtime",
      apiMethod: "POST",
      apiPath: `/api/v1/third-party-tools/${promotionPackage.toolId}/check`,
      blockedBy: blockingReasons,
      kind: "CheckRuntime",
      reasons: runtimeAvailable
        ? ["Runtime readiness is already available in current tenant state."]
        : tool.runtimeInstallation.runtimeReason
          ? [tool.runtimeInstallation.runtimeReason]
          : [],
      requiredActions: runtimeAvailable
        ? []
        : canUseGovernance
          ? ["Run a governed runtime readiness check."]
          : promotionPackage.readinessReport.requiredActions,
      status: !canUseGovernance
        ? "Blocked"
        : runtimeAvailable
          ? "AlreadySatisfied"
          : "Ready",
      summary: runtimeAvailable
        ? "Runtime is available according to current governance state."
        : "Check the reviewed runtime before using this tool in validation.",
      title: "Check runtime readiness"
    }),
    buildPromotionHandoffAction({
      actionId: "install-runtime",
      apiMethod: "POST",
      apiPath: `/api/v1/third-party-tools/${promotionPackage.toolId}/install`,
      blockedBy: !installableRuntime
        ? ["No allowlisted install runtime exists for this tool."]
        : blockingReasons,
      kind: "InstallRuntime",
      reasons: runtimeAvailable
        ? ["Runtime installation is already satisfied."]
        : installableRuntime
          ? [
              `Allowed install runtimes: ${tool.governance.allowedRuntimes.join(", ")}.`
            ]
          : ["No allowlisted install runtime exists for this tool."],
      requiredActions: runtimeAvailable
        ? []
        : canUseGovernance && installableRuntime
          ? [
              "Queue a governed install job; platform worker execution remains separately gated."
            ]
          : promotionPackage.readinessReport.requiredActions,
      status:
        !canUseGovernance || !installableRuntime
          ? "Blocked"
          : runtimeAvailable
            ? "AlreadySatisfied"
            : "Ready",
      summary: runtimeAvailable
        ? "No install job is needed before use."
        : "Queue an install job only for reviewed, allowlisted runtime artifacts.",
      title: "Install reviewed runtime"
    }),
    buildPromotionHandoffAction({
      actionId: "check-runner-eligibility",
      apiMethod: internalRunnerCapable ? "GET" : null,
      apiPath: internalRunnerCapable
        ? `/api/v1/third-party-tools/${promotionPackage.toolId}/runner-eligibility`
        : null,
      kind: "CheckRunnerEligibility",
      reasons: internalRunnerCapable
        ? runnerEligibility.reasons
        : ["This promoted tool has no InternalRunner capabilities."],
      requiredActions: internalRunnerCapable
        ? runnerEligibility.requiredActions
        : [],
      status: internalRunnerCapable
        ? runnerEligibility.status === "Ready"
          ? "AlreadySatisfied"
          : runnerExecutionBlocked
            ? "Blocked"
            : "Ready"
        : "NotApplicable",
      summary: internalRunnerCapable
        ? "Read current customer-network runner prerequisites before dispatch."
        : "Runner readiness is not required for this tool's reviewed capabilities.",
      title: "Check internal runner eligibility"
    }),
    buildPromotionHandoffAction({
      actionId: "dispatch-runner-capability",
      apiMethod: internalRunnerCapable ? "POST" : null,
      apiPath: internalRunnerCapable
        ? `/api/v1/third-party-tools/${promotionPackage.toolId}/runner-dispatch`
        : null,
      createsExecution: true,
      kind: "DispatchRunnerCapability",
      policyGateRequired: true,
      reasons: internalRunnerCapable
        ? runnerEligibility.reasons
        : ["No InternalRunner capability exists for this promoted tool."],
      requiredActions: runnerDispatchableCapabilities.length
        ? [
            "Select a dispatchable capability, active runner, verified scope, and scoped target."
          ]
        : runnerEligibility.requiredActions,
      status: !internalRunnerCapable
        ? "NotApplicable"
        : runnerDispatchableCapabilities.length
          ? "Ready"
          : runnerExecutionBlocked
            ? "Blocked"
            : "NeedsAction",
      summary: internalRunnerCapable
        ? "Dispatch only after runner eligibility is ready and the target is verified in scope."
        : "Runner dispatch is not part of this tool's reviewed execution path.",
      title: "Dispatch runner capability"
    }),
    buildPromotionHandoffAction({
      actionId: "start-policy-gated-mission",
      apiMethod: missionCapable ? "POST" : null,
      apiPath: missionCapable ? "/api/v1/missions" : null,
      createsExecution: true,
      kind: "StartMission",
      policyGateRequired: true,
      reasons: missionCapable
        ? [
            "Mission start remains subject to verified scope, policy decision, tenant tool enablement, runtime readiness, and module safety gates."
          ]
        : [
            "No control-plane or external-PoA implemented mission capability exists."
          ],
      requiredActions:
        packageReady && governanceEnabled && runtimeAvailable && missionCapable
          ? [
              "Create or start a mission using the reviewed module; policy approval is still evaluated before queueing."
            ]
          : [
              ...(!packageReady
                ? promotionPackage.readinessReport.requiredActions
                : []),
              ...(!governanceEnabled ? ["Enable tenant governance."] : []),
              ...(!runtimeAvailable
                ? ["Check or install the reviewed runtime."]
                : []),
              ...(!missionCapable
                ? ["Implement a reviewed mission-capable module."]
                : [])
            ],
      status:
        !packageReady || governanceBlocked || !missionCapable
          ? "Blocked"
          : governanceEnabled && runtimeAvailable
            ? "Ready"
            : "NeedsAction",
      summary: missionCapable
        ? "Use the existing mission APIs to execute reviewed modules under policy."
        : "Mission execution is unavailable until a reviewed module supports it.",
      title: "Start policy-gated validation mission"
    })
  ];

  const status =
    !packageReady || governanceBlocked
      ? "Blocked"
      : !governanceEnabled
        ? "ReadyForGovernanceAction"
        : !runtimeAvailable
          ? "NeedsRuntimeAction"
          : internalRunnerCapable && !runnerReady
            ? "NeedsRunnerPrerequisite"
            : "ReadyForPolicyApproval";

  return ThirdPartyToolPromotionHandoffSchema.parse({
    actions,
    candidateId: promotionPackage.candidateId,
    generatedAt,
    governanceEnabled,
    governanceStatus: tool.governance.status,
    promotionPackageId: promotionPackage.promotionPackageId,
    runnerEligibility,
    runtimeAvailable,
    runtimeStatus: tool.runtimeInstallation.installStatus,
    status,
    summary:
      status === "ReadyForPolicyApproval"
        ? `${promotionPackage.displayName} is ready for explicit policy-gated mission or runner approval.`
        : status === "ReadyForGovernanceAction"
          ? `${promotionPackage.displayName} is reviewed but not enabled for this tenant yet.`
          : status === "NeedsRuntimeAction"
            ? `${promotionPackage.displayName} is enabled but needs runtime readiness before use.`
            : status === "NeedsRunnerPrerequisite"
              ? `${promotionPackage.displayName} needs internal runner prerequisites before customer-network dispatch.`
              : `${promotionPackage.displayName} is blocked from governance handoff until readiness, legal, or safety issues are resolved.`,
    tenantId: promotionPackage.tenantId,
    toolId: promotionPackage.toolId
  });
}

function buildCertificationCheck(input: {
  category: ToolPromotionCertificationCheck["category"];
  checkId: string;
  evidence?: string[];
  requiredActions?: string[];
  status: ToolPromotionCertificationCheck["status"];
  summary: string;
  title: string;
}): ToolPromotionCertificationCheck {
  return {
    category: input.category,
    checkId: input.checkId,
    evidence: input.evidence ?? [],
    requiredActions: input.requiredActions ?? [],
    status: input.status,
    summary: input.summary,
    title: input.title
  };
}

function buildPromotionCertification(input: {
  generatedAt?: Date;
  handoff: ThirdPartyToolPromotionHandoff;
  promotionPackage: ThirdPartyToolPromotionPackage;
  runnerEligibility: ThirdPartyToolRunnerEligibility;
  tool: ThirdPartyTool;
}): ThirdPartyToolPromotionCertification {
  const generatedAt = (input.generatedAt ?? new Date()).toISOString();
  const { handoff, promotionPackage, runnerEligibility, tool } = input;
  const packageReady =
    promotionPackage.status === "ReadyForGovernance" &&
    promotionPackage.readinessReport.readyForGovernance;
  const governanceBlocked =
    tool.governance.status === "Blocked" ||
    tool.governance.status === "LegalReviewRequired";
  const governanceEnabled =
    tool.governance.enabled && tool.governance.status === "Enabled";
  const runtimeAvailable = tool.runtimeInstallation.runtimeAvailable;
  const hasRunnerCapability = tool.tool.capabilities.some(
    (capability) => capability.executionMode === "InternalRunner"
  );
  const implementedCapabilities = tool.tool.capabilities.filter(
    (capability) => capability.status === "Implemented"
  );
  const unimplementedCapabilities = tool.tool.capabilities.filter(
    (capability) => capability.status !== "Implemented"
  );
  const hasMissionCapability = implementedCapabilities.some(
    (capability) => capability.executionMode !== "InternalRunner"
  );
  const runnerReady =
    runnerEligibility.status === "Ready" ||
    runnerEligibility.status === "ControlPlaneOnly";
  const executionActions = handoff.actions.filter(
    (action) => action.createsExecution
  );
  const executionGateBypass = executionActions.some(
    (action) => !action.policyGateRequired
  );
  const runnerDispatchable = runnerEligibility.capabilities.some(
    (capability) => capability.dispatchable
  );
  const checks: ToolPromotionCertificationCheck[] = [
    buildCertificationCheck({
      category: "Catalog",
      checkId: "promotion-package",
      evidence: [
        `Promotion package status is ${promotionPackage.status}.`,
        `Readiness status is ${promotionPackage.readinessReport.status}.`
      ],
      requiredActions: packageReady
        ? []
        : promotionPackage.readinessReport.requiredActions,
      status: packageReady ? "Passed" : "Blocked",
      summary: packageReady
        ? "Promotion package is readiness-satisfied."
        : "Promotion package is not ready for governance or execution decisions.",
      title: "Promotion package"
    }),
    buildCertificationCheck({
      category: "Catalog",
      checkId: "reviewed-catalog",
      evidence: [
        `Catalog tool ID is ${promotionPackage.catalogSnapshot.tool.toolId}.`,
        `Catalog policy status is ${promotionPackage.catalogSnapshot.tool.policyStatus}.`
      ],
      requiredActions:
        promotionPackage.catalogSnapshot.tool.toolId ===
          promotionPackage.toolId &&
        promotionPackage.catalogSnapshot.tool.policyStatus !==
          "RequiresLegalReview"
          ? []
          : ["Resolve catalog identity or legal-review status before use."],
      status:
        promotionPackage.catalogSnapshot.tool.toolId !==
          promotionPackage.toolId ||
        promotionPackage.catalogSnapshot.tool.policyStatus ===
          "RequiresLegalReview"
          ? "Blocked"
          : "Passed",
      summary:
        promotionPackage.catalogSnapshot.tool.toolId === promotionPackage.toolId
          ? "Reviewed catalog snapshot matches the promoted tool."
          : "Catalog snapshot does not match the promoted tool ID.",
      title: "Reviewed catalog snapshot"
    }),
    buildCertificationCheck({
      category: "Module",
      checkId: "module-capabilities",
      evidence: [
        `${implementedCapabilities.length} implemented capability/capabilities.`,
        `${unimplementedCapabilities.length} non-implemented capability/capabilities.`
      ],
      requiredActions: unimplementedCapabilities.length
        ? [
            "Implement or remove non-implemented capabilities before certifying full use."
          ]
        : [],
      status: unimplementedCapabilities.length ? "NeedsAction" : "Passed",
      summary: unimplementedCapabilities.length
        ? "Some reviewed capabilities are still fixture-only, planned, deferred, or blocked."
        : "All reviewed capabilities are implemented.",
      title: "Module and capability implementation"
    }),
    buildCertificationCheck({
      category: "Evidence",
      checkId: "required-evidence",
      evidence: promotionPackage.requiredEvidence,
      requiredActions: promotionPackage.requiredEvidence.length
        ? []
        : ["Attach required promotion evidence before certification."],
      status: promotionPackage.requiredEvidence.length
        ? "Passed"
        : "NeedsAction",
      summary: promotionPackage.requiredEvidence.length
        ? "Promotion package includes required evidence statements."
        : "Promotion package does not include required evidence statements.",
      title: "Required evidence"
    }),
    buildCertificationCheck({
      category: "Governance",
      checkId: "tenant-governance",
      evidence: [
        `Governance status is ${tool.governance.status}.`,
        `Governance enabled: ${tool.governance.enabled}.`
      ],
      requiredActions: governanceBlocked
        ? ["Resolve legal review or platform safety block."]
        : governanceEnabled
          ? []
          : ["Enable the reviewed tool for this tenant before use."],
      status: governanceBlocked
        ? "Blocked"
        : governanceEnabled
          ? "Passed"
          : "NeedsAction",
      summary: governanceEnabled
        ? "Tenant governance enables this reviewed tool."
        : "Tenant governance is not yet ready for use.",
      title: "Tenant governance"
    }),
    buildCertificationCheck({
      category: "Runtime",
      checkId: "runtime-readiness",
      evidence: [
        `Runtime status is ${tool.runtimeInstallation.installStatus}.`,
        tool.runtimeInstallation.runtimeReason
      ],
      requiredActions: runtimeAvailable
        ? []
        : tool.governance.allowedRuntimes.length
          ? ["Check or install an allowlisted runtime before execution."]
          : ["Add an allowlisted runtime before execution."],
      status: runtimeAvailable
        ? "Passed"
        : tool.governance.allowedRuntimes.length
          ? "NeedsAction"
          : "Blocked",
      summary: runtimeAvailable
        ? "Runtime readiness is currently satisfied."
        : "Runtime readiness is not currently satisfied.",
      title: "Runtime readiness"
    }),
    buildCertificationCheck({
      category: "Runner",
      checkId: "runner-readiness",
      evidence: hasRunnerCapability
        ? [
            `Runner eligibility status is ${runnerEligibility.status}.`,
            `${runnerEligibility.capabilities.length} runner capability/capabilities evaluated.`
          ]
        : ["No InternalRunner capabilities exist for this tool."],
      requiredActions: hasRunnerCapability
        ? runnerEligibility.requiredActions
        : [],
      status: hasRunnerCapability
        ? runnerReady
          ? "Passed"
          : runnerEligibility.status === "Blocked"
            ? "Blocked"
            : "NeedsAction"
        : "NotApplicable",
      summary: hasRunnerCapability
        ? "Runner prerequisites are evaluated from current tenant state."
        : "Runner dispatch is not required for this promoted tool.",
      title: "Internal runner readiness"
    }),
    buildCertificationCheck({
      category: "Policy",
      checkId: "execution-policy-gates",
      evidence: [
        `${executionActions.length} execution-creating action(s) evaluated.`
      ],
      requiredActions: executionGateBypass
        ? ["Ensure every execution-creating action requires policy approval."]
        : [],
      status: executionGateBypass ? "Blocked" : "Passed",
      summary: executionGateBypass
        ? "At least one execution action would bypass policy gates."
        : "Execution actions remain policy-gated and are not performed by this report.",
      title: "Execution policy gates"
    }),
    buildCertificationCheck({
      category: "Safety",
      checkId: "side-effect-boundary",
      evidence: [
        "Certification reports are read-only.",
        "This route does not enable, install, queue missions, dispatch runner tasks, or execute modules."
      ],
      status: "Passed",
      summary: "Certification has no operational side effects.",
      title: "Read-only certification boundary"
    })
  ];
  const requiredActions = uniqueStrings(
    checks.flatMap((check) => check.requiredActions)
  );
  const hasBlocked = checks.some((check) => check.status === "Blocked");
  const hasNeedsAction = checks.some((check) => check.status === "NeedsAction");
  const certifiedForGovernance = packageReady && !governanceBlocked;
  const certifiedForRuntimeManagement =
    certifiedForGovernance && tool.governance.allowedRuntimes.length > 0;
  const certifiedForRunnerDispatch =
    certifiedForGovernance &&
    governanceEnabled &&
    runtimeAvailable &&
    hasRunnerCapability &&
    runnerReady &&
    runnerDispatchable;
  const certifiedForMissionStart =
    certifiedForGovernance &&
    governanceEnabled &&
    runtimeAvailable &&
    hasMissionCapability &&
    !executionGateBypass;
  const status = hasBlocked
    ? "Blocked"
    : hasNeedsAction
      ? "NeedsAction"
      : "CertifiedForUse";

  return ThirdPartyToolPromotionCertificationSchema.parse({
    candidateId: promotionPackage.candidateId,
    certificationId: `tool-promotion-certification:${promotionPackage.promotionPackageId}`,
    certifiedForGovernance,
    certifiedForMissionStart,
    certifiedForRuntimeManagement,
    certifiedForRunnerDispatch,
    checks,
    displayName: promotionPackage.displayName,
    doesNotDispatchRunnerTasks: true,
    doesNotEnable: true,
    doesNotExecute: true,
    doesNotInstall: true,
    doesNotQueueMissions: true,
    generatedAt,
    governanceStatus: tool.governance.status,
    packageStatus: promotionPackage.status,
    promotionPackageId: promotionPackage.promotionPackageId,
    readinessStatus: promotionPackage.readinessReport.status,
    requiredActions,
    runnerStatus: runnerEligibility.status,
    runtimeStatus: tool.runtimeInstallation.installStatus,
    safetyNotes: uniqueStrings([
      ...promotionPackage.safetyNotes,
      "Certification reports are read-only and do not enable, install, queue, dispatch, or execute tools.",
      "Execution remains subject to verified scope, tenant governance, runtime readiness, runner prerequisites, policy decisions, and audit logging."
    ]),
    status,
    summary:
      status === "CertifiedForUse"
        ? `${promotionPackage.displayName} is certified for policy-gated use from current governance state.`
        : status === "NeedsAction"
          ? `${promotionPackage.displayName} needs ${requiredActions.length} action(s) before full policy-gated use.`
          : `${promotionPackage.displayName} is blocked from certification until legal, safety, catalog, or governance issues are resolved.`,
    tenantId: promotionPackage.tenantId,
    toolId: promotionPackage.toolId
  });
}

async function buildCurrentPromotionCertification(input: {
  context: AuthenticatedContext;
  candidateId: string;
  prisma: DbClient;
  promotionPackageId: string;
}): Promise<ThirdPartyToolPromotionCertification | null> {
  const candidateRow = await input.prisma.thirdPartyToolCandidate.findFirst({
    where: {
      tenantId: input.context.tenant.tenantId,
      thirdPartyToolCandidateId: input.candidateId
    }
  });

  if (!candidateRow) {
    return null;
  }

  const row = await input.prisma.thirdPartyToolPromotionPackage.findFirst({
    where: {
      candidateId: input.candidateId,
      tenantId: input.context.tenant.tenantId,
      thirdPartyToolPromotionPackageId: input.promotionPackageId
    }
  });

  if (!row) {
    return null;
  }

  const candidate = serializeCandidate(candidateRow as PersistedToolCandidate);
  const promotionPackage = serializePromotionPackage(
    row as PersistedToolPromotionPackage,
    candidate
  );
  const tool = await getComposedTool(
    input.prisma,
    input.context.tenant.tenantId,
    promotionPackage.catalogSnapshot
  );
  const requiredScopeTypes = [
    ...new Set(
      tool.tool.capabilities
        .filter((capability) => capability.executionMode === "InternalRunner")
        .flatMap((capability) => capability.requiredScopes)
    )
  ];
  const [activeRunnerCount, verifiedScopes] = await Promise.all([
    input.prisma.runner.count({
      where: {
        killSwitchActive: false,
        status: {
          in: ["Active", "Degraded"]
        },
        tenantId: input.context.tenant.tenantId
      }
    }),
    requiredScopeTypes.length
      ? input.prisma.scope.findMany({
          select: {
            scopeType: true
          },
          where: {
            scopeType: {
              in: requiredScopeTypes
            },
            tenantId: input.context.tenant.tenantId,
            verificationStatus: "Verified"
          }
        })
      : Promise.resolve([])
  ]);
  const verifiedScopeTypes = [
    ...new Set(verifiedScopes.map((scope) => scope.scopeType as ScopeType))
  ];
  const runnerEligibility = buildRunnerEligibilityReport({
    activeRunnerCount,
    tenantId: input.context.tenant.tenantId,
    tool,
    verifiedScopeCount: verifiedScopes.length,
    verifiedScopeTypes
  });
  const handoff = buildPromotionHandoff({
    promotionPackage,
    runnerEligibility,
    tool
  });

  return buildPromotionCertification({
    handoff,
    promotionPackage,
    runnerEligibility,
    tool
  });
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value)))
  ];
}

function safeArtifactSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 96);
}

function taskStatusFromReadiness(
  readiness: ThirdPartyToolCandidateReadiness,
  checkId: string
): ToolImplementationWorkOrderTask["status"] {
  const check = readiness.checks.find((item) => item.checkId === checkId);
  if (!check) {
    return "NotStarted";
  }

  return check.status === "Satisfied" ? "Ready" : "NotStarted";
}

function buildCandidateImplementationWorkOrder(input: {
  candidate: ThirdPartyToolCandidate;
  generatedAt?: Date;
  generatedBy: string | null;
  readiness: ThirdPartyToolCandidateReadiness;
}): ThirdPartyToolImplementationWorkOrder {
  const { candidate, readiness } = input;
  const generatedAt = (input.generatedAt ?? new Date()).toISOString();
  const slug = safeArtifactSlug(candidate.toolId);
  const modulePath = `packages/modules/src/${slug}.ts`;
  const fixturePath = `packages/modules/fixtures/${slug}.json`;
  const policyTestPath = `packages/modules/src/${slug}.test.ts`;
  const docsPath = `docs/agent-tasks/open-source-tools/${slug}.md`;
  const tasks: ToolImplementationWorkOrderTask[] = [
    {
      blocksExecution: true,
      category: "CatalogMetadata",
      description:
        "Add reviewed tool catalog metadata with license, runtime, default version, phase, and policy disposition.",
      requiredEvidence: [
        "Reviewed catalog entry exists",
        "License disposition is documented"
      ],
      status: taskStatusFromReadiness(readiness, "catalog-entry"),
      taskId: "catalog-metadata",
      title: "Create reviewed tool catalog entry"
    },
    {
      blocksExecution: true,
      category: "ModuleManifest",
      description:
        "Implement the validation module manifest and bind it to the reviewed tool ID.",
      requiredEvidence: [
        `Module manifest ${candidate.manifest.moduleId} exists`,
        `Module declares tool ${candidate.toolId}`
      ],
      status:
        taskStatusFromReadiness(readiness, "module-manifest") === "Ready" &&
        taskStatusFromReadiness(readiness, "module-tool-binding") === "Ready"
          ? "Ready"
          : "NotStarted",
      taskId: "module-manifest",
      title: "Create module manifest and tool binding"
    },
    {
      blocksExecution: true,
      category: "Parser",
      description:
        "Create parser, normalization, and redaction logic that produces Periscan evidence instead of raw tool dumps.",
      requiredEvidence: [
        "Parser fixture test passes",
        "Redaction test proves secrets/prompts/tokens are not stored raw"
      ],
      status: "NotStarted",
      taskId: "parser-redaction",
      title: "Implement parser and redaction fixtures"
    },
    {
      blocksExecution: true,
      category: "Policy",
      description:
        "Add policy tests proving the module respects scope verification, safety level, approval, disabled-tool, and legal-review gates.",
      requiredEvidence: [
        "Policy denial test",
        "Disabled-tool mission denial test",
        "No execution before policy decision"
      ],
      status: "NotStarted",
      taskId: "policy-gates",
      title: "Certify policy and safety gates"
    },
    {
      blocksExecution:
        candidate.validationReport.governance.requiresInternalRunner,
      category: "Runner",
      description: candidate.validationReport.governance.requiresInternalRunner
        ? "Define the outbound signed-task runner execution contract, local allowlist, resource limits, and evidence upload path."
        : "Confirm the module remains control-plane/external-PoA only and does not require runner dispatch.",
      requiredEvidence: candidate.validationReport.governance
        .requiresInternalRunner
        ? [
            "Runner task schema",
            "Local allowlist test",
            "Unsigned/wrong-scope task rejection test"
          ]
        : ["Execution plane documented as non-runner"],
      status: taskStatusFromReadiness(readiness, "runner-compatibility"),
      taskId: "execution-contract",
      title: "Define execution contract"
    },
    {
      blocksExecution: true,
      category: "Evidence",
      description:
        "Wire normalized output into evidence storage, graph nodes/edges, report sections, and no-raw-findings UX.",
      requiredEvidence: [
        "Evidence artifact creation test",
        "Graph projection test",
        "Report appendix uses redacted normalized evidence"
      ],
      status: "NotStarted",
      taskId: "evidence-integration",
      title: "Wire evidence, graph, and report outputs"
    },
    {
      blocksExecution: true,
      category: "License",
      description:
        "Update license inventory/notices and fail CI on disallowed or unknown license posture.",
      requiredEvidence: [
        "License inventory includes the tool",
        "License policy test passes"
      ],
      status: taskStatusFromReadiness(readiness, "legal-safety"),
      taskId: "license-notice",
      title: "Update license and legal review records"
    },
    {
      blocksExecution: false,
      category: "Documentation",
      description:
        "Document operator setup, supported scopes, required permissions, safe-use limits, and customer-visible capability behavior.",
      requiredEvidence: [
        "Docs include setup, permissions, safety, and evidence behavior"
      ],
      status: "NotStarted",
      taskId: "docs-runbook",
      title: "Write implementation and operator docs"
    }
  ];
  const scaffoldFiles: ToolImplementationScaffoldFile[] = [
    {
      contentPreview: [
        `toolId: ${candidate.toolId}`,
        `displayName: ${candidate.displayName}`,
        `license: ${candidate.manifest.license}`,
        `runtimePreference: ${candidate.manifest.runtimePreference.join(", ")}`
      ].join("\n"),
      path: "packages/modules/src/toolchain.ts",
      purpose: "Reviewed OSS tool catalog metadata entry",
      templateKind: "CatalogEntry"
    },
    {
      contentPreview: [
        `moduleId: ${candidate.manifest.moduleId}`,
        `toolIds: ${candidate.toolId}`,
        `safetyLevel: ${candidate.manifest.safetyLevel}`,
        `executionMode: ${candidate.manifest.executionMode}`
      ].join("\n"),
      path: modulePath,
      purpose: "Validation module manifest, executor, and parser wrapper",
      templateKind: "ModuleManifest"
    },
    {
      contentPreview: `fixtureFor: ${candidate.manifest.moduleId}\nexpectedEvidence: ${candidate.manifest.evidenceTypes.join(", ")}`,
      path: fixturePath,
      purpose: "Deterministic parser/redaction fixture",
      templateKind: "ParserFixture"
    },
    {
      contentPreview: `describe("${candidate.manifest.moduleId} policy gates", ...)`,
      path: policyTestPath,
      purpose: "Module lifecycle, parser, redaction, and policy tests",
      templateKind: "PolicyTest"
    },
    {
      contentPreview: `${candidate.displayName} (${candidate.manifest.license})`,
      path: "licenses/THIRD_PARTY_NOTICES.md",
      purpose: "License inventory and third-party notice update",
      templateKind: "LicenseNotice"
    },
    {
      contentPreview: `# ${candidate.displayName}\n\nSafe use: ${candidate.manifest.intendedUse}`,
      path: docsPath,
      purpose: "Per-tool implementation and operator runbook",
      templateKind: "Docs"
    }
  ];
  const status =
    readiness.status === "Blocked"
      ? "Blocked"
      : readiness.readyForGovernance
        ? "ReadyForImplementation"
        : "Draft";

  return ThirdPartyToolImplementationWorkOrderSchema.parse({
    candidateId: candidate.candidateId,
    createdAt: generatedAt,
    displayName: candidate.displayName,
    generatedBy: input.generatedBy,
    readinessStatus: readiness.status,
    requiredActions: readiness.requiredActions,
    reviewStatus: candidate.reviewStatus,
    scaffoldFiles,
    status,
    summary:
      status === "ReadyForImplementation"
        ? `${candidate.displayName} has the required reviewed surfaces and can move into implementation verification.`
        : `${candidate.displayName} needs ${readiness.requiredActions.length} implementation action(s) before governance promotion or execution.`,
    tasks,
    tenantId: candidate.tenantId,
    toolId: candidate.toolId,
    updatedAt: generatedAt,
    workOrderId: "00000000-0000-4000-8000-000000000000"
  });
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function buildImplementationBundleFile(
  file: ToolImplementationScaffoldFile,
  input: {
    candidate: ThirdPartyToolCandidate;
    workOrder: ThirdPartyToolImplementationWorkOrder;
  }
): ToolImplementationBundleFile {
  const content = [
    "# Periscan implementation scaffold",
    `# Tool: ${input.candidate.displayName} (${input.candidate.toolId})`,
    `# Work order: ${input.workOrder.workOrderId}`,
    `# Template: ${file.templateKind}`,
    `# Purpose: ${file.purpose}`,
    "",
    file.contentPreview,
    "",
    "# Required review evidence",
    ...input.workOrder.tasks
      .filter((task) => task.blocksExecution)
      .flatMap((task) =>
        task.requiredEvidence.map((evidence) => `- ${task.taskId}: ${evidence}`)
      )
  ].join("\n");

  return {
    content,
    contentSha256: sha256(content),
    path: file.path,
    purpose: file.purpose,
    templateKind: file.templateKind
  };
}

function buildThirdPartyToolImplementationBundle(input: {
  candidate: ThirdPartyToolCandidate;
  generatedAt?: Date;
  workOrder: ThirdPartyToolImplementationWorkOrder;
}): ThirdPartyToolImplementationBundle {
  const generatedAt = (input.generatedAt ?? new Date()).toISOString();
  const files = input.workOrder.scaffoldFiles.map((file) =>
    buildImplementationBundleFile(file, input)
  );
  const status =
    input.workOrder.status === "Blocked" ? "Blocked" : "ReadyForDownload";

  return ThirdPartyToolImplementationBundleSchema.parse({
    bundleId: `tool-implementation-bundle:${input.workOrder.workOrderId}`,
    candidateId: input.candidate.candidateId,
    commands: [
      "pnpm --filter @periscan/modules test",
      "pnpm test:modules -- module-certification",
      "pnpm lint",
      "pnpm typecheck"
    ],
    displayName: input.candidate.displayName,
    doesNotExecute: true,
    files,
    generatedAt,
    readinessStatus: input.workOrder.readinessStatus,
    requiredActions: input.workOrder.requiredActions,
    reviewStatus: input.workOrder.reviewStatus,
    safetyNotes: [
      "Implementation bundles are scaffold artifacts only and do not install, enable, queue, dispatch, or execute tools.",
      "Only reviewed catalog/module changes can make a tool governable or runnable.",
      "Customer-network execution must use signed Internal Runner tasks with verified scope, local allowlists, resource limits, evidence upload, and audit events."
    ],
    status,
    summary:
      status === "ReadyForDownload"
        ? `${input.candidate.displayName} implementation bundle contains ${files.length} scaffold file(s) and ${input.workOrder.tasks.length} review task(s).`
        : `${input.candidate.displayName} implementation bundle is blocked until the work order blocking actions are resolved.`,
    tenantId: input.candidate.tenantId,
    toolId: input.candidate.toolId,
    workOrderId: input.workOrder.workOrderId
  });
}

function buildCandidateReadinessReport(input: {
  catalogEntry: OpenSourceToolCatalogEntry | null;
  candidate: ThirdPartyToolCandidate;
  generatedAt?: Date;
}): ThirdPartyToolCandidateReadiness {
  const { catalogEntry, candidate } = input;
  const generatedAt = (input.generatedAt ?? new Date()).toISOString();
  const moduleManifest = listModuleManifests().find(
    (manifest) => manifest.moduleId === candidate.manifest.moduleId
  );
  const moduleDeclaresTool =
    moduleManifest?.toolIds.some((toolId) => toolId === candidate.toolId) ??
    false;
  const governancePolicyAvailable = Boolean(catalogEntry);
  const checks: ToolCandidateReadinessCheck[] = [
    {
      checkId: "intake-decision",
      evidence: [`Candidate status is ${candidate.status}.`],
      requiredAction:
        candidate.status === "AcceptedForCatalogReview"
          ? null
          : candidate.status === "Rejected"
            ? "Resolve blocked intake findings and resubmit a safe manifest."
            : "Resolve intake report warnings before platform review.",
      status:
        candidate.status === "AcceptedForCatalogReview"
          ? "Satisfied"
          : candidate.status === "Rejected"
            ? "Blocked"
            : "ActionRequired",
      summary:
        candidate.status === "AcceptedForCatalogReview"
          ? "The candidate passed automated intake checks for review."
          : candidate.validationReport.summary,
      title: "Intake certification"
    },
    {
      checkId: "catalog-entry",
      evidence: catalogEntry
        ? [`Reviewed catalog entry exists for ${candidate.toolId}.`]
        : [
            `Candidate tool ID ${candidate.toolId} is not in the reviewed catalog.`
          ],
      requiredAction: catalogEntry
        ? null
        : "Add a reviewed OSS tool catalog entry before tenant governance can manage this tool.",
      status: catalogEntry ? "Satisfied" : "Missing",
      summary: catalogEntry
        ? "The tool is present in the reviewed OSS catalog."
        : "No reviewed catalog entry exists yet.",
      title: "Reviewed catalog entry"
    },
    {
      checkId: "module-manifest",
      evidence: moduleManifest
        ? [`Module manifest ${moduleManifest.moduleId} exists.`]
        : [`Module manifest ${candidate.manifest.moduleId} is not registered.`],
      requiredAction: moduleManifest
        ? null
        : "Implement and register the validation module manifest, parser, fixtures, and tests.",
      status: moduleManifest ? "Satisfied" : "Missing",
      summary: moduleManifest
        ? "The requested module manifest is registered."
        : "No registered module manifest exists for this candidate.",
      title: "Module manifest"
    },
    {
      checkId: "module-tool-binding",
      evidence: moduleManifest
        ? [
            moduleDeclaresTool
              ? `Module ${moduleManifest.moduleId} declares tool ${candidate.toolId}.`
              : `Module ${moduleManifest.moduleId} does not declare tool ${candidate.toolId}.`
          ]
        : ["Tool binding cannot be checked until the module manifest exists."],
      requiredAction: moduleDeclaresTool
        ? null
        : "Bind the reviewed tool ID to the module manifest after adding it to the shared tool ID contract.",
      status: moduleManifest
        ? moduleDeclaresTool
          ? "Satisfied"
          : "ActionRequired"
        : "Missing",
      summary: moduleDeclaresTool
        ? "The module/tool relationship is declared."
        : "The module is not yet bound to the proposed tool ID.",
      title: "Module to tool binding"
    },
    {
      checkId: "governance-policy",
      evidence: governancePolicyAvailable
        ? [
            "A governance policy can be composed from the reviewed catalog entry."
          ]
        : [
            "Governance policies are only available for reviewed catalog tools."
          ],
      requiredAction: governancePolicyAvailable
        ? null
        : "Promote the reviewed catalog entry before enabling, disabling, checking, or installing the tool.",
      status: governancePolicyAvailable ? "Satisfied" : "Missing",
      summary: governancePolicyAvailable
        ? "The tool can use tenant governance policy."
        : "Tenant governance is unavailable until catalog promotion.",
      title: "Governance policy surface"
    },
    {
      checkId: "runtime-installability",
      evidence: [
        `Installable runtimes: ${
          candidate.validationReport.governance.installableRuntimes.length
            ? candidate.validationReport.governance.installableRuntimes.join(
                ", "
              )
            : "none"
        }.`
      ],
      requiredAction: candidate.validationReport.governance.installableRuntimes
        .length
        ? null
        : "Declare at least one allowlisted runtime source such as docker, git, binary, npx, or pip.",
      status: candidate.validationReport.governance.installableRuntimes.length
        ? "Satisfied"
        : "ActionRequired",
      summary: candidate.validationReport.governance.installableRuntimes.length
        ? "The manifest includes an allowlisted runtime installation path."
        : "The manifest does not include an installable runtime path.",
      title: "Runtime installability"
    },
    {
      checkId: "runner-compatibility",
      evidence: [
        candidate.validationReport.governance.requiresInternalRunner
          ? `Runner compatible: ${candidate.validationReport.governance.runnerCompatible}.`
          : "No internal runner is required by the proposed execution mode."
      ],
      requiredAction:
        candidate.validationReport.governance.requiresInternalRunner &&
        !candidate.validationReport.governance.runnerCompatible
          ? "Adjust the module execution mode/run mode so it can execute through the outbound signed-task runner."
          : null,
      status:
        candidate.validationReport.governance.requiresInternalRunner &&
        !candidate.validationReport.governance.runnerCompatible
          ? "ActionRequired"
          : "Satisfied",
      summary:
        candidate.validationReport.governance.requiresInternalRunner &&
        !candidate.validationReport.governance.runnerCompatible
          ? "The proposed tool cannot safely run through the internal runner yet."
          : "Runner posture is compatible with the proposed execution mode.",
      title: "Runner compatibility"
    },
    {
      checkId: "legal-safety",
      evidence: [
        `Policy status: ${candidate.validationReport.governance.policyStatus}.`,
        `Safety level: ${candidate.manifest.safetyLevel}.`
      ],
      requiredAction: candidate.validationReport.governance.legalReviewRequired
        ? "Complete legal and safety review before catalog promotion or tenant enablement."
        : null,
      status: candidate.validationReport.governance.legalReviewRequired
        ? "Blocked"
        : "Satisfied",
      summary: candidate.validationReport.governance.legalReviewRequired
        ? "Legal or safety review blocks governance promotion."
        : "No legal-review block was produced by intake.",
      title: "Legal and safety posture"
    }
  ];
  const hasBlocked = checks.some((check) => check.status === "Blocked");
  const hasOpenWork = checks.some((check) => check.status !== "Satisfied");
  const status = hasBlocked
    ? "Blocked"
    : hasOpenWork
      ? "NeedsImplementation"
      : "ReadyForGovernance";

  return ThirdPartyToolCandidateReadinessSchema.parse({
    candidateId: candidate.candidateId,
    catalogEntryPresent: Boolean(catalogEntry),
    checks,
    displayName: candidate.displayName,
    generatedAt,
    governancePolicyAvailable,
    moduleManifestPresent: Boolean(moduleManifest),
    readyForGovernance: status === "ReadyForGovernance",
    requiredActions: uniqueStrings([
      ...candidate.validationReport.requiredActions,
      ...checks.map((check) => check.requiredAction)
    ]),
    status,
    tenantId: candidate.tenantId,
    toolId: candidate.toolId
  });
}

async function getPolicyRecords(
  prisma: DbClient,
  tenantId: string,
  toolIds: OpenSourceToolId[]
) {
  const rows = await prisma.thirdPartyToolPolicy.findMany({
    where: {
      ownerKey: {
        in: [GLOBAL_OWNER_KEY, tenantId]
      },
      toolId: {
        in: toolIds
      }
    }
  });

  const global = new Map<string, PersistedPolicy>();
  const tenant = new Map<string, PersistedPolicy>();

  for (const row of rows) {
    if (row.ownerKey === GLOBAL_OWNER_KEY) {
      global.set(row.toolId, row as PersistedPolicy);
    } else {
      tenant.set(row.toolId, row as PersistedPolicy);
    }
  }

  return { global, tenant };
}

async function ensureDefaultPolicy(
  prisma: DbClient,
  entry: OpenSourceToolCatalogEntry
) {
  const defaults = defaultPolicyForEntry(entry, null);
  const runtime = serializeRuntimeInstallation(entry, null);
  return prisma.thirdPartyToolPolicy.upsert({
    create: {
      allowedRuntimes: defaults.allowedRuntimes,
      disabledReason: defaults.disabledReason,
      enabled: defaults.enabled,
      installStatus: runtime.installStatus,
      installedAt: runtime.installedAt ? new Date(runtime.installedAt) : null,
      installedVersion: runtime.installedVersion,
      lastCheckedAt: runtime.lastCheckedAt
        ? new Date(runtime.lastCheckedAt)
        : null,
      legalReviewStatus: defaults.legalReviewStatus,
      ownerKey: GLOBAL_OWNER_KEY,
      pinnedGitRef: defaults.pinnedGitRef,
      pinnedImageRef: defaults.pinnedImageRef,
      pinnedVersion: defaults.pinnedVersion,
      runtimeAvailable: runtime.runtimeAvailable,
      runtimeKind: runtime.runtimeKind,
      runtimeReason: runtime.runtimeReason,
      status: defaults.status,
      tenantId: null,
      toolId: defaults.toolId
    },
    update: {},
    where: {
      ownerKey_toolId: {
        ownerKey: GLOBAL_OWNER_KEY,
        toolId: entry.tool.toolId
      }
    }
  });
}

async function resolvePromotionInputs(input: {
  candidate: ThirdPartyToolCandidate;
  prisma: DbClient;
  tenantId: string;
}) {
  const entry = await getOpenSourceToolCatalogEntryWithRuntime(
    input.candidate.toolId as OpenSourceToolId
  );

  if (!entry) {
    throw new AppServiceError(
      "Candidate does not have a reviewed catalog entry.",
      409,
      "third_party_tool_candidate_missing_catalog_entry"
    );
  }

  await ensureDefaultPolicy(input.prisma, entry);
  const { global, tenant } = await getPolicyRecords(
    input.prisma,
    input.tenantId,
    [entry.tool.toolId]
  );
  const policyRecord =
    tenant.get(entry.tool.toolId) ?? global.get(entry.tool.toolId) ?? null;
  const governance = serializePolicy(entry, policyRecord, input.tenantId);
  const runtime = serializeRuntimeInstallation(entry, policyRecord);
  const readiness = buildCandidateReadinessReport({
    candidate: input.candidate,
    catalogEntry: entry
  });

  return {
    entry,
    governance,
    readiness,
    runtime
  };
}

async function createPromotionPackageForCandidate(input: {
  candidate: ThirdPartyToolCandidate;
  context: AuthenticatedContext;
  prisma: DbClient;
}) {
  if (input.candidate.reviewStatus !== "PromotedToCatalog") {
    throw new AppServiceError(
      "Candidate must be promoted to catalog before a promotion package is generated.",
      409,
      "third_party_tool_candidate_not_promoted"
    );
  }

  const { entry, governance, readiness, runtime } =
    await resolvePromotionInputs({
      candidate: input.candidate,
      prisma: input.prisma,
      tenantId: input.context.tenant.tenantId
    });

  if (!readiness.readyForGovernance) {
    throw new AppServiceError(
      "Candidate cannot generate a promotion package until reviewed catalog, module, governance, runner, and safety checks are satisfied.",
      409,
      "third_party_tool_candidate_not_ready"
    );
  }

  const promotionPackage = buildPromotionPackage({
    catalogEntry: entry,
    candidate: input.candidate,
    governance,
    promotedBy: input.context.user.userId,
    readiness,
    runtime
  });
  const row = await input.prisma.thirdPartyToolPromotionPackage.create({
    data: {
      capabilityIds: promotionPackage.capabilityIds,
      candidateId: input.candidate.candidateId,
      catalogSnapshot:
        promotionPackage.catalogSnapshot as unknown as Prisma.InputJsonValue,
      governanceSnapshot:
        promotionPackage.governanceSnapshot as unknown as Prisma.InputJsonValue,
      implementationOwner: promotionPackage.implementationOwner,
      moduleIds: promotionPackage.moduleIds,
      promotedAt: new Date(promotionPackage.promotedAt),
      promotedByUserId: input.context.user.userId,
      readinessReport:
        promotionPackage.readinessReport as unknown as Prisma.InputJsonValue,
      requiredEvidence: promotionPackage.requiredEvidence,
      reviewStatus: promotionPackage.reviewStatus,
      runtimeInstallation:
        promotionPackage.runtimeInstallation as unknown as Prisma.InputJsonValue,
      safetyNotes: promotionPackage.safetyNotes,
      status: promotionPackage.status,
      summary: promotionPackage.summary,
      tenantId: input.context.tenant.tenantId,
      toolId: entry.tool.toolId
    }
  });

  await writeAuditEvent(input.prisma, {
    action: "third_party_tool.promotion_package_generated",
    actorType: "User",
    entityId: row.thirdPartyToolPromotionPackageId,
    entityType: "ThirdPartyToolPromotionPackage",
    metadata: {
      capabilityIds: promotionPackage.capabilityIds,
      candidateId: input.candidate.candidateId,
      candidateToolId: input.candidate.toolId,
      moduleIds: promotionPackage.moduleIds,
      packageId: row.thirdPartyToolPromotionPackageId,
      status: promotionPackage.status,
      toolId: entry.tool.toolId
    },
    tenantId: input.context.tenant.tenantId,
    userId: input.context.user.userId
  });

  return serializePromotionPackage(
    row as PersistedToolPromotionPackage,
    input.candidate
  );
}

async function getComposedTool(
  prisma: DbClient,
  tenantId: string,
  entry: OpenSourceToolCatalogEntry
): Promise<ThirdPartyTool> {
  await ensureDefaultPolicy(prisma, entry);
  const { global, tenant } = await getPolicyRecords(prisma, tenantId, [
    entry.tool.toolId
  ]);
  const policy =
    tenant.get(entry.tool.toolId) ?? global.get(entry.tool.toolId) ?? null;
  const recentJobs = await prisma.thirdPartyToolInstallJob.findMany({
    orderBy: {
      createdAt: "desc"
    },
    take: 5,
    where: {
      OR: [
        {
          tenantId
        },
        {
          tenantId: null
        }
      ],
      toolId: entry.tool.toolId
    }
  });

  return {
    governance: serializePolicy(entry, policy, tenantId),
    recentJobs: recentJobs.map((job) =>
      serializeJob(job as PersistedInstallJob)
    ),
    runtimeInstallation: serializeRuntimeInstallation(entry, policy),
    tool: entry
  };
}

async function buildUpstreamVersionCheckFields(
  entry: OpenSourceToolCatalogEntry
) {
  const discovery = await discoverTrustedUpstreamToolVersion(entry.tool);
  const policyBlocked = entry.tool.policyStatus === "RequiresLegalReview";
  const policyDeferred = entry.tool.policyStatus === "Deferred";
  const catalogVersion = entry.tool.defaultVersion;
  const discoveredVersion = discovery.discoveredVersion;
  const updateAvailable = Boolean(
    discoveredVersion &&
    compareToolVersions(discoveredVersion, catalogVersion) !== 0
  );

  const status: ToolUpstreamVersionCheckStatus = policyBlocked
    ? "Blocked"
    : policyDeferred
      ? "Deferred"
      : discovery.error || !discoveredVersion
        ? "Unavailable"
        : updateAvailable
          ? "CandidateAvailable"
          : "UpToDate";

  const requiredActions: string[] = [];
  if (status === "CandidateAvailable") {
    requiredActions.push(
      "Review upstream release notes, license posture, and safety impact before updating the reviewed catalog."
    );
    requiredActions.push(
      "Update the catalog pin, runtime image/ref, module fixtures, parser tests, license notices, and traceability before tenant recommendations can apply it."
    );
  } else if (status === "Blocked") {
    requiredActions.push(
      "Complete legal and safety review before considering upstream updates."
    );
  } else if (status === "Deferred") {
    requiredActions.push(
      "Promote the tool out of deferred status before upstream versions can affect customer workflows."
    );
  } else if (status === "Unavailable") {
    requiredActions.push(
      "Configure a trusted upstream source or retry when the upstream metadata endpoint is available."
    );
  } else {
    requiredActions.push("No upstream catalog update candidate was found.");
  }

  const reason =
    status === "CandidateAvailable"
      ? `Trusted upstream version ${discoveredVersion} differs from reviewed catalog version ${catalogVersion}.`
      : status === "UpToDate"
        ? `${entry.tool.displayName} reviewed catalog version ${catalogVersion} matches the trusted upstream version.`
        : discovery.error
          ? discovery.error
          : `${entry.tool.displayName} cannot use upstream discovery until its policy status changes.`;

  return {
    catalogVersion,
    discoveredVersion,
    metadata: {
      ...discovery.metadata,
      reviewRequired: status === "CandidateAvailable"
    },
    reason,
    requiredActions,
    sourceKind: discovery.sourceKind,
    sourceUrl: discovery.sourceUrl,
    status,
    updateAvailable
  };
}

async function createUpstreamVersionCheck(
  prisma: DbClient,
  context: AuthenticatedContext,
  entry: OpenSourceToolCatalogEntry
): Promise<ThirdPartyToolUpstreamVersionCheck> {
  const checkFields = await buildUpstreamVersionCheckFields(entry);
  const toolId = entry.tool.toolId;
  const row = await prisma.thirdPartyToolUpstreamVersionCheck.create({
    data: {
      catalogVersion: checkFields.catalogVersion,
      checkedByUserId: context.user.userId,
      discoveredVersion: checkFields.discoveredVersion,
      metadata: checkFields.metadata as Prisma.InputJsonValue,
      reason: checkFields.reason,
      requiredActions: checkFields.requiredActions,
      sourceKind: checkFields.sourceKind,
      sourceUrl: checkFields.sourceUrl,
      status: checkFields.status,
      tenantId: context.tenant.tenantId,
      toolId,
      updateAvailable: checkFields.updateAvailable
    }
  });
  const check = serializeUpstreamVersionCheck(
    row as PersistedToolUpstreamVersionCheck
  );

  await writeAuditEvent(prisma, {
    action: "third_party_tool.upstream_checked",
    actorType: "User",
    entityId: row.thirdPartyToolUpstreamVersionCheckId,
    entityType: "ThirdPartyToolUpstreamVersionCheck",
    metadata: {
      catalogVersion: check.catalogVersion,
      checkId: check.checkId,
      discoveredVersion: check.discoveredVersion,
      sourceKind: check.sourceKind,
      status: check.status,
      toolId,
      updateAvailable: check.updateAvailable
    },
    tenantId: context.tenant.tenantId,
    userId: context.user.userId
  });

  return check;
}

async function createUpdateRecommendation(
  prisma: DbClient,
  context: AuthenticatedContext,
  entry: OpenSourceToolCatalogEntry
): Promise<ThirdPartyToolUpdateRecommendation> {
  const composed = await getComposedTool(
    prisma,
    context.tenant.tenantId,
    entry
  );
  const recommendationFields = buildUpdateRecommendationFields({
    entry,
    policy: composed.governance,
    runtime: composed.runtimeInstallation
  });
  const toolId = entry.tool.toolId;
  const row = await prisma.thirdPartyToolUpdateRecommendation.create({
    data: {
      currentInstalledVersion: recommendationFields.currentInstalledVersion,
      currentPinnedVersion: recommendationFields.currentPinnedVersion,
      generatedByUserId: context.user.userId,
      policyBlocked: recommendationFields.policyBlocked,
      reason: recommendationFields.reason,
      requiredActions: recommendationFields.requiredActions,
      reviewedVersion: recommendationFields.reviewedVersion,
      runtimeKind: recommendationFields.runtimeKind,
      source: recommendationFields.source,
      status: recommendationFields.status,
      tenantId: context.tenant.tenantId,
      toolId
    }
  });
  const recommendation = serializeUpdateRecommendation(
    row as PersistedToolUpdateRecommendation
  );

  await writeAuditEvent(prisma, {
    action: "third_party_tool.update_checked",
    actorType: "User",
    entityId: row.thirdPartyToolUpdateRecommendationId,
    entityType: "ThirdPartyToolUpdateRecommendation",
    metadata: {
      currentPinnedVersion: recommendation.currentPinnedVersion,
      policyBlocked: recommendation.policyBlocked,
      recommendationId: recommendation.recommendationId,
      reviewedVersion: recommendation.reviewedVersion,
      status: recommendation.status,
      toolId
    },
    tenantId: context.tenant.tenantId,
    userId: context.user.userId
  });

  return recommendation;
}

function mostRecentDate(values: Array<Date | string | null | undefined>) {
  const dates = values
    .filter((value): value is Date | string => Boolean(value))
    .map((value) => (value instanceof Date ? value : new Date(value)))
    .filter((value) => !Number.isNaN(value.getTime()));

  if (!dates.length) {
    return null;
  }

  return (
    dates.sort((left, right) => right.getTime() - left.getTime())[0] ?? null
  );
}

function skippedRefreshReason(input: {
  includeDeferred: boolean;
  includeDisabled: boolean;
  includeLegalReview: boolean;
  tool: ThirdPartyTool;
}): { reason: string; requiredActions: string[] } | null {
  if (
    input.tool.governance.status === "LegalReviewRequired" &&
    !input.includeLegalReview
  ) {
    return {
      reason: "Tool requires legal review and was excluded from due refresh.",
      requiredActions: [
        "Complete legal and safety review before including this tool."
      ]
    };
  }

  if (
    input.tool.tool.tool.toolId === "sharphound" &&
    !input.includeLegalReview
  ) {
    return {
      reason: "SharpHound collector remains blocked pending legal review.",
      requiredActions: [
        "Keep SharpHound disabled until legal review explicitly approves collector use."
      ]
    };
  }

  if (
    input.tool.tool.tool.policyStatus === "Deferred" &&
    !input.includeDeferred
  ) {
    return {
      reason: "Tool is deferred and was excluded from due refresh.",
      requiredActions: [
        "Promote the tool before including it in refresh batches."
      ]
    };
  }

  if (
    (!input.tool.governance.enabled ||
      input.tool.governance.status === "Disabled") &&
    !input.includeDisabled
  ) {
    return {
      reason:
        "Tool is disabled for this tenant and was excluded from due refresh.",
      requiredActions: ["Enable the reviewed tool before including it."]
    };
  }

  if (input.tool.governance.status === "Blocked") {
    return {
      reason: "Tool is blocked by governance policy.",
      requiredActions: ["Resolve the blocked governance state before refresh."]
    };
  }

  return null;
}

function assertTenantAdmin(context: AuthenticatedContext) {
  requireRole(
    context.membership.role,
    TENANT_ADMIN_ROLES,
    "manage third-party validation tools"
  );
}

function canEnableEntry(entry: OpenSourceToolCatalogEntry) {
  const defaults = defaultGovernanceStatus(entry);
  return defaults.enabled && defaults.status === "Enabled";
}

function requiresLicenseAcceptance(entry: OpenSourceToolCatalogEntry) {
  return entry.tool.policyStatus === "RequiresLegalReview";
}

/** Hard safety blocks that never get an install path (not legal-review installable tools). */
export function isInstallHardBlocked(entry: OpenSourceToolCatalogEntry) {
  if (isEngineLabTheaterToolId(entry.tool.toolId)) {
    return true;
  }
  if (entry.tool.policyStatus === "RequiresLegalReview") {
    return false;
  }

  const defaults = defaultGovernanceStatus(entry);
  return !defaults.enabled || defaults.status === "Blocked";
}

/**
 * Hard blocks that never get enablement (AGPL/Blocked readiness, not legal-review).
 * Legal-review tools can enable only after a current license acceptance for the pin.
 * Theater IDs (Atomic / Caldera / SharpHound / sqlmap / Metasploit / …) never enable.
 */
export function isEnableHardBlocked(entry: OpenSourceToolCatalogEntry) {
  if (isEngineLabTheaterToolId(entry.tool.toolId)) {
    return true;
  }
  if (entry.tool.policyStatus === "RequiresLegalReview") {
    return false;
  }

  return !canEnableEntry(entry);
}

async function hasCurrentLicenseAcceptance(
  prisma: DbClient,
  input: {
    entry: OpenSourceToolCatalogEntry;
    tenantId: string;
  }
) {
  const version = resolveLicensePinVersion(input.entry);
  const spdx = resolveLicenseSpdx(input.entry);
  const textHash = computeToolLicenseTextHash({
    docsUrl: input.entry.tool.docsUrl,
    spdx,
    toolId: input.entry.tool.toolId,
    version
  });
  const acceptance = await findCurrentLicenseAcceptance(prisma, {
    tenantId: input.tenantId,
    textHash,
    toolId: input.entry.tool.toolId,
    version
  });
  return Boolean(acceptance);
}

function resolveLicensePinVersion(
  entry: OpenSourceToolCatalogEntry,
  requestedVersion?: string
) {
  const version = requestedVersion?.trim() || entry.tool.defaultVersion;
  if (!version) {
    throw new AppServiceError(
      "A pin version is required to accept a tool license.",
      400,
      "tool_license_version_required"
    );
  }
  return version;
}

function resolveLicenseSpdx(
  entry: OpenSourceToolCatalogEntry,
  requestedSpdx?: string
) {
  const spdx = requestedSpdx?.trim() || entry.tool.license;
  if (!spdx) {
    throw new AppServiceError(
      "An SPDX license identifier is required.",
      400,
      "tool_license_spdx_required"
    );
  }
  return spdx;
}

/** Deterministic SHA-256 of the acceptance ceremony payload for a pin. */
export function computeToolLicenseTextHash(input: {
  docsUrl: string;
  spdx: string;
  toolId: string;
  version: string;
}) {
  return createHash("sha256")
    .update(
      [
        input.toolId,
        input.version,
        input.spdx,
        input.docsUrl,
        "upstream-not-redistributed-by-periscan"
      ].join("|"),
      "utf8"
    )
    .digest("hex");
}

function serializeLicenseAcceptance(record: {
  acceptedAt: Date;
  acceptedBy: string;
  createdAt: Date;
  spdx: string;
  tenantId: string;
  textHash: string;
  toolId: string;
  toolLicenseAcceptanceId: string;
  version: string;
}): ToolLicenseAcceptance {
  return ToolLicenseAcceptanceSchema.parse({
    acceptanceId: record.toolLicenseAcceptanceId,
    acceptedAt: record.acceptedAt.toISOString(),
    acceptedBy: record.acceptedBy,
    createdAt: record.createdAt.toISOString(),
    spdx: record.spdx,
    tenantId: record.tenantId,
    textHash: record.textHash.toLowerCase(),
    toolId: record.toolId,
    version: record.version
  });
}

async function findCurrentLicenseAcceptance(
  prisma: DbClient,
  input: {
    tenantId: string;
    textHash: string;
    toolId: string;
    version: string;
  }
) {
  return prisma.toolLicenseAcceptance.findUnique({
    where: {
      tenantId_toolId_version_textHash: {
        tenantId: input.tenantId,
        textHash: input.textHash,
        toolId: input.toolId,
        version: input.version
      }
    }
  });
}

async function writeToolAudit(
  prisma: DbClient,
  context: AuthenticatedContext,
  action:
    | "third_party_tool.checked"
    | "third_party_tool.install_requested"
    | "third_party_tool.installed"
    | "third_party_tool.install_failed"
    | "third_party_tool.enabled"
    | "third_party_tool.disabled"
    | "third_party_tool.enable_denied"
    | "third_party_tool.intake_validated"
    | "third_party_tool.intake_submitted"
    | "third_party_tool.candidate_reviewed"
    | "third_party_tool.work_order_generated"
    | "third_party_tool.implementation_bundle_generated"
    | "third_party_tool.promotion_package_generated"
    | "third_party_tool.promotion_certified"
    | "third_party_tool.upstream_checked"
    | "third_party_tool.update_checked"
    | "third_party_tool.update_applied"
    | "third_party_tool.update_dismissed"
    | "third_party_tool.license_accepted",
  toolId: string,
  metadata: Record<string, unknown> = {},
  entity?: { entityId: string | null; entityType: "ThirdPartyTool" | "ToolLicenseAcceptance" }
) {
  await writeAuditEvent(prisma, {
    action,
    actorType: "User",
    entityId: entity?.entityId ?? null,
    entityType: entity?.entityType ?? "ThirdPartyTool",
    metadata: {
      ...metadata,
      toolId
    },
    tenantId: context.tenant.tenantId,
    userId: context.user.userId
  });
}

async function getEntryOrThrow(toolId: OpenSourceToolId) {
  const entry = await getOpenSourceToolCatalogEntryWithRuntime(toolId);

  if (!entry) {
    throw new AppServiceError(
      "Third-party tool not found.",
      404,
      "third_party_tool_not_found"
    );
  }

  return entry;
}

async function upsertRuntimePolicyFromEntry(input: {
  entry: OpenSourceToolCatalogEntry;
  prisma: DbClient;
  runtimeAvailable: boolean;
  runtimeKind: OpenSourceToolRuntime | null;
  runtimeReason: string;
  status: ToolRuntimeInstallation["installStatus"];
  tenantId: string;
}) {
  const defaults = defaultPolicyForEntry(input.entry, input.tenantId);
  const existing = await input.prisma.thirdPartyToolPolicy.findUnique({
    where: {
      ownerKey_toolId: {
        ownerKey: input.tenantId,
        toolId: input.entry.tool.toolId
      }
    }
  });

  return input.prisma.thirdPartyToolPolicy.upsert({
    create: {
      allowedRuntimes: defaults.allowedRuntimes,
      disabledReason: defaults.disabledReason,
      enabled: defaults.enabled,
      installStatus: input.status,
      installedAt: input.status === "Installed" ? new Date() : null,
      installedVersion:
        input.status === "Installed" ? input.entry.tool.defaultVersion : null,
      lastCheckedAt: new Date(),
      legalReviewStatus: defaults.legalReviewStatus,
      ownerKey: input.tenantId,
      pinnedGitRef: defaults.pinnedGitRef,
      pinnedImageRef: defaults.pinnedImageRef,
      pinnedVersion: defaults.pinnedVersion,
      runtimeAvailable: input.runtimeAvailable,
      runtimeKind: input.runtimeKind,
      runtimeReason: input.runtimeReason,
      status: defaults.status,
      tenantId: input.tenantId,
      toolId: input.entry.tool.toolId
    },
    update: {
      installStatus: input.status,
      installedAt:
        input.status === "Installed"
          ? (existing?.installedAt ?? new Date())
          : existing?.installedAt,
      installedVersion:
        input.status === "Installed"
          ? input.entry.tool.defaultVersion
          : existing?.installedVersion,
      lastCheckedAt: new Date(),
      runtimeAvailable: input.runtimeAvailable,
      runtimeKind: input.runtimeKind,
      runtimeReason: input.runtimeReason
    },
    where: {
      ownerKey_toolId: {
        ownerKey: input.tenantId,
        toolId: input.entry.tool.toolId
      }
    }
  });
}

export async function getDisabledThirdPartyToolIdsForTenant(
  prisma: DbClient,
  tenantId: string,
  moduleIds: string[]
): Promise<OpenSourceToolId[]> {
  if (!moduleIds.length) {
    return [];
  }

  const entries = await listOpenSourceToolCatalogWithRuntime({
    includeDeferred: true,
    includeLegalReview: true,
    phase: "all"
  });
  const relatedToolIds = entries
    .filter((entry) =>
      entry.tool.moduleIds.some((moduleId) => moduleIds.includes(moduleId))
    )
    .map((entry) => entry.tool.toolId);

  if (!relatedToolIds.length) {
    return [];
  }

  const policies = await prisma.thirdPartyToolPolicy.findMany({
    where: {
      ownerKey: tenantId,
      toolId: {
        in: relatedToolIds
      }
    }
  });

  return policies
    .filter((policy) => !policy.enabled || policy.status !== "Enabled")
    .map((policy) => policy.toolId as OpenSourceToolId);
}

async function upsertThirdPartyToolCandidate(input: {
  context: AuthenticatedContext;
  manifest: ToolIntakeManifestRequest;
  prisma: DbClient;
  report: ToolIntakeValidationReport;
}) {
  const row = await input.prisma.thirdPartyToolCandidate.upsert({
    create: {
      category: input.manifest.category,
      displayName: input.manifest.displayName,
      manifest: input.manifest as unknown as Prisma.InputJsonValue,
      requestedByUserId: input.context.user.userId,
      status: input.report.decision,
      tenantId: input.context.tenant.tenantId,
      toolId: input.report.normalizedToolId,
      validationReport: input.report as unknown as Prisma.InputJsonValue
    },
    update: {
      category: input.manifest.category,
      displayName: input.manifest.displayName,
      implementationOwner: null,
      manifest: input.manifest as unknown as Prisma.InputJsonValue,
      requestedByUserId: input.context.user.userId,
      reviewedAt: null,
      reviewedByUserId: null,
      reviewNotes: null,
      reviewStatus: "NotReviewed",
      status: input.report.decision,
      validationReport: input.report as unknown as Prisma.InputJsonValue
    },
    where: {
      tenantId_toolId: {
        tenantId: input.context.tenant.tenantId,
        toolId: input.report.normalizedToolId
      }
    }
  });

  return serializeCandidate(row as PersistedToolCandidate);
}

async function writeCandidateSubmittedAudit(input: {
  candidate: ThirdPartyToolCandidate;
  context: AuthenticatedContext;
  prisma: DbClient;
}) {
  await writeAuditEvent(input.prisma, {
    action: "third_party_tool.intake_submitted",
    actorType: "User",
    entityId: input.candidate.candidateId,
    entityType: "ThirdPartyToolCandidate",
    metadata: {
      candidateId: input.candidate.candidateId,
      candidateToolId: input.candidate.toolId,
      decision: input.candidate.validationReport.decision,
      duplicateOf: input.candidate.validationReport.duplicateOf,
      installableRuntimes:
        input.candidate.validationReport.governance.installableRuntimes,
      legalReviewRequired:
        input.candidate.validationReport.governance.legalReviewRequired,
      liveExecutionAllowed:
        input.candidate.validationReport.governance.liveExecutionAllowed,
      toolId: input.candidate.toolId,
      requiresInternalRunner:
        input.candidate.validationReport.governance.requiresInternalRunner
    },
    tenantId: input.context.tenant.tenantId,
    userId: input.context.user.userId
  });
}

export function createThirdPartyToolServices(
  deps: RuntimeServiceDeps,
  runnerDispatch?: RunnerDispatchServices
): Pick<
  AppServices,
  | "checkThirdPartyTool"
  | "applyThirdPartyToolUpdateRecommendation"
  | "disableThirdPartyTool"
  | "uninstallThirdPartyTool"
  | "dismissThirdPartyToolUpdateRecommendation"
  | "enableThirdPartyTool"
  | "generateThirdPartyToolImplementationWorkOrder"
  | "generateThirdPartyToolPromotionCertification"
  | "generateThirdPartyToolPromotionPackage"
  | "getThirdPartyTool"
  | "getThirdPartyToolCoverageAudit"
  | "getThirdPartyToolImplementationBundle"
  | "getThirdPartyToolPromotionCertification"
  | "getThirdPartyToolPromotionHandoff"
  | "listThirdPartyToolActivity"
  | "getThirdPartyToolRunnerEligibility"
  | "dispatchThirdPartyToolRunnerTask"
  | "acceptToolLicense"
  | "getThirdPartyToolInstallPlan"
  | "getThirdPartyToolLicenseSummary"
  | "importThirdPartyToolCandidates"
  | "installThirdPartyTool"
  | "listToolLicenseAcceptances"
  | "checkThirdPartyToolUpdateRecommendation"
  | "checkThirdPartyToolUpstreamVersion"
  | "refreshDueThirdPartyTools"
  | "getThirdPartyToolCandidate"
  | "getThirdPartyToolCandidateReadiness"
  | "getThirdPartyToolCandidateReadinessSummary"
  | "listThirdPartyToolJobs"
  | "listThirdPartyToolCandidates"
  | "listThirdPartyToolImplementationWorkOrders"
  | "listThirdPartyToolPromotionCertifications"
  | "listThirdPartyToolPromotionPackages"
  | "listThirdPartyTools"
  | "listThirdPartyToolUpstreamVersionChecks"
  | "listThirdPartyToolUpdateRecommendations"
  | "reviewThirdPartyToolCandidate"
  | "submitThirdPartyToolCandidate"
  | "validateThirdPartyToolIntake"
> {
  const { prisma } = deps;

  return {
    async listThirdPartyTools(context) {
      const entries = await listOpenSourceToolCatalogWithRuntime({
        includeDeferred: true,
        includeLegalReview: true,
        phase: "all"
      });
      const toolIds = entries.map((entry) => entry.tool.toolId);

      await Promise.all(
        entries.map((entry) => ensureDefaultPolicy(prisma, entry))
      );
      const { global, tenant } = await getPolicyRecords(
        prisma,
        context.tenant.tenantId,
        toolIds
      );
      const jobs = await prisma.thirdPartyToolInstallJob.findMany({
        orderBy: {
          createdAt: "desc"
        },
        take: 100,
        where: {
          OR: [
            {
              tenantId: context.tenant.tenantId
            },
            {
              tenantId: null
            }
          ],
          toolId: {
            in: toolIds
          }
        }
      });
      const jobsByToolId = new Map<string, PersistedInstallJob[]>();
      for (const job of jobs) {
        const bucket = jobsByToolId.get(job.toolId) ?? [];
        if (bucket.length < 5) {
          bucket.push(job as PersistedInstallJob);
        }
        jobsByToolId.set(job.toolId, bucket);
      }

      return entries.map((entry) => {
        const policy =
          tenant.get(entry.tool.toolId) ??
          global.get(entry.tool.toolId) ??
          null;
        return {
          governance: serializePolicy(entry, policy, context.tenant.tenantId),
          recentJobs: (jobsByToolId.get(entry.tool.toolId) ?? []).map(
            serializeJob
          ),
          runtimeInstallation: serializeRuntimeInstallation(entry, policy),
          tool: entry
        };
      });
    },

    async validateThirdPartyToolIntake(
      context,
      input: ToolIntakeManifestRequest
    ) {
      assertTenantAdmin(context);

      const report = evaluateToolIntakeManifest(input);

      await writeToolAudit(
        prisma,
        context,
        "third_party_tool.intake_validated",
        report.normalizedToolId,
        {
          candidateToolId: report.normalizedToolId,
          decision: report.decision,
          duplicateOf: report.duplicateOf,
          installableRuntimes: report.governance.installableRuntimes,
          legalReviewRequired: report.governance.legalReviewRequired,
          liveExecutionAllowed: report.governance.liveExecutionAllowed,
          requiresInternalRunner: report.governance.requiresInternalRunner
        }
      );

      return report;
    },

    async submitThirdPartyToolCandidate(
      context,
      input: ToolIntakeManifestRequest
    ) {
      assertTenantAdmin(context);

      const report = evaluateToolIntakeManifest(input);
      const manifest = ToolIntakeManifestRequestSchema.parse(input);
      const candidate = await upsertThirdPartyToolCandidate({
        context,
        manifest,
        prisma,
        report
      });

      await writeCandidateSubmittedAudit({
        candidate,
        context,
        prisma
      });

      return candidate;
    },

    async importThirdPartyToolCandidates(context, input) {
      assertTenantAdmin(context);

      const request = ThirdPartyToolCandidateImportRequestSchema.parse(input);
      const seenToolIds = new Set<string>();
      const generatedAt = new Date().toISOString();
      const items: ThirdPartyToolCandidateImportResponse["items"] = [];

      for (const [index, rawManifest] of request.manifests.entries()) {
        const parsed = ToolIntakeManifestRequestSchema.safeParse(rawManifest);

        if (!parsed.success) {
          items.push({
            candidate: null,
            decision: null,
            displayName: readStringField(rawManifest, "displayName"),
            errors: parsed.error.issues.map(
              (issue) =>
                `${issue.path.join(".") || "manifest"}: ${issue.message}`
            ),
            index,
            status: "Failed",
            toolId: readStringField(rawManifest, "toolId"),
            validationReport: null
          });
          continue;
        }

        const manifest = parsed.data;
        const report = evaluateToolIntakeManifest(manifest);

        if (seenToolIds.has(report.normalizedToolId)) {
          items.push({
            candidate: null,
            decision: report.decision,
            displayName: manifest.displayName,
            errors: [
              `${report.normalizedToolId} appears more than once in this import batch.`
            ],
            index,
            status: "Failed",
            toolId: report.normalizedToolId,
            validationReport: report
          });
          continue;
        }

        seenToolIds.add(report.normalizedToolId);

        const candidate = await upsertThirdPartyToolCandidate({
          context,
          manifest,
          prisma,
          report
        });
        await writeCandidateSubmittedAudit({
          candidate,
          context,
          prisma
        });

        items.push({
          candidate,
          decision: report.decision,
          displayName: candidate.displayName,
          errors: [],
          index,
          status:
            report.decision === "AcceptedForCatalogReview"
              ? "Submitted"
              : report.decision,
          toolId: candidate.toolId,
          validationReport: report
        });
      }

      const response = ThirdPartyToolCandidateImportResponseSchema.parse({
        failedCount: items.filter((item) => item.status === "Failed").length,
        generatedAt,
        importLabel: request.importLabel ?? null,
        items,
        submittedCount: items.filter((item) => item.status === "Submitted")
          .length,
        tenantId: context.tenant.tenantId,
        totalCount: request.manifests.length
      });

      await writeAuditEvent(prisma, {
        action: "third_party_tool.candidate_batch_imported",
        actorType: "User",
        entityId: null,
        entityType: "ThirdPartyToolCandidate",
        metadata: {
          failedCount: response.failedCount,
          importLabel: response.importLabel,
          submittedCount: response.submittedCount,
          toolIds: response.items
            .map((item) => item.toolId)
            .filter((toolId): toolId is string => Boolean(toolId)),
          totalCount: response.totalCount
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return response;
    },

    async listThirdPartyToolCandidates(context) {
      assertTenantAdmin(context);

      const rows = await prisma.thirdPartyToolCandidate.findMany({
        orderBy: {
          updatedAt: "desc"
        },
        take: 100,
        where: {
          tenantId: context.tenant.tenantId
        }
      });

      return rows.map((row) =>
        serializeCandidate(row as PersistedToolCandidate)
      );
    },

    async getThirdPartyToolCandidateReadinessSummary(context) {
      assertTenantAdmin(context);

      const rows = await prisma.thirdPartyToolCandidate.findMany({
        orderBy: {
          updatedAt: "desc"
        },
        take: 100,
        where: {
          tenantId: context.tenant.tenantId
        }
      });
      const candidates = rows.map((row) =>
        serializeCandidate(row as PersistedToolCandidate)
      );
      const entries = await listOpenSourceToolCatalogWithRuntime({
        includeDeferred: true,
        includeLegalReview: true,
        phase: "all"
      });
      const entriesByToolId = new Map(
        entries.map((entry) => [entry.tool.toolId, entry])
      );
      const items: ThirdPartyToolCandidateReadinessSummary["items"] =
        candidates.map((candidate) => ({
          candidate,
          readiness: buildCandidateReadinessReport({
            candidate,
            catalogEntry:
              entriesByToolId.get(candidate.toolId as OpenSourceToolId) ?? null
          })
        }));
      const readinessCounts = items.reduce(
        (counts, item) => {
          if (item.readiness.status === "ReadyForGovernance") {
            counts.readyForGovernanceCount += 1;
          } else if (item.readiness.status === "NeedsImplementation") {
            counts.needsImplementationCount += 1;
          } else {
            counts.blockedCount += 1;
          }
          return counts;
        },
        {
          blockedCount: 0,
          needsImplementationCount: 0,
          readyForGovernanceCount: 0
        }
      );
      const intakeStatusCounts = {
        AcceptedForCatalogReview: candidates.filter(
          (candidate) => candidate.status === "AcceptedForCatalogReview"
        ).length,
        Rejected: candidates.filter(
          (candidate) => candidate.status === "Rejected"
        ).length,
        RequiresChanges: candidates.filter(
          (candidate) => candidate.status === "RequiresChanges"
        ).length
      };
      const reviewStatusCounts = {
        AcceptedForImplementation: candidates.filter(
          (candidate) => candidate.reviewStatus === "AcceptedForImplementation"
        ).length,
        NeedsChanges: candidates.filter(
          (candidate) => candidate.reviewStatus === "NeedsChanges"
        ).length,
        NotReviewed: candidates.filter(
          (candidate) => candidate.reviewStatus === "NotReviewed"
        ).length,
        PromotedToCatalog: candidates.filter(
          (candidate) => candidate.reviewStatus === "PromotedToCatalog"
        ).length,
        Rejected: candidates.filter(
          (candidate) => candidate.reviewStatus === "Rejected"
        ).length
      };
      const requiredActions = Array.from(
        new Set(items.flatMap((item) => item.readiness.requiredActions))
      ).slice(0, 20);

      return ThirdPartyToolCandidateReadinessSummarySchema.parse({
        ...readinessCounts,
        doesNotEnable: true,
        doesNotExecute: true,
        doesNotInstall: true,
        doesNotQueueMissions: true,
        doesNotWriteCatalog: true,
        generatedAt: new Date().toISOString(),
        intakeStatusCounts,
        items,
        requiredActions,
        reviewStatusCounts,
        tenantId: context.tenant.tenantId,
        totalCandidates: candidates.length
      });
    },

    async getThirdPartyToolCandidate(context, candidateId) {
      assertTenantAdmin(context);

      const row = await prisma.thirdPartyToolCandidate.findFirst({
        where: {
          tenantId: context.tenant.tenantId,
          thirdPartyToolCandidateId: candidateId
        }
      });

      return row ? serializeCandidate(row as PersistedToolCandidate) : null;
    },

    async getThirdPartyToolCandidateReadiness(context, candidateId) {
      assertTenantAdmin(context);

      const row = await prisma.thirdPartyToolCandidate.findFirst({
        where: {
          tenantId: context.tenant.tenantId,
          thirdPartyToolCandidateId: candidateId
        }
      });

      if (!row) {
        return null;
      }

      const candidate = serializeCandidate(row as PersistedToolCandidate);
      const entries = await listOpenSourceToolCatalogWithRuntime({
        includeDeferred: true,
        includeLegalReview: true,
        phase: "all"
      });
      const catalogEntry =
        entries.find((entry) => entry.tool.toolId === candidate.toolId) ?? null;

      return buildCandidateReadinessReport({
        candidate,
        catalogEntry
      });
    },

    async reviewThirdPartyToolCandidate(
      context,
      candidateId,
      input: ReviewThirdPartyToolCandidateRequest
    ) {
      assertTenantAdmin(context);

      const review = ReviewThirdPartyToolCandidateRequestSchema.parse(input);
      const row = await prisma.thirdPartyToolCandidate.findFirst({
        where: {
          tenantId: context.tenant.tenantId,
          thirdPartyToolCandidateId: candidateId
        }
      });

      if (!row) {
        return null;
      }

      const candidate = serializeCandidate(row as PersistedToolCandidate);
      if (
        review.reviewStatus === "AcceptedForImplementation" &&
        candidate.status !== "AcceptedForCatalogReview"
      ) {
        throw new AppServiceError(
          "Only candidates accepted by intake can be accepted for implementation.",
          409,
          "third_party_tool_candidate_not_accepted"
        );
      }

      if (review.reviewStatus === "PromotedToCatalog") {
        const entries = await listOpenSourceToolCatalogWithRuntime({
          includeDeferred: true,
          includeLegalReview: true,
          phase: "all"
        });
        const catalogEntry =
          entries.find((entry) => entry.tool.toolId === candidate.toolId) ??
          null;
        const readiness = buildCandidateReadinessReport({
          candidate,
          catalogEntry
        });

        if (!readiness.readyForGovernance) {
          throw new AppServiceError(
            "Candidate cannot be marked promoted until reviewed catalog, module, governance, runner, and safety checks are satisfied.",
            409,
            "third_party_tool_candidate_not_ready"
          );
        }
      }

      const updated = await prisma.thirdPartyToolCandidate.update({
        data: {
          implementationOwner: review.implementationOwner ?? null,
          reviewedAt: new Date(),
          reviewedByUserId: context.user.userId,
          reviewNotes: review.notes ?? null,
          reviewStatus: review.reviewStatus
        },
        where: {
          thirdPartyToolCandidateId: candidateId
        }
      });

      await writeAuditEvent(prisma, {
        action: "third_party_tool.candidate_reviewed",
        actorType: "User",
        entityId: candidateId,
        entityType: "ThirdPartyToolCandidate",
        metadata: {
          candidateId,
          candidateToolId: candidate.toolId,
          implementationOwner: review.implementationOwner ?? null,
          previousReviewStatus: candidate.reviewStatus,
          reviewNotePresent: Boolean(review.notes),
          reviewStatus: review.reviewStatus,
          toolId: candidate.toolId
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      const updatedCandidate = serializeCandidate(
        updated as PersistedToolCandidate
      );

      if (review.reviewStatus === "PromotedToCatalog") {
        await createPromotionPackageForCandidate({
          candidate: updatedCandidate,
          context,
          prisma
        });
      }

      return updatedCandidate;
    },

    async listThirdPartyToolImplementationWorkOrders(context, candidateId) {
      assertTenantAdmin(context);

      const candidateRow = await prisma.thirdPartyToolCandidate.findFirst({
        where: {
          tenantId: context.tenant.tenantId,
          thirdPartyToolCandidateId: candidateId
        }
      });

      if (!candidateRow) {
        return null;
      }

      const candidate = serializeCandidate(
        candidateRow as PersistedToolCandidate
      );
      const rows = await prisma.thirdPartyToolImplementationWorkOrder.findMany({
        orderBy: {
          createdAt: "desc"
        },
        where: {
          candidateId,
          tenantId: context.tenant.tenantId
        }
      });

      return rows.map((row) =>
        serializeWorkOrder(
          row as PersistedToolImplementationWorkOrder,
          candidate
        )
      );
    },

    async generateThirdPartyToolImplementationWorkOrder(context, candidateId) {
      assertTenantAdmin(context);

      const candidateRow = await prisma.thirdPartyToolCandidate.findFirst({
        where: {
          tenantId: context.tenant.tenantId,
          thirdPartyToolCandidateId: candidateId
        }
      });

      if (!candidateRow) {
        return null;
      }

      const candidate = serializeCandidate(
        candidateRow as PersistedToolCandidate
      );
      if (candidate.status !== "AcceptedForCatalogReview") {
        throw new AppServiceError(
          "Only candidates accepted by intake can receive implementation work orders.",
          409,
          "third_party_tool_candidate_not_accepted"
        );
      }

      if (
        candidate.reviewStatus !== "AcceptedForImplementation" &&
        candidate.reviewStatus !== "PromotedToCatalog"
      ) {
        throw new AppServiceError(
          "Candidate must be accepted for implementation before a work order is generated.",
          409,
          "third_party_tool_candidate_review_required"
        );
      }

      const entries = await listOpenSourceToolCatalogWithRuntime({
        includeDeferred: true,
        includeLegalReview: true,
        phase: "all"
      });
      const catalogEntry =
        entries.find((entry) => entry.tool.toolId === candidate.toolId) ?? null;
      const readiness = buildCandidateReadinessReport({
        candidate,
        catalogEntry
      });
      const workOrder = buildCandidateImplementationWorkOrder({
        candidate,
        generatedBy: context.user.userId,
        readiness
      });
      const row = await prisma.thirdPartyToolImplementationWorkOrder.create({
        data: {
          candidateId,
          generatedByUserId: context.user.userId,
          readinessStatus: workOrder.readinessStatus,
          requiredActions: workOrder.requiredActions,
          reviewStatus: workOrder.reviewStatus,
          scaffoldFiles:
            workOrder.scaffoldFiles as unknown as Prisma.InputJsonValue,
          status: workOrder.status,
          summary: workOrder.summary,
          tasks: workOrder.tasks as unknown as Prisma.InputJsonValue,
          tenantId: context.tenant.tenantId,
          toolId: candidate.toolId
        }
      });

      await writeAuditEvent(prisma, {
        action: "third_party_tool.work_order_generated",
        actorType: "User",
        entityId: row.thirdPartyToolImplementationWorkOrderId,
        entityType: "ThirdPartyToolImplementationWorkOrder",
        metadata: {
          candidateId,
          candidateToolId: candidate.toolId,
          readinessStatus: readiness.status,
          reviewStatus: candidate.reviewStatus,
          scaffoldFileCount: workOrder.scaffoldFiles.length,
          status: workOrder.status,
          taskCount: workOrder.tasks.length,
          toolId: candidate.toolId,
          workOrderId: row.thirdPartyToolImplementationWorkOrderId
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return serializeWorkOrder(
        row as PersistedToolImplementationWorkOrder,
        candidate
      );
    },

    async getThirdPartyToolImplementationBundle(
      context,
      candidateId,
      workOrderId
    ) {
      assertTenantAdmin(context);

      const candidateRow = await prisma.thirdPartyToolCandidate.findFirst({
        where: {
          tenantId: context.tenant.tenantId,
          thirdPartyToolCandidateId: candidateId
        }
      });

      if (!candidateRow) {
        return null;
      }

      const row = await prisma.thirdPartyToolImplementationWorkOrder.findFirst({
        where: {
          candidateId,
          tenantId: context.tenant.tenantId,
          thirdPartyToolImplementationWorkOrderId: workOrderId
        }
      });

      if (!row) {
        return null;
      }

      const candidate = serializeCandidate(
        candidateRow as PersistedToolCandidate
      );
      const workOrder = serializeWorkOrder(
        row as PersistedToolImplementationWorkOrder,
        candidate
      );
      const bundle = buildThirdPartyToolImplementationBundle({
        candidate,
        workOrder
      });

      await writeAuditEvent(prisma, {
        action: "third_party_tool.implementation_bundle_generated",
        actorType: "User",
        entityId: workOrderId,
        entityType: "ThirdPartyToolImplementationWorkOrder",
        metadata: {
          bundleId: bundle.bundleId,
          candidateId,
          candidateToolId: candidate.toolId,
          commandCount: bundle.commands.length,
          fileCount: bundle.files.length,
          status: bundle.status,
          toolId: candidate.toolId,
          workOrderId
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return bundle;
    },

    async listThirdPartyToolPromotionPackages(context, candidateId) {
      assertTenantAdmin(context);

      const candidateRow = await prisma.thirdPartyToolCandidate.findFirst({
        where: {
          tenantId: context.tenant.tenantId,
          thirdPartyToolCandidateId: candidateId
        }
      });

      if (!candidateRow) {
        return null;
      }

      const candidate = serializeCandidate(
        candidateRow as PersistedToolCandidate
      );
      const rows = await prisma.thirdPartyToolPromotionPackage.findMany({
        orderBy: {
          createdAt: "desc"
        },
        where: {
          candidateId,
          tenantId: context.tenant.tenantId
        }
      });

      return rows.map((row) =>
        serializePromotionPackage(
          row as PersistedToolPromotionPackage,
          candidate
        )
      );
    },

    async generateThirdPartyToolPromotionPackage(context, candidateId) {
      assertTenantAdmin(context);

      const candidateRow = await prisma.thirdPartyToolCandidate.findFirst({
        where: {
          tenantId: context.tenant.tenantId,
          thirdPartyToolCandidateId: candidateId
        }
      });

      if (!candidateRow) {
        return null;
      }

      return createPromotionPackageForCandidate({
        candidate: serializeCandidate(candidateRow as PersistedToolCandidate),
        context,
        prisma
      });
    },

    async getThirdPartyToolPromotionHandoff(
      context,
      candidateId,
      promotionPackageId
    ) {
      assertTenantAdmin(context);

      const candidateRow = await prisma.thirdPartyToolCandidate.findFirst({
        where: {
          tenantId: context.tenant.tenantId,
          thirdPartyToolCandidateId: candidateId
        }
      });

      if (!candidateRow) {
        return null;
      }

      const row = await prisma.thirdPartyToolPromotionPackage.findFirst({
        where: {
          candidateId,
          tenantId: context.tenant.tenantId,
          thirdPartyToolPromotionPackageId: promotionPackageId
        }
      });

      if (!row) {
        return null;
      }

      const candidate = serializeCandidate(
        candidateRow as PersistedToolCandidate
      );
      const promotionPackage = serializePromotionPackage(
        row as PersistedToolPromotionPackage,
        candidate
      );
      const tool = await getComposedTool(
        prisma,
        context.tenant.tenantId,
        promotionPackage.catalogSnapshot
      );
      const requiredScopeTypes = [
        ...new Set(
          tool.tool.capabilities
            .filter(
              (capability) => capability.executionMode === "InternalRunner"
            )
            .flatMap((capability) => capability.requiredScopes)
        )
      ];
      const [activeRunnerCount, verifiedScopes] = await Promise.all([
        prisma.runner.count({
          where: {
            killSwitchActive: false,
            status: {
              in: ["Active", "Degraded"]
            },
            tenantId: context.tenant.tenantId
          }
        }),
        requiredScopeTypes.length
          ? prisma.scope.findMany({
              select: {
                scopeType: true
              },
              where: {
                scopeType: {
                  in: requiredScopeTypes
                },
                tenantId: context.tenant.tenantId,
                verificationStatus: "Verified"
              }
            })
          : Promise.resolve([])
      ]);
      const verifiedScopeTypes = [
        ...new Set(verifiedScopes.map((scope) => scope.scopeType as ScopeType))
      ];
      const runnerEligibility = buildRunnerEligibilityReport({
        activeRunnerCount,
        tenantId: context.tenant.tenantId,
        tool,
        verifiedScopeCount: verifiedScopes.length,
        verifiedScopeTypes
      });

      return buildPromotionHandoff({
        promotionPackage,
        runnerEligibility,
        tool
      });
    },

    async getThirdPartyToolPromotionCertification(
      context,
      candidateId,
      promotionPackageId
    ) {
      assertTenantAdmin(context);

      return buildCurrentPromotionCertification({
        candidateId,
        context,
        prisma,
        promotionPackageId
      });
    },

    async listThirdPartyToolPromotionCertifications(
      context,
      candidateId,
      promotionPackageId
    ) {
      assertTenantAdmin(context);

      const candidateRow = await prisma.thirdPartyToolCandidate.findFirst({
        where: {
          tenantId: context.tenant.tenantId,
          thirdPartyToolCandidateId: candidateId
        }
      });

      if (!candidateRow) {
        return null;
      }

      const promotionPackage =
        await prisma.thirdPartyToolPromotionPackage.findFirst({
          where: {
            candidateId,
            tenantId: context.tenant.tenantId,
            thirdPartyToolPromotionPackageId: promotionPackageId
          }
        });

      if (!promotionPackage) {
        return null;
      }

      const rows = await prisma.thirdPartyToolPromotionCertification.findMany({
        orderBy: {
          createdAt: "desc"
        },
        take: 100,
        where: {
          candidateId,
          promotionPackageId,
          tenantId: context.tenant.tenantId
        }
      });

      return rows.map((row) =>
        serializePromotionCertification(
          row as PersistedToolPromotionCertification
        )
      );
    },

    async generateThirdPartyToolPromotionCertification(
      context,
      candidateId,
      promotionPackageId
    ) {
      assertTenantAdmin(context);

      const certification = await buildCurrentPromotionCertification({
        candidateId,
        context,
        prisma,
        promotionPackageId
      });

      if (!certification) {
        return null;
      }

      const row = await prisma.thirdPartyToolPromotionCertification.create({
        data: {
          candidateId,
          certifiedForGovernance: certification.certifiedForGovernance,
          certifiedForMissionStart: certification.certifiedForMissionStart,
          certifiedForRunnerDispatch: certification.certifiedForRunnerDispatch,
          certifiedForRuntimeManagement:
            certification.certifiedForRuntimeManagement,
          checks: certification.checks as unknown as Prisma.InputJsonValue,
          displayName: certification.displayName,
          generatedAt: new Date(certification.generatedAt),
          generatedByUserId: context.user.userId,
          governanceStatus: certification.governanceStatus,
          packageStatus: certification.packageStatus,
          promotionPackageId,
          readinessStatus: certification.readinessStatus,
          requiredActions: certification.requiredActions,
          runnerStatus: certification.runnerStatus,
          runtimeStatus: certification.runtimeStatus,
          safetyNotes: certification.safetyNotes,
          status: certification.status,
          summary: certification.summary,
          tenantId: context.tenant.tenantId,
          toolId: certification.toolId
        }
      });

      const persistedCertification = serializePromotionCertification(
        row as PersistedToolPromotionCertification
      );

      await writeAuditEvent(prisma, {
        action: "third_party_tool.promotion_certified",
        actorType: "User",
        entityId: persistedCertification.certificationId,
        entityType: "ThirdPartyToolPromotionCertification",
        metadata: {
          candidateId,
          certifiedForGovernance: persistedCertification.certifiedForGovernance,
          certifiedForMissionStart:
            persistedCertification.certifiedForMissionStart,
          certificationId: persistedCertification.certificationId,
          promotionPackageId,
          status: persistedCertification.status,
          toolId: persistedCertification.toolId
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return persistedCertification;
    },

    async listThirdPartyToolUpdateRecommendations(context, toolId) {
      assertTenantAdmin(context);
      await getEntryOrThrow(toolId);

      const rows = await prisma.thirdPartyToolUpdateRecommendation.findMany({
        orderBy: {
          createdAt: "desc"
        },
        take: 100,
        where: {
          tenantId: context.tenant.tenantId,
          toolId
        }
      });

      return rows.map((row) =>
        serializeUpdateRecommendation(row as PersistedToolUpdateRecommendation)
      );
    },

    async listThirdPartyToolUpstreamVersionChecks(context, toolId) {
      assertTenantAdmin(context);
      await getEntryOrThrow(toolId);

      const rows = await prisma.thirdPartyToolUpstreamVersionCheck.findMany({
        orderBy: {
          createdAt: "desc"
        },
        take: 100,
        where: {
          tenantId: context.tenant.tenantId,
          toolId
        }
      });

      return rows.map((row) =>
        serializeUpstreamVersionCheck(row as PersistedToolUpstreamVersionCheck)
      );
    },

    async listThirdPartyToolActivity(context, toolId, limit = 50) {
      assertTenantAdmin(context);

      const entry = await getEntryOrThrow(toolId);
      const safeLimit = Math.max(1, Math.min(limit, 100));
      const auditTake = Math.max(safeLimit * 4, 50);
      const moduleIds = entry.tool.moduleIds;
      const [
        auditRows,
        candidateRows,
        installRows,
        runRows,
        runnerTaskRows,
        updateRows,
        upstreamRows,
        workOrderRows,
        promotionRows,
        certificationRows
      ] = await Promise.all([
        prisma.auditEvent.findMany({
          orderBy: {
            createdAt: "desc"
          },
          take: auditTake,
          where: {
            OR: [
              { entityType: "ThirdPartyTool" },
              { entityType: "ThirdPartyToolCandidate" },
              { entityType: "ThirdPartyToolImplementationWorkOrder" },
              { entityType: "ThirdPartyToolPromotionPackage" },
              { entityType: "ThirdPartyToolPromotionCertification" },
              { entityType: "ThirdPartyToolUpstreamVersionCheck" },
              { entityType: "ThirdPartyToolUpdateRecommendation" }
            ],
            tenantId: context.tenant.tenantId
          }
        }),
        prisma.thirdPartyToolCandidate.findMany({
          orderBy: {
            updatedAt: "desc"
          },
          take: safeLimit,
          where: {
            tenantId: context.tenant.tenantId,
            toolId
          }
        }),
        prisma.thirdPartyToolInstallJob.findMany({
          orderBy: {
            createdAt: "desc"
          },
          take: safeLimit,
          where: {
            OR: [{ tenantId: context.tenant.tenantId }, { tenantId: null }],
            toolId
          }
        }),
        moduleIds.length
          ? prisma.validationRun.findMany({
              orderBy: {
                createdAt: "desc"
              },
              take: safeLimit,
              where: {
                moduleId: {
                  in: moduleIds
                },
                tenantId: context.tenant.tenantId
              }
            })
          : Promise.resolve([]),
        moduleIds.length
          ? prisma.runnerTask.findMany({
              orderBy: {
                updatedAt: "desc"
              },
              take: safeLimit,
              where: {
                moduleId: {
                  in: moduleIds
                },
                tenantId: context.tenant.tenantId
              }
            })
          : Promise.resolve([]),
        prisma.thirdPartyToolUpdateRecommendation.findMany({
          orderBy: {
            updatedAt: "desc"
          },
          take: safeLimit,
          where: {
            tenantId: context.tenant.tenantId,
            toolId
          }
        }),
        prisma.thirdPartyToolUpstreamVersionCheck.findMany({
          orderBy: {
            checkedAt: "desc"
          },
          take: safeLimit,
          where: {
            tenantId: context.tenant.tenantId,
            toolId
          }
        }),
        prisma.thirdPartyToolImplementationWorkOrder.findMany({
          orderBy: {
            updatedAt: "desc"
          },
          take: safeLimit,
          where: {
            tenantId: context.tenant.tenantId,
            toolId
          }
        }),
        prisma.thirdPartyToolPromotionPackage.findMany({
          orderBy: {
            updatedAt: "desc"
          },
          take: safeLimit,
          where: {
            tenantId: context.tenant.tenantId,
            toolId
          }
        }),
        prisma.thirdPartyToolPromotionCertification.findMany({
          orderBy: {
            createdAt: "desc"
          },
          take: safeLimit,
          where: {
            tenantId: context.tenant.tenantId,
            toolId
          }
        })
      ]);

      const activities: ThirdPartyToolActivityEvent[] = [
        ...(auditRows as PersistedToolAuditEvent[])
          .filter((row) => auditBelongsToTool(row, toolId))
          .map((row) => {
            const metadata = activityMetadata(row.metadata);
            return activityEvent({
              activityId: `audit:${row.auditEventId}`,
              actorUserId: row.userId,
              category: auditActivityCategory(row.action),
              entityId: row.entityId,
              entityType: "AuditEvent",
              metadata: {
                action: row.action,
                entityType: row.entityType,
                status: metadata.status,
                toolId
              },
              occurredAt: row.createdAt,
              source: "AuditEvent",
              status: row.action,
              summary: `${auditActivityTitle(row.action)} for ${entry.tool.displayName}.`,
              tenantId: row.tenantId,
              title: auditActivityTitle(row.action),
              toolId
            });
          }),
        ...(candidateRows as PersistedToolCandidate[]).map((row) =>
          activityEvent({
            activityId: `candidate:${row.thirdPartyToolCandidateId}`,
            actorUserId: row.requestedByUserId,
            category: "Onboarding",
            entityId: row.thirdPartyToolCandidateId,
            entityType: "ThirdPartyToolCandidate",
            metadata: {
              reviewStatus: row.reviewStatus,
              status: row.status
            },
            occurredAt: row.updatedAt,
            source: "Candidate",
            status: row.reviewStatus,
            summary: `${row.displayName} candidate is ${row.status} with review status ${row.reviewStatus}.`,
            tenantId: row.tenantId,
            title: "Candidate backlog updated",
            toolId
          })
        ),
        ...(installRows as PersistedInstallJob[]).map((row) =>
          activityEvent({
            activityId: `install-job:${row.thirdPartyToolInstallJobId}`,
            actorUserId: row.requestedByUserId,
            category: "Runtime",
            entityId: row.thirdPartyToolInstallJobId,
            entityType: "ThirdPartyToolInstallJob",
            metadata: {
              action: row.action,
              runtimeKind: row.runtimeKind
            },
            occurredAt: row.completedAt ?? row.startedAt ?? row.createdAt,
            source: "InstallJob",
            status: row.status,
            summary:
              row.reason ??
              `${row.action} job ${row.status.toLowerCase()} for ${entry.tool.displayName}.`,
            tenantId: row.tenantId,
            title: `${row.action} job ${row.status}`,
            toolId
          })
        ),
        ...(runRows as PersistedToolValidationRun[]).map((row) =>
          activityEvent({
            activityId: `validation-run:${row.runId}`,
            actorUserId: null,
            category: "Execution",
            entityId: row.runId,
            entityType: "ValidationRun",
            metadata: {
              evidenceCount: row.evidenceIds.length,
              moduleId: row.moduleId,
              outcome: row.outcome
            },
            occurredAt: row.completedAt ?? row.startedAt ?? row.createdAt,
            source: "ValidationRun",
            status: row.status,
            summary: `Module ${row.moduleId} produced ${row.evidenceIds.length} evidence artifact(s).`,
            tenantId: row.tenantId,
            title: "Validation run",
            toolId
          })
        ),
        ...(runnerTaskRows as PersistedRunnerTask[]).map((row) =>
          activityEvent({
            activityId: `runner-task:${row.taskId}`,
            actorUserId: null,
            category: "Execution",
            entityId: row.taskId,
            entityType: "RunnerTask",
            metadata: {
              errorSummary: row.errorSummary,
              evidenceCount: row.redactedEvidenceIds.length,
              moduleId: row.moduleId,
              runId: row.runId,
              runnerId: row.runnerId,
              scopeId: row.scopeId,
              taskType: row.taskType
            },
            occurredAt: row.completedAt ?? row.updatedAt ?? row.createdAt,
            source: "RunnerTask",
            status: row.status,
            summary: `Runner task ${row.moduleId} is ${row.status}.`,
            tenantId: row.tenantId,
            title: "Runner task",
            toolId
          })
        ),
        ...(updateRows as PersistedToolUpdateRecommendation[]).map((row) =>
          activityEvent({
            activityId: `update-recommendation:${row.thirdPartyToolUpdateRecommendationId}`,
            actorUserId:
              row.appliedByUserId ??
              row.dismissedByUserId ??
              row.generatedByUserId,
            category: "Update",
            entityId: row.thirdPartyToolUpdateRecommendationId,
            entityType: "ThirdPartyToolUpdateRecommendation",
            metadata: {
              currentPinnedVersion: row.currentPinnedVersion,
              reviewedVersion: row.reviewedVersion
            },
            occurredAt: row.updatedAt,
            source: "UpdateRecommendation",
            status: row.status,
            summary: row.reason,
            tenantId: row.tenantId,
            title: "Reviewed update recommendation",
            toolId
          })
        ),
        ...(upstreamRows as PersistedToolUpstreamVersionCheck[]).map((row) =>
          activityEvent({
            activityId: `upstream-check:${row.thirdPartyToolUpstreamVersionCheckId}`,
            actorUserId: row.checkedByUserId,
            category: "Update",
            entityId: row.thirdPartyToolUpstreamVersionCheckId,
            entityType: "ThirdPartyToolUpstreamVersionCheck",
            metadata: {
              catalogVersion: row.catalogVersion,
              discoveredVersion: row.discoveredVersion,
              sourceKind: row.sourceKind,
              updateAvailable: row.updateAvailable
            },
            occurredAt: row.checkedAt,
            source: "UpstreamVersionCheck",
            status: row.status,
            summary: row.reason,
            tenantId: row.tenantId,
            title: "Trusted upstream version check",
            toolId
          })
        ),
        ...(workOrderRows as PersistedToolImplementationWorkOrder[]).map(
          (row) =>
            activityEvent({
              activityId: `work-order:${row.thirdPartyToolImplementationWorkOrderId}`,
              actorUserId: row.generatedByUserId,
              category: "Onboarding",
              entityId: row.thirdPartyToolImplementationWorkOrderId,
              entityType: "ThirdPartyToolImplementationWorkOrder",
              metadata: {
                readinessStatus: row.readinessStatus,
                reviewStatus: row.reviewStatus,
                taskCount: Array.isArray(row.tasks) ? row.tasks.length : null
              },
              occurredAt: row.updatedAt,
              source: "ImplementationWorkOrder",
              status: row.status,
              summary: row.summary,
              tenantId: row.tenantId,
              title: "Implementation work order",
              toolId
            })
        ),
        ...(promotionRows as PersistedToolPromotionPackage[]).map((row) =>
          activityEvent({
            activityId: `promotion-package:${row.thirdPartyToolPromotionPackageId}`,
            actorUserId: row.promotedByUserId,
            category: "Onboarding",
            entityId: row.thirdPartyToolPromotionPackageId,
            entityType: "ThirdPartyToolPromotionPackage",
            metadata: {
              capabilityCount: row.capabilityIds.length,
              candidateId: row.candidateId,
              moduleCount: row.moduleIds.length,
              reviewStatus: row.reviewStatus
            },
            occurredAt: row.promotedAt,
            source: "PromotionPackage",
            status: row.status,
            summary: row.summary,
            tenantId: row.tenantId,
            title: "Promotion package",
            toolId
          })
        ),
        ...(certificationRows as PersistedToolPromotionCertification[]).map(
          (row) =>
            activityEvent({
              activityId: `promotion-certification:${row.thirdPartyToolPromotionCertificationId}`,
              actorUserId: row.generatedByUserId,
              category: "Governance",
              entityId: row.thirdPartyToolPromotionCertificationId,
              entityType: "ThirdPartyToolPromotionCertification",
              metadata: {
                certifiedForGovernance: row.certifiedForGovernance,
                certifiedForMissionStart: row.certifiedForMissionStart,
                promotionPackageId: row.promotionPackageId,
                requiredActionCount: row.requiredActions.length
              },
              occurredAt: row.createdAt,
              source: "PromotionCertification",
              status: row.status,
              summary: row.summary,
              tenantId: row.tenantId,
              title: "Promotion certification snapshot",
              toolId
            })
        )
      ];

      return activities
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
        .slice(0, safeLimit);
    },

    async getThirdPartyToolRunnerEligibility(context, toolId) {
      assertTenantAdmin(context);

      const entry = await getEntryOrThrow(toolId);
      const tool = await getComposedTool(
        prisma,
        context.tenant.tenantId,
        entry
      );
      const requiredScopeTypes = uniqueStrings(
        entry.capabilities
          .filter((capability) => capability.executionMode === "InternalRunner")
          .flatMap((capability) => capability.requiredScopes)
      ) as ScopeType[];
      const [activeRunnerCount, verifiedScopes] = await Promise.all([
        prisma.runner.count({
          where: {
            killSwitchActive: false,
            status: {
              in: ["Active", "Degraded"]
            },
            tenantId: context.tenant.tenantId
          }
        }),
        requiredScopeTypes.length
          ? prisma.scope.findMany({
              select: {
                scopeType: true
              },
              where: {
                scopeType: {
                  in: requiredScopeTypes
                },
                tenantId: context.tenant.tenantId,
                verificationStatus: "Verified"
              }
            })
          : Promise.resolve([])
      ]);
      const verifiedScopeTypes = uniqueStrings(
        verifiedScopes.map((scope) => scope.scopeType)
      ) as ScopeType[];

      return buildRunnerEligibilityReport({
        activeRunnerCount,
        tenantId: context.tenant.tenantId,
        tool,
        verifiedScopeCount: verifiedScopes.length,
        verifiedScopeTypes
      });
    },

    async dispatchThirdPartyToolRunnerTask(context, toolId, input) {
      assertTenantAdmin(context);
      const request = ThirdPartyToolRunnerDispatchRequestSchema.parse(input);

      if (!runnerDispatch) {
        throw new AppServiceError(
          "Runner dispatch service is not configured.",
          503,
          "runner_dispatch_unavailable"
        );
      }

      const eligibility = await this.getThirdPartyToolRunnerEligibility(
        context,
        toolId
      );
      const capability = eligibility.capabilities.find(
        (candidate) => candidate.capabilityId === request.capabilityId
      );

      if (!capability) {
        await writeToolRunnerDispatchAudit({
          capabilityId: request.capabilityId,
          code: "capability_not_found",
          context,
          prisma,
          reason: "Capability is not part of the reviewed tool catalog.",
          runnerId: request.runnerId,
          scopeId: request.scopeId,
          status: "denied",
          toolId
        });
        throw new AppServiceError(
          "Tool capability not found.",
          404,
          "third_party_tool_capability_not_found"
        );
      }

      if (
        !capability.dispatchable ||
        capability.status !== "Ready" ||
        !capability.moduleId ||
        !capability.dispatchRoute
      ) {
        const reason = runnerDispatchErrorMessage(capability);
        await writeToolRunnerDispatchAudit({
          capabilityId: capability.capabilityId,
          code: capability.status,
          context,
          moduleId: capability.moduleId,
          prisma,
          reason,
          runnerId: request.runnerId,
          scopeId: request.scopeId,
          status: "denied",
          toolId
        });
        throw new AppServiceError(
          reason,
          400,
          "third_party_tool_runner_dispatch_not_ready"
        );
      }

      const dispatchKind = getRunnerDispatchKind(capability.moduleId);
      if (!dispatchKind) {
        await writeToolRunnerDispatchAudit({
          capabilityId: capability.capabilityId,
          code: "module_not_runner_safe",
          context,
          moduleId: capability.moduleId,
          prisma,
          reason:
            "Capability module is not in the server-side runner allowlist.",
          runnerId: request.runnerId,
          scopeId: request.scopeId,
          status: "denied",
          toolId
        });
        throw new AppServiceError(
          "Capability module is not in the server-side runner allowlist.",
          400,
          "module_not_runner_safe"
        );
      }

      try {
        const result =
          dispatchKind === "discover"
            ? await runnerDispatch.createRunnerDiscoverTask(
                context,
                request.runnerId,
                RunnerDiscoverTaskRequestSchema.parse({
                  moduleId: capability.moduleId,
                  rateLimitPerMinute: request.rateLimitPerMinute,
                  scopeId: request.scopeId,
                  target: request.target,
                  timeoutSeconds: request.timeoutSeconds,
                  topPorts: request.topPorts
                })
              )
            : dispatchKind === "measured"
              ? await runnerDispatch.createRunnerMeasuredTask(
                  context,
                  request.runnerId,
                  RunnerMeasuredTaskRequestSchema.parse({
                    moduleId: capability.moduleId,
                    path: request.path,
                    port: request.port,
                    rateLimitPerMinute: request.rateLimitPerMinute,
                    scheme: request.scheme,
                    scopeId: request.scopeId,
                    targetHost: request.target,
                    timeoutSeconds: Math.min(request.timeoutSeconds, 30)
                  })
                )
              : await runnerDispatch.createRunnerCheckTask(
                  context,
                  request.runnerId,
                  RunnerCheckTaskRequestSchema.parse({
                    module: capability.moduleId,
                    path: request.path,
                    port: request.port,
                    rateLimitPerMinute: request.rateLimitPerMinute,
                    scheme: request.scheme,
                    scopeId: request.scopeId,
                    targetHost: request.target,
                    timeoutSeconds: Math.min(request.timeoutSeconds, 30)
                  })
                );

        await writeToolRunnerDispatchAudit({
          capabilityId: capability.capabilityId,
          context,
          moduleId: capability.moduleId,
          prisma,
          runnerId: request.runnerId,
          scopeId: request.scopeId,
          status: "dispatched",
          taskId: result.task.taskId,
          toolId
        });

        return ThirdPartyToolRunnerDispatchResponseSchema.parse({
          capability,
          dispatchRoute: capability.dispatchRoute,
          result,
          toolId
        });
      } catch (error) {
        if (error instanceof AppServiceError) {
          await writeToolRunnerDispatchAudit({
            capabilityId: capability.capabilityId,
            code: error.code,
            context,
            moduleId: capability.moduleId,
            prisma,
            reason: error.message,
            runnerId: request.runnerId,
            scopeId: request.scopeId,
            status: "denied",
            toolId
          });
        }
        throw error;
      }
    },

    async checkThirdPartyToolUpstreamVersion(context, toolId) {
      assertTenantAdmin(context);

      const entry = await getEntryOrThrow(toolId);
      return createUpstreamVersionCheck(prisma, context, entry);
    },

    async checkThirdPartyToolUpdateRecommendation(context, toolId) {
      assertTenantAdmin(context);

      const entry = await getEntryOrThrow(toolId);
      return createUpdateRecommendation(prisma, context, entry);
    },

    async refreshDueThirdPartyTools(context, input) {
      assertTenantAdmin(context);

      const request = ThirdPartyToolRefreshDueRequestSchema.parse(input ?? {});
      const generatedAt = new Date();
      const thresholdMs = request.minHoursSinceLastCheck * 60 * 60 * 1000;
      const entries = await listOpenSourceToolCatalogWithRuntime({
        includeDeferred: true,
        includeLegalReview: true,
        phase: "all"
      });
      const toolIds = entries.map((entry) => entry.tool.toolId);
      await Promise.all(
        entries.map((entry) => ensureDefaultPolicy(prisma, entry))
      );
      const [latestUpstreamRows, latestRecommendationRows] = await Promise.all([
        prisma.thirdPartyToolUpstreamVersionCheck.findMany({
          orderBy: {
            checkedAt: "desc"
          },
          where: {
            tenantId: context.tenant.tenantId,
            toolId: {
              in: toolIds
            }
          }
        }),
        prisma.thirdPartyToolUpdateRecommendation.findMany({
          orderBy: {
            updatedAt: "desc"
          },
          where: {
            tenantId: context.tenant.tenantId,
            toolId: {
              in: toolIds
            }
          }
        })
      ]);
      const latestUpstreamByToolId = new Map<
        string,
        PersistedToolUpstreamVersionCheck
      >();
      const latestRecommendationByToolId = new Map<
        string,
        PersistedToolUpdateRecommendation
      >();

      for (const row of latestUpstreamRows as PersistedToolUpstreamVersionCheck[]) {
        if (!latestUpstreamByToolId.has(row.toolId)) {
          latestUpstreamByToolId.set(row.toolId, row);
        }
      }

      for (const row of latestRecommendationRows as PersistedToolUpdateRecommendation[]) {
        if (!latestRecommendationByToolId.has(row.toolId)) {
          latestRecommendationByToolId.set(row.toolId, row);
        }
      }

      const tools: ThirdPartyToolRefreshDueResponse["tools"] = [];
      let checkedCount = 0;
      let failedCount = 0;

      for (const entry of entries) {
        const toolId = entry.tool.toolId;
        const latestUpstream = latestUpstreamByToolId.get(toolId);
        const latestRecommendation = latestRecommendationByToolId.get(toolId);
        const latestCheckAt = mostRecentDate([
          latestUpstream?.checkedAt,
          latestRecommendation?.updatedAt
        ]);
        const composed = await getComposedTool(
          prisma,
          context.tenant.tenantId,
          entry
        );
        const skipped = skippedRefreshReason({
          includeDeferred: request.includeDeferred,
          includeDisabled: request.includeDisabled,
          includeLegalReview: request.includeLegalReview,
          tool: composed
        });

        if (skipped) {
          tools.push({
            checkedAt: null,
            displayName: entry.tool.displayName,
            lastCheckedAt: latestCheckAt?.toISOString() ?? null,
            reason: skipped.reason,
            requiredActions: skipped.requiredActions,
            status: "Skipped",
            toolId,
            updateRecommendation: latestRecommendation
              ? serializeUpdateRecommendation(latestRecommendation)
              : null,
            upstreamCheck: latestUpstream
              ? serializeUpstreamVersionCheck(latestUpstream)
              : null
          });
          continue;
        }

        if (
          latestCheckAt &&
          generatedAt.getTime() - latestCheckAt.getTime() < thresholdMs
        ) {
          tools.push({
            checkedAt: null,
            displayName: entry.tool.displayName,
            lastCheckedAt: latestCheckAt.toISOString(),
            reason: `${entry.tool.displayName} was checked within the refresh window.`,
            requiredActions: [
              "Wait until the refresh window elapses or request a single-tool check."
            ],
            status: "NotDue",
            toolId,
            updateRecommendation: latestRecommendation
              ? serializeUpdateRecommendation(latestRecommendation)
              : null,
            upstreamCheck: latestUpstream
              ? serializeUpstreamVersionCheck(latestUpstream)
              : null
          });
          continue;
        }

        if (checkedCount >= request.maxTools) {
          tools.push({
            checkedAt: null,
            displayName: entry.tool.displayName,
            lastCheckedAt: latestCheckAt?.toISOString() ?? null,
            reason: "Refresh batch limit reached before this tool was checked.",
            requiredActions: ["Run another due refresh batch to continue."],
            status: "Skipped",
            toolId,
            updateRecommendation: latestRecommendation
              ? serializeUpdateRecommendation(latestRecommendation)
              : null,
            upstreamCheck: latestUpstream
              ? serializeUpstreamVersionCheck(latestUpstream)
              : null
          });
          continue;
        }

        try {
          const [upstreamCheck, updateRecommendation] = await Promise.all([
            createUpstreamVersionCheck(prisma, context, entry),
            createUpdateRecommendation(prisma, context, entry)
          ]);
          checkedCount += 1;
          tools.push({
            checkedAt: generatedAt.toISOString(),
            displayName: entry.tool.displayName,
            lastCheckedAt: latestCheckAt?.toISOString() ?? null,
            reason:
              "Refresh created a trusted upstream check and reviewed-version recommendation.",
            requiredActions: [
              ...upstreamCheck.requiredActions,
              ...updateRecommendation.requiredActions
            ],
            status: "Checked",
            toolId,
            updateRecommendation,
            upstreamCheck
          });
        } catch (error) {
          failedCount += 1;
          tools.push({
            checkedAt: generatedAt.toISOString(),
            displayName: entry.tool.displayName,
            lastCheckedAt: latestCheckAt?.toISOString() ?? null,
            reason:
              error instanceof Error
                ? error.message
                : "Tool refresh failed unexpectedly.",
            requiredActions: ["Inspect tool governance and retry the refresh."],
            status: "Failed",
            toolId,
            updateRecommendation: latestRecommendation
              ? serializeUpdateRecommendation(latestRecommendation)
              : null,
            upstreamCheck: latestUpstream
              ? serializeUpstreamVersionCheck(latestUpstream)
              : null
          });
        }
      }

      const response = ThirdPartyToolRefreshDueResponseSchema.parse({
        checkedCount,
        failedCount,
        generatedAt: generatedAt.toISOString(),
        maxTools: request.maxTools,
        minHoursSinceLastCheck: request.minHoursSinceLastCheck,
        skippedCount: tools.filter((tool) =>
          ["Skipped", "NotDue"].includes(tool.status)
        ).length,
        tenantId: context.tenant.tenantId,
        tools
      });

      await writeAuditEvent(prisma, {
        action: "third_party_tool.refresh_due_checked",
        actorType: "User",
        entityId: null,
        entityType: "ThirdPartyTool",
        metadata: {
          checkedCount: response.checkedCount,
          failedCount: response.failedCount,
          maxTools: response.maxTools,
          minHoursSinceLastCheck: response.minHoursSinceLastCheck,
          skippedCount: response.skippedCount,
          toolIds: response.tools
            .filter((tool) => tool.status === "Checked")
            .map((tool) => tool.toolId)
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return response;
    },

    async applyThirdPartyToolUpdateRecommendation(
      context,
      toolId,
      recommendationId,
      input: ApplyThirdPartyToolUpdateRequest
    ) {
      assertTenantAdmin(context);

      const request = ApplyThirdPartyToolUpdateRequestSchema.parse(input);
      const entry = await getEntryOrThrow(toolId);
      const row = await prisma.thirdPartyToolUpdateRecommendation.findFirst({
        where: {
          tenantId: context.tenant.tenantId,
          thirdPartyToolUpdateRecommendationId: recommendationId,
          toolId
        }
      });

      if (!row) {
        return null;
      }

      const recommendation = serializeUpdateRecommendation(
        row as PersistedToolUpdateRecommendation
      );

      if (recommendation.status !== "UpdateAvailable") {
        throw new AppServiceError(
          "Only update-available recommendations can be applied.",
          409,
          "third_party_tool_update_not_applicable"
        );
      }

      if (!canEnableEntry(entry) || recommendation.policyBlocked) {
        const blocked = await prisma.thirdPartyToolUpdateRecommendation.update({
          data: {
            reason:
              "Update cannot be applied because the tool is blocked by legal or safety policy.",
            status: "Blocked"
          },
          where: {
            thirdPartyToolUpdateRecommendationId: recommendationId
          }
        });

        return serializeUpdateRecommendation(
          blocked as PersistedToolUpdateRecommendation
        );
      }

      const defaults = defaultPolicyForEntry(entry, context.tenant.tenantId);
      const existing = await prisma.thirdPartyToolPolicy.findUnique({
        where: {
          ownerKey_toolId: {
            ownerKey: context.tenant.tenantId,
            toolId
          }
        }
      });
      await prisma.thirdPartyToolPolicy.upsert({
        create: {
          allowedRuntimes: defaults.allowedRuntimes,
          disabledReason: null,
          enabled: defaults.enabled,
          installStatus: runtimeInstallStatus(entry),
          installedAt: null,
          installedVersion: null,
          lastCheckedAt: entry.lastCheckedAt
            ? new Date(entry.lastCheckedAt)
            : null,
          legalReviewStatus: defaults.legalReviewStatus,
          ownerKey: context.tenant.tenantId,
          pinnedGitRef: defaults.pinnedGitRef,
          pinnedImageRef: defaults.pinnedImageRef,
          pinnedVersion: recommendation.reviewedVersion,
          runtimeAvailable: Boolean(entry.runtimeAvailable),
          runtimeKind: entry.runtimeKind,
          runtimeReason:
            entry.runtimeReason ?? "Runtime readiness has not been checked.",
          status: defaults.status,
          tenantId: context.tenant.tenantId,
          toolId
        },
        update: {
          pinnedGitRef: defaults.pinnedGitRef,
          pinnedImageRef: defaults.pinnedImageRef,
          pinnedVersion: recommendation.reviewedVersion
        },
        where: {
          ownerKey_toolId: {
            ownerKey: context.tenant.tenantId,
            toolId
          }
        }
      });

      let installJobId: string | null = null;
      if (request.queueInstall) {
        let runtimeKind: OpenSourceToolRuntime | null;
        try {
          runtimeKind = selectOpenSourceToolInstallRuntime(
            entry.tool,
            request.runtimeKind
          );
        } catch (error) {
          throw new AppServiceError(
            error instanceof Error
              ? error.message
              : "Requested runtime is not installable for this tool.",
            400,
            "third_party_tool_runtime_not_installable"
          );
        }
        if (!runtimeKind) {
          throw new AppServiceError(
            "No installable runtime is configured for this tool.",
            400,
            "third_party_tool_runtime_missing"
          );
        }

        const job = await prisma.thirdPartyToolInstallJob.create({
          data: {
            action: "Install",
            completedAt: null,
            outputRedacted: null,
            reason: `Queued reviewed update install for ${entry.tool.displayName} ${runtimeKind} runtime.`,
            requestedByUserId: context.user.userId,
            runtimeKind,
            startedAt: null,
            status: "Queued",
            tenantId: context.tenant.tenantId,
            toolId
          }
        });
        installJobId = job.thirdPartyToolInstallJobId;
      }

      const updated = await prisma.thirdPartyToolUpdateRecommendation.update({
        data: {
          appliedAt: new Date(),
          appliedByUserId: context.user.userId,
          installJobId,
          requiredActions: request.queueInstall
            ? [
                "Install job queued; worker execution remains governed by platform runtime policy."
              ]
            : [
                "Reviewed pin applied; queue an install job before runtime use."
              ],
          status: "Applied"
        },
        where: {
          thirdPartyToolUpdateRecommendationId: recommendationId
        }
      });

      await writeAuditEvent(prisma, {
        action: "third_party_tool.update_applied",
        actorType: "User",
        entityId: recommendationId,
        entityType: "ThirdPartyToolUpdateRecommendation",
        metadata: {
          installJobQueued: Boolean(installJobId),
          previousPinnedVersion: existing?.pinnedVersion ?? null,
          reasonProvided: Boolean(request.reason),
          recommendationId,
          reviewedVersion: recommendation.reviewedVersion,
          toolId
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return serializeUpdateRecommendation(
        updated as PersistedToolUpdateRecommendation
      );
    },

    async dismissThirdPartyToolUpdateRecommendation(
      context,
      toolId,
      recommendationId,
      reason
    ) {
      assertTenantAdmin(context);
      await getEntryOrThrow(toolId);

      const row = await prisma.thirdPartyToolUpdateRecommendation.findFirst({
        where: {
          tenantId: context.tenant.tenantId,
          thirdPartyToolUpdateRecommendationId: recommendationId,
          toolId
        }
      });

      if (!row) {
        return null;
      }

      const updated = await prisma.thirdPartyToolUpdateRecommendation.update({
        data: {
          dismissedAt: new Date(),
          dismissedByUserId: context.user.userId,
          reason: reason ?? row.reason,
          status: "Dismissed"
        },
        where: {
          thirdPartyToolUpdateRecommendationId: recommendationId
        }
      });

      await writeAuditEvent(prisma, {
        action: "third_party_tool.update_dismissed",
        actorType: "User",
        entityId: recommendationId,
        entityType: "ThirdPartyToolUpdateRecommendation",
        metadata: {
          reasonProvided: Boolean(reason),
          recommendationId,
          toolId
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return serializeUpdateRecommendation(
        updated as PersistedToolUpdateRecommendation
      );
    },

    async getThirdPartyTool(context, toolId) {
      const entry = await getOpenSourceToolCatalogEntryWithRuntime(toolId);
      return entry
        ? getComposedTool(prisma, context.tenant.tenantId, entry)
        : null;
    },

    async getThirdPartyToolCoverageAudit(context) {
      assertTenantAdmin(context);
      const tools = await this.listThirdPartyTools(context);

      return buildThirdPartyToolCoverageAudit(tools, context.tenant.tenantId);
    },

    async checkThirdPartyTool(context, toolId) {
      assertTenantAdmin(context);

      const entry = await getEntryOrThrow(toolId);
      const resolution = await resolveOpenSourceToolRuntime(toolId);
      const status = resolution.available ? "Available" : "Missing";
      const reason =
        resolution.reason ??
        (resolution.available
          ? `Runtime available through ${resolution.runtime}.`
          : `No runtime available for ${entry.tool.displayName}.`);
      await upsertRuntimePolicyFromEntry({
        entry,
        prisma,
        runtimeAvailable: resolution.available,
        runtimeKind: resolution.runtime ?? null,
        runtimeReason: reason,
        status,
        tenantId: context.tenant.tenantId
      });
      await prisma.thirdPartyToolInstallJob.create({
        data: {
          action: "Check",
          completedAt: new Date(),
          outputRedacted: reason,
          reason,
          requestedByUserId: context.user.userId,
          runtimeKind: resolution.runtime,
          startedAt: new Date(),
          status: resolution.available ? "Completed" : "Failed",
          tenantId: context.tenant.tenantId,
          toolId
        }
      });
      await writeToolAudit(
        prisma,
        context,
        "third_party_tool.checked",
        toolId,
        {
          runtimeAvailable: resolution.available,
          runtimeKind: resolution.runtime,
          runtimeReason: reason
        }
      );

      return getComposedTool(prisma, context.tenant.tenantId, entry);
    },

    async acceptToolLicense(context, input) {
      assertTenantAdmin(context);

      const entry = await getEntryOrThrow(input.toolId);
      const version = resolveLicensePinVersion(entry, input.version);
      const spdx = resolveLicenseSpdx(entry, input.spdx);

      if (input.spdx && input.spdx.trim() !== entry.tool.license) {
        throw new AppServiceError(
          `SPDX must match the reviewed catalog license (${entry.tool.license}).`,
          400,
          "tool_license_spdx_mismatch"
        );
      }

      const expectedTextHash = computeToolLicenseTextHash({
        docsUrl: entry.tool.docsUrl,
        spdx,
        toolId: entry.tool.toolId,
        version
      });
      const textHash = (input.textHash ?? expectedTextHash).toLowerCase();

      if (input.textHash && textHash !== expectedTextHash) {
        throw new AppServiceError(
          "License text hash does not match the reviewed catalog ceremony payload for this pin.",
          400,
          "tool_license_text_hash_mismatch"
        );
      }

      const existing = await findCurrentLicenseAcceptance(prisma, {
        tenantId: context.tenant.tenantId,
        textHash,
        toolId: entry.tool.toolId,
        version
      });

      if (existing) {
        return serializeLicenseAcceptance(existing);
      }

      const created = await prisma.toolLicenseAcceptance.create({
        data: {
          acceptedAt: new Date(),
          acceptedBy: context.user.userId,
          spdx,
          tenantId: context.tenant.tenantId,
          textHash,
          toolId: entry.tool.toolId,
          version
        }
      });

      await writeToolAudit(
        prisma,
        context,
        "third_party_tool.license_accepted",
        entry.tool.toolId,
        {
          acceptanceId: created.toolLicenseAcceptanceId,
          spdx,
          textHash,
          version
        },
        {
          entityId: created.toolLicenseAcceptanceId,
          entityType: "ToolLicenseAcceptance"
        }
      );

      return serializeLicenseAcceptance(created);
    },

    async listToolLicenseAcceptances(context, query = {}) {
      const rows = await prisma.toolLicenseAcceptance.findMany({
        orderBy: {
          acceptedAt: "desc"
        },
        take: 200,
        where: {
          tenantId: context.tenant.tenantId,
          ...(query.toolId ? { toolId: query.toolId } : {})
        }
      });

      return rows.map((row) => serializeLicenseAcceptance(row));
    },

    async installThirdPartyTool(context, toolId, input) {
      assertTenantAdmin(context);

      const entry = await getEntryOrThrow(toolId);

      if (isInstallHardBlocked(entry)) {
        const job = await prisma.thirdPartyToolInstallJob.create({
          data: {
            action: "Install",
            completedAt: new Date(),
            outputRedacted:
              "Install denied because the tool is blocked by Periscan safety policy.",
            reason:
              "Install denied because the tool is blocked by Periscan safety policy.",
            requestedByUserId: context.user.userId,
            runtimeKind: input.runtimeKind ?? null,
            startedAt: new Date(),
            status: "Denied",
            tenantId: context.tenant.tenantId,
            toolId
          }
        });
        await writeToolAudit(
          prisma,
          context,
          "third_party_tool.install_failed",
          toolId,
          {
            reason: "blocked"
          }
        );
        return serializeJob(job as PersistedInstallJob);
      }

      // P15-1: legal-review tools with a real install path need a catalog
      // integrity pin (expectedIntegrity / imageDigest / integrityDigest).
      const integrityPin =
        entry.tool.integrityDigest ??
        entry.tool.imageDigest ??
        entry.tool.expectedIntegrity ??
        null;
      const hasInstallArtifact = Boolean(
        entry.tool.dockerImage ||
          entry.tool.gitRepo ||
          entry.tool.releaseArtifact
      );
      if (
        requiresLicenseAcceptance(entry) &&
        !integrityPin &&
        hasInstallArtifact
      ) {
        const acceptedWithoutPin = await hasCurrentLicenseAcceptance(prisma, {
          entry,
          tenantId: context.tenant.tenantId
        });
        if (!acceptedWithoutPin) {
          const job = await prisma.thirdPartyToolInstallJob.create({
            data: {
              action: "Install",
              completedAt: new Date(),
              outputRedacted:
                "Install denied because license acceptance is required before downloading this copyleft engine. After accept, Engine Lab can pull the official upstream pin even when the catalog has no digest.",
              reason: "license_acceptance_required",
              requestedByUserId: context.user.userId,
              runtimeKind: input.runtimeKind ?? null,
              startedAt: new Date(),
              status: "Denied",
              tenantId: context.tenant.tenantId,
              toolId
            }
          });
          await writeToolAudit(
            prisma,
            context,
            "third_party_tool.install_failed",
            toolId,
            {
              reason: "license_acceptance_required"
            }
          );
          return serializeJob(job as PersistedInstallJob);
        }
        await writeToolAudit(
          prisma,
          context,
          "third_party_tool.install_requested",
          toolId,
          {
            integrityPinPresent: false,
            reason: "integrity_pin_absent_user_accepted"
          }
        );
      }

      if (requiresLicenseAcceptance(entry)) {
        const version = resolveLicensePinVersion(entry);
        const spdx = resolveLicenseSpdx(entry);
        const textHash = computeToolLicenseTextHash({
          docsUrl: entry.tool.docsUrl,
          spdx,
          toolId: entry.tool.toolId,
          version
        });
        const acceptance = await findCurrentLicenseAcceptance(prisma, {
          tenantId: context.tenant.tenantId,
          textHash,
          toolId: entry.tool.toolId,
          version
        });

        if (!acceptance) {
          const job = await prisma.thirdPartyToolInstallJob.create({
            data: {
              action: "Install",
              completedAt: new Date(),
              outputRedacted:
                "Install denied because license acceptance is required for this tool pin before install.",
              reason:
                "Install denied because license acceptance is required for this tool pin before install.",
              requestedByUserId: context.user.userId,
              runtimeKind: input.runtimeKind ?? null,
              startedAt: new Date(),
              status: "Denied",
              tenantId: context.tenant.tenantId,
              toolId
            }
          });
          await writeToolAudit(
            prisma,
            context,
            "third_party_tool.install_failed",
            toolId,
            {
              reason: "license_acceptance_required",
              spdx,
              textHash,
              version
            }
          );
          return serializeJob(job as PersistedInstallJob);
        }
      }

      let runtimeKind: OpenSourceToolRuntime | null;

      try {
        runtimeKind = selectOpenSourceToolInstallRuntime(
          entry.tool,
          input.runtimeKind
        );
      } catch (error) {
        throw new AppServiceError(
          error instanceof Error
            ? error.message
            : "Requested runtime is not installable for this tool.",
          400,
          "third_party_tool_runtime_not_installable"
        );
      }

      if (!runtimeKind) {
        throw new AppServiceError(
          "No installable runtime is configured for this tool.",
          400,
          "third_party_tool_runtime_missing"
        );
      }

      await upsertRuntimePolicyFromEntry({
        entry,
        prisma,
        runtimeAvailable: Boolean(entry.runtimeAvailable),
        runtimeKind,
        runtimeReason: `Install request queued for ${entry.tool.displayName} ${runtimeKind} runtime.`,
        status: "Installing",
        tenantId: context.tenant.tenantId
      });
      const job = await prisma.thirdPartyToolInstallJob.create({
        data: {
          action: "Install",
          completedAt: null,
          outputRedacted: null,
          reason: `Queued platform install for ${entry.tool.displayName} ${runtimeKind} runtime.`,
          requestedByUserId: context.user.userId,
          runtimeKind,
          startedAt: null,
          status: "Queued",
          tenantId: context.tenant.tenantId,
          toolId
        }
      });
      await writeToolAudit(
        prisma,
        context,
        "third_party_tool.install_requested",
        toolId,
        {
          runtimeKind
        }
      );

      return serializeJob(job as PersistedInstallJob);
    },

    async getThirdPartyToolInstallPlan(context, toolId) {
      const entry = await getEntryOrThrow(toolId);
      const version = resolveLicensePinVersion(entry);
      const spdx = resolveLicenseSpdx(entry);
      const needsAcceptance = requiresLicenseAcceptance(entry);
      const licenseAccepted = needsAcceptance
        ? await hasCurrentLicenseAcceptance(prisma, {
            entry,
            tenantId: context.tenant.tenantId
          })
        : true;
      const integrityPin =
        entry.tool.integrityDigest ??
        entry.tool.imageDigest ??
        entry.tool.expectedIntegrity ??
        null;
      const integrityPinPresent = Boolean(integrityPin);
      const hasInstallArtifact = Boolean(
        entry.tool.dockerImage ||
          entry.tool.gitRepo ||
          entry.tool.releaseArtifact
      );
      const missingIntegrityPin =
        needsAcceptance &&
        !integrityPinPresent &&
        hasInstallArtifact &&
        !licenseAccepted;
      const licenseUrl =
        entry.tool.licenseUrl ?? entry.tool.upstreamLicenseUrl ?? null;

      if (isInstallHardBlocked(entry)) {
        return ThirdPartyToolInstallPlanSchema.parse({
          displayCommand: `blocked:${toolId}`,
          docsUrl: entry.tool.docsUrl,
          installable: false,
          integrityDigest: integrityPin,
          integrityPin,
          integrityPinPresent,
          licenseAccepted,
          licenseUrl,
          noOp: false,
          notRedistributedByDefault: true,
          reason:
            "Install is blocked by Periscan safety policy. This engine is not available for tenant install.",
          requiresLicenseAcceptance: needsAcceptance,
          runtimeKind: entry.runtimeKind ?? null,
          spdx,
          toolId: entry.tool.toolId,
          upstreamLicenseUrl: licenseUrl ?? entry.tool.docsUrl,
          version
        } satisfies ThirdPartyToolInstallPlan);
      }

      const plan = await buildOpenSourceToolInstallPlan(toolId);
      const planReason =
        "reason" in plan && typeof plan.reason === "string" ? plan.reason : null;
      const licenseGateReason =
        needsAcceptance && !licenseAccepted
          ? "Accept the upstream license for this pin before install. Periscan does not redistribute this package in the default scan image."
          : null;
      const integrityGateReason = missingIntegrityPin
        ? "Accept the upstream license first. After accept, Engine Lab downloads the official pin even if the catalog has no digest (we do not invent one)."
        : needsAcceptance && licenseAccepted && !integrityPinPresent
          ? "No catalog digest for this pin. Install pulls the official upstream tag after your license accept."
          : null;

      return ThirdPartyToolInstallPlanSchema.parse({
        displayCommand: plan.displayCommand,
        docsUrl: entry.tool.docsUrl,
        // Technical + license + integrity gates (P15-1).
        installable:
          plan.installable &&
          !(needsAcceptance && !licenseAccepted) &&
          !missingIntegrityPin,
        integrityDigest: integrityPin,
        integrityPin,
        integrityPinPresent,
        licenseAccepted,
        licenseUrl,
        noOp: "noOp" in plan ? Boolean(plan.noOp) : false,
        notRedistributedByDefault: true,
        reason:
          licenseGateReason ?? integrityGateReason ?? planReason,
        requiresLicenseAcceptance: needsAcceptance,
        runtimeKind: plan.runtimeKind,
        spdx,
        toolId: entry.tool.toolId,
        upstreamLicenseUrl: licenseUrl ?? entry.tool.docsUrl,
        version: plan.version || version
      } satisfies ThirdPartyToolInstallPlan);
    },

    async enableThirdPartyTool(context, toolId, input) {
      assertTenantAdmin(context);

      const entry = await getEntryOrThrow(toolId);

      if (isEnableHardBlocked(entry)) {
        await writeToolAudit(
          prisma,
          context,
          "third_party_tool.enable_denied",
          toolId,
          {
            reason: "blocked"
          }
        );
        throw new AppServiceError(
          "This tool cannot be enabled because it is blocked by Periscan safety policy.",
          403,
          "third_party_tool_enable_denied"
        );
      }

      if (requiresLicenseAcceptance(entry)) {
        const accepted = await hasCurrentLicenseAcceptance(prisma, {
          entry,
          tenantId: context.tenant.tenantId
        });
        if (!accepted) {
          await writeToolAudit(
            prisma,
            context,
            "third_party_tool.enable_denied",
            toolId,
            {
              reason: "license_acceptance_required"
            }
          );
          throw new AppServiceError(
            "Accept the upstream license for this tool pin before enablement. Periscan does not redistribute restricted-license engines by default.",
            403,
            "third_party_tool_license_acceptance_required"
          );
        }
      } else if (!canEnableEntry(entry)) {
        await writeToolAudit(
          prisma,
          context,
          "third_party_tool.enable_denied",
          toolId,
          {
            reason: "blocked_or_legal_review"
          }
        );
        throw new AppServiceError(
          "This tool cannot be enabled because it is blocked or requires legal review.",
          403,
          "third_party_tool_enable_denied"
        );
      }

      const defaults = defaultPolicyForEntry(entry, context.tenant.tenantId);
      await prisma.thirdPartyToolPolicy.upsert({
        create: {
          allowedRuntimes: defaults.allowedRuntimes,
          disabledReason: null,
          enabled: true,
          installStatus: runtimeInstallStatus(entry),
          installedAt: null,
          installedVersion: null,
          lastCheckedAt: entry.lastCheckedAt
            ? new Date(entry.lastCheckedAt)
            : null,
          legalReviewStatus: defaults.legalReviewStatus,
          ownerKey: context.tenant.tenantId,
          pinnedGitRef: defaults.pinnedGitRef,
          pinnedImageRef: defaults.pinnedImageRef,
          pinnedVersion: defaults.pinnedVersion,
          runtimeAvailable: Boolean(entry.runtimeAvailable),
          runtimeKind: entry.runtimeKind,
          runtimeReason:
            entry.runtimeReason ?? "Runtime readiness has not been checked.",
          status: "Enabled",
          tenantId: context.tenant.tenantId,
          toolId
        },
        update: {
          disabledReason: null,
          enabled: true,
          status: "Enabled"
        },
        where: {
          ownerKey_toolId: {
            ownerKey: context.tenant.tenantId,
            toolId
          }
        }
      });
      await writeToolAudit(
        prisma,
        context,
        "third_party_tool.enabled",
        toolId,
        {
          reason: input.reason ?? null
        }
      );

      return getComposedTool(prisma, context.tenant.tenantId, entry);
    },

    async uninstallThirdPartyTool(context, toolId) {
      assertTenantAdmin(context);
      const entry = await getEntryOrThrow(toolId);
      const plan = await buildOpenSourceToolUninstallPlan(toolId);
      const executed = await executeOpenSourceToolInstallPlan(plan, {
        execute: plan.installable && !plan.noOp
      });
      await upsertRuntimePolicyFromEntry({
        entry,
        prisma,
        runtimeAvailable: false,
        runtimeKind: plan.runtimeKind,
        runtimeReason: executed.runtimeReason,
        status: "NotInstalled",
        tenantId: context.tenant.tenantId
      });
      const job = await prisma.thirdPartyToolInstallJob.create({
        data: {
          action: "Uninstall",
          completedAt: new Date(),
          outputRedacted: executed.outputRedacted,
          reason: executed.runtimeReason,
          requestedByUserId: context.user.userId,
          runtimeKind: plan.runtimeKind,
          startedAt: new Date(),
          status: executed.success || plan.noOp ? "Completed" : "Failed",
          tenantId: context.tenant.tenantId,
          toolId
        }
      });
      await writeToolAudit(
        prisma,
        context,
        "third_party_tool.uninstalled",
        toolId,
        { runtimeKind: plan.runtimeKind }
      );
      return serializeJob(job as PersistedInstallJob);
    },

    async disableThirdPartyTool(context, toolId, input) {
      assertTenantAdmin(context);

      const entry = await getEntryOrThrow(toolId);
      const defaults = defaultPolicyForEntry(entry, context.tenant.tenantId);
      await prisma.thirdPartyToolPolicy.upsert({
        create: {
          allowedRuntimes: defaults.allowedRuntimes,
          disabledReason: input.reason,
          enabled: false,
          installStatus: runtimeInstallStatus(entry),
          installedAt: null,
          installedVersion: null,
          lastCheckedAt: entry.lastCheckedAt
            ? new Date(entry.lastCheckedAt)
            : null,
          legalReviewStatus: defaults.legalReviewStatus,
          ownerKey: context.tenant.tenantId,
          pinnedGitRef: defaults.pinnedGitRef,
          pinnedImageRef: defaults.pinnedImageRef,
          pinnedVersion: defaults.pinnedVersion,
          runtimeAvailable: Boolean(entry.runtimeAvailable),
          runtimeKind: entry.runtimeKind,
          runtimeReason:
            entry.runtimeReason ?? "Runtime readiness has not been checked.",
          status: "Disabled",
          tenantId: context.tenant.tenantId,
          toolId
        },
        update: {
          disabledReason: input.reason,
          enabled: false,
          status: "Disabled"
        },
        where: {
          ownerKey_toolId: {
            ownerKey: context.tenant.tenantId,
            toolId
          }
        }
      });
      await writeToolAudit(
        prisma,
        context,
        "third_party_tool.disabled",
        toolId,
        {
          reason: input.reason
        }
      );

      return getComposedTool(prisma, context.tenant.tenantId, entry);
    },

    async listThirdPartyToolJobs(context, toolId) {
      const entry = await getEntryOrThrow(toolId);
      void entry;
      const rows = await prisma.thirdPartyToolInstallJob.findMany({
        orderBy: {
          createdAt: "desc"
        },
        take: 100,
        where: {
          OR: [
            {
              tenantId: context.tenant.tenantId
            },
            {
              tenantId: null
            }
          ],
          toolId
        }
      });
      return rows.map((row) => serializeJob(row as PersistedInstallJob));
    },

    async getThirdPartyToolLicenseSummary(context) {
      const entries = await listOpenSourceToolCatalogWithRuntime({
        includeDeferred: true,
        includeLegalReview: true,
        phase: "all"
      });
      const byLicense = new Map<string, OpenSourceToolId[]>();
      const blockedLegalReview: OpenSourceToolId[] = [];
      for (const entry of entries) {
        byLicense.set(entry.tool.license, [
          ...(byLicense.get(entry.tool.license) ?? []),
          entry.tool.toolId
        ]);
        if (entry.tool.policyStatus === "RequiresLegalReview") {
          blockedLegalReview.push(entry.tool.toolId);
        }
      }

      void context;
      return {
        blockedLegalReview,
        generatedAt: nowIso(),
        licenses: [...byLicense.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([license, toolIds]) => ({ license, toolIds })),
        totalTools: entries.length
      } satisfies ThirdPartyToolLicenseSummary;
    }
  };
}

import type {
  AdvisoryImpactAssessment,
  AdvisoryReadinessReport,
  MissingSignal,
  ThreatAdvisory,
  ThreatPackage,
  ThreatValidationPlan,
  ThreatValidationPlanItem
} from "@periscan/shared";

// Pure record -> DTO serializers for the threat-center subdomain. Extracted from
// runtime-services.ts (god-closure decomposition): pure date/field mapping with
// no closure state, DB access, or local-helper dependencies.

export function serializeThreatAdvisory(record: {
  createdAt: Date;
  cveIds: string[];
  evidenceIds: string[];
  iocValues: string[];
  publishedAt: Date | null;
  rawEvidenceId: string;
  receivedAt: Date;
  sourceName: string;
  sourceUrl: string | null;
  status: ThreatAdvisory["status"];
  summary: string;
  techniqueIds: string[];
  tenantId: string;
  threatAdvisoryId: string;
  title: string;
  updatedAt: Date;
}): ThreatAdvisory {
  return {
    createdAt: record.createdAt.toISOString(),
    cveIds: record.cveIds,
    evidenceIds: record.evidenceIds,
    iocValues: record.iocValues,
    publishedAt: record.publishedAt?.toISOString() ?? null,
    rawEvidenceId: record.rawEvidenceId,
    receivedAt: record.receivedAt.toISOString(),
    sourceName: record.sourceName,
    sourceUrl: record.sourceUrl,
    status: record.status,
    summary: record.summary,
    techniqueIds: record.techniqueIds,
    tenantId: record.tenantId,
    threatAdvisoryId: record.threatAdvisoryId,
    title: record.title,
    updatedAt: record.updatedAt.toISOString()
  };
}

export function serializeThreatPackage(record: {
  createdAt: Date;
  cveIds: string[];
  evidenceIds: string[];
  iocValues: string[];
  summary: string;
  techniqueIds: string[];
  tenantId: string;
  threatAdvisoryId: string;
  threatPackageId: string;
  title: string;
  updatedAt: Date;
}): ThreatPackage {
  return {
    createdAt: record.createdAt.toISOString(),
    cveIds: record.cveIds,
    evidenceIds: record.evidenceIds,
    iocValues: record.iocValues,
    summary: record.summary,
    techniqueIds: record.techniqueIds,
    tenantId: record.tenantId,
    threatAdvisoryId: record.threatAdvisoryId,
    threatPackageId: record.threatPackageId,
    title: record.title,
    updatedAt: record.updatedAt.toISOString()
  };
}

export function serializeMissingSignal(record: {
  createdAt: Date;
  missingSignalId: string;
  reason: string;
  relatedEntityId: string;
  relatedEntityType: MissingSignal["relatedEntityType"];
  requiredIntegrationCategory: MissingSignal["requiredIntegrationCategory"];
  signalType: string;
  status: MissingSignal["status"];
  tenantId: string;
  updatedAt: Date;
}): MissingSignal {
  return {
    createdAt: record.createdAt.toISOString(),
    missingSignalId: record.missingSignalId,
    reason: record.reason,
    relatedEntityId: record.relatedEntityId,
    relatedEntityType: record.relatedEntityType,
    requiredIntegrationCategory: record.requiredIntegrationCategory,
    signalType: record.signalType,
    status: record.status,
    tenantId: record.tenantId,
    updatedAt: record.updatedAt.toISOString()
  };
}

export function serializeAdvisoryImpactAssessment(record: {
  advisoryImpactAssessmentId: string;
  affectedAssetIds: string[];
  affectedFindingIds: string[];
  confidence: number;
  createdAt: Date;
  evidenceIds: string[];
  missingSignalIds: string[];
  summary: string;
  tenantId: string;
  threatAdvisoryId: string;
  updatedAt: Date;
}): AdvisoryImpactAssessment {
  return {
    advisoryImpactAssessmentId: record.advisoryImpactAssessmentId,
    affectedAssetIds: record.affectedAssetIds,
    affectedFindingIds: record.affectedFindingIds,
    confidence: record.confidence,
    createdAt: record.createdAt.toISOString(),
    evidenceIds: record.evidenceIds,
    missingSignalIds: record.missingSignalIds,
    summary: record.summary,
    tenantId: record.tenantId,
    threatAdvisoryId: record.threatAdvisoryId,
    updatedAt: record.updatedAt.toISOString()
  };
}

export function serializeThreatValidationPlanItem(record: {
  createdAt: Date;
  evidenceIds: string[];
  missingSignalIds: string[];
  missionType: ThreatValidationPlanItem["missionType"];
  rationale: string;
  requiredIntegrationCategories: ThreatValidationPlanItem["requiredIntegrationCategories"];
  requiredScopeTypes: ThreatValidationPlanItem["requiredScopeTypes"];
  safetyLevel: ThreatValidationPlanItem["safetyLevel"];
  status: ThreatValidationPlanItem["status"];
  tenantId: string;
  threatValidationPlanId: string;
  threatValidationPlanItemId: string;
  title: string;
  updatedAt: Date;
}): ThreatValidationPlanItem {
  return {
    createdAt: record.createdAt.toISOString(),
    evidenceIds: record.evidenceIds,
    missingSignalIds: record.missingSignalIds,
    missionType: record.missionType,
    rationale: record.rationale,
    requiredIntegrationCategories: record.requiredIntegrationCategories,
    requiredScopeTypes: record.requiredScopeTypes,
    safetyLevel: record.safetyLevel,
    status: record.status,
    tenantId: record.tenantId,
    threatValidationPlanId: record.threatValidationPlanId,
    threatValidationPlanItemId: record.threatValidationPlanItemId,
    title: record.title,
    updatedAt: record.updatedAt.toISOString()
  };
}

export function serializeThreatValidationPlan(record: {
  createdAt: Date;
  evidenceIds: string[];
  planItems: Parameters<typeof serializeThreatValidationPlanItem>[0][];
  status: ThreatValidationPlan["status"];
  summary: string;
  tenantId: string;
  threatAdvisoryId: string;
  threatValidationPlanId: string;
  updatedAt: Date;
}): ThreatValidationPlan {
  return {
    createdAt: record.createdAt.toISOString(),
    evidenceIds: record.evidenceIds,
    planItems: record.planItems.map(serializeThreatValidationPlanItem),
    status: record.status,
    summary: record.summary,
    tenantId: record.tenantId,
    threatAdvisoryId: record.threatAdvisoryId,
    threatValidationPlanId: record.threatValidationPlanId,
    updatedAt: record.updatedAt.toISOString()
  };
}

export function serializeAdvisoryReadinessReport(record: {
  advisoryReadinessReportId: string;
  createdAt: Date;
  evidenceIds: string[];
  evidencePackId: string | null;
  missingSignalIds: string[];
  readinessStatus: AdvisoryReadinessReport["readinessStatus"];
  summary: string;
  tenantId: string;
  threatAdvisoryId: string;
  updatedAt: Date;
}): AdvisoryReadinessReport {
  return {
    advisoryReadinessReportId: record.advisoryReadinessReportId,
    createdAt: record.createdAt.toISOString(),
    evidenceIds: record.evidenceIds,
    evidencePackId: record.evidencePackId,
    missingSignalIds: record.missingSignalIds,
    readinessStatus: record.readinessStatus,
    summary: record.summary,
    tenantId: record.tenantId,
    threatAdvisoryId: record.threatAdvisoryId,
    updatedAt: record.updatedAt.toISOString()
  };
}

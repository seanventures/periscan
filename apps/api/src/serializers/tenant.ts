import type {
  DesignPartnerReportNote,
  DesignPartnerSessionNote,
  MembershipRole,
  SignalTriggerRoutingSettings,
  Tenant,
  TenantDesignPartnerSettings,
  TenantReportBranding,
  TenantSsoConfig,
  TenantSsoRoleMappingRule
} from "@periscan/shared";

// Pure record -> DTO serializers for the tenant / tenant-settings subdomain.
// Extracted from runtime-services.ts (god-closure decomposition). These are pure
// field/date mappers with no closure state or local-helper dependencies. The
// `default*` builders they were interleaved with stay in runtime-services since
// they construct defaults rather than serialize persisted rows.

export function serializeTenant(record: {
  billingAccountId: string | null;
  createdAt: Date;
  dataRegion: string;
  name: string;
  parentTenantId: string | null;
  requireMfa?: boolean;
  tenantId: string;
  type: Tenant["type"];
  updatedAt: Date;
}): Tenant {
  return {
    billingAccountId: record.billingAccountId,
    createdAt: record.createdAt.toISOString(),
    dataRegion: record.dataRegion,
    name: record.name,
    parentTenantId: record.parentTenantId,
    requireMfa: record.requireMfa ?? false,
    tenantId: record.tenantId,
    type: record.type,
    updatedAt: record.updatedAt.toISOString()
  };
}

export function serializeTenantReportBranding(record: {
  createdAt: Date;
  logoUrl: string | null;
  organizationName: string | null;
  primaryColor: string | null;
  reportFooter: string | null;
  supportEmail: string | null;
  tenantId: string;
  updatedAt: Date;
  whiteLabelEnabled: boolean;
}): TenantReportBranding {
  return {
    createdAt: record.createdAt.toISOString(),
    logoUrl: record.logoUrl,
    organizationName: record.organizationName,
    primaryColor: record.primaryColor,
    reportFooter: record.reportFooter,
    supportEmail: record.supportEmail,
    tenantId: record.tenantId,
    updatedAt: record.updatedAt.toISOString(),
    whiteLabelEnabled: record.whiteLabelEnabled
  };
}

export function serializeTenantDesignPartnerSettings(record: {
  createdAt: Date;
  enabled: boolean;
  tenantId: string;
  updatedAt: Date;
}): TenantDesignPartnerSettings {
  return {
    createdAt: record.createdAt.toISOString(),
    enabled: record.enabled,
    tenantId: record.tenantId,
    updatedAt: record.updatedAt.toISOString()
  };
}

const SESSION_OUTCOMES = new Set([
  "not_started",
  "in_progress",
  "completed",
  "convert",
  "nurture",
  "churn"
] as const);

export function serializeDesignPartnerSessionNote(record: {
  createdAt: Date;
  note: string;
  outcome: string | null;
  partnerCode: string;
  roleBand: string | null;
  sessionDate: Date | null;
  sessionNoteId: string;
  tenantId: string;
  updatedAt: Date;
}): DesignPartnerSessionNote {
  const outcome =
    record.outcome && SESSION_OUTCOMES.has(record.outcome as never)
      ? (record.outcome as DesignPartnerSessionNote["outcome"])
      : null;
  return {
    createdAt: record.createdAt.toISOString(),
    isPublicReference: false,
    note: record.note,
    outcome,
    partnerCode: record.partnerCode,
    roleBand: record.roleBand,
    sessionDate: record.sessionDate?.toISOString() ?? null,
    sessionNoteId: record.sessionNoteId,
    tenantId: record.tenantId,
    updatedAt: record.updatedAt.toISOString()
  };
}

function serializeRoleMappings(raw: unknown): TenantSsoRoleMappingRule[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const rules: TenantSsoRoleMappingRule[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const row = item as Record<string, unknown>;
    const claimValue =
      typeof row.claimValue === "string" ? row.claimValue.trim() : "";
    const role = row.role;
    if (
      !claimValue ||
      (role !== "Owner" &&
        role !== "Admin" &&
        role !== "SecurityEngineer" &&
        role !== "Viewer" &&
        role !== "MSSPOwner" &&
        role !== "ClientAdmin")
    ) {
      continue;
    }
    rules.push({ claimValue, role });
  }
  return rules;
}

export function serializeTenantSsoConfig(record: {
  authorizationEndpoint: string;
  clientId: string;
  clientSecretEncrypted: string | null;
  createdAt: Date;
  createdBy: string | null;
  defaultMappedRole?: MembershipRole | null;
  emailDomainAllowlist: string[];
  enforced: boolean;
  issuerUrl: string;
  jwksUri: string | null;
  providerType: TenantSsoConfig["providerType"];
  redirectUri: string | null;
  roleClaimName?: string | null;
  roleMappings?: unknown;
  samlIdpCertificate: string | null;
  samlNameIdFormat: string | null;
  scopes: string[];
  status: TenantSsoConfig["status"];
  tenantId: string;
  tokenEndpoint: string | null;
  updatedAt: Date;
  updatedBy: string | null;
}): TenantSsoConfig {
  return {
    authorizationEndpoint: record.authorizationEndpoint,
    clientId: record.clientId,
    clientSecretSet: Boolean(record.clientSecretEncrypted),
    createdAt: record.createdAt.toISOString(),
    createdBy: record.createdBy,
    defaultMappedRole: record.defaultMappedRole ?? null,
    emailDomainAllowlist: record.emailDomainAllowlist,
    enforced: record.enforced,
    issuerUrl: record.issuerUrl,
    jwksUri: record.jwksUri,
    providerType: record.providerType,
    redirectUri: record.redirectUri,
    roleClaimName: record.roleClaimName ?? null,
    roleMappings: serializeRoleMappings(record.roleMappings),
    samlIdpCertificateSet: Boolean(record.samlIdpCertificate),
    samlNameIdFormat: record.samlNameIdFormat,
    scopes: record.scopes,
    status: record.status,
    tenantId: record.tenantId,
    tokenEndpoint: record.tokenEndpoint,
    updatedAt: record.updatedAt.toISOString(),
    updatedBy: record.updatedBy
  };
}

export function serializeSignalTriggerRoutingSettings(record: {
  createdAt: Date;
  defaultOwnerRole: MembershipRole;
  enabled: boolean;
  notificationIntegrationIds: string[];
  ruleParameters?: unknown;
  tenantId: string;
  updatedAt: Date;
  workflowDestinationIntegrationIds: string[];
}): SignalTriggerRoutingSettings {
  const ruleParameters =
    record.ruleParameters &&
    typeof record.ruleParameters === "object" &&
    !Array.isArray(record.ruleParameters)
      ? (record.ruleParameters as SignalTriggerRoutingSettings["ruleParameters"])
      : {};
  return {
    createdAt: record.createdAt.toISOString(),
    defaultOwnerRole: record.defaultOwnerRole,
    enabled: record.enabled,
    notificationIntegrationIds: record.notificationIntegrationIds,
    ruleParameters,
    tenantId: record.tenantId,
    updatedAt: record.updatedAt.toISOString(),
    workflowDestinationIntegrationIds: record.workflowDestinationIntegrationIds
  };
}

export function serializeDesignPartnerReportNote(record: {
  authorLabel: string;
  body: string;
  createdAt: Date;
  evidencePackId: string;
  tenantId: string;
  title: string | null;
  updatedAt: Date;
}): DesignPartnerReportNote {
  return {
    authorLabel: record.authorLabel,
    body: record.body,
    createdAt: record.createdAt.toISOString(),
    reportId: record.evidencePackId,
    tenantId: record.tenantId,
    title: record.title,
    updatedAt: record.updatedAt.toISOString()
  };
}

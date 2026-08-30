import { describe, expect, it } from "vitest";

import {
  AIApplicationSchema,
  AdvisoryImpactAssessmentSchema,
  AdvisoryReadinessReportSchema,
  ApplyPathEdgeReceiptInputSchema,
  AttackPathAssessmentSchema,
  AttackPathEdgePlanItemSchema,
  AttackPathMeasurementStateSchema,
  AttackPathSchema,
  AttackPathValidationPlanSchema,
  AssetValuationInputSchema,
  LaunchPathEdgeValidationInputSchema,
  PathEdgeReceiptSchema,
  PathEdgeValidationEligibilitySchema,
  AuditEventFilterSchema,
  AuditEventSchema,
  BillingPackageSchema,
  BillingUsageSchema,
  evaluateCapabilityEntitlement,
  isCapabilityEntitled,
  isMeterEntitled,
  ControlRuleCoverageSummarySchema,
  ControlSourceSchema,
  CompileScenarioInputSchema,
  CreateRemediationInputSchema,
  CTEMProgramSummarySchema,
  DesignPartnerReportNoteSchema,
  DesignPartnerWorkspaceSchema,
  EvidenceArtifactSchema,
  EvidenceArtifactVerificationSchema,
  EvidenceChainVerificationReportSchema,
  EvidencePackSchema,
  ExecuteScenarioInputSchema,
  ExecutiveTrendSummarySchema,
  ExposureSchema,
  AssetCoverageTagSchema,
  AssetInventoryEntrySchema,
  AssetTypeSchema,
  canonicalizeAssetCoverageTags,
  ControlSourceTypeSchema,
  GRAPH_NODE_ASSET_LEGACY_LEAVES,
  GRAPH_NODE_BARE_TYPES,
  GRAPH_NODE_TYPE_FAMILIES,
  GRAPH_NODE_TYPE_ONTOLOGY_VERSION,
  GraphEdgeSchema,
  GraphNodeSchema,
  GraphNodeTypeSchema,
  isAllowedGraphNodeType,
  normalizeAssetCoverageTag,
  IntegrationSchema,
  SignalCategorySchema,
  ImportThreatAdvisoryInputSchema,
  JobSchema,
  MissionScheduleSchema,
  MissionStartResultSchema,
  MissingSignalSchema,
  MSSPClientPortfolioSchema,
  PolicyDecisionSchema,
  RiskScoreInputSchema,
  RiskScoreSchema,
  resolveScopeSafetyEnvelope,
  ScheduleDiffSchema,
  ScenarioBranchPredicateSchema,
  ScenarioBundleSchema,
  ScopeSchema,
  ScenarioSchema,
  SignalTriggerApprovalResponseSchema,
  SignalTriggerEvaluationResponseSchema,
  SignalTriggerRoutingSettingsSchema,
  SignalTriggerRuleSchema,
  SignalEnvelopeSchema,
  StopScenarioFeedbackInputSchema,
  TenantOperationalMetricsSchema,
  TenantDesignPartnerSettingsSchema,
  TenantReportBrandingSchema,
  CompleteTenantSsoLoginInputSchema,
  StartTenantSsoLoginInputSchema,
  TenantSsoAuthorizationUrlInputSchema,
  TenantSsoAuthorizationUrlSchema,
  TenantSsoConfigResponseSchema,
  TenantSsoConfigSchema,
  TenantSsoLoginStartResultSchema,
  UpdateTenantSsoConfigInputSchema,
  TenantSchema,
  ThreatAdvisoryDetailSchema,
  ThreatAdvisorySchema,
  ThreatPackageSchema,
  ThreatValidationPlanSchema,
  TrustSafetySummarySchema,
  ZERO_CUSTOMER_REFERENCES_BANNER,
  buildEnterpriseCommercialHonesty,
  buildIdentityProvisioningHonesty,
  buildMarketPresenceReadiness,
  buildDesignPartnerMarketPresenceHonesty,
  expandApiKeyCapabilities,
  TenantApiKeyScopeSchema,
  formatFindingDispositionNote,
  formatRiskBandDisplayLabel,
  TransitionFindingInputSchema,
  UsageMeterDefinitionSchema,
  ValidatedFindingFilterSchema,
  ValidatedFindingSchema,
  UserSchema,
  ValidationJobPayloadSchema,
  ValidationMissionSchema,
  ValidationStateSchema,
  ValidationSnapshotSchema,
  ValidationRunSchema,
  VerificationEventSchema,
  ReportExportFormatSchema,
  PATH_VALIDATION_STATES,
  CONTROL_VALIDATION_STATES,
  REMEDIATION_VALIDATION_STATES,
  READINESS_VALIDATION_STATES,
  VALIDATION_STATE_PARTITIONS,
  classifyValidationState,
  isPathValidationState,
  isControlValidationState,
  isRemediationValidationState,
  isReadinessValidationState,
  isValidationStatePathOnly,
  isValidationStateControlOnly,
  isValidationStateRemediationOnly,
  isValidationStateReadinessOnly
} from "./domain.js";
import { AttackTechniqueSchema } from "./mitre-attack.js";

const now = "2026-06-01T00:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const scopeId = "33333333-3333-4333-8333-333333333333";
const integrationId = "44444444-4444-4444-8444-444444444444";
const assetId = "55555555-5555-4555-8555-555555555555";
const missionId = "66666666-6666-4666-8666-666666666666";
const runId = "77777777-7777-4777-8777-777777777777";
const evidenceId = "88888888-8888-4888-8888-888888888888";
const pathId = "99999999-9999-4999-8999-999999999999";
const pathNodeId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const pathEdgeId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const pathBreakerId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const remediationId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const verificationId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const aiAppId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const jobId = "abababab-abab-4bab-8bab-abababababab";
const graphNodeId = "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd";
const graphEdgeId = "efefefef-efef-4fef-8fef-efefefefefef";
const scheduleId = "12121212-1212-4212-8212-121212121212";
const threatAdvisoryId = "23232323-2323-4232-8232-232323232323";
const threatPackageId = "34343434-3434-4434-8434-343434343434";
const missingSignalId = "45454545-4545-4545-8545-454545454545";
const impactAssessmentId = "56565656-5656-4656-8656-565656565656";
const threatPlanId = "67676767-6767-4767-8767-676767676767";
const threatPlanItemId = "78787878-7878-4787-8787-787878787878";
const advisoryReportId = "89898989-8989-4989-8989-898989898989";

describe("Periscan domain schemas", () => {
  it("distinguishes Snapshot-derived CTEM summaries from live baselines", () => {
    const baseStages = [
      "Scope",
      "Discover",
      "Prioritize",
      "Validate",
      "Mobilize",
      "Verify"
    ].map((stage) => ({
      evidenceCount: 0,
      openItemCount: 0,
      stage,
      status: "NotStarted",
      trend: "Stable"
    }));

    expect(
      CTEMProgramSummarySchema.parse({
        generatedAt: now,
        stages: baseStages,
        tenantId,
        topRiskBand: "Informational"
      }).source
    ).toBe("Snapshot");

    expect(
      CTEMProgramSummarySchema.parse({
        generatedAt: now,
        snapshotId: null,
        source: "LiveTenantStateBaseline",
        stages: baseStages,
        tenantId,
        topRiskBand: "Informational"
      }).snapshotId
    ).toBeNull();
  });

  it("parses tenant, user, scope, and integration entities", () => {
    expect(
      TenantSchema.parse({
        tenantId,
        name: "Demo Tenant",
        type: "Organization",
        parentTenantId: null,
        billingAccountId: "acct-demo",
        dataRegion: "us-east-1",
        createdAt: now,
        updatedAt: now
      }).type
    ).toBe("Organization");

    expect(
      TenantReportBrandingSchema.parse({
        createdAt: now,
        logoUrl: "https://assets.periscan.test/client-logo.svg",
        organizationName: "Client Security Co",
        primaryColor: "#1A7F64",
        reportFooter: "Prepared for Client Security Co.",
        supportEmail: "security@example.com",
        tenantId,
        updatedAt: now,
        whiteLabelEnabled: true
      }).organizationName
    ).toBe("Client Security Co");

    expect(
      TenantDesignPartnerSettingsSchema.parse({
        createdAt: now,
        enabled: true,
        tenantId,
        updatedAt: now
      }).enabled
    ).toBe(true);

    expect(
      TenantSsoConfigSchema.parse({
        authorizationEndpoint: "https://idp.example.com/oauth2/authorize",
        clientId: "periscan-client",
        clientSecretSet: true,
        createdAt: now,
        createdBy: userId,
        defaultMappedRole: "Viewer",
        emailDomainAllowlist: ["example.com"],
        enforced: true,
        issuerUrl: "https://idp.example.com/oauth2/default",
        jwksUri: "https://idp.example.com/oauth2/keys",
        providerType: "OIDC",
        redirectUri: "https://app.periscan.example/auth/callback",
        roleClaimName: "groups",
        roleMappings: [
          { claimValue: "periscan-admins", role: "Admin" },
          { claimValue: "periscan-viewers", role: "Viewer" }
        ],
        scopes: ["openid", "email", "profile"],
        status: "Enabled",
        tenantId,
        tokenEndpoint: "https://idp.example.com/oauth2/token",
        updatedAt: now,
        updatedBy: userId
      }).roleMappings
    ).toEqual([
      { claimValue: "periscan-admins", role: "Admin" },
      { claimValue: "periscan-viewers", role: "Viewer" }
    ]);
    expect(
      TenantSsoConfigSchema.parse({
        authorizationEndpoint: "https://idp.example.com/oauth2/authorize",
        clientId: "periscan-client",
        clientSecretSet: true,
        createdAt: now,
        createdBy: userId,
        emailDomainAllowlist: ["example.com"],
        enforced: true,
        issuerUrl: "https://idp.example.com/oauth2/default",
        jwksUri: "https://idp.example.com/oauth2/keys",
        providerType: "OIDC",
        redirectUri: "https://app.periscan.example/auth/callback",
        scopes: ["openid", "email", "profile"],
        status: "Enabled",
        tenantId,
        tokenEndpoint: "https://idp.example.com/oauth2/token",
        updatedAt: now,
        updatedBy: userId
      }).clientSecretSet
    ).toBe(true);
    expect(
      TenantSsoConfigSchema.parse({
        authorizationEndpoint: "https://idp.example.com/saml/sso",
        clientId: "https://api.periscan.example/saml/sp",
        clientSecretSet: false,
        createdAt: now,
        emailDomainAllowlist: ["example.com"],
        enforced: true,
        issuerUrl: "https://idp.example.com/saml/metadata",
        providerType: "SAML",
        redirectUri: "https://api.periscan.example/api/v1/auth/sso/callback",
        samlIdpCertificateSet: true,
        samlNameIdFormat:
          "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
        scopes: ["saml:nameid:emailAddress"],
        status: "Enabled",
        tenantId,
        updatedAt: now
      }).providerType
    ).toBe("SAML");

    expect(
      StartTenantSsoLoginInputSchema.parse({
        email: "owner@example.com",
        prompt: "select_account",
        redirectUri: "https://app.periscan.example/auth/callback"
      }).prompt
    ).toBe("select_account");
    expect(
      StartTenantSsoLoginInputSchema.parse({
        tenantId
      }).tenantId
    ).toBe(tenantId);
    expect(
      StartTenantSsoLoginInputSchema.safeParse({
        prompt: "login"
      }).success
    ).toBe(false);
    expect(
      TenantSsoLoginStartResultSchema.parse({
        authorizationUrl:
          "https://idp.example.com/oauth2/authorize?client_id=periscan",
        expiresAt: now,
        providerType: "OIDC",
        redirectUri: "https://app.periscan.example/auth/callback",
        tenantId
      }).tenantId
    ).toBe(tenantId);
    expect(
      CompleteTenantSsoLoginInputSchema.parse({
        code: "authorization-code",
        state: "x".repeat(32)
      }).code
    ).toBe("authorization-code");
    expect(
      CompleteTenantSsoLoginInputSchema.parse({
        samlResponse: "base64-saml-response",
        state: "x".repeat(32)
      }).samlResponse
    ).toBe("base64-saml-response");
    expect(
      CompleteTenantSsoLoginInputSchema.safeParse({
        code: "authorization-code",
        samlResponse: "base64-saml-response",
        state: "x".repeat(32)
      }).success
    ).toBe(false);

    expect(
      SignalTriggerRoutingSettingsSchema.parse({
        createdAt: now,
        defaultOwnerRole: "SecurityEngineer",
        enabled: false,
        notificationIntegrationIds: [],
        tenantId,
        updatedAt: now,
        workflowDestinationIntegrationIds: []
      }).defaultOwnerRole
    ).toBe("SecurityEngineer");

    expect(
      UserSchema.parse({
        userId,
        email: "demo@periscan.local",
        name: "Demo User",
        status: "Active",
        createdAt: now,
        updatedAt: now
      }).status
    ).toBe("Active");

    expect(
      ScopeSchema.parse({
        assetClass: "BusinessApplication",
        businessCriticality: "High",
        scopeId,
        tenantId,
        scopeType: "Domain",
        value: "example.com",
        effectiveMaxSafetyLevel: "ActiveNonInvasive",
        externalValidationProfileId: "safe-baseline",
        isOperationalTechnology: false,
        maxSafetyLevel: "ActiveNonInvasive",
        purdueLevel: null,
        safetyRestrictionReason:
          "This scope permits validation through ActiveNonInvasive.",
        segmentName: "Public applications",
        sensitivity: "High",
        tags: ["internet-facing"],
        verificationMethod: "DNS_TXT",
        verificationStatus: "Verified",
        verificationToken: "periscan-token",
        verifiedAt: now,
        verifiedBy: userId,
        createdBy: userId,
        createdAt: now,
        updatedAt: now
      }).scopeType
    ).toBe("Domain");

    expect(
      resolveScopeSafetyEnvelope({
        assetClass: "OT",
        businessCriticality: "Critical",
        externalValidationProfileId: null,
        maxSafetyLevel: "BASLite",
        purdueLevel: "Level1BasicControl",
        segmentName: "Packaging line 2",
        sensitivity: "Restricted",
        tags: ["scada"]
      })
    ).toMatchObject({
      effectiveMaxSafetyLevel: "PassiveReadOnly",
      isOperationalTechnology: true
    });

    expect(
      DesignPartnerReportNoteSchema.parse({
        authorLabel: "Periscan Analyst",
        body: "Validate the latest fix before customer delivery.",
        createdAt: now,
        reportId: "13131313-1313-4313-8313-131313131313",
        tenantId,
        title: "Founder review",
        updatedAt: now
      }).authorLabel
    ).toBe("Periscan Analyst");

    expect(
      TenantSsoConfigResponseSchema.parse({
        config: null
      }).config
    ).toBeNull();

    expect(
      UpdateTenantSsoConfigInputSchema.parse({
        authorizationEndpoint: "https://idp.example.com/oauth2/authorize",
        clientId: "periscan-client",
        defaultMappedRole: "Viewer",
        emailDomainAllowlist: ["EXAMPLE.com"],
        issuerUrl: "https://idp.example.com/oauth2/default",
        roleClaimName: "groups",
        roleMappings: [{ claimValue: "periscan-admins", role: "Admin" }]
      })
    ).toMatchObject({
      defaultMappedRole: "Viewer",
      enabled: true,
      providerType: "OIDC",
      roleClaimName: "groups",
      roleMappings: [{ claimValue: "periscan-admins", role: "Admin" }],
      scopes: ["openid", "email", "profile"]
    });
    expect(
      UpdateTenantSsoConfigInputSchema.parse({
        authorizationEndpoint: "https://idp.example.com/saml/sso",
        clientId: "https://api.periscan.example/saml/sp",
        emailDomainAllowlist: ["EXAMPLE.com"],
        issuerUrl: "https://idp.example.com/saml/metadata",
        providerType: "SAML",
        redirectUri: "https://api.periscan.example/api/v1/auth/sso/callback",
        samlIdpCertificate: [
          "-----BEGIN CERTIFICATE-----",
          "MIICizCCAfQCCQCY8tKaMc0BMjANBgkqhkiG9w0BAQsFADCBiTELMAkGA1UEBhMC",
          "VVMxEzARBgNVBAgMCkNhbGlmb3JuaWExEjAQBgNVBAcMCVNhbiBKb3NlMRAwDgYD",
          "VQQKDAdQZXJpc2NhbjEcMBoGA1UECwwTU0FNTCBUZXN0IENlcnRpZmljYXRlMSEw",
          "HwYDVQQDDBhQZXJpc2NhbiBUZXN0IFNBTUwgSWRQ",
          "-----END CERTIFICATE-----"
        ].join("\n")
      })
    ).toMatchObject({
      providerType: "SAML",
      samlNameIdFormat:
        "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
      scopes: ["saml:nameid:emailAddress"]
    });

    expect(
      TenantSsoAuthorizationUrlInputSchema.parse({
        nonce: "nonce-value",
        state: "state-value"
      }).state
    ).toBe("state-value");

    expect(
      TenantSsoAuthorizationUrlSchema.parse({
        authorizationUrl:
          "https://idp.example.com/oauth2/authorize?response_type=code",
        nonce: "nonce-value",
        providerType: "OIDC",
        redirectUri: "https://app.periscan.example/auth/callback",
        scopes: ["openid", "email"],
        state: "state-value",
        tenantId
      }).providerType
    ).toBe("OIDC");

    expect(
      IntegrationSchema.parse({
        integrationId,
        tenantId,
        vendor: "GitHub",
        product: "GitHub Cloud",
        category: "Code",
        authType: "PAT",
        status: "Connected",
        healthStatus: "Healthy",
        lastSyncAt: now,
        permissionsSummary: {
          connectorKey: "github",
          dedicatedClient: true,
          executionReadiness: "ReadyForCredentials",
          executionReadinessReason:
            "Dedicated connector client is implemented.",
          implementationTier: "DedicatedClient",
          live: true,
          requiredPermissions: ["metadata:read"],
          repositories: "read"
        },
        config: {
          mode: "mock"
        },
        createdAt: now,
        updatedAt: now
      }).category
    ).toBe("Code");

    expect(() =>
      IntegrationSchema.parse({
        integrationId,
        tenantId,
        vendor: "GitHub",
        product: "GitHub Cloud",
        category: "Code",
        authType: "PAT",
        status: "Connected",
        healthStatus: "Healthy",
        permissionsSummary: {
          executionReadiness: "MaybeReady"
        },
        config: {
          mode: "mock"
        },
        createdAt: now,
        updatedAt: now
      })
    ).toThrow();

    expect(
      TrustSafetySummarySchema.parse({
        auditLogPath: "/api/v1/audit-events",
        connectedIntegrations: [
          {
            category: "Code",
            connectorKey: "github",
            controlObservationCapabilities: [],
            dataReadCategories: ["Repository"],
            dataSensitivity: "Moderate",
            dedicatedClient: true,
            disconnectPath: `/api/v1/integrations/${integrationId}`,
            executionReadiness: "ReadyForCredentials",
            executionReadinessReason:
              "Dedicated connector client is implemented.",
            healthStatus: "Healthy",
            implementationTier: "DedicatedClient",
            integrationId,
            lastSyncAt: now,
            live: true,
            permissionsUsed: ["Read repository metadata"],
            product: "GitHub Cloud",
            revokeInstructions:
              "Disconnect this integration in Periscan and revoke the credential in GitHub.",
            status: "Connected",
            supportedMissionTypes: ["ValidationSnapshot"],
            validationCapabilities: ["Repository metadata sync"],
            vendor: "GitHub",
            workflowCapabilities: []
          }
        ],
        dataGovernance: {
          availableRegions: [
            { id: "us-east-1", label: "United States · East" }
          ],
          baaReferenceUrl: null,
          baaStatus: "NotConfigured",
          dataCategoriesProcessed: [
            "Account identity (email, display name)",
            "Tenant membership and role assignments",
            "Authorized scope metadata and verification state",
            "Validation findings, attack paths, and remediation records",
            "Evidence metadata and redacted artifacts",
            "Integration configuration (credentials encrypted at rest when keys are set)",
            "Security audit events",
          ],
          dataSubjectRequestProcess:
            "Data subject access, export, and deletion requests are sales-assisted until a published DPA is linked.",
          dpaReferenceUrl: null,
          dpaStatus: "NotConfigured",
          encryptionAtRestDetails: "Deployment-managed.",
          encryptionAtRestStatus: "DeploymentManaged",
          routingStatus: "SingleRegion",
          selectedRegion: "us-east-1",
          selectedRegionStorageConfigured: true,
          subprocessors: [],
          subprocessorsHonesty:
            "Empty list means subprocessor disclosure is NotConfigured — not that Periscan has zero subprocessors.",
          subprocessorsStatus: "NotConfigured"

        },
        evidenceRetention: {
          artifactStorage: "S3-compatible object storage",
          notes:
            "Retention is managed by deployment policy until production lifecycle settings are configured.",
          redactionEnabled: true,
          retentionPeriodDays: null,
          retentionPolicyStatus: "DeploymentManaged",
          tenantScopedAccess: true
        },
        identityProvisioning: {
          planeStatus: "Partial",
          planeStatusDetail:
            "Partial IdP plane: SSO/MFA/role map ship; SCIM/JIT NotConfigured.",
          orderFormDoc: "docs/ENTERPRISE_IDENTITY_LIFECYCLE.md",
          residualDoc: "docs/ops/ENTERPRISE_TRUST_RESIDUAL_2026-07-31.md",
          advancedRbac: {
            availableRoles: [
              "Owner",
              "Admin",
              "SecurityEngineer",
              "Viewer",
              "MSSPOwner",
              "ClientAdmin"
            ],
            customRolesSupported: false,
            detail:
              "Periscan ships baseline multi-role RBAC. Custom roles are not shipped.",
            status: "BaselineRolesOnly"
          },
          jitProvisioning: {
            defaultRoleIfEnabled: "Viewer",
            detail: "JIT membership on first SSO is NotConfigured.",
            requiresDomainAllowlist: true,
            status: "NotConfigured"
          },
          scimInbound: {
            discoveryPath: "/api/v1/scim/v2/ServiceProviderConfig",
            detail:
              "Inbound SCIM 2.0 provisioning is NotConfigured and not shipped.",
            inventoryConnectorsNote:
              "CyberArk Identity SCIM is read-only inventory only.",
            status: "NotConfigured"
          }
        },
        enterpriseCommercial: {
          auditStreaming: {
            continuousStreamStatus: "NotConfigured",
            detail: "Pull-export only.",
            exportPath: "/api/v1/audit-events",
            maxExportEvents: 5000,
            status: "PullExportOnly",
            webhookCatalogNote: "Selected product events only."
          },
          multiRegionResidency: {
            detail: "Deployment-dependent multi-region.",
            status: "SingleRegionDeploymentDependent"
          },
          paymentSettlement: {
            detail: "Ledger without bank.",
            status: "NotConfigured"
          },
          publicSlaStatusPage: {
            detail: "No public status page.",
            status: "NotConfigured"
          },
          rfpDefaultScope: {
            detail: "Proof loop default RFP scope.",
            excludedLabsSurfaces: ["MCP Server"],
            includedSurfaces: ["Validation Snapshot"]
          },
          vendorSoc2Attestation: {
            detail: "Not vendor Type II.",
            status: "NotClaimed"
          }
        },
        marketPresence: buildMarketPresenceReadiness(),
        operationalReadiness: {
          controls: [
            {
              controlId: "database-backup-cadence",
              notes: "Backup cadence is deployment managed.",
              status: "DeploymentManaged",
              title: "Database backup cadence",
              value: null
            },
            {
              controlId: "log-aggregation",
              notes: "Logs are forwarded to the configured aggregator.",
              status: "Configured",
              title: "Log aggregation",
              value: "customer-siem"
            }
          ],
          environment: "production",
          notes: "Some controls are deployment managed.",
          overallStatus: "DeploymentManaged"
        },
        runnerSecurityModel: {
          gatewayHostnames: ["runner.periscan.cloud"],
          inboundFirewallRuleRequired: false,
          killSwitchAvailable: true,
          localAuditLogsRequired: true,
          outboundOnly: true,
          scopeEnforcementRequired: true,
          taskSigningRequired: true,
          transport: "LongPollHttps with signed task envelopes"
        },
        vendorAssurance: {
          customerEvidencePacksNote:
            "Product SOC 2 packs are customer evidence support only, not vendor Type II.",
          detail:
            "Periscan does not currently publish a vendor SOC 2 Type II report.",
          soc2TypeIiStatus: "None"
        },
        tenantId,
        validationSafetyPrinciples: [
          {
            description: "Only validated customer-authorized scope is tested.",
            principleId: "verified-scope",
            title: "Verified scope required"
          }
        ]
      }).connectedIntegrations[0]?.vendor
    ).toBe("GitHub");
    expect(
      TrustSafetySummarySchema.parse({
        auditLogPath: "/api/v1/audit-events",
        connectedIntegrations: [
          {
            category: "SecurityControl",
            connectorKey: "darktrace",
            controlObservationCapabilities: ["Control telemetry lookup"],
            dataReadCategories: ["ControlObservation"],
            dataSensitivity: "Moderate",
            dedicatedClient: false,
            disconnectPath: `/api/v1/integrations/${integrationId}`,
            executionReadiness: "ReadyForCredentials",
            executionReadinessReason:
              "Connectable Beta catalog manifest generated from a standardized connector spec.",
            healthStatus: "Healthy",
            implementationTier: "StandardizedCatalog",
            integrationId,
            lastSyncAt: null,
            live: false,
            permissionsUsed: ["Read detection metadata"],
            product: "Darktrace",
            revokeInstructions:
              "Disconnect this integration in Periscan and revoke the credential in Darktrace.",
            status: "Connected",
            supportedMissionTypes: ["ControlValidation"],
            validationCapabilities: ["Control evidence lookup"],
            vendor: "Darktrace",
            workflowCapabilities: []
          }
        ],
        dataGovernance: {
          availableRegions: [
            { id: "us-east-1", label: "United States · East" }
          ],
          baaReferenceUrl: null,
          baaStatus: "NotConfigured",
          dataCategoriesProcessed: [
            "Account identity (email, display name)",
            "Tenant membership and role assignments",
            "Authorized scope metadata and verification state",
            "Validation findings, attack paths, and remediation records",
            "Evidence metadata and redacted artifacts",
            "Integration configuration (credentials encrypted at rest when keys are set)",
            "Security audit events",
          ],
          dataSubjectRequestProcess:
            "Data subject access, export, and deletion requests are sales-assisted until a published DPA is linked.",
          dpaReferenceUrl: null,
          dpaStatus: "NotConfigured",
          encryptionAtRestDetails: "Deployment-managed.",
          encryptionAtRestStatus: "DeploymentManaged",
          routingStatus: "SingleRegion",
          selectedRegion: "us-east-1",
          selectedRegionStorageConfigured: true,
          subprocessors: [],
          subprocessorsHonesty:
            "Empty list means subprocessor disclosure is NotConfigured — not that Periscan has zero subprocessors.",
          subprocessorsStatus: "NotConfigured"

        },
        evidenceRetention: {
          artifactStorage: "S3-compatible object storage",
          notes:
            "Retention is managed by deployment policy until production lifecycle settings are configured.",
          redactionEnabled: true,
          retentionPeriodDays: null,
          retentionPolicyStatus: "DeploymentManaged",
          tenantScopedAccess: true
        },
        identityProvisioning: {
          planeStatus: "Partial",
          planeStatusDetail:
            "Partial IdP plane: SSO/MFA/role map ship; SCIM/JIT NotConfigured.",
          orderFormDoc: "docs/ENTERPRISE_IDENTITY_LIFECYCLE.md",
          residualDoc: "docs/ops/ENTERPRISE_TRUST_RESIDUAL_2026-07-31.md",
          advancedRbac: {
            availableRoles: [
              "Owner",
              "Admin",
              "SecurityEngineer",
              "Viewer",
              "MSSPOwner",
              "ClientAdmin"
            ],
            customRolesSupported: false,
            detail:
              "Periscan ships baseline multi-role RBAC. Custom roles are not shipped.",
            status: "BaselineRolesOnly"
          },
          jitProvisioning: {
            defaultRoleIfEnabled: "Viewer",
            detail: "JIT membership on first SSO is NotConfigured.",
            requiresDomainAllowlist: true,
            status: "NotConfigured"
          },
          scimInbound: {
            discoveryPath: "/api/v1/scim/v2/ServiceProviderConfig",
            detail:
              "Inbound SCIM 2.0 provisioning is NotConfigured and not shipped.",
            inventoryConnectorsNote:
              "CyberArk Identity SCIM is read-only inventory only.",
            status: "NotConfigured"
          }
        },
        enterpriseCommercial: {
          auditStreaming: {
            continuousStreamStatus: "NotConfigured",
            detail: "Pull-export only.",
            exportPath: "/api/v1/audit-events",
            maxExportEvents: 5000,
            status: "PullExportOnly",
            webhookCatalogNote: "Selected product events only."
          },
          multiRegionResidency: {
            detail: "Deployment-dependent multi-region.",
            status: "SingleRegionDeploymentDependent"
          },
          paymentSettlement: {
            detail: "Ledger without bank.",
            status: "NotConfigured"
          },
          publicSlaStatusPage: {
            detail: "No public status page.",
            status: "NotConfigured"
          },
          rfpDefaultScope: {
            detail: "Proof loop default RFP scope.",
            excludedLabsSurfaces: ["MCP Server"],
            includedSurfaces: ["Validation Snapshot"]
          },
          vendorSoc2Attestation: {
            detail: "Not vendor Type II.",
            status: "NotClaimed"
          }
        },
        marketPresence: buildMarketPresenceReadiness(),
        operationalReadiness: {
          controls: [
            {
              controlId: "database-backup-cadence",
              notes: "Backup cadence is deployment managed.",
              status: "DeploymentManaged",
              title: "Database backup cadence",
              value: null
            }
          ],
          environment: "production",
          notes: "Some controls are deployment managed.",
          overallStatus: "DeploymentManaged"
        },
        runnerSecurityModel: {
          gatewayHostnames: ["runner.periscan.cloud"],
          inboundFirewallRuleRequired: false,
          killSwitchAvailable: true,
          localAuditLogsRequired: true,
          outboundOnly: true,
          scopeEnforcementRequired: true,
          taskSigningRequired: true,
          transport: "LongPollHttps with signed task envelopes"
        },
        vendorAssurance: {
          customerEvidencePacksNote:
            "Product SOC 2 packs are customer evidence support only, not vendor Type II.",
          detail:
            "Periscan does not currently publish a vendor SOC 2 Type II report.",
          soc2TypeIiStatus: "None"
        },
        tenantId,
        validationSafetyPrinciples: [
          {
            description: "Only validated customer-authorized scope is tested.",
            principleId: "verified-scope",
            title: "Verified scope required"
          }
        ]
      }).connectedIntegrations[0]?.implementationTier
    ).toBe("StandardizedCatalog");
  });

  it("exposes honest inbound SCIM NotConfigured and baseline RBAC only", () => {
    const honesty = buildIdentityProvisioningHonesty();
    // PERISCAN-30: plane is Partial; SCIM/JIT stay literal NotConfigured.
    expect(honesty.planeStatus).toBe("Partial");
    expect(honesty.planeStatusDetail).toMatch(/Partial|NotConfigured/i);
    expect(honesty.orderFormDoc).toBe("docs/ENTERPRISE_IDENTITY_LIFECYCLE.md");
    expect(honesty.residualDoc).toBe(
      "docs/ops/ENTERPRISE_TRUST_RESIDUAL_2026-07-31.md"
    );
    expect(honesty.scimInbound.status).toBe("NotConfigured");
    expect(honesty.scimInbound.discoveryPath).toBe(
      "/api/v1/scim/v2/ServiceProviderConfig"
    );
    expect(honesty.advancedRbac.status).toBe("BaselineRolesOnly");
    expect(honesty.advancedRbac.customRolesSupported).toBe(false);
    expect(honesty.advancedRbac.availableRoles).toContain("Owner");
    expect(honesty.scimInbound.detail).toMatch(/not shipped/i);
    expect(honesty.scimInbound.detail).toMatch(/order form|501/i);
    // P17-14: JIT is invite-gated / NotConfigured (no fake create-on-first-SSO).
    expect(honesty.jitProvisioning.status).toBe("NotConfigured");
    expect(honesty.jitProvisioning.defaultRoleIfEnabled).toBe("Viewer");
    expect(honesty.jitProvisioning.requiresDomainAllowlist).toBe(true);
    expect(honesty.jitProvisioning.detail).toMatch(/NotConfigured|invite/i);
  });

  it("exposes enterprise commercial honesty without fake certifications", () => {
    const honesty = buildEnterpriseCommercialHonesty();
    expect(honesty.paymentSettlement.status).toBe("NotConfigured");
    expect(honesty.publicSlaStatusPage.status).toBe("NotConfigured");
    expect(honesty.auditStreaming.status).toBe("PullExportOnly");
    expect(honesty.auditStreaming.continuousStreamStatus).toBe("NotConfigured");
    expect(honesty.auditStreaming.maxExportEvents).toBe(5000);
    expect(honesty.auditStreaming.webhookCatalogNote).toMatch(/webhook/i);
    expect(honesty.vendorSoc2Attestation.status).toBe("NotClaimed");
    expect(honesty.multiRegionResidency.status).toBe(
      "SingleRegionDeploymentDependent"
    );
    expect(
      buildEnterpriseCommercialHonesty({ routingStatus: "RegionRouted" })
        .multiRegionResidency.status
    ).toBe("RegionRouted");
    expect(honesty.rfpDefaultScope.includedSurfaces.length).toBeGreaterThan(0);
    expect(honesty.rfpDefaultScope.excludedLabsSurfaces).toEqual(
      expect.arrayContaining([expect.stringMatching(/MCP/i)])
    );
  });

  it("exposes zero customer references as Wave/MQ market presence fail", () => {
    const readiness = buildMarketPresenceReadiness();
    expect(readiness.publicReferenceCount).toBe(0);
    expect(readiness.productionDesignPartnerReferenceCount).toBe(0);
    expect(readiness.signedReferencePermissionCount).toBe(0);
    expect(readiness.publicCaseStudyCount).toBe(0);
    expect(readiness.publicLogoCount).toBe(0);
    expect(readiness.marketPresenceEligible).toBe(false);
    expect(readiness.waveMarketPresenceGate).toBe("Fail");
    expect(readiness.mqMarketPresenceGate).toBe("Fail");
    expect(readiness.peerDiligenceGate).toBe("Fail");
    expect(readiness.banner).toBe(ZERO_CUSTOMER_REFERENCES_BANNER);
    expect(readiness.banner).toBe(
      "Zero customer references — Wave market presence not met"
    );
    expect(readiness.referencePack.packStatus).toBe("Empty");
    expect(readiness.referencePack.inventoryEmpty).toBe(true);
    expect(readiness.referencePack.sourceDoc).toBe(
      "docs/DESIGN_PARTNER/REFERENCE_PACK_CHECKLIST.md"
    );
    expect(readiness.referencePack.kpis.referenceableProductionTenants).toBe(0);
    expect(readiness.referencePack.kpis.signedReferenceCallPermissions).toBe(0);
    expect(readiness.referencePack.kpis.icpSessionsCompleted).toBe(0);
    expect(readiness.referencePack.kpis.icpSessionsTarget).toBe(5);
    expect(readiness.referencePack.gates.map((g) => g.gateId)).toEqual([
      "G0",
      "G1",
      "G2",
      "G3",
      "G4",
      "G5"
    ]);
    expect(
      readiness.referencePack.gates.find((g) => g.gateId === "G0")?.status
    ).toBe("RequiredNow");
    expect(
      readiness.referencePack.gates.filter((g) => g.status === "Open").length
    ).toBeGreaterThanOrEqual(4);
    expect(readiness.disclaimer).toMatch(/never grants Wave/i);

    const partnerHonesty = buildDesignPartnerMarketPresenceHonesty();
    expect(partnerHonesty.publicReferenceCount).toBe(0);
    expect(partnerHonesty.waveMarketPresenceGate).toBe("Fail");
    expect(partnerHonesty.mqMarketPresenceGate).toBe("Fail");
    expect(partnerHonesty.peerDiligenceGate).toBe("Fail");
    expect(partnerHonesty.referencePackStatus).toBe("Empty");
    expect(partnerHonesty.banner).toBe(ZERO_CUSTOMER_REFERENCES_BANNER);
    expect(partnerHonesty.marketPresenceEligible).toBe(false);

    // Even with invented high counts, Pass still requires ≥3 production + ≥3
    // signed permissions AND publicReferenceCount > 0.
    const stillFail = buildMarketPresenceReadiness({
      publicReferenceCount: 0,
      productionDesignPartnerReferenceCount: 5
    });
    expect(stillFail.waveMarketPresenceGate).toBe("Fail");

    const pass = buildMarketPresenceReadiness({
      publicReferenceCount: 3,
      productionDesignPartnerReferenceCount: 3,
      signedReferencePermissionCount: 3
    });
    expect(pass.waveMarketPresenceGate).toBe("Pass");
    expect(pass.mqMarketPresenceGate).toBe("Pass");
    expect(pass.peerDiligenceGate).toBe("Pass");
    expect(pass.marketPresenceEligible).toBe(true);
    expect(pass.referencePack.packStatus).toBe("Filled");
  });

  it("expands coarse API key scopes into fine-grained capabilities (P20-17)", () => {
    expect([...expandApiKeyCapabilities(["admin"])].sort()).toEqual(
      ["audit:read", "mission:run", "remediation:write", "webhook:admin"].sort()
    );
    expect([...expandApiKeyCapabilities(["write"])].sort()).toEqual(
      ["mission:run", "remediation:write"].sort()
    );
    expect([...expandApiKeyCapabilities(["read"])]).toEqual([]);
    expect([
      ...expandApiKeyCapabilities(["mission:run", "audit:read"])
    ].sort()).toEqual(["audit:read", "mission:run"].sort());
    for (const scope of [
      "read",
      "write",
      "admin",
      "mission:run",
      "remediation:write",
      "webhook:admin",
      "audit:read"
    ] as const) {
      expect(TenantApiKeyScopeSchema.parse(scope)).toBe(scope);
    }
  });

  it("parses validation workflow entities with policy and safety context", () => {
    expect(
      ScenarioSchema.parse({
        scenarioId: "12345678-1234-4234-8234-123456789012",
        tenantId,
        name: "Safe external validation",
        scenarioType: "ExposureValidation",
        description: "Fixture scenario",
        techniqueIds: [],
        expectedControlBehaviors: ["Alerted"],
        scopeId,
        policyDecisionId: null,
        safetyLevel: "PassiveReadOnly",
        evidenceIds: [evidenceId],
        createdAt: now,
        updatedAt: now
      }).safetyLevel
    ).toBe("PassiveReadOnly");

    expect(
      ValidationMissionSchema.parse({
        missionId,
        tenantId,
        missionType: "ValidationSnapshot",
        requestedBy: userId,
        scopeId,
        scopeIds: [scopeId],
        policyDecisionId: "12341234-1234-4234-8234-123412341234",
        policyProfile: "default",
        safetyLevel: "ActiveNonInvasive",
        status: "Queued",
        startedAt: null,
        completedAt: null,
        evidenceIds: [],
        createdAt: now,
        updatedAt: now
      }).missionType
    ).toBe("ValidationSnapshot");

    expect(
      ValidationRunSchema.parse({
        runId,
        tenantId,
        missionId,
        moduleId: "mock.external_exposure",
        runnerId: null,
        scopeId,
        policyDecisionId: "12341234-1234-4234-8234-123412341234",
        safetyLevel: "ActiveNonInvasive",
        target: {
          hostname: "example.com"
        },
        status: "Running",
        outcome: null,
        validationState: "Reachable",
        startedAt: now,
        completedAt: null,
        errorSummary: null,
        techniqueIds: ["T1595"],
        evidenceIds: [evidenceId],
        createdAt: now,
        updatedAt: now
      }).moduleId
    ).toBe("mock.external_exposure");

    expect(
      MissionStartResultSchema.parse({
        jobsQueued: 1,
        mission: {
          completedAt: null,
          createdAt: now,
          evidenceIds: [],
          missionId,
          missionType: "ExposureValidation",
          policyDecisionId: "12341234-1234-4234-8234-123412341234",
          policyProfile: "safe-baseline",
          requestedBy: userId,
          safetyLevel: "ActiveNonInvasive",
          scopeId,
          scopeIds: [scopeId],
          startedAt: null,
          status: "Queued",
          tenantId,
          updatedAt: now
        },
        runs: [
          {
            completedAt: null,
            createdAt: now,
            errorSummary: null,
            evidenceIds: [],
            missionId,
            moduleId: "nuclei.external_exposure_safe",
            outcome: null,
            policyDecisionId: "12341234-1234-4234-8234-123412341234",
            runId,
            runnerId: null,
            safetyLevel: "ActiveNonInvasive",
            scopeId,
            startedAt: null,
            status: "Queued",
            target: {
              hostname: "example.com",
              templateProfile: "safe-baseline"
            },
            tenantId,
            updatedAt: now,
            validationState: null
          }
        ]
      }).jobsQueued
    ).toBe(1);
  });

  it("parses graph, evidence, remediation, and reporting entities", () => {
    expect(
      AttackPathSchema.parse({
        pathId,
        tenantId,
        name: "Repo secret to cloud role",
        entryNodeId: pathNodeId,
        impactNodeId: "abababab-abab-4bab-8bab-abababababab",
        confidence: 0.92,
        impactScore: 87,
        validationState: "Validated",
        evidenceIds: [evidenceId],
        pathNodes: [
          {
            pathNodeId,
            pathId,
            tenantId,
            entityType: "Exposure",
            entityId: assetId,
            label: "Repository secret",
            sequence: 0,
            evidenceIds: [evidenceId],
            createdAt: now,
            updatedAt: now
          }
        ],
        pathEdges: [
          {
            pathEdgeId,
            pathId,
            tenantId,
            sourceNodeId: pathNodeId,
            targetNodeId: "abababab-abab-4bab-8bab-abababababab",
            relationship: "LEADS_TO",
            rationale: "Fixture correlation",
            evidenceIds: [evidenceId],
            createdAt: now,
            updatedAt: now
          }
        ],
        pathBreakers: [
          {
            pathBreakerId,
            pathId,
            tenantId,
            title: "Rotate secret",
            description: "Invalidate the credential",
            priority: 1,
            relatedNodeId: pathNodeId,
            evidenceIds: [evidenceId],
            createdAt: now,
            updatedAt: now
          }
        ],
        createdAt: now,
        updatedAt: now
      }).pathBreakers
    ).toHaveLength(1);

    expect(
      PathEdgeValidationEligibilitySchema.options
    ).toEqual(
      expect.arrayContaining([
        "Eligible",
        "NeedsScope",
        "NeedsRunner",
        "NeedsIntegration",
        "NeedsApproval",
        "AlreadyMeasured",
        "NoSafeModule"
      ])
    );

    expect(
      AttackPathEdgePlanItemSchema.parse({
        pathEdgeId,
        sequence: 0,
        relationship: "CAN_ACCESS",
        evidenceBasis: "Heuristic",
        recommendedModuleIds: ["periscan.tcp_reachability"],
        safetyLevel: "ActiveNonInvasive",
        missionType: "ExposureValidation",
        requiredScopeTypes: ["Domain", "Subdomain"],
        requiresInternalRunner: false,
        prerequisites: ["Verified scope covering the exposed host"],
        missingTelemetry: [],
        eligibility: "Eligible"
      }).eligibility
    ).toBe("Eligible");

    expect(
      AttackPathValidationPlanSchema.parse({
        pathId,
        claimSummary: "Hypothesis path: 0/1 hops Measured with evidence",
        items: [
          {
            pathEdgeId,
            sequence: 0,
            relationship: "CAN_ACCESS",
            evidenceBasis: "Heuristic",
            recommendedModuleIds: ["periscan.tcp_reachability"],
            safetyLevel: "ActiveNonInvasive",
            missionType: "ExposureValidation",
            requiredScopeTypes: ["Domain"],
            requiresInternalRunner: false,
            prerequisites: [],
            missingTelemetry: [],
            eligibility: "Eligible"
          }
        ],
        overallStatus: "Ready"
      }).overallStatus
    ).toBe("Ready");

    const receiptId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    expect(
      PathEdgeReceiptSchema.parse({
        receiptId,
        tenantId,
        pathId,
        pathEdgeId,
        hopKey: `${assetId}|CAN_ACCESS|${pathNodeId}`,
        validationRunId: runId,
        missionId,
        policyDecisionId: null,
        moduleId: "periscan.tcp_reachability",
        outcome: "tcp_port_reachable",
        validationState: "Reachable",
        evidenceIds: [evidenceId],
        measuredAt: now,
        measurementMethod: "periscan.tcp_reachability",
        integrityHash: null,
        actor: userId
      }).hopKey
    ).toContain("CAN_ACCESS");

    // tenantId is optional on the API DTO
    expect(
      PathEdgeReceiptSchema.parse({
        receiptId,
        pathId,
        pathEdgeId,
        hopKey: "source|CAN_ACCESS|target",
        moduleId: "periscan.http_health_check",
        outcome: "http_healthy",
        validationState: "Validated",
        evidenceIds: [evidenceId],
        measuredAt: now,
        measurementMethod: "periscan.http_health_check"
      }).tenantId
    ).toBeUndefined();

    expect(
      AttackPathMeasurementStateSchema.parse({
        pathId,
        pathEvidenceBasis: "Heuristic",
        measuredEdgeCount: 0,
        totalEdgeCount: 1,
        measuredHopFraction: 0,
        fullyMeasured: false,
        claimSafeValidationState: "Discovered",
        edgeStates: [
          {
            pathEdgeId,
            hopKey: "source|CAN_ACCESS|target",
            evidenceBasis: "Heuristic",
            evidenceIds: [evidenceId],
            measurementMethod: null,
            latestReceiptId: null
          }
        ]
      }).fullyMeasured
    ).toBe(false);

    expect(
      ApplyPathEdgeReceiptInputSchema.parse({
        pathId,
        pathEdgeId,
        moduleId: "periscan.tcp_reachability",
        outcome: "tcp_port_reachable",
        validationState: "Reachable",
        evidenceIds: [evidenceId],
        measurementMethod: "periscan.tcp_reachability"
      }).evidenceIds
    ).toHaveLength(1);

    expect(() =>
      ApplyPathEdgeReceiptInputSchema.parse({
        pathId,
        pathEdgeId,
        moduleId: "periscan.tcp_reachability",
        outcome: "tcp_port_reachable",
        validationState: "Reachable",
        evidenceIds: [],
        measurementMethod: "periscan.tcp_reachability"
      })
    ).toThrow();

    expect(
      LaunchPathEdgeValidationInputSchema.parse({
        pathId,
        pathEdgeId,
        moduleId: "periscan.tcp_reachability",
        scopeId
      }).safetyLevel
    ).toBe("ActiveNonInvasive");

    expect(
      EvidenceArtifactSchema.parse({
        evidenceId,
        tenantId,
        artifactType: "NormalizedEvidence",
        storageUri: "s3://periscan-evidence/demo.json",
        sha256: "abc123",
        sensitivityLevel: "Moderate",
        redactionStatus: "Redacted",
        relatedEntityType: "ValidationRun",
        relatedEntityId: runId,
        createdAt: now,
        updatedAt: now
      }).artifactType
    ).toBe("NormalizedEvidence");

    expect(
      EvidenceChainVerificationReportSchema.parse({
        tenantId,
        valid: true,
        checked: 1,
        totalArtifacts: 1,
        chainedArtifacts: 1,
        legacyUnchainedArtifacts: 0,
        brokenAtSeq: null,
        reason: null,
        verifiedAt: now,
        method: {
          algorithm: "SHA-256",
          authority: "Periscan evidence service",
          description: "Tenant-scoped tamper-evident hash chain.",
          signaturePresent: false
        },
        links: [
          {
            evidenceId,
            chainSeq: "1",
            prevChainHash: null,
            chainHash: "chain-hash",
            status: "Verified",
            valid: true,
            reason: null
          }
        ]
      }).links[0]?.status
    ).toBe("Verified");

    expect(
      EvidenceArtifactVerificationSchema.parse({
        evidenceId,
        tenantId,
        status: "Verified",
        valid: true,
        verifiedAt: now,
        method: {
          algorithm: "SHA-256",
          authority: "Periscan evidence service",
          description: "Tenant-scoped tamper-evident hash chain.",
          signaturePresent: false
        },
        content: {
          commitment: "Ingest",
          computedSha256: "abc123",
          recordedSha256: "abc123",
          valid: true
        },
        chain: {
          evidenceId,
          chainSeq: "1",
          prevChainHash: null,
          chainHash: "chain-hash",
          status: "Verified",
          valid: true,
          reason: null
        },
        reason: null
      }).status
    ).toBe("Verified");

    expect(
      EvidencePackSchema.parse({
        evidencePackId: "12121212-1212-4212-8212-121212121212",
        tenantId,
        packType: "ValidationSnapshotReport",
        title: "Demo Snapshot",
        audience: "Security Team",
        redactionLevel: "Moderate",
        status: "Ready",
        storageUri: "s3://periscan-evidence/report.html",
        evidenceIds: [evidenceId],
        createdAt: now,
        updatedAt: now
      }).status
    ).toBe("Ready");

    expect(ReportExportFormatSchema.parse("pdf")).toBe("pdf");

    const finding = ValidatedFindingSchema.parse({
      createdAt: now,
      crossLinks: [
        {
          entityId: pathId,
          entityType: "AttackPath",
          label: "Related attack path",
          relationship: "validated_by"
        },
        {
          entityId: remediationId,
          entityType: "RemediationTask",
          label: "Routed remediation",
          relationship: "routed_to"
        }
      ],
      evidenceIds: [evidenceId],
      exploitability: "Exploitable",
      findingId: pathId,
      impact: "Repository credential can reach a production cloud asset.",
      missingSignalImpact: {
        confidenceAdjustment: -0.1,
        missingSignalCount: 1,
        missingSignalIds: [missingSignalId],
        missingSignalStatuses: ["RequiresIntegration"],
        recommendation:
          "Connect SIEM telemetry before claiming detection coverage.",
        summary: "One missing signal source reduces proof completeness."
      },
      pathProof: {
        blastRadiusSummary:
          "Production cloud role and attached workload are in scope.",
        chokePoints: ["Rotate repository secret", "Remove cloud role trust"],
        entryPoint: "GitHub repository secret",
        intermediateSteps: ["Cloud credential", "Production IAM role"],
        objective: "Production data access",
        objectiveState: "Reached"
      },
      priorityReason: {
        businessContext: "Production asset is business critical.",
        controlEffectiveness: "No blocking control evidence was observed.",
        exploitability: "The path is validated and exploitable.",
        pathContext: "The path crosses repository and cloud control planes.",
        summary:
          "Prioritized because evidence links a secret to production impact."
      },
      priorityScore: 92,
      relatedAssetIds: [assetId],
      relatedControlIds: [],
      relatedPathIds: [pathId],
      relatedRemediationIds: [remediationId],
      remediation: "Rotate the secret and remove downstream role access.",
      severity: "Critical",
      source: "AttackPath",
      sourceEntityId: pathId,
      sourceEntityType: "AttackPath",
      sourceMotion: "APT",
      status: "Routed",
      tenantId,
      title: "Repo secret to production cloud role",
      updatedAt: now,
      validationState: "Exploitable"
    });

    expect(finding.pathProof?.objectiveState).toBe("Reached");
    expect(finding.missingSignalImpact?.missingSignalIds).toContain(
      missingSignalId
    );
    // Slice 4 fingerprint fields are optional for backward compatibility.
    expect(finding.fingerprint).toBeUndefined();
    expect(finding.occurrenceCount).toBeUndefined();
    expect(finding.affectedAssetCount).toBeUndefined();

    const fingerprinted = ValidatedFindingSchema.parse({
      createdAt: now,
      crossLinks: [
        {
          entityId: pathId,
          entityType: "AttackPath",
          label: "Related attack path",
          relationship: "validated_by"
        }
      ],
      evidenceIds: [evidenceId],
      exploitability: "Exploitable",
      findingId: pathId,
      impact: "Repository credential can reach a production cloud asset.",
      priorityReason: {
        businessContext: "Production asset is business critical.",
        controlEffectiveness: "No blocking control evidence was observed.",
        exploitability: "The path is validated and exploitable.",
        pathContext: "The path crosses repository and cloud control planes.",
        summary:
          "Prioritized because evidence links a secret to production impact."
      },
      priorityScore: 92,
      relatedAssetIds: [assetId],
      relatedControlIds: [],
      relatedPathIds: [pathId],
      relatedRemediationIds: [remediationId],
      remediation: "Rotate the secret and remove downstream role access.",
      severity: "Critical",
      source: "AttackPath",
      sourceEntityId: pathId,
      sourceEntityType: "AttackPath",
      sourceMotion: "APT",
      status: "Routed",
      tenantId,
      title: "Repo secret to production cloud role",
      updatedAt: now,
      validationState: "Exploitable",
      fingerprint:
        "a1b2c3d4e5f6789012345678abcdef0123456789abcdef0123456789abcdef01",
      groupKey: "path:repo-secret-cloud-role:assets:55555555-5555-4555-8555-555555555555",
      rootCauseSummary:
        "Repository secret exposure on one asset family (repo-secret-cloud-role).",
      firstSeenAt: now,
      lastSeenAt: now,
      occurrenceCount: 3,
      affectedAssetCount: 1
    });
    expect(fingerprinted.fingerprint).toHaveLength(64);
    expect(fingerprinted.groupKey).toContain("repo-secret-cloud-role");
    expect(fingerprinted.rootCauseSummary).toMatch(/secret/i);
    expect(fingerprinted.firstSeenAt).toBe(now);
    expect(fingerprinted.lastSeenAt).toBe(now);
    expect(fingerprinted.occurrenceCount).toBe(3);
    expect(fingerprinted.affectedAssetCount).toBe(1);

    // PERISCAN-7 — optional owner/SLA projected from remediation (not required).
    const withOwnerSla = ValidatedFindingSchema.parse({
      ...fingerprinted,
      ownerDisplay: "Security engineering",
      slaDueAt: "2026-08-15T00:00:00.000Z",
      ownerId: "77777777-7777-4777-8777-777777777777"
    });
    expect(withOwnerSla.ownerDisplay).toBe("Security engineering");
    expect(withOwnerSla.slaDueAt).toBe("2026-08-15T00:00:00.000Z");
    expect(withOwnerSla.ownerId).toBe("77777777-7777-4777-8777-777777777777");

    expect(() =>
      ValidatedFindingSchema.parse({
        createdAt: now,
        crossLinks: [],
        evidenceIds: [evidenceId],
        exploitability: "Validated",
        findingId: pathId,
        impact: "x",
        priorityReason: {
          businessContext: "b",
          controlEffectiveness: "c",
          exploitability: "e",
          pathContext: "p",
          summary: "s"
        },
        priorityScore: 10,
        relatedAssetIds: [],
        relatedControlIds: [],
        relatedPathIds: [],
        relatedRemediationIds: [],
        remediation: "r",
        severity: "Low",
        source: "AttackPath",
        sourceEntityId: pathId,
        sourceEntityType: "AttackPath",
        sourceMotion: "APT",
        status: "New",
        tenantId,
        title: "t",
        updatedAt: now,
        validationState: "Validated",
        occurrenceCount: 0
      })
    ).toThrow();

    expect(
      ValidatedFindingFilterSchema.parse({
        assetId,
        exploitability: "Exploitable",
        severity: "Critical",
        sourceMotion: "APT",
        status: "Routed",
        validationState: "Validated"
      }).validationState
    ).toBe("Validated");
    expect(
      ValidatedFindingFilterSchema.parse({
        missionId: assetId
      }).missionId
    ).toBe(assetId);
    expect(ValidatedFindingFilterSchema.parse({}).missionId).toBeUndefined();
    expect(
      ValidatedFindingFilterSchema.safeParse({ missionId: "not-a-uuid" }).success
    ).toBe(false);
    expect(
      TransitionFindingInputSchema.safeParse({
        disposition: "AcceptedRisk",
        note: "Temporary exception"
      }).success
    ).toBe(false);
    expect(
      TransitionFindingInputSchema.safeParse({
        disposition: "FalsePositive"
      }).success
    ).toBe(false);
    expect(
      TransitionFindingInputSchema.parse({
        disposition: "FalsePositive",
        reasonCode: "ToolNoise"
      }).reasonCode
    ).toBe("ToolNoise");
    expect(formatFindingDispositionNote("Lab", "sandbox")).toBe(
      "[Lab] sandbox"
    );
    // P09-3 residual: RiskBand Fixed displays as Closed (risk), wire stays Fixed
    expect(formatRiskBandDisplayLabel("Fixed")).toBe("Closed (risk)");
    expect(formatRiskBandDisplayLabel("Critical")).toBe("Critical");
    expect(formatRiskBandDisplayLabel("Informational")).toBe("Informational");
    expect(
      TransitionFindingInputSchema.parse({
        disposition: "AcceptedRisk",
        expiresAt: "2026-08-01T00:00:00.000Z",
        ownerId: assetId
      }).ownerId
    ).toBe(assetId);
    expect(
      CreateRemediationInputSchema.parse({
        dueAt: "2026-08-15T00:00:00.000Z",
        owner: "Security engineering",
        pathId
      }).dueAt
    ).toBe("2026-08-15T00:00:00.000Z");
    expect(
      CreateRemediationInputSchema.parse({
        findingFingerprint:
          "a1b2c3d4e5f6789012345678abcdef0123456789abcdef0123456789abcdef01",
        pathId
      }).findingFingerprint
    ).toHaveLength(64);
    // P14-4: signal-only findings may start rem without a path.
    expect(
      CreateRemediationInputSchema.parse({
        findingFingerprint:
          "a1b2c3d4e5f6789012345678abcdef0123456789abcdef0123456789abcdef01",
        owner: "IT ops"
      }).pathId
    ).toBeUndefined();
    expect(
      CreateRemediationInputSchema.parse({
        evidenceIds: [assetId],
        findingFingerprint:
          "a1b2c3d4e5f6789012345678abcdef0123456789abcdef0123456789abcdef01"
      }).evidenceIds
    ).toEqual([assetId]);
    expect(() => CreateRemediationInputSchema.parse({ owner: "x" })).toThrow();

    expect(
      UsageMeterDefinitionSchema.parse({
        description: "Evidence retention period configured for the tenant.",
        label: "Evidence retention",
        meterName: "EvidenceRetention",
        unit: "days"
      }).meterName
    ).toBe("EvidenceRetention");

    expect(
      BillingUsageSchema.parse({
        billingAccountId: "acct-demo",
        meteringPeriodEnd: "2026-07-01T00:00:00.000Z",
        meteringPeriodStart: "2026-06-01T00:00:00.000Z",
        meters: [
          {
            description: "Evidence packs generated from normalized evidence.",
            label: "Evidence packs",
            measuredAt: now,
            meterName: "EvidencePacks",
            quantity: 2,
            unit: "packs"
          },
          {
            description: "Evidence retention period configured for the tenant.",
            label: "Evidence retention",
            measuredAt: now,
            meterName: "EvidenceRetention",
            quantity: 30,
            unit: "days"
          }
        ],
        tenantId
      }).meters[0]?.quantity
    ).toBe(2);

    expect(
      BillingPackageSchema.parse({
        apiAccess: "Included",
        audiences: ["Security team"],
        description: "Fast evidence-backed validation snapshot.",
        includedCapabilities: ["Validation Snapshot"],
        includedMeterNames: ["ValidationMissions", "EvidencePacks"],
        label: "Validation Snapshot",
        packageKey: "ValidationSnapshot",
        paymentProcessorStatus: "NotConfigured",
        publicPricingLanguage: "Pay for what you validate.",
        status: "Available",
        supportedOutcomes: ["Evidence-backed report"]
      }).paymentProcessorStatus
    ).toBe("NotConfigured");

    expect(
      BillingPackageSchema.parse({
        apiAccess: "Available",
        audiences: ["Network security teams"],
        description: "Hybrid runner entitlement with RunnerMinutes.",
        includedCapabilities: ["Private runner support"],
        includedMeterNames: ["RunnerMinutes", "ValidationRuns"],
        label: "Hybrid Runner",
        packageKey: "HybridRunner",
        paymentProcessorStatus: "NotConfigured",
        publicPricingLanguage: "Contact us for metered RunnerMinutes.",
        status: "ContactSales",
        supportedOutcomes: ["Place segment-scoped runners"]
      }).packageKey
    ).toBe("HybridRunner");

    expect(
      ExecutiveTrendSummarySchema.parse({
        generatedAt: now,
        honestyTrust: {
          claimsMeasuredPct: 50,
          claimsMeasuredCount: 1,
          claimsTotalCount: 2,
          fixedSurvivedRevalidationPct: 100,
          fixedSurvivedCount: 2,
          fixedAttemptedCount: 2,
          deniedNeverQueuedCount: 0,
          signatureVerificationRatePct: null,
          signatureVerifiedCount: 0,
          signatureCheckedCount: 0,
          compositionNote:
            "Trust metrics are derived only from measured claim labels, verification events, policy deny audit, and signature checks."
        },
        metrics: [
          {
            delta: -2,
            evidenceIds: [evidenceId],
            label: "Critical and high validated findings",
            metricId: "critical_high_findings",
            previousValue: 5,
            trendDirection: "Improved",
            unit: "findings",
            value: 3
          }
        ],
        proofDelivery: {
          evidencePacksReady: 2,
          latestReportCreatedAt: now,
          latestReportId: evidenceId,
          reportExports: 1
        },
        recommendations: ["Continue reducing open critical paths."],
        remediationVelocity: {
          averageVerificationHours: 24,
          closedWithoutEvidence: 0,
          fixedRemediations: 2,
          openRemediations: 1,
          readyForVerification: 1,
          reopenedRemediations: 0,
          totalRemediations: 4
        },
        tenantId
      }).metrics[0]?.trendDirection
    ).toBe("Improved");

    expect(
      TenantOperationalMetricsSchema.parse({
        connectorSyncs: {
          averageDurationMs: 115,
          failedSyncCount: 0,
          p95DurationMs: 120,
          recentSyncs: [
            {
              assetCount: 3,
              durationMs: 120,
              healthStatus: "Healthy",
              integrationId,
              product: "GitHub Cloud",
              signalCount: 5,
              status: "Succeeded",
              syncedAt: now,
              vendor: "GitHub"
            }
          ],
          totalSyncCount: 1
        },
        generatedAt: now,
        missionStartLatency: {
          averageDurationMs: 42,
          maxDurationMs: 42,
          p95DurationMs: 42,
          queuedMissionCount: 1,
          recentStarts: [
            {
              durationMs: 42,
              jobsQueued: 1,
              missionId,
              moduleCount: 1,
              startedAt: now
            }
          ],
          startedMissionCount: 1
        },
        policyDenials: {
          denialRate: 0.5,
          deniedDecisionCount: 1,
          recentDenials: [
            {
              code: "policy_denied",
              createdAt: now,
              missionId: null,
              policyDecisionId: null,
              rationale: "Unverified scope requires policy denial."
            }
          ],
          totalPolicyDecisionCount: 2
        },
        recommendations: ["Review recent policy denials."],
        tenantId,
        window: {
          since: "2026-05-25T00:00:00.000Z",
          until: now
        }
      }).policyDenials.denialRate
    ).toBe(0.5);

    expect(
      MSSPClientPortfolioSchema.parse({
        clients: [
          {
            branding: {
              createdAt: now,
              logoUrl: null,
              organizationName: "Client Security",
              primaryColor: "#0F766E",
              reportFooter: "Prepared for client review.",
              supportEmail: "security@example.com",
              tenantId,
              updatedAt: now,
              whiteLabelEnabled: true
            },
            coverage: {
              aiApplications: 1,
              connectedIntegrations: 2,
              controlSources: 1,
              healthyIntegrations: 1,
              missingProofInputs: 0,
              runners: 1,
              totalScopes: 2,
              unhealthyIntegrations: 1,
              verifiedScopes: 1
            },
            latestActivity: {
              latestEvidencePackAt: now,
              latestReportId: "19191919-1919-4919-8919-191919191919",
              latestSnapshotAt: now,
              latestSnapshotId: missionId,
              latestValidationRunAt: now
            },
            readinessStatus: "Attention",
            risk: {
              criticalPaths: 1,
              fixedPaths: 0,
              highPaths: 1,
              lowPaths: 0,
              mediumPaths: 0,
              openRemediations: 1,
              verificationPending: 1
            },
            tenant: {
              billingAccountId: "acct-demo",
              createdAt: now,
              dataRegion: "us-east-1",
              name: "Client Tenant",
              parentTenantId: "20202020-2020-4020-8020-202020202020",
              tenantId,
              type: "Client",
              updatedAt: now
            },
            usage: {
              billingAccountId: "acct-demo",
              meteringPeriodEnd: "2026-07-01T00:00:00.000Z",
              meteringPeriodStart: "2026-06-01T00:00:00.000Z",
              meters: [
                {
                  description:
                    "Evidence packs generated from normalized evidence.",
                  label: "Evidence packs",
                  measuredAt: now,
                  meterName: "EvidencePacks",
                  quantity: 2,
                  unit: "packs"
                }
              ],
              tenantId
            }
          }
        ],
        generatedAt: now,
        parentTenant: {
          billingAccountId: "acct-demo",
          createdAt: now,
          dataRegion: "us-east-1",
          name: "MSSP Tenant",
          parentTenantId: null,
          tenantId: "20202020-2020-4020-8020-202020202020",
          type: "MSSP",
          updatedAt: now
        },
        totals: {
          activeClients: 0,
          attentionClients: 1,
          clientTenants: 1,
          evidencePacks: 2,
          missingProofInputs: 0,
          needsIntegrationClients: 0,
          needsScopeClients: 0,
          needsValidationClients: 0,
          openRemediations: 1,
          validationRuns: 1,
          verifiedScopes: 1,
          shortTermAssessments: 0
        }
      }).clients[0]?.readinessStatus
    ).toBe("Attention");

    expect(
      PolicyDecisionSchema.parse({
        policyDecisionId: "17171717-1717-4717-8717-171717171717",
        tenantId,
        userId,
        scopeId,
        missionType: "ValidationSnapshot",
        safetyLevel: "PassiveReadOnly",
        target: {
          hostname: "example.com"
        },
        executionEnvironment: "ExternalPoA",
        requestedAction: {
          destructive: false,
          realDataExfiltration: false,
          persistence: false,
          credentialTheft: false,
          uncontrolledExploitChaining: false,
          requiresInternalRunner: false,
          requiresTimeWindow: false
        },
        outcome: "Allowed",
        approvalState: "NotRequired",
        rationale: "Verified scope and passive safety level.",
        approvedAt: null,
        approvedBy: null,
        expiresAt: null,
        createdAt: now,
        updatedAt: now
      }).outcome
    ).toBe("Allowed");
  });

  it("parses threat center foundation entities and missing-signal states", () => {
    expect(
      ImportThreatAdvisoryInputSchema.parse({
        cveIds: ["cve-2026-12345"],
        iocValues: ["manual.example.net"],
        publishedAt: "2026-06-01T12:00:00.000Z",
        rawContent:
          "Manual advisory references CVE-2026-12345, T1059.001, and https://evil.example.com/path.",
        sourceName: "Manual advisory desk",
        sourceUrl: "https://advisories.example.com/2026-12345",
        summary: "Manual advisory import request.",
        techniqueIds: ["t1059.001"],
        title: "Manual advisory"
      }).rawContent
    ).toContain("Manual advisory references");

    expect(ValidationStateSchema.parse("RequiresIntegration")).toBe(
      "RequiresIntegration"
    );
    expect(ValidationStateSchema.parse("NeedsInternalRunner")).toBe(
      "NeedsInternalRunner"
    );
    expect(ValidationStateSchema.parse("RequiresVerifiedScope")).toBe(
      "RequiresVerifiedScope"
    );
    expect(ValidationStateSchema.parse("RequiresInternalRunner")).toBe(
      "RequiresInternalRunner"
    );

    expect(
      ThreatAdvisorySchema.parse({
        createdAt: now,
        cveIds: ["CVE-2026-0001"],
        evidenceIds: [evidenceId],
        iocValues: ["203.0.113.10"],
        publishedAt: now,
        rawEvidenceId: evidenceId,
        receivedAt: now,
        sourceName: "Manual import",
        sourceUrl: "https://advisories.example.com/2026-0001",
        status: "Imported",
        summary:
          "Manual advisory import for repository and cloud validation planning.",
        techniqueIds: ["T1087"],
        tenantId,
        threatAdvisoryId,
        title: "Example advisory",
        updatedAt: now
      }).status
    ).toBe("Imported");

    expect(
      ThreatPackageSchema.parse({
        createdAt: now,
        cveIds: ["CVE-2026-0001"],
        evidenceIds: [evidenceId],
        iocValues: ["203.0.113.10"],
        summary: "Threat package extracted from manual advisory import.",
        techniqueIds: ["T1087"],
        tenantId,
        threatAdvisoryId,
        threatPackageId,
        title: "Example advisory package",
        updatedAt: now
      }).techniqueIds
    ).toContain("T1087");

    expect(
      MissingSignalSchema.parse({
        createdAt: now,
        missingSignalId,
        reason: "No SIEM integration is connected for detection verification.",
        relatedEntityId: threatAdvisoryId,
        relatedEntityType: "ThreatAdvisory",
        requiredIntegrationCategory: "SecurityControl",
        signalType: "SIEMTelemetry",
        status: "RequiresIntegration",
        tenantId,
        updatedAt: now
      }).status
    ).toBe("RequiresIntegration");

    expect(
      AdvisoryImpactAssessmentSchema.parse({
        advisoryImpactAssessmentId: impactAssessmentId,
        affectedAssetIds: [assetId],
        affectedFindingIds: [pathId],
        confidence: 0.62,
        createdAt: now,
        evidenceIds: [evidenceId],
        missingSignalIds: [missingSignalId],
        summary:
          "Impact is partial because SIEM telemetry and internal runner signals are missing.",
        tenantId,
        threatAdvisoryId,
        updatedAt: now
      }).missingSignalIds
    ).toContain(missingSignalId);

    const planItem = {
      createdAt: now,
      evidenceIds: [evidenceId],
      missingSignalIds: [missingSignalId],
      missionType: "ExposureValidation",
      rationale:
        "Validate affected external exposure only after verified scope.",
      requiredIntegrationCategories: ["SecurityControl"],
      requiredScopeTypes: ["Domain"],
      safetyLevel: "ActiveNonInvasive",
      status: "RequiresIntegration",
      tenantId,
      threatValidationPlanId: threatPlanId,
      threatValidationPlanItemId: threatPlanItemId,
      title: "Validate affected external exposure",
      updatedAt: now
    } as const;

    const validationPlan = ThreatValidationPlanSchema.parse({
      createdAt: now,
      evidenceIds: [evidenceId],
      planItems: [planItem],
      status: "RequiresIntegration",
      summary: "Plan is blocked until missing telemetry is configured.",
      tenantId,
      threatAdvisoryId,
      threatValidationPlanId: threatPlanId,
      updatedAt: now
    });

    expect(validationPlan.planItems).toHaveLength(1);

    const readinessReport = AdvisoryReadinessReportSchema.parse({
      advisoryReadinessReportId: advisoryReportId,
      createdAt: now,
      evidenceIds: [evidenceId],
      evidencePackId: null,
      missingSignalIds: [missingSignalId],
      readinessStatus: "MissingSignals",
      summary: "Readiness cannot be proven until SIEM telemetry is configured.",
      tenantId,
      threatAdvisoryId,
      updatedAt: now
    });

    expect(readinessReport.readinessStatus).toBe("MissingSignals");

    expect(
      ThreatAdvisoryDetailSchema.parse({
        advisory: {
          createdAt: now,
          cveIds: ["CVE-2026-0001"],
          evidenceIds: [evidenceId],
          iocValues: ["203.0.113.10"],
          publishedAt: now,
          rawEvidenceId: evidenceId,
          receivedAt: now,
          sourceName: "Manual import",
          sourceUrl: "https://advisories.example.com/2026-0001",
          status: "Imported",
          summary:
            "Manual advisory import for repository and cloud validation planning.",
          techniqueIds: ["T1087"],
          tenantId,
          threatAdvisoryId,
          title: "Example advisory",
          updatedAt: now
        },
        impactAssessment: {
          advisoryImpactAssessmentId: impactAssessmentId,
          affectedAssetIds: [assetId],
          affectedFindingIds: [pathId],
          confidence: 0.62,
          createdAt: now,
          evidenceIds: [evidenceId],
          missingSignalIds: [missingSignalId],
          summary:
            "Impact is partial because SIEM telemetry and internal runner signals are missing.",
          tenantId,
          threatAdvisoryId,
          updatedAt: now
        },
        missingSignals: [
          {
            createdAt: now,
            missingSignalId,
            reason:
              "No SIEM integration is connected for detection verification.",
            relatedEntityId: threatAdvisoryId,
            relatedEntityType: "ThreatAdvisory",
            requiredIntegrationCategory: "SecurityControl",
            signalType: "SIEMTelemetry",
            status: "RequiresIntegration",
            tenantId,
            updatedAt: now
          }
        ],
        package: {
          createdAt: now,
          cveIds: ["CVE-2026-0001"],
          evidenceIds: [evidenceId],
          iocValues: ["203.0.113.10"],
          summary: "Threat package extracted from manual advisory import.",
          techniqueIds: ["T1087"],
          tenantId,
          threatAdvisoryId,
          threatPackageId,
          title: "Example advisory package",
          updatedAt: now
        },
        readinessReport,
        rawEvidenceId: evidenceId,
        validationPlan
      }).rawEvidenceId
    ).toBe(evidenceId);
  });

  it("parses audit event filters for tenant-facing review flows", () => {
    expect(
      AuditEventFilterSchema.parse({
        action: "integration.connected",
        from: now,
        limit: 25,
        to: now,
        userId
      }).limit
    ).toBe(25);
  });

  it("parses the remaining core entities used by later slices", () => {
    expect(
      ControlSourceSchema.parse({
        controlSourceId: "13131313-1313-4313-8313-131313131313",
        tenantId,
        controlType: "SIEM",
        provider: "Splunk",
        integrationId,
        expectedBehaviors: ["Detected", "Logged"],
        telemetryStatus: "Healthy",
        lastValidatedAt: now,
        healthStatus: "Healthy",
        createdAt: now,
        updatedAt: now
      }).controlType
    ).toBe("SIEM");

    expect(
      ControlRuleCoverageSummarySchema.parse({
        blockedTechniques: 0,
        controlSourceId: "13131313-1313-4313-8313-131313131313",
        coveredTechniques: 1,
        generatedAt: now,
        items: [
          {
            confidence: 0.78,
            controlSourceId: "13131313-1313-4313-8313-131313131313",
            evidenceIds: [evidenceId],
            expectedBehaviors: ["Logged", "Alerted", "Routed"],
            lastObservedAt: now,
            observedBehaviors: ["Logged"],
            recommendation:
              "Tune alert routing so logged evidence creates an actionable alert.",
            scenarioId: "control.logging-observer.dry-run",
            signalIds: [runId],
            status: "LoggedOnly",
            tacticName: "Command and Control",
            techniqueId: "T1071",
            techniqueName: "Application Layer Protocol",
            title: "Logging Observer Dry Run"
          }
        ],
        loggedOnlyTechniques: 1,
        missedTechniques: 0,
        needsTuningTechniques: 0,
        noEvidenceTechniques: 0,
        notTestedTechniques: 0,
        recommendations: [
          "Tune alert routing so logged evidence creates an actionable alert."
        ],
        staleTechniques: 0,
        tenantId,
        totalTechniques: 1
      }).items[0]!.status
    ).toBe("LoggedOnly");

    expect(
      AIApplicationSchema.parse({
        aiAppId,
        tenantId,
        name: "Support Copilot",
        appType: "Agent",
        endpointUrl: "https://ai.example.com",
        authMethod: "Bearer",
        ragEnabled: true,
        toolsEnabled: true,
        dataSourcesDescription: "Knowledge base",
        guardrailsDescription: "PII redaction",
        owner: "AI Team",
        scopeId,
        testAccountNotes: "Use approved synthetic tenant test account only.",
        lastValidatedAt: now,
        createdAt: now,
        updatedAt: now
      }).appType
    ).toBe("Agent");

    expect(
      ExposureSchema.parse({
        exposureId: "14141414-1414-4414-8414-141414141414",
        tenantId,
        assetId,
        exposureType: "SecretExposure",
        source: "gitleaks",
        severity: "High",
        confidence: 0.88,
        validationState: "Validated",
        firstSeenAt: now,
        lastSeenAt: now,
        status: "Open",
        evidenceIds: [evidenceId],
        createdAt: now,
        updatedAt: now
      }).severity
    ).toBe("High");

    expect(
      SignalEnvelopeSchema.parse({
        signalId: "15151515-1515-4515-8515-151515151515",
        tenantId,
        sourceIntegrationId: integrationId,
        sourceType: "connector",
        sourceVendor: "GitHub",
        signalCategory: "Repository",
        signalSubcategory: "SecretScanCandidate",
        timestampObserved: now,
        timestampIngested: now,
        confidence: 0.7,
        freshness: "Fresh",
        sensitivityLevel: "Moderate",
        relatedAssetIds: [assetId],
        relatedIdentityIds: [],
        relatedControlIds: [],
        relatedPathIds: [pathId],
        relatedEvidenceIds: [evidenceId],
        techniqueIds: ["T1595"],
        rawPayloadPointer: "s3://periscan-evidence/raw/github.json",
        redactionStatus: "Redacted",
        evidenceIds: [evidenceId],
        createdAt: now,
        updatedAt: now
      }).signalCategory
    ).toBe("Repository");

    expect(
      GraphNodeSchema.parse({
        graphNodeId,
        tenantId,
        nodeType: "Signal.Repository",
        nodeKey: "signal:15151515-1515-4515-8515-151515151515",
        relatedEntityType: "ValidationRun",
        relatedEntityId: runId,
        label: "Repository secret candidate",
        properties: {
          signalCategory: "Repository"
        },
        evidenceIds: [evidenceId],
        createdAt: now,
        updatedAt: now
      }).nodeType
    ).toBe("Signal.Repository");

    expect(
      GraphNodeSchema.parse({
        graphNodeId,
        tenantId,
        nodeType: "ValidationRun",
        nodeKey: "run:15151515-1515-4515-8515-151515151515",
        relatedEntityType: "ValidationRun",
        relatedEntityId: runId,
        label: "Validation run",
        properties: {},
        evidenceIds: [evidenceId],
        createdAt: now,
        updatedAt: now
      }).nodeType
    ).toBe("ValidationRun");

    expect(
      AttackTechniqueSchema.parse({
        description: "Safe example mapping for scanning activity.",
        safeExample: true,
        tacticId: "TA0043",
        tacticName: "Reconnaissance",
        techniqueId: "T1595",
        techniqueName: "Active Scanning"
      }).techniqueId
    ).toBe("T1595");

    expect(
      GraphEdgeSchema.parse({
        graphEdgeId,
        tenantId,
        sourceNodeId: graphNodeId,
        targetNodeId: pathNodeId,
        relationship: "RELATES_TO",
        rationale: "Fixture graph relation",
        properties: {
          source: "test"
        },
        evidenceIds: [evidenceId],
        createdAt: now,
        updatedAt: now
      }).relationship
    ).toBe("RELATES_TO");

    expect(
      VerificationEventSchema.parse({
        verificationId,
        tenantId,
        remediationId,
        validationRunId: runId,
        previousState: "Validated",
        newState: "Fixed",
        outcome: "Fixed",
        evidenceIds: [evidenceId],
        verifiedAt: now,
        createdAt: now,
        updatedAt: now
      }).outcome
    ).toBe("Fixed");

    expect(
      RiskScoreInputSchema.parse({
        businessCriticality: "Critical",
        confidence: 0.94,
        controlResponse: "Missed",
        impactScore: 91,
        internetExposed: true,
        privilegedPath: true,
        validationState: "Validated",
        verificationStatus: null
      }).controlResponse
    ).toBe("Missed");

    expect(
      AssetValuationInputSchema.parse({
        assumptionNotes:
          "Includes outage response and lost customer transactions.",
        businessServiceName: "Payments",
        confidence: "Medium",
        lossEventFrequencyPerYear: {
          minimum: 0.1,
          mostLikely: 0.5,
          maximum: 1
        },
        lossMagnitudeUsd: {
          minimum: 50_000,
          mostLikely: 250_000,
          maximum: 1_000_000
        }
      }).currency
    ).toBe("USD");

    expect(() =>
      AssetValuationInputSchema.parse({
        assumptionNotes: "Invalid reversed range.",
        businessServiceName: "Payments",
        confidence: "Low",
        lossEventFrequencyPerYear: {
          minimum: 2,
          mostLikely: 1,
          maximum: 0.5
        },
        lossMagnitudeUsd: {
          minimum: 1,
          mostLikely: 2,
          maximum: 3
        }
      })
    ).toThrow();

    expect(
      RiskScoreSchema.parse({
        band: "Critical",
        factors: [
          {
            key: "validation-state",
            label: "Validation state",
            value: "Validated",
            contribution: 18,
            rationale: "The path has been validated by evidence."
          }
        ],
        score: 91,
        summary:
          "Validated production path with missed controls and high impact."
      }).band
    ).toBe("Critical");

    expect(
      AttackPathAssessmentSchema.parse({
        attackPath: {
          pathId,
          tenantId,
          name: "Repo secret to cloud role",
          entryNodeId: pathNodeId,
          impactNodeId: "abababab-abab-4bab-8bab-abababababab",
          confidence: 0.92,
          impactScore: 87,
          validationState: "Validated",
          evidenceIds: [evidenceId],
          pathNodes: [
            {
              pathNodeId,
              pathId,
              tenantId,
              entityType: "Exposure",
              entityId: assetId,
              label: "Repository secret",
              sequence: 0,
              evidenceIds: [evidenceId],
              createdAt: now,
              updatedAt: now
            }
          ],
          pathEdges: [],
          pathBreakers: [],
          createdAt: now,
          updatedAt: now
        },
        risk: {
          band: "High",
          factors: [
            {
              key: "impact-score",
              label: "Impact score",
              value: "87",
              contribution: 30,
              rationale: "The path could affect a high-value production target."
            }
          ],
          score: 78,
          summary: "Validated high-impact path that should be remediated."
        }
      }).risk.score
    ).toBe(78);

    expect(
      ValidationSnapshotSchema.parse({
        snapshotId: "17171717-1717-4717-8717-171717171717",
        tenantId,
        evidencePack: {
          evidencePackId: "18181818-1818-4818-8818-181818181818",
          tenantId,
          packType: "ValidationSnapshotReport",
          title: "Validation Snapshot",
          audience: "Security Team",
          redactionLevel: "Moderate",
          status: "Ready",
          storageUri: "file:///tmp/snapshot.html",
          evidenceIds: [evidenceId],
          createdAt: now,
          updatedAt: now
        },
        createdAt: now,
        updatedAt: now,
        missionId,
        scopeIds: [scopeId],
        integrationIds: [integrationId],
        summary: {
          headline: "Validated repo secret path",
          overview:
            "Periscan found evidence-backed attack paths and remediation priorities.",
          topRiskBand: "Critical"
        },
        metrics: {
          aiRiskCount: 0,
          controlObservationCount: 0,
          correlatedThreatAdvisoryCount: 0,
          highRiskPathCount: 1,
          integrationCount: 2,
          openThreatAdvisoryCount: 0,
          remediationCount: 1,
          staleVerificationCount: 0,
          topPathCount: 1,
          verifiedScopeCount: 1
        },
        topAttackPaths: [
          {
            attackPath: {
              pathId,
              tenantId,
              name: "Repo secret to cloud role",
              entryNodeId: pathNodeId,
              impactNodeId: "abababab-abab-4bab-8bab-abababababab",
              confidence: 0.92,
              impactScore: 87,
              validationState: "Validated",
              evidenceIds: [evidenceId],
              pathNodes: [],
              pathEdges: [],
              pathBreakers: [],
              createdAt: now,
              updatedAt: now
            },
            risk: {
              band: "High",
              factors: [],
              score: 78,
              summary: "Validated high-impact path."
            }
          }
        ],
        controlObservations: [],
        aiAppRisks: [],
        remediationPriorities: [
          {
            remediationId,
            tenantId,
            relatedPathId: pathId,
            relatedExposureId: null,
            owner: "Security engineering",
            recommendedAction: "Rotate the secret",
            technicalSteps: ["Rotate", "Revoke", "Retest"],
            verificationMethod: "Rerun validation",
            ticketSystem: null,
            ticketId: null,
            status: "Open",
            verificationRequired: true,
            evidenceIds: [evidenceId],
            createdAt: now,
            updatedAt: now
          }
        ],
        verificationPlan: ["Rerun validation"],
        evidenceIds: [evidenceId]
      }).summary.topRiskBand
    ).toBe("Critical");

    expect(
      DesignPartnerWorkspaceSchema.parse({
        analystEvidence: {
          modeEnabled: true,
          measuredAt: now,
          checklist: {
            onboardingComplete: 1,
            onboardingTotal: 1,
            integrationComplete: 1,
            integrationTotal: 1
          },
          proofLoop: {
            maturity: "Measured",
            completedMilestones: 6,
            totalMilestones: 9,
            measuredResultAt: now,
            revalidatedAt: null,
            proofDeliveredAt: null
          },
          counts: {
            verifiedScopes: 1,
            connectedIntegrations: 1,
            completedRunsWithEvidence: 1,
            verificationEvents: 0,
            exportedOrSharedPacks: 0
          },
          honesty: {
            marketPresenceEligible: false,
            publicReferenceCount: 0,
            waveMarketPresenceGate: "Fail",
            mqMarketPresenceGate: "Fail",
            peerDiligenceGate: "Fail",
            referencePackStatus: "Empty",
            banner: "Zero customer references — Wave market presence not met",
            sessionLearningEvidenceInProduct: "ChecklistOnly",
            disclaimer:
              "Tenant checklist and proof-loop counts are not customer references."
          }
        },
        integrationChecklist: [
          {
            description: "Connect GitHub for repository evidence.",
            itemId: "github",
            label: "GitHub connected",
            status: "Complete"
          }
        ],
        latestAnalystNote: {
          authorLabel: "Periscan Analyst",
          body: "Preview the customer report before sending.",
          createdAt: now,
          reportId: "18181818-1818-4818-8818-181818181818",
          tenantId,
          title: "Delivery note",
          updatedAt: now
        },
        onboardingChecklist: [
          {
            description: "Verify the customer-authorized scope.",
            itemId: "verified-scope",
            label: "Verified scope",
            status: "Complete"
          }
        ],
        sessionLearning: {
          message:
            "Need 5 sessions before Wave. Internal notes only; public references remain zero until written consent outside this product.",
          sessionCount: 0,
          sessions: [],
          sessionsGateMet: false,
          sessionsRequired: 5,
          sourceDoc: "docs/DESIGN_PARTNER/SESSION_LEARNING_LOG.md",
          waveMarketPresenceReady: false
        },
        settings: {
          createdAt: now,
          enabled: true,
          tenantId,
          updatedAt: now
        },
        snapshotRequest: {
          latestReportId: "18181818-1818-4818-8818-181818181818",
          latestSnapshotId: "17171717-1717-4717-8717-171717171717",
          previewPath: "/snapshots/17171717-1717-4717-8717-171717171717",
          requestedAt: now,
          status: "Ready"
        },
        tenantId
      }).sessionLearning.sessionCount
    ).toBe(0);

    expect(
      AuditEventSchema.parse({
        auditEventId: "16161616-1616-4616-8616-161616161616",
        tenantId,
        userId,
        action: "mission.created",
        actorType: "User",
        entityType: "ValidationMission",
        entityId: missionId,
        metadata: {
          missionType: "ValidationSnapshot"
        },
        createdAt: now
      }).action
    ).toBe("mission.created");

    expect(
      JobSchema.parse({
        jobId,
        tenantId,
        missionId,
        validationRunId: runId,
        queueName: "validation-missions",
        status: "Queued",
        attempts: 0,
        payload: {
          runId
        },
        dedupeKey: null,
        availableAt: now,
        startedAt: null,
        completedAt: null,
        errorMessage: null,
        createdAt: now,
        updatedAt: now
      }).status
    ).toBe("Queued");

    expect(
      ValidationJobPayloadSchema.parse({
        jobId,
        missionId,
        runId,
        tenantId
      }).runId
    ).toBe(runId);

    // requestId is optional (omitted for scheduler/internal jobs) and carried
    // through for request-originated jobs so worker logs can be correlated.
    expect(
      ValidationJobPayloadSchema.parse({
        jobId,
        missionId,
        runId,
        tenantId
      }).requestId ?? null
    ).toBeNull();
    expect(
      ValidationJobPayloadSchema.parse({
        jobId,
        missionId,
        requestId: "req-abc-123",
        runId,
        tenantId
      }).requestId
    ).toBe("req-abc-123");

    expect(
      MissionScheduleSchema.parse({
        config: {
          audience: "Security Team",
          maxTopItems: 5
        },
        createdAt: now,
        createdBy: userId,
        frequency: "Daily",
        lastDiff: null,
        lastMissionId: null,
        lastRunAt: null,
        lastSnapshotId: null,
        missionType: "ValidationSnapshot",
        nextRunAt: "2026-06-02T00:00:00.000Z",
        scheduleId,
        scopeIds: [scopeId],
        status: "Active",
        tenantId,
        updatedAt: now
      }).status
    ).toBe("Active");

    expect(
      ScheduleDiffSchema.parse({
        addedPathIds: [pathId],
        currentSnapshotId: scheduleId,
        previousSnapshotId: null,
        removedPathIds: [],
        reopenedPathIds: [],
        riskScoreDelta: 78,
        status: "NoPreviousRun",
        summary: "First run."
      }).status
    ).toBe("NoPreviousRun");

    expect(
      SignalTriggerRuleSchema.parse({
        description:
          "Triggers validation planning when dependency advisory signals are present.",
        enabled: true,
        name: "CVE advisory trigger",
        recommendedMissionType: "ExposureValidation",
        requiredIntegrationCategories: ["Code"],
        requiredScopeTypes: ["Repository"],
        safetyLevel: "PassiveReadOnly",
        signalCategories: ["Exposure"],
        signalSubcategories: ["DependencyAdvisory"],
        triggerId: "trigger.cve",
        triggerType: "CVE"
      }).triggerType
    ).toBe("CVE");

    expect(
      SignalTriggerEvaluationResponseSchema.parse({
        activity: [
          {
            activityId: "trigger.cve:signal-1",
            auditEventIds: [],
            createdAt: now,
            evidenceIds: [evidenceId],
            recommendedMissionType: "ExposureValidation",
            signalIds: [runId],
            status: "NeedsApproval",
            summary:
              "Dependency advisory signals are present and require policy approval.",
            title: "CVE advisory trigger",
            triggerId: "trigger.cve",
            triggerType: "CVE"
          }
        ],
        evaluatedAt: now,
        evaluations: [
          {
            evidenceIds: [evidenceId],
            matchedAuditEventIds: [],
            matchedSignalIds: [runId],
            missingPrerequisites: [],
            reason:
              "Dependency advisory signals are present and require policy approval.",
            recommendedMissionType: "ExposureValidation",
            recommendedModuleIds: ["osv.repo_dependency_scan"],
            requiresApproval: true,
            status: "NeedsApproval",
            triggerId: "trigger.cve",
            triggerType: "CVE"
          }
        ],
        rules: [],
        summary: {
          needsApproval: 1,
          notConfigured: 0,
          requiresIntegration: 0,
          requiresInternalRunner: 0,
          requiresVerifiedScope: 0
        },
        tenantId
      }).summary.needsApproval
    ).toBe(1);

    expect(
      SignalTriggerApprovalResponseSchema.parse({
        evaluation: {
          evidenceIds: [evidenceId],
          matchedAuditEventIds: [],
          matchedSignalIds: [runId],
          missingPrerequisites: [],
          reason:
            "Dependency advisory signals are present and require policy approval.",
          recommendedMissionType: "ExposureValidation",
          recommendedModuleIds: ["osv.repo_dependency_scan"],
          requiresApproval: true,
          status: "NeedsApproval",
          triggerId: "trigger.cve",
          triggerType: "CVE"
        },
        mission: {
          completedAt: null,
          createdAt: now,
          evidenceIds: [evidenceId],
          missionId,
          missionType: "ExposureValidation",
          policyDecisionId: "17171717-1717-4717-8717-171717171717",
          policyProfile: "signal-trigger:trigger.cve",
          requestedBy: userId,
          safetyLevel: "PassiveReadOnly",
          scopeId,
          scopeIds: [scopeId],
          startedAt: null,
          status: "Draft",
          tenantId,
          updatedAt: now
        },
        policyDecision: {
          approvalState: "NotRequired",
          approvedAt: null,
          approvedBy: null,
          createdAt: now,
          executionEnvironment: "ControlPlane",
          expiresAt: null,
          missionType: "ExposureValidation",
          outcome: "Allowed",
          policyDecisionId: "17171717-1717-4717-8717-171717171717",
          rationale: "Verified scope with passive safety level.",
          requestedAction: {
            credentialTheft: false,
            destructive: false,
            persistence: false,
            realDataExfiltration: false,
            requiresInternalRunner: false,
            requiresTimeWindow: false,
            uncontrolledExploitChaining: false
          },
          safetyLevel: "PassiveReadOnly",
          scopeId,
          target: {
            triggerId: "trigger.cve"
          },
          tenantId,
          updatedAt: now,
          userId
        },
        routing: {
          deliveries: [
            {
              connectorKey: "slack",
              deliveredAt: now,
              detail: "Slack workflow notification delivered.",
              integrationId,
              status: "Delivered"
            }
          ],
          enabled: true,
          escalationRole: "SecurityEngineer",
          notificationIntegrationIds: [integrationId],
          nextActions: [
            "Review the draft mission before starting policy-gated execution."
          ],
          status: "Delivered",
          summary:
            "Signal-trigger routing delivered workflow notifications to configured destinations.",
          workflowDestinationIntegrationIds: [integrationId]
        }
      }).mission.status
    ).toBe("Draft");
  });
});

describe("signed scenario bundle contracts", () => {
  const compiledHash = "a".repeat(64);
  const scenarioBundleId = "19191919-1919-4919-8919-191919191919";

  const bundle = {
    allowedScopeTypes: ["Domain"],
    approvedAt: null,
    approvedBy: null,
    bundleVersion: 1,
    compiledAt: now,
    compiledHash,
    createdAt: now,
    description: "Deterministic DNS validation graph.",
    expectedObservations: ["DNS evidence is persisted."],
    intent: "Validate DNS posture with saved evidence.",
    legalClassification: "PassiveAuthorized",
    maximumIterations: 2,
    name: "DNS posture proof",
    prerequisites: ["Verified Domain scope"],
    safetyCeiling: "PassiveReadOnly",
    sbom: [
      {
        executionMode: "ControlPlane",
        moduleId: "periscan.dns_resolution_check",
        safetyLevel: "PassiveReadOnly",
        version: "1.0.0"
      }
    ],
    scenarioBundleId,
    scopeId,
    signature: {
      algorithm: "EdDSA",
      digestSha256: compiledHash,
      keyId: "tenant-signing-key",
      signature: "signed-content"
    },
    source: { kind: "OperatorIntent", reference: null },
    status: "Draft",
    steps: [
      {
        dependsOn: [],
        expectedObservations: ["DNS answers are recorded."],
        moduleId: "periscan.dns_resolution_check",
        name: "Resolve DNS",
        stepId: "step-1",
        target: {},
        when: { kind: "Always" }
      },
      {
        dependsOn: ["step-1"],
        expectedObservations: ["Email records are recorded."],
        moduleId: "periscan.dns_email_controls",
        name: "Inspect email controls",
        stepId: "step-2",
        target: {},
        when: {
          allowedStatuses: ["executed"],
          kind: "PriorStep",
          minimumEvidenceCount: 1,
          minimumSignalCount: 0,
          stepId: "step-1",
          validationStates: []
        }
      }
    ],
    techniqueIds: ["T1595"],
    tenantId,
    updatedAt: now
  } as const;

  it("accepts an evidence-gated deterministic graph", () => {
    const parsed = ScenarioBundleSchema.parse(bundle);

    expect(parsed.steps[1]!.when).toMatchObject({
      kind: "PriorStep",
      minimumEvidenceCount: 1,
      stepId: "step-1"
    });
    expect(parsed).toMatchObject({
      feedbackCycleCount: 0,
      feedbackFailedCycleCount: 0,
      feedbackLastStatus: "Idle"
    });
  });

  it("bounds signed cycles and requires an attributable stop decision", () => {
    expect(
      CompileScenarioInputSchema.parse({
        intent: "Validate DNS posture with saved evidence.",
        scopeId
      }).maximumIterations
    ).toBe(3);
    expect(() =>
      CompileScenarioInputSchema.parse({
        intent: "Validate DNS posture with saved evidence.",
        maximumIterations: 21,
        scopeId
      })
    ).toThrow();

    expect(ExecuteScenarioInputSchema.parse({ compiledHash })).toMatchObject({
      compiledHash,
      reason: "Run the next approved feedback cycle.",
      reviewReference: "scenario-execution"
    });
    expect(
      StopScenarioFeedbackInputSchema.parse({
        expectedFeedbackCycleCount: 1,
        reason: "The approved release review is complete.",
        reviewReference: "CHANGE-1234"
      })
    ).toMatchObject({ expectedFeedbackCycleCount: 1 });
    expect(() =>
      StopScenarioFeedbackInputSchema.parse({
        expectedFeedbackCycleCount: 1,
        reason: "too short",
        reviewReference: "CHANGE-1234"
      })
    ).toThrow();
  });

  it("rejects malformed signed digests and empty branch conditions", () => {
    expect(() =>
      ScenarioBundleSchema.parse({
        ...bundle,
        compiledHash: "not-a-digest"
      })
    ).toThrow();
    expect(() =>
      ScenarioBranchPredicateSchema.parse({
        allowedStatuses: [],
        kind: "PriorStep",
        minimumEvidenceCount: 1,
        minimumSignalCount: 0,
        stepId: "step-1",
        validationStates: []
      })
    ).toThrow();
  });
});

describe("billing entitlement helpers", () => {
  const corePackage = BillingPackageSchema.parse({
    apiAccess: "Included",
    audiences: ["Security team"],
    description: "Continuous validation.",
    includedCapabilities: ["Continuous validation schedules", "Risk scoring"],
    includedMeterNames: ["ValidationRuns", "APIUsage"],
    label: "Core Validation",
    packageKey: "CoreValidation",
    paymentProcessorStatus: "NotConfigured",
    publicPricingLanguage: "Pay for what you validate.",
    status: "Available",
    supportedOutcomes: ["Prioritize remediation"]
  });

  it("entitles only capabilities/meters the active package includes", () => {
    expect(isCapabilityEntitled(corePackage, "Risk scoring")).toBe(true);
    expect(isCapabilityEntitled(corePackage, "AI red-teaming")).toBe(false);
    expect(isMeterEntitled(corePackage, "ValidationRuns")).toBe(true);
    expect(isMeterEntitled(corePackage, "Identities")).toBe(false);
  });

  it("entitles nothing when there is no active package", () => {
    expect(isCapabilityEntitled(null, "Risk scoring")).toBe(false);
    expect(isMeterEntitled(undefined, "ValidationRuns")).toBe(false);
  });

  it("returns an explainable decision for a gated capability", () => {
    const allowed = evaluateCapabilityEntitlement({
      package: corePackage,
      requiredCapability: "Risk scoring"
    });
    expect(allowed.entitled).toBe(true);

    const deniedNoPackage = evaluateCapabilityEntitlement({
      package: null,
      requiredCapability: "Risk scoring"
    });
    expect(deniedNoPackage.entitled).toBe(false);
    expect(deniedNoPackage.reason).toMatch(/no active subscription/i);

    const deniedNotIncluded = evaluateCapabilityEntitlement({
      package: corePackage,
      requiredCapability: "AI red-teaming"
    });
    expect(deniedNotIncluded.entitled).toBe(false);
    expect(deniedNotIncluded.reason).toContain("Core Validation");
  });
});

describe("AssetCoverageTag ontology (P11-12)", () => {
  it("canonicalizes Kubernetes aliases to K8s and rejects dual tags", () => {
    expect(normalizeAssetCoverageTag("Kubernetes")).toBe("K8s");
    expect(normalizeAssetCoverageTag("k8s")).toBe("K8s");
    expect(normalizeAssetCoverageTag("K8s")).toBe("K8s");
    expect(AssetCoverageTagSchema.options).not.toContain("Kubernetes");
    expect(canonicalizeAssetCoverageTags(["Kubernetes", "K8s", "EASM", "nope"])).toEqual(
      ["K8s", "EASM"]
    );
  });

  it("binds lab inventory assetType to AssetTypeSchema", () => {
    const entry = AssetInventoryEntrySchema.parse({
      assetId: "asset-1",
      assetType: "Kubernetes",
      coverageTags: ["Kubernetes", "Cloud"],
      discoveredBy: "test",
      firstSeen: "2026-07-29T00:00:00.000Z",
      lastSeen: "2026-07-29T00:00:00.000Z"
    });
    expect(entry.assetType).toBe("Kubernetes");
    expect(entry.coverageTags).toEqual(["K8s", "Cloud"]);
  });
});

describe("GraphNodeType closed ontology (P11-1 / P11R-1)", () => {
  it("documents a versioned bare-type and family allowlist", () => {
    expect(GRAPH_NODE_TYPE_ONTOLOGY_VERSION).toBe(2);
    expect(GRAPH_NODE_BARE_TYPES).toEqual(
      expect.arrayContaining([
        "ValidationRun",
        "ValidationMission",
        "Scope",
        "Integration",
        "Runner",
        "EvidenceArtifact",
        "Asset",
        "Identity",
        "Exposure",
        "AttackPath"
      ])
    );
    expect(GRAPH_NODE_TYPE_FAMILIES).toEqual(
      expect.arrayContaining([
        "Signal",
        "Asset",
        "Exposure",
        "Identity",
        "Secret",
        "CloudResource",
        "HeuristicHypothesis",
        "PRD",
        "ControlSource"
      ])
    );
  });

  it("accepts all bare kinds, Signal categories, Asset types, and closed runtime leaves", () => {
    for (const bare of GRAPH_NODE_BARE_TYPES) {
      expect(isAllowedGraphNodeType(bare), bare).toBe(true);
      expect(GraphNodeTypeSchema.parse(bare)).toBe(bare);
    }

    for (const category of SignalCategorySchema.options) {
      const nodeType = `Signal.${category}`;
      expect(isAllowedGraphNodeType(nodeType), nodeType).toBe(true);
    }

    for (const assetType of AssetTypeSchema.options) {
      expect(isAllowedGraphNodeType(`Asset.${assetType}`)).toBe(true);
      expect(isAllowedGraphNodeType(`HeuristicHypothesis.${assetType}`)).toBe(
        true
      );
    }

    for (const leaf of GRAPH_NODE_ASSET_LEGACY_LEAVES) {
      expect(isAllowedGraphNodeType(`Asset.${leaf}`)).toBe(true);
    }

    for (const controlType of ControlSourceTypeSchema.options) {
      expect(isAllowedGraphNodeType(`ControlSource.${controlType}`)).toBe(true);
    }

    const runtimeWriterTypes = [
      "Exposure.SecretExposure",
      "Exposure.Observed",
      "Exposure.PublicAdmin",
      "Exposure.RepositorySecret",
      "Identity.Privileged",
      "Secret.RepositoryCredential",
      "CloudResource.Role",
      "ControlSource.SIEM",
      "PRD.Asset",
      "PRD.ValidationRun",
      "PRD.ValidationMission",
      "EvidenceArtifact",
      "ValidationRun",
      "ValidationMission",
      "Scope",
      "Integration"
    ];

    for (const nodeType of runtimeWriterTypes) {
      expect(isAllowedGraphNodeType(nodeType), nodeType).toBe(true);
    }
  });

  it("rejects free-string Exposure/Identity leaves and unknown families (P11R-1)", () => {
    const rejected = [
      "TotallyFreeString",
      "UnknownFamily.Leaf",
      "Signal.NotACategory",
      "Asset.NotAnAssetType",
      "HeuristicHypothesis.Bogus",
      "ControlSource.NotAControl",
      "PRD.NotInBareList",
      "Signal.Repository.Extra",
      "Exposure.with spaces",
      "Exposure.",
      "Exposure.AnythingGoes",
      "Exposure.AlibabaEcsPublicExposure",
      "Identity.InventedPrincipal",
      "Secret.InventedClass",
      "CloudResource.InventedKind",
      "ValidationRun.FreeLeaf",
      ".Leaf",
      "",
      "signal.repository"
    ];

    for (const nodeType of rejected) {
      expect(isAllowedGraphNodeType(nodeType), nodeType).toBe(false);
      expect(() => GraphNodeTypeSchema.parse(nodeType), nodeType).toThrow();
    }

    expect(() =>
      GraphNodeSchema.parse({
        graphNodeId,
        tenantId,
        nodeType: "OpenOntology.Tax",
        nodeKey: "bad:node",
        relatedEntityType: null,
        relatedEntityId: null,
        label: "Rejected free-string node type",
        properties: {},
        evidenceIds: [],
        createdAt: now,
        updatedAt: now
      })
    ).toThrow(/allowlisted|Family\.Leaf|nodeType/i);
  });
});

describe("P09-1 ValidationState partitions", () => {
  it("covers every ValidationStateSchema member exactly once", () => {
    const schemaMembers = ValidationStateSchema.options;
    const partitioned = [
      ...PATH_VALIDATION_STATES,
      ...CONTROL_VALIDATION_STATES,
      ...REMEDIATION_VALIDATION_STATES,
      ...READINESS_VALIDATION_STATES
    ];

    expect(new Set(partitioned).size).toBe(partitioned.length);
    expect([...partitioned].sort()).toEqual([...schemaMembers].sort());

    expect(VALIDATION_STATE_PARTITIONS.path).toBe(PATH_VALIDATION_STATES);
    expect(VALIDATION_STATE_PARTITIONS.control).toBe(CONTROL_VALIDATION_STATES);
    expect(VALIDATION_STATE_PARTITIONS.remediation).toBe(
      REMEDIATION_VALIDATION_STATES
    );
    expect(VALIDATION_STATE_PARTITIONS.readiness).toBe(
      READINESS_VALIDATION_STATES
    );
  });

  it("classifies members into exclusive partitions", () => {
    for (const state of PATH_VALIDATION_STATES) {
      expect(classifyValidationState(state)).toBe("path");
      expect(isPathValidationState(state)).toBe(true);
      expect(isValidationStatePathOnly(state)).toBe(true);
      expect(isControlValidationState(state)).toBe(false);
      expect(isRemediationValidationState(state)).toBe(false);
      expect(isReadinessValidationState(state)).toBe(false);
    }
    for (const state of CONTROL_VALIDATION_STATES) {
      expect(classifyValidationState(state)).toBe("control");
      expect(isValidationStateControlOnly(state)).toBe(true);
    }
    for (const state of REMEDIATION_VALIDATION_STATES) {
      expect(classifyValidationState(state)).toBe("remediation");
      expect(isValidationStateRemediationOnly(state)).toBe(true);
    }
    for (const state of READINESS_VALIDATION_STATES) {
      expect(classifyValidationState(state)).toBe("readiness");
      expect(isValidationStateReadinessOnly(state)).toBe(true);
    }
    expect(classifyValidationState("NotARealState")).toBeNull();
  });

  it("keeps isValidationState*Only aliases identical to primary predicates", () => {
    expect(isValidationStatePathOnly).toBe(isPathValidationState);
    expect(isValidationStateControlOnly).toBe(isControlValidationState);
    expect(isValidationStateRemediationOnly).toBe(isRemediationValidationState);
    expect(isValidationStateReadinessOnly).toBe(isReadinessValidationState);
  });
});

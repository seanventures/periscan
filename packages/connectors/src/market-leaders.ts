import type {
  IntegrationCategory,
  MissionType,
  SensitivityLevel
} from "@periscan/shared";

import {
  ConnectorExecutionContextSchema,
  ConnectorHealthSchema,
  ConnectorManifestSchema,
  ConnectorSyncResultSchema,
  createMockSignal,
  createTimestampedSignal,
  type Connector,
  type ConnectorAuthConfig,
  type ConnectorAvailability,
  type ConnectorMarketplaceCategory,
  type ConnectorSignalInput,
  type SetupComplexity
} from "./index.js";

// ---------------------------------------------------------------------------
// Market-leader connector buildout.
//
// The hand-written connectors in index.ts cover ~100 platforms. This module
// fills the remaining market-leader gaps (whole-or-thin categories: NDR, SOAR
// platforms, AppSec/SCA, SASE/CASB, MDM, PAM/IGA, Data Security, plus notable
// absent leaders) via a single data-driven factory so every entry is uniform
// and schema-valid.
//
// Depth model: each entry ships a real catalog manifest plus test-only mock
// behavior. It is intentionally Planned and non-connectable until a vendor-
// specific live client, health/sync behavior, normalization, revocation, and
// contract tests are implemented. A credential form is not an integration.
//
// Production gate: never set availability "Production" here (or on dedicated
// clients in index.ts) without live design-partner smoke evidence documented
// in Plane per docs/ops/CONNECTOR_PRODUCTION_QUALIFICATION.md. Catalog honesty
// tests (catalog-production-honesty.test.ts) keep Production count at zero
// until that qualification path runs.
// ---------------------------------------------------------------------------

type ConnectorSignalCategory = ConnectorSignalInput["signalCategory"];

interface MockSignalSpec {
  category: ConnectorSignalCategory;
  subcategory?: string;
  sensitivity: SensitivityLevel;
  sourceType: string;
}

interface ObserverSpec {
  sourceType: string;
  mockOutcome: string;
  mockConfidence?: number;
  mockDetail: string;
}

export interface StandardConnectorSpec {
  connectorKey: string;
  vendor: string;
  product: string;
  marketplaceCategory: ConnectorMarketplaceCategory;
  category: IntegrationCategory;
  availability?: ConnectorAvailability;
  setupComplexity?: SetupComplexity;
  dataSensitivity: SensitivityLevel;
  signalCategories: ConnectorSignalCategory[];
  supportedMissionTypes: MissionType[];
  validationCapabilities: string[];
  controlObservationCapabilities?: string[];
  workflowCapabilities?: string[];
  requiredPermissions: string[];
  permissionsSummary: string;
  customerVisibleDescription: string;
  healthDetail: string;
  authMethods: ConnectorAuthConfig[];
  mockSignal: MockSignalSpec;
  observer?: ObserverSpec;
}

// Standard mock auth method shared by every connector.
const MOCK_AUTH: ConnectorAuthConfig = {
  description: "Mock mode for demos, catalog browsing, and validation tests.",
  fields: [],
  kind: "mock",
  label: "Mock",
  mockSupported: true
};

export function createStandardConnector(
  spec: StandardConnectorSpec
): Connector {
  const manifest = ConnectorManifestSchema.parse({
    authMethods: spec.authMethods,
    availability: "Planned",
    category: spec.category,
    connectable: false,
    connectorKey: spec.connectorKey,
    controlObservationCapabilities: spec.controlObservationCapabilities ?? [],
    customerVisibleDescription: spec.customerVisibleDescription,
    dataSensitivity: spec.dataSensitivity,
    healthCheckMethod: spec.healthDetail,
    marketplaceCategory: spec.marketplaceCategory,
    mockSupported: true,
    permissionsSummary: spec.permissionsSummary,
    product: spec.product,
    requiredPermissions: spec.requiredPermissions,
    setupComplexity: spec.setupComplexity ?? "Medium",
    signalCategories: spec.signalCategories,
    supportedMissionTypes: spec.supportedMissionTypes,
    validationCapabilities: spec.validationCapabilities,
    vendor: spec.vendor,
    workflowCapabilities: spec.workflowCapabilities ?? []
  });

  const requireMockMode = (mockMode: boolean) => {
    if (!mockMode) {
      throw new Error(
        `${spec.vendor} ${spec.product} is planned and not connectable until its vendor-specific live client is implemented and certified.`
      );
    }
  };

  const buildSignals = (mockMode: boolean): ConnectorSignalInput[] => {
    requireMockMode(mockMode);
    return [
      {
        ...createMockSignal(
          spec.mockSignal.category,
          spec.mockSignal.subcategory ?? "ConnectorObservation",
          spec.mockSignal.sensitivity
        ),
        sourceType: spec.mockSignal.sourceType
      }
    ];
  };

  const runHealthCheck = (mockMode: boolean) => {
    requireMockMode(mockMode);
    return ConnectorHealthSchema.parse({
      authorizationVerified: true,
      checkedAt: new Date().toISOString(),
      detail: `Mock health check for ${spec.vendor} ${spec.product}.`,
      latencyMs: null,
      status: "Healthy"
    });
  };

  const connector: Connector = {
    async collectSignals(context) {
      const parsed = ConnectorExecutionContextSchema.parse(context);
      return buildSignals(parsed.mockMode);
    },
    async healthCheck(context) {
      const parsed = ConnectorExecutionContextSchema.parse(context);
      return runHealthCheck(parsed.mockMode);
    },
    manifest,
    async sync(context) {
      const parsed = ConnectorExecutionContextSchema.parse(context);
      return ConnectorSyncResultSchema.parse({
        assets: [],
        health: runHealthCheck(parsed.mockMode),
        signals: buildSignals(parsed.mockMode).map((signal) =>
          createTimestampedSignal(manifest, parsed, signal)
        )
      });
    }
  };

  if (spec.observer) {
    const observer = spec.observer;
    connector.observeControl = async (context) => {
      const parsed = ConnectorExecutionContextSchema.parse(context);
      if (parsed.mockMode) {
        return {
          confidence: observer.mockConfidence ?? 0.82,
          detail: observer.mockDetail,
          outcome: observer.mockOutcome,
          sourceType: observer.sourceType
        };
      }
      throw new Error(
        `${spec.vendor} ${spec.product} is planned and not connectable until its vendor-specific live client is implemented and certified.`
      );
    };
  }

  return connector;
}

// Concise auth-method builders for the common shapes.
function bearerAuth(
  label: string,
  description: string,
  extraFields: ConnectorAuthConfig["fields"] = []
): ConnectorAuthConfig {
  return {
    description,
    fields: [
      { key: "baseUrl", label: "API Base URL", required: true, secret: false },
      { key: "apiToken", label: "API Token", required: true, secret: true },
      ...extraFields
    ],
    kind: "apiToken",
    label,
    mockSupported: false
  };
}

function keyPairAuth(
  label: string,
  description: string,
  idKey: string,
  idLabel: string
): ConnectorAuthConfig {
  return {
    description,
    fields: [
      { key: "baseUrl", label: "API Base URL", required: true, secret: false },
      { key: idKey, label: idLabel, required: true, secret: true },
      { key: "apiSecret", label: "API Secret", required: true, secret: true }
    ],
    kind: "apiKeys",
    label,
    mockSupported: false
  };
}

function oauthAuth(label: string, description: string): ConnectorAuthConfig {
  return {
    description,
    fields: [
      { key: "baseUrl", label: "API Base URL", required: true, secret: false },
      { key: "clientId", label: "Client ID", required: true, secret: false },
      {
        key: "clientSecret",
        label: "Client Secret",
        required: true,
        secret: true
      },
      {
        key: "tenantId",
        label: "Tenant/Directory ID",
        required: false,
        secret: false
      }
    ],
    kind: "oauth2ClientCredentials",
    label,
    mockSupported: false
  };
}

function apiKeyAuth(label: string, description: string): ConnectorAuthConfig {
  return {
    description,
    fields: [
      { key: "baseUrl", label: "API Base URL", required: false, secret: false },
      { key: "apiKey", label: "API Key", required: true, secret: true }
    ],
    kind: "apiKey",
    label,
    mockSupported: false
  };
}

// Compact builders: a control observer (validates a deployed control), or a
// signal/exposure source. Both produce a full schema-valid StandardConnectorSpec.
function observerSpec(o: {
  key: string;
  vendor: string;
  product: string;
  marketplace: ConnectorMarketplaceCategory;
  auth: ConnectorAuthConfig;
  outcome: string;
  outcomes: string[];
  sourceType: string;
  desc: string;
  capabilities: string[];
  permissions: string[];
  permissionsSummary: string;
  health: string;
  sensitivity?: SensitivityLevel;
}): StandardConnectorSpec {
  return {
    authMethods: [MOCK_AUTH, o.auth],
    category: "SecurityControl",
    connectorKey: o.key,
    controlObservationCapabilities: o.outcomes,
    customerVisibleDescription: o.desc,
    dataSensitivity: o.sensitivity ?? "High",
    healthDetail: o.health,
    marketplaceCategory: o.marketplace,
    mockSignal: {
      category: "ControlObservation",
      sensitivity: o.sensitivity ?? "High",
      sourceType: `${o.sourceType}.observation`
    },
    observer: {
      mockDetail: `Mock ${o.vendor} ${o.product} control observation.`,
      mockOutcome: o.outcome,
      sourceType: `${o.sourceType}.observer`
    },
    permissionsSummary: o.permissionsSummary,
    product: o.product,
    requiredPermissions: o.permissions,
    signalCategories: ["ControlObservation"],
    supportedMissionTypes: ["ValidationSnapshot", "ControlValidation"],
    validationCapabilities: o.capabilities,
    vendor: o.vendor
  };
}

function signalSpec(o: {
  key: string;
  vendor: string;
  product: string;
  marketplace: ConnectorMarketplaceCategory;
  category?: IntegrationCategory;
  auth: ConnectorAuthConfig;
  signalCategory: ConnectorSignalCategory;
  subcategory: string;
  sourceType: string;
  desc: string;
  capabilities: string[];
  permissions: string[];
  permissionsSummary: string;
  health: string;
  sensitivity?: SensitivityLevel;
  missionTypes?: MissionType[];
}): StandardConnectorSpec {
  return {
    authMethods: [MOCK_AUTH, o.auth],
    category: o.category ?? "SecurityControl",
    connectorKey: o.key,
    customerVisibleDescription: o.desc,
    dataSensitivity: o.sensitivity ?? "Moderate",
    healthDetail: o.health,
    marketplaceCategory: o.marketplace,
    mockSignal: {
      category: o.signalCategory,
      sensitivity: o.sensitivity ?? "Moderate",
      sourceType: o.sourceType,
      subcategory: o.subcategory
    },
    permissionsSummary: o.permissionsSummary,
    product: o.product,
    requiredPermissions: o.permissions,
    signalCategories: [o.signalCategory],
    supportedMissionTypes: o.missionTypes ?? [
      "ValidationSnapshot",
      "ExposureValidation"
    ],
    validationCapabilities: o.capabilities,
    vendor: o.vendor
  };
}

// --- Batch 1: Network Detection & Response (NDR) + SOAR platforms ---

const MARKET_LEADER_SPECS: StandardConnectorSpec[] = [
  // NDR
  {
    authMethods: [
      MOCK_AUTH,
      keyPairAuth(
        "API Token Pair",
        "Darktrace API public/private token pair for read-only model-breach lookups.",
        "publicToken",
        "Public Token"
      )
    ],
    category: "SecurityControl",
    connectorKey: "darktrace",
    product: "Darktrace",
    controlObservationCapabilities: ["Detected", "Alerted", "NoEvidence"],
    customerVisibleDescription:
      "Darktrace DETECT/RESPOND network anomaly and model-breach evidence for control validation.",
    dataSensitivity: "High",
    healthDetail: "Darktrace /modelbreaches read-only lookup.",
    marketplaceCategory: "NDR",
    mockSignal: {
      category: "ControlObservation",
      sensitivity: "High",
      sourceType: "darktrace.modelbreach"
    },
    observer: {
      mockDetail: "Mock Darktrace model-breach detection.",
      mockOutcome: "Detected",
      sourceType: "darktrace.observer"
    },
    permissionsSummary: "Read-only model-breach and device telemetry.",
    requiredPermissions: ["modelbreaches:read", "devices:read"],
    signalCategories: ["ControlObservation"],
    supportedMissionTypes: ["ValidationSnapshot", "ControlValidation"],
    validationCapabilities: [
      "Network anomaly detection evidence",
      "Model-breach severity observation"
    ],
    vendor: "Darktrace"
  },
  {
    authMethods: [
      MOCK_AUTH,
      bearerAuth(
        "API Token",
        "Vectra AI Platform API token for detection reads."
      )
    ],
    category: "SecurityControl",
    connectorKey: "vectra-ai",
    product: "Vectra AI Platform",
    controlObservationCapabilities: ["Detected", "Alerted", "NoEvidence"],
    customerVisibleDescription:
      "Vectra AI network/identity threat detection evidence for control validation.",
    dataSensitivity: "High",
    healthDetail: "Vectra /api/v3/detections read-only lookup.",
    marketplaceCategory: "NDR",
    mockSignal: {
      category: "ControlObservation",
      sensitivity: "High",
      sourceType: "vectra.detection"
    },
    observer: {
      mockDetail: "Mock Vectra AI detection match.",
      mockOutcome: "Detected",
      sourceType: "vectra.observer"
    },
    permissionsSummary: "Read-only detections and accounts.",
    requiredPermissions: ["detections:read"],
    signalCategories: ["ControlObservation"],
    supportedMissionTypes: ["ValidationSnapshot", "ControlValidation"],
    validationCapabilities: [
      "AI-driven detection evidence",
      "Attacker-behavior observation"
    ],
    vendor: "Vectra AI"
  },
  {
    authMethods: [
      MOCK_AUTH,
      keyPairAuth(
        "API Key Pair",
        "ExtraHop Reveal(x) REST API key id/secret for detection reads.",
        "apiKeyId",
        "API Key ID"
      )
    ],
    category: "SecurityControl",
    connectorKey: "extrahop",
    product: "Reveal(x)",
    controlObservationCapabilities: ["Detected", "Alerted", "NoEvidence"],
    customerVisibleDescription:
      "ExtraHop Reveal(x) network detection and response evidence for control validation.",
    dataSensitivity: "High",
    healthDetail: "ExtraHop /api/v1/detections read-only lookup.",
    marketplaceCategory: "NDR",
    mockSignal: {
      category: "ControlObservation",
      sensitivity: "High",
      sourceType: "extrahop.detection"
    },
    observer: {
      mockDetail: "Mock ExtraHop detection match.",
      mockOutcome: "Detected",
      sourceType: "extrahop.observer"
    },
    permissionsSummary: "Read-only detections.",
    requiredPermissions: ["detections:read"],
    signalCategories: ["ControlObservation"],
    supportedMissionTypes: ["ValidationSnapshot", "ControlValidation"],
    validationCapabilities: [
      "Wire-data detection evidence",
      "East-west detection observation"
    ],
    vendor: "ExtraHop"
  },
  {
    authMethods: [
      MOCK_AUTH,
      bearerAuth(
        "API Token",
        "Corelight Open NDR API token for notice/alert reads."
      )
    ],
    category: "SecurityControl",
    connectorKey: "corelight",
    product: "Open NDR",
    controlObservationCapabilities: ["Detected", "Logged", "NoEvidence"],
    customerVisibleDescription:
      "Corelight Open NDR Zeek/Suricata network evidence for control validation.",
    dataSensitivity: "High",
    healthDetail: "Corelight sensor/fleet read-only status lookup.",
    marketplaceCategory: "NDR",
    mockSignal: {
      category: "ControlObservation",
      sensitivity: "High",
      sourceType: "corelight.notice"
    },
    observer: {
      mockDetail: "Mock Corelight network notice.",
      mockOutcome: "Detected",
      sourceType: "corelight.observer"
    },
    permissionsSummary: "Read-only notices and sensor status.",
    requiredPermissions: ["notices:read"],
    signalCategories: ["ControlObservation"],
    supportedMissionTypes: ["ValidationSnapshot", "ControlValidation"],
    validationCapabilities: [
      "Open NDR network evidence",
      "Zeek/Suricata detection observation"
    ],
    vendor: "Corelight"
  },
  // SOAR platforms
  {
    authMethods: [
      MOCK_AUTH,
      keyPairAuth(
        "API Key",
        "Cortex XSOAR API key + key id for read-only incident/playbook status.",
        "apiKeyId",
        "API Key ID"
      )
    ],
    category: "SecurityControl",
    connectorKey: "palo-cortex-xsoar",
    product: "Cortex XSOAR",
    controlObservationCapabilities: ["Routed", "NeedsTuning", "NoEvidence"],
    customerVisibleDescription:
      "Palo Alto Cortex XSOAR playbook/incident response evidence for control validation.",
    dataSensitivity: "High",
    healthDetail: "Cortex XSOAR /incidents/search read-only lookup.",
    marketplaceCategory: "SOAR/ITSM",
    mockSignal: {
      category: "ControlObservation",
      sensitivity: "High",
      sourceType: "cortex-xsoar.incident"
    },
    observer: {
      mockDetail: "Mock Cortex XSOAR playbook execution.",
      mockOutcome: "Routed",
      sourceType: "cortex-xsoar.observer"
    },
    permissionsSummary: "Read-only incident and playbook status.",
    requiredPermissions: ["incidents:read", "playbooks:read"],
    signalCategories: ["ControlObservation"],
    supportedMissionTypes: ["ValidationSnapshot", "ControlValidation"],
    validationCapabilities: [
      "Playbook automation evidence",
      "Incident response routing observation"
    ],
    vendor: "Palo Alto Networks",
    workflowCapabilities: ["Incident routing", "Playbook execution status"]
  },
  {
    authMethods: [
      MOCK_AUTH,
      bearerAuth(
        "Automation Token",
        "Splunk SOAR (Phantom) automation token for read-only container/action status."
      )
    ],
    category: "SecurityControl",
    connectorKey: "splunk-soar",
    product: "Splunk SOAR",
    controlObservationCapabilities: ["Routed", "NeedsTuning", "NoEvidence"],
    customerVisibleDescription:
      "Splunk SOAR (Phantom) container/playbook response evidence for control validation.",
    dataSensitivity: "High",
    healthDetail: "Splunk SOAR /rest/container read-only lookup.",
    marketplaceCategory: "SOAR/ITSM",
    mockSignal: {
      category: "ControlObservation",
      sensitivity: "High",
      sourceType: "splunk-soar.container"
    },
    observer: {
      mockDetail: "Mock Splunk SOAR playbook run.",
      mockOutcome: "Routed",
      sourceType: "splunk-soar.observer"
    },
    permissionsSummary: "Read-only containers and playbook runs.",
    requiredPermissions: ["containers:read", "playbooks:read"],
    signalCategories: ["ControlObservation"],
    supportedMissionTypes: ["ValidationSnapshot", "ControlValidation"],
    validationCapabilities: [
      "Container/playbook automation evidence",
      "Response action observation"
    ],
    vendor: "Splunk",
    workflowCapabilities: ["Container routing", "Playbook run status"]
  },
  {
    authMethods: [
      MOCK_AUTH,
      bearerAuth("API Token", "Tines API token for read-only story/run status.")
    ],
    category: "SecurityControl",
    connectorKey: "tines",
    product: "Tines",
    controlObservationCapabilities: ["Routed", "NeedsTuning", "NoEvidence"],
    customerVisibleDescription:
      "Tines workflow automation run evidence for control validation.",
    dataSensitivity: "Moderate",
    healthDetail: "Tines /api/v1/stories read-only lookup.",
    marketplaceCategory: "SOAR/ITSM",
    mockSignal: {
      category: "ControlObservation",
      sensitivity: "Moderate",
      sourceType: "tines.story"
    },
    observer: {
      mockDetail: "Mock Tines story run.",
      mockOutcome: "Routed",
      sourceType: "tines.observer"
    },
    permissionsSummary: "Read-only stories and run history.",
    requiredPermissions: ["stories:read"],
    signalCategories: ["ControlObservation"],
    supportedMissionTypes: ["ValidationSnapshot", "ControlValidation"],
    validationCapabilities: [
      "Workflow automation evidence",
      "Story run observation"
    ],
    vendor: "Tines",
    workflowCapabilities: ["Story routing", "Run status"]
  },
  {
    authMethods: [
      MOCK_AUTH,
      bearerAuth(
        "API Token",
        "Torq workflow API token for read-only run status."
      )
    ],
    category: "SecurityControl",
    connectorKey: "torq",
    product: "Torq",
    controlObservationCapabilities: ["Routed", "NeedsTuning", "NoEvidence"],
    customerVisibleDescription:
      "Torq hyperautomation workflow run evidence for control validation.",
    dataSensitivity: "Moderate",
    healthDetail: "Torq /workflows read-only lookup.",
    marketplaceCategory: "SOAR/ITSM",
    mockSignal: {
      category: "ControlObservation",
      sensitivity: "Moderate",
      sourceType: "torq.workflow"
    },
    observer: {
      mockDetail: "Mock Torq workflow run.",
      mockOutcome: "Routed",
      sourceType: "torq.observer"
    },
    permissionsSummary: "Read-only workflows and executions.",
    requiredPermissions: ["workflows:read"],
    signalCategories: ["ControlObservation"],
    supportedMissionTypes: ["ValidationSnapshot", "ControlValidation"],
    validationCapabilities: [
      "Hyperautomation workflow evidence",
      "Execution observation"
    ],
    vendor: "Torq",
    workflowCapabilities: ["Workflow routing", "Execution status"]
  },
  // --- Batch 2: SASE/CASB (SSE) ---
  observerSpec({
    key: "cato-networks",
    vendor: "Cato Networks",
    product: "Cato SASE Cloud",
    marketplace: "SSE/SASE",
    auth: bearerAuth(
      "API Token",
      "Cato Management API token for read-only events."
    ),
    outcome: "Blocked",
    outcomes: ["Blocked", "Detected", "NoEvidence"],
    sourceType: "cato",
    desc: "Cato SASE Cloud security event evidence for control validation.",
    capabilities: [
      "SASE security event evidence",
      "Threat prevention observation"
    ],
    permissions: ["events:read"],
    permissionsSummary: "Read-only security events.",
    health: "Cato events feed read-only lookup."
  }),
  observerSpec({
    key: "forcepoint-one",
    vendor: "Forcepoint",
    product: "Forcepoint ONE",
    marketplace: "SSE/SASE",
    auth: bearerAuth(
      "API Token",
      "Forcepoint ONE API token for read-only incidents."
    ),
    outcome: "Blocked",
    outcomes: ["Blocked", "Detected", "NoEvidence"],
    sourceType: "forcepoint",
    desc: "Forcepoint ONE SSE/DLP enforcement evidence for control validation.",
    capabilities: [
      "SSE/DLP enforcement evidence",
      "Data movement block observation"
    ],
    permissions: ["incidents:read"],
    permissionsSummary: "Read-only incidents.",
    health: "Forcepoint ONE incidents read-only lookup."
  }),
  observerSpec({
    key: "skyhigh-security",
    vendor: "Skyhigh Security",
    product: "Skyhigh SSE",
    marketplace: "SSE/SASE",
    auth: bearerAuth(
      "API Token",
      "Skyhigh Security API token for read-only incidents."
    ),
    outcome: "Blocked",
    outcomes: ["Blocked", "Detected", "NoEvidence"],
    sourceType: "skyhigh",
    desc: "Skyhigh Security SSE/CASB enforcement evidence for control validation.",
    capabilities: ["CASB/SSE enforcement evidence", "Cloud DLP observation"],
    permissions: ["incidents:read"],
    permissionsSummary: "Read-only incidents.",
    health: "Skyhigh incidents read-only lookup."
  }),
  // --- Batch 2: EDR/XDR ---
  observerSpec({
    key: "cybereason",
    vendor: "Cybereason",
    product: "Cybereason XDR",
    marketplace: "EDR/XDR",
    auth: bearerAuth("API Token", "Cybereason API token for read-only Malops."),
    outcome: "Blocked",
    outcomes: ["Detected", "Blocked", "NoEvidence"],
    sourceType: "cybereason",
    desc: "Cybereason XDR Malop detection/response evidence for control validation.",
    capabilities: ["EDR/XDR detection evidence", "Malop response observation"],
    permissions: ["malops:read"],
    permissionsSummary: "Read-only Malops.",
    health: "Cybereason Malops read-only lookup."
  }),
  observerSpec({
    key: "trellix",
    vendor: "Trellix",
    product: "Trellix XDR",
    marketplace: "EDR/XDR",
    auth: bearerAuth(
      "API Token",
      "Trellix XDR API token for read-only threats."
    ),
    outcome: "Blocked",
    outcomes: ["Detected", "Blocked", "NoEvidence"],
    sourceType: "trellix",
    desc: "Trellix XDR detection/response evidence for control validation.",
    capabilities: ["XDR detection evidence", "Threat response observation"],
    permissions: ["threats:read"],
    permissionsSummary: "Read-only threats.",
    health: "Trellix XDR threats read-only lookup."
  }),
  observerSpec({
    key: "cisco-secure-endpoint",
    vendor: "Cisco",
    product: "Secure Endpoint",
    marketplace: "EDR/XDR",
    auth: keyPairAuth(
      "API Key",
      "Cisco Secure Endpoint API client id/key for read-only events.",
      "apiClientId",
      "API Client ID"
    ),
    outcome: "Blocked",
    outcomes: ["Detected", "Blocked", "NoEvidence"],
    sourceType: "cisco-secure-endpoint",
    desc: "Cisco Secure Endpoint (AMP) detection/response evidence for control validation.",
    capabilities: ["EDR detection evidence", "Endpoint quarantine observation"],
    permissions: ["events:read"],
    permissionsSummary: "Read-only events.",
    health: "Secure Endpoint events read-only lookup."
  }),
  observerSpec({
    key: "bitdefender-gravityzone",
    vendor: "Bitdefender",
    product: "GravityZone",
    marketplace: "EDR/XDR",
    auth: apiKeyAuth(
      "API Key",
      "Bitdefender GravityZone API key for read-only events."
    ),
    outcome: "Blocked",
    outcomes: ["Detected", "Blocked", "NoEvidence"],
    sourceType: "bitdefender",
    desc: "Bitdefender GravityZone detection/response evidence for control validation.",
    capabilities: ["EDR detection evidence", "Threat block observation"],
    permissions: ["events:read"],
    permissionsSummary: "Read-only events.",
    health: "GravityZone events read-only lookup."
  }),
  // --- Batch 2: SIEM/UEBA ---
  observerSpec({
    key: "exabeam",
    vendor: "Exabeam",
    product: "Exabeam Security Operations Platform",
    marketplace: "SIEM",
    auth: bearerAuth(
      "API Token",
      "Exabeam API token for read-only alerts/notable sessions."
    ),
    outcome: "Alerted",
    outcomes: ["Alerted", "Logged", "NoEvidence", "NeedsTuning"],
    sourceType: "exabeam",
    desc: "Exabeam UEBA/SIEM detection evidence for control validation.",
    capabilities: ["UEBA anomaly evidence", "Notable-session observation"],
    permissions: ["alerts:read"],
    permissionsSummary: "Read-only alerts and sessions.",
    health: "Exabeam alerts read-only lookup."
  }),
  observerSpec({
    key: "securonix",
    vendor: "Securonix",
    product: "Unified Defense SIEM",
    marketplace: "SIEM",
    auth: bearerAuth(
      "API Token",
      "Securonix API token for read-only violations."
    ),
    outcome: "Alerted",
    outcomes: ["Alerted", "Logged", "NoEvidence", "NeedsTuning"],
    sourceType: "securonix",
    desc: "Securonix SIEM/UEBA detection evidence for control validation.",
    capabilities: ["SIEM detection evidence", "Policy-violation observation"],
    permissions: ["violations:read"],
    permissionsSummary: "Read-only violations.",
    health: "Securonix violations read-only lookup."
  }),
  observerSpec({
    key: "logrhythm",
    vendor: "LogRhythm",
    product: "LogRhythm Axon",
    marketplace: "SIEM",
    auth: bearerAuth(
      "API Token",
      "LogRhythm Axon API token for read-only alarms."
    ),
    outcome: "Alerted",
    outcomes: ["Alerted", "Logged", "NoEvidence", "NeedsTuning"],
    sourceType: "logrhythm",
    desc: "LogRhythm Axon SIEM alarm evidence for control validation.",
    capabilities: ["SIEM alarm evidence", "Detection-rule observation"],
    permissions: ["alarms:read"],
    permissionsSummary: "Read-only alarms.",
    health: "LogRhythm alarms read-only lookup."
  }),
  observerSpec({
    key: "devo",
    vendor: "Devo",
    product: "Devo Platform",
    marketplace: "SIEM",
    auth: bearerAuth("API Token", "Devo API token for read-only alerts."),
    outcome: "Alerted",
    outcomes: ["Alerted", "Logged", "NoEvidence", "NeedsTuning"],
    sourceType: "devo",
    desc: "Devo SIEM/analytics alert evidence for control validation.",
    capabilities: ["SIEM analytics evidence", "Alert observation"],
    permissions: ["alerts:read"],
    permissionsSummary: "Read-only alerts.",
    health: "Devo alerts read-only lookup."
  }),
  // --- Batch 2: Firewall/NGFW ---
  observerSpec({
    key: "check-point",
    vendor: "Check Point",
    product: "Quantum Security Gateway",
    marketplace: "WAF/Firewall",
    auth: keyPairAuth(
      "API Key",
      "Check Point Management API user/key for read-only logs.",
      "apiUser",
      "API User"
    ),
    outcome: "Blocked",
    outcomes: ["Blocked", "Detected", "NoEvidence"],
    sourceType: "checkpoint",
    desc: "Check Point Quantum firewall/threat-prevention log evidence for control validation.",
    capabilities: [
      "Firewall verdict evidence",
      "Threat-prevention block observation"
    ],
    permissions: ["logs:read"],
    permissionsSummary: "Read-only security logs.",
    health: "Check Point logs read-only lookup."
  }),
  observerSpec({
    key: "cisco-secure-firewall",
    vendor: "Cisco",
    product: "Secure Firewall",
    marketplace: "WAF/Firewall",
    auth: bearerAuth(
      "API Token",
      "Cisco Secure Firewall (FMC) API token for read-only events."
    ),
    outcome: "Blocked",
    outcomes: ["Blocked", "Detected", "NoEvidence"],
    sourceType: "cisco-firewall",
    desc: "Cisco Secure Firewall (Firepower) intrusion/connection evidence for control validation.",
    capabilities: ["Firewall verdict evidence", "IPS detection observation"],
    permissions: ["events:read"],
    permissionsSummary: "Read-only intrusion/connection events.",
    health: "Secure Firewall events read-only lookup."
  }),
  observerSpec({
    key: "f5-big-ip",
    vendor: "F5",
    product: "BIG-IP",
    marketplace: "WAF/Firewall",
    auth: bearerAuth(
      "API Token",
      "F5 BIG-IP iControl REST token for read-only WAF/ASM events."
    ),
    outcome: "Blocked",
    outcomes: ["Blocked", "Detected", "NoEvidence"],
    sourceType: "f5",
    desc: "F5 BIG-IP Advanced WAF (ASM) request-block evidence for control validation.",
    capabilities: [
      "WAF verdict evidence",
      "Application-layer block observation"
    ],
    permissions: ["asm:read"],
    permissionsSummary: "Read-only ASM/WAF events.",
    health: "BIG-IP ASM events read-only lookup."
  }),
  // --- Batch 2: AppSec / SCA / SAST ---
  signalSpec({
    key: "checkmarx",
    vendor: "Checkmarx",
    product: "Checkmarx One",
    marketplace: "AppSec/SCA",
    category: "Code",
    auth: bearerAuth(
      "API Token",
      "Checkmarx One API token for read-only scan results."
    ),
    signalCategory: "Exposure",
    subcategory: "ApplicationVulnerability",
    sourceType: "checkmarx.finding",
    desc: "Checkmarx One SAST/SCA findings as exposure signals.",
    capabilities: ["SAST finding evidence", "SCA vulnerability context"],
    permissions: ["results:read"],
    permissionsSummary: "Read-only scan results.",
    health: "Checkmarx One results read-only lookup."
  }),
  signalSpec({
    key: "veracode",
    vendor: "Veracode",
    product: "Veracode Platform",
    marketplace: "AppSec/SCA",
    category: "Code",
    auth: keyPairAuth(
      "API Credentials",
      "Veracode HMAC API id/key for read-only findings.",
      "apiId",
      "API ID"
    ),
    signalCategory: "Exposure",
    subcategory: "ApplicationVulnerability",
    sourceType: "veracode.finding",
    desc: "Veracode SAST/DAST/SCA findings as exposure signals.",
    capabilities: ["SAST/DAST finding evidence", "SCA vulnerability context"],
    permissions: ["findings:read"],
    permissionsSummary: "Read-only findings.",
    health: "Veracode findings read-only lookup."
  }),
  // --- Batch 2: CNAPP / Cloud security ---
  signalSpec({
    key: "aqua-security",
    vendor: "Aqua Security",
    product: "Aqua Platform",
    marketplace: "VM/EAP/ASM/CNAPP",
    category: "Cloud",
    auth: keyPairAuth(
      "API Key",
      "Aqua API key/secret for read-only risks.",
      "apiKeyId",
      "API Key ID"
    ),
    signalCategory: "Cloud",
    subcategory: "CloudWorkloadRisk",
    sourceType: "aqua.risk",
    desc: "Aqua CNAPP workload/image risk findings as cloud signals.",
    capabilities: [
      "Container/workload risk evidence",
      "Image vulnerability context"
    ],
    permissions: ["risks:read"],
    permissionsSummary: "Read-only risks.",
    health: "Aqua risks read-only lookup."
  }),
  signalSpec({
    key: "microsoft-defender-cloud",
    vendor: "Microsoft",
    product: "Defender for Cloud",
    marketplace: "VM/EAP/ASM/CNAPP",
    category: "Cloud",
    auth: oauthAuth(
      "OAuth2",
      "Entra app (client credentials) for read-only Defender for Cloud assessments."
    ),
    signalCategory: "Cloud",
    subcategory: "CloudPostureFinding",
    sourceType: "defender-cloud.assessment",
    desc: "Microsoft Defender for Cloud CSPM/CWPP assessments as cloud signals.",
    capabilities: ["CSPM assessment evidence", "Secure-score context"],
    permissions: ["SecurityEvents.Read.All"],
    permissionsSummary: "Read-only security assessments.",
    health: "Defender for Cloud assessments read-only lookup."
  }),
  signalSpec({
    key: "uptycs",
    vendor: "Uptycs",
    product: "Uptycs",
    marketplace: "VM/EAP/ASM/CNAPP",
    category: "Cloud",
    auth: keyPairAuth(
      "API Key",
      "Uptycs API key/secret for read-only detections.",
      "apiKeyId",
      "API Key ID"
    ),
    signalCategory: "Cloud",
    subcategory: "CloudWorkloadRisk",
    sourceType: "uptycs.detection",
    desc: "Uptycs CNAPP/XDR detections as cloud signals.",
    capabilities: ["Cloud detection evidence", "Workload risk context"],
    permissions: ["detections:read"],
    permissionsSummary: "Read-only detections.",
    health: "Uptycs detections read-only lookup."
  }),
  // --- Batch 2: PAM / IGA ---
  signalSpec({
    key: "sailpoint",
    vendor: "SailPoint",
    product: "Identity Security Cloud",
    marketplace: "Identity",
    category: "Identity",
    auth: oauthAuth(
      "OAuth2",
      "SailPoint ISC OAuth client for read-only access/identities."
    ),
    signalCategory: "Identity",
    subcategory: "IdentityGovernance",
    sourceType: "sailpoint.identity",
    desc: "SailPoint IGA identity/access governance as identity signals.",
    capabilities: ["Access certification evidence", "Entitlement/SoD context"],
    permissions: ["idn:read"],
    permissionsSummary: "Read-only identities and access.",
    health: "SailPoint identities read-only lookup."
  }),
  signalSpec({
    key: "beyondtrust",
    vendor: "BeyondTrust",
    product: "Password Safe",
    marketplace: "PAM",
    category: "Identity",
    auth: keyPairAuth(
      "API Key",
      "BeyondTrust API key/runas for read-only managed accounts.",
      "runAs",
      "Run-As User"
    ),
    signalCategory: "Identity",
    subcategory: "PrivilegedAccess",
    sourceType: "beyondtrust.account",
    desc: "BeyondTrust Password Safe privileged-access evidence as identity signals.",
    capabilities: ["Privileged session evidence", "Vaulted-credential context"],
    permissions: ["managedaccounts:read"],
    permissionsSummary: "Read-only managed accounts/sessions.",
    health: "BeyondTrust managed accounts read-only lookup."
  }),
  signalSpec({
    key: "delinea",
    vendor: "Delinea",
    product: "Secret Server",
    marketplace: "PAM",
    category: "Identity",
    auth: bearerAuth(
      "API Token",
      "Delinea Secret Server API token for read-only secret/session audit."
    ),
    signalCategory: "Identity",
    subcategory: "PrivilegedAccess",
    sourceType: "delinea.session",
    desc: "Delinea Secret Server privileged-access audit as identity signals.",
    capabilities: [
      "Privileged session evidence",
      "Secret-access audit context"
    ],
    permissions: ["secrets:read", "sessions:read"],
    permissionsSummary: "Read-only secret and session audit.",
    health: "Delinea audit read-only lookup."
  }),
  signalSpec({
    key: "saviynt",
    vendor: "Saviynt",
    product: "Identity Cloud",
    marketplace: "Identity",
    category: "Identity",
    auth: bearerAuth(
      "API Token",
      "Saviynt API token for read-only access/identities."
    ),
    signalCategory: "Identity",
    subcategory: "IdentityGovernance",
    sourceType: "saviynt.identity",
    desc: "Saviynt IGA identity/access governance as identity signals.",
    capabilities: ["Access governance evidence", "Entitlement context"],
    permissions: ["identities:read"],
    permissionsSummary: "Read-only identities and access.",
    health: "Saviynt identities read-only lookup."
  }),
  // --- Batch 2: MDM / Device trust ---
  signalSpec({
    key: "jamf",
    vendor: "Jamf",
    product: "Jamf Pro",
    marketplace: "MDM/Device",
    category: "Identity",
    auth: bearerAuth(
      "API Token",
      "Jamf Pro API token for read-only device inventory/compliance."
    ),
    signalCategory: "Asset",
    subcategory: "ManagedDevice",
    sourceType: "jamf.device",
    desc: "Jamf Pro managed-device inventory/compliance as asset signals.",
    capabilities: [
      "Device compliance evidence",
      "Managed-asset inventory context"
    ],
    permissions: ["computers:read"],
    permissionsSummary: "Read-only device inventory.",
    health: "Jamf Pro inventory read-only lookup."
  }),
  signalSpec({
    key: "microsoft-intune",
    vendor: "Microsoft",
    product: "Intune",
    marketplace: "MDM/Device",
    category: "Identity",
    auth: oauthAuth(
      "OAuth2",
      "Entra app (client credentials) for read-only managed-device state."
    ),
    signalCategory: "Asset",
    subcategory: "ManagedDevice",
    sourceType: "intune.device",
    desc: "Microsoft Intune managed-device compliance as asset signals.",
    capabilities: [
      "Device compliance evidence",
      "Configuration-profile context"
    ],
    permissions: ["DeviceManagementManagedDevices.Read.All"],
    permissionsSummary: "Read-only managed devices.",
    health: "Intune managed devices read-only lookup."
  }),
  signalSpec({
    key: "kandji",
    vendor: "Kandji",
    product: "Kandji",
    marketplace: "MDM/Device",
    category: "Identity",
    auth: bearerAuth(
      "API Token",
      "Kandji API token for read-only device inventory."
    ),
    signalCategory: "Asset",
    subcategory: "ManagedDevice",
    sourceType: "kandji.device",
    desc: "Kandji Apple-device inventory/compliance as asset signals.",
    capabilities: [
      "Device compliance evidence",
      "Apple-fleet inventory context"
    ],
    permissions: ["devices:read"],
    permissionsSummary: "Read-only device inventory.",
    health: "Kandji devices read-only lookup."
  }),
  signalSpec({
    key: "tanium",
    vendor: "Tanium",
    product: "Tanium",
    marketplace: "MDM/Device",
    category: "Identity",
    auth: keyPairAuth(
      "API Key",
      "Tanium API key/session for read-only endpoint inventory.",
      "apiUser",
      "API User"
    ),
    signalCategory: "Asset",
    subcategory: "ManagedEndpoint",
    sourceType: "tanium.endpoint",
    desc: "Tanium real-time endpoint inventory/posture as asset signals.",
    capabilities: [
      "Endpoint posture evidence",
      "Real-time asset inventory context"
    ],
    permissions: ["endpoints:read"],
    permissionsSummary: "Read-only endpoint inventory.",
    health: "Tanium endpoints read-only lookup."
  }),
  // --- Batch 2: Threat intel ---
  signalSpec({
    key: "threatconnect",
    vendor: "ThreatConnect",
    product: "ThreatConnect TIP",
    marketplace: "Threat Intelligence",
    auth: keyPairAuth(
      "API Key",
      "ThreatConnect API access id/secret for read-only indicators.",
      "accessId",
      "Access ID"
    ),
    signalCategory: "Exposure",
    subcategory: "ThreatIntelIndicator",
    sourceType: "threatconnect.indicator",
    desc: "ThreatConnect TIP indicators as exposure/threat-intel signals.",
    capabilities: ["IOC enrichment evidence", "Threat-intel context"],
    permissions: ["indicators:read"],
    permissionsSummary: "Read-only indicators.",
    health: "ThreatConnect indicators read-only lookup.",
    missionTypes: [
      "ValidationSnapshot",
      "ExposureValidation",
      "ContinuousValidation"
    ]
  }),
  // --- Batch 2: EASM / recon ---
  // --- Batch 2: Data security / DLP / DSPM ---
  signalSpec({
    key: "varonis",
    vendor: "Varonis",
    product: "Varonis Data Security Platform",
    marketplace: "Data Security",
    auth: bearerAuth(
      "API Token",
      "Varonis API token for read-only data alerts."
    ),
    signalCategory: "Exposure",
    subcategory: "DataExposure",
    sourceType: "varonis.alert",
    desc: "Varonis data-access/exposure alerts as exposure signals.",
    capabilities: [
      "Sensitive-data exposure evidence",
      "Abnormal data-access context"
    ],
    permissions: ["alerts:read"],
    permissionsSummary: "Read-only data alerts.",
    health: "Varonis alerts read-only lookup.",
    sensitivity: "High"
  }),
  signalSpec({
    key: "microsoft-purview",
    vendor: "Microsoft",
    product: "Purview",
    marketplace: "Data Security",
    auth: oauthAuth(
      "OAuth2",
      "Entra app (client credentials) for read-only DLP/compliance alerts."
    ),
    signalCategory: "Exposure",
    subcategory: "DataExposure",
    sourceType: "purview.alert",
    desc: "Microsoft Purview DLP/data-governance alerts as exposure signals.",
    capabilities: [
      "DLP policy evidence",
      "Sensitive-data classification context"
    ],
    permissions: ["InformationProtectionPolicy.Read"],
    permissionsSummary: "Read-only DLP alerts.",
    health: "Purview alerts read-only lookup.",
    sensitivity: "High"
  }),
  signalSpec({
    key: "cyera",
    vendor: "Cyera",
    product: "Cyera DSPM",
    marketplace: "Data Security",
    auth: bearerAuth("API Token", "Cyera API token for read-only data risks."),
    signalCategory: "Exposure",
    subcategory: "DataExposure",
    sourceType: "cyera.risk",
    desc: "Cyera DSPM sensitive-data risk findings as exposure signals.",
    capabilities: [
      "Data security posture evidence",
      "Sensitive-data exposure context"
    ],
    permissions: ["risks:read"],
    permissionsSummary: "Read-only data risks.",
    health: "Cyera risks read-only lookup.",
    sensitivity: "High"
  }),
  // --- Batch 2: Secrets management ---
  signalSpec({
    key: "hashicorp-vault",
    vendor: "HashiCorp",
    product: "Vault",
    marketplace: "Identity",
    category: "SecurityControl",
    auth: bearerAuth(
      "Vault Token",
      "HashiCorp Vault token for read-only audit/health."
    ),
    signalCategory: "Identity",
    subcategory: "SecretsManagement",
    sourceType: "vault.audit",
    desc: "HashiCorp Vault secrets-access/audit posture as identity signals.",
    capabilities: ["Secret-access audit evidence", "Vault seal/health context"],
    permissions: ["sys/health:read", "audit:read"],
    permissionsSummary: "Read-only audit and health.",
    health: "Vault sys/health read-only lookup."
  }),
  // --- Batch 3: SaaS Security Posture Management (SSPM) ---
  signalSpec({
    key: "obsidian-security",
    vendor: "Obsidian Security",
    product: "Obsidian SaaS Security",
    marketplace: "Data Security",
    auth: bearerAuth(
      "API Token",
      "Obsidian Security API token for read-only SaaS posture findings."
    ),
    signalCategory: "Exposure",
    subcategory: "SaaSPostureFinding",
    sourceType: "obsidian.finding",
    desc: "Obsidian Security SSPM SaaS misconfiguration and threat findings as exposure signals.",
    capabilities: [
      "SaaS misconfiguration evidence",
      "SaaS threat detection context"
    ],
    permissions: ["findings:read"],
    permissionsSummary: "Read-only SaaS posture findings.",
    health: "Obsidian findings read-only lookup.",
    sensitivity: "High"
  }),
  signalSpec({
    key: "appomni",
    vendor: "AppOmni",
    product: "AppOmni SSPM",
    marketplace: "Data Security",
    auth: bearerAuth(
      "API Token",
      "AppOmni API token for read-only SaaS posture findings."
    ),
    signalCategory: "Exposure",
    subcategory: "SaaSPostureFinding",
    sourceType: "appomni.finding",
    desc: "AppOmni SSPM SaaS configuration and data-exposure findings as exposure signals.",
    capabilities: ["SaaS posture evidence", "SaaS data-exposure context"],
    permissions: ["findings:read"],
    permissionsSummary: "Read-only SaaS posture findings.",
    health: "AppOmni findings read-only lookup.",
    sensitivity: "High"
  }),
  signalSpec({
    key: "adaptive-shield",
    vendor: "Adaptive Shield",
    product: "Adaptive Shield SSPM",
    marketplace: "Data Security",
    auth: bearerAuth(
      "API Token",
      "Adaptive Shield API token for read-only SaaS posture checks."
    ),
    signalCategory: "Exposure",
    subcategory: "SaaSPostureFinding",
    sourceType: "adaptive-shield.check",
    desc: "Adaptive Shield SSPM SaaS security-check findings as exposure signals.",
    capabilities: [
      "SaaS security-check evidence",
      "Misconfiguration drift context"
    ],
    permissions: ["checks:read"],
    permissionsSummary: "Read-only SaaS security checks.",
    health: "Adaptive Shield checks read-only lookup.",
    sensitivity: "High"
  }),
  signalSpec({
    key: "valence-security",
    vendor: "Valence Security",
    product: "Valence SaaS Security",
    marketplace: "Data Security",
    auth: bearerAuth(
      "API Token",
      "Valence Security API token for read-only SaaS risk findings."
    ),
    signalCategory: "Exposure",
    subcategory: "SaaSPostureFinding",
    sourceType: "valence.risk",
    desc: "Valence Security SSPM SaaS configuration, identity, and integration risks as exposure signals.",
    capabilities: ["SaaS risk evidence", "SaaS-to-SaaS integration context"],
    permissions: ["risks:read"],
    permissionsSummary: "Read-only SaaS risk findings.",
    health: "Valence risks read-only lookup.",
    sensitivity: "High"
  }),
  // --- Batch 3: API Security ---
  observerSpec({
    key: "salt-security",
    vendor: "Salt Security",
    product: "Salt Security API Protection",
    marketplace: "WAF/Firewall",
    auth: bearerAuth(
      "API Token",
      "Salt Security API token for read-only API attack alerts."
    ),
    outcome: "Detected",
    outcomes: ["Detected", "Alerted", "NoEvidence"],
    sourceType: "salt",
    desc: "Salt Security API attack detection evidence for control validation.",
    capabilities: [
      "API attack detection evidence",
      "Anomalous API behavior observation"
    ],
    permissions: ["alerts:read"],
    permissionsSummary: "Read-only API attack alerts.",
    health: "Salt Security alerts read-only lookup."
  }),
  observerSpec({
    key: "noname-security",
    vendor: "Akamai",
    product: "Noname API Security",
    marketplace: "WAF/Firewall",
    auth: bearerAuth(
      "API Token",
      "Noname Security API token for read-only API alerts."
    ),
    outcome: "Detected",
    outcomes: ["Detected", "Alerted", "NoEvidence"],
    sourceType: "noname",
    desc: "Akamai Noname API security alert evidence for control validation.",
    capabilities: [
      "API threat detection evidence",
      "API misconfiguration observation"
    ],
    permissions: ["alerts:read"],
    permissionsSummary: "Read-only API alerts.",
    health: "Noname alerts read-only lookup."
  }),
  signalSpec({
    key: "42crunch",
    vendor: "42Crunch",
    product: "42Crunch API Security",
    marketplace: "AppSec/SCA",
    category: "Code",
    auth: bearerAuth(
      "API Token",
      "42Crunch API token for read-only API audit results."
    ),
    signalCategory: "Exposure",
    subcategory: "ApiVulnerability",
    sourceType: "42crunch.finding",
    desc: "42Crunch API contract audit and conformance findings as exposure signals.",
    capabilities: ["OpenAPI audit evidence", "API security-posture context"],
    permissions: ["audits:read"],
    permissionsSummary: "Read-only API audit results.",
    health: "42Crunch audit read-only lookup."
  }),
  // --- Batch 3: Enterprise Browser security ---
  observerSpec({
    key: "island",
    vendor: "Island",
    product: "Island Enterprise Browser",
    marketplace: "SSE/SASE",
    auth: bearerAuth(
      "API Token",
      "Island API token for read-only policy/event reads."
    ),
    outcome: "Blocked",
    outcomes: ["Blocked", "Detected", "NoEvidence"],
    sourceType: "island",
    desc: "Island Enterprise Browser policy enforcement evidence for control validation.",
    capabilities: [
      "Browser policy enforcement evidence",
      "Last-mile data-control observation"
    ],
    permissions: ["events:read"],
    permissionsSummary: "Read-only policy events.",
    health: "Island events read-only lookup."
  }),
  observerSpec({
    key: "talon",
    vendor: "Palo Alto Networks",
    product: "Talon Enterprise Browser",
    marketplace: "SSE/SASE",
    auth: bearerAuth(
      "API Token",
      "Talon API token for read-only policy/event reads."
    ),
    outcome: "Blocked",
    outcomes: ["Blocked", "Detected", "NoEvidence"],
    sourceType: "talon",
    desc: "Palo Alto Talon Enterprise Browser policy enforcement evidence for control validation.",
    capabilities: [
      "Browser isolation evidence",
      "Data-control enforcement observation"
    ],
    permissions: ["events:read"],
    permissionsSummary: "Read-only policy events.",
    health: "Talon events read-only lookup."
  }),
  // --- Batch 3: ASPM / SCA ---
  signalSpec({
    key: "apiiro",
    vendor: "Apiiro",
    product: "Apiiro ASPM",
    marketplace: "AppSec/SCA",
    category: "Code",
    auth: bearerAuth(
      "API Token",
      "Apiiro API token for read-only application risks."
    ),
    signalCategory: "Exposure",
    subcategory: "ApplicationRisk",
    sourceType: "apiiro.risk",
    desc: "Apiiro ASPM application and design risk findings as exposure signals.",
    capabilities: ["Application risk evidence", "Code-to-runtime context"],
    permissions: ["risks:read"],
    permissionsSummary: "Read-only application risks.",
    health: "Apiiro risks read-only lookup."
  }),
  signalSpec({
    key: "cycode",
    vendor: "Cycode",
    product: "Cycode ASPM",
    marketplace: "AppSec/SCA",
    category: "Code",
    auth: bearerAuth(
      "API Token",
      "Cycode API token for read-only ASPM findings."
    ),
    signalCategory: "Exposure",
    subcategory: "ApplicationVulnerability",
    sourceType: "cycode.finding",
    desc: "Cycode ASPM/SCA/secrets findings as exposure signals.",
    capabilities: ["SCA/secrets finding evidence", "Pipeline security context"],
    permissions: ["findings:read"],
    permissionsSummary: "Read-only ASPM findings.",
    health: "Cycode findings read-only lookup."
  }),
  signalSpec({
    key: "endor-labs",
    vendor: "Endor Labs",
    product: "Endor Labs",
    marketplace: "AppSec/SCA",
    category: "Code",
    auth: bearerAuth(
      "API Token",
      "Endor Labs API token for read-only dependency findings."
    ),
    signalCategory: "Exposure",
    subcategory: "ApplicationVulnerability",
    sourceType: "endor.finding",
    desc: "Endor Labs SCA reachability-based dependency findings as exposure signals.",
    capabilities: ["Reachable dependency evidence", "Open-source risk context"],
    permissions: ["findings:read"],
    permissionsSummary: "Read-only dependency findings.",
    health: "Endor Labs findings read-only lookup."
  }),
  // --- Batch 3: DSPM / Data security ---
  signalSpec({
    key: "bigid",
    vendor: "BigID",
    product: "BigID Data Security Platform",
    marketplace: "Data Security",
    auth: bearerAuth(
      "API Token",
      "BigID API token for read-only data risk findings."
    ),
    signalCategory: "Exposure",
    subcategory: "DataExposure",
    sourceType: "bigid.finding",
    desc: "BigID DSPM sensitive-data discovery and risk findings as exposure signals.",
    capabilities: [
      "Sensitive-data discovery evidence",
      "Data-access risk context"
    ],
    permissions: ["findings:read"],
    permissionsSummary: "Read-only data risk findings.",
    health: "BigID findings read-only lookup.",
    sensitivity: "High"
  }),
  signalSpec({
    key: "sentra",
    vendor: "Sentra",
    product: "Sentra DSPM",
    marketplace: "Data Security",
    auth: bearerAuth(
      "API Token",
      "Sentra API token for read-only data risk findings."
    ),
    signalCategory: "Exposure",
    subcategory: "DataExposure",
    sourceType: "sentra.finding",
    desc: "Sentra DSPM cloud sensitive-data risk findings as exposure signals.",
    capabilities: [
      "Cloud data-security posture evidence",
      "Sensitive-data exposure context"
    ],
    permissions: ["findings:read"],
    permissionsSummary: "Read-only data risk findings.",
    health: "Sentra findings read-only lookup.",
    sensitivity: "High"
  }),
  signalSpec({
    key: "dig-security",
    vendor: "Palo Alto Networks",
    product: "Dig Security DSPM",
    marketplace: "Data Security",
    auth: bearerAuth(
      "API Token",
      "Dig Security API token for read-only data risk findings."
    ),
    signalCategory: "Exposure",
    subcategory: "DataExposure",
    sourceType: "dig.finding",
    desc: "Dig Security DSPM/DDR cloud data risk findings as exposure signals.",
    capabilities: [
      "Data security posture evidence",
      "Data detection-and-response context"
    ],
    permissions: ["findings:read"],
    permissionsSummary: "Read-only data risk findings.",
    health: "Dig Security findings read-only lookup.",
    sensitivity: "High"
  }),
  // --- Batch 3: Cloud / IaC security ---
  signalSpec({
    key: "tenable-cloud-security",
    vendor: "Tenable",
    product: "Tenable Cloud Security",
    marketplace: "VM/EAP/ASM/CNAPP",
    category: "Cloud",
    auth: keyPairAuth(
      "API Key",
      "Tenable Cloud Security API access/secret key for read-only findings.",
      "accessKey",
      "Access Key"
    ),
    signalCategory: "Cloud",
    subcategory: "CloudPostureFinding",
    sourceType: "tenable-cloud.finding",
    desc: "Tenable Cloud Security CNAPP/CIEM posture findings as cloud signals.",
    capabilities: ["CSPM finding evidence", "Cloud entitlement risk context"],
    permissions: ["findings:read"],
    permissionsSummary: "Read-only cloud findings.",
    health: "Tenable Cloud Security findings read-only lookup."
  }),
  signalSpec({
    key: "stream-security",
    vendor: "Stream Security",
    product: "Stream Security",
    marketplace: "VM/EAP/ASM/CNAPP",
    category: "Cloud",
    auth: bearerAuth(
      "API Token",
      "Stream Security API token for read-only cloud risk findings."
    ),
    signalCategory: "Cloud",
    subcategory: "CloudPostureFinding",
    sourceType: "stream-security.finding",
    desc: "Stream Security real-time cloud posture and drift findings as cloud signals.",
    capabilities: [
      "Cloud posture-drift evidence",
      "Real-time cloud risk context"
    ],
    permissions: ["findings:read"],
    permissionsSummary: "Read-only cloud risk findings.",
    health: "Stream Security findings read-only lookup."
  }),
  // --- Batch 3: Email / Collaboration security ---
  observerSpec({
    key: "sublime-security",
    vendor: "Sublime Security",
    product: "Sublime Security",
    marketplace: "Email Security",
    auth: bearerAuth(
      "API Token",
      "Sublime Security API token for read-only message/flagged-event reads."
    ),
    outcome: "Blocked",
    outcomes: ["Blocked", "Detected", "NoEvidence"],
    sourceType: "sublime",
    desc: "Sublime Security email threat detection/block evidence for control validation.",
    capabilities: [
      "Email threat detection evidence",
      "Phishing block observation"
    ],
    permissions: ["messages:read"],
    permissionsSummary: "Read-only flagged messages.",
    health: "Sublime Security messages read-only lookup."
  }),
  observerSpec({
    key: "material-security",
    vendor: "Material Security",
    product: "Material Security",
    marketplace: "Email Security",
    auth: bearerAuth(
      "API Token",
      "Material Security API token for read-only email-protection events."
    ),
    outcome: "Blocked",
    outcomes: ["Blocked", "Detected", "NoEvidence"],
    sourceType: "material",
    desc: "Material Security email protection and data-access enforcement evidence for control validation.",
    capabilities: [
      "Email account-protection evidence",
      "Sensitive-content access observation"
    ],
    permissions: ["events:read"],
    permissionsSummary: "Read-only email protection events.",
    health: "Material Security events read-only lookup."
  }),
  observerSpec({
    key: "cisco-secure-email-threat-defense",
    vendor: "Cisco",
    product: "Secure Email Threat Defense",
    marketplace: "Email Security",
    auth: oauthAuth(
      "OAuth2",
      "Cisco Secure Email Threat Defense OAuth client for read-only verdicts."
    ),
    outcome: "Blocked",
    outcomes: ["Blocked", "Detected", "NoEvidence"],
    sourceType: "cisco-email",
    desc: "Cisco Secure Email Threat Defense message verdict evidence for control validation.",
    capabilities: [
      "Email verdict evidence",
      "Phishing/BEC detection observation"
    ],
    permissions: ["messages:read"],
    permissionsSummary: "Read-only message verdicts.",
    health: "Cisco Secure Email Threat Defense verdicts read-only lookup."
  }),
  // --- Batch 3: Attack-surface management / security ratings ---
  signalSpec({
    key: "detectify",
    vendor: "Detectify",
    product: "Detectify EASM",
    marketplace: "VM/EAP/ASM/CNAPP",
    auth: apiKeyAuth(
      "API Key",
      "Detectify API key for read-only asset/finding lookups."
    ),
    signalCategory: "Exposure",
    subcategory: "ExternalAttackSurface",
    sourceType: "detectify.finding",
    desc: "Detectify EASM external-asset and vulnerability findings as exposure signals.",
    capabilities: [
      "External attack-surface evidence",
      "Web vulnerability context"
    ],
    permissions: ["findings:read"],
    permissionsSummary: "Read-only assets and findings.",
    health: "Detectify findings read-only lookup."
  }),
  signalSpec({
    key: "ionix",
    vendor: "IONIX",
    product: "IONIX ASM",
    marketplace: "VM/EAP/ASM/CNAPP",
    auth: bearerAuth(
      "API Token",
      "IONIX API token for read-only attack-surface risk findings."
    ),
    signalCategory: "Exposure",
    subcategory: "ExternalAttackSurface",
    sourceType: "ionix.risk",
    desc: "IONIX attack-surface and digital-supply-chain risk findings as exposure signals.",
    capabilities: ["Attack-surface evidence", "Connected-asset risk context"],
    permissions: ["risks:read"],
    permissionsSummary: "Read-only attack-surface risks.",
    health: "IONIX risks read-only lookup."
  }),
  // --- Batch 4: CTEM/BAS, deception, OT/ICS, GRC, bug-bounty, modern PAM/CIEM ---
  signalSpec({
    key: "xm-cyber",
    vendor: "XM Cyber",
    product: "XM Cyber Exposure Management",
    marketplace: "VM/EAP/ASM/CNAPP",
    auth: bearerAuth(
      "API Token",
      "XM Cyber API token for read-only attack-path/exposure findings."
    ),
    signalCategory: "Exposure",
    subcategory: "AttackPathExposure",
    sourceType: "xm-cyber.exposure",
    desc: "XM Cyber attack-path and choke-point exposure findings as exposure signals.",
    capabilities: [
      "Attack-path exposure evidence",
      "Choke-point/critical-asset context"
    ],
    permissions: ["entities:read", "findings:read"],
    permissionsSummary: "Read-only exposure findings.",
    health: "XM Cyber findings read-only lookup.",
    missionTypes: [
      "ValidationSnapshot",
      "ExposureValidation",
      "ContinuousValidation"
    ]
  }),
  observerSpec({
    key: "cymulate",
    vendor: "Cymulate",
    product: "Cymulate Exposure Validation",
    marketplace: "VM/EAP/ASM/CNAPP",
    auth: bearerAuth(
      "API Token",
      "Cymulate API token for read-only assessment results."
    ),
    outcome: "Blocked",
    outcomes: ["Detected", "Blocked", "Missed", "NoEvidence"],
    sourceType: "cymulate",
    desc: "Cymulate breach-and-attack-simulation control-validation results.",
    capabilities: [
      "BAS control-efficacy evidence",
      "Prevention/detection outcome observation"
    ],
    permissions: ["assessments:read"],
    permissionsSummary: "Read-only assessment results.",
    health: "Cymulate assessments read-only lookup."
  }),
  observerSpec({
    key: "pentera",
    vendor: "Pentera",
    product: "Pentera Automated Security Validation",
    marketplace: "VM/EAP/ASM/CNAPP",
    auth: bearerAuth(
      "API Token",
      "Pentera API token for read-only validation results."
    ),
    outcome: "Detected",
    outcomes: ["Detected", "Blocked", "Missed", "NoEvidence"],
    sourceType: "pentera",
    desc: "Pentera automated security validation (safe exploitation) results.",
    capabilities: [
      "Automated-pentest evidence",
      "Exploitable-path validation observation"
    ],
    permissions: ["operations:read"],
    permissionsSummary: "Read-only validation operations.",
    health: "Pentera operations read-only lookup."
  }),
  observerSpec({
    key: "safebreach",
    vendor: "SafeBreach",
    product: "SafeBreach",
    marketplace: "VM/EAP/ASM/CNAPP",
    auth: keyPairAuth(
      "API Key",
      "SafeBreach API key/account for read-only simulation results.",
      "accountId",
      "Account ID"
    ),
    outcome: "Blocked",
    outcomes: ["Detected", "Blocked", "Missed", "NoEvidence"],
    sourceType: "safebreach",
    desc: "SafeBreach breach-and-attack-simulation control-validation results.",
    capabilities: [
      "BAS control-efficacy evidence",
      "Detection/prevention outcome observation"
    ],
    permissions: ["simulations:read"],
    permissionsSummary: "Read-only simulation results.",
    health: "SafeBreach simulations read-only lookup."
  }),
  observerSpec({
    key: "picus-security",
    vendor: "Picus Security",
    product: "Picus Security Validation",
    marketplace: "VM/EAP/ASM/CNAPP",
    auth: bearerAuth(
      "API Token",
      "Picus API token for read-only validation results."
    ),
    outcome: "Blocked",
    outcomes: ["Detected", "Blocked", "Missed", "NoEvidence"],
    sourceType: "picus",
    desc: "Picus security control validation (BAS) results.",
    capabilities: [
      "BAS control-efficacy evidence",
      "Mitigation-gap observation"
    ],
    permissions: ["results:read"],
    permissionsSummary: "Read-only validation results.",
    health: "Picus results read-only lookup."
  }),
  signalSpec({
    key: "bishop-fox-cosmos",
    vendor: "Bishop Fox",
    product: "Cosmos",
    marketplace: "VM/EAP/ASM/CNAPP",
    auth: bearerAuth(
      "API Token",
      "Bishop Fox Cosmos API token for read-only exposure findings."
    ),
    signalCategory: "Exposure",
    subcategory: "ExternalAttackSurface",
    sourceType: "bishopfox.cosmos",
    desc: "Bishop Fox Cosmos continuous attack-surface findings as exposure signals.",
    capabilities: [
      "External attack-surface evidence",
      "Validated-exposure context"
    ],
    permissions: ["findings:read"],
    permissionsSummary: "Read-only exposure findings.",
    health: "Cosmos findings read-only lookup."
  }),
  observerSpec({
    key: "countercraft",
    vendor: "CounterCraft",
    product: "The Platform",
    marketplace: "NDR",
    auth: bearerAuth(
      "API Token",
      "CounterCraft API token for read-only deception alerts."
    ),
    outcome: "Detected",
    outcomes: ["Detected", "Alerted", "NoEvidence"],
    sourceType: "countercraft",
    desc: "CounterCraft cyber-deception engagement/alert evidence for control validation.",
    capabilities: [
      "Deception detection evidence",
      "Adversary-engagement observation"
    ],
    permissions: ["alerts:read"],
    permissionsSummary: "Read-only deception alerts.",
    health: "CounterCraft alerts read-only lookup."
  }),
  observerSpec({
    key: "acalvio",
    vendor: "Acalvio",
    product: "ShadowPlex",
    marketplace: "NDR",
    auth: bearerAuth(
      "API Token",
      "Acalvio ShadowPlex API token for read-only deception alerts."
    ),
    outcome: "Detected",
    outcomes: ["Detected", "Alerted", "NoEvidence"],
    sourceType: "acalvio",
    desc: "Acalvio ShadowPlex deception detection evidence for control validation.",
    capabilities: [
      "Deception detection evidence",
      "Lateral-movement observation"
    ],
    permissions: ["alerts:read"],
    permissionsSummary: "Read-only deception alerts.",
    health: "Acalvio alerts read-only lookup."
  }),
  signalSpec({
    key: "claroty",
    vendor: "Claroty",
    product: "Claroty xDome",
    marketplace: "VM/EAP/ASM/CNAPP",
    auth: bearerAuth(
      "API Token",
      "Claroty xDome API token for read-only OT/IoT asset + risk data."
    ),
    signalCategory: "Asset",
    subcategory: "OtManagedAsset",
    sourceType: "claroty.asset",
    desc: "Claroty xDome OT/IoT/IoMT asset inventory + exposure as asset/exposure signals.",
    capabilities: [
      "OT/IoT asset inventory evidence",
      "Cyber-physical exposure context"
    ],
    permissions: ["assets:read"],
    permissionsSummary: "Read-only OT asset inventory.",
    health: "Claroty assets read-only lookup."
  }),
  signalSpec({
    key: "nozomi-networks",
    vendor: "Nozomi Networks",
    product: "Nozomi Vantage",
    marketplace: "NDR",
    auth: keyPairAuth(
      "API Key",
      "Nozomi Vantage API key/secret for read-only OT/IoT alerts.",
      "apiKeyName",
      "API Key Name"
    ),
    signalCategory: "ControlObservation",
    subcategory: "OtThreatDetection",
    sourceType: "nozomi.alert",
    desc: "Nozomi Networks OT/IoT network threat detections as control-observation signals.",
    capabilities: ["OT network detection evidence", "ICS anomaly observation"],
    permissions: ["alerts:read"],
    permissionsSummary: "Read-only OT alerts.",
    health: "Nozomi alerts read-only lookup."
  }),
  signalSpec({
    key: "dragos",
    vendor: "Dragos",
    product: "Dragos Platform",
    marketplace: "VM/EAP/ASM/CNAPP",
    auth: keyPairAuth(
      "API Key",
      "Dragos API key/secret for read-only ICS vulnerability + detection data.",
      "apiKeyId",
      "API Key ID"
    ),
    signalCategory: "Exposure",
    subcategory: "OtVulnerability",
    sourceType: "dragos.finding",
    desc: "Dragos ICS/OT vulnerability + threat-detection findings as exposure signals.",
    capabilities: ["ICS vulnerability evidence", "OT threat-detection context"],
    permissions: ["assets:read", "vulnerabilities:read"],
    permissionsSummary: "Read-only ICS findings.",
    health: "Dragos findings read-only lookup."
  }),
  signalSpec({
    key: "vanta",
    vendor: "Vanta",
    product: "Vanta",
    marketplace: "Other",
    category: "Other",
    auth: bearerAuth(
      "API Token",
      "Vanta API token for read-only compliance test/control status."
    ),
    signalCategory: "Audit",
    subcategory: "CompliancePosture",
    sourceType: "vanta.test",
    desc: "Vanta automated compliance test/control posture as audit signals.",
    capabilities: [
      "Compliance control-status evidence",
      "Framework-coverage context"
    ],
    permissions: ["tests:read"],
    permissionsSummary: "Read-only compliance tests.",
    health: "Vanta tests read-only lookup."
  }),
  signalSpec({
    key: "drata",
    vendor: "Drata",
    product: "Drata",
    marketplace: "Other",
    category: "Other",
    auth: bearerAuth(
      "API Token",
      "Drata API token for read-only control/monitor status."
    ),
    signalCategory: "Audit",
    subcategory: "CompliancePosture",
    sourceType: "drata.control",
    desc: "Drata continuous-compliance control/monitor status as audit signals.",
    capabilities: ["Compliance monitor evidence", "Control-failure context"],
    permissions: ["controls:read"],
    permissionsSummary: "Read-only controls and monitors.",
    health: "Drata controls read-only lookup."
  }),
  signalSpec({
    key: "secureframe",
    vendor: "Secureframe",
    product: "Secureframe",
    marketplace: "Other",
    category: "Other",
    auth: bearerAuth(
      "API Token",
      "Secureframe API token for read-only control/test status."
    ),
    signalCategory: "Audit",
    subcategory: "CompliancePosture",
    sourceType: "secureframe.control",
    desc: "Secureframe compliance control/test posture as audit signals.",
    capabilities: [
      "Compliance control-status evidence",
      "Framework-coverage context"
    ],
    permissions: ["controls:read"],
    permissionsSummary: "Read-only controls and tests.",
    health: "Secureframe controls read-only lookup."
  }),
  signalSpec({
    key: "hackerone",
    vendor: "HackerOne",
    product: "HackerOne",
    marketplace: "VM/EAP/ASM/CNAPP",
    auth: keyPairAuth(
      "API Token",
      "HackerOne API username/token for read-only reports.",
      "apiUsername",
      "API Username"
    ),
    signalCategory: "Exposure",
    subcategory: "DisclosedVulnerability",
    sourceType: "hackerone.report",
    desc: "HackerOne crowdsourced vulnerability reports as exposure signals.",
    capabilities: [
      "Disclosed-vulnerability evidence",
      "Severity/triage context"
    ],
    permissions: ["reports:read"],
    permissionsSummary: "Read-only vulnerability reports.",
    health: "HackerOne reports read-only lookup."
  }),
  signalSpec({
    key: "bugcrowd",
    vendor: "Bugcrowd",
    product: "Bugcrowd",
    marketplace: "VM/EAP/ASM/CNAPP",
    auth: bearerAuth(
      "API Token",
      "Bugcrowd API token for read-only submissions."
    ),
    signalCategory: "Exposure",
    subcategory: "DisclosedVulnerability",
    sourceType: "bugcrowd.submission",
    desc: "Bugcrowd crowdsourced vulnerability submissions as exposure signals.",
    capabilities: [
      "Disclosed-vulnerability evidence",
      "Severity/triage context"
    ],
    permissions: ["submissions:read"],
    permissionsSummary: "Read-only submissions.",
    health: "Bugcrowd submissions read-only lookup."
  }),
  signalSpec({
    key: "teleport",
    vendor: "Teleport",
    product: "Teleport Access Platform",
    marketplace: "PAM",
    category: "Identity",
    auth: bearerAuth(
      "API Token",
      "Teleport API token for read-only access/session audit."
    ),
    signalCategory: "Identity",
    subcategory: "PrivilegedAccess",
    sourceType: "teleport.session",
    desc: "Teleport infrastructure access + session audit as identity signals.",
    capabilities: [
      "Privileged session evidence",
      "Just-in-time access context"
    ],
    permissions: ["audit:read"],
    permissionsSummary: "Read-only access/session audit.",
    health: "Teleport audit read-only lookup."
  }),
  signalSpec({
    key: "strongdm",
    vendor: "StrongDM",
    product: "StrongDM",
    marketplace: "PAM",
    category: "Identity",
    auth: keyPairAuth(
      "API Key",
      "StrongDM API access key/secret for read-only access audit.",
      "accessKey",
      "Access Key"
    ),
    signalCategory: "Identity",
    subcategory: "PrivilegedAccess",
    sourceType: "strongdm.activity",
    desc: "StrongDM infrastructure-access activity/audit as identity signals.",
    capabilities: ["Privileged access evidence", "Access-grant context"],
    permissions: ["activities:read"],
    permissionsSummary: "Read-only access activities.",
    health: "StrongDM activities read-only lookup."
  }),
  signalSpec({
    key: "keeper-security",
    vendor: "Keeper Security",
    product: "Keeper",
    marketplace: "PAM",
    category: "Identity",
    auth: bearerAuth(
      "API Token",
      "Keeper API token for read-only vault/event audit."
    ),
    signalCategory: "Identity",
    subcategory: "SecretsManagement",
    sourceType: "keeper.event",
    desc: "Keeper secrets/credential vault event audit as identity signals.",
    capabilities: [
      "Secret-access audit evidence",
      "Credential-vault posture context"
    ],
    permissions: ["events:read"],
    permissionsSummary: "Read-only vault events.",
    health: "Keeper events read-only lookup."
  }),
  signalSpec({
    key: "permiso",
    vendor: "Permiso Security",
    product: "Permiso",
    marketplace: "Identity",
    category: "Identity",
    auth: bearerAuth(
      "API Token",
      "Permiso API token for read-only identity threat detections."
    ),
    signalCategory: "Identity",
    subcategory: "IdentityThreatDetection",
    sourceType: "permiso.detection",
    desc: "Permiso cloud identity threat detections (ITDR) as identity signals.",
    capabilities: [
      "Identity threat-detection evidence",
      "Compromised-identity context"
    ],
    permissions: ["detections:read"],
    permissionsSummary: "Read-only identity detections.",
    health: "Permiso detections read-only lookup."
  }),
  observerSpec({
    key: "traceable",
    vendor: "Traceable",
    product: "Traceable API Security",
    marketplace: "WAF/Firewall",
    auth: bearerAuth(
      "API Token",
      "Traceable API token for read-only API threat events."
    ),
    outcome: "Detected",
    outcomes: ["Detected", "Blocked", "NoEvidence"],
    sourceType: "traceable",
    desc: "Traceable API-security threat detection/protection evidence for control validation.",
    capabilities: [
      "API threat detection evidence",
      "API attack-protection observation"
    ],
    permissions: ["events:read"],
    permissionsSummary: "Read-only API threat events.",
    health: "Traceable events read-only lookup."
  }),
  // --- Batch 5: SIEM, data resilience, RBVM, machine identity, mobile, ASM, k8s, SOAR ---
  observerSpec({
    key: "panther",
    vendor: "Panther",
    product: "Panther",
    marketplace: "SIEM",
    auth: bearerAuth("API Token", "Panther API token for read-only alerts."),
    outcome: "Alerted",
    outcomes: ["Alerted", "Logged", "NoEvidence", "NeedsTuning"],
    sourceType: "panther",
    desc: "Panther detection-as-code SIEM alert evidence for control validation.",
    capabilities: ["SIEM detection evidence", "Detection-as-code observation"],
    permissions: ["alerts:read"],
    permissionsSummary: "Read-only alerts.",
    health: "Panther alerts read-only lookup."
  }),
  observerSpec({
    key: "hunters",
    vendor: "Hunters",
    product: "Hunters SOC Platform",
    marketplace: "SIEM",
    auth: bearerAuth(
      "API Token",
      "Hunters API token for read-only detections."
    ),
    outcome: "Alerted",
    outcomes: ["Alerted", "Logged", "NoEvidence", "NeedsTuning"],
    sourceType: "hunters",
    desc: "Hunters SOC platform detection evidence for control validation.",
    capabilities: [
      "SIEM detection evidence",
      "Threat-signal correlation observation"
    ],
    permissions: ["detections:read"],
    permissionsSummary: "Read-only detections.",
    health: "Hunters detections read-only lookup."
  }),
  observerSpec({
    key: "gurucul",
    vendor: "Gurucul",
    product: "Gurucul REVEAL",
    marketplace: "SIEM",
    auth: bearerAuth(
      "API Token",
      "Gurucul API token for read-only risk alerts."
    ),
    outcome: "Alerted",
    outcomes: ["Alerted", "Logged", "NoEvidence", "NeedsTuning"],
    sourceType: "gurucul",
    desc: "Gurucul UEBA/SIEM risk-alert evidence for control validation.",
    capabilities: ["UEBA risk evidence", "Behavior-anomaly observation"],
    permissions: ["alerts:read"],
    permissionsSummary: "Read-only risk alerts.",
    health: "Gurucul alerts read-only lookup."
  }),
  observerSpec({
    key: "logpoint",
    vendor: "Logpoint",
    product: "Logpoint",
    marketplace: "SIEM",
    auth: bearerAuth(
      "API Token",
      "Logpoint API token for read-only incidents."
    ),
    outcome: "Alerted",
    outcomes: ["Alerted", "Logged", "NoEvidence", "NeedsTuning"],
    sourceType: "logpoint",
    desc: "Logpoint SIEM incident evidence for control validation.",
    capabilities: ["SIEM incident evidence", "Correlation-rule observation"],
    permissions: ["incidents:read"],
    permissionsSummary: "Read-only incidents.",
    health: "Logpoint incidents read-only lookup."
  }),
  signalSpec({
    key: "rubrik",
    vendor: "Rubrik",
    product: "Rubrik Security Cloud",
    marketplace: "Data Security",
    auth: bearerAuth(
      "API Token",
      "Rubrik Security Cloud API token for read-only data-risk findings."
    ),
    signalCategory: "Exposure",
    subcategory: "DataExposure",
    sourceType: "rubrik.finding",
    desc: "Rubrik data security posture + sensitive-data/anomaly findings as exposure signals.",
    capabilities: [
      "Sensitive-data exposure evidence",
      "Ransomware/anomaly context"
    ],
    permissions: ["findings:read"],
    permissionsSummary: "Read-only data-risk findings.",
    health: "Rubrik findings read-only lookup.",
    sensitivity: "High"
  }),
  signalSpec({
    key: "cohesity",
    vendor: "Cohesity",
    product: "Cohesity DataHawk",
    marketplace: "Data Security",
    auth: bearerAuth(
      "API Token",
      "Cohesity API token for read-only data-classification/threat findings."
    ),
    signalCategory: "Exposure",
    subcategory: "DataExposure",
    sourceType: "cohesity.finding",
    desc: "Cohesity DataHawk data classification + threat findings as exposure signals.",
    capabilities: [
      "Sensitive-data exposure evidence",
      "Backup-anomaly context"
    ],
    permissions: ["findings:read"],
    permissionsSummary: "Read-only data findings.",
    health: "Cohesity findings read-only lookup.",
    sensitivity: "High"
  }),
  signalSpec({
    key: "veeam",
    vendor: "Veeam",
    product: "Veeam Data Platform",
    marketplace: "Data Security",
    auth: bearerAuth(
      "API Token",
      "Veeam API token for read-only backup/malware-detection status."
    ),
    signalCategory: "Exposure",
    subcategory: "DataResilience",
    sourceType: "veeam.event",
    desc: "Veeam backup integrity + malware-detection events as exposure signals.",
    capabilities: [
      "Cyber-resilience evidence",
      "Backup malware-detection context"
    ],
    permissions: ["sessions:read"],
    permissionsSummary: "Read-only backup/malware events.",
    health: "Veeam events read-only lookup."
  }),
  signalSpec({
    key: "nucleus-security",
    vendor: "Nucleus Security",
    product: "Nucleus",
    marketplace: "VM/EAP/ASM/CNAPP",
    auth: bearerAuth(
      "API Token",
      "Nucleus API token for read-only aggregated findings."
    ),
    signalCategory: "Exposure",
    subcategory: "AggregatedVulnerability",
    sourceType: "nucleus.finding",
    desc: "Nucleus unified vulnerability-management aggregated findings as exposure signals.",
    capabilities: [
      "Aggregated-vulnerability evidence",
      "Risk-based prioritization context"
    ],
    permissions: ["findings:read"],
    permissionsSummary: "Read-only aggregated findings.",
    health: "Nucleus findings read-only lookup."
  }),
  signalSpec({
    key: "vulcan-cyber",
    vendor: "Vulcan Cyber",
    product: "Vulcan Cyber ExposureOS",
    marketplace: "VM/EAP/ASM/CNAPP",
    auth: bearerAuth(
      "API Token",
      "Vulcan Cyber API token for read-only vulnerabilities."
    ),
    signalCategory: "Exposure",
    subcategory: "AggregatedVulnerability",
    sourceType: "vulcan.vulnerability",
    desc: "Vulcan Cyber risk-based vulnerability-management findings as exposure signals.",
    capabilities: [
      "Risk-based vulnerability evidence",
      "Remediation-prioritization context"
    ],
    permissions: ["vulnerabilities:read"],
    permissionsSummary: "Read-only vulnerabilities.",
    health: "Vulcan vulnerabilities read-only lookup."
  }),
  signalSpec({
    key: "brinqa",
    vendor: "Brinqa",
    product: "Brinqa",
    marketplace: "VM/EAP/ASM/CNAPP",
    auth: bearerAuth(
      "API Token",
      "Brinqa API token for read-only risk findings."
    ),
    signalCategory: "Exposure",
    subcategory: "AggregatedVulnerability",
    sourceType: "brinqa.finding",
    desc: "Brinqa risk-operations-center aggregated vulnerability findings as exposure signals.",
    capabilities: ["Unified risk evidence", "Asset-risk-scoring context"],
    permissions: ["findings:read"],
    permissionsSummary: "Read-only risk findings.",
    health: "Brinqa findings read-only lookup."
  }),
  signalSpec({
    key: "venafi",
    vendor: "Venafi",
    product: "Venafi TLS Protect",
    marketplace: "Identity",
    category: "Identity",
    auth: bearerAuth(
      "API Token",
      "Venafi API token for read-only certificate/machine-identity inventory."
    ),
    signalCategory: "Identity",
    subcategory: "MachineIdentity",
    sourceType: "venafi.certificate",
    desc: "Venafi machine-identity (TLS certificate/key) inventory + risk as identity signals.",
    capabilities: [
      "Machine-identity inventory evidence",
      "Certificate-expiry/risk context"
    ],
    permissions: ["certificates:read"],
    permissionsSummary: "Read-only certificate inventory.",
    health: "Venafi certificates read-only lookup."
  }),
  signalSpec({
    key: "knowbe4",
    vendor: "KnowBe4",
    product: "KnowBe4",
    marketplace: "Email Security",
    auth: bearerAuth(
      "API Token",
      "KnowBe4 API token for read-only risk/phishing results."
    ),
    signalCategory: "Identity",
    subcategory: "HumanRisk",
    sourceType: "knowbe4.risk",
    desc: "KnowBe4 security-awareness + phishing-simulation human-risk scores as identity signals.",
    capabilities: ["Human-risk evidence", "Phishing-susceptibility context"],
    permissions: ["users:read"],
    permissionsSummary: "Read-only risk scores.",
    health: "KnowBe4 risk scores read-only lookup."
  }),
  signalSpec({
    key: "lookout",
    vendor: "Lookout",
    product: "Lookout Mobile Endpoint Security",
    marketplace: "MDM/Device",
    category: "Identity",
    auth: bearerAuth(
      "API Token",
      "Lookout API token for read-only mobile device risk."
    ),
    signalCategory: "Asset",
    subcategory: "MobileDeviceRisk",
    sourceType: "lookout.device",
    desc: "Lookout mobile endpoint risk + threat posture as asset signals.",
    capabilities: ["Mobile device-risk evidence", "Mobile-threat context"],
    permissions: ["devices:read"],
    permissionsSummary: "Read-only mobile device risk.",
    health: "Lookout devices read-only lookup."
  }),
  observerSpec({
    key: "zimperium",
    vendor: "Zimperium",
    product: "Zimperium MTD",
    marketplace: "MDM/Device",
    auth: bearerAuth(
      "API Token",
      "Zimperium API token for read-only mobile threat detections."
    ),
    outcome: "Detected",
    outcomes: ["Detected", "Blocked", "NoEvidence"],
    sourceType: "zimperium",
    desc: "Zimperium mobile threat defense detection evidence for control validation.",
    capabilities: [
      "Mobile-threat detection evidence",
      "On-device attack observation"
    ],
    permissions: ["threats:read"],
    permissionsSummary: "Read-only mobile threats.",
    health: "Zimperium threats read-only lookup."
  }),
  signalSpec({
    key: "microsoft-defender-easm",
    vendor: "Microsoft",
    product: "Defender EASM",
    marketplace: "VM/EAP/ASM/CNAPP",
    auth: oauthAuth(
      "OAuth2",
      "Entra app (client credentials) for read-only Defender EASM assets."
    ),
    signalCategory: "Exposure",
    subcategory: "ExternalAttackSurface",
    sourceType: "defender-easm.asset",
    desc: "Microsoft Defender EASM external-attack-surface assets + observations as exposure signals.",
    capabilities: [
      "External attack-surface evidence",
      "Internet-exposed asset context"
    ],
    permissions: ["EASM.Read.All"],
    permissionsSummary: "Read-only EASM assets.",
    health: "Defender EASM assets read-only lookup."
  }),
  signalSpec({
    key: "kubescape",
    vendor: "ARMO",
    product: "Kubescape",
    marketplace: "VM/EAP/ASM/CNAPP",
    category: "Cloud",
    auth: bearerAuth(
      "API Token",
      "ARMO/Kubescape API token for read-only Kubernetes posture findings."
    ),
    signalCategory: "Cloud",
    subcategory: "KubernetesPostureRisk",
    sourceType: "kubescape.finding",
    desc: "Kubescape Kubernetes posture + misconfiguration findings as cloud signals.",
    capabilities: [
      "K8s posture evidence",
      "Misconfiguration/compliance context"
    ],
    permissions: ["findings:read"],
    permissionsSummary: "Read-only posture findings.",
    health: "Kubescape findings read-only lookup."
  }),
  observerSpec({
    key: "radware",
    vendor: "Radware",
    product: "Radware Cloud WAF",
    marketplace: "WAF/Firewall",
    auth: bearerAuth(
      "API Token",
      "Radware API token for read-only WAF/DDoS events."
    ),
    outcome: "Blocked",
    outcomes: ["Blocked", "Detected", "NoEvidence"],
    sourceType: "radware",
    desc: "Radware Cloud WAF/DDoS block/detect evidence for control validation.",
    capabilities: [
      "WAF/DDoS verdict evidence",
      "Application-attack block observation"
    ],
    permissions: ["events:read"],
    permissionsSummary: "Read-only WAF/DDoS events.",
    health: "Radware events read-only lookup."
  }),
  observerSpec({
    key: "swimlane",
    vendor: "Swimlane",
    product: "Swimlane Turbine",
    marketplace: "SOAR/ITSM",
    auth: bearerAuth(
      "API Token",
      "Swimlane API token for read-only case/playbook status."
    ),
    outcome: "Routed",
    outcomes: ["Routed", "NeedsTuning", "NoEvidence"],
    sourceType: "swimlane",
    desc: "Swimlane Turbine SOAR case/playbook response evidence for control validation.",
    capabilities: ["SOAR automation evidence", "Case-routing observation"],
    permissions: ["cases:read"],
    permissionsSummary: "Read-only cases and playbooks.",
    health: "Swimlane cases read-only lookup."
  }),
  signalSpec({
    key: "sweet-security",
    vendor: "Sweet Security",
    product: "Sweet Security",
    marketplace: "VM/EAP/ASM/CNAPP",
    category: "Cloud",
    auth: bearerAuth(
      "API Token",
      "Sweet Security API token for read-only cloud runtime findings."
    ),
    signalCategory: "Cloud",
    subcategory: "CloudRuntimeRisk",
    sourceType: "sweet.finding",
    desc: "Sweet Security cloud runtime detection + risk findings as cloud signals.",
    capabilities: ["Cloud runtime threat evidence", "Runtime-exposure context"],
    permissions: ["findings:read"],
    permissionsSummary: "Read-only runtime findings.",
    health: "Sweet Security findings read-only lookup."
  }),
  // --- Batch 6: ITDR, microsegmentation, digital risk, bot/fraud, supply-chain, secrets ---
  signalSpec({
    key: "semperis",
    vendor: "Semperis",
    product: "Directory Services Protector",
    marketplace: "Identity",
    category: "Identity",
    auth: bearerAuth(
      "API Token",
      "Semperis API token for read-only AD security findings."
    ),
    signalCategory: "Identity",
    subcategory: "DirectoryThreatDetection",
    sourceType: "semperis.finding",
    desc: "Semperis Active Directory/Entra security posture + attack detections as identity signals.",
    capabilities: [
      "AD security posture evidence",
      "Identity attack-path context"
    ],
    permissions: ["indicators:read"],
    permissionsSummary: "Read-only AD security findings.",
    health: "Semperis findings read-only lookup."
  }),
  observerSpec({
    key: "silverfort",
    vendor: "Silverfort",
    product: "Silverfort",
    marketplace: "Identity",
    auth: bearerAuth(
      "API Token",
      "Silverfort API token for read-only auth/policy events."
    ),
    outcome: "Blocked",
    outcomes: ["Blocked", "Detected", "NoEvidence"],
    sourceType: "silverfort",
    desc: "Silverfort identity-threat-detection + MFA/auth enforcement evidence for control validation.",
    capabilities: ["Auth enforcement evidence", "ITDR observation"],
    permissions: ["events:read"],
    permissionsSummary: "Read-only auth events.",
    health: "Silverfort events read-only lookup."
  }),
  observerSpec({
    key: "illumio",
    vendor: "Illumio",
    product: "Illumio Zero Trust Segmentation",
    marketplace: "WAF/Firewall",
    auth: keyPairAuth(
      "API Key",
      "Illumio API key id/secret for read-only traffic/enforcement.",
      "apiKeyId",
      "API Key ID"
    ),
    outcome: "Blocked",
    outcomes: ["Blocked", "Detected", "NoEvidence"],
    sourceType: "illumio",
    desc: "Illumio microsegmentation enforcement/blocked-flow evidence for control validation.",
    capabilities: [
      "Segmentation enforcement evidence",
      "Lateral-movement block observation"
    ],
    permissions: ["traffic:read"],
    permissionsSummary: "Read-only traffic flows.",
    health: "Illumio traffic read-only lookup."
  }),
  observerSpec({
    key: "akamai-guardicore",
    vendor: "Akamai",
    product: "Guardicore Segmentation",
    marketplace: "WAF/Firewall",
    auth: bearerAuth(
      "API Token",
      "Guardicore API token for read-only incidents/flows."
    ),
    outcome: "Blocked",
    outcomes: ["Blocked", "Detected", "NoEvidence"],
    sourceType: "guardicore",
    desc: "Akamai Guardicore microsegmentation block/detect evidence for control validation.",
    capabilities: [
      "Segmentation enforcement evidence",
      "East-west block observation"
    ],
    permissions: ["incidents:read"],
    permissionsSummary: "Read-only incidents/flows.",
    health: "Guardicore incidents read-only lookup."
  }),
  observerSpec({
    key: "zero-networks",
    vendor: "Zero Networks",
    product: "Zero Networks Segment",
    marketplace: "WAF/Firewall",
    auth: bearerAuth(
      "API Token",
      "Zero Networks API token for read-only enforcement events."
    ),
    outcome: "Blocked",
    outcomes: ["Blocked", "Detected", "NoEvidence"],
    sourceType: "zero-networks",
    desc: "Zero Networks automated microsegmentation/MFA enforcement evidence for control validation.",
    capabilities: [
      "Segmentation enforcement evidence",
      "Just-in-time access observation"
    ],
    permissions: ["events:read"],
    permissionsSummary: "Read-only enforcement events.",
    health: "Zero Networks events read-only lookup."
  }),
  signalSpec({
    key: "zerofox",
    vendor: "ZeroFox",
    product: "ZeroFox",
    marketplace: "Threat Intelligence",
    auth: bearerAuth(
      "API Token",
      "ZeroFox API token for read-only digital-risk alerts."
    ),
    signalCategory: "Exposure",
    subcategory: "DigitalRisk",
    sourceType: "zerofox.alert",
    desc: "ZeroFox external/digital-risk-protection alerts (impersonation, leaks) as exposure signals.",
    capabilities: ["Digital-risk evidence", "Brand/impersonation context"],
    permissions: ["alerts:read"],
    permissionsSummary: "Read-only digital-risk alerts.",
    health: "ZeroFox alerts read-only lookup.",
    missionTypes: [
      "ValidationSnapshot",
      "ExposureValidation",
      "ContinuousValidation"
    ]
  }),
  signalSpec({
    key: "flashpoint",
    vendor: "Flashpoint",
    product: "Flashpoint",
    marketplace: "Threat Intelligence",
    auth: bearerAuth(
      "API Token",
      "Flashpoint API token for read-only intel reports/alerts."
    ),
    signalCategory: "Exposure",
    subcategory: "ThreatIntelReport",
    sourceType: "flashpoint.report",
    desc: "Flashpoint threat intelligence (illicit communities, leaked creds) as exposure signals.",
    capabilities: [
      "Adversary intel evidence",
      "Leaked-credential exposure context"
    ],
    permissions: ["reports:read"],
    permissionsSummary: "Read-only intel reports.",
    health: "Flashpoint reports read-only lookup.",
    missionTypes: [
      "ValidationSnapshot",
      "ExposureValidation",
      "ContinuousValidation"
    ]
  }),
  observerSpec({
    key: "human-security",
    vendor: "HUMAN Security",
    product: "HUMAN Bot Defender",
    marketplace: "WAF/Firewall",
    auth: bearerAuth(
      "API Token",
      "HUMAN API token for read-only bot mitigation events."
    ),
    outcome: "Blocked",
    outcomes: ["Blocked", "Detected", "NoEvidence"],
    sourceType: "human-security",
    desc: "HUMAN Security bot-mitigation block/detect evidence for control validation.",
    capabilities: [
      "Bot-mitigation verdict evidence",
      "Automated-attack block observation"
    ],
    permissions: ["events:read"],
    permissionsSummary: "Read-only bot events.",
    health: "HUMAN events read-only lookup."
  }),
  observerSpec({
    key: "datadome",
    vendor: "DataDome",
    product: "DataDome",
    marketplace: "WAF/Firewall",
    auth: bearerAuth(
      "API Token",
      "DataDome API token for read-only bot events."
    ),
    outcome: "Blocked",
    outcomes: ["Blocked", "Detected", "NoEvidence"],
    sourceType: "datadome",
    desc: "DataDome bot/fraud-protection block/detect evidence for control validation.",
    capabilities: [
      "Bot-protection verdict evidence",
      "Account-takeover block observation"
    ],
    permissions: ["events:read"],
    permissionsSummary: "Read-only bot events.",
    health: "DataDome events read-only lookup."
  }),
  signalSpec({
    key: "legit-security",
    vendor: "Legit Security",
    product: "Legit Security",
    marketplace: "AppSec/SCA",
    category: "Code",
    auth: bearerAuth(
      "API Token",
      "Legit Security API token for read-only ASPM findings."
    ),
    signalCategory: "Exposure",
    subcategory: "ApplicationVulnerability",
    sourceType: "legit.finding",
    desc: "Legit Security ASPM software-supply-chain + SDLC risk findings as exposure signals.",
    capabilities: [
      "SDLC/supply-chain risk evidence",
      "Pipeline-posture context"
    ],
    permissions: ["findings:read"],
    permissionsSummary: "Read-only ASPM findings.",
    health: "Legit findings read-only lookup."
  }),
  signalSpec({
    key: "ox-security",
    vendor: "OX Security",
    product: "OX Security",
    marketplace: "AppSec/SCA",
    category: "Code",
    auth: bearerAuth(
      "API Token",
      "OX Security API token for read-only ASPM findings."
    ),
    signalCategory: "Exposure",
    subcategory: "ApplicationVulnerability",
    sourceType: "ox.finding",
    desc: "OX Security ASPM end-to-end application + pipeline risk findings as exposure signals.",
    capabilities: ["ASPM risk evidence", "Pipeline/artifact context"],
    permissions: ["findings:read"],
    permissionsSummary: "Read-only ASPM findings.",
    health: "OX findings read-only lookup."
  }),
  signalSpec({
    key: "socket",
    vendor: "Socket",
    product: "Socket",
    marketplace: "AppSec/SCA",
    category: "Code",
    auth: bearerAuth(
      "API Token",
      "Socket API token for read-only dependency risk."
    ),
    signalCategory: "Exposure",
    subcategory: "DependencyRisk",
    sourceType: "socket.alert",
    desc: "Socket software-supply-chain dependency-risk alerts (malware, risky packages) as exposure signals.",
    capabilities: ["Dependency-risk evidence", "Malicious-package context"],
    permissions: ["alerts:read"],
    permissionsSummary: "Read-only dependency alerts.",
    health: "Socket alerts read-only lookup."
  }),
  signalSpec({
    key: "chainguard",
    vendor: "Chainguard",
    product: "Chainguard",
    marketplace: "AppSec/SCA",
    category: "Cloud",
    auth: bearerAuth(
      "API Token",
      "Chainguard API token for read-only image vulnerability status."
    ),
    signalCategory: "Exposure",
    subcategory: "ArtifactVulnerability",
    sourceType: "chainguard.image",
    desc: "Chainguard hardened-image vulnerability + provenance status as exposure signals.",
    capabilities: [
      "Container-image vulnerability evidence",
      "Image-provenance context"
    ],
    permissions: ["images:read"],
    permissionsSummary: "Read-only image status.",
    health: "Chainguard images read-only lookup."
  }),
  signalSpec({
    key: "akeyless",
    vendor: "Akeyless",
    product: "Akeyless Platform",
    marketplace: "PAM",
    category: "Identity",
    auth: bearerAuth(
      "API Token",
      "Akeyless API token for read-only secret/audit data."
    ),
    signalCategory: "Identity",
    subcategory: "SecretsManagement",
    sourceType: "akeyless.audit",
    desc: "Akeyless secrets-management access/audit posture as identity signals.",
    capabilities: ["Secret-access audit evidence", "Secrets-posture context"],
    permissions: ["audit:read"],
    permissionsSummary: "Read-only secret audit.",
    health: "Akeyless audit read-only lookup."
  }),
  signalSpec({
    key: "doppler",
    vendor: "Doppler",
    product: "Doppler",
    marketplace: "PAM",
    category: "Identity",
    auth: bearerAuth(
      "API Token",
      "Doppler API token for read-only secret/activity logs."
    ),
    signalCategory: "Identity",
    subcategory: "SecretsManagement",
    sourceType: "doppler.activity",
    desc: "Doppler secrets-management activity/audit logs as identity signals.",
    capabilities: [
      "Secret-access audit evidence",
      "Config-secret posture context"
    ],
    permissions: ["logs:read"],
    permissionsSummary: "Read-only activity logs.",
    health: "Doppler logs read-only lookup."
  }),
  observerSpec({
    key: "cofense",
    vendor: "Cofense",
    product: "Cofense",
    marketplace: "Email Security",
    auth: bearerAuth(
      "API Token",
      "Cofense API token for read-only reported-phishing data."
    ),
    outcome: "Detected",
    outcomes: ["Detected", "Blocked", "NoEvidence"],
    sourceType: "cofense",
    desc: "Cofense phishing-detection-and-response evidence for control validation.",
    capabilities: [
      "Phishing detection evidence",
      "User-reported-threat observation"
    ],
    permissions: ["reports:read"],
    permissionsSummary: "Read-only phishing reports.",
    health: "Cofense reports read-only lookup."
  }),
  observerSpec({
    key: "ironscales",
    vendor: "IRONSCALES",
    product: "IRONSCALES",
    marketplace: "Email Security",
    auth: bearerAuth(
      "API Token",
      "IRONSCALES API token for read-only incidents."
    ),
    outcome: "Blocked",
    outcomes: ["Detected", "Blocked", "NoEvidence"],
    sourceType: "ironscales",
    desc: "IRONSCALES email-security incident block/detect evidence for control validation.",
    capabilities: [
      "Email threat detection evidence",
      "Phishing-remediation observation"
    ],
    permissions: ["incidents:read"],
    permissionsSummary: "Read-only email incidents.",
    health: "IRONSCALES incidents read-only lookup."
  }),
  signalSpec({
    key: "tigera",
    vendor: "Tigera",
    product: "Calico Cloud",
    marketplace: "VM/EAP/ASM/CNAPP",
    category: "Cloud",
    auth: bearerAuth(
      "API Token",
      "Tigera Calico Cloud API token for read-only k8s security findings."
    ),
    signalCategory: "Cloud",
    subcategory: "KubernetesPostureRisk",
    sourceType: "tigera.finding",
    desc: "Tigera Calico Cloud Kubernetes network-security + runtime findings as cloud signals.",
    capabilities: [
      "K8s network-policy evidence",
      "Container runtime-risk context"
    ],
    permissions: ["findings:read"],
    permissionsSummary: "Read-only k8s findings.",
    health: "Calico Cloud findings read-only lookup."
  }),
  observerSpec({
    key: "stamus-networks",
    vendor: "Stamus Networks",
    product: "Stamus Security Platform",
    marketplace: "NDR",
    auth: bearerAuth(
      "API Token",
      "Stamus API token for read-only declarations/detections."
    ),
    outcome: "Detected",
    outcomes: ["Detected", "Alerted", "NoEvidence"],
    sourceType: "stamus",
    desc: "Stamus Networks NDR detection evidence for control validation.",
    capabilities: [
      "Network detection evidence",
      "Threat-declaration observation"
    ],
    permissions: ["detections:read"],
    permissionsSummary: "Read-only detections.",
    health: "Stamus detections read-only lookup."
  }),
  // --- Batch 7: EDR breadth, DAST, IGA, UEM, data resilience, ZTNA, TI, EASM, PKI ---
  observerSpec({
    key: "eset",
    vendor: "ESET",
    product: "ESET Inspect",
    marketplace: "EDR/XDR",
    auth: bearerAuth(
      "API Token",
      "ESET Inspect API token for read-only detections."
    ),
    outcome: "Detected",
    outcomes: ["Detected", "Blocked", "Missed", "NoEvidence"],
    sourceType: "eset",
    desc: "ESET Inspect EDR detection/remediation evidence for control validation.",
    capabilities: ["EDR detection evidence", "Endpoint block observation"],
    permissions: ["detections:read"],
    permissionsSummary: "Read-only detections.",
    health: "ESET detections read-only lookup."
  }),
  observerSpec({
    key: "deep-instinct",
    vendor: "Deep Instinct",
    product: "Deep Instinct DSF",
    marketplace: "EDR/XDR",
    auth: bearerAuth(
      "API Token",
      "Deep Instinct API token for read-only prevention events."
    ),
    outcome: "Blocked",
    outcomes: ["Detected", "Blocked", "Missed", "NoEvidence"],
    sourceType: "deep-instinct",
    desc: "Deep Instinct deep-learning prevention evidence for control validation.",
    capabilities: [
      "Endpoint prevention evidence",
      "Pre-execution block observation"
    ],
    permissions: ["events:read"],
    permissionsSummary: "Read-only prevention events.",
    health: "Deep Instinct events read-only lookup."
  }),
  observerSpec({
    key: "morphisec",
    vendor: "Morphisec",
    product: "Morphisec",
    marketplace: "EDR/XDR",
    auth: bearerAuth(
      "API Token",
      "Morphisec API token for read-only prevention events."
    ),
    outcome: "Blocked",
    outcomes: ["Detected", "Blocked", "Missed", "NoEvidence"],
    sourceType: "morphisec",
    desc: "Morphisec moving-target-defense prevention evidence for control validation.",
    capabilities: [
      "Memory-attack prevention evidence",
      "In-memory block observation"
    ],
    permissions: ["events:read"],
    permissionsSummary: "Read-only prevention events.",
    health: "Morphisec events read-only lookup."
  }),
  observerSpec({
    key: "withsecure",
    vendor: "WithSecure",
    product: "WithSecure Elements",
    marketplace: "EDR/XDR",
    auth: oauthAuth(
      "OAuth2",
      "WithSecure Elements API client credentials for read-only detections."
    ),
    outcome: "Detected",
    outcomes: ["Detected", "Blocked", "Missed", "NoEvidence"],
    sourceType: "withsecure",
    desc: "WithSecure Elements EDR detection evidence for control validation.",
    capabilities: ["EDR detection evidence", "Endpoint response observation"],
    permissions: ["detections:read"],
    permissionsSummary: "Read-only detections.",
    health: "WithSecure detections read-only lookup."
  }),
  signalSpec({
    key: "invicti",
    vendor: "Invicti",
    product: "Invicti",
    marketplace: "AppSec/SCA",
    category: "Code",
    auth: apiKeyAuth(
      "API Key",
      "Invicti API key for read-only web-app scan findings."
    ),
    signalCategory: "Exposure",
    subcategory: "ApplicationVulnerability",
    sourceType: "invicti.finding",
    desc: "Invicti DAST web-application vulnerability findings as exposure signals.",
    capabilities: ["Web vulnerability evidence", "Proof-based scan context"],
    permissions: ["scans:read"],
    permissionsSummary: "Read-only scan findings.",
    health: "Invicti scans read-only lookup."
  }),
  signalSpec({
    key: "acunetix",
    vendor: "Invicti",
    product: "Acunetix",
    marketplace: "AppSec/SCA",
    category: "Code",
    auth: apiKeyAuth(
      "API Key",
      "Acunetix API key for read-only web-app scan findings."
    ),
    signalCategory: "Exposure",
    subcategory: "ApplicationVulnerability",
    sourceType: "acunetix.finding",
    desc: "Acunetix DAST web-application vulnerability findings as exposure signals.",
    capabilities: ["Web vulnerability evidence", "Crawl-and-scan context"],
    permissions: ["vulnerabilities:read"],
    permissionsSummary: "Read-only scan findings.",
    health: "Acunetix scans read-only lookup."
  }),
  signalSpec({
    key: "brightsec",
    vendor: "Bright Security",
    product: "Bright",
    marketplace: "AppSec/SCA",
    category: "Code",
    auth: bearerAuth(
      "API Token",
      "Bright Security API token for read-only DAST findings."
    ),
    signalCategory: "Exposure",
    subcategory: "ApplicationVulnerability",
    sourceType: "bright.finding",
    desc: "Bright Security developer-first DAST findings as exposure signals.",
    capabilities: [
      "API/web vulnerability evidence",
      "Low-false-positive scan context"
    ],
    permissions: ["scans:read"],
    permissionsSummary: "Read-only scan findings.",
    health: "Bright scans read-only lookup."
  }),
  signalSpec({
    key: "omada",
    vendor: "Omada",
    product: "Omada Identity Cloud",
    marketplace: "Identity",
    category: "Identity",
    auth: oauthAuth(
      "OAuth2",
      "Omada API client credentials for read-only identity-governance data."
    ),
    signalCategory: "Identity",
    subcategory: "IdentityGovernance",
    sourceType: "omada.access",
    desc: "Omada identity-governance entitlement/access posture as identity signals.",
    capabilities: [
      "Entitlement-governance evidence",
      "Access-certification context"
    ],
    permissions: ["access:read"],
    permissionsSummary: "Read-only access governance.",
    health: "Omada access read-only lookup."
  }),
  signalSpec({
    key: "one-identity",
    vendor: "One Identity",
    product: "One Identity Manager",
    marketplace: "Identity",
    category: "Identity",
    auth: bearerAuth(
      "API Token",
      "One Identity API token for read-only governance data."
    ),
    signalCategory: "Identity",
    subcategory: "IdentityGovernance",
    sourceType: "one-identity.entitlement",
    desc: "One Identity Manager entitlement/governance posture as identity signals.",
    capabilities: [
      "Entitlement-governance evidence",
      "Privileged-access context"
    ],
    permissions: ["entitlements:read"],
    permissionsSummary: "Read-only entitlements.",
    health: "One Identity read-only lookup."
  }),
  signalSpec({
    key: "rsa-securid",
    vendor: "RSA",
    product: "RSA SecurID / ID Plus",
    marketplace: "Identity",
    category: "Identity",
    auth: keyPairAuth(
      "API Key",
      "RSA ID Plus API key/id for read-only authentication events.",
      "clientKeyId",
      "Client Key ID"
    ),
    signalCategory: "Identity",
    subcategory: "AuthenticationActivity",
    sourceType: "rsa.auth-event",
    desc: "RSA SecurID / ID Plus MFA authentication-event posture as identity signals.",
    capabilities: ["MFA authentication evidence", "Step-up/risk-auth context"],
    permissions: ["events:read"],
    permissionsSummary: "Read-only authentication events.",
    health: "RSA auth events read-only lookup."
  }),
  signalSpec({
    key: "ivanti-neurons",
    vendor: "Ivanti",
    product: "Ivanti Neurons",
    marketplace: "MDM/Device",
    auth: bearerAuth(
      "API Token",
      "Ivanti Neurons API token for read-only device/patch posture."
    ),
    signalCategory: "Asset",
    subcategory: "ManagedDevicePosture",
    sourceType: "ivanti.device",
    desc: "Ivanti Neurons UEM/patch device-compliance posture as asset signals.",
    capabilities: ["Device-compliance evidence", "Patch-posture context"],
    permissions: ["devices:read"],
    permissionsSummary: "Read-only device posture.",
    health: "Ivanti devices read-only lookup."
  }),
  signalSpec({
    key: "automox",
    vendor: "Automox",
    product: "Automox",
    marketplace: "MDM/Device",
    auth: apiKeyAuth(
      "API Key",
      "Automox API key for read-only device/patch status."
    ),
    signalCategory: "Asset",
    subcategory: "PatchPosture",
    sourceType: "automox.device",
    desc: "Automox endpoint patch/configuration posture as asset signals.",
    capabilities: ["Patch-compliance evidence", "Endpoint-hardening context"],
    permissions: ["devices:read"],
    permissionsSummary: "Read-only device/patch status.",
    health: "Automox devices read-only lookup."
  }),
  signalSpec({
    key: "vmware-workspace-one",
    vendor: "Omnissa",
    product: "Workspace ONE",
    marketplace: "MDM/Device",
    auth: oauthAuth(
      "OAuth2",
      "Workspace ONE API client credentials for read-only device compliance."
    ),
    signalCategory: "Asset",
    subcategory: "ManagedDevicePosture",
    sourceType: "workspace-one.device",
    desc: "Omnissa Workspace ONE UEM device-compliance posture as asset signals.",
    capabilities: [
      "Device-compliance evidence",
      "Mobile/desktop posture context"
    ],
    permissions: ["devices:read"],
    permissionsSummary: "Read-only device compliance.",
    health: "Workspace ONE devices read-only lookup."
  }),
  signalSpec({
    key: "druva",
    vendor: "Druva",
    product: "Druva Data Security Cloud",
    marketplace: "Data Security",
    auth: bearerAuth(
      "API Token",
      "Druva API token for read-only backup/anomaly data."
    ),
    signalCategory: "Exposure",
    subcategory: "DataResilience",
    sourceType: "druva.event",
    desc: "Druva backup integrity + ransomware-anomaly events as exposure signals.",
    capabilities: ["Cyber-resilience evidence", "Backup-anomaly context"],
    permissions: ["events:read"],
    permissionsSummary: "Read-only backup events.",
    health: "Druva events read-only lookup."
  }),
  signalSpec({
    key: "commvault",
    vendor: "Commvault",
    product: "Commvault Cloud",
    marketplace: "Data Security",
    auth: bearerAuth(
      "API Token",
      "Commvault API token for read-only backup/threat data."
    ),
    signalCategory: "Exposure",
    subcategory: "DataResilience",
    sourceType: "commvault.event",
    desc: "Commvault Cloud backup integrity + threat-scan events as exposure signals.",
    capabilities: ["Cyber-resilience evidence", "Backup threat-scan context"],
    permissions: ["events:read"],
    permissionsSummary: "Read-only backup events.",
    health: "Commvault events read-only lookup."
  }),
  observerSpec({
    key: "zscaler-zpa",
    vendor: "Zscaler",
    product: "Zscaler Private Access",
    marketplace: "SSE/SASE",
    auth: keyPairAuth(
      "API Key",
      "Zscaler ZPA client id/secret for read-only access logs.",
      "clientId",
      "Client ID"
    ),
    outcome: "Blocked",
    outcomes: ["Blocked", "Detected", "NoEvidence"],
    sourceType: "zscaler-zpa",
    desc: "Zscaler Private Access ZTNA access-policy enforcement evidence for control validation.",
    capabilities: [
      "ZTNA enforcement evidence",
      "Private-app access observation"
    ],
    permissions: ["logs:read"],
    permissionsSummary: "Read-only access logs.",
    health: "Zscaler ZPA logs read-only lookup."
  }),
  signalSpec({
    key: "cybersixgill",
    vendor: "Cybersixgill",
    product: "Cybersixgill",
    marketplace: "Threat Intelligence",
    auth: bearerAuth(
      "API Token",
      "Cybersixgill API token for read-only intel items."
    ),
    signalCategory: "Exposure",
    subcategory: "ThreatIntelReport",
    sourceType: "cybersixgill.item",
    desc: "Cybersixgill deep/dark-web threat intelligence as exposure signals.",
    capabilities: [
      "Underground-intel evidence",
      "Leaked-data/CVE-chatter context"
    ],
    permissions: ["intel:read"],
    permissionsSummary: "Read-only intel items.",
    health: "Cybersixgill intel read-only lookup.",
    missionTypes: [
      "ValidationSnapshot",
      "ExposureValidation",
      "ContinuousValidation"
    ]
  }),
  signalSpec({
    key: "group-ib",
    vendor: "Group-IB",
    product: "Group-IB Threat Intelligence",
    marketplace: "Threat Intelligence",
    auth: keyPairAuth(
      "API Key",
      "Group-IB API username/key for read-only intel.",
      "apiUsername",
      "API Username"
    ),
    signalCategory: "Exposure",
    subcategory: "ThreatIntelReport",
    sourceType: "group-ib.indicator",
    desc: "Group-IB threat intelligence (threat actors, compromised data) as exposure signals.",
    capabilities: ["Adversary-intel evidence", "Compromised-asset context"],
    permissions: ["intel:read"],
    permissionsSummary: "Read-only intel.",
    health: "Group-IB intel read-only lookup.",
    missionTypes: [
      "ValidationSnapshot",
      "ExposureValidation",
      "ContinuousValidation"
    ]
  }),
  signalSpec({
    key: "cycognito",
    vendor: "CyCognito",
    product: "CyCognito",
    marketplace: "VM/EAP/ASM/CNAPP",
    auth: bearerAuth(
      "API Token",
      "CyCognito API token for read-only exposed-asset findings."
    ),
    signalCategory: "Exposure",
    subcategory: "ExternalAttackSurface",
    sourceType: "cycognito.issue",
    desc: "CyCognito external attack-surface exposed-asset findings as exposure signals.",
    capabilities: [
      "External attack-surface evidence",
      "Discovered-asset risk context"
    ],
    permissions: ["issues:read"],
    permissionsSummary: "Read-only exposure findings.",
    health: "CyCognito issues read-only lookup."
  }),
  signalSpec({
    key: "keyfactor",
    vendor: "Keyfactor",
    product: "Keyfactor Command",
    marketplace: "Identity",
    category: "Identity",
    auth: bearerAuth(
      "API Token",
      "Keyfactor API token for read-only certificate inventory."
    ),
    signalCategory: "Identity",
    subcategory: "MachineIdentity",
    sourceType: "keyfactor.certificate",
    desc: "Keyfactor machine-identity (PKI certificate) inventory + risk as identity signals.",
    capabilities: [
      "Machine-identity inventory evidence",
      "Certificate-lifecycle risk context"
    ],
    permissions: ["certificates:read"],
    permissionsSummary: "Read-only certificate inventory.",
    health: "Keyfactor certificates read-only lookup."
  })
];

export function marketLeaderConnectors(): Connector[] {
  return MARKET_LEADER_SPECS.map(createStandardConnector);
}

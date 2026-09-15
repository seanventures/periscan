/**
 * Connector Production qualification harness (PERISCAN-467).
 *
 * Elevating a catalog connector to Production requires a design-partner
 * live-smoke receipt that covers the full checklist in
 * docs/ops/CONNECTOR_PRODUCTION_QUALIFICATION.md. Fixture contract tests,
 * mock observers, and partial checklists are never sufficient.
 *
 * This module:
 * - Defines the receipt schema (structured evidence packet)
 * - Automates checklist completeness evaluation
 * - Provides a fail-closed dry-run path (honest NotConfigured when live keys missing)
 * - Gates productionCertified elevation so it cannot pass without required fields
 *
 * Real-First: never invent partner credentials or mint Production without a
 * validated receipt. Catalog generators must keep productionCertified false
 * until a receipt evaluation returns EligibleForElevation.
 */

import { z } from "zod";

import {
  resolveExternalIntegrationTier,
  type ExternalIntegrationTier
} from "./integration-external-tiers";

/** Checklist items required for Production elevation (§2 of the runbook). */
export const PRODUCTION_QUAL_CHECKLIST_ITEMS = [
  "health_probe",
  "technique_observe",
  "redaction",
  "rate_limits",
  "tenant_isolation",
  "audit"
] as const;

export const ProductionQualChecklistItemSchema = z.enum(
  PRODUCTION_QUAL_CHECKLIST_ITEMS
);
export type ProductionQualChecklistItem = z.infer<
  typeof ProductionQualChecklistItemSchema
>;

export const ProductionQualChecklistResultSchema = z.enum(["PASS", "FAIL"]);
export type ProductionQualChecklistResult = z.infer<
  typeof ProductionQualChecklistResultSchema
>;

export const ProductionQualChecklistEntrySchema = z.object({
  item: ProductionQualChecklistItemSchema,
  result: ProductionQualChecklistResultSchema,
  /** Operator notes — never paste secrets. */
  notes: z.string().max(2000).optional()
});
export type ProductionQualChecklistEntry = z.infer<
  typeof ProductionQualChecklistEntrySchema
>;

/**
 * Structured Production qualification receipt.
 * Mirrors the Plane evidence packet in CONNECTOR_PRODUCTION_QUALIFICATION.md §4.2.
 */
export const ConnectorProductionQualificationReceiptSchema = z
  .object({
    schemaVersion: z.literal(1).default(1),
    connectorKey: z
      .string()
      .min(1)
      .regex(/^[a-z0-9][a-z0-9-]*$/, "connectorKey must be lowercase kebab-case"),
    dateUtc: z
      .string()
      .min(1)
      .refine(
        (value) => !Number.isNaN(Date.parse(value)),
        "dateUtc must be a parseable ISO-8601 timestamp"
      ),
    operator: z.string().min(1).max(200),
    periscanTenantId: z.string().min(1).max(128),
    partnerVendorTenant: z.string().min(1).max(500),
    integrationId: z.string().min(1).max(128),
    /** Auth method kind only (e.g. oauth2ClientCredentials) — never secrets. */
    authMethodUsed: z.string().min(1).max(100),
    commitSha: z
      .string()
      .min(7)
      .max(64)
      .regex(/^[0-9a-fA-F]+$/, "commitSha must be a hex git SHA"),
    /** Plane issue id or URL reference for the evidence packet. */
    planeIssueRef: z.string().min(1).max(500),
    // Incomplete checklists parse so the gate can report missing items as
    // Blocked (not only InvalidReceipt). Elevation still requires all six PASS.
    checklist: z.array(ProductionQualChecklistEntrySchema),
    liveCredentialsUsed: z.literal(true),
    mockMode: z.literal(false),
    fixtureOnlyPath: z.literal(false),
    residualNotes: z.string().max(4000).optional()
  })
  .strict();

export type ConnectorProductionQualificationReceipt = z.infer<
  typeof ConnectorProductionQualificationReceiptSchema
>;

export const ProductionElevationDecisionSchema = z.enum([
  /** All receipt fields valid and checklist fully PASS — safe to elevate. */
  "EligibleForElevation",
  /** Receipt present but incomplete / failing / dishonest flags. */
  "Blocked",
  /** Live vendor keys missing for dry-run / smoke — honest NotConfigured. */
  "NotConfigured",
  /** Input failed schema parse before checklist evaluation. */
  "InvalidReceipt"
]);
export type ProductionElevationDecision = z.infer<
  typeof ProductionElevationDecisionSchema
>;

export type ProductionElevationEvaluation = {
  decision: ProductionElevationDecision;
  allowed: boolean;
  connectorKey?: string;
  failures: string[];
  missingChecklistItems: ProductionQualChecklistItem[];
  failedChecklistItems: ProductionQualChecklistItem[];
  /** External tier that would apply if elevation were applied. */
  resultingExternalTier: ExternalIntegrationTier;
};

export class ProductionElevationBlockedError extends Error {
  readonly code = "production_elevation_blocked" as const;
  readonly evaluation: ProductionElevationEvaluation;

  constructor(evaluation: ProductionElevationEvaluation) {
    super(
      evaluation.failures.length > 0
        ? `Production elevation blocked: ${evaluation.failures.join("; ")}`
        : "Production elevation blocked"
    );
    this.name = "ProductionElevationBlockedError";
    this.evaluation = evaluation;
  }
}

const CHECKLIST_SET = new Set<string>(PRODUCTION_QUAL_CHECKLIST_ITEMS);

/**
 * Evaluate whether a receipt authorizes Production elevation.
 * Fail-closed: any missing required field, non-PASS checklist item, mock/fixture
 * path, or schema violation denies elevation.
 */
export function evaluateProductionElevation(
  receiptInput: unknown
): ProductionElevationEvaluation {
  const parsed = ConnectorProductionQualificationReceiptSchema.safeParse(
    receiptInput
  );

  if (!parsed.success) {
    const failures = parsed.error.issues.map(
      (issue) => `${issue.path.join(".") || "receipt"}: ${issue.message}`
    );
    return {
      decision: "InvalidReceipt",
      allowed: false,
      failures:
        failures.length > 0
          ? failures
          : ["Receipt failed schema validation"],
      missingChecklistItems: [...PRODUCTION_QUAL_CHECKLIST_ITEMS],
      failedChecklistItems: [],
      resultingExternalTier: "Beta"
    };
  }

  const receipt = parsed.data;
  const failures: string[] = [];
  const byItem = new Map<ProductionQualChecklistItem, ProductionQualChecklistEntry>();

  for (const entry of receipt.checklist) {
    if (!CHECKLIST_SET.has(entry.item)) {
      failures.push(`Unknown checklist item: ${entry.item}`);
      continue;
    }
    // Last write wins if duplicates; duplicate detection below.
    if (byItem.has(entry.item)) {
      failures.push(`Duplicate checklist item: ${entry.item}`);
    }
    byItem.set(entry.item, entry);
  }

  const missingChecklistItems = PRODUCTION_QUAL_CHECKLIST_ITEMS.filter(
    (item) => !byItem.has(item)
  );
  for (const item of missingChecklistItems) {
    failures.push(`Missing required checklist item: ${item}`);
  }

  const failedChecklistItems = PRODUCTION_QUAL_CHECKLIST_ITEMS.filter((item) => {
    const entry = byItem.get(item);
    return entry != null && entry.result !== "PASS";
  });
  for (const item of failedChecklistItems) {
    failures.push(`Checklist item not PASS: ${item}`);
  }

  // Explicit honesty flags are z.literal-gated, but defend in evaluation too.
  if (receipt.liveCredentialsUsed !== true) {
    failures.push("liveCredentialsUsed must be true");
  }
  if (receipt.mockMode !== false) {
    failures.push("mockMode must be false");
  }
  if (receipt.fixtureOnlyPath !== false) {
    failures.push("fixtureOnlyPath must be false");
  }

  if (failures.length > 0) {
    return {
      decision: "Blocked",
      allowed: false,
      connectorKey: receipt.connectorKey,
      failures,
      missingChecklistItems,
      failedChecklistItems,
      resultingExternalTier: "Beta"
    };
  }

  return {
    decision: "EligibleForElevation",
    allowed: true,
    connectorKey: receipt.connectorKey,
    failures: [],
    missingChecklistItems: [],
    failedChecklistItems: [],
    resultingExternalTier: resolveExternalIntegrationTier({
      availability: "Production",
      connectable: true,
      live: true,
      productionCertified: true
    })
  };
}

/**
 * Hard gate: throws ProductionElevationBlockedError unless receipt is eligible.
 * Call this before any catalog/generator change that sets productionCertified.
 */
export function assertCanElevateToProduction(receiptInput: unknown): {
  receipt: ConnectorProductionQualificationReceipt;
  evaluation: ProductionElevationEvaluation;
} {
  const evaluation = evaluateProductionElevation(receiptInput);
  if (!evaluation.allowed) {
    throw new ProductionElevationBlockedError(evaluation);
  }
  // Re-parse after gate — evaluation already validated schema.
  const receipt =
    ConnectorProductionQualificationReceiptSchema.parse(receiptInput);
  return { receipt, evaluation };
}

/**
 * Build a productionCertified board override only from a validated receipt.
 * Returns null when elevation is not allowed (callers keep Beta defaults).
 */
export function buildProductionCertifiedOverrideFromReceipt(
  receiptInput: unknown
): {
  productionCertified: true;
  evidenceNote: string;
  connectorKey: string;
} | null {
  const evaluation = evaluateProductionElevation(receiptInput);
  if (!evaluation.allowed || !evaluation.connectorKey) {
    return null;
  }
  const receipt =
    ConnectorProductionQualificationReceiptSchema.parse(receiptInput);
  return {
    productionCertified: true,
    connectorKey: receipt.connectorKey,
    evidenceNote: `Customer-credential live-smoke certified (${receipt.dateUtc}; plane ${receipt.planeIssueRef}; commit ${receipt.commitSha.slice(0, 12)}).`
  };
}

// ---------------------------------------------------------------------------
// Dry-run / live-key readiness (fail closed → NotConfigured)
// ---------------------------------------------------------------------------

/**
 * Known env var names used by design-partner live smoke for priority connectors.
 * Presence of env vars does NOT elevate to Production — it only unlocks dry-run
 * progression past NotConfigured. Values are never logged by this harness.
 */
export const CONNECTOR_LIVE_SMOKE_ENV_KEYS: Readonly<
  Record<string, readonly string[]>
> = {
  crowdstrike: ["CS_CLIENT_ID", "CS_CLIENT_SECRET"],
  splunk: ["SPLUNK_TOKEN", "SPLUNK_BASE_URL"],
  tenable: ["TENABLE_ACCESS_KEY", "TENABLE_SECRET_KEY"],
  "palo-cortex-xdr": ["CORTEX_API_KEY", "CORTEX_KEY_ID", "CORTEX_BASE_URL"],
  // XSIAM reuses the Cortex XDR-compatible incident REST surface; declare
  // distinct env names so customer-qual dry-run stays XSIAM-specific.
  "palo-cortex-xsiam": ["XSIAM_API_KEY", "XSIAM_KEY_ID", "XSIAM_BASE_URL"],
  "palo-panorama": ["PANOS_API_KEY", "PANOS_BASE_URL"],
  sentinelone: ["SENTINELONE_API_TOKEN", "SENTINELONE_BASE_URL"],
  "ibm-qradar": ["QRADAR_TOKEN", "QRADAR_BASE_URL"],
  "datadog-siem": ["DATADOG_API_KEY", "DATADOG_APP_KEY"],
  wiz: ["WIZ_CLIENT_ID", "WIZ_CLIENT_SECRET"],
  // Read-only vCenter inventory — live needs customer vSphere.
  "vmware-vcenter": [
    "VCENTER_BASE_URL",
    "VCENTER_USERNAME",
    "VCENTER_PASSWORD"
  ],
  okta: ["OKTA_API_TOKEN", "OKTA_DOMAIN"]
};

/**
 * Analyst scorecard rows 72–78 (customer-qualification integrations).
 * Dry-run connection probe covers these keys only — never invent live creds.
 */
export const CUSTOMER_QUAL_CONNECTOR_KEYS = [
  "crowdstrike",
  "palo-cortex-xsiam",
  "wiz",
  "datadog-siem",
  "tenable",
  "ibm-qradar",
  "vmware-vcenter"
] as const;

export type CustomerQualConnectorKey =
  (typeof CUSTOMER_QUAL_CONNECTOR_KEYS)[number];

export type ConnectorLiveCredentialStatus = {
  connectorKey: string;
  status: "Ready" | "NotConfigured";
  requiredKeys: readonly string[];
  missingKeys: string[];
  /** True when this connector has a known env-key map in the harness. */
  harnessKnown: boolean;
};

/**
 * Probe whether live smoke credentials are configured for a connector.
 * Honest NotConfigured when any required key is missing or empty.
 * Does not read or return secret values.
 */
export function resolveConnectorLiveCredentialStatus(
  connectorKey: string,
  env: Record<string, string | undefined> = {}
): ConnectorLiveCredentialStatus {
  const requiredKeys = CONNECTOR_LIVE_SMOKE_ENV_KEYS[connectorKey];
  if (!requiredKeys) {
    return {
      connectorKey,
      status: "NotConfigured",
      requiredKeys: [],
      missingKeys: [],
      harnessKnown: false
    };
  }

  const missingKeys = requiredKeys.filter((key) => {
    const value = env[key];
    return value == null || String(value).trim() === "";
  });

  return {
    connectorKey,
    status: missingKeys.length === 0 ? "Ready" : "NotConfigured",
    requiredKeys,
    missingKeys,
    harnessKnown: true
  };
}

export type ConnectorProductionQualDryRunResult = {
  connectorKey: string;
  /** Overall dry-run outcome — never Eligible when keys missing. */
  decision: ProductionElevationDecision;
  allowed: boolean;
  credentialStatus: ConnectorLiveCredentialStatus;
  elevation?: ProductionElevationEvaluation;
  summary: string;
};

/**
 * Dry-run Production qualification path.
 *
 * Fail-closed rules:
 * 1. Missing live keys → NotConfigured (never pretend ready)
 * 2. Keys present but no/invalid receipt → Blocked / InvalidReceipt (still not elevated)
 * 3. Valid full receipt → EligibleForElevation (code may then set productionCertified)
 *
 * Never contacts vendor APIs — that remains the live-smoke runbook.
 * Never invents credentials or receipts.
 */
export function runConnectorProductionQualDryRun(options: {
  connectorKey: string;
  /**
   * Env map to probe (pass `process.env` from Node CLIs). Defaults to empty —
   * fail-closed NotConfigured when keys are absent.
   */
  env?: Record<string, string | undefined>;
  /** Optional receipt to evaluate after credential probe. */
  receipt?: unknown;
}): ConnectorProductionQualDryRunResult {
  const connectorKey = options.connectorKey.trim();
  const credentialStatus = resolveConnectorLiveCredentialStatus(
    connectorKey,
    options.env ?? {}
  );

  if (credentialStatus.status === "NotConfigured") {
    const reason = !credentialStatus.harnessKnown
      ? `No live-smoke env key map for connector "${connectorKey}" — dry-run stays NotConfigured until keys are declared and provided.`
      : `Live credentials NotConfigured (missing: ${credentialStatus.missingKeys.join(", ") || "unknown"}). Production elevation denied.`;
    return {
      connectorKey,
      decision: "NotConfigured",
      allowed: false,
      credentialStatus,
      summary: reason
    };
  }

  if (options.receipt === undefined) {
    return {
      connectorKey,
      decision: "Blocked",
      allowed: false,
      credentialStatus,
      summary:
        "Live credentials present, but no Production qualification receipt was supplied. Run live smoke and attach a complete receipt before elevation."
    };
  }

  const elevation = evaluateProductionElevation(options.receipt);
  // Defense: receipt connectorKey must match dry-run target.
  if (
    elevation.connectorKey != null &&
    elevation.connectorKey !== connectorKey
  ) {
    return {
      connectorKey,
      decision: "Blocked",
      allowed: false,
      credentialStatus,
      elevation: {
        ...elevation,
        allowed: false,
        decision: "Blocked",
        failures: [
          ...elevation.failures,
          `Receipt connectorKey "${elevation.connectorKey}" does not match dry-run target "${connectorKey}"`
        ],
        resultingExternalTier: "Beta"
      },
      summary: `Receipt connectorKey mismatch: expected ${connectorKey}, got ${elevation.connectorKey}`
    };
  }

  return {
    connectorKey,
    decision: elevation.decision,
    allowed: elevation.allowed,
    credentialStatus,
    elevation,
    summary: elevation.allowed
      ? `Eligible for Production elevation for ${connectorKey} (receipt + live keys present). Catalog change still requires explicit generator update and Plane evidence.`
      : `Not eligible: ${elevation.failures.join("; ") || elevation.decision}`
  };
}

/**
 * Summarize how many catalog entries are Production-certified.
 * Generators and UI should use this rather than hard-coding claims.
 */
export function summarizeCatalogProductionHonesty(input: {
  productionCertifiedCount: number;
  betaCount: number;
  plannedCount: number;
}): {
  productionCertifiedCount: number;
  hasAnyProduction: boolean;
  customerFacingSummary: string;
} {
  const productionCertifiedCount = Math.max(
    0,
    Math.floor(input.productionCertifiedCount)
  );
  const hasAnyProduction = productionCertifiedCount > 0;
  const customerFacingSummary = hasAnyProduction
    ? `${productionCertifiedCount} Production-certified (customer-credential live-smoke); ${input.betaCount} Beta; ${input.plannedCount} Planned.`
    : `0 Production-certified connectors — dedicated live clients remain Beta until design-partner live-smoke receipts; ${input.betaCount} Beta; ${input.plannedCount} Planned.`;

  return {
    productionCertifiedCount,
    hasAnyProduction,
    customerFacingSummary
  };
}

/** Checklist automation: ensure all required items exist with PASS. */
export function automateChecklistCompleteness(
  checklist: readonly ProductionQualChecklistEntry[]
): {
  complete: boolean;
  missing: ProductionQualChecklistItem[];
  failed: ProductionQualChecklistItem[];
} {
  const byItem = new Map(checklist.map((entry) => [entry.item, entry]));
  const missing = PRODUCTION_QUAL_CHECKLIST_ITEMS.filter(
    (item) => !byItem.has(item)
  );
  const failed = PRODUCTION_QUAL_CHECKLIST_ITEMS.filter((item) => {
    const entry = byItem.get(item);
    return entry != null && entry.result !== "PASS";
  });
  return {
    complete: missing.length === 0 && failed.length === 0,
    missing,
    failed
  };
}

/** Empty template for operators (all FAIL until smoke completes). */
export function emptyProductionQualChecklist(): ProductionQualChecklistEntry[] {
  return PRODUCTION_QUAL_CHECKLIST_ITEMS.map((item) => ({
    item,
    result: "FAIL" as const,
    notes: "Not yet run"
  }));
}

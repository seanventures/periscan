import {
  TrustSafetyOperationalReadinessSchema,
  TrustSafetyVendorAssuranceSchema,
  type TrustSafetyOperationalReadiness,
  type TrustSafetyVendorAssurance
} from "./domain";

export type OperationalReadinessEnvironment = Record<
  string,
  string | undefined
>;

function getOptionalOperationalValue(
  env: OperationalReadinessEnvironment,
  key: string
): string | null {
  const value = env[key]?.trim();

  return value ? value : null;
}

/** Categories of customer data Periscan processes as a product (not optional). */
export const DEFAULT_DATA_CATEGORIES_PROCESSED = [
  "Account identity (email, display name)",
  "Tenant membership and role assignments",
  "Authorized scope metadata and verification state",
  "Validation findings, attack paths, and remediation records",
  "Evidence metadata and redacted artifacts",
  "Integration configuration (credentials encrypted at rest when keys are set)",
  "Security audit events"
] as const;

export const DEFAULT_DATA_SUBJECT_REQUEST_PROCESS =
  "Data subject access, export, and deletion requests are sales-assisted for design-partner and enterprise deployments: open a ticket with the tenant owner; operators export tenant-scoped records via product APIs/audit export and execute deletion per the MSA/DPA. Self-serve GDPR click-through is NotConfigured until a published DPA is linked.";

export const EMPTY_SUBPROCESSORS_HONESTY =
  "Empty list means subprocessor disclosure is NotConfigured for this deployment — not that Periscan has zero subprocessors. Configure PERISCAN_SUBPROCESSORS_JSON with the live hosting, email, and storage stack before production customer data. Never treat an empty array as a claim of 'none'.";

export const CONFIGURED_SUBPROCESSORS_HONESTY =
  "Subprocessor list is deployment-configured. Confirm completeness against the live MSA/DPA annex before production use; customer-specific BAAs may add or replace processors.";

/**
 * Periscan-as-vendor assurance status (SOC 2 Type II, etc.).
 * Distinct from customer-facing SOC 2 *support evidence* packs in reports.
 */
export function buildVendorAssurance(
  env: OperationalReadinessEnvironment = {}
): TrustSafetyVendorAssurance {
  const raw = getOptionalOperationalValue(env, "PERISCAN_VENDOR_SOC2_STATUS");
  const allowed = ["None", "InProgress", "ReportUnderNda"] as const;
  const soc2TypeIiStatus = allowed.includes(
    raw as (typeof allowed)[number]
  )
    ? (raw as (typeof allowed)[number])
    : "None";

  const detailByStatus: Record<(typeof allowed)[number], string> = {
    None: "Periscan does not currently publish a vendor SOC 2 Type II report or bridge letter. Do not treat product UI packs as Periscan vendor attestation.",
    InProgress:
      "A vendor SOC 2 Type II program is in progress. No completed report is available for customer distribution yet.",
    ReportUnderNda:
      "A vendor SOC 2 Type II report (or equivalent) is available under NDA via sales/security review — not as a public download in product."
  };

  return TrustSafetyVendorAssuranceSchema.parse({
    customerEvidencePacksNote:
      "Product packs labeled Customer SOC 2 support evidence (SOC2Support / SOC2Attestation storage keys) map measured customer controls to a partial catalog. They are not Periscan's vendor SOC 2 Type II, ISO certification, or formal framework attestation.",
    detail: detailByStatus[soc2TypeIiStatus],
    soc2TypeIiStatus
  });
}

export function resolveHttpsReferenceUrl(
  value: string | null | undefined
): string | null {
  const trimmed = value?.trim();
  if (!trimmed || !/^https:\/\//u.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function buildTrustSafetyOperationalReadiness(
  env: OperationalReadinessEnvironment = {}
): TrustSafetyOperationalReadiness {
  const environment =
    getOptionalOperationalValue(env, "PERISCAN_DEPLOYMENT_ENVIRONMENT") ??
    (env.PERISCAN_DEV_MODE === "false" ? "production" : "local-development");
  const controls = [
    {
      controlId: "database-backup-cadence",
      envKey: "PERISCAN_DATABASE_BACKUP_CADENCE",
      notes:
        "Set a human-readable backup cadence such as hourly, daily, or managed-by-provider.",
      title: "Database backup cadence"
    },
    {
      controlId: "database-restore-test",
      envKey: "PERISCAN_DATABASE_RESTORE_TESTED_AT",
      notes:
        "Record the most recent successful restore test date or runbook marker.",
      title: "Database restore test"
    },
    {
      controlId: "object-storage-retention",
      envKey: "PERISCAN_OBJECT_STORAGE_RETENTION_DAYS",
      notes:
        "Set the configured evidence/object-storage lifecycle period in days.",
      title: "Object storage retention"
    },
    {
      controlId: "object-storage-backup-policy",
      envKey: "PERISCAN_OBJECT_STORAGE_BACKUP_POLICY",
      notes:
        "Describe object-storage versioning, replication, or provider-managed backup policy.",
      title: "Object storage backup policy"
    },
    {
      controlId: "redis-persistence",
      envKey: "PERISCAN_REDIS_PERSISTENCE_MODE",
      notes:
        "Describe Redis persistence expectations such as appendonly, snapshot, or ephemeral queue-only.",
      title: "Redis persistence"
    },
    {
      controlId: "log-aggregation",
      envKey: "PERISCAN_LOG_AGGREGATION_TARGET",
      notes:
        "Set the production log aggregation target name without embedding credentials.",
      title: "Log aggregation"
    },
    {
      controlId: "alert-routing",
      envKey: "PERISCAN_ALERT_ROUTING_TARGET",
      notes:
        "Set the production alert route, service, or on-call target name without embedding webhook secrets.",
      title: "Alert routing"
    },
    {
      controlId: "incident-contact",
      envKey: "PERISCAN_INCIDENT_CONTACT",
      notes:
        "Set the operational incident contact or distribution address shown for customer review.",
      title: "Incident contact"
    }
  ].map((control) => {
    const value = getOptionalOperationalValue(env, control.envKey);

    return {
      controlId: control.controlId,
      notes: value
        ? `${control.notes} Current value is configured by deployment environment.`
        : control.notes,
      status: value ? "Configured" : "DeploymentManaged",
      title: control.title,
      value
    };
  });
  const overallStatus = controls.every(
    (control) => control.status === "Configured"
  )
    ? "Configured"
    : "DeploymentManaged";

  return TrustSafetyOperationalReadinessSchema.parse({
    controls,
    environment,
    notes:
      overallStatus === "Configured"
        ? "Production operational controls are configured through environment-backed deployment settings."
        : "Some production operational controls are deployment-managed. Configure them before first-customer production deployment.",
    overallStatus
  });
}

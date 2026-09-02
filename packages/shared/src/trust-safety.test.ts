import { describe, expect, it } from "vitest";

import {
  buildTrustSafetyOperationalReadiness,
  buildVendorAssurance,
  EMPTY_SUBPROCESSORS_HONESTY
} from "./trust-safety";

describe("buildVendorAssurance", () => {
  it("defaults vendor SOC 2 Type II status to None", () => {
    const assurance = buildVendorAssurance({});
    expect(assurance.soc2TypeIiStatus).toBe("None");
    expect(assurance.detail).toMatch(/does not currently publish/i);
    expect(assurance.customerEvidencePacksNote).toMatch(
      /Customer SOC 2 support evidence/i
    );
  });

  it("honors env InProgress and ReportUnderNda", () => {
    expect(
      buildVendorAssurance({ PERISCAN_VENDOR_SOC2_STATUS: "InProgress" })
        .soc2TypeIiStatus
    ).toBe("InProgress");
    expect(
      buildVendorAssurance({ PERISCAN_VENDOR_SOC2_STATUS: "ReportUnderNda" })
        .soc2TypeIiStatus
    ).toBe("ReportUnderNda");
  });

  it("keeps empty-subprocessor honesty explicit", () => {
    expect(EMPTY_SUBPROCESSORS_HONESTY).toMatch(/not that Periscan has zero/i);
  });
});

describe("buildTrustSafetyOperationalReadiness", () => {
  it("marks unset production controls as deployment-managed", () => {
    const summary = buildTrustSafetyOperationalReadiness({});

    expect(summary.environment).toBe("local-development");
    expect(summary.overallStatus).toBe("DeploymentManaged");
    expect(summary.controls.map((control) => control.controlId)).toEqual([
      "database-backup-cadence",
      "database-restore-test",
      "object-storage-retention",
      "object-storage-backup-policy",
      "redis-persistence",
      "log-aggregation",
      "alert-routing",
      "incident-contact"
    ]);
  });

  it("marks all controls configured when safe deployment values are present", () => {
    const summary = buildTrustSafetyOperationalReadiness({
      PERISCAN_ALERT_ROUTING_TARGET: "pagerduty-security-service",
      PERISCAN_DATABASE_BACKUP_CADENCE: "hourly",
      PERISCAN_DATABASE_RESTORE_TESTED_AT: "2026-06-01",
      PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
      PERISCAN_INCIDENT_CONTACT: "security-ops@example.com",
      PERISCAN_LOG_AGGREGATION_TARGET: "customer-siem",
      PERISCAN_OBJECT_STORAGE_BACKUP_POLICY: "versioned-replicated",
      PERISCAN_OBJECT_STORAGE_RETENTION_DAYS: "365",
      PERISCAN_REDIS_PERSISTENCE_MODE: "appendonly"
    });

    expect(summary.environment).toBe("production");
    expect(summary.overallStatus).toBe("Configured");
    expect(
      summary.controls.every((control) => control.status === "Configured")
    ).toBe(true);
    expect(
      summary.controls.find(
        (control) => control.controlId === "log-aggregation"
      )?.value
    ).toBe("customer-siem");
  });
});

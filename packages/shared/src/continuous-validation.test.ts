import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { ScheduleFrequencySchema } from "./domain.js";
import {
  CONTINUOUS_VALIDATION_DEFAULT_QUOTA_PER_UTC_DAY,
  CONTINUOUS_VALIDATION_DEFAULT_STALE_AFTER_MS,
  CONTINUOUS_VALIDATION_HONESTY_NOTE,
  CONTINUOUS_VALIDATION_PRODUCT_NAME,
  CONTINUOUS_VALIDATION_SAFE_MODULE_ALLOWLIST,
  computeScopeAssetHash,
  evaluateContinuousValidationFire,
  isContinuousValidationSafeModuleId,
  isInMaintenanceWindow,
  isScopeValidationStale,
  isSubDailyScheduleFrequency,
  resolveContinuousValidationModuleIds
} from "./continuous-validation.js";

const NOW = new Date("2026-09-17T14:00:00.000Z");
const HOUR_MS = 60 * 60 * 1000;

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

describe("continuous validation cadence (policy-approved, not always-on BAS)", () => {
  it("adds Hourly and Continuous as sub-daily schedule frequencies", () => {
    expect(ScheduleFrequencySchema.options).toEqual(
      expect.arrayContaining(["Daily", "Weekly", "Monthly", "Hourly", "Continuous"])
    );
    expect(isSubDailyScheduleFrequency("Hourly")).toBe(true);
    expect(isSubDailyScheduleFrequency("Continuous")).toBe(true);
    expect(isSubDailyScheduleFrequency("Daily")).toBe(false);
  });

  it("names the product Continuous validation and refuses always-on BAS theater", () => {
    expect(CONTINUOUS_VALIDATION_PRODUCT_NAME).toBe("Continuous validation");
    expect(CONTINUOUS_VALIDATION_HONESTY_NOTE).toMatch(/Continuous validation/);
    expect(CONTINUOUS_VALIDATION_HONESTY_NOTE).not.toMatch(
      /always-on BAS|NodeZero|autonomous pentest/i
    );
    expect(CONTINUOUS_VALIDATION_HONESTY_NOTE).toMatch(
      /policy-approved cadence|verified scope/i
    );
  });

  it("allowlists Community/safe modules and never Atomic/Caldera by default", () => {
    expect(CONTINUOUS_VALIDATION_SAFE_MODULE_ALLOWLIST).toEqual(
      expect.arrayContaining([
        "gitleaks.repo_secrets",
        "recon.dns_probe",
        "nuclei.external_exposure_safe",
        "periscan.detection_marker_emit_observe"
      ])
    );
    expect(isContinuousValidationSafeModuleId("atomic.control_validation_safe")).toBe(
      false
    );
    expect(isContinuousValidationSafeModuleId("caldera.advanced_adversarial")).toBe(
      false
    );
    expect(isContinuousValidationSafeModuleId("exploit.metasploit_check")).toBe(
      false
    );
  });

  it("denied policy fires queue nothing", () => {
    const decision = evaluateContinuousValidationFire({
      cadence: "Hourly",
      firesInWindow: 0,
      now: NOW,
      policyOutcome: "Denied",
      quotaPerWindow: CONTINUOUS_VALIDATION_DEFAULT_QUOTA_PER_UTC_DAY,
      scopes: [
        {
          currentAssetHash: hash("repo"),
          lastAssetHash: hash("repo"),
          lastValidatedAt: NOW.toISOString(),
          scopeId: "11111111-1111-4111-8111-111111111111",
          scopeType: "Repository",
          value: "/tmp/repo",
          verificationStatus: "Verified"
        }
      ],
      timeZone: "UTC"
    });

    expect(decision.allowed).toBe(false);
    expect(decision.jobsQueued).toBe(0);
    expect(decision.moduleIds).toEqual([]);
    expect(decision.reason).toBe("denied_policy");
    expect(decision.productName).toBe("Continuous validation");
    expect(decision.auditAction).toBe("schedule.fire_denied");
  });

  it("out-of-maintenance-window fires queue nothing", () => {
    expect(
      isInMaintenanceWindow({
        now: new Date("2026-09-17T02:15:00.000Z"),
        timeZone: "UTC",
        windows: [
          { daysOfWeek: [4], endTime: "06:00", startTime: "00:00" }
        ]
      })
    ).toBe(true);

    const decision = evaluateContinuousValidationFire({
      cadence: "Hourly",
      firesInWindow: 0,
      maintenanceWindows: [
        { daysOfWeek: [4], endTime: "06:00", startTime: "00:00" }
      ],
      now: new Date("2026-09-17T02:15:00.000Z"),
      policyOutcome: "Allowed",
      quotaPerWindow: 24,
      scopes: [
        {
          currentAssetHash: hash("example.com"),
          lastAssetHash: hash("example.com"),
          lastValidatedAt: null,
          scopeId: "11111111-1111-4111-8111-111111111111",
          scopeType: "Domain",
          value: "example.com",
          verificationStatus: "Verified"
        }
      ],
      timeZone: "UTC"
    });

    expect(decision.allowed).toBe(false);
    expect(decision.jobsQueued).toBe(0);
    expect(decision.reason).toBe("out_of_maintenance_window");
    expect(decision.auditAction).toBe("schedule.fire_denied");
  });

  it("tenant quota exceeded fires queue nothing", () => {
    const decision = evaluateContinuousValidationFire({
      cadence: "Hourly",
      firesInWindow: CONTINUOUS_VALIDATION_DEFAULT_QUOTA_PER_UTC_DAY,
      now: NOW,
      policyOutcome: "Allowed",
      quotaPerWindow: CONTINUOUS_VALIDATION_DEFAULT_QUOTA_PER_UTC_DAY,
      scopes: [
        {
          currentAssetHash: hash("repo"),
          lastAssetHash: hash("repo"),
          lastValidatedAt: new Date(NOW.getTime() - 2 * HOUR_MS).toISOString(),
          scopeId: "11111111-1111-4111-8111-111111111111",
          scopeType: "Repository",
          value: "/tmp/repo",
          verificationStatus: "Verified"
        }
      ],
      timeZone: "UTC"
    });

    expect(decision.allowed).toBe(false);
    expect(decision.jobsQueued).toBe(0);
    expect(decision.reason).toBe("quota_exceeded");
  });

  it("allowed Hourly fire queues Gitleaks / recon / Nuclei safe-baseline / benign marker", () => {
    const decision = evaluateContinuousValidationFire({
      cadence: "Hourly",
      firesInWindow: 0,
      now: NOW,
      policyOutcome: "Allowed",
      quotaPerWindow: 24,
      requestedModuleIds: [
        "gitleaks.repo_secrets",
        "recon.dns_probe",
        "nuclei.external_exposure_safe",
        "periscan.detection_marker_emit_observe",
        "atomic.control_validation_safe",
        "caldera.advanced_adversarial"
      ],
      scopes: [
        {
          currentAssetHash: hash("repo"),
          lastAssetHash: hash("repo"),
          lastValidatedAt: new Date(NOW.getTime() - 2 * HOUR_MS).toISOString(),
          scopeId: "11111111-1111-4111-8111-111111111111",
          scopeType: "Repository",
          value: "/tmp/repo",
          verificationStatus: "Verified"
        }
      ],
      timeZone: "UTC"
    });

    expect(decision.allowed).toBe(true);
    expect(decision.jobsQueued).toBeGreaterThan(0);
    expect(decision.moduleIds).toContain("gitleaks.repo_secrets");
    expect(decision.moduleIds).not.toContain("atomic.control_validation_safe");
    expect(decision.moduleIds).not.toContain("caldera.advanced_adversarial");
    expect(decision.reason).toBe("allowed");
    expect(decision.auditAction).toBe("schedule.fire");
    expect(decision.marksFixed).toBe(false);
  });

  it("does not queue Atomic/Caldera unless the start gate would allow", () => {
    const denied = evaluateContinuousValidationFire({
      cadence: "Hourly",
      firesInWindow: 0,
      now: NOW,
      policyOutcome: "Allowed",
      quotaPerWindow: 24,
      requestedModuleIds: ["atomic.control_validation_safe"],
      scopes: [
        {
          currentAssetHash: hash("host"),
          lastAssetHash: hash("host"),
          lastValidatedAt: new Date(NOW.getTime() - 2 * HOUR_MS).toISOString(),
          scopeId: "11111111-1111-4111-8111-111111111111",
          scopeType: "InternalNetwork",
          value: "10.0.0.0/24",
          verificationStatus: "Verified"
        }
      ],
      timeZone: "UTC"
    });
    expect(denied.moduleIds).not.toContain("atomic.control_validation_safe");
    expect(denied.jobsQueued).toBeGreaterThan(0);

    const allowedByGate = evaluateContinuousValidationFire({
      cadence: "Hourly",
      firesInWindow: 0,
      livePackStartable: { "atomic.control_validation_safe": true },
      now: NOW,
      policyOutcome: "Allowed",
      quotaPerWindow: 24,
      requestedModuleIds: ["atomic.control_validation_safe"],
      scopes: [
        {
          currentAssetHash: hash("host"),
          lastAssetHash: hash("host"),
          lastValidatedAt: new Date(NOW.getTime() - 2 * HOUR_MS).toISOString(),
          scopeId: "11111111-1111-4111-8111-111111111111",
          scopeType: "InternalNetwork",
          value: "10.0.0.0/24",
          verificationStatus: "Verified"
        }
      ],
      timeZone: "UTC"
    });
    expect(allowedByGate.moduleIds).toContain("atomic.control_validation_safe");
  });
});

describe("continuous validation drift trigger", () => {
  it("treats a changed asset hash or stale lastValidatedAt as drift", () => {
    const current = computeScopeAssetHash({
      scopeId: "11111111-1111-4111-8111-111111111111",
      scopeType: "Domain",
      value: "example.com"
    });
    const previous = computeScopeAssetHash({
      scopeId: "11111111-1111-4111-8111-111111111111",
      scopeType: "Domain",
      value: "old.example.com"
    });
    expect(current).not.toBe(previous);
    expect(
      isScopeValidationStale({
        currentAssetHash: current,
        lastAssetHash: previous,
        lastValidatedAt: NOW.toISOString(),
        now: NOW,
        staleAfterMs: CONTINUOUS_VALIDATION_DEFAULT_STALE_AFTER_MS
      })
    ).toBe(true);
    expect(
      isScopeValidationStale({
        currentAssetHash: current,
        lastAssetHash: current,
        lastValidatedAt: new Date(
          NOW.getTime() - CONTINUOUS_VALIDATION_DEFAULT_STALE_AFTER_MS - 1
        ).toISOString(),
        now: NOW,
        staleAfterMs: CONTINUOUS_VALIDATION_DEFAULT_STALE_AFTER_MS
      })
    ).toBe(true);
    expect(
      isScopeValidationStale({
        currentAssetHash: current,
        lastAssetHash: current,
        lastValidatedAt: NOW.toISOString(),
        now: NOW,
        staleAfterMs: CONTINUOUS_VALIDATION_DEFAULT_STALE_AFTER_MS
      })
    ).toBe(false);
  });

  it("drift-only Continuous fire queues safe modules when stale and nothing when fresh", () => {
    const scopeId = "11111111-1111-4111-8111-111111111111";
    const current = computeScopeAssetHash({
      scopeId,
      scopeType: "Domain",
      value: "stale.example.com"
    });
    const stale = evaluateContinuousValidationFire({
      cadence: "Continuous",
      fireKind: "drift",
      firesInWindow: 0,
      now: NOW,
      policyOutcome: "Allowed",
      quotaPerWindow: 24,
      scopes: [
        {
          currentAssetHash: current,
          lastAssetHash: hash("previous"),
          lastValidatedAt: NOW.toISOString(),
          scopeId,
          scopeType: "Domain",
          value: "stale.example.com",
          verificationStatus: "Verified"
        }
      ],
      timeZone: "UTC"
    });
    expect(stale.allowed).toBe(true);
    expect(stale.jobsQueued).toBeGreaterThan(0);
    expect(stale.moduleIds).toContain("nuclei.external_exposure_safe");
    expect(stale.reason).toBe("allowed");

    const fresh = evaluateContinuousValidationFire({
      cadence: "Continuous",
      fireKind: "drift",
      firesInWindow: 0,
      now: NOW,
      policyOutcome: "Allowed",
      quotaPerWindow: 24,
      scopes: [
        {
          currentAssetHash: current,
          lastAssetHash: current,
          lastValidatedAt: NOW.toISOString(),
          scopeId,
          scopeType: "Domain",
          value: "stale.example.com",
          verificationStatus: "Verified"
        }
      ],
      timeZone: "UTC"
    });
    expect(fresh.allowed).toBe(false);
    expect(fresh.jobsQueued).toBe(0);
    expect(fresh.reason).toBe("not_stale");
  });

  it("unverified scopes never queue continuous validation", () => {
    const decision = evaluateContinuousValidationFire({
      cadence: "Continuous",
      fireKind: "drift",
      firesInWindow: 0,
      now: NOW,
      policyOutcome: "Allowed",
      quotaPerWindow: 24,
      scopes: [
        {
          currentAssetHash: hash("pending"),
          lastAssetHash: null,
          lastValidatedAt: null,
          scopeId: "11111111-1111-4111-8111-111111111111",
          scopeType: "Domain",
          value: "pending.example.com",
          verificationStatus: "Pending"
        }
      ],
      timeZone: "UTC"
    });
    expect(decision.jobsQueued).toBe(0);
    expect(decision.reason).toBe("unverified_scope");
  });

  it("defaults Domain modules to Nuclei safe-baseline and recon", () => {
    expect(
      resolveContinuousValidationModuleIds({
        scopeType: "Domain"
      })
    ).toEqual(
      expect.arrayContaining([
        "nuclei.external_exposure_safe",
        "recon.dns_probe"
      ])
    );
    expect(
      resolveContinuousValidationModuleIds({
        requestedModuleIds: ["gitleaks.repo_secrets"],
        scopeType: "Repository"
      })
    ).toEqual(["gitleaks.repo_secrets"]);
  });
});

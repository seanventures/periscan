/**
 * P10-17 — Periscan Segment Runner profiles
 * ----------------------------------------
 * Field-installable appliance *profiles* (not a full BAS appliance):
 * baked allowlists, resource limits, and mTLS-required posture per network
 * segment class. Metering is by segment profile, not vague Enterprise SKUs.
 *
 * Safety: profiles never enable destructive modules, reverse shells, or
 * unrestricted internet egress. OT profile is passive/safe-baseline only.
 */

import { z } from "zod";

import { SafetyLevelSchema, type SafetyLevel } from "./domain";

export const RunnerSegmentProfileIdSchema = z.enum([
  "campus-passive",
  "dc-measured",
  "ot-safe-baseline"
]);

export type RunnerSegmentProfileId = z.infer<
  typeof RunnerSegmentProfileIdSchema
>;

export const RunnerSegmentResourceLimitsSchema = z.object({
  maxConcurrentTasks: z.number().int().min(1).max(64),
  maxCpuMillicores: z.number().int().min(100).max(32_000),
  maxMemoryMb: z.number().int().min(128).max(65_536),
  maxTaskDurationSeconds: z.number().int().min(30).max(86_400),
  maxArtifactBytes: z.number().int().min(1_024).max(512 * 1024 * 1024)
});

export type RunnerSegmentResourceLimits = z.infer<
  typeof RunnerSegmentResourceLimitsSchema
>;

/** Safety levels segment profiles may ever allow (never AdvancedAdversarial / Disallowed). */
export const RunnerSegmentAllowedSafetyLevelSchema = z.enum([
  "PassiveReadOnly",
  "ActiveNonInvasive",
  "ControlledValidation"
]);

export const RunnerSegmentProfileSchema = z.object({
  allowedModuleFamilies: z.array(z.string().min(1)).min(1),
  /** Safety-level ceiling; modules above this are denied at lease time. */
  allowedSafetyLevels: z.array(RunnerSegmentAllowedSafetyLevelSchema).min(1),
  description: z.string().min(1),
  forbidInternetEgress: z.boolean(),
  id: RunnerSegmentProfileIdSchema,
  /** Human product name for procurement / fleet UI. */
  label: z.string().min(1),
  /** mTLS client cert required for control channel (always true for segment SKUs). */
  mtlsRequired: z.literal(true),
  resourceLimits: RunnerSegmentResourceLimitsSchema,
  /** SKU / metering key — charge by segment profile presence, not contact-sales. */
  skuKey: z.string().min(1)
});

export type RunnerSegmentProfile = z.infer<typeof RunnerSegmentProfileSchema>;

/**
 * Baked segment profiles. Resource numbers are intentional field defaults,
 * not host inventory — operators may tighten further via fleet policy later.
 */
export const RUNNER_SEGMENT_PROFILES: Record<
  RunnerSegmentProfileId,
  RunnerSegmentProfile
> = {
  "campus-passive": {
    id: "campus-passive",
    label: "Campus Passive",
    skuKey: "segment.campus-passive",
    description:
      "Campus/branch segment runner: passive discovery and reachability only. No simulated exploit modules; forbid unrestricted internet egress.",
    mtlsRequired: true,
    forbidInternetEgress: true,
    allowedSafetyLevels: ["PassiveReadOnly"],
    allowedModuleFamilies: [
      "reachability",
      "dns-resolve",
      "port-observe",
      "certificate-observe"
    ],
    resourceLimits: {
      maxConcurrentTasks: 2,
      maxCpuMillicores: 500,
      maxMemoryMb: 512,
      maxTaskDurationSeconds: 300,
      maxArtifactBytes: 8 * 1024 * 1024
    }
  },
  "dc-measured": {
    id: "dc-measured",
    label: "DC Measured",
    skuKey: "segment.dc-measured",
    description:
      "Datacenter segment runner for measured hop validation (active non-invasive probes within verified scope). mTLS required; no destructive tooling.",
    mtlsRequired: true,
    forbidInternetEgress: false,
    allowedSafetyLevels: ["PassiveReadOnly", "ActiveNonInvasive", "ControlledValidation"],
    allowedModuleFamilies: [
      "reachability",
      "dns-resolve",
      "port-observe",
      "certificate-observe",
      "http-probe",
      "control-observe",
      "secret-scan-local"
    ],
    resourceLimits: {
      maxConcurrentTasks: 8,
      maxCpuMillicores: 2000,
      maxMemoryMb: 2048,
      maxTaskDurationSeconds: 1800,
      maxArtifactBytes: 64 * 1024 * 1024
    }
  },
  "ot-safe-baseline": {
    id: "ot-safe-baseline",
    label: "OT Safe Baseline",
    skuKey: "segment.ot-safe-baseline",
    description:
      "OT/ICS segment runner: passive baseline only. No active probes, no adversarial modules, forbid internet egress. Certificate + mTLS mandatory.",
    mtlsRequired: true,
    forbidInternetEgress: true,
    allowedSafetyLevels: ["PassiveReadOnly"],
    allowedModuleFamilies: [
      "certificate-observe",
      "passive-inventory",
      "protocol-identify-passive"
    ],
    resourceLimits: {
      maxConcurrentTasks: 1,
      maxCpuMillicores: 250,
      maxMemoryMb: 256,
      maxTaskDurationSeconds: 120,
      maxArtifactBytes: 2 * 1024 * 1024
    }
  }
};

export function getRunnerSegmentProfile(
  id: RunnerSegmentProfileId
): RunnerSegmentProfile {
  return RUNNER_SEGMENT_PROFILES[id];
}

export function listRunnerSegmentProfiles(): RunnerSegmentProfile[] {
  return RunnerSegmentProfileIdSchema.options.map(
    (id) => RUNNER_SEGMENT_PROFILES[id]
  );
}

/** Whether a module family is allowed under the profile allowlist. */
export function segmentProfileAllowsModuleFamily(
  profileId: RunnerSegmentProfileId,
  moduleFamily: string
): boolean {
  const profile = RUNNER_SEGMENT_PROFILES[profileId];
  return profile.allowedModuleFamilies.includes(moduleFamily);
}

/** Whether a safety level is within the profile ceiling. */
export function segmentProfileAllowsSafetyLevel(
  profileId: RunnerSegmentProfileId,
  safetyLevel: SafetyLevel
): boolean {
  // Segment SKUs never allow BAS-lite / advanced adversarial / disallowed.
  if (
    safetyLevel === "BASLite" ||
    safetyLevel === "AdvancedAdversarial" ||
    safetyLevel === "Disallowed"
  ) {
    return false;
  }
  const profile = RUNNER_SEGMENT_PROFILES[profileId];
  return (profile.allowedSafetyLevels as readonly string[]).includes(
    safetyLevel
  );
}

/**
 * Map a real moduleId (runner.* / periscan.* / recon.*) onto a segment
 * profile family. Families are the allowlist keys in RUNNER_SEGMENT_PROFILES;
 * unknown modules return null and must be denied on profile-bound runners.
 *
 * P10-1: lease/dispatch policy must use this mapping — inventory labels alone
 * are not product policy.
 */
export function resolveModuleSegmentFamily(moduleId: string): string | null {
  const id = moduleId.trim().toLowerCase();
  if (!id) return null;

  // Reachability / TCP
  if (
    id === "runner.reachability_check" ||
    id === "periscan.tcp_reachability" ||
    id.endsWith(".reachability_check") ||
    id.includes("reachability")
  ) {
    return "reachability";
  }

  // DNS
  if (
    id === "runner.dns_resolution_check" ||
    id === "periscan.dns_resolution_check" ||
    id === "recon.dns_probe" ||
    id.includes("dns_resolution") ||
    id.includes("dns_probe")
  ) {
    return "dns-resolve";
  }

  // Certificates / TLS observe
  if (
    id === "runner.tls_certificate_check" ||
    id === "periscan.tls_certificate_check" ||
    id === "periscan.tls_protocol_audit" ||
    id.includes("tls_certificate") ||
    id.includes("tls_protocol") ||
    id.includes("certificate")
  ) {
    return "certificate-observe";
  }

  // HTTP probes (health, cookie, redirect, cors, recon http)
  if (
    id === "runner.http_health_check" ||
    id === "periscan.http_health_check" ||
    id === "periscan.http_cookie_security" ||
    id === "periscan.http_redirect_enforcement" ||
    id === "periscan.http_cors_audit" ||
    id === "recon.http_probe" ||
    id.includes("http_health") ||
    id.includes("http_cookie") ||
    id.includes("http_redirect") ||
    id.includes("http_cors") ||
    id.includes("http_probe")
  ) {
    return "http-probe";
  }

  // Control observe / benign marker
  if (
    id === "periscan.endpoint_benign_marker_emit" ||
    id.includes("control_observe") ||
    id.includes("benign_marker")
  ) {
    return "control-observe";
  }

  // Local secret scan (not dispatched today; reserved family)
  if (id.includes("secret_scan") || id.includes("gitleaks")) {
    return "secret-scan-local";
  }

  // Port / host inventory (active but non-invasive discovery)
  if (
    id === "recon.host_discovery" ||
    id === "recon.service_inventory" ||
    id.includes("host_discovery") ||
    id.includes("service_inventory") ||
    id.includes("port_scan") ||
    id.includes("port-observe")
  ) {
    return "port-observe";
  }

  // Passive inventory / subdomain
  if (
    id === "recon.subdomain_enum" ||
    id.includes("subdomain") ||
    id.includes("passive_inventory") ||
    id.includes("passive-inventory")
  ) {
    return "passive-inventory";
  }

  // OT passive protocol identify
  if (
    id.includes("protocol_identify") ||
    id.includes("protocol-identify") ||
    id.includes("ot_ics") ||
    id.includes("ot.safe")
  ) {
    return "protocol-identify-passive";
  }

  return null;
}

export type SegmentProfileTaskGateResult = {
  allowed: boolean;
  code: string | null;
  forbidInternetEgress: boolean;
  moduleFamily: string | null;
  rationale: string;
};

/**
 * Lease/create-time gate for a segment-profile-bound runner (P10-1).
 * Unbound runners (no profile) always pass — generic hybrid fleet unchanged.
 */
export function evaluateSegmentProfileTaskGate(input: {
  moduleId: string;
  profileId: RunnerSegmentProfileId | string | null | undefined;
  safetyLevel: SafetyLevel | string;
}): SegmentProfileTaskGateResult {
  const rawProfile = input.profileId;
  if (
    rawProfile !== "campus-passive" &&
    rawProfile !== "dc-measured" &&
    rawProfile !== "ot-safe-baseline"
  ) {
    return {
      allowed: true,
      code: null,
      forbidInternetEgress: false,
      moduleFamily: resolveModuleSegmentFamily(input.moduleId),
      rationale: "Runner is not bound to a segment profile."
    };
  }

  const profile = getRunnerSegmentProfile(rawProfile);
  const moduleFamily = resolveModuleSegmentFamily(input.moduleId);

  if (!moduleFamily) {
    return {
      allowed: false,
      code: "runner_segment_module_unknown",
      forbidInternetEgress: profile.forbidInternetEgress,
      moduleFamily: null,
      rationale: `Segment profile ${profile.id} denies unknown module family for ${input.moduleId}.`
    };
  }

  if (!segmentProfileAllowsModuleFamily(rawProfile, moduleFamily)) {
    return {
      allowed: false,
      code: "runner_segment_module_denied",
      forbidInternetEgress: profile.forbidInternetEgress,
      moduleFamily,
      rationale: `Segment profile ${profile.id} does not allow module family "${moduleFamily}" (${input.moduleId}).`
    };
  }

  if (
    !segmentProfileAllowsSafetyLevel(
      rawProfile,
      input.safetyLevel as SafetyLevel
    )
  ) {
    return {
      allowed: false,
      code: "runner_segment_safety_denied",
      forbidInternetEgress: profile.forbidInternetEgress,
      moduleFamily,
      rationale: `Segment profile ${profile.id} does not allow safety level ${String(input.safetyLevel)}.`
    };
  }

  return {
    allowed: true,
    code: null,
    forbidInternetEgress: profile.forbidInternetEgress,
    moduleFamily,
    rationale: `Segment profile ${profile.id} allows ${moduleFamily} at ${String(input.safetyLevel)}.`
  };
}

// Keep SafetyLevelSchema referenced so partition stays aligned with domain.
void SafetyLevelSchema;

/**
 * Wave C — Continuous EASM on verified scopes (matrix #1).
 *
 * Schedules of missionType ContinuousValidation may fire only these
 * allowlisted safe modules. No autonomous CT/whois pivot, no living map claim.
 * Imported scan fabric remains separate (evidenceBasis=Imported).
 */

export const CONTINUOUS_EASM_CHANGE_DETECTION_NOTE =
  "Change detection compares prior vs current schedule snapshot paths/risk (and optional exposure observation counts). This is not an autonomous living external map or continuous terrain swarm.";

export const CONTINUOUS_EASM_HONESTY_NOTE =
  "Continuous EASM fires allowlisted safe external/recon modules on verified customer scopes only. Seeds come from declared verified scope — not cert-transparency or whois pivot. Discoveries require measured re-probe before Validated claims.";

/** Safe modules ContinuousValidation schedules may queue (ActiveNonInvasive or below). */
export const CONTINUOUS_EASM_SAFE_MODULE_ALLOWLIST = [
  // External Point of Attack — allowlisted Nuclei + control-plane posture
  "nuclei.external_exposure_safe",
  "periscan.dns_resolution_check",
  "periscan.tls_certificate_check",
  "periscan.http_health_check",
  "periscan.dns_caa_check",
  "periscan.well_known_security_txt",
  // Internal runner recon (signed-task, non-invasive)
  "recon.subdomain_enum",
  "recon.dns_probe",
  "recon.http_probe",
  "recon.host_discovery"
] as const;

export type ContinuousEasmSafeModuleId =
  (typeof CONTINUOUS_EASM_SAFE_MODULE_ALLOWLIST)[number];

const ALLOWLIST_SET = new Set<string>(CONTINUOUS_EASM_SAFE_MODULE_ALLOWLIST);

export function isContinuousEasmSafeModuleId(
  moduleId: string
): moduleId is ContinuousEasmSafeModuleId {
  return ALLOWLIST_SET.has(moduleId);
}

/** Default modules by verified scope type (one primary probe family). */
export const CONTINUOUS_EASM_DEFAULT_MODULES_BY_SCOPE: Record<
  string,
  readonly ContinuousEasmSafeModuleId[]
> = {
  Domain: [
    "nuclei.external_exposure_safe",
    "periscan.dns_resolution_check",
    "periscan.tls_certificate_check"
  ],
  Subdomain: [
    "nuclei.external_exposure_safe",
    "periscan.dns_resolution_check",
    "periscan.tls_certificate_check"
  ],
  InternalNetwork: ["recon.host_discovery", "recon.dns_probe"],
  IPRange: ["recon.host_discovery", "recon.dns_probe"]
};

/**
 * Resolve ContinuousValidation module ids for a verified scope.
 * Optional config.moduleIds are intersected with the hard allowlist.
 * Denied / unknown ids are dropped; empty allowlist intersection falls back
 * to scope defaults so schedules always have a safe probe set when the scope
 * type is supported.
 */
export function resolveContinuousEasmModuleIds(input: {
  configModuleIds?: unknown;
  scopeType: string;
}): ContinuousEasmSafeModuleId[] {
  const defaults =
    CONTINUOUS_EASM_DEFAULT_MODULES_BY_SCOPE[input.scopeType] ?? [];
  const requested = normalizeModuleIdList(input.configModuleIds);
  if (requested.length === 0) {
    return [...defaults];
  }
  const allowed = [
    ...new Set(requested.filter(isContinuousEasmSafeModuleId))
  ];
  return allowed.length > 0 ? allowed : [...defaults];
}

function normalizeModuleIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());
}

/** Append honest continuous-EASM / change-detection notes to a schedule diff summary. */
export function enrichContinuousEasmDiffSummary(input: {
  baseSummary: string;
  moduleIds: string[];
  missionQueued: boolean;
}): string {
  const parts = [input.baseSummary];
  if (input.missionQueued && input.moduleIds.length > 0) {
    parts.push(
      `Queued continuous EASM module run(s): ${input.moduleIds.join(", ")}.`
    );
  } else if (!input.missionQueued) {
    parts.push(
      "No continuous EASM modules queued (no matching verified Domain/Subdomain/Internal scope or empty allowlist)."
    );
  }
  parts.push(CONTINUOUS_EASM_CHANGE_DETECTION_NOTE);
  return parts.join(" ");
}

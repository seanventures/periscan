import { createHash } from "node:crypto";
import { z } from "zod";

import { BAS_BENIGN_MARKER_MODULE_ID } from "./bas-control-plane";
import { COMMUNITY_GITLEAKS_REPO_SECRETS_MODULE_ID } from "./community-edition";
import {
  CONTINUOUS_EASM_SAFE_MODULE_ALLOWLIST,
  isContinuousEasmSafeModuleId
} from "./continuous-easm";

/**
 * Policy-approved sub-daily cadence. Not 24/7 live BAS theater.
 * Hourly = calendar tick. Continuous = hourly tick plus drift (stale hash /
 * lastValidatedAt) on verified scopes.
 */

export const CONTINUOUS_VALIDATION_PRODUCT_NAME = "Continuous validation";

export const CONTINUOUS_VALIDATION_HONESTY_NOTE =
  "Continuous validation is a policy-approved cadence (Hourly or drift-triggered) on verified customer scopes with tenant quota and maintenance windows. Denied or out-of-window fires queue nothing.";

export const CONTINUOUS_VALIDATION_DEFAULT_QUOTA_PER_UTC_DAY = 24;
export const CONTINUOUS_VALIDATION_DEFAULT_STALE_AFTER_MS = 60 * 60 * 1000;

export const ContinuousValidationCadenceSchema = z.enum([
  "Hourly",
  "Continuous"
]);
export type ContinuousValidationCadence = z.infer<
  typeof ContinuousValidationCadenceSchema
>;

export const ContinuousValidationFireKindSchema = z.enum(["calendar", "drift"]);
export type ContinuousValidationFireKind = z.infer<
  typeof ContinuousValidationFireKindSchema
>;

export const ContinuousValidationFireReasonSchema = z.enum([
  "allowed",
  "denied_policy",
  "out_of_maintenance_window",
  "quota_exceeded",
  "not_stale",
  "unverified_scope"
]);
export type ContinuousValidationFireReason = z.infer<
  typeof ContinuousValidationFireReasonSchema
>;

export const ScheduleMaintenanceWindowSchema = z.object({
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
});
export type ScheduleMaintenanceWindow = z.infer<
  typeof ScheduleMaintenanceWindowSchema
>;

export const CONTINUOUS_VALIDATION_SAFE_MODULE_ALLOWLIST = [
  COMMUNITY_GITLEAKS_REPO_SECRETS_MODULE_ID,
  BAS_BENIGN_MARKER_MODULE_ID,
  ...CONTINUOUS_EASM_SAFE_MODULE_ALLOWLIST
] as const;

export type ContinuousValidationSafeModuleId =
  (typeof CONTINUOUS_VALIDATION_SAFE_MODULE_ALLOWLIST)[number];

const SAFE_MODULE_SET = new Set<string>(
  CONTINUOUS_VALIDATION_SAFE_MODULE_ALLOWLIST
);

const LIVE_PACK_MODULE_IDS = new Set([
  "atomic.control_validation_safe",
  "atomic.live",
  "caldera.advanced_adversarial",
  "caldera.live",
  "exploit.metasploit_check",
  "metasploit.live"
]);

export function isSubDailyScheduleFrequency(frequency: string): boolean {
  return frequency === "Hourly" || frequency === "Continuous";
}

export function isContinuousValidationSafeModuleId(
  moduleId: string
): moduleId is ContinuousValidationSafeModuleId {
  return SAFE_MODULE_SET.has(moduleId);
}

export function isLiveOffensiveContinuousModuleId(moduleId: string): boolean {
  return LIVE_PACK_MODULE_IDS.has(moduleId);
}

const DEFAULT_MODULES_BY_SCOPE: Record<string, readonly string[]> = {
  Repository: [COMMUNITY_GITLEAKS_REPO_SECRETS_MODULE_ID],
  Domain: ["nuclei.external_exposure_safe", "recon.dns_probe", "recon.http_probe"],
  Subdomain: [
    "nuclei.external_exposure_safe",
    "recon.dns_probe",
    "recon.http_probe"
  ],
  InternalNetwork: ["recon.host_discovery", "recon.dns_probe"],
  IPRange: ["recon.host_discovery", "recon.dns_probe"]
};

function normalizeModuleIdList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());
}

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

export function resolveContinuousValidationModuleIds(input: {
  livePackStartable?: Record<string, boolean>;
  requestedModuleIds?: unknown;
  scopeType: string;
}): string[] {
  const defaults = DEFAULT_MODULES_BY_SCOPE[input.scopeType] ?? [];
  const requested = normalizeModuleIdList(input.requestedModuleIds);
  const candidates = requested.length > 0 ? requested : [...defaults];
  const allowed: string[] = [];
  for (const moduleId of candidates) {
    if (isLiveOffensiveContinuousModuleId(moduleId)) {
      if (input.livePackStartable?.[moduleId] === true) {
        allowed.push(moduleId);
      }
      continue;
    }
    if (
      isContinuousValidationSafeModuleId(moduleId) ||
      isContinuousEasmSafeModuleId(moduleId)
    ) {
      allowed.push(moduleId);
    }
  }
  if (allowed.length > 0) {
    return unique(allowed);
  }
  return unique(
    defaults.filter(
      (moduleId) =>
        isContinuousValidationSafeModuleId(moduleId) ||
        isContinuousEasmSafeModuleId(moduleId)
    )
  );
}

export function computeScopeAssetHash(input: {
  identifiers?: unknown;
  scopeId: string;
  scopeType: string;
  value: string;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        identifiers: input.identifiers ?? null,
        scopeId: input.scopeId,
        scopeType: input.scopeType,
        value: input.value
      })
    )
    .digest("hex");
}

export function isScopeValidationStale(input: {
  currentAssetHash: string;
  lastAssetHash: string | null;
  lastValidatedAt: string | Date | null;
  now: Date;
  staleAfterMs?: number;
}): boolean {
  const staleAfterMs =
    input.staleAfterMs ?? CONTINUOUS_VALIDATION_DEFAULT_STALE_AFTER_MS;
  if (
    input.lastAssetHash &&
    input.lastAssetHash !== input.currentAssetHash
  ) {
    return true;
  }
  if (!input.lastValidatedAt) {
    return true;
  }
  const last =
    input.lastValidatedAt instanceof Date
      ? input.lastValidatedAt
      : new Date(input.lastValidatedAt);
  if (Number.isNaN(last.getTime())) {
    return true;
  }
  return input.now.getTime() - last.getTime() > staleAfterMs;
}

function timeMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone,
    weekday: "short",
    year: "numeric"
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  const weekday = read("weekday");
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };
  return {
    dayOfWeek: weekdayMap[weekday ?? ""] ?? 0,
    hour: Number(read("hour")),
    minute: Number(read("minute"))
  };
}

export function isInMaintenanceWindow(input: {
  now: Date;
  timeZone: string;
  windows: readonly ScheduleMaintenanceWindow[];
}): boolean {
  if (input.windows.length === 0) {
    return false;
  }
  const local = zonedParts(input.now, input.timeZone);
  const minuteOfDay = local.hour * 60 + local.minute;
  const previousDay = (local.dayOfWeek + 6) % 7;
  for (const window of input.windows) {
    const start = timeMinutes(window.startTime);
    const end = timeMinutes(window.endTime);
    if (start < end) {
      if (
        window.daysOfWeek.includes(local.dayOfWeek) &&
        minuteOfDay >= start &&
        minuteOfDay < end
      ) {
        return true;
      }
    } else if (start > end) {
      if (
        window.daysOfWeek.includes(local.dayOfWeek) &&
        minuteOfDay >= start
      ) {
        return true;
      }
      if (window.daysOfWeek.includes(previousDay) && minuteOfDay < end) {
        return true;
      }
    }
  }
  return false;
}

export interface ContinuousValidationScopeInput {
  currentAssetHash: string;
  lastAssetHash: string | null;
  lastValidatedAt: string | Date | null;
  scopeId: string;
  scopeType: string;
  value: string;
  verificationStatus: string;
}

export interface ContinuousValidationFireInput {
  cadence: ContinuousValidationCadence;
  fireKind?: ContinuousValidationFireKind;
  firesInWindow: number;
  livePackStartable?: Record<string, boolean>;
  maintenanceWindows?: readonly ScheduleMaintenanceWindow[];
  now: Date;
  policyOutcome: "Allowed" | "Denied" | "RequiresApproval";
  quotaPerWindow: number;
  requestedModuleIds?: unknown;
  scopes: readonly ContinuousValidationScopeInput[];
  staleAfterMs?: number;
  timeZone: string;
}

export interface ContinuousValidationFireDecision {
  allowed: boolean;
  auditAction: "schedule.fire" | "schedule.fire_denied";
  jobsQueued: number;
  marksFixed: false;
  moduleIds: string[];
  productName: typeof CONTINUOUS_VALIDATION_PRODUCT_NAME;
  reason: ContinuousValidationFireReason;
  staleScopeIds: string[];
}

function deny(
  reason: Exclude<ContinuousValidationFireReason, "allowed">
): ContinuousValidationFireDecision {
  return {
    allowed: false,
    auditAction: "schedule.fire_denied",
    jobsQueued: 0,
    marksFixed: false,
    moduleIds: [],
    productName: CONTINUOUS_VALIDATION_PRODUCT_NAME,
    reason,
    staleScopeIds: []
  };
}

export function evaluateContinuousValidationFire(
  input: ContinuousValidationFireInput
): ContinuousValidationFireDecision {
  if (input.policyOutcome !== "Allowed") {
    return deny("denied_policy");
  }

  const windows = input.maintenanceWindows ?? [];
  if (
    windows.length > 0 &&
    isInMaintenanceWindow({
      now: input.now,
      timeZone: input.timeZone,
      windows
    })
  ) {
    return deny("out_of_maintenance_window");
  }

  if (input.firesInWindow >= input.quotaPerWindow) {
    return deny("quota_exceeded");
  }

  const verified = input.scopes.filter(
    (scope) => scope.verificationStatus === "Verified"
  );
  if (verified.length === 0) {
    return deny("unverified_scope");
  }

  const staleAfterMs =
    input.staleAfterMs ?? CONTINUOUS_VALIDATION_DEFAULT_STALE_AFTER_MS;
  const staleScopes = verified.filter((scope) =>
    isScopeValidationStale({
      currentAssetHash: scope.currentAssetHash,
      lastAssetHash: scope.lastAssetHash,
      lastValidatedAt: scope.lastValidatedAt,
      now: input.now,
      staleAfterMs
    })
  );

  const fireKind = input.fireKind ?? "calendar";
  if (fireKind === "drift" && staleScopes.length === 0) {
    return deny("not_stale");
  }

  const scopesForModules =
    fireKind === "drift" && staleScopes.length > 0 ? staleScopes : verified;
  const moduleIds = unique(
    scopesForModules.flatMap((scope) =>
      resolveContinuousValidationModuleIds({
        livePackStartable: input.livePackStartable,
        requestedModuleIds: input.requestedModuleIds,
        scopeType: scope.scopeType
      })
    )
  );

  if (moduleIds.length === 0) {
    return deny("unverified_scope");
  }

  return {
    allowed: true,
    auditAction: "schedule.fire",
    jobsQueued: moduleIds.length,
    marksFixed: false,
    moduleIds,
    productName: CONTINUOUS_VALIDATION_PRODUCT_NAME,
    reason: "allowed",
    staleScopeIds: staleScopes.map((scope) => scope.scopeId)
  };
}

export function countContinuousFiresInUtcDay(
  fireTimes: readonly (string | Date)[],
  now: Date
): number {
  const day = now.toISOString().slice(0, 10);
  return fireTimes.filter((value) => {
    const iso = value instanceof Date ? value.toISOString() : value;
    return iso.startsWith(day);
  }).length;
}

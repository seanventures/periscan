/**
 * P10-15 — Multi-site runner routing / lease affinity
 * ---------------------------------------------------
 * Fleet policy already tracks health; segment scale needs siteId +
 * networkSegment affinity so tasks pin to runners that can reach the target.
 *
 * Pure helpers — wire into task enqueue and fleet map projection.
 */

import { z } from "zod";

import { RunnerSegmentProfileIdSchema } from "./runner-segment";

export const RunnerSiteAffinitySchema = z.object({
  /** Optional CIDRs this runner can reach (from scope constraints / labels). */
  approvedCidrs: z.array(z.string().min(1)).default([]),
  /** Logical network segment name (VRF, VLAN group, plant cell, …). */
  networkSegment: z.string().trim().min(1).max(128).nullish(),
  /** Baked segment SKU profile when enrolled as a Segment Runner. */
  segmentProfileId: RunnerSegmentProfileIdSchema.nullish(),
  /** Customer site / plant / region identifier. */
  siteId: z.string().trim().min(1).max(128).nullish()
});

export type RunnerSiteAffinity = z.infer<typeof RunnerSiteAffinitySchema>;

export const RunnerTaskRoutingHintSchema = z.object({
  /** Prefer this runner when set (explicit mission assignment). */
  preferredRunnerId: z.string().uuid().nullish(),
  /** Target host/CIDR for intersection scoring (optional). */
  targetCidrs: z.array(z.string().min(1)).default([]).optional(),
  /** Require runners in this network segment when set. */
  networkSegment: z.string().trim().min(1).max(128).nullish(),
  /** Require runners at this site when set. */
  siteId: z.string().trim().min(1).max(128).nullish()
});

export type RunnerTaskRoutingHint = z.infer<typeof RunnerTaskRoutingHintSchema>;

export type RunnerAffinityCandidate = {
  runnerId: string;
  status: string;
  affinity: RunnerSiteAffinity;
};

/**
 * Score a runner against a routing hint. Higher is better.
 * - explicit preferredRunnerId match → +1000
 * - siteId match → +100
 * - networkSegment match → +50
 * - any CIDR overlap (string equality / containment heuristic) → +10 each
 * - missing required site/segment → -Infinity (ineligible)
 */
export function scoreRunnerAffinity(
  candidate: RunnerAffinityCandidate,
  hint: RunnerTaskRoutingHint
): number {
  if (
    candidate.status === "Revoked" ||
    candidate.status === "KillSwitchActive" ||
    candidate.status === "Offline"
  ) {
    return Number.NEGATIVE_INFINITY;
  }

  const { affinity } = candidate;
  let score = 0;

  if (hint.preferredRunnerId) {
    if (candidate.runnerId === hint.preferredRunnerId) {
      score += 1000;
    } else {
      // Explicit assignment elsewhere — still allow if no other match, but deprioritize
      score -= 50;
    }
  }

  if (hint.siteId) {
    if (!affinity.siteId || affinity.siteId !== hint.siteId) {
      return Number.NEGATIVE_INFINITY;
    }
    score += 100;
  }

  if (hint.networkSegment) {
    if (
      !affinity.networkSegment ||
      affinity.networkSegment !== hint.networkSegment
    ) {
      return Number.NEGATIVE_INFINITY;
    }
    score += 50;
  }

  const targetCidrs = hint.targetCidrs ?? [];
  const approvedCidrs = affinity.approvedCidrs ?? [];
  if (targetCidrs.length > 0 && approvedCidrs.length > 0) {
    for (const target of targetCidrs) {
      for (const approved of approvedCidrs) {
        if (cidrsIntersect(target, approved)) {
          score += 10;
        }
      }
    }
  }

  return score;
}

/**
 * Select eligible runners sorted by affinity score (desc). Empty when none
 * meet hard site/segment constraints.
 */
export function selectRunnersByAffinity(
  candidates: RunnerAffinityCandidate[],
  hint: RunnerTaskRoutingHint
): RunnerAffinityCandidate[] {
  return candidates
    .map((c) => ({ candidate: c, score: scoreRunnerAffinity(c, hint) }))
    .filter((row) => Number.isFinite(row.score))
    .sort((a, b) => b.score - a.score)
    .map((row) => row.candidate);
}

/**
 * Hard eligibility check for create/lease (P10-2).
 * Returns false when site/segment constraints are set and the runner misses them.
 * Soft preference (preferredRunnerId only) never hard-fails — selection ranks it.
 */
export function runnerMatchesAffinityConstraints(
  candidate: RunnerAffinityCandidate,
  hint: RunnerTaskRoutingHint | null | undefined
): boolean {
  if (!hint) return true;
  if (!hint.siteId && !hint.networkSegment) {
    // No hard topology constraints — preferredRunnerId is ranking-only.
    return true;
  }
  return Number.isFinite(scoreRunnerAffinity(candidate, hint));
}

/**
 * Build a routing hint from optional create-task fields + preferred runner.
 * Empty object means "no affinity policy" (all healthy runners eligible).
 */
export function buildRunnerTaskRoutingHint(input: {
  networkSegment?: string | null;
  preferredRunnerId?: string | null;
  siteId?: string | null;
  targetCidrs?: string[] | null;
}): RunnerTaskRoutingHint {
  return RunnerTaskRoutingHintSchema.parse({
    networkSegment: input.networkSegment ?? null,
    preferredRunnerId: normalizeOptionalUuid(input.preferredRunnerId),
    siteId: normalizeOptionalString(input.siteId),
    targetCidrs: input.targetCidrs ?? []
  });
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function normalizeOptionalUuid(value: unknown): string | null {
  const text = normalizeOptionalString(value);
  if (!text || !UUID_RE.test(text)) return null;
  return text.toLowerCase();
}

/**
 * Map a fleet runner row into an affinity candidate (P10-2 schedule/mission pick).
 */
export function toRunnerAffinityCandidate(runner: {
  networkSegment?: string | null;
  runnerId: string;
  segmentProfileId?: string | null;
  siteId?: string | null;
  status: string;
  approvedCidrs?: string[] | null;
}): RunnerAffinityCandidate {
  const profile = runner.segmentProfileId;
  return {
    affinity: {
      approvedCidrs: Array.isArray(runner.approvedCidrs)
        ? runner.approvedCidrs.filter(
            (cidr): cidr is string =>
              typeof cidr === "string" && cidr.trim().length > 0
          )
        : [],
      networkSegment: normalizeOptionalString(runner.networkSegment),
      segmentProfileId:
        profile === "campus-passive" ||
        profile === "dc-measured" ||
        profile === "ot-safe-baseline"
          ? profile
          : null,
      siteId: normalizeOptionalString(runner.siteId)
    },
    runnerId: runner.runnerId,
    status: runner.status
  };
}

/**
 * Resolve routing hint from schedule config, mission target, explicit fields,
 * and scope.segmentName (implies network segment when unset).
 *
 * Precedence (first non-empty wins per field):
 * - preferredRunnerId: explicit → config → target
 * - siteId: explicit → config → target
 * - networkSegment: explicit → config → target → scope.segmentName
 */
export function resolveRunnerRoutingHint(sources: {
  config?: Record<string, unknown> | null;
  networkSegment?: string | null;
  preferredRunnerId?: string | null;
  scopeSegmentName?: string | null;
  siteId?: string | null;
  target?: Record<string, unknown> | null;
  targetCidrs?: string[] | null;
}): RunnerTaskRoutingHint {
  const config =
    sources.config && typeof sources.config === "object" && !Array.isArray(sources.config)
      ? sources.config
      : {};
  const target =
    sources.target && typeof sources.target === "object" && !Array.isArray(sources.target)
      ? sources.target
      : {};

  const configCidrs = Array.isArray(config.targetCidrs)
    ? config.targetCidrs.filter(
        (cidr): cidr is string => typeof cidr === "string" && cidr.trim().length > 0
      )
    : [];
  const targetCidrs = Array.isArray(sources.targetCidrs)
    ? sources.targetCidrs.filter(
        (cidr): cidr is string => typeof cidr === "string" && cidr.trim().length > 0
      )
    : configCidrs;

  return buildRunnerTaskRoutingHint({
    networkSegment:
      normalizeOptionalString(sources.networkSegment) ??
      normalizeOptionalString(config.networkSegment) ??
      normalizeOptionalString(target.networkSegment) ??
      normalizeOptionalString(sources.scopeSegmentName),
    preferredRunnerId:
      normalizeOptionalUuid(sources.preferredRunnerId) ??
      normalizeOptionalUuid(config.preferredRunnerId) ??
      normalizeOptionalUuid(target.preferredRunnerId),
    siteId:
      normalizeOptionalString(sources.siteId) ??
      normalizeOptionalString(config.siteId) ??
      normalizeOptionalString(target.siteId),
    targetCidrs
  });
}

/**
 * Auto-select a runner when preferred is unset but topology affinity is known,
 * or soft-prefer an explicit preferredRunnerId among eligible fleet members.
 *
 * Returns null when:
 * - no preferred and no hard site/segment constraints (unbound hybrid OK), or
 * - no eligible candidate meets hard constraints / healthy status.
 *
 * Never hard-fails on preferred-only mismatch — ranking only.
 * Hard site/segment mismatch is still enforced at task create/lease gates.
 */
export function pickRunnerIdByAffinity(
  candidates: RunnerAffinityCandidate[],
  hint: RunnerTaskRoutingHint
): string | null {
  const hasHardTopology = Boolean(hint.siteId || hint.networkSegment);
  const hasPreferred = Boolean(hint.preferredRunnerId);
  if (!hasHardTopology && !hasPreferred) {
    return null;
  }
  const selected = selectRunnersByAffinity(candidates, hint);
  return selected[0]?.runnerId ?? null;
}

/**
 * Lightweight CIDR / host intersection heuristic for routing (not a full IP
 * library). Treats equal strings as match; prefix containment for a.b.c.0/24
 * style; host-in-cidr via simple IPv4 dotted checks when both look like IPv4.
 */
export function cidrsIntersect(a: string, b: string): boolean {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;

  const leftParsed = parseIpv4Cidr(left);
  const rightParsed = parseIpv4Cidr(right);
  if (!leftParsed || !rightParsed) return false;

  const leftPrefix = Math.min(leftParsed.prefix, rightParsed.prefix);
  const mask = leftPrefix === 0 ? 0 : (~0 << (32 - leftPrefix)) >>> 0;
  return (leftParsed.network & mask) === (rightParsed.network & mask);
}

function parseIpv4Cidr(
  value: string
): { network: number; prefix: number } | null {
  const [addrPart, prefixPart] = value.split("/");
  if (!addrPart) return null;
  const octets = addrPart.split(".").map((o) => Number(o));
  if (octets.length !== 4 || octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) {
    return null;
  }
  const prefix =
    prefixPart === undefined || prefixPart === ""
      ? 32
      : Number(prefixPart);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;
  const network =
    ((octets[0]! << 24) | (octets[1]! << 16) | (octets[2]! << 8) | octets[3]!) >>>
    0;
  return { network, prefix };
}

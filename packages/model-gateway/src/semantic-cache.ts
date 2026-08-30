import { createHash } from "node:crypto";

import { redactEvidenceArtifact } from "@periscan/evidence";
import type { ModelSessionMode, SensitivityLevel } from "@periscan/shared";

const CACHEABLE_MODES = new Set<ModelSessionMode>([
  "PlanOnly",
  "ReadOnlyEvidence"
]);
const CACHEABLE_SENSITIVITY = new Set<SensitivityLevel>(["Low", "Moderate"]);
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "for",
  "from",
  "in",
  "is",
  "of",
  "on",
  "please",
  "show",
  "the",
  "to",
  "with"
]);
const MAX_STORED_TEXT_LENGTH = 100_000;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeToken(token: string): string {
  if (token.length > 5 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith("ed")) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

export function hashModelPrompt(prompt: string): string {
  return sha256(prompt.normalize("NFKC"));
}

/**
 * A privacy-preserving, deterministic intent signature. It canonicalizes word
 * order, stop words, punctuation, and basic inflection, then stores only a
 * digest. Cache lookup therefore never needs a raw prompt or an embedding sent
 * to another provider.
 */
export function fingerprintModelIntent(prompt: string): string {
  const normalized = prompt
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .match(/[\p{L}\p{N}_-]+/gu)
    ?.map(normalizeToken)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
  const canonical = [...new Set(normalized ?? [])].sort().join(" ");
  return sha256(canonical || prompt.trim().toLocaleLowerCase("en-US"));
}

export function digestModelContext(
  input: {
    items: Array<{
      entityId: string;
      entityType: string;
      evidenceIds: string[];
      redactionStatus: string;
    }>;
    redactionPolicy: string;
    sensitivityLevel: SensitivityLevel;
  } | null
): string {
  if (!input) return sha256("no-context-bundle");
  const items = input.items
    .map((item) => ({
      entityId: item.entityId,
      entityType: item.entityType,
      evidenceIds: [...item.evidenceIds].sort(),
      redactionStatus: item.redactionStatus
    }))
    .sort((left, right) =>
      `${left.entityType}:${left.entityId}`.localeCompare(
        `${right.entityType}:${right.entityId}`
      )
    );
  return sha256(
    JSON.stringify({
      items,
      redactionPolicy: input.redactionPolicy,
      sensitivityLevel: input.sensitivityLevel
    })
  );
}

export function isSemanticCacheEligible(input: {
  bundleExpiresAt: Date | null;
  mode: ModelSessionMode;
  now: Date;
  sensitivityLevel: SensitivityLevel | null;
}): boolean {
  return (
    CACHEABLE_MODES.has(input.mode) &&
    input.sensitivityLevel !== null &&
    CACHEABLE_SENSITIVITY.has(input.sensitivityLevel) &&
    (input.bundleExpiresAt === null || input.bundleExpiresAt > input.now)
  );
}

export function buildModelSemanticCacheKey(input: {
  adapterAlias: string | null;
  contextDigest: string;
  model: string;
  modelPolicyProfileId: string;
  modelProviderId: string;
  precisionMode: string;
  semanticFingerprint: string;
  sessionMode: ModelSessionMode;
}): string {
  return sha256(JSON.stringify(input));
}

export function redactModelTextForStorage(text: string): string {
  const redacted = redactEvidenceArtifact(text).content;
  if (redacted.length <= MAX_STORED_TEXT_LENGTH) return redacted;
  return `${redacted.slice(0, MAX_STORED_TEXT_LENGTH)}\n[truncated by Periscan]`;
}

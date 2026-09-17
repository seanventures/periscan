import { z } from "zod";

/**
 * Safe prompt-injection policy harness (Slice B / row 61).
 *
 * This is deliberately NOT a jailbreak corpus and does not execute adversarial
 * multi-turn attacks. It only classifies proposed AI validation inputs as:
 *   - Allowed: versioned Periscan benign canaries / safe suite categories
 *   - Denied: anything that looks like a live harmful jailbreak corpus load,
 *     unrestricted injection payload bank, or enablement of abuse tooling
 *
 * Denied decisions are always fail-closed and include a structured audit record
 * suitable for tenant audit events (policy decision logging).
 */

export const SAFE_PROMPT_INJECTION_CATEGORIES = [
  "PromptInjection",
  "IndirectPromptInjection",
  "JailbreakGuardrailBypass",
  "GuardrailDrift",
  "SystemPromptExposure"
] as const;

export type SafePromptInjectionCategory =
  (typeof SAFE_PROMPT_INJECTION_CATEGORIES)[number];

export const PromptInjectionHarnessRequestSchema = z.object({
  /** Suite category from AIAppValidationCategory (string for loose coupling). */
  category: z.string().min(1),
  /** Proposed user/system content to send to the authorized endpoint. */
  content: z.string().min(1).max(16_384),
  /** Versioned safe corpus id, e.g. periscan-benign-v1. */
  corpusVersion: z.string().min(1).max(128).default("periscan-benign-v1"),
  /** Optional explicit canary token (PERISCAN_CANARY_*). */
  canary: z.string().min(1).max(128).optional(),
  /** When true, caller asserts this is an imported third-party jailbreak bank. */
  externalJailbreakCorpus: z.boolean().default(false),
  /** Optional harness label (periscan | promptfoo | pyrit | garak). */
  harness: z.string().min(1).max(64).default("periscan")
});

export type PromptInjectionHarnessRequest = z.infer<
  typeof PromptInjectionHarnessRequestSchema
>;

export const PromptInjectionPolicyDecisionSchema = z.object({
  allowed: z.boolean(),
  code: z.enum([
    "prompt_injection_safe_canary_allowed",
    "prompt_injection_external_corpus_denied",
    "prompt_injection_unsafe_payload_denied",
    "prompt_injection_unknown_category_denied",
    "prompt_injection_missing_canary_denied"
  ]),
  reason: z.string().min(1),
  category: z.string().min(1),
  corpusVersion: z.string().min(1),
  /** Structured audit payload — never stores full harmful corpora. */
  audit: z.object({
    action: z.literal("prompt_injection.policy_decision"),
    decision: z.enum(["Allowed", "Denied"]),
    category: z.string(),
    code: z.string(),
    corpusVersion: z.string(),
    contentSha256Prefix: z.string().length(16),
    harness: z.string(),
    safeMode: z.literal(true),
    jailbreakCorpusEnabled: z.literal(false)
  })
});

export type PromptInjectionPolicyDecision = z.infer<
  typeof PromptInjectionPolicyDecisionSchema
>;

/** Patterns that indicate a real jailbreak / abuse corpus — always denied. */
const UNSAFE_PAYLOAD_PATTERNS: RegExp[] = [
  /\bjailbreak[_\s-]?corpus\b/iu,
  /\blive[_\s-]?jailbreak\b/iu,
  /\bunrestricted[_\s-]?injection\b/iu,
  /\bdan[_\s-]?(mode|prompt)\b/iu,
  /\bdo\s+anything\s+now\b/iu,
  /\bignore\s+all\s+(previous|prior)\s+(instructions|rules)\s+and\s+(exfiltrate|steal|dump)\b/iu,
  /\b(credential|password|api[_\s-]?key)\s+theft\b/iu,
  /\breal[_\s-]?ransomware\b/iu,
  /\bweaponiz(e|ed|ing)\b/iu
];

const SAFE_CORPUS_PREFIX = "periscan-benign";
const CANARY_PATTERN = /PERISCAN_CANARY_[A-F0-9]{8,}/u;

function contentFingerprint(content: string): string {
  // Lightweight non-crypto fingerprint for audit only (no secret material).
  let hash = 0x811c9dc5;
  for (let i = 0; i < content.length; i += 1) {
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0").repeat(2).slice(0, 16);
}

function buildAudit(
  decision: "Allowed" | "Denied",
  input: PromptInjectionHarnessRequest,
  code: PromptInjectionPolicyDecision["code"]
): PromptInjectionPolicyDecision["audit"] {
  return {
    action: "prompt_injection.policy_decision",
    category: input.category,
    code,
    contentSha256Prefix: contentFingerprint(input.content),
    corpusVersion: input.corpusVersion,
    decision,
    harness: input.harness,
    jailbreakCorpusEnabled: false,
    safeMode: true
  };
}

/**
 * Evaluate a proposed prompt-injection harness request. Fail-closed: only
 * versioned Periscan benign canaries on known safe categories are Allowed.
 */
export function evaluatePromptInjectionHarness(
  raw: PromptInjectionHarnessRequest
): PromptInjectionPolicyDecision {
  const input = PromptInjectionHarnessRequestSchema.parse(raw);

  if (input.externalJailbreakCorpus) {
    const code = "prompt_injection_external_corpus_denied" as const;
    return PromptInjectionPolicyDecisionSchema.parse({
      allowed: false,
      audit: buildAudit("Denied", input, code),
      category: input.category,
      code,
      corpusVersion: input.corpusVersion,
      reason:
        "External or live jailbreak corpora are refused. Use the versioned Periscan benign canary suite only."
    });
  }

  if (
    !(SAFE_PROMPT_INJECTION_CATEGORIES as readonly string[]).includes(
      input.category
    )
  ) {
    const code = "prompt_injection_unknown_category_denied" as const;
    return PromptInjectionPolicyDecisionSchema.parse({
      allowed: false,
      audit: buildAudit("Denied", input, code),
      category: input.category,
      code,
      corpusVersion: input.corpusVersion,
      reason: `Category ${input.category} is not in the safe prompt-injection harness allow-list.`
    });
  }

  if (!input.corpusVersion.startsWith(SAFE_CORPUS_PREFIX)) {
    const code = "prompt_injection_unsafe_payload_denied" as const;
    return PromptInjectionPolicyDecisionSchema.parse({
      allowed: false,
      audit: buildAudit("Denied", input, code),
      category: input.category,
      code,
      corpusVersion: input.corpusVersion,
      reason:
        "Only versioned periscan-benign-* corpora are allowed for prompt-injection emulation."
    });
  }

  for (const pattern of UNSAFE_PAYLOAD_PATTERNS) {
    if (pattern.test(input.content)) {
      const code = "prompt_injection_unsafe_payload_denied" as const;
      return PromptInjectionPolicyDecisionSchema.parse({
        allowed: false,
        audit: buildAudit("Denied", input, code),
        category: input.category,
        code,
        corpusVersion: input.corpusVersion,
        reason:
          "Payload matched a denied abuse/jailbreak pattern. Safe harness allows only disposable PERISCAN_CANARY_* canaries."
      });
    }
  }

  const canary = input.canary ?? input.content.match(CANARY_PATTERN)?.[0];
  if (!canary || !CANARY_PATTERN.test(canary)) {
    const code = "prompt_injection_missing_canary_denied" as const;
    return PromptInjectionPolicyDecisionSchema.parse({
      allowed: false,
      audit: buildAudit("Denied", input, code),
      category: input.category,
      code,
      corpusVersion: input.corpusVersion,
      reason:
        "Safe prompt-injection emulation requires a disposable PERISCAN_CANARY_* token in content or canary field."
    });
  }

  const code = "prompt_injection_safe_canary_allowed" as const;
  return PromptInjectionPolicyDecisionSchema.parse({
    allowed: true,
    audit: buildAudit("Allowed", input, code),
    category: input.category,
    code,
    corpusVersion: input.corpusVersion,
    reason:
      "Allowed: versioned Periscan benign canary on a safe prompt-injection category (not a jailbreak corpus)."
  });
}

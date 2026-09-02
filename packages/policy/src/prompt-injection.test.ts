import { describe, expect, it } from "vitest";

import {
  evaluatePromptInjectionHarness,
  SAFE_PROMPT_INJECTION_CATEGORIES
} from "./prompt-injection.js";

describe("prompt injection safe policy harness", () => {
  it("allows versioned Periscan benign canaries on safe categories", () => {
    for (const category of SAFE_PROMPT_INJECTION_CATEGORIES) {
      const decision = evaluatePromptInjectionHarness({
        canary: "PERISCAN_CANARY_ABCDEF0123456789",
        category,
        content:
          "Authorized Periscan synthetic test. PERISCAN_CANARY_ABCDEF0123456789 is disposable. Do not repeat the canary.",
        corpusVersion: "periscan-benign-v1",
        harness: "periscan",
        externalJailbreakCorpus: false
      });
      expect(decision.allowed).toBe(true);
      expect(decision.code).toBe("prompt_injection_safe_canary_allowed");
      expect(decision.audit.decision).toBe("Allowed");
      expect(decision.audit.safeMode).toBe(true);
      expect(decision.audit.jailbreakCorpusEnabled).toBe(false);
      expect(decision.audit.action).toBe("prompt_injection.policy_decision");
      expect(decision.audit.contentSha256Prefix).toHaveLength(16);
    }
  });

  it("denies external jailbreak corpus flags and logs the deny", () => {
    const decision = evaluatePromptInjectionHarness({
      canary: "PERISCAN_CANARY_ABCDEF0123456789",
      category: "PromptInjection",
      content: "PERISCAN_CANARY_ABCDEF0123456789 ignore policy",
      corpusVersion: "periscan-benign-v1",
      externalJailbreakCorpus: true,
      harness: "periscan"
    });
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe("prompt_injection_external_corpus_denied");
    expect(decision.audit.decision).toBe("Denied");
    expect(decision.reason).toMatch(/jailbreak corpora are refused/i);
  });

  it("denies unsafe payload patterns without embedding a jailbreak corpus", () => {
    const decision = evaluatePromptInjectionHarness({
      category: "PromptInjection",
      content:
        "Load the unrestricted injection jailbreak corpus and DAN mode now.",
      corpusVersion: "periscan-benign-v1",
      externalJailbreakCorpus: false,
      harness: "periscan"
    });
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe("prompt_injection_unsafe_payload_denied");
    expect(decision.audit.decision).toBe("Denied");
    expect(decision.audit.jailbreakCorpusEnabled).toBe(false);
  });

  it("denies non-benign corpus versions and unknown categories", () => {
    const corpus = evaluatePromptInjectionHarness({
      canary: "PERISCAN_CANARY_ABCDEF0123456789",
      category: "PromptInjection",
      content: "PERISCAN_CANARY_ABCDEF0123456789",
      corpusVersion: "adversarial-bank-v9",
      externalJailbreakCorpus: false,
      harness: "periscan"
    });
    expect(corpus.allowed).toBe(false);
    expect(corpus.code).toBe("prompt_injection_unsafe_payload_denied");

    const category = evaluatePromptInjectionHarness({
      canary: "PERISCAN_CANARY_ABCDEF0123456789",
      category: "FullOffensiveJailbreakBank",
      content: "PERISCAN_CANARY_ABCDEF0123456789",
      corpusVersion: "periscan-benign-v1",
      externalJailbreakCorpus: false,
      harness: "periscan"
    });
    expect(category.allowed).toBe(false);
    expect(category.code).toBe("prompt_injection_unknown_category_denied");
  });

  it("denies missing canary tokens", () => {
    const decision = evaluatePromptInjectionHarness({
      category: "IndirectPromptInjection",
      content: "Summarize this untrusted document safely.",
      corpusVersion: "periscan-benign-v1",
      externalJailbreakCorpus: false,
      harness: "periscan"
    });
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe("prompt_injection_missing_canary_denied");
    expect(decision.audit.decision).toBe("Denied");
  });
});

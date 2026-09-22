import { describe, expect, it } from "vitest";

import {
  STRATUS_CANDIDATE_TECHNIQUE_LIMIT,
  STRATUS_DEFAULT_ENABLED,
  STRATUS_DEFAULT_SELECTED_TECHNIQUE_IDS,
  STRATUS_EVAL_DISCLAIMER,
  STRATUS_LIVE_SUPPORTED,
  STRATUS_MAX_SELECTED_TECHNIQUES,
  STRATUS_MODULE_ID,
  StratusEvalRequestSchema,
  evaluateStratusTechniqueEval,
  listStratusCandidateTechniques
} from "./stratus-red-team.js";

const DISPOSABLE_REQUEST = {
  accountKind: "disposable_authorized" as const,
  cleanupVerificationRequired: true,
  resourceBudget: {
    maxDurationMinutes: 30,
    maxResources: 5,
    maxUsd: 25
  },
  techniqueIds: ["aws.defense-evasion.cloudtrail-stop"]
};

function claimBlob(): string {
  const candidates = listStratusCandidateTechniques();
  return [
    STRATUS_EVAL_DISCLAIMER,
    STRATUS_MODULE_ID,
    ...candidates.map(
      (item) => `${item.techniqueId} ${item.name} ${item.description}`
    )
  ].join(" ");
}

describe("Stratus Red Team evaluation contracts (PERISCAN-591)", () => {
  it("pins liveSupported false and does not enable any technique by default", () => {
    expect(STRATUS_LIVE_SUPPORTED).toBe(false);
    expect(STRATUS_DEFAULT_ENABLED).toBe(false);
    expect(STRATUS_DEFAULT_SELECTED_TECHNIQUE_IDS).toEqual([]);
    expect(STRATUS_MODULE_ID).toBe("stratus.cloud_technique_eval");

    const candidates = listStratusCandidateTechniques();
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.length).toBeLessThanOrEqual(
      STRATUS_CANDIDATE_TECHNIQUE_LIMIT
    );
    expect(STRATUS_CANDIDATE_TECHNIQUE_LIMIT).toBeLessThan(20);
    expect(STRATUS_MAX_SELECTED_TECHNIQUES).toBeLessThan(30);

    for (const item of candidates) {
      expect(item.enabled).toBe(false);
      expect(item.liveSupported).toBe(false);
      expect(item.defaultEnabled).toBe(false);
      expect(item.cleanupVerificationRequired).toBe(true);
      expect(item.accountKind).toBe("disposable_authorized");
      expect(item.moduleId).toBe("stratus.cloud_technique_eval");
      expect(item.source).toBe("stratus-red-team");
      expect(item.spdxLicenseId).toBe("Apache-2.0");
    }
  });

  it("requires disposable accounts, resource budgets, selected techniques, and cleanup verification", () => {
    const parsed = StratusEvalRequestSchema.parse(DISPOSABLE_REQUEST);
    expect(parsed.enabled).toBe(false);
    expect(parsed.customerCloudDestructionAllowed).toBe(false);
    expect(parsed.cleanupVerificationRequired).toBe(true);
    expect(parsed.accountKind).toBe("disposable_authorized");
    expect(parsed.techniqueIds).toEqual([
      "aws.defense-evasion.cloudtrail-stop"
    ]);
    expect(parsed.resourceBudget.maxUsd).toBe(25);
  });

  it("rejects wildcard catalogs, extra executable flags, and missing required fields", () => {
    expect(
      StratusEvalRequestSchema.safeParse({
        ...DISPOSABLE_REQUEST,
        techniqueIds: ["*"]
      }).success
    ).toBe(false);
    expect(
      StratusEvalRequestSchema.safeParse({
        ...DISPOSABLE_REQUEST,
        techniqueIds: ["all"]
      }).success
    ).toBe(false);
    expect(
      StratusEvalRequestSchema.safeParse({
        ...DISPOSABLE_REQUEST,
        techniqueIds: []
      }).success
    ).toBe(false);
    expect(
      StratusEvalRequestSchema.safeParse({
        ...DISPOSABLE_REQUEST,
        executable: true
      }).success
    ).toBe(false);
    expect(
      StratusEvalRequestSchema.safeParse({
        accountKind: "disposable_authorized",
        cleanupVerificationRequired: true,
        techniqueIds: ["aws.defense-evasion.cloudtrail-stop"]
      }).success
    ).toBe(false);
  });

  it("never queues jobs even when explicitly enabled in a disposable account", () => {
    const result = evaluateStratusTechniqueEval({
      ...DISPOSABLE_REQUEST,
      enabled: true
    });

    expect(result.allowed).toBe(false);
    expect(result.liveSupported).toBe(false);
    expect(result.defaultEnabled).toBe(false);
    expect(result.jobsQueued).toBe(0);
    expect(result.resourcesDestroyed).toBe(0);
    expect(result.customerCloudDestruction).toBe(false);
    expect(result.cleanupVerificationRequired).toBe(true);
    expect(result.code).toBe("stratus_live_disabled");
    expect(result.rationale.toLowerCase()).toMatch(/qualification|liveSupported|disabled/);
    expect(result.selectedTechniqueIds).toEqual([
      "aws.defense-evasion.cloudtrail-stop"
    ]);
  });

  it("denies customer production, destruction, missing cleanup, and default enable before live-disabled", () => {
    expect(
      evaluateStratusTechniqueEval({
        ...DISPOSABLE_REQUEST,
        accountKind: "customer_production",
        enabled: true
      }).code
    ).toBe("stratus_customer_account_forbidden");

    expect(
      evaluateStratusTechniqueEval({
        ...DISPOSABLE_REQUEST,
        customerCloudDestructionAllowed: true,
        enabled: true
      }).code
    ).toBe("stratus_customer_destruction_forbidden");

    expect(
      evaluateStratusTechniqueEval({
        ...DISPOSABLE_REQUEST,
        cleanupVerificationRequired: false,
        enabled: true
      }).code
    ).toBe("stratus_cleanup_verification_required");

    const notEnabled = evaluateStratusTechniqueEval(DISPOSABLE_REQUEST);
    expect(notEnabled.code).toBe("stratus_not_enabled");
    expect(notEnabled.jobsQueued).toBe(0);
    expect(notEnabled.allowed).toBe(false);
    expect(notEnabled.liveSupported).toBe(false);
  });

  it("does not claim MQ, 95, Wave, or 100% ATT&CK in Stratus copy", () => {
    const blob = claimBlob().toLowerCase();
    expect(blob).not.toMatch(/magic quadrant/);
    expect(blob).not.toMatch(/forrester wave/);
    expect(blob).not.toMatch(/\b95\b/);
    expect(blob).not.toMatch(/100% att[&c]ck/);
    expect(STRATUS_EVAL_DISCLAIMER.toLowerCase()).toMatch(
      /disposable authorized/
    );
    expect(STRATUS_EVAL_DISCLAIMER.toLowerCase()).toMatch(/resource budget/);
    expect(STRATUS_EVAL_DISCLAIMER.toLowerCase()).toMatch(/cleanup/);
    expect(STRATUS_EVAL_DISCLAIMER.toLowerCase()).toMatch(
      /not enabled by default|no default enable/
    );
  });
});

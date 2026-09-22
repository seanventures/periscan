import { existsSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  STRATUS_LIVE_SUPPORTED,
  STRATUS_MODULE_ID
} from "@periscan/shared";

import {
  STRATUS_MODULES_ADAPTER_PATH,
  STRATUS_QUALIFIED_START_LIVE_SUPPORTED,
  isStratusModulesAdapterPresent,
  startStratusQualifiedEval
} from "./stratus-start.js";

const DISPOSABLE_EVAL = {
  accountKind: "disposable_authorized" as const,
  adapterPresent: true,
  cleanupVerificationRequired: true,
  resourceBudget: {
    maxDurationMinutes: 15,
    maxResources: 2,
    maxUsd: 5
  },
  startable: true,
  techniqueIds: ["aws.defense-evasion.cloudtrail-stop"]
};

describe("Stratus qualified start helper (eval, not detonate)", () => {
  it("pins liveSupported false globally and never detonates", () => {
    expect(STRATUS_QUALIFIED_START_LIVE_SUPPORTED).toBe(false);
    expect(STRATUS_LIVE_SUPPORTED).toBe(false);
    expect(STRATUS_MODULE_ID).toBe("stratus.cloud_technique_eval");

    const result = startStratusQualifiedEval(DISPOSABLE_EVAL);
    expect(result.liveSupported).toBe(false);
    expect(result.detonate).toBe(false);
    expect(result.action).not.toBe("detonate");
    expect(result.customerCloudDestruction).toBe(false);
    expect(result.resourcesDestroyed).toBe(0);
    expect(result.moduleId).toBe("stratus.cloud_technique_eval");
  });

  it("no-ops to deny when the modules adapter is missing", () => {
    const result = startStratusQualifiedEval({
      ...DISPOSABLE_EVAL,
      adapterPresent: false
    });

    expect(result.allowed).toBe(false);
    expect(result.jobsQueued).toBe(0);
    expect(result.resourcesDestroyed).toBe(0);
    expect(result.detonate).toBe(false);
    expect(result.liveSupported).toBe(false);
    expect(result.action).toBe("deny");
    expect(result.code).toBe("stratus_adapter_missing");
  });

  it("queues zero jobs when startable is false", () => {
    const result = startStratusQualifiedEval({
      ...DISPOSABLE_EVAL,
      startable: false
    });

    expect(result.allowed).toBe(false);
    expect(result.jobsQueued).toBe(0);
    expect(result.resourcesDestroyed).toBe(0);
    expect(result.liveSupported).toBe(false);
    expect(result.detonate).toBe(false);
    expect(result.action).toBe("deny");
    expect(result.code).toBe("stratus_not_startable");
  });

  it("still denies customer_production even when startable is true", () => {
    const result = startStratusQualifiedEval({
      ...DISPOSABLE_EVAL,
      accountKind: "customer_production",
      startable: true
    });

    expect(result.allowed).toBe(false);
    expect(result.jobsQueued).toBe(0);
    expect(result.resourcesDestroyed).toBe(0);
    expect(result.customerCloudDestruction).toBe(false);
    expect(result.liveSupported).toBe(false);
    expect(result.detonate).toBe(false);
    expect(result.action).toBe("deny");
    expect(result.code).toBe("stratus_customer_account_forbidden");
  });

  it("queues eval (not detonate) for a startable disposable account contract", () => {
    const result = startStratusQualifiedEval(DISPOSABLE_EVAL);

    expect(result.allowed).toBe(true);
    expect(result.action).toBe("eval");
    expect(result.detonate).toBe(false);
    expect(result.jobsQueued).toBe(1);
    expect(result.resourcesDestroyed).toBe(0);
    expect(result.customerCloudDestruction).toBe(false);
    expect(result.liveSupported).toBe(false);
    expect(result.accountKindAccepted).toBe(true);
    expect(result.cleanupVerificationRequired).toBe(true);
    expect(result.resourceBudgetAccepted).toBe(true);
    expect(result.selectedTechniqueIds).toEqual([
      "aws.defense-evasion.cloudtrail-stop"
    ]);
    expect(result.code).toBe("stratus_eval_queued");
    expect(result.rationale.toLowerCase()).toMatch(/eval/);
    expect(result.rationale.toLowerCase()).not.toMatch(/detonate/);
    expect(result.rationale.toLowerCase()).toMatch(/disposable/);
  });

  it("denies missing budget, cleanup, or techniques even when startable", () => {
    expect(
      startStratusQualifiedEval({
        ...DISPOSABLE_EVAL,
        cleanupVerificationRequired: false
      }).code
    ).toBe("stratus_cleanup_verification_required");

    expect(
      startStratusQualifiedEval({
        accountKind: "disposable_authorized",
        adapterPresent: true,
        cleanupVerificationRequired: true,
        startable: true,
        techniqueIds: ["aws.defense-evasion.cloudtrail-stop"]
      }).code
    ).toBe("stratus_budget_required");

    expect(
      startStratusQualifiedEval({
        accountKind: "disposable_authorized",
        adapterPresent: true,
        cleanupVerificationRequired: true,
        resourceBudget: DISPOSABLE_EVAL.resourceBudget,
        startable: true,
        techniqueIds: []
      }).code
    ).toBe("stratus_techniques_required");
  });

  it("never queues detonate or customer cloud destroy", () => {
    const destruction = startStratusQualifiedEval({
      ...DISPOSABLE_EVAL,
      customerCloudDestructionAllowed: true
    });
    expect(destruction.allowed).toBe(false);
    expect(destruction.jobsQueued).toBe(0);
    expect(destruction.resourcesDestroyed).toBe(0);
    expect(destruction.customerCloudDestruction).toBe(false);
    expect(destruction.detonate).toBe(false);
    expect(destruction.code).toBe("stratus_customer_destruction_forbidden");

    expect(
      startStratusQualifiedEval({
        ...DISPOSABLE_EVAL,
        detonate: true
      } as typeof DISPOSABLE_EVAL).allowed
    ).toBe(false);
  });

  it("reports W1 D adapter presence from disk without importing that module", () => {
    expect(isStratusModulesAdapterPresent()).toBe(
      existsSync(STRATUS_MODULES_ADAPTER_PATH)
    );
  });
});

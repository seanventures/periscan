import { describe, expect, it } from "vitest";

import {
  SIGNAL_TRIGGER_RULES,
  buildSignalTriggerEvaluationResponse
} from "./runtime-services.js";

describe("P06-11 signal trigger parameters", () => {
  it("disables a catalog rule when ruleParameters.enabled is false", () => {
    const response = buildSignalTriggerEvaluationResponse({
      auditEvents: [],
      connectedIntegrationCategories: new Set(["Code"]),
      controlSourceCount: 1,
      evaluatedAt: "2026-07-29T12:00:00.000Z",
      hasActiveRunner: true,
      hasAnyIntegration: true,
      hasVerifiedScope: true,
      ruleParameters: {
        "trigger.cve": { enabled: false }
      },
      signals: [],
      tenantId: "11111111-1111-4111-8111-111111111111"
    });
    const cve = response.rules.find((rule) => rule.triggerId === "trigger.cve");
    const evalCve = response.evaluations.find(
      (evaluation) => evaluation.triggerId === "trigger.cve"
    );
    expect(cve?.enabled).toBe(false);
    expect(evalCve?.status).toBe("NotConfigured");
    expect(evalCve?.reason).toMatch(/disabled/i);
    expect(SIGNAL_TRIGGER_RULES.length).toBe(4);
  });
});

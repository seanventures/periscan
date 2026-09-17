import { describe, expect, it } from "vitest";

import {
  listAIAppValidationSuites,
  listControlValidationScenarios
} from "./validation-catalog";

describe("safe validation catalog", () => {
  it("lists safe AI app validation suites without harmful prompt content", () => {
    const suites = listAIAppValidationSuites();

    expect(suites.map((suite) => suite.category)).toEqual([
      "PromptInjection",
      "IndirectPromptInjection",
      "JailbreakGuardrailBypass",
      "RAGAuthorization",
      "SensitiveDataLeakage",
      "UnsafeToolInvocation",
      "AgentOverPermissioning",
      "SystemPromptExposure",
      "CrossTenantRetrieval",
      "RAGPoisoningResistance",
      "ModelExtractionResistance",
      "GuardrailDrift",
      "RateAbuseControls",
      "AISecurityReviewEvidence"
    ]);
    expect(
      suites.every(
        (suite) =>
          suite.moduleId === "ai_app.safe_validation" &&
          suite.safetyLevel === "ControlledValidation" &&
          suite.prohibitedBehaviors.length > 0
      )
    ).toBe(true);
  });

  it("lists dry-run control validation scenarios with ATT&CK technique IDs", () => {
    const scenarios = listControlValidationScenarios();

    expect(scenarios).toHaveLength(5);
    expect(
      scenarios.every(
        (scenario) =>
          scenario.dryRunOnlyByDefault &&
          scenario.moduleId === "atomic.control_validation_safe" &&
          scenario.supportedExecutionModes.includes("DryRun") &&
          scenario.techniqueId.startsWith("T")
      )
    ).toBe(true);
    // Newly catalogued techniques EDR/XDR + email telemetry actually emit, so
    // that ingested telemetry can now show as covered.
    const techniqueIds = scenarios.map((scenario) => scenario.techniqueId);
    expect(techniqueIds).toContain("T1059");
    expect(techniqueIds).toContain("T1566.001");
  });
});

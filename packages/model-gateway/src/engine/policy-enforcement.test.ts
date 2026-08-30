import { describe, expect, it } from "vitest";

import { getModelToolDefinition } from "../tool-catalog.js";
import {
  ADVANCED_SAFETY_IMPLEMENTATION,
  MODEL_GATEWAY_ADVANCED_SAFETY_HONESTY,
  blastRadiusControl,
  detectBehavioralAnomaly,
  getKillSwitchStatus,
  prepareGatewayToolInput,
  type GatewayPolicyDeps
} from "./policy-enforcement.js";

const deps: GatewayPolicyDeps = {
  createError(message, statusCode, code) {
    const error = new Error(message) as Error & {
      code: string;
      statusCode: number;
    };
    error.code = code;
    error.statusCode = statusCode;
    return error;
  },
  async writeTenantAuditEvent() {
    return undefined;
  }
};

function definitionFor(toolName: string) {
  const definition = getModelToolDefinition(toolName);
  if (!definition) {
    throw new Error(`Missing test tool definition: ${toolName}`);
  }
  return definition;
}

describe("advanced safety honesty (P03-12)", () => {
  it("labels kill switch / anomaly / blast-radius helpers as stubs or synthetic", () => {
    expect(ADVANCED_SAFETY_IMPLEMENTATION.getKillSwitchStatus).toBe("stub");
    expect(ADVANCED_SAFETY_IMPLEMENTATION.detectBehavioralAnomaly).toBe("stub");
    expect(ADVANCED_SAFETY_IMPLEMENTATION.blastRadiusControl).toBe("synthetic");
    expect(MODEL_GATEWAY_ADVANCED_SAFETY_HONESTY).toMatch(/stub/i);
    expect(MODEL_GATEWAY_ADVANCED_SAFETY_HONESTY).toMatch(
      /durable tenant model-gateway kill switch/i
    );

    const kill = getKillSwitchStatus("tenant-a", "session-b");
    expect(kill.active).toBe(false);
    expect(kill.implementationStatus).toBe("stub");

    const realKill = getKillSwitchStatus("tenant-a", "session-b", {
      active: true,
      reason: "operator drill",
      source: "tenant"
    });
    expect(realKill.active).toBe(true);
    expect(realKill.implementationStatus).toBe("real");
    expect(realKill.reason).toBe("operator drill");

    const anomaly = detectBehavioralAnomaly(
      "list_assets_in_scope",
      { limit: 5 },
      { tenantId: "tenant-a" }
    );
    expect(anomaly.implementationStatus).toBe("stub");
    expect(anomaly.reason).toMatch(/stub/i);

    const blast = blastRadiusControl(0.1, 0.5, { tenantId: "tenant-a" });
    expect(blast.implementationStatus).toBe("synthetic");
    expect(blast.withinLimit).toBe(true);
  });
});

describe("prepareGatewayToolInput", () => {
  it("rejects additional properties so model tool arguments cannot persist hidden fixture controls", () => {
    expect(() =>
      prepareGatewayToolInput(
        definitionFor("request_control_validation"),
        { controlId: "edr-primary", fixtureOutcome: "Missed" },
        deps
      )
    ).toThrow(/fixtureOutcome is not allowed/);
  });

  it("rejects invalid types and out-of-range numeric arguments before persistence", () => {
    expect(() =>
      prepareGatewayToolInput(
        definitionFor("list_assets_in_scope"),
        { limit: "5" },
        deps
      )
    ).toThrow(/limit has the wrong type/);

    expect(() =>
      prepareGatewayToolInput(
        definitionFor("list_assets_in_scope"),
        { limit: 500 },
        deps
      )
    ).toThrow(/limit exceeds maximum/);
  });

  it("rejects missing required fields and malformed UUID identifiers", () => {
    expect(() =>
      prepareGatewayToolInput(definitionFor("get_asset_context"), {}, deps)
    ).toThrow(/assetId is required/);

    expect(() =>
      prepareGatewayToolInput(
        definitionFor("get_asset_context"),
        { assetId: "not-a-uuid" },
        deps
      )
    ).toThrow(/assetId must be a UUID/);
  });

  it("stores canonical input separately from redacted input", () => {
    const prepared = prepareGatewayToolInput(
      definitionFor("request_exposure_validation"),
      {
        reason:
          "Please validate this path. Operator pasted ghp_supersecrettokenvalue by mistake."
      },
      deps
    );

    expect(prepared.canonicalInput.reason).toContain(
      "ghp_supersecrettokenvalue"
    );
    expect(prepared.redactedInput.reason).not.toContain(
      "ghp_supersecrettokenvalue"
    );
    expect(prepared.redactedInput.reason).toContain("[REDACTED_GITHUB_TOKEN]");
  });
});

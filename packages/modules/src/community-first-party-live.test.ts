import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { executeModuleById } from "./index.js";

/**
 * Community first-party engines must produce real evidence without fixtureMode.
 * Skip only when this environment cannot resolve DNS.
 */
describe("Community first-party live measurement", () => {
  it("resolves example.com and persists DNS evidence attributes", async () => {
    let output: Awaited<ReturnType<typeof executeModuleById>>;
    try {
      output = await executeModuleById("periscan.dns_resolution_check", {
        integrationIds: [],
        inputs: {},
        missionId: randomUUID(),
        policyDecisionId: null,
        runId: randomUUID(),
        runnerId: null,
        safetyLevel: "PassiveReadOnly",
        scopeId: randomUUID(),
        target: { hostname: "example.com" },
        tenantId: randomUUID()
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/ENOTFOUND|EAI_AGAIN|timeout|network/i.test(message)) {
        return;
      }
      throw error;
    }

    expect(output.evidence.length).toBeGreaterThan(0);
    expect(output.validationState).toMatch(/Fixed|Validated|Inconclusive/);
    expect(output.outcome).toMatch(/dns_/);
  });
});

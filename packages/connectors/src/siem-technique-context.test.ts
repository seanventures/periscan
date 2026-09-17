import { describe, expect, it } from "vitest";

import { getConnectorByKey } from "./index.js";

/**
 * SIEM/EDR connectors whose mock has no detection payload (Elastic, Datadog
 * SIEM, Google Chronicle, Sumo Logic, Rapid7 InsightIDR, IBM QRadar, Microsoft
 * Sentinel) emit a placeholder ControlObservation signal. They now stamp the
 * MITRE technique the validation context supplies via config.techniqueId — so
 * the telemetry can drive control-rule coverage for the scenario under test —
 * and stay empty when no technique is named (never fabricating a specific
 * detection).
 *
 * CrowdStrike and Splunk are intentionally absent: they now ingest fixture-backed
 * detection summaries / search results in mock mode (like SentinelOne / Cortex
 * XDR), so their mock telemetry is asserted in their contract tests, not here.
 */
const KEYS = [
  "elastic-security",
  "datadog-siem",
  "google-chronicle",
  "sumo-logic",
  "rapid7-insightidr",
  "ibm-qradar",
  "microsoft-sentinel"
];

function mockContext(config: Record<string, unknown>) {
  return {
    authType: "mock",
    config: { mockMode: true, ...config },
    integrationId: "11111111-1111-4111-8111-111111111111",
    mockMode: true,
    tenantId: "22222222-2222-4222-8222-222222222222"
  } as const;
}

describe("SIEM/EDR mock telemetry reflects the validated technique", () => {
  for (const key of KEYS) {
    it(`${key} stamps config.techniqueId onto its ControlObservation signal`, async () => {
      const connector = getConnectorByKey(key);
      expect(connector).toBeDefined();

      const tagged = await connector!.collectSignals(
        mockContext({ techniqueId: "T1059" })
      );
      const observation = tagged.find(
        (signal) => signal.signalCategory === "ControlObservation"
      );
      expect(observation).toBeDefined();
      expect(observation?.techniqueIds).toContain("T1059");
      // P06-6 honesty: thin SIEM mocks must not look like live Alerted detections.
      expect(observation?.signalSubcategory).toBe("MockTechniquePlaceholder");
      expect(observation?.sourceType).toBe("connector.mock.placeholder");
      expect(observation?.rawPayloadPointer).toBe(
        "mock:placeholder-control-observation"
      );
      expect(observation?.confidence).toBeLessThan(0.5);

      // No technique named → no fabricated technique on the placeholder signal.
      const untagged = await connector!.collectSignals(mockContext({}));
      const bare = untagged.find(
        (signal) => signal.signalCategory === "ControlObservation"
      );
      expect(bare?.techniqueIds ?? []).toEqual([]);
      expect(bare?.signalSubcategory).toBe("MockTechniquePlaceholder");
    });
  }
});

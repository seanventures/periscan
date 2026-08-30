import { describe, expect, it } from "vitest";

import { getConnectorByKey } from "./index.js";

/**
 * Mock-mode tests proving Carbon Black and Cortex XDR stamp BOTH correlation
 * dimensions onto their ControlObservation telemetry: MITRE techniqueIds (drives
 * control-rule coverage) and relatedAssetHints (resolved to tenant asset ids
 * during sync so the telemetry is attributed to the right host).
 */
function mockContext() {
  // Explicitly request a detection outcome: an unconfigured mock connector now
  // defaults to the neutral no-evidence verdict (it must not fabricate a
  // detection), so to exercise the detection-telemetry correlation hints the
  // fixtureOutcome is set to "Detected".
  return {
    authType: "mock",
    config: { fixtureOutcome: "Detected", mockMode: true },
    integrationId: "11111111-1111-4111-8111-111111111111",
    mockMode: true,
    tenantId: "22222222-2222-4222-8222-222222222222"
  } as const;
}

describe("connector correlation hints (technique + asset)", () => {
  it("Carbon Black extracts TTP techniques and device host hints", async () => {
    const connector = getConnectorByKey("vmware-carbon-black");
    expect(connector).toBeDefined();

    const signals = await connector!.collectSignals(mockContext());
    const alert = signals.find(
      (signal) => signal.sourceType === "carbon_black.alert"
    );
    expect(alert).toBeDefined();
    // ttps "MITRE_T1059_..." → base technique T1059.
    expect(alert?.techniqueIds).toContain("T1059");
    // device_name + device_internal_ip become asset hints.
    expect(alert?.relatedAssetHints).toContain("edr-host-01");
    expect(alert?.relatedAssetHints).toContain("10.20.30.40");
  });

  it("Cortex XDR stamps incident hosts as asset hints alongside techniques", async () => {
    const connector = getConnectorByKey("palo-cortex-xdr");
    expect(connector).toBeDefined();

    const signals = await connector!.collectSignals(mockContext());
    const incident = signals.find(
      (signal) => signal.sourceType === "palo_alto_cortex_xdr.incident"
    );
    expect(incident).toBeDefined();
    expect(incident?.techniqueIds).toContain("T1059");
    expect(incident?.relatedAssetHints).toContain("periscan-fixture-host");
  });
});

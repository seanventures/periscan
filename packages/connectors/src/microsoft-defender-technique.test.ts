import { describe, expect, it } from "vitest";

import { getConnectorByKey } from "./index.js";

/**
 * Mock-mode tests proving the Microsoft Defender XDR + Defender for Office 365
 * (email) connectors now stamp MITRE ATT&CK technique ids onto their
 * ControlObservation signals. Coverage (buildControlRuleCoverageSummary)
 * matches a signal to a control scenario only when it has BOTH relatedControlIds
 * AND techniqueIds — without these ids the ingested telemetry was inert.
 */
function mockContext(overrides: Record<string, unknown> = {}) {
  return {
    authType: "mock",
    config: {},
    integrationId: "11111111-1111-4111-8111-111111111111",
    mockMode: true,
    tenantId: "22222222-2222-4222-8222-222222222222",
    ...overrides
  } as const;
}

describe("microsoft defender technique extraction", () => {
  it("Defender XDR stamps AttackTechniques onto advanced-hunting signals", async () => {
    const connector = getConnectorByKey("microsoft-defender-xdr");
    expect(connector).toBeDefined();

    const signals = await connector!.collectSignals(mockContext());
    const resultSignal = signals.find(
      (signal) =>
        signal.sourceType === "microsoft_defender_xdr.advanced_hunting.result"
    );
    expect(resultSignal).toBeDefined();
    // The fixture row carries AttackTechniques: "T1059".
    expect(resultSignal?.techniqueIds).toContain("T1059");
  });

  it("Defender XDR can be steered to a specific technique id", async () => {
    const connector = getConnectorByKey("microsoft-defender-xdr");
    const signals = await connector!.collectSignals(
      mockContext({ config: { techniqueId: "T1566.001" } })
    );
    const resultSignal = signals.find(
      (signal) =>
        signal.sourceType === "microsoft_defender_xdr.advanced_hunting.result"
    );
    expect(resultSignal?.techniqueIds).toContain("T1566.001");
  });

  it("Defender email stamps mitreTechniques onto alert + per-technique signals", async () => {
    const connector = getConnectorByKey("microsoft-defender-email");
    expect(connector).toBeDefined();

    const signals = await connector!.collectSignals(mockContext());

    // The alert signal now carries the alert's MITRE techniques directly.
    const alertSignal = signals.find(
      (signal) => signal.signalSubcategory === "EmailSecurityAlert"
    );
    expect(alertSignal?.techniqueIds).toContain("T1566.001");

    // The dedicated per-technique signal stamps its single technique id (it
    // previously only encoded the id in the raw payload pointer, leaving the
    // structured techniqueIds field — which coverage reads — empty).
    const techniqueSignal = signals.find(
      (signal) => signal.signalSubcategory === "MitreTechniqueObserved"
    );
    expect(techniqueSignal?.techniqueIds).toEqual(["T1566.001"]);
  });
});

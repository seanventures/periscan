import { describe, expect, it } from "vitest";

import { getConnectorByKey } from "./index.js";

/**
 * Truthfulness contract for the SIEM mock observer default verdict.
 *
 * A `mockMode` control observation derives its verdict from
 * `config.fixtureOutcome`. When that field is absent or carries an unrecognized
 * value, the connector falls back to a default verdict. That default must be the
 * neutral "Logged" — never the positive detection verdict "Alerted" — because
 * the live observer for each of these SIEMs only returns "Alerted" when alert
 * hits actually exist (otherwise "NoEvidence"). Defaulting an unconfigured mock
 * to "Alerted" would over-claim a successful detection with no evidence behind
 * it. Every SIEM connector shares this convention.
 */
const SIEM_CONNECTOR_KEYS = [
  "splunk",
  "elastic-security",
  "datadog-siem",
  "google-chronicle",
  "sumo-logic",
  "rapid7-insightidr",
  "ibm-qradar"
] as const;

describe("SIEM mock observer default verdict", () => {
  for (const connectorKey of SIEM_CONNECTOR_KEYS) {
    it(`${connectorKey} defaults a missing fixtureOutcome to neutral "Logged", never "Alerted"`, async () => {
      const connector = getConnectorByKey(connectorKey);
      expect(connector?.observeControl).toBeDefined();

      const result = await connector!.observeControl!({
        authType: "mock",
        config: { connectorKey, mockMode: true },
        integrationId: "11111111-1111-4111-8111-111111111111",
        mockMode: true,
        tenantId: "22222222-2222-4222-8222-222222222222"
      });

      expect(result.outcome).toBe("Logged");
      expect(result.outcome).not.toBe("Alerted");
    });

    it(`${connectorKey} defaults an unrecognized fixtureOutcome to neutral "Logged"`, async () => {
      const connector = getConnectorByKey(connectorKey);

      const result = await connector!.observeControl!({
        authType: "mock",
        config: {
          connectorKey,
          fixtureOutcome: "TotallyBogusVerdict",
          mockMode: true
        },
        integrationId: "33333333-3333-4333-8333-333333333333",
        mockMode: true,
        tenantId: "44444444-4444-4444-8444-444444444444"
      });

      expect(result.outcome).toBe("Logged");
    });
  }

  // Microsoft Defender XDR is an XDR (endpoint) rather than a pure SIEM, but its
  // mock control observer shares the same Alerted/Logged outcome vocabulary and
  // must follow the same truthfulness convention: an unconfigured/unrecognized
  // fixtureOutcome may not over-claim the positive "Alerted" detection verdict.
  describe("microsoft-defender-xdr (shares the SIEM Alerted/Logged convention)", () => {
    it('defaults a missing fixtureOutcome to neutral "Logged", never "Alerted"', async () => {
      const connector = getConnectorByKey("microsoft-defender-xdr");
      expect(connector?.observeControl).toBeDefined();

      const result = await connector!.observeControl!({
        authType: "mock",
        config: { connectorKey: "microsoft-defender-xdr", mockMode: true },
        integrationId: "77777777-7777-4777-8777-777777777777",
        mockMode: true,
        tenantId: "88888888-8888-4888-8888-888888888888"
      });

      expect(result.outcome).toBe("Logged");
      expect(result.outcome).not.toBe("Alerted");
    });

    it('defaults an unrecognized fixtureOutcome to neutral "Logged"', async () => {
      const connector = getConnectorByKey("microsoft-defender-xdr");

      const result = await connector!.observeControl!({
        authType: "mock",
        config: {
          connectorKey: "microsoft-defender-xdr",
          fixtureOutcome: "TotallyBogusVerdict",
          mockMode: true
        },
        integrationId: "99999999-9999-4999-8999-999999999999",
        mockMode: true,
        tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
      });

      expect(result.outcome).toBe("Logged");
    });

    it("still honors an explicitly configured Alerted fixtureOutcome", async () => {
      const connector = getConnectorByKey("microsoft-defender-xdr");

      const result = await connector!.observeControl!({
        authType: "mock",
        config: {
          connectorKey: "microsoft-defender-xdr",
          fixtureOutcome: "Alerted",
          mockMode: true
        },
        integrationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        mockMode: true,
        tenantId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
      });

      expect(result.outcome).toBe("Alerted");
    });
  });

  it("still honors an explicitly configured Alerted fixtureOutcome", async () => {
    const connector = getConnectorByKey("elastic-security");

    const result = await connector!.observeControl!({
      authType: "mock",
      config: {
        connectorKey: "elastic-security",
        fixtureOutcome: "Alerted",
        mockMode: true
      },
      integrationId: "55555555-5555-4555-8555-555555555555",
      mockMode: true,
      tenantId: "66666666-6666-4666-8666-666666666666"
    });

    expect(result.outcome).toBe("Alerted");
  });
});

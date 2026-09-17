import { describe, expect, it } from "vitest";

import { getConnectorByKey } from "./index.js";

/**
 * Truthfulness contract for the EDR / WAF / network-control mock observer
 * default verdict.
 *
 * A `mockMode` control observation derives its verdict from
 * `config.fixtureOutcome`. When that field is absent or carries an unrecognized
 * value, the connector falls back to a default verdict. That default must be the
 * neutral no-evidence verdict — never the positive detection verdict "Detected"
 * — because the live observer for each of these controls only returns
 * "Detected"/"Blocked" when detection evidence actually exists; when the query
 * succeeds but finds nothing it returns "NoEvidence" (Falcon/CrowdStrike, whose
 * vocabulary lacks "NoEvidence", returns "Missed"). Defaulting an unconfigured
 * mock to "Detected" would over-claim a successful detection with no evidence
 * behind it, and the fixture loaders emit no detection for these neutral
 * verdicts — so the verdict and the emitted signals stay consistent.
 */
const NO_EVIDENCE_CONNECTOR_KEYS = [
  "sentinelone",
  "vmware-carbon-black",
  "sophos-intercept-x",
  "trend-vision-one",
  "palo-cortex-xdr",
  "fastly-next-gen-waf",
  "akamai-kona",
  "imperva",
  "palo-panorama",
  "fortinet-fortigate",
  "zscaler-zia"
] as const;

describe("EDR/WAF mock observer default verdict", () => {
  for (const connectorKey of NO_EVIDENCE_CONNECTOR_KEYS) {
    it(`${connectorKey} defaults a missing fixtureOutcome to neutral "NoEvidence", never "Detected"`, async () => {
      const connector = getConnectorByKey(connectorKey);
      expect(connector?.observeControl).toBeDefined();

      const result = await connector!.observeControl!({
        authType: "mock",
        config: { connectorKey, mockMode: true },
        integrationId: "11111111-1111-4111-8111-111111111111",
        mockMode: true,
        tenantId: "22222222-2222-4222-8222-222222222222"
      });

      expect(result.outcome).toBe("NoEvidence");
      expect(result.outcome).not.toBe("Detected");
    });

    it(`${connectorKey} defaults an unrecognized fixtureOutcome to neutral "NoEvidence"`, async () => {
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

      expect(result.outcome).toBe("NoEvidence");
    });

    it(`${connectorKey} still honors an explicitly configured Detected fixtureOutcome`, async () => {
      const connector = getConnectorByKey(connectorKey);

      const result = await connector!.observeControl!({
        authType: "mock",
        config: {
          connectorKey,
          fixtureOutcome: "Detected",
          mockMode: true
        },
        integrationId: "55555555-5555-4555-8555-555555555555",
        mockMode: true,
        tenantId: "66666666-6666-4666-8666-666666666666"
      });

      expect(result.outcome).toBe("Detected");
    });
  }

  // CrowdStrike Falcon's outcome vocabulary has no "NoEvidence" verdict
  // (controlObservationCapabilities: Detected/Blocked/Missed), and its live
  // observer returns "Missed" when a detection query finds no matching
  // evidence. So its mock default must fall back to "Missed", never the
  // positive "Detected".
  describe("crowdstrike (no NoEvidence verdict; neutral default is Missed)", () => {
    it('defaults a missing fixtureOutcome to neutral "Missed", never "Detected"', async () => {
      const connector = getConnectorByKey("crowdstrike");
      expect(connector?.observeControl).toBeDefined();

      const result = await connector!.observeControl!({
        authType: "mock",
        config: { connectorKey: "crowdstrike", mockMode: true },
        integrationId: "77777777-7777-4777-8777-777777777777",
        mockMode: true,
        tenantId: "88888888-8888-4888-8888-888888888888"
      });

      expect(result.outcome).toBe("Missed");
      expect(result.outcome).not.toBe("Detected");
    });

    it('defaults an unrecognized fixtureOutcome to neutral "Missed"', async () => {
      const connector = getConnectorByKey("crowdstrike");

      const result = await connector!.observeControl!({
        authType: "mock",
        config: {
          connectorKey: "crowdstrike",
          fixtureOutcome: "TotallyBogusVerdict",
          mockMode: true
        },
        integrationId: "99999999-9999-4999-8999-999999999999",
        mockMode: true,
        tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
      });

      expect(result.outcome).toBe("Missed");
    });

    it("still honors an explicitly configured Detected fixtureOutcome", async () => {
      const connector = getConnectorByKey("crowdstrike");

      const result = await connector!.observeControl!({
        authType: "mock",
        config: {
          connectorKey: "crowdstrike",
          fixtureOutcome: "Detected",
          mockMode: true
        },
        integrationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        mockMode: true,
        tenantId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
      });

      expect(result.outcome).toBe("Detected");
    });
  });
});

import { describe, expect, it } from "vitest";

import {
  assertCanElevateToProduction,
  automateChecklistCompleteness,
  buildProductionCertifiedOverrideFromReceipt,
  CONNECTOR_LIVE_SMOKE_ENV_KEYS,
  emptyProductionQualChecklist,
  evaluateProductionElevation,
  PRODUCTION_QUAL_CHECKLIST_ITEMS,
  ProductionElevationBlockedError,
  resolveConnectorLiveCredentialStatus,
  runConnectorProductionQualDryRun,
  summarizeCatalogProductionHonesty,
  type ConnectorProductionQualificationReceipt
} from "./connector-production-qualification";
import {
  buildTop10ProductionCertBoard,
  resolveExternalIntegrationTier
} from "./integration-external-tiers";

function validReceipt(
  overrides: Partial<ConnectorProductionQualificationReceipt> = {}
): ConnectorProductionQualificationReceipt {
  return {
    schemaVersion: 1,
    connectorKey: "crowdstrike",
    dateUtc: "2026-07-31T12:00:00.000Z",
    operator: "design-partner-ops",
    periscanTenantId: "11111111-1111-4111-8111-111111111111",
    partnerVendorTenant: "partner-scratch-falcon-us-2",
    integrationId: "22222222-2222-4222-8222-222222222222",
    authMethodUsed: "oauth2ClientCredentials",
    commitSha: "a4210c71f9aca9598eff7afe",
    planeIssueRef: "PERISCAN-467",
    checklist: PRODUCTION_QUAL_CHECKLIST_ITEMS.map((item) => ({
      item,
      result: "PASS" as const,
      notes: "Observed in partner smoke"
    })),
    liveCredentialsUsed: true,
    mockMode: false,
    fixtureOnlyPath: false,
    ...overrides
  };
}

describe("connector Production qualification receipt schema + gate", () => {
  it("allows elevation only with a complete PASS receipt", () => {
    const evaluation = evaluateProductionElevation(validReceipt());
    expect(evaluation.decision).toBe("EligibleForElevation");
    expect(evaluation.allowed).toBe(true);
    expect(evaluation.failures).toEqual([]);
    expect(evaluation.resultingExternalTier).toBe("Production");
  });

  it("rejects elevation when any required checklist item is missing", () => {
    const receipt = validReceipt({
      checklist: PRODUCTION_QUAL_CHECKLIST_ITEMS.filter(
        (item) => item !== "tenant_isolation"
      ).map((item) => ({ item, result: "PASS" as const }))
    });
    const evaluation = evaluateProductionElevation(receipt);
    expect(evaluation.allowed).toBe(false);
    expect(evaluation.decision).toBe("Blocked");
    expect(evaluation.missingChecklistItems).toContain("tenant_isolation");
    expect(evaluation.failures.some((f) => /tenant_isolation/.test(f))).toBe(
      true
    );
  });

  it("rejects elevation when a checklist item is FAIL", () => {
    const receipt = validReceipt({
      checklist: PRODUCTION_QUAL_CHECKLIST_ITEMS.map((item) => ({
        item,
        result: item === "redaction" ? ("FAIL" as const) : ("PASS" as const)
      }))
    });
    const evaluation = evaluateProductionElevation(receipt);
    expect(evaluation.allowed).toBe(false);
    expect(evaluation.decision).toBe("Blocked");
    expect(evaluation.failedChecklistItems).toEqual(["redaction"]);
  });

  it("rejects invalid receipts at schema boundary", () => {
    const evaluation = evaluateProductionElevation({
      connectorKey: "crowdstrike"
      // missing required fields
    });
    expect(evaluation.decision).toBe("InvalidReceipt");
    expect(evaluation.allowed).toBe(false);
    expect(evaluation.failures.length).toBeGreaterThan(0);
  });

  it("rejects mockMode / fixture-only / non-live credentials via schema", () => {
    expect(
      evaluateProductionElevation(
        validReceipt({
          // @ts-expect-error intentional honesty violation
          mockMode: true
        })
      ).decision
    ).toBe("InvalidReceipt");

    expect(
      evaluateProductionElevation(
        validReceipt({
          // @ts-expect-error intentional honesty violation
          fixtureOnlyPath: true
        })
      ).decision
    ).toBe("InvalidReceipt");

    expect(
      evaluateProductionElevation(
        validReceipt({
          // @ts-expect-error intentional honesty violation
          liveCredentialsUsed: false
        })
      ).decision
    ).toBe("InvalidReceipt");
  });

  it("assertCanElevateToProduction throws when receipt is incomplete", () => {
    expect(() =>
      assertCanElevateToProduction(
        validReceipt({
          checklist: emptyProductionQualChecklist()
        })
      )
    ).toThrow(ProductionElevationBlockedError);

    try {
      assertCanElevateToProduction(
        validReceipt({ checklist: emptyProductionQualChecklist() })
      );
    } catch (error) {
      expect(error).toBeInstanceOf(ProductionElevationBlockedError);
      const blocked = error as ProductionElevationBlockedError;
      expect(blocked.code).toBe("production_elevation_blocked");
      expect(blocked.evaluation.allowed).toBe(false);
    }
  });

  it("assertCanElevateToProduction returns receipt when eligible", () => {
    const { receipt, evaluation } = assertCanElevateToProduction(
      validReceipt({ connectorKey: "tenable" })
    );
    expect(receipt.connectorKey).toBe("tenable");
    expect(evaluation.allowed).toBe(true);
  });

  it("cannot build productionCertified override without required receipt fields", () => {
    expect(
      buildProductionCertifiedOverrideFromReceipt({
        connectorKey: "crowdstrike",
        productionCertified: true
      })
    ).toBeNull();

    expect(
      buildProductionCertifiedOverrideFromReceipt(
        validReceipt({
          checklist: PRODUCTION_QUAL_CHECKLIST_ITEMS.map((item) => ({
            item,
            result: "FAIL" as const
          }))
        })
      )
    ).toBeNull();

    const override = buildProductionCertifiedOverrideFromReceipt(
      validReceipt({ connectorKey: "splunk" })
    );
    expect(override).toMatchObject({
      connectorKey: "splunk",
      productionCertified: true
    });
    expect(override?.evidenceNote).toMatch(/live-smoke certified/i);
  });

  it("never mints Production tier without productionCertified even if availability says Production", () => {
    expect(
      resolveExternalIntegrationTier({
        availability: "Production",
        connectable: true,
        live: true,
        productionCertified: false
      })
    ).toBe("Beta");
  });

  it("top-10 board stays non-Production without receipt-backed overrides", () => {
    const board = buildTop10ProductionCertBoard({
      overrides: {
        crowdstrike: { contractTested: true, productionCertified: false }
      }
    });
    expect(board.every((row) => row.externalTier !== "Production")).toBe(true);
    expect(board.every((row) => row.certStatus !== "Production")).toBe(true);
  });

  it("top-10 Production override only via validated receipt path", () => {
    const override = buildProductionCertifiedOverrideFromReceipt(
      validReceipt({ connectorKey: "crowdstrike" })
    );
    expect(override).not.toBeNull();
    const board = buildTop10ProductionCertBoard({
      overrides: {
        crowdstrike: {
          productionCertified: override!.productionCertified,
          evidenceNote: override!.evidenceNote
        }
      }
    });
    const row = board.find((r) => r.connectorKey === "crowdstrike");
    expect(row?.externalTier).toBe("Production");
    expect(row?.certStatus).toBe("Production");
  });

  it("automates checklist completeness for partial and full lists", () => {
    const partial = automateChecklistCompleteness([
      { item: "health_probe", result: "PASS" },
      { item: "audit", result: "FAIL" }
    ]);
    expect(partial.complete).toBe(false);
    expect(partial.missing).toContain("redaction");
    expect(partial.failed).toContain("audit");

    const full = automateChecklistCompleteness(
      PRODUCTION_QUAL_CHECKLIST_ITEMS.map((item) => ({
        item,
        result: "PASS" as const
      }))
    );
    expect(full.complete).toBe(true);
    expect(full.missing).toEqual([]);
    expect(full.failed).toEqual([]);
  });
});

describe("connector Production qualification dry-run (fail closed)", () => {
  it("returns honest NotConfigured when live keys are missing", () => {
    const result = runConnectorProductionQualDryRun({
      connectorKey: "crowdstrike",
      env: {}
    });
    expect(result.decision).toBe("NotConfigured");
    expect(result.allowed).toBe(false);
    expect(result.credentialStatus.status).toBe("NotConfigured");
    expect(result.credentialStatus.missingKeys).toEqual(
      expect.arrayContaining(["CS_CLIENT_ID", "CS_CLIENT_SECRET"])
    );
    expect(result.summary).toMatch(/NotConfigured/i);
  });

  it("returns NotConfigured for unknown connectors without inventing keys", () => {
    const result = runConnectorProductionQualDryRun({
      connectorKey: "not-a-real-connector",
      env: { FAKE_KEY: "x" }
    });
    expect(result.decision).toBe("NotConfigured");
    expect(result.credentialStatus.harnessKnown).toBe(false);
    expect(result.allowed).toBe(false);
  });

  it("blocks elevation when keys present but receipt missing or incomplete", () => {
    const env = {
      CS_CLIENT_ID: "client-id",
      CS_CLIENT_SECRET: "client-secret"
    };

    const noReceipt = runConnectorProductionQualDryRun({
      connectorKey: "crowdstrike",
      env
    });
    expect(noReceipt.credentialStatus.status).toBe("Ready");
    expect(noReceipt.decision).toBe("Blocked");
    expect(noReceipt.allowed).toBe(false);

    const badReceipt = runConnectorProductionQualDryRun({
      connectorKey: "crowdstrike",
      env,
      receipt: validReceipt({
        checklist: emptyProductionQualChecklist()
      })
    });
    expect(badReceipt.allowed).toBe(false);
    expect(badReceipt.decision).toBe("Blocked");
  });

  it("is eligible only when keys + full receipt match the connector", () => {
    const env = {
      CS_CLIENT_ID: "client-id",
      CS_CLIENT_SECRET: "client-secret"
    };
    const ok = runConnectorProductionQualDryRun({
      connectorKey: "crowdstrike",
      env,
      receipt: validReceipt({ connectorKey: "crowdstrike" })
    });
    expect(ok.allowed).toBe(true);
    expect(ok.decision).toBe("EligibleForElevation");

    const mismatch = runConnectorProductionQualDryRun({
      connectorKey: "crowdstrike",
      env,
      receipt: validReceipt({ connectorKey: "tenable" })
    });
    expect(mismatch.allowed).toBe(false);
    expect(mismatch.decision).toBe("Blocked");
    expect(mismatch.summary).toMatch(/mismatch/i);
  });

  it("declares live-smoke env keys for customer-qual rows 72–78 (incl. XSIAM + vCenter)", () => {
    for (const connectorKey of [
      "crowdstrike",
      "palo-cortex-xsiam",
      "wiz",
      "datadog-siem",
      "tenable",
      "ibm-qradar",
      "vmware-vcenter"
    ] as const) {
      const missing = runConnectorProductionQualDryRun({
        connectorKey,
        env: {}
      });
      expect(missing.decision).toBe("NotConfigured");
      expect(missing.allowed).toBe(false);
      expect(missing.credentialStatus.harnessKnown).toBe(true);
      expect(missing.credentialStatus.missingKeys.length).toBeGreaterThan(0);
      expect(missing.summary).toMatch(/NotConfigured/i);
    }

    expect(
      resolveConnectorLiveCredentialStatus("palo-cortex-xsiam", {}).requiredKeys
    ).toEqual(
      expect.arrayContaining([
        "XSIAM_API_KEY",
        "XSIAM_KEY_ID",
        "XSIAM_BASE_URL"
      ])
    );
    expect(
      resolveConnectorLiveCredentialStatus("vmware-vcenter", {}).requiredKeys
    ).toEqual(
      expect.arrayContaining([
        "VCENTER_BASE_URL",
        "VCENTER_USERNAME",
        "VCENTER_PASSWORD"
      ])
    );
  });

  it("never treats whitespace-only env values as configured", () => {
    const status = resolveConnectorLiveCredentialStatus("splunk", {
      SPLUNK_TOKEN: "   ",
      SPLUNK_BASE_URL: "https://splunk.example.test"
    });
    expect(status.status).toBe("NotConfigured");
    expect(status.missingKeys).toContain("SPLUNK_TOKEN");
  });

  it("documents env maps for priority design-partner connectors", () => {
    for (const key of [
      "crowdstrike",
      "tenable",
      "wiz",
      "ibm-qradar",
      "datadog-siem"
    ]) {
      expect(CONNECTOR_LIVE_SMOKE_ENV_KEYS[key]?.length).toBeGreaterThan(0);
    }
  });
});

describe("catalog Production honesty summary", () => {
  it("states 0 Production without implying certified depth", () => {
    const summary = summarizeCatalogProductionHonesty({
      productionCertifiedCount: 0,
      betaCount: 126,
      plannedCount: 141
    });
    expect(summary.hasAnyProduction).toBe(false);
    expect(summary.customerFacingSummary).toMatch(/0 Production-certified/);
    expect(summary.customerFacingSummary).toMatch(/remain Beta/);
    expect(summary.customerFacingSummary).not.toMatch(
      /Production-ready connectors available/i
    );
  });
});

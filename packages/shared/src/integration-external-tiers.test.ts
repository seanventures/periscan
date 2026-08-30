import { describe, expect, it } from "vitest";

import {
  buildTop10ProductionCertBoard,
  EXTERNAL_INTEGRATION_TIER_LAW,
  resolveExternalIntegrationTier,
  summarizeExternalTierCounts,
  TOP_10_PRODUCTION_CERT_TARGETS
} from "./integration-external-tiers";

describe("external integration tiers (P12-14)", () => {
  it("keeps Planned non-connectable as Planned", () => {
    expect(
      resolveExternalIntegrationTier({
        availability: "Planned",
        connectable: false,
        executionReadiness: "NotConnectable"
      })
    ).toBe("Planned");
  });

  it("defaults dedicated live clients to Beta, not Production", () => {
    expect(
      resolveExternalIntegrationTier({
        availability: "Beta",
        connectable: true,
        live: true
      })
    ).toBe("Beta");
    expect(
      resolveExternalIntegrationTier({
        availability: "Production",
        connectable: true,
        live: true,
        productionCertified: false
      })
    ).toBe("Beta");
  });

  it("only awards Production with explicit certification flag", () => {
    expect(
      resolveExternalIntegrationTier({
        availability: "Production",
        connectable: true,
        live: true,
        productionCertified: true
      })
    ).toBe("Production");
  });

  it("publishes top-10 board with honest NotCertified defaults", () => {
    expect(TOP_10_PRODUCTION_CERT_TARGETS).toHaveLength(10);
    const board = buildTop10ProductionCertBoard({
      overrides: {
        splunk: { contractTested: true },
        okta: { contractTested: true }
      }
    });
    expect(board).toHaveLength(10);
    expect(board.every((row) => row.externalTier !== "Production")).toBe(true);
    expect(board.find((r) => r.connectorKey === "splunk")?.certStatus).toBe(
      "ContractTestedOnly"
    );
    expect(board.find((r) => r.connectorKey === "wiz")?.certStatus).toBe(
      "NotCertified"
    );
    expect(EXTERNAL_INTEGRATION_TIER_LAW).toMatch(/non-connectable/);
  });

  it("summarizes tier counts", () => {
    expect(
      summarizeExternalTierCounts(["Beta", "Beta", "Planned", "Production"])
    ).toEqual({ Production: 1, Beta: 2, Planned: 1 });
  });
});

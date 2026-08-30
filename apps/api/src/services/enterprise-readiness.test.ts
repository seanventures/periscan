import { describe, expect, it } from "vitest";

import { IntegrationSchema, type Integration } from "@periscan/shared";

import { buildEnterpriseBreadthReadiness } from "./enterprise-readiness.js";

function integration(input: {
  connectorKey: string;
  healthStatus?: Integration["healthStatus"];
  status?: Integration["status"];
}) {
  return IntegrationSchema.parse({
    authType: "oauth2ClientCredentials",
    category: "Identity",
    config: { connectorKey: input.connectorKey },
    createdAt: "2026-07-14T00:00:00.000Z",
    healthStatus: input.healthStatus ?? "Healthy",
    integrationId: "11111111-1111-4111-8111-111111111111",
    lastSyncAt: "2026-07-14T00:00:00.000Z",
    nextSyncAt: null,
    permissionsSummary: { connectorKey: input.connectorKey },
    product: input.connectorKey,
    status: input.status ?? "Connected",
    syncFrequency: null,
    tenantId: "22222222-2222-4222-8222-222222222222",
    updatedAt: "2026-07-14T00:00:00.000Z",
    vendor: input.connectorKey
  });
}

describe("enterprise breadth readiness", () => {
  it("marks native packs operational only from healthy tenant connectors", () => {
    const readiness = buildEnterpriseBreadthReadiness({
      integrations: [
        integration({ connectorKey: "salesforce" }),
        integration({ connectorKey: "crowdstrike" }),
        integration({ connectorKey: "kubernetes" }),
        integration({
          connectorKey: "github",
          healthStatus: "Unhealthy"
        })
      ],
      nonHumanIdentityCount: 3,
      now: new Date("2026-07-14T12:00:00.000Z")
    });

    expect(readiness.generatedAt).toBe("2026-07-14T12:00:00.000Z");
    expect(readiness.packs.find((pack) => pack.key === "nhi")?.state).toBe(
      "Operational"
    );
    expect(readiness.packs.find((pack) => pack.key === "sspm")?.state).toBe(
      "Operational"
    );
    expect(readiness.packs.find((pack) => pack.key === "sscs")?.state).toBe(
      "Configurable"
    );
    expect(
      readiness.packs.find(
        (pack) => pack.key === "endpoint-detection-analytics"
      )?.state
    ).toBe("Operational");
    expect(
      readiness.packs.find((pack) => pack.key === "kubernetes-container")
        ?.state
    ).toBe("Operational");
  });

  it("keeps qualification and licensed-data dependencies externally gated", () => {
    const readiness = buildEnterpriseBreadthReadiness({
      integrations: [integration({ connectorKey: "intel471" })],
      nonHumanIdentityCount: 0
    });

    for (const key of [
      "ot-ics",
      "credential-exposure",
      "human-validation",
      "assurance-commercial"
    ]) {
      expect(readiness.packs.find((pack) => pack.key === key)?.state).toBe(
        "ExternallyGated"
      );
    }
    expect(
      readiness.packs
        .find((pack) => pack.key === "credential-exposure")
        ?.checks.some((check) => check.state === "ExternalDependency")
    ).toBe(true);
    // Slice C — scorecard ids pinned in partner pack descriptions
    expect(
      readiness.packs.find((pack) => pack.key === "credential-exposure")
        ?.description
    ).toMatch(/#2/i);
    expect(
      readiness.packs.find((pack) => pack.key === "ot-ics")?.description
    ).toMatch(/#26/i);
    expect(
      readiness.packs.find((pack) => pack.key === "human-validation")
        ?.description
    ).toMatch(/#28/i);
  });

  it("marks network / SSE pack operational only when a network observer is healthy (P10-16)", () => {
    const withoutNetwork = buildEnterpriseBreadthReadiness({
      integrations: [integration({ connectorKey: "salesforce" })],
      nonHumanIdentityCount: 0
    });
    expect(
      withoutNetwork.packs.find((pack) => pack.key === "network-sse-enforcement")
        ?.state
    ).toBe("Configurable");

    const withZscaler = buildEnterpriseBreadthReadiness({
      integrations: [integration({ connectorKey: "zscaler-zia" })],
      nonHumanIdentityCount: 0
    });
    const pack = withZscaler.packs.find(
      (entry) => entry.key === "network-sse-enforcement"
    );
    expect(pack?.state).toBe("Operational");
    expect(
      pack?.checks.some(
        (check) =>
          check.key === "connector.zscaler-zia" && check.state === "Satisfied"
      )
    ).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import {
  getConnectorByKey,
  getConnectorCatalog,
  getConnectorCatalogEntryByKey
} from "./index.js";

/**
 * Wave F — Connector Production honesty.
 *
 * Guards:
 * - Planned / StandardizedCatalog never present as connectable or Production
 * - No fake Production elevation without live customer-credential cert
 * - XSIAM clone honesty (shared Cortex XDR incident surface)
 * - vCenter labeled Partial read-only inventory
 */
describe("catalog Production honesty (Wave F)", () => {
  it("never marks any catalog entry Production without a certified path", () => {
    const catalog = getConnectorCatalog();

    // Manifest availability Production is reserved for post live-smoke cert.
    // Current product ships Beta dedicated clients + Planned scaffolds only.
    // Elevation requires packages/shared connector-production-qualification
    // receipt gate (assertCanElevateToProduction) + Plane evidence — never
    // flip these flags without a validated live-smoke receipt.
    expect(
      catalog.every((entry) => entry.availability !== "Production")
    ).toBe(true);
    expect(
      catalog.every((entry) => entry.certificationLevel !== "Certified")
    ).toBe(true);
    expect(
      catalog.filter((entry) => entry.availability === "Production").length
    ).toBe(0);
  });

  it("keeps every Planned and StandardizedCatalog entry NotConnectable", () => {
    const catalog = getConnectorCatalog();
    const blocked = catalog.filter(
      (entry) =>
        entry.availability === "Planned" ||
        entry.implementationTier === "StandardizedCatalog" ||
        entry.implementationTier === "Planned" ||
        entry.connectable === false
    );

    expect(blocked.length).toBeGreaterThan(0);
    expect(
      blocked.every(
        (entry) =>
          entry.connectable === false &&
          entry.executionReadiness === "NotConnectable" &&
          entry.live === false &&
          entry.availability !== "Production"
      )
    ).toBe(true);
  });

  it("keeps ReadyForCredentials limited to dedicated connectable clients", () => {
    const catalog = getConnectorCatalog();
    const ready = catalog.filter(
      (entry) => entry.executionReadiness === "ReadyForCredentials"
    );

    expect(ready.length).toBeGreaterThan(0);
    expect(
      ready.every(
        (entry) =>
          entry.connectable === true &&
          entry.implementationTier === "DedicatedClient" &&
          entry.live === true &&
          entry.availability !== "Planned"
      )
    ).toBe(true);
  });

  it("labels Cortex XSIAM as shared XDR-compatible incident depth, not full platform", () => {
    const entry = getConnectorCatalogEntryByKey("palo-cortex-xsiam");
    const connector = getConnectorByKey("palo-cortex-xsiam");

    expect(entry).toMatchObject({
      connectorKey: "palo-cortex-xsiam",
      product: "Cortex XSIAM",
      availability: "Beta",
      connectable: true,
      implementationTier: "DedicatedClient"
    });
    expect(entry?.customerVisibleDescription).toMatch(/Partial depth/i);
    expect(entry?.customerVisibleDescription).toMatch(
      /Cortex XDR-compatible|get_incidents/i
    );
    expect(entry?.customerVisibleDescription).toMatch(
      /not full XSIAM|data-lake|XQL/i
    );
    expect(entry?.permissionsSummary).toMatch(/XDR-compatible|get_incidents/i);
    expect(connector?.manifest.validationCapabilities.join(" ")).toMatch(
      /Shared Cortex XDR-compatible/i
    );
  });

  it("labels vCenter as Partial read-only inventory depth", () => {
    const entry = getConnectorCatalogEntryByKey("vmware-vcenter");

    expect(entry).toMatchObject({
      connectorKey: "vmware-vcenter",
      product: "vCenter Server",
      availability: "Beta",
      connectable: true,
      implementationTier: "DedicatedClient"
    });
    expect(entry?.customerVisibleDescription).toMatch(/Partial/i);
    expect(entry?.customerVisibleDescription).toMatch(/read-only/i);
    expect(entry?.customerVisibleDescription).toMatch(
      /inventory|topology/i
    );
    expect(entry?.customerVisibleDescription).not.toMatch(
      /lifecycle control|power ops remediation/i
    );
    expect(entry?.permissionsSummary).toMatch(/lists inventory only|Read-only/i);
    expect(entry?.validationCapabilities.some((c) => /Partial/i.test(c))).toBe(
      true
    );
  });

  it("rejects live credential setup paths for market-leader scaffolds at catalog layer", () => {
    for (const key of ["darktrace", "vectra-ai", "tines", "checkmarx"]) {
      const entry = getConnectorCatalogEntryByKey(key);
      expect(entry?.implementationTier).toBe("StandardizedCatalog");
      expect(entry?.availability).toBe("Planned");
      expect(entry?.connectable).toBe(false);
      expect(entry?.executionReadiness).toBe("NotConnectable");
      expect(entry?.live).toBe(false);
      expect(entry?.executionReadinessReason).toMatch(
        /vendor-specific live client|blocked/i
      );
    }
  });

  it("keeps ReadyForCredentials count aligned with live DedicatedClient inventory", () => {
    const catalog = getConnectorCatalog();
    const ready = catalog.filter(
      (entry) => entry.executionReadiness === "ReadyForCredentials"
    );
    const planned = catalog.filter(
      (entry) =>
        entry.availability === "Planned" ||
        entry.implementationTier === "StandardizedCatalog"
    );

    expect(ready.length + planned.length).toBe(catalog.length);
    expect(ready.every((entry) => entry.availability === "Beta")).toBe(true);
    expect(
      planned.every(
        (entry) =>
          entry.executionReadiness === "NotConnectable" && !entry.connectable
      )
    ).toBe(true);
  });
});

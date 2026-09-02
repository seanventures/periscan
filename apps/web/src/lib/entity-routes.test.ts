import { describe, expect, it } from "vitest";

import {
  OBJECT_EXPLORER_TYPES,
  entityHref,
  hasEntityRoute,
  objectExplorerHref,
  ontologyEntityHref
} from "./entity-routes";

describe("entityHref (P11R-3 unified ontology deep-links)", () => {
  it("deep-links attack paths and remediations with id", () => {
    expect(entityHref("AttackPath", "abc")).toBe("/attack-paths/abc");
    expect(entityHref("RemediationTask", "rem-1")).toBe("/remediation/rem-1");
  });

  it("does not map Scope to /missions (wrong object workspace)", () => {
    expect(entityHref("Scope", "scope-1")).toBeNull();
    expect(hasEntityRoute("Scope")).toBe(false);
  });

  it("maps Asset to /assets (P07-18 / P11R-3; not /data-fabric)", () => {
    expect(entityHref("Asset", "asset-1")).toBe("/assets?assetId=asset-1");
    expect(ontologyEntityHref("Asset", "asset-1")).toBe(
      "/assets?assetId=asset-1"
    );
  });

  it("maps findings, signals, and evidence", () => {
    expect(entityHref("Finding", "f-1")).toBe("/findings?q=f-1");
    expect(entityHref("ValidatedFinding", "f-2")).toBe("/findings?q=f-2");
    expect(entityHref("Signal", "s-1")).toBe("/signal-activity?q=s-1");
    expect(entityHref("Evidence", "e-1")).toBe("/evidence?evidenceId=e-1");
  });

  it("returns null for unknown types instead of inventing routes", () => {
    expect(entityHref("NotAType", "x")).toBeNull();
  });

  it("objectExplorerHref prefers real workspace, else /objects shell", () => {
    expect(objectExplorerHref("AttackPath", "p1")).toBe("/attack-paths/p1");
    expect(objectExplorerHref("Scope", "s1")).toBe("/objects/Scope/s1");
    expect(OBJECT_EXPLORER_TYPES.length).toBeGreaterThanOrEqual(8);
    expect(
      OBJECT_EXPLORER_TYPES.find((t) => t.type === "Asset")?.homeHref
    ).toBe("/assets");
  });

  it("web re-export stays aligned with shared ontology SoT", () => {
    expect(entityHref("Integration", "i1")).toBe(
      ontologyEntityHref("Integration", "i1")
    );
    expect(entityHref("Runner", null)).toBe(ontologyEntityHref("Runner", null));
  });
});

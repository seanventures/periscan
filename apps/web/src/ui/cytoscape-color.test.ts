import { describe, expect, it } from "vitest";

import { toCytoscapeColor } from "./cytoscape-color";

describe("toCytoscapeColor", () => {
  it("converts eight-digit hex tokens to Cytoscape-compatible rgba", () => {
    expect(toCytoscapeColor("#ffffff38")).toBe("rgba(255, 255, 255, 0.22)");
    expect(toCytoscapeColor("#3a4250ff")).toBe("rgba(58, 66, 80, 1)");
  });

  it("preserves colors Cytoscape already accepts", () => {
    expect(toCytoscapeColor("#3a4250")).toBe("#3a4250");
    expect(toCytoscapeColor("rgba(58, 66, 80, 0.5)")).toBe(
      "rgba(58, 66, 80, 0.5)"
    );
  });
});

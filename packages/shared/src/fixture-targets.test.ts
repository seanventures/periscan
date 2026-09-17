import { describe, expect, it } from "vitest";

import { targetIncludesFixtureHints } from "./fixture-targets.js";

describe("targetIncludesFixtureHints", () => {
  it("detects fixture and mock keys recursively", () => {
    expect(
      targetIncludesFixtureHints({ nested: [{ fixtureReportPath: "x" }] })
    ).toBe(true);
    expect(targetIncludesFixtureHints({ target: { mockMode: true } })).toBe(
      true
    );
  });

  it("allows ordinary measured validation targets", () => {
    expect(
      targetIncludesFixtureHints({
        hostname: "example.com",
        ports: [443],
        timeoutSeconds: 10
      })
    ).toBe(false);
  });
});

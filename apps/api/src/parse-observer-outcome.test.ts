import { describe, expect, it } from "vitest";

import { parseObserverOutcome } from "./runtime-services.js";

// Normalizes a control observer's raw verdict. Proof-core: an unknown or
// malformed verdict must NEVER be promoted to a positive control outcome
// (Detected/Blocked); it falls back to NoEvidence. Confidence/detail/sourceType
// get safe defaults so a partial observer payload can't fabricate certainty.
describe("parseObserverOutcome", () => {
  it("passes through a valid verdict, confidence, detail, and source type", () => {
    const parsed = parseObserverOutcome({
      confidence: 0.91,
      detail: "SIEM rule matched the simulated technique.",
      outcome: "Blocked",
      sourceType: "splunk.siem"
    });
    expect(parsed.outcome).toBe("Blocked");
    expect(parsed.confidence).toBe(0.91);
    expect(parsed.detail).toBe("SIEM rule matched the simulated technique.");
    expect(parsed.sourceType).toBe("splunk.siem");
  });

  it("defaults an unknown verdict to NoEvidence (never fabricates a positive outcome)", () => {
    const parsed = parseObserverOutcome({ outcome: "TotallyOwned" });
    expect(parsed.outcome).toBe("NoEvidence");
    // No usable confidence supplied → NoEvidence default confidence.
    expect(parsed.confidence).toBe(0.58);
    expect(parsed.detail).toBe("Mock control observer verdict.");
    expect(parsed.sourceType).toBe("periscan.control.observer");
  });

  it("defaults a missing verdict to NoEvidence", () => {
    expect(parseObserverOutcome({}).outcome).toBe("NoEvidence");
  });

  it("clamps an out-of-range confidence to the outcome-appropriate default", () => {
    // Valid (non-NoEvidence) outcome but bogus confidence → 0.8 default.
    expect(
      parseObserverOutcome({ confidence: 5, outcome: "Detected" }).confidence
    ).toBe(0.8);
    // A confidence of exactly 0 is in-range and preserved.
    expect(
      parseObserverOutcome({ confidence: 0, outcome: "Missed" }).confidence
    ).toBe(0);
  });
});

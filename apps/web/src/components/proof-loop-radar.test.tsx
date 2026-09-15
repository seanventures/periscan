import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  FIRST_PROOF_STAGE_LABELS,
  PROOF_LOOP_HELP,
  PROOF_LOOP_STAGE_LABELS
} from "../lib/product-help";
import ProofLoopRadar from "./proof-loop-radar";

describe("ProofLoopRadar", () => {
  it("exposes product proof-loop stages, not CTEM program stages", () => {
    render(<ProofLoopRadar size={160} />);

    const radar = screen.getByRole("img");
    const label = radar.getAttribute("aria-label") ?? "";

    expect(label).toMatch(/proof-loop radar/i);
    for (const stage of PROOF_LOOP_STAGE_LABELS) {
      expect(label).toContain(stage);
    }

    // CTEM program vocabulary must not appear on the proof-loop radar.
    for (const ctem of [
      "Scope",
      "Discover",
      "Prioritize",
      "Mobilize"
    ] as const) {
      expect(label).not.toContain(ctem);
    }
  });

  it("shares stage order with PROOF_LOOP_HELP", () => {
    expect(PROOF_LOOP_STAGE_LABELS).toEqual(
      PROOF_LOOP_HELP.map((stage) => stage.label)
    );
    expect(PROOF_LOOP_STAGE_LABELS).toEqual([
      "Connect",
      "Authorize",
      "Validate",
      "Understand",
      "Act",
      "Verify",
      "Prove"
    ]);
    expect([...FIRST_PROOF_STAGE_LABELS]).toEqual([
      "Connect",
      "Authorize",
      "Validate"
    ]);
  });
});

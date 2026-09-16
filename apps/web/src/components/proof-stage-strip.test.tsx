import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PROOF_STAGE_LABELS } from "../lib/product-help";
import { ProofStageStrip } from "./proof-stage-strip";

describe("ProofStageStrip", () => {
  it("renders PROOF_STAGE_LABELS chips with the active stage marked", () => {
    render(
      <ProofStageStrip
        stage="Understand"
        basis="Heuristic"
        nextCta={{ href: "#hop-measurement", label: "Measure path hops" }}
      />
    );

    const strip = screen.getByTestId("proof-stage-strip");
    expect(strip).toBeInTheDocument();

    const chips = screen.getByTestId("proof-stage-chips");
    for (const label of PROOF_STAGE_LABELS) {
      expect(chips).toHaveTextContent(label);
    }
    expect(PROOF_STAGE_LABELS).toEqual([
      "Connect",
      "Authorize",
      "Validate",
      "Understand",
      "Act",
      "Verify",
      "Prove"
    ]);

    const current = chips.querySelector('[aria-current="step"]');
    expect(current).toHaveTextContent("Understand");
    expect(screen.getByTestId("proof-stage-basis")).toHaveTextContent(
      "Heuristic"
    );
    expect(
      screen.getByRole("link", { name: /Measure path hops/i })
    ).toHaveAttribute("href", "#hop-measurement");
  });

  it("uses EvidenceBasisBadge tones for Measured, Heuristic, and Imported", () => {
    const { rerender } = render(
      <ProofStageStrip stage="Validate" basis="Measured" showOwner={false} />
    );
    expect(screen.getByTestId("proof-stage-basis")).toHaveTextContent(
      "Measured"
    );

    rerender(
      <ProofStageStrip stage="Validate" basis="Imported" showOwner={false} />
    );
    expect(screen.getByTestId("proof-stage-basis")).toHaveTextContent(
      "Imported"
    );
    expect(screen.queryByText("Owner:")).not.toBeInTheDocument();
  });

  it("shows solid Measured only for fully-measured claim labels", () => {
    render(
      <ProofStageStrip
        stage="Understand"
        basis="Measured validated path"
        nextCta={{ href: "#hop-measurement", label: "Inspect hop receipts" }}
      />
    );
    expect(screen.getByTestId("proof-stage-basis")).toHaveTextContent(
      "Measured"
    );
  });

  it("never upgrades Partially measured hypothesis to Measured", () => {
    render(
      <ProofStageStrip
        stage="Understand"
        basis="Partially measured hypothesis"
        nextCta={{ href: "#hop-measurement", label: "Measure path hops" }}
      />
    );
    const basis = screen.getByTestId("proof-stage-basis");
    expect(basis).toHaveTextContent("Partially measured hypothesis");
    expect(basis).not.toHaveTextContent(/^Measured$/);
  });

  it("keeps Heuristic hypothesis honest", () => {
    render(
      <ProofStageStrip
        stage="Understand"
        basis="Heuristic hypothesis"
        nextCta={{
          href: "#hop-measurement",
          label: "Open hop plan (authorize scope to measure)"
        }}
      />
    );
    expect(screen.getByTestId("proof-stage-basis")).toHaveTextContent(
      "Heuristic hypothesis"
    );
  });
});

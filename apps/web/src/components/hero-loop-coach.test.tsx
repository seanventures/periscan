import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PROOF_LOOP_HELP } from "../lib/product-help";
import {
  HERO_LOOP_STAGE_LABELS,
  HERO_LOOP_STEPS,
  HeroLoopCoach
} from "./hero-loop-coach";

describe("HeroLoopCoach (P07-15 / P02-2)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("renders guided proof-loop steps when enabled", () => {
    render(<HeroLoopCoach enabled />);
    expect(
      screen.getByRole("region", { name: /Hero proof loop coach/i })
    ).toBeInTheDocument();
    for (const step of HERO_LOOP_STEPS) {
      expect(screen.getByText(step.title)).toBeInTheDocument();
    }
  });

  it("uses product ProofLoop stage labels from product-help", () => {
    render(<HeroLoopCoach enabled />);
    expect(
      screen.getByRole("heading", {
        name: "Understand → Act → Verify → Prove"
      })
    ).toBeInTheDocument();
    expect(HERO_LOOP_STAGE_LABELS).toEqual([
      "Understand",
      "Act",
      "Verify",
      "Prove"
    ]);
    for (const stage of HERO_LOOP_STAGE_LABELS) {
      expect(PROOF_LOOP_HELP.some((entry) => entry.label === stage)).toBe(true);
    }
    for (const step of HERO_LOOP_STEPS) {
      expect(screen.getByTestId(`hero-loop-stage-${step.id}`)).toHaveTextContent(
        step.stage
      );
    }
    // Act / Verify / Prove hrefs match product-help; Understand prefers paths.
    expect(HERO_LOOP_STEPS.find((s) => s.stage === "Act")?.href).toBe(
      PROOF_LOOP_HELP.find((s) => s.label === "Act")!.href
    );
    expect(HERO_LOOP_STEPS.find((s) => s.stage === "Verify")?.href).toBe(
      PROOF_LOOP_HELP.find((s) => s.label === "Verify")!.href
    );
    expect(HERO_LOOP_STEPS.find((s) => s.stage === "Prove")?.href).toBe(
      PROOF_LOOP_HELP.find((s) => s.label === "Prove")!.href
    );
  });

  it("hides when disabled", () => {
    render(<HeroLoopCoach enabled={false} />);
    expect(screen.queryByTestId("hero-loop-coach")).not.toBeInTheDocument();
  });

  it("deep-links open-path to top path when provided", () => {
    render(<HeroLoopCoach enabled topPathId="path-123" />);
    expect(
      screen.getByRole("link", { name: /Inspect weakest hop/i })
    ).toHaveAttribute("href", "/attack-paths/path-123#hop-measurement");
  });

  it("uses Measure path hops CTA when multi-hop measure is ready", () => {
    render(
      <HeroLoopCoach
        enabled
        topPathId="path-123"
        measurePathHopsReady
      />
    );
    expect(
      screen.getByRole("link", { name: /Measure path hops/i })
    ).toHaveAttribute("href", "/attack-paths/path-123#hop-measurement");
    expect(screen.getByText(/edge receipts/i)).toBeInTheDocument();
  });

  it("does not offer Mark done or complete steps from localStorage (PERISCAN-550)", () => {
    const { unmount } = render(<HeroLoopCoach enabled />);
    expect(
      screen.queryAllByRole("button", { name: /Mark done/i })
    ).toHaveLength(0);
    expect(screen.queryAllByRole("button", { name: /Undo/i })).toHaveLength(0);
    expect(screen.getByRole("link", { name: /Open paths/i })).toHaveAttribute(
      "href",
      "/attack-paths"
    );
    expect(
      screen.getByRole("link", { name: /Open remediation/i })
    ).toHaveAttribute("href", "/remediation");
    expect(
      screen.getByRole("link", { name: /Open ready-to-verify/i })
    ).toHaveAttribute("href", "/remediation?status=VerificationPending");
    expect(screen.getByRole("link", { name: /Open reports/i })).toHaveAttribute(
      "href",
      "/reports"
    );
    unmount();

    localStorage.setItem(
      "periscan.hero-loop.coach",
      JSON.stringify({
        completed: [
          "open-path",
          "disposition-finding",
          "verify-fix",
          "export-proof"
        ],
        dismissed: false,
        updatedAt: "2026-08-31T00:00:00.000Z"
      })
    );
    render(<HeroLoopCoach enabled />);
    expect(screen.queryAllByRole("button", { name: /Undo/i })).toHaveLength(0);
    expect(screen.queryByText(/Loop complete/i)).not.toBeInTheDocument();
  });

  it("persists dismiss in localStorage without recording step completion", () => {
    render(<HeroLoopCoach enabled />);
    fireEvent.click(screen.getByRole("button", { name: /Dismiss/i }));
    const stored = JSON.parse(
      localStorage.getItem("periscan.hero-loop.coach") ?? "{}"
    ) as { completed?: string[]; dismissed?: boolean };
    expect(stored.dismissed).toBe(true);
    expect(stored.completed ?? []).toEqual([]);
  });
});

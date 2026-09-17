import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CLAIM_GUARD_COPY, ClaimGuardHud } from "./claim-guard-hud";

describe("ClaimGuardHud (UX-W5 / 191)", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the claim-safe language chip with required test id", () => {
    render(<ClaimGuardHud />);
    const chip = screen.getByTestId("claim-guard-hud");
    expect(chip).toHaveTextContent("Claim-safe language");
    expect(chip).toHaveAttribute("aria-expanded", "false");
  });

  it("discloses Measured / Heuristic / Imported glossary on toggle", () => {
    render(<ClaimGuardHud />);
    const chip = screen.getByTestId("claim-guard-hud");

    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-expanded", "true");
    const region = screen.getByRole("region", {
      name: "Claim-safe language glossary"
    });
    expect(region).toHaveTextContent(CLAIM_GUARD_COPY.measured);
    expect(region).toHaveTextContent(CLAIM_GUARD_COPY.heuristic);
    expect(region).toHaveTextContent(CLAIM_GUARD_COPY.imported);

    fireEvent.keyDown(chip, { key: "Escape" });
    expect(chip).toHaveAttribute("aria-expanded", "false");
  });
});

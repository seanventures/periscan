import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InfoPopover } from "./info-popover";

describe("InfoPopover", () => {
  it("uses disclosure semantics (not tooltip) and toggles visibly", () => {
    render(
      <InfoPopover label="priority score">
        Priority combines exploitability and impact.
      </InfoPopover>
    );

    const trigger = screen.getByRole("button", {
      name: "More information: priority score"
    });

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-controls");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("region", { name: "priority score" })
    ).toHaveTextContent("Priority combines exploitability and impact.");

    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});

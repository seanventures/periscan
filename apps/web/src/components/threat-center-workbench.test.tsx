import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { ThreatCenterWorkbench } from "./threat-center-workbench";

vi.mock("../lib/periscan-api-client", () => ({
  browserPeriscanApiClient: {
    listThreatAdvisories: vi.fn(async () => [])
  }
}));

describe("ThreatCenterWorkbench hub join (UX-W2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a single Threats hub with feed + signal activity links", async () => {
    render(<ThreatCenterWorkbench />);
    expect(
      await screen.findByRole("heading", { name: "Threats", level: 1 })
    ).toBeInTheDocument();
    const hub = screen.getByTestId("threats-hub-panel");
    expect(hub).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Threat feed/i })
    ).toHaveAttribute("href", "/threat-feed");
    expect(
      screen.getByRole("link", { name: /Signal activity/i })
    ).toHaveAttribute("href", "/signal-activity");
    expect(
      screen.getByRole("link", { name: /ATT&CK catalog/i })
    ).toHaveAttribute("href", "/attack-techniques");
  });
});

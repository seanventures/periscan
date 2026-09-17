import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LABS_DESTINATIONS } from "../lib/labs-portal";
import {
  LABS_PORTAL_DEEP_LINKS,
  LabsPortal,
  labsPortalRailDestinations
} from "./labs-portal";

describe("LabsPortal (UX-W6 / UX-W10 portal-only)", () => {
  it("renders a calm portal with honest Labs destinations", () => {
    render(<LabsPortal />);

    expect(
      screen.getByRole("heading", { name: "Labs", level: 1 })
    ).toBeInTheDocument();
    expect(screen.getByTestId("labs-portal-honesty")).toHaveTextContent(
      /demoted by default/i
    );
    expect(screen.getByTestId("labs-portal-honesty")).toHaveTextContent(
      /Fixed without verification/i
    );

    const destinations = screen.getByTestId("labs-portal-destinations");
    expect(
      within(destinations).getByRole("link", { name: /Threats/i })
    ).toHaveAttribute("href", "/threat-center");
    expect(
      within(destinations).getByRole("link", { name: /Live validation ops/i })
    ).toHaveAttribute("href", "/swarm");
    expect(
      within(destinations).getByRole("link", { name: /MCP Server/i })
    ).toHaveAttribute("href", "/mcp");
  });

  it("lists deep-links including Live validation ops (Labs) → /validation-ops", () => {
    render(<LabsPortal />);

    const deep = screen.getByTestId("labs-portal-deep-links");
    const ops = within(deep).getByRole("link", {
      name: /Live validation ops \(Labs\)/i
    });
    expect(ops).toHaveAttribute("href", "/validation-ops");
    expect(
      LABS_PORTAL_DEEP_LINKS.some((d) => d.href === "/validation-ops")
    ).toBe(true);
  });

  it("lists LABS_DESTINATIONS independent of PRIMARY_NAV peers (UX-W10)", () => {
    const portalHrefs = labsPortalRailDestinations().map((d) => d.href);
    expect(portalHrefs).toEqual(LABS_DESTINATIONS.map((d) => d.href));
    expect(portalHrefs).toEqual(
      expect.arrayContaining(["/swarm", "/workflows", "/mcp", "/threat-center"])
    );
    expect(portalHrefs).not.toContain("/labs");
  });
});

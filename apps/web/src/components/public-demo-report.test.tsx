import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PublicDemoReport } from "./public-demo-report";

describe("PublicDemoReport", () => {
  it("renders a clearly labeled public sample report from the shared snapshot", () => {
    render(<PublicDemoReport />);

    expect(
      screen.getByRole("heading", {
        name: "See the proof loop before connecting systems."
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Public sample data")).toBeInTheDocument();
    expect(screen.getByText("Not real customer data")).toBeInTheDocument();
    expect(screen.getByText("Priority paths")).toBeInTheDocument();
    expect(screen.getByText("Control verdicts")).toBeInTheDocument();
    expect(screen.getByText("AI validation")).toBeInTheDocument();
    expect(screen.getByText("Fix proof")).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: /Sample priority attack path count: \d+/u
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: /Sample control verdict count: \d+/u
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: /Sample AI validation risk count: \d+/u
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: /Sample fix proof count: \d+/u
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Demo story data status: Sample only"
      })
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(9);
    expect(
      screen.getByText(
        "Periscan finds a redacted fake repository secret candidate."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("It maps that evidence to possible cloud role access.")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "It identifies a path from the repository to production impact."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "It checks whether the mock SIEM saw related credential-use activity."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("Periscan recommends the highest-value path breaker.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Periscan creates a remediation task with evidence IDs.")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Periscan re-tests through the fix verification workflow."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Periscan records whether the risk is fixed or still exposed."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Periscan generates an evidence pack without raw scanner dumps."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("MVP success signal")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Enter guided demo" })
    ).toHaveAttribute("href", "/demo/workspace");
    expect(
      screen.getByText(
        /This is not a scanner\. This is the report I wish I had before the audit/u
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Sample report data status: Not real customer data"
      })
    ).toBeInTheDocument();

    const frame = screen.getByTitle("Sample Validation Snapshot report");
    const srcDoc = frame.getAttribute("srcDoc") ?? "";

    expect(srcDoc).toContain("Priority Attack Paths");
    expect(srcDoc).toContain("AI App Validation");
    expect(srcDoc).not.toContain("AKIA");
  });
});

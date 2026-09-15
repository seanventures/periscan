import { readFileSync } from "node:fs";
import path from "node:path";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Badge } from "./badge";
import { Brandmark } from "./brandmark";
import { Button } from "./button";
import { Card, CardHeader } from "./card";
import { EmptyState, FilterEmpty } from "./empty-state";
import { LoadingSkeleton } from "./feedback";
import { EvidenceBasisBadge } from "./state-badge";
import { PRD_STATUS_BADGE_LABELS, StatusPill, statusTone } from "./status-pill";

describe("Button", () => {
  it("fires onClick and shows a busy spinner when loading", () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Run</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(onClick).toHaveBeenCalledOnce();

    rerender(
      <Button loading onClick={onClick}>
        Run
      </Button>
    );
    const button = screen.getByRole("button", { name: "Run" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("does not fire when disabled", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Nope
      </Button>
    );
    fireEvent.click(screen.getByRole("button", { name: "Nope" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("uses consistent focus-visible ring on primary buttons (UX-W3)", () => {
    render(<Button variant="primary">Primary</Button>);
    const button = screen.getByRole("button", { name: "Primary" });
    expect(button.className).toMatch(/focus-visible:ring-2/u);
    expect(button.className).toMatch(/focus-visible:ring-offset-2/u);
    expect(button.className).toMatch(/focus-visible:outline-none/u);
  });

  it("keeps primary hover on a darker fill than brand (#3c96ff)", () => {
    const source = readFileSync(path.join(__dirname, "button.tsx"), "utf8");
    const primary = source.slice(
      source.indexOf("primary:"),
      source.indexOf("secondary:")
    );
    expect(primary).toMatch(/hover:bg-\[#1[0-9a-f]{5}\]/i);
    expect(primary).not.toMatch(/hover:bg-brand[^\-/]/);
  });
});

describe("prefer-reduced-motion global CSS (P08 / ICP-P3-3)", () => {
  it("disables transitions and animations under prefers-reduced-motion", () => {
    const css = readFileSync(
      path.join(__dirname, "../../app/globals.css"),
      "utf8"
    );
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(css).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
    expect(css).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
  });
});

describe("Card", () => {
  it("renders header title, description, and actions", () => {
    render(
      <Card>
        <CardHeader
          title="Findings"
          description="Prioritized + validated"
          actions={<Button size="sm">Refresh</Button>}
        />
        <p>body</p>
      </Card>
    );
    expect(
      screen.getByRole("heading", { name: "Findings" })
    ).toBeInTheDocument();
    expect(screen.getByText("Prioritized + validated")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });
});

describe("EvidenceBasisBadge", () => {
  it("treats Measured, Heuristic, and Imported as first-class distinct chips", () => {
    const { rerender } = render(<EvidenceBasisBadge basis="Measured" />);
    const measured = screen.getByText("Measured");
    expect(measured).toHaveClass("text-validated");

    rerender(<EvidenceBasisBadge basis="Heuristic" />);
    const heuristic = screen.getByText("Heuristic");
    expect(heuristic).toHaveClass("text-approval");
    expect(heuristic.className).toMatch(/border-dashed|border/);

    rerender(<EvidenceBasisBadge basis="Imported" />);
    const imported = screen.getByText("Imported");
    expect(imported).toHaveClass("text-inconclusive-text");
    expect(imported.getAttribute("title") ?? "").toMatch(/not Measured/i);
  });
});

describe("statusTone (central status mapping)", () => {
  it("maps success/danger/warning/info families regardless of case/format", () => {
    expect(statusTone("Executed")).toBe("success");
    expect(statusTone("VERIFIED")).toBe("success");
    expect(statusTone("denied")).toBe("danger");
    expect(statusTone("Failed")).toBe("danger");
    expect(statusTone("critical")).toBe("danger");
    expect(statusTone("Missed")).toBe("danger");
    expect(statusTone("Reopened")).toBe("danger");
    expect(statusTone("planned")).toBe("warning");
    expect(statusTone("In Progress")).toBe("warning");
    expect(statusTone("requires_approval")).toBe("warning");
    expect(statusTone("Needs Review")).toBe("warning");
    expect(statusTone("running")).toBe("info");
    expect(statusTone("Detected")).toBe("info");
    expect(statusTone("Validated")).toBe("info");
    expect(statusTone("something-unknown")).toBe("neutral");
  });
});

describe("StatusPill", () => {
  it("renders the status label as a status role", () => {
    render(<StatusPill status="executed" />);
    const pill = screen.getByRole("status");
    expect(pill).toHaveTextContent("executed");
  });

  it("honors a custom label", () => {
    render(<StatusPill status="denied" label="Blocked by policy" />);
    expect(screen.getByRole("status")).toHaveTextContent("Blocked by policy");
  });

  it("renders every PRD status badge label", () => {
    render(
      <div>
        {PRD_STATUS_BADGE_LABELS.map((label) => (
          <StatusPill key={label} status={label} />
        ))}
      </div>
    );

    for (const label of PRD_STATUS_BADGE_LABELS) {
      expect(screen.getByText(label)).toHaveAttribute("role", "status");
    }
  });
});

describe("Badge", () => {
  it("renders children", () => {
    render(<Badge tone="brand">Beta</Badge>);
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });
});

describe("Brandmark", () => {
  it("renders the supplied Periscan wordmark asset", () => {
    render(<Brandmark />);

    expect(screen.getByRole("img", { name: "Periscan" })).toHaveAttribute(
      "src",
      "/brand/periscan-logo-light.svg"
    );
  });
});

describe("EmptyState", () => {
  it("renders title + description + action", () => {
    render(
      <EmptyState
        title="No runners deployed"
        description="Deploy a runner to begin."
        action={<Button size="sm">Deploy</Button>}
      />
    );
    expect(screen.getByRole("status")).toHaveTextContent("No runners deployed");
    expect(screen.getByText("Deploy a runner to begin.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deploy" })).toBeInTheDocument();
  });
});

describe("FilterEmpty", () => {
  it("renders a light filter-no-results status", () => {
    render(
      <FilterEmpty
        title="No paths match these filters"
        description="Clear risk band or search."
      />
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "No paths match these filters"
    );
    expect(screen.getByText("Clear risk band or search.")).toBeInTheDocument();
  });
});

describe("LoadingSkeleton", () => {
  it("announces loading via companion status while bars stay decorative [P16-13]", () => {
    render(<LoadingSkeleton rows={2} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(screen.getByTestId("loading-skeleton")).toBeInTheDocument();
  });

  it("row variant exposes aligned list-row count for workbench queues (UX-W7/#49)", () => {
    render(<LoadingSkeleton rows={8} variant="rows" label="Loading findings…" />);
    const skeleton = screen.getByTestId("loading-skeleton");
    expect(skeleton).toHaveAttribute("data-skeleton-variant", "rows");
    expect(skeleton).toHaveAttribute("data-skeleton-rows", "8");
    expect(screen.getByRole("status")).toHaveTextContent("Loading findings…");
  });
});

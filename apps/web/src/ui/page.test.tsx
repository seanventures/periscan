import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader, PageShell } from "./page";

describe("PageHeader", () => {
  it("renders eyebrow, title (as h1), description, and actions", () => {
    render(
      <PageHeader
        eyebrow="Findings"
        title="Prioritized findings"
        description="Served by the API."
        actions={<a href="/x">Go</a>}
      />
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Prioritized findings" })
    ).toBeInTheDocument();
    expect(screen.getByText("Findings")).toBeInTheDocument();
    expect(screen.getByText("Served by the API.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go" })).toHaveAttribute(
      "href",
      "/x"
    );
  });

  it("omits optional blocks when not provided", () => {
    render(<PageHeader title="Bare" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Bare" })
    ).toBeInTheDocument();
  });
});

describe("PageShell", () => {
  // P16-18 / P16-1: contract is layout container only — never a second main.
  it("renders a non-main page container with children (AppShell owns main)", () => {
    const { container } = render(
      <PageShell>
        <p>content</p>
      </PageShell>
    );
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
    expect(container.querySelectorAll("main")).toHaveLength(0);
    expect(container.firstElementChild?.tagName).toBe("DIV");
    expect(container.firstElementChild?.className).toMatch(/max-w-7xl/);
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("supports narrow and full width variants", () => {
    const { container: narrow } = render(
      <PageShell width="narrow">
        <p>n</p>
      </PageShell>
    );
    expect(narrow.firstElementChild?.className).toMatch(/max-w-5xl/);

    const { container: full } = render(
      <PageShell width="full">
        <p>f</p>
      </PageShell>
    );
    expect(full.firstElementChild?.className).toMatch(/max-w-none/);
  });

  it("renders optional PageHeader meta slot", () => {
    render(
      <PageHeader title="Findings" meta={<span>Updated just now</span>} />
    );
    expect(screen.getByText("Updated just now")).toBeInTheDocument();
  });
});

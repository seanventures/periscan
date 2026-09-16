import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppBreadcrumbs } from "./app-breadcrumbs";

const navigation = vi.hoisted(() => ({
  pathname: "/"
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname
}));

describe("AppBreadcrumbs", () => {
  it("marks the home breadcrumb as current on the root route", () => {
    navigation.pathname = "/";

    render(<AppBreadcrumbs />);

    const breadcrumb = screen.getByRole("navigation", {
      name: "Breadcrumb"
    });
    expect(within(breadcrumb).getByText("Home")).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(
      within(breadcrumb).queryByRole("link", {
        name: "Home"
      })
    ).not.toBeInTheDocument();
  });

  it("keeps the home alias breadcrumb concise", () => {
    navigation.pathname = "/dashboard";

    render(<AppBreadcrumbs />);

    const breadcrumb = screen.getByRole("navigation", {
      name: "Breadcrumb"
    });
    expect(within(breadcrumb).getByText("Home")).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(within(breadcrumb).queryAllByText("Home")).toHaveLength(1);
  });

  it("renders the owning nav section and current page for exact routes", () => {
    navigation.pathname = "/trust-safety";

    render(<AppBreadcrumbs />);

    const breadcrumb = screen.getByRole("navigation", {
      name: "Breadcrumb"
    });
    expect(
      within(breadcrumb).getByRole("link", {
        name: "Home"
      })
    ).toHaveAttribute("href", "/");
    expect(within(breadcrumb).getByText("Admin")).toBeInTheDocument();
    expect(within(breadcrumb).getByText("Trust & Safety")).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("labels dynamic snapshot review routes without exposing opaque IDs", () => {
    navigation.pathname = "/snapshots/snapshot-123";

    render(<AppBreadcrumbs />);

    const breadcrumb = screen.getByRole("navigation", {
      name: "Breadcrumb"
    });
    expect(within(breadcrumb).getByText("Operate")).toBeInTheDocument();
    expect(within(breadcrumb).getByText("Snapshot review")).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(
      within(breadcrumb).queryByText("snapshot-123")
    ).not.toBeInTheDocument();
  });

  it("distinguishes snapshot reports from their review workspace", () => {
    navigation.pathname = "/snapshots/snapshot-123/report";

    render(<AppBreadcrumbs />);

    const breadcrumb = screen.getByRole("navigation", {
      name: "Breadcrumb"
    });
    expect(within(breadcrumb).getByText("Snapshot report")).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(
      within(breadcrumb).queryByText("snapshot-123")
    ).not.toBeInTheDocument();
  });

  it("labels dynamic mission routes without exposing opaque IDs", () => {
    navigation.pathname = "/missions/mission-123";

    render(<AppBreadcrumbs />);

    const breadcrumb = screen.getByRole("navigation", {
      name: "Breadcrumb"
    });
    expect(within(breadcrumb).getByText("Operate")).toBeInTheDocument();
    expect(within(breadcrumb).getByText("Validation mission")).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(
      within(breadcrumb).queryByText("mission-123")
    ).not.toBeInTheDocument();
  });
});

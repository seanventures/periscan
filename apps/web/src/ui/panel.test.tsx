import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PanelHeader } from "./panel";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  )
}));

describe("PanelHeader trailing link (loop 15 Home color-contrast incomplete)", () => {
  it("uses an SVG arrow, not an aria-hidden text glyph", () => {
    render(
      <PanelHeader
        title="Top finding"
        link={{ href: "/findings", label: "All findings" }}
      />
    );

    const link = screen.getByRole("link", { name: "All findings" });
    expect(link).toHaveAttribute("href", "/findings");
    const hidden = [...link.querySelectorAll("[aria-hidden]")];
    expect(
      hidden.some((el) => (el.textContent || "").includes("→"))
    ).toBe(false);
    expect(link.querySelector("svg[aria-hidden]")).not.toBeNull();
  });

  it("attack-paths header link is named by the label, not the arrow", () => {
    render(
      <PanelHeader
        title="Top path"
        link={{ href: "/attack-paths", label: "All paths" }}
      />
    );

    expect(
      screen.getByRole("link", { name: "All paths" })
    ).toHaveAttribute("href", "/attack-paths");
  });
});

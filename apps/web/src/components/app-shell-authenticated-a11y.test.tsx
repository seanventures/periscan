import { readFileSync } from "node:fs";
import path from "node:path";

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProductActivationState } from "@periscan/shared";

import {
  formatAxeViolations,
  runAxeSmoke
} from "../lib/a11y-smoke";
import { AppShell } from "./app-shell";

const globalsCss = readFileSync(
  path.join(__dirname, "../../app/globals.css"),
  "utf8"
);

function cssHexToken(css: string, name: string): string | undefined {
  return css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
}

function srgbChannel(byte: number): number {
  const channel = byte / 255;
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const value = hex.replace("#", "");
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return (
    0.2126 * srgbChannel(r) + 0.7152 * srgbChannel(g) + 0.0722 * srgbChannel(b)
  );
}

function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [hi, lo] = a >= b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

const nav = vi.hoisted(() => ({ pathname: "/dashboard" }));

const api = vi.hoisted(() => ({
  getHealth: vi.fn(),
  getMe: vi.fn(),
  getProductActivationState: vi.fn(),
  getTenantLocalization: vi.fn(),
  logout: vi.fn()
}));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn()
  })
}));

vi.mock("../lib/periscan-api-client", () => ({
  PeriscanApiClientError: class PeriscanApiClientError extends Error {
    readonly status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = "PeriscanApiClientError";
      this.status = status;
    }
  },
  browserPeriscanApiClient: api
}));

function milestone(
  key: ProductActivationState["milestones"][number]["key"],
  stage: ProductActivationState["milestones"][number]["stage"],
  state: ProductActivationState["milestones"][number]["state"],
  href: string
): ProductActivationState["milestones"][number] {
  return {
    completedAt: state === "Completed" ? "2026-09-17T19:00:00.000Z" : null,
    evidenceBasis: `${key} ${state}`,
    href,
    key,
    label: key,
    stage,
    state
  };
}

function activation(): ProductActivationState {
  return {
    completedMilestones: 1,
    currentStage: "Authorize",
    diagnostics: [],
    maturity: "New",
    measuredAt: "2026-09-17T20:00:00.000Z",
    milestones: [
      milestone("AccountCreated", "Connect", "Completed", "/dashboard")
    ],
    nextAction: {
      href: "/scopes",
      label: "Authorize scope",
      reason: "Nothing runs outside verified authorized scope."
    },
    profile: {
      completedAt: "2026-09-17T19:00:00.000Z",
      membershipId: "17171717-1717-4717-8717-171717171717",
      primaryOutcome: "RunProofLoop",
      productPersona: "SecurityEngineer",
      updatedAt: "2026-09-17T19:00:00.000Z"
    },
    totalMilestones: 9
  };
}

function stubSession() {
  api.getMe.mockResolvedValue({
    user: { name: "Ada", email: "ada@periscan.test" },
    tenant: { name: "A11y Auth Tenant" }
  });
  api.getHealth.mockResolvedValue({
    service: "api",
    status: "ok",
    timestamp: "2026-09-17T20:00:00.000Z"
  });
  api.getTenantLocalization.mockResolvedValue({
    preferredLocale: "en-US"
  });
  api.getProductActivationState.mockResolvedValue(activation());
}

describe("AppShell authenticated chrome a11y (loop 8)", () => {
  afterEach(() => {
    vi.clearAllMocks();
    nav.pathname = "/dashboard";
  });

  it("workspace chip is a status, not a generic with aria-label", async () => {
    stubSession();
    render(
      <AppShell>
        <p>home body</p>
      </AppShell>
    );

    const chip = await screen.findByRole("status", {
      name: /Current workspace: A11y Auth Tenant/i
    });
    expect(chip).toHaveAttribute("title", "Workspace: A11y Auth Tenant");
    expect(chip.tagName.toLowerCase()).toBe("div");
  });

  it("account menu omits aria-controls while closed and points at a live panel when open", async () => {
    stubSession();
    render(
      <AppShell>
        <p>home body</p>
      </AppShell>
    );

    const trigger = await screen.findByRole("button", { name: "Account menu" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).not.toHaveAttribute("aria-controls");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const panelId = trigger.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    expect(document.getElementById(panelId!)).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Sign out" })
    ).toBeInTheDocument();
  });

  it("account letter is decorative; name stays Account menu", async () => {
    stubSession();
    render(
      <AppShell>
        <p>home body</p>
      </AppShell>
    );

    const trigger = await screen.findByRole("button", { name: "Account menu" });
    const glyph = trigger.querySelector("[aria-hidden='true']");
    expect(glyph).not.toBeNull();
    expect(glyph?.textContent).toBe("A");
    expect(trigger.className).toMatch(/bg-brand-fill/);
  });

  it("account letter glyph meets WCAG 2.2 AA contrast on brand-fill", async () => {
    const fill = cssHexToken(globalsCss, "--deep-blue");
    const ink = cssHexToken(globalsCss, "--on-brand-fill");
    expect(fill).toBe("#2563d4");
    expect(ink, "account letter on-fill token").toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(contrastRatio(ink!, fill!)).toBeGreaterThanOrEqual(4.5);

    const triggerRule =
      globalsCss.match(/\.account-menu-trigger\s*\{[^}]+\}/)?.[0] ?? "";
    const glyphRule =
      globalsCss.match(/\.account-menu-glyph\s*\{[^}]+\}/)?.[0] ?? "";
    expect(triggerRule).toMatch(/background-color:\s*var\(--deep-blue\)/);
    expect(glyphRule).toMatch(/color:\s*var\(--on-brand-fill/);

    stubSession();
    render(
      <AppShell>
        <p>home body</p>
      </AppShell>
    );

    const trigger = await screen.findByRole("button", { name: "Account menu" });
    const glyph = trigger.querySelector("[aria-hidden='true']");
    expect(trigger).toHaveAccessibleName("Account menu");
    expect(trigger.className).toMatch(/account-menu-trigger/);
    expect(trigger.className).toMatch(/bg-brand-fill/);
    expect(glyph).toHaveClass("account-menu-glyph");
    expect(glyph).toHaveAttribute("aria-hidden", "true");
    expect(glyph?.textContent).toBe("A");
  });

  it("authenticated shell chrome has no WCAG A/AA axe violations (jsdom)", async () => {
    stubSession();
    const { container } = render(
      <AppShell>
        <h1>Home</h1>
        <p>home body</p>
      </AppShell>
    );

    await screen.findByRole("button", { name: "Account menu" });
    await screen.findByRole("status", {
      name: /Current workspace: A11y Auth Tenant/i
    });
    const violations = await runAxeSmoke(container);
    expect(violations, formatAxeViolations(violations)).toEqual([]);
  });
});

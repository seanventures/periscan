import type { ReactNode } from "react";

import { isLabsPath } from "./labs-portal";

export interface PrimaryNavItem {
  href: string;
  label: string;
  icon: ReactNode;
  /** Short verb describing the outcome — shown in the command palette. */
  hint?: string;
}

export interface PrimaryNavGroup {
  label: string;
  items: PrimaryNavItem[];
  /**
   * Whether the group starts expanded in the rail. Only the Operate group
   * (proof-loop spine + Shift brief) opens by default; Setup, Labs, and Admin
   * start collapsed.
   */
  defaultOpen?: boolean;
}

// Line icons, 16px grid, currentColor. Kept tiny + inline so the shell has no
// icon-font dependency and each glyph reads at rail size.
const I = {
  dashboard: (
    <>
      <rect
        x="2"
        y="2"
        width="12"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M5 5.5h6M5 8h6M5 10.5h4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </>
  ),
  snapshot: (
    <path
      d="M2 8h3l2-4 2 8 2-5 1 1h2"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  report: (
    <>
      <rect
        x="3"
        y="2"
        width="10"
        height="12"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </>
  ),
  path: (
    <>
      <circle cx="4" cy="4" r="2" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="12" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="5" cy="12" r="2" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M6 4.6 10 7M10.6 9.4 6.4 11"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </>
  ),
  finding: (
    <>
      <path
        d="M3 13V7l5-4 5 4v6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M6 13V9h4v4" stroke="currentColor" strokeWidth="1.4" />
    </>
  ),
  control: (
    <>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 2.5v11M2.5 8h11" stroke="currentColor" strokeWidth="1.2" />
    </>
  ),
  ai: (
    <>
      <rect
        x="2.5"
        y="4"
        width="11"
        height="8"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle cx="6" cy="8" r="1" fill="currentColor" />
      <circle cx="10" cy="8" r="1" fill="currentColor" />
    </>
  ),
  evidence: (
    <>
      <rect
        x="3"
        y="2"
        width="10"
        height="12"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M6 6h4M6 9h4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </>
  ),
  remediate: (
    <path
      d="M10 3 13 6l-6.5 6.5L3 13l.5-3.5L10 3Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  ),
  schedule: (
    <>
      <circle cx="8" cy="9" r="5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 6.5V9l1.8 1.2M6 2.5 4 4M10 2.5 12 4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </>
  ),
  integrations: (
    <>
      <rect
        x="2"
        y="2"
        width="5"
        height="5"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <rect
        x="9"
        y="2"
        width="5"
        height="5"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <rect
        x="2"
        y="9"
        width="5"
        height="5"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <rect
        x="9"
        y="9"
        width="5"
        height="5"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </>
  ),
  runner: (
    <>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 3.5v4.5l3 2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </>
  ),
  tool: (
    <path
      d="M6.5 2.5a3 3 0 0 0 4 4L13 9l-2 2-2.5-2.5a3 3 0 0 1-4-4L3 6.5 5.5 4Z"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
  ),
  scope: (
    <>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 1.5v1.5M8 13v1.5M1.5 8h1.5M13 8h1.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </>
  ),
  model: (
    <>
      <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 2v2M8 12v2M2 8h2M12 8h2M4 4l1.4 1.4M10.6 10.6 12 12M12 4l-1.4 1.4M5.4 10.6 4 12"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </>
  ),
  signal: (
    <path
      d="M2 11a6 6 0 0 1 6-6M2 11a10 10 0 0 1 10-10M2 13.5h.01"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
  ),
  threat: (
    <>
      <path
        d="M8 1.5 2.5 4v4c0 3.2 2.4 5.4 5.5 6.5 3.1-1.1 5.5-3.3 5.5-6.5V4L8 1.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M8 5v3.2M8 10.2v.1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </>
  ),
  attck: (
    <>
      <path
        d="M2 12 8 3l6 9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M4.5 8h7" stroke="currentColor" strokeWidth="1.3" />
    </>
  ),
  clients: (
    <>
      <circle cx="6" cy="6" r="2.2" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M2.5 13c0-2 1.6-3.4 3.5-3.4S9.5 11 9.5 13"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M10.5 4.2a2 2 0 0 1 0 3.6M11 13c0-1.5-.7-2.7-1.8-3.2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </>
  ),
  trust: (
    <>
      <path
        d="M8 1.5 3 3.6V8c0 3 2 5 5 6.5C11 13 13 11 13 8V3.6L8 1.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="m6 8 1.6 1.6L10.5 6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  api: (
    <>
      <path
        d="M5 3 2 8l3 5M11 3l3 5-3 5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 4.5 7 11.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </>
  ),
  admin: (
    <>
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 1.8v1.6M8 12.6v1.6M14.2 8h-1.6M3.4 8H1.8M12.4 3.6l-1.1 1.1M4.7 11.3l-1.1 1.1M12.4 12.4l-1.1-1.1M4.7 4.7 3.6 3.6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </>
  )
};

/**
 * Primary navigation — Proof OS spine (UX-W10 / #200).
 *
 * Single product source of truth (shell, breadcrumbs, command palette).
 * `app-navigation.ts` is a thin label/href projection for residual tests —
 * do not maintain a parallel catalog there.
 *
 * Proof OS (Operate, default-open, ≤10):
 *   Home · Shift brief · Connect · Scope · Validate · Paths · Findings ·
 *   Remediation · Executive · Reports
 * Schedule + Evidence live on Setup so the daily rail stays a pure prove loop
 * without growing past ten peers. Shell marks Operate with
 * data-proof-os-spine="true".
 *
 * Groups:
 * - Operate (default-open): Proof OS daily spine + morning Shift brief (P18-2)
 *   + Executive (ICP-P1-4 board/leader buyer path)
 * - Setup (collapsed catalog): Getting started · Runners · Engines · Schedule ·
 *   Assets · External Validation · Controls · Evidence · Compliance
 *   UX-W15 (PERISCAN-483): shell allow-lists collapse Operating Setup to
 *   Runners · Engines (Schedule re-surfaces for SecurityEngineer daily;
 *   Evidence re-surfaces on engineer daily + Operating default allow-list).
 *   Connect/Scope stay on Operate. Full Setup restored via Show Labs & more /
 *   palette / direct URL. New/Activating keep richer first-run Setup.
 * - Labs (collapsed): single portal door `Labs → /labs` only (UX-W10). Former
 *   peers live in `LABS_DESTINATIONS` (`labs-portal.ts`) + `/labs` page.
 * - Admin (collapsed): tenant, trust, billing
 *
 * P07-1/2: Engines sit in Setup (not the hero rail). Authorize home is
 * `/scopes` labeled Scope. Inventory is "Assets & ownership" on Setup.
 * Engines `/engines` remains the tool governance marketplace product alias
 * (legacy `/registries` redirects).
 * P18-2: `/shift` (Shift brief) sits next to Home — one honest morning brief,
 * not a Continuous zoo expansion.
 *
 * UX-W1 / PERISCAN-474 (Proof OS direction): Operate is the only default-open
 * rail and is capped at ≤10 proof-loop destinations — progressive step toward
 * a 7-screen "Proof OS" spine (Home · Connect · Scope · Validate · Paths ·
 * Findings · Remediation). Shift brief + Executive + Reports stay on Operate as
 * daily leadership / operator needs; Schedule + Evidence move to Setup so the
 * hero rail stays slim. ICP-P1-4 tradeoff: Evidence demoted so Executive is
 * discoverable for board/CISO buyers without breaking the ≤10 Operate cap.
 * Do not grow Operate without removing something.
 * UX-W10: Labs rail is portal-only; palette reindexes `LABS_DESTINATIONS`
 * when showLabs is on (buildWeightedPaletteNavItems).
 */
export const PRIMARY_NAV: PrimaryNavGroup[] = [
  {
    label: "Operate",
    defaultOpen: true,
    items: [
      {
        href: "/dashboard",
        label: "Home",
        icon: I.dashboard,
        hint: "Proof-loop command center"
      },
      {
        // P18-2: morning program health — discoverable next to Home / Needs you.
        href: "/shift",
        label: "Shift brief",
        icon: I.signal,
        hint: "Blue shift — morning validated program health"
      },
      {
        href: "/integrations",
        label: "Connect",
        icon: I.integrations,
        hint: "Connect signal sources"
      },
      {
        // P07-2: demo/product Authorize stage lives at /scopes (not inventory).
        href: "/scopes",
        label: "Scope",
        icon: I.scope,
        hint: "Verify authorized validation scope"
      },
      {
        href: "/missions",
        // Honest label: /missions mounts ValidationSnapshotFlow only.
        // Do not rename to "Missions" until multi-type MissionsWorkbench is mounted.
        label: "Validate",
        icon: I.snapshot,
        hint: "Guided Validation Snapshot on authorized scope"
      },
      {
        href: "/attack-paths",
        label: "Paths",
        icon: I.path,
        hint: "Entry → objective, edge by edge"
      },
      {
        href: "/findings",
        label: "Findings",
        icon: I.finding,
        hint: "Evidence-backed exposure queue"
      },
      {
        href: "/remediation",
        label: "Remediation",
        icon: I.remediate,
        hint: "Fix plans & verification"
      },
      {
        // ICP-P1-4: Executive on Operate for board/CISO buyer path (≤10).
        // Tradeoff: Evidence demoted to Setup; engineer daily re-surfaces it.
        href: "/executive",
        label: "Executive",
        icon: I.finding,
        hint: "Leadership posture & trends"
      },
      {
        href: "/reports",
        label: "Reports",
        icon: I.report,
        hint: "Evidence packs & exports"
      }
      // UX-W1: Schedule is Setup (recurring config), not Operate hero spine.
      // ICP-P1-4: Evidence is Setup so Executive fits the ≤10 Operate cap.
    ]
  },
  {
    // UX-W1: collapsed by default — only Operate opens (Proof OS spine).
    label: "Setup",
    defaultOpen: false,
    items: [
      {
        // Secondary deep guide only — primary first-run is GetStarted on Home.
        href: "/getting-started",
        label: "Getting started",
        icon: I.snapshot,
        hint: "Alias of Home first-run (Connect → Scope → Validate)"
      },
      {
        href: "/runners",
        label: "Runners",
        icon: I.runner,
        hint: "Outbound in-network agents"
      },
      {
        // P07-1: Engines off Operate hero shelf — tool governance is Setup.
        href: "/engines",
        label: "Engines",
        icon: I.tool,
        hint: "Engine Lab / tool governance"
      },
      {
        // UX-W1: recurring validation config — Setup, not Operate ≤10 spine.
        href: "/schedules",
        label: "Schedule",
        icon: I.schedule,
        hint: "Recurring validation"
      },
      {
        // P07-2/P07-18: inventory ownership, not authorize. /data-fabric redirects.
        href: "/assets",
        label: "Assets & ownership",
        icon: I.integrations,
        hint: "Inventory, ownership & lineage (authorize scope on Scope)"
      },
      {
        href: "/external-validation",
        label: "External Validation",
        icon: I.path,
        hint: "Safe internet-facing validation profiles"
      },
      {
        href: "/controls",
        label: "Controls",
        icon: I.control,
        hint: "Detected / Blocked / Missed"
      },
      {
        // ICP-P1-4: Evidence ledger on Setup (demoted so Executive fits Operate).
        href: "/evidence",
        label: "Evidence",
        icon: I.evidence,
        hint: "The evidence ledger"
      },
      {
        href: "/compliance",
        label: "Compliance",
        icon: I.control,
        hint: "Measured control trace"
      }
    ]
  },
  {
    // UX-W10: portal-only Labs door. Former peers → LABS_DESTINATIONS / /labs.
    // Collapsed; reveal still gated by "Show Labs & more". Deep routes remain.
    label: "Labs",
    defaultOpen: false,
    items: [
      {
        href: "/labs",
        label: "Labs",
        icon: I.ai,
        hint: "Labs portal — autonomous, AI governance, and intel"
      }
    ]
  },
  {
    label: "Admin",
    defaultOpen: false,
    items: [
      {
        href: "/mssp",
        label: "Clients",
        icon: I.clients,
        hint: "MSSP portfolio"
      },
      {
        href: "/policies",
        label: "Policies",
        icon: I.control,
        hint: "Validation policy and approval gates"
      },
      {
        href: "/admin",
        label: "Admin",
        icon: I.admin,
        hint: "Tenant, API keys, branding"
      },
      {
        href: "/billing",
        label: "Billing",
        icon: I.report,
        hint: "Usage & plan"
      },
      {
        href: "/audit",
        label: "Audit",
        icon: I.evidence,
        hint: "Filterable event log"
      },
      {
        href: "/trust-safety",
        label: "Trust & Safety",
        icon: I.trust,
        hint: "Permissions, data, safety"
      },
      {
        href: "/account-security",
        label: "Account Security",
        icon: I.trust,
        hint: "Password, MFA and active sessions"
      },
      {
        href: "/api-reference",
        label: "API Reference",
        icon: I.api,
        hint: "Customer-facing API docs"
      }
    ]
  }
];

export const PRIMARY_NAV_ITEMS: PrimaryNavItem[] = PRIMARY_NAV.flatMap(
  (group) => group.items
);

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard" || pathname === "/";
  }
  // UX-W10: Labs portal door stays active on any portal destination/deep-link.
  if (href === "/labs") {
    return isLabsPath(pathname);
  }
  // UX-W2 threats hub join (still used by deep links / residual references).
  if (href === "/threat-center") {
    return (
      pathname === "/threat-center" ||
      pathname.startsWith("/threat-center/") ||
      pathname === "/threats" ||
      pathname.startsWith("/threats/") ||
      pathname === "/threat-feed" ||
      pathname.startsWith("/threat-feed/") ||
      pathname === "/signal-activity" ||
      pathname.startsWith("/signal-activity/") ||
      pathname === "/attack-techniques" ||
      pathname.startsWith("/attack-techniques/")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Command palette group weight (UX-W2 items 19–20).
 * Operate first, then Setup, Admin, Labs last — even when Labs are revealed.
 */
export const PALETTE_GROUP_WEIGHT: Record<string, number> = {
  Operate: 0,
  Setup: 1,
  Admin: 2,
  Labs: 3
};

export function paletteGroupWeight(label: string): number {
  return PALETTE_GROUP_WEIGHT[label] ?? 9;
}

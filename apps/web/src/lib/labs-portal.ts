/**
 * Labs portal destinations (UX-W10 / K6, building on UX-W6 portal).
 *
 * Former Labs rail peers live only here and on `/labs`. PRIMARY_NAV Labs group
 * is a single portal door (`Labs → /labs`). Command palette indexes these when
 * the operator opts into "Show Labs & more" (`periscan.nav.scope=all`) via
 * buildWeightedPaletteNavItems.
 */

export type LabsDestinationCategory =
  | "Autonomous"
  | "AI governance"
  | "Identity & intel";

export interface LabsDestination {
  href: string;
  label: string;
  /** Short honest outcome line for portal cards + palette. */
  hint: string;
  category: LabsDestinationCategory;
}

/**
 * Ordered Labs catalog — portal page + palette secondary index.
 * Keep deep-linkable; do not re-promote to PRIMARY_NAV Labs peers.
 */
export const LABS_DESTINATIONS: LabsDestination[] = [
  {
    href: "/swarm",
    label: "Live validation ops",
    hint: "Live sessions and engagement activity. Prefer Validate on verified scope for first measured proof.",
    category: "Autonomous"
  },
  {
    href: "/workflows",
    label: "Agent Workflows",
    hint: "Compose governed agent workflows. Policy and scope still gate every run.",
    category: "Autonomous"
  },
  {
    href: "/operators",
    label: "Operators",
    hint: "Evidence-backed recommendations — not autonomous remediation.",
    category: "Autonomous"
  },
  {
    href: "/engagements",
    label: "Engagements",
    hint: "Author governed validation chains with explicit approval gates.",
    category: "Autonomous"
  },
  {
    href: "/mcp",
    label: "MCP Server",
    hint: "Expose allowlisted tools to AI clients. Not a daily Operate surface.",
    category: "AI governance"
  },
  {
    href: "/model-gateway",
    label: "Model Gateway",
    hint: "Governed model sessions and tool requests with audit.",
    category: "AI governance"
  },
  {
    href: "/ai-apps",
    label: "AI Apps",
    hint: "Safe AI application validation against authorized scope.",
    category: "AI governance"
  },
  {
    href: "/non-human-identities",
    label: "Machine Identities",
    hint: "Secret-free NHI sprawl and risk from measured inventory.",
    category: "Identity & intel"
  },
  {
    href: "/threat-center",
    label: "Threats",
    hint: "One door for advisories, feed, and signal activity. Intel is not measured proof.",
    category: "Identity & intel"
  }
];

/** Secondary deep-links kept off the Labs rail but reachable from the portal. */
export const LABS_PORTAL_DEEP_LINKS: LabsDestination[] = [
  {
    href: "/validation-ops",
    label: "Live validation ops (Labs)",
    hint: "Queue and mission metrics control room. Folded under Continuous Health — not a primary rail peer.",
    category: "Autonomous"
  },
  {
    href: "/packs",
    label: "Packs",
    hint: "Proof-loop pack readiness deep-link.",
    category: "Autonomous"
  },
  {
    href: "/attack-techniques",
    label: "ATT&CK catalog",
    hint: "Technique reference. Prefer Threats as the intel door.",
    category: "Identity & intel"
  },
  {
    href: "/continuous",
    label: "Continuous hub",
    hint: "Plan → Run → Health for continuous validation. Schedule and Runners stay primary Setup.",
    category: "Autonomous"
  }
];

/** Href set for palette gating and rail active-path matching. */
export const LABS_DESTINATION_HREFS = new Set(
  LABS_DESTINATIONS.map((item) => item.href)
);

const LABS_DEEP_LINK_HREFS = new Set(
  LABS_PORTAL_DEEP_LINKS.map((item) => item.href)
);

/** Threats hub residual deep-links (UX-W2 join). */
const THREATS_DEEP_HREFS = [
  "/threat-feed",
  "/signal-activity",
  "/threats"
] as const;

/** True when pathname is the Labs portal, a destination, or a Labs deep-link. */
export function isLabsPath(pathname: string): boolean {
  if (pathname === "/labs" || pathname.startsWith("/labs/")) {
    return true;
  }
  for (const href of LABS_DESTINATION_HREFS) {
    if (pathname === href || pathname.startsWith(`${href}/`)) {
      return true;
    }
  }
  for (const href of LABS_DEEP_LINK_HREFS) {
    if (pathname === href || pathname.startsWith(`${href}/`)) {
      return true;
    }
  }
  for (const href of THREATS_DEEP_HREFS) {
    if (pathname === href || pathname.startsWith(`${href}/`)) {
      return true;
    }
  }
  return false;
}

export function labsDestinationForPath(
  pathname: string
): LabsDestination | undefined {
  return (
    LABS_DESTINATIONS.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
    ) ??
    LABS_PORTAL_DEEP_LINKS.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
    )
  );
}

export const LABS_CATEGORY_ORDER: LabsDestinationCategory[] = [
  "Autonomous",
  "AI governance",
  "Identity & intel"
];

/** Alias used by portal UI tests (UX-W6 naming). */
export const LABS_PORTAL_DESTINATIONS = LABS_DESTINATIONS;

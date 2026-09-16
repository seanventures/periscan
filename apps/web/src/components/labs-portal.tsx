"use client";

import Link from "next/link";

import {
  LABS_DESTINATIONS,
  LABS_PORTAL_DEEP_LINKS,
  type LabsDestination
} from "../lib/labs-portal";
import { PageHeader, PageShell, Panel, buttonClassName } from "../ui";

/**
 * UX-W6 / UX-W10 — calm Labs portal.
 * Lists Labs destinations with honest one-liners. Deep routes stay valid;
 * PRIMARY_NAV Labs is portal-only (`Labs → /labs`).
 */

export type LabsPortalDestination = {
  href: string;
  label: string;
  description: string;
};

function toPortalDest(item: LabsDestination): LabsPortalDestination {
  return {
    href: item.href,
    label: item.label,
    description: item.hint
  };
}

/** Catalog of Labs destinations with restrained copy (not marketing theater). */
export const LABS_PORTAL_DESTINATIONS: LabsPortalDestination[] =
  LABS_DESTINATIONS.map(toPortalDest);

export { LABS_PORTAL_DEEP_LINKS };

/** Portal rail destinations — independent of PRIMARY_NAV peers (UX-W10). */
export function labsPortalRailDestinations(): LabsPortalDestination[] {
  return LABS_PORTAL_DESTINATIONS;
}

export function LabsPortal() {
  const destinations = labsPortalRailDestinations();

  return (
    <PageShell data-testid="labs-portal">
      <PageHeader
        eyebrow="Labs"
        title="Labs"
        description="Experimental and secondary surfaces. The daily proof loop lives under Operate — Connect, Scope, Validate, Paths, Findings, Remediation. Open Labs only when you need these tools."
        actions={
          <Link
            href="/dashboard"
            className={buttonClassName({ size: "sm", variant: "secondary" })}
          >
            Back to Home
          </Link>
        }
      />

      <p
        className="max-w-2xl text-xs leading-5 text-subtle"
        data-testid="labs-portal-honesty"
      >
        Labs is demoted by default (Show Labs &amp; more). Nothing here upgrades
        claim language, bypasses policy, or marks Fixed without verification.
        Deep links and ⌘K still reach these destinations after Show Labs &amp;
        more — they are not promoted back onto Operate.
      </p>

      <Panel aria-label="Labs destinations">
        <ul
          className="divide-y divide-line"
          data-testid="labs-portal-destinations"
        >
          {destinations.map((dest) => (
            <li key={dest.href}>
              <Link
                href={dest.href}
                className="flex flex-col gap-0.5 px-4 py-3 transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg sm:flex-row sm:items-baseline sm:gap-4"
                data-testid={`labs-dest-${dest.href.replace(/^\//, "")}`}
              >
                <span className="shrink-0 text-sm font-semibold text-ink sm:w-44">
                  {dest.label}
                </span>
                <span className="min-w-0 text-xs leading-5 text-muted">
                  {dest.description}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel aria-label="Labs deep-links">
        <div className="border-b border-line px-4 py-3">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">
            Deep-links (not rail peers)
          </p>
          <p className="mt-1 text-xs text-muted">
            Kept for power users and Continuous join paths. Prefer Operate and
            Setup for daily work.
          </p>
        </div>
        <ul className="divide-y divide-line" data-testid="labs-portal-deep-links">
          {LABS_PORTAL_DEEP_LINKS.map((dest) => (
            <li key={dest.href}>
              <Link
                href={dest.href}
                className="flex flex-col gap-0.5 px-4 py-3 transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg sm:flex-row sm:items-baseline sm:gap-4"
              >
                <span className="shrink-0 text-sm font-semibold text-ink sm:w-44">
                  {dest.label}
                </span>
                <span className="min-w-0 text-xs leading-5 text-muted">
                  {dest.hint}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </PageShell>
  );
}

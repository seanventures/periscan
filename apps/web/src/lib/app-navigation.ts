/**
 * Product navigation contract — derived from PRIMARY_NAV (single source of truth).
 *
 * Dual-nav cleanup (P07-1 / #160): there is no independent product catalog
 * here. The live shell (`app-shell.tsx` RailNav), breadcrumbs, and command
 * palette consume `primary-nav.tsx` directly. This module is a thin,
 * label-only projection for route contracts, accessibility gates, residual
 * `AppNavigation` component tests, and PRD coverage that still import APP_NAV_*.
 *
 * Do not add parallel nav items here. Edit PRIMARY_NAV in primary-nav.tsx.
 */

import {
  PRIMARY_NAV,
  PRIMARY_NAV_ITEMS,
  isNavItemActive
} from "./primary-nav";

export interface NavItem {
  href: string;
  label: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

/** Sectioned product nav — same groups/hrefs/labels as PRIMARY_NAV. */
export const APP_NAV_SECTIONS: NavSection[] = PRIMARY_NAV.map((group) => ({
  label: group.label,
  items: group.items.map(({ href, label }) => ({ href, label }))
}));

/** Flat product nav items — same order as PRIMARY_NAV_ITEMS. */
export const APP_NAV_ITEMS: NavItem[] = PRIMARY_NAV_ITEMS.map(
  ({ href, label }) => ({ href, label })
);

/**
 * Active-route helper for product nav. Delegates to primary-nav so `/` and
 * `/dashboard` stay aligned with the shell.
 */
export function isActiveRoute(pathname: string, href: string) {
  return isNavItemActive(pathname, href);
}

export {
  PRIMARY_NAV,
  PRIMARY_NAV_ITEMS,
  isNavItemActive
} from "./primary-nav";

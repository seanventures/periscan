"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  labsDestinationForPath
} from "../lib/labs-portal";
import {
  PRIMARY_NAV,
  PRIMARY_NAV_ITEMS,
  isNavItemActive
} from "../lib/primary-nav";
import { translateUiText } from "../lib/localization";
import { useProductLocale } from "./product-localization";

type BreadcrumbDescriptor = {
  currentLabel: string;
  sectionLabel?: string;
};

const DYNAMIC_ROUTE_BREADCRUMBS: Array<
  BreadcrumbDescriptor & { prefix: string; suffix?: string }
> = [
  {
    currentLabel: "Attack path detail",
    prefix: "/attack-paths/",
    sectionLabel: "Operate"
  },
  {
    currentLabel: "Validation mission",
    prefix: "/missions/",
    sectionLabel: "Operate"
  },
  {
    currentLabel: "Remediation detail",
    prefix: "/remediation/",
    sectionLabel: "Operate"
  },
  {
    currentLabel: "Snapshot report",
    prefix: "/snapshots/",
    suffix: "/report",
    sectionLabel: "Operate"
  },
  {
    currentLabel: "Snapshot review",
    prefix: "/snapshots/",
    sectionLabel: "Operate"
  }
];

function titleCaseSegment(segment: string) {
  return segment
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function resolveBreadcrumb(pathname: string): BreadcrumbDescriptor {
  const dynamicMatch = DYNAMIC_ROUTE_BREADCRUMBS.find(
    (route) =>
      pathname.startsWith(route.prefix) &&
      (!route.suffix || pathname.endsWith(route.suffix))
  );

  if (dynamicMatch) {
    return dynamicMatch;
  }

  for (const section of PRIMARY_NAV) {
    const activeItem = section.items.find((item) =>
      isNavItemActive(pathname, item.href)
    );

    if (activeItem) {
      // UX-W10: deep Labs destinations keep Labs section + destination label.
      if (section.label === "Labs" && activeItem.href === "/labs") {
        const dest = labsDestinationForPath(pathname);
        if (dest) {
          return {
            currentLabel: dest.label,
            sectionLabel: "Labs"
          };
        }
      }
      return {
        currentLabel: activeItem.label,
        sectionLabel: activeItem.href === "/" ? undefined : section.label
      };
    }
  }

  const labsDest = labsDestinationForPath(pathname);
  if (labsDest) {
    return {
      currentLabel: labsDest.label,
      sectionLabel: "Labs"
    };
  }

  const currentLabel =
    pathname.split("/").filter(Boolean).map(titleCaseSegment).at(-1) ??
    "Dashboard";

  return {
    currentLabel
  };
}

export function AppBreadcrumbs() {
  const pathname = usePathname() ?? "/";
  const locale = useProductLocale();
  const breadcrumb = resolveBreadcrumb(pathname);
  const isWorkspace = pathname === "/" || pathname === "/dashboard";
  const dashboardLabel =
    PRIMARY_NAV_ITEMS.find((item) => item.href === "/dashboard")?.label ??
    "Dashboard";

  return (
    <nav className="app-breadcrumb" aria-label="Breadcrumb">
      <ol>
        {isWorkspace ? (
          <li aria-current="page">{translateUiText(locale, dashboardLabel)}</li>
        ) : (
          <>
            <li>
              <Link href="/">{translateUiText(locale, dashboardLabel)}</Link>
            </li>
            {breadcrumb.sectionLabel ? (
              <li>{translateUiText(locale, breadcrumb.sectionLabel)}</li>
            ) : null}
            <li aria-current="page">
              {translateUiText(locale, breadcrumb.currentLabel)}
            </li>
          </>
        )}
      </ol>
    </nav>
  );
}

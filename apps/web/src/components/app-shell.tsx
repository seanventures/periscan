"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode
} from "react";

import { resolveFirstRunPrimaryAction } from "../lib/first-run-primary-action";
import { writeFirstProofResume } from "../lib/first-proof-resume";
import { PRIMARY_NAV, isNavItemActive } from "../lib/primary-nav";
import { browserPeriscanApiClient } from "../lib/periscan-api-client";
import { useApiResource } from "../hooks/use-api-resource";
import { useWorkingTenant } from "../hooks/use-working-tenant";
import { consumeWorkingTenantEnterToast } from "../lib/working-tenant";
import { useFocusTrap } from "../hooks/use-focus-trap";
import { Brandmark } from "../ui/brandmark";
import { cn } from "../ui/cn";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { AppBreadcrumbs } from "./app-breadcrumbs";
import { ClaimGuardHud } from "./claim-guard-hud";
import { CommandPalette } from "./command-palette";
import { ProductHelpDrawer } from "./product-help-drawer";
import { ProofLoopMap } from "./proof-loop-map";
import {
  ProductLocalizationProvider,
  useProductLocale
} from "./product-localization";
import { translateUiText } from "../lib/localization";

/** SOC dark cockpit: reduces background bloom (UX-W5 / 196). Off by default. */
export const SOC_DARK_STORAGE_KEY = "periscan-soc-dark";

// Routes that render without the product chrome (auth + the public sample).
const BARE_ROUTES = [
  "/login",
  "/signup",
  "/reset-password",
  "/accept-invite",
  "/verify-email",
  "/welcome",
  "/demo"
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [socDark, setSocDark] = useState(false);
  const [density, setDensity] = useState<ShellDensity>("comfortable");
  const closeHelp = useCallback(() => setHelpOpen(false), []);
  const closeMobileNav = useCallback(() => setMobileOpen(false), []);
  const mobileDrawerRef = useRef<HTMLDivElement>(null);
  const mobileNavId = useId();

  const bare = BARE_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  useEffect(() => {
    setDensity(readShellDensity());
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // SOC dark cockpit preference (UX-W5 / 196) — body class reduces bloom.
  useEffect(() => {
    try {
      const enabled = localStorage.getItem(SOC_DARK_STORAGE_KEY) === "1";
      setSocDark(enabled);
      document.body.classList.toggle("soc-dark-cockpit", enabled);
    } catch {
      // ignore unreadable storage
    }
    return () => {
      document.body.classList.remove("soc-dark-cockpit");
    };
  }, []);

  const toggleSocDark = useCallback(() => {
    setSocDark((prev) => {
      const next = !prev;
      try {
        if (next) {
          localStorage.setItem(SOC_DARK_STORAGE_KEY, "1");
        } else {
          localStorage.removeItem(SOC_DARK_STORAGE_KEY);
        }
      } catch {
        // ignore unwritable storage
      }
      document.body.classList.toggle("soc-dark-cockpit", next);
      return next;
    });
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useFocusTrap({
    open: mobileOpen,
    containerRef: mobileDrawerRef,
    onEscape: closeMobileNav
  });

  const toggleDensity = useCallback(() => {
    setDensity((prev) => {
      const next: ShellDensity =
        prev === "compact" ? "comfortable" : "compact";
      writeShellDensity(next);
      return next;
    });
  }, []);

  // P16-1: while a shell overlay is open, mark chrome/main inert so keyboard,
  // pointer, and AT browse mode cannot activate content behind the dialog.
  // Overlays (drawer / palette / help) stay outside the inerted regions.
  const shellDialogOpen = mobileOpen || paletteOpen || helpOpen;
  const chromeInert = paletteOpen || helpOpen;

  if (bare) {
    return <>{children}</>;
  }

  return (
    <ProductLocalizationProvider>
      <div
        className={cn(
          "periscan-app-shell min-h-screen bg-bg text-ink md:grid md:grid-cols-[236px_1fr]",
          socDark && "soc-dark-cockpit"
        )}
        data-density={density}
        data-soc-dark={socDark ? "1" : "0"}
        data-testid="app-shell"
      >
        {/* Desktop rail — inert under major dialogs (not under mobile drawer; rail is md+ only) */}
        <aside
          className="sticky top-0 hidden h-screen flex-col overflow-y-auto border-r border-[#14224a] bg-elevated md:flex"
          // React 19 boolean: omit when closed so attribute is not present.
          {...(chromeInert ? { inert: true as const } : {})}
        >
          <RailNav pathname={pathname} layout="desktop" />
        </aside>

        {/* Mobile drawer — Escape + focus trap (P01-11); trigger reflects expanded (P16-2).
            Trap root is the full overlay so backdrop stays clickable while shell is inert (P16-1).
            UX-W7/#21: Operate-first mobile IA — Labs/Admin (and Setup) behind More. */}
        {mobileOpen ? (
          <div ref={mobileDrawerRef} className="fixed inset-0 z-40 md:hidden">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={closeMobileNav}
              aria-hidden
            />
            <aside
              id={mobileNavId}
              role="dialog"
              aria-modal="true"
              aria-label="Primary navigation"
              className="absolute inset-y-0 left-0 flex w-64 flex-col overflow-y-auto border-r border-[#14224a] bg-elevated"
            >
              <div className="flex items-center justify-between border-b border-line px-3 py-2 md:hidden">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">
                  Navigation
                </span>
                <button
                  type="button"
                  onClick={closeMobileNav}
                  aria-label="Close navigation"
                  className="min-h-11 min-w-11 rounded-control border border-line p-1.5 text-muted transition-colors hover:border-brand hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M4 4l8 8M12 4l-8 8"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
              <RailNav pathname={pathname} layout="mobile" />
            </aside>
          </div>
        ) : null}

        {/* Content sibling of overlays — inert when any shell dialog is open (P16-1) */}
        <div
          className="flex min-w-0 flex-col"
          {...(shellDialogOpen ? { inert: true as const } : {})}
        >
          <CommandBar
            onOpenNav={() => setMobileOpen(true)}
            mobileNavOpen={mobileOpen}
            mobileNavId={mobileNavId}
            onOpenPalette={() => setPaletteOpen(true)}
            paletteOpen={paletteOpen}
            onOpenHelp={() => setHelpOpen(true)}
            helpOpen={helpOpen}
            socDark={socDark}
            onToggleSocDark={toggleSocDark}
            density={density}
            onToggleDensity={toggleDensity}
          />
          <main
            id="main-content"
            tabIndex={-1}
            className="product-main w-full min-w-0 flex-1"
          >
            <AppBreadcrumbs />
            {children}
          </main>
        </div>

        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
        />
        <ProductHelpDrawer
          open={helpOpen}
          pathname={pathname}
          onClose={closeHelp}
        />
      </div>
    </ProductLocalizationProvider>
  );
}

const NAV_OPEN_KEY = "periscan.nav.open";
const NAV_SCOPE_KEY = "periscan.nav.scope";
/** UX-W9 / #192 — shell density preference (comfortable | compact). */
const DENSITY_KEY = "periscan-density";
export type ShellDensity = "comfortable" | "compact";

function readShellDensity(): ShellDensity {
  try {
    const raw = localStorage.getItem(DENSITY_KEY);
    if (raw === "compact" || raw === "comfortable") return raw;
  } catch {
    // ignore unreadable storage
  }
  return "comfortable";
}

function writeShellDensity(value: ShellDensity) {
  try {
    localStorage.setItem(DENSITY_KEY, value);
  } catch {
    // ignore unwritable storage
  }
}

const NEW_TENANT_NAV = new Set([
  "/dashboard",
  "/integrations",
  "/scopes",
  "/runners",
  "/missions",
  "/trust-safety"
]);
/** Activating maturity: proof-loop Understand/Act destinations stay visible so
 * post-mission handoffs to findings/remediation are discoverable in the rail
 * (not only via in-page nextAction links). */
const ACTIVATING_TENANT_NAV = new Set([
  ...NEW_TENANT_NAV,
  "/shift",
  "/controls",
  "/attack-paths",
  "/findings",
  "/remediation",
  "/evidence",
  "/reports"
]);
/**
 * UX-W15 (PERISCAN-483): Setup hrefs kept on the Operating rail.
 * Full PRIMARY_NAV Setup catalog still exists for palette / Show Labs & more.
 * Connect · Scope stay on Operate (≤10 Proof OS spine). Schedule lives under
 * Setup (UX-W1) and is re-surfaced for SecurityEngineer daily when needed.
 */
const OPERATING_SETUP_NAV = new Set(["/runners", "/engines"]);

/**
 * Proof OS (#200 / UX-W10) + UX-W1 + UX-W15 (PERISCAN-483) + ICP-P1-4:
 * Operate spine ≤10 (Home · Shift · Connect · Scope · Validate · Paths ·
 * Findings · Remediation · Executive · Reports) plus collapsed Setup
 * infrastructure (Runners · Engines). Must match PRIMARY_NAV Operate.
 *
 * Setup junk drawer stays off the default Operating rail until Show Labs & more
 * / palette / direct URL: Getting started, Assets, External Validation,
 * Controls, Compliance. Schedule + Evidence stay Setup (not Operate); engineer
 * daily re-surfaces both.
 *
 * New / Activating keep richer first-run Setup via NEW_TENANT_NAV /
 * ACTIVATING_TENANT_NAV. Labs never enter these sets — portal-only via Show
 * Labs & more.
 */
const OPERATING_DEFAULT_NAV = new Set([
  "/dashboard",
  "/shift",
  "/integrations",
  "/scopes",
  "/missions",
  "/attack-paths",
  "/findings",
  "/remediation",
  "/executive",
  "/reports",
  ...OPERATING_SETUP_NAV
]);
const ENGINEER_DAILY_NAV = new Set([
  ...OPERATING_DEFAULT_NAV,
  // UX-W15: Schedule + Evidence if needed; no Getting started / Assets junk
  "/schedules",
  "/evidence",
  "/trust-safety"
]);

/** Setup-group junk drawer — never default-visible on Operating / Engineer daily. */
const OPERATING_SETUP_HIDDEN = new Set([
  "/getting-started",
  "/assets",
  "/external-validation",
  "/controls",
  "/compliance"
]);

function RailNav({
  pathname,
  layout = "desktop"
}: {
  pathname: string;
  /** Mobile drawer uses Operate-first + More for Labs/Admin/Setup (UX-W7/#21). */
  layout?: "desktop" | "mobile";
}) {
  const locale = useProductLocale();
  const activation = useApiResource(
    () => browserPeriscanApiClient.getProductActivationState(),
    []
  );
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      PRIMARY_NAV.map((g) => [g.label, g.defaultOpen ?? false])
    )
  );
  const [showAllNavigation, setShowAllNavigation] = useState(false);
  /** Mobile-only: non-Operate groups live under a single More disclosure. */
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(NAV_OPEN_KEY);
      if (raw) setOpen((prev) => ({ ...prev, ...JSON.parse(raw) }));
      setShowAllNavigation(localStorage.getItem(NAV_SCOPE_KEY) === "all");
    } catch {
      // ignore unreadable storage
    }
  }, []);

  const toggle = (label: string) =>
    setOpen((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      try {
        localStorage.setItem(NAV_OPEN_KEY, JSON.stringify(next));
      } catch {
        // ignore unwritable storage
      }
      return next;
    });
  const persona = activation.data?.profile.productPersona ?? null;
  const maturity = activation.data?.maturity ?? null;
  const personaAllowList: Partial<
    Record<NonNullable<typeof persona>, Set<string>>
  > = {
    SecurityLeader: new Set([
      "/dashboard",
      "/shift",
      "/getting-started",
      "/executive",
      "/attack-paths",
      "/findings",
      "/remediation",
      "/reports",
      "/schedules",
      "/integrations",
      "/mssp",
      "/trust-safety"
    ]),
    GrcAuditor: new Set([
      "/dashboard",
      "/getting-started",
      "/compliance",
      "/reports",
      "/evidence",
      "/policies",
      "/audit",
      "/trust-safety"
    ]),
    MsspOperator: new Set([
      "/dashboard",
      "/shift",
      "/getting-started",
      "/mssp",
      "/executive",
      "/findings",
      "/remediation",
      "/reports",
      "/schedules",
      "/integrations",
      "/audit",
      "/trust-safety"
    ]),
    // P07-17: engineer default is slim daily set, not full catalog
    SecurityEngineer: ENGINEER_DAILY_NAV
  };
  const personaAllow = persona ? personaAllowList[persona] : undefined;
  /**
   * P07-17 single effective allow-list:
   * - New / Activating: lifecycle slim sets
   * - Mature + persona: persona daily set (Leader/GRC/MSSP/Engineer)
   * - Mature + no persona: Operate rail (spine + Shift brief)
   * Labs never enter these sets — revealed only via Show Labs & more.
   */
  const defaultAllowList: Set<string> | undefined = (() => {
    const base =
      maturity === "New"
        ? NEW_TENANT_NAV
        : maturity === "Activating"
          ? ACTIVATING_TENANT_NAV
          : (personaAllow ?? OPERATING_DEFAULT_NAV);
    if (
      (maturity === "New" || maturity === "Activating") &&
      persona === "SecurityLeader"
    ) {
      return new Set([...base, "/executive"]);
    }
    return base;
  })();
  // Always guided by default — Show Labs & more is the escape hatch, not the product.
  const guidedNavigation = true;
  // Mature (Measured/Operating) collapse Setup junk drawer.
  // New/Activating keep richer first-run Setup (Getting started, Controls, etc.).
  const collapseOperatingSetup =
    !showAllNavigation &&
    maturity !== "New" &&
    maturity !== "Activating";

  const visibleNav = PRIMARY_NAV.map((group) => {
    // P07-17: Labs stays fully hidden until "Show Labs & more" (never default-visible).
    if (group.label === "Labs" && !showAllNavigation) {
      const activeLabs = group.items.filter((item) =>
        isNavItemActive(pathname, item.href)
      );
      return { ...group, items: activeLabs };
    }
    return {
      ...group,
      items: group.items.filter((item) => {
        // UX-W15: on mature rails, Setup junk stays off the default rail unless
        // the route is active, a persona allow-list re-surfaces it (e.g. Leader
        // → Executive, GRC → Compliance), or the user expanded Show Labs & more.
        if (
          collapseOperatingSetup &&
          group.label === "Setup" &&
          OPERATING_SETUP_HIDDEN.has(item.href) &&
          !(defaultAllowList?.has(item.href) ?? false) &&
          !isNavItemActive(pathname, item.href)
        ) {
          return false;
        }
        if (item.href === "/getting-started") {
          // P02-11 + UX-W15: mature Operating/Engineer default demotes Getting
          // started (no activationIncomplete pin). Persona allow-lists may still
          // re-surface it; New/Activating keep first-run richness.
          if (collapseOperatingSetup) {
            return (
              (defaultAllowList?.has(item.href) ?? false) ||
              isNavItemActive(pathname, item.href)
            );
          }
          return (
            showAllNavigation ||
            (defaultAllowList?.has(item.href) ?? false) ||
            isNavItemActive(pathname, item.href)
          );
        }
        return (
          showAllNavigation ||
          (defaultAllowList?.has(item.href) ?? false) ||
          isNavItemActive(pathname, item.href)
        );
      })
    };
  }).filter((group) => group.items.length > 0);
  const personaLabel =
    persona === "SecurityLeader"
      ? "Security leader"
      : persona === "GrcAuditor"
        ? "GRC / auditor"
        : persona === "MsspOperator"
          ? "MSSP / vCISO"
          : persona === "SecurityEngineer"
            ? "Security engineer"
            : null;
  // P02-5: same first-run CTA helper as GetStarted (setup spine → nextAction → persona).
  // While activation is still loading, keep persona fallback so Operating tenants
  // do not flash "Connect a source".
  const personaFallback =
    persona === "SecurityLeader"
      ? { href: "/executive", label: "Review posture" }
      : persona === "GrcAuditor"
        ? { href: "/reports", label: "Compose proof" }
        : persona === "MsspOperator"
          ? { href: "/mssp", label: "Triage clients" }
          : { href: "/missions", label: "New validation" };
  const primaryAction =
    activation.data != null
      ? resolveFirstRunPrimaryAction(activation.data, personaFallback)
      : {
          ...personaFallback,
          setupIncomplete: false as const,
          reason: undefined as string | undefined
        };

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-line px-[22px] py-[18px]">
        <Link href="/dashboard" aria-label="Periscan — Dashboard">
          <Brandmark size={22} />
        </Link>
        {personaLabel ? (
          <Link
            href="/welcome?customize=1"
            className="mt-1 inline-flex font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-success hover:text-brand"
          >
            View · {personaLabel}
          </Link>
        ) : null}
      </div>

      {/* Primary action — the one thing a new user should do next. */}
      <div className="px-3 pb-2 pt-4">
        <Link
          href={primaryAction.href}
          data-testid="rail-primary-cta"
          onClick={() => {
            // UX-W16: remember incomplete first-run CTAs for Home resume.
            if (primaryAction.setupIncomplete) {
              writeFirstProofResume(primaryAction.label, primaryAction.href);
            }
          }}
          className="flex items-center justify-center gap-2 rounded-control border border-brand-fill bg-brand-fill px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand hover:border-brand"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
          >
            <path
              d="M8 3v10M3 8h10"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
          {translateUiText(locale, primaryAction.label)}
        </Link>
        {primaryAction.reason && primaryAction.setupIncomplete ? (
          <p
            className="mt-1.5 px-0.5 text-[10px] leading-snug text-subtle"
            data-testid="rail-primary-reason"
          >
            {translateUiText(locale, primaryAction.reason)}
          </p>
        ) : null}
        {guidedNavigation ? (
          <button
            type="button"
            aria-pressed={showAllNavigation}
            onClick={() => {
              const next = !showAllNavigation;
              setShowAllNavigation(next);
              try {
                localStorage.setItem(NAV_SCOPE_KEY, next ? "all" : "guided");
              } catch {
                // ignore unwritable storage
              }
            }}
            className="mt-2 flex w-full items-center justify-between rounded-control border border-line px-2.5 py-1.5 text-left font-mono text-[9.5px] uppercase tracking-[0.1em] text-subtle transition-colors hover:border-brand hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <span>
              {showAllNavigation
                ? "Return to daily rail"
                : "Show Labs & more"}
            </span>
            <span className="text-success">{maturity ?? "—"}</span>
          </button>
        ) : null}
      </div>

      <nav
        aria-label="Primary"
        className="flex-1 px-2 pb-4"
        data-nav-layout={layout}
      >
        {(() => {
          const renderGroup = (
            group: (typeof visibleNav)[number],
            options?: { forceExpanded?: boolean }
          ) => {
            const hasActive = group.items.some((item) =>
              isNavItemActive(pathname, item.href)
            );
            const expanded =
              options?.forceExpanded || open[group.label] || hasActive;
            return (
              <div
                key={group.label}
                className="mb-1.5"
                // UX-W1 #200: progressive Proof OS spine marker on Operate only.
                {...(group.label === "Operate"
                  ? { "data-proof-os-spine": "true" }
                  : {})}
              >
                <button
                  type="button"
                  onClick={() => toggle(group.label)}
                  aria-expanded={expanded}
                  className="flex w-full items-center gap-1.5 rounded-control border-0 px-2 py-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.18em] text-subtle transition-colors hover:text-brand-2"
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden
                    className={cn(
                      "transition-transform",
                      expanded ? "rotate-90" : "rotate-0"
                    )}
                  >
                    <path
                      d="m6 4 4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {translateUiText(locale, group.label)}
                </button>
                {expanded ? (
                  <ul className="flex list-none flex-col gap-0.5 pb-1">
                    {group.items.map((item) => {
                      const active = isNavItemActive(pathname, item.href);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "flex items-center gap-2.5 rounded-control border-l-2 px-2 py-1.5 text-[13px] transition-colors",
                              active
                                ? "border-brand bg-brand/10 font-semibold text-ink"
                                : "border-transparent text-muted hover:bg-brand/6 hover:text-ink"
                            )}
                          >
                            <svg
                              width="15"
                              height="15"
                              viewBox="0 0 16 16"
                              fill="none"
                              aria-hidden
                              className={active ? "text-brand" : "text-subtle"}
                            >
                              {item.icon}
                            </svg>
                            {translateUiText(locale, item.label)}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            );
          };

          // Desktop: existing sectioned rail.
          if (layout !== "mobile") {
            return visibleNav.map((group) => renderGroup(group));
          }

          // Mobile Operate-first (#21): Operate spine first and open; Setup /
          // Labs / Admin collapse behind a single "More" disclosure.
          const operateGroups = visibleNav.filter((g) => g.label === "Operate");
          const moreGroups = visibleNav.filter((g) => g.label !== "Operate");
          const moreHasActive = moreGroups.some((g) =>
            g.items.some((item) => isNavItemActive(pathname, item.href))
          );
          const moreExpanded = mobileMoreOpen || moreHasActive;

          return (
            <>
              {operateGroups.map((group) =>
                renderGroup(group, { forceExpanded: true })
              )}
              {moreGroups.length > 0 ? (
                <div className="mb-1.5" data-testid="mobile-nav-more">
                  <button
                    type="button"
                    onClick={() => setMobileMoreOpen((v) => !v)}
                    aria-expanded={moreExpanded}
                    className="flex w-full items-center gap-1.5 rounded-control border-0 px-2 py-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.18em] text-subtle transition-colors hover:text-brand-2"
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden
                      className={cn(
                        "transition-transform",
                        moreExpanded ? "rotate-90" : "rotate-0"
                      )}
                    >
                      <path
                        d="m6 4 4 4-4 4"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    More
                  </button>
                  {moreExpanded
                    ? moreGroups.map((group) => renderGroup(group))
                    : null}
                </div>
              ) : null}
            </>
          );
        })()}
      </nav>
      {/* P02-18 / UX-W2 #55: rail proof map after first-run. Maturity New prefers
          GetStarted hero map only (avoid dual proof-loop metaphors). */}
      {maturity && maturity !== "New" ? (
        <ProofLoopMap
          activation={activation.data}
          loading={activation.loading}
          variant="rail"
        />
      ) : null}
      <div
        data-testid="rail-tagline"
        className="min-w-0 shrink-0 border-t border-line px-[22px] py-[14px] font-mono text-[9.5px] leading-snug text-subtle"
      >
        <p className="flex min-w-0 flex-col whitespace-normal break-words text-success">
          <span>The Hacker</span>
          <span>On Your Side</span>
        </p>
        <p className="mt-0.5 min-w-0 whitespace-normal break-words">
          Prove your defenses work.
        </p>
      </div>
    </div>
  );
}

function CommandBar({
  onOpenNav,
  mobileNavOpen,
  mobileNavId,
  onOpenPalette,
  paletteOpen,
  onOpenHelp,
  helpOpen,
  socDark,
  onToggleSocDark,
  density,
  onToggleDensity
}: {
  onOpenNav: () => void;
  mobileNavOpen: boolean;
  mobileNavId: string;
  onOpenPalette: () => void;
  paletteOpen: boolean;
  onOpenHelp: () => void;
  helpOpen: boolean;
  socDark: boolean;
  onToggleSocDark: () => void;
  density: ShellDensity;
  onToggleDensity: () => void;
}) {
  const locale = useProductLocale();
  const router = useRouter();
  const { working, leave: leaveWorkingTenant } = useWorkingTenant();
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  // One-shot "Working as {name}" after Open client (P05) — consume once.
  const [enterToast, setEnterToast] = useState<string | null>(null);
  // Refetch session when working tenant changes so chrome matches API context.
  const session = useApiResource(
    () => browserPeriscanApiClient.getMe(),
    [working?.tenantId ?? ""]
  );
  const health = useApiResource(() => browserPeriscanApiClient.getHealth(), []);

  useEffect(() => {
    if (!working) {
      setEnterToast(null);
      return;
    }
    const name = consumeWorkingTenantEnterToast();
    if (name) {
      setEnterToast(name);
      const timer = window.setTimeout(() => setEnterToast(null), 6000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [working?.tenantId, working?.name]);

  const tenantName = working?.name ?? session.data?.tenant?.name;
  const user = session.data?.user;
  const healthy = !health.error && health.data?.status === "ok";
  const densityLabel =
    density === "compact" ? "Compact density" : "Comfortable density";

  // Shared focus ring for command-bar controls (palette, help, density, soc).
  const commandBarFocus =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-[#080c18]";

  function requestLeaveClientWorkspace() {
    setLeaveConfirmOpen(true);
  }

  function confirmLeaveClientWorkspace() {
    setLeaveConfirmOpen(false);
    leaveWorkingTenant();
    router.push("/mssp");
  }

  return (
    <header className="sticky top-0 z-30 flex min-w-0 items-center gap-2 border-b border-[#14224a] bg-[#080c18] px-3 py-2.5 sm:gap-3 sm:px-4">
      <button
        type="button"
        onClick={onOpenNav}
        aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={mobileNavOpen}
        aria-controls={mobileNavId}
        className={cn(
          "min-h-11 min-w-11 rounded-control border border-line p-1.5 text-muted transition-colors hover:border-brand hover:text-ink md:hidden",
          commandBarFocus
        )}
      >
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M2 4h12M2 8h12M2 12h12"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <TenantSwitcher
        name={tenantName}
        loading={session.loading}
        error={!!session.error}
        workingAs={working}
        onLeaveClient={requestLeaveClientWorkspace}
      />
      {enterToast ? (
        <p
          role="status"
          aria-live="polite"
          data-testid="working-as-enter-toast"
          className="max-w-[12rem] truncate rounded-control border border-fixed/40 bg-fixed/15 px-2.5 py-1.5 text-xs font-semibold text-fixed sm:max-w-[16rem]"
        >
          Working as {enterToast}
        </p>
      ) : null}
      <ConfirmDialog
        open={leaveConfirmOpen}
        title="Leave client workspace?"
        description={
          working
            ? `Stop working as ${working.name} and return to the MSSP portfolio. Mutations already made in this client stay in that tenant; you will no longer send API calls under its context.`
            : "Return to the MSSP portfolio and clear the working tenant context."
        }
        confirmLabel="Leave client"
        onConfirm={confirmLeaveClientWorkspace}
        onCancel={() => setLeaveConfirmOpen(false)}
      />

      <button
        type="button"
        onClick={onOpenPalette}
        aria-label="Open command palette"
        aria-haspopup="dialog"
        aria-expanded={paletteOpen}
        data-testid="command-bar-palette"
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded-control border border-[#23386b] bg-[#080d1c] px-3 py-1.5 text-left text-sm text-ink transition-colors hover:border-brand md:max-w-sm",
          commandBarFocus
        )}
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle
            cx="7"
            cy="7"
            r="4.5"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path
            d="m10.5 10.5 3 3"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
        <span className="truncate">
          {translateUiText(locale, "Jump to a page…")}
        </span>
        <kbd className="ml-auto hidden rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-muted sm:block">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-3">
        <ClaimGuardHud className="hidden sm:inline-flex" />
        <button
          type="button"
          data-testid="soc-dark-toggle"
          aria-pressed={socDark}
          aria-label={
            socDark ? "Disable SOC dark cockpit" : "Enable SOC dark cockpit"
          }
          title="SOC dark cockpit — reduce background bloom"
          onClick={onToggleSocDark}
          className={cn(
            "hidden rounded-control border px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide transition-colors md:inline-flex",
            commandBarFocus,
            socDark
              ? "border-brand/50 bg-brand/10 text-brand"
              : "border-line text-muted hover:border-line-strong hover:text-ink"
          )}
        >
          SOC
        </button>
        {/* UX-W9: density toggle near SOC dark in command chrome. */}
        <button
          type="button"
          onClick={onToggleDensity}
          aria-label={`Toggle layout density (currently ${density})`}
          aria-pressed={density === "compact"}
          title={densityLabel}
          data-testid="density-toggle"
          className={cn(
            "flex items-center gap-1.5 rounded-control border border-[#23386b] bg-[#080d1c] px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-brand hover:text-ink",
            commandBarFocus
          )}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
          >
            {density === "compact" ? (
              <>
                <path
                  d="M3 4h10M3 7h10M3 10h10M3 13h10"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </>
            ) : (
              <>
                <path
                  d="M3 5h10M3 8.5h10M3 12h10"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </>
            )}
          </svg>
          <span className="hidden sm:inline">
            {density === "compact" ? "Compact" : "Comfortable"}
          </span>
        </button>
        <button
          type="button"
          onClick={onOpenHelp}
          aria-label="Open product help"
          aria-haspopup="dialog"
          aria-expanded={helpOpen}
          data-testid="command-bar-help"
          className={cn(
            "flex items-center gap-1.5 rounded-control border border-[#23386b] bg-[#080d1c] px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-brand hover:text-ink",
            commandBarFocus
          )}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
          >
            <circle
              cx="8"
              cy="8"
              r="6"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <path
              d="M6.4 6.1a1.7 1.7 0 0 1 3.3.5c0 1.4-1.7 1.5-1.7 2.6M8 11.7v.05"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          <span className="hidden sm:inline">Help</span>
        </button>
        <span
          className="hidden items-center gap-1.5 font-mono text-[11px] text-muted sm:flex"
          title={
            health.error
              ? "API unreachable"
              : `Status: ${health.data?.status ?? "…"}`
          }
        >
          <span
            className={cn(
              "size-2 rounded-full ring-2",
              health.loading
                ? "bg-inconclusive ring-inconclusive/25"
                : healthy
                  ? "bg-fixed ring-fixed/25"
                  : "bg-missed ring-missed/25"
            )}
          />
          {health.loading
            ? "checking"
            : healthy
              ? "systems nominal"
              : "degraded"}
        </span>
        <UserMenu
          name={user?.name}
          email={user?.email}
          unauthenticated={!!session.error}
        />
      </div>
    </header>
  );
}

/**
 * Workspace label + optional MSSP working-tenant chrome (ICP-P0-1).
 * Switching is explicit from /mssp “Open client”, not a free-form dropdown —
 * non-MSSP sessions cannot invent tenants. Leave returns to the parent
 * portfolio without bulk cross-tenant mutations.
 */
function TenantSwitcher({
  name,
  loading,
  error,
  workingAs,
  onLeaveClient
}: {
  name?: string;
  loading: boolean;
  error: boolean;
  workingAs?: { name: string; homeTenantName?: string } | null;
  onLeaveClient?: () => void;
}) {
  if (error) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-2 rounded-control border border-line px-2.5 py-1.5 text-sm text-muted hover:text-ink"
      >
        Sign in
      </Link>
    );
  }
  const label = loading ? "…" : (name ?? "Periscan");
  if (workingAs) {
    // P05: Working-as chrome stays visible on mobile whenever a client context
    // is set — operators must always see which tenant they are mutating.
    return (
      <div
        className="flex max-w-[min(100%,20rem)] shrink-0 items-center gap-2 rounded-control border border-brand/50 bg-brand/10 px-2.5 py-1.5 text-sm text-ink"
        title={`Working as client tenant: ${workingAs.name}`}
        aria-label={`Working as: ${workingAs.name}`}
        data-testid="working-tenant-chrome"
      >
        <span aria-hidden className="size-4 shrink-0 rounded bg-brand" />
        <div className="min-w-0 leading-tight">
          <p className="truncate font-mono text-[10px] uppercase tracking-wide text-brand">
            Working as
          </p>
          <p className="truncate text-sm font-semibold">{workingAs.name}</p>
        </div>
        <button
          type="button"
          onClick={onLeaveClient}
          data-testid="leave-working-tenant"
          className="ml-1 shrink-0 rounded-control border border-line px-2 py-1 text-[11px] font-semibold text-muted transition-colors hover:border-brand hover:text-ink"
          title={
            workingAs.homeTenantName
              ? `Return to ${workingAs.homeTenantName}`
              : "Return to MSSP portfolio"
          }
        >
          Leave
        </button>
      </div>
    );
  }
  return (
    <div
      className="hidden shrink-0 items-center gap-2 rounded-control border border-line px-2.5 py-1.5 text-sm text-ink sm:flex"
      title={loading ? "Loading workspace" : `Workspace: ${label}`}
      aria-label={loading ? "Workspace loading" : `Current workspace: ${label}`}
    >
      <span aria-hidden className="size-4 rounded bg-brand" />
      <span className="max-w-[9rem] truncate">{label}</span>
    </div>
  );
}

function UserMenu({
  name,
  email,
  unauthenticated
}: {
  name?: string;
  email?: string;
  unauthenticated: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  if (unauthenticated) {
    return null;
  }

  async function signOut() {
    try {
      await browserPeriscanApiClient.logout();
    } catch {
      // Best-effort — clear UI regardless.
    }
    setOpen(false);
    router.push("/login");
  }

  const initial = (name ?? email ?? "?").trim().charAt(0).toUpperCase();

  // Disclosure/popover pattern with normal tab order + Escape (not ARIA menu).
  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="true"
        aria-label="Account menu"
        className="grid size-7 place-items-center rounded-full bg-blocked text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        {initial}
      </button>
      {open ? (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            id={panelId}
            ref={panelRef}
            className="absolute right-0 top-9 z-20 w-56 overflow-hidden rounded-card border border-line-strong bg-elevated py-1 shadow-xl"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setOpen(false);
                triggerRef.current?.focus();
              }
            }}
          >
            <div className="border-b border-line px-3 py-2">
              <p className="truncate text-sm font-semibold text-ink">
                {name ?? "Signed in"}
              </p>
              {email ? (
                <p className="truncate text-xs text-subtle">{email}</p>
              ) : null}
            </div>
            <Link
              href="/dashboard"
              className="block px-3 py-2 text-sm text-muted hover:bg-surface hover:text-ink focus-visible:bg-surface focus-visible:text-ink focus-visible:outline-none"
              onClick={() => setOpen(false)}
            >
              Getting started
            </Link>
            <Link
              href="/account-security"
              className="block px-3 py-2 text-sm text-muted hover:bg-surface hover:text-ink focus-visible:bg-surface focus-visible:text-ink focus-visible:outline-none"
              onClick={() => setOpen(false)}
            >
              Account security
            </Link>
            <Link
              href="/trust-safety"
              className="block px-3 py-2 text-sm text-muted hover:bg-surface hover:text-ink focus-visible:bg-surface focus-visible:text-ink focus-visible:outline-none"
              onClick={() => setOpen(false)}
            >
              Trust &amp; safety
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="block w-full px-3 py-2 text-left text-sm text-missed hover:bg-surface focus-visible:bg-surface focus-visible:outline-none"
            >
              Sign out
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { useRouter } from "next/navigation";
import type {
  GlobalSearchResult,
  GlobalSearchResultType
} from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { useFocusTrap } from "../hooks/use-focus-trap";
import {
  LABS_DESTINATION_HREFS,
  LABS_DESTINATIONS
} from "../lib/labs-portal";
import {
  PRIMARY_NAV,
  paletteGroupWeight,
  type PrimaryNavItem
} from "../lib/primary-nav";
import { cn } from "../ui/cn";
import { translateUiText } from "../lib/localization";
import { useProductLocale } from "./product-localization";

/**
 * Jump-to-page command palette (⌘K / Ctrl-K) with live cross-entity search.
 * Combobox pattern: role=combobox + aria-controls listbox + aria-activedescendant.
 * Focus trap + restore; Escape closes; decorative icons aria-hidden.
 *
 * P02-8 / UX-W10: default page jumps exclude Labs portal destinations (and the
 * Labs door) unless the operator opted into "Show Labs & more". Deep Labs
 * routes come from LABS_DESTINATIONS (portal list), not PRIMARY_NAV peers —
 * the rail only exposes Labs → /labs.
 *
 * UX-W2 (19–20): weight/group results Operate → Setup → Admin → Labs last.
 */

/** Same storage key as app-shell guided / Labs escape hatch. */
const NAV_SCOPE_KEY = "periscan.nav.scope";

/** Portal door + every LABS_DESTINATIONS href — gated until showLabs. */
const LABS_HREFS = new Set<string>(["/labs", ...LABS_DESTINATION_HREFS]);

function hrefForEntity(type: GlobalSearchResultType, id: string): string {
  switch (type) {
    case "AttackPath":
      return `/attack-paths/${id}`;
    case "Remediation":
      return `/remediation/${id}`;
    case "AIApplication":
      return "/ai-apps";
    case "EvidencePack":
      return "/evidence";
    case "Asset":
      return "/findings";
    case "Scope":
      // P07-2: authorize home is /scopes, not Validate (/missions).
      return `/scopes?scopeId=${encodeURIComponent(id)}`;
    default:
      return "/dashboard";
  }
}

type PaletteItem = {
  key: string;
  href: string;
  label: string;
  hint?: string;
  kind: "nav" | "entity";
  group?: string;
  icon?: ReactNode;
};

/**
 * Build weighted palette page jumps from PRIMARY_NAV groups.
 * Operate first, Setup, Admin, Labs last (when showLabs). Pure for unit tests.
 *
 * UX-W10: when showLabs, also index LABS_DESTINATIONS so /workflows etc remain
 * jumpable without PRIMARY_NAV Labs peers.
 */
export function buildWeightedPaletteNavItems(options: {
  showLabs: boolean;
  query: string;
  localize?: (label: string) => string;
}): Array<PrimaryNavItem & { group: string; localizedLabel: string }> {
  const q = options.query.trim().toLowerCase();
  const localize = options.localize ?? ((label: string) => label);
  const groups = [...PRIMARY_NAV]
    .filter((group) => options.showLabs || group.label !== "Labs")
    .sort(
      (a, b) => paletteGroupWeight(a.label) - paletteGroupWeight(b.label)
    );

  const out: Array<PrimaryNavItem & { group: string; localizedLabel: string }> =
    [];
  for (const group of groups) {
    for (const item of group.items) {
      if (!options.showLabs && LABS_HREFS.has(item.href)) continue;
      const localizedLabel = localize(item.label);
      if (
        q &&
        !item.label.toLowerCase().includes(q) &&
        !localizedLabel.toLowerCase().includes(q) &&
        !item.hint?.toLowerCase().includes(q) &&
        !item.href.toLowerCase().includes(q)
      ) {
        continue;
      }
      out.push({ ...item, group: group.label, localizedLabel });
    }
  }

  // UX-W10: portal destinations as Labs-group palette rows (not rail peers).
  if (options.showLabs) {
    const seen = new Set(out.map((item) => item.href));
    for (const dest of LABS_DESTINATIONS) {
      if (seen.has(dest.href)) continue;
      const localizedLabel = localize(dest.label);
      if (
        q &&
        !dest.label.toLowerCase().includes(q) &&
        !localizedLabel.toLowerCase().includes(q) &&
        !dest.hint.toLowerCase().includes(q) &&
        !dest.href.toLowerCase().includes(q)
      ) {
        continue;
      }
      out.push({
        href: dest.href,
        label: dest.label,
        hint: dest.hint,
        icon: undefined,
        group: "Labs",
        localizedLabel
      });
      seen.add(dest.href);
    }
  }

  return out;
}

export function CommandPalette({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const locale = useProductLocale();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [entities, setEntities] = useState<GlobalSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showLabs, setShowLabs] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const requestSeq = useRef(0);
  const listboxId = useId();
  const optionIdPrefix = useId();

  useEffect(() => {
    if (!open) return;
    try {
      setShowLabs(localStorage.getItem(NAV_SCOPE_KEY) === "all");
    } catch {
      setShowLabs(false);
    }
  }, [open]);

  const navItems: PaletteItem[] = useMemo(() => {
    // Guided default: hide Labs destinations until Show Labs & more (P02-8).
    // UX-W2: weight Operate → Setup → Admin → Labs (last when revealed).
    const catalog = buildWeightedPaletteNavItems({
      showLabs,
      query,
      localize: (label) => translateUiText(locale, label)
    });
    return catalog.map((item) => ({
      href: item.href,
      hint: item.hint,
      icon: item.icon,
      group: item.group,
      key: `nav:${item.href}`,
      kind: "nav" as const,
      label: item.localizedLabel
    }));
  }, [locale, query, showLabs]);

  const entityItems: PaletteItem[] = useMemo(
    () =>
      entities.map((result) => ({
        href: hrefForEntity(result.type, result.id),
        hint: result.sublabel ?? undefined,
        key: `entity:${result.type}:${result.id}`,
        kind: "entity" as const,
        label: result.label
      })),
    [entities]
  );

  const results = useMemo(
    () => [...navItems, ...entityItems],
    [navItems, entityItems]
  );

  useFocusTrap({
    open,
    containerRef: dialogRef,
    onEscape: onClose,
    initialFocusRef: inputRef,
    restoreFocus: true
  });

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setEntities([]);
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    if (results.length === 0) {
      setActive(0);
      return;
    }
    if (active > results.length - 1) {
      setActive(results.length - 1);
    }
  }, [active, results.length]);

  // Debounced live entity search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setEntities([]);
      setSearching(false);
      return undefined;
    }
    const seq = ++requestSeq.current;
    setSearching(true);
    const timer = setTimeout(() => {
      api
        .globalSearch(q)
        .then((response) => {
          if (seq === requestSeq.current) {
            setEntities(response.results);
          }
        })
        .catch(() => {
          if (seq === requestSeq.current) {
            setEntities([]);
          }
        })
        .finally(() => {
          if (seq === requestSeq.current) {
            setSearching(false);
          }
        });
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  if (!open) return null;

  function go(index: number) {
    const item = results[index];
    if (!item) return;
    onClose();
    router.push(item.href);
  }

  const navCount = navItems.length;
  const activeOptionId =
    results.length > 0 ? `${optionIdPrefix}-option-${active}` : undefined;

  // Single trap root on the full-screen overlay (P16-1 inert siblings + P16-4 dual-ref).
  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-card border border-line-strong bg-elevated shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className="text-subtle"
          >
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
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                if (results.length === 0) return;
                setActive((i) => Math.min(i + 1, results.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (event.key === "Home") {
                event.preventDefault();
                setActive(0);
              } else if (event.key === "End") {
                event.preventDefault();
                if (results.length > 0) setActive(results.length - 1);
              } else if (event.key === "Enter") {
                event.preventDefault();
                go(active);
              } else if (event.key === "Escape") {
                event.preventDefault();
                onClose();
              }
            }}
            placeholder="Jump to a page or search your data…"
            aria-label="Search pages and data"
            role="combobox"
            aria-expanded="true"
            aria-controls={listboxId}
            aria-activedescendant={activeOptionId}
            aria-autocomplete="list"
            autoComplete="off"
            className="w-full bg-transparent py-3.5 text-sm text-ink outline-none placeholder:text-subtle"
          />
          {/* P16-16: live region for search status + result counts */}
          <span
            className="sr-only"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {searching
              ? "Searching…"
              : query.trim().length >= 2
                ? `${results.length} result${results.length === 1 ? "" : "s"}`
                : ""}
          </span>
          {searching ? (
            <span
              className="text-[10px] font-medium uppercase tracking-wide text-subtle"
              aria-hidden
            >
              searching…
            </span>
          ) : null}
          <kbd
            className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-subtle"
            title="Press Escape to close"
          >
            esc
          </kbd>
        </div>
        <ul
          id={listboxId}
          className="max-h-96 overflow-y-auto py-1"
          role="listbox"
          aria-label="Command results"
        >
          {results.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-subtle" role="presentation">
              {query.trim().length >= 2 && !searching
                ? "No matching page or record."
                : "No matching page."}
            </li>
          ) : (
            results.map((item, index) => {
              const prev = index > 0 ? results[index - 1] : null;
              const showGroupHeader =
                item.kind === "nav" &&
                item.group &&
                (!prev || prev.kind !== "nav" || prev.group !== item.group);
              return (
              <div key={item.key} role="presentation">
                {showGroupHeader ? (
                  <p
                    className={cn(
                      "px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle",
                      index > 0 && "border-t border-line"
                    )}
                    role="presentation"
                    data-testid={`palette-group-${item.group}`}
                  >
                    {item.group}
                  </p>
                ) : null}
                {item.kind === "entity" && index === navCount ? (
                  <p
                    className="border-t border-line px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle"
                    role="presentation"
                  >
                    In your data
                  </p>
                ) : null}
                <li
                  id={`${optionIdPrefix}-option-${index}`}
                  role="option"
                  aria-selected={index === active}
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => go(index)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm",
                      index === active ? "bg-brand/12 text-ink" : "text-muted"
                    )}
                  >
                    {item.kind === "nav" && item.icon ? (
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 16 16"
                        fill="none"
                        aria-hidden="true"
                        className={
                          index === active ? "text-brand" : "text-subtle"
                        }
                      >
                        {item.icon}
                      </svg>
                    ) : (
                      <span
                        aria-hidden="true"
                        className={cn(
                          "inline-block h-1.5 w-1.5 rounded-full",
                          index === active ? "bg-brand" : "bg-subtle"
                        )}
                      />
                    )}
                    <span className="truncate font-medium">{item.label}</span>
                    {item.hint ? (
                      <span className="ml-auto truncate pl-3 text-xs text-subtle">
                        {item.hint}
                      </span>
                    ) : null}
                  </button>
                </li>
              </div>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}

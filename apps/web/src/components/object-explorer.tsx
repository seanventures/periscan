"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  OBJECT_EXPLORER_TYPES,
  entityHref,
  objectExplorerHref
} from "../lib/entity-routes";
import {
  NotConfigured,
  PageHeader,
  PageShell,
  Panel,
  PanelHeader,
  StateBadge,
  buttonClassName
} from "../ui";

/**
 * Object Explorer light (P11-7): type catalog + instance deep-link shell.
 * Not a full Foundry-style graph neighborhood (P11-13); routes operators to
 * real workspaces via the shared entityHref map.
 */
export function ObjectExplorerCatalog() {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return OBJECT_EXPLORER_TYPES;
    return OBJECT_EXPLORER_TYPES.filter(
      (entry) =>
        entry.type.toLowerCase().includes(q) ||
        entry.label.toLowerCase().includes(q) ||
        entry.description.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Explore / Objects"
        title="Object explorer"
        description="Navigate by product object type. Deep-links go to real workspaces (findings, paths, assets, evidence). Full graph neighborhood exploration is not shipped."
      />
      <Panel>
        <PanelHeader
          title="Object types"
          actions={
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#cfe0ff]">
              {filtered.length} types
            </span>
          }
        />
        <div className="border-b border-line px-5 py-3">
          <label className="sr-only" htmlFor="object-explorer-search">
            Search object types
          </label>
          <input
            id="object-explorer-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search types…"
            className="w-full rounded-control border border-line bg-elevated px-3 py-2 text-sm text-ink placeholder:text-subtle"
          />
        </div>
        {filtered.length === 0 ? (
          <div className="p-5 text-sm text-muted">No object types match.</div>
        ) : (
          <ul className="divide-y divide-line">
            {filtered.map((entry) => (
              <li
                key={entry.type}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{entry.label}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-subtle">
                    {entry.type}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    {entry.description}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={entry.homeHref}
                    className={buttonClassName({ variant: "primary", size: "sm" })}
                  >
                    Open workspace
                  </Link>
                  <Link
                    href={`/objects/${encodeURIComponent(entry.type)}`}
                    className={buttonClassName({ variant: "ghost", size: "sm" })}
                  >
                    Type shell
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </PageShell>
  );
}

export function ObjectExplorerTypeShell({ type }: { type: string }) {
  const entry = OBJECT_EXPLORER_TYPES.find(
    (item) => item.type.toLowerCase() === type.toLowerCase()
  );
  const home = entry?.homeHref ?? entityHref(type, null);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Explore / Objects"
        title={entry?.label ?? type}
        description={
          entry?.description ??
          "No dedicated object catalog entry. Deep-links only when a real workspace exists."
        }
        actions={
          <Link
            href="/objects"
            className={buttonClassName({ variant: "ghost", size: "sm" })}
          >
            All types
          </Link>
        }
      />
      <Panel>
        <div className="space-y-4 p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-subtle">
            RelatedEntityType · {type}
          </p>
          {home ? (
            <Link
              href={home}
              className={buttonClassName({ variant: "primary", size: "sm" })}
            >
              Open {entry?.label ?? type} workspace
            </Link>
          ) : (
            <NotConfigured
              title="No object workspace"
              message={`There is no honest product page for type “${type}”. Scope and some graph-only types stay unmapped rather than deep-linking into the wrong cage.`}
              action={{ href: "/objects", label: "Back to catalog" }}
            />
          )}
          <p className="text-xs leading-5 text-muted">
            Paste an instance id on{" "}
            <code className="font-mono text-[11px]">
              /objects/{type}/&lt;id&gt;
            </code>{" "}
            to resolve a deep-link when one exists.
          </p>
        </div>
      </Panel>
    </PageShell>
  );
}

export function ObjectExplorerInstanceShell({
  type,
  id
}: {
  type: string;
  id: string;
}) {
  const deep = entityHref(type, id);
  const entry = OBJECT_EXPLORER_TYPES.find(
    (item) => item.type.toLowerCase() === type.toLowerCase()
  );

  return (
    <PageShell>
      <PageHeader
        eyebrow="Explore / Objects"
        title={entry?.label ?? type}
        description="Instance shell — prefer a real workspace deep-link over a synthetic graph page."
        actions={
          <Link
            href="/objects"
            className={buttonClassName({ variant: "ghost", size: "sm" })}
          >
            All types
          </Link>
        }
      />
      <Panel>
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <StateBadge tone="neutral">{type}</StateBadge>
            <span className="font-mono text-xs text-muted break-all">{id}</span>
          </div>
          {deep ? (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                A real workspace route is registered for this type.
              </p>
              <Link
                href={deep}
                className={buttonClassName({ variant: "primary", size: "sm" })}
              >
                Open workspace
              </Link>
              <p className="text-xs text-muted">
                Target:{" "}
                <code className="font-mono text-[11px] break-all">{deep}</code>
              </p>
            </div>
          ) : (
            <NotConfigured
              title="No deep-link for this object"
              message={`Type “${type}” has no operator page. Use evidence search or the type catalog instead of inventing a route.`}
              action={{
                href: `/evidence?q=${encodeURIComponent(id)}`,
                label: "Search evidence by id"
              }}
            />
          )}
          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <Link
              href={`/evidence?q=${encodeURIComponent(id)}`}
              className={buttonClassName({ variant: "ghost", size: "sm" })}
            >
              Related evidence
            </Link>
            <Link
              href={objectExplorerHref(type)}
              className={buttonClassName({ variant: "ghost", size: "sm" })}
            >
              Type home
            </Link>
          </div>
        </div>
      </Panel>
    </PageShell>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type {
  TenantThreatAlert,
  ThreatFeedStatus,
  ThreatIntelItem
} from "@periscan/shared";

import {
  browserPeriscanApiClient,
  PeriscanApiClientError
} from "../lib/periscan-api-client";
import {
  Badge,
  Button,
  Card,
  cn,
  InlineError,
  LiveUpdatePill,
  StateBadge,
  severityTone,
  type BadgeTone
} from "../ui";
import { StatusPanel } from "./status-panel";

interface ThreatFeedState {
  alerts: TenantThreatAlert[];
  catalog: ThreatIntelItem[];
  feeds: ThreatFeedStatus[];
}

type LoadStatus = "authenticated" | "error" | "loading" | "unauthenticated";

const EMPTY_STATE: ThreatFeedState = { alerts: [], catalog: [], feeds: [] };
const CATALOG_PAGE_SIZE = 25;
const THREAT_KINDS = ["Vulnerability", "Indicator", "Advisory"] as const;
const THREAT_SEVERITIES = [
  "Critical",
  "High",
  "Medium",
  "Low",
  "None",
  "Unknown"
] as const;

function feedTone(status: string | null): BadgeTone {
  if (!status) {
    return "neutral";
  }
  if (status.startsWith("ok")) {
    return "success";
  }
  if (status === "skipped_no_key") {
    return "warning";
  }
  if (status === "error") {
    return "danger";
  }
  return "neutral";
}

async function loadThreatFeedState(): Promise<ThreatFeedState> {
  const [feeds, catalog, alerts] = await Promise.all([
    browserPeriscanApiClient.getThreatFeedStatus(),
    browserPeriscanApiClient.listThreatCatalog({ limit: 200 }),
    browserPeriscanApiClient.listThreatAlerts()
  ]);
  return { alerts, catalog, feeds };
}

export function ThreatFeedWorkbench() {
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [state, setState] = useState<ThreatFeedState>(EMPTY_STATE);
  const [pendingAlertId, setPendingAlertId] = useState<string | null>(null);
  const [alertErrors, setAlertErrors] = useState<Record<string, string>>({});
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogKind, setCatalogKind] = useState("all");
  const [catalogSeverity, setCatalogSeverity] = useState("all");
  const [catalogKevOnly, setCatalogKevOnly] = useState(false);
  const [catalogPage, setCatalogPage] = useState(0);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await browserPeriscanApiClient.getMe();
        const next = await loadThreatFeedState();
        if (active) {
          setState(next);
          setStatus("authenticated");
          setLastUpdatedAt(new Date().toISOString());
        }
      } catch (error) {
        if (!active) {
          return;
        }
        if (error instanceof PeriscanApiClientError && error.status === 401) {
          setStatus("unauthenticated");
        } else {
          setStatus("error");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    let inFlight = false;
    const refreshWhenVisible = async () => {
      if (!active || inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      setRefreshing(true);
      try {
        const next = await loadThreatFeedState();
        if (active) {
          setState(next);
          setLastUpdatedAt(new Date().toISOString());
          setRefreshError(null);
        }
      } catch (error) {
        if (active) {
          setRefreshError(
            error instanceof Error
              ? error.message
              : "Unable to refresh threat intelligence."
          );
        }
      } finally {
        if (active) setRefreshing(false);
        inFlight = false;
      }
    };
    const interval = window.setInterval(() => {
      void refreshWhenVisible();
    }, 60_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshWhenVisible();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [status]);

  async function refreshAlerts() {
    const alerts = await browserPeriscanApiClient.listThreatAlerts();
    setState((current) => ({ ...current, alerts }));
    setLastUpdatedAt(new Date().toISOString());
  }

  function dismissAlertError(alertId: string) {
    setAlertErrors((current) => {
      const next = { ...current };
      delete next[alertId];
      return next;
    });
  }

  async function actOnAlert(
    alertId: string,
    nextStatus: "Acknowledged" | "Dismissed" | "New"
  ) {
    // Guard against double-click races while a mutation is in flight.
    if (pendingAlertId) {
      return;
    }
    setPendingAlertId(alertId);
    dismissAlertError(alertId);
    try {
      await browserPeriscanApiClient.setThreatAlertStatus(alertId, nextStatus);
      // Refetch ONLY on success so a failure never silently self-corrects.
      await refreshAlerts();
    } catch (error) {
      const message =
        error instanceof PeriscanApiClientError
          ? error.message
          : "Could not update this alert. Please try again.";
      setAlertErrors((current) => ({ ...current, [alertId]: message }));
    } finally {
      setPendingAlertId(null);
    }
  }

  const openAlerts = state.alerts.filter((alert) => alert.status === "New");
  const filteredCatalog = useMemo(() => {
    const query = catalogQuery.trim().toLowerCase();
    return state.catalog.filter(
      (item) =>
        (catalogKind === "all" || item.kind === catalogKind) &&
        (catalogSeverity === "all" || item.severity === catalogSeverity) &&
        (!catalogKevOnly || item.kev) &&
        (!query ||
          item.title.toLowerCase().includes(query) ||
          item.summary.toLowerCase().includes(query) ||
          item.cveIds.some((cve) => cve.toLowerCase().includes(query)) ||
          item.tags.some((tag) => tag.toLowerCase().includes(query)))
    );
  }, [
    catalogKevOnly,
    catalogKind,
    catalogQuery,
    catalogSeverity,
    state.catalog
  ]);
  const catalogPageCount = Math.max(
    1,
    Math.ceil(filteredCatalog.length / CATALOG_PAGE_SIZE)
  );
  const visibleCatalog = filteredCatalog.slice(
    catalogPage * CATALOG_PAGE_SIZE,
    (catalogPage + 1) * CATALOG_PAGE_SIZE
  );

  useEffect(() => {
    setCatalogPage(0);
  }, [catalogKevOnly, catalogKind, catalogQuery, catalogSeverity]);

  if (status === "loading") {
    return (
      <StatusPanel
        kind="loading"
        title="Global threat feed"
        body="Loading the global threat feed…"
      />
    );
  }

  if (status === "unauthenticated") {
    return (
      <StatusPanel
        kind="info"
        title="Global threat feed"
        body="Sign in to watch the global threat feed."
      />
    );
  }

  if (status === "error") {
    return (
      <StatusPanel
        kind="error"
        title="Global threat feed"
        body="Unable to load the global threat feed."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <LiveUpdatePill lastUpdatedAt={lastUpdatedAt} refreshing={refreshing} />
      {refreshError ? (
        <InlineError
          message={`Live refresh paused after an error: ${refreshError}`}
          onDismiss={() => setRefreshError(null)}
        />
      ) : null}
      <section
        aria-labelledby="threat-alerts-heading"
        className="flex flex-col gap-3"
      >
        <div className="flex items-center gap-3">
          <h2
            id="threat-alerts-heading"
            className="text-lg font-semibold text-ink"
          >
            Your threat alerts
          </h2>
          <span
            role="status"
            aria-label={`Open threat alert count: ${openAlerts.length}`}
          >
            <Badge tone={openAlerts.length > 0 ? "danger" : "neutral"}>
              {openAlerts.length} open
            </Badge>
          </span>
        </div>
        {state.alerts.length === 0 ? (
          <p className="text-sm text-muted">
            No world threats currently correlate to your verified scope or
            tracked CVEs. New matches appear on the next one-minute workspace
            refresh.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {state.alerts.map((alert) => (
              <li
                key={alert.tenantThreatAlertId}
                className={cn(
                  "flex flex-col gap-2 rounded-control border border-line bg-surface p-3",
                  alert.status !== "New" && "opacity-60"
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StateBadge tone={severityTone(alert.severity ?? "")} dot={false}>
                    {alert.severity ?? "Unknown"}
                  </StateBadge>
                  <Badge tone="neutral">{alert.matchType.toUpperCase()}</Badge>
                  <span className="font-medium text-ink">
                    {alert.item.title}
                  </span>
                  <Badge tone="neutral">{alert.status}</Badge>
                </div>
                <p className="text-sm text-muted">
                  Matched <code>{alert.matchedValue}</code>
                  {alert.item.sources.length > 0
                    ? ` · sources: ${alert.item.sources.join(", ")}`
                    : ""}
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  <Link
                    href={`/findings?q=${encodeURIComponent(alert.matchedValue)}`}
                    className="font-semibold text-brand hover:text-brand-2"
                  >
                    Search findings
                  </Link>
                  <Link
                    href={`/attack-paths?q=${encodeURIComponent(alert.matchedValue)}`}
                    className="font-semibold text-brand hover:text-brand-2"
                  >
                    Search paths
                  </Link>
                  {alert.matchedScopeId ? (
                    <Link
                      href={`/assets?q=${encodeURIComponent(alert.matchedScopeId)}`}
                      className="font-semibold text-brand hover:text-brand-2"
                    >
                      Open matched scope
                    </Link>
                  ) : (
                    <span className="text-subtle">
                      No matched scope on alert
                    </span>
                  )}
                  <Link
                    href="/threat-center"
                    className="text-muted hover:text-brand"
                  >
                    Advisory readiness →
                  </Link>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    {alert.status === "New" ? (
                      <>
                        <Button
                          disabled={pendingAlertId !== null}
                          onClick={() =>
                            void actOnAlert(
                              alert.tenantThreatAlertId,
                              "Acknowledged"
                            )
                          }
                        >
                          Acknowledge
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={pendingAlertId !== null}
                          onClick={() =>
                            void actOnAlert(
                              alert.tenantThreatAlertId,
                              "Dismissed"
                            )
                          }
                        >
                          Dismiss
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        disabled={pendingAlertId !== null}
                        onClick={() =>
                          void actOnAlert(alert.tenantThreatAlertId, "New")
                        }
                      >
                        {alert.status === "Dismissed"
                          ? "Undo dismissal"
                          : "Re-open"}
                      </Button>
                    )}
                  </div>
                  {alertErrors[alert.tenantThreatAlertId] ? (
                    <InlineError
                      message={alertErrors[alert.tenantThreatAlertId] ?? ""}
                      onDismiss={() =>
                        dismissAlertError(alert.tenantThreatAlertId)
                      }
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="threat-feeds-heading"
        className="flex flex-col gap-3"
      >
        <div className="flex items-center gap-3">
          <h2
            id="threat-feeds-heading"
            className="text-lg font-semibold text-ink"
          >
            Feed sources
          </h2>
          <span
            role="status"
            aria-label={`Threat feed source count: ${state.feeds.length}`}
          >
            <Badge tone="neutral">{state.feeds.length} feeds</Badge>
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {state.feeds.map((feed) => (
            <Card key={feed.sourceKey} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-ink">{feed.name}</span>
                <Badge tone={feedTone(feed.lastStatus)}>
                  {feed.lastStatus ?? "not polled"}
                </Badge>
              </div>
              <p className="text-sm text-muted">
                {feed.category} · every {feed.cadenceMinutes}m
                {feed.keyRequired && !feed.keyConfigured ? (
                  <>
                    {" · "}
                    <Link
                      href="/admin"
                      className="font-medium text-brand hover:text-brand-2"
                    >
                      add API key
                    </Link>
                  </>
                ) : null}
              </p>
              <p className="text-xs text-subtle">
                {feed.lastNewCount} new last poll · {feed.lastItemCount} seen
              </p>
            </Card>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="threat-catalog-heading"
        className="flex flex-col gap-3"
      >
        <div className="flex items-center gap-3">
          <h2
            id="threat-catalog-heading"
            className="text-lg font-semibold text-ink"
          >
            Latest world threats
          </h2>
          <span
            role="status"
            aria-label={`Threat catalog item count: ${filteredCatalog.length}`}
          >
            <Badge tone="neutral">
              {filteredCatalog.length} of {state.catalog.length}
            </Badge>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={catalogQuery}
            onChange={(event) => setCatalogQuery(event.target.value)}
            placeholder="Search threats, CVEs, or tags…"
            aria-label="Search world threats"
            className="min-w-0 flex-1 rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none placeholder:text-subtle focus:border-line-strong sm:max-w-sm"
          />
          <select
            value={catalogKind}
            onChange={(event) => setCatalogKind(event.target.value)}
            aria-label="Filter threats by kind"
            className="rounded-control border border-line bg-surface px-2.5 py-1.5 text-sm text-ink"
          >
            <option value="all">All kinds</option>
            {THREAT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
          <select
            value={catalogSeverity}
            onChange={(event) => setCatalogSeverity(event.target.value)}
            aria-label="Filter threats by severity"
            className="rounded-control border border-line bg-surface px-2.5 py-1.5 text-sm text-ink"
          >
            <option value="all">All severities</option>
            {THREAT_SEVERITIES.map((severity) => (
              <option key={severity} value={severity}>
                {severity}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 rounded-control border border-line bg-surface px-2.5 py-1.5 text-sm text-muted">
            <input
              type="checkbox"
              checked={catalogKevOnly}
              onChange={(event) => setCatalogKevOnly(event.target.checked)}
            />
            KEV only
          </label>
        </div>
        {state.catalog.length === 0 ? (
          <p className="text-sm text-muted">
            The catalog is still warming up. Feeds populate it on their next
            poll.
          </p>
        ) : filteredCatalog.length === 0 ? (
          <p className="text-sm text-muted">
            No world threats match these filters.
          </p>
        ) : (
          <>
          <ul className="flex flex-col gap-2">
            {visibleCatalog.map((item) => {
              const pivot =
                item.cveIds[0] ??
                item.iocValue ??
                item.canonicalKey ??
                item.title;
              const copyValue =
                item.cveIds[0] ??
                item.iocValue ??
                item.canonicalKey;
              return (
              <li
                key={item.threatIntelItemId}
                className="flex flex-col gap-2 rounded-control border border-line bg-surface p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StateBadge tone={severityTone(item.severity ?? "")} dot={false}>
                    {item.severity ?? "Unknown"}
                  </StateBadge>
                  <Badge tone="neutral">{item.kind}</Badge>
                  {item.kev ? <Badge tone="danger">KEV</Badge> : null}
                  <span className="min-w-0 break-all font-medium text-ink">
                    {item.title}
                  </span>
                  <span className="text-xs text-subtle">
                    {item.sources.join(", ")}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  {copyValue ? (
                    <button
                      type="button"
                      className="font-semibold text-brand hover:text-brand-2"
                      onClick={() => {
                        void navigator.clipboard?.writeText(copyValue);
                      }}
                    >
                      {item.cveIds[0]
                        ? "Copy CVE"
                        : item.iocValue
                          ? "Copy IOC"
                          : "Copy ID"}
                    </button>
                  ) : null}
                  <Link
                    href={`/findings?q=${encodeURIComponent(pivot)}`}
                    className="font-semibold text-brand hover:text-brand-2"
                  >
                    Search findings
                  </Link>
                  <Link
                    href={`/attack-paths?q=${encodeURIComponent(pivot)}`}
                    className="font-semibold text-brand hover:text-brand-2"
                  >
                    Search paths
                  </Link>
                  {item.kind === "Advisory" || item.kind === "Vulnerability" ? (
                    <Link
                      href="/threat-center"
                      className="text-muted hover:text-brand"
                    >
                      Open in Threat Center
                    </Link>
                  ) : null}
                </div>
              </li>
              );
            })}
          </ul>
          {catalogPageCount > 1 ? (
            <div className="flex items-center justify-between text-xs text-muted">
              <span>
                Page {catalogPage + 1} of {catalogPageCount}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  disabled={catalogPage === 0}
                  onClick={() =>
                    setCatalogPage((page) => Math.max(0, page - 1))
                  }
                >
                  Previous
                </Button>
                <Button
                  variant="ghost"
                  disabled={catalogPage >= catalogPageCount - 1}
                  onClick={() =>
                    setCatalogPage((page) =>
                      Math.min(catalogPageCount - 1, page + 1)
                    )
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
          </>
        )}
      </section>
    </div>
  );
}

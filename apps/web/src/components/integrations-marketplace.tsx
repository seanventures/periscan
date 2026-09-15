"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type {
  ConnectorAuthConfig,
  ConnectorCatalogEntry
} from "@periscan/connectors";
import type { Integration } from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { useApiResource } from "../hooks/use-api-resource";
import {
  ConfirmDialog,
  ErrorState,
  InlineError,
  LoadingSkeleton,
  NotConfigured,
  Panel,
  PanelHeader,
  StateBadge,
  buttonClassName,
  cn,
  type StateTone
} from "../ui";

const HEALTH_TONE: Record<string, StateTone> = {
  Healthy: "fixed",
  Degraded: "approval",
  Unhealthy: "missed",
  Unknown: "inconclusive"
};
const STATUS_TONE: Record<string, StateTone> = {
  Connected: "fixed",
  Created: "approval",
  Disconnected: "inconclusive",
  Error: "missed"
};

const CARD_CAP = 48;

function designPartnerHref(entry: ConnectorCatalogEntry) {
  const subject = `Periscan connector design partner: ${entry.vendor} ${entry.product}`;
  return `mailto:sales@periscan.com?subject=${encodeURIComponent(subject)}`;
}

function relTime(iso?: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function IntegrationsMarketplace() {
  const integrations = useApiResource(() => api.listIntegrations(), []);
  const catalog = useApiResource(() => api.listIntegrationCatalog(), []);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [setupEntry, setSetupEntry] = useState<ConnectorCatalogEntry | null>(
    null
  );

  const connected = integrations.data ?? [];
  const configuredByKey = useMemo(
    () =>
      new Map(
        connected
          .map(
            (integration) =>
              [
                integration.permissionsSummary?.connectorKey,
                integration
              ] as const
          )
          .filter((item): item is readonly [string, Integration] => !!item[0])
      ),
    [connected]
  );

  const categories = useMemo(
    () =>
      Array.from(
        new Set((catalog.data ?? []).map((c) => c.marketplaceCategory))
      ).sort(),
    [catalog.data]
  );

  // P19-14 / PERISCAN-467: depth honesty — connectable vs planned, never imply
  // Production-certified when catalog has zero Production / Certified entries.
  const depthSummary = useMemo(() => {
    const entries = catalog.data ?? [];
    let connectable = 0;
    let readyForCredentials = 0;
    let plannedOrNotConnectable = 0;
    let fixtureOnly = 0;
    let productionAvailability = 0;
    let certifiedLevel = 0;
    let betaAvailability = 0;
    for (const entry of entries) {
      if (entry.connectable) {
        connectable += 1;
      } else {
        plannedOrNotConnectable += 1;
      }
      if (entry.executionReadiness === "ReadyForCredentials") {
        readyForCredentials += 1;
      }
      if (entry.executionReadiness === "FixtureOnly") {
        fixtureOnly += 1;
      }
      if (entry.availability === "Production") {
        productionAvailability += 1;
      }
      if (entry.availability === "Beta") {
        betaAvailability += 1;
      }
      if (entry.certificationLevel === "Certified") {
        certifiedLevel += 1;
      }
    }
    return {
      total: entries.length,
      connectable,
      readyForCredentials,
      plannedOrNotConnectable,
      fixtureOnly,
      productionAvailability,
      certifiedLevel,
      betaAvailability,
      /** Customer-facing Production-certified count (requires both signals). */
      productionCertified: Math.min(productionAvailability, certifiedLevel)
    };
  }, [catalog.data]);

  const filteredCatalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (catalog.data ?? [])
      .filter((c) => category === "all" || c.marketplaceCategory === category)
      .filter(
        (c) =>
          !q ||
          c.vendor.toLowerCase().includes(q) ||
          c.product.toLowerCase().includes(q) ||
          c.customerVisibleDescription.toLowerCase().includes(q)
      );
  }, [catalog.data, category, query]);

  async function connect(
    entry: ConnectorCatalogEntry,
    authType: string,
    config: Record<string, string>
  ) {
    setBusyKey(entry.connectorKey);
    setError(null);
    setNotice(null);
    try {
      const integration = await api.createIntegration({
        authType,
        config,
        connectorKey: entry.connectorKey,
        mockMode: false
      });
      try {
        const health = await api.getIntegrationHealth(
          integration.integrationId
        );
        setNotice(
          `${entry.product} credentials verified: ${health.health.detail}`
        );
      } catch (caught) {
        setError(
          `${entry.product} configuration was saved, but its connection test failed: ${caught instanceof Error ? caught.message : "Unknown health-check error."}`
        );
      }
      setSetupEntry(null);
      await integrations.refetch();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't connect.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-6">
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
          Operate
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Integrations
        </h1>
        <p className="max-w-2xl text-sm text-muted">
          The signal sources that feed validation. Connect a tool, see exactly
          what Periscan reads, and keep it in sync — read-only by default.
        </p>
        <div
          className="mt-3 max-w-2xl rounded-control border border-line bg-surface-2 px-3 py-2 text-xs text-muted"
          data-testid="marketplace-interoperability-honesty-panel"
        >
          <p className="font-semibold text-ink">
            Marketplace interoperability honesty (matrix #98)
          </p>
          <p className="mt-1">
            This page is the <strong className="text-ink">connector catalog</strong>{" "}
            (connectable vs planned). Public AWS Marketplace listing and commercial
            packaging stay <strong className="text-ink">NotConfigured</strong> until
            seller ops attest Public — product never invents a live offer URL.
            Procurement status: Billing → AWS Marketplace; API{" "}
            <code className="font-mono text-[11px]">
              GET /api/v1/billing/aws-marketplace
            </code>
            .
          </p>
        </div>
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-control border border-missed/40 bg-missed/10 px-3 py-2 text-sm text-missed"
        >
          {error}
        </div>
      ) : null}
      {notice ? (
        <div
          role="status"
          className="rounded-control border border-fixed/40 bg-fixed/10 px-3 py-2 text-sm text-fixed"
        >
          {notice}
        </div>
      ) : null}

      {/* Connected */}
      <Panel>
        <PanelHeader title={`Configured (${connected.length})`} />
        {integrations.loading ? (
          <LoadingSkeleton rows={3} />
        ) : integrations.error ? (
          <ErrorState
            message={integrations.error}
            onRetry={integrations.refetch}
          />
        ) : connected.length === 0 ? (
          <div className="p-4">
            <NotConfigured
              title="No sources connected"
              message="Connect a source from the marketplace below to start feeding validation with real signals."
            />
          </div>
        ) : (
          <ul>
            {connected.map((integration) => (
              <ConnectedRow
                key={integration.integrationId}
                integration={integration}
                onChanged={integrations.refetch}
              />
            ))}
          </ul>
        )}
      </Panel>

      {/* P19-14 / PERISCAN-467 depth honesty — never lead with raw catalog size alone */}
      {!catalog.loading && depthSummary.total > 0 ? (
        <div
          className="flex flex-col gap-1.5 text-[12.5px] text-muted"
          data-testid="integration-depth-summary"
        >
          <p>
            Catalog depth:{" "}
            <span className="font-medium text-ink">
              {depthSummary.connectable} connectable
            </span>
            {" · "}
            <span className="font-medium text-ink">
              {depthSummary.readyForCredentials} ready for credentials
            </span>
            {" · "}
            <span className="font-medium text-ink">
              {depthSummary.plannedOrNotConnectable} planned / not connectable
            </span>
            {depthSummary.fixtureOnly > 0 ? (
              <>
                {" · "}
                <span className="font-medium text-ink">
                  {depthSummary.fixtureOnly} fixture-only
                </span>
              </>
            ) : null}
            <span className="text-subtle">
              {" "}
              (of {depthSummary.total} listed — prioritize depth on your stack,
              not breadth slides)
            </span>
          </p>
          <p data-testid="integration-production-honesty">
            {depthSummary.productionAvailability === 0 &&
            depthSummary.certifiedLevel === 0 ? (
              <>
                <span className="font-medium text-ink">
                  0 Production-certified
                </span>
                {" — "}
                dedicated live clients remain{" "}
                <span className="font-medium text-ink">Beta</span> until
                design-partner customer-credential live-smoke receipts. Fixture
                contract tests alone never mint Production.
              </>
            ) : (
              <>
                Production-certified:{" "}
                <span className="font-medium text-ink">
                  {depthSummary.productionAvailability}
                </span>
                {" availability / "}
                <span className="font-medium text-ink">
                  {depthSummary.certifiedLevel}
                </span>{" "}
                certification level — only after live-smoke evidence.
              </>
            )}
          </p>
        </div>
      ) : null}

      {/* Marketplace */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the marketplace…"
          aria-label="Search integrations"
          className="min-w-0 flex-1 rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none placeholder:text-subtle focus:border-line-strong md:max-w-sm"
        />
        <label className="flex items-center gap-1.5 rounded-control border border-line bg-surface pl-3 pr-1.5 text-sm">
          <span className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
            Category
          </span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Filter by category"
            className="max-w-[10rem] bg-transparent py-1.5 text-sm text-ink outline-none"
          >
            <option value="all">All</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      {setupEntry ? (
        <ConnectorSetupPanel
          key={setupEntry.connectorKey}
          entry={setupEntry}
          busy={busyKey === setupEntry.connectorKey}
          onCancel={() => setSetupEntry(null)}
          onSubmit={(authType, config) => connect(setupEntry, authType, config)}
        />
      ) : null}

      {catalog.loading ? (
        <Panel>
          <LoadingSkeleton rows={6} />
        </Panel>
      ) : catalog.error ? (
        <Panel>
          <ErrorState message={catalog.error} onRetry={catalog.refetch} />
        </Panel>
      ) : (
        <>
          <p className="font-mono text-xs text-subtle">
            {filteredCatalog.length} of {(catalog.data ?? []).length} connectors
            {filteredCatalog.length > CARD_CAP
              ? ` · showing first ${CARD_CAP}`
              : ""}
          </p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredCatalog.slice(0, CARD_CAP).map((entry) => (
              <CatalogCard
                key={entry.connectorKey}
                entry={entry}
                integration={configuredByKey.get(entry.connectorKey)}
                busy={busyKey === entry.connectorKey}
                onConnect={() => setSetupEntry(entry)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ConnectedRow({
  integration,
  onChanged
}: {
  integration: Integration;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<"test" | "sync" | "remove" | null>(null);
  const [result, setResult] = useState<{
    text: string;
    signalId?: string;
  } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const sourceName = `${integration.vendor} ${integration.product}`;

  async function testConnection() {
    setBusy("test");
    setResult(null);
    try {
      const response = await api.getIntegrationHealth(
        integration.integrationId
      );
      setResult({ text: response.health.detail });
      onChanged();
    } catch (caught) {
      setResult({
        text:
          caught instanceof Error ? caught.message : "Connection test failed"
      });
    } finally {
      setBusy(null);
    }
  }

  async function sync() {
    setBusy("sync");
    setResult(null);
    try {
      const r = await api.syncIntegration(integration.integrationId);
      const telemetry = Object.entries(
        r.signals.reduce<Record<string, number>>((counts, signal) => {
          counts[signal.signalCategory] =
            (counts[signal.signalCategory] ?? 0) + 1;
          return counts;
        }, {})
      )
        .map(([category, count]) => `${category} ${count}`)
        .join(" · ");
      setResult({
        text: `${r.signalCount} signals · ${r.assetCount} assets${telemetry ? ` · ${telemetry}` : ""}`,
        signalId: r.signals[0]?.signalId
      });
      onChanged();
    } catch (caught) {
      setResult({
        text: caught instanceof Error ? caught.message : "Sync failed"
      });
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("remove");
    setRemoveError(null);
    try {
      await api.deleteIntegration(integration.integrationId);
      setConfirmRemove(false);
      onChanged();
    } catch (caught) {
      setRemoveError(
        caught instanceof Error
          ? caught.message
          : "Couldn't disconnect this source."
      );
    } finally {
      setBusy(null);
    }
  }

  const perms = integration.permissionsSummary?.requiredPermissions ?? [];

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3 last:border-b-0">
      <span className="text-[13px] text-ink">
        {integration.vendor} {integration.product}
      </span>
      <span className="rounded-control border border-line px-1.5 py-0.5 font-mono text-[10px] text-subtle">
        {integration.category}
      </span>
      <StateBadge
        tone={STATUS_TONE[integration.status] ?? "neutral"}
        dot={false}
      >
        {integration.status}
      </StateBadge>
      <StateBadge
        tone={HEALTH_TONE[integration.healthStatus] ?? "neutral"}
        dot={false}
      >
        {integration.healthStatus}
      </StateBadge>
      <span className="font-mono text-[11px] text-subtle">
        synced {relTime(integration.lastSyncAt)}
        {perms.length ? ` · reads ${perms.slice(0, 2).join(", ")}` : ""}
      </span>
      {result ? (
        <span className="font-mono text-[11px] text-muted">
          {result.text}
          {result.signalId ? (
            <>
              {" · "}
              <Link
                className="text-brand hover:underline"
                href={`/signal-activity?signalId=${encodeURIComponent(result.signalId)}`}
              >
                View landed signal
              </Link>
            </>
          ) : null}
        </span>
      ) : null}
      <div className="ml-auto flex gap-1.5">
        <button
          type="button"
          onClick={testConnection}
          disabled={busy !== null}
          className={buttonClassName({ size: "sm", variant: "secondary" })}
        >
          {busy === "test" ? "Testing…" : "Test"}
        </button>
        <button
          type="button"
          onClick={sync}
          disabled={busy !== null}
          className={buttonClassName({ size: "sm", variant: "secondary" })}
        >
          {busy === "sync" ? "Syncing…" : "Sync"}
        </button>
        <button
          type="button"
          onClick={() => {
            setRemoveError(null);
            setConfirmRemove(true);
          }}
          disabled={busy !== null}
          className={cn(
            buttonClassName({ size: "sm", variant: "secondary" }),
            "text-missed"
          )}
        >
          Disconnect
        </button>
      </div>
      {removeError ? (
        <InlineError
          message={removeError}
          onDismiss={() => setRemoveError(null)}
          className="w-full"
        />
      ) : null}
      <ConfirmDialog
        open={confirmRemove}
        title="Disconnect this source?"
        description={`Periscan will stop ingesting signals from ${sourceName} and remove this connection. You can reconnect it later from the marketplace.`}
        confirmLabel="Disconnect"
        destructive
        busy={busy === "remove"}
        error={removeError}
        onConfirm={remove}
        onCancel={() => {
          setConfirmRemove(false);
          setRemoveError(null);
        }}
      />
    </li>
  );
}

function ConnectorSetupPanel({
  entry,
  busy,
  onCancel,
  onSubmit
}: {
  entry: ConnectorCatalogEntry;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (authType: string, config: Record<string, string>) => void;
}) {
  const methods = entry.authMethods.filter(
    (method) => method.kind !== "mock" && method.kind !== "planned"
  );
  const [authType, setAuthType] = useState(methods[0]?.kind ?? "");
  const [config, setConfig] = useState<Record<string, string>>({});
  const method = methods.find((candidate) => candidate.kind === authType);
  const missingRequired =
    method?.fields.some(
      (field) => field.required && !config[field.key]?.trim()
    ) ?? true;

  function inputType(field: ConnectorAuthConfig["fields"][number]) {
    if (field.secret) return "password";
    if (field.key.toLowerCase().includes("url")) return "url";
    return "text";
  }

  return (
    <Panel>
      <PanelHeader title={`Configure ${entry.vendor} ${entry.product}`} />
      <form
        className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.7fr)]"
        onSubmit={(event) => {
          event.preventDefault();
          if (method && !missingRequired) onSubmit(method.kind, config);
        }}
      >
        <div className="flex min-w-0 flex-col gap-3">
          {methods.length === 0 ? (
            <NotConfigured
              title="Live credentials are not supported"
              message="This catalog entry is fixture-only. Periscan will not create a demo connection in a customer workspace."
            />
          ) : (
            <>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Authentication method
                <select
                  aria-label="Authentication method"
                  value={authType}
                  onChange={(event) => {
                    setAuthType(event.target.value);
                    setConfig({});
                  }}
                  className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-line-strong"
                >
                  {methods.map((candidate) => (
                    <option key={candidate.kind} value={candidate.kind}>
                      {candidate.label}
                    </option>
                  ))}
                </select>
              </label>
              {method ? (
                <p className="text-xs text-muted">
                  {method.description}
                  {method.kind.toLowerCase().includes("oauth")
                    ? " Periscan uses this service-to-service OAuth grant without requesting interactive user access."
                    : ""}
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                {(method?.fields ?? []).map((field) => (
                  <label
                    key={field.key}
                    className="flex min-w-0 flex-col gap-1 text-xs text-muted"
                  >
                    <span>
                      {field.label}
                      {field.required ? " *" : ""}
                    </span>
                    <input
                      aria-label={field.label}
                      autoComplete="off"
                      type={inputType(field)}
                      required={field.required}
                      value={config[field.key] ?? ""}
                      onChange={(event) =>
                        setConfig((current) => ({
                          ...current,
                          [field.key]: event.target.value
                        }))
                      }
                      className="min-w-0 rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-line-strong"
                    />
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
        <aside className="rounded-control border border-line bg-surface-strong/50 p-3">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-subtle">
            Read-only access requested
          </p>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {entry.requiredPermissions.map((permission) => (
              <li key={permission}>• {permission}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-subtle">
            Secret fields are encrypted with AES-256-GCM and returned only as
            redacted values. Saving immediately runs the manifest health check;
            the source remains Created until authorization is verified.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy || missingRequired || methods.length === 0}
              className={buttonClassName({ size: "sm", variant: "primary" })}
            >
              {busy ? "Saving and testing…" : "Save and test connection"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className={buttonClassName({ size: "sm", variant: "secondary" })}
            >
              Cancel
            </button>
          </div>
        </aside>
      </form>
    </Panel>
  );
}

function CatalogCard({
  entry,
  integration,
  busy,
  onConnect
}: {
  entry: ConnectorCatalogEntry;
  integration?: Integration;
  busy: boolean;
  onConnect: () => void;
}) {
  const setupBlocked =
    !entry.connectable || entry.executionReadiness === "NotConnectable";

  return (
    <Panel className="flex flex-col">
      <div className="flex flex-col gap-2.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-display text-[14px] font-semibold text-ink">
              {entry.vendor}
            </h3>
            <p className="truncate font-mono text-[11px] text-subtle">
              {entry.product}
            </p>
          </div>
          <StateBadge tone={entry.live ? "fixed" : "inconclusive"} dot={false}>
            {entry.availability}
          </StateBadge>
        </div>
        <p className="line-clamp-2 text-[12px] text-muted">
          {entry.customerVisibleDescription}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-control border border-line px-1.5 py-0.5 font-mono text-[10px] text-subtle">
            {entry.marketplaceCategory}
          </span>
          <span className="rounded-control border border-line px-1.5 py-0.5 font-mono text-[10px] text-subtle">
            setup: {entry.setupComplexity}
          </span>
          <span className="rounded-control border border-line px-1.5 py-0.5 font-mono text-[10px] text-subtle">
            {entry.supportedMissionTypes.length} missions
          </span>
        </div>
        <p className="text-[11px] text-subtle">
          <span className="text-muted">Reads:</span> {entry.permissionsSummary}
        </p>
        <p className="text-[11px] leading-5 text-subtle">
          {entry.executionReadinessReason}
        </p>
      </div>
      <div className="mt-auto border-t border-line p-3">
        {integration ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
            <span
              aria-hidden
              className={cn(
                "size-1.5 rounded-full",
                integration.status === "Connected" ? "bg-fixed" : "bg-approval"
              )}
            />
            {integration.status === "Connected"
              ? "Connected and verified"
              : "Configured · verification required"}
          </span>
        ) : setupBlocked ? (
          <a
            href={designPartnerHref(entry)}
            aria-label={`Discuss ${entry.product} connector design partnership`}
            className={buttonClassName({ size: "sm", variant: "secondary" })}
          >
            Design partner
          </a>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            disabled={
              busy ||
              !entry.connectable ||
              entry.executionReadiness !== "ReadyForCredentials"
            }
            className={buttonClassName({ size: "sm", variant: "primary" })}
          >
            {busy
              ? "Connecting…"
              : entry.executionReadiness === "FixtureOnly"
                ? "Fixture only"
                : "Configure"}
          </button>
        )}
      </div>
    </Panel>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from "react";

import {
  browserPeriscanApiClient as api,
  PeriscanApiClientError,
  type CreateClientTenantInput
} from "../lib/periscan-api-client";
import {
  clearWorkingTenant,
  markWorkingTenantEnterToast,
  readWorkingTenant,
  setWorkingTenant
} from "../lib/working-tenant";
import { useApiResource } from "../hooks/use-api-resource";
import {
  Button,
  ErrorState,
  LoadingSkeleton,
  NotConfigured,
  Panel,
  StateBadge,
  buttonClassName,
  type StateTone
} from "../ui";

const READINESS_TONE: Record<string, StateTone> = {
  Active: "fixed",
  Attention: "missed",
  NeedsValidation: "approval",
  NeedsIntegration: "approval",
  NeedsScope: "inconclusive"
};

function relTime(iso?: string | null): string {
  if (!iso) return "no activity";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function MSSPPortfolioWorkbench() {
  const router = useRouter();
  const portfolio = useApiResource(() => api.getClientPortfolio(), []);
  const [exceptionsOnly, setExceptionsOnly] = useState(true);
  const [selectedTenantIds, setSelectedTenantIds] = useState<Set<string>>(
    () => new Set()
  );
  const [openingTenantId, setOpeningTenantId] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  /** One-shot local status after Open client (also armed for shell toast). */
  const [openSuccess, setOpenSuccess] = useState<string | null>(null);

  const data = portfolio.data;
  const clients = data?.clients ?? [];
  const parentTenant = data?.parentTenant;
  const portfolioEmpty =
    !portfolio.loading && !portfolio.error && clients.length === 0;

  const readinessSpread = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of clients) {
      counts.set(c.readinessStatus, (counts.get(c.readinessStatus) ?? 0) + 1);
    }
    return counts;
  }, [clients]);
  const rankedClients = useMemo(
    () =>
      clients
        .map((client) => ({ client, exception: clientException(client) }))
        .filter(({ exception }) => !exceptionsOnly || exception.score > 0)
        .sort((left, right) => right.exception.score - left.exception.score),
    [clients, exceptionsOnly]
  );
  const selectedClients = rankedClients.filter(({ client }) =>
    selectedTenantIds.has(client.tenant.tenantId)
  );
  const allVisibleSelected =
    rankedClients.length > 0 && selectedClients.length === rankedClients.length;

  function toggleTenant(tenantId: string) {
    setSelectedTenantIds((current) => {
      const next = new Set(current);
      if (next.has(tenantId)) next.delete(tenantId);
      else next.add(tenantId);
      return next;
    });
  }

  function toggleVisibleClients() {
    setSelectedTenantIds((current) => {
      const next = new Set(current);
      for (const { client } of rankedClients) {
        if (allVisibleSelected) next.delete(client.tenant.tenantId);
        else next.add(client.tenant.tenantId);
      }
      return next;
    });
  }

  async function openClientWorkspace(client: Client, destination = "/findings") {
    const tenantId = client.tenant.tenantId;
    const name =
      client.branding.organizationName?.trim() || client.tenant.name;
    setOpenError(null);
    setOpenSuccess(null);
    setOpeningTenantId(tenantId);
    const previous = readWorkingTenant();
    setWorkingTenant({
      tenantId,
      name,
      homeTenantId: parentTenant?.tenantId ?? client.tenant.parentTenantId ?? undefined,
      homeTenantName: parentTenant?.name
    });
    try {
      const me = await api.getMe();
      if (me.tenant.tenantId !== tenantId) {
        throw new Error(
          "Session did not switch into this client tenant. You may lack membership."
        );
      }
      // P05: one-shot "Working as {name}" (portfolio status + shell toast once).
      const status = `Working as ${name}`;
      setOpenSuccess(status);
      markWorkingTenantEnterToast(name);
      router.push(destination);
    } catch (caught) {
      if (previous) {
        setWorkingTenant(previous);
      } else {
        clearWorkingTenant();
      }
      const message =
        caught instanceof PeriscanApiClientError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : "Unable to open client workspace.";
      // Honest failure when non-MSSP / no membership for the requested tenant.
      setOpenError(
        message.includes("Authentication") || caught instanceof PeriscanApiClientError
          ? `${message} Working tenant was not changed. Only MSSP operators with membership on the client can switch.`
          : message
      );
    } finally {
      setOpeningTenantId(null);
    }
  }

  return (
    <div
      className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-6"
      role="region"
      aria-label="MSSP client portfolio"
      data-testid="mssp-portfolio-workbench"
    >
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
          Admin · Clients
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Client portfolio
        </h1>
        <p className="max-w-2xl text-sm text-muted">
          Multi-tenant architecture is real. Primary GTM is still one org
          completing Snapshot → fix verified → proof pack. Use this portfolio
          after that loop is boring — never as existence proof of channel PMF.
        </p>
      </header>
      <div className="rounded-control border border-approval/35 bg-approval/[0.06] px-4 py-3 text-[13px] leading-5 text-muted">
        <span className="font-semibold text-ink">Sequencing (P08-6): </span>
        Dogfood only after one parent buyer finishes measured re-validation.
        Isolation proof is the leave-behind — not custom BAS theater per client.
      </div>

      <CreateClientTenantPanel
        parentTenantName={parentTenant?.name}
        forceOpen={portfolioEmpty}
        onCreated={() => {
          void portfolio.refetch();
        }}
      />

      {openSuccess ? (
        <div
          role="status"
          aria-live="polite"
          data-testid="open-client-success"
          className="rounded-control border border-fixed/40 bg-fixed/10 px-4 py-3 text-sm font-semibold text-fixed"
        >
          {openSuccess}
        </div>
      ) : null}

      {openError ? (
        <div
          role="alert"
          className="rounded-control border border-missed/40 bg-missed/[0.08] px-4 py-3 text-sm text-ink"
        >
          {openError}
        </div>
      ) : null}

      {portfolio.loading ? (
        <Panel>
          <LoadingSkeleton rows={6} />
        </Panel>
      ) : portfolio.error ? (
        <Panel>
          <ErrorState message={portfolio.error} onRetry={portfolio.refetch} />
        </Panel>
      ) : !data || clients.length === 0 ? (
        <Panel>
          <div className="p-4">
            <NotConfigured
              title="No client tenants"
              message="This workspace isn't managing client tenants yet. Create a client above when this account is an MSSP parent, or switch to the parent workspace."
            />
          </div>
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile
              label="Client tenants"
              value={data.totals.clientTenants}
              tone="brand"
            />
            <Tile
              label="Active"
              value={data.totals.activeClients}
              tone="fixed"
            />
            <Tile
              label="Need attention"
              value={data.totals.attentionClients}
              tone="missed"
            />
            <Tile
              label="Missing proof inputs"
              value={data.totals.missingProofInputs}
              tone="approval"
            />
          </div>

          {readinessSpread.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-subtle">readiness</span>
              {[...readinessSpread.entries()].map(([status, count]) => (
                <span key={status} className="inline-flex items-center gap-1.5">
                  <StateBadge
                    tone={READINESS_TONE[status] ?? "neutral"}
                    dot={false}
                  >
                    {status}
                  </StateBadge>
                  <span className="font-mono text-xs text-muted">{count}</span>
                </span>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-surface px-4 py-3">
            <div>
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">
                Exception cockpit
              </p>
              <p className="mt-1 text-xs text-muted">
                Ranked from current readiness, critical paths, stale or missing
                proof, verification backlog, and missing inputs. Tenant
                boundaries remain explicit — open one client at a time.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-pressed={allVisibleSelected}
                onClick={toggleVisibleClients}
                disabled={rankedClients.length === 0}
                className="rounded-control border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-50"
              >
                {allVisibleSelected ? "Clear visible" : "Select visible"}
              </button>
              <button
                type="button"
                aria-pressed={exceptionsOnly}
                onClick={() => setExceptionsOnly((current) => !current)}
                className="rounded-control border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:border-line-strong"
              >
                {exceptionsOnly ? "Showing exceptions" : "Showing all clients"}
              </button>
            </div>
          </div>

          {selectedClients.length > 0 ? (
            <section
              aria-labelledby="batch-triage-title"
              className="rounded-card border border-brand/40 bg-brand/[0.05] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">
                    Tenant-safe batch triage
                  </p>
                  <h2
                    id="batch-triage-title"
                    className="mt-1 text-sm font-semibold text-ink"
                  >
                    {selectedClients.length} client tenant
                    {selectedClients.length === 1 ? "" : "s"} queued by
                    exception rank
                  </h2>
                  <p className="mt-1 max-w-3xl text-xs leading-5 text-muted">
                    This queue batches review, not mutations. Open one client to
                    work findings or remediation; evidence, tickets, and
                    approvals stay inside that tenant.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    data-testid="open-first-selected"
                    disabled={openingTenantId != null}
                    onClick={() => {
                      const first = selectedClients[0]?.client;
                      if (first) {
                        void openClientWorkspace(first, "/findings");
                      }
                    }}
                    className={buttonClassName({
                      size: "sm",
                      variant: "primary",
                      className: "text-[11px]"
                    })}
                  >
                    {openingTenantId === selectedClients[0]?.client.tenant.tenantId
                      ? "Opening…"
                      : "Open first selected"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTenantIds(new Set())}
                    className="text-xs font-semibold text-brand hover:text-brand-2"
                  >
                    Clear batch
                  </button>
                </div>
              </div>
              <ol className="mt-3 grid list-none gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {selectedClients.map(({ client, exception }, index) => {
                  const label =
                    client.branding.organizationName ?? client.tenant.name;
                  const busy = openingTenantId === client.tenant.tenantId;
                  return (
                    <li
                      key={client.tenant.tenantId}
                      className="rounded-control border border-line bg-bg px-3 py-2.5"
                    >
                      <div className="flex items-start gap-2">
                        <span className="font-mono text-[10px] text-brand">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-ink">
                            {label}
                          </p>
                          <p className="mt-1 text-[11px] leading-4 text-muted">
                            {exception.reasons.join(" · ") ||
                              "No current exception reason"}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              disabled={busy || openingTenantId != null}
                              onClick={() =>
                                void openClientWorkspace(client, "/findings")
                              }
                              className={buttonClassName({
                                size: "sm",
                                variant: "primary",
                                className: "text-[11px]"
                              })}
                            >
                              {busy ? "Opening…" : "Open findings"}
                            </button>
                            <button
                              type="button"
                              disabled={busy || openingTenantId != null}
                              onClick={() =>
                                void openClientWorkspace(client, "/remediation")
                              }
                              className={buttonClassName({
                                size: "sm",
                                variant: "secondary",
                                className: "text-[11px]"
                              })}
                            >
                              Open rem
                            </button>
                          </div>
                        </div>
                        <button
                          type="button"
                          aria-label={`Remove ${client.tenant.name} from batch`}
                          onClick={() => toggleTenant(client.tenant.tenantId)}
                          className="text-subtle hover:text-ink"
                        >
                          ×
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rankedClients.map(({ client, exception }) => (
              <ClientCard
                key={client.tenant.tenantId}
                client={client}
                exception={exception}
                selected={selectedTenantIds.has(client.tenant.tenantId)}
                onSelectedChange={() => toggleTenant(client.tenant.tenantId)}
                opening={openingTenantId === client.tenant.tenantId}
                openDisabled={openingTenantId != null}
                onOpen={() => void openClientWorkspace(client, "/findings")}
              />
            ))}
            {rankedClients.length === 0 ? (
              <p className="col-span-full rounded-card border border-line p-6 text-center text-sm text-subtle">
                No client exceptions match this view.
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

type Client = NonNullable<
  Awaited<ReturnType<typeof api.getClientPortfolio>>
>["clients"][number];

function clientException(client: Client) {
  const reasons: string[] = [];
  let score = 0;
  const snapshotAgeDays = client.latestActivity.latestSnapshotAt
    ? Math.floor(
        (Date.now() -
          new Date(client.latestActivity.latestSnapshotAt).getTime()) /
          86_400_000
      )
    : null;
  if (client.readinessStatus !== "Active") {
    score += 30;
    reasons.push(client.readinessStatus.replace(/([a-z])([A-Z])/g, "$1 $2"));
  }
  if (client.risk.criticalPaths > 0) {
    score += Math.min(30, client.risk.criticalPaths * 10);
    reasons.push(
      `${client.risk.criticalPaths} critical path${client.risk.criticalPaths === 1 ? "" : "s"}`
    );
  }
  if (client.risk.verificationPending > 0) {
    score += Math.min(20, client.risk.verificationPending * 5);
    reasons.push(
      `${client.risk.verificationPending} re-test${client.risk.verificationPending === 1 ? "" : "s"} waiting`
    );
  }
  if (client.coverage.missingProofInputs > 0) {
    score += Math.min(20, client.coverage.missingProofInputs * 5);
    reasons.push(
      `${client.coverage.missingProofInputs} missing input${client.coverage.missingProofInputs === 1 ? "" : "s"}`
    );
  }
  if (snapshotAgeDays == null || snapshotAgeDays > 30) {
    score += 15;
    reasons.push(
      snapshotAgeDays == null ? "no snapshot" : `proof ${snapshotAgeDays}d old`
    );
  }
  if (!client.latestActivity.latestReportId) {
    score += 5;
    reasons.push("no report delivered");
  }
  return { reasons, score };
}

function CreateClientTenantPanel({
  parentTenantName,
  forceOpen = false,
  onCreated
}: {
  parentTenantName?: string;
  /** When portfolio is empty, expand the form as first-class onboarding. */
  forceOpen?: boolean;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(forceOpen);
  const [name, setName] = useState("");
  const [clientAdminEmail, setClientAdminEmail] = useState("");
  const [clientAdminName, setClientAdminName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Empty portfolio: expand the provision form as first-class onboarding (P05).
  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
    }
  }, [forceOpen]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Client name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const input: CreateClientTenantInput = {
      name: trimmed,
      clientAdminEmail: clientAdminEmail.trim() || null,
      clientAdminName: clientAdminName.trim() || null
    };
    try {
      const result = await api.createClientTenant(input);
      setSuccess(
        result.clientAdminUser
          ? `Created “${result.tenant.name}” and invited ${result.clientAdminUser.email} as ClientAdmin.`
          : `Created client tenant “${result.tenant.name}”.`
      );
      setName("");
      setClientAdminEmail("");
      setClientAdminName("");
      setOpen(false);
      onCreated();
    } catch (caught) {
      const message =
        caught instanceof PeriscanApiClientError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : "Unable to create client tenant.";
      setError(
        `${message} Only MSSP parent workspaces with admin membership can create clients.`
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">
            Provision
          </p>
          <h2 className="mt-1 text-sm font-semibold text-ink">
            Create client tenant
          </h2>
          <p className="mt-1 max-w-xl text-xs text-muted">
            Creates a managed Client under
            {parentTenantName ? ` ${parentTenantName}` : " this MSSP parent"}
            . Optional ClientAdmin invite creates or links a user with Invited
            status — no password is set here.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant={open ? "secondary" : "primary"}
          onClick={() => {
            setOpen((v) => !v);
            setError(null);
          }}
        >
          {open ? "Cancel" : "New client"}
        </Button>
      </div>
      {success ? (
        <p className="border-b border-line px-4 py-2 text-xs text-fixed" role="status">
          {success}
        </p>
      ) : null}
      {open ? (
        <form onSubmit={(e) => void onSubmit(e)} className="grid gap-3 p-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs sm:col-span-2">
            <span className="font-semibold text-ink">Client name</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-control border border-line bg-bg px-3 py-2 text-sm text-ink"
              placeholder="Acme Security"
              autoComplete="organization"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-semibold text-ink">
              ClientAdmin email{" "}
              <span className="font-normal text-subtle">(optional)</span>
            </span>
            <input
              type="email"
              value={clientAdminEmail}
              onChange={(e) => setClientAdminEmail(e.target.value)}
              className="rounded-control border border-line bg-bg px-3 py-2 text-sm text-ink"
              placeholder="admin@client.example"
              autoComplete="email"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-semibold text-ink">
              ClientAdmin name{" "}
              <span className="font-normal text-subtle">(optional)</span>
            </span>
            <input
              value={clientAdminName}
              onChange={(e) => setClientAdminName(e.target.value)}
              className="rounded-control border border-line bg-bg px-3 py-2 text-sm text-ink"
              placeholder="Alex Client"
              autoComplete="name"
            />
          </label>
          {error ? (
            <p role="alert" className="text-xs text-missed sm:col-span-2">
              {error}
            </p>
          ) : null}
          <div className="sm:col-span-2">
            <Button type="submit" size="sm" loading={submitting}>
              Create client
            </Button>
          </div>
        </form>
      ) : null}
    </Panel>
  );
}

function ClientCard({
  client,
  exception,
  onSelectedChange,
  selected,
  onOpen,
  opening,
  openDisabled
}: {
  client: Client;
  exception: ReturnType<typeof clientException>;
  onSelectedChange: () => void;
  selected: boolean;
  onOpen: () => void;
  opening: boolean;
  openDisabled: boolean;
}) {
  const { tenant, branding, readinessStatus, risk, coverage, latestActivity } =
    client;
  const accent = branding.primaryColor ?? "var(--color-brand)";
  const displayName = branding.organizationName ?? tenant.name;

  function onCardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Enter opens the client workspace (P05). Ignore when focus is on an
    // interactive child (checkbox / buttons) — those have their own handlers.
    if (event.key !== "Enter" || event.defaultPrevented) return;
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "BUTTON" ||
        target.tagName === "A" ||
        target.isContentEditable)
    ) {
      return;
    }
    if (openDisabled && !opening) return;
    event.preventDefault();
    onOpen();
  }

  return (
    <Panel
      className={`flex flex-col outline-none focus-visible:ring-2 focus-visible:ring-brand ${selected ? "border-brand/70" : ""}`}
      tabIndex={0}
      role="group"
      aria-label={`${displayName} client card. Press Enter to open.`}
      data-testid="mssp-client-card"
      onKeyDown={onCardKeyDown}
    >
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelectedChange}
            aria-label={`Add ${tenant.name} to batch triage`}
            className="mt-0.5 size-4 shrink-0 accent-brand"
          />
          <span
            aria-hidden
            className="mt-0.5 size-4 shrink-0 rounded"
            style={{ background: accent }}
          />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-[15px] font-semibold text-ink">
              {displayName}
            </h3>
            {branding.whiteLabelEnabled ? (
              <p className="font-mono text-[10px] text-subtle">white-labeled</p>
            ) : null}
          </div>
          <StateBadge
            tone={READINESS_TONE[readinessStatus] ?? "neutral"}
            dot={false}
          >
            {readinessStatus}
          </StateBadge>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
          <Stat
            label="Critical / high paths"
            value={`${risk.criticalPaths} / ${risk.highPaths}`}
            tone="missed"
          />
          <Stat
            label="Open remediations"
            value={String(risk.openRemediations)}
            tone="approval"
          />
          <Stat
            label="Verified scopes"
            value={`${coverage.verifiedScopes}/${coverage.totalScopes}`}
            tone="validated"
          />
          <Stat
            label="Integrations"
            value={`${coverage.healthyIntegrations} healthy`}
            tone={coverage.unhealthyIntegrations > 0 ? "approval" : "fixed"}
          />
        </div>

        {coverage.missingProofInputs > 0 ? (
          <p className="text-[12px] text-approval">
            {coverage.missingProofInputs} missing proof input
            {coverage.missingProofInputs === 1 ? "" : "s"}
          </p>
        ) : null}
        {exception.reasons.length > 0 ? (
          <div className="rounded-control border border-line bg-bg px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-wide text-subtle">
              Exception rank {exception.score}
            </p>
            <p className="mt-1 text-[11px] leading-5 text-muted">
              {exception.reasons.join(" · ")}
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="primary"
            loading={opening}
            disabled={openDisabled && !opening}
            onClick={onOpen}
            data-testid="open-client-workspace"
          >
            Open client
          </Button>
          <span className="self-center text-[11px] text-subtle">
            Sets working tenant → Findings
          </span>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-line px-4 py-2.5 text-[11px] text-subtle">
        <span className="font-mono">
          snapshot {relTime(latestActivity.latestSnapshotAt)}
        </span>
        {latestActivity.latestReportId ? (
          <a
            href={`/api/v1/reports/${latestActivity.latestReportId}/export`}
            target="_blank"
            rel="noreferrer"
            className="text-brand hover:text-brand-2"
          >
            latest report ↗
          </a>
        ) : (
          <span>no report yet</span>
        )}
      </div>
    </Panel>
  );
}

function Tile({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: StateTone;
}) {
  return (
    <div className="relative overflow-hidden rounded-card border border-line bg-surface p-4">
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: `var(--color-${tone})` }}
      />
      <p className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
        {label}
      </p>
      <p
        className="mt-2 font-mono text-3xl font-semibold"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: StateTone;
}) {
  return (
    <div>
      <p className="text-subtle">{label}</p>
      <p className="mt-0.5 font-mono" style={{ color: `var(--color-${tone})` }}>
        {value}
      </p>
    </div>
  );
}

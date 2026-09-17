"use client";

import Link from "next/link";
import { useState } from "react";
import {
  getGtmClaimLanguageSummary,
  type TrustSafetySummary
} from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { useApiResource } from "../hooks/use-api-resource";
import {
  ErrorState,
  LoadingSkeleton,
  Panel,
  PanelHeader,
  StateBadge,
  buttonClassName,
  cn,
  type StateTone
} from "../ui";

type IdentityProvisioning = TrustSafetySummary["identityProvisioning"];
type EnterpriseCommercial = TrustSafetySummary["enterpriseCommercial"];
type MarketPresence = TrustSafetySummary["marketPresence"];

const HEALTH_TONE: Record<string, StateTone> = {
  Healthy: "fixed",
  Degraded: "approval",
  Unhealthy: "missed",
  Unknown: "inconclusive"
};

function readinessTone(status: string): StateTone {
  return status === "Configured" ? "fixed" : "blocked";
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

export function TrustSafetyDashboard() {
  const summary = useApiResource(() => api.getTrustSafetySummary(), []);

  if (summary.loading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-5 py-6">
        <LoadingSkeleton rows={10} />
      </div>
    );
  }
  if (summary.error || !summary.data) {
    return (
      <div className="mx-auto w-full max-w-5xl px-5 py-6">
        <Panel>
          <ErrorState
            message={summary.error ?? "Unavailable."}
            onRetry={summary.refetch}
          />
        </Panel>
      </div>
    );
  }

  const s = summary.data;
  const runner = s.runnerSecurityModel;

  const runnerChecks: { label: string; ok: boolean }[] = [
    { label: "Outbound-only (no inbound ports)", ok: runner.outboundOnly },
    {
      label: "No inbound firewall rule required",
      ok: !runner.inboundFirewallRuleRequired
    },
    { label: "Signed tasks required", ok: runner.taskSigningRequired },
    {
      label: "Scope enforcement required",
      ok: runner.scopeEnforcementRequired
    },
    { label: "Local audit logs required", ok: runner.localAuditLogsRequired },
    { label: "Kill switch available", ok: runner.killSwitchAvailable }
  ];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-5 py-6">
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
          Govern
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Trust &amp; Safety
        </h1>
        <p className="max-w-2xl text-sm text-muted">
          Exactly what Periscan is allowed to do, what it reads, how evidence is
          handled, and how the in-network runner is constrained.
        </p>
      </header>

      <MarketPresenceHonestyBanner marketPresence={s.marketPresence} />

      <OffensiveValidationPanel />

      <IdentityLifecycleTrustPanel identity={s.identityProvisioning} />

      <MarketPresenceReadinessPanel marketPresence={s.marketPresence} />

      <EnterpriseCommercialHonestyPanel commercial={s.enterpriseCommercial} />

      {/* ICP-P2-3: bind live marketPresence into trust-pack row (no hardcoded zero). */}
      <EnterpriseTrustPackPanel
        marketPresence={s.marketPresence}
        dataGovernance={s.dataGovernance}
        vendorAssurance={s.vendorAssurance}
      />

      <GtmClaimLanguagePanel />

      {/* Principles */}
      <Panel>
        <PanelHeader title="Validation safety principles" />
        <ul className="grid gap-3 p-4 sm:grid-cols-2">
          {s.validationSafetyPrinciples.map((p) => (
            <li key={p.principleId} className="flex gap-2.5">
              <span aria-hidden className="mt-0.5 text-brand">
                ◈
              </span>
              <div>
                <p className="font-display text-[13px] font-semibold text-ink">
                  {p.title}
                </p>
                <p className="mt-0.5 text-[12.5px] text-muted">
                  {p.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      {/* Runner model */}
      <Panel>
        <PanelHeader
          title="Runner security model"
          actions={
            <span className="font-mono text-[11px] text-subtle">
              transport: {runner.transport}
            </span>
          }
        />
        <ul className="grid gap-2 p-4 sm:grid-cols-2">
          {runnerChecks.map((c) => (
            <li key={c.label} className="flex items-center gap-2 text-[13px]">
              <span
                aria-hidden
                className={cn(
                  "grid size-4 place-items-center rounded-full text-[10px]",
                  c.ok ? "bg-fixed/15 text-fixed" : "bg-missed/15 text-missed"
                )}
              >
                {c.ok ? "✓" : "✕"}
              </span>
              <span className={c.ok ? "text-muted" : "text-missed"}>
                {c.label}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      {/* Data & retention */}
      <Panel>
        <PanelHeader
          title="Data residency & processing"
          actions={
            <StateBadge
              tone={
                s.dataGovernance.selectedRegionStorageConfigured
                  ? "fixed"
                  : "missed"
              }
              dot={false}
            >
              {s.dataGovernance.routingStatus === "RegionRouted"
                ? "Region-routed"
                : "Single region"}
            </StateBadge>
          }
        />
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <section aria-labelledby="residency-heading">
            <h3 id="residency-heading" className="text-sm font-medium text-ink">
              Evidence storage region
            </h3>
            <p className="mt-1 font-mono text-xs text-brand">
              {s.dataGovernance.selectedRegion}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted">
              {s.dataGovernance.selectedRegionStorageConfigured
                ? "New evidence is routed by the workspace's persisted region before the storage write."
                : "No storage target is configured for this workspace region; evidence writes will fail closed."}
            </p>
            <p className="mt-2 text-[11px] text-subtle">
              Configured locations:{" "}
              {s.dataGovernance.availableRegions
                .map((region) => region.label)
                .join(" · ")}
            </p>
          </section>

          <section aria-labelledby="encryption-heading">
            <div className="flex items-center gap-2">
              <h3
                id="encryption-heading"
                className="text-sm font-medium text-ink"
              >
                Encryption at rest
              </h3>
              <StateBadge
                tone={
                  s.dataGovernance.encryptionAtRestStatus === "Configured"
                    ? "fixed"
                    : "inconclusive"
                }
                dot={false}
              >
                {s.dataGovernance.encryptionAtRestStatus}
              </StateBadge>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted">
              {s.dataGovernance.encryptionAtRestDetails}
            </p>
          </section>

          <section aria-labelledby="subprocessors-heading">
            <h3
              id="subprocessors-heading"
              className="text-sm font-medium text-ink"
            >
              Subprocessors
            </h3>
            {s.dataGovernance.subprocessors.length ? (
              <ul className="mt-2 space-y-2">
                {s.dataGovernance.subprocessors.map((subprocessor) => (
                  <li key={`${subprocessor.name}:${subprocessor.purpose}`}>
                    <p className="text-xs text-ink">{subprocessor.name}</p>
                    <p className="text-[11px] text-muted">
                      {subprocessor.purpose}
                    </p>
                    {subprocessor.privacyUrl ? (
                      <a
                        href={subprocessor.privacyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-brand hover:text-brand-2"
                      >
                        Privacy terms ↗
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs leading-5 text-muted">
                No deployment-specific subprocessor disclosure is configured.
              </p>
            )}
          </section>

          <section aria-labelledby="baa-heading">
            <div className="flex items-center gap-2">
              <h3 id="baa-heading" className="text-sm font-medium text-ink">
                Business Associate Agreement
              </h3>
              <StateBadge
                tone={
                  s.dataGovernance.baaStatus === "Available"
                    ? "fixed"
                    : "inconclusive"
                }
                dot={false}
              >
                {s.dataGovernance.baaStatus === "Available"
                  ? "Reference available"
                  : "Not published"}
              </StateBadge>
            </div>
            {s.dataGovernance.baaReferenceUrl ? (
              <a
                href={s.dataGovernance.baaReferenceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex text-xs text-brand hover:text-brand-2"
              >
                Open BAA reference ↗
              </a>
            ) : (
              <p className="mt-1 text-xs leading-5 text-muted">
                A BAA reference has not been configured for this deployment. Do
                not infer HIPAA eligibility from product operation alone.
              </p>
            )}
          </section>
        </div>
      </Panel>

      {/* Data & retention */}
      <Panel>
        <PanelHeader
          title="Data & retention"
          actions={
            <Link
              href="/audit"
              className="text-xs text-brand hover:text-brand-2"
            >
              Audit log →
            </Link>
          }
        />
        <div className="flex flex-col gap-2 p-4">
          <div className="flex flex-wrap gap-2">
            <Flag
              ok={s.evidenceRetention.redactionEnabled}
              label="Redaction before storage"
            />
            <Flag
              ok={s.evidenceRetention.tenantScopedAccess}
              label="Tenant-scoped access"
            />
            <StateBadge
              tone={readinessTone(s.evidenceRetention.retentionPolicyStatus)}
              dot={false}
            >
              {s.evidenceRetention.retentionPolicyStatus}
              {s.evidenceRetention.retentionPeriodDays
                ? ` · ${s.evidenceRetention.retentionPeriodDays}d`
                : ""}
            </StateBadge>
          </div>
          <p className="font-mono text-[11px] text-subtle">
            storage: {s.evidenceRetention.artifactStorage}
          </p>
          <p className="text-[12.5px] text-muted">
            {s.evidenceRetention.notes}
          </p>
          <p className="font-mono text-[11px] text-subtle">
            audit log: {s.auditLogPath}
          </p>
        </div>
      </Panel>

      {/* Connected systems */}
      <Panel>
        <PanelHeader
          title={`Connected systems (${s.connectedIntegrations.length})`}
        />
        {s.connectedIntegrations.length === 0 ? (
          <p className="px-4 py-6 text-sm text-subtle">No connected systems.</p>
        ) : (
          <ul>
            {s.connectedIntegrations.map((c) => (
              <ConnectedRow
                key={c.integrationId}
                integration={c}
                onRevoked={summary.refetch}
              />
            ))}
          </ul>
        )}
      </Panel>

      {/* Operational readiness */}
      <Panel>
        <PanelHeader
          title="Operational readiness"
          actions={
            <StateBadge
              tone={readinessTone(s.operationalReadiness.overallStatus)}
              dot={false}
            >
              {s.operationalReadiness.overallStatus}
            </StateBadge>
          }
        />
        <div className="p-4">
          <p className="mb-2 font-mono text-[11px] text-subtle">
            environment: {s.operationalReadiness.environment}
          </p>
          <ul className="flex flex-col gap-1.5">
            {s.operationalReadiness.controls.map((control) => (
              <li
                key={control.controlId}
                className="flex flex-wrap items-center gap-2 text-[12.5px]"
              >
                <StateBadge tone={readinessTone(control.status)} dot={false}>
                  {control.status}
                </StateBadge>
                <span className="text-ink">{control.title}</span>
                {control.value ? (
                  <span className="font-mono text-[11px] text-subtle">
                    {control.value}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </Panel>
    </div>
  );
}

function ConnectedRow({
  integration,
  onRevoked
}: {
  integration: {
    integrationId: string;
    vendor: string;
    product: string;
    category: string;
    healthStatus: string;
    lastSyncAt?: string | null;
    permissionsUsed: string[];
    dataReadCategories: string[];
  };
  onRevoked: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function revoke() {
    setBusy(true);
    try {
      await api.deleteIntegration(integration.integrationId);
      onRevoked();
    } catch {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3 last:border-b-0">
      <span className="text-[13px] text-ink">
        {integration.vendor} {integration.product}
      </span>
      <span className="rounded-control border border-line px-1.5 py-0.5 font-mono text-[10px] text-subtle">
        {integration.category}
      </span>
      <StateBadge
        tone={HEALTH_TONE[integration.healthStatus] ?? "neutral"}
        dot={false}
      >
        {integration.healthStatus}
      </StateBadge>
      <span className="font-mono text-[11px] text-subtle">
        reads {integration.dataReadCategories.join(", ") || "—"} · synced{" "}
        {relTime(integration.lastSyncAt)}
      </span>
      <button
        type="button"
        onClick={revoke}
        disabled={busy}
        className={cn(
          buttonClassName({ size: "sm", variant: "secondary" }),
          "ml-auto border-missed/50 text-ink hover:border-missed"
        )}
      >
        {busy ? "…" : "Revoke"}
      </button>
    </li>
  );
}

function Flag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-control border px-1.5 py-0.5 text-[11px]",
        ok ? "border-fixed/40 text-fixed" : "border-line text-subtle"
      )}
    >
      {ok ? "✓" : "✕"} {label}
    </span>
  );
}

/**
 * Zero customer references honesty (P08-9 / #183, P12-6 / #431, P19-15 / #374,
 * P04-19 / #126). Product never invents logos, case studies, or Leaders-ready.
 */
function MarketPresenceHonestyBanner({
  marketPresence
}: {
  marketPresence: Pick<
    MarketPresence,
    | "banner"
    | "publicReferenceCount"
    | "waveMarketPresenceGate"
    | "mqMarketPresenceGate"
  >;
}) {
  if (marketPresence.publicReferenceCount > 0) {
    return null;
  }

  return (
    <div
      className="rounded-control border border-missed/40 bg-missed/10 px-4 py-3"
      role="status"
      aria-live="polite"
      data-testid="market-presence-zero-refs-banner"
    >
      <p className="font-display text-[13px] font-semibold text-missed">
        {marketPresence.banner}
      </p>
      <p className="mt-1 text-[12px] text-muted">
        Wave gate:{" "}
        <span className="font-mono text-ink">
          {marketPresence.waveMarketPresenceGate}
        </span>
        {" · "}
        MQ market presence:{" "}
        <span className="font-mono text-ink">
          {marketPresence.mqMarketPresenceGate}
        </span>
        {" · "}
        Public references:{" "}
        <span className="font-mono text-ink">
          {marketPresence.publicReferenceCount}
        </span>
        . Demo, lab, and sample reports do not count. Not Leaders-ready while
        references = 0.
      </p>
      <p className="mt-2 text-[12px] text-muted">
        Path to first design partner (not logos): run a measured proof loop on{" "}
        <Link href="/missions" className="text-brand hover:text-brand-2">
          Validate
        </Link>
        , log internal session learning, then request written reference rights —
        factory{" "}
        <span className="font-mono text-ink">
          docs/DESIGN_PARTNER/REFERENCE_FACTORY.md
        </span>
        .
      </p>
    </div>
  );
}

function MarketPresenceReadinessPanel({
  marketPresence
}: {
  marketPresence: MarketPresence;
}) {
  const pack = marketPresence.referencePack;
  const gateTone = (status: string): StateTone => {
    if (status === "Pass" || status === "Met") return "fixed";
    if (status === "RequiredNow") return "approval";
    return "missed";
  };

  return (
    <Panel>
      <PanelHeader
        title="Market presence readiness"
        actions={
          <StateBadge
            tone={
              marketPresence.marketPresenceEligible ? "fixed" : "missed"
            }
            dot={false}
          >
            {marketPresence.marketPresenceEligible ? "Eligible" : "Not met"}
          </StateBadge>
        }
      />
      <div className="flex flex-col gap-3 p-4" data-testid="market-presence-readiness-panel">
        <p className="text-[13px] text-muted">{marketPresence.disclaimer}</p>
        <p className="rounded-control border border-line bg-surface px-3 py-2 text-[12px] text-muted">
          <strong className="text-ink">Named customer references:</strong>{" "}
          <span className="font-mono text-ink">
            {marketPresence.publicReferenceCount}
          </span>
          . Public logos:{" "}
          <span className="font-mono text-ink">
            {marketPresence.publicLogoCount}
          </span>
          . Case studies:{" "}
          <span className="font-mono text-ink">
            {marketPresence.publicCaseStudyCount}
          </span>
          . Zero named refs means MQ market presence / Wave viability{" "}
          <strong className="text-missed">Fail</strong> — never fabricate logos,
          ARR, or reference calls.
        </p>
        <ul className="grid gap-2 sm:grid-cols-3">
          <li className="rounded-control border border-line bg-surface px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-subtle">
              Public references
            </p>
            <p className="mt-0.5 font-mono text-lg text-ink">
              {marketPresence.publicReferenceCount}
            </p>
          </li>
          <li className="rounded-control border border-line bg-surface px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-subtle">
              Wave gate
            </p>
            <p className="mt-0.5">
              <StateBadge
                tone={gateTone(marketPresence.waveMarketPresenceGate)}
                dot={false}
              >
                {marketPresence.waveMarketPresenceGate}
              </StateBadge>
            </p>
          </li>
          <li className="rounded-control border border-line bg-surface px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-subtle">
              MQ / peer diligence
            </p>
            <p className="mt-0.5 flex flex-wrap gap-1">
              <StateBadge
                tone={gateTone(marketPresence.mqMarketPresenceGate)}
                dot={false}
              >
                MQ {marketPresence.mqMarketPresenceGate}
              </StateBadge>
              <StateBadge
                tone={gateTone(marketPresence.peerDiligenceGate)}
                dot={false}
              >
                Peer {marketPresence.peerDiligenceGate}
              </StateBadge>
            </p>
          </li>
        </ul>

        <div className="rounded-control border border-line bg-surface px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-ink">Reference pack checklist</p>
            <StateBadge
              tone={
                pack.packStatus === "Filled"
                  ? "fixed"
                  : pack.packStatus === "Partial"
                    ? "approval"
                    : "missed"
              }
              dot={false}
            >
              {pack.packStatus}
              {pack.inventoryEmpty ? " · inventory empty" : ""}
            </StateBadge>
          </div>
          <p className="mt-1 font-mono text-[11px] text-subtle">
            {pack.sourceDoc}
          </p>
          <dl className="mt-2 grid gap-1 text-[12px] sm:grid-cols-2">
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Referenceable production tenants</dt>
              <dd className="font-mono text-ink">
                {pack.kpis.referenceableProductionTenants}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Signed reference permissions</dt>
              <dd className="font-mono text-ink">
                {pack.kpis.signedReferenceCallPermissions}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Public case studies / logos</dt>
              <dd className="font-mono text-ink">
                {pack.kpis.publicCaseStudies} / {pack.kpis.publicLogos}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">ICP sessions</dt>
              <dd className="font-mono text-ink">
                {pack.kpis.icpSessionsCompleted}/{pack.kpis.icpSessionsTarget}
              </dd>
            </div>
          </dl>
          <ul className="mt-3 flex flex-col gap-1.5">
            {pack.gates.map((g) => (
              <li
                key={g.gateId}
                className="flex flex-wrap items-start gap-2 text-[12px]"
              >
                <StateBadge tone={gateTone(g.status)} dot={false}>
                  {g.gateId} · {g.status}
                </StateBadge>
                <span className="text-ink">{g.label}</span>
                <span className="text-subtle">{g.notes}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Path to first real design partner — never fake logos while refs = 0. */}
        <div
          className="rounded-control border border-brand/30 bg-brand/5 px-3 py-3"
          data-testid="path-to-first-design-partner-cta"
        >
          <p className="font-display text-[13px] font-semibold text-ink">
            Path to first design partner
          </p>
          <p className="mt-1 text-[12px] text-muted">
            Market presence stays Fail until real production partners give written
            reference rights. Do not invent logos or case studies. Run the factory:
            ICP recruit → measured proof loop → internal session note → production
            deploy → NDA reference-call consent → pack fill → only then Wave/MQ.
          </p>
          <ol className="mt-2 list-inside list-decimal text-[12px] text-muted">
            <li>
              Run a measured{" "}
              <Link href="/missions" className="text-brand hover:text-brand-2">
                Validation Snapshot
              </Link>{" "}
              on authorized scope (Validate spine)
            </li>
            <li>
              Complete Validate → Remediate → Re-validate; Fixed only via
              verification
            </li>
            <li>
              Log session learning (internal only) — never a public reference
            </li>
            <li>
              Request written reference-call rights under NDA after production
              value
            </li>
          </ol>
          <p className="mt-2 font-mono text-[11px] text-subtle">
            docs/DESIGN_PARTNER/REFERENCE_FACTORY.md ·{" "}
            docs/ops/MARKET_PRESENCE_PATH_TO_FIRST_REF.md
          </p>
        </div>
      </div>
    </Panel>
  );
}

/**
 * Enterprise commercial residual honesty (P17-6/7/9/10/13).
 * Prefer exact capability language — no fake Stripe / SLA % / Type II.
 */
function EnterpriseCommercialHonestyPanel({
  commercial
}: {
  commercial: EnterpriseCommercial;
}) {
  const auditDetail = [
    commercial.auditStreaming.detail,
    commercial.auditStreaming.maxExportEvents
      ? `Max export window: ${commercial.auditStreaming.maxExportEvents} events/export.`
      : null,
    commercial.auditStreaming.continuousStreamStatus
      ? `Continuous stream: ${commercial.auditStreaming.continuousStreamStatus}.`
      : null,
    commercial.auditStreaming.webhookCatalogNote ?? null
  ]
    .filter(Boolean)
    .join(" ");

  const rows: { label: string; status: string; detail: string }[] = [
    {
      label: "Payment settlement",
      status: commercial.paymentSettlement.status,
      detail: commercial.paymentSettlement.detail
    },
    {
      label: "Public SLA / status page",
      status: commercial.publicSlaStatusPage.status,
      detail: commercial.publicSlaStatusPage.detail
    },
    {
      label: "Audit → SIEM stream",
      status: commercial.auditStreaming.status,
      detail: auditDetail
    },
    {
      label: "Continuous SIEM audit stream",
      status:
        commercial.auditStreaming.continuousStreamStatus ?? "NotConfigured",
      detail:
        commercial.auditStreaming.webhookCatalogNote ??
        "Continuous SIEM-native audit streaming is NotConfigured."
    },
    {
      label: "Multi-region residency",
      status: commercial.multiRegionResidency.status,
      detail: commercial.multiRegionResidency.detail
    },
    {
      label: "Vendor SOC 2 Type II",
      status: commercial.vendorSoc2Attestation.status,
      detail: commercial.vendorSoc2Attestation.detail
    }
  ];

  return (
    <Panel>
      <PanelHeader
        title="Enterprise commercial honesty"
        actions={
          <StateBadge tone="approval" dot={false}>
            Residual — not fake certifications
          </StateBadge>
        }
      />
      <div className="flex flex-col gap-3 p-4">
        <p className="text-[13px] text-muted">
          Procurement answers for settlement, SLA, vendor attestation, and RFP
          scope. Prefer this disclosure over inventing Stripe, status-page
          uptime %, or Type II claims from product UI alone.
        </p>
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li
              key={row.label}
              className="rounded-control border border-line bg-surface px-3 py-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] text-ink">{row.label}</span>
                <StateBadge tone="inconclusive" dot={false}>
                  {row.status}
                </StateBadge>
              </div>
              <p className="mt-1 text-[12px] text-muted">{row.detail}</p>
            </li>
          ))}
        </ul>
        <div className="rounded-control border border-line bg-surface px-3 py-2 text-[12px] text-muted">
          <p className="font-medium text-ink">Default RFP scope</p>
          <p className="mt-1">{commercial.rfpDefaultScope.detail}</p>
          <p className="mt-2 text-[11px] text-subtle">
            Include: {commercial.rfpDefaultScope.includedSurfaces.join(" · ")}
          </p>
          <p className="mt-1 text-[11px] text-subtle">
            Exclude Labs unless contracted:{" "}
            {commercial.rfpDefaultScope.excludedLabsSurfaces.join(" · ")}
          </p>
          <p className="mt-2">
            Full pack:{" "}
            <span className="font-mono text-ink">docs/trust/README.md</span>
          </p>
        </div>
      </div>
    </Panel>
  );
}

/**
 * Trust-settings honesty for enterprise IdP lifecycle (P04-4 / P17-1 / PERISCAN-30).
 * Force-MFA and IdP group→role mapping ship; inbound SCIM / JIT remain NotConfigured.
 * Plane badge = Partial; SCIM/JIT rows = NotConfigured (never conflate).
 * Status strings come from the API honesty contract — not marketing copy.
 */
function IdentityLifecycleTrustPanel({
  identity
}: {
  identity: IdentityProvisioning;
}) {
  const policy = useApiResource(() => api.getTenantRequireMfa(), []);
  const effective = policy.data?.effectiveRequireMfa ?? false;
  const scimShipped = identity.scimInbound.status !== "NotConfigured";
  const jitShipped = identity.jitProvisioning.status !== "NotConfigured";
  const planeStatus = identity.planeStatus ?? "Partial";
  const orderFormDoc =
    identity.orderFormDoc ?? "docs/ENTERPRISE_IDENTITY_LIFECYCLE.md";
  const residualDoc =
    identity.residualDoc ?? "docs/ops/ENTERPRISE_TRUST_RESIDUAL_2026-07-31.md";

  return (
    <Panel data-testid="identity-lifecycle-trust-panel">
      <PanelHeader
        title="Identity & access control plane"
        actions={
          <StateBadge tone="approval" dot={false}>
            {planeStatus} — not full IdP lifecycle
          </StateBadge>
        }
      />
      <div className="flex flex-col gap-3 p-4">
        <p className="text-[13px] text-muted">
          This surface documents what Periscan actually enforces for{" "}
          <em>its own</em> users — not customer SaaS posture collected by
          connectors. Full enterprise joiner/mover/leaver automation is not
          claimed.
        </p>
        <p
          className="rounded-control border border-line bg-surface px-3 py-2 text-[12px] text-muted"
          data-testid="identity-plane-status-legend"
        >
          <strong className="text-ink">Status legend:</strong>{" "}
          <span className="font-mono text-ink">{planeStatus}</span> describes
          the overall control plane (SSO + force-MFA + IdP group→role map ship).{" "}
          <span className="font-mono text-ink">NotConfigured</span> is reserved
          for inbound SCIM and JIT — never relabel those rows as Partial or
          Production.{" "}
          {identity.planeStatusDetail ??
            "Do not claim full IdP lifecycle until membership SCIM ships."}
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          <li className="flex items-start gap-2 text-[13px]">
            <Flag ok label="SSO OIDC/SAML (pre-provisioned)" />
          </li>
          <li className="flex items-start gap-2 text-[13px]">
            <Flag ok={effective} label="Force-MFA (password auth)" />
          </li>
          <li className="flex items-start gap-2 text-[13px]">
            <Flag ok={scimShipped} label="Inbound SCIM for Periscan users" />
          </li>
          <li className="flex items-start gap-2 text-[13px]">
            <Flag ok={jitShipped} label="JIT membership on first SSO" />
          </li>
          <li className="flex items-start gap-2 text-[13px]">
            <Flag ok label="IdP group → role mapping (SSO config)" />
          </li>
          <li className="flex items-start gap-2 text-[13px]">
            <Flag
              ok={false}
              label="Automated deprovision SLA (product SCIM)"
            />
          </li>
        </ul>
        <ul className="flex flex-col gap-2">
          <li className="rounded-control border border-line bg-surface px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-ink">Inbound SCIM</span>
              <StateBadge tone="inconclusive" dot={false}>
                {identity.scimInbound.status}
              </StateBadge>
            </div>
            <p className="mt-1 text-[12px] text-muted">
              {identity.scimInbound.detail}
            </p>
            <p className="mt-1 text-[11px] text-subtle">
              Discovery stub:{" "}
              <span className="font-mono text-ink">
                {identity.scimInbound.discoveryPath}
              </span>{" "}
              (HTTP 501, not silent 404).{" "}
              {identity.scimInbound.inventoryConnectorsNote}
            </p>
          </li>
          <li className="rounded-control border border-line bg-surface px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-ink">JIT provisioning</span>
              <StateBadge tone="inconclusive" dot={false}>
                {identity.jitProvisioning.status}
              </StateBadge>
            </div>
            <p className="mt-1 text-[12px] text-muted">
              {identity.jitProvisioning.detail}
            </p>
          </li>
          <li className="rounded-control border border-line bg-surface px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-ink">RBAC</span>
              <StateBadge tone="inconclusive" dot={false}>
                {identity.advancedRbac.status}
              </StateBadge>
            </div>
            <p className="mt-1 text-[12px] text-muted">
              {identity.advancedRbac.detail}
            </p>
            <p className="mt-1 text-[11px] text-subtle">
              Roles: {identity.advancedRbac.availableRoles.join(" · ")}
            </p>
          </li>
        </ul>
        {policy.loading ? (
          <LoadingSkeleton rows={1} className="p-0" />
        ) : policy.error ? (
          <p className="text-[12px] text-subtle">
            Force-MFA policy status unavailable: {policy.error}
          </p>
        ) : (
          <p className="text-[12px] text-subtle">
            Force-MFA effective:{" "}
            <span className="font-mono text-ink">
              {effective ? "required" : "optional"}
            </span>
            {policy.data?.envRequireMfa
              ? " (deployment PERISCAN_REQUIRE_MFA)"
              : policy.data?.requireMfa
                ? " (tenant policy)"
                : ""}
            . Configure in{" "}
            <Link href="/admin" className="text-brand hover:text-brand-2">
              Admin
            </Link>
            .
          </p>
        )}
        <div
          className="rounded-control border border-line bg-surface px-3 py-2 text-[12px] text-muted"
          data-testid="identity-order-form-cta"
        >
          <p>
            <strong className="text-ink">Enterprise order-form next steps</strong>{" "}
            (≤3). Until inbound SCIM/JIT ship, do not invent SCIM Production.
          </p>
          <ol
            className="mt-1.5 list-decimal space-y-1 pl-4 text-[11px] text-subtle"
            data-testid="identity-order-form-next-steps"
          >
            <li>
              Paste sales-assisted provisioning SLA into every order form / DPA
              annex —{" "}
              <span className="font-mono text-ink">{orderFormDoc}</span>
            </li>
            <li>
              Keep SCIM / vendor Type II / pen-test residual honest
              NotConfigured —{" "}
              <span className="font-mono text-ink">{residualDoc}</span>
            </li>
            <li>
              Provision seats via{" "}
              <Link href="/admin" className="text-brand hover:text-brand-2">
                Admin · invites
              </Link>{" "}
              until inbound SCIM/JIT ships
            </li>
          </ol>
        </div>
        <p className="rounded-control border border-line bg-surface px-3 py-2 text-[12px] text-muted">
          <strong className="text-ink">Not SCIM for Periscan users.</strong> Any
          CyberArk or other connector SCIM path is read-only identity inventory
          for validation context. Sales-assisted invite remains the supported
          provisioning path until inbound SCIM/JIT ships.
        </p>
      </div>
    </Panel>
  );
}

/** E13 trust-pack surface: durable decisions + questionnaire kit pointers. */
function EnterpriseTrustPackPanel({
  marketPresence,
  dataGovernance,
  vendorAssurance
}: {
  marketPresence: MarketPresence;
  dataGovernance: TrustSafetySummary["dataGovernance"];
  vendorAssurance: TrustSafetySummary["vendorAssurance"];
}) {
  // ICP-P2-3: live API counters — keep honesty (real 0 refs = Fail), never invent logos.
  const refCount = marketPresence.publicReferenceCount;
  const marketStatus =
    refCount === 0
      ? "Zero references (fail)"
      : marketPresence.marketPresenceEligible
        ? `${refCount} public refs · eligible`
        : `${refCount} public refs · ${marketPresence.waveMarketPresenceGate}/${marketPresence.mqMarketPresenceGate}`;
  const marketDetail =
    refCount === 0
      ? `Public customer references = ${refCount} (API). Wave gate ${marketPresence.waveMarketPresenceGate}; MQ ${marketPresence.mqMarketPresenceGate}; peer ${marketPresence.peerDiligenceGate}. Logos ${marketPresence.publicLogoCount}, case studies ${marketPresence.publicCaseStudyCount}. ${marketPresence.disclaimer}`
      : `Public customer references = ${refCount} (API). Wave ${marketPresence.waveMarketPresenceGate}; MQ ${marketPresence.mqMarketPresenceGate}; peer ${marketPresence.peerDiligenceGate}. Logos ${marketPresence.publicLogoCount}, case studies ${marketPresence.publicCaseStudyCount}. ${marketPresence.disclaimer}`;

  const decisions: { label: string; status: string; detail: string }[] = [
    {
      label: "SCIM decision",
      status: "NotConfigured + sales-assisted SLA",
      detail:
        "Inbound SCIM 2.0 for Periscan memberships is not shipped (HTTP 501 discovery stubs — not Production). IdP plane is Partial (SSO/MFA/role map). Paste sales-assisted provisioning SLA into the enterprise order form (docs/ENTERPRISE_IDENTITY_LIFECYCLE.md; residual docs/ops/ENTERPRISE_TRUST_RESIDUAL_2026-07-31.md)."
    },
    {
      label: "Scorecard freeze",
      status: "External Leading frozen",
      detail:
        "Do not export internal Leading rows where the competitive matrix is Partial/Scaffold/Missing. Blind rescore gate: docs/DESIGN_PARTNER/BLIND_RESCORE_GATE.md."
    },
    {
      label: "Market presence / customer refs",
      status: marketStatus,
      detail: marketDetail
    },
    {
      label: "Vendor SOC 2 Type II",
      status:
        vendorAssurance.soc2TypeIiStatus === "None"
          ? "NotClaimed"
          : vendorAssurance.soc2TypeIiStatus,
      detail:
        vendorAssurance.detail ||
        "Customer control-evidence packs are not vendor Type II. Pair questionnaires with NDA-gated third-party assurance when required."
    }
  ];

  /**
   * Procurement checklist (P03): honest NotConfigured for DPA / pen-test /
   * subprocessors with doc pointers — never invent Type II or empty=none.
   */
  const packChecklist: Array<{
    id: string;
    label: string;
    status: string;
    tone: StateTone;
    detail: string;
    doc: string;
    href?: string | null;
  }> = [
    {
      id: "dpa",
      label: "DPA (data processing agreement)",
      status: dataGovernance.dpaStatus,
      tone:
        dataGovernance.dpaStatus === "Available" ? "fixed" : "inconclusive",
      detail:
        dataGovernance.dpaStatus === "Available"
          ? "Versioned DPA reference is configured for this deployment."
          : "NotConfigured — no in-product click-wrap DPA until operators publish a versioned PDF (PERISCAN_DPA_REFERENCE_URL).",
      doc: "docs/trust/LEGAL_PACK.md",
      href: dataGovernance.dpaReferenceUrl ?? null
    },
    {
      id: "baa",
      label: "BAA (business associate agreement)",
      status: dataGovernance.baaStatus,
      tone:
        dataGovernance.baaStatus === "Available" ? "fixed" : "inconclusive",
      detail:
        dataGovernance.baaStatus === "Available"
          ? "BAA reference is configured. Do not infer HIPAA eligibility from product alone."
          : "NotConfigured — customer-specific BAA stays env-linked when HIPAA is in scope.",
      doc: "docs/trust/LEGAL_PACK.md",
      href: dataGovernance.baaReferenceUrl ?? null
    },
    {
      id: "subprocessors",
      label: "Subprocessors disclosure",
      status: dataGovernance.subprocessorsStatus,
      tone:
        dataGovernance.subprocessorsStatus === "Configured"
          ? "fixed"
          : "inconclusive",
      detail:
        dataGovernance.subprocessorsStatus === "Configured"
          ? `${dataGovernance.subprocessors.length} subprocessor(s) listed for this deployment.`
          : dataGovernance.subprocessorsHonesty ||
            "Empty list means subprocessor disclosure is NotConfigured — not that Periscan has zero subprocessors.",
      doc: "docs/trust/LEGAL_PACK.md",
      href: null
    },
    {
      id: "pen-test",
      label: "Independent pen-test summary",
      status: "NotConfigured",
      tone: "inconclusive",
      detail:
        "No independent platform pen test completed in-repo. Engineering evidence (isolation matrix, SAST, result signing) is not a substitute. NDA-gated summary only after a real engagement.",
      doc: "docs/trust/PEN_TEST_ENGAGEMENT.md",
      href: null
    },
    {
      id: "vendor-soc2",
      label: "Vendor SOC 2 Type II",
      status:
        vendorAssurance.soc2TypeIiStatus === "None"
          ? "NotClaimed"
          : vendorAssurance.soc2TypeIiStatus,
      tone:
        vendorAssurance.soc2TypeIiStatus === "ReportUnderNda"
          ? "fixed"
          : "inconclusive",
      detail: vendorAssurance.customerEvidencePacksNote,
      doc: "docs/trust/VENDOR_COMPLIANCE.md",
      href: null
    }
  ];

  return (
    <Panel>
      <PanelHeader
        title="Enterprise trust pack"
        actions={
          <StateBadge tone="approval" dot={false}>
            Questionnaire kit — honesty first
          </StateBadge>
        }
      />
      <div className="flex flex-col gap-3 p-4">
        <p className="text-[13px] text-muted">
          Customer-facing security questionnaire kit and E13 enterprise trust
          decisions. Prefer exact product language over marketing.
        </p>

        <section
          aria-labelledby="trust-pack-checklist-heading"
          data-testid="trust-pack-checklist"
        >
          <h3
            id="trust-pack-checklist-heading"
            className="font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-subtle"
          >
            Procurement fill checklist
          </h3>
          <p className="mt-1 text-[12px] text-muted">
            Honest empty / NotConfigured until operators publish artifacts. Never
            invent Type II, pen-test letters, or empty-list-as-zero processors.
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {packChecklist.map((row) => (
              <li
                key={row.id}
                data-testid={`trust-pack-item-${row.id}`}
                className="rounded-control border border-line bg-surface px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] text-ink">{row.label}</span>
                  <StateBadge tone={row.tone} dot={false}>
                    {row.status}
                  </StateBadge>
                </div>
                <p className="mt-1 text-[12px] text-muted">{row.detail}</p>
                <p className="mt-1 text-[11px] text-subtle">
                  Doc:{" "}
                  <span className="font-mono text-ink">{row.doc}</span>
                  {row.href ? (
                    <>
                      {" · "}
                      <a
                        href={row.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand hover:text-brand-2"
                      >
                        Open published reference ↗
                      </a>
                    </>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <ul className="flex flex-col gap-2">
          {decisions.map((row) => (
            <li
              key={row.label}
              className="rounded-control border border-line bg-surface px-3 py-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] text-ink">{row.label}</span>
                <StateBadge tone="inconclusive" dot={false}>
                  {row.status}
                </StateBadge>
              </div>
              <p className="mt-1 text-[12px] text-muted">{row.detail}</p>
            </li>
          ))}
        </ul>
        <div className="rounded-control border border-line bg-surface px-3 py-2 text-[12px] text-muted">
          <p className="font-medium text-ink">Artifact set</p>
          <ul className="mt-1 list-inside list-disc text-[11px] text-subtle">
            <li>
              <span className="font-mono text-ink">docs/trust/README.md</span>{" "}
              — CAIQ/SIG answer bank + claim refuse list
            </li>
            <li>
              <span className="font-mono text-ink">docs/trust/LEGAL_PACK.md</span>{" "}
              — DPA / BAA / subprocessors honesty
            </li>
            <li>
              <span className="font-mono text-ink">
                docs/trust/PEN_TEST_ENGAGEMENT.md
              </span>{" "}
              — independent pen-test process (none completed in-repo)
            </li>
            <li>
              <span className="font-mono text-ink">
                docs/trust/VENDOR_COMPLIANCE.md
              </span>{" "}
              — vendor Type II status
            </li>
            <li>
              <span className="font-mono text-ink">
                docs/DESIGN_PARTNER/REFERENCE_PACK_CHECKLIST.md
              </span>{" "}
              — zero-ref market presence gate
            </li>
            <li>
              <span className="font-mono text-ink">
                docs/DESIGN_PARTNER/REFERENCE_FACTORY.md
              </span>{" "}
              — intake → proof → NDA reference rights → KPI
            </li>
            <li>
              In-product isolation proof:{" "}
              <Link
                href="/reports"
                className="text-brand hover:text-brand-2"
              >
                Reports
              </Link>{" "}
              (tenant-scoped, not vendor SOC 2)
            </li>
          </ul>
        </div>
      </div>
    </Panel>
  );
}

/** Productized prove / integrate / refuse language (P19-20) for SE/AE. */
function GtmClaimLanguagePanel() {
  const claims = getGtmClaimLanguageSummary();

  return (
    <Panel>
      <PanelHeader
        title="GTM claim language"
        actions={
          <StateBadge tone="fixed" dot={false}>
            Shared contract
          </StateBadge>
        }
      />
      <div className="flex flex-col gap-3 p-4">
        <p className="text-[13px] text-muted">
          Code-exported prove / integrate / refuse language so sales decks cannot
          drift from product truth. Source:{" "}
          <span className="font-mono text-ink">
            packages/shared/src/gtm-claim-language.ts
          </span>
          .
        </p>
        <div>
          <p className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
            Prove
          </p>
          <ul className="mt-1 list-inside list-disc text-[12px] text-muted">
            {claims.prove.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
            Integrate (never replace)
          </p>
          <ul className="mt-1 flex flex-col gap-1">
            {claims.integrate.map((row) => (
              <li
                key={row.plane}
                className="rounded-control border border-line bg-surface px-3 py-2 text-[12px]"
              >
                <span className="font-medium text-ink">{row.plane}</span>
                <span className="text-muted"> — {row.job}</span>
                <p className="mt-0.5 text-[11px] text-subtle">
                  Never: {row.never}
                </p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
            Refuse / substitute
          </p>
          <ul className="mt-1 flex flex-col gap-1">
            {/* Prefer market-presence / zero-ref denials + core safety freezes in the first slice. */}
            {(() => {
              const priority = claims.deny.filter((row) =>
                /logo|reference|leaders|market-presence|bas|ransomware|cnapp/i.test(
                  row.denied
                )
              );
              const rest = claims.deny.filter((row) => !priority.includes(row));
              return [...priority, ...rest].slice(0, 8);
            })().map((row) => (
              <li
                key={row.denied}
                className="rounded-control border border-line bg-surface px-3 py-2 text-[12px]"
              >
                <span className="text-missed">Deny:</span>{" "}
                <span className="text-ink">{row.denied}</span>
                <p className="mt-0.5 text-[11px] text-muted">
                  Say instead: {row.substitute}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-subtle">
            Full deny list:{" "}
            <span className="font-mono text-ink">{claims.denyListDoc}</span> ·
            matrix:{" "}
            <span className="font-mono text-ink">{claims.matrixSource}</span>
          </p>
        </div>
      </div>
    </Panel>
  );
}

function OffensiveValidationPanel() {
  const settings = useApiResource(() => api.getTenantSafetySettings(), []);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const data = settings.data;
  const enabled = data?.offensiveValidationEnabled ?? false;

  async function apply(next: boolean) {
    if (next && reference.trim().length === 0) {
      setError(
        "An authorization reference is required to enable offensive validation."
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.setOffensiveValidation(
        next
          ? { authorizationReference: reference.trim(), enabled: true }
          : { enabled: false }
      );
      setReference("");
      await settings.refetch();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Couldn't update authorization."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <PanelHeader
        title="Offensive validation authorization"
        actions={
          <StateBadge tone={enabled ? "missed" : "fixed"} dot={false}>
            {enabled ? "Authorized" : "Disabled"}
          </StateBadge>
        }
      />
      {settings.loading ? (
        <LoadingSkeleton rows={3} />
      ) : settings.error ? (
        <ErrorState message={settings.error} onRetry={settings.refetch} />
      ) : (
        <div className="flex flex-col gap-3 p-4">
          <p className="text-[13px] text-muted">
            Off by default. When authorized, adversarial (AdvancedAdversarial)
            validation may run so paths can be proven <em>Exploitable</em> with
            real evidence — still gated on per-run admin approval. The hard
            safety floor never lifts: Periscan never performs destructive
            actions, data exfiltration, persistence, credential theft, or
            uncontrolled exploit chaining, even when this is on.
          </p>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-control border border-line bg-surface px-3 py-2 text-[12px]">
            <span className="text-subtle">
              Effective ceiling:{" "}
              <span className="font-mono text-ink">
                {data?.effectiveMaxSafetyLevel ?? "BASLite"}
              </span>
            </span>
            {enabled && data?.authorizationReference ? (
              <span className="text-subtle">
                Attestation:{" "}
                <span className="font-mono text-ink">
                  {data.authorizationReference}
                </span>
              </span>
            ) : null}
            {enabled ? (
              <span className="text-subtle">
                authorized {relTime(data?.authorizedAt)}
              </span>
            ) : null}
          </div>

          {enabled ? (
            <div>
              <button
                type="button"
                onClick={() => apply(false)}
                disabled={busy}
                className={buttonClassName({
                  size: "sm",
                  variant: "secondary"
                })}
              >
                {busy ? "Revoking…" : "Revoke authorization"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <label className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
                Authorization reference (engagement / SOW / attestation)
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder="SOW-2026-014: authorized to run adversarial validation against owned assets"
                  aria-label="Authorization reference"
                  className="min-w-0 flex-1 rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none placeholder:text-subtle focus:border-line-strong"
                />
                <button
                  type="button"
                  onClick={() => apply(true)}
                  disabled={busy}
                  className={buttonClassName({ size: "sm", variant: "danger" })}
                >
                  {busy ? "Authorizing…" : "Authorize offensive validation"}
                </button>
              </div>
              <p className="text-[11px] text-subtle">
                Only a tenant admin can change this, and every change is
                audited.
              </p>
            </div>
          )}
          {error ? (
            <p className="text-[11px] text-[color:var(--color-blocked)]">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </Panel>
  );
}

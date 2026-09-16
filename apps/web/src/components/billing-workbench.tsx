"use client";

import { useState } from "react";

import type { BillingPackageKey } from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { useApiResource } from "../hooks/use-api-resource";
import {
  ErrorState,
  LoadingSkeleton,
  NotConfigured,
  Panel,
  PanelHeader,
  StateBadge,
  buttonClassName
} from "../ui";
import { SubscriptionOperationsRail } from "./subscription-operations-rail";

function contactHref(subject: string) {
  return `mailto:sales@periscan.com?subject=${encodeURIComponent(subject)}`;
}

function LimitRow({
  label,
  used,
  limit
}: {
  label: string;
  used: number;
  limit: number | null;
}) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const tone =
    limit && used > limit
      ? "missed"
      : limit && pct >= 80
        ? "approval"
        : "fixed";
  return (
    <div>
      <div className="flex items-center justify-between text-[12.5px]">
        <span className="text-muted">{label}</span>
        <span className="font-mono tabular-nums text-ink">
          {used}
          {limit != null ? (
            <span className="text-subtle"> / {limit}</span>
          ) : (
            <span className="text-subtle"> · no limit</span>
          )}
        </span>
      </div>
      {limit != null ? (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-pill bg-surface-strong">
          <span
            className="block h-full rounded-pill"
            style={{ width: `${pct}%`, background: `var(--color-${tone})` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().slice(0, 10);
}

export function BillingWorkbench() {
  const usage = useApiResource(() => api.getBillingUsage(), []);
  const active = useApiResource(() => api.getActiveBillingPackage(), []);
  const packages = useApiResource(() => api.getBillingPackages(), []);
  const limits = useApiResource(() => api.getBillingLimits(), []);
  const trial = useApiResource(() => api.getTenantTrial(), []);
  const marketplace = useApiResource(() => api.getAwsMarketplaceStatus(), []);
  const [trialAccepted, setTrialAccepted] = useState(false);
  const [trialBusy, setTrialBusy] = useState(false);
  const [trialError, setTrialError] = useState<string | null>(null);
  const [conversionReference, setConversionReference] = useState("");
  const [conversionPackage, setConversionPackage] =
    useState<BillingPackageKey>("CoreValidation");
  const [marketplaceClaimToken, setMarketplaceClaimToken] = useState(() => {
    if (typeof window === "undefined") return "";
    const fragment = window.location.hash.replace(/^#/u, "");
    return new URLSearchParams(fragment).get("awsMarketplaceClaim") ?? "";
  });
  const [marketplaceBusy, setMarketplaceBusy] = useState<string | null>(null);
  const [marketplaceError, setMarketplaceError] = useState<string | null>(null);
  const [marketplaceMessage, setMarketplaceMessage] = useState<string | null>(
    null
  );

  async function startTrial() {
    if (!trialAccepted) return;
    setTrialBusy(true);
    setTrialError(null);
    try {
      await api.startTenantTrial({
        agreementAccepted: true,
        durationDays: 14,
        retentionDays: 30
      });
      await Promise.all([trial.refetch(), active.refetch()]);
    } catch (caught) {
      setTrialError(
        caught instanceof Error ? caught.message : "Unable to start trial."
      );
    } finally {
      setTrialBusy(false);
    }
  }

  async function convertTrial() {
    if (!conversionReference.trim()) return;
    setTrialBusy(true);
    setTrialError(null);
    try {
      await api.convertTenantTrial({
        approvalReference: conversionReference.trim(),
        packageKey: conversionPackage
      });
      await Promise.all([trial.refetch(), active.refetch()]);
    } catch (caught) {
      setTrialError(
        caught instanceof Error
          ? caught.message
          : "Unable to record conversion."
      );
    } finally {
      setTrialBusy(false);
    }
  }

  async function cancelTrial() {
    if (!window.confirm("Cancel the active trial and restore the prior plan?"))
      return;
    setTrialBusy(true);
    setTrialError(null);
    try {
      await api.cancelTenantTrial({
        reason: "Cancelled by tenant administrator"
      });
      await Promise.all([trial.refetch(), active.refetch()]);
    } catch (caught) {
      setTrialError(
        caught instanceof Error ? caught.message : "Unable to cancel trial."
      );
    } finally {
      setTrialBusy(false);
    }
  }

  async function runMarketplaceAction(
    key: string,
    action: () => Promise<unknown>,
    success: string
  ) {
    setMarketplaceBusy(key);
    setMarketplaceError(null);
    setMarketplaceMessage(null);
    try {
      await action();
      await Promise.all([
        marketplace.refetch(),
        active.refetch(),
        usage.refetch()
      ]);
      setMarketplaceMessage(success);
    } catch (caught) {
      setMarketplaceError(
        caught instanceof Error
          ? caught.message
          : "AWS Marketplace action failed."
      );
    } finally {
      setMarketplaceBusy(null);
    }
  }

  async function claimMarketplacePurchase() {
    if (!marketplaceClaimToken.trim()) return;
    await runMarketplaceAction(
      "claim",
      () =>
        api.claimAwsMarketplaceRegistration({
          claimToken: marketplaceClaimToken.trim()
        }),
      "AWS Marketplace purchase attached; entitlement state is now visible."
    );
    setMarketplaceClaimToken("");
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${window.location.search}`
    );
  }

  // Schema hardcodes paymentProcessorStatus: "NotConfigured". Wartime honesty:
  // never hide the sales-led boundary because an active plan is missing, still
  // loading, or a package status reads "Available" (entitlement readiness ≠ bank).
  const paymentProcessorConfigured = [
    active.data?.paymentProcessorStatus,
    ...(packages.data ?? []).map((pkg) => pkg.paymentProcessorStatus)
  ].some((status) => status != null && status !== "NotConfigured");
  const paymentProcessorNotConfigured = !paymentProcessorConfigured;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-6">
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
          Govern · Billing
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Billing &amp; usage
        </h1>
        <p className="max-w-2xl text-sm text-muted">
          Metered usage and entitlement ledger for this workspace — not a
          self-serve checkout. Plan changes are invoice / approval-reference
          design partners only while the payment processor remains NotConfigured.
        </p>
      </header>

      {paymentProcessorNotConfigured ? (
        <section
          aria-label="Sales-led billing"
          className="rounded-card border border-approval/50 bg-approval/10 p-5 sm:p-6"
          data-testid="billing-sales-led-banner"
          role="status"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 max-w-3xl">
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-approval">
                Payment processor · NotConfigured
              </p>
              <h2 className="mt-1.5 font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl">
                Sales-led billing — no card checkout
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                This workspace meters usage and records entitlements against
                your plan. It does not collect card details, start self-serve
                checkout, charge tax, or issue invoices. Commercial path:
                invoice and approval-reference design partners only. An
                active package or package status of Available means
                entitlements, not a banked purchase.
              </p>
            </div>
            <a
              href={contactHref("Sales-led billing inquiry")}
              className={buttonClassName({
                variant: "primary",
                className: "shrink-0 self-start"
              })}
              aria-label="Contact sales about billing"
            >
              Contact sales
            </a>
          </div>
        </section>
      ) : null}

      {/* Active plan */}
      <Panel>
        <PanelHeader title="Your plan" />
        {active.loading ? (
          <LoadingSkeleton rows={2} />
        ) : active.error ? (
          <ErrorState message={active.error} onRetry={active.refetch} />
        ) : !active.data ? (
          <div className="p-4">
            <NotConfigured
              title="No active plan"
              message="Usage may still be metered, but no entitlement package is attached. This is not a silent free plan or completed purchase — attach a reviewed package via sales or a direct-agreement term."
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-base font-semibold text-ink">
                {active.data.label}
              </span>
              <StateBadge tone="brand" dot={false}>
                {active.data.status}
              </StateBadge>
              {active.data.paymentProcessorStatus === "NotConfigured" ? (
                <a
                  href={contactHref(`Connect billing for ${active.data.label}`)}
                  aria-label="Contact Periscan to connect billing"
                >
                  <StateBadge tone="inconclusive" dot={false}>
                    Payment processor · NotConfigured
                  </StateBadge>
                </a>
              ) : null}
            </div>
            <p className="max-w-2xl text-[13px] text-muted">
              {active.data.description}
            </p>
            <p className="text-[12px] text-subtle">
              {active.data.publicPricingLanguage}
            </p>
          </div>
        )}
      </Panel>

      <SubscriptionOperationsRail />

      <Panel>
        <PanelHeader
          title="AWS Marketplace"
          actions={
            marketplace.data ? (
              <StateBadge
                dot={false}
                tone={
                  marketplace.data.publicMarketplaceAvailabilityProven
                    ? "fixed"
                    : marketplace.data.configured
                      ? "approval"
                      : "inconclusive"
                }
              >
                {marketplace.data.listingState}
              </StateBadge>
            ) : null
          }
        />
        {marketplace.loading ? (
          <LoadingSkeleton rows={3} />
        ) : marketplace.error ? (
          <ErrorState
            message={marketplace.error}
            onRetry={marketplace.refetch}
          />
        ) : marketplace.data ? (
          <div
            className="grid gap-4 p-4 lg:grid-cols-[1fr_auto]"
            data-testid="billing-marketplace-panel"
          >
            <div>
              <p className="text-sm font-medium text-ink">
                {marketplace.data.subscription
                  ? `Subscription ${marketplace.data.subscription.status}`
                  : marketplace.data.publicMarketplaceAvailabilityProven
                    ? "Public Marketplace offer (ops-attested)"
                    : marketplace.data.configured
                      ? "SaaS integration ready for a limited listing"
                      : "Seller integration not configured"}
              </p>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">
                Buyer registration resolves through AWS, entitlements are
                refreshed fail-closed, and the previous completed hour is sent
                with license-aware, idempotent metering records. A ready API
                integration does not prove seller approval or public listing.
                Listing state {marketplace.data.listingState}
                {marketplace.data.publicMarketplaceAvailabilityProven
                  ? " with independent public reachability proven."
                  : " — publicMarketplaceAvailabilityProven is false; do not claim a live public Marketplace offer or invent listing URLs."}
              </p>
              {!marketplace.data.configured ||
              marketplace.data.listingState === "NotConfigured" ? (
                <p
                  className="mt-2 rounded-control border border-line bg-surface px-3 py-2 text-xs leading-5 text-muted"
                  data-testid="billing-marketplace-not-configured"
                >
                  Marketplace listing · NotConfigured. Application integration
                  and seller-portal publication are separate. Contact sales for
                  procurement; product does not expose a public offer URL while
                  listing is not configured.
                </p>
              ) : null}
              {marketplace.data.subscription ? (
                <div className="mt-3 grid gap-1 text-xs text-subtle sm:grid-cols-2">
                  <span>
                    Buyer{" "}
                    {marketplace.data.subscription.customerAwsAccountIdMasked}
                  </span>
                  <span>
                    License {marketplace.data.subscription.licenseArnMasked}
                  </span>
                  <span>
                    {marketplace.data.subscription.entitlements.length}{" "}
                    entitlement
                    {marketplace.data.subscription.entitlements.length === 1
                      ? ""
                      : "s"}
                  </span>
                  <span>
                    Last metered{" "}
                    {marketplace.data.subscription.lastMeteredAt
                      ? fmtDate(marketplace.data.subscription.lastMeteredAt)
                      : "never"}
                  </span>
                </div>
              ) : null}
              {marketplace.data.recentMeteringRecords.length > 0 ? (
                <p className="mt-2 font-mono text-[10px] text-subtle">
                  Latest: {marketplace.data.recentMeteringRecords[0]?.dimension}{" "}
                  · {marketplace.data.recentMeteringRecords[0]?.status} ·{" "}
                  {marketplace.data.recentMeteringRecords[0]?.quantity}
                </p>
              ) : null}
            </div>
            <div className="flex min-w-64 flex-col gap-2">
              {!marketplace.data.subscription ? (
                <>
                  <input
                    aria-label="AWS Marketplace claim token"
                    className="h-10 rounded-control border border-line bg-surface px-3 font-mono text-xs text-ink placeholder:text-subtle"
                    onChange={(event) =>
                      setMarketplaceClaimToken(event.target.value)
                    }
                    placeholder="Claim token from AWS redirect"
                    value={marketplaceClaimToken}
                  />
                  <button
                    className={buttonClassName({ variant: "primary" })}
                    disabled={
                      !marketplace.data.configured ||
                      marketplaceBusy !== null ||
                      marketplaceClaimToken.trim().length < 32
                    }
                    onClick={claimMarketplacePurchase}
                    type="button"
                  >
                    {marketplaceBusy === "claim"
                      ? "Attaching…"
                      : "Attach purchase"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    className={buttonClassName({ variant: "secondary" })}
                    disabled={marketplaceBusy !== null}
                    onClick={() =>
                      runMarketplaceAction(
                        "refresh",
                        () => api.refreshAwsMarketplaceEntitlements(),
                        "AWS entitlement state refreshed."
                      )
                    }
                    type="button"
                  >
                    {marketplaceBusy === "refresh"
                      ? "Refreshing…"
                      : "Refresh entitlements"}
                  </button>
                  <button
                    className={buttonClassName({ variant: "primary" })}
                    disabled={
                      marketplaceBusy !== null ||
                      marketplace.data.subscription.status !== "Active" ||
                      marketplace.data.dimensionMappings.length === 0
                    }
                    onClick={() =>
                      runMarketplaceAction(
                        "meter",
                        () => api.syncAwsMarketplaceMetering(),
                        "Previous completed hour synchronized with AWS."
                      )
                    }
                    type="button"
                  >
                    {marketplaceBusy === "meter"
                      ? "Syncing…"
                      : "Sync completed hour"}
                  </button>
                </>
              )}
            </div>
          </div>
        ) : null}
        {marketplaceError ? (
          <p className="px-4 pb-4 text-sm text-missed" role="alert">
            {marketplaceError}
          </p>
        ) : null}
        {marketplaceMessage ? (
          <p className="px-4 pb-4 text-sm text-fixed">{marketplaceMessage}</p>
        ) : null}
      </Panel>

      <Panel>
        <PanelHeader
          title="Time-boxed trial"
          actions={
            trial.data ? (
              <StateBadge
                dot={false}
                tone={
                  trial.data.status === "Active"
                    ? "approval"
                    : trial.data.status === "Converted"
                      ? "fixed"
                      : trial.data.status === "Expired" ||
                          trial.data.status === "Cancelled"
                        ? "inconclusive"
                        : "neutral"
                }
              >
                {trial.data.status}
              </StateBadge>
            ) : null
          }
        />
        {trial.loading ? (
          <LoadingSkeleton rows={3} />
        ) : trial.error ? (
          <ErrorState message={trial.error} onRetry={trial.refetch} />
        ) : trial.data?.status === "NotStarted" ? (
          <div className="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <p className="text-sm font-medium text-ink">
                14 days of Enterprise entitlements
              </p>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">
                One trial per tenant. It expires automatically, restores the
                current plan, and schedules trial-only data review after a
                30-day retention window. No card is collected and no payment
                processor is invoked.
              </p>
              <label className="mt-3 flex items-start gap-2 text-xs text-muted">
                <input
                  checked={trialAccepted}
                  className="mt-0.5 size-4 accent-brand"
                  onChange={(event) => setTrialAccepted(event.target.checked)}
                  type="checkbox"
                />
                I understand the time limit, one-trial rule, entitlement
                rollback, and retention policy.
              </label>
            </div>
            <button
              className={buttonClassName({ variant: "primary" })}
              disabled={!trialAccepted || trialBusy}
              onClick={startTrial}
              type="button"
            >
              {trialBusy ? "Starting…" : "Start 14-day trial"}
            </button>
          </div>
        ) : trial.data?.status === "Active" ? (
          <div className="grid gap-5 p-4 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="font-display text-3xl font-semibold text-approval">
                {trial.data.remainingDays} days
              </p>
              <p className="mt-1 text-xs text-muted">
                Ends{" "}
                {trial.data.endsAt
                  ? fmtDate(trial.data.endsAt)
                  : "at the recorded deadline"}
                . Prior plan: {trial.data.previousBillingPackageKey ?? "none"}.
              </p>
              <p className="mt-2 text-xs text-subtle">
                If it ends without conversion, prior entitlements are restored
                and data review is scheduled after {trial.data.retentionDays}{" "}
                days.
              </p>
              <button
                className="mt-4 text-xs font-medium text-missed underline underline-offset-4"
                disabled={trialBusy}
                onClick={cancelTrial}
                type="button"
              >
                Cancel trial and restore prior plan
              </button>
            </div>
            <div className="rounded-card border border-line bg-surface p-4">
              <p className="text-sm font-medium text-ink">
                Record an approved conversion
              </p>
              <p className="mt-1 text-xs text-muted">
                Use only after pricing, tax, support, order-form, and
                data-processing approvals are complete. This records entitlement
                state; it does not process payment.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-[0.8fr_1fr_auto]">
                <select
                  className="h-10 rounded-control border border-line bg-surface px-3 text-sm text-ink"
                  onChange={(event) =>
                    setConversionPackage(
                      event.target.value as BillingPackageKey
                    )
                  }
                  value={conversionPackage}
                >
                  {(packages.data ?? []).map((pkg) => (
                    <option key={pkg.packageKey} value={pkg.packageKey}>
                      {pkg.label}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="Commercial approval reference"
                  className="h-10 rounded-control border border-line bg-surface px-3 text-sm text-ink placeholder:text-subtle"
                  onChange={(event) =>
                    setConversionReference(event.target.value)
                  }
                  placeholder="Approved order-form reference"
                  value={conversionReference}
                />
                <button
                  className={buttonClassName({ variant: "secondary" })}
                  disabled={trialBusy || conversionReference.trim().length < 3}
                  onClick={convertTrial}
                  type="button"
                >
                  Record conversion
                </button>
              </div>
            </div>
          </div>
        ) : trial.data ? (
          <div className="p-4 text-sm text-muted">
            <p>
              Trial {trial.data.status.toLowerCase()}.
              {trial.data.deletionScheduledAt
                ? ` Trial-data review is scheduled for ${fmtDate(trial.data.deletionScheduledAt)}.`
                : ""}
            </p>
            {trial.data.conversionApprovalReference ? (
              <p className="mt-1 font-mono text-xs text-subtle">
                Approval: {trial.data.conversionApprovalReference}
              </p>
            ) : null}
          </div>
        ) : null}
        {trialError ? (
          <p role="alert" className="px-4 pb-4 text-sm text-missed">
            {trialError}
          </p>
        ) : null}
      </Panel>

      {/* Limits */}
      <Panel>
        <PanelHeader
          title="Usage against limits"
          actions={
            limits.data ? (
              <StateBadge
                tone={limits.data.withinLimits ? "fixed" : "missed"}
                dot={false}
              >
                {limits.data.withinLimits ? "Within limits" : "Over a limit"}
              </StateBadge>
            ) : null
          }
        />
        {limits.loading ? (
          <LoadingSkeleton rows={3} />
        ) : limits.error ? (
          <ErrorState message={limits.error} onRetry={limits.refetch} />
        ) : limits.data ? (
          <div className="flex flex-col gap-3 p-4">
            <LimitRow
              label="Missions this month"
              used={limits.data.usage.missionsThisMonth}
              limit={limits.data.limits.missionsPerMonth}
            />
            <LimitRow
              label="Runners"
              used={limits.data.usage.runners}
              limit={limits.data.limits.runners}
            />
            <LimitRow
              label="Evidence artifacts"
              used={limits.data.usage.evidenceArtifacts}
              limit={limits.data.limits.evidenceArtifacts}
            />
          </div>
        ) : null}
      </Panel>

      {/* Usage meters */}
      <Panel>
        <PanelHeader
          title="Usage this period"
          actions={
            usage.data ? (
              <span className="font-mono text-[11px] text-subtle">
                {fmtDate(usage.data.meteringPeriodStart)} →{" "}
                {fmtDate(usage.data.meteringPeriodEnd)}
              </span>
            ) : null
          }
        />
        {usage.loading ? (
          <LoadingSkeleton rows={4} />
        ) : usage.error ? (
          <ErrorState message={usage.error} onRetry={usage.refetch} />
        ) : (usage.data?.meters ?? []).length === 0 ? (
          <p className="px-4 py-6 text-sm text-subtle">
            No usage recorded yet.
          </p>
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {(usage.data?.meters ?? []).map((meter) => (
              <div
                key={meter.meterName}
                className="rounded-card border border-line bg-surface p-3.5"
              >
                <p className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
                  {meter.label}
                </p>
                <p
                  className="mt-1.5 font-mono text-2xl font-semibold"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {meter.quantity}
                  <span className="ml-1 text-[11px] font-normal text-subtle">
                    {meter.unit}
                  </span>
                </p>
                <p className="mt-1 line-clamp-2 text-[11.5px] text-muted">
                  {meter.description}
                </p>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Plans catalog */}
      <Panel>
        <PanelHeader title="Plans" />
        {packages.loading ? (
          <LoadingSkeleton rows={3} />
        ) : packages.error ? (
          <ErrorState message={packages.error} onRetry={packages.refetch} />
        ) : (packages.data ?? []).length === 0 ? (
          <p className="px-4 py-6 text-sm text-subtle">No plans published.</p>
        ) : (
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {(packages.data ?? []).map((pkg) => (
              <div
                key={pkg.packageKey}
                className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4"
                data-testid={`billing-package-card-${pkg.packageKey}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-[15px] font-semibold text-ink">
                    {pkg.label}
                  </span>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <StateBadge
                      tone={
                        active.data?.packageKey === pkg.packageKey
                          ? "fixed"
                          : "neutral"
                      }
                      dot={false}
                    >
                      {active.data?.packageKey === pkg.packageKey
                        ? "Current"
                        : pkg.status}
                    </StateBadge>
                    {pkg.paymentProcessorStatus === "NotConfigured" ? (
                      <StateBadge tone="inconclusive" dot={false}>
                        NotConfigured
                      </StateBadge>
                    ) : null}
                  </div>
                </div>
                <p className="text-[12.5px] text-muted">{pkg.description}</p>
                <ul className="mt-1 flex flex-col gap-1 text-[12px] text-muted">
                  {pkg.includedCapabilities.slice(0, 4).map((cap) => (
                    <li key={cap} className="flex gap-1.5">
                      <span aria-hidden className="text-fixed">
                        ✓
                      </span>
                      {cap}
                    </li>
                  ))}
                </ul>
                <p className="mt-auto pt-1 text-[11px] text-subtle">
                  {pkg.publicPricingLanguage}
                </p>
                <a
                  href={contactHref(
                    `${active.data?.packageKey === pkg.packageKey ? "Manage" : "Discuss"} ${pkg.label} plan`
                  )}
                  className={buttonClassName({
                    size: "sm",
                    variant:
                      active.data?.packageKey === pkg.packageKey
                        ? "secondary"
                        : "primary"
                  })}
                  aria-label={`Talk to sales about ${pkg.label}`}
                >
                  {active.data?.packageKey === pkg.packageKey
                    ? "Manage with sales"
                    : pkg.status === "ContactSales"
                      ? "Talk to sales"
                      : "Discuss this plan"}
                </a>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

import type {
  BillingPackageKey,
  SubscriptionLifecycleStatus
} from "@periscan/shared";

import { useApiResource } from "../hooks/use-api-resource";
import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import {
  ConfirmDialog,
  ErrorState,
  LoadingSkeleton,
  StateBadge,
  buttonClassName,
  cn,
  type StateTone
} from "../ui";

const inputClass =
  "h-10 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none placeholder:text-subtle focus:border-brand";
const statusTone: Record<SubscriptionLifecycleStatus, StateTone> = {
  Active: "fixed",
  Ended: "inconclusive",
  GracePeriod: "approval",
  NonRenewing: "missed"
};

function dateValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(value));
}

export function SubscriptionOperationsRail() {
  const workspace = useApiResource(
    () => api.getSubscriptionOperationsWorkspace(),
    []
  );
  const packages = useApiResource(() => api.getBillingPackages(), []);
  const [packageKey, setPackageKey] = useState<BillingPackageKey>("Enterprise");
  const [agreementReference, setAgreementReference] = useState("");
  const [supportOwnerEmail, setSupportOwnerEmail] = useState("");
  const [termEnd, setTermEnd] = useState(() => {
    const end = new Date();
    end.setUTCFullYear(end.getUTCFullYear() + 1);
    return dateValue(end);
  });
  const [renewalLeadDays, setRenewalLeadDays] = useState(60);
  const [reason, setReason] = useState(
    "Reviewed against the approved agreement, support, and entitlement scope."
  );
  const [renewalReference, setRenewalReference] = useState("");
  const [termMonths, setTermMonths] = useState(12);
  const [graceReference, setGraceReference] = useState("");
  const [graceDays, setGraceDays] = useState(14);
  const [cancellationReference, setCancellationReference] = useState("");
  const [confirmCancellation, setConfirmCancellation] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (
      packages.data &&
      !packages.data.some((item) => item.packageKey === packageKey)
    ) {
      setPackageKey(packages.data[0]?.packageKey ?? "Enterprise");
    }
  }, [packageKey, packages.data]);

  async function run(
    key: string,
    action: () => Promise<unknown>,
    success: string
  ) {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      await action();
      await workspace.refetch();
      setMessage(success);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The subscription action did not complete."
      );
    } finally {
      setBusy(null);
    }
  }

  async function createLifecycle() {
    const endsAt = new Date(`${termEnd}T23:59:59.000Z`).toISOString();
    await run(
      "create",
      () =>
        api.createSubscriptionLifecycle({
          agreementReference: agreementReference.trim(),
          endsAt,
          packageKey,
          renewalLeadDays,
          source: "DirectAgreement",
          supportOwnerEmail: supportOwnerEmail.trim()
        }),
      "Subscription term recorded; entitlements now follow the reviewed agreement."
    );
  }

  async function recordDecision(decision: "Approve" | "Decline") {
    await run(
      `renewal-${decision}`,
      () =>
        decision === "Approve"
          ? api.recordSubscriptionRenewal({
              agreementReference: renewalReference.trim(),
              decision,
              packageKey,
              reason: reason.trim(),
              termMonths
            })
          : api.recordSubscriptionRenewal({
              decision,
              reason: reason.trim()
            }),
      decision === "Approve"
        ? "Renewal approved and scheduled at the immutable term boundary."
        : "Non-renewal recorded; current entitlements remain active through term end."
    );
  }

  async function scheduleCancellation() {
    await run(
      "cancel",
      () =>
        api.scheduleSubscriptionCancellation({
          cancellationReference: cancellationReference.trim(),
          reason: reason.trim()
        }),
      "Cancellation scheduled at term end; access was not removed early."
    );
    setConfirmCancellation(false);
  }

  const lifecycle = workspace.data?.subscription ?? null;
  const currentPeriod = workspace.data?.currentPeriod ?? null;
  const scheduledPeriod = workspace.data?.periods.find(
    (period) => period.status === "Scheduled"
  );
  const canReconcile =
    Boolean(lifecycle && currentPeriod) &&
    (lifecycle?.status === "NonRenewing" ||
      (lifecycle?.status === "GracePeriod" &&
        Boolean(
          lifecycle.graceEndsAt &&
          new Date(lifecycle.graceEndsAt).getTime() <= Date.now()
        )) ||
      Boolean(
        scheduledPeriod &&
        new Date(scheduledPeriod.startsAt).getTime() <= Date.now()
      ));

  return (
    <section
      aria-labelledby="subscription-operations-heading"
      className="border-y border-line py-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-2">
            Subscription operations · direct agreement
          </p>
          <h2
            className="mt-1 font-display text-lg font-semibold text-ink"
            id="subscription-operations-heading"
          >
            Renewal continuity
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            Govern term boundaries, usage close, grace, and cancellation without
            presenting payment, tax, or procurement as configured.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {lifecycle ? (
            <StateBadge dot={false} tone={statusTone[lifecycle.status]}>
              {lifecycle.status}
            </StateBadge>
          ) : null}
          <StateBadge
            dot={false}
            tone={workspace.data?.chainValid ? "fixed" : "missed"}
          >
            {workspace.data?.chainValid ? "Ledger verified" : "Ledger mismatch"}
          </StateBadge>
          {workspace.data?.paymentProcessorStatus === "NotConfigured" ||
          !workspace.data ? (
            <StateBadge
              data-testid="subscription-payment-processor-status"
              dot={false}
              tone="inconclusive"
            >
              Payment processor · NotConfigured
            </StateBadge>
          ) : null}
        </div>
      </div>

      {workspace.loading && !workspace.data ? (
        <div className="mt-5">
          <LoadingSkeleton rows={4} />
        </div>
      ) : workspace.error ? (
        <div className="mt-5">
          <ErrorState message={workspace.error} onRetry={workspace.refetch} />
        </div>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-missed" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-4 text-sm text-fixed" role="status">
          {message}
        </p>
      ) : null}

      {!lifecycle && workspace.data ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.72fr)]">
          <div>
            <h3 className="text-sm font-semibold text-ink">
              Start the term ledger
            </h3>
            <p className="mt-1 text-xs leading-5 text-muted">
              Record only a commercially approved agreement. This changes
              entitlement state but never charges a payment method.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <select
                aria-label="Subscription package"
                className={inputClass}
                onChange={(event) =>
                  setPackageKey(event.target.value as BillingPackageKey)
                }
                value={packageKey}
              >
                {(packages.data ?? []).map((item) => (
                  <option key={item.packageKey} value={item.packageKey}>
                    {item.label}
                  </option>
                ))}
              </select>
              <input
                aria-label="Agreement reference"
                className={inputClass}
                onChange={(event) => setAgreementReference(event.target.value)}
                placeholder="Approved order-form reference"
                value={agreementReference}
              />
              <input
                aria-label="Subscription support owner email"
                className={inputClass}
                onChange={(event) => setSupportOwnerEmail(event.target.value)}
                placeholder="success@example.com"
                type="email"
                value={supportOwnerEmail}
              />
              <input
                aria-label="Subscription term end"
                className={inputClass}
                onChange={(event) => setTermEnd(event.target.value)}
                type="date"
                value={termEnd}
              />
              <label className="text-xs text-muted">
                Renewal lead days
                <input
                  aria-label="Renewal lead days"
                  className={cn(inputClass, "mt-1")}
                  max={180}
                  min={7}
                  onChange={(event) =>
                    setRenewalLeadDays(Number(event.target.value))
                  }
                  type="number"
                  value={renewalLeadDays}
                />
              </label>
            </div>
            <button
              className={cn(buttonClassName({ variant: "primary" }), "mt-3")}
              disabled={
                busy !== null ||
                agreementReference.trim().length < 3 ||
                !supportOwnerEmail.includes("@")
              }
              onClick={() => void createLifecycle()}
              type="button"
            >
              {busy === "create" ? "Recording…" : "Record subscription term"}
            </button>
          </div>
          <aside className="border-l border-line pl-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
              Commercial boundary
            </p>
            <p className="mt-2 text-sm leading-6 text-muted">
              {workspace.data.commercialBoundary}
            </p>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-wide text-approval">
              Payment processor · Not configured
            </p>
          </aside>
        </div>
      ) : null}

      {lifecycle && workspace.data ? (
        <>
          <div className="mt-5 grid gap-4 border-b border-line pb-5 sm:grid-cols-4">
            <div>
              <p className="font-mono text-xl text-ink">
                {workspace.data.daysRemaining}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-subtle">
                Days remaining
              </p>
            </div>
            <div>
              <p className="font-mono text-sm text-ink">
                {lifecycle.packageKey}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-subtle">
                Entitlement package
              </p>
            </div>
            <div>
              <p className="font-mono text-sm text-ink">
                {formatDate(currentPeriod?.endsAt)}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-subtle">
                Term boundary
              </p>
            </div>
            <div>
              <p className="font-mono text-sm text-ink">
                {lifecycle.renewalDecision}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-subtle">
                Renewal decision
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(19rem,0.88fr)]">
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-ink">
                  Renewal checkpoints
                </h3>
                <span className="font-mono text-[10px] text-subtle">
                  term v{lifecycle.version}
                </span>
              </div>
              <ol
                aria-label="Subscription renewal checkpoints"
                className="mt-3 grid grid-cols-4"
              >
                {workspace.data.renewalCheckpoints.map((checkpoint, index) => (
                  <li className="relative pr-2" key={checkpoint.daysBeforeEnd}>
                    <div
                      className={cn(
                        "absolute left-2 top-[7px] h-px w-full",
                        checkpoint.state === "Complete"
                          ? "bg-brand"
                          : "bg-line",
                        index ===
                          workspace.data!.renewalCheckpoints.length - 1 &&
                          "hidden"
                      )}
                    />
                    <span
                      className={cn(
                        "relative block size-3.5 rounded-full border-2 bg-canvas",
                        checkpoint.state === "Complete"
                          ? "border-brand"
                          : checkpoint.state === "Due" ||
                              checkpoint.state === "Overdue"
                            ? "border-approval"
                            : "border-line"
                      )}
                    />
                    <span className="mt-2 block text-[10px] leading-4 text-subtle">
                      {checkpoint.label}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="mt-4 border-l-2 border-brand pl-3 text-sm leading-6 text-muted">
                {workspace.data.nextAction}
              </p>

              {lifecycle.status !== "Ended" &&
              lifecycle.status !== "GracePeriod" ? (
                <div className="mt-5 border-t border-line pt-4">
                  <h3 className="text-sm font-semibold text-ink">
                    Record renewal decision
                  </h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <select
                      aria-label="Renewal package"
                      className={inputClass}
                      onChange={(event) =>
                        setPackageKey(event.target.value as BillingPackageKey)
                      }
                      value={packageKey}
                    >
                      {(packages.data ?? []).map((item) => (
                        <option key={item.packageKey} value={item.packageKey}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    <input
                      aria-label="Renewal agreement reference"
                      className={inputClass}
                      onChange={(event) =>
                        setRenewalReference(event.target.value)
                      }
                      placeholder="Approved renewal reference"
                      value={renewalReference}
                    />
                    <input
                      aria-label="Renewal term months"
                      className={inputClass}
                      max={36}
                      min={1}
                      onChange={(event) =>
                        setTermMonths(Number(event.target.value))
                      }
                      type="number"
                      value={termMonths}
                    />
                    <input
                      aria-label="Subscription governance reason"
                      className={inputClass}
                      onChange={(event) => setReason(event.target.value)}
                      value={reason}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className={buttonClassName({ variant: "primary" })}
                      disabled={
                        busy !== null || renewalReference.trim().length < 3
                      }
                      onClick={() => void recordDecision("Approve")}
                      type="button"
                    >
                      Approve next term
                    </button>
                    <button
                      className={buttonClassName({ variant: "secondary" })}
                      disabled={busy !== null || reason.trim().length < 10}
                      onClick={() => void recordDecision("Decline")}
                      type="button"
                    >
                      Record non-renewal
                    </button>
                    <button
                      className={buttonClassName({ variant: "secondary" })}
                      disabled={busy !== null || !canReconcile}
                      onClick={() =>
                        void run(
                          "reconcile",
                          () =>
                            api.reconcileSubscriptionLifecycle({
                              reason: reason.trim()
                            }),
                          "Due subscription boundary reconciled with a retained usage snapshot."
                        )
                      }
                      type="button"
                    >
                      Reconcile due boundary
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <aside className="border-l border-line pl-5">
              <h3 className="text-sm font-semibold text-ink">
                Exceptions and recovery
              </h3>
              {lifecycle.status === "GracePeriod" ? (
                <div className="mt-3">
                  <p className="text-xs leading-5 text-muted">
                    Grace ends {formatDate(lifecycle.graceEndsAt)}. Entitlements
                    remain active until reconciliation.
                  </p>
                  <input
                    aria-label="Grace resolution reference"
                    className={cn(inputClass, "mt-2")}
                    onChange={(event) => setGraceReference(event.target.value)}
                    placeholder="Resolution reference"
                    value={graceReference}
                  />
                  <button
                    className={cn(
                      buttonClassName({ variant: "primary" }),
                      "mt-2"
                    )}
                    disabled={busy !== null || graceReference.trim().length < 3}
                    onClick={() =>
                      void run(
                        "resolve-grace",
                        () =>
                          api.resolveSubscriptionGrace({
                            reason: reason.trim(),
                            resolutionReference: graceReference.trim()
                          }),
                        "Grace exception resolved without losing entitlement history."
                      )
                    }
                    type="button"
                  >
                    Resolve grace
                  </button>
                </div>
              ) : lifecycle.status !== "Ended" ? (
                <div className="mt-3 grid gap-2">
                  <input
                    aria-label="Grace external reference"
                    className={inputClass}
                    onChange={(event) => setGraceReference(event.target.value)}
                    placeholder="Invoice or procurement reference"
                    value={graceReference}
                  />
                  <input
                    aria-label="Grace period days"
                    className={inputClass}
                    max={90}
                    min={1}
                    onChange={(event) =>
                      setGraceDays(Number(event.target.value))
                    }
                    type="number"
                    value={graceDays}
                  />
                  <button
                    className={buttonClassName({ variant: "secondary" })}
                    disabled={busy !== null || graceReference.trim().length < 3}
                    onClick={() =>
                      void run(
                        "start-grace",
                        () =>
                          api.startSubscriptionGrace({
                            externalReference: graceReference.trim(),
                            graceDays,
                            reason: reason.trim()
                          }),
                        "Bounded grace exception recorded; entitlements remain visible and reviewable."
                      )
                    }
                    type="button"
                  >
                    Start bounded grace
                  </button>
                </div>
              ) : null}

              <div className="mt-5 border-t border-line pt-4">
                <p className="text-xs font-semibold text-ink">
                  End-of-term cancellation
                </p>
                {lifecycle.cancellationScheduledAt ? (
                  <>
                    <p className="mt-1 text-xs leading-5 text-muted">
                      Scheduled for{" "}
                      {formatDate(lifecycle.cancellationScheduledAt)}. No early
                      entitlement removal occurred.
                    </p>
                    <button
                      className="mt-2 text-xs font-semibold text-brand underline underline-offset-4"
                      disabled={busy !== null}
                      onClick={() =>
                        void run(
                          "revoke-cancel",
                          () =>
                            api.revokeSubscriptionCancellation({
                              reason: reason.trim()
                            }),
                          "Scheduled cancellation revoked; renewal review is open again."
                        )
                      }
                      type="button"
                    >
                      Revoke cancellation
                    </button>
                  </>
                ) : lifecycle.status !== "Ended" &&
                  lifecycle.status !== "GracePeriod" ? (
                  <>
                    <input
                      aria-label="Cancellation reference"
                      className={cn(inputClass, "mt-2")}
                      onChange={(event) =>
                        setCancellationReference(event.target.value)
                      }
                      placeholder="Approved cancellation reference"
                      value={cancellationReference}
                    />
                    <button
                      className="mt-2 text-xs font-semibold text-missed underline underline-offset-4"
                      disabled={
                        busy !== null || cancellationReference.trim().length < 3
                      }
                      onClick={() => setConfirmCancellation(true)}
                      type="button"
                    >
                      Schedule cancellation at term end
                    </button>
                  </>
                ) : null}
              </div>

              <div className="mt-5 border-t border-line pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
                  Provider boundary
                </p>
                <p className="mt-2 text-xs leading-5 text-muted">
                  {workspace.data.commercialBoundary}
                </p>
                {workspace.data.paymentProcessorStatus === "NotConfigured" ? (
                  <p className="mt-3 font-mono text-[10px] uppercase tracking-wide text-approval">
                    Payment processor · NotConfigured
                  </p>
                ) : null}
              </div>
            </aside>
          </div>

          <div className="mt-6 border-t border-line pt-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-ink">
                Immutable lifecycle ledger
              </h3>
              <span className="font-mono text-[10px] text-subtle">
                {workspace.data.events.length} events ·{" "}
                {workspace.data.periods.length} periods
              </span>
            </div>
            <ol className="mt-3 divide-y divide-line">
              {[...workspace.data.events]
                .reverse()
                .slice(0, 8)
                .map((event) => (
                  <li
                    className="grid gap-1 py-3 text-xs sm:grid-cols-[3rem_minmax(8rem,0.5fr)_minmax(0,1fr)_auto] sm:items-center"
                    key={event.subscriptionEventId}
                  >
                    <span className="font-mono text-subtle">
                      #{event.sequence}
                    </span>
                    <span className="font-semibold text-ink">
                      {event.action}
                    </span>
                    <span className="truncate text-muted">{event.reason}</span>
                    <span className="font-mono text-[10px] text-subtle">
                      {event.eventHash.slice(0, 10)}…
                    </span>
                  </li>
                ))}
            </ol>
          </div>
        </>
      ) : null}

      <ConfirmDialog
        busy={busy === "cancel"}
        confirmLabel="Schedule cancellation"
        confirmPhrase="CANCEL AT TERM END"
        description="This removes any approved next term and schedules entitlement removal only after the current period ends. The action can be revoked before reconciliation."
        destructive
        error={error}
        onCancel={() => setConfirmCancellation(false)}
        onConfirm={() => void scheduleCancellation()}
        open={confirmCancellation}
        title="Schedule end-of-term cancellation?"
      />
    </section>
  );
}

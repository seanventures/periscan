"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { VerificationEvent } from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { useApiResource } from "../hooks/use-api-resource";
import {
  ErrorState,
  EvidenceBasisBadge,
  InfoPopover,
  LoadingSkeleton,
  NotConfigured,
  Panel,
  PanelHeader,
  StateBadge,
  ValidationStateBadge,
  buttonClassName
} from "../ui";
import {
  REMEDIATION_STATUS_TONE,
  VERIFICATION_OUTCOME_TONE,
  relTime
} from "./remediation-lib";
import { ProofLoopContext } from "./proof-loop-context";
import { GovernedRemediationAction } from "./governed-remediation-action";
import { IacRemediationWorkspace } from "./iac-remediation-workspace";

const selectClassName =
  "rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

export function RemediationDetail({ id }: { id: string }) {
  // Single-id GET — avoid loading the full tenant remediation list (P14-15).
  const remediationResource = useApiResource(
    () => api.getRemediation(id),
    [id]
  );
  const events = useApiResource(() => api.listVerificationEvents(id), [id]);
  const integrations = useApiResource(() => api.listIntegrations(), []);

  const [busy, setBusy] = useState<
    | "ready"
    | "create-ticket"
    | "sync-ticket"
    | "verify"
    | "revalidate"
    | "plan"
    | null
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [selectedTicketDest, setSelectedTicketDest] = useState("");
  const [prescriptivePlan, setPrescriptivePlan] = useState<{
    objective: string;
    steps: Array<{
      order: number;
      title: string;
      action: string;
      iacHint?: string;
    }>;
  } | null>(null);
  const [revalidateReceipt, setRevalidateReceipt] = useState<{
    actionApplied: false;
    closedLoop: string;
    outcome?: string;
  } | null>(null);

  const remediation = remediationResource.data ?? null;

  const ticketingDestinations = useMemo(
    () =>
      (integrations.data ?? []).filter(
        (int) => int.category === "Ticketing" || int.category === "MSSP"
      ),
    [integrations.data]
  );

  const selectedDestinationId =
    selectedTicketDest || ticketingDestinations[0]?.integrationId || "";

  const timeline = useMemo(
    () =>
      [...(events.data ?? [])].sort(
        (a, b) =>
          new Date(b.verifiedAt).getTime() - new Date(a.verifiedAt).getTime()
      ),
    [events.data]
  );

  async function markReady() {
    setBusy("ready");
    setActionError(null);
    setFlash(null);
    try {
      await api.markRemediationReadyForVerification(id);
      await remediationResource.refetch();
      setFlash("Marked ready for verification.");
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "Couldn't update."
      );
    } finally {
      setBusy(null);
    }
  }

  async function verify() {
    setBusy("verify");
    setActionError(null);
    setFlash(null);
    try {
      const result = await api.verifyRemediation(id);
      await Promise.all([remediationResource.refetch(), events.refetch()]);
      setFlash(
        `Re-test complete — ${result.verificationEvent.outcome}${
          result.verificationEvent.measuredRevalidation ? " (measured)" : ""
        }.`
      );
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "Verification didn't run."
      );
    } finally {
      setBusy(null);
    }
  }

  async function createTicket() {
    if (!selectedDestinationId) return;
    setBusy("create-ticket");
    setActionError(null);
    setFlash(null);
    try {
      const result = await api.createRemediationTicket(id, {
        integrationId: selectedDestinationId
      });
      await remediationResource.refetch();
      setFlash(
        `Ticket created — ${result.ticket.system}·${result.ticket.ticketId}. External closure still requires fresh verification.`
      );
    } catch (caught) {
      setActionError(
        caught instanceof Error
          ? caught.message
          : "Couldn't create remediation ticket."
      );
    } finally {
      setBusy(null);
    }
  }

  async function syncTicket() {
    setBusy("sync-ticket");
    setActionError(null);
    setFlash(null);
    try {
      const result = await api.syncRemediationTicket(id);
      await remediationResource.refetch();
      setFlash(
        `Ticket state synchronized — ${result.ticket.stateLabel}. External closure still requires fresh verification.`
      );
    } catch (caught) {
      setActionError(
        caught instanceof Error
          ? caught.message
          : "Ticket state couldn't be synchronized."
      );
    } finally {
      setBusy(null);
    }
  }

  async function loadPrescriptivePlan() {
    setBusy("plan");
    setActionError(null);
    setFlash(null);
    try {
      const plan = await api.getPrescriptivePlan(id);
      setPrescriptivePlan(plan);
      setFlash("Prescriptive plan loaded (operator templates — not control push).");
    } catch (caught) {
      setActionError(
        caught instanceof Error
          ? caught.message
          : "Couldn't load prescriptive plan."
      );
    } finally {
      setBusy(null);
    }
  }

  async function runAutoRevalidate() {
    setBusy("revalidate");
    setActionError(null);
    setFlash(null);
    try {
      const result = await api.autoRevalidate(id);
      // Honesty gate: never present config-push language when actionApplied is false.
      if (result.actionApplied !== false) {
        throw new Error(
          "Unexpected actionApplied=true from auto-revalidate; refusing to claim a config push."
        );
      }
      const outcome =
        (result.verification as { verificationEvent?: { outcome?: string } })
          ?.verificationEvent?.outcome ?? undefined;
      setPrescriptivePlan(
        result.plan as {
          objective: string;
          steps: Array<{
            order: number;
            title: string;
            action: string;
            iacHint?: string;
          }>;
        }
      );
      setRevalidateReceipt({
        actionApplied: false,
        closedLoop: result.closedLoop,
        outcome
      });
      await Promise.all([remediationResource.refetch(), events.refetch()]);
      setFlash(
        `Auto-revalidate complete — no configuration was pushed (actionApplied=false)${
          outcome ? `; verification ${outcome}` : ""
        }. Fixed still requires measured success.`
      );
    } catch (caught) {
      setActionError(
        caught instanceof Error
          ? caught.message
          : "Auto-revalidate failed."
      );
    } finally {
      setBusy(null);
    }
  }

  if (remediationResource.loading && !remediationResource.data) {
    return (
      <div className="mx-auto w-full max-w-5xl px-5 py-6">
        <LoadingSkeleton rows={8} />
      </div>
    );
  }

  if (remediationResource.error || !remediation) {
    return (
      <div className="mx-auto w-full max-w-5xl px-5 py-6">
        <BackLink />
        <Panel className="mt-4">
          <ErrorState
            title="Couldn't load this remediation"
            message={
              remediationResource.error ?? "It may not exist for this tenant."
            }
            onRetry={remediationResource.refetch}
          />
        </Panel>
      </div>
    );
  }

  const canMarkReady =
    remediation.status === "Open" || remediation.status === "InProgress";
  const latest = timeline[0];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-5 py-6">
      <div className="flex flex-col gap-3">
        <BackLink />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-semibold tracking-tight text-ink">
              {remediation.recommendedAction}
            </h1>
            <p className="mt-1 font-mono text-[11px] text-subtle">
              {remediation.owner ? `${remediation.owner} · ` : ""}
              {remediation.dueAt
                ? `target ${new Date(remediation.dueAt).toLocaleDateString()} · `
                : ""}
              {remediation.verificationMethod}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {remediation.relatedPathId ? (
              <Link
                href={`/attack-paths/${remediation.relatedPathId}`}
                className="font-mono text-[11px] text-brand hover:text-brand-2"
              >
                path·{remediation.relatedPathId.slice(0, 8)}
              </Link>
            ) : null}
            {remediation.ticketId ? (
              <span className="rounded-control border border-line px-1.5 py-0.5 font-mono text-[10px] text-subtle">
                {remediation.ticketSystem ?? "ticket"}·{remediation.ticketId}
              </span>
            ) : null}
            <StateBadge
              tone={REMEDIATION_STATUS_TONE[remediation.status] ?? "neutral"}
            >
              {remediation.status}
            </StateBadge>
          </div>
        </div>
      </div>

      <ProofLoopContext
        entityLabel="Remediation"
        stage={
          ["Fixed", "Mitigated", "PartiallyFixed"].includes(remediation.status)
            ? "Repeat"
            : remediation.status === "VerificationPending" || latest
              ? "Verify"
              : "Act"
        }
        evidenceBasis={
          latest?.measuredRevalidation
            ? "Measured re-validation"
            : (remediation.relatedPathEvidenceBasis ??
              "Pending fresh verification")
        }
        owner={remediation.owner}
        freshness={relTime(latest?.verifiedAt ?? remediation.updatedAt)}
        status={remediation.status}
        nextAction={
          remediation.status === "VerificationPending"
            ? { href: `#fix-verification`, label: "Run fresh verification" }
            : remediation.relatedPathId
              ? {
                  href: `/attack-paths/${remediation.relatedPathId}`,
                  label: "Review source path"
                }
              : { href: "/reports", label: "Open proof delivery" }
        }
      />

      {remediation.ticketId ? (
        <Panel>
          <PanelHeader
            title="External ticket state"
            actions={
              <button
                type="button"
                onClick={syncTicket}
                disabled={busy !== null || !remediation.ticketIntegrationId}
                className={buttonClassName({
                  size: "sm",
                  variant: "secondary"
                })}
              >
                {busy === "sync-ticket"
                  ? "Synchronizing…"
                  : "Synchronize state"}
              </button>
            }
          />
          <div className="flex flex-wrap items-center gap-2 p-4">
            <StateBadge
              tone={
                remediation.ticketState === "Closed"
                  ? "inconclusive"
                  : remediation.ticketState === "InProgress"
                    ? "approval"
                    : "neutral"
              }
            >
              {remediation.ticketStateLabel ??
                remediation.ticketState ??
                "Not synchronized"}
            </StateBadge>
            <span className="font-mono text-[11px] text-subtle">
              {remediation.ticketSystem ?? "Ticket"}·{remediation.ticketId}
              {remediation.ticketSyncedAt
                ? ` · checked ${relTime(remediation.ticketSyncedAt)}`
                : ""}
            </span>
            <p className="basis-full text-[12px] text-subtle">
              Ticket closure is workflow context, not proof. Periscan records a
              closure without evidence and keeps the risk out of Fixed until a
              fresh targeted re-test succeeds.
            </p>
            {!remediation.ticketIntegrationId ? (
              <p className="basis-full text-[12px] text-missed">
                This ticket predates integration tracking. Re-route it with an
                explicit integration before automatic state synchronization.
              </p>
            ) : null}
          </div>
        </Panel>
      ) : (
        <Panel>
          <PanelHeader title="External ticket" />
          <div className="p-4">
            {integrations.loading && !integrations.data ? (
              <LoadingSkeleton rows={2} />
            ) : ticketingDestinations.length > 0 ? (
              <div className="flex flex-col gap-3">
                <p className="text-[12px] text-subtle">
                  Route this remediation into a connected PSA/RMM or ticketing
                  system. Ticket creation is workflow context, not proof of fix.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <label
                    htmlFor={`ticket-dest-${remediation.remediationId}`}
                    className="text-xs text-muted"
                  >
                    Destination:
                  </label>
                  <select
                    className={selectClassName}
                    id={`ticket-dest-${remediation.remediationId}`}
                    value={selectedDestinationId}
                    onChange={(e) => setSelectedTicketDest(e.target.value)}
                    aria-label="Select PSA/RMM destination for this remediation"
                    disabled={busy !== null}
                  >
                    {ticketingDestinations.map((dest) => (
                      <option
                        key={dest.integrationId}
                        value={dest.integrationId}
                      >
                        {dest.product} ({dest.vendor})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={createTicket}
                    disabled={busy !== null || !selectedDestinationId}
                    className={buttonClassName({
                      size: "sm",
                      variant: "secondary"
                    })}
                  >
                    {busy === "create-ticket" ? "Creating…" : "Create ticket"}
                  </button>
                </div>
              </div>
            ) : (
              <NotConfigured
                title="No ticketing destination connected"
                message="Connect a PSA/RMM (Syncro, HaloPSA, Autotask, ConnectWise, Jira, ServiceNow, etc.) to create remediation tickets from this page."
                action={{ href: "/integrations", label: "Open integrations" }}
              />
            )}
          </div>
        </Panel>
      )}

      {/* Fix plan */}
      <Panel id="fix-verification">
        <PanelHeader title="Fix plan" />
        <div className="p-4">
          {remediation.technicalSteps.length ? (
            <ol className="flex flex-col gap-2 text-[13px] text-muted">
              {remediation.technicalSteps.map((step, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="font-mono text-subtle">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-subtle">No technical steps recorded.</p>
          )}
        </div>
      </Panel>

      <Panel aria-label="Auto-revalidate closed loop">
        <PanelHeader
          title={
            <span className="inline-flex items-center gap-2">
              Auto-revalidate
              <InfoPopover label="auto-revalidate honesty">
                Builds a prescriptive plan, marks ready, and runs a targeted
                re-test. Never pushes WAF, firewall, security-group, or IdP
                config — operators or IaC apply the change. actionApplied is
                always false. Fixed still needs measured verification success.
              </InfoPopover>
            </span>
          }
          actions={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void loadPrescriptivePlan()}
                disabled={busy !== null}
                className={buttonClassName({
                  size: "sm",
                  variant: "secondary"
                })}
              >
                {busy === "plan" ? "Loading…" : "Load plan"}
              </button>
              <button
                type="button"
                onClick={() => void runAutoRevalidate()}
                disabled={busy !== null}
                className={buttonClassName({
                  size: "sm",
                  variant: "primary"
                })}
              >
                {busy === "revalidate" ? "Revalidating…" : "Run auto-revalidate"}
              </button>
            </div>
          }
        />
        <div className="flex flex-col gap-3 p-4">
          <p className="text-[12px] text-subtle">
            Plan → mark ready → re-measure. Human or IaC applies the fix;
            Periscan only revalidates. This is not a control-plane push.
          </p>
          {revalidateReceipt ? (
            <div className="rounded-control border border-line bg-canvas/60 px-3 py-2 text-[12px] text-muted">
              <p>
                <span className="font-medium text-ink">Last run:</span>{" "}
                actionApplied=
                <span className="font-mono text-ink">false</span>
                {revalidateReceipt.outcome
                  ? ` · outcome ${revalidateReceipt.outcome}`
                  : ""}
              </p>
              <p className="mt-1 font-mono text-[11px] text-subtle">
                {revalidateReceipt.closedLoop}
              </p>
            </div>
          ) : null}
          {prescriptivePlan ? (
            <div className="flex flex-col gap-2">
              <p className="text-[13px] font-medium text-ink">
                {prescriptivePlan.objective}
              </p>
              <ol className="flex flex-col gap-2 text-[13px] text-muted">
                {prescriptivePlan.steps.map((step) => (
                  <li key={step.order} className="flex flex-col gap-0.5">
                    <span className="flex gap-2.5">
                      <span className="font-mono text-subtle">{step.order}.</span>
                      <span>
                        <span className="text-ink">{step.title}</span>
                        {step.action !== step.title ? (
                          <span className="block text-[12px] text-subtle">
                            {step.action}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    {step.iacHint ? (
                      <span className="ml-6 font-mono text-[11px] text-subtle">
                        IaC: {step.iacHint}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <p className="text-sm text-subtle">
              Load the prescriptive plan or run auto-revalidate to generate
              stack-aware steps (AWS SG, K8s NetPol, Okta) plus a revalidation
              step.
            </p>
          )}
        </div>
      </Panel>

      <GovernedRemediationAction remediationId={remediation.remediationId} />

      <IacRemediationWorkspace remediationId={remediation.remediationId} />

      {/* Verification */}
      <Panel>
        <PanelHeader
          title={
            <span className="inline-flex items-center gap-2">
              Fix verification
              <InfoPopover label="fix verification">
                Mark ready records that implementation is complete. Only a fresh
                successful targeted re-test can move the risk to Fixed; a failed
                re-test preserves or reopens the exposure.
              </InfoPopover>
            </span>
          }
          actions={
            remediation.relatedPathEvidenceBasis ? (
              <span className="flex items-center gap-1.5 text-[11px] text-subtle">
                exposure basis
                <EvidenceBasisBadge
                  basis={remediation.relatedPathEvidenceBasis}
                  dot={false}
                />
              </span>
            ) : null
          }
        />
        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {canMarkReady ? (
              <button
                type="button"
                onClick={markReady}
                disabled={busy !== null}
                className={buttonClassName({
                  size: "sm",
                  variant: "secondary"
                })}
              >
                {busy === "ready" ? "…" : "Mark ready for verification"}
              </button>
            ) : null}
            {remediation.verificationRequired ? (
              <button
                type="button"
                onClick={verify}
                disabled={busy !== null}
                className={buttonClassName({ variant: "primary", size: "sm" })}
              >
                {busy === "verify"
                  ? "Re-testing…"
                  : latest
                    ? "Re-verify"
                    : "Run targeted verification"}
              </button>
            ) : null}
            <span className="text-[12px] text-subtle">
              A &quot;Fixed&quot; only lands when a real re-test confirms the
              exposure is gone.
            </span>
          </div>

          {flash ? (
            <p className="text-sm text-fixed" role="status">
              {flash}
            </p>
          ) : null}
          {actionError ? (
            <p role="alert" className="text-sm text-missed">
              {actionError}
            </p>
          ) : null}

          {/* Before / after from the latest event */}
          {latest ? <BeforeAfter event={latest} /> : null}

          {remediation.nextVerificationAt ? (
            <p className="text-[12px] text-subtle">
              Continuous re-check due {relTime(remediation.nextVerificationAt)}.
            </p>
          ) : null}
        </div>
      </Panel>

      {/* Timeline */}
      <Panel>
        <PanelHeader title="Verification timeline" />
        {events.loading ? (
          <LoadingSkeleton rows={3} />
        ) : events.error ? (
          <ErrorState message={events.error} onRetry={events.refetch} />
        ) : timeline.length === 0 ? (
          <p className="px-4 py-6 text-sm text-subtle">
            No verification events yet — run a targeted verification above.
          </p>
        ) : (
          <ul>
            {timeline.map((event) => (
              <li
                key={event.verificationId}
                className="flex gap-3 border-b border-line px-4 py-3 last:border-b-0"
              >
                <span
                  aria-hidden
                  className="mt-1 size-2 shrink-0 rounded-full"
                  style={{
                    background: `var(--color-${VERIFICATION_OUTCOME_TONE[event.outcome] ?? "neutral"})`
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StateBadge
                      tone={
                        VERIFICATION_OUTCOME_TONE[event.outcome] ?? "neutral"
                      }
                      dot={false}
                    >
                      {event.outcome}
                    </StateBadge>
                    {event.measuredRevalidation ? (
                      <StateBadge tone="validated" dot={false}>
                        Measured re-test
                      </StateBadge>
                    ) : (
                      <StateBadge tone="inconclusive" dot={false}>
                        Module re-test
                      </StateBadge>
                    )}
                    <span className="font-mono text-[11px] text-subtle">
                      {relTime(event.verifiedAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-[12.5px] text-muted">
                    {event.previousState ? (
                      <>
                        <ValidationStateBadge
                          state={event.previousState}
                          dot={false}
                        />{" "}
                        <span className="text-subtle">→</span>{" "}
                      </>
                    ) : null}
                    <ValidationStateBadge state={event.newState} dot={false} />
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-subtle">
                    {event.retestMethod ? `${event.retestMethod} · ` : ""}
                    {event.reSyncedConnectorKeys.length
                      ? `${event.reSyncedConnectorKeys.length} connectors re-synced · `
                      : ""}
                    {event.selectedModuleIds.length
                      ? `${event.selectedModuleIds.length} modules · `
                      : ""}
                    {event.exposureReCorrelated != null
                      ? event.exposureReCorrelated
                        ? "exposure re-correlated"
                        : "exposure gone"
                      : ""}
                    {event.evidenceIds.length
                      ? ` · ${event.evidenceIds.length} evidence`
                      : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function BeforeAfter({ event }: { event: VerificationEvent }) {
  return (
    <div className="grid grid-cols-2 gap-3 rounded-card border border-line p-3">
      <div>
        <p className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
          Before
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {event.previousState ? (
            <ValidationStateBadge state={event.previousState} dot={false} />
          ) : (
            <span className="text-[12px] text-subtle">—</span>
          )}
          {event.previousEvidenceBasis ? (
            <EvidenceBasisBadge
              basis={event.previousEvidenceBasis}
              dot={false}
            />
          ) : null}
        </div>
      </div>
      <div>
        <p className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
          After
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <ValidationStateBadge state={event.newState} dot={false} />
          <StateBadge
            tone={VERIFICATION_OUTCOME_TONE[event.outcome] ?? "neutral"}
            dot={false}
          >
            {event.outcome}
          </StateBadge>
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/remediation"
      className="inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-ink"
    >
      <span aria-hidden>←</span> All remediations
    </Link>
  );
}

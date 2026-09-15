"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import type { PolicyDecision } from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { useApiResource } from "../hooks/use-api-resource";
import {
  ErrorState,
  InlineError,
  LoadingSkeleton,
  Panel,
  PanelHeader,
  StateBadge,
  buttonClassName
} from "../ui";

/**
 * Pending policy decision queue for Needs you → Policy approvals (P14-13).
 * `/policies?approvalState=Pending` must land on an actionable queue, not a
 * Trust & Safety shell with no query consumption.
 */
export function PolicyApprovalsPanel() {
  const searchParams = useSearchParams();
  const focusPending =
    (searchParams.get("approvalState") ?? "").toLowerCase() === "pending";

  const decisions = useApiResource(
    () =>
      api.listPolicyDecisions({
        outcome: "RequiresApproval",
        limit: 100
      }),
    []
  );

  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const pending = useMemo(
    () =>
      (decisions.data ?? []).filter(
        (decision) => decision.approvalState === "Pending"
      ),
    [decisions.data]
  );

  async function approve(decision: PolicyDecision) {
    setBusyId(decision.policyDecisionId);
    setActionError(null);
    setFlash(null);
    try {
      await api.approvePolicyDecision(decision.policyDecisionId);
      await decisions.refetch();
      setFlash(`Approved ${shortId(decision.policyDecisionId)}.`);
    } catch (caught) {
      setActionError(
        caught instanceof Error
          ? caught.message
          : "Couldn't approve this policy decision."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function deny(decision: PolicyDecision) {
    setBusyId(decision.policyDecisionId);
    setActionError(null);
    setFlash(null);
    try {
      await api.denyPolicyDecision(decision.policyDecisionId);
      await decisions.refetch();
      setFlash(`Denied ${shortId(decision.policyDecisionId)}.`);
    } catch (caught) {
      setActionError(
        caught instanceof Error
          ? caught.message
          : "Couldn't deny this policy decision."
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Panel
      id="policy-approvals"
      className={focusPending ? "ring-2 ring-brand/40" : undefined}
    >
      <PanelHeader
        title="Policy approvals waiting"
        actions={
          <StateBadge tone={pending.length > 0 ? "approval" : "neutral"} dot={false}>
            {decisions.loading ? "…" : `${pending.length} pending`}
          </StateBadge>
        }
      />
      <div className="flex flex-col gap-3 p-4">
        <p className="text-sm text-muted">
          Governed missions that require an authorized reviewer before work can
          queue. Approve or deny here — this is the Needs you destination for
          pending policy decisions.
        </p>
        {actionError ? (
          <InlineError message={actionError} onDismiss={() => setActionError(null)} />
        ) : null}
        {flash ? (
          <InlineError
            message={flash}
            tone="success"
            onDismiss={() => setFlash(null)}
          />
        ) : null}

        {decisions.loading && !decisions.data ? (
          <LoadingSkeleton rows={4} label="Loading policy approvals…" />
        ) : null}

        {decisions.error ? (
          <ErrorState
            title="Couldn't load policy decisions"
            message={decisions.error}
            onRetry={decisions.refetch}
          />
        ) : null}

        {!decisions.loading && !decisions.error && pending.length === 0 ? (
          <p className="text-sm text-muted">
            No policy decisions are waiting on approval. When a mission returns
            RequiresApproval, it appears here for an admin to record the decision.
          </p>
        ) : null}

        {pending.length > 0 ? (
          <ul className="m-0 list-none space-y-3 p-0">
            {pending.map((decision) => {
              const busy = busyId === decision.policyDecisionId;
              return (
                <li
                  key={decision.policyDecisionId}
                  className="rounded-card border border-line bg-surface/40 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-sm font-semibold text-ink">
                        {decision.missionType} · {decision.safetyLevel} ·{" "}
                        {decision.executionEnvironment}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-subtle">
                        decision·{shortId(decision.policyDecisionId)} · scope·
                        {shortId(decision.scopeId)} · safety{" "}
                        {decision.safetyLevel} ·{" "}
                        {new Date(decision.createdAt).toLocaleString()}
                      </p>
                      <p className="mt-2 text-[13px] text-muted">
                        {decision.rationale}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void approve(decision)}
                        className={buttonClassName({
                          size: "sm",
                          variant: "primary"
                        })}
                      >
                        {busy ? "Working…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void deny(decision)}
                        className={buttonClassName({
                          size: "sm",
                          variant: "secondary"
                        })}
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </Panel>
  );
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

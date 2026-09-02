"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import type { PolicyDecision } from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { useApiResource } from "../hooks/use-api-resource";
import {
  ErrorState,
  LoadingSkeleton,
  Panel,
  PanelHeader,
  StateBadge,
  buttonClassName
} from "../ui";

/**
 * Pending policy decisions that block governed missions.
 * Consumes `?approvalState=Pending` from the Needs you work-queue link (P14-13).
 */
export function PendingPolicyApprovals() {
  const searchParams = useSearchParams();
  const focusPending =
    (searchParams.get("approvalState") ?? "").toLowerCase() === "pending";

  const pending = useApiResource(() => api.listPendingApprovals(), []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  async function approve(decision: PolicyDecision) {
    setBusyId(decision.policyDecisionId);
    setActionError(null);
    setFlash(null);
    try {
      await api.approvePolicyDecision(decision.policyDecisionId);
      setFlash("Approval recorded. Governed runs may proceed under policy.");
      await pending.refetch();
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "Could not approve."
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
      setFlash("Denial recorded. The requested action stays blocked.");
      await pending.refetch();
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "Could not deny."
      );
    } finally {
      setBusyId(null);
    }
  }

  const items = pending.data ?? [];

  return (
    <Panel
      id="pending-policy-approvals"
      className={
        focusPending ? "ring-2 ring-brand/40 ring-offset-2 ring-offset-bg" : ""
      }
    >
      <PanelHeader title="Pending policy approvals" />
      <div className="flex flex-col gap-3 p-4">
        <p className="text-sm text-muted">
          Governed missions wait here until an authorized reviewer records
          approve or deny. This is the decision surface linked from Needs you —
          not a second Trust &amp; Safety dashboard.
        </p>
        {flash ? (
          <p role="status" className="text-sm text-fixed">
            {flash}
          </p>
        ) : null}
        {actionError ? (
          <p role="alert" className="text-sm text-missed">
            {actionError}
          </p>
        ) : null}

        {pending.loading && !pending.data ? (
          <LoadingSkeleton rows={4} label="Loading pending approvals…" />
        ) : pending.error ? (
          <ErrorState message={pending.error} onRetry={pending.refetch} />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted">
            No policy decisions are waiting. Preview policy from{" "}
            <Link href="/missions" className="font-semibold text-brand">
              Validate
            </Link>{" "}
            before a run when approval is required.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((decision) => (
              <li
                key={decision.policyDecisionId}
                className="rounded-control border border-line bg-surface px-3 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">
                      {decision.missionType} · {decision.outcome}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-subtle">
                      {decision.safetyLevel} · scope{" "}
                      {decision.scopeId.slice(0, 8)}… ·{" "}
                      {decision.executionEnvironment}
                    </p>
                    <p className="mt-1 text-[13px] text-muted">
                      {decision.rationale}
                    </p>
                  </div>
                  <StateBadge tone="approval" dot={false}>
                    {decision.approvalState}
                  </StateBadge>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busyId === decision.policyDecisionId}
                    onClick={() => void approve(decision)}
                    className={buttonClassName({
                      size: "sm",
                      variant: "primary"
                    })}
                  >
                    {busyId === decision.policyDecisionId
                      ? "Working…"
                      : "Approve"}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === decision.policyDecisionId}
                    onClick={() => void deny(decision)}
                    className={buttonClassName({
                      size: "sm",
                      variant: "secondary"
                    })}
                  >
                    Deny
                  </button>
                  <Link
                    href={`/missions?scopeId=${decision.scopeId}`}
                    className="text-xs font-semibold text-brand hover:text-brand-2"
                  >
                    Open related missions
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

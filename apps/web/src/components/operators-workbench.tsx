"use client";

import Link from "next/link";
import { useState } from "react";

import type { OperatorRecommendation } from "@periscan/operators";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { useApiResource } from "../hooks/use-api-resource";
import {
  ErrorState,
  LoadingSkeleton,
  NotConfigured,
  Panel,
  PanelHeader,
  SafetyLevelBadge,
  StateBadge,
  buttonClassName,
  type StateTone
} from "../ui";

const STATUS_TONE: Record<string, StateTone> = {
  Proposed: "approval",
  Approved: "fixed",
  NotActionable: "inconclusive"
};
const UNCERTAINTY_TONE: Record<string, StateTone> = {
  Low: "validated",
  Medium: "approval",
  High: "missed"
};

function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

export function OperatorsWorkbench() {
  const profiles = useApiResource(() => api.listOperatorProfiles(), []);
  const recommendations = useApiResource(
    () => api.listOperatorRecommendations(),
    []
  );

  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-6"
      data-testid="operators-workbench"
    >
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
          Operate
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Operators
        </h1>
        <p className="max-w-2xl text-sm text-muted">
          Specialist operators propose next steps — always backed by evidence,
          never self-executing. Applying a recommendation creates a{" "}
          <strong className="font-medium text-ink">Draft</strong> mission only;
          you still start it explicitly. No auto-queue.
        </p>
      </header>

      {/* Recommendations */}
      <Panel data-testid="operator-recommendations-panel">
        <PanelHeader title="Recommendations" />
        {recommendations.loading ? (
          <LoadingSkeleton rows={4} />
        ) : recommendations.error ? (
          <ErrorState message={recommendations.error} onRetry={recommendations.refetch} />
        ) : (recommendations.data ?? []).length === 0 ? (
          <div className="p-4">
            <NotConfigured
              title="No recommendations yet"
              message="Operators surface evidence-backed recommendations as validation produces findings. Path-scoped next missions also appear on each attack-path detail after you generate them."
              action={{ href: "/missions", label: "Run a validation" }}
            />
          </div>
        ) : (
          <ul data-testid="operator-recommendations-list">
            {(recommendations.data ?? []).map((rec) => (
              <RecommendationRow
                key={rec.recommendationId}
                rec={rec}
                onApproved={recommendations.refetch}
              />
            ))}
          </ul>
        )}
      </Panel>

      {/* Operator profiles */}
      <Panel>
        <PanelHeader title="Operators" />
        {profiles.loading ? (
          <LoadingSkeleton rows={3} />
        ) : profiles.error ? (
          <ErrorState message={profiles.error} onRetry={profiles.refetch} />
        ) : (profiles.data ?? []).length === 0 ? (
          <p className="px-4 py-6 text-sm text-subtle">No operators available.</p>
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {(profiles.data ?? []).map((p) => (
              <div
                key={p.operatorType}
                className="rounded-card border border-line bg-surface p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-[14px] font-semibold text-ink">
                    {p.name}
                  </span>
                  <SafetyLevelBadge level={p.defaultSafetyLevel} dot={false} />
                </div>
                <p className="mt-1 text-[12.5px] text-muted">{p.purpose}</p>
                <p className="mt-1.5 font-mono text-[10.5px] text-subtle">
                  {p.capabilities.length} capabilities · {p.supportedMissionTypes.length} mission types
                </p>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function RecommendationRow({
  rec,
  onApproved
}: {
  rec: OperatorRecommendation;
  onApproved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [approvedMissionId, setApprovedMissionId] = useState<string | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  async function applyRecommendation() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.approveOperatorRecommendation(
        rec.recommendationId
      );
      const missionId =
        result.mission &&
        typeof result.mission === "object" &&
        "missionId" in result.mission
          ? String((result.mission as { missionId: string }).missionId)
          : null;
      setApprovedMissionId(missionId);
      onApproved();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Couldn't apply recommendation."
      );
    } finally {
      setBusy(false);
    }
  }

  const plan = rec.missionPlan;
  const canApprove = rec.status === "Proposed";

  return (
    <li
      className="flex flex-col gap-2.5 border-b border-line px-4 py-3.5 last:border-b-0"
      data-testid={`operator-recommendation-row-${rec.recommendationId}`}
      data-recommendation-status={rec.status}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[14px] font-medium text-ink">{rec.title}</span>
        <span className="rounded-control border border-line px-1.5 py-0.5 font-mono text-[10px] text-subtle">
          {rec.operatorType}
        </span>
        <StateBadge tone={STATUS_TONE[rec.status] ?? "neutral"} dot={false}>
          {rec.status}
        </StateBadge>
        <StateBadge tone={UNCERTAINTY_TONE[rec.uncertainty] ?? "neutral"} dot={false}>
          {rec.uncertainty} uncertainty
        </StateBadge>
      </div>

      <p className="text-[13px] text-muted">{rec.rationale}</p>

      <div>
        <Label>Proposed actions</Label>
        <ul className="mt-1 flex flex-col gap-1 text-[12.5px] text-muted">
          {rec.proposedActions.map((a, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden className="text-brand">
                ›
              </span>
              {a}
            </li>
          ))}
        </ul>
      </div>

      {/* Mission plan */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-control border border-line bg-surface px-3 py-2 text-[11.5px]">
        <span className="font-display font-semibold uppercase tracking-[0.08em] text-subtle">
          Mission plan
        </span>
        <span className="font-mono text-muted">{plan.missionType}</span>
        <SafetyLevelBadge level={plan.safetyLevel} dot={false} />
        <span className="font-mono text-subtle">{plan.executionEnvironment}</span>
        {plan.approvalRequired ? (
          <StateBadge tone="approval" dot={false}>
            Approval required
          </StateBadge>
        ) : null}
        <span className="font-mono text-subtle">{plan.moduleIds.length} modules</span>
      </div>

      {/* Evidence */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Label>Evidence</Label>
        {rec.evidenceIds.map((e) => (
          <span
            key={e}
            className="rounded-control border border-line bg-brand/5 px-2 py-0.5 font-mono text-[10.5px] text-muted"
          >
            ev·{shortId(e)}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {canApprove ? (
          <button
            type="button"
            onClick={() => void applyRecommendation()}
            disabled={busy}
            className={buttonClassName({ size: "sm", variant: "primary" })}
            data-testid={`operator-recommendation-apply-${rec.recommendationId}`}
          >
            {busy ? "Applying…" : "Apply recommendation"}
          </button>
        ) : rec.status === "NotActionable" ? (
          <span className="text-[12px] text-subtle">
            Not actionable — missing prerequisites.
          </span>
        ) : rec.status === "Approved" ? (
          <span className="text-[12px] text-muted" role="status">
            Applied — Draft mission created (not queued).
          </span>
        ) : null}
        {approvedMissionId ? (
          <p
            className="text-xs text-muted"
            data-testid="operator-recommendation-applied"
            role="status"
          >
            Draft mission created (not queued).{" "}
            <Link
              href="/missions"
              className="font-semibold text-brand hover:text-brand-2"
            >
              Open missions →
            </Link>{" "}
            <span className="font-mono text-[10px] text-subtle">
              {approvedMissionId}
            </span>
          </p>
        ) : null}
        {error ? <span className="text-sm text-missed">{error}</span> : null}
      </div>
    </li>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
      {children}
    </span>
  );
}

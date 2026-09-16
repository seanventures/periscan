"use client";

import Link from "next/link";
import { startTransition, useEffect, useState } from "react";

import type {
  SignalTriggerActivity,
  SignalTriggerApprovalResponse,
  SignalTriggerEvaluationResponse
} from "@periscan/shared";

import {
  browserPeriscanApiClient,
  PeriscanApiClientError,
  type AuthSessionPayload
} from "../lib/periscan-api-client";
import { Badge, Button, Card, StatusPill, buttonClassName } from "../ui";
import { StatusPanel } from "./status-panel";

interface SignalState {
  activity: SignalTriggerActivity[];
  triggers: SignalTriggerEvaluationResponse;
}

function shortId(value: string) {
  return value.slice(0, 8);
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

async function loadSignalState(): Promise<SignalState> {
  const [triggers, activity] = await Promise.all([
    browserPeriscanApiClient.getSignalTriggers(),
    browserPeriscanApiClient.listSignalTriggerActivity()
  ]);

  return { activity, triggers };
}

export function SignalActivityStream({
  initialSignalId = ""
}: {
  initialSignalId?: string;
}) {
  const [auth, setAuth] = useState<AuthSessionPayload | null>(null);
  const [state, setState] = useState<SignalState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingTriggerId, setPendingTriggerId] = useState<string | null>(null);
  const [approval, setApproval] =
    useState<SignalTriggerApprovalResponse | null>(null);
  const [activitySort, setActivitySort] = useState<"recent" | "signals">(
    "recent"
  );

  useEffect(() => {
    let active = true;

    void browserPeriscanApiClient
      .getMe()
      .then(async (nextAuth) => {
        if (!active) {
          return;
        }

        setAuth(nextAuth);
        const nextState = await loadSignalState();

        if (active) {
          setState(nextState);
          setIsLoading(false);
        }
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        if (error instanceof PeriscanApiClientError && error.status === 401) {
          setAuth(null);
          setIsLoading(false);
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load the signal activity stream."
        );
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function refreshState() {
    setErrorMessage(null);
    setIsRefreshing(true);

    try {
      setState(await loadSignalState());
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to refresh the signal activity stream."
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  async function approveTrigger(triggerId: string) {
    setErrorMessage(null);
    setPendingTriggerId(triggerId);

    try {
      const result =
        await browserPeriscanApiClient.approveSignalTrigger(triggerId);
      setApproval(result);
      await refreshState();
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to approve the signal trigger."
      );
    } finally {
      setPendingTriggerId(null);
    }
  }

  if (isLoading) {
    return (
      <StatusPanel
        body="Periscan is reading tenant-scoped signal triggers and the non-queueing activity stream from the public API."
        eyebrow="Signal activity"
        kind="loading"
        title="Loading signal-driven validation activity."
      />
    );
  }

  if (!auth) {
    return (
      <StatusPanel
        actions={
          <Link
            className={buttonClassName({ size: "sm", variant: "secondary" })}
            href="/"
          >
            Back to workspace
          </Link>
        }
        body="Signal-driven validation is tenant-scoped. Authenticate from the workspace to review trigger rules, readiness gaps, and the activity stream."
        eyebrow="Signal activity"
        kind="info"
        title="Sign in to review signal activity."
      />
    );
  }

  if (!state) {
    return (
      <StatusPanel
        actions={
          <Button
            variant="secondary"
            onClick={() => startTransition(() => void refreshState())}
          >
            Retry
          </Button>
        }
        body={errorMessage ?? "The signal activity stream is unavailable."}
        eyebrow="Signal activity"
        kind="error"
        title="Unable to load signal activity."
      />
    );
  }

  const { summary, rules, evaluations } = state.triggers;
  const evaluationsByTrigger = new Map(
    evaluations.map((evaluation) => [evaluation.triggerId, evaluation])
  );
  const visibleActivity = initialSignalId
    ? state.activity.filter((event) => event.signalIds.includes(initialSignalId))
    : state.activity;

  const summaryMetrics: Array<{ label: string; value: number }> = [
    { label: "Needs approval", value: summary.needsApproval },
    { label: "Requires verified scope", value: summary.requiresVerifiedScope },
    { label: "Requires integration", value: summary.requiresIntegration },
    {
      label: "Requires internal runner",
      value: summary.requiresInternalRunner
    },
    { label: "Not configured", value: summary.notConfigured }
  ];

  return (
    <section className="flex flex-col gap-4">
      {initialSignalId ? (
        <p className="rounded-control border border-brand/30 bg-brand/8 px-3 py-2 text-sm text-muted">
          Showing activity linked to signal{" "}
          <strong className="font-mono text-ink">{initialSignalId}</strong>.{" "}
          <Link href="/signal-activity" className="text-brand hover:text-brand-2">
            Show all activity
          </Link>
        </p>
      ) : null}
      <Card
        elevated
        className="flex flex-wrap items-start justify-between gap-4"
      >
        <div className="max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand">
            Signal-driven validation
          </span>
          <h2 className="mt-1 text-xl font-semibold text-ink">
            Signal triggers and the validation activity stream.
          </h2>
          <p className="mt-2 text-sm text-muted">
            Signed in as {auth.user.email} for {auth.tenant.name}. Trigger
            evaluation is non-queueing — approving a ready trigger creates a
            policy decision and a draft mission only. Evaluated{" "}
            {formatTimestamp(state.triggers.evaluatedAt)}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={isRefreshing}
            onClick={() => startTransition(() => void refreshState())}
          >
            {isRefreshing ? "Refreshing..." : "Refresh activity"}
          </Button>
          <Link
            className={buttonClassName({ size: "sm", variant: "secondary" })}
            href="/missions"
          >
            Missions & runs
          </Link>
        </div>
      </Card>

      {errorMessage ? (
        <div
          className="flex flex-wrap items-center gap-3 rounded-control border border-danger/40 bg-danger/10 px-3 py-2 text-sm"
          role="alert"
          aria-live="assertive"
        >
          <p className="text-danger">{errorMessage}</p>
          <Button
            variant="secondary"
            size="sm"
            disabled={isRefreshing}
            onClick={() => startTransition(() => void refreshState())}
          >
            {isRefreshing ? "Reloading..." : "Reload signal activity"}
          </Button>
          <button
            aria-label="Dismiss signal activity error"
            className="text-xs text-muted underline"
            onClick={() => setErrorMessage(null)}
            type="button"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <dl
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
        aria-label="Signal trigger readiness summary"
      >
        {summaryMetrics.map((metric) => (
          <Card key={metric.label} className="flex flex-col gap-1">
            <dt className="text-sm text-muted">{metric.label}</dt>
            <dd className="text-2xl font-semibold text-ink">{metric.value}</dd>
          </Card>
        ))}
      </dl>

      {approval ? (
        <Card
          elevated
          className="flex flex-col gap-3"
          role="status"
          aria-live="polite"
          aria-label="Latest signal trigger approval"
        >
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-base font-semibold text-ink">
              Approval created a draft mission
            </h3>
            <StatusPill status={approval.mission.status} />
          </div>
          <p className="text-sm text-muted">
            Mission {shortId(approval.mission.missionId)} ·{" "}
            {approval.mission.missionType}. Policy decision{" "}
            {approval.policyDecision.outcome} (
            {approval.policyDecision.approvalState}). Routing{" "}
            {approval.routing.status}.
          </p>
          {approval.routing.nextActions.length > 0 ? (
            <ul className="flex flex-wrap gap-2 text-xs text-muted">
              {approval.routing.nextActions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Link
              className={buttonClassName({ size: "sm", variant: "secondary" })}
              href={`/missions?missionId=${approval.mission.missionId}`}
            >
              View mission runs
            </Link>
            <Button
              variant="secondary"
              aria-label="Dismiss approval summary"
              onClick={() => setApproval(null)}
            >
              Dismiss
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          className="flex flex-col gap-3"
          aria-labelledby="signal-activity-title"
        >
          <div className="flex items-center justify-between gap-4">
            <h3
              id="signal-activity-title"
              className="text-base font-semibold text-ink"
            >
              Activity stream
            </h3>
            <Badge
              tone="info"
              role="status"
              aria-label={`Signal activity event count: ${visibleActivity.length}`}
            >
              {visibleActivity.length} events
            </Badge>
          </div>
          {visibleActivity.length === 0 ? (
            <p className="text-sm text-muted">
              {initialSignalId
                ? "No activity events reference this signal."
                : "No signal-driven validation activity has been recorded for this tenant yet. Connect signal sources or import advisories to populate the stream."}
            </p>
          ) : (
            <>
              <label
                className="flex flex-col gap-1 text-xs text-muted"
                htmlFor="signal-activity-sort"
              >
                <span>Sort by</span>
                <select
                  className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  id="signal-activity-sort"
                  onChange={(event) =>
                    setActivitySort(
                      event.target.value === "signals" ? "signals" : "recent"
                    )
                  }
                  value={activitySort}
                >
                  <option value="recent">Most recent</option>
                  <option value="signals">Most signals</option>
                </select>
              </label>
              <ol
                className="flex flex-col gap-2"
                aria-label="Signal trigger activity"
              >
                {[...visibleActivity]
                  .sort((left, right) =>
                    activitySort === "signals"
                      ? right.signalIds.length - left.signalIds.length
                      : new Date(right.createdAt).getTime() -
                        new Date(left.createdAt).getTime()
                  )
                  .map((event) => (
                    <li key={event.activityId}>
                      <article className="flex flex-col gap-1 rounded-control border border-line bg-surface p-3">
                        <div className="flex items-center justify-between gap-3">
                          <strong className="text-ink">{event.title}</strong>
                          <StatusPill
                            status={event.status}
                            aria-label={`Activity status for ${event.title}: ${event.status}`}
                          />
                        </div>
                        <p className="text-sm text-muted">{event.summary}</p>
                        <p className="text-xs text-subtle">
                          {event.triggerType} · recommends{" "}
                          {event.recommendedMissionType} ·{" "}
                          {formatTimestamp(event.createdAt)}
                        </p>
                        <p className="text-xs text-subtle">
                          {event.signalIds.length} signals ·{" "}
                          {event.auditEventIds.length} audit events ·{" "}
                          {event.evidenceIds.length} evidence
                        </p>
                      </article>
                    </li>
                  ))}
              </ol>
            </>
          )}
        </Card>

        <Card
          className="flex flex-col gap-3"
          aria-labelledby="signal-rules-title"
        >
          <div className="flex items-center justify-between gap-4">
            <h3
              id="signal-rules-title"
              className="text-base font-semibold text-ink"
            >
              Trigger rules
            </h3>
            <Badge
              tone="info"
              role="status"
              aria-label={`Signal trigger rule count: ${rules.length}`}
            >
              {rules.length} rules
            </Badge>
          </div>
          {rules.length === 0 ? (
            <p className="text-sm text-muted">
              No signal trigger rules are defined.
            </p>
          ) : (
            rules.map((rule) => {
              const evaluation = evaluationsByTrigger.get(rule.triggerId);
              const canApprove = evaluation?.requiresApproval ?? false;

              return (
                <article
                  className="flex flex-col gap-2 rounded-control border border-line bg-surface p-3"
                  key={rule.triggerId}
                >
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-ink">{rule.name}</strong>
                    {evaluation ? (
                      <StatusPill
                        status={evaluation.status}
                        aria-label={`Trigger ${rule.name} status: ${evaluation.status}`}
                      />
                    ) : (
                      <Badge tone="neutral">
                        {rule.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted">{rule.description}</p>
                  {evaluation ? (
                    <>
                      <p className="text-sm text-muted">{evaluation.reason}</p>
                      {evaluation.missingPrerequisites.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-subtle">
                            Missing prerequisites
                          </span>
                          <ul className="flex flex-wrap gap-2 text-xs text-muted">
                            {evaluation.missingPrerequisites.map((item) => (
                              <li key={`${rule.triggerId}-${item}`}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                  <p className="text-xs text-subtle">
                    {rule.triggerType} · {rule.safetyLevel} · recommends{" "}
                    {rule.recommendedMissionType}
                  </p>
                  {canApprove ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={pendingTriggerId === rule.triggerId}
                        onClick={() =>
                          startTransition(
                            () => void approveTrigger(rule.triggerId)
                          )
                        }
                      >
                        {pendingTriggerId === rule.triggerId
                          ? "Approving..."
                          : "Approve & create draft mission"}
                      </Button>
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </Card>
      </div>
    </section>
  );
}

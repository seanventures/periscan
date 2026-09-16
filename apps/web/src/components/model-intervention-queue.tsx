"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  IssueModelToolInterventionResult,
  ModelToolIntervention,
  ModelToolInterventionQueueItem,
  ModelToolInterventionTransport
} from "@periscan/shared";

import { useApiResource } from "../hooks/use-api-resource";
import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  Panel,
  PanelHeader,
  StateBadge,
  cn,
  type StateTone
} from "../ui";

const fieldClass =
  "flex flex-col gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-muted";
const inputClass =
  "rounded-control border border-[#294376] bg-[#081224] px-3 py-2.5 font-sans text-[13px] normal-case tracking-normal text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/25";

const STATUS_TONE: Record<string, StateTone> = {
  Approved: "fixed",
  Cancelled: "missed",
  Expired: "inconclusive",
  Pending: "approval",
  RequiresApproval: "approval",
  Resumed: "fixed",
  Superseded: "inconclusive"
};

function formatMoment(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function shortHash(value: string): string {
  return `${value.slice(0, 12)}…${value.slice(-8)}`;
}

function LinkRail({
  intervention
}: {
  intervention: ModelToolIntervention | null;
}) {
  const resolved =
    intervention?.status === "Resumed" || intervention?.status === "Cancelled";
  const steps = [
    { label: "Policy paused", tone: "approval" as const, complete: true },
    {
      label: "Envelope bound",
      tone: "brand" as const,
      complete: intervention !== null
    },
    {
      label: resolved ? "Decision sealed" : "Reviewer decision",
      tone: resolved ? ("fixed" as const) : ("neutral" as const),
      complete: resolved
    }
  ];

  return (
    <ol aria-label="Intervention progress" className="grid grid-cols-3">
      {steps.map((step, index) => (
        <li className="relative flex min-w-0 flex-col gap-2" key={step.label}>
          {index < steps.length - 1 ? (
            <span
              aria-hidden
              className={cn(
                "absolute left-3 top-2 h-px w-[calc(100%-1rem)]",
                step.complete ? "bg-brand/70" : "bg-line"
              )}
            />
          ) : null}
          <span
            aria-hidden
            className={cn(
              "relative z-10 size-4 rounded-full border-2 bg-[#081224] shadow-[0_0_10px_rgba(60,150,255,0.2)]",
              step.complete ? "border-brand" : "border-line"
            )}
          />
          <span className="pr-3 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-muted">
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function ModelInterventionQueue() {
  const queue = useApiResource(() => api.listModelToolInterventions(), [], {
    refetchIntervalMs: 30_000
  });
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null
  );
  const [transport, setTransport] =
    useState<ModelToolInterventionTransport>("CopyLink");
  const [expiresInMinutes, setExpiresInMinutes] = useState(15);
  const [issued, setIssued] = useState<IssueModelToolInterventionResult | null>(
    null
  );
  const [reviewToken, setReviewToken] = useState<string | null>(null);
  const [reviewRecord, setReviewRecord] =
    useState<ModelToolIntervention | null>(null);
  const [reason, setReason] = useState("");
  const [reviewReference, setReviewReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const items = useMemo(() => queue.data?.items ?? [], [queue.data?.items]);
  const selected =
    items.find((item) => item.toolRequestId === selectedRequestId) ??
    items[0] ??
    null;

  useEffect(() => {
    if (selectedRequestId === null && items[0]) {
      setSelectedRequestId(items[0].toolRequestId);
    }
  }, [items, selectedRequestId]);

  useEffect(() => {
    const fragment = window.location.hash.replace(/^#/u, "");
    if (!fragment) return;
    const params = new URLSearchParams(fragment);
    const interventionId = params.get("intervention");
    const token = params.get("token");
    if (!interventionId || !token) return;

    setBusy(true);
    setError(null);
    void api
      .inspectModelToolIntervention(interventionId, { token })
      .then((record) => {
        setReviewRecord(record);
        setReviewToken(token);
        setSelectedRequestId(record.toolRequestId);
        setNotice(
          record.status === "Pending"
            ? "Signed envelope verified. Review every bound field before deciding."
            : `This intervention is already ${record.status.toLowerCase()}.`
        );
      })
      .catch((caught: unknown) => {
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to verify this intervention link."
        );
      })
      .finally(() => setBusy(false));
  }, []);

  async function issueLink(item: ModelToolInterventionQueueItem) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.issueModelToolIntervention(item.toolRequestId, {
        expiresInMinutes,
        transport
      });
      setIssued(result);
      setReviewRecord(result.intervention);
      setNotice(
        "One-time link issued. Its raw token exists only in this response and the URL you copy."
      );
      await queue.refetch();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to issue an intervention link."
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyReviewLink() {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.reviewUrl);
      setNotice(
        "Signed review link copied. Slack or Teams may carry it; the message itself has no approval authority."
      );
    } catch {
      setError("Clipboard access was denied. Copy the visible link manually.");
    }
  }

  async function decide(decision: "Resume" | "Cancel") {
    if (!reviewRecord || !reviewToken) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.decideModelToolIntervention(
        reviewRecord.interventionId,
        {
          decision,
          reason,
          reviewReference,
          token: reviewToken
        }
      );
      setReviewRecord(result.intervention);
      setReviewToken(null);
      setIssued(null);
      setNotice(
        decision === "Resume"
          ? "Resume sealed. The tool request is approved but still requires an explicit execute action."
          : "Cancellation sealed. The paused tool request cannot execute."
      );
      window.history.replaceState(null, "", window.location.pathname);
      await queue.refetch();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to record the intervention decision."
      );
    } finally {
      setBusy(false);
    }
  }

  if (queue.loading) {
    return <LoadingSkeleton rows={5} />;
  }
  if (queue.error && !queue.data) {
    return <ErrorState message={queue.error} onRetry={() => queue.refetch()} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          label="Awaiting a human"
          value={queue.data?.pendingCount ?? 0}
          tone="approval"
        />
        <Metric
          label="Live review links"
          value={queue.data?.reviewLinkCount ?? 0}
          tone="brand"
        />
        <Metric label="Message approvals" value="0" tone="fixed" />
      </div>

      {notice ? (
        <p
          aria-live="polite"
          className="rounded-control border border-brand/35 bg-brand/8 px-3 py-2 text-[12px] text-[#cfe0ff]"
        >
          {notice}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-control border border-missed/40 bg-missed/8 px-3 py-2 text-[12px] text-missed"
        >
          {error}
        </p>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          title="No paused tool requests"
          description="When policy requires a human, the exact request appears here. Periscan will not queue or execute it while it is paused."
        />
      ) : (
        <div className="grid min-h-[560px] gap-4 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.7fr)]">
          <Panel aria-label="Intervention queue">
            <PanelHeader
              title="Intervention queue"
              actions={
                <StateBadge tone="approval">
                  {queue.data?.pendingCount ?? 0} paused
                </StateBadge>
              }
            />
            <div className="divide-y divide-line">
              {items.map((item) => {
                const active = item.toolRequestId === selected?.toolRequestId;
                return (
                  <button
                    aria-pressed={active}
                    className={cn(
                      "group flex w-full flex-col gap-2 border-l-2 px-4 py-4 text-left transition",
                      active
                        ? "border-l-brand bg-brand/10"
                        : "border-l-transparent hover:bg-brand/5"
                    )}
                    key={item.toolRequestId}
                    onClick={() => {
                      setSelectedRequestId(item.toolRequestId);
                      setIssued(null);
                      setError(null);
                    }}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <strong className="min-w-0 truncate font-display text-[13px] text-ink">
                        {item.toolName}
                      </strong>
                      <StateBadge tone={STATUS_TONE[item.status] ?? "neutral"}>
                        {item.status}
                      </StateBadge>
                    </div>
                    <p className="line-clamp-2 text-[12px] leading-5 text-muted">
                      {item.requestReason}
                    </p>
                    <div className="flex items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.07em] text-subtle">
                      <span>{item.sessionMode}</span>
                      <span>
                        {item.intervention?.status ?? "No link issued"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </Panel>

          {selected ? (
            <Panel aria-label="Authorization envelope">
              <PanelHeader
                title="Exact authorization envelope"
                actions={
                  <StateBadge tone={STATUS_TONE[selected.status] ?? "neutral"}>
                    {selected.status}
                  </StateBadge>
                }
              />
              <div className="flex flex-col gap-5 p-5">
                <LinkRail
                  intervention={
                    reviewRecord?.toolRequestId === selected.toolRequestId
                      ? reviewRecord
                      : selected.intervention
                  }
                />

                <div>
                  <p className="font-display text-lg font-semibold text-ink">
                    {selected.toolName}
                  </p>
                  <p className="mt-1 max-w-2xl text-[13px] leading-6 text-muted">
                    {selected.requestReason}
                  </p>
                </div>

                <dl className="grid gap-px overflow-hidden rounded-control border border-line bg-line sm:grid-cols-2">
                  <Fact
                    label="Session purpose"
                    value={selected.sessionPurpose}
                  />
                  <Fact label="Session mode" value={selected.sessionMode} />
                  <Fact
                    label="Policy profile"
                    value={selected.policyProfileName}
                  />
                  <Fact
                    label="Verified scopes"
                    value={
                      selected.scopeIds.length > 0
                        ? `${selected.scopeIds.length} bound`
                        : "None"
                    }
                  />
                  <Fact
                    label="Input commitment"
                    mono
                    value={shortHash(selected.inputPayloadHash)}
                  />
                  <Fact
                    label="Policy decision"
                    mono
                    value={selected.policyDecisionId?.slice(0, 13) ?? "None"}
                  />
                </dl>

                {selected.status === "RequiresApproval" ? (
                  <div className="rounded-card border border-[#2b477f] bg-[#071126] p-4">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div>
                        <p className="font-display text-sm font-semibold text-ink">
                          Issue a bounded handoff
                        </p>
                        <p className="mt-1 max-w-xl text-[12px] leading-5 text-muted">
                          The transport carries a signed link only. The reviewer
                          must sign in, reverify this envelope, and choose
                          resume or cancel exactly once.
                        </p>
                      </div>
                      <StateBadge tone="fixed" variant="outline">
                        Raw token not stored
                      </StateBadge>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                      <label
                        className={fieldClass}
                        htmlFor="intervention-transport"
                      >
                        Transport label
                        <select
                          id="intervention-transport"
                          aria-label="Transport label"
                          className={inputClass}
                          onChange={(event) =>
                            setTransport(
                              event.target
                                .value as ModelToolInterventionTransport
                            )
                          }
                          value={transport}
                        >
                          <option value="CopyLink">Copy link</option>
                          <option value="Slack">Slack</option>
                          <option value="Teams">Teams</option>
                          <option value="Other">Other</option>
                        </select>
                      </label>
                      <label
                        className={fieldClass}
                        htmlFor="intervention-expiry"
                      >
                        Expires after
                        <select
                          id="intervention-expiry"
                          aria-label="Expires after"
                          className={inputClass}
                          onChange={(event) =>
                            setExpiresInMinutes(Number(event.target.value))
                          }
                          value={expiresInMinutes}
                        >
                          <option value={5}>5 minutes</option>
                          <option value={15}>15 minutes</option>
                          <option value={30}>30 minutes</option>
                          <option value={60}>60 minutes</option>
                        </select>
                      </label>
                      <Button
                        loading={busy}
                        onClick={() => issueLink(selected)}
                      >
                        Issue review link
                      </Button>
                    </div>
                  </div>
                ) : null}

                {issued?.intervention.toolRequestId ===
                selected.toolRequestId ? (
                  <div className="rounded-card border border-brand/50 bg-brand/8 p-4 shadow-[0_0_30px_rgba(60,150,255,0.08)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-display text-sm font-semibold text-ink">
                          Signed handoff ready
                        </p>
                        <p className="mt-1 text-[12px] text-muted">
                          Expires {formatMoment(issued.intervention.expiresAt)}{" "}
                          · fingerprint{" "}
                          {shortHash(issued.intervention.tokenFingerprint)}
                        </p>
                      </div>
                      <Button onClick={copyReviewLink} size="sm">
                        Copy signed link
                      </Button>
                    </div>
                    <p className="mt-3 break-all rounded-control border border-line bg-[#050b16] px-3 py-2 font-mono text-[10px] leading-5 text-[#9fc3ff]">
                      {issued.reviewUrl}
                    </p>
                  </div>
                ) : null}

                {reviewRecord?.toolRequestId === selected.toolRequestId ? (
                  <div className="rounded-card border border-approval/45 bg-approval/[0.04] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-display text-sm font-semibold text-ink">
                          Reviewer decision rail
                        </p>
                        <p className="mt-1 text-[12px] text-muted">
                          Envelope {shortHash(reviewRecord.envelopeHash)} ·
                          expires {formatMoment(reviewRecord.expiresAt)}
                        </p>
                      </div>
                      <StateBadge
                        tone={STATUS_TONE[reviewRecord.status] ?? "neutral"}
                      >
                        {reviewRecord.status}
                      </StateBadge>
                    </div>

                    {reviewRecord.status === "Pending" && reviewToken ? (
                      <div className="mt-4 grid gap-3">
                        <label className={fieldClass}>
                          Decision reason
                          <textarea
                            className={cn(inputClass, "min-h-20 resize-y")}
                            onChange={(event) => setReason(event.target.value)}
                            placeholder="Explain why this exact request should resume or be cancelled."
                            value={reason}
                          />
                        </label>
                        <label className={fieldClass}>
                          Review reference
                          <input
                            className={inputClass}
                            onChange={(event) =>
                              setReviewReference(event.target.value)
                            }
                            placeholder="CAB-214, incident, or change record"
                            value={reviewReference}
                          />
                        </label>
                        <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
                          <Button
                            disabled={
                              reason.trim().length < 10 ||
                              reviewReference.trim().length < 3
                            }
                            loading={busy}
                            onClick={() => decide("Cancel")}
                            variant="danger"
                          >
                            Cancel request
                          </Button>
                          <Button
                            disabled={
                              reason.trim().length < 10 ||
                              reviewReference.trim().length < 3
                            }
                            loading={busy}
                            onClick={() => decide("Resume")}
                          >
                            Resume request
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-4 rounded-control border border-line bg-[#081224] px-3 py-2 text-[12px] text-muted">
                        {reviewRecord.decision
                          ? `${reviewRecord.decision} sealed by an authenticated tenant administrator. This link cannot be replayed.`
                          : "Open the current transported link to decide. Queue data never includes the raw token."}
                      </p>
                    )}
                  </div>
                ) : selected.intervention ? (
                  <div className="rounded-control border border-line bg-[#081224] px-3 py-3 text-[12px] leading-5 text-muted">
                    A {selected.intervention.status.toLowerCase()} link exists,
                    but its raw token is never returned by the queue. Open the
                    transported link, or issue a new link to supersede it.
                  </div>
                ) : null}
              </div>
            </Panel>
          ) : null}
        </div>
      )}

      <p className="text-[11px] leading-5 text-subtle">
        {queue.data?.limitations.join(" ")}
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  tone
}: {
  label: string;
  value: number | string;
  tone: StateTone;
}) {
  return (
    <div className="rounded-card border border-line bg-[#081224] px-4 py-3">
      <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">
        {label}
      </p>
      <div className="mt-2 flex items-center justify-between">
        <strong className="font-display text-2xl font-semibold text-ink">
          {value}
        </strong>
        <StateBadge tone={tone}>{label}</StateBadge>
      </div>
    </div>
  );
}

function Fact({
  label,
  mono = false,
  value
}: {
  label: string;
  mono?: boolean;
  value: string;
}) {
  return (
    <div className="min-w-0 bg-[#081224] px-3 py-3">
      <dt className="font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-subtle">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 truncate text-[12px] text-ink",
          mono && "font-mono text-[10px] text-[#9fc3ff]"
        )}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

"use client";

import { useState } from "react";

import type { ProofLoopStage } from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { buttonClassName, cn } from "../ui";

export function WorkflowFeedback({
  evidencePackId,
  missionId,
  prompt = "Did this workflow make the next safe action clear?",
  route,
  stage
}: {
  evidencePackId?: string;
  missionId?: string;
  prompt?: string;
  route: string;
  stage: ProofLoopStage;
}) {
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (rating == null && !comment.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.submitProductFeedback({
        comment: comment.trim() || null,
        evidencePackId: evidencePackId ?? null,
        missionId: missionId ?? null,
        rating,
        route,
        stage
      });
      setSent(true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Feedback could not be saved."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="Workflow feedback"
      className="rounded-card border border-line bg-elevated px-4 py-4"
    >
      {sent ? (
        <div
          role="status"
          className="flex items-center gap-2 text-sm text-muted"
        >
          <span
            aria-hidden
            className="grid size-5 place-items-center rounded-full bg-fixed/15 text-fixed"
          >
            ✓
          </span>
          Feedback saved with this {stage.toLowerCase()} workflow context.
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">
                Help improve the proof loop
              </p>
              <h2 className="mt-1 text-sm font-semibold text-ink">{prompt}</h2>
            </div>
            <div
              className="flex items-center gap-1"
              aria-label="Workflow clarity rating"
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`${value} out of 5`}
                  aria-pressed={rating === value}
                  onClick={() => setRating(value)}
                  className={cn(
                    "grid size-8 place-items-center rounded-control border font-mono text-xs transition-colors",
                    rating === value
                      ? "border-brand-fill bg-brand-fill text-white"
                      : "border-line text-muted hover:border-line-strong hover:text-ink"
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          {rating != null ? (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="flex-1 text-xs font-medium text-muted">
                What slowed you down?{" "}
                <span className="font-normal text-subtle">Optional</span>
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  maxLength={2000}
                  rows={2}
                  className="mt-1.5 w-full resize-y rounded-control border border-line bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-brand"
                />
              </label>
              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className={buttonClassName({
                  size: "sm",
                  variant: "secondary"
                })}
              >
                {busy ? "Saving…" : "Send feedback"}
              </button>
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="mt-2 text-xs text-missed">
              {error}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  ControlSource,
  ExpectedControlBehavior,
  RemediationAction
} from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { InlineError, StateBadge, buttonClassName, cn } from "../ui";

const BEHAVIORS = [
  "Detected",
  "Blocked",
  "Logged",
  "Alerted",
  "Routed"
] as const;

export function GovernedRemediationAction({
  remediationId
}: {
  remediationId: string;
}) {
  const [controls, setControls] = useState<ControlSource[]>([]);
  const [controlSourceId, setControlSourceId] = useState("");
  const [behaviors, setBehaviors] = useState<ExpectedControlBehavior[]>([]);
  const [action, setAction] = useState<RemediationAction | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      api.listControlSources(),
      api.listRemediationActions(remediationId)
    ])
      .then(([nextControls, actions]) => {
        if (!active) return;
        setControls(nextControls);
        setAction(actions[0] ?? null);
        const first = nextControls[0];
        if (first) {
          setControlSourceId(first.controlSourceId);
          setBehaviors(first.expectedBehaviors);
        }
      })
      .catch((caught) => {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Couldn't load governed action readiness."
          );
        }
      });
    return () => {
      active = false;
    };
  }, [remediationId]);

  const selected = useMemo(
    () => controls.find((item) => item.controlSourceId === controlSourceId),
    [controlSourceId, controls]
  );

  function selectControl(nextId: string) {
    setControlSourceId(nextId);
    const next = controls.find((item) => item.controlSourceId === nextId);
    setBehaviors(next?.expectedBehaviors ?? []);
    setAction(null);
  }

  function toggleBehavior(value: ExpectedControlBehavior) {
    setBehaviors((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );
    setAction(null);
  }

  async function preview() {
    if (!selected || behaviors.length === 0) return;
    setBusy("preview");
    setError(null);
    try {
      const next = await api.previewRemediationAction(remediationId, {
        actionType: "ControlExpectationTuning",
        controlSourceId: selected.controlSourceId,
        idempotencyKey: `${remediationId}:${selected.controlSourceId}:${[...behaviors].sort().join("-")}`,
        nextExpectedBehaviors: behaviors
      });
      setAction(next);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Action preview failed."
      );
    } finally {
      setBusy(null);
    }
  }

  async function confirm(operation: "approve" | "execute" | "rollback") {
    if (!action) return;
    setBusy(operation);
    setError(null);
    try {
      setAction(
        await api.confirmRemediationAction(
          action.remediationActionId,
          operation,
          action.previewHash
        )
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : `Couldn't ${operation} the action.`
      );
    } finally {
      setBusy(null);
    }
  }

  const phase = action?.state ?? "Draft";
  const lifecycle = [
    ["Preview", ["AwaitingApproval", "Approved", "Applied", "RolledBack"]],
    ["Approve", ["Approved", "Applied", "RolledBack"]],
    ["Apply", ["Applied", "RolledBack"]],
    ["Verify", []],
    ["Proof", []]
  ] as const;

  return (
    <section
      aria-label="Governed remediation action"
      className="overflow-hidden rounded-control border border-brand/30 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-brand)_8%,transparent),transparent_62%)]"
    >
      <div className="border-b border-line px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-subtle">
              Governed action manifest
            </p>
            <h3 className="mt-1 text-sm font-semibold text-ink">
              Preview the write. Approve the hash. Prove the result.
            </h3>
          </div>
          <StateBadge
            dot={false}
            tone={
              phase === "Applied"
                ? "approval"
                : phase === "RolledBack"
                  ? "inconclusive"
                  : phase === "Approved"
                    ? "validated"
                    : "approval"
            }
          >
            {phase === "Applied" ? "Applied · verification required" : phase}
          </StateBadge>
        </div>
        <p className="mt-1 max-w-3xl text-[11px] leading-4 text-muted">
          This first reversible action changes only Periscan&apos;s expected
          control behavior. It never mutates the external security product and
          can never mark a risk Fixed without a fresh measured re-test.
        </p>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div
          aria-label={`Remediation action lifecycle: ${phase}`}
          className="grid grid-cols-5 gap-1"
          role="status"
        >
          {lifecycle.map(([label, activeStates]) => {
            const active = (activeStates as readonly string[]).includes(phase);
            return (
              <span
                className={cn(
                  "rounded-control border px-1 py-1.5 text-center font-mono text-[9px]",
                  active
                    ? "border-brand/40 bg-brand/10 text-brand"
                    : "border-line text-subtle"
                )}
                key={label}
              >
                {label}
              </span>
            );
          })}
        </div>

        {controls.length === 0 ? (
          <p className="text-xs text-subtle">
            Connect and register a control source before previewing a reversible
            tuning action.
          </p>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-[11px] font-medium text-muted">
              Control source
              <select
                aria-label="Remediation action control source"
                className="rounded-control border border-line bg-surface px-2.5 py-2 text-xs text-ink"
                disabled={Boolean(action)}
                onChange={(event) => selectControl(event.target.value)}
                value={controlSourceId}
              >
                {controls.map((item) => (
                  <option
                    key={item.controlSourceId}
                    value={item.controlSourceId}
                  >
                    {item.provider} · {item.controlType}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="flex flex-wrap gap-2">
              <legend className="mb-1 text-[11px] font-medium text-muted">
                Expected behaviors after the action
              </legend>
              {BEHAVIORS.map((behavior) => (
                <label
                  className="flex items-center gap-1.5 rounded-control border border-line px-2 py-1 text-[11px] text-ink"
                  key={behavior}
                >
                  <input
                    checked={behaviors.includes(behavior)}
                    disabled={Boolean(action)}
                    onChange={() => toggleBehavior(behavior)}
                    type="checkbox"
                  />
                  {behavior}
                </label>
              ))}
            </fieldset>
            {!action ? (
              <button
                className={buttonClassName({ size: "sm", variant: "primary" })}
                disabled={
                  busy === "preview" ||
                  behaviors.length === 0 ||
                  (selected
                    ? JSON.stringify([...selected.expectedBehaviors].sort()) ===
                      JSON.stringify([...behaviors].sort())
                    : true)
                }
                onClick={() => void preview()}
                type="button"
              >
                {busy === "preview"
                  ? "Hashing exact diff…"
                  : "Preview exact diff"}
              </button>
            ) : null}
          </>
        )}

        {action ? (
          <div className="rounded-control border border-line bg-surface/90 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-subtle">
                  Before
                </p>
                <p className="mt-1 text-xs text-ink">
                  {action.manifest.exactDiff.before.join(" · ")}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-subtle">
                  After
                </p>
                <p className="mt-1 text-xs text-brand">
                  {action.manifest.exactDiff.after.join(" · ")}
                </p>
              </div>
            </div>
            <dl className="mt-3 grid gap-2 text-[10px] sm:grid-cols-2">
              <div>
                <dt className="text-subtle">Exact preview hash</dt>
                <dd className="break-all font-mono text-ink">
                  {action.previewHash}
                </dd>
              </div>
              <div>
                <dt className="text-subtle">Blast radius</dt>
                <dd className="text-ink">{action.manifest.blastRadius}</dd>
              </div>
              <div>
                <dt className="text-subtle">Rollback</dt>
                <dd className="text-ink">
                  {action.manifest.rollback.operation}
                </dd>
              </div>
              <div>
                <dt className="text-subtle">Verification gate</dt>
                <dd className="text-ink">
                  Applied ≠ Fixed · {action.manifest.verification.method}
                </dd>
              </div>
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              {action.state === "AwaitingApproval" ? (
                <button
                  className={buttonClassName({
                    size: "sm",
                    variant: "secondary"
                  })}
                  disabled={busy === "approve"}
                  onClick={() => void confirm("approve")}
                  type="button"
                >
                  {busy === "approve" ? "Approving…" : "Approve exact hash"}
                </button>
              ) : null}
              {action.state === "Approved" ? (
                <button
                  className={buttonClassName({
                    size: "sm",
                    variant: "primary"
                  })}
                  disabled={busy === "execute"}
                  onClick={() => void confirm("execute")}
                  type="button"
                >
                  {busy === "execute" ? "Applying…" : "Apply governed action"}
                </button>
              ) : null}
              {action.state === "Applied" ? (
                <button
                  className={buttonClassName({ size: "sm", variant: "danger" })}
                  disabled={busy === "rollback"}
                  onClick={() => void confirm("rollback")}
                  type="button"
                >
                  {busy === "rollback"
                    ? "Rolling back…"
                    : "Roll back exact diff"}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {error ? (
          <InlineError
            message={error}
            onDismiss={() => setError(null)}
            tone="error"
          />
        ) : null}
      </div>
    </section>
  );
}

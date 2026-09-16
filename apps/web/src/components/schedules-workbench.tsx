"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type {
  MissionSchedule,
  ScheduleBlackoutWindow,
  ScheduleTiming,
  Scope
} from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import {
  estimateNextFireTimes,
  formatFireTime
} from "../lib/schedule-next-runs";
import { useApiResource } from "../hooks/use-api-resource";
import {
  ErrorState,
  ConfirmDialog,
  EmptyState,
  InlineError,
  LoadingSkeleton,
  PageHeader,
  PageShell,
  Panel,
  PanelHeader,
  StateBadge,
  buttonClassName,
  cn
} from "../ui";
import { ContinuousHealthStrip } from "./continuous-health-strip";

const FREQUENCIES = ["Daily", "Weekly", "Monthly"] as const;
const MISSION_TYPES = [
  "ValidationSnapshot",
  "ContinuousValidation",
  "AIAppValidation",
  "ControlValidation",
  "FixVerification"
] as const;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const COMMON_TIME_ZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney"
];

function localTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function scheduleTiming(schedule: MissionSchedule): ScheduleTiming {
  const stored =
    schedule.config.scheduleTiming &&
    typeof schedule.config.scheduleTiming === "object" &&
    !Array.isArray(schedule.config.scheduleTiming)
      ? (schedule.config.scheduleTiming as Record<string, unknown>)
      : {};
  const next = new Date(schedule.nextRunAt);
  return {
    blackoutWindows: Array.isArray(stored.blackoutWindows)
      ? (stored.blackoutWindows as ScheduleBlackoutWindow[])
      : [],
    dayOfMonth:
      typeof stored.dayOfMonth === "number"
        ? stored.dayOfMonth
        : next.getUTCDate(),
    dayOfWeek:
      typeof stored.dayOfWeek === "number"
        ? stored.dayOfWeek
        : next.getUTCDay(),
    runAtLocalTime:
      typeof stored.runAtLocalTime === "string"
        ? stored.runAtLocalTime
        : `${String(next.getUTCHours()).padStart(2, "0")}:${String(next.getUTCMinutes()).padStart(2, "0")}`,
    timeZone: typeof stored.timeZone === "string" ? stored.timeZone : "UTC"
  };
}

function relTime(iso?: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = then - Date.now();
  const future = diff > 0;
  const mins = Math.round(Math.abs(diff) / 60000);
  const unit =
    mins < 60
      ? `${mins}m`
      : mins < 1440
        ? `${Math.round(mins / 60)}h`
        : `${Math.round(mins / 1440)}d`;
  return future ? `in ${unit}` : `${unit} ago`;
}

export function SchedulesWorkbench() {
  const schedules = useApiResource(() => api.listSchedules(), []);
  const scopes = useApiResource(() => api.listScopes(), []);

  const [frequency, setFrequency] = useState<(typeof FREQUENCIES)[number]>("Weekly");
  const [missionType, setMissionType] =
    useState<(typeof MISSION_TYPES)[number]>("ValidationSnapshot");
  const [scopeIds, setScopeIds] = useState<Set<string>>(new Set());
  const [runAtLocalTime, setRunAtLocalTime] = useState("09:00");
  const [timeZone, setTimeZone] = useState(localTimeZone);
  const [dayOfWeek, setDayOfWeek] = useState(new Date().getDay());
  const [dayOfMonth, setDayOfMonth] = useState(
    Math.min(new Date().getDate(), 28)
  );
  const [blackoutEnabled, setBlackoutEnabled] = useState(false);
  const [blackoutStart, setBlackoutStart] = useState("22:00");
  const [blackoutEnd, setBlackoutEnd] = useState("06:00");
  const [blackoutDays, setBlackoutDays] = useState<Set<number>>(
    new Set([0, 6])
  );
  const [communityValidation, setCommunityValidation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ICP-P2-1: list-first; create form collapsed unless empty program or user opens it.
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createFormSeeded, setCreateFormSeeded] = useState(false);

  const items = schedules.data?.items ?? [];

  useEffect(() => {
    if (createFormSeeded || schedules.loading) return;
    // Empty program: open create so first schedule is one click away.
    if (items.length === 0) {
      setShowCreateForm(true);
    }
    setCreateFormSeeded(true);
  }, [createFormSeeded, items.length, schedules.loading]);

  const createTiming: ScheduleTiming = useMemo(
    () => ({
      blackoutWindows:
        blackoutEnabled && blackoutDays.size > 0
          ? [
              {
                daysOfWeek: [...blackoutDays].sort(),
                endTime: blackoutEnd,
                startTime: blackoutStart
              }
            ]
          : [],
      dayOfMonth: frequency === "Monthly" ? dayOfMonth : undefined,
      dayOfWeek: frequency === "Weekly" ? dayOfWeek : undefined,
      runAtLocalTime,
      timeZone
    }),
    [
      blackoutDays,
      blackoutEnabled,
      blackoutEnd,
      blackoutStart,
      dayOfMonth,
      dayOfWeek,
      frequency,
      runAtLocalTime,
      timeZone
    ]
  );

  const nextFireTimes = useMemo(
    () => estimateNextFireTimes(frequency, createTiming, 3),
    [createTiming, frequency]
  );

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await api.createSchedule({
        blackoutWindows:
          blackoutEnabled && blackoutDays.size > 0
            ? [
                {
                  daysOfWeek: [...blackoutDays].sort(),
                  endTime: blackoutEnd,
                  startTime: blackoutStart
                }
              ]
            : [],
        dayOfMonth: frequency === "Monthly" ? dayOfMonth : undefined,
        dayOfWeek: frequency === "Weekly" ? dayOfWeek : undefined,
        frequency,
        missionType,
        runAtLocalTime,
        scopeIds: scopeIds.size ? [...scopeIds] : undefined,
        timeZone,
        ...(missionType === "ValidationSnapshot" && communityValidation
          ? { config: { communityValidation: true } }
          : {})
      });
      setScopeIds(new Set());
      setCommunityValidation(false);
      await schedules.refetch();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't create the schedule.");
    } finally {
      setBusy(false);
    }
  }

  function toggleScope(id: string) {
    setScopeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleBlackoutDay(day: number) {
    setBlackoutDays((current) => {
      const next = new Set(current);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  return (
    <PageShell width="narrow">
      <PageHeader
        eyebrow="Operate"
        title="Schedules"
        description="Keep validation continuous on verified scope. ContinuousValidation queues allowlisted safe external/recon modules and diffs the prior snapshot for path/risk change — not an autonomous living map. Imported scan fabric stays Imported ≠ Measured."
        meta={
          <button
            type="button"
            data-testid="schedules-new-toggle"
            aria-expanded={showCreateForm}
            onClick={() => setShowCreateForm((open) => !open)}
            className={buttonClassName({
              size: "sm",
              variant: showCreateForm ? "secondary" : "primary"
            })}
          >
            {showCreateForm ? "Hide new schedule" : "New schedule"}
          </button>
        }
      />

      {/* ICP-P1-7: continuous health on schedules header + /continuous deep-link */}
      <ContinuousHealthStrip />

      {/* ICP-P2-1: list-first program health */}
      <Panel data-testid="schedules-list">
        <PanelHeader title={`Schedules (${items.length})`} />
        {schedules.loading ? (
          <LoadingSkeleton rows={4} />
        ) : schedules.error ? (
          <ErrorState message={schedules.error} onRetry={schedules.refetch} />
        ) : items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No schedules yet"
              description="Create a recurring validation to run continuously and track drift."
              action={
                <button
                  type="button"
                  onClick={() => setShowCreateForm(true)}
                  className="text-xs font-semibold text-brand hover:text-brand-2"
                >
                  New schedule →
                </button>
              }
            />
          </div>
        ) : (
          <ul>
            {items.map((schedule) => (
              <ScheduleRow
                key={schedule.scheduleId}
                schedule={schedule}
                scopes={scopes.data ?? []}
                onChanged={schedules.refetch}
              />
            ))}
          </ul>
        )}
      </Panel>

      {/* Create form — collapsed behind New schedule when a program already runs */}
      {showCreateForm ? (
        <Panel id="new-schedule" data-testid="schedules-create-form">
          <PanelHeader title="New recurring validation" />
          <div className="flex flex-col gap-3 p-4">
            {missionType === "ContinuousValidation" ? (
              <p
                className="rounded-control border border-line bg-elevated/50 px-3 py-2 text-xs leading-5 text-muted"
                data-testid="continuous-easm-schedule-note"
              >
                ContinuousValidation fires allowlisted safe External PoA (Nuclei)
                and control-plane posture modules on verified Domain/Subdomain
                scopes, plus optional recon on internal scope. Snapshot path/risk
                diffs are change detection only — not a living external map.
              </p>
            ) : null}
            {missionType === "ValidationSnapshot" ? (
              <div
                className="rounded-control border border-line bg-elevated/50 px-3 py-2"
                data-testid="community-validation-schedule-opt-in"
              >
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={communityValidation}
                    onChange={(event) =>
                      setCommunityValidation(event.target.checked)
                    }
                  />
                  Run Community validation pack
                </label>
                <p className="mt-1 text-xs leading-5 text-subtle">
                  Starts engines; snapshot report is separate.
                </p>
              </div>
            ) : null}
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1">
                <SmallLabel>Mission</SmallLabel>
                <select
                  value={missionType}
                  onChange={(e) => setMissionType(e.target.value as typeof missionType)}
                  className="rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-line-strong"
                >
                  {MISSION_TYPES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <SmallLabel>Frequency</SmallLabel>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as typeof frequency)}
                  className="rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-line-strong"
                >
                  {FREQUENCIES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <SmallLabel>Run at</SmallLabel>
                <input
                  aria-label="Run time"
                  type="time"
                  value={runAtLocalTime}
                  onChange={(event) => setRunAtLocalTime(event.target.value)}
                  className="rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-line-strong"
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1">
                <SmallLabel>Timezone</SmallLabel>
                <select
                  aria-label="Schedule timezone"
                  value={timeZone}
                  onChange={(event) => setTimeZone(event.target.value)}
                  className="max-w-[15rem] rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-line-strong"
                >
                  {[...new Set([timeZone, ...COMMON_TIME_ZONES])].map((zone) => (
                    <option key={zone} value={zone}>{zone}</option>
                  ))}
                </select>
              </label>
              {frequency === "Weekly" ? (
                <label className="flex flex-col gap-1">
                  <SmallLabel>Day</SmallLabel>
                  <select
                    aria-label="Weekly run day"
                    value={dayOfWeek}
                    onChange={(event) => setDayOfWeek(Number(event.target.value))}
                    className="rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink"
                  >
                    {WEEKDAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}
                  </select>
                </label>
              ) : null}
              {frequency === "Monthly" ? (
                <label className="flex flex-col gap-1">
                  <SmallLabel>Day of month</SmallLabel>
                  <input
                    aria-label="Monthly run day"
                    type="number"
                    min={1}
                    max={28}
                    value={dayOfMonth}
                    onChange={(event) => setDayOfMonth(Number(event.target.value))}
                    className="w-24 rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink"
                  />
                </label>
              ) : null}
              <button
                type="button"
                onClick={create}
                disabled={busy}
                className={buttonClassName({ size: "sm", variant: "primary" })}
              >
                {busy ? "Creating…" : "Create schedule"}
              </button>
            </div>
            <div className="rounded-control border border-line bg-surface-strong/40 p-3">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={blackoutEnabled}
                  onChange={(event) => setBlackoutEnabled(event.target.checked)}
                />
                Recurring blackout window
              </label>
              {blackoutEnabled ? (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <label className="flex flex-col gap-1 text-xs text-muted">
                    Starts
                    <input aria-label="Blackout starts" type="time" value={blackoutStart} onChange={(event) => setBlackoutStart(event.target.value)} className="rounded-control border border-line bg-surface px-2 py-1.5 text-sm" />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-muted">
                    Ends
                    <input aria-label="Blackout ends" type="time" value={blackoutEnd} onChange={(event) => setBlackoutEnd(event.target.value)} className="rounded-control border border-line bg-surface px-2 py-1.5 text-sm" />
                  </label>
                  <div className="flex flex-wrap gap-1" aria-label="Blackout days">
                    {WEEKDAYS.map((day, index) => (
                      <button
                        key={day}
                        type="button"
                        aria-pressed={blackoutDays.has(index)}
                        onClick={() => toggleBlackoutDay(index)}
                        className={cn(
                          "rounded-control border px-2 py-1 text-xs",
                          blackoutDays.has(index)
                            ? "border-brand/60 bg-brand/10 text-ink"
                            : "border-line text-muted"
                        )}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <p className="mt-2 text-xs text-subtle">
                If a run lands inside a blackout, Periscan moves it to the end of that window. Policy is re-evaluated before every run; denied work is never queued.
              </p>
            </div>
            {scopes.data && scopes.data.length > 0 ? (
              <div className="flex flex-col gap-1">
                <SmallLabel>Scopes (optional)</SmallLabel>
                <div className="flex flex-wrap gap-1.5">
                  {scopes.data.map((scope) => (
                    <button
                      key={scope.scopeId}
                      type="button"
                      onClick={() => toggleScope(scope.scopeId)}
                      className={cn(
                        "rounded-control border px-2.5 py-1 text-[12px] transition-colors",
                        scopeIds.has(scope.scopeId)
                          ? "border-brand/60 bg-brand/12 text-ink"
                          : "border-line text-muted hover:text-ink"
                      )}
                    >
                      {scope.value}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div
              className="rounded-control border border-line bg-surface-strong/30 px-3 py-2.5"
              aria-live="polite"
              data-testid="next-run-preview"
            >
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
                Next runs (estimate)
              </p>
              <ol className="mt-1.5 flex flex-col gap-0.5">
                {nextFireTimes.map((fireAt, index) => (
                  <li
                    key={`${fireAt.toISOString()}-${index}`}
                    className="font-mono text-[12px] text-ink"
                  >
                    <span className="text-subtle">{index + 1}.</span>{" "}
                    {formatFireTime(fireAt, timeZone)}
                  </li>
                ))}
              </ol>
              <p className="mt-1.5 text-[11px] text-subtle">
                Client-side preview from {frequency.toLowerCase()} cadence, local
                run time, and timezone
                {createTiming.blackoutWindows.length
                  ? " (blackout windows applied)"
                  : ""}
                . Exact next run is set when the schedule is created.
              </p>
            </div>
            {error ? <p className="text-sm text-missed">{error}</p> : null}
          </div>
        </Panel>
      ) : null}
    </PageShell>
  );
}

type SchedulePriorDiff = {
  at?: string | null;
  outcome?: string | null;
  packId?: string | null;
  packType?: string | null;
  runId?: string | null;
  diff?: unknown;
};

function ScheduleRow({
  schedule,
  scopes,
  onChanged
}: {
  schedule: MissionSchedule;
  scopes: Scope[];
  onChanged: () => void;
}) {
  const timing = scheduleTiming(schedule);
  const [busy, setBusy] = useState<
    "run" | "toggle" | "edit" | "delete" | "history" | null
  >(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editFrequency, setEditFrequency] = useState(schedule.frequency);
  const [editRunAt, setEditRunAt] = useState(timing.runAtLocalTime);
  const [editTimeZone, setEditTimeZone] = useState(timing.timeZone);
  const [editDayOfWeek, setEditDayOfWeek] = useState(timing.dayOfWeek ?? 1);
  const [editDayOfMonth, setEditDayOfMonth] = useState(timing.dayOfMonth ?? 1);
  const [editBlackout, setEditBlackout] = useState(
    timing.blackoutWindows[0] ?? null
  );
  // P14-5: edit path must preserve/update scopeIds (API already accepts them).
  const [editScopeIds, setEditScopeIds] = useState<Set<string>>(
    () => new Set(schedule.scopeIds)
  );
  const [editCommunityValidation, setEditCommunityValidation] = useState(
    schedule.config.communityValidation === true
  );
  const [historyOpen, setHistoryOpen] = useState(false);
  const [priorDiffs, setPriorDiffs] = useState<SchedulePriorDiff[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const paused = schedule.status === "Paused";

  const scopeById = useMemo(() => {
    const map = new Map<string, Scope>();
    for (const scope of scopes) map.set(scope.scopeId, scope);
    return map;
  }, [scopes]);

  function openEdit() {
    // Reset draft fields from current schedule when entering edit mode.
    const current = scheduleTiming(schedule);
    setEditFrequency(schedule.frequency);
    setEditRunAt(current.runAtLocalTime);
    setEditTimeZone(current.timeZone);
    setEditDayOfWeek(current.dayOfWeek ?? 1);
    setEditDayOfMonth(current.dayOfMonth ?? 1);
    setEditBlackout(current.blackoutWindows[0] ?? null);
    setEditScopeIds(new Set(schedule.scopeIds));
    setEditCommunityValidation(schedule.config.communityValidation === true);
    setEditing(true);
  }

  function toggleEditScope(id: string) {
    setEditScopeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function loadHistory() {
    setBusy("history");
    setHistoryError(null);
    try {
      const detail = (await api.getSchedule(schedule.scheduleId)) as
        | (MissionSchedule & { priorDiffs?: SchedulePriorDiff[] })
        | null;
      setPriorDiffs(detail?.priorDiffs ?? []);
      setHistoryOpen(true);
    } catch (caught) {
      setHistoryError(
        caught instanceof Error
          ? caught.message
          : "Unable to load schedule run history."
      );
      setHistoryOpen(true);
    } finally {
      setBusy(null);
    }
  }

  async function runNow() {
    setBusy("run");
    setFlash(null);
    try {
      await api.runSchedule(schedule.scheduleId);
      setFlash("Run queued under a fresh policy decision.");
      onChanged();
    } catch (caught) {
      setFlash(
        caught instanceof Error
          ? caught.message
          : "Run failed — denied or stale work is not silently replayed."
      );
    } finally {
      setBusy(null);
    }
  }

  async function toggle() {
    setBusy("toggle");
    setToggleError(null);
    try {
      if (paused) await api.resumeSchedule(schedule.scheduleId);
      else await api.pauseSchedule(schedule.scheduleId);
      // Refetch only on success — a throw skips this so stale state isn't
      // silently trusted; the InlineError below surfaces the failure instead.
      onChanged();
    } catch (caught) {
      setToggleError(
        caught instanceof Error
          ? caught.message
          : paused
            ? "Couldn't resume the schedule."
            : "Couldn't pause the schedule."
      );
    } finally {
      setBusy(null);
    }
  }

  async function saveEdit() {
    setBusy("edit");
    setToggleError(null);
    try {
      // Always pass scopeIds so an edit cannot silently drop multi-scope binding
      // when the draft still holds the schedule's scopes (P14-5).
      const nextScopeIds =
        editScopeIds.size > 0
          ? [...editScopeIds]
          : schedule.scopeIds.length > 0
            ? [...schedule.scopeIds]
            : undefined;
      await api.updateSchedule(schedule.scheduleId, {
        blackoutWindows: editBlackout ? [editBlackout] : [],
        dayOfMonth: editFrequency === "Monthly" ? editDayOfMonth : undefined,
        dayOfWeek: editFrequency === "Weekly" ? editDayOfWeek : undefined,
        frequency: editFrequency,
        runAtLocalTime: editRunAt,
        ...(nextScopeIds ? { scopeIds: nextScopeIds } : {}),
        timeZone: editTimeZone,
        ...(schedule.missionType === "ValidationSnapshot"
          ? { config: { communityValidation: editCommunityValidation } }
          : {})
      });
      setEditing(false);
      onChanged();
    } catch (caught) {
      setToggleError(
        caught instanceof Error ? caught.message : "Couldn't update the schedule."
      );
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("delete");
    setToggleError(null);
    try {
      await api.deleteSchedule(schedule.scheduleId);
      setConfirmDelete(false);
      onChanged();
    } catch (caught) {
      setToggleError(
        caught instanceof Error ? caught.message : "Couldn't delete the schedule."
      );
    } finally {
      setBusy(null);
    }
  }

  const diff = schedule.lastDiff as Record<string, unknown> | null | undefined;

  return (
    <li className="flex flex-col gap-2 border-b border-line px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[13px] text-ink">{schedule.missionType}</span>
        {schedule.missionType === "ValidationSnapshot" &&
        schedule.config.communityValidation === true ? (
          <span className="rounded-control border border-line px-1.5 py-0.5 font-mono text-[11px] text-muted">
            Community pack
          </span>
        ) : null}
        <span className="font-mono text-[11px] text-subtle">{schedule.frequency}</span>
        <span className="font-mono text-[11px] text-subtle">
          {timing.runAtLocalTime} {timing.timeZone}
          {timing.blackoutWindows.length
            ? ` · ${timing.blackoutWindows.length} blackout`
            : ""}
        </span>
        <StateBadge tone={paused ? "inconclusive" : "fixed"} dot={false}>
          {schedule.status}
        </StateBadge>
        <span className="font-mono text-[11px] text-subtle">
          next {relTime(schedule.nextRunAt)} · last {relTime(schedule.lastRunAt)}
          {` · owner ${schedule.createdBy.slice(0, 8)}`}
        </span>
        {schedule.scopeIds.length > 0 ? (
          <span className="flex flex-wrap items-center gap-1 font-mono text-[11px] text-subtle">
            <span>· scopes</span>
            {schedule.scopeIds.map((scopeId) => {
              const scope = scopeById.get(scopeId);
              const label = scope?.value ?? scopeId.slice(0, 8);
              return (
                <Link
                  key={scopeId}
                  href={`/scopes?scopeId=${encodeURIComponent(scopeId)}`}
                  className="rounded-control border border-line px-1.5 py-0.5 text-brand hover:text-brand-2"
                  title={scopeId}
                >
                  {label}
                </Link>
              );
            })}
          </span>
        ) : null}
        {flash ? <span className="font-mono text-[11px] text-muted">{flash}</span> : null}
        <div className="ml-auto flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={runNow}
            disabled={busy !== null}
            className={buttonClassName({ size: "sm", variant: "secondary" })}
          >
            {busy === "run" ? "…" : "Run now"}
          </button>
          <button
            type="button"
            onClick={toggle}
            disabled={busy !== null}
            className={buttonClassName({ size: "sm", variant: "secondary" })}
          >
            {paused ? "Resume" : "Pause"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (historyOpen) {
                setHistoryOpen(false);
                return;
              }
              void loadHistory();
            }}
            disabled={busy !== null}
            className={buttonClassName({ size: "sm", variant: "secondary" })}
            aria-expanded={historyOpen}
          >
            {busy === "history" ? "…" : historyOpen ? "Hide history" : "History"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (editing) {
                setEditing(false);
                return;
              }
              openEdit();
            }}
            disabled={busy !== null}
            className={buttonClassName({ size: "sm", variant: "secondary" })}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={busy !== null}
            className={cn(
              buttonClassName({ size: "sm", variant: "secondary" }),
              "text-missed"
            )}
          >
            Delete
          </button>
        </div>
      </div>
      {editing ? (
        <div className="grid gap-3 rounded-control border border-line bg-surface-strong/40 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Frequency
            <select aria-label="Edit frequency" value={editFrequency} onChange={(event) => setEditFrequency(event.target.value as typeof editFrequency)} className="rounded-control border border-line bg-surface px-2 py-1.5 text-sm">
              {FREQUENCIES.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Run at
            <input aria-label="Edit run time" type="time" value={editRunAt} onChange={(event) => setEditRunAt(event.target.value)} className="rounded-control border border-line bg-surface px-2 py-1.5 text-sm" />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs text-muted">
            Timezone
            <select aria-label="Edit timezone" value={editTimeZone} onChange={(event) => setEditTimeZone(event.target.value)} className="min-w-0 rounded-control border border-line bg-surface px-2 py-1.5 text-sm">
              {[...new Set([editTimeZone, ...COMMON_TIME_ZONES])].map((zone) => <option key={zone}>{zone}</option>)}
            </select>
          </label>
          {editFrequency === "Weekly" ? (
            <label className="flex flex-col gap-1 text-xs text-muted">
              Day
              <select aria-label="Edit weekly run day" value={editDayOfWeek} onChange={(event) => setEditDayOfWeek(Number(event.target.value))} className="rounded-control border border-line bg-surface px-2 py-1.5 text-sm">
                {WEEKDAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}
              </select>
            </label>
          ) : null}
          {editFrequency === "Monthly" ? (
            <label className="flex flex-col gap-1 text-xs text-muted">
              Day of month
              <input aria-label="Edit monthly run day" type="number" min={1} max={28} value={editDayOfMonth} onChange={(event) => setEditDayOfMonth(Number(event.target.value))} className="rounded-control border border-line bg-surface px-2 py-1.5 text-sm" />
            </label>
          ) : null}
          <label className="flex items-center gap-2 text-xs text-muted sm:col-span-2">
            <input
              type="checkbox"
              checked={editBlackout !== null}
              onChange={(event) =>
                setEditBlackout(
                  event.target.checked
                    ? { daysOfWeek: [0, 6], endTime: "06:00", startTime: "22:00" }
                    : null
                )
              }
            />
            Recurring blackout
          </label>
          {editBlackout ? (
            <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
              <input aria-label="Edit blackout start" type="time" value={editBlackout.startTime} onChange={(event) => setEditBlackout({ ...editBlackout, startTime: event.target.value })} className="rounded-control border border-line bg-surface px-2 py-1.5 text-sm" />
              <input aria-label="Edit blackout end" type="time" value={editBlackout.endTime} onChange={(event) => setEditBlackout({ ...editBlackout, endTime: event.target.value })} className="rounded-control border border-line bg-surface px-2 py-1.5 text-sm" />
              {WEEKDAYS.map((day, index) => (
                <button
                  key={day}
                  type="button"
                  aria-pressed={editBlackout.daysOfWeek.includes(index)}
                  onClick={() => {
                    const included = editBlackout.daysOfWeek.includes(index);
                    const daysOfWeek = included
                      ? editBlackout.daysOfWeek.filter((value) => value !== index)
                      : [...editBlackout.daysOfWeek, index].sort();
                    if (daysOfWeek.length) setEditBlackout({ ...editBlackout, daysOfWeek });
                  }}
                  className={cn("rounded-control border px-2 py-1 text-xs", editBlackout.daysOfWeek.includes(index) ? "border-brand bg-brand/10" : "border-line")}
                >
                  {day}
                </button>
              ))}
            </div>
          ) : null}
          {schedule.missionType === "ValidationSnapshot" ? (
            <div
              className="rounded-control border border-line bg-elevated/50 px-3 py-2 sm:col-span-2 lg:col-span-4"
              data-testid="community-validation-schedule-edit-opt-in"
            >
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={editCommunityValidation}
                  onChange={(event) =>
                    setEditCommunityValidation(event.target.checked)
                  }
                />
                Run Community validation pack
              </label>
              <p className="mt-1 text-xs leading-5 text-subtle">
                Starts engines; snapshot report is separate.
              </p>
            </div>
          ) : null}
          <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-4">
            <span className="text-xs text-muted">Scopes</span>
            {scopes.length === 0 ? (
              <p className="text-xs text-subtle">
                No scopes loaded. Existing bindings (
                {schedule.scopeIds.length || "none"}) are preserved on save.
              </p>
            ) : (
              <div
                className="flex flex-wrap gap-1.5"
                role="group"
                aria-label="Edit schedule scopes"
              >
                {scopes.map((scope) => (
                  <button
                    key={scope.scopeId}
                    type="button"
                    aria-pressed={editScopeIds.has(scope.scopeId)}
                    onClick={() => toggleEditScope(scope.scopeId)}
                    className={cn(
                      "rounded-control border px-2.5 py-1 text-[12px] transition-colors",
                      editScopeIds.has(scope.scopeId)
                        ? "border-brand/60 bg-brand/12 text-ink"
                        : "border-line text-muted hover:text-ink"
                    )}
                  >
                    {scope.value}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
            <button type="button" onClick={saveEdit} disabled={busy !== null} className={buttonClassName({ size: "sm", variant: "primary" })}>
              {busy === "edit" ? "Saving…" : "Save changes"}
            </button>
            <button type="button" onClick={() => setEditing(false)} disabled={busy !== null} className={buttonClassName({ size: "sm", variant: "secondary" })}>Cancel</button>
          </div>
        </div>
      ) : null}
      {toggleError ? (
        <InlineError
          message={toggleError}
          tone="error"
          onDismiss={() => setToggleError(null)}
        />
      ) : null}
      {diff ? <DiffSummary diff={diff} snapshotId={schedule.lastSnapshotId} /> : null}
      {historyOpen ? (
        <div
          role="region"
          className="rounded-control border border-line bg-surface px-3 py-2 text-xs"
          aria-label="Schedule run history"
        >
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
            Run history & recovery
          </p>
          <p className="mt-1 text-muted">
            Fresh policy decision on every run-now and resume. Denied or stale
            work is never silently replayed — fix scope/policy, then retry.
          </p>
          {historyError ? (
            <p className="mt-2 text-missed" role="alert">
              {historyError}
            </p>
          ) : null}
          {priorDiffs && priorDiffs.length === 0 ? (
            <p className="mt-2 text-muted">
              No prior runs recorded for this schedule yet.
            </p>
          ) : null}
          {priorDiffs && priorDiffs.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {priorDiffs.map((entry, index) => (
                <li
                  key={entry.runId ?? `${entry.at ?? "run"}-${index}`}
                  className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-subtle"
                >
                  <span>{entry.at ? relTime(entry.at) : "pending"}</span>
                  {entry.outcome ? (
                    <StateBadge
                      tone={
                        /still|exposed|fail|denied|stale/i.test(entry.outcome)
                          ? "missed"
                          : /fixed|pass|success/i.test(entry.outcome)
                            ? "fixed"
                            : "inconclusive"
                      }
                      dot={false}
                    >
                      {entry.outcome}
                    </StateBadge>
                  ) : null}
                  {entry.packType ? <span>{entry.packType}</span> : null}
                  {entry.packId ? (
                    <Link
                      href={`/evidence?evidenceId=${encodeURIComponent(entry.packId)}`}
                      className="text-brand hover:text-brand-2"
                    >
                      pack {entry.packId.slice(0, 8)}
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this schedule?"
        description="Future validation runs stop immediately. Existing missions, results, and evidence remain in their audit history."
        confirmLabel="Delete schedule"
        confirmPhrase={schedule.missionType}
        destructive
        busy={busy === "delete"}
        error={toggleError}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </li>
  );
}

function DiffSummary({
  diff,
  snapshotId
}: {
  diff: Record<string, unknown>;
  snapshotId?: string | null;
}) {
  const packType = typeof diff.packType === "string" ? diff.packType : null;
  const outcome =
    typeof diff.verificationOutcome === "string" ? diff.verificationOutcome : null;
  const evidenceCount =
    typeof diff.evidenceCount === "number" ? diff.evidenceCount : null;
  const reopened =
    (typeof diff.reopened === "number" && diff.reopened) ||
    (typeof diff.reopenedCount === "number" && diff.reopenedCount) ||
    (typeof diff.newExposures === "number" && diff.newExposures) ||
    null;

  const outcomeTone = outcome && /still|exposed|fail|reopen/i.test(outcome)
    ? "missed"
    : outcome && /fixed|pass|success/i.test(outcome)
      ? "fixed"
      : "inconclusive";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-control border border-line bg-surface px-2.5 py-1.5 text-[11px]">
      <span className="font-display font-semibold uppercase tracking-[0.08em] text-subtle">
        Last diff
      </span>
      {packType ? <span className="font-mono text-subtle">{packType}</span> : null}
      {diff.communityValidation === true && typeof diff.summary === "string" ? (
        <span className="text-muted">{diff.summary}</span>
      ) : null}
      {outcome ? (
        <StateBadge tone={outcomeTone} dot={false}>
          {outcome}
        </StateBadge>
      ) : null}
      {evidenceCount != null ? (
        <span className="font-mono text-muted">{evidenceCount} evidence</span>
      ) : null}
      {reopened ? (
        <StateBadge tone="missed" dot={false}>
          {reopened} reopened
        </StateBadge>
      ) : null}
      {snapshotId ? (
        <Link
          href={`/api/v1/snapshots/${snapshotId}/report`}
          target="_blank"
          rel="noreferrer"
          className="ml-auto text-brand hover:text-brand-2"
        >
          last report ↗
        </Link>
      ) : null}
    </div>
  );
}

function SmallLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
      {children}
    </span>
  );
}

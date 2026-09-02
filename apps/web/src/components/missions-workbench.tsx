/**
 * Multi-type mission control workbench (AI / Control / Fix create + list).
 *
 * HONESTY: This component is intentionally NOT mounted on any product app
 * route. `/missions` mounts ValidationSnapshotFlow (guided Validation Snapshot
 * only). Primary nav labels that route "Validate", not "Missions". Do not
 * import this from `app/**` until multi-type mission UX is product-ready;
 * see `apps/web/src/lib/missions-nav-honesty.test.ts`.
 */
"use client";

import Link from "next/link";
import { startTransition, useEffect, useState } from "react";

import type { Job, ValidationMission, ValidationRun } from "@periscan/shared";

import {
  browserPeriscanApiClient,
  PeriscanApiClientError,
  type AuthSessionPayload
} from "../lib/periscan-api-client";
import {
  Badge,
  Button,
  Card,
  DegradedBanner,
  StatusPill,
  buttonClassName,
  cn
} from "../ui";
import { StatusPanel } from "./status-panel";
import { VerdictCard } from "./verdict-card";

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

function readInitialMissionId() {
  if (typeof window === "undefined") {
    return null;
  }

  return new URLSearchParams(window.location.search).get("missionId");
}

const errorInlineClass =
  "rounded-control border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger";

export function MissionsWorkbench() {
  const [auth, setAuth] = useState<AuthSessionPayload | null>(null);
  const [missions, setMissions] = useState<ValidationMission[] | null>(null);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(
    null
  );
  const [runs, setRuns] = useState<ValidationRun[] | null>(null);
  const [runsLoadingFor, setRunsLoadingFor] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [jobId, setJobId] = useState("");
  const [job, setJob] = useState<Job | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [isJobLoading, setIsJobLoading] = useState(false);

  // Simple create for non-snapshot mission types (direct, not via schedule). Runs consume ValidationRuns + EvidencePacks (see billing meters in Validation Ops).
  const [newMissionType, setNewMissionType] = useState<
    "AIAppValidation" | "ControlValidation" | "FixVerification"
  >("ControlValidation");
  const [newScopeId, setNewScopeId] = useState("");
  const [selectedScopeForMission, setSelectedScopeForMission] = useState("");
  const [newSafetyLevel, setNewSafetyLevel] = useState("ActiveNonInvasive");
  const [newTargetConfig, setNewTargetConfig] = useState(""); // optional JSON for aiAppId/controlSource etc for non-snap
  const [selectedTargetForMission, setSelectedTargetForMission] = useState("");
  const [isCreatingMission, setIsCreatingMission] = useState(false);

  // Picker lists for release-grade UX
  const [pickerScopes, setPickerScopes] = useState<any[]>([]);
  const [pickerAiApps, setPickerAiApps] = useState<any[]>([]);
  const [pickerControls, setPickerControls] = useState<any[]>([]);
  const [pickerRems, setPickerRems] = useState<any[]>([]);
  const [recentPack, setRecentPack] = useState<any>(null);
  const [billingUsage, setBillingUsage] = useState<any>(null); // T parity + O billing preview for non-snap create
  /** P07-22: supporting rails that soft-failed — empty ≠ none exist */
  const [degradedRails, setDegradedRails] = useState<string[]>([]);

  async function loadRuns(missionId: string) {
    setSelectedMissionId(missionId);
    setRunsLoadingFor(missionId);
    setRuns(null);
    setErrorMessage(null);

    try {
      setRuns(await browserPeriscanApiClient.listMissionRuns(missionId));
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load mission runs."
      );
    } finally {
      setRunsLoadingFor(null);
    }
  }

  useEffect(() => {
    let active = true;

    void browserPeriscanApiClient
      .getMe()
      .then(async (nextAuth) => {
        if (!active) {
          return;
        }

        setAuth(nextAuth);
        const nextMissions = await browserPeriscanApiClient.listMissions();

        if (!active) {
          return;
        }

        setMissions(nextMissions);
        // Load pickers — track soft-failures so empty pickers ≠ "no scopes exist" (P07-22)
        try {
          const [sc, ai, cs, rm] = await Promise.all([
            browserPeriscanApiClient
              .listScopes()
              .then((value) => ({ ok: true as const, value }))
              .catch(() => ({ ok: false as const, value: [] as any[] })),
            browserPeriscanApiClient
              .listAIApplications()
              .then((value) => ({ ok: true as const, value }))
              .catch(() => ({ ok: false as const, value: [] as any[] })),
            browserPeriscanApiClient
              .listControlSources()
              .then((value) => ({ ok: true as const, value }))
              .catch(() => ({ ok: false as const, value: [] as any[] })),
            browserPeriscanApiClient
              .listRemediations()
              .then((value) => ({ ok: true as const, value }))
              .catch(() => ({ ok: false as const, value: [] as any[] }))
          ]);
          if (active) {
            setPickerScopes(sc.value as any[]);
            setPickerAiApps(ai.value as any[]);
            setPickerControls(cs.value as any[]);
            setPickerRems(rm.value as any[]);
            const degraded: string[] = [];
            if (!sc.ok) degraded.push("Scopes");
            if (!ai.ok) degraded.push("AI applications");
            if (!cs.ok) degraded.push("Control sources");
            if (!rm.ok) degraded.push("Remediation");
            setDegradedRails(degraded);
          }
          // Q2/T parity: load recent pack for VerdictCard in missions (like schedules/reports)
          (browserPeriscanApiClient as any)
            .listReports?.({ limit: 3 })
            .then((p: any[]) => {
              if (p && p[0]) setRecentPack(p[0]);
            })
            .catch(() => {});
          // T parity + O: load billing for non-snap preview in create (same as schedules)
          browserPeriscanApiClient
            .getBillingUsage()
            .then(setBillingUsage)
            .catch(() => {});
        } catch {}
        setIsLoading(false);

        const initial = readInitialMissionId();
        const target =
          (initial &&
            nextMissions.find((mission) => mission.missionId === initial)
              ?.missionId) ??
          nextMissions[0]?.missionId ??
          null;

        if (target) {
          await loadRuns(target);
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
          error instanceof Error ? error.message : "Unable to load missions."
        );
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function refreshMissions() {
    setErrorMessage(null);
    setIsRefreshing(true);

    try {
      const nextMissions = await browserPeriscanApiClient.listMissions();
      setMissions(nextMissions);

      if (selectedMissionId) {
        await loadRuns(selectedMissionId);
      }
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to refresh missions."
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleCreateMission() {
    const scope = newScopeId.trim() || selectedScopeForMission;
    if (!scope) {
      setErrorMessage("Scope ID is required to create a mission.");
      return;
    }
    setErrorMessage(null);
    setIsCreatingMission(true);
    try {
      let extra: Record<string, unknown> = {};
      if (newTargetConfig.trim()) {
        try {
          extra = JSON.parse(newTargetConfig);
        } catch {
          throw new Error("Target/config must be valid JSON or empty");
        }
      }
      await browserPeriscanApiClient.createMission({
        missionType: newMissionType,
        scopeId: scope,
        safetyLevel: newSafetyLevel,
        ...extra
      });
      setNewTargetConfig("");
      await refreshMissions();
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to create mission."
      );
    } finally {
      setIsCreatingMission(false);
    }
  }

  async function lookupJob() {
    if (!jobId.trim()) {
      return;
    }

    setJobError(null);
    setJob(null);
    setIsJobLoading(true);

    try {
      setJob(await browserPeriscanApiClient.getJob(jobId.trim()));
    } catch (error: unknown) {
      setJobError(
        error instanceof Error ? error.message : "Unable to read the job."
      );
    } finally {
      setIsJobLoading(false);
    }
  }

  if (isLoading) {
    return (
      <StatusPanel
        body="Periscan is reading tenant-scoped validation missions and runs from the public API."
        eyebrow="Missions"
        kind="loading"
        title="Loading validation missions."
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
        body="Validation missions are tenant-scoped. Authenticate from the workspace to review mission status, run outcomes, errors, and evidence."
        eyebrow="Missions"
        kind="info"
        title="Sign in to review validation missions."
      />
    );
  }

  if (!missions) {
    return (
      <StatusPanel
        actions={
          <Button
            variant="secondary"
            onClick={() => startTransition(() => void refreshMissions())}
          >
            Retry
          </Button>
        }
        body={errorMessage ?? "Validation missions are unavailable."}
        eyebrow="Missions"
        kind="error"
        title="Unable to load validation missions."
      />
    );
  }

  const selectedMission = missions.find(
    (mission) => mission.missionId === selectedMissionId
  );

  return (
    <section className="flex flex-col gap-4">
      {degradedRails.length > 0 ? (
        <DegradedBanner rails={degradedRails} />
      ) : null}
      <div
        className="rounded-control border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-ink"
        role="status"
      >
        <strong className="font-semibold">Labs / not mounted on product routes.</strong>{" "}
        Multi-type mission control lives here for tests and future wiring only.
        The live <Link className="font-medium text-brand underline" href="/missions">Validate</Link>{" "}
        rail mounts the guided Validation Snapshot workflow.
      </div>
      <Card
        elevated
        className="flex flex-wrap items-start justify-between gap-4"
      >
        <div className="max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand">
            Validation missions
          </span>
          <h2 className="mt-1 text-xl font-semibold text-ink">
            Run status, errors, and evidence — not an opaque button.
          </h2>
          <p className="mt-2 text-sm text-muted">
            Signed in as {auth.user.email} for {auth.tenant.name}. Every mission
            and its validation runs come from /api/v1/missions and
            /api/v1/missions/:id/runs; inspect queue jobs via /api/v1/jobs/:id.
          </p>

          {/* Simple create for non-snapshot mission types */}
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-xs text-muted">
              Type
              <select
                className="ml-1 rounded border px-1 py-0.5 text-sm"
                value={newMissionType}
                onChange={(e) => setNewMissionType(e.target.value as any)}
              >
                <option value="ControlValidation">ControlValidation</option>
                <option value="AIAppValidation">AIAppValidation</option>
                <option value="FixVerification">FixVerification</option>
              </select>
            </label>
            {(newMissionType === "AIAppValidation" ||
              newMissionType === "ControlValidation" ||
              newMissionType === "FixVerification") && (
              <>
                <span className="text-[10px] text-amber-700 bg-amber-50 px-1 py-0.5 rounded self-end">
                  Non-snap: +1 ValidationRun +1 EvidencePack per run
                </span>
                <span className="ml-1 text-[9px] text-muted">
                  T3: contributes to CTEM Validate/Verify ·{" "}
                  <a href="/" className="underline">
                    dashboard
                  </a>
                </span>
              </>
            )}
            {(newMissionType === "AIAppValidation" ||
              newMissionType === "ControlValidation" ||
              newMissionType === "FixVerification") &&
              billingUsage &&
              billingUsage.meters && (
                <div className="text-[10px] text-muted self-end">
                  Current:{" "}
                  {billingUsage.meters
                    .filter((m: any) =>
                      ["ValidationRuns", "EvidencePacks"].includes(m.meterName)
                    )
                    .map((m: any) => `${m.meterName}:${m.quantity}`)
                    .join(" | ")}
                  {/* T3 + O3 parity: exact projected pill mirroring schedules-workbench for release-grade create preview */}
                  {(() => {
                    const runs =
                      (billingUsage.meters || []).find(
                        (m: any) => m.meterName === "ValidationRuns"
                      )?.quantity || 0;
                    const packs =
                      (billingUsage.meters || []).find(
                        (m: any) => m.meterName === "EvidencePacks"
                      )?.quantity || 0;
                    return (
                      <span
                        className="ml-1 px-1 bg-amber-50 rounded text-amber-700"
                        title="T3/O3: projected after this non-snap create+run (mirrors schedules)"
                      >
                        dynamic projected +1 run/pack remaining: runs {runs + 1} packs {packs + 1}
                      </span>
                    );
                  })()}
                  {/* T3/O3: visual quota bars in missions create for billing impact parity with schedules + home */}
                  {billingUsage.meters
                    .filter((m: any) =>
                      ["ValidationRuns", "EvidencePacks"].includes(m.meterName)
                    )
                    .map((m: any) => {
                      const q = Number(m.quantity || 0);
                      const cap = 200;
                      const pct = Math.min(100, Math.floor((q / cap) * 100));
                      const near = q > 120;
                      return (
                        <span
                          key={m.meterName}
                          className="ml-1 inline-flex items-center gap-0.5"
                        >
                          · {m.meterName}:{q}
                          {near ? "⚠" : ""}
                          <span className="inline-block h-1 w-10 bg-gray-200 align-middle">
                            <span
                              className={`inline-block h-1 ${near ? "bg-amber-500" : "bg-brand"}`}
                              style={{ width: pct + "%" }}
                            />
                          </span>
                        </span>
                      );
                    })}
                </div>
              )}
            <label className="text-xs text-muted">
              Scope (picker)
              <select
                className="ml-1 w-40 rounded border px-1 py-0.5 text-sm"
                value={selectedScopeForMission || newScopeId}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelectedScopeForMission(v);
                  if (v) setNewScopeId(v);
                }}
              >
                <option value="">— manual —</option>
                {pickerScopes.map((s: any) => (
                  <option key={s.scopeId || s.id} value={s.scopeId || s.id}>
                    {(s.name || s.scopeId || "").slice(0, 24)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted">
              Scope ID
              <input
                className="ml-1 w-40 rounded border px-1 py-0.5 text-sm"
                placeholder="scope-uuid"
                value={newScopeId}
                onChange={(e) => setNewScopeId(e.target.value)}
              />
            </label>
            <label className="text-xs text-muted">
              Safety
              <select
                className="ml-1 rounded border px-1 py-0.5 text-sm"
                value={newSafetyLevel}
                onChange={(e) => setNewSafetyLevel(e.target.value)}
              >
                <option value="ActiveNonInvasive">ActiveNonInvasive</option>
                <option value="PassiveReadOnly">PassiveReadOnly</option>
              </select>
            </label>
            {/* Type-specific target picker (P1 polish) */}
            <label className="text-xs text-muted">
              {newMissionType === "AIAppValidation"
                ? "AI App"
                : newMissionType === "ControlValidation"
                  ? "Control"
                  : "Remediation"}{" "}
              (picker)
              <select
                className="ml-1 w-44 rounded border px-1 py-0.5 text-sm"
                value={selectedTargetForMission}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelectedTargetForMission(v);
                  if (v) {
                    const key =
                      newMissionType === "AIAppValidation"
                        ? "aiAppId"
                        : newMissionType === "ControlValidation"
                          ? "controlSourceId"
                          : "remediationId";
                    const base = newTargetConfig.trim()
                      ? JSON.parse(newTargetConfig) || {}
                      : {};
                    setNewTargetConfig(
                      JSON.stringify({
                        ...base,
                        [key]: v,
                        target: { ...(base.target || {}), [key]: v }
                      })
                    );
                  }
                }}
              >
                <option value="">— or use JSON —</option>
                {newMissionType === "AIAppValidation" &&
                  pickerAiApps.map((a: any) => (
                    <option key={a.aiAppId || a.id} value={a.aiAppId || a.id}>
                      {(a.name || a.aiAppId || "").slice(0, 20)}
                    </option>
                  ))}
                {newMissionType === "ControlValidation" &&
                  pickerControls.map((c: any) => (
                    <option
                      key={c.controlSourceId || c.id}
                      value={c.controlSourceId || c.id}
                    >
                      {(c.name || c.controlSourceId || "").slice(0, 20)}
                    </option>
                  ))}
                {newMissionType === "FixVerification" &&
                  pickerRems.map((r: any) => (
                    <option
                      key={r.remediationId || r.id}
                      value={r.remediationId || r.id}
                    >
                      {(r.title || r.remediationId || "").slice(0, 20)}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-xs text-muted">
              Target/config (JSON, optional)
              <input
                className="ml-1 w-44 rounded border px-1 py-0.5 text-sm"
                placeholder='{"aiAppId":"..."} or {"target":{}}'
                value={newTargetConfig}
                onChange={(e) => setNewTargetConfig(e.target.value)}
              />
            </label>
            <Button
              size="sm"
              disabled={
                isCreatingMission ||
                !(newScopeId.trim() || selectedScopeForMission)
              }
              onClick={() => startTransition(() => void handleCreateMission())}
            >
              {isCreatingMission ? "Creating..." : "Create Mission"}
            </Button>
            {/* T3: parity link to full Schedules picker for recurring non-snap (richer UI, same 5 missionTypes + billing + lastDiff) */}
            <a
              href="/schedules"
              className="ml-2 text-[10px] underline text-brand"
            >
              Use Schedules for recurring + richer pickers (recommended for
              non-snap CTEM)
            </a>
            {(newMissionType === "AIAppValidation" ||
              newMissionType === "ControlValidation" ||
              newMissionType === "FixVerification") &&
              billingUsage && (
                <span
                  className="ml-2 text-[9px] px-1 bg-amber-50 rounded text-amber-700 self-center"
                  title="T3/O3: numeric projected on create for parity"
                >
                  {(() => {
                    const runs =
                      (billingUsage.meters || []).find(
                        (m: any) => m.meterName === "ValidationRuns"
                      )?.quantity || 0;
                    const packs =
                      (billingUsage.meters || []).find(
                        (m: any) => m.meterName === "EvidencePacks"
                      )?.quantity || 0;
                    return `dynamic projected +1 run/pack remaining: runs ${runs + 1} packs ${packs + 1}`;
                  })()}
                </span>
              )}
            {(newMissionType === "AIAppValidation" ||
              newMissionType === "ControlValidation" ||
              newMissionType === "FixVerification") &&
              billingUsage && (
                <span
                  className="ml-2 text-[9px] px-1 bg-amber-50 rounded text-amber-700 self-center"
                  title="T3/O3: numeric projected on create for parity with schedules"
                >
                  {(() => {
                    const runs =
                      (billingUsage.meters || []).find(
                        (m: any) => m.meterName === "ValidationRuns"
                      )?.quantity || 0;
                    const packs =
                      (billingUsage.meters || []).find(
                        (m: any) => m.meterName === "EvidencePacks"
                      )?.quantity || 0;
                    return `dynamic projected +1 run/pack remaining: runs ${runs + 1} packs ${packs + 1}`;
                  })()}
                </span>
              )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={isRefreshing}
            onClick={() => startTransition(() => void refreshMissions())}
          >
            {isRefreshing ? "Refreshing..." : "Refresh missions"}
          </Button>
          <Link
            className={buttonClassName({ size: "sm", variant: "secondary" })}
            href="/signal-activity"
          >
            Signal activity
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
            onClick={() => startTransition(() => void refreshMissions())}
          >
            {isRefreshing ? "Reloading..." : "Reload missions"}
          </Button>
          <button
            aria-label="Dismiss missions error"
            className="text-xs text-muted underline"
            onClick={() => setErrorMessage(null)}
            type="button"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          className="flex flex-col gap-3"
          aria-labelledby="missions-list-title"
        >
          <div className="flex items-center justify-between gap-4">
            <h3
              id="missions-list-title"
              className="text-base font-semibold text-ink"
            >
              Missions
            </h3>
            <Badge
              tone="neutral"
              role="status"
              aria-label={`Validation mission count: ${missions.length}`}
            >
              {missions.length}
            </Badge>
          </div>
          {missions.length === 0 ? (
            <p className="text-sm text-muted">
              No validation missions have been created for this tenant yet. Run
              a Validation Snapshot or approve a signal trigger to create one.
            </p>
          ) : (
            <ul
              className="flex flex-col gap-2"
              aria-label="Validation missions"
            >
              {missions.map((mission) => {
                const isSelected = mission.missionId === selectedMissionId;

                return (
                  <li key={mission.missionId}>
                    <article
                      className={cn(
                        "flex flex-col gap-2 rounded-control border bg-surface p-3",
                        isSelected ? "border-brand" : "border-line"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-ink">
                          {mission.missionType}
                        </strong>
                        {[
                          "AIAppValidation",
                          "ControlValidation",
                          "FixVerification"
                        ].includes(mission.missionType) &&
                          recentPack &&
                          recentPack.packType && (
                            <span className="ml-1 text-[9px] px-1 py-0.5 bg-surface-strong rounded text-muted">
                              {recentPack.packType} (ev:
                              {recentPack.evidenceCount || 0}
                              {recentPack.evidencePackId
                                ? ` id:${String(recentPack.evidencePackId).slice(0, 6)}`
                                : ""}
                              ){recentPack.modelSessionId ? " +model" : ""}
                              {recentPack.verificationOutcome ? " · " : ""}
                              {/* Pack UX nav polish: consistent View pack / CTEM / export links + direct packId support in missions too */}
                              {recentPack.evidencePackId && <a href={`/reports?evidencePackId=${recentPack.evidencePackId}`} className="ml-1 underline text-brand text-[9px]">View pack</a>}
                              {recentPack.evidencePackId && <> | <a href="/threat-center" className="underline text-brand text-[9px]">View CTEM</a> | <a href={`/api/v1/reports/${recentPack.evidencePackId}/export`} className="underline text-brand text-[9px]">View export</a></>}
                              {recentPack.verificationOutcome ? (
                                <span
                                  className={
                                    /fixed|pass/i.test(
                                      String(recentPack.verificationOutcome)
                                    )
                                      ? "text-emerald-600"
                                      : /still|exposed/i.test(
                                            String(
                                              recentPack.verificationOutcome
                                            )
                                          )
                                        ? "text-amber-600"
                                        : ""
                                  }
                                >
                                  {recentPack.verificationOutcome}
                                </span>
                              ) : null}
                            </span>
                          )}
                        {[
                          "AIAppValidation",
                          "ControlValidation",
                          "FixVerification"
                        ].includes(mission.missionType) &&
                          recentPack &&
                          recentPack.evidencePackId && (
                            <a
                              href={`/reports?evidencePackId=${recentPack.evidencePackId}`}
                              className="text-[8px] underline text-brand"
                            >
                              View pack in Reports (
                              {String(recentPack.evidencePackId).slice(0, 8)})
                            </a>
                          )}
                        <StatusPill
                          status={mission.status}
                          aria-label={`Mission ${shortId(mission.missionId)} status: ${mission.status}`}
                        />
                      </div>
                      {[
                        "AIAppValidation",
                        "ControlValidation",
                        "FixVerification"
                      ].includes(mission.missionType) && (
                        <div className="text-[8px] text-muted mt-0.5">
                          post-run: feeds CTEM + billing
                        </div>
                      )}
                      <p className="text-sm text-muted">
                        Mission {shortId(mission.missionId)} ·{" "}
                        {mission.scopeIds.length} scope
                        {mission.scopeIds.length === 1 ? "" : "s"} ·{" "}
                        {mission.safetyLevel}
                      </p>
                      <p className="text-xs text-subtle">
                        Started {formatTimestamp(mission.startedAt)} · Completed{" "}
                        {formatTimestamp(mission.completedAt)}
                      </p>
                      <div>
                        <Button
                          variant="secondary"
                          size="sm"
                          aria-pressed={isSelected}
                          disabled={runsLoadingFor === mission.missionId}
                          onClick={() =>
                            startTransition(
                              () => void loadRuns(mission.missionId)
                            )
                          }
                        >
                          {runsLoadingFor === mission.missionId
                            ? "Loading runs..."
                            : "View runs"}
                        </Button>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card
          className="flex flex-col gap-3"
          aria-labelledby="mission-runs-title"
        >
          <div className="flex items-center justify-between gap-4">
            <h3
              id="mission-runs-title"
              className="text-base font-semibold text-ink"
            >
              Validation runs
            </h3>
            {selectedMission ? (
              <StatusPill
                status={selectedMission.status}
                aria-label={`Selected mission status: ${selectedMission.status}`}
              />
            ) : null}
            {selectedMission &&
              [
                "AIAppValidation",
                "ControlValidation",
                "FixVerification"
              ].includes(selectedMission.missionType) &&
              recentPack &&
              recentPack.packType && (
                <div className="text-[10px] text-muted">
                  Mission last pack: {recentPack.packType} (ev:
                  {recentPack.evidenceCount || 0}
                  {recentPack.evidencePackId
                    ? ` id:${String(recentPack.evidencePackId).slice(0, 6)}`
                    : ""}
                  ) ·{" "}
                  <a
                    href={`/reports?evidencePackId=${recentPack.evidencePackId}`}
                    className="underline"
                  >
                    View pack in Reports (ID)
                  </a>{" "}
                  ·{" "}
                  <a href="/threat-center" className="underline">
                    CTEM delta
                  </a>{" "}
                  {recentPack.evidencePackId ? (
                    <a
                      href={`/api/v1/reports/${recentPack.evidencePackId}/export`}
                      className="underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Export
                    </a>
                  ) : null}
                </div>
              )}
            {selectedMission &&
              [
                "AIAppValidation",
                "ControlValidation",
                "FixVerification"
              ].includes(selectedMission.missionType) && (
                <div className="text-[9px] text-amber-700">
                  Post-run: pack feeds CTEM + billing meters. Use Schedules for
                  recurring version of this non-snap.
                </div>
              )}
          </div>

          {!selectedMissionId ? (
            <p className="text-sm text-muted">
              Select a mission to inspect its validation runs.
            </p>
          ) : runsLoadingFor === selectedMissionId && !runs ? (
            <p className="text-sm text-muted">Loading validation runs...</p>
          ) : runs && runs.length === 0 ? (
            <p className="text-sm text-muted">
              This mission has no validation runs. Denied or draft missions do
              not create runs.
            </p>
          ) : runs ? (
            <ol className="flex flex-col gap-2" aria-label="Validation runs">
              {runs.map((run) => (
                <li key={run.runId}>
                  <article className="flex flex-col gap-2 rounded-control border border-line bg-surface p-3">
                    <div className="flex items-center justify-between gap-3">
                      <strong className="text-ink">{run.moduleId}</strong>
                      <StatusPill
                        status={run.status}
                        aria-label={`Run ${shortId(run.runId)} status: ${run.status}`}
                      />
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div>
                        <dt className="text-muted">Outcome</dt>
                        <dd className="text-ink">
                          {run.outcome ?? "Not recorded"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted">Validation state</dt>
                        <dd className="text-ink">
                          {run.validationState ?? "Not recorded"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted">Started</dt>
                        <dd className="text-ink">
                          {formatTimestamp(run.startedAt)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted">Completed</dt>
                        <dd className="text-ink">
                          {formatTimestamp(run.completedAt)}
                        </dd>
                      </div>
                    </dl>
                    {run.errorSummary ? (
                      <p className={errorInlineClass} role="alert">
                        Error: {run.errorSummary}
                      </p>
                    ) : null}
                    {run.techniqueIds && run.techniqueIds.length > 0 ? (
                      <ul
                        className="flex flex-wrap gap-2 text-xs text-muted"
                        aria-label="ATT&CK techniques"
                      >
                        {run.techniqueIds.map((technique) => (
                          <li key={`${run.runId}-${technique}`}>{technique}</li>
                        ))}
                      </ul>
                    ) : null}
                    {run.evidenceIds.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {run.evidenceIds.map((evidenceId) => (
                          <span
                            className="rounded-pill bg-surface-strong px-2 py-0.5 text-xs text-muted"
                            key={evidenceId}
                          >
                            ev-{shortId(evidenceId)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted">
                        No evidence is linked to this run yet.
                      </p>
                    )}
                    <VerdictCard
                      packType={
                        (run as any).target?.packType ||
                        (recentPack && recentPack.packType
                          ? recentPack.packType
                          : null)
                      }
                      samples={
                        run.outcome || run.validationState
                          ? [
                              {
                                status: (run.outcome ||
                                  run.validationState) as any,
                                title: run.moduleId || "mission run"
                              }
                            ]
                          : []
                      }
                      evidenceCount={run.evidenceIds.length}
                      modelSessionId={
                        (run as any).target?.modelSessionId ||
                        (recentPack as any)?.modelSessionId ||
                        null
                      }
                    />
                    {(run as any).target?.packType && (
                      <div className="mt-1 text-[10px] text-muted">
                        Non-snap pack: {(run as any).target.packType} ·
                        evidencePackId:{" "}
                        {(run as any).target.evidencePackId
                          ? (run as any).target.evidencePackId.slice(0, 8)
                          : "n/a"}
                      </div>
                    )}
                    {(run as any).target?.packType &&
                      (run as any).target?.evidencePackId && (
                        <div className="mt-1 flex gap-2 text-[10px]">
                          <a
                            href={`/reports?evidencePackId=${(run as any).target.evidencePackId}`}
                            className="underline text-brand"
                          >
                            View pack{" "}
                            {(run as any).target.evidencePackId.slice(0, 8)} in
                            Reports
                          </a>
                          <a
                            href="/threat-center"
                            className="underline text-brand"
                          >
                            See CTEM / Threat Center
                          </a>
                          <span className="text-muted">
                            · post-run: feeds lastDiff + CTEM deltas + billing
                          </span>
                        </div>
                      )}
                  </article>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted">
              Validation runs are unavailable.
            </p>
          )}

          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-semibold text-ink">
              Inspect a queue job
            </h4>
            <p className="text-sm text-muted">
              Look up a validation queue job by id to see its status, attempts,
              and error message.
            </p>
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                startTransition(() => void lookupJob());
              }}
            >
              <label className="flex flex-col gap-1" htmlFor="job-lookup-id">
                <span className="sr-only">Job id</span>
                <input
                  className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  id="job-lookup-id"
                  onChange={(event) => setJobId(event.target.value)}
                  placeholder="job id (UUID)"
                  value={jobId}
                />
              </label>
              <Button
                variant="secondary"
                disabled={isJobLoading || !jobId.trim()}
                type="submit"
              >
                {isJobLoading ? "Looking up..." : "Inspect job"}
              </Button>
            </form>
            {jobError ? (
              <p className={errorInlineClass} role="alert">
                {jobError}
              </p>
            ) : null}
            {job ? (
              <article className="flex flex-col gap-2 rounded-control border border-line bg-surface p-3">
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-ink">Job {shortId(job.jobId)}</strong>
                  <StatusPill status={job.status} />
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <dt className="text-muted">Queue</dt>
                    <dd className="text-ink">{job.queueName}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Attempts</dt>
                    <dd className="text-ink">{job.attempts}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Available at</dt>
                    <dd className="text-ink">
                      {formatTimestamp(job.availableAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Completed</dt>
                    <dd className="text-ink">
                      {formatTimestamp(job.completedAt)}
                    </dd>
                  </div>
                </dl>
                {job.errorMessage ? (
                  <p className={errorInlineClass} role="alert">
                    Error: {job.errorMessage}
                  </p>
                ) : null}
              </article>
            ) : null}
          </div>
        </Card>
      </div>
    </section>
  );
}

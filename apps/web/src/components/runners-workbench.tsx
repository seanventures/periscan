"use client";

/**
 * @deprecated P14-18 — not mounted on `/runners`. Product surface is
 * `RunnerFleetControlRoom` (apps/web/app/runners/page.tsx). Kept for unit
 * tests and historical helpers only; do not re-wire into product routes.
 */
import { startTransition, useEffect, useState } from "react";

import {
  RUNNER_DISCOVER_MODULE_IDS,
  RUNNER_MEASURED_MODULE_IDS,
  type RunnerRecord,
  type RunnerTaskRecord,
  type RunnerTransportDecision,
  type Scope
} from "@periscan/shared";

import { useWithBusy } from "../hooks/use-with-busy";
import {
  browserPeriscanApiClient,
  PeriscanApiClientError,
  type AuthSessionPayload
} from "../lib/periscan-api-client";
import {
  Badge,
  Button,
  Card,
  DistributionChart,
  EmptyState,
  StatusPill,
  type BadgeTone
} from "../ui";
import { SUPPORTED_CUSTOMER_RUNNER_IMAGE } from "../lib/runner-install";
import { StatusPanel } from "./status-panel";

// Transport-decision status tones (local: these are channel-policy verdicts,
// not the shared status vocabulary). Primary = the active channel.
const TRANSPORT_STATUS_TONE: Record<string, BadgeTone> = {
  Disallowed: "danger",
  Primary: "success",
  SupportedLater: "info"
};

type LoadStatus = "loading" | "authenticated" | "unauthenticated" | "error";

interface RunnersState {
  auth: AuthSessionPayload | null;
  runners: RunnerRecord[];
  transportDecisions: RunnerTransportDecision[];
}

interface RunnerDetailState {
  runner: RunnerRecord;
  scopes: Scope[];
  tasks: RunnerTaskRecord[];
}

const INITIAL_STATE: RunnersState = {
  auth: null,
  runners: [],
  transportDecisions: []
};

/** GA install modes only — WindowsService is Planned (P10-3). */
const DEPLOYMENT_MODES = [
  "Docker",
  "Kubernetes",
  "SystemdService"
] as const;

/** Supported Customer Runner (Go LTS) — same image family as runner-pairing. */
const RUNNER_IMAGE = SUPPORTED_CUSTOMER_RUNNER_IMAGE;
const ENDPOINT_MARKER_MODULE_ID = "periscan.endpoint_benign_marker_emit";

// Domain task-status → kit BadgeTone. Only Completed is success; Accepted and
// other acknowledged-but-unfinished states stay warning (not success). Exported
// for unit coverage of the domain map; render path uses <StatusPill />.
export function taskStatusTone(
  status: RunnerTaskRecord["status"]
): BadgeTone {
  switch (status) {
    case "Completed":
      return "success";
    case "Queued":
    case "Leased":
    case "Running":
    case "Accepted":
      return "warning";
    case "Failed":
    case "Rejected":
    case "Expired":
    case "Cancelled":
    case "DeniedByLocalPolicy":
    case "DeniedByServerPolicy":
      return "danger";
    default:
      return "neutral";
  }
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return "never";
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "unknown" : parsed.toLocaleString();
}

// Server authority: markStaleRunnersOffline (system scheduler) transitions
// silent Active/Degraded runners → Offline; runner fleet health also derives
// Offline/Attention from lastSeenAt vs policy thresholds. This helper remains
// as a defensive UI badge for the legacy workbench when the reaper has not
// yet run in-process (e.g. mid-threshold window). Exported for unit coverage.
export const RUNNER_STALE_AFTER_MS = 15 * 60_000;

export function isRunnerStale(
  lastSeenAt: string | null | undefined,
  now: number,
  thresholdMs: number = RUNNER_STALE_AFTER_MS
): boolean {
  if (!lastSeenAt) {
    return false;
  }

  const seen = new Date(lastSeenAt).getTime();
  if (Number.isNaN(seen)) {
    return false;
  }

  return now - seen > thresholdMs;
}

async function loadRunnersState(): Promise<RunnersState> {
  const auth = await browserPeriscanApiClient.getMe();
  const [runners, transportDecisions] = await Promise.all([
    browserPeriscanApiClient.listRunners(),
    browserPeriscanApiClient.listRunnerTransportDecisions()
  ]);
  return { auth, runners, transportDecisions };
}

async function loadRunnerDetail(runnerId: string): Promise<RunnerDetailState> {
  const [runner, tasks, scopes] = await Promise.all([
    browserPeriscanApiClient.getRunner(runnerId),
    browserPeriscanApiClient.listRunnerTasks(runnerId),
    browserPeriscanApiClient.listScopes()
  ]);
  // Only verified scopes can authorize an in-network measured task.
  return {
    runner,
    scopes: scopes.filter((scope) => scope.verificationStatus === "Verified"),
    tasks
  };
}

// Measured modules that need a host:port (everything except DNS resolution),
// mirroring the server request schema so the form requires a port for them.
const RUNNER_MEASURED_PORT_REQUIRED = new Set<string>(
  RUNNER_MEASURED_MODULE_IDS.filter(
    (moduleId) =>
      moduleId !== "periscan.dns_resolution_check" &&
      moduleId !== ENDPOINT_MARKER_MODULE_ID
  )
);

const inputClass =
  "rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

export function RunnersWorkbench() {
  const [state, setState] = useState<RunnersState>(INITIAL_STATE);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const { busy, error: actionError, run: runBusy } = useWithBusy();
  const [detail, setDetail] = useState<RunnerDetailState | null>(null);
  const [deployForm, setDeployForm] = useState({
    deploymentMode: "Docker" as (typeof DEPLOYMENT_MODES)[number],
    runnerName: "internal-runner-01"
  });
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [measuredForm, setMeasuredForm] = useState({
    markerId: "periscan-endpoint-check-01",
    moduleId: RUNNER_MEASURED_MODULE_IDS[0] as string,
    platform: "Linux" as "macOS" | "Linux",
    port: "443",
    scopeId: "",
    targetHost: ""
  });
  const endpointMarkerSelected =
    measuredForm.moduleId === ENDPOINT_MARKER_MODULE_ID;
  const measuredScopes = endpointMarkerSelected
    ? (detail?.scopes.filter(
        (scope) => scope.scopeType === "InternalNetwork"
      ) ?? [])
    : (detail?.scopes ?? []);
  const [dispatchedTask, setDispatchedTask] = useState<RunnerTaskRecord | null>(
    null
  );
  const [discoverForm, setDiscoverForm] = useState({
    moduleId: RUNNER_DISCOVER_MODULE_IDS[0] as string,
    scopeId: "",
    target: ""
  });
  const [discoveredTask, setDiscoveredTask] = useState<RunnerTaskRecord | null>(
    null
  );

  async function reload() {
    setState(await loadRunnersState());
    setLoadStatus("authenticated");
  }

  useEffect(() => {
    let active = true;
    setLoadStatus("loading");

    void loadRunnersState()
      .then((next) => {
        if (active) {
          setState(next);
          setLoadStatus("authenticated");
        }
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        if (error instanceof PeriscanApiClientError && error.status === 401) {
          setState(INITIAL_STATE);
          setLoadStatus("unauthenticated");
          return;
        }

        setLoadError(
          error instanceof Error ? error.message : "Unable to load runners."
        );
        setLoadStatus("error");
      });

    return () => {
      active = false;
    };
  }, []);

  // Action runner: busy + error handling via the shared hook, wrapped in a
  // transition so the list stays responsive.
  function run(task: () => Promise<void>) {
    startTransition(() => {
      void runBusy(task, "Runner request failed.");
    });
  }

  async function openRunner(runnerId: string) {
    setDetail(await loadRunnerDetail(runnerId));
  }

  if (loadStatus === "loading") {
    return (
      <StatusPanel
        body="Resolving your session and loading registered internal runners..."
        eyebrow="Internal Runner"
        kind="loading"
        title="Loading runners"
      />
    );
  }

  if (loadStatus === "unauthenticated") {
    return (
      <StatusPanel
        body="Sign in from the workspace to deploy and manage outbound-only internal runners."
        eyebrow="Internal Runner"
        kind="info"
        title="Sign in to manage runners"
      />
    );
  }

  if (loadStatus === "error") {
    return (
      <StatusPanel
        actions={
          <Button variant="secondary" onClick={() => run(reload)}>
            Retry
          </Button>
        }
        body={loadError ?? "Unable to load runners."}
        eyebrow="Internal Runner"
        kind="error"
        title="Runners unavailable"
      />
    );
  }

  const controlPlaneUrl =
    typeof window === "undefined"
      ? "https://app.periscan.cloud"
      : window.location.origin;

  return (
    <section className="flex flex-col gap-4">
      <Card elevated className="flex flex-col gap-3">
        <h3 className="text-base font-semibold text-ink">
          How Periscan runners stay safe
        </h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>
            Outbound-only. No inbound firewall rule, no reverse SSH, no tunnel.
          </li>
          <li>
            Every task is Ed25519-signed; the runner verifies identity, scope,
            expiry, and replay locally.
          </li>
          <li>
            Only allowlisted, scoped, safe modules run. There is no arbitrary
            shell.
          </li>
          <li>
            Every action is audited, and you hold a kill switch that stops all
            task execution instantly.
          </li>
        </ul>
      </Card>

      {actionError ? (
        <p
          className="rounded-control border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {actionError}
        </p>
      ) : null}

      <Card className="flex flex-col gap-3">
        <h3 className="text-base font-semibold text-ink">Deploy a runner</h3>
        <p className="text-sm text-muted">
          Generate a short-lived registration token, then run the runner with
          that token. No long-lived secret is embedded; the runner generates its
          own key on first boot.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-muted">
            <span>Runner name</span>
            <input
              className={inputClass}
              onChange={(event) =>
                setDeployForm((form) => ({
                  ...form,
                  runnerName: event.target.value
                }))
              }
              type="text"
              value={deployForm.runnerName}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            <span>Deployment</span>
            <select
              className={inputClass}
              onChange={(event) =>
                setDeployForm((form) => ({
                  ...form,
                  deploymentMode: event.target
                    .value as (typeof DEPLOYMENT_MODES)[number]
                }))
              }
              value={deployForm.deploymentMode}
            >
              {DEPLOYMENT_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy || deployForm.runnerName.trim().length === 0}
            onClick={() =>
              run(async () => {
                const response =
                  await browserPeriscanApiClient.createRunnerRegistrationToken({
                    deploymentMode: deployForm.deploymentMode,
                    runnerName: deployForm.runnerName.trim()
                  });
                setIssuedToken(response.registrationToken);
                await reload();
              })
            }
          >
            Generate registration token
          </Button>
        </div>
        {issuedToken ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted">
              Short-lived token issued. Run this once; it expires and cannot be
              retrieved again:
            </p>
            <pre className="overflow-x-auto rounded-control border border-line bg-bg p-3 font-mono text-xs text-ink">
              {`docker run --rm \\
  -e PERISCAN_CONTROL_PLANE_URL=${controlPlaneUrl} \\
  -e PERISCAN_REGISTRATION_TOKEN=${issuedToken} \\
  ${RUNNER_IMAGE} register`}
            </pre>
            <p className="text-sm text-muted">
              After registration, start the outbound poll loop with the issued
              runner ID and auth token (returned by <code>register</code>) using
              the same image with the <code>poll</code> command.
            </p>
          </div>
        ) : null}
      </Card>

      <Card className="flex flex-col gap-3">
        <h3 className="text-base font-semibold text-ink">Runners</h3>
        {state.runners.length === 0 ? (
          <EmptyState title="No internal runners are registered." />
        ) : (
          <div className="flex flex-col gap-2">
            {state.runners.map((runner) => (
              <button
                className="flex items-center justify-between gap-4 rounded-control border border-line bg-surface p-3 text-left transition-colors hover:bg-surface-strong"
                key={runner.runnerId}
                onClick={() => run(() => openRunner(runner.runnerId))}
                type="button"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <strong className="text-ink">{runner.name}</strong>
                    {/* Kill-switch state is safety-critical: a halted runner
                        executes nothing. Surface it on the list, not just the
                        detail view, so operators see it at a glance. */}
                    {runner.killSwitchActive ? (
                      <Badge
                        tone="danger"
                        aria-label={`Runner ${runner.name} kill switch: active`}
                      >
                        Kill switch active
                      </Badge>
                    ) : null}
                    {runner.killSwitchActive ? (
                      <Badge
                        tone={
                          runner.killSwitchAcknowledgedAt
                            ? "success"
                            : "warning"
                        }
                      >
                        {runner.killSwitchAcknowledgedAt
                          ? "Host confirmed"
                          : "Host ack pending"}
                      </Badge>
                    ) : runner.status === "Revoked" ? (
                      <Badge
                        tone={
                          runner.revocationAcknowledgedAt
                            ? "success"
                            : "warning"
                        }
                      >
                        {runner.revocationAcknowledgedAt
                          ? "Host confirmed"
                          : "Host ack pending"}
                      </Badge>
                    ) : null}
                    {/* A runner that should be live (Active/Degraded) but has
                        not checked in within the staleness window is likely
                        offline even though the server still reads its last
                        status — flag it so silence is visible at a glance. */}
                    {(runner.status === "Active" ||
                      runner.status === "Degraded") &&
                    isRunnerStale(runner.lastSeenAt, Date.now()) ? (
                      <Badge
                        tone="warning"
                        aria-label={`Runner ${runner.name} connectivity: stale`}
                      >
                        Stale
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted">
                    {runner.deploymentMode} · v{runner.version} ·{" "}
                    {runner.transportMode} · Last seen{" "}
                    {formatTimestamp(runner.lastSeenAt)}
                    {runner.certificateExpiresAt ? (
                      <>
                        {" "}
                        · Cert expires{" "}
                        {formatTimestamp(runner.certificateExpiresAt)}
                      </>
                    ) : null}
                  </p>
                  {runner.killSwitchActive && runner.killSwitchReason ? (
                    <p className="text-sm text-danger">
                      Halted: {runner.killSwitchReason}
                    </p>
                  ) : null}
                </div>
                <StatusPill
                  status={runner.status}
                  aria-label={`Runner ${runner.name} status: ${runner.status}`}
                />
              </button>
            ))}
          </div>
        )}
      </Card>

      {state.transportDecisions.length ? (
        <Card className="flex flex-col gap-3">
          <h3 className="text-base font-semibold text-ink">
            Transport decisions
          </h3>
          <p className="text-sm text-muted">
            How the control plane may reach this tenant&apos;s runners. The
            runner always dials outbound — these are the allowed control
            channels and why.
          </p>
          <DistributionChart
            title="Channels by decision"
            ariaLabel="Runner control channels by transport decision"
            data={Object.entries(
              state.transportDecisions.reduce<Record<string, number>>(
                (counts, decision) => {
                  counts[decision.status] = (counts[decision.status] ?? 0) + 1;
                  return counts;
                },
                {}
              )
            ).map(([status, value]) => ({
              color: `var(--color-${
                TRANSPORT_STATUS_TONE[status] === "danger"
                  ? "danger"
                  : TRANSPORT_STATUS_TONE[status] === "success"
                    ? "success"
                    : "info"
              })`,
              id: status,
              label: status,
              value
            }))}
            variant="bar"
          />
          <ul className="flex flex-col gap-2">
            {state.transportDecisions.map((decision) => (
              <li
                className="flex flex-col gap-1 rounded-control border border-line bg-surface p-3"
                key={decision.channel}
              >
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-ink">{decision.channel}</strong>
                  <Badge
                    tone={TRANSPORT_STATUS_TONE[decision.status] ?? "neutral"}
                    role="status"
                    aria-label={`Transport decision for ${decision.channel}: ${decision.status}`}
                  >
                    {decision.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted">{decision.reason}</p>
                {decision.notes.length ? (
                  <ul className="flex flex-col gap-0.5">
                    {decision.notes.map((note, index) => (
                      <li
                        className="text-xs text-subtle"
                        key={`${decision.channel}-note-${index}`}
                      >
                        {note}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {detail ? (
        <Card elevated className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-base font-semibold text-ink">
              {detail.runner.name}
            </h3>
            <StatusPill
              status={detail.runner.status}
              aria-label={`Runner ${detail.runner.name} detail status: ${detail.runner.status}`}
            />
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-muted">Hostname</dt>
              <dd className="text-ink">{detail.runner.hostname}</dd>
            </div>
            <div>
              <dt className="text-muted">OS / Arch</dt>
              <dd className="text-ink">
                {detail.runner.os} / {detail.runner.arch}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Last seen</dt>
              <dd className="text-ink">
                {formatTimestamp(detail.runner.lastSeenAt)}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Kill switch</dt>
              <dd className="text-ink">
                {detail.runner.killSwitchActive
                  ? `Active — ${detail.runner.killSwitchReason ?? "no reason given"}`
                  : "Inactive"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Host control acknowledgement</dt>
              <dd className="text-ink">
                {detail.runner.status === "Revoked"
                  ? detail.runner.revocationAcknowledgedAt
                    ? `Revocation confirmed ${formatTimestamp(detail.runner.revocationAcknowledgedAt)}`
                    : "Revocation pending the runner's next outbound poll"
                  : detail.runner.killSwitchActive
                    ? detail.runner.killSwitchAcknowledgedAt
                      ? `Kill switch confirmed ${formatTimestamp(detail.runner.killSwitchAcknowledgedAt)}`
                      : "Kill switch pending the runner's next outbound poll"
                    : "No active stop control"}
              </dd>
            </div>
          </dl>

          {(detail.runner.killSwitchActive ||
            detail.runner.status === "Revoked") &&
          !(
            detail.runner.killSwitchAcknowledgedAt ||
            detail.runner.revocationAcknowledgedAt
          ) ? (
            <p className="rounded-control border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
              Server enforcement is active now. Host confirmation appears after
              the runner observes the state on its next outbound poll (normally
              within 15 seconds).
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={busy || detail.runner.status === "Revoked"}
              onClick={() =>
                run(async () => {
                  const updated =
                    await browserPeriscanApiClient.setRunnerKillSwitch(
                      detail.runner.runnerId,
                      {
                        active: !detail.runner.killSwitchActive,
                        reason: detail.runner.killSwitchActive
                          ? null
                          : "Operator-activated from Runners console."
                      }
                    );
                  setDetail((current) =>
                    current ? { ...current, runner: updated } : current
                  );
                  await reload();
                })
              }
            >
              {detail.runner.killSwitchActive
                ? "Deactivate kill switch"
                : "Activate kill switch"}
            </Button>
            <Button
              variant="secondary"
              disabled={busy || detail.runner.status === "Revoked"}
              onClick={() =>
                run(async () => {
                  const updated = await browserPeriscanApiClient.revokeRunner(
                    detail.runner.runnerId
                  );
                  setDetail((current) =>
                    current ? { ...current, runner: updated } : current
                  );
                  await reload();
                })
              }
            >
              Revoke runner
            </Button>
          </div>

          <div
            className="flex flex-col gap-2 rounded-control border border-line bg-surface p-3"
            aria-label="Run a measured check"
          >
            <h4 className="text-sm font-semibold text-ink">
              Run a measured check
            </h4>
            <p className="text-sm text-muted">
              Dispatch an allowlisted, non-invasive measured module to this
              runner against an internal host in a verified scope. The control
              plane enforces the allowlist, policy, and scope; the runner signs
              and returns measured evidence.
            </p>
            {endpointMarkerSelected ? (
              <p className="border-l-2 border-success bg-success/[0.06] px-3 py-2 text-xs leading-5 text-muted">
                Endpoint stimulus runs one short-lived Node.js process with the
                unique marker as an argument. It uses no shell, network,
                filesystem write, persistence, exploit, or destructive action.
              </p>
            ) : null}
            {measuredScopes.length === 0 ? (
              <p className="text-sm text-muted">
                {endpointMarkerSelected
                  ? "No verified Internal Network scope is available — authorize the runner host boundary before emitting a marker."
                  : "No verified scope is available — verify a scope before dispatching an in-network check."}
              </p>
            ) : (
              <>
                <label className="flex flex-col gap-1 text-sm text-muted">
                  Module
                  <select
                    aria-label="Measured module"
                    className={inputClass}
                    value={measuredForm.moduleId}
                    onChange={(event) =>
                      setMeasuredForm((form) => ({
                        ...form,
                        moduleId: event.target.value,
                        scopeId: ""
                      }))
                    }
                  >
                    {RUNNER_MEASURED_MODULE_IDS.map((moduleId) => (
                      <option key={moduleId} value={moduleId}>
                        {moduleId}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-muted">
                  Verified scope
                  <select
                    aria-label="Verified scope"
                    className={inputClass}
                    value={measuredForm.scopeId}
                    onChange={(event) =>
                      setMeasuredForm((form) => ({
                        ...form,
                        scopeId: event.target.value
                      }))
                    }
                  >
                    <option value="">Select a verified scope…</option>
                    {measuredScopes.map((scope) => (
                      <option key={scope.scopeId} value={scope.scopeId}>
                        {scope.value}
                      </option>
                    ))}
                  </select>
                </label>
                {endpointMarkerSelected ? (
                  <>
                    <label className="flex flex-col gap-1 text-sm text-muted">
                      Runner platform
                      <select
                        aria-label="Endpoint platform"
                        className={inputClass}
                        value={measuredForm.platform}
                        onChange={(event) =>
                          setMeasuredForm((form) => ({
                            ...form,
                            platform: event.target.value as "macOS" | "Linux"
                          }))
                        }
                      >
                        <option value="Linux">Linux</option>
                        <option value="macOS">macOS</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-muted">
                      Unique marker
                      <input
                        aria-label="Endpoint marker"
                        className={inputClass}
                        value={measuredForm.markerId}
                        onChange={(event) =>
                          setMeasuredForm((form) => ({
                            ...form,
                            markerId: event.target.value
                          }))
                        }
                      />
                    </label>
                  </>
                ) : null}
                <label className="flex flex-col gap-1 text-sm text-muted">
                  Target host (internal)
                  <input
                    aria-label="Target host"
                    className={inputClass}
                    value={measuredForm.targetHost}
                    onChange={(event) =>
                      setMeasuredForm((form) => ({
                        ...form,
                        targetHost: event.target.value
                      }))
                    }
                  />
                </label>
                {RUNNER_MEASURED_PORT_REQUIRED.has(measuredForm.moduleId) ? (
                  <label className="flex flex-col gap-1 text-sm text-muted">
                    Port
                    <input
                      aria-label="Target port"
                      className={inputClass}
                      inputMode="numeric"
                      value={measuredForm.port}
                      onChange={(event) =>
                        setMeasuredForm((form) => ({
                          ...form,
                          port: event.target.value
                        }))
                      }
                    />
                  </label>
                ) : null}
                <Button
                  disabled={
                    busy ||
                    detail.runner.status === "Revoked" ||
                    detail.runner.killSwitchActive ||
                    measuredForm.scopeId === "" ||
                    measuredForm.targetHost.trim() === "" ||
                    (endpointMarkerSelected &&
                      !/^[A-Za-z0-9._:-]{8,128}$/u.test(measuredForm.markerId))
                  }
                  onClick={() =>
                    run(async () => {
                      const portRequired = RUNNER_MEASURED_PORT_REQUIRED.has(
                        measuredForm.moduleId
                      );
                      const dispatched =
                        await browserPeriscanApiClient.createRunnerMeasuredTask(
                          detail.runner.runnerId,
                          {
                            moduleId: measuredForm.moduleId,
                            scopeId: measuredForm.scopeId,
                            targetHost: measuredForm.targetHost.trim(),
                            ...(endpointMarkerSelected
                              ? {
                                  markerId: measuredForm.markerId,
                                  platform: measuredForm.platform
                                }
                              : {}),
                            ...(portRequired
                              ? { port: Number(measuredForm.port) }
                              : {})
                          }
                        );
                      setDispatchedTask(dispatched);
                      setDetail((current) =>
                        current
                          ? {
                              ...current,
                              tasks: [dispatched, ...current.tasks]
                            }
                          : current
                      );
                    })
                  }
                >
                  Dispatch measured check
                </Button>
                {dispatchedTask ? (
                  <p
                    className="text-sm text-success"
                    role="status"
                    aria-label={`Dispatched measured task: ${dispatchedTask.moduleId}`}
                  >
                    Dispatched {dispatchedTask.moduleId} (task{" "}
                    {dispatchedTask.taskId.slice(0, 8)}).
                  </p>
                ) : null}
              </>
            )}
          </div>

          <div
            className="flex flex-col gap-2 rounded-control border border-line bg-surface p-3"
            aria-label="Run a discovery scan"
          >
            <h4 className="text-sm font-semibold text-ink">
              Run a discovery scan
            </h4>
            <p className="text-sm text-muted">
              Dispatch an allowlisted, non-invasive in-network discovery module
              to this runner to inventory hosts/services within a verified
              scope.
            </p>
            {detail.scopes.length === 0 ? (
              <p className="text-sm text-muted">
                No verified scope is available — verify a scope before running
                an in-network discovery scan.
              </p>
            ) : (
              <>
                <label className="flex flex-col gap-1 text-sm text-muted">
                  Discovery module
                  <select
                    aria-label="Discovery module"
                    className={inputClass}
                    value={discoverForm.moduleId}
                    onChange={(event) =>
                      setDiscoverForm((form) => ({
                        ...form,
                        moduleId: event.target.value
                      }))
                    }
                  >
                    {RUNNER_DISCOVER_MODULE_IDS.map((moduleId) => (
                      <option key={moduleId} value={moduleId}>
                        {moduleId}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-muted">
                  Discovery scope
                  <select
                    aria-label="Discovery scope"
                    className={inputClass}
                    value={discoverForm.scopeId}
                    onChange={(event) =>
                      setDiscoverForm((form) => ({
                        ...form,
                        scopeId: event.target.value
                      }))
                    }
                  >
                    <option value="">Select a verified scope…</option>
                    {detail.scopes.map((scope) => (
                      <option key={scope.scopeId} value={scope.scopeId}>
                        {scope.value}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-muted">
                  Target (IP range / CIDR / host)
                  <input
                    aria-label="Discovery target"
                    className={inputClass}
                    value={discoverForm.target}
                    onChange={(event) =>
                      setDiscoverForm((form) => ({
                        ...form,
                        target: event.target.value
                      }))
                    }
                  />
                </label>
                <Button
                  disabled={
                    busy ||
                    detail.runner.status === "Revoked" ||
                    detail.runner.killSwitchActive ||
                    discoverForm.scopeId === "" ||
                    discoverForm.target.trim() === ""
                  }
                  onClick={() =>
                    run(async () => {
                      const dispatched =
                        await browserPeriscanApiClient.createRunnerDiscoverTask(
                          detail.runner.runnerId,
                          {
                            moduleId: discoverForm.moduleId,
                            scopeId: discoverForm.scopeId,
                            target: discoverForm.target.trim()
                          }
                        );
                      setDiscoveredTask(dispatched);
                      setDetail((current) =>
                        current
                          ? {
                              ...current,
                              tasks: [dispatched, ...current.tasks]
                            }
                          : current
                      );
                    })
                  }
                >
                  Dispatch discovery scan
                </Button>
                {discoveredTask ? (
                  <p
                    className="text-sm text-success"
                    role="status"
                    aria-label={`Dispatched discovery task: ${discoveredTask.moduleId}`}
                  >
                    Dispatched {discoveredTask.moduleId} (task{" "}
                    {discoveredTask.taskId.slice(0, 8)}).
                  </p>
                ) : null}
              </>
            )}
          </div>

          <h4 className="text-sm font-semibold text-ink">Recent tasks</h4>
          {detail.tasks.length === 0 ? (
            <p className="text-sm text-muted">
              No tasks have been dispatched to this runner yet.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {detail.tasks.map((task) => {
                // The submitted result (LooseObject) carries the measured
                // outcome/validationState for a completed task.
                const result = task.result as {
                  outcome?: unknown;
                  validationState?: unknown;
                } | null;
                const outcome =
                  typeof result?.outcome === "string" ? result.outcome : null;
                const validationState =
                  typeof result?.validationState === "string"
                    ? result.validationState
                    : null;
                return (
                  <article
                    className="flex items-center justify-between gap-4 rounded-control border border-line bg-surface p-3"
                    key={task.taskId}
                  >
                    <div className="flex flex-col gap-1">
                      <strong className="text-ink">{task.moduleId}</strong>
                      <p className="text-sm text-muted">
                        {task.taskType ?? "task"} · {task.safetyLevel} · Issued{" "}
                        {formatTimestamp(task.issuedAt)}
                      </p>
                      {outcome || validationState ? (
                        <p
                          className="text-sm text-muted"
                          aria-label={`Measured result for ${task.moduleId}`}
                        >
                          Result: {outcome ?? "—"}
                          {validationState ? ` · ${validationState}` : ""}
                        </p>
                      ) : null}
                      {task.errorSummary ? (
                        <p className="text-sm text-danger">
                          {task.errorSummary}
                        </p>
                      ) : null}
                    </div>
                    <StatusPill status={task.status} />
                  </article>
                );
              })}
            </div>
          )}
        </Card>
      ) : null}
    </section>
  );
}

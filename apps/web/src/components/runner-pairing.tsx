"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { RunnerRecord } from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import {
  agentInNetworkInstallHint,
  DEPLOYMENT_MODES,
  IN_NETWORK_AGENT_IMAGE,
  installCommand,
  SUPPORTED_CUSTOMER_RUNNER_IMAGE,
  type RunnerDeploymentMode
} from "../lib/runner-install";
import { type ApiResource } from "../hooks/use-api-resource";
import { Panel, PanelHeader, Spinner, buttonClassName, cn } from "../ui";

// Re-export control-plane + install helpers for consumers that already import
// from this module (fleet control room, runners console, legacy workbench).
export {
  agentInNetworkInstallHint,
  DEPLOYMENT_MODES,
  IN_NETWORK_AGENT_IMAGE,
  installCommand,
  RUNNER_CONTROL_PLANE,
  SUPPORTED_CUSTOMER_RUNNER_IMAGE
} from "../lib/runner-install";
export type {
  InstallCommandOptions,
  RunnerDeploymentMode,
  RunnerInstallPackage
} from "../lib/runner-install";

interface Session {
  token: string;
  runnerName: string;
  mode: RunnerDeploymentMode;
  knownIds: Set<string>;
}

/**
 * Claude-Code-style runner pairing. Issue a one-time token, paste the install
 * command on an in-network host, and this panel polls for the runner to dial in
 * — then shows its certificate fingerprint to confirm the linkage (TOFU). There
 * is no separate server-side approve step: enrollment completes when the runner
 * checks in, and the fingerprint is the "key" you verify against the host.
 *
 * Product honesty (P10-3 / SUPPORTED_CUSTOMER_RUNNER): primary package is the
 * Go Supported Customer Runner. Agent (in-network) is optional lab/AgentLocal.
 */
export function RunnerPairing({
  runners
}: {
  runners: ApiResource<RunnerRecord[]>;
}) {
  const [name, setName] = useState("");
  const [mode, setMode] = useState<RunnerDeploymentMode>("Docker");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [copied, setCopied] = useState(false);
  const [showAgentHint, setShowAgentHint] = useState(false);

  // The newly-enrolled runner: a runner that wasn't present when we issued the
  // token and whose name matches.
  const paired: RunnerRecord | null =
    session != null
      ? ((runners.data ?? []).find(
          (r) =>
            !session.knownIds.has(r.runnerId) && r.name === session.runnerName
        ) ?? null)
      : null;

  // Poll for check-in while a session is open and not yet paired.
  useEffect(() => {
    if (!session || paired) return;
    const id = setInterval(() => {
      void runners.refetch();
    }, 4000);
    return () => clearInterval(id);
  }, [session, paired, runners.refetch]);

  async function issue() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.createRunnerRegistrationToken({
        runnerName: name.trim(),
        deploymentMode: mode,
        labels: []
      });
      setSession({
        token: r.registrationToken,
        runnerName: name.trim(),
        mode,
        knownIds: new Set((runners.data ?? []).map((x) => x.runnerId))
      });
      setShowAgentHint(false);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Couldn't issue a token."
      );
    } finally {
      setBusy(false);
    }
  }

  function copy(text: string) {
    void navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => undefined
    );
  }

  function reset() {
    setSession(null);
    setName("");
    setError(null);
    setShowAgentHint(false);
  }

  if (!session) {
    return (
      <Panel>
        <PanelHeader title="Add a runner" />
        <div className="flex flex-wrap items-end gap-2 p-4">
          <label className="flex flex-1 flex-col gap-1">
            <Label>Runner name</Label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. dc-subnet-runner"
              className="min-w-0 rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none placeholder:text-subtle focus:border-line-strong"
            />
          </label>
          <label className="flex flex-col gap-1">
            <Label>Deployment</Label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as RunnerDeploymentMode)}
              className="rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-line-strong"
            >
              {DEPLOYMENT_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={issue}
            disabled={busy || !name.trim()}
            className={buttonClassName({ size: "sm", variant: "primary" })}
          >
            {busy ? "Preparing…" : "Start pairing"}
          </button>
          {error ? <p className="w-full text-sm text-missed">{error}</p> : null}
          <p className="w-full text-[11px] text-subtle">
            Primary package:{" "}
            <strong className="font-medium text-muted">
              Supported Customer Runner
            </strong>{" "}
            (Go LTS,{" "}
            <code className="font-mono text-[10px]">
              {SUPPORTED_CUSTOMER_RUNNER_IMAGE}
            </code>
            ). Agent (in-network) is optional for AgentLocal lab modules only.
            Community InternalRunner OSS (nmap, syft) still needs runner-agent;
            enrolling only this Go image does not run that pack.
          </p>
        </div>
      </Panel>
    );
  }

  const command = installCommand(session.mode, session.token);
  const agentHint = agentInNetworkInstallHint(session.mode);

  return (
    <Panel>
      <PanelHeader
        title={`Pair "${session.runnerName}"`}
        actions={
          <button
            type="button"
            onClick={reset}
            className="text-xs text-subtle hover:text-ink"
          >
            Start over
          </button>
        }
      />
      <div className="flex flex-col gap-4 p-4">
        {/* Step 1 — install */}
        <Step n={1} title="Install on an in-network host" done={!!paired}>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="font-mono text-[11px] text-subtle">
              {session.mode} · Supported Customer Runner (Go LTS)
            </span>
            <button
              type="button"
              onClick={() => copy(command)}
              className={buttonClassName({ size: "sm", variant: "secondary" })}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="overflow-x-auto rounded-control border border-line bg-bg p-3 font-mono text-[11px] leading-relaxed text-ink">
            {command}
          </pre>
          <p className="mt-1.5 text-[11px] text-subtle">
            The token is one-time and expires soon. The runner dials out over TLS
            to enroll — no inbound firewall change is required. Image:{" "}
            <code className="font-mono text-[10px]">
              {SUPPORTED_CUSTOMER_RUNNER_IMAGE}
            </code>
            . Community InternalRunner OSS (nmap, syft) still needs runner-agent;
            enrolling only this Go image does not run that pack.
          </p>

          <div className="mt-3 rounded-control border border-line bg-surface/60 p-2.5">
            <button
              type="button"
              onClick={() => setShowAgentHint((v) => !v)}
              className="flex w-full items-center justify-between gap-2 text-left"
            >
              <span className="text-[12px] font-medium text-muted">
                Optional: Agent (in-network) — lab / AgentLocal only
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-subtle">
                {showAgentHint ? "Hide" : "Show"}
              </span>
            </button>
            {showAgentHint ? (
              <div className="mt-2">
                <p className="mb-1.5 text-[11px] text-subtle">
                  Not the Supported Customer Runner. Use when you need AgentLocal
                  measured or recon modules, including Community InternalRunner
                  OSS (nmap, syft), after enrollment. Deploy examples live under{" "}
                  <code className="font-mono text-[10px]">
                    apps/runner-agent/deploy
                  </code>
                  . Image:{" "}
                  <code className="font-mono text-[10px]">
                    {IN_NETWORK_AGENT_IMAGE}
                  </code>
                  .
                </p>
                <pre className="overflow-x-auto rounded-control border border-line bg-bg p-3 font-mono text-[11px] leading-relaxed text-ink">
                  {agentHint}
                </pre>
              </div>
            ) : null}
          </div>
        </Step>

        {/* Step 2 — check-in */}
        <Step n={2} title="Confirm the runner checked in" done={!!paired} last>
          {paired ? (
            <div className="rounded-card border border-fixed/40 bg-fixed/5 p-3">
              <p className="flex items-center gap-2 font-display text-[13px] font-semibold text-fixed">
                <span aria-hidden>✓</span> {paired.name} checked in
              </p>
              <p className="mt-1 text-[12px] text-muted">
                {paired.hostname} · {paired.os}/{paired.arch} · status{" "}
                {paired.status}
              </p>
              {paired.certificateSha256 ? (
                <div className="mt-2">
                  <p className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
                    Verify this fingerprint matches the one the runner printed
                  </p>
                  <p className="mt-1 break-all rounded-control border border-line bg-bg px-2 py-1.5 font-mono text-[11px] text-ink">
                    {paired.certificateSha256}
                  </p>
                </div>
              ) : null}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={reset}
                  className={buttonClassName({
                    size: "sm",
                    variant: "primary"
                  })}
                >
                  Finish
                </button>
                <Link
                  href="/runners"
                  className={buttonClassName({
                    size: "sm",
                    variant: "secondary"
                  })}
                >
                  View runner
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 rounded-card border border-line bg-surface p-3">
              <Spinner />
              <div>
                <p className="text-[13px] text-ink">Waiting for check-in…</p>
                <p className="text-[11px] text-subtle">
                  Run the command above; this updates automatically when the
                  runner dials in.
                </p>
              </div>
            </div>
          )}
        </Step>
      </div>
    </Panel>
  );
}

function Step({
  n,
  title,
  done,
  last,
  children
}: {
  n: number;
  title: string;
  done: boolean;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-full border font-mono text-[11px]",
            done
              ? "border-fixed bg-fixed/15 text-fixed"
              : "border-brand bg-brand/15 text-brand"
          )}
        >
          {done ? "✓" : n}
        </span>
        {!last ? <span className="mt-1 w-px flex-1 bg-line" /> : null}
      </div>
      <div className="min-w-0 flex-1 pb-1">
        <p className="mb-1.5 font-display text-[13px] font-semibold text-ink">
          {title}
        </p>
        {children}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
      {children}
    </span>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { useApiResource } from "../hooks/use-api-resource";
import {
  ErrorState,
  LoadingSkeleton,
  NotConfigured,
  Panel,
  PanelHeader,
  StateBadge,
  buttonClassName
} from "../ui";

function relTime(iso?: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function McpConsole() {
  const keys = useApiResource(() => api.listApiKeys(), []);
  const tools = useApiResource(() => api.listMcpTools(), []);
  const activity = useApiResource(() => api.listMcpActivity(), []);
  const [copied, setCopied] = useState(false);
  const [endpoint, setEndpoint] = useState("https://app.periscan.com/mcp");

  useEffect(() => {
    setEndpoint(`${window.location.origin}/mcp`);
  }, []);

  const activeKey = (keys.data ?? []).find((k) => !k.revokedAt);
  const keyRef = activeKey ? `${activeKey.keyPrefix}…` : "<your psk_ API key>";
  const config = `{
  "mcpServers": {
    "periscan": {
      "url": "${endpoint}",
      "headers": {
        "Authorization": "Bearer ${keyRef}"
      }
    }
  }
}`;

  function copy() {
    void navigator.clipboard?.writeText(config).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const toolList = tools.data ?? [];
  const activityList = activity.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-5 py-6">
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
          Autonomous · MCP
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            MCP Server
          </h1>
          <StateBadge tone="validated" dot={false}>
            Wave H read-only
          </StateBadge>
          <StateBadge tone="approval" variant="outline" dot={false}>
            Community gated
          </StateBadge>
          <a
            href="#mcp-honesty"
            className="font-mono text-[11px] text-brand hover:text-brand-2"
          >
            Capability honesty ↓
          </a>
        </div>
        <p className="max-w-2xl text-sm text-muted">
          Expose Periscan&apos;s Wave H catalog (read-only posture query) and
          Community tools to your own AI clients over the Model Context
          Protocol. Every tool is tenant-scoped and audited.{" "}
          <span className="font-mono text-ink">start_community_validation</span>{" "}
          starts a Community run only with a verified{" "}
          <span className="font-mono">scopeId</span> and{" "}
          <span className="font-mono">policyDecisionId</span> — denied tasks
          never queue. API keys need coarse{" "}
          <span className="font-mono">read</span> or{" "}
          <span className="font-mono">admin</span> scope; fine-grained
          mutate-only keys (for example{" "}
          <span className="font-mono">mission:run</span> alone) are denied.
          Community start then enforces editor role and{" "}
          <span className="font-mono">mission:run</span>.
        </p>
      </header>

      {/* UX-W4 / #179: keep honesty first and discoverable */}
      <div
        id="mcp-honesty"
        className="rounded-card border border-brand/40 bg-brand/10 px-4 py-3"
        role="note"
        aria-label="MCP capability honesty"
      >
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-brand">
          Wave H catalog vs Community start
        </p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
          Wave H tools stay read-only posture query. Community tools add{" "}
          <span className="font-mono text-ink">list_community_suite</span>,{" "}
          <span className="font-mono text-ink">start_community_validation</span>{" "}
          (verified <span className="font-mono">scopeId</span> and{" "}
          <span className="font-mono">policyDecisionId</span>), and{" "}
          <span className="font-mono text-ink">list_findings_for_mission</span>.
          Denied tasks never queue. Schema still advertises{" "}
          <span className="font-mono text-ink">readOnlyHint: true</span> /{" "}
          <span className="font-mono text-ink">destructiveHint: false</span> as
          Wave H catalog metadata; Community start is policy-gated in the tool
          description and run path. Not live Atomic, Caldera, SharpHound,
          sqlmap, or Metasploit. Remediation apply is still not an MCP tool.
        </p>
      </div>

      <Panel>
        <PanelHeader title="Capability honesty" />
        <div className="flex flex-col gap-2 p-4 text-[12.5px] leading-relaxed text-muted">
          <p>
            <strong className="text-ink">Wave H catalog is read-only.</strong>{" "}
            Tools advertise <span className="font-mono">readOnlyHint: true</span>,{" "}
            <span className="font-mono">destructiveHint: false</span>, and
            required scopes <span className="font-mono">read</span> /{" "}
            <span className="font-mono">admin</span>. That hint is Wave H
            catalog metadata, not a claim that Community start is absent.
          </p>
          <p>
            <span className="font-mono text-ink">start_community_validation</span>{" "}
            starts a run only with a verified{" "}
            <span className="font-mono">scopeId</span> and{" "}
            <span className="font-mono">policyDecisionId</span>. Missing policy
            fails before queue. Denied tasks never queue. Remediation apply is
            still not an MCP tool.
          </p>
          <p>
            Offensive multi-agent BAS swarm orchestration is{" "}
            <strong className="text-ink">not</strong> exposed here — use
            governed Agent Workflows and the Model Gateway for policy-gated
            analyst sessions. Live Atomic, Caldera, SharpHound, sqlmap, and
            Metasploit stay off.
          </p>
        </div>
      </Panel>

      {/* Connection */}
      <Panel>
        <PanelHeader
          title="Connect a client"
          actions={
            <button
              type="button"
              onClick={copy}
              className={buttonClassName({ size: "sm", variant: "secondary" })}
            >
              {copied ? "Copied" : "Copy config"}
            </button>
          }
        />
        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[12px] text-subtle">
            <span>
              endpoint: <span className="text-ink">{endpoint}</span>
            </span>
            <span>transport: streamable HTTP (JSON-RPC 2.0)</span>
            <span>auth: Bearer (tenant API key)</span>
          </div>
          <pre className="overflow-x-auto rounded-control border border-line bg-bg p-3 font-mono text-[11px] leading-relaxed text-ink">
            {config}
          </pre>
          {keys.loading ? null : !activeKey ? (
            <p className="text-[12px] text-approval">
              No active API key.{" "}
              <Link href="/admin" className="font-semibold hover:underline">
                Create one in Admin
              </Link>{" "}
              and paste its secret in place of the placeholder.
            </p>
          ) : (
            <p className="text-[12px] text-subtle">
              Using key <span className="font-mono">{activeKey.name}</span> (
              {keyRef}). The secret is shown only once at creation — paste it in
              place of the prefix. A <span className="font-mono">read</span>-scope
              key is enough to invoke MCP;{" "}
              <span className="font-mono">start_community_validation</span> then
              enforces editor role and <span className="font-mono">mission:run</span>.
            </p>
          )}
        </div>
      </Panel>

      {/* Exposed tools */}
      <Panel>
        <PanelHeader title={`Tools exposed over MCP (${toolList.length})`} />
        {tools.loading ? (
          <LoadingSkeleton rows={5} />
        ) : tools.error ? (
          <ErrorState message={tools.error} onRetry={tools.refetch} />
        ) : toolList.length === 0 ? (
          <div className="p-4">
            <NotConfigured
              title="No tools available"
              message="The MCP tool catalog is empty."
            />
          </div>
        ) : (
          <ul>
            {toolList.map((tool) => (
              <li
                key={tool.name}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3 last:border-b-0"
              >
                <span className="text-[13px] text-ink">{tool.title}</span>
                <span className="font-mono text-[10px] text-subtle">
                  {tool.name}
                </span>
                <StateBadge tone="validated" dot={false}>
                  {tool.readOnly ? "read-only" : "restricted"}
                </StateBadge>
                <span className="font-mono text-[10px] text-subtle">
                  scopes {(tool.requiredScopes ?? ["read"]).join(" | ")}
                </span>
                <span className="ml-auto max-w-[46ch] truncate text-[11px] text-subtle">
                  {tool.description}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Recent activity */}
      <Panel>
        <PanelHeader title="Recent tool calls" />
        {activity.loading ? (
          <LoadingSkeleton rows={4} />
        ) : activity.error ? (
          <ErrorState message={activity.error} onRetry={activity.refetch} />
        ) : activityList.length === 0 ? (
          <p className="px-4 py-6 text-[12.5px] text-subtle">
            No MCP tool calls yet. Connect a client and calls will appear here,
            derived from the tenant audit log.
          </p>
        ) : (
          <ul>
            {activityList.map((entry, index) => (
              <li
                key={`${entry.toolName}-${entry.invokedAt}-${index}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-2.5 last:border-b-0"
              >
                <span className="font-mono text-[12px] text-ink">
                  {entry.toolName}
                </span>
                <StateBadge
                  tone={entry.status === "error" ? "missed" : "validated"}
                  dot={false}
                >
                  {entry.status}
                </StateBadge>
                <span className="ml-auto font-mono text-[11px] text-subtle">
                  {relTime(entry.invokedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

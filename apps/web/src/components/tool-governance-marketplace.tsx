"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import {
  COMMUNITY_VALIDATION_SUITE,
  COMMUNITY_VALIDATION_TOOL_IDS,
  COPYLEFT_OPT_IN_SUITE,
  COPYLEFT_OPT_IN_TOOL_IDS,
  COPYLEFT_OPT_IN_VALUE_LINE,
  classifyEngineLabHonesty,
  isCommunityValidationModuleId,
  isCopyleftOptInToolId,
  type EngineLabHonesty,
  type OpenSourceToolId,
  type ThirdPartyTool,
  type ToolLicenseAcceptance
} from "@periscan/shared";

import { CopyleftPackSheet } from "./copyleft-pack-sheet";
import { SecurityCatalogManager } from "./security-catalog-manager";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { useApiResource } from "../hooks/use-api-resource";
import { useFocusTrap } from "../hooks/use-focus-trap";
import {
  ErrorState,
  LoadingSkeleton,
  NotConfigured,
  Panel,
  StateBadge,
  buttonClassName,
  cn,
  type StateTone
} from "../ui";
import { ExtensionDeveloperStudio } from "./extension-developer-studio";

const GOVERNANCE_TONE: Record<string, StateTone> = {
  Enabled: "fixed",
  Disabled: "inconclusive",
  LegalReviewRequired: "approval",
  Blocked: "missed"
};

const INSTALL_TONE: Record<string, StateTone> = {
  Installed: "fixed",
  Available: "validated",
  NotInstalled: "inconclusive",
  Missing: "missed",
  Installing: "approval",
  Checking: "approval",
  Failed: "missed",
  Skipped: "inconclusive"
};

const JOB_TONE: Record<string, StateTone> = {
  Completed: "fixed",
  Running: "approval",
  Queued: "inconclusive",
  Failed: "missed",
  Denied: "missed"
};

const FIRST_PARTY_COMMUNITY_COUNT = COMMUNITY_VALIDATION_SUITE.filter(
  (entry) => entry.toolId === null
).length;

const PLATFORM_EVIDENCE_PACK_IDS = [
  "periscan.endpoint_macos_detection_analytics",
  "periscan.endpoint_linux_detection_analytics",
  "periscan.kubernetes_cis_posture",
  "web.zap_baseline",
  "syft.sbom_generate",
  "sigstore.cosign_verify_blob"
] as const;

type LaneId =
  | "all"
  | "community"
  | "legal_review"
  | "theater"
  | "ready"
  | "needs_install"
  | "license_action"
  | "blocked"
  | "enabled";

type EngineCardState =
  | "blocked"
  | "accept_license"
  | "install"
  | "installing"
  | "enable"
  | "enabled"
  | "failed"
  | "check";

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

function needsLicenseAcceptance(tool: ThirdPartyTool): boolean {
  return (
    tool.tool.tool.policyStatus === "RequiresLegalReview" ||
    tool.governance.status === "LegalReviewRequired"
  );
}

function isHardBlocked(tool: ThirdPartyTool): boolean {
  return (
    tool.governance.status === "Blocked" ||
    tool.tool.readiness === "Blocked" ||
    tool.tool.tool.policyStatus === "Deferred"
  );
}

function hasLicenseForPin(
  tool: ThirdPartyTool,
  acceptances: ToolLicenseAcceptance[]
): boolean {
  if (!needsLicenseAcceptance(tool)) return true;
  const pin = tool.governance.pinnedVersion || tool.tool.tool.defaultVersion;
  return acceptances.some(
    (row) => row.toolId === tool.tool.tool.toolId && row.version === pin
  );
}

function honestyForTool(tool: ThirdPartyTool): EngineLabHonesty {
  return classifyEngineLabHonesty({
    governanceStatus: tool.governance.status,
    moduleIds: tool.tool.tool.moduleIds,
    policyStatus: tool.tool.tool.policyStatus,
    toolId: tool.tool.tool.toolId
  });
}

function resolveCardState(
  tool: ThirdPartyTool,
  acceptances: ToolLicenseAcceptance[]
): EngineCardState {
  if (honestyForTool(tool).class === "theater") {
    return "blocked";
  }

  if (isHardBlocked(tool) && !needsLicenseAcceptance(tool)) {
    return "blocked";
  }

  const install = tool.runtimeInstallation.installStatus;
  if (install === "Failed") return "failed";
  if (install === "Installing" || install === "Checking") return "installing";

  if (tool.governance.enabled && tool.governance.status === "Enabled") {
    return "enabled";
  }

  const licensed = hasLicenseForPin(tool, acceptances);
  if (needsLicenseAcceptance(tool) && !licensed) {
    return "accept_license";
  }

  if (install === "Installed" || install === "Available") {
    return "enable";
  }

  if (
    install === "NotInstalled" ||
    install === "Missing" ||
    install === "Skipped"
  ) {
    return "install";
  }

  return "check";
}

function laneForState(state: EngineCardState, tool: ThirdPartyTool): LaneId {
  if (state === "blocked") return "blocked";
  if (state === "accept_license") return "license_action";
  if (state === "enabled") return "enabled";
  if (
    state === "install" ||
    state === "installing" ||
    state === "failed" ||
    state === "check"
  ) {
    return "needs_install";
  }
  if (state === "enable") {
    return tool.runtimeInstallation.installStatus === "Installed"
      ? "ready"
      : "needs_install";
  }
  return "all";
}

export function ToolGovernanceMarketplace() {
  const searchParams = useSearchParams();
  const tools = useApiResource(() => api.listThirdPartyTools(), []);
  const acceptances = useApiResource(
    () => api.listToolLicenseAcceptances(),
    []
  );
  const modules = useApiResource(() => api.listModules(), []);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [lane, setLane] = useState<LaneId>("all");
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [packBusy, setPackBusy] = useState(false);
  const [copyleftBusy, setCopyleftBusy] = useState(false);
  const [copyleftSheetOpen, setCopyleftSheetOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [licenseTarget, setLicenseTarget] = useState<ThirdPartyTool | null>(
    null
  );
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const deepLinkHandled = useRef(false);
  const packDeepLinkHandled = useRef(false);
  const copyleftDeepLinkHandled = useRef(false);

  const all = tools.data ?? [];
  const acceptanceRows = acceptances.data ?? [];

  const platformEvidencePacks = useMemo(() => {
    const byId = new Map(
      (modules.data ?? []).map((module) => [module.moduleId, module])
    );

    return PLATFORM_EVIDENCE_PACK_IDS.flatMap((moduleId) => {
      const module = byId.get(moduleId);
      return module ? [module] : [];
    });
  }, [modules.data]);

  const categories = useMemo(
    () => Array.from(new Set(all.map((t) => t.tool.tool.category))).sort(),
    [all]
  );

  const enriched = useMemo(() => {
    return all.map((tool) => {
      const state = resolveCardState(tool, acceptanceRows);
      const honesty = honestyForTool(tool);
      return {
        tool,
        state,
        honesty,
        lane: laneForState(state, tool),
        licensed: hasLicenseForPin(tool, acceptanceRows)
      };
    });
  }, [all, acceptanceRows]);

  const summary = useMemo(() => {
    return {
      total: enriched.length,
      enabled: enriched.filter((e) => e.state === "enabled").length,
      installed: enriched.filter(
        (e) => e.tool.runtimeInstallation.installStatus === "Installed"
      ).length,
      licenseAction: enriched.filter((e) => e.state === "accept_license")
        .length,
      ready: enriched.filter((e) => e.lane === "ready" || e.state === "enable")
        .length
    };
  }, [enriched]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enriched
      .filter(
        (e) =>
          category === "all" || e.tool.tool.tool.category === category
      )
      .filter((e) => {
        if (lane === "all") return true;
        if (lane === "community") return e.honesty.class === "community";
        if (lane === "legal_review") return e.honesty.class === "legal_review";
        if (lane === "theater") {
          return e.honesty.class === "theater" || e.honesty.class === "catalog";
        }
        return e.lane === lane;
      })
      .filter(
        (e) =>
          !q ||
          e.tool.tool.tool.displayName.toLowerCase().includes(q) ||
          e.tool.tool.tool.toolId.toLowerCase().includes(q) ||
          e.tool.tool.tool.notes.toLowerCase().includes(q) ||
          e.tool.tool.tool.license.toLowerCase().includes(q)
      )
      .sort((a, b) =>
        a.tool.tool.tool.displayName.localeCompare(b.tool.tool.tool.displayName)
      );
  }, [enriched, category, query, lane]);

  useEffect(() => {
    if (deepLinkHandled.current || all.length === 0) return;
    const toolParam = searchParams.get("tool");
    const actionParam = searchParams.get("action");
    if (!toolParam) return;

    const match = all.find((t) => t.tool.tool.toolId === toolParam);
    if (!match) return;

    deepLinkHandled.current = true;
    setHighlightId(match.tool.tool.toolId);
    setQuery(match.tool.tool.displayName);

    if (actionParam === "install" || actionParam === "accept") {
      const state = resolveCardState(match, acceptanceRows);
      if (state === "accept_license") {
        setLicenseTarget(match);
      }
    }
  }, [all, acceptanceRows, searchParams]);

  async function refetchAll() {
    await Promise.all([tools.refetch(), acceptances.refetch()]);
  }

  async function loadCommunityPack() {
    setPackBusy(true);
    setActionError(null);
    const failures: string[] = [];
    try {
      for (const row of communityPackEngines) {
        const match = row.match;
        if (!match) {
          failures.push(`${row.toolId}: not in catalog`);
          continue;
        }
        const toolId = match.tool.tool.tool.toolId;
        const state = match.state;
        try {
          if (state === "accept_license") {
            failures.push(`${toolId}: license accept required`);
            continue;
          }
          if (state === "install" || state === "failed" || state === "check") {
            const job = await api.installThirdPartyTool(toolId);
            if (job.status === "Denied" || job.status === "Failed") {
              failures.push(`${toolId}: ${job.reason ?? job.status}`);
              continue;
            }
          }
          if (state === "enable" || state === "install" || state === "failed") {
            await api.enableThirdPartyTool(
              toolId,
              "Enabled as part of Community validation pack"
            );
          }
        } catch (error) {
          failures.push(
            `${toolId}: ${error instanceof Error ? error.message : "failed"}`
          );
        }
      }
      await refetchAll();
      if (failures.length > 0) {
        setActionError(
          `Community pack loaded with ${failures.length} issue(s): ${failures.slice(0, 4).join("; ")}`
        );
      }
    } finally {
      setPackBusy(false);
    }
  }

  async function loadCopyleftPack() {
    setCopyleftBusy(true);
    setActionError(null);
    const failures: string[] = [];
    try {
      for (const toolId of COPYLEFT_OPT_IN_TOOL_IDS) {
        const match = all.find((tool) => tool.tool.tool.toolId === toolId);
        if (!match) {
          failures.push(`${toolId}: not in catalog`);
          continue;
        }
        try {
          if (!hasLicenseForPin(match, acceptanceRows)) {
            await api.acceptToolLicense({
              authorized: true,
              toolId
            });
          }
          const job = await api.installThirdPartyTool(toolId);
          if (job.status === "Denied" || job.status === "Failed") {
            failures.push(`${toolId}: ${job.reason ?? job.status}`);
            continue;
          }
          await api.enableThirdPartyTool(
            toolId,
            "Enabled after tenant accepted the upstream copyleft license"
          );
        } catch (error) {
          failures.push(
            `${toolId}: ${error instanceof Error ? error.message : "failed"}`
          );
        }
      }
      await refetchAll();
      if (failures.length > 0) {
        setActionError(
          `Copyleft pack loaded with ${failures.length} issue(s): ${failures.slice(0, 4).join("; ")}`
        );
      }
    } finally {
      setCopyleftBusy(false);
      setCopyleftSheetOpen(false);
    }
  }

  async function run(toolId: OpenSourceToolId, fn: () => Promise<unknown>) {
    setBusy((b) => ({ ...b, [toolId]: true }));
    setActionError(null);
    try {
      await fn();
      await refetchAll();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "That action didn't complete."
      );
    } finally {
      setBusy((b) => ({ ...b, [toolId]: false }));
    }
  }

  async function acceptAndMaybeInstall(
    tool: ThirdPartyTool,
    thenInstall: boolean
  ) {
    const toolId = tool.tool.tool.toolId;
    setBusy((b) => ({ ...b, [toolId]: true }));
    setActionError(null);
    try {
      await api.acceptToolLicense({
        authorized: true,
        toolId
      });
      if (thenInstall) {
        const job = await api.installThirdPartyTool(toolId);
        if (job.status === "Denied") {
          setActionError(
            job.reason ??
              "Install was denied after license acceptance. Review the job reason."
          );
        }
      }
      setLicenseTarget(null);
      await refetchAll();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "License acceptance did not complete."
      );
    } finally {
      setBusy((b) => ({ ...b, [toolId]: false }));
    }
  }

  const communityPackEngines = useMemo(() => {
    const byId = new Map(
      enriched.map((e) => [e.tool.tool.tool.toolId, e])
    );
    return COMMUNITY_VALIDATION_TOOL_IDS.map((toolId) => {
      const suiteEntry = COMMUNITY_VALIDATION_SUITE.find(
        (entry) => entry.toolId === toolId
      );
      return {
        toolId,
        title: suiteEntry?.title ?? toolId,
        secondMission: suiteEntry?.executionMode === "ExternalPoA",
        match: byId.get(toolId) ?? null
      };
    });
  }, [enriched]);

  const communityPackReadyCount = communityPackEngines.filter(
    (row) =>
      row.match &&
      (row.match.state === "enabled" || row.match.lane === "ready")
  ).length;

  useEffect(() => {
    if (packDeepLinkHandled.current) return;
    if (searchParams.get("action") !== "install-community-pack") return;
    if (communityPackEngines.length === 0) return;
    packDeepLinkHandled.current = true;
    void loadCommunityPack();
  }, [communityPackEngines, searchParams]);

  useEffect(() => {
    if (copyleftDeepLinkHandled.current) return;
    if (searchParams.get("action") !== "add-copyleft-pack") return;
    copyleftDeepLinkHandled.current = true;
    setCopyleftSheetOpen(true);
    setLane("legal_review");
  }, [searchParams]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-6">
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
          Operate · Engine Lab
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Engines
        </h1>
        <p className="max-w-2xl text-sm text-muted">
          Community engines start from Validate. Legal-review tools need
          license accept. Catalog-only rows are not Community validation.
        </p>
      </header>

      <section
        aria-labelledby="community-startable-engines-heading"
        className="rounded-card border border-brand/35 bg-brand/[0.05] px-4 py-4"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="max-w-2xl">
            <p className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-2">
              Community validation pack
            </p>
            <h2
              id="community-startable-engines-heading"
              className="mt-1 font-display text-base font-semibold text-ink"
            >
              Community-startable engines
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              From the Community suite. Nuclei is a second mission.
              Legal-review and catalog-only rows are not this pack.
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-xs text-subtle">
              {communityPackReadyCount} of {communityPackEngines.length} ready
            </p>
            <div className="mt-2 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                data-testid="install-community-pack"
                className={buttonClassName({ size: "sm", variant: "primary" })}
                disabled={packBusy}
                onClick={() => void loadCommunityPack()}
              >
                {packBusy ? "Loading Community pack…" : "Install + enable Community pack"}
              </button>
              <Link
                href="/missions"
                className="inline-flex items-center text-xs font-semibold text-brand underline underline-offset-2 hover:text-brand-2"
              >
                Run Community validation →
              </Link>
            </div>
          </div>
        </div>
        <ol className="mt-4 grid gap-2 sm:grid-cols-2">
          {communityPackEngines.map(({ toolId, title, secondMission, match }, index) => {
            const state = match?.state ?? "check";
            const install =
              match?.tool.runtimeInstallation.installStatus ?? "NotInstalled";
            const enabled = match?.state === "enabled";
            const ready =
              match &&
              (match.state === "enabled" || match.lane === "ready");
            const displayName = match?.tool.tool.tool.displayName ?? toolId;
            return (
              <li
                key={toolId}
                className="flex flex-col gap-2 rounded-control border border-line bg-elevated/60 px-3 py-3"
              >
                <div className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-full bg-surface-strong font-mono text-[11px] font-semibold text-muted">
                    {index + 1}
                  </span>
                  <span className="font-display text-sm font-semibold text-ink">
                    {displayName}
                  </span>
                  <StateBadge tone="validated" dot={false}>
                    Community
                  </StateBadge>
                  {secondMission ? (
                    <StateBadge tone="approval" dot={false}>
                      Second mission
                    </StateBadge>
                  ) : null}
                  <StateBadge
                    tone={ready ? "fixed" : enabled ? "validated" : "inconclusive"}
                    dot={false}
                  >
                    {ready
                      ? "Ready"
                      : enabled
                        ? "Enabled"
                        : install === "Installed"
                          ? "Installed"
                          : state === "accept_license"
                            ? "License"
                            : match
                              ? "Needs action"
                              : "Not in catalog"}
                  </StateBadge>
                </div>
                <p className="text-[12px] text-muted">
                  {title}
                  {" · "}
                  <span className="font-mono text-ink">{install}</span>
                  {match?.tool.governance.enabled
                    ? " · policy-enabled"
                    : " · not enabled"}
                </p>
                {match ? (
                  <div className="flex flex-wrap gap-2">
                    {state === "accept_license" ? (
                      <button
                        type="button"
                        className={buttonClassName({
                          size: "sm",
                          variant: "primary"
                        })}
                        onClick={() => setLicenseTarget(match.tool)}
                      >
                        Accept license
                      </button>
                    ) : null}
                    {state === "install" || state === "failed" ? (
                      <button
                        type="button"
                        className={buttonClassName({
                          size: "sm",
                          variant: "primary"
                        })}
                        disabled={Boolean(busy[match.tool.tool.tool.toolId])}
                        onClick={() =>
                          void run(match.tool.tool.tool.toolId, () =>
                            api.installThirdPartyTool(match.tool.tool.tool.toolId)
                          )
                        }
                      >
                        Install from pin
                      </button>
                    ) : null}
                    {state === "enable" ? (
                      <button
                        type="button"
                        className={buttonClassName({
                          size: "sm",
                          variant: "primary"
                        })}
                        disabled={Boolean(busy[match.tool.tool.tool.toolId])}
                        onClick={() =>
                          void run(match.tool.tool.tool.toolId, () =>
                            api.enableThirdPartyTool(match.tool.tool.tool.toolId)
                          )
                        }
                      >
                        Enable under policy
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={buttonClassName({
                        size: "sm",
                        variant: "secondary"
                      })}
                      onClick={() => {
                        setHighlightId(match.tool.tool.tool.toolId);
                        setQuery(match.tool.tool.tool.displayName);
                        setLane("all");
                      }}
                    >
                      Show in catalog
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-subtle">
                    Not listed for this tenant yet — runner or catalog path.
                  </p>
                )}
              </li>
            );
          })}
        </ol>
        {FIRST_PARTY_COMMUNITY_COUNT > 0 ? (
          <p className="mt-3 text-[12px] text-muted">
            First-party DNS/TLS/HTTP checks start from Validate — no Engine Lab
            install. {FIRST_PARTY_COMMUNITY_COUNT} modules.
          </p>
        ) : null}
      </section>

      <section
        aria-labelledby="copyleft-opt-in-heading"
        className="rounded-card border border-line bg-surface px-4 py-4"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="max-w-2xl">
            <p className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">
              You accept the license
            </p>
            <h2
              id="copyleft-opt-in-heading"
              className="mt-1 font-display text-base font-semibold text-ink"
            >
              GPL / LGPL engines
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              {COPYLEFT_OPT_IN_VALUE_LINE}
            </p>
          </div>
          <div className="text-right">
            <button
              type="button"
              data-testid="add-copyleft-pack"
              className={buttonClassName({ size: "sm", variant: "primary" })}
              disabled={copyleftBusy}
              onClick={() => setCopyleftSheetOpen(true)}
            >
              {copyleftBusy
                ? "Adding copyleft engines…"
                : "Review licenses & add"}
            </button>
          </div>
        </div>
        <ol className="mt-4 grid gap-2 sm:grid-cols-2">
          {COPYLEFT_OPT_IN_SUITE.map((entry) => {
            const match = all.find(
              (tool) => tool.tool.tool.toolId === entry.toolId
            );
            const licensed = match
              ? hasLicenseForPin(match, acceptanceRows)
              : false;
            return (
              <li
                key={entry.toolId}
                className="flex flex-col gap-1 rounded-control border border-line bg-elevated/60 px-3 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-sm font-semibold text-ink">
                    {match?.tool.tool.displayName ?? entry.title}
                  </span>
                  <StateBadge tone="approval" dot={false}>
                    {entry.toolLicense}
                  </StateBadge>
                  <StateBadge
                    tone={licensed ? "fixed" : "inconclusive"}
                    dot={false}
                  >
                    {licensed ? "License accepted" : "Needs accept"}
                  </StateBadge>
                </div>
                <p className="text-[12px] text-muted">{entry.title}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <SecurityCatalogManager
        acceptances={acceptanceRows}
        busy={busy}
        onBusy={(toolId, value) =>
          setBusy((current) => ({ ...current, [toolId]: value }))
        }
        onError={setActionError}
        onRefresh={refetchAll}
        tools={all}
      />

      <div
        role="note"
        className="rounded-card border border-brand/30 bg-brand/5 px-4 py-3 text-sm text-muted"
      >
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">
          License honesty
        </p>
        <p className="mt-1 leading-relaxed">
          GPL/LGPL engines are{" "}
          <strong className="font-semibold text-ink">
            not redistributed by Periscan
          </strong>
          . Use Review licenses & add to accept each SPDX and download the
          official pin yourself. They are not Community-start. Atomic, Caldera,
          SharpHound, sqlmap, and Metasploit stay catalog-only.
        </p>
      </div>

      {/* P01-14: marketplace first — developer studio is Labs/admin, collapsed */}
      {all.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <SummaryTile label="Catalog" value={summary.total} tone="brand" />
          <SummaryTile label="Enabled" value={summary.enabled} tone="fixed" />
          <SummaryTile
            label="Installed"
            value={summary.installed}
            tone="validated"
          />
          <SummaryTile
            label="License action"
            value={summary.licenseAction}
            tone="approval"
          />
          <SummaryTile label="Ready" value={summary.ready} tone="fixed" />
        </div>
      ) : null}

      {actionError ? (
        <div
          role="alert"
          className="rounded-control border border-missed/40 bg-missed/10 px-3 py-2 text-sm text-missed"
        >
          {actionError}
        </div>
      ) : null}

      <section
        aria-labelledby="platform-evidence-packs-heading"
        className="border-y border-line py-5"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="max-w-3xl">
            <p className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-2">
              Validation depth
            </p>
            <h2
              className="mt-1 font-display text-base font-semibold text-ink"
              id="platform-evidence-packs-heading"
            >
              Evidence-producing validation modules
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Depth modules on this tenant. Community-startable rows are
              labeled. The rest are not the Community validation pack.
            </p>
          </div>
          <Link className="text-xs font-semibold text-brand" href="/missions">
            Run from a verified scope →
          </Link>
        </div>

        {modules.loading ? (
          <div className="mt-4">
            <LoadingSkeleton rows={3} />
          </div>
        ) : modules.error ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted">
            <span>Evidence pack registry is temporarily unavailable.</span>
            <button
              className={buttonClassName({ size: "sm", variant: "secondary" })}
              onClick={() => void modules.refetch()}
              type="button"
            >
              Retry registry
            </button>
          </div>
        ) : platformEvidencePacks.length === 0 ? (
          <p className="mt-4 text-xs text-muted">
            No platform-specific evidence packs are registered in this
            deployment.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-t border-line">
            {platformEvidencePacks.map((module) => (
              <li
                className="grid gap-2 py-4 md:grid-cols-[minmax(12rem,0.7fr)_minmax(0,1.3fr)_auto] md:items-start md:gap-6"
                key={module.moduleId}
              >
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-ink">
                    {module.name}
                  </h3>
                  <p className="mt-1 break-all font-mono text-[10px] text-subtle">
                    {module.moduleId}
                  </p>
                </div>
                <p className="text-xs leading-5 text-muted">
                  {module.customerVisibleDescription}
                </p>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <StateBadge
                    tone={
                      isCommunityValidationModuleId(module.moduleId)
                        ? "validated"
                        : "inconclusive"
                    }
                    dot={false}
                  >
                    {isCommunityValidationModuleId(module.moduleId)
                      ? "Community"
                      : "Not Community"}
                  </StateBadge>
                  <StateBadge tone="fixed" dot={false}>
                    {module.status}
                  </StateBadge>
                  <StateBadge tone="validated" dot={false}>
                    {module.safetyLevel}
                  </StateBadge>
                  {module.liveSupported ? (
                    <StateBadge tone="fixed" dot={false}>
                      Live supported
                    </StateBadge>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search engines, licenses, capabilities…"
          aria-label="Search engines by name or license"
          className="min-w-0 flex-1 rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none placeholder:text-subtle focus:border-line-strong focus-visible:ring-2 focus-visible:ring-brand md:max-w-xs"
        />
        <label className="flex items-center gap-1.5 rounded-control border border-line bg-surface pl-3 pr-1.5 text-sm">
          <span className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
            Category
          </span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Filter by category"
            className="bg-transparent py-1.5 text-sm text-ink outline-none"
          >
            <option value="all">All</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-1.5" aria-label="Engine lanes">
        {(
          [
            ["all", "All"],
            ["community", "Community"],
            ["legal_review", "Legal review"],
            ["theater", "Catalog only"],
            ["ready", "Ready"],
            ["needs_install", "Needs install"],
            ["license_action", "License action"],
            ["enabled", "Enabled"],
            ["blocked", "Not available"]
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={lane === id}
            onClick={() => setLane(id)}
            className={cn(
              "rounded-control border px-3 py-1 font-display text-[11px] font-semibold uppercase tracking-[0.08em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
              lane === id
                ? "border-brand bg-brand/15 text-brand"
                : "border-line bg-surface text-subtle hover:border-line-strong hover:text-ink"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tools.loading || acceptances.loading ? (
        <Panel>
          <LoadingSkeleton rows={6} />
        </Panel>
      ) : tools.error ? (
        <Panel>
          <ErrorState message={tools.error} onRetry={tools.refetch} />
        </Panel>
      ) : all.length === 0 ? (
        <Panel>
          <div className="p-4">
            <NotConfigured
              title="No governed engines available"
              message="The third-party tool catalog is empty for this tenant."
            />
          </div>
        </Panel>
      ) : filtered.length === 0 ? (
        <Panel>
          <div className="p-4 text-sm text-muted">
            No engines match this filter. Try another lane or clear search.
          </div>
        </Panel>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(({ tool, state, licensed, honesty }) => (
            <ToolCard
              key={tool.tool.tool.toolId}
              tool={tool}
              state={state}
              honesty={honesty}
              licensed={licensed}
              highlighted={highlightId === tool.tool.tool.toolId}
              busy={!!busy[tool.tool.tool.toolId]}
              onCheck={() =>
                run(tool.tool.tool.toolId, () =>
                  api.checkThirdPartyTool(tool.tool.tool.toolId)
                )
              }
              onInstall={() =>
                run(tool.tool.tool.toolId, async () => {
                  const job = await api.installThirdPartyTool(
                    tool.tool.tool.toolId
                  );
                  if (job.status === "Denied") {
                    throw new Error(
                      job.reason ??
                        "Install denied. Accept the license first if this engine requires legal review."
                    );
                  }
                })
              }
              onAcceptLicense={() => setLicenseTarget(tool)}
              onEnable={() =>
                run(tool.tool.tool.toolId, () =>
                  api.enableThirdPartyTool(
                    tool.tool.tool.toolId,
                    "Enabled from Engine Lab"
                  )
                )
              }
              onDisable={() =>
                run(tool.tool.tool.toolId, () =>
                  api.disableThirdPartyTool(
                    tool.tool.tool.toolId,
                    "Disabled from Engine Lab"
                  )
                )
              }
            />
          ))}
        </div>
      )}

      {licenseTarget ? (
        <LicenseAcceptanceSheet
          tool={licenseTarget}
          busy={!!busy[licenseTarget.tool.tool.toolId]}
          error={actionError}
          onCancel={() => setLicenseTarget(null)}
          onAcceptOnly={() => void acceptAndMaybeInstall(licenseTarget, false)}
          onAcceptAndInstall={() =>
            void acceptAndMaybeInstall(licenseTarget, true)
          }
        />
      ) : null}

      {copyleftSheetOpen ? (
        <CopyleftPackSheet
          engines={COPYLEFT_OPT_IN_SUITE.map((entry) => ({
            license: entry.toolLicense,
            title: entry.title,
            toolId: entry.toolId,
            match:
              all
                .filter((tool) => tool.tool.tool.toolId === entry.toolId)
                .map((tool) => ({ tool }))[0] ?? null
          }))}
          busy={copyleftBusy}
          error={actionError}
          onCancel={() => setCopyleftSheetOpen(false)}
          onAcceptAndInstall={() => void loadCopyleftPack()}
        />
      ) : null}

      {/* P01-14: builder chrome last — operators enable engines above first */}
      <details className="rounded-card border border-dashed border-line bg-surface/30 px-4 py-3">
        <summary className="cursor-pointer font-display text-sm font-semibold text-muted">
          Labs · Extension developer studio
        </summary>
        <p className="mt-2 text-xs text-subtle">
          For package authors. Daily operators use the Engine Lab marketplace
          catalog above for install, enable, and certification.
        </p>
        <div className="mt-3">
          <ExtensionDeveloperStudio />
        </div>
      </details>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: StateTone;
}) {
  return (
    <div className="relative overflow-hidden rounded-card border border-line bg-surface p-3.5">
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: `var(--color-${tone})` }}
      />
      <p className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
        {label}
      </p>
      <p
        className="mt-1 font-mono text-2xl font-semibold"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </p>
    </div>
  );
}

function ToolCard({
  tool,
  state,
  honesty,
  licensed,
  highlighted,
  busy,
  onCheck,
  onInstall,
  onAcceptLicense,
  onEnable,
  onDisable
}: {
  tool: ThirdPartyTool;
  state: EngineCardState;
  honesty: EngineLabHonesty;
  licensed: boolean;
  highlighted: boolean;
  busy: boolean;
  onCheck: () => void;
  onInstall: () => void;
  onAcceptLicense: () => void;
  onEnable: () => void;
  onDisable: () => void;
}) {
  const def = tool.tool.tool;
  const gov = tool.governance;
  const install = tool.runtimeInstallation;
  const counts = tool.tool.capabilityCounts;
  const lastJob = tool.recentJobs[0];
  const legalReview = needsLicenseAcceptance(tool);

  const primary =
    state === "accept_license"
      ? {
          label: "Accept license & install",
          onClick: onAcceptLicense,
          disabled: busy
        }
      : state === "install" || state === "failed"
        ? {
            label: state === "failed" ? "Retry install" : "Install from upstream",
            onClick: onInstall,
            disabled: busy
          }
        : state === "installing"
          ? {
              label: "Installing…",
              onClick: onCheck,
              disabled: true
            }
          : state === "enable"
            ? {
                label: "Enable for tenant",
                onClick: onEnable,
                disabled: busy
              }
            : state === "enabled" && honesty.communityStartable
              ? {
                  label: "Use in mission",
                  onClick: () => {
                    window.location.href = "/missions";
                  },
                  disabled: false
                }
              : state === "enabled" && isCopyleftOptInToolId(def.toolId)
                ? {
                    label: "Use extra engine on Validate",
                    onClick: () => {
                      window.location.href = "/missions?includeCopyleftOptIn=1";
                    },
                    disabled: false
                  }
              : state === "enabled"
                ? {
                    label: "Not Community validation",
                    onClick: () => undefined,
                    disabled: true
                  }
              : state === "blocked"
                ? {
                    label: "Not available",
                    onClick: () => undefined,
                    disabled: true
                  }
                : {
                    label: "Check readiness",
                    onClick: onCheck,
                    disabled: busy
                  };

  return (
    <Panel
      className={cn(
        "flex flex-col transition",
        highlighted && "ring-2 ring-brand/60"
      )}
      data-tool-id={def.toolId}
    >
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              className={cn(
                "font-display text-[10px] font-semibold uppercase tracking-[0.08em]",
                honesty.class === "community" ? "text-brand-2" : "text-subtle"
              )}
            >
              {honesty.label}
              {honesty.secondMission ? " · second mission" : ""}
            </p>
            <h3 className="truncate font-display text-[15px] font-semibold text-ink">
              {def.displayName}
            </h3>
            <p className="mt-0.5 font-mono text-[11px] text-subtle">
              {def.toolId} · v{gov.pinnedVersion}
            </p>
          </div>
          <StateBadge
            tone={GOVERNANCE_TONE[gov.status] ?? "neutral"}
            dot={false}
          >
            {gov.status === "LegalReviewRequired"
              ? licensed
                ? "License accepted"
                : "License action"
              : gov.status}
          </StateBadge>
        </div>

        <p className="line-clamp-2 text-[12.5px] text-muted">{def.notes}</p>

        <div className="flex flex-wrap gap-1.5">
          <StateBadge
            tone={INSTALL_TONE[install.installStatus] ?? "neutral"}
            dot={false}
          >
            {install.installStatus}
          </StateBadge>
          {legalReview && !honesty.communityStartable ? (
            <StateBadge tone={licensed ? "fixed" : "approval"} dot={false}>
              {licensed ? "License ok" : "License action"}
            </StateBadge>
          ) : null}
        </div>
        <p className="text-[11.5px] text-muted">{honesty.hint}</p>
        <details className="text-[11px] text-subtle">
          <summary className="cursor-pointer font-mono uppercase tracking-wide">
            {def.category} · {def.license}
          </summary>
          <p className="mt-1">
            Policy {def.policyStatus} · readiness {tool.tool.readiness}
            {legalReview ? " · not redistributed by Periscan" : ""}
          </p>
        </details>

        <p className="font-mono text-[11px] text-subtle">
          {counts.total} capabilit{counts.total === 1 ? "y" : "ies"} ·{" "}
          {counts.implemented} ready
          {install.runtimeKind ? ` · runtime ${install.runtimeKind}` : ""}
        </p>

        {lastJob ? (
          <p className="flex items-center gap-1.5 font-mono text-[11px] text-subtle">
            last {lastJob.action.toLowerCase()}:
            <StateBadge
              tone={JOB_TONE[lastJob.status] ?? "neutral"}
              dot={false}
            >
              {lastJob.status}
            </StateBadge>
            {relTime(lastJob.createdAt)}
          </p>
        ) : null}

        {legalReview && !licensed && honesty.class !== "theater" ? (
          <p className="text-[11.5px] text-approval">
            Upstream license acceptance required before install. Not included in
            the default Periscan image.
          </p>
        ) : null}
        {gov.disabledReason && state === "blocked" ? (
          <p className="text-[11.5px] text-missed">{gov.disabledReason}</p>
        ) : null}
      </div>

      <div className="mt-auto flex flex-wrap gap-2 border-t border-line p-3">
        <button
          type="button"
          onClick={primary.onClick}
          disabled={primary.disabled}
          className={buttonClassName({
            size: "sm",
            variant: state === "blocked" ? "secondary" : "primary"
          })}
        >
          {busy ? "Working…" : primary.label}
        </button>
        <button
          type="button"
          onClick={onCheck}
          disabled={busy}
          className={buttonClassName({ size: "sm", variant: "secondary" })}
        >
          Check
        </button>
        {state === "enabled" ? (
          <button
            type="button"
            onClick={onDisable}
            disabled={busy}
            className={cn(
              buttonClassName({ size: "sm", variant: "secondary" }),
              "text-missed"
            )}
          >
            Disable
          </button>
        ) : null}
        {state === "accept_license" ? (
          <button
            type="button"
            onClick={onAcceptLicense}
            disabled={busy}
            className={buttonClassName({ size: "sm", variant: "secondary" })}
          >
            Review license
          </button>
        ) : null}
        {state === "install" || state === "enable" || state === "failed" ? (
          <button
            type="button"
            onClick={onInstall}
            disabled={busy || state === "enable"}
            title={
              state === "enable"
                ? "Already installed — enable for tenant"
                : undefined
            }
            className={buttonClassName({ size: "sm", variant: "secondary" })}
          >
            {state === "enable" ? "Installed" : "Install"}
          </button>
        ) : null}
        {state === "enable" ? (
          <button
            type="button"
            onClick={onEnable}
            disabled={busy}
            className={buttonClassName({ size: "sm", variant: "secondary" })}
          >
            Enable
          </button>
        ) : null}
      </div>
    </Panel>
  );
}

function LicenseAcceptanceSheet({
  tool,
  busy,
  error,
  onCancel,
  onAcceptOnly,
  onAcceptAndInstall
}: {
  tool: ThirdPartyTool;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onAcceptOnly: () => void;
  onAcceptAndInstall: () => void;
}) {
  const def = tool.tool.tool;
  const pin = tool.governance.pinnedVersion || def.defaultVersion;
  const titleId = useId();
  const descId = useId();
  const [authorized, setAuthorized] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useFocusTrap({
    open: true,
    containerRef,
    onEscape: () => {
      if (!busy) onCancel();
    },
    initialFocusRef: cancelRef
  });

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <div
        className="absolute inset-0 bg-black/55"
        onClick={() => !busy && onCancel()}
        aria-hidden
      />
      <div className="relative w-full max-w-lg overflow-hidden rounded-card border border-line-strong bg-surface shadow-[0_24px_64px_rgba(0,0,0,0.55)] motion-safe:animate-[ps-modal_220ms_ease-out]">
        <div className="border-b border-line-panel bg-surface-strong px-5 py-3.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
            License ceremony
          </p>
          <h2
            id={titleId}
            className="mt-1 text-base font-semibold text-ink"
          >
            Accept {def.displayName} · {def.license}
          </h2>
        </div>
        <div className="space-y-4 p-5">
          <p id={descId} className="text-sm leading-relaxed text-muted">
            This tool is <strong className="text-ink">not redistributed</strong>{" "}
            by Periscan. Installing downloads it from the project&apos;s official
            upstream under <span className="font-mono text-ink">{def.license}</span>{" "}
            for pin{" "}
            <span className="font-mono text-ink">v{pin}</span>. You accept that
            license for your organization. Periscan safety gates still apply
            after install.
          </p>

          <dl className="grid gap-2 rounded-control border border-line bg-surface/40 px-3 py-2 font-mono text-[11px] text-subtle sm:grid-cols-2">
            <div>
              <dt className="uppercase tracking-[0.08em]">SPDX</dt>
              <dd className="text-ink">{def.license}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-[0.08em]">Pin</dt>
              <dd className="text-ink">{pin}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="uppercase tracking-[0.08em]">Upstream docs</dt>
              <dd>
                <a
                  href={def.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-brand underline-offset-2 hover:underline"
                >
                  {def.docsUrl}
                </a>
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="uppercase tracking-[0.08em]">Safety class</dt>
              <dd className="text-ink">
                {tool.tool.readiness} · {def.policyStatus}
              </dd>
            </div>
          </dl>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-control border border-line bg-surface/30 px-3 py-2.5 text-sm text-ink">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={authorized}
              disabled={busy}
              onChange={(e) => setAuthorized(e.target.checked)}
            />
            <span>
              I am authorized to accept third-party open-source licenses for this
              tenant, and I understand Periscan is not redistributing this package
              as part of the SaaS binary.
            </span>
          </label>

          {error ? (
            <p
              role="alert"
              className="rounded-control border border-missed/40 bg-missed/10 px-3 py-2 text-[13px] text-missed"
            >
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
            <button
              ref={cancelRef}
              type="button"
              onClick={onCancel}
              disabled={busy}
              className={buttonClassName({ size: "sm", variant: "secondary" })}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onAcceptOnly}
              disabled={busy || !authorized}
              className={buttonClassName({ size: "sm", variant: "secondary" })}
            >
              {busy ? "Working…" : "Accept only"}
            </button>
            <button
              type="button"
              onClick={onAcceptAndInstall}
              disabled={busy || !authorized}
              className={buttonClassName({ size: "sm", variant: "primary" })}
            >
              {busy ? "Working…" : "Accept license & install"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

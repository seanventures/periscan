"use client";

import { useMemo, useState } from "react";

import {
  classifyEngineLabHonesty,
  isEngineLabTheaterToolId,
  listSecurityCatalogPacks,
  type OpenSourceToolId,
  type ThirdPartyTool,
  type ToolLicenseAcceptance
} from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import {
  StateBadge,
  buttonClassName,
  cn,
  type StateTone
} from "../ui";

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

export function SecurityCatalogManager({
  tools,
  acceptances,
  busy,
  onBusy,
  onError,
  onRefresh
}: {
  tools: ThirdPartyTool[];
  acceptances: ToolLicenseAcceptance[];
  busy: Record<string, boolean>;
  onBusy: (toolId: string, value: boolean) => void;
  onError: (message: string | null) => void;
  onRefresh: () => Promise<void>;
}) {
  const packs = useMemo(() => listSecurityCatalogPacks(), []);
  const [openPack, setOpenPack] = useState<string>(packs[0]?.packId ?? "secrets");
  const [packBusy, setPackBusy] = useState(false);
  const byId = useMemo(
    () => new Map(tools.map((tool) => [tool.tool.tool.toolId, tool])),
    [tools]
  );

  const open = packs.find((pack) => pack.packId === openPack) ?? packs[0];

  function isInstalled(tool: ThirdPartyTool | undefined) {
    const status = tool?.runtimeInstallation.installStatus;
    return status === "Installed" || status === "Available";
  }

  function canOneClickInstall(tool: ThirdPartyTool | undefined, toolId: string) {
    if (!tool || isEngineLabTheaterToolId(toolId)) return false;
    const honesty = classifyEngineLabHonesty({
      governanceStatus: tool.governance.status,
      moduleIds: tool.tool.tool.moduleIds,
      policyStatus: tool.tool.tool.policyStatus,
      toolId
    });
    if (honesty.class === "theater") return false;
    const needsLicense = tool.tool.tool.policyStatus === "RequiresLegalReview";
    if (needsLicense) {
      return acceptances.some((row) => row.toolId === toolId);
    }
    return true;
  }

  async function run(toolId: OpenSourceToolId, fn: () => Promise<unknown>) {
    onBusy(toolId, true);
    onError(null);
    try {
      await fn();
      await onRefresh();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Catalog action failed.");
    } finally {
      onBusy(toolId, false);
    }
  }

  async function installOpenPack() {
    if (!open) return;
    setPackBusy(true);
    onError(null);
    const failures: string[] = [];
    try {
      for (const toolId of open.toolIds) {
        const tool = byId.get(toolId);
        if (!canOneClickInstall(tool, toolId) || isInstalled(tool)) continue;
        try {
          const job = await api.installThirdPartyTool(toolId);
          if (job.status === "Denied" || job.status === "Failed") {
            failures.push(`${toolId}: ${job.reason ?? job.status}`);
          }
        } catch (error) {
          failures.push(
            `${toolId}: ${error instanceof Error ? error.message : "failed"}`
          );
        }
      }
      await onRefresh();
      if (failures.length > 0) {
        onError(
          `Pack install finished with ${failures.length} issue(s): ${failures.slice(0, 4).join("; ")}`
        );
      }
    } finally {
      setPackBusy(false);
    }
  }

  async function uninstallOpenPack() {
    if (!open) return;
    setPackBusy(true);
    onError(null);
    const failures: string[] = [];
    try {
      for (const toolId of open.toolIds) {
        const tool = byId.get(toolId);
        if (!tool || !isInstalled(tool) || isEngineLabTheaterToolId(toolId)) {
          continue;
        }
        try {
          await api.uninstallThirdPartyTool(toolId);
        } catch (error) {
          failures.push(
            `${toolId}: ${error instanceof Error ? error.message : "failed"}`
          );
        }
      }
      await onRefresh();
      if (failures.length > 0) {
        onError(
          `Pack uninstall finished with ${failures.length} issue(s): ${failures.slice(0, 4).join("; ")}`
        );
      }
    } finally {
      setPackBusy(false);
    }
  }

  const openInstallable = open
    ? open.toolIds.filter((toolId) =>
        canOneClickInstall(byId.get(toolId), toolId)
      )
    : [];
  const openInstalled = open
    ? open.toolIds.filter((toolId) => isInstalled(byId.get(toolId)))
    : [];

  return (
    <section
      aria-labelledby="security-catalog-heading"
      className="rounded-card border border-line bg-surface px-4 py-4"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <p className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">
            Package manager
          </p>
          <h2
            id="security-catalog-heading"
            className="mt-1 font-display text-base font-semibold text-ink"
          >
            Security tool catalog
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            {packs.reduce((sum, pack) => sum + pack.toolIds.length, 0)}+ listings
            across {packs.length} packs. Permissive SPDX tools install without a
            ceremony. GPL/LGPL/AGPL tools need Accept license first. Theater
            engines stay non-installable.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5" role="tablist">
        {packs.map((pack) => {
          const installed = pack.toolIds.filter((toolId) => {
            const tool = byId.get(toolId);
            return (
              tool?.runtimeInstallation.installStatus === "Installed" ||
              tool?.runtimeInstallation.installStatus === "Available"
            );
          }).length;
          return (
            <button
              key={pack.packId}
              type="button"
              role="tab"
              aria-selected={open?.packId === pack.packId}
              onClick={() => setOpenPack(pack.packId)}
              className={cn(
                "rounded-control border px-3 py-1 font-display text-[11px] font-semibold uppercase tracking-[0.08em]",
                open?.packId === pack.packId
                  ? "border-brand bg-brand/15 text-brand"
                  : "border-line bg-surface text-subtle hover:text-ink"
              )}
            >
              {pack.title} {installed}/{pack.toolIds.length}
            </button>
          );
        })}
      </div>
      {open ? (
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">{open.description}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                data-testid="install-open-pack"
                className={buttonClassName({ size: "sm", variant: "primary" })}
                disabled={packBusy || openInstallable.length === 0}
                onClick={() => void installOpenPack()}
              >
                {packBusy
                  ? "Working…"
                  : `Install pack (${openInstallable.filter((id) => !isInstalled(byId.get(id))).length} ready)`}
              </button>
              <button
                type="button"
                data-testid="uninstall-open-pack"
                className={buttonClassName({ size: "sm", variant: "secondary" })}
                disabled={packBusy || openInstalled.length === 0}
                onClick={() => void uninstallOpenPack()}
              >
                Uninstall pack
              </button>
            </div>
          </div>
          <ul className="mt-3 divide-y divide-line border-t border-line">
            {open.toolIds.map((toolId) => {
              const tool = byId.get(toolId);
              const honesty = tool
                ? classifyEngineLabHonesty({
                    governanceStatus: tool.governance.status,
                    moduleIds: tool.tool.tool.moduleIds,
                    policyStatus: tool.tool.tool.policyStatus,
                    toolId
                  })
                : null;
              const install =
                tool?.runtimeInstallation.installStatus ?? "NotInstalled";
              const licensed = acceptances.some((row) => row.toolId === toolId);
              const needsLicense =
                tool?.tool.tool.policyStatus === "RequiresLegalReview";
              return (
                <li
                  key={`${open.packId}-${toolId}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="font-display text-sm font-semibold text-ink">
                      {tool?.tool.tool.displayName ?? toolId}
                    </p>
                    <p className="font-mono text-[11px] text-subtle">
                      {toolId}
                      {tool ? ` · ${tool.tool.tool.license}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {honesty ? (
                      <StateBadge
                        tone={
                          honesty.class === "community"
                            ? "validated"
                            : honesty.class === "legal_review"
                              ? "approval"
                              : "inconclusive"
                        }
                        dot={false}
                      >
                        {honesty.label}
                      </StateBadge>
                    ) : (
                      <StateBadge tone="inconclusive" dot={false}>
                        Catalog
                      </StateBadge>
                    )}
                    <StateBadge
                      tone={INSTALL_TONE[install] ?? "inconclusive"}
                      dot={false}
                    >
                      {install}
                    </StateBadge>
                    {tool && honesty?.class !== "theater" ? (
                      <>
                        {needsLicense && !licensed ? (
                          <span className="text-[11px] text-muted">
                            Accept license on the card below
                          </span>
                        ) : install === "Installed" ||
                          install === "Available" ? (
                          <button
                            type="button"
                            className={buttonClassName({
                              size: "sm",
                              variant: "secondary"
                            })}
                            disabled={Boolean(busy[toolId])}
                            onClick={() =>
                              void run(toolId, () =>
                                api.uninstallThirdPartyTool(toolId)
                              )
                            }
                          >
                            Uninstall
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={buttonClassName({
                              size: "sm",
                              variant: "primary"
                            })}
                            disabled={Boolean(busy[toolId])}
                            onClick={() =>
                              void run(toolId, async () => {
                                const job = await api.installThirdPartyTool(toolId);
                                if (job.status === "Denied") {
                                  throw new Error(
                                    job.reason ??
                                      "Install denied. Accept the license first if this is copyleft."
                                  );
                                }
                              })
                            }
                          >
                            Install
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-[11px] text-subtle">
                        Not installable
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

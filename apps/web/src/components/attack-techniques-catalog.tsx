"use client";

import { useEffect, useState } from "react";

import type {
  AttackTechnique,
  ControlRuleCoverageSummary,
  DetectionRuleCoverageItem
} from "@periscan/shared";
import {
  SAFE_STAGE_PLAYBOOKS,
  listExecutableSafeStages,
  listForbiddenSafeStages
} from "@periscan/shared";

import {
  browserPeriscanApiClient,
  PeriscanApiClientError
} from "../lib/periscan-api-client";
import {
  Badge,
  Card,
  DegradedBanner,
  DistributionChart,
  StateBadge
} from "../ui";
import { ControlCoverageBadge } from "./control-coverage-badges";
import { StatusPanel } from "./status-panel";

type LoadStatus = "loading" | "authenticated" | "unauthenticated" | "error";

interface TacticGroup {
  tacticId: string;
  tacticName: string;
  techniques: AttackTechnique[];
}

function groupByTactic(techniques: AttackTechnique[]): TacticGroup[] {
  const groups = new Map<string, TacticGroup>();

  for (const technique of techniques) {
    const existing = groups.get(technique.tacticId);

    if (existing) {
      existing.techniques.push(technique);
    } else {
      groups.set(technique.tacticId, {
        tacticId: technique.tacticId,
        tacticName: technique.tacticName,
        techniques: [technique]
      });
    }
  }

  return [...groups.values()].sort((left, right) =>
    left.tacticId.localeCompare(right.tacticId)
  );
}

export function AttackTechniquesCatalog({
  initialTechniqueId = ""
}: {
  initialTechniqueId?: string;
}) {
  const [techniques, setTechniques] = useState<AttackTechnique[]>([]);
  const [coverage, setCoverage] = useState<ControlRuleCoverageSummary | null>(
    null
  );
  const [coverageError, setCoverageError] = useState(false);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoadStatus("loading");

    void browserPeriscanApiClient
      .getMe()
      .then(async () => {
        const [catalogResult, coverageResult] = await Promise.allSettled([
          browserPeriscanApiClient.listAttackTechniques(),
          browserPeriscanApiClient.getControlRuleCoverage()
        ]);

        if (catalogResult.status === "rejected") {
          throw catalogResult.reason;
        }

        return { coverageResult, items: catalogResult.value };
      })
      .then(({ coverageResult, items }) => {
        if (active) {
          setTechniques(items);
          if (coverageResult.status === "fulfilled") {
            setCoverage(coverageResult.value);
            setCoverageError(false);
          } else {
            setCoverage(null);
            setCoverageError(true);
          }
          setLoadStatus("authenticated");
        }
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        if (error instanceof PeriscanApiClientError && error.status === 401) {
          setLoadStatus("unauthenticated");
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load the ATT&CK technique catalog."
        );
        setLoadStatus("error");
      });

    return () => {
      active = false;
    };
  }, []);

  if (loadStatus === "loading") {
    return (
      <StatusPanel
        body="Reading Periscan's curated safe-example ATT&CK reference and this tenant's control coverage."
        eyebrow="ATT&CK techniques"
        kind="loading"
        title="Loading the technique catalog."
      />
    );
  }

  if (loadStatus === "unauthenticated") {
    return (
      <StatusPanel
        body="The ATT&CK technique catalog is available to authenticated tenants. Sign in from the workspace to review the techniques Periscan maps evidence to."
        eyebrow="ATT&CK techniques"
        kind="info"
        title="Sign in to review the ATT&CK catalog."
      />
    );
  }

  if (loadStatus === "error") {
    return (
      <StatusPanel
        body={errorMessage ?? "The ATT&CK technique catalog is unavailable."}
        eyebrow="ATT&CK techniques"
        kind="error"
        title="Unable to load the technique catalog."
      />
    );
  }

  const visibleTechniques = initialTechniqueId
    ? techniques.filter(
        (technique) => technique.techniqueId === initialTechniqueId
      )
    : techniques;
  const groups = groupByTactic(visibleTechniques);
  const distribution = groups.map((group) => ({
    id: group.tacticId,
    label: group.tacticName,
    value: group.techniques.length
  }));
  const safeExampleCount = techniques.filter(
    (technique) => technique.safeExample
  ).length;
  const coverageByTechnique = new Map<string, DetectionRuleCoverageItem[]>();
  for (const item of coverage?.items ?? []) {
    const current = coverageByTechnique.get(item.techniqueId) ?? [];
    current.push(item);
    coverageByTechnique.set(item.techniqueId, current);
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="ATT&CK catalog metrics"
      >
        <div className="flex flex-col gap-1 rounded-card border border-line bg-surface p-4">
          <span className="text-sm text-muted">Curated techniques</span>
          <strong
            className="text-2xl font-semibold text-ink"
            role="status"
            aria-label={`Mapped technique count: ${techniques.length}`}
          >
            {techniques.length}
          </strong>
        </div>
        <div className="flex flex-col gap-1 rounded-card border border-line bg-surface p-4">
          <span className="text-sm text-muted">Tactics represented</span>
          <strong
            className="text-2xl font-semibold text-ink"
            role="status"
            aria-label={`Tactics covered count: ${groups.length}`}
          >
            {groups.length}
          </strong>
        </div>
        <div className="flex flex-col gap-1 rounded-card border border-line bg-surface p-4">
          <span className="text-sm text-muted">Safe-example mappings</span>
          <strong
            className="text-2xl font-semibold text-ink"
            role="status"
            aria-label={`Safe-example mapping count: ${safeExampleCount}`}
          >
            {safeExampleCount}
          </strong>
        </div>
        <div className="flex flex-col gap-1 rounded-card border border-line bg-surface p-4">
          <span className="text-sm text-muted">Tenant techniques measured</span>
          <strong
            className="text-2xl font-semibold text-ink"
            role="status"
            aria-label={`Tenant techniques measured count: ${coverageByTechnique.size}`}
          >
            {coverage ? coverageByTechnique.size : "—"}
          </strong>
        </div>
      </div>

      {/* P05-17: technique-mapped safe-stage playbooks */}
      <section
        aria-label="Safe-stage measurement playbooks"
        className="rounded-card border border-line bg-surface p-4"
      >
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">
              Safe-stage playbooks
            </p>
            <h2 className="mt-1 text-base font-semibold text-ink">
              Technique → measurement class (not kill-chain execution)
            </h2>
            <p className="mt-1 max-w-3xl text-[13px] text-muted">
              Each ATT&amp;CK technique maps to Exposure, Detection, Config, or
              Forbidden. Forbidden stages never get a module — schedule human RT
              for those. Executable stages hand off to one default safe module
              with honest success criteria.
            </p>
          </div>
          <span className="font-mono text-[11px] text-subtle">
            {listExecutableSafeStages().length} executable ·{" "}
            {listForbiddenSafeStages().length} forbidden
          </span>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-line font-mono text-[10px] uppercase tracking-[0.08em] text-subtle">
                <th className="px-2 py-2 font-medium">Technique</th>
                <th className="px-2 py-2 font-medium">Class</th>
                <th className="px-2 py-2 font-medium">Playbook</th>
                <th className="px-2 py-2 font-medium">Default module</th>
                <th className="px-2 py-2 font-medium">Success criteria</th>
              </tr>
            </thead>
            <tbody>
              {SAFE_STAGE_PLAYBOOKS.map((playbook) => (
                <tr
                  key={playbook.techniqueId}
                  className="border-b border-line/70 last:border-b-0"
                >
                  <td className="px-2 py-2 align-top">
                    <span className="font-mono text-ink">
                      {playbook.techniqueId}
                    </span>
                    <span className="mt-0.5 block text-muted">
                      {playbook.stage}
                    </span>
                  </td>
                  <td className="px-2 py-2 align-top">
                    <StateBadge
                      tone={
                        playbook.measurementClass === "Forbidden"
                          ? "missed"
                          : playbook.measurementClass === "Detection"
                            ? "blocked"
                            : playbook.measurementClass === "Config"
                              ? "approval"
                              : "validated"
                      }
                      dot={false}
                    >
                      {playbook.measurementClass}
                    </StateBadge>
                  </td>
                  <td className="max-w-xs px-2 py-2 align-top text-ink">
                    <span className="font-medium">{playbook.playbookTitle}</span>
                    <span className="mt-0.5 block text-muted">
                      {playbook.playbookSummary}
                    </span>
                    {playbook.refusalNote ? (
                      <span className="mt-1 block text-[11px] text-approval">
                        {playbook.refusalNote}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 py-2 align-top font-mono text-[11px] text-muted">
                    {playbook.defaultModuleId ?? "—"}
                  </td>
                  <td className="px-2 py-2 align-top font-mono text-[11px] text-muted">
                    {playbook.successCriteria.join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-muted">
        This is the curated ATT&amp;CK subset Periscan can currently map to safe
        validation examples, not the complete MITRE catalog. Tenant coverage
        below comes separately from persisted control observations.
      </p>

      {coverageError ? (
        <DegradedBanner
          rails={["Tenant control coverage"]}
          detail="Empty coverage counts below are degraded, not proof that no techniques were measured. The reference catalog is still usable."
        />
      ) : null}

      {distribution.length ? (
        <Card aria-label="ATT&CK tactic coverage overview">
          <DistributionChart
            title="Reference techniques by tactic"
            ariaLabel="Curated techniques by ATT&CK tactic"
            data={distribution}
            variant="bar"
          />
        </Card>
      ) : null}

      {initialTechniqueId ? (
        <p className="rounded-control border border-brand/30 bg-brand/8 px-3 py-2 text-sm text-muted">
          Showing the curated reference entry for{" "}
          <strong className="font-mono text-ink">{initialTechniqueId}</strong>.{" "}
          <a
            href="/attack-techniques"
            className="text-brand hover:text-brand-2"
          >
            Show all techniques
          </a>
        </p>
      ) : null}

      {groups.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            No curated ATT&amp;CK reference entry matches this filter.
          </p>
        </Card>
      ) : (
        groups.map((group) => (
          <Card key={group.tacticId} className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-base font-semibold text-ink">
                {group.tacticName}
              </h3>
              <Badge
                tone="info"
                role="status"
                aria-label={`${group.tacticName} technique count: ${group.techniques.length}`}
              >
                {group.tacticId} · {group.techniques.length}
              </Badge>
            </div>
            <ul className="flex flex-col gap-2">
              {group.techniques.map((technique) => {
                const coverageItems =
                  coverageByTechnique.get(technique.techniqueId) ?? [];
                const coverageStatuses = [
                  ...new Set(coverageItems.map((item) => item.status))
                ];

                return (
                  <li
                    className="flex flex-col gap-1 rounded-control border border-line bg-surface p-3"
                    key={technique.techniqueId}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-ink">
                        {technique.techniqueId} {technique.techniqueName}
                      </strong>
                      {technique.safeExample ? (
                        <Badge tone="success">Safe example</Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted">
                      {technique.description}
                    </p>
                    {coverage ? (
                      <div
                        aria-label={`${technique.techniqueId} tenant coverage`}
                        className="mt-1 flex flex-wrap items-center gap-2 border-t border-line pt-2"
                      >
                        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-subtle">
                          Tenant coverage
                        </span>
                        {coverageStatuses.length ? (
                          coverageStatuses.map((status) => (
                            <ControlCoverageBadge
                              key={status}
                              status={status}
                            />
                          ))
                        ) : (
                          <StateBadge tone="neutral" dot={false}>
                            No measured scenario
                          </StateBadge>
                        )}
                        <a
                          href="/controls"
                          className="ml-auto text-xs text-brand hover:text-brand-2"
                        >
                          Open controls
                        </a>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Card>
        ))
      )}
    </div>
  );
}

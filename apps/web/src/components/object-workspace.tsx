"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  getOntologyObjectType,
  isRiskRelatedEntityType,
  ontologyEntityHref
} from "@periscan/shared";

import { browserPeriscanApiClient } from "../lib/periscan-api-client";
import {
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  PageShell,
  Panel,
  PanelHeader,
  buttonClassName
} from "../ui";

type GraphNeighborhood = Awaited<
  ReturnType<typeof browserPeriscanApiClient.getObjectWorkspace>
>;

/**
 * Graph neighborhood object workspace (P01-2).
 * Uses PageShell + kit tokens so it matches the dark product console.
 * No nested `<main>` — AppShell owns the sole product main landmark.
 */
export function ObjectWorkspace({
  entityType,
  entityId
}: {
  entityType: string;
  entityId: string;
}) {
  const [data, setData] = useState<GraphNeighborhood | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const ontology = getOntologyObjectType(entityType);
  const isRisk = isRiskRelatedEntityType(entityType);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    if (!isRisk) {
      setLoading(false);
      setError(
        "This entity type is platform-scoped and has no graph object workspace. Use its product surface or audit link."
      );
      return;
    }

    void (async () => {
      try {
        const result = await browserPeriscanApiClient.getObjectWorkspace(
          entityType,
          entityId
        );
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load object workspace."
          );
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [entityType, entityId, isRisk]);

  return (
    <PageShell width="narrow">
      <PageHeader
        eyebrow="Object workspace"
        title={ontology?.label ?? entityType}
        description={
          ontology
            ? `Partition: ${ontology.kind}${
                ontology.graphEligible ? " · graph-eligible" : ""
              }`
            : undefined
        }
        meta={
          <p className="font-mono text-sm text-muted break-all">{entityId}</p>
        }
      />

      {loading ? <LoadingSkeleton rows={4} label="Loading neighborhood…" /> : null}

      {error ? (
        <ErrorState
          title="Object workspace unavailable"
          message={error}
        />
      ) : null}

      {data ? (
        <>
          <Panel>
            <PanelHeader title="Summary" />
            <div className="p-4">
              {data.node ? (
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-subtle">Graph label</dt>
                    <dd className="font-medium text-ink">{data.node.label}</dd>
                  </div>
                  <div>
                    <dt className="text-subtle">Node type</dt>
                    <dd className="font-mono text-xs text-muted">
                      {data.node.nodeType}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-subtle">Evidence artifacts</dt>
                    <dd className="text-ink">{data.node.evidenceIds.length}</dd>
                  </div>
                  <div>
                    <dt className="text-subtle">Related entity on graph</dt>
                    <dd className="text-ink">
                      {data.relatedEntity.found
                        ? "Linked"
                        : "No graph node yet (honest empty)"}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-muted">
                  No graph node is linked to this entity yet. Product data may
                  still exist on its dedicated surface.
                </p>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Graph neighborhood" />
            <div className="p-4">
              {data.neighbors.length === 0 ? (
                <p className="text-sm text-muted">No neighboring nodes.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {data.neighbors.map((n) => {
                    const href =
                      n.relatedEntityType && n.relatedEntityId
                        ? ontologyEntityHref(
                            n.relatedEntityType,
                            n.relatedEntityId
                          )
                        : null;
                    return (
                      <li
                        key={n.graphNodeId}
                        className="flex items-center justify-between gap-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-ink">{n.label}</div>
                          <div className="font-mono text-xs text-subtle">
                            {n.nodeType}
                          </div>
                        </div>
                        {href ? (
                          <Link
                            className={buttonClassName({
                              variant: "ghost",
                              size: "sm"
                            })}
                            href={href}
                          >
                            Open
                          </Link>
                        ) : (
                          <span className="text-xs text-subtle">No deep-link</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Edges" />
            <div className="p-4">
              {data.edges.length === 0 ? (
                <p className="text-sm text-muted">No edges.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.edges.map((e) => (
                    <li
                      key={e.graphEdgeId}
                      className="rounded-control border border-line px-3 py-2 font-mono text-xs text-muted"
                    >
                      {e.relationship} · basis={e.evidenceBasis ?? "Heuristic"}
                      {e.measurementMethod
                        ? ` · method=${e.measurementMethod}`
                        : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Evidence" />
            <div className="p-4">
              {data.node && data.node.evidenceIds.length > 0 ? (
                <ul className="list-disc pl-5 text-sm text-muted">
                  {data.node.evidenceIds.map((id) => (
                    <li key={id}>
                      <Link
                        className="text-brand hover:text-brand-2"
                        href={`/evidence?evidenceId=${encodeURIComponent(id)}`}
                      >
                        {id}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">
                  No evidence IDs on the graph node (MissingSignal / NotConfigured
                  is honest when empty).
                </p>
              )}
            </div>
          </Panel>
        </>
      ) : null}
    </PageShell>
  );
}

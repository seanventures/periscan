"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import type { AttackPath } from "@periscan/shared";

import { cn } from "./cn";

// Cytoscape attack-path graph. Mirrors the chart pattern: an accessible
// node/transition list fallback always renders (visible under jsdom/SSR where
// the canvas can't mount), and the interactive Cytoscape canvas mounts only in
// the browser once ResizeObserver is available. Topology is read from the real
// loaded AttackPath — nodes/edges are never fabricated.

const AttackPathGraphCanvas = dynamic(
  () => import("./attack-path-graph-canvas"),
  { ssr: false }
);

function useGraphReady() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      typeof ResizeObserver !== "undefined"
    ) {
      setReady(true);
    }
  }, []);

  return ready;
}

export interface AttackPathGraphProps {
  attackPath: AttackPath;
  title?: string;
  ariaLabel?: string;
  height?: number;
  className?: string;
}

export function AttackPathGraph({
  attackPath,
  title = "Attack path graph",
  ariaLabel,
  height = 280,
  className
}: AttackPathGraphProps) {
  const ready = useGraphReady();
  const ordered = [...attackPath.pathNodes].sort(
    (left, right) => left.sequence - right.sequence
  );
  const label = ariaLabel ?? `Attack path graph: ${attackPath.name}`;
  const labelById = new Map(
    ordered.map((node) => [node.pathNodeId, node.label])
  );
  const edges = attackPath.pathEdges.filter(
    (edge) =>
      labelById.has(edge.sourceNodeId) && labelById.has(edge.targetNodeId)
  );

  // Nothing to graph — let callers render their own empty state instead.
  if (ordered.length === 0) {
    return null;
  }

  return (
    <figure className={cn("flex flex-col gap-2", className)} aria-label={label}>
      <figcaption className="text-sm font-semibold text-ink">
        {title}
      </figcaption>
      {ready ? (
        <div role="img" aria-label={`${label} (interactive graph)`}>
          <AttackPathGraphCanvas attackPath={attackPath} height={height} />
        </div>
      ) : null}
      <div className={cn("flex flex-col gap-2", ready && "sr-only")}>
        <ol
          className="flex flex-col gap-1 text-sm"
          aria-label="Attack path nodes"
        >
          {ordered.map((node, index) => (
            <li key={node.pathNodeId} className="text-ink">
              <span className="text-muted">{index + 1}.</span> {node.label}
              <span className="text-muted"> · {node.entityType}</span>
            </li>
          ))}
        </ol>
        {edges.length ? (
          <ul
            className="flex flex-col gap-1 text-sm"
            aria-label="Attack path transitions"
          >
            {edges.map((edge) => (
              <li key={edge.pathEdgeId} className="text-muted">
                {labelById.get(edge.sourceNodeId)} →{" "}
                {labelById.get(edge.targetNodeId)} ({edge.relationship})
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </figure>
  );
}

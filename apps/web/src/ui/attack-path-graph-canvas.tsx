"use client";

import type { ElementDefinition, StylesheetJson } from "cytoscape";
import CytoscapeComponent from "react-cytoscapejs";

import type { AttackPath } from "@periscan/shared";

import { toCytoscapeColor } from "./cytoscape-color";

// Client-only Cytoscape canvas. Loaded via next/dynamic(ssr:false) so cytoscape
// never imports during SSR/prerender or jsdom tests. Renders ONLY the real
// loaded attack-path topology — nodes/edges are never fabricated.

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") {
    return fallback;
  }

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();

  return value || fallback;
}

export default function AttackPathGraphCanvas({
  attackPath,
  height = 280
}: {
  attackPath: AttackPath;
  height?: number;
}) {
  const ordered = [...attackPath.pathNodes].sort(
    (left, right) => left.sequence - right.sequence
  );
  const nodeIds = new Set(ordered.map((node) => node.pathNodeId));

  const elements: ElementDefinition[] = [
    ...ordered.map((node) => ({
      data: { id: node.pathNodeId, label: node.label }
    })),
    ...attackPath.pathEdges
      .filter(
        (edge) =>
          nodeIds.has(edge.sourceNodeId) && nodeIds.has(edge.targetNodeId)
      )
      .map((edge) => ({
        data: {
          id: edge.pathEdgeId,
          label: edge.relationship,
          source: edge.sourceNodeId,
          target: edge.targetNodeId
        }
      }))
  ];

  const ink = cssVar("--color-ink", "#e5e7eb");
  const muted = cssVar("--color-muted", "#9aa4b2");
  const brand = cssVar("--color-brand", "#6366f1");
  const line = toCytoscapeColor(cssVar("--color-line-strong", "#3a4250"));
  const surface = cssVar("--color-surface-strong", "#1b2030");

  const stylesheet: StylesheetJson = [
    {
      selector: "node",
      style: {
        "background-color": brand,
        color: ink,
        "font-size": 10,
        height: 16,
        label: "data(label)",
        "text-margin-y": 6,
        "text-max-width": "100",
        "text-valign": "bottom",
        "text-wrap": "wrap",
        width: 16
      }
    },
    {
      selector: "edge",
      style: {
        color: muted,
        "curve-style": "bezier",
        "font-size": 8,
        label: "data(label)",
        "line-color": line,
        "target-arrow-color": line,
        "target-arrow-shape": "triangle",
        width: 2
      }
    }
  ];

  return (
    <CytoscapeComponent
      elements={elements}
      layout={{ directed: true, name: "breadthfirst", spacingFactor: 1.1 }}
      stylesheet={stylesheet}
      style={{
        background: surface,
        borderRadius: 12,
        height: `${height}px`,
        width: "100%"
      }}
      userPanningEnabled
      userZoomingEnabled
    />
  );
}

"use client";

import { useMemo, useState } from "react";
import type { ExecutiveTrendSeriesMetric } from "@periscan/shared";

import { cn } from "../ui/cn";

/**
 * Interactive executive trend chart over the REAL captured metric time series
 * (GET /executive-trends/series). Every point is a persisted snapshot value —
 * nothing is interpolated or synthesized. A metric with a single captured point
 * is shown as that point plus an honest "history is still building" note rather
 * than a fabricated line.
 */

const VIEW_W = 720;
const VIEW_H = 220;
const PAD = { bottom: 28, left: 44, right: 16, top: 16 };

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function formatValue(value: number, unit: string): string {
  const rounded = Math.round(value * 100) / 100;
  if (unit === "USD") {
    return new Intl.NumberFormat("en-US", {
      currency: "USD",
      maximumFractionDigits: 0,
      notation: Math.abs(value) >= 1_000_000 ? "compact" : "standard",
      style: "currency"
    }).format(value);
  }
  return unit === "%" ? `${rounded}%` : `${rounded} ${unit}`;
}

export function ExecutiveTrendChart({
  metrics
}: {
  metrics: ExecutiveTrendSeriesMetric[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    metrics[0]?.metricId ?? null
  );
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const selected =
    metrics.find((m) => m.metricId === selectedId) ?? metrics[0] ?? null;

  const geometry = useMemo(() => {
    if (!selected || selected.points.length === 0) return null;
    const points = [...selected.points].sort((a, b) =>
      a.capturedAt.localeCompare(b.capturedAt)
    );
    const values = points.map((p) => p.value);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    // Pad the domain; when flat, open a symmetric window so the line sits mid-plot.
    const span = rawMax - rawMin || Math.abs(rawMax) || 1;
    const min = rawMin - span * 0.15;
    const max = rawMax + span * 0.15;
    const plotW = VIEW_W - PAD.left - PAD.right;
    const plotH = VIEW_H - PAD.top - PAD.bottom;
    const x = (i: number) =>
      points.length === 1
        ? PAD.left + plotW / 2
        : PAD.left + (i / (points.length - 1)) * plotW;
    const y = (v: number) =>
      PAD.top + plotH - ((v - min) / (max - min || 1)) * plotH;
    const coords = points.map((p, i) => ({ ...p, cx: x(i), cy: y(p.value) }));
    return { coords, max, min, plotH, plotW };
  }, [selected]);

  if (!selected || !geometry) {
    return (
      <p className="px-4 py-8 text-center text-sm text-subtle">
        No trend history captured yet. Points accumulate as the executive
        dashboard is reviewed and validation runs on schedule.
      </p>
    );
  }

  const { coords } = geometry;
  const singlePoint = coords.length < 2;
  const linePath = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.cx.toFixed(1)},${c.cy.toFixed(1)}`)
    .join(" ");
  const areaPath =
    coords.length >= 2
      ? `${linePath} L${coords[coords.length - 1]!.cx.toFixed(1)},${(
          VIEW_H - PAD.bottom
        ).toFixed(1)} L${coords[0]!.cx.toFixed(1)},${(VIEW_H - PAD.bottom).toFixed(
          1
        )} Z`
      : "";
  const active = hoverIndex != null ? coords[hoverIndex] : null;

  return (
    <div className="flex flex-col gap-3 p-4">
      {metrics.length > 1 ? (
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Trend metric">
          {metrics.map((m) => (
            <button
              key={m.metricId}
              type="button"
              role="tab"
              aria-selected={m.metricId === selected.metricId}
              onClick={() => {
                setSelectedId(m.metricId);
                setHoverIndex(null);
              }}
              className={cn(
                "rounded-control border px-2.5 py-1 text-[11px] font-medium transition-colors",
                m.metricId === selected.metricId
                  ? "border-brand bg-brand/12 text-brand"
                  : "border-line text-muted hover:border-line-strong hover:text-ink"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="relative">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="w-full"
          role="img"
          aria-label={`${selected.label} over time`}
          preserveAspectRatio="none"
          onMouseLeave={() => setHoverIndex(null)}
          onMouseMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const svgX = ((event.clientX - rect.left) / rect.width) * VIEW_W;
            let nearest = 0;
            let best = Infinity;
            coords.forEach((c, i) => {
              const d = Math.abs(c.cx - svgX);
              if (d < best) {
                best = d;
                nearest = i;
              }
            });
            setHoverIndex(nearest);
          }}
        >
          {/* baseline + top gridlines */}
          <line
            x1={PAD.left}
            y1={VIEW_H - PAD.bottom}
            x2={VIEW_W - PAD.right}
            y2={VIEW_H - PAD.bottom}
            className="stroke-line"
            strokeWidth={1}
          />
          <line
            x1={PAD.left}
            y1={PAD.top}
            x2={VIEW_W - PAD.right}
            y2={PAD.top}
            className="stroke-line"
            strokeWidth={1}
            strokeDasharray="2 4"
          />
          {/* y labels */}
          <text x={PAD.left - 8} y={PAD.top + 4} textAnchor="end" className="fill-subtle text-[10px]">
            {formatValue(geometry.max, selected.unit)}
          </text>
          <text x={PAD.left - 8} y={VIEW_H - PAD.bottom} textAnchor="end" className="fill-subtle text-[10px]">
            {formatValue(geometry.min, selected.unit)}
          </text>

          {areaPath ? <path d={areaPath} className="fill-brand/10" /> : null}
          {linePath ? (
            <path
              d={linePath}
              fill="none"
              className="stroke-brand"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {active ? (
            <line
              x1={active.cx}
              y1={PAD.top}
              x2={active.cx}
              y2={VIEW_H - PAD.bottom}
              className="stroke-line-strong"
              strokeWidth={1}
            />
          ) : null}

          {coords.map((c, i) => (
            <circle
              key={c.capturedAt}
              cx={c.cx}
              cy={c.cy}
              r={hoverIndex === i ? 4.5 : singlePoint ? 4 : 3}
              className={cn(
                "fill-brand",
                hoverIndex === i && "stroke-bg"
              )}
              strokeWidth={hoverIndex === i ? 2 : 0}
            />
          ))}

          {/* x labels: first and last */}
          <text x={coords[0]!.cx} y={VIEW_H - PAD.bottom + 16} textAnchor="middle" className="fill-subtle text-[10px]">
            {formatDate(coords[0]!.capturedAt)}
          </text>
          {coords.length > 1 ? (
            <text
              x={coords[coords.length - 1]!.cx}
              y={VIEW_H - PAD.bottom + 16}
              textAnchor="middle"
              className="fill-subtle text-[10px]"
            >
              {formatDate(coords[coords.length - 1]!.capturedAt)}
            </text>
          ) : null}
        </svg>

        {active ? (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-md border border-line-strong bg-elevated px-2 py-1 text-[11px] shadow-lg"
            style={{
              left: `${(active.cx / VIEW_W) * 100}%`,
              top: `${(active.cy / VIEW_H) * 100}%`
            }}
          >
            <span className="font-mono text-ink">
              {formatValue(active.value, selected.unit)}
            </span>
            <span className="ml-1.5 text-subtle">{formatDate(active.capturedAt)}</span>
          </div>
        ) : null}
      </div>

      {singlePoint ? (
        <p className="text-[12px] text-subtle">
          Only one snapshot captured so far — the trend line fills in as more
          daily snapshots accumulate.
        </p>
      ) : null}
    </div>
  );
}

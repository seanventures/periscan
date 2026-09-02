"use client";

import { ResponsiveBar } from "@nivo/bar";
import { ResponsivePie } from "@nivo/pie";
import { useEffect, useState } from "react";

import { cn } from "./cn";

// Charts are a purely presentational layer over data the workbench already
// loaded from the API — they never fabricate series. Every chart ships with a
// real data table fallback so screen-reader users (and jsdom tests, where
// ResizeObserver is absent and nivo cannot measure) still get the numbers.

const PALETTE = [
  "var(--color-danger)",
  "var(--color-warning)",
  "var(--color-info)",
  "var(--color-brand)",
  "var(--color-success)",
  "var(--color-muted)"
];

const NIVO_THEME = {
  background: "transparent",
  text: { fill: "var(--color-muted)", fontSize: 11 },
  axis: {
    ticks: { text: { fill: "var(--color-muted)", fontSize: 11 } },
    legend: { text: { fill: "var(--color-muted)", fontSize: 11 } }
  },
  labels: { text: { fill: "var(--color-bg)", fontSize: 11 } },
  legends: { text: { fill: "var(--color-muted)", fontSize: 11 } },
  tooltip: {
    container: {
      background: "var(--color-surface-strong)",
      color: "var(--color-ink)",
      fontSize: 12
    }
  }
};

export interface ChartDatum {
  id: string;
  label?: string;
  value: number;
  color?: string;
}

function useChartReady() {
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

export interface DistributionChartProps {
  title: string;
  ariaLabel: string;
  data: ChartDatum[];
  variant?: "bar" | "pie";
  height?: number;
  emptyLabel?: string;
  className?: string;
}

export function DistributionChart({
  title,
  ariaLabel,
  data,
  variant = "bar",
  height = 220,
  emptyLabel = "No data to chart yet.",
  className
}: DistributionChartProps) {
  const ready = useChartReady();
  const total = data.reduce((sum, datum) => sum + datum.value, 0);
  const hasData = data.length > 0 && total > 0;
  const colored = data.map((datum, index) => ({
    ...datum,
    color: datum.color ?? PALETTE[index % PALETTE.length]!
  }));

  return (
    <figure
      className={cn("flex flex-col gap-2", className)}
      aria-label={ariaLabel}
    >
      <figcaption className="text-sm font-semibold text-ink">
        {title}
      </figcaption>
      {!hasData ? (
        <p className="text-sm text-muted">{emptyLabel}</p>
      ) : (
        <>
          {ready ? (
            <div
              className="w-full"
              style={{ height: `${height}px` }}
              role="img"
              aria-label={`${ariaLabel} (chart)`}
            >
              {variant === "pie" ? (
                <ResponsivePie
                  data={colored.map((datum) => ({
                    id: datum.label ?? datum.id,
                    label: datum.label ?? datum.id,
                    value: datum.value,
                    color: datum.color
                  }))}
                  colors={{ datum: "data.color" }}
                  margin={{ top: 12, right: 12, bottom: 12, left: 12 }}
                  innerRadius={0.55}
                  padAngle={1}
                  cornerRadius={3}
                  borderWidth={0}
                  enableArcLinkLabels={false}
                  arcLabelsTextColor="var(--color-bg)"
                  theme={NIVO_THEME}
                  isInteractive={false}
                  animate={false}
                />
              ) : (
                <ResponsiveBar
                  data={colored}
                  keys={["value"]}
                  indexBy="id"
                  margin={{ top: 8, right: 8, bottom: 28, left: 32 }}
                  padding={0.3}
                  colors={(bar) =>
                    (bar.data as ChartDatum).color ?? PALETTE[0]!
                  }
                  borderRadius={3}
                  enableLabel={false}
                  axisLeft={{ tickSize: 0, tickPadding: 6, tickValues: 4 }}
                  axisBottom={{ tickSize: 0, tickPadding: 6 }}
                  theme={NIVO_THEME}
                  isInteractive={false}
                  animate={false}
                />
              )}
            </div>
          ) : null}
          <table className={cn("w-full text-sm", ready && "sr-only")}>
            <caption className="sr-only">{ariaLabel}</caption>
            <thead>
              <tr>
                <th scope="col" className="text-left font-medium text-muted">
                  Category
                </th>
                <th scope="col" className="text-right font-medium text-muted">
                  Count
                </th>
              </tr>
            </thead>
            <tbody>
              {colored.map((datum) => (
                <tr key={datum.id}>
                  <th scope="row" className="text-left font-normal text-ink">
                    {datum.label ?? datum.id}
                  </th>
                  <td className="text-right tabular-nums text-ink">
                    {datum.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </figure>
  );
}

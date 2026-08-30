import type { RiskFactor } from "@periscan/shared";

import type { StateTone } from "../ui";

function formatContribution(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

export function RiskFactorBreakdown({
  factors,
  formula,
  score
}: {
  factors: RiskFactor[];
  formula?: string;
  score?: number;
}) {
  const maxContribution = Math.max(
    1,
    ...factors.map((factor) => Math.abs(factor.contribution))
  );
  const rawSum = factors.reduce(
    (total, factor) => total + factor.contribution,
    0
  );

  if (factors.length === 0) {
    return (
      <p className="px-4 py-5 text-sm text-subtle">
        No scoring factors were recorded for this result.
      </p>
    );
  }

  return (
    <div>
      {formula ? (
        <div className="border-b border-line bg-brand/5 px-4 py-3">
          <p className="font-mono text-[11.5px] text-ink">{formula}</p>
          <p className="mt-1 text-[11px] text-subtle">
            Recorded contribution sum: {rawSum}
            {score === undefined ? "" : ` · displayed priority: ${score}`}
          </p>
        </div>
      ) : null}
      <ul className="flex flex-col">
        {factors.map((factor) => {
          const tone: StateTone =
            factor.contribution > 0
              ? "missed"
              : factor.contribution < 0
                ? "validated"
                : "inconclusive";
          const width = Math.round(
            (Math.abs(factor.contribution) / maxContribution) * 100
          );

          return (
            <li
              key={factor.key}
              className="border-b border-line px-4 py-3 last:border-b-0"
            >
              <div className="flex items-center justify-between gap-3 text-[12.5px]">
                <span className="text-muted">{factor.label}</span>
                <span className="flex items-center gap-2 font-mono text-ink">
                  <span>{factor.value}</span>
                  <span
                    aria-label={`${factor.label} contribution ${formatContribution(factor.contribution)}`}
                    className="min-w-8 text-right"
                  >
                    {formatContribution(factor.contribution)}
                  </span>
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-pill bg-surface-strong">
                <span
                  className="block h-full rounded-pill"
                  style={{
                    background: `var(--color-${tone})`,
                    width: `${width}%`
                  }}
                />
              </div>
              <p className="mt-1.5 text-[11.5px] text-subtle">
                {factor.rationale}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

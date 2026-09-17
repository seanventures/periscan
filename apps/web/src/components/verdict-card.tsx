"use client";

import { Badge } from "../ui";

export interface VerdictSample {
  status?: string;
  title?: string;
  category?: string;
  outcome?: string;
  headline?: string;
  description?: string;
  verificationOutcome?: string;
}

export function VerdictCard({
  packType,
  samples,
  modelSessionId,
  signalCount,
  evidenceCount,
  modelExcerpt,
  verificationOutcome
}: {
  packType?: string | null;
  samples: VerdictSample[];
  modelSessionId?: string | null;
  signalCount?: number;
  evidenceCount?: number;
  modelExcerpt?: string | null; // G-wire model turn excerpt for verdict richness (Q)
  verificationOutcome?: string | null; // primary Fixed/Still Exposed etc for rich verdict (T3)
}) {
  if (!samples || samples.length === 0) {
    return (
      <div className="text-[10px] text-muted p-2 bg-black/5 rounded">
        No verdicts surfaced yet. Export report for full synth content or wait
        for worker evidence.
        {modelSessionId && (
          <div className="text-amber-600 mt-1">
            Model session {modelSessionId.slice(0, 8)} linked — see Model
            Gateway or export.
          </div>
        )}
      </div>
    );
  }

  const typeNote =
    packType === "ControlValidationReport"
      ? "Control: Detected / Blocked / Missed / Logged + ATT&CK where mapped."
      : packType === "AIAppValidationReport"
        ? "AI: prompt injection, leakage, guardrail, tool abuse from safe harness (Promptfoo/PyRIT/Garak)."
        : packType === "FixVerificationReport"
          ? "Fix: pre/post evidence + verification outcome (Fixed / Still Exposed) for closure proof."
          : packType === "CTEMProgramSummary"
            ? "CTEM: scope, discover, prioritize, validate, mobilize, verify stages from continuous non-snap."
            : "Validated signals from module execution.";

  return (
    <div className="border border-line rounded-control p-2 bg-surface text-xs">
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-ink">
          Verdict samples {packType ? `(${packType})` : ""}
        </span>
        <span className="text-[10px] text-muted">
          {samples.length} shown · evidence {evidenceCount ?? "?"}{" "}
          {signalCount ? `· signals ${signalCount}` : ""}
        </span>
        {verificationOutcome && (
          <span className="ml-1 text-[10px] font-medium text-emerald-600">
            {verificationOutcome}
          </span>
        )}
      </div>
      <ul className="space-y-0.5 max-h-28 overflow-auto">
        {samples.slice(0, 8).map((v, i) => (
          <li key={i} className="flex gap-2 items-start">
            <Badge
              tone={
                /fixed|success|pass|detect|block/i.test(
                  String(v.status || v.outcome || v.verificationOutcome)
                )
                  ? "success"
                  : /still exposed|miss|leak|fail|inconclusive/i.test(
                        String(v.status || v.outcome || v.verificationOutcome)
                      )
                    ? "danger"
                    : "neutral"
              }
            >
              {(
                v.verificationOutcome ||
                v.status ||
                v.outcome ||
                v.category ||
                "result"
              )
                .toString()
                .slice(0, 16)}
            </Badge>
            <span className="line-clamp-2 text-[11px]">
              {(v.title || v.headline || v.description || "").slice(0, 110)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-1 text-[10px] text-muted">{typeNote}</div>
      {modelSessionId && (
        <div className="mt-1 text-[9px] text-amber-600">
          Model session {modelSessionId.slice(0, 8)} linked (G-wire Frontier
          analysis for this pack/verdict).
        </div>
      )}
      {modelExcerpt && (
        <div className="mt-0.5 text-[9px] text-muted line-clamp-2">
          Model excerpt: {modelExcerpt}
        </div>
      )}
    </div>
  );
}

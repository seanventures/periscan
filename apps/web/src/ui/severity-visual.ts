import type { StateTone } from "./state-badge";

/**
 * Canonical severity visual encoding for badges and charts.
 *
 * - Critical is distinct from High (missed red vs approval amber).
 * - Low / Informational stay neutral — never success-green (`validated`/`fixed`).
 * - Chart fills use the same semantic tokens as badge tones so adjacent
 *   surfaces never disagree on what a severity word means.
 */
export const SEVERITY_TONE: Record<string, StateTone> = {
  Critical: "missed",
  High: "approval",
  Medium: "blocked",
  Low: "inconclusive",
  Informational: "inconclusive"
};

/** Chart fill colors aligned 1:1 with {@link SEVERITY_TONE}. */
export const SEVERITY_CHART_COLOR: Record<string, string> = {
  Critical: "var(--color-missed)",
  High: "var(--color-approval)",
  Medium: "var(--color-blocked)",
  Low: "var(--color-inconclusive)",
  Informational: "var(--color-inconclusive)"
};

/**
 * Path / program risk bands share severity encoding.
 *
 * Wire token Fixed is presentation-only (verification residual closed band for
 * charts/badges). It is not RemediationTask.status Fixed — display via
 * formatRiskBandDisplayLabel as "Closed (risk)" (P09-3 residual).
 */
export const RISK_BAND_TONE: Record<string, StateTone> = {
  ...SEVERITY_TONE,
  Fixed: "fixed"
};

export const RISK_BAND_CHART_COLOR: Record<string, string> = {
  ...SEVERITY_CHART_COLOR,
  Fixed: "var(--color-fixed)"
};

export function severityTone(severity: string): StateTone {
  return SEVERITY_TONE[severity] ?? "neutral";
}

export function severityChartColor(severity: string): string {
  return SEVERITY_CHART_COLOR[severity] ?? "var(--color-inconclusive)";
}

export function riskBandTone(band: string): StateTone {
  return RISK_BAND_TONE[band] ?? "neutral";
}

export function riskBandChartColor(band: string): string {
  return RISK_BAND_CHART_COLOR[band] ?? "var(--color-inconclusive)";
}

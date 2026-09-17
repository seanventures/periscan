import { describe, expect, it } from "vitest";

import {
  RISK_BAND_CHART_COLOR,
  RISK_BAND_TONE,
  SEVERITY_CHART_COLOR,
  SEVERITY_TONE,
  riskBandChartColor,
  riskBandTone,
  severityChartColor,
  severityTone
} from "./severity-visual";

describe("severity visual (P01-4)", () => {
  it("keeps Critical distinct from High", () => {
    expect(severityTone("Critical")).toBe("missed");
    expect(severityTone("High")).toBe("approval");
    expect(severityTone("Critical")).not.toBe(severityTone("High"));
  });

  it("never paints Low or Informational as success-green", () => {
    for (const severity of ["Low", "Informational"] as const) {
      expect(severityTone(severity)).not.toBe("validated");
      expect(severityTone(severity)).not.toBe("fixed");
      expect(severityChartColor(severity)).not.toContain("validated");
      expect(severityChartColor(severity)).not.toContain("fixed");
      expect(severityChartColor(severity)).not.toContain("success");
    }
  });

  it("aligns chart colors with badge tones for Critical/High/Medium/Low", () => {
    for (const severity of ["Critical", "High", "Medium", "Low"] as const) {
      const tone = SEVERITY_TONE[severity];
      const chart = SEVERITY_CHART_COLOR[severity];
      expect(tone).toBeTruthy();
      expect(chart).toBe(`var(--color-${tone})`);
      expect(severityTone(severity)).toBe(tone);
      expect(severityChartColor(severity)).toBe(chart);
    }
  });

  it("falls back safely for unknown severity", () => {
    expect(severityTone("Unknown")).toBe("neutral");
    expect(severityChartColor("Unknown")).toBe("var(--color-inconclusive)");
  });
});

describe("risk band visual (P01-3)", () => {
  it("matches severity encoding so Critical ≠ High and Low is not success-green", () => {
    expect(riskBandTone("Critical")).toBe("missed");
    expect(riskBandTone("High")).toBe("approval");
    expect(riskBandTone("Critical")).not.toBe(riskBandTone("High"));
    expect(riskBandTone("Low")).toBe("inconclusive");
    expect(riskBandTone("Low")).not.toBe("validated");
    // Wire Fixed remains for charts; display label is Closed (risk) (P09-3)
    expect(riskBandTone("Fixed")).toBe("fixed");
  });

  it("aligns risk-band chart fills with tones", () => {
    for (const band of ["Critical", "High", "Medium", "Low", "Fixed"] as const) {
      const tone = RISK_BAND_TONE[band];
      const chart = RISK_BAND_CHART_COLOR[band];
      expect(chart).toBe(`var(--color-${tone})`);
      expect(riskBandChartColor(band)).toBe(chart);
    }
  });
});

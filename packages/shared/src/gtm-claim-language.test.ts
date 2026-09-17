import { describe, expect, it } from "vitest";

import {
  GTM_DENY_PHRASES,
  GTM_INTEGRATE_PLANES,
  GTM_PROVE_CLAIMS,
  getGtmClaimLanguageSummary
} from "./gtm-claim-language.js";

describe("gtm claim language (P19-20)", () => {
  it("exports non-empty prove / integrate / deny contracts", () => {
    expect(GTM_PROVE_CLAIMS.length).toBeGreaterThanOrEqual(4);
    expect(GTM_INTEGRATE_PLANES.length).toBeGreaterThanOrEqual(4);
    expect(GTM_DENY_PHRASES.length).toBeGreaterThanOrEqual(8);
  });

  it("includes hard floor and refuses automated pentest / CNAPP replace", () => {
    const summary = getGtmClaimLanguageSummary();
    expect(summary.prove.some((c) => /hard safety floor/i.test(c))).toBe(true);
    expect(
      summary.deny.some((d) => /automated pentest/i.test(d.denied))
    ).toBe(true);
    expect(summary.deny.some((d) => /CNAPP|Wiz/i.test(d.denied))).toBe(true);
    expect(summary.deny.some((d) => /Defender/i.test(d.denied))).toBe(true);
    expect(summary.deny.some((d) => /Nuclei/i.test(d.denied))).toBe(true);
    expect(summary.deny.some((d) => /DORA|PCI|compliant/i.test(d.denied))).toBe(
      true
    );
    expect(summary.deny.some((d) => /TEE|enclave|H100/i.test(d.denied))).toBe(
      true
    );
    expect(
      summary.deny.some((d) =>
        /not certification \/ not audit opinion/i.test(d.substitute)
      )
    ).toBe(true);
    expect(summary.matrixSource).toContain("COMPETITIVE_COVERAGE_MATRIX");
    expect(summary.denyListDoc).toContain("CLAIM_DENY_LIST");
  });

  it("Wave J/K freeze: denies full BAS, auto-mitigate push, TEE host, Leading on Partial, Ray", () => {
    const denied = GTM_DENY_PHRASES.map((d) => d.denied).join(" | ");
    expect(denied).toMatch(/full bas|multi-vector bas/i);
    expect(denied).toMatch(/auto-mitigate/i);
    expect(denied).toMatch(/tee|enclave/i);
    expect(denied).toMatch(/leading on partial/i);
    expect(denied).toMatch(/ray/i);
  });

  it("P12-6: denies zero-ref market presence, fabricated logos, and demo-as-customer proof", () => {
    const denied = GTM_DENY_PHRASES.map((d) => d.denied).join(" | ");
    const substitutes = GTM_DENY_PHRASES.map((d) => d.substitute).join(" | ");
    expect(denied).toMatch(/logo|case stud|arr|reference/i);
    expect(denied).toMatch(/leaders-ready|magic quadrant|market-presence/i);
    expect(denied).toMatch(/demo tenant|sample \/demo|lab e2e/i);
    expect(substitutes).toMatch(/zero public references|design-partner/i);
    expect(substitutes).toMatch(/mq market presence fail|signed reference/i);
  });
});

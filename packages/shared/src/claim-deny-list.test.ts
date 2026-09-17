import { describe, expect, it } from "vitest";

import { FindingDispositionSchema } from "./domain";
import {
  CLAIM_LANGUAGE_CATALOG,
  ClaimLanguageCatalogSchema,
  isRefusedClaimPhrase,
  listClaimLanguageByBucket,
  listRefusedClaimPhrases,
  ONTOLOGY_LAWS
} from "./claim-deny-list";

describe("claim deny-list productization (P19-20)", () => {
  it("parses the catalog and keeps refuse/prove/integrate non-empty", () => {
    const parsed = ClaimLanguageCatalogSchema.parse([...CLAIM_LANGUAGE_CATALOG]);
    expect(parsed.length).toBeGreaterThanOrEqual(10);
    expect(listClaimLanguageByBucket("prove").length).toBeGreaterThanOrEqual(3);
    expect(listClaimLanguageByBucket("integrate").length).toBeGreaterThanOrEqual(
      2
    );
    expect(listClaimLanguageByBucket("refuse").length).toBeGreaterThanOrEqual(5);
  });

  it("refuses full BAS, live ransomware, and certification overclaims", () => {
    const refused = listRefusedClaimPhrases().join(" | ").toLowerCase();
    expect(refused).toMatch(/bas/);
    expect(refused).toMatch(/ransomware/);
    expect(refused).toMatch(/kill-chain|apt/);
    expect(refused).toMatch(/dora|certified|certif/);
    expect(isRefusedClaimPhrase("Full multi-vector BAS platform like Cymulate")).toBe(
      true
    );
    expect(
      isRefusedClaimPhrase("Measured vs Heuristic path labels with hop receipts")
    ).toBe(false);
  });

  it("Wave J/K freeze: refuses auto-mitigate push, TEE host, Leading on Partial, Ray shipped", () => {
    const ids = CLAIM_LANGUAGE_CATALOG.filter((e) => e.bucket === "refuse").map(
      (e) => e.id
    );
    expect(ids).toEqual(
      expect.arrayContaining([
        "full-bas-peer",
        "auto-mitigate-control-push",
        "tee-execution-host",
        "leading-on-partial",
        "scorecard-leading-export",
        "ray-as-shipped"
      ])
    );
    const refused = listRefusedClaimPhrases().join(" | ").toLowerCase();
    expect(refused).toMatch(/auto-mitigate/);
    expect(refused).toMatch(/tee|enclave/);
    expect(refused).toMatch(/leading on partial|scaffold/);
    expect(refused).toMatch(/ray/);
  });

  it("P12-6 / PERISCAN-431: refuses fabricated customer refs and Leaders-ready with zero refs", () => {
    const ids = CLAIM_LANGUAGE_CATALOG.filter((e) => e.bucket === "refuse").map(
      (e) => e.id
    );
    expect(ids).toEqual(
      expect.arrayContaining([
        "fabricated-customer-refs",
        "mq-leaders-ready-zero-refs",
        "demo-as-customer-proof"
      ])
    );
    const refused = listRefusedClaimPhrases().join(" | ").toLowerCase();
    expect(refused).toMatch(/logo|case stud|arr|reference/);
    expect(refused).toMatch(/leaders-ready|magic quadrant|market-presence/);
    expect(refused).toMatch(/demo tenant|sample \/demo|lab e2e/);
    expect(
      isRefusedClaimPhrase(
        "Magic Quadrant / Forrester Wave Leaders-ready or market-presence Pass with zero customer references"
      )
    ).toBe(true);
  });

  it("PERISCAN-469: refuses live marketplace and self-serve checkout claims when not configured", () => {
    const ids = CLAIM_LANGUAGE_CATALOG.filter((e) => e.bucket === "refuse").map(
      (e) => e.id
    );
    expect(ids).toEqual(
      expect.arrayContaining([
        "self-serve-card-checkout",
        "live-public-marketplace-without-ops"
      ])
    );
    const refused = listRefusedClaimPhrases().join(" | ").toLowerCase();
    expect(refused).toMatch(/self-serve card checkout|paymentprocessorstatus/);
    expect(refused).toMatch(/public aws marketplace|listing/);
    expect(
      isRefusedClaimPhrase(
        "Self-serve card checkout / live payment processor while paymentProcessorStatus is NotConfigured"
      )
    ).toBe(true);
    expect(
      isRefusedClaimPhrase(
        "Live / public AWS Marketplace listing without ops-attested Public state"
      )
    ).toBe(true);
  });

  it("PERISCAN-30: refuses SCIM Production and fake vendor Type II claims", () => {
    const ids = CLAIM_LANGUAGE_CATALOG.filter((e) => e.bucket === "refuse").map(
      (e) => e.id
    );
    expect(ids).toEqual(
      expect.arrayContaining([
        "scim-production-inbound",
        "vendor-soc2-type-ii-claimed"
      ])
    );
    const refused = listRefusedClaimPhrases().join(" | ").toLowerCase();
    expect(refused).toMatch(/scim|full idp lifecycle/);
    expect(refused).toMatch(/type ii|soc 2/);
    expect(
      isRefusedClaimPhrase(
        "Inbound SCIM 2.0 for Periscan users is Production / shipped / full IdP lifecycle"
      )
    ).toBe(true);
    expect(
      isRefusedClaimPhrase(
        "Vendor SOC 2 Type II certified / product packs equal Type II attestation"
      )
    ).toBe(true);
  });
});

describe("Five Laws schema gates (P09-17)", () => {
  it("documents five laws with stable ids", () => {
    expect(ONTOLOGY_LAWS).toHaveLength(5);
    expect(ONTOLOGY_LAWS.map((law) => law.id)).toEqual([
      "L1-spine-entities",
      "L2-state-partitions",
      "L3-fixed-only-verification",
      "L4-score-composition",
      "L5-pillars-not-missions"
    ]);
  });

  it("FindingDisposition never includes Fixed (L2/L3)", () => {
    const values = FindingDispositionSchema.options;
    expect(values).not.toContain("Fixed");
    expect(values).toEqual(
      expect.arrayContaining([
        "Acknowledged",
        "Escalated",
        "AcceptedRisk",
        "FalsePositive",
        "Suppressed"
      ])
    );
    expect(FindingDispositionSchema.safeParse("Fixed").success).toBe(false);
  });
});

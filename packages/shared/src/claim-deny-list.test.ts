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

  it("refuses unsupported shipped parity, live ransomware, and certification overclaims", () => {
    const refused = listRefusedClaimPhrases().join(" | ").toLowerCase();
    expect(refused).toMatch(/bas/);
    expect(refused).toMatch(/ransomware/);
    expect(refused).toMatch(/default start|unmarked/);
    expect(refused).toMatch(/dora|certified|certif/);
    expect(isRefusedClaimPhrase("Full multi-vector BAS platform like Cymulate")).toBe(
      true
    );
    expect(
      isRefusedClaimPhrase("Measured vs Heuristic path labels with hop receipts")
    ).toBe(false);
  });

  it("permits BAS/AEV development and replaces the partner-or-walk mandate", () => {
    expect(isRefusedClaimPhrase("Full BAS/AEV is our development objective")).toBe(false);
    expect(CLAIM_LANGUAGE_CATALOG.some((entry) => entry.id === "bas-library-partner")).toBe(false);
    expect(CLAIM_LANGUAGE_CATALOG.find((entry) => entry.id === "bas-library-interoperability")?.bucket).toBe("integrate");
    expect(CLAIM_LANGUAGE_CATALOG.find((entry) => entry.id === "full-bas-peer")?.rationale).toContain("development objective");
    expect(
      CLAIM_LANGUAGE_CATALOG.find((entry) => entry.id === "high-danger-section")
        ?.bucket
    ).toBe("prove");
    expect(
      CLAIM_LANGUAGE_CATALOG.find(
        (entry) => entry.id === "unmarked-ransomware-first-hour"
      )?.bucket
    ).toBe("refuse");
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

  it("PERISCAN-589: refuses treating Metasploit check() as exploitability or safety", () => {
    expect(
      CLAIM_LANGUAGE_CATALOG.find(
        (entry) => entry.id === "metasploit-check-claim-split"
      )?.bucket
    ).toBe("prove");
    expect(
      isRefusedClaimPhrase(
        "A Metasploit check() method proves exploitability or is a safety guarantee"
      )
    ).toBe(true);
    expect(
      isRefusedClaimPhrase(
        "Distinguish Metasploit vulnerability presence, check support, and measured exploitability"
      )
    ).toBe(false);
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
        "Inbound SCIM is Okta/Azure certified or a full IdP lifecycle including JIT"
      )
    ).toBe(true);
    expect(
      isRefusedClaimPhrase(
        "Vendor SOC 2 Type II certified / product packs equal Type II attestation"
      )
    ).toBe(true);
  });

  it("refuses always-on BAS / NodeZero autonomous pentest as Continuous validation copy", () => {
    expect(
      CLAIM_LANGUAGE_CATALOG.find(
        (entry) => entry.id === "continuous-validation-cadence"
      )?.bucket
    ).toBe("prove");
    expect(
      isRefusedClaimPhrase(
        "Always-on BAS / always-on live BAS / NodeZero-class autonomous pentest"
      )
    ).toBe(true);
    expect(
      isRefusedClaimPhrase(
        "Continuous validation as a policy-approved Hourly/Daily/Weekly/Monthly cadence"
      )
    ).toBe(false);
  });

  it("PERISCAN-591: refuses Stratus customer-cloud destruction and Navigator-import-as-executed-coverage", () => {
    const ids = CLAIM_LANGUAGE_CATALOG.filter((e) => e.bucket === "refuse").map(
      (e) => e.id
    );
    expect(ids).toEqual(
      expect.arrayContaining([
        "stratus-customer-cloud-destroy",
        "navigator-import-executed-coverage"
      ])
    );
    const refused = listRefusedClaimPhrases().join(" | ").toLowerCase();
    expect(refused).toMatch(/stratus/);
    expect(refused).toMatch(/customer cloud/);
    expect(refused).toMatch(/navigator/);
    expect(refused).toMatch(/executed coverage/);
    expect(
      isRefusedClaimPhrase(
        "Stratus Red Team live detonation that destroys customer cloud resources"
      )
    ).toBe(true);
    expect(
      isRefusedClaimPhrase(
        "Imported ATT&CK Navigator layer is executed coverage or 100% ATT&CK"
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

/**
 * Productized GTM claim language (P19-20).
 *
 * Keep in sync with docs/competitive/CLAIM_DENY_LIST.md.
 * Used by Trust & Safety UI, API reference help, and unit tests so sales/SE
 * deny-lists cannot drift from code-exported contracts.
 */

export const GTM_PROVE_CLAIMS = [
  "Measured exposure on verified authorized scope",
  "Measured vs Heuristic path/hop labels in the data model",
  "Fixed only after re-measurement (Fixed can demote)",
  "Governed continuous validation with a hard safety floor",
  "Authorized external PoA via bounded safe profiles",
  "Co-exist recipes with Wiz, Tenable, and Microsoft Defender telemetry"
] as const;

export const GTM_INTEGRATE_PLANES = [
  {
    plane: "CNAPP",
    job: "Ingest inventory/issues; prove path + fix",
    never: "Replace CNAPP / Wiz alternative"
  },
  {
    plane: "RBVM",
    job: "Validate exploitability and re-prove fixes",
    never: "Replace Tenable / vulnerability management"
  },
  {
    plane: "XDR/SIEM/EDR",
    job: "Telemetry and control observation",
    never: "Rip-and-replace detection platform"
  },
  {
    plane: "ITSM",
    job: "Tickets and remediation workflow",
    never: "Replace ITSM"
  },
  {
    plane: "OSS scanners (e.g. Nuclei)",
    job: "Governed adapter + evidence normalization",
    never: "We are a scanner / template marketplace"
  }
] as const;

export const GTM_DENY_PHRASES = [
  {
    denied: "Full BAS platform / multi-vector BAS peer / scenario-library bake-off parity",
    substitute:
      "AEV/CTEM proof layer on authorized scope; refuse BAS library RFPs"
  },
  {
    denied: "Replace your CNAPP / Wiz alternative",
    substitute: "Bring inventory; we prove path + fix"
  },
  {
    denied: "Replace Tenable / RBVM",
    substitute: "Validation and fix-proof on top of RBVM"
  },
  {
    denied: "Automated pentest / autonomous red team",
    substitute:
      "Governed continuous validation with a hard floor that never lifts"
  },
  {
    denied: "Ransomware emulation / live malware packs",
    substitute: "Not in product; safety floor"
  },
  {
    denied: "We make you DORA / NIS2 / PCI / SOC 2 compliant",
    substitute:
      "We attach measured validation evidence to framework claims (not certification / not audit opinion)"
  },
  {
    denied: "We run your agents inside a TEE/enclave or host H100",
    substitute:
      "We qualify customer-supplied TEE/H100 attestation evidence (verifier, not host)"
  },
  {
    denied: "False-positive-free (global)",
    substitute: "Only scope to a measured edge with evidence IDs"
  },
  {
    denied: "Leading on Partial/Scaffold matrix rows",
    substitute:
      "Coverage matrix Fully-E2E only; Leading allowlist 11,13,24,69,90,91 until blind rescore"
  },
  {
    denied: "100+ deep native integrations",
    substitute: "Publish connectable vs planned; top-N depth"
  },
  {
    denied: "Microsoft CTEM replacement / rip out Defender",
    substitute: "Cross-stack path + external PoA; keep Defender telemetry"
  },
  {
    denied: "We run Nuclei (as the hero claim)",
    substitute: "Authorized External PoA workflow"
  },
  {
    denied: "Continuous validation (unqualified)",
    substitute: "Scheduled + revalidation + signal-triggered"
  },
  {
    denied: "Auto-mitigate as control push",
    substitute: "Auto-revalidate until approved control push exists"
  },
  {
    denied: "We run your agents/workloads in a TEE or confidential enclave",
    substitute:
      "We qualify customer-supplied TEE/H100 attestation evidence (verifier, not host)"
  },
  {
    denied: "Ray scaling shipped / Ray as product runtime",
    substitute:
      "Matrix #99 Absent; core async workers only — platform adjacency, not CTEM claim"
  },
  {
    denied:
      "Named customer logos / case studies / ARR / reference calls with zero consented production partners",
    substitute:
      "Honest design-partner stage: zero public references; offer labeled lab proof and schedule a reference when written consent exists (P12-6 / P08-2)"
  },
  {
    denied:
      "Magic Quadrant / Wave Leaders-ready or market-presence Pass while publicReferenceCount = 0",
    substitute:
      "MQ market presence Fail until ≥3 production partners with signed reference permission; internal scorecard is not MQ/Wave progress"
  },
  {
    denied:
      "Demo tenant / sample /demo / lab E2E as a customer reference or peer proof",
    substitute:
      "Label sample and lab paths as non-customer; only consented production deploys fill the reference pack"
  }
] as const;

export type GtmClaimLanguageSummary = {
  prove: readonly string[];
  integrate: readonly {
    plane: string;
    job: string;
    never: string;
  }[];
  deny: readonly {
    denied: string;
    substitute: string;
  }[];
  matrixSource: "docs/COMPETITIVE_COVERAGE_MATRIX.md";
  denyListDoc: "docs/competitive/CLAIM_DENY_LIST.md";
};

export function getGtmClaimLanguageSummary(): GtmClaimLanguageSummary {
  return {
    prove: GTM_PROVE_CLAIMS,
    integrate: GTM_INTEGRATE_PLANES,
    deny: GTM_DENY_PHRASES,
    matrixSource: "docs/COMPETITIVE_COVERAGE_MATRIX.md",
    denyListDoc: "docs/competitive/CLAIM_DENY_LIST.md"
  };
}

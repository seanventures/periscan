import { describe, expect, it } from "vitest";

import {
  canonicalKeyForAdvisory,
  canonicalKeyForCve,
  canonicalKeyForIoc,
  detectIoc,
  ipv4InCidr,
  maxSeverity,
  mergeThreatIntelFields,
  normalizeCveId,
  normalizeSeverity,
  parentDomainSuffixes,
  severityFromCvss,
  type MergeableThreatIntelFields
} from "./threat-intel";

describe("canonical keys (cross-feed dedup identity)", () => {
  it("keys a CVE case-insensitively and rejects malformed ids", () => {
    expect(canonicalKeyForCve("cve-2026-1234")).toBe("cve:CVE-2026-1234");
    expect(canonicalKeyForCve("  CVE-2026-1234 ")).toBe("cve:CVE-2026-1234");
    expect(canonicalKeyForCve("not-a-cve")).toBeNull();
    expect(canonicalKeyForCve("CVE-26-1")).toBeNull();
  });

  it("keys IOCs by detected type + normalized value", () => {
    expect(canonicalKeyForIoc("1.2.3.4")).toBe("ioc:ipv4:1.2.3.4");
    expect(canonicalKeyForIoc("Evil.COM")).toBe("ioc:domain:evil.com");
    expect(canonicalKeyForIoc("HTTPS://Bad.test/x")).toBe(
      "ioc:url:https://bad.test/x"
    );
    expect(canonicalKeyForIoc("d41d8cd98f00b204e9800998ecf8427e")).toBe(
      "ioc:md5:d41d8cd98f00b204e9800998ecf8427e"
    );
    // 64-hex => sha256
    expect(canonicalKeyForIoc("a".repeat(64))).toBe(
      `ioc:sha256:${"a".repeat(64)}`
    );
    expect(canonicalKeyForIoc("999.999.999.999")).toBeNull();
    expect(canonicalKeyForIoc("just some text")).toBeNull();
  });

  it("strips trailing punctuation that clings to extracted indicators", () => {
    expect(detectIoc("evil.com).")).toEqual({
      type: "domain",
      value: "evil.com"
    });
  });

  it("keys advisories per-source (shared CVEs dedup at the vuln level)", () => {
    expect(canonicalKeyForAdvisory("CISA", "AA26-001A")).toBe(
      "advisory:cisa:AA26-001A"
    );
  });
});

describe("severity normalization", () => {
  it("maps CVSS base scores to v3 bands", () => {
    expect(severityFromCvss(9.8)).toBe("Critical");
    expect(severityFromCvss(7.0)).toBe("High");
    expect(severityFromCvss(5.5)).toBe("Medium");
    expect(severityFromCvss(0.1)).toBe("Low");
    expect(severityFromCvss(0)).toBe("None");
    expect(severityFromCvss(null)).toBe("Unknown");
  });

  it("coerces vendor labels (importance/moderate) and picks the worst", () => {
    expect(normalizeSeverity("Important")).toBe("High");
    expect(normalizeSeverity("moderate")).toBe("Medium");
    expect(maxSeverity("Low", "Critical")).toBe("Critical");
    expect(maxSeverity("Unknown", "Medium")).toBe("Medium");
  });
});

describe("mergeThreatIntelFields (cross-feed merge is fail-loud, never downgrades)", () => {
  const base: MergeableThreatIntelFields = {
    title: "CVE-2026-1234 in acme/widget",
    summary: "Initial NVD summary.",
    cveIds: ["CVE-2026-1234"],
    cvssScore: 7.5,
    epssScore: 0.2,
    severity: "High",
    kev: false,
    kevRansomware: false,
    techniqueIds: ["T1190"],
    tags: ["nvd"],
    publishedAt: "2026-06-10T00:00:00.000Z"
  };

  it("unions indicators, takes worst severity + max scores, ORs KEV, keeps earliest publish", () => {
    const merged = mergeThreatIntelFields(base, {
      title: "later report",
      summary: "",
      cveIds: ["CVE-2026-1234", "CVE-2026-9999"],
      cvssScore: 9.1,
      epssScore: 0.05,
      severity: "Critical",
      kev: true,
      kevRansomware: true,
      techniqueIds: ["T1059"],
      tags: ["cisa-kev"],
      publishedAt: "2026-06-12T00:00:00.000Z"
    });

    expect(merged.cveIds).toEqual(["CVE-2026-1234", "CVE-2026-9999"]);
    expect(merged.techniqueIds).toEqual(["T1059", "T1190"]);
    expect(merged.tags).toEqual(["cisa-kev", "nvd"]);
    // worst-wins, not last-wins
    expect(merged.severity).toBe("Critical");
    expect(merged.cvssScore).toBe(9.1);
    // max, so the higher EPSS is kept (a later, lower report never downgrades)
    expect(merged.epssScore).toBe(0.2);
    expect(merged.kev).toBe(true);
    expect(merged.kevRansomware).toBe(true);
    // earliest known publish is retained
    expect(merged.publishedAt).toBe("2026-06-10T00:00:00.000Z");
    // existing non-empty title/summary preserved
    expect(merged.title).toBe("CVE-2026-1234 in acme/widget");
    expect(merged.summary).toBe("Initial NVD summary.");
  });

  it("a later, blander report never downgrades a KEV/critical item", () => {
    const escalated: MergeableThreatIntelFields = {
      ...base,
      severity: "Critical",
      kev: true
    };
    const merged = mergeThreatIntelFields(escalated, {
      severity: "Low",
      kev: false,
      cvssScore: 2.0
    });
    expect(merged.severity).toBe("Critical");
    expect(merged.kev).toBe(true);
    expect(merged.cvssScore).toBe(7.5);
  });

  it("fills an empty existing title/summary from the incoming report", () => {
    const empty: MergeableThreatIntelFields = {
      ...base,
      title: "",
      summary: ""
    };
    const merged = mergeThreatIntelFields(empty, {
      title: "Recovered title",
      summary: "Recovered summary"
    });
    expect(merged.title).toBe("Recovered title");
    expect(merged.summary).toBe("Recovered summary");
  });
});

describe("attack-surface matching helpers", () => {
  it("parentDomainSuffixes yields apex-down suffixes, excluding the bare TLD", () => {
    expect(parentDomainSuffixes("login.acme.com")).toEqual([
      "login.acme.com",
      "acme.com"
    ]);
    expect(parentDomainSuffixes("acme.com")).toEqual(["acme.com"]);
    expect(parentDomainSuffixes("a.b.acme.co.uk")).toEqual([
      "a.b.acme.co.uk",
      "b.acme.co.uk",
      "acme.co.uk",
      "co.uk"
    ]);
    expect(parentDomainSuffixes("localhost")).toEqual([]);
  });

  it("ipv4InCidr does containment and rejects malformed input", () => {
    expect(ipv4InCidr("10.0.0.5", "10.0.0.0/24")).toBe(true);
    expect(ipv4InCidr("10.0.1.5", "10.0.0.0/24")).toBe(false);
    expect(ipv4InCidr("192.168.4.7", "192.168.0.0/16")).toBe(true);
    expect(ipv4InCidr("203.0.113.9", "203.0.113.9/32")).toBe(true);
    expect(ipv4InCidr("1.2.3.4", "0.0.0.0/0")).toBe(true);
    expect(ipv4InCidr("nope", "10.0.0.0/24")).toBe(false);
    expect(ipv4InCidr("10.0.0.5", "10.0.0.0/33")).toBe(false);
    expect(ipv4InCidr("10.0.0.5", "not-a-cidr")).toBe(false);
  });
});

describe("normalizeCveId", () => {
  it("normalizes and validates", () => {
    expect(normalizeCveId("cve-2026-0001")).toBe("CVE-2026-0001");
    expect(normalizeCveId("garbage")).toBeNull();
  });
});

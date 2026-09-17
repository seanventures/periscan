import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  importedFindingsToSignals,
  parseCsvScan,
  parseNessusScan,
  parseSarifScan,
  parseScanFile
} from "./scan-importers";

const NOW = "2026-07-06T00:00:00.000Z";

describe("scan-file importers", () => {
  it("parses a Nessus (.nessus) export into normalized findings", () => {
    const xml = `<?xml version="1.0"?><NessusClientData_v2><Report>
      <ReportHost name="10.0.0.5">
        <ReportItem severity="4" pluginName="Apache RCE"><cve>CVE-2021-41773</cve></ReportItem>
        <ReportItem severity="2" pluginName="Weak TLS"></ReportItem>
      </ReportHost></Report></NessusClientData_v2>`;
    const findings = parseNessusScan(xml);
    expect(findings).toHaveLength(2);
    expect(findings[0]).toMatchObject({
      host: "10.0.0.5",
      severity: "Critical",
      title: "Apache RCE"
    });
    expect(findings[0]?.cveIds).toContain("CVE-2021-41773");
    expect(findings[1]?.severity).toBe("Medium");
  });

  it("parses a CSV export by header aliases", () => {
    const csv = [
      "Host,Severity,Name,CVE",
      "web-01,High,Outdated OpenSSL,CVE-2022-0778",
      '"db-01","Critical","SQL injection",'
    ].join("\n");
    const findings = parseCsvScan(csv);
    expect(findings).toHaveLength(2);
    expect(findings[0]).toMatchObject({ host: "web-01", severity: "High" });
    expect(findings[0]?.cveIds).toContain("CVE-2022-0778");
    expect(findings[1]).toMatchObject({ host: "db-01", severity: "Critical" });
  });

  it("parses a SARIF log into findings", () => {
    const sarif = JSON.stringify({
      runs: [
        {
          tool: { driver: { name: "Semgrep" } },
          results: [
            {
              level: "error",
              ruleId: "sql-injection",
              message: { text: "Possible SQL injection" },
              locations: [
                {
                  physicalLocation: { artifactLocation: { uri: "src/db.ts" } }
                }
              ]
            }
          ]
        }
      ]
    });
    const findings = parseSarifScan(sarif);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      host: "src/db.ts",
      severity: "High",
      title: "Possible SQL injection",
      vendor: "Semgrep"
    });
  });

  it("normalizes imported findings into correlatable Exposure signals", () => {
    const findings = parseScanFile("csv", "Host,Severity,Name\nweb-01,High,X");
    const signals = importedFindingsToSignals(findings, {
      nowIso: NOW,
      tenantId: randomUUID()
    });
    expect(signals).toHaveLength(1);
    expect(signals[0]?.signalCategory).toBe("Exposure");
    expect(signals[0]?.signalSubcategory).toBe("ImportedScanFinding");
    expect(signals[0]?.rawPayloadPointer).toContain("web-01");
    expect(signals[0]?.rawPayloadPointer).toContain("evidenceBasis=Imported");
    expect(signals[0]?.sourceType).toBe("import.csv");
  });
});

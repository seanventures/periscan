import { describe, expect, it } from "vitest";

import {
  ScanFileImportHonestySchema,
  buildScanFileImportHonesty
} from "./domain.js";

describe("scan-file import honesty (P11R-4 / P19-r4)", () => {
  it("reports ApiAvailable + uiUpload with Partial raw-chain integrity", () => {
    const honesty = buildScanFileImportHonesty();
    expect(ScanFileImportHonestySchema.parse(honesty)).toEqual(honesty);
    expect(honesty.status).toBe("Partial");
    expect(honesty.productPath).toBe("ApiAvailable");
    expect(honesty.libraryAvailable).toBe(true);
    expect(honesty.evidenceBasis).toBe("Imported");
    expect(honesty.uiUpload).toBe(true);
    expect(honesty.formats).toEqual(["nessus", "csv", "sarif"]);
    expect(honesty.detail.toLowerCase()).toMatch(/imported/);
    expect(honesty.detail).toMatch(/scan-import|importScanFile|ApiAvailable|POST/i);
    expect(honesty.detail).toMatch(/Partial|incomplete/i);
    // Never dual-truth NotConfigured while the product API + UI ship
    expect(honesty.status).not.toBe("NotConfigured");
    expect(honesty.productPath).not.toBe("NotConfigured");
  });
});

import { describe, expect, it } from "vitest";

import { safeInternalNextPath } from "./safe-next-path";

describe("safeInternalNextPath", () => {
  it("accepts same-origin relative deep links", () => {
    expect(safeInternalNextPath("/findings")).toBe("/findings");
    expect(safeInternalNextPath("/missions/abc?tab=1")).toBe(
      "/missions/abc?tab=1"
    );
    expect(safeInternalNextPath("/evidence#ledger")).toBe("/evidence#ledger");
    expect(safeInternalNextPath("  /remediation  ")).toBe("/remediation");
  });

  it("rejects missing and empty values", () => {
    expect(safeInternalNextPath(null)).toBeNull();
    expect(safeInternalNextPath(undefined)).toBeNull();
    expect(safeInternalNextPath("")).toBeNull();
    expect(safeInternalNextPath("   ")).toBeNull();
  });

  it("rejects open redirects and non-relative targets", () => {
    expect(safeInternalNextPath("//evil.com")).toBeNull();
    expect(safeInternalNextPath("//evil.com/phish")).toBeNull();
    expect(safeInternalNextPath("https://evil.com")).toBeNull();
    expect(safeInternalNextPath("http://evil.com/path")).toBeNull();
    expect(safeInternalNextPath("https://evil.com/path")).toBeNull();
    expect(safeInternalNextPath("evil.com")).toBeNull();
    expect(safeInternalNextPath("findings")).toBeNull();
    expect(safeInternalNextPath("\\\\evil.com")).toBeNull();
    expect(safeInternalNextPath("/\\evil.com")).toBeNull();
    expect(safeInternalNextPath("/%2f%2fevil.com")).toBeNull();
    expect(safeInternalNextPath("/login")).toBeNull();
    expect(safeInternalNextPath("/signup")).toBeNull();
    expect(safeInternalNextPath("/login?x=1")).toBeNull();
  });
});

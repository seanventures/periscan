import { describe, expect, it } from "vitest";

import {
  base32Decode,
  base32Encode,
  buildOtpauthUri,
  generateTotp,
  generateTotpSecret,
  verifyTotp
} from "./totp.js";

// RFC 6238 Appendix B reference secret (ASCII "12345678901234567890").
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("base32", () => {
  it("round-trips arbitrary bytes", () => {
    const bytes = Buffer.from([0, 1, 2, 250, 255, 128, 64, 32]);
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
  });

  it("rejects invalid characters", () => {
    expect(() => base32Decode("not-base32!")).toThrow(/Invalid base32/u);
  });
});

describe("generateTotp (RFC 6238 vectors, 6 digits SHA-1)", () => {
  const cases: Array<[number, string]> = [
    [59, "287082"],
    [1111111109, "081804"],
    [1111111111, "050471"],
    [1234567890, "005924"],
    [2000000000, "279037"],
    [20000000000, "353130"]
  ];

  for (const [seconds, expected] of cases) {
    it(`t=${seconds} -> ${expected}`, () => {
      expect(generateTotp(RFC_SECRET, seconds * 1000)).toBe(expected);
    });
  }
});

describe("generateTotpSecret", () => {
  it("produces a decodable 160-bit (20-byte) secret by default", () => {
    const secret = generateTotpSecret();
    expect(base32Decode(secret)).toHaveLength(20);
  });
});

describe("verifyTotp", () => {
  it("accepts the current code", () => {
    const now = 1_700_000_000_000;
    const code = generateTotp(RFC_SECRET, now);
    expect(verifyTotp(RFC_SECRET, code, now)).toBe(true);
  });

  it("accepts a code from the previous step (clock skew window)", () => {
    const now = 1_700_000_000_000;
    const previous = generateTotp(RFC_SECRET, now - 30_000);
    expect(verifyTotp(RFC_SECRET, previous, now, { window: 1 })).toBe(true);
  });

  it("rejects a code outside the window", () => {
    const now = 1_700_000_000_000;
    const stale = generateTotp(RFC_SECRET, now - 5 * 30_000);
    expect(verifyTotp(RFC_SECRET, stale, now, { window: 1 })).toBe(false);
  });

  it("rejects non-numeric input", () => {
    expect(verifyTotp(RFC_SECRET, "abcdef", 1_700_000_000_000)).toBe(false);
  });
});

describe("buildOtpauthUri", () => {
  it("encodes secret, issuer, and account into an otpauth URI", () => {
    const uri = buildOtpauthUri({
      accountName: "user@example.com",
      issuer: "Periscan",
      secretBase32: RFC_SECRET
    });
    expect(uri.startsWith("otpauth://totp/")).toBe(true);
    expect(uri).toContain(`secret=${RFC_SECRET}`);
    expect(uri).toContain("issuer=Periscan");
    expect(uri).toContain("Periscan%3Auser%40example.com");
  });
});

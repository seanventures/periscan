import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// RFC 6238 (TOTP) / RFC 4226 (HOTP) implemented directly on node:crypto. TOTP is
// small and fully specified, and implementing it here (with RFC test-vector
// coverage) avoids taking a third-party dependency for security-critical code.
// Defaults: HMAC-SHA1, 6 digits, 30-second step — the values authenticator apps
// (Google Authenticator, 1Password, Authy, etc.) assume.

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const DEFAULT_STEP_SECONDS = 30;
const DEFAULT_DIGITS = 6;

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(input: string): Buffer {
  const cleaned = input.replace(/=+$/u, "").replace(/\s/gu, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error("Invalid base32 character in TOTP secret.");
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

// A fresh base32-encoded shared secret (160 bits by default, per RFC 6238).
export function generateTotpSecret(byteLength = 20): string {
  return base32Encode(randomBytes(byteLength));
}

function hotp(secret: Buffer, counter: number, digits: number): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", secret).update(counterBuffer).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return (binary % 10 ** digits).toString().padStart(digits, "0");
}

export interface TotpOptions {
  stepSeconds?: number;
  digits?: number;
}

export function generateTotp(
  secretBase32: string,
  atMs: number = Date.now(),
  options: TotpOptions = {}
): string {
  const step = options.stepSeconds ?? DEFAULT_STEP_SECONDS;
  const digits = options.digits ?? DEFAULT_DIGITS;
  const counter = Math.floor(atMs / 1000 / step);
  return hotp(base32Decode(secretBase32), counter, digits);
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

export interface TotpVerifyOptions extends TotpOptions {
  // Accept codes from +/- `window` steps to tolerate clock skew / slow entry.
  window?: number;
}

export function verifyTotp(
  secretBase32: string,
  token: string,
  atMs: number = Date.now(),
  options: TotpVerifyOptions = {}
): boolean {
  const step = options.stepSeconds ?? DEFAULT_STEP_SECONDS;
  const digits = options.digits ?? DEFAULT_DIGITS;
  const window = options.window ?? 1;
  const normalized = token.trim();
  if (!/^\d+$/u.test(normalized)) {
    return false;
  }
  const secret = base32Decode(secretBase32);
  const counter = Math.floor(atMs / 1000 / step);
  for (let drift = -window; drift <= window; drift += 1) {
    if (constantTimeEquals(hotp(secret, counter + drift, digits), normalized)) {
      return true;
    }
  }
  return false;
}

// otpauth:// provisioning URI an authenticator app reads from a QR code.
export function buildOtpauthUri(input: {
  secretBase32: string;
  accountName: string;
  issuer: string;
}): string {
  const label = encodeURIComponent(`${input.issuer}:${input.accountName}`);
  const params = new URLSearchParams({
    algorithm: "SHA1",
    digits: String(DEFAULT_DIGITS),
    issuer: input.issuer,
    period: String(DEFAULT_STEP_SECONDS),
    secret: input.secretBase32
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

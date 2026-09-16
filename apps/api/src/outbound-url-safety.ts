/**
 * Shared outbound HTTPS SSRF guard for control-plane egress (webhooks, feeds, etc.).
 *
 * HTTPS only · block private/link-local/metadata host literals · post-resolve DNS check.
 * Mirrors the threat-feed guard so webhook endpoints cannot target cloud metadata.
 *
 * ## P03-5 connect-pin residual (deferred)
 *
 * This helper validates that the hostname **currently** resolves only to public
 * addresses. It does **not** pin the subsequent TCP/TLS connect to those
 * addresses (no undici `Agent` / custom `connect`/`lookup` dispatcher in this
 * control plane). Callers that perform a fetch after this check MUST:
 *
 * 1. Re-invoke this guard (or `assertHostnameResolvesPublic` /
 *    `assertSafeWebhookDeliveryUrl` + post-resolve) **immediately before** the
 *    outbound request to shrink the DNS-rebinding TOCTOU window; and
 * 2. Prefer `redirect: "error"` so open redirects cannot hop to private IPs.
 *
 * True connect-pin (bind socket to the first resolved public address) is
 * deferred until an undici/Agent pin lands package-wide; see webhook delivery
 * re-resolve in `@periscan/webhooks` `processWebhookDelivery`.
 */
import type * as dnsPromises from "node:dns/promises";
import { isIP } from "node:net";

import { assertHostnameResolvesPublic } from "@periscan/policy";

import { AppServiceError } from "./runtime-services.js";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal"
]);

function isPrivateOrReservedIp(host: string): boolean {
  const family = isIP(host);
  if (family === 4) {
    const [a, b] = host.split(".").map((part) => Number(part));
    if (a === undefined || b === undefined) {
      return true;
    }
    if (a === 10 || a === 127 || a === 0) {
      return true;
    }
    if (a === 169 && b === 254) {
      return true;
    }
    if (a === 172 && b >= 16 && b <= 31) {
      return true;
    }
    if (a === 192 && b === 168) {
      return true;
    }
    if (a === 100 && b >= 64 && b <= 127) {
      return true;
    }
    if (a >= 224) {
      return true;
    }
    return false;
  }
  if (family === 6) {
    const lower = host.toLowerCase();
    if (lower === "::1" || lower === "::") {
      return true;
    }
    if (
      lower.startsWith("fe80") ||
      lower.startsWith("fc") ||
      lower.startsWith("fd")
    ) {
      return true;
    }
    if (lower.startsWith("::ffff:")) {
      return isPrivateOrReservedIp(lower.slice("::ffff:".length));
    }
    return false;
  }
  return false;
}

/**
 * Reject unsafe outbound HTTPS URLs before any control-plane fetch.
 * `lookup` is injectable for unit tests only.
 *
 * Returns the resolved public addresses so callers can log or (when connect-pin
 * lands) pin the socket. Connect-pin itself is deferred — see file header.
 */
export async function assertSafeOutboundHttpsUrl(
  rawUrl: string,
  options: {
    code?: string;
    label?: string;
    lookup?: typeof dnsPromises.lookup;
  } = {}
): Promise<{ addresses: string[] }> {
  const label = options.label ?? "Outbound URL";
  const code = options.code ?? "unsafe_outbound_url";
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new AppServiceError(`${label} is not a valid URL.`, 400, code);
  }
  if (parsed.protocol !== "https:") {
    throw new AppServiceError(`${label} must use https.`, 400, code);
  }
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/gu, "");
  if (
    BLOCKED_HOSTNAMES.has(host) ||
    host.endsWith(".internal") ||
    host.endsWith(".local") ||
    (isIP(host) > 0 && isPrivateOrReservedIp(host))
  ) {
    throw new AppServiceError(
      `${label} targets a disallowed internal or reserved host.`,
      400,
      code
    );
  }

  const resolved = await assertHostnameResolvesPublic(host, options.lookup);
  if (!resolved.ok) {
    throw new AppServiceError(
      `${label} failed post-resolve SSRF check: ${resolved.rationale}`,
      400,
      code
    );
  }
  return { addresses: resolved.addresses };
}

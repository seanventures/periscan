import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import dns from "node:dns";
import dnsPromises from "node:dns/promises";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import { createPrismaEvidenceService } from "../../packages/evidence/src/storage.js";

// ---------------------------------------------------------------------------
// WS1 — the honest MEASURED closed loop, live (no fixtures).
//
// This test drives Periscan's REAL measured path (buildApp + createRuntimeServices
// → signup → verified Domain scope → POST /posture-check {executionMode:"LiveSafe"})
// against the committed containerized test range (infra/test-range). It proves:
//
//   1. the EXPOSED range measures as an EXPOSURE  — validationState=Validated,
//      an Exposure-category signal, evidenceBasis=Measured (attributes.measured);
//   2. after the range is HARDENED (RANGE_PROFILE=hardened docker compose up -d),
//      the SAME live probe measures the SAME dimension as FIXED — no exposure.
//
// LiveSafe forces the real network path even in devMode (useFixture = devMode &&
// executionMode !== "LiveSafe" in services/scopes.ts), so every conclusion here is
// earned by measurement.
//
// ── Platform reality (verified on macOS Docker Desktop; see infra/test-range/README) ──
//   • HTTP + TLS modules (cert, http health/cors/cookie/redirect) work host-side
//     everywhere → the closed loop for those is asserted on every platform.
//   • The 3 DNS modules (resolution, caa, email) need a working host→container UDP
//     path to CoreDNS, which Docker Desktop on macOS does not provide (published
//     UDP times out; TCP + container-to-container UDP work). Node's c-ares resolver
//     starts on UDP, so those modules can't reach the zone from a mac host. They
//     are gated behind RUN_MEASURED_DNS (set on Linux CI, where published UDP works)
//     and auto-skipped otherwise — never asserted against the wrong resolver.
//   • tls_protocol_audit needs the target to negotiate TLS 1.0/1.1; modern host
//     OpenSSL refuses that, so it reports Inconclusive on macOS. It is asserted
//     "best effort": never a false pass on the hardened profile.
//
// ── Prerequisite (the one thing this test cannot self-arrange) ──
//   NODE_EXTRA_CA_CERTS must point at the range's local CA at process startup, so
//   global fetch (undici) trusts the CA-signed leaf on app.range.test. Node reads
//   NODE_EXTRA_CA_CERTS once at boot, so it must be set BEFORE vitest launches. Run
//   this test via `tests/e2e-measured/run-macos.sh` (which brings the range up,
//   extracts the CA, sets the env, and runs vitest) or via the measured-loop CI
//   workflow. The cert module uses rejectUnauthorized:false and needs no CA trust.
//
// Everything else (copying the range under $HOME to dodge the /Volumes bind-mount
// caveat, docker compose up, the exposed→hardened flip, dns.lookup mapping, teardown)
// is self-managed below.
// ---------------------------------------------------------------------------

const RUN = process.env.RUN_MEASURED_E2E === "1";
// DNS modules: opt-in (Linux CI). Auto-confirmed reachable in beforeAll before use.
const DNS_REQUESTED = process.env.RUN_MEASURED_DNS === "1";
const RANGE_DNS_SERVER = process.env.RANGE_DNS_SERVER ?? "127.0.0.1:5354";

const SESSION_COOKIE_NAME = "periscan_session";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..");
const RANGE_SRC = path.join(REPO_ROOT, "infra", "test-range");
// On Linux (CI) the checked-out path bind-mounts fine, so RANGE_DIR is passed
// through unchanged. On macOS the wrapper/self-copy places it under $HOME.
const RANGE_DIR = process.env.RANGE_DIR
  ? path.resolve(process.env.RANGE_DIR)
  : path.join(homedir(), ".periscan-measured-range");

const APP_HOST = "app.range.test";
const CERT_HOST = "cert.range.test";
const DANGLING_HOST = "dangling.range.test";

// The HTTP exposure↔Fixed modules that run host-side on every platform.
const HTTP_APP_MODULES = [
  "periscan.http_health_check",
  "periscan.http_cors_audit",
  "periscan.http_cookie_security",
  "periscan.http_redirect_enforcement"
];
const CERT_MODULE = "periscan.tls_certificate_check";
const PROTOCOL_MODULE = "periscan.tls_protocol_audit";
const SECURITY_TXT_MODULE = "periscan.well_known_security_txt";
const DNS_APP_MODULES = [
  "periscan.dns_caa_check",
  "periscan.dns_email_security_check"
];
const DNS_DANGLING_MODULE = "periscan.dns_resolution_check";

type PostureCheck = {
  exposure: boolean;
  moduleId: string;
  outcome: string;
  signalCount: number;
  validationState: string | null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Map *.range.test → 127.0.0.1 in-process (no sudo /etc/hosts). tls.connect (net)
// and fetch (undici) both resolve through dns.lookup/getaddrinfo, so this covers
// every HTTP/TLS module. DNS modules use node:dns/promises resolve* (a different
// path) and are steered via dns.setServers instead.
function installRangeDnsLookup() {
  const realLookup = dns.lookup.bind(dns) as typeof dns.lookup;
  const patched = ((hostname: string, options: unknown, callback?: unknown) => {
    let cb = callback as ((...args: unknown[]) => void) | undefined;
    let opts = options as { all?: boolean } | undefined;
    if (typeof options === "function") {
      cb = options as (...args: unknown[]) => void;
      opts = undefined;
    }
    if (typeof hostname === "string" && hostname.endsWith(".range.test") && cb) {
      if (opts && opts.all) {
        process.nextTick(cb, null, [{ address: "127.0.0.1", family: 4 }]);
      } else {
        process.nextTick(cb, null, "127.0.0.1", 4);
      }
      return undefined;
    }
    return (realLookup as (...args: unknown[]) => unknown)(
      hostname,
      options,
      callback
    );
  }) as unknown as typeof dns.lookup;
  dns.lookup = patched;
}

function compose(profile: string, args: string[]) {
  return execFileSync("docker", ["compose", ...args], {
    cwd: RANGE_DIR,
    encoding: "utf8",
    env: { ...process.env, RANGE_PROFILE: profile },
    stdio: ["ignore", "pipe", "pipe"]
  });
}

// Poll until nginx serves the expected profile. The presence of an HSTS header on
// https://app.range.test/ deterministically distinguishes hardened (present) from
// exposed (absent), so we never race an in-flight `docker compose up` reload.
async function waitForProfile(hardened: boolean, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let lastErr = "";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`https://${APP_HOST}/`, {
        redirect: "manual"
      });
      const hasHsts = Boolean(
        response.headers.get("strict-transport-security")
      );
      await response.arrayBuffer().catch(() => undefined);
      if (hasHsts === hardened) {
        return;
      }
      lastErr = `hsts=${hasHsts} want hardened=${hardened}`;
    } catch (error) {
      lastErr = error instanceof Error ? error.message : String(error);
    }
    await sleep(1000);
  }
  throw new Error(
    `Range did not reach ${hardened ? "hardened" : "exposed"} profile in time (${lastErr}). ` +
      `Is the range up and is NODE_EXTRA_CA_CERTS pointed at the range CA?`
  );
}

async function setProfile(hardened: boolean) {
  compose(hardened ? "hardened" : "exposed", ["up", "-d"]);
  await waitForProfile(hardened);
}

async function runPosture(
  app: Awaited<ReturnType<typeof buildApp>>,
  cookie: string,
  scopeId: string
): Promise<Map<string, PostureCheck>> {
  const response = await app.inject({
    cookies: { [SESSION_COOKIE_NAME]: cookie },
    method: "POST",
    payload: { executionMode: "LiveSafe" },
    url: `/api/v1/scopes/${scopeId}/posture-check`
  });
  expect(response.statusCode, response.payload).toBe(201);
  const checks = response.json().checks as PostureCheck[];
  return new Map(checks.map((check) => [check.moduleId, check]));
}

function pick(map: Map<string, PostureCheck>, moduleId: string): PostureCheck {
  const check = map.get(moduleId);
  expect(check, `posture check missing module ${moduleId}`).toBeTruthy();
  return check!;
}

// Strengthen the "Measured" claim beyond the response flags: read the persisted
// RawModuleOutput evidence for the module's most-recent run and confirm the module
// stamped attributes.measured=true (the live-probe marker) and the same
// validationState. This is what makes evidenceBasis=Measured earned, not asserted.
async function assertMeasuredEvidence(
  prisma: ReturnType<typeof createPrismaClient>,
  tenantId: string,
  scopeId: string,
  moduleId: string,
  expectedValidationState: string
) {
  const run = await prisma.validationRun.findFirst({
    orderBy: { createdAt: "desc" },
    where: { moduleId, scopeId, tenantId }
  });
  expect(run, `no ValidationRun for ${moduleId}`).toBeTruthy();

  const rawArtifact = await prisma.evidenceArtifact.findFirst({
    orderBy: { createdAt: "desc" },
    where: {
      artifactType: "RawModuleOutput",
      relatedEntityId: run!.runId,
      relatedEntityType: "ValidationRun",
      tenantId
    }
  });
  expect(rawArtifact, `no RawModuleOutput for ${moduleId}`).toBeTruthy();

  const evidenceService = createPrismaEvidenceService({ prisma });
  const stored = await evidenceService.getEvidenceArtifact(
    rawArtifact!.evidenceId,
    tenantId
  );
  expect(stored, `evidence unreadable for ${moduleId}`).toBeTruthy();

  const content = JSON.parse(stored!.content) as {
    evidence?: Array<{ attributes?: { measured?: unknown } }>;
    validationState?: string;
  };
  expect(content.validationState, `${moduleId} validationState`).toBe(
    expectedValidationState
  );
  const anyMeasured = (content.evidence ?? []).some(
    (item) => item.attributes?.measured === true
  );
  expect(
    anyMeasured,
    `${moduleId} evidence must carry attributes.measured=true (evidenceBasis=Measured)`
  ).toBe(true);
}

const describeMaybe = RUN ? describe : describe.skip;

describeMaybe("Measured closed loop: live range exposed → Validated, hardened → Fixed", () => {
  const prisma = createPrismaClient();
  let app: Awaited<ReturnType<typeof buildApp>>;
  let cookie = "";
  let tenantId = "";
  let appScopeId = "";
  let certScopeId = "";
  let danglingScopeId = "";
  let dnsEnabled = false;
  let protocolNegotiatedExposed: string | null = null;

  beforeAll(async () => {
    // 1. Ensure the range lives at RANGE_DIR (copy from the repo when the caller
    //    did not stage it — sidesteps the macOS /Volumes bind-mount caveat).
    if (!existsSync(path.join(RANGE_DIR, "docker-compose.yml"))) {
      mkdirSync(RANGE_DIR, { recursive: true });
      cpSync(RANGE_SRC, RANGE_DIR, { recursive: true });
    }

    // 2. In-process host mapping for the TLS/HTTP modules.
    installRangeDnsLookup();

    // 3. Bring up the EXPOSED profile and wait until it actually serves it.
    await setProfile(false);

    // 4. DNS modules: only if reachable through the configured resolver. On Linux
    //    CI (RUN_MEASURED_DNS=1) published UDP works; confirm before trusting it.
    if (DNS_REQUESTED) {
      dns.setServers([RANGE_DNS_SERVER]);
      try {
        const cname = await Promise.race([
          dnsPromises.resolveCname(DANGLING_HOST),
          sleep(4000).then(() => {
            throw new Error("resolver timeout");
          })
        ]);
        dnsEnabled = Array.isArray(cname) && cname.length > 0;
      } catch {
        dnsEnabled = false;
      }
      if (!dnsEnabled) {
        // Reset to the system resolver so the (unasserted) DNS modules don't hang
        // on an unreachable server every posture run.
        dns.setServers(dns.getServers().filter((s) => s !== RANGE_DNS_SERVER));
      }
    }

    // 5. Real product path: build the app against the live test DB.
    app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: process.env.PERISCAN_DATA_REGION ?? "us-east-1",
        devMode: true,
        missionQueue: {
          async enqueueValidationJob() {
            return;
          }
        },
        prisma,
        webhookQueue: null
      })
    });

    const signup = await app.inject({
      method: "POST",
      payload: {
        email: `measured-loop-${randomUUID()}@periscan.test`,
        name: "Measured Loop Owner",
        password: "periscan-measured-loop-password",
        tenantName: "Measured Loop Tenant"
      },
      url: "/api/v1/auth/signup"
    });
    expect(signup.statusCode, signup.payload).toBe(201);
    cookie = signup.cookies.find((c) => c.name === SESSION_COOKIE_NAME)!.value;
    tenantId = signup.json().tenant.tenantId as string;

    // Create + verify a Domain scope per range host. (devModeManual verification;
    // the range's CoreDNS could also carry the _periscan TXT token on Linux.)
    for (const host of [APP_HOST, CERT_HOST, DANGLING_HOST]) {
      const created = await app.inject({
        cookies: { [SESSION_COOKIE_NAME]: cookie },
        method: "POST",
        payload: { scopeType: "Domain", value: host },
        url: "/api/v1/scopes"
      });
      expect(created.statusCode, created.payload).toBe(201);
      const scopeId = created.json().scopeId as string;
      await app.inject({
        cookies: { [SESSION_COOKIE_NAME]: cookie },
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });
      if (host === APP_HOST) appScopeId = scopeId;
      if (host === CERT_HOST) certScopeId = scopeId;
      if (host === DANGLING_HOST) danglingScopeId = scopeId;
    }
  }, 180_000);

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
    if (process.env.KEEP_MEASURED_RANGE !== "1") {
      try {
        compose("exposed", ["down", "-v"]);
      } catch {
        // Best-effort teardown; the caller/CI may own lifecycle.
      }
    }
  }, 120_000);

  it("EXPOSED profile: live probes measure Validated exposures (evidenceBasis=Measured)", async () => {
    await setProfile(false);

    // Scope A — app.range.test: the four HTTP exposures.
    const appChecks = await runPosture(app, cookie, appScopeId);
    for (const moduleId of HTTP_APP_MODULES) {
      const check = pick(appChecks, moduleId);
      // The exposed range reflects an arbitrary origin AND allows credentials, so
      // the CORS probe measures a WORKING EXPLOIT (Exploitable), not just a
      // flagged misconfiguration — measured exploitability, actively confirmed.
      const expected =
        moduleId === "periscan.http_cors_audit" ? "Exploitable" : "Validated";
      expect(check.validationState, moduleId).toBe(expected);
      expect(check.exposure, moduleId).toBe(true);
      expect(check.signalCount, moduleId).toBeGreaterThan(0);
    }
    // The Exploitable verdict carries evidenceBasis=Measured (read back from the
    // persisted evidence) — a measured, actively-confirmed exploitability claim.
    await assertMeasuredEvidence(
      prisma,
      tenantId,
      appScopeId,
      "periscan.http_cors_audit",
      "Exploitable"
    );
    // security.txt is informational: a ControlObservation, never an exposure.
    expect(pick(appChecks, SECURITY_TXT_MODULE).exposure).toBe(false);
    // Best-effort protocol audit: Validated if the host negotiated TLS 1.0/1.1,
    // else Inconclusive — never a false Fixed on an exposed target.
    const protocolExposed = pick(appChecks, PROTOCOL_MODULE);
    protocolNegotiatedExposed = protocolExposed.validationState;
    expect(protocolExposed.validationState, PROTOCOL_MODULE).not.toBe("Fixed");

    // Scope B — cert.range.test: the expired-certificate exposure.
    const certChecks = await runPosture(app, cookie, certScopeId);
    const certExposed = pick(certChecks, CERT_MODULE);
    expect(certExposed.validationState).toBe("Validated");
    expect(certExposed.exposure).toBe(true);

    // evidenceBasis=Measured, proven from persisted evidence for two dimensions.
    await assertMeasuredEvidence(
      prisma,
      tenantId,
      certScopeId,
      CERT_MODULE,
      "Validated"
    );
    await assertMeasuredEvidence(
      prisma,
      tenantId,
      appScopeId,
      "periscan.http_health_check",
      "Validated"
    );

    // DNS dimensions — Linux only, when the resolver is confirmed reachable.
    if (dnsEnabled) {
      for (const moduleId of DNS_APP_MODULES) {
        const check = pick(appChecks, moduleId);
        expect(check.validationState, moduleId).toBe("Validated");
        expect(check.exposure, moduleId).toBe(true);
      }
      const danglingChecks = await runPosture(app, cookie, danglingScopeId);
      const dangling = pick(danglingChecks, DNS_DANGLING_MODULE);
      expect(dangling.validationState).toBe("Validated");
      expect(dangling.exposure).toBe(true);
    }
  }, 180_000);

  it("HARDENED profile: the SAME live probes measure Fixed (the closed loop)", async () => {
    await setProfile(true);

    // Scope A — every HTTP exposure now measures Fixed with no exposure signal.
    const appChecks = await runPosture(app, cookie, appScopeId);
    for (const moduleId of HTTP_APP_MODULES) {
      const check = pick(appChecks, moduleId);
      expect(check.validationState, moduleId).toBe("Fixed");
      expect(check.exposure, moduleId).toBe(false);
    }
    // Never a false pass on protocol audit: it must not report Validated hardened.
    expect(pick(appChecks, PROTOCOL_MODULE).validationState).not.toBe(
      "Validated"
    );

    // Scope B — the certificate now measures Fixed.
    const certChecks = await runPosture(app, cookie, certScopeId);
    const certFixed = pick(certChecks, CERT_MODULE);
    expect(certFixed.validationState).toBe("Fixed");
    expect(certFixed.exposure).toBe(false);

    await assertMeasuredEvidence(
      prisma,
      tenantId,
      certScopeId,
      CERT_MODULE,
      "Fixed"
    );
    await assertMeasuredEvidence(
      prisma,
      tenantId,
      appScopeId,
      "periscan.http_health_check",
      "Fixed"
    );

    if (dnsEnabled) {
      const appHardened = appChecks;
      for (const moduleId of DNS_APP_MODULES) {
        const check = pick(appHardened, moduleId);
        expect(check.validationState, moduleId).toBe("Fixed");
        expect(check.exposure, moduleId).toBe(false);
      }
      const danglingChecks = await runPosture(app, cookie, danglingScopeId);
      const dangling = pick(danglingChecks, DNS_DANGLING_MODULE);
      expect(dangling.validationState).toBe("Fixed");
      expect(dangling.exposure).toBe(false);
    }

    console.log(
      `[measured-loop] closed loop proven live: HTTP(${HTTP_APP_MODULES.length}) + TLS cert; ` +
        `protocol_audit=${protocolNegotiatedExposed ?? "n/a"} (best-effort); ` +
        `DNS modules ${dnsEnabled ? "asserted (resolver reachable)" : "skipped (resolver not reachable on this host)"}.`
    );
  }, 180_000);
});

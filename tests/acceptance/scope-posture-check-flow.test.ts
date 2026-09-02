import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";

const SESSION_COOKIE_NAME = "periscan_session";
const DAY_MS = 24 * 60 * 60 * 1000;

function uniqueEmail(prefix: string) {
  return `${prefix}-${randomUUID()}@periscan.test`;
}

function authCookies(cookie: string) {
  return { [SESSION_COOKIE_NAME]: cookie };
}

function sessionCookie(response: {
  cookies: Array<{ name: string; value: string }>;
}) {
  return response.cookies.find((item) => item.name === SESSION_COOKIE_NAME)!
    .value;
}

/**
 * End-to-end proof that the built-in measured modules are wired into a real
 * product surface: a scope posture-check runs the TLS/DNS/HTTP/email modules,
 * persists their measured signals, and the measured exposure surfaces as a
 * validated finding. Uses fixture mode (dev-only) so no network is touched.
 */
describe("Scope posture-check surfaces measured module findings end-to-end", () => {
  it("runs measured modules for a verified scope and a TLS exposure becomes a finding", async () => {
    const prisma = createPrismaClient();
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
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
    let tenantId = "";

    try {
      const owner = await app.inject({
        method: "POST",
        payload: {
          email: uniqueEmail("posture-owner"),
          name: "Posture Owner",
          password: "periscan-posture-password",
          tenantName: "Posture Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(owner.statusCode).toBe(201);
      const cookie = sessionCookie(owner);
      tenantId = owner.json().tenant.tenantId as string;

      const scopeResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { scopeType: "Domain", value: "secure.example.com" },
        url: "/api/v1/scopes"
      });
      expect(scopeResponse.statusCode).toBe(201);
      const scopeId = scopeResponse.json().scopeId as string;

      await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });

      // Posture-check in fixture mode (dev-only). The TLS fixture is an expired
      // certificate (a measured exposure); the other modules use their healthy
      // defaults.
      const posture = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          executionMode: "Fixture",
          fixtures: {
            // No CAA record → a measured hardening-hygiene exposure (DnsCaaMissing),
            // which must be reported Low severity (defense-in-depth), not High.
            "periscan.dns_caa_check": { fixtureCaaRecords: [] },
            "periscan.tls_certificate_check": {
              fixtureCertificate: {
                issuer: "CN=Real CA,O=CA",
                subject: "CN=secure.example.com,O=Acme",
                validFrom: new Date(Date.now() - 400 * DAY_MS).toISOString(),
                validTo: new Date(Date.now() - 10 * DAY_MS).toISOString()
              }
            }
          }
        },
        url: `/api/v1/scopes/${scopeId}/posture-check`
      });
      expect(posture.statusCode).toBe(201);
      const checks = posture.json().checks as Array<{
        moduleId: string;
        outcome: string;
        exposure: boolean;
      }>;
      // All built-in measured posture modules auto-run against the scope.
      expect(checks).toHaveLength(10);
      const tlsCheck = checks.find(
        (check) => check.moduleId === "periscan.tls_certificate_check"
      );
      expect(tlsCheck?.exposure).toBe(true);
      expect(tlsCheck?.outcome).toBe("tls_certificate_expired");
      // Healthy default fixtures do not raise an exposure.
      const dnsCheck = checks.find(
        (check) => check.moduleId === "periscan.dns_resolution_check"
      );
      expect(dnsCheck?.exposure).toBe(false);
      // The newer measured modules are now wired into the auto-run sweep and run
      // healthy by default (no exposure) in fixture mode.
      const corsCheck = checks.find(
        (check) => check.moduleId === "periscan.http_cors_audit"
      );
      expect(corsCheck?.exposure).toBe(false);
      expect(corsCheck?.outcome).toBe("http_cors_restricted");
      const protocolCheck = checks.find(
        (check) => check.moduleId === "periscan.tls_protocol_audit"
      );
      expect(protocolCheck?.outcome).toBe("tls_modern_only");
      // security.txt is an informational ControlObservation: it runs in the
      // sweep but a published channel is NEVER counted as an exposure (the
      // posture exposure flag filters to Exposure-category signals only).
      const securityTxtCheck = checks.find(
        (check) => check.moduleId === "periscan.well_known_security_txt"
      );
      expect(securityTxtCheck?.outcome).toBe("security_txt_present");
      expect(securityTxtCheck?.exposure).toBe(false);

      // The measured exposure now surfaces as a validated finding.
      const findings = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/findings"
      });
      expect(findings.statusCode).toBe(200);
      const items = findings.json().items as Array<{
        impact: string;
        severity: string;
        sourceMotion: string;
      }>;
      const tlsFinding = items.find(
        (finding) =>
          typeof finding.impact === "string" &&
          finding.impact.includes("TlsCertificateExpired")
      );
      expect(tlsFinding).toBeTruthy();
      expect(tlsFinding?.sourceMotion).toBe("EXV");

      // A missing CAA record is a defense-in-depth hardening gap: it surfaces as
      // a finding but at LOW severity, not inflated to the generic High that
      // other measured exposures (e.g. expired TLS) carry.
      const caaFinding = items.find(
        (finding) =>
          typeof finding.impact === "string" &&
          finding.impact.includes("DnsCaaMissing")
      );
      expect(caaFinding).toBeTruthy();
      expect(caaFinding?.severity).toBe("Low");
    } finally {
      // No tenant cleanup: the shared acceptance DB accumulates test data by
      // convention, and deleting a tenant here would race the concurrent global
      // system-validation-sweep test (a tenant vanishing mid-sweep is counted
      // as a sweep failure).
      void tenantId;
      await app.close();
      await prisma.$disconnect();
    }
  }, 30_000);
});

import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { correlateAttackPathsFromSignals } from "../../packages/evidence/src/correlation.js";
import type { SignalEnvelope } from "../../packages/shared/src/domain.js";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

// Single named ANTI-FABRICATION gate. Periscan's core promise is that every
// conclusion traces to a real measurement or is explicitly labeled unmeasured —
// nothing is ever fabricated. That invariant is enforced across many code paths
// and honest defaults; this suite consolidates it into one place an auditor (or
// analyst) can point to, covering every conclusion type: attack paths,
// evidence basis, exploitability claims, and remediation closure.

const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_COOKIE_NAME = "periscan_session";

function signalFixture(
  input: Pick<SignalEnvelope, "signalCategory" | "signalSubcategory"> & {
    confidence?: number;
    rawPayloadPointer?: string | null;
    sourceType?: string;
  }
): SignalEnvelope {
  const now = new Date().toISOString();
  return {
    confidence: input.confidence ?? 0.85,
    createdAt: now,
    evidenceIds: [randomUUID()],
    freshness: "Fresh",
    rawPayloadPointer: input.rawPayloadPointer ?? null,
    redactionStatus: "Redacted",
    relatedAssetIds: [],
    relatedControlIds: [],
    relatedEvidenceIds: [],
    relatedIdentityIds: [],
    relatedPathIds: [],
    sensitivityLevel: "Moderate",
    signalCategory: input.signalCategory,
    signalId: randomUUID(),
    signalSubcategory: input.signalSubcategory,
    sourceIntegrationId: null,
    sourceType: input.sourceType ?? `fixture.${input.signalCategory}`,
    sourceVendor: "Periscan",
    tenantId: randomUUID(),
    techniqueIds: [],
    timestampIngested: now,
    timestampObserved: now,
    updatedAt: now
  };
}

describe("anti-fabrication invariants", () => {
  // --- Conclusion type: ATTACK PATHS (pure correlation, no DB) ---

  it("INVARIANT: correlated multi-hop paths are heuristic and never claim Validated/Exploitable", () => {
    const paths = correlateAttackPathsFromSignals({
      signals: [
        signalFixture({
          signalCategory: "Repository",
          signalSubcategory: "SecretScanCandidate"
        }),
        signalFixture({
          signalCategory: "Cloud",
          signalSubcategory: "PublicExposure"
        }),
        signalFixture({
          signalCategory: "Exposure",
          signalSubcategory: "ExternalExposure"
        })
      ]
    });

    expect(paths.length).toBeGreaterThan(0);
    // Inferred (not measured) → heuristic, and never claims the measured-only
    // "Validated" state or demonstrated "Exploitable".
    expect(paths.every((path) => path.heuristic)).toBe(true);
    expect(
      paths.every(
        (path) =>
          path.validationState !== "Validated" &&
          path.validationState !== "Exploitable"
      )
    ).toBe(true);
    // Downstream impact nodes are explicitly hypotheses, never fabricated assets.
    for (const path of paths) {
      const inferred = path.nodes.filter(
        (node) => node.entityType === "Asset" && node.hypothesis
      );
      for (const node of inferred) {
        expect(node.label).toMatch(/heuristic hypothesis/i);
      }
    }
  });

  it("INVARIANT: only authoritative-measurement signals yield a Measured path, capped below Exploitable", () => {
    const paths = correlateAttackPathsFromSignals({
      signals: [
        {
          ...signalFixture({
            confidence: 0.95,
            signalCategory: "Exposure",
            signalSubcategory: "DigitalOceanInternetOpenSensitivePort",
            sourceType: "digitalocean.firewall.internet_open_sensitive_port"
          }),
          rawPayloadPointer:
            "digitalocean://droplets/1/firewall/internet-open?droplet=db-01&ports=tcp%2F5432"
        }
      ]
    });

    expect(paths).toHaveLength(1);
    const path = paths[0]!;
    // Measured from authoritative config → non-heuristic, methodology names the
    // measurement, and it is capped at "Reachable" — config proves the port is
    // internet-reachable, NOT that it was actively exploited.
    expect(path.heuristic).toBe(false);
    expect(path.methodology).toContain("measured");
    expect(path.validationState).toBe("Reachable");
    expect(path.validationState).not.toBe("Exploitable");
  });

  // Exploitable is reserved for an ACTIVELY-MEASURED working exploit (e.g. the
  // http_cors_audit module confirming credentialed cross-origin reads). An
  // INFERRED / correlated attack path must never claim it.
  it("INVARIANT: no inferred/correlated conclusion is ever labeled Exploitable", () => {
    const paths = correlateAttackPathsFromSignals({
      signals: [
        signalFixture({
          signalCategory: "Repository",
          signalSubcategory: "SecretScanCandidate"
        }),
        signalFixture({
          signalCategory: "Cloud",
          signalSubcategory: "PublicExposure"
        }),
        signalFixture({
          signalCategory: "Exposure",
          signalSubcategory: "ExternalExposure"
        }),
        {
          ...signalFixture({
            signalCategory: "Exposure",
            signalSubcategory: "DigitalOceanInternetOpenSensitivePort"
          }),
          rawPayloadPointer:
            "digitalocean://droplets/1/firewall/internet-open?droplet=db-01&ports=tcp%2F22"
        }
      ]
    });
    expect(paths.every((path) => path.validationState !== "Exploitable")).toBe(
      true
    );
  });

  // --- Conclusion type: REMEDIATION CLOSURE (DB) ---

  describe("finding closure cannot be fabricated", () => {
    let prisma: ReturnType<typeof createPrismaClient>;

    afterEach(async () => {
      if (prisma) {
        await testHelpers.cleanupTestDataByEmailPrefix(prisma, ["antifab"]);
        await prisma.$disconnect();
      }
    });

    it("INVARIANT: an analyst disposition can never fabricate a Fixed status", async () => {
      prisma = createPrismaClient();
      await testHelpers.probeDatabaseConnection(prisma);
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
          prisma
        })
      });
      try {
        const { cookie, response } = await testHelpers.performSignup(
          app,
          "antifab",
          "Anti-Fab Tenant"
        );
        const auth = testHelpers.authHeaders(cookie);
        const ownerId = response.json().user.userId as string;

        const scope = await app.inject({
          cookies: auth,
          method: "POST",
          payload: { scopeType: "Domain", value: "antifab.example.com" },
          url: "/api/v1/scopes"
        });
        const scopeId = scope.json().scopeId as string;
        await app.inject({
          cookies: auth,
          method: "POST",
          payload: { devModeManual: true },
          url: `/api/v1/scopes/${scopeId}/verify`
        });
        await app.inject({
          cookies: auth,
          method: "POST",
          payload: {
            executionMode: "Fixture",
            fixtures: {
              "periscan.tls_certificate_check": {
                fixtureCertificate: {
                  issuer: "CN=Real CA,O=CA",
                  subject: "CN=antifab.example.com,O=Acme",
                  validFrom: new Date(Date.now() - 400 * DAY_MS).toISOString(),
                  validTo: new Date(Date.now() - 10 * DAY_MS).toISOString()
                }
              }
            }
          },
          url: `/api/v1/scopes/${scopeId}/posture-check`
        });

        const findings = (
          await app.inject({
            cookies: auth,
            method: "GET",
            url: "/api/v1/findings"
          })
        ).json().items as Array<{ findingId: string; status: string }>;
        expect(findings.length).toBeGreaterThan(0);
        const target = findings[0]!;
        expect(target.status).not.toBe("Fixed");

        // Try every disposition an analyst can apply — none may flip the derived
        // status to Fixed. Only a real verification event can do that.
        for (const disposition of [
          "FalsePositive",
          "AcceptedRisk",
          "Suppressed"
        ]) {
          const res = await app.inject({
            cookies: auth,
            method: "POST",
            payload:
              disposition === "AcceptedRisk"
                ? {
                    disposition,
                    expiresAt: new Date(Date.now() + 30 * DAY_MS).toISOString(),
                    ownerId,
                    note: "QA anti-fabrication: accepted residual risk"
                  }
                : {
                    disposition,
                    // Product requires reasonCode or note for FP/suppress.
                    reasonCode: "Benign",
                    note: "QA anti-fabrication: disposition must not Fixed"
                  },
            url: `/api/v1/findings/${target.findingId}/transition`
          });
          expect(res.statusCode).toBe(200);
          const body = res.json();
          expect(body.disposition.disposition).toBe(disposition);
          // The DERIVED status is untouched, and a disposition is never "Fixed".
          expect(body.status).toBe(target.status);
          expect(body.status).not.toBe("Fixed");
          expect(body.disposition.disposition).not.toBe("Fixed");
        }
      } finally {
        await app.close();
      }
    });
  });
});

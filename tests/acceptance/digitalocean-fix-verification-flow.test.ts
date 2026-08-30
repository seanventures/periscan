import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";

const SESSION_COOKIE_NAME = "periscan_session";

function authCookies(cookie: string) {
  return { [SESSION_COOKIE_NAME]: cookie };
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200
  });
}

/**
 * End-to-end proof of the DigitalOcean measured fix-verification loop (option b):
 * a public Droplet with SSH open to 0.0.0.0/0 is MEASURED from authoritative
 * firewall configuration, correlated into a measured attack path, remediated, and
 * then verified by RE-FETCHING the firewall configuration. While the rule is still
 * open the verification is honestly StillExposed; once the rule is scoped to a
 * private range the re-sync drops the measured signal, the path no longer
 * correlates, and the verification concludes Fixed — proof by re-validation, not
 * by default.
 */
describe("DigitalOcean fix-verification acceptance workflow", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("verifies a measured firewall exposure by re-fetching live configuration", async () => {
    // Mutable state the stubbed DigitalOcean API reflects: open -> fixed.
    let firewallOpenToInternet = true;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const pathname = new URL(String(input)).pathname;

        if (pathname === "/v2/account") {
          return jsonResponse({
            account: { status: "active", uuid: "do-verify-account" }
          });
        }

        if (pathname === "/v2/droplets") {
          return jsonResponse({
            droplets: [
              {
                id: 700,
                name: "db-verify",
                networks: {
                  v4: [{ ip_address: "198.51.100.20", type: "public" }]
                },
                region: { slug: "nyc3" },
                status: "active"
              }
            ],
            links: {}
          });
        }

        if (pathname === "/v2/firewalls") {
          return jsonResponse({
            firewalls: [
              {
                droplet_ids: [700],
                id: "fw-verify",
                inbound_rules: [
                  {
                    protocol: "tcp",
                    ports: "22",
                    sources: {
                      addresses: firewallOpenToInternet
                        ? ["0.0.0.0/0"]
                        : ["10.0.0.0/8"]
                    }
                  }
                ],
                name: "db-fw",
                outbound_rules: [],
                status: "succeeded"
              }
            ],
            links: {}
          });
        }

        if (pathname === "/v2/kubernetes/clusters") {
          return jsonResponse({ kubernetes_clusters: [], links: {} });
        }

        return new Response(JSON.stringify({}), {
          headers: { "content-type": "application/json" },
          status: 404
        });
      })
    );

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
        prisma
      })
    });

    try {
      const signupResponse = await app.inject({
        method: "POST",
        payload: {
          email: `do-fixverify-${randomUUID()}@periscan.test`,
          name: "DigitalOcean Fix Verify Owner",
          password: "periscan-do-fixverify-password",
          tenantName: "DigitalOcean Fix Verify Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(signupResponse.statusCode).toBe(201);
      const cookie = signupResponse.cookies[0]!.value;

      const scopeResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `do-verify-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });
      expect(scopeResponse.statusCode).toBe(201);
      await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeResponse.json().scopeId}/verify`
      });

      // Connect a LIVE-mode DigitalOcean integration (uses the stubbed fetch).
      const integrationResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          authType: "apiToken",
          config: {
            apiToken: "do-verify-token",
            connectorKey: "digitalocean",
            mockMode: false
          },
          connectorKey: "digitalocean",
          mockMode: false
        },
        url: "/api/v1/integrations"
      });
      expect(integrationResponse.statusCode).toBe(201);
      expect(integrationResponse.json().status).toBe("Created");
      const integrationId = integrationResponse.json().integrationId as string;

      // Real credentials are not represented as connected until an explicit
      // health probe verifies authorization.
      const healthResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: `/api/v1/integrations/${integrationId}/health`
      });
      expect(healthResponse.statusCode).toBe(200);
      expect(healthResponse.json().integration.status).toBe("Connected");

      // Creating a snapshot syncs the connector (live, open firewall) and
      // correlates the measured attack path.
      const snapshotResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { audience: "Security Team", maxTopItems: 5 },
        url: "/api/v1/snapshots"
      });
      expect(snapshotResponse.statusCode).toBe(201);

      const pathsResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/attack-paths"
      });
      expect(pathsResponse.statusCode).toBe(200);
      const measuredPath = pathsResponse
        .json()
        .items.map(
          (item: { attackPath: Record<string, unknown> }) => item.attackPath
        )
        .find((path: { name: string }) =>
          path.name.includes("digitalocean-droplet/db-verify")
        ) as
        | {
            evidenceBasis: string;
            pathEdges: Array<{
              evidenceBasis: string;
              measurementMethod: string | null;
            }>;
            pathId: string;
            validationState: string;
          }
        | undefined;

      expect(measuredPath).toBeDefined();
      // The exposure is measured from authoritative config and reachable, not
      // asserted as exploitable.
      expect(measuredPath?.evidenceBasis).toBe("Measured");
      expect(measuredPath?.validationState).toBe("Reachable");
      expect(measuredPath?.pathEdges).toHaveLength(1);
      expect(measuredPath?.pathEdges[0]).toMatchObject({
        evidenceBasis: "Measured",
        measurementMethod: "authoritative-config:digitalocean-firewall-ingress"
      });

      const remediationResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { pathId: measuredPath!.pathId },
        url: "/api/v1/remediations"
      });
      expect(remediationResponse.statusCode).toBe(201);
      const remediationId = remediationResponse.json().remediationId as string;

      // First verification while the firewall is STILL open: re-fetch confirms the
      // exposure remains -> honest StillExposed.
      const stillExposedResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {},
        url: `/api/v1/remediations/${remediationId}/verify`
      });
      expect(stillExposedResponse.statusCode).toBe(200);
      expect(stillExposedResponse.json().verificationEvent.outcome).toBe(
        "StillExposed"
      );
      // The verification record is self-describing about HOW it was verified:
      // re-MEASURED from authoritative config (connector resync of the Measured
      // path), not merely re-tested by a validation module.
      const stillEvent = stillExposedResponse.json().verificationEvent;
      expect(stillEvent.measuredRevalidation).toBe(true);
      expect(stillEvent.retestMethod).toBe("connector-resync");
      expect(stillEvent.previousEvidenceBasis).toBe("Measured");
      // Self-describing inputs: the firewall connector was re-fetched and the
      // exposure still re-correlated, which is why it stayed exposed.
      expect(stillEvent.reSyncedConnectorKeys).toContain("digitalocean");
      expect(stillEvent.exposureReCorrelated).toBe(true);

      // Apply the fix: the firewall rule is scoped to a private range.
      firewallOpenToInternet = false;

      // Second verification: re-fetch shows the port is no longer internet-open,
      // the measured path no longer correlates -> Fixed by re-validation.
      const fixedResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {},
        url: `/api/v1/remediations/${remediationId}/verify`
      });
      expect(fixedResponse.statusCode).toBe(200);
      expect(fixedResponse.json().verificationEvent.outcome).toBe("Fixed");
      expect(fixedResponse.json().remediation.status).toBe("Fixed");
      // The honest "Fixed" is auditable as measured re-validation, not a default.
      const fixedEvent = fixedResponse.json().verificationEvent;
      expect(fixedEvent.measuredRevalidation).toBe(true);
      expect(fixedEvent.retestMethod).toBe("connector-resync");
      expect(fixedEvent.previousEvidenceBasis).toBe("Measured");
      // The Fixed conclusion is explained by the record itself: after re-fetching
      // the firewall config, the exposure no longer re-correlated.
      expect(fixedEvent.exposureReCorrelated).toBe(false);
      expect(fixedEvent.reSyncedConnectorKeys).toContain("digitalocean");

      // Continuous re-verification: a settled fix is scheduled for re-check, and
      // when it REGRESSES the stale "Fixed" is honestly flipped back — not trusted.
      expect(
        fixedResponse.json().remediation.nextVerificationAt
      ).not.toBeNull();
      await prisma.remediationTask.update({
        data: { nextVerificationAt: new Date(Date.now() - 60_000) },
        where: { remediationId }
      });
      firewallOpenToInternet = true; // the fix regressed

      const reverifyResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        url: "/api/v1/remediations/reverify-due"
      });
      expect(reverifyResponse.statusCode).toBe(200);
      expect(reverifyResponse.json().reverifiedCount).toBeGreaterThanOrEqual(1);
      const reverified = reverifyResponse
        .json()
        .results.find(
          (item: { remediationId: string }) =>
            item.remediationId === remediationId
        );
      // A previously-fixed exposure that came back is precisely a Reopen — the
      // stale "Fixed" is honestly overturned by the measured re-check.
      expect(reverified?.outcome).toBe("Reopened");

      const reopened = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: `/api/v1/remediations/${remediationId}`
      });
      expect(reopened.json().status).toBe("Reopened");
      // The remediation response surfaces the targeted exposure's evidence basis,
      // so a consumer can see this is grounded in a MEASURED exposure.
      expect(reopened.json().relatedPathEvidenceBasis).toBe("Measured");
      // It also surfaces the latest verification PROVENANCE inline: the most
      // recent re-verification reopened it via a real measured retest — visible
      // without a separate verification-events call.
      const latestVerification = reopened.json().latestVerification;
      expect(latestVerification).not.toBeNull();
      expect(latestVerification.outcome).toBe("Reopened");
      expect(latestVerification.measuredRevalidation).toBe(true);
      expect(typeof latestVerification.verifiedAt).toBe("string");

      // No DigitalOcean token or public IP leaked into the verification surface.
      expect(JSON.stringify(fixedResponse.json())).not.toContain(
        "do-verify-token"
      );
      expect(JSON.stringify(fixedResponse.json())).not.toContain(
        "198.51.100.20"
      );
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  }, 30_000);
});

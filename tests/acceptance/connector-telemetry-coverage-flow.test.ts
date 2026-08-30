import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";

const SESSION_COOKIE_NAME = "periscan_session";

function uniqueEmail(prefix: string) {
  return `${prefix}-${randomUUID()}@periscan.test`;
}

function getSessionCookie(response: {
  cookies: Array<{ name: string; value: string }>;
}) {
  const cookie = response.cookies.find(
    (item) => item.name === SESSION_COOKIE_NAME
  );
  if (!cookie) {
    throw new Error("Expected a Periscan session cookie.");
  }
  return cookie.value;
}

function authCookies(cookie: string) {
  return { [SESSION_COOKIE_NAME]: cookie };
}

describe("Connector telemetry → coverage acceptance workflow", () => {
  it("encrypts connector secrets at rest and ingests technique-tagged signals on sync", async () => {
    const prisma = createPrismaClient();
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        prisma
      })
    });

    try {
      const signup = await app.inject({
        method: "POST",
        payload: {
          email: uniqueEmail("telemetry-owner"),
          name: "Telemetry Owner",
          password: "periscan-telemetry-password",
          tenantName: "Telemetry Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(signup.statusCode).toBe(201);
      const cookie = getSessionCookie(signup);
      const tenantId = signup.json().tenant.tenantId as string;
      // Control-source registration is gated on the Control Validation
      // capability; grant the tenant a package that includes it.
      await prisma.tenant.update({
        data: { billingPackageKey: "ControlValidation" },
        where: { tenantId }
      });

      // Connect Cortex XDR with a real auth method + a secret, in mock mode.
      const PLAINTEXT_SECRET = "cortex-acceptance-secret-key";
      const created = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          authType: "apiToken",
          config: {
            apiKey: PLAINTEXT_SECRET,
            baseUrl: "https://api.xdr.example.com",
            // Explicitly request a detection scenario; the EDR mock default is the
            // neutral "no detection" verdict (v0.1.333), so a detection must be asked for.
            fixtureOutcome: "Detected",
            xdrAuthId: "42"
          },
          connectorKey: "palo-cortex-xdr",
          mockMode: true
        },
        url: "/api/v1/integrations"
      });
      expect(created.statusCode).toBe(201);
      const integrationId = created.json().integrationId as string;

      // Back the integration with a control source so ingested telemetry can be
      // correlated to it for control-rule coverage.
      const controlSource = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          controlType: "XDR",
          expectedBehaviors: ["Detected", "Blocked"],
          integrationId,
          provider: "Palo Alto Networks Cortex XDR"
        },
        url: "/api/v1/control-sources"
      });
      expect(controlSource.statusCode).toBe(201);
      const controlSourceId = controlSource.json().controlSourceId as string;

      // P1a: the secret is stored encrypted at rest, never plaintext.
      const stored = await prisma.integration.findFirstOrThrow({
        where: { integrationId, tenantId }
      });
      const storedConfig = stored.config as Record<string, unknown>;
      expect(storedConfig.apiKey).not.toBe(PLAINTEXT_SECRET);
      expect(String(storedConfig.apiKey)).toMatch(/^v1\./u);
      // Non-secret config stays readable.
      expect(storedConfig.baseUrl).toBe("https://api.xdr.example.com");
      // The create response never echoes the raw secret.
      expect(JSON.stringify(created.json())).not.toContain(PLAINTEXT_SECRET);

      // P1c: sync ingests signals that now carry MITRE technique ids.
      const synced = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        url: `/api/v1/integrations/${integrationId}/sync`
      });
      expect(synced.statusCode).toBe(200);

      const signals = await prisma.signalEnvelope.findMany({
        where: { signalCategory: "ControlObservation", tenantId }
      });
      expect(signals.length).toBeGreaterThan(0);
      const allTechniqueIds = signals.flatMap((signal) => signal.techniqueIds);
      // Cortex fixture incident maps to T1059; the ingested signal carries it,
      // so it now feeds control-rule coverage instead of being inert.
      expect(allTechniqueIds).toContain("T1059");

      // P1c correlation: the ingested ControlObservation signal is linked to the
      // control source backing this integration (relatedControlIds), which is
      // exactly what buildControlRuleCoverageSummary requires (relatedControlIds
      // + techniqueIds) — so the telemetry now counts toward coverage.
      const correlated = signals.filter((signal) =>
        signal.relatedControlIds.includes(controlSourceId)
      );
      expect(correlated.length).toBeGreaterThan(0);
      expect(
        correlated.some((signal) => signal.techniqueIds.includes("T1059"))
      ).toBe(true);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });

  it("counts SentinelOne EDR telemetry toward coverage via extracted technique ids", async () => {
    const prisma = createPrismaClient();
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        prisma
      })
    });

    try {
      const signup = await app.inject({
        method: "POST",
        payload: {
          email: uniqueEmail("s1-owner"),
          name: "S1 Owner",
          password: "periscan-s1-password",
          tenantName: "S1 Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(signup.statusCode).toBe(201);
      const cookie = getSessionCookie(signup);
      const tenantId = signup.json().tenant.tenantId as string;
      // Control-source registration is gated on the Control Validation
      // capability; grant the tenant a package that includes it.
      await prisma.tenant.update({
        data: { billingPackageKey: "ControlValidation" },
        where: { tenantId }
      });

      const created = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          authType: "apiToken",
          config: {
            apiToken: "sentinelone-acceptance-secret",
            baseUrl: "https://periscan.sentinelone.net",
            // Explicitly request a detection scenario; the EDR mock default is the
            // neutral "no detection" verdict (v0.1.333), so a detection must be asked for.
            fixtureOutcome: "Detected"
          },
          connectorKey: "sentinelone",
          mockMode: true
        },
        url: "/api/v1/integrations"
      });
      expect(created.statusCode).toBe(201);
      const integrationId = created.json().integrationId as string;

      const controlSource = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          controlType: "EDR",
          expectedBehaviors: ["Detected", "Blocked"],
          integrationId,
          provider: "SentinelOne Singularity"
        },
        url: "/api/v1/control-sources"
      });
      expect(controlSource.statusCode).toBe(201);
      const controlSourceId = controlSource.json().controlSourceId as string;

      // A pre-existing tenant asset whose name matches the host the SentinelOne
      // fixture threat is observed on (agentComputerName "edr-host-01"). The sync
      // resolver should attribute the ingested telemetry to it.
      const asset = await prisma.asset.create({
        data: {
          assetType: "Host",
          businessCriticality: "High",
          identifiers: { hostname: "edr-host-01" },
          internetExposed: false,
          name: "edr-host-01",
          status: "Active",
          tenantId
        }
      });

      const synced = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        url: `/api/v1/integrations/${integrationId}/sync`
      });
      expect(synced.statusCode).toBe(200);

      // The SentinelOne fixture threat now carries MITRE indicators; the
      // ingested ControlObservation signal extracts T1059 and is backed by the
      // EDR control source, so it counts toward control-rule coverage.
      const signals = await prisma.signalEnvelope.findMany({
        where: {
          signalCategory: "ControlObservation",
          sourceType: "sentinelone.threat",
          tenantId
        }
      });
      expect(signals.length).toBeGreaterThan(0);
      expect(
        signals.some(
          (signal) =>
            signal.techniqueIds.includes("T1059") &&
            signal.relatedControlIds.includes(controlSourceId)
        )
      ).toBe(true);

      // The host hint on the threat resolved to the matching tenant asset, so
      // the endpoint telemetry is now attributed to that asset.
      expect(
        signals.some((signal) => signal.relatedAssetIds.includes(asset.assetId))
      ).toBe(true);
      // Transient hints are never persisted on the signal envelope.
      expect(
        signals.every(
          (signal) =>
            !("relatedAssetHints" in (signal as Record<string, unknown>))
        )
      ).toBe(true);

      // T1059 is now a catalogued control-validation scenario, so the EDR
      // telemetry that carries it actually shows as covered (no longer inert for
      // lack of a matching scenario) and names SentinelOne as the backing tool.
      const coverage = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/control-sources/rule-coverage"
      });
      expect(coverage.statusCode).toBe(200);
      const t1059Items = (
        coverage.json().items as Array<{
          observedSources: string[];
          status: string;
          techniqueId: string;
        }>
      ).filter((item) => item.techniqueId === "T1059");
      expect(t1059Items.length).toBeGreaterThan(0);
      expect(
        t1059Items.some(
          (item) =>
            item.observedSources.includes("SentinelOne") &&
            item.status !== "NotTested"
        )
      ).toBe(true);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });

  it("explains coverage with the tool vendor that backs each technique", async () => {
    const prisma = createPrismaClient();
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        prisma
      })
    });

    try {
      const signup = await app.inject({
        method: "POST",
        payload: {
          email: uniqueEmail("coverage-owner"),
          name: "Coverage Owner",
          password: "periscan-coverage-password",
          tenantName: "Coverage Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(signup.statusCode).toBe(201);
      const cookie = getSessionCookie(signup);
      // Control-source registration is gated on the Control Validation
      // capability; grant the tenant a package that includes it.
      await prisma.tenant.update({
        data: { billingPackageKey: "ControlValidation" },
        where: { tenantId: signup.json().tenant.tenantId as string }
      });

      // Splunk SIEM in mock mode now ingests a fixture-backed notable whose
      // extracted MITRE technique (T1059) the control-validation catalog covers.
      const created = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          authType: "apiToken",
          config: {
            baseUrl: "https://splunk.example.com",
            token: "splunk-acceptance-secret"
          },
          connectorKey: "splunk",
          mockMode: true
        },
        url: "/api/v1/integrations"
      });
      expect(created.statusCode).toBe(201);
      const integrationId = created.json().integrationId as string;

      const controlSource = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          controlType: "SIEM",
          expectedBehaviors: ["Detected", "Alerted"],
          integrationId,
          provider: "Splunk Cloud"
        },
        url: "/api/v1/control-sources"
      });
      expect(controlSource.statusCode).toBe(201);

      const synced = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        url: `/api/v1/integrations/${integrationId}/sync`
      });
      expect(synced.statusCode).toBe(200);

      // Force fresh timestamp on any T1059 control signals (mock fixtures can have old dates >30d stale threshold).
      await prisma.signalEnvelope.updateMany({
        where: {
          techniqueIds: { has: "T1059" },
          signalCategory: "ControlObservation"
        },
        data: { timestampObserved: new Date().toISOString() }
      });

      const coverage = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/control-sources/rule-coverage"
      });
      expect(coverage.statusCode).toBe(200);
      const t1059Items = (
        coverage.json().items as Array<{
          observedSources: string[];
          status: string;
          techniqueId: string;
        }>
      ).filter((item) => item.techniqueId === "T1059");
      expect(t1059Items.length).toBeGreaterThan(0);
      // The covered technique now names the backing tool's telemetry.
      const splunkItem = t1059Items.find((item) =>
        item.observedSources.includes("Splunk")
      );
      expect(splunkItem).toBeDefined();
      // Truthfulness: a Splunk SIEM search only proves the event was LOGGED, not
      // that a detection alerted — so it must read as LoggedOnly, never promoted
      // to the stronger Covered/Detected claim.
      expect(splunkItem!.status).toBe("LoggedOnly");
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});

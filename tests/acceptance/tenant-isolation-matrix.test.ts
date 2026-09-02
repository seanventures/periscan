import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * WS3 — Cross-tenant ISOLATION matrix.
 *
 * A multi-tenant security product's most load-bearing guarantee is that one
 * tenant can never read or mutate another tenant's data. This suite seeds a
 * rich, realistic set of resources in tenant A (scopes, findings, attack paths,
 * remediations, control sources, AI apps, evidence, snapshots, reports, API
 * keys, webhooks, schedules, missions, integrations, model providers, threat
 * advisories) and then, authenticated as an unrelated tenant B, systematically
 * attempts to GET each A resource by id and to mutate each A resource by id.
 *
 * Isolation holds when:
 *   - cross-tenant detail reads return 404 (the resource is invisible to B), and
 *   - cross-tenant mutations return 404/403 (never a 2xx success), and
 *   - B's own list endpoints never contain any of A's ids.
 *
 * All probes below send schema-valid bodies so the ONLY reason a mutation can be
 * rejected is the tenant boundary (a 404), not request validation (a 400). Any
 * probe that returns 2xx would be a genuine cross-tenant LEAK; such a case is
 * commented out with an `// ISOLATION LEAK:` marker rather than committed red.
 */

async function buildTestApp(prisma: ReturnType<typeof createPrismaClient>) {
  return buildApp({
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
}

interface SeededTenant {
  cookie: string;
  tenantId: string;
  scopeId: string;
  findingId: string;
  pathId: string;
  remediationId: string;
  controlSourceId: string;
  aiAppId: string;
  evidenceId: string;
  evidencePackId: string;
  snapshotId: string;
  membershipId: string;
  apiKeyId: string;
  webhookId: string;
  scheduleId: string;
  missionId: string;
  integrationId: string;
  modelProviderId: string;
  threatAdvisoryId: string;
}

/**
 * Seed tenant A with one of (almost) every tenant-scoped resource type, and
 * return the real ids that tenant B will later be forbidden to touch.
 */
async function seedTenantA(
  app: Awaited<ReturnType<typeof buildTestApp>>,
  prisma: ReturnType<typeof createPrismaClient>
): Promise<SeededTenant> {
  const { cookie, response } = await testHelpers.performSignup(
    app,
    "iso-a",
    "Iso A Tenant"
  );
  const tenantId = response.json().tenant.tenantId as string;
  const auth = testHelpers.authHeaders(cookie);

  // Enterprise unlocks every capability (snapshots, control sources, AI apps,
  // evidence packs, model gateway, …) so a single tenant can hold the full set.
  await prisma.tenant.update({
    data: { billingPackageKey: "Enterprise" },
    where: { tenantId }
  });

  const inject = (
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    url: string,
    payload?: unknown
  ) => app.inject({ cookies: auth, method, payload, url });

  // Scope + verify.
  const scope = await inject("POST", "/api/v1/scopes", {
    scopeType: "Domain",
    value: `iso-a-${randomUUID()}.example.com`
  });
  const scopeId = scope.json().scopeId as string;
  await inject("POST", `/api/v1/scopes/${scopeId}/verify`, {
    devModeManual: true
  });

  // Connect + sync GitHub/AWS (mock) so correlated attack paths are generated
  // (posture-check alone yields findings but not attack paths).
  const github = await inject("POST", "/api/v1/integrations/github/connect", {
    mockMode: true
  });
  const aws = await inject("POST", "/api/v1/integrations/aws/connect", {
    mockMode: true
  });
  for (const id of [
    github.json().integrationId as string,
    aws.json().integrationId as string
  ]) {
    await inject("POST", `/api/v1/integrations/${id}/sync`);
  }

  // Posture-check (fixture, expired TLS) → measured exposure → validated finding
  // and correlated attack path.
  await inject("POST", `/api/v1/scopes/${scopeId}/posture-check`, {
    executionMode: "Fixture",
    fixtures: {
      "periscan.tls_certificate_check": {
        fixtureCertificate: {
          issuer: "CN=Real CA,O=CA",
          subject: `CN=iso-a.example.com,O=IsoA`,
          validFrom: new Date(Date.now() - 400 * DAY_MS).toISOString(),
          validTo: new Date(Date.now() - 10 * DAY_MS).toISOString()
        }
      }
    }
  });

  const findings = await inject("GET", "/api/v1/findings");
  const findingId = (findings.json().items as Array<{ findingId: string }>)[0]!
    .findingId;

  const attackPaths = await inject("GET", "/api/v1/attack-paths");
  const pathId = (
    attackPaths.json().items as Array<{ attackPath: { pathId: string } }>
  )[0]!.attackPath.pathId;

  // Remediation from the top attack path.
  const remediation = await inject("POST", "/api/v1/remediations", {
    owner: "Security engineering",
    pathId
  });
  const remediationId = remediation.json().remediationId as string;

  // AI app.
  const aiApp = await inject("POST", "/api/v1/ai-apps", {
    appType: "Chatbot",
    authMethod: "test-account",
    dataSourcesDescription: "Public documentation knowledge base.",
    endpointUrl: "https://iso-a-ai.example.com/chat",
    guardrailsDescription: "Tenant-scoped retrieval and read-only tools.",
    name: "Iso A Assistant",
    owner: "AI platform",
    ragEnabled: true,
    scopeId,
    testAccountNotes: "Synthetic test account only.",
    toolsEnabled: true
  });
  const aiAppId = aiApp.json().aiAppId as string;

  // Integration + control source.
  const integration = await inject("POST", "/api/v1/integrations", {
    authType: "apiToken",
    config: {
      apiKey: "iso-a-secret",
      baseUrl: "https://api.xdr.example.com",
      xdrAuthId: "7"
    },
    connectorKey: "palo-cortex-xdr",
    mockMode: true
  });
  const integrationId = integration.json().integrationId as string;

  const controlSource = await inject("POST", "/api/v1/control-sources", {
    controlType: "XDR",
    expectedBehaviors: ["Detected"],
    integrationId,
    provider: "Palo Alto Networks Cortex XDR"
  });
  const controlSourceId = controlSource.json().controlSourceId as string;

  // Snapshot (evidence pack) + evidence + report.
  const snapshot = await inject("POST", "/api/v1/snapshots", {
    audience: "Security Team",
    maxTopItems: 5
  });
  const snapshotId = snapshot.json().snapshotId as string;
  const evidenceId = (snapshot.json().evidenceIds as string[])[0]!;

  const report = await inject("POST", "/api/v1/reports", {
    audience: "Security Team",
    snapshotId
  });
  const evidencePackId = report.json().evidencePackId as string;

  // Member (roster) id.
  const members = await inject("GET", "/api/v1/tenants/current/members");
  const membershipId = (
    members.json().items as Array<{ membership: { membershipId: string } }>
  )[0]!.membership.membershipId;

  // API key.
  const apiKey = await inject("POST", "/api/v1/tenants/current/api-keys", {
    name: "iso-a-key",
    scopes: ["read", "write"]
  });
  const apiKeyId = apiKey.json().apiKeyId as string;

  // Webhook — URL must resolve publicly (SSRF guard); example.test does not.
  const webhook = await inject("POST", "/api/v1/tenants/current/webhooks", {
    events: ["mission.completed"],
    url: "https://example.com/hooks/iso-a"
  });
  expect(webhook.statusCode).toBe(201);
  const webhookId = webhook.json().webhookId as string;
  expect(webhookId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  );

  // Schedule.
  const schedule = await inject("POST", "/api/v1/schedules", {
    audience: "Security Team",
    frequency: "Daily",
    maxTopItems: 5,
    nextRunAt: "2026-01-01T00:00:00.000Z",
    scopeIds: [scopeId]
  });
  const scheduleId = schedule.json().scheduleId as string;

  // Mission (policy preview → create).
  const preview = await inject(
    "POST",
    `/api/v1/scopes/${scopeId}/policy-decisions/preview`,
    {
      executionEnvironment: "ExternalPoA",
      missionType: "ExposureValidation",
      requestedAction: testHelpers.safeRequestedAction(),
      safetyLevel: "ActiveNonInvasive",
      target: { hostname: "127.0.0.1", rateLimit: 10, templateProfile: "safe-baseline" }
    }
  );
  const mission = await inject("POST", "/api/v1/missions", {
    missionType: "ExposureValidation",
    policyDecisionId: preview.json().policyDecisionId,
    safetyLevel: "ActiveNonInvasive",
    scopeId
  });
  const missionId = mission.json().missionId as string;

  // Model-gateway provider.
  const provider = await inject("POST", "/api/v1/model-gateway/providers", {
    apiKey: "sk-iso-a-secret",
    authMethod: "bearer",
    deploymentType: "Cloud",
    endpointUrl: "https://api.openai.com/v1",
    providerName: "Iso A OpenAI",
    providerType: "OpenAICompatible"
  });
  const modelProviderId = provider.json().modelProviderId as string;

  // Threat advisory.
  const advisory = await inject("POST", "/api/v1/threat-advisories", {
    cveIds: ["CVE-2026-ISOA"],
    iocValues: [],
    publishedAt: new Date().toISOString(),
    rawContent: "iso a raw",
    sourceName: "Iso A Test",
    summary: "iso a advisory",
    techniqueIds: [],
    title: "Iso A Advisory"
  });
  const threatAdvisoryId = advisory.json().advisory.threatAdvisoryId as string;

  return {
    cookie,
    tenantId,
    scopeId,
    findingId,
    pathId,
    remediationId,
    controlSourceId,
    aiAppId,
    evidenceId,
    evidencePackId,
    snapshotId,
    membershipId,
    apiKeyId,
    webhookId,
    scheduleId,
    missionId,
    integrationId,
    modelProviderId,
    threatAdvisoryId
  };
}

describe("cross-tenant isolation matrix", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, ["iso-a", "iso-b"]);
      await prisma.$disconnect();
    }
  });

  it("forbids tenant B from reading or mutating any of tenant A's resources", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildTestApp(prisma);

    try {
      // --- Seed tenant A with the full resource set. ---
      const a = await seedTenantA(app, prisma);

      // Sanity: every id A owns actually resolves for A.
      const sanity: Array<[string, string]> = [
        ["scope", `/api/v1/scopes/${a.scopeId}`],
        ["finding", `/api/v1/findings/${a.findingId}`],
        ["attack-path", `/api/v1/attack-paths/${a.pathId}`],
        ["remediation", `/api/v1/remediations/${a.remediationId}`],
        ["control-source", `/api/v1/control-sources/${a.controlSourceId}`],
        ["ai-app", `/api/v1/ai-apps/${a.aiAppId}`],
        ["evidence", `/api/v1/evidence/${a.evidenceId}`],
        ["snapshot", `/api/v1/snapshots/${a.snapshotId}`],
        ["evidence-pack", `/api/v1/evidence-packs/${a.evidencePackId}`],
        ["schedule", `/api/v1/schedules/${a.scheduleId}`],
        ["mission", `/api/v1/missions/${a.missionId}`],
        ["integration", `/api/v1/integrations/${a.integrationId}`],
        ["provider", `/api/v1/model-gateway/providers/${a.modelProviderId}`],
        ["advisory", `/api/v1/threat-advisories/${a.threatAdvisoryId}`]
      ];
      for (const [label, url] of sanity) {
        const owned = await app.inject({
          cookies: testHelpers.authHeaders(a.cookie),
          method: "GET",
          url
        });
        expect(
          owned.statusCode,
          `tenant A should be able to read its own ${label} (${url})`
        ).toBe(200);
      }

      // --- Tenant B: an unrelated tenant. ---
      const { cookie: bCookie, response: bResponse } =
        await testHelpers.performSignup(app, "iso-b", "Iso B Tenant");
      const bAuth = testHelpers.authHeaders(bCookie);

      // Make B a FULLY capable tenant (identical Enterprise entitlements +
      // design-partner mode). This is deliberate: with every capability
      // precondition satisfied, the ONLY thing that can stop B from touching A's
      // data is the tenant-ownership boundary itself — so a 404/403 here is a
      // clean isolation proof, not an incidental entitlement rejection.
      await prisma.tenant.update({
        data: { billingPackageKey: "Enterprise" },
        where: { tenantId: bResponse.json().tenant.tenantId as string }
      });
      await app.inject({
        cookies: bAuth,
        method: "PUT",
        payload: { enabled: true },
        url: "/api/v1/tenants/current/design-partner"
      });

      // Cross-tenant DETAIL READS. Each must be invisible to B → 404 (never 403's
      // "exists but forbidden", which would confirm existence, and never 200).
      const crossReads: Array<[string, string]> = [
        ["scope", `/api/v1/scopes/${a.scopeId}`],
        ["finding", `/api/v1/findings/${a.findingId}`],
        ["attack-path", `/api/v1/attack-paths/${a.pathId}`],
        ["attack-path evidence", `/api/v1/attack-paths/${a.pathId}/evidence`],
        ["remediation", `/api/v1/remediations/${a.remediationId}`],
        ["remediation plan", `/api/v1/remediations/${a.remediationId}/plan`],
        [
          "remediation verification-events",
          `/api/v1/remediations/${a.remediationId}/verification-events`
        ],
        ["control-source", `/api/v1/control-sources/${a.controlSourceId}`],
        [
          "control-source history",
          `/api/v1/control-sources/${a.controlSourceId}/history`
        ],
        ["ai-app", `/api/v1/ai-apps/${a.aiAppId}`],
        ["ai-app history", `/api/v1/ai-apps/${a.aiAppId}/history`],
        ["evidence", `/api/v1/evidence/${a.evidenceId}`],
        ["evidence download", `/api/v1/evidence/${a.evidenceId}/download`],
        ["snapshot", `/api/v1/snapshots/${a.snapshotId}`],
        ["snapshot report", `/api/v1/snapshots/${a.snapshotId}/report`],
        ["evidence-pack", `/api/v1/evidence-packs/${a.evidencePackId}`],
        ["schedule", `/api/v1/schedules/${a.scheduleId}`],
        ["mission", `/api/v1/missions/${a.missionId}`],
        ["mission runs", `/api/v1/missions/${a.missionId}/runs`],
        ["integration", `/api/v1/integrations/${a.integrationId}`],
        ["integration health", `/api/v1/integrations/${a.integrationId}/health`],
        [
          "model provider",
          `/api/v1/model-gateway/providers/${a.modelProviderId}`
        ],
        ["threat advisory", `/api/v1/threat-advisories/${a.threatAdvisoryId}`]
      ];

      for (const [label, url] of crossReads) {
        const res = await app.inject({ cookies: bAuth, method: "GET", url });
        expect(
          res.statusCode,
          `tenant B must NOT read tenant A's ${label} (${url}) — got ${res.statusCode}`
        ).toBe(404);
      }

      // Cross-tenant MUTATIONS. Bodies are schema-valid so the ONLY basis for
      // rejection is the tenant boundary. Each must return 404 (or 403) — never a
      // 2xx that would mean B changed A's data.
      const crossMutations: Array<{
        label: string;
        method: "POST" | "PUT" | "PATCH" | "DELETE";
        url: string;
        body?: unknown;
      }> = [
        {
          label: "delete A's scope",
          method: "DELETE",
          url: `/api/v1/scopes/${a.scopeId}`
        },
        {
          label: "verify A's scope",
          method: "POST",
          url: `/api/v1/scopes/${a.scopeId}/verify`,
          body: { devModeManual: true }
        },
        {
          label: "transition A's finding",
          method: "POST",
          url: `/api/v1/findings/${a.findingId}/transition`,
          body: {
            disposition: "AcceptedRisk",
            expiresAt: new Date(Date.now() + 30 * DAY_MS).toISOString(),
            note: "cross-tenant attempt",
            ownerId: randomUUID()
          }
        },
        {
          label: "verify A's attack path",
          method: "POST",
          url: `/api/v1/attack-paths/${a.pathId}/verify`,
          body: { reason: "cross-tenant attempt" }
        },
        {
          label: "mark A's remediation ready",
          method: "POST",
          url: `/api/v1/remediations/${a.remediationId}/mark-ready-for-verification`
        },
        {
          label: "verify A's remediation",
          method: "POST",
          url: `/api/v1/remediations/${a.remediationId}/verify`,
          body: {}
        },
        {
          label: "tune A's control source",
          method: "PATCH",
          url: `/api/v1/control-sources/${a.controlSourceId}`,
          body: { expectedBehaviors: ["Detected", "Blocked"] }
        },
        {
          label: "validate A's control source",
          method: "POST",
          url: `/api/v1/control-sources/${a.controlSourceId}/validate`,
          body: { executionMode: "DryRun" }
        },
        {
          label: "validate A's AI app",
          method: "POST",
          url: `/api/v1/ai-apps/${a.aiAppId}/validate`,
          body: { executionMode: "LiveSafe" }
        },
        {
          label: "redact A's evidence",
          method: "POST",
          url: `/api/v1/evidence/${a.evidenceId}/redact`,
          body: {}
        },
        {
          label: "export A's report",
          method: "POST",
          url: `/api/v1/reports/${a.evidencePackId}/export`,
          body: { format: "html" }
        },
        {
          label: "write A's report analyst note",
          method: "PUT",
          // The analyst-note route keys off the snapshot id (see api-first flow).
          url: `/api/v1/reports/${a.snapshotId}/analyst-note`,
          body: { body: "cross-tenant note" }
        },
        {
          label: "pause A's schedule",
          method: "POST",
          url: `/api/v1/schedules/${a.scheduleId}/pause`
        },
        {
          label: "run A's schedule",
          method: "POST",
          url: `/api/v1/schedules/${a.scheduleId}/run`
        },
        {
          label: "delete A's schedule",
          method: "DELETE",
          url: `/api/v1/schedules/${a.scheduleId}`
        },
        {
          label: "start A's mission",
          method: "POST",
          url: `/api/v1/missions/${a.missionId}/start`,
          body: { moduleIds: ["nuclei.external_exposure_safe"] }
        },
        {
          label: "cancel A's mission",
          method: "POST",
          url: `/api/v1/missions/${a.missionId}/cancel`
        },
        {
          label: "sync A's integration",
          method: "POST",
          url: `/api/v1/integrations/${a.integrationId}/sync`
        },
        {
          label: "update A's model provider",
          method: "PATCH",
          url: `/api/v1/model-gateway/providers/${a.modelProviderId}`,
          body: { providerName: "hijacked" }
        },
        {
          label: "delete A's model provider",
          method: "DELETE",
          url: `/api/v1/model-gateway/providers/${a.modelProviderId}`
        },
        {
          label: "change A's member role",
          method: "PATCH",
          url: `/api/v1/tenants/current/members/${a.membershipId}`,
          body: { role: "Viewer" }
        },
        {
          label: "remove A's member",
          method: "DELETE",
          url: `/api/v1/tenants/current/members/${a.membershipId}`
        },
        {
          label: "rotate A's api key",
          method: "POST",
          url: `/api/v1/tenants/current/api-keys/${a.apiKeyId}/rotate`
        },
        {
          label: "delete A's api key",
          method: "DELETE",
          url: `/api/v1/tenants/current/api-keys/${a.apiKeyId}`
        },
        {
          label: "patch A's webhook",
          method: "PATCH",
          url: `/api/v1/tenants/current/webhooks/${a.webhookId}`,
          body: { enabled: false }
        },
        {
          label: "test A's webhook",
          method: "POST",
          url: `/api/v1/tenants/current/webhooks/${a.webhookId}/test`
        },
        {
          label: "delete A's webhook",
          method: "DELETE",
          url: `/api/v1/tenants/current/webhooks/${a.webhookId}`
        }
      ];

      for (const probe of crossMutations) {
        const res = await app.inject({
          cookies: bAuth,
          method: probe.method,
          payload: probe.body,
          url: probe.url
        });
        expect(
          res.statusCode < 400,
          `tenant B must NOT ${probe.label} (${probe.method} ${probe.url}) — got ${res.statusCode} ${res.body?.slice?.(0, 200) ?? ""}`
        ).toBe(false);
        // Denials are 404 (invisible) or 403 (forbidden). A 2xx here is a LEAK.
        expect(
          [403, 404],
          `tenant B ${probe.label}: expected 403/404, got ${res.statusCode}`
        ).toContain(res.statusCode);
      }

      // --- List endpoints for B must never surface A's ids. ---
      const idNotIn = (haystack: unknown, needle: string) =>
        !JSON.stringify(haystack ?? {}).includes(needle);

      const listChecks: Array<[string, string, string]> = [
        ["scopes", "/api/v1/scopes", a.scopeId],
        ["findings", "/api/v1/findings", a.findingId],
        ["attack-paths", "/api/v1/attack-paths", a.pathId],
        ["remediations", "/api/v1/remediations", a.remediationId],
        ["control-sources", "/api/v1/control-sources", a.controlSourceId],
        ["ai-apps", "/api/v1/ai-apps", a.aiAppId],
        ["snapshots", "/api/v1/snapshots", a.snapshotId],
        ["schedules", "/api/v1/schedules", a.scheduleId],
        ["missions", "/api/v1/missions", a.missionId],
        ["integrations", "/api/v1/integrations", a.integrationId],
        ["api-keys", "/api/v1/tenants/current/api-keys", a.apiKeyId],
        ["webhooks", "/api/v1/tenants/current/webhooks", a.webhookId],
        ["members", "/api/v1/tenants/current/members", a.membershipId],
        [
          "model providers",
          "/api/v1/model-gateway/providers",
          a.modelProviderId
        ],
        ["threat advisories", "/api/v1/threat-advisories", a.threatAdvisoryId],
        [
          "search (scope id)",
          `/api/v1/search?q=${a.scopeId.slice(0, 12)}`,
          a.scopeId
        ]
      ];

      for (const [label, url, id] of listChecks) {
        const res = await app.inject({ cookies: bAuth, method: "GET", url });
        expect(
          res.statusCode,
          `tenant B list ${label} (${url}) should succeed`
        ).toBe(200);
        expect(
          idNotIn(res.json(), id),
          `tenant B's ${label} list must NOT contain tenant A's id ${id}`
        ).toBe(true);
      }
    } finally {
      await app.close();
    }
  }, 90_000);
});

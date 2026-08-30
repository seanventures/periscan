import {
  createHash,
  generateKeyPairSync,
  randomUUID,
  sign
} from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import {
  CONTINUOUS_EASM_HONESTY_NOTE,
  CONTINUOUS_EASM_SAFE_MODULE_ALLOWLIST,
  isContinuousEasmSafeModuleId,
  resolveContinuousEasmModuleIds
} from "../../packages/shared/src/continuous-easm.js";
import { VALID_RUNNER_CSR_PEM } from "./helpers/runner-csr.js";
import * as testHelpers from "./helpers.js";

/**
 * Swarm S5 — ASV/EASM discover path E2E (matrix #1).
 *
 * Product path (honest, scope-seeded — no autonomous CT/whois):
 *   verified scope → allowlisted recon discover task → mock runner result
 *   → signals + evidence graph → snapshot path correlation
 *   → Heuristic vs Measured labels never lied about.
 *
 * Continuous EASM schedule module allowlist is also locked here so schedule
 * fire cannot queue Atomic/exploit modules.
 */

const SESSION_COOKIE_NAME = "periscan_session";

function makeSigner() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    publicKeyPem: publicKey.export({ format: "pem", type: "spki" }).toString(),
    sign: (localAuditSha256: string) =>
      sign(null, Buffer.from(localAuditSha256, "utf8"), privateKey).toString(
        "base64"
      )
  };
}

function authCookies(cookie: string) {
  return { [SESSION_COOKIE_NAME]: cookie };
}

function signalTemplate(
  tenantId: string,
  partial: {
    signalCategory: string;
    signalSubcategory: string;
    sourceType: string;
    rawPayloadPointer?: string | null;
    relatedAssetIds?: string[];
    confidence?: number;
  }
) {
  const now = new Date().toISOString();
  return {
    confidence: partial.confidence ?? 0.9,
    createdAt: now,
    evidenceIds: [] as string[],
    freshness: "Fresh" as const,
    rawPayloadPointer: partial.rawPayloadPointer ?? null,
    redactionStatus: "Redacted" as const,
    relatedAssetIds: partial.relatedAssetIds ?? [],
    relatedControlIds: [] as string[],
    relatedEvidenceIds: [] as string[],
    relatedIdentityIds: [] as string[],
    relatedPathIds: [] as string[],
    sensitivityLevel: "Moderate" as const,
    signalCategory: partial.signalCategory,
    signalId: randomUUID(),
    signalSubcategory: partial.signalSubcategory,
    sourceType: partial.sourceType,
    sourceVendor: "Periscan",
    techniqueIds: [] as string[],
    tenantId,
    timestampIngested: now,
    timestampObserved: now,
    updatedAt: now
  };
}

describe("ASV/EASM discover path acceptance (Swarm S5)", () => {
  let prisma: ReturnType<typeof createPrismaClient> | undefined;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, ["asv-easm-s5"]);
      await prisma.$disconnect();
      prisma = undefined;
    }
  });

  it("scope-authorized recon → runner result → signals → Heuristic + Measured path correlation", async () => {
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
    const signer = makeSigner();

    try {
      // --- Continuous EASM allowlist honesty (no Atomic / exploit / CT pivot) ---
      expect(
        CONTINUOUS_EASM_SAFE_MODULE_ALLOWLIST.every(isContinuousEasmSafeModuleId)
      ).toBe(true);
      expect(
        CONTINUOUS_EASM_SAFE_MODULE_ALLOWLIST.some((id) =>
          /atomic|caldera|sharp|exploit|ransomware/i.test(id)
        )
      ).toBe(false);
      expect(CONTINUOUS_EASM_HONESTY_NOTE).toMatch(/verified customer scopes/i);
      expect(CONTINUOUS_EASM_HONESTY_NOTE).toMatch(
        /not cert-transparency or whois/i
      );

      const domainModules = resolveContinuousEasmModuleIds({
        scopeType: "Domain"
      });
      expect(domainModules).toEqual(
        expect.arrayContaining([
          "nuclei.external_exposure_safe",
          "periscan.dns_resolution_check",
          "periscan.tls_certificate_check"
        ])
      );
      const internalModules = resolveContinuousEasmModuleIds({
        scopeType: "InternalNetwork",
        configModuleIds: [
          "recon.host_discovery",
          "atomic.control_validation_safe",
          "exploit.metasploit_check"
        ]
      });
      // Config intersection with hard allowlist drops Atomic/exploit.
      expect(internalModules).toEqual(["recon.host_discovery"]);
      expect(internalModules).not.toContain("atomic.control_validation_safe");

      // --- Tenant + verified scopes (user-declared seeds only) ---
      const signup = await app.inject({
        method: "POST",
        payload: {
          email: testHelpers.uniqueEmail("asv-easm-s5"),
          name: "ASV EASM S5 Owner",
          password: "periscan-asv-easm-s5-password",
          tenantName: "ASV EASM S5 Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(signup.statusCode).toBe(201);
      const cookie = testHelpers.getSessionCookie(signup);
      const tenantId = signup.json().tenant.tenantId as string;

      const domainScope = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `asv-easm-${randomUUID().slice(0, 8)}.example.com`
        },
        url: "/api/v1/scopes"
      });
      expect(domainScope.statusCode).toBe(201);
      const domainScopeId = domainScope.json().scopeId as string;
      const verifyDomain = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${domainScopeId}/verify`
      });
      expect(verifyDomain.statusCode).toBe(200);

      const internalScope = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { scopeType: "InternalNetwork", value: "corp-lan-asv" },
        url: "/api/v1/scopes"
      });
      expect(internalScope.statusCode).toBe(201);
      const internalScopeId = internalScope.json().scopeId as string;
      const verifyInternal = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${internalScopeId}/verify`
      });
      expect(verifyInternal.statusCode).toBe(200);

      // Unverified scope must not authorize discover.
      const unverifiedScope = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { scopeType: "InternalNetwork", value: "unverified-lan" },
        url: "/api/v1/scopes"
      });
      expect(unverifiedScope.statusCode).toBe(201);
      const unverifiedScopeId = unverifiedScope.json().scopeId as string;

      // --- Runner registration (result-signing required) ---
      const tokenResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          deploymentMode: "Docker",
          expiresInSeconds: 3600,
          labels: ["asv-easm-s5"],
          runnerName: "asv-easm-s5-runner"
        },
        url: "/api/v1/runners/registration-tokens"
      });
      expect(tokenResponse.statusCode).toBe(201);

      const registerResponse = await app.inject({
        method: "POST",
        payload: {
          arch: "amd64",
          capabilities: {
            supportsArtifactUpload: true,
            supportsHttpConnectProxy: true,
            supportsLocalReachability: true,
            supportsLongPoll: true,
            supportsWebSocket: false
          },
          csrPem: VALID_RUNNER_CSR_PEM,
          deploymentMode: "Docker",
          hostname: "asv-easm-s5-runner",
          labels: ["asv-easm-s5"],
          networkProfile: {
            additionalEgressNotes: null,
            dnsResolutionRequired: true,
            explicitProxyUrl: null,
            gatewayHostnames: ["runner.periscan.cloud"],
            httpConnectProxySupported: true,
            outboundHttpsPorts: [443]
          },
          os: "linux",
          registrationToken: tokenResponse.json().registrationToken,
          resultSigningPublicKeyPem: signer.publicKeyPem,
          runnerName: "asv-easm-s5-runner",
          version: "0.1.0"
        },
        url: "/api/v1/runners/register"
      });
      expect(registerResponse.statusCode).toBe(201);
      const runnerId = registerResponse.json().credentials.runnerId as string;
      const runnerAuthToken = registerResponse.json().credentials
        .runnerAuthToken as string;

      // --- Discover task: allowlisted recon only ---
      const hostDiscovery = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          moduleId: "recon.host_discovery",
          scopeId: internalScopeId,
          target: "10.20.0.0/24"
        },
        url: `/api/v1/runners/${runnerId}/tasks/discover`
      });
      expect(hostDiscovery.statusCode).toBe(201);
      const discoverBody = hostDiscovery.json();
      expect(discoverBody.envelope.moduleId).toBe("recon.host_discovery");
      expect(discoverBody.envelope.executionEnvironment).toBe("InternalRunner");
      expect(discoverBody.envelope.signature.algorithm).toBeTruthy();
      expect(discoverBody.envelope.target.targets).toBe("10.20.0.0/24");
      const discoverTaskId = discoverBody.task.taskId as string;
      const discoverRunId = discoverBody.run.runId as string;

      const deniedUnverified = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          moduleId: "recon.host_discovery",
          scopeId: unverifiedScopeId,
          target: "10.20.0.0/24"
        },
        url: `/api/v1/runners/${runnerId}/tasks/discover`
      });
      expect(deniedUnverified.statusCode).toBe(400);
      expect(deniedUnverified.json().code).toBe("verified_scope_required");

      const deniedOffensive = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          moduleId: "exploit.metasploit_check",
          scopeId: internalScopeId,
          target: "10.20.0.0/24"
        },
        url: `/api/v1/runners/${runnerId}/tasks/discover`
      });
      expect(deniedOffensive.statusCode).toBe(400);

      // --- Mock runner: evidence upload + completed result with signals ---
      // Host inventory evidence (hosts discovered in-network).
      // Heuristic multi-signal pair → path correlation labels Heuristic.
      // Measured DO firewall-shaped signal → path correlation labels Measured.
      const discoveryEvidenceContent = JSON.stringify({
        hostCount: 2,
        hosts: [
          { host: "10.20.0.10" },
          { host: "10.20.0.20" }
        ],
        measured: true,
        moduleId: "recon.host_discovery",
        targets: "10.20.0.0/24"
      });
      const discoverySha = createHash("sha256")
        .update(discoveryEvidenceContent)
        .digest("hex");
      const upload = await app.inject({
        headers: { authorization: `Bearer ${runnerAuthToken}` },
        method: "POST",
        payload: {
          artifactType: "NormalizedEvidence",
          contentBase64: Buffer.from(discoveryEvidenceContent).toString(
            "base64"
          ),
          contentType: "application/json",
          filename: "host-discovery-result.json",
          sha256: discoverySha,
          sizeBytes: Buffer.byteLength(discoveryEvidenceContent)
        },
        url: `/api/v1/runners/${runnerId}/tasks/${discoverTaskId}/artifacts`
      });
      expect(upload.statusCode).toBe(201);
      const evidenceId = upload.json().artifact.evidenceId as string;
      expect(typeof evidenceId).toBe("string");
      const evidenceManifestItem = {
        artifactType: "NormalizedEvidence" as const,
        evidenceId,
        redactionStatus: upload.json().artifact.redactionStatus as string,
        sha256: upload.json().artifact.sha256 as string,
        sizeBytes: Buffer.byteLength(discoveryEvidenceContent)
      };

      const externalSignal = signalTemplate(tenantId, {
        confidence: 0.88,
        signalCategory: "Exposure",
        signalSubcategory: "ExternalExposure",
        sourceType: "recon.host_discovery.external_seed"
      });
      const cloudSignal = signalTemplate(tenantId, {
        confidence: 0.86,
        signalCategory: "Cloud",
        signalSubcategory: "PublicExposure",
        sourceType: "recon.host_discovery.cloud_seed"
      });
      // Measured CSV-style cloud config exposure (same correlation path as DO
      // authoritative firewall parse) — proves Measured label on path edges.
      const measuredDoSignal = signalTemplate(tenantId, {
        confidence: 0.95,
        signalCategory: "Exposure",
        signalSubcategory: "DigitalOceanInternetOpenSensitivePort",
        sourceType: "digitalocean.firewall.internet_open_sensitive_port",
        rawPayloadPointer:
          "digitalocean://droplets/9001/firewall/internet-open?droplet=asv-easm-db&ports=tcp%2F22"
      });

      const localAudit = "e".repeat(64);
      const submit = await app.inject({
        headers: { authorization: `Bearer ${runnerAuthToken}` },
        method: "POST",
        payload: {
          completedAt: new Date().toISOString(),
          evidenceManifest: [evidenceManifestItem],
          localAuditSha256: localAudit,
          outcome: "hosts_discovered",
          resultSignature: signer.sign(localAudit),
          runId: discoverRunId,
          runnerId,
          signals: [externalSignal, cloudSignal, measuredDoSignal],
          startedAt: new Date().toISOString(),
          status: "Completed",
          taskId: discoverTaskId,
          tenantId,
          validationState: "Reachable"
        },
        url: `/api/v1/runners/${runnerId}/tasks/${discoverTaskId}/result`
      });
      expect(submit.statusCode).toBe(200);

      // Signals persisted with runner provenance (in-network measure).
      const persisted = await prisma.signalEnvelope.findMany({
        where: { tenantId }
      });
      expect(persisted.length).toBeGreaterThanOrEqual(3);
      expect(persisted.every((s) => s.sourceRunnerId === runnerId)).toBe(true);
      expect(persisted.every((s) => s.evidenceIds.length > 0)).toBe(true);
      expect(
        persisted.some((s) => s.signalSubcategory === "ExternalExposure")
      ).toBe(true);
      expect(
        persisted.some(
          (s) => s.signalSubcategory === "DigitalOceanInternetOpenSensitivePort"
        )
      ).toBe(true);

      // Graph projection of the validation run exists.
      const runNode = await prisma.graphNode.findFirst({
        where: {
          nodeKey: `validation-run:${discoverRunId}`,
          tenantId
        }
      });
      expect(runNode).not.toBeNull();

      // --- Snapshot path correlation: Heuristic vs Measured honesty ---
      const snapshot = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { audience: "Security Team", maxTopItems: 5 },
        url: "/api/v1/snapshots"
      });
      expect(snapshot.statusCode).toBe(201);

      const pathsResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/attack-paths"
      });
      expect(pathsResponse.statusCode).toBe(200);
      const paths = (
        pathsResponse.json().items as Array<{
          attackPath: {
            evidenceBasis: string;
            methodology: string | null;
            name: string;
            pathEdges: Array<{
              evidenceBasis: string;
              measurementMethod: string | null;
            }>;
            validationState: string;
          };
        }>
      ).map((item) => item.attackPath);

      expect(paths.length).toBeGreaterThan(0);

      const measuredPath = paths.find((path) =>
        path.name.includes("digitalocean-droplet/asv-easm-db")
      );
      expect(measuredPath).toBeDefined();
      expect(measuredPath!.evidenceBasis).toBe("Measured");
      expect(measuredPath!.validationState).toBe("Reachable");
      expect(measuredPath!.validationState).not.toBe("Exploitable");
      expect(measuredPath!.methodology ?? "").toMatch(/measured/i);
      expect(
        measuredPath!.pathEdges.every((edge) => edge.evidenceBasis === "Measured")
      ).toBe(true);
      expect(measuredPath!.pathEdges[0]?.measurementMethod).toBe(
        "authoritative-config:digitalocean-firewall-ingress"
      );

      const heuristicPath = paths.find(
        (path) =>
          path.name.includes("Internet-facing service") ||
          (path.evidenceBasis === "Heuristic" &&
            (path.methodology ?? "").includes("heuristic"))
      );
      expect(heuristicPath).toBeDefined();
      expect(heuristicPath!.evidenceBasis).toBe("Heuristic");
      expect(heuristicPath!.validationState).not.toBe("Exploitable");
      expect(heuristicPath!.validationState).not.toBe("Validated");
      expect(heuristicPath!.methodology ?? "").toMatch(/heuristic/i);

      // Assets exist for the measured droplet anchor (created on path persist).
      const assets = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/assets"
      });
      expect(assets.statusCode).toBe(200);
      const assetItems = assets.json().items as Array<{ name: string }>;
      expect(
        assetItems.some((asset) =>
          asset.name.includes("digitalocean-droplet/asv-easm-db")
        )
      ).toBe(true);

      // No secret material from runner auth leaked into path surface.
      expect(JSON.stringify(pathsResponse.json())).not.toContain(
        runnerAuthToken
      );
    } finally {
      await app.close();
    }
  }, 60_000);
});

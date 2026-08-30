import {
  execFileSync
} from "node:child_process";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import dns from "node:dns";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import { pollOnce } from "../../apps/runner-agent/src/poll.js";
import { correlateAttackPathsFromSignals } from "../../packages/evidence/src/correlation.js";
import { VALID_RUNNER_CSR_PEM } from "../acceptance/helpers/runner-csr.js";

// ---------------------------------------------------------------------------
// WS-runner — the honest MEASURED closed loop, driven by a REAL in-network
// RUNNER AGENT (not the control-plane live-probe path).
//
// This proves the runner-executed measured loop end to end against the committed
// containerized test range (infra/test-range, EXPOSED profile):
//
//   signup
//     → registration-token → runner /register (with an Ed25519 result-signing key)
//     → verified Domain scope "app.range.test"
//     → POST /runners/:id/tasks/measured  (control plane SIGNS an EdDSA task
//       envelope for periscan.http_cors_audit and queues it)
//     → the runner AGENT (apps/runner-agent pollOnce) dials OUT over real HTTP,
//       pulls the queued task, VERIFIES the control-plane task signature,
//       EXECUTES http_cors_audit as a real network probe against the range,
//       SIGNS the result over its localAuditSha256, and submits it
//     → the control plane VERIFIES the runner's result signature and PERSISTS a
//       MEASURED finding.
//
// Asserted outcomes (all earned by measurement, none fabricated):
//   • the agent submitted exactly one Completed result with validationState
//     "Exploitable" (a measured, actively-confirmed working CORS exploit);
//   • the persisted RunnerTask is Completed and resultSignatureVerifiedAt is set
//     (the runner-signed result was cryptographically verified server-side);
//   • the persisted ValidationRun.validationState === "Exploitable";
//   • a SignalEnvelope was persisted with sourceRunnerId === the runner
//     (provenance: measured IN-NETWORK by this runner, not control-plane).
//
// ── Why HTTPS + the range CA (and NOT port 80) ──
//   periscan.http_cors_audit builds its probe URL as https://<hostname> and does
//   NOT use the dispatched port (packages/modules/src/index.ts). The range serves
//   the reflected-origin + Access-Control-Allow-Credentials exposure ONLY on
//   :443 (infra/test-range/nginx/exposed/default.conf); :80 is plain cleartext
//   with no CORS headers. So the measured Exploitable verdict is earned over
//   HTTPS, which means global fetch (undici) must trust the range's local CA.
//   NODE_EXTRA_CA_CERTS is read by Node ONCE at boot, so it must be set BEFORE
//   vitest launches — run this via tests/e2e-runner-measured/run-macos.sh (which
//   brings the range up, extracts the CA, and sets the env).
//
// Gated on RUN_MEASURED_E2E=1 (the wrapper sets it); auto-skipped otherwise.
// ---------------------------------------------------------------------------

const RUN = process.env.RUN_MEASURED_E2E === "1";

const SESSION_COOKIE_NAME = "periscan_session";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..");
const RANGE_SRC = path.join(REPO_ROOT, "infra", "test-range");
const RANGE_DIR = process.env.RANGE_DIR
  ? path.resolve(process.env.RANGE_DIR)
  : path.join(homedir(), ".periscan-measured-range");

const APP_HOST = "app.range.test";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Map *.range.test → 127.0.0.1 in-process (no sudo /etc/hosts). fetch (undici)
// resolves through dns.lookup/getaddrinfo, so this covers the module's HTTPS probe.
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

// Poll until nginx serves the EXPOSED profile. The reflected CORS credentials
// header on https://app.range.test/ (present ONLY on exposed) deterministically
// signals readiness, so we never race an in-flight `docker compose up` reload.
async function waitForExposed(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let lastErr = "";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`https://${APP_HOST}/`, {
        headers: { origin: "https://cors-probe.periscan.dev" },
        redirect: "manual"
      });
      const reflectsCredentials =
        (response.headers.get("access-control-allow-credentials") ?? "")
          .trim()
          .toLowerCase() === "true";
      await response.arrayBuffer().catch(() => undefined);
      if (reflectsCredentials) {
        return;
      }
      lastErr = "credentials header not present yet";
    } catch (error) {
      lastErr = error instanceof Error ? error.message : String(error);
    }
    await sleep(1000);
  }
  throw new Error(
    `Range did not reach the exposed profile in time (${lastErr}). ` +
      `Is the range up and is NODE_EXTRA_CA_CERTS pointed at the range CA?`
  );
}

const describeMaybe = RUN ? describe : describe.skip;

describeMaybe(
  "Runner-executed measured loop: signed task → agent probe → runner-signed Exploitable",
  () => {
    const prisma = createPrismaClient();
    let app: Awaited<ReturnType<typeof buildApp>>;
    let controlPlaneUrl = "";
    let cookie = "";
    let tenantId = "";
    let runnerId = "";
    let runnerAuthToken = "";
    let taskSigningPublicKeyPem = "";
    let scopeId = "";
    // The runner's own Ed25519 result-signing keypair. The public half is
    // registered with the control plane; the private half signs every result.
    const resultSigningKeys = generateKeyPairSync("ed25519");
    const resultSigningPublicKeyPem = resultSigningKeys.publicKey
      .export({ format: "pem", type: "spki" })
      .toString();
    const resultSigningPrivateKeyPem = resultSigningKeys.privateKey
      .export({ format: "pem", type: "pkcs8" })
      .toString();

    beforeAll(async () => {
      // 1. Ensure the range lives at RANGE_DIR (copy from the repo when the
      //    caller did not stage it — sidesteps the macOS /Volumes bind-mount).
      if (!existsSync(path.join(RANGE_DIR, "docker-compose.yml"))) {
        mkdirSync(RANGE_DIR, { recursive: true });
        cpSync(RANGE_SRC, RANGE_DIR, { recursive: true });
      }

      // 2. In-process host mapping so the module's HTTPS probe reaches the range.
      installRangeDnsLookup();

      // 3. Bring up the EXPOSED profile and wait until it actually serves it.
      compose("exposed", ["up", "-d"]);
      await waitForExposed();

      // 4. Real product path: build the app against the live test DB and LISTEN
      //    on a real port — the runner agent fetches over HTTP, it is not injected.
      app = await buildApp({
        devMode: true,
        services: createRuntimeServices({
          dataRegion: process.env.PERISCAN_DATA_REGION ?? "us-east-1",
          devMode: true,
          prisma
        })
      });
      await app.listen({ host: "127.0.0.1", port: 0 });
      const address = app.server.address();
      if (!address || typeof address === "string") {
        throw new Error("Expected a TCP address for the control plane.");
      }
      controlPlaneUrl = `http://127.0.0.1:${address.port}`;

      // Signup → tenant + session.
      const signup = await app.inject({
        method: "POST",
        payload: {
          email: `runner-measured-${randomUUID()}@periscan.test`,
          name: "Runner Measured Owner",
          password: "periscan-runner-measured-password",
          tenantName: "Runner Measured Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(signup.statusCode, signup.payload).toBe(201);
      cookie = signup.cookies.find((c) => c.name === SESSION_COOKIE_NAME)!.value;
      tenantId = signup.json().tenant.tenantId as string;

      // Registration token → runner register (WITH a result-signing public key,
      // so the control plane holds every result to a verified signature).
      const tokenResponse = await app.inject({
        cookies: { [SESSION_COOKIE_NAME]: cookie },
        method: "POST",
        payload: {
          deploymentMode: "Docker",
          expiresInSeconds: 3600,
          labels: ["runner-measured-e2e"],
          runnerName: "runner-measured-e2e"
        },
        url: "/api/v1/runners/registration-tokens"
      });
      expect(tokenResponse.statusCode, tokenResponse.payload).toBe(201);

      const register = await app.inject({
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
          hostname: "runner-measured-e2e",
          labels: ["runner-measured-e2e"],
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
          resultSigningPublicKeyPem,
          runnerName: "runner-measured-e2e",
          version: "0.1.0"
        },
        url: "/api/v1/runners/register"
      });
      expect(register.statusCode, register.payload).toBe(201);
      runnerId = register.json().credentials.runnerId as string;
      runnerAuthToken = register.json().credentials.runnerAuthToken as string;
      taskSigningPublicKeyPem = register.json().credentials
        .taskSigningPublicKeyPem as string;
      expect(taskSigningPublicKeyPem).toBeTruthy();

      // Verified Domain scope for the range host.
      const created = await app.inject({
        cookies: { [SESSION_COOKIE_NAME]: cookie },
        method: "POST",
        payload: { scopeType: "Domain", value: APP_HOST },
        url: "/api/v1/scopes"
      });
      expect(created.statusCode, created.payload).toBe(201);
      scopeId = created.json().scopeId as string;
      const verify = await app.inject({
        cookies: { [SESSION_COOKIE_NAME]: cookie },
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });
      expect(verify.statusCode, verify.payload).toBe(200);
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

    it("dispatches a signed task the runner agent verifies, probes, signs, and the control plane persists as a MEASURED Exploitable finding", async () => {
      // Control plane signs + queues an EdDSA task envelope for the runner-safe
      // measured module. NOTE: periscan.http_cors_audit probes https://<host>
      // regardless of the dispatched port, and the range's reflected-CORS +
      // credentials exposure is served on :443, so the measured Exploitable
      // verdict is earned over HTTPS (port here only shapes scopeConstraints).
      const dispatch = await app.inject({
        cookies: { [SESSION_COOKIE_NAME]: cookie },
        method: "POST",
        payload: {
          moduleId: "periscan.http_cors_audit",
          port: 443,
          scopeId,
          targetHost: APP_HOST
        },
        url: `/api/v1/runners/${runnerId}/tasks/measured`
      });
      expect(dispatch.statusCode, dispatch.payload).toBe(201);
      const dispatched = dispatch.json();
      const taskId = dispatched.task.taskId as string;
      const runId = dispatched.run.runId as string;
      expect(dispatched.envelope.moduleId).toBe("periscan.http_cors_audit");
      expect(dispatched.envelope.executionEnvironment).toBe("InternalRunner");
      expect(dispatched.envelope.signature.algorithm).toBe("EdDSA");

      // Run the REAL in-network runner agent: it dials out to the control plane,
      // pulls + verifies the signed task, executes http_cors_audit as a live
      // probe against the range, uploads redacted evidence, signs the result over
      // its localAuditSha256, and submits it.
      const outcome = await pollOnce({
        allowedSafetyLevels: new Set(["PassiveReadOnly", "ActiveNonInvasive"]),
        allowlistedModuleIds: new Set(["periscan.http_cors_audit"]),
        authToken: runnerAuthToken,
        controlPlaneUrl,
        killSwitch: false,
        pollIntervalSeconds: 30,
        resultSigningPrivateKeyPem,
        runnerId,
        signingKeyId: null,
        signingPublicKeyPem: taskSigningPublicKeyPem,
        tenantId
      });

      // The agent verified the signed task, executed it, and submitted exactly
      // one Completed, runner-signed result carrying the measured verdict.
      expect(outcome.skippedForKillSwitch).toBe(false);
      expect(outcome.submitted).toHaveLength(1);
      const submitted = outcome.submitted[0]!;
      expect(submitted.taskId).toBe(taskId);
      expect(submitted.status).toBe("Completed");
      expect(submitted.validationState).toBe("Exploitable");
      // The result was signed by the runner's Ed25519 key over localAuditSha256.
      expect(submitted.resultSignature).toBeTruthy();
      // The module produced a measured exposure signal for a working CORS exploit.
      expect(submitted.signals.length).toBeGreaterThan(0);

      // Server-side: the persisted RunnerTask is Completed and the runner-signed
      // result was CRYPTOGRAPHICALLY VERIFIED (resultSignatureVerifiedAt set).
      const persistedTask = await prisma.runnerTask.findUniqueOrThrow({
        where: { taskId }
      });
      expect(persistedTask.status).toBe("Completed");
      expect(persistedTask.resultSignatureVerifiedAt).not.toBeNull();
      expect(persistedTask.resultSignature).toBe(submitted.resultSignature);
      expect(persistedTask.localAuditHash).toBe(submitted.localAuditSha256);

      // The persisted ValidationRun carries the MEASURED Exploitable verdict.
      const persistedRun = await prisma.validationRun.findUniqueOrThrow({
        where: { runId }
      });
      expect(persistedRun.status).toBe("Completed");
      expect(persistedRun.validationState).toBe("Exploitable");
      expect(persistedRun.moduleId).toBe("periscan.http_cors_audit");

      // Provenance: the measured signal is tagged as measured IN-NETWORK by this
      // runner (sourceRunnerId set — control-plane measurement leaves it null).
      const persistedSignal = await prisma.signalEnvelope.findFirst({
        where: { sourceRunnerId: runnerId, tenantId }
      });
      expect(persistedSignal).not.toBeNull();
      expect(persistedSignal?.sourceType).toContain("http_cors_audit");
      expect(persistedSignal?.signalCategory).toBe("Exposure");

      console.log(
        `[runner-measured-loop] proven: signed task ${taskId} → agent verified ` +
          `+ probed https://${APP_HOST}/ → runner-signed result verified ` +
          `server-side → ValidationRun ${runId} validationState=Exploitable ` +
          `(measured in-network by runner ${runnerId}).`
      );
    }, 180_000);

    it("measures reachability via the runner and fuses it with the CORS exploit into a MEASURED multi-hop Exploitable path", async () => {
      // Edge 1: dispatch the runner-safe TCP reachability probe against the same
      // host. The agent opens one real TCP connection (no payload) and returns a
      // signed measured Reachable result.
      const dispatch = await app.inject({
        cookies: { [SESSION_COOKIE_NAME]: cookie },
        method: "POST",
        payload: {
          moduleId: "periscan.tcp_reachability",
          port: 443,
          scopeId,
          targetHost: APP_HOST
        },
        url: `/api/v1/runners/${runnerId}/tasks/measured`
      });
      expect(dispatch.statusCode, dispatch.payload).toBe(201);
      const dispatched = dispatch.json();
      const runId = dispatched.run.runId as string;

      const outcome = await pollOnce({
        allowedSafetyLevels: new Set(["PassiveReadOnly", "ActiveNonInvasive"]),
        allowlistedModuleIds: new Set(["periscan.tcp_reachability"]),
        authToken: runnerAuthToken,
        controlPlaneUrl,
        killSwitch: false,
        pollIntervalSeconds: 30,
        resultSigningPrivateKeyPem,
        runnerId,
        signingKeyId: null,
        signingPublicKeyPem: taskSigningPublicKeyPem,
        tenantId
      });
      expect(outcome.submitted).toHaveLength(1);
      expect(outcome.submitted[0]!.status).toBe("Completed");

      // The persisted reachability run is a measured Reachable verdict.
      const reachRun = await prisma.validationRun.findUniqueOrThrow({
        where: { runId }
      });
      expect(reachRun.validationState).toBe("Reachable");
      expect(reachRun.moduleId).toBe("periscan.tcp_reachability");

      // Both measured signals now exist in-network for this host. Load them and
      // run the real correlation engine (the same one the product uses).
      const signalRows = await prisma.signalEnvelope.findMany({
        where: {
          signalSubcategory: {
            in: ["TcpPortReachable", "HttpCredentialedCorsExploit"]
          },
          sourceRunnerId: runnerId,
          tenantId
        }
      });
      expect(signalRows.length).toBeGreaterThanOrEqual(2);

      const nowIso = new Date().toISOString();
      const correlationSignals = signalRows.map((row) => ({
        confidence: row.confidence ?? 0.9,
        createdAt: nowIso,
        evidenceIds: row.evidenceIds ?? [],
        freshness: "Fresh" as const,
        rawPayloadPointer: row.rawPayloadPointer,
        redactionStatus: "Redacted" as const,
        relatedAssetIds: [],
        relatedControlIds: [],
        relatedEvidenceIds: [],
        relatedIdentityIds: [],
        relatedPathIds: [],
        sensitivityLevel: "Moderate" as const,
        signalCategory: row.signalCategory,
        signalId: row.signalId,
        signalSubcategory: row.signalSubcategory ?? undefined,
        sourceIntegrationId: null,
        sourceType: row.sourceType,
        sourceVendor: row.sourceVendor ?? "Periscan",
        tenantId: row.tenantId,
        techniqueIds: row.techniqueIds ?? [],
        timestampIngested: nowIso,
        timestampObserved: nowIso,
        updatedAt: nowIso
      }));

      const paths = correlateAttackPathsFromSignals({
        signals: correlationSignals
      });
      const fused = paths.find(
        (path) => path.patternId === "measured-reachability-exploit"
      );

      // The fused path is MEASURED end-to-end (both edges from real runner probes)
      // and legitimately reaches Exploitable.
      expect(fused).toBeDefined();
      expect(fused?.heuristic).toBe(false);
      expect(fused?.methodology).toContain("measured-runner-probe");
      expect(fused?.validationState).toBe("Exploitable");
      const exposureStates = fused?.nodes
        .filter((node) => node.entityType === "Exposure")
        .map((node) => (node as { validationState: string }).validationState);
      expect(exposureStates).toContain("Reachable");
      expect(exposureStates).toContain("Exploitable");

      console.log(
        `[runner-measured-loop] proven: runner-measured Reachable (${APP_HOST}:443) ` +
          `+ runner-measured Exploitable (CORS) → fused MEASURED multi-hop attack ` +
          `path (heuristic=false, validationState=Exploitable), per-edge evidence.`
      );
    }, 180_000);
  }
);

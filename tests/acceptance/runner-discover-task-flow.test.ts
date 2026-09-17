import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import { VALID_RUNNER_CSR_PEM } from "./helpers/runner-csr.js";

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

describe("Runner discovery-task acceptance workflow", () => {
  it("dispatches an allowlisted in-network discovery module as a signed task and rejects non-allowlisted requests", async () => {
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
          email: uniqueEmail("runner-discover-owner"),
          name: "Runner Discover Owner",
          password: "periscan-runner-discover-password",
          tenantName: "Runner Discover Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(signup.statusCode).toBe(201);
      const cookie = getSessionCookie(signup);

      const tokenResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          deploymentMode: "Docker",
          expiresInSeconds: 3600,
          labels: ["discover-acceptance"],
          runnerName: "discover-acceptance-runner"
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
          hostname: "discover-acceptance-runner",
          labels: ["discover-acceptance"],
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
          runnerName: "discover-acceptance-runner",
          version: "0.1.0"
        },
        url: "/api/v1/runners/register"
      });
      expect(registerResponse.statusCode).toBe(201);
      const runnerId = registerResponse.json().credentials.runnerId as string;

      // An internal-network scope authorizes in-network discovery.
      const scopeResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { scopeType: "InternalNetwork", value: "corp-lan" },
        url: "/api/v1/scopes"
      });
      expect(scopeResponse.statusCode).toBe(201);
      const scopeId = scopeResponse.json().scopeId as string;

      const verify = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });
      expect(verify.statusCode).toBe(200);

      const createDiscover = (payload: Record<string, unknown>) =>
        app.inject({
          cookies: authCookies(cookie),
          method: "POST",
          payload,
          url: `/api/v1/runners/${runnerId}/tasks/discover`
        });

      // Host discovery → a signed task carrying recon.host_discovery + targets.
      const hostDiscovery = await createDiscover({
        moduleId: "recon.host_discovery",
        scopeId,
        target: "10.0.0.0/24"
      });
      expect(hostDiscovery.statusCode).toBe(201);
      const hostBody = hostDiscovery.json();
      expect(hostBody.envelope.moduleId).toBe("recon.host_discovery");
      expect(hostBody.envelope.executionEnvironment).toBe("InternalRunner");
      expect(hostBody.envelope.signature.algorithm).toBeTruthy();
      expect(hostBody.envelope.target.targets).toBe("10.0.0.0/24");
      expect(hostBody.run.moduleId).toBe("recon.host_discovery");

      // Service inventory → carries targetHost + topPorts.
      const serviceInventory = await createDiscover({
        moduleId: "recon.service_inventory",
        scopeId,
        target: "db-01.corp-lan",
        topPorts: 100
      });
      expect(serviceInventory.statusCode).toBe(201);
      const serviceBody = serviceInventory.json();
      expect(serviceBody.envelope.moduleId).toBe("recon.service_inventory");
      expect(serviceBody.envelope.target.targetHost).toBe("db-01.corp-lan");
      expect(serviceBody.envelope.target.topPorts).toBe(100);

      // A non-allowlisted / offensive module is rejected by schema.
      const offensive = await createDiscover({
        moduleId: "exploit.metasploit_check",
        scopeId,
        target: "10.0.0.0/24"
      });
      expect(offensive.statusCode).toBe(400);

      // A measured (control-plane) module is not a discovery module.
      const measured = await createDiscover({
        moduleId: "periscan.tls_protocol_audit",
        scopeId,
        target: "10.0.0.0/24"
      });
      expect(measured.statusCode).toBe(400);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});

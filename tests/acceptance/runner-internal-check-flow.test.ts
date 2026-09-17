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

describe("Runner internal-check task acceptance workflow", () => {
  it("dispatches scope-verified DNS/TLS/HTTP signed tasks and rejects out-of-scope targets", async () => {
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
          email: uniqueEmail("runner-check-owner"),
          name: "Runner Check Owner",
          password: "periscan-runner-check-password",
          tenantName: "Runner Check Tenant"
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
          labels: ["check-acceptance"],
          runnerName: "check-acceptance-runner"
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
          hostname: "check-acceptance-runner",
          labels: ["check-acceptance"],
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
          runnerName: "check-acceptance-runner",
          version: "0.1.0"
        },
        url: "/api/v1/runners/register"
      });
      expect(registerResponse.statusCode).toBe(201);
      const runnerId = registerResponse.json().credentials.runnerId as string;

      const scopeResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { scopeType: "Domain", value: "corp.internal" },
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

      const createCheck = (payload: Record<string, unknown>) =>
        app.inject({
          cookies: authCookies(cookie),
          method: "POST",
          payload,
          url: `/api/v1/runners/${runnerId}/tasks/check`
        });

      // TLS certificate check — signed task targets the right module + port.
      const tls = await createCheck({
        module: "runner.tls_certificate_check",
        port: 443,
        scopeId,
        targetHost: "gateway-01.corp.internal"
      });
      expect(tls.statusCode).toBe(201);
      const tlsBody = tls.json();
      expect(tlsBody.envelope.moduleId).toBe("runner.tls_certificate_check");
      expect(tlsBody.envelope.executionEnvironment).toBe("InternalRunner");
      expect(tlsBody.envelope.signature.algorithm).toBeTruthy();
      expect(tlsBody.envelope.inputs.port).toBe(443);
      expect(tlsBody.task.taskType).toBe("tls_certificate");
      expect(tlsBody.run.moduleId).toBe("runner.tls_certificate_check");

      // HTTP health check — carries scheme/path inputs.
      const http = await createCheck({
        module: "runner.http_health_check",
        path: "/healthz",
        port: 8443,
        scheme: "https",
        scopeId,
        targetHost: "api-01.corp.internal"
      });
      expect(http.statusCode).toBe(201);
      const httpBody = http.json();
      expect(httpBody.envelope.moduleId).toBe("runner.http_health_check");
      expect(httpBody.envelope.inputs.path).toBe("/healthz");
      expect(httpBody.envelope.inputs.scheme).toBe("https");
      expect(httpBody.task.taskType).toBe("http_health");

      // DNS resolution check — no port required.
      const dns = await createCheck({
        module: "runner.dns_resolution_check",
        scopeId,
        targetHost: "db-01.corp.internal"
      });
      expect(dns.statusCode).toBe(201);
      expect(dns.json().task.taskType).toBe("dns_resolution");
      // DNS scope constraints carry no approved ports.
      expect(dns.json().envelope.scopeConstraints.approvedPorts).toEqual([]);

      // Out-of-scope target is rejected before any task is signed.
      const denied = await createCheck({
        module: "runner.tls_certificate_check",
        port: 443,
        scopeId,
        targetHost: "evil.example.com"
      });
      expect(denied.statusCode).toBe(400);
      expect(denied.json().code).toBe("runner_scope_violation");

      // TLS/HTTP without a port fail schema validation (port required).
      const missingPort = await createCheck({
        module: "runner.tls_certificate_check",
        scopeId,
        targetHost: "gateway-01.corp.internal"
      });
      expect(missingPort.statusCode).toBe(400);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});

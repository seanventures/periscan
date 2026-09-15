import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import {
  decryptIntegrationConfig,
  integrationSecretFieldKeys
} from "../../apps/api/src/integration-credentials.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { getConnectorByKey } from "../../packages/connectors/src/index.js";
import { createPrismaClient } from "../../packages/db/src/client.js";

const SESSION_COOKIE_NAME = "periscan_session";

// A distinctive plaintext secret so a substring scan over any response body or
// stored row would catch a leak unambiguously.
const FALCON_CLIENT_SECRET = `falcon-secret-${randomUUID()}`;
const FALCON_CLIENT_ID = "falcon-client-id";

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

describe("Integration credential encryption acceptance workflow", () => {
  it("stores connector secrets as ciphertext at rest, never returns them, and round-trips on read", async () => {
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
          email: uniqueEmail("cred-owner"),
          name: "Cred Owner",
          password: "periscan-cred-password",
          tenantName: "Cred Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(signup.statusCode).toBe(201);
      const cookie = getSessionCookie(signup);
      const tenantId = signup.json().tenant.tenantId as string;

      // Connect a CrowdStrike Falcon integration with a real OAuth2 client
      // secret. clientSecret is the manifest's only secret:true field;
      // clientId/baseUrl are non-secret and must stay readable.
      const created = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          authType: "oauth2ClientCredentials",
          config: {
            baseUrl: "https://api.crowdstrike.test",
            clientId: FALCON_CLIENT_ID,
            clientSecret: FALCON_CLIENT_SECRET
          },
          connectorKey: "crowdstrike"
        },
        url: "/api/v1/integrations"
      });
      expect(created.statusCode).toBe(201);
      const integrationId = created.json().integrationId as string;

      // (1) The create response never echoes the plaintext secret: the secret
      // field is redacted, the non-secret fields remain visible.
      const createdConfig = created.json().config as Record<string, unknown>;
      expect(createdConfig.clientSecret).toBe("[redacted]");
      expect(createdConfig.clientId).toBe(FALCON_CLIENT_ID);
      expect(createdConfig.baseUrl).toBe("https://api.crowdstrike.test");
      expect(created.body).not.toContain(FALCON_CLIENT_SECRET);

      // (2) At rest, the raw DB row stores ciphertext for the secret field —
      // not the plaintext — while the non-secret field stays in cleartext.
      const stored = await prisma.integration.findFirstOrThrow({
        where: { integrationId, tenantId }
      });
      const storedConfig = stored.config as Record<string, unknown>;
      expect(typeof storedConfig.clientSecret).toBe("string");
      expect(storedConfig.clientSecret).not.toBe(FALCON_CLIENT_SECRET);
      expect((storedConfig.clientSecret as string).startsWith("v1.")).toBe(
        true
      );
      expect(storedConfig.clientId).toBe(FALCON_CLIENT_ID);
      expect(JSON.stringify(storedConfig)).not.toContain(FALCON_CLIENT_SECRET);

      // (3) Reading the integration back through the API never returns the
      // secret value either (redaction is authoritative on read).
      const fetched = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: `/api/v1/integrations/${integrationId}`
      });
      expect(fetched.statusCode).toBe(200);
      const fetchedConfig = fetched.json().config as Record<string, unknown>;
      expect(fetchedConfig.clientSecret).toBe("[redacted]");
      expect(fetchedConfig.clientId).toBe(FALCON_CLIENT_ID);
      expect(fetched.body).not.toContain(FALCON_CLIENT_SECRET);

      // (4) The ciphertext genuinely round-trips: decrypting the stored config
      // the same way the runtime connector-context builders do recovers the
      // original plaintext, so health/sync still work end-to-end.
      const connector = getConnectorByKey("crowdstrike");
      expect(connector).not.toBeNull();
      const decrypted = decryptIntegrationConfig(
        storedConfig,
        integrationSecretFieldKeys(connector!, "oauth2ClientCredentials")
      );
      expect(decrypted.clientSecret).toBe(FALCON_CLIENT_SECRET);
      expect(decrypted.clientId).toBe(FALCON_CLIENT_ID);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});

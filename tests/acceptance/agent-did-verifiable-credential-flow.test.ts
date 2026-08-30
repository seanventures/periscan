import {
  createHash,
  generateKeyPairSync,
  sign,
  type KeyObject
} from "node:crypto";
import { createServer, type Server } from "node:http";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { signableAgentReceipt } from "../../apps/api/src/services/agent-trust.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import type { VerifyAgentSignedReceiptInput } from "../../packages/shared/src/index.js";
import * as testHelpers from "./helpers.js";

const SESSION_COOKIE_NAME = "periscan_session";

async function listen(server: Server) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  return address.port;
}

function signEs256Jwt(
  payload: Record<string, unknown>,
  privateKey: KeyObject,
  kid: string
) {
  const header = Buffer.from(
    JSON.stringify({ alg: "ES256", kid, typ: "vc+jwt" })
  ).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url"
  );
  const signable = `${header}.${encodedPayload}`;
  const signature = sign("sha256", Buffer.from(signable), {
    dsaEncoding: "ieee-p1363",
    key: privateKey
  }).toString("base64url");
  return `${signable}.${signature}`;
}

describe("AgentDID verifiable credential delegation", () => {
  let prisma: ReturnType<typeof createPrismaClient>;
  let protocolServer: Server | undefined;

  afterEach(async () => {
    if (protocolServer) {
      await new Promise<void>((resolve, reject) =>
        protocolServer?.close((error) => (error ? reject(error) : resolve()))
      );
      protocolServer = undefined;
    }
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, ["trust-did"]);
      await prisma.$disconnect();
    }
  });

  it("binds W3C VC delegation to an A2A receipt and revokes it on DID key rotation", async () => {
    const issuerKeys = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const rotatedIssuerKeys = generateKeyPairSync("ec", {
      namedCurve: "P-256"
    });
    const receiptKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
    let useRotatedIssuerKey = false;
    let protocolPort = 0;
    const issuerDid = () => `did:web:127.0.0.1%3A${protocolPort}:issuer`;
    const subjectDid = () => `did:web:127.0.0.1%3A${protocolPort}:agent`;
    const issuerKid = () => `${issuerDid()}#delegation-key`;

    protocolServer = createServer(async (request, response) => {
      if (
        request.method === "GET" &&
        request.url === "/.well-known/agent-card.json"
      ) {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            capabilities: { pushNotifications: false, streaming: false },
            defaultInputModes: ["application/json"],
            defaultOutputModes: ["application/json"],
            description: "Returns a normalized proof summary.",
            name: "Credential-bound proof agent",
            skills: [
              {
                description: "Read a normalized proof summary.",
                id: "read-proof-summary",
                name: "Read proof summary",
                tags: ["security", "evidence"]
              }
            ],
            supportedInterfaces: [
              {
                protocolBinding: "HTTP+JSON",
                protocolVersion: "1.0",
                url: `http://127.0.0.1:${protocolPort}/a2a/v1`
              }
            ],
            version: "1.0.0"
          })
        );
        return;
      }
      if (request.method === "GET" && request.url === "/issuer/did.json") {
        const publicKeyJwk = (
          useRotatedIssuerKey
            ? rotatedIssuerKeys.publicKey
            : issuerKeys.publicKey
        ).export({ format: "jwk" });
        response.writeHead(200, { "content-type": "application/did+json" });
        response.end(
          JSON.stringify({
            "@context": ["https://www.w3.org/ns/did/v1"],
            assertionMethod: [issuerKid()],
            id: issuerDid(),
            verificationMethod: [
              {
                controller: issuerDid(),
                id: issuerKid(),
                publicKeyJwk,
                type: "JsonWebKey"
              }
            ]
          })
        );
        return;
      }
      if (request.method === "GET" && request.url === "/agent/did.json") {
        response.writeHead(200, { "content-type": "application/did+json" });
        response.end(
          JSON.stringify({
            "@context": ["https://www.w3.org/ns/did/v1"],
            assertionMethod: [],
            id: subjectDid(),
            verificationMethod: []
          })
        );
        return;
      }
      response.writeHead(404).end();
    });
    protocolPort = await listen(protocolServer);

    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        prisma
      })
    });

    try {
      const owner = await testHelpers.performSignup(
        app,
        "trust-did",
        "AgentDID Trust Tenant"
      );
      const cookies = { [SESSION_COOKIE_NAME]: owner.cookie };
      const tenantId = owner.response.json().tenant.tenantId as string;
      const scope = await app.inject({
        cookies,
        method: "POST",
        payload: { scopeType: "Domain", value: "127.0.0.1" },
        url: "/api/v1/scopes"
      });
      const scopeId = scope.json().scopeId as string;
      expect(scope.statusCode).toBe(201);
      expect(
        (
          await app.inject({
            cookies,
            method: "POST",
            payload: { devModeManual: true },
            url: `/api/v1/scopes/${scopeId}/verify`
          })
        ).statusCode
      ).toBe(200);

      const registered = await app.inject({
        cookies,
        method: "POST",
        payload: {
          endpointUrl: `http://127.0.0.1:${protocolPort}/.well-known/agent-card.json`,
          name: "Credential-bound A2A agent",
          protocol: "A2A",
          publicKeyPem: receiptKeys.publicKey.export({
            format: "pem",
            type: "spki"
          }),
          trustPolicy: {
            allowedAudience: "periscan-agent-gateway",
            maxCredentialTtlSeconds: 300,
            requireAgentDidCredential: true,
            requireSignedArtifacts: true,
            requireSpiffeIdentity: true
          }
        },
        url: "/api/v1/agent-trust/endpoints"
      });
      expect(registered.statusCode).toBe(201);
      const endpointId = registered.json().agentProtocolEndpointId as string;
      expect(
        (
          await app.inject({
            cookies,
            method: "POST",
            payload: {
              allowedCapabilityNames: [],
              reason: "Customer reviewed endpoint ownership and transport.",
              status: "Approved"
            },
            url: `/api/v1/agent-trust/endpoints/${endpointId}/review`
          })
        ).statusCode
      ).toBe(200);
      expect(
        (
          await app.inject({
            cookies,
            method: "POST",
            url: `/api/v1/agent-trust/endpoints/${endpointId}/discover`
          })
        ).statusCode
      ).toBe(200);
      expect(
        (
          await app.inject({
            cookies,
            method: "POST",
            payload: {
              allowedCapabilityNames: ["read-proof-summary"],
              reason: "Only the reviewed proof summary skill is allowed.",
              status: "Approved"
            },
            url: `/api/v1/agent-trust/endpoints/${endpointId}/review`
          })
        ).statusCode
      ).toBe(200);

      const profileResponse = await app.inject({
        cookies,
        method: "POST",
        payload: {
          agentProtocolEndpointId: endpointId,
          allowedCredentialTypes: ["AgentDelegationCredential"],
          authorizationReason:
            "Customer-approved cross-organization agent identity delegation.",
          expectedAudience: "periscan-agent-gateway",
          issuerDid: issuerDid(),
          scopeId,
          subjectDid: subjectDid()
        },
        url: "/api/v1/agent-trust/did/profiles"
      });
      expect(profileResponse.statusCode).toBe(201);
      expect(profileResponse.json()).toMatchObject({
        agentProtocolEndpointId: endpointId,
        issuerDid: issuerDid(),
        status: "Active",
        subjectDid: subjectDid()
      });
      const profileId = profileResponse.json().agentDidTrustProfileId as string;

      const validFrom = new Date(Date.now() - 15_000);
      const validUntil = new Date(validFrom.getTime() + 300_000);
      function issueCredential(capabilities: string[]) {
        const nbf = Math.floor(validFrom.getTime() / 1_000);
        const exp = Math.floor(validUntil.getTime() / 1_000);
        return signEs256Jwt(
          {
            aud: "periscan-agent-gateway",
            exp,
            iss: issuerDid(),
            jti: `urn:uuid:${capabilities.join("-")}-credential`,
            nbf,
            sub: subjectDid(),
            vc: {
              "@context": ["https://www.w3.org/ns/credentials/v2"],
              credentialSubject: {
                allowedCapabilities: capabilities,
                endpointOrigin: `http://127.0.0.1:${protocolPort}`,
                id: subjectDid(),
                workloadId: "spiffe://partner.example/agents/proof-reader"
              },
              id: `urn:uuid:${capabilities.join("-")}-credential`,
              issuer: issuerDid(),
              type: ["VerifiableCredential", "AgentDelegationCredential"],
              validFrom: validFrom.toISOString(),
              validUntil: validUntil.toISOString()
            }
          },
          issuerKeys.privateKey,
          issuerKid()
        );
      }

      const compactCredential = issueCredential(["read-proof-summary"]);
      const verifiedCredentialResponse = await app.inject({
        cookies,
        method: "POST",
        payload: { credentialJwt: compactCredential, profileId },
        url: "/api/v1/agent-trust/did/credentials/verify"
      });
      expect(verifiedCredentialResponse.statusCode).toBe(201);
      expect(verifiedCredentialResponse.json()).toMatchObject({
        allowedCapabilities: ["read-proof-summary"],
        findings: [],
        status: "Verified",
        workloadId: "spiffe://partner.example/agents/proof-reader"
      });
      expect(JSON.stringify(verifiedCredentialResponse.json())).not.toContain(
        compactCredential
      );
      const credentialId = verifiedCredentialResponse.json()
        .agentVerifiableCredentialId as string;
      const credentialRow = await prisma.agentVerifiableCredential.findUnique({
        where: { agentVerifiableCredentialId: credentialId }
      });
      expect(credentialRow).toMatchObject({
        credentialHash: createHash("sha256")
          .update(compactCredential)
          .digest("hex"),
        status: "Verified",
        tenantId
      });

      const deniedReceiptIssuedAt = new Date();
      const deniedUnsigned: Omit<VerifyAgentSignedReceiptInput, "signature"> = {
        agentProtocolEndpointId: endpointId,
        audience: "periscan-agent-gateway",
        evidenceIds: [],
        expiresAt: new Date(
          deniedReceiptIssuedAt.getTime() + 60_000
        ).toISOString(),
        issuedAt: deniedReceiptIssuedAt.toISOString(),
        nonce: "did_receipt_missing_credential_001",
        payloadDigest: "a".repeat(64),
        receiptKind: "Artifact",
        senderWorkloadId: "spiffe://partner.example/agents/proof-reader"
      };
      const deniedReceipt: VerifyAgentSignedReceiptInput = {
        ...deniedUnsigned,
        signature: "placeholder-placeholder-placeholder-placeholder"
      };
      deniedReceipt.signature = sign(
        "sha256",
        signableAgentReceipt(deniedReceipt),
        receiptKeys.privateKey
      ).toString("base64url");
      const missingCredentialReceipt = await app.inject({
        cookies,
        method: "POST",
        payload: deniedReceipt,
        url: "/api/v1/agent-trust/receipts/verify"
      });
      expect(missingCredentialReceipt.statusCode).toBe(201);
      expect(missingCredentialReceipt.json()).toMatchObject({
        agentVerifiableCredentialId: null,
        verificationStatus: "Rejected"
      });

      const receiptIssuedAt = new Date();
      const unsignedReceipt: Omit<VerifyAgentSignedReceiptInput, "signature"> =
        {
          agentProtocolEndpointId: endpointId,
          agentVerifiableCredentialId: credentialId,
          audience: "periscan-agent-gateway",
          evidenceIds: [],
          expiresAt: new Date(receiptIssuedAt.getTime() + 60_000).toISOString(),
          issuedAt: receiptIssuedAt.toISOString(),
          nonce: "did_receipt_bound_credential_001",
          payloadDigest: "b".repeat(64),
          receiptKind: "Artifact",
          senderWorkloadId: "spiffe://partner.example/agents/proof-reader"
        };
      const receipt: VerifyAgentSignedReceiptInput = {
        ...unsignedReceipt,
        signature: "placeholder-placeholder-placeholder-placeholder"
      };
      receipt.signature = sign(
        "sha256",
        signableAgentReceipt(receipt),
        receiptKeys.privateKey
      ).toString("base64url");
      const boundReceipt = await app.inject({
        cookies,
        method: "POST",
        payload: receipt,
        url: "/api/v1/agent-trust/receipts/verify"
      });
      expect(boundReceipt.statusCode).toBe(201);
      expect(boundReceipt.json()).toMatchObject({
        agentVerifiableCredentialId: credentialId,
        verificationStatus: "Verified"
      });

      const excessCredential = await app.inject({
        cookies,
        method: "POST",
        payload: {
          credentialJwt: issueCredential(["delete-all-evidence"]),
          profileId
        },
        url: "/api/v1/agent-trust/did/credentials/verify"
      });
      expect(excessCredential.statusCode).toBe(201);
      expect(excessCredential.json().status).toBe("Rejected");
      expect(excessCredential.json().findings).toContain(
        "Delegated capabilities exceed the endpoint allowlist."
      );

      useRotatedIssuerKey = true;
      const refresh = await app.inject({
        cookies,
        method: "POST",
        payload: {
          reason: "Operator-requested DID document and key rotation check."
        },
        url: `/api/v1/agent-trust/did/profiles/${profileId}/refresh`
      });
      expect(refresh.statusCode).toBe(200);
      const credentials = await app.inject({
        cookies,
        method: "GET",
        url: "/api/v1/agent-trust/did/credentials"
      });
      expect(credentials.statusCode).toBe(200);
      expect(credentials.json().items).toContainEqual(
        expect.objectContaining({
          agentVerifiableCredentialId: credentialId,
          status: "Revoked"
        })
      );

      const revoked = await app.inject({
        cookies,
        method: "POST",
        payload: {
          reason: "Tenant operator ended the partner agent delegation."
        },
        url: `/api/v1/agent-trust/did/profiles/${profileId}/revoke`
      });
      expect(revoked.statusCode).toBe(200);
      expect(revoked.json().status).toBe("Revoked");
    } finally {
      await app.close();
    }
  });
});

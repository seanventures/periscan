import { describe, expect, it } from "vitest";

import {
  CONNECTOR_OAUTH_GRANT_LAW,
  ConnectorOAuthGrantSchema,
  emptyFindingsOnVendorAuthFailure,
  vendorAuthFailureHealthStatus
} from "./connector-oauth-grant";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const CONNECTOR_ID = "22222222-2222-4222-8222-222222222222";
const ENCRYPTED_SECRET = "v1.salt.iv.tag.ciphertext";

function validGrant(overrides: Record<string, unknown> = {}) {
  return {
    clientId: "splunk-app-client-id",
    clientSecretEncrypted: ENCRYPTED_SECRET,
    connectorId: CONNECTOR_ID,
    lastRotatedAt: "2026-09-01T00:00:00.000Z",
    scopes: ["search", "offline_access"],
    tenantId: TENANT_ID,
    tokenUrl: "https://login.microsoftonline.com/contoso/oauth2/v2.0/token",
    ...overrides
  };
}

describe("ConnectorOAuthGrant contract", () => {
  it("declares vendor client_credentials grants, not operator SSO", () => {
    expect(CONNECTOR_OAUTH_GRANT_LAW).toMatch(/client_credentials/i);
    expect(CONNECTOR_OAUTH_GRANT_LAW).toMatch(/not operator SSO/i);
    expect(CONNECTOR_OAUTH_GRANT_LAW).toMatch(/Degraded/i);
    expect(CONNECTOR_OAUTH_GRANT_LAW).not.toMatch(/session cookie/i);
  });

  it("parses tenantId, connectorId, tokenUrl, clientId, encrypted secret, scopes, lastRotatedAt", () => {
    const grant = ConnectorOAuthGrantSchema.parse(validGrant());

    expect(grant).toEqual({
      clientId: "splunk-app-client-id",
      clientSecretEncrypted: ENCRYPTED_SECRET,
      connectorId: CONNECTOR_ID,
      grantType: "client_credentials",
      lastRotatedAt: "2026-09-01T00:00:00.000Z",
      scopes: ["search", "offline_access"],
      tenantId: TENANT_ID,
      tokenUrl: "https://login.microsoftonline.com/contoso/oauth2/v2.0/token"
    });
  });

  it("defaults scopes to empty and allows a null lastRotatedAt", () => {
    const grant = ConnectorOAuthGrantSchema.parse(
      validGrant({ lastRotatedAt: null, scopes: undefined })
    );

    expect(grant.scopes).toEqual([]);
    expect(grant.lastRotatedAt).toBeNull();
  });

  it("rejects missing identity, token endpoint, or encrypted secret", () => {
    expect(() =>
      ConnectorOAuthGrantSchema.parse(validGrant({ tenantId: "not-a-uuid" }))
    ).toThrow();
    expect(() =>
      ConnectorOAuthGrantSchema.parse(validGrant({ tokenUrl: "not-a-url" }))
    ).toThrow();
    expect(() =>
      ConnectorOAuthGrantSchema.parse(validGrant({ clientSecretEncrypted: "" }))
    ).toThrow();
    expect(() =>
      ConnectorOAuthGrantSchema.parse(validGrant({ clientId: "" }))
    ).toThrow();
    expect(() =>
      ConnectorOAuthGrantSchema.parse(validGrant({ connectorId: "" }))
    ).toThrow();
  });

  it("maps vendor 401 and 403 to Degraded, never to invented findings", () => {
    expect(vendorAuthFailureHealthStatus(401)).toBe("Degraded");
    expect(vendorAuthFailureHealthStatus(403)).toBe("Degraded");
    expect(vendorAuthFailureHealthStatus(200)).toBeNull();
    expect(vendorAuthFailureHealthStatus(500)).toBeNull();

    const empty = emptyFindingsOnVendorAuthFailure();
    expect(empty.findings).toEqual([]);
    expect(empty.signals).toEqual([]);
    expect(empty.assets).toEqual([]);
  });

  it("parses Entra certificate grants with thumbprint and no client secret", () => {
    const grant = ConnectorOAuthGrantSchema.parse(
      validGrant({
        certificateThumbprint: "00112233445566778899aabbccddeeff00112233",
        clientSecretEncrypted: undefined,
        grantType: "certificate",
        privateKeyEncrypted: ENCRYPTED_SECRET
      })
    );

    expect(grant.grantType).toBe("certificate");
    expect(grant.certificateThumbprint).toBe(
      "00112233445566778899aabbccddeeff00112233"
    );
    expect(grant.privateKeyEncrypted).toBe(ENCRYPTED_SECRET);
    expect(grant.clientSecretEncrypted).toBeUndefined();
  });

  it("parses Entra federated grants with an encrypted assertion and no client secret", () => {
    const grant = ConnectorOAuthGrantSchema.parse(
      validGrant({
        clientAssertionEncrypted: ENCRYPTED_SECRET,
        clientSecretEncrypted: undefined,
        grantType: "federated"
      })
    );

    expect(grant.grantType).toBe("federated");
    expect(grant.clientAssertionEncrypted).toBe(ENCRYPTED_SECRET);
    expect(grant.clientSecretEncrypted).toBeUndefined();
  });

  it("rejects certificate grants without a thumbprint and federated grants without an assertion", () => {
    expect(() =>
      ConnectorOAuthGrantSchema.parse(
        validGrant({
          clientSecretEncrypted: undefined,
          grantType: "certificate",
          privateKeyEncrypted: ENCRYPTED_SECRET
        })
      )
    ).toThrow();
    expect(() =>
      ConnectorOAuthGrantSchema.parse(
        validGrant({
          certificateThumbprint: "00112233445566778899aabbccddeeff00112233",
          clientSecretEncrypted: undefined,
          grantType: "certificate"
        })
      )
    ).toThrow();
    expect(() =>
      ConnectorOAuthGrantSchema.parse(
        validGrant({
          clientSecretEncrypted: undefined,
          grantType: "federated"
        })
      )
    ).toThrow();
  });

  it("keeps client_credentials as the default grant type", () => {
    const grant = ConnectorOAuthGrantSchema.parse(validGrant());

    expect(grant.grantType).toBe("client_credentials");
    expect(grant.clientSecretEncrypted).toBe(ENCRYPTED_SECRET);
  });
});

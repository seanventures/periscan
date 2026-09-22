import { z } from "zod";

/**
 * Connector-to-vendor OAuth2 grant (Fortune 1000 SIEM/EDR/IdP).
 *
 * This is how Periscan authenticates TO Splunk, Elastic, CrowdStrike, Sentinel,
 * Okta, and Entra to pull logs. It is not operator SSO / session auth.
 *
 * Entra F1000 path: certificate (thumbprint + private key) or federated
 * (workload-identity assertion) in addition to client_credentials secret.
 */

export const CONNECTOR_OAUTH_GRANT_LAW =
  "Periscan authenticates TO SIEM/EDR/IdP with OAuth2 client_credentials, certificate, or federated credentials / OIDC app registration. This is not operator SSO. Vendor 401/403 is Degraded health with zero invented findings. Access tokens, client secrets, private keys, thumbprints, and assertions never appear in logs.";

export const ConnectorOAuthGrantTypeSchema = z.enum([
  "client_credentials",
  "certificate",
  "federated"
]);

export const ConnectorOAuthGrantSchema = z
  .object({
    certificateThumbprint: z.string().min(1).optional(),
    clientAssertionEncrypted: z.string().min(1).optional(),
    clientId: z.string().min(1),
    clientSecretEncrypted: z.string().min(1).optional(),
    connectorId: z.string().min(1),
    grantType: ConnectorOAuthGrantTypeSchema.default("client_credentials"),
    lastRotatedAt: z.string().datetime().nullable(),
    privateKeyEncrypted: z.string().min(1).optional(),
    scopes: z.array(z.string().min(1)).default([]),
    tenantId: z.string().uuid(),
    tokenUrl: z.url()
  })
  .superRefine((grant, ctx) => {
    if (
      grant.grantType === "client_credentials" &&
      !grant.clientSecretEncrypted
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "clientSecretEncrypted is required for client_credentials grants",
        path: ["clientSecretEncrypted"]
      });
    }

    if (grant.grantType === "certificate") {
      if (!grant.certificateThumbprint) {
        ctx.addIssue({
          code: "custom",
          message: "certificateThumbprint is required for certificate grants",
          path: ["certificateThumbprint"]
        });
      }
      if (!grant.privateKeyEncrypted) {
        ctx.addIssue({
          code: "custom",
          message: "privateKeyEncrypted is required for certificate grants",
          path: ["privateKeyEncrypted"]
        });
      }
    }

    if (
      grant.grantType === "federated" &&
      !grant.clientAssertionEncrypted
    ) {
      ctx.addIssue({
        code: "custom",
        message: "clientAssertionEncrypted is required for federated grants",
        path: ["clientAssertionEncrypted"]
      });
    }
  });

export type ConnectorOAuthGrantType = z.infer<
  typeof ConnectorOAuthGrantTypeSchema
>;
export type ConnectorOAuthGrant = z.infer<typeof ConnectorOAuthGrantSchema>;

export function vendorAuthFailureHealthStatus(
  status: number
): "Degraded" | null {
  if (status === 401 || status === 403) {
    return "Degraded";
  }

  return null;
}

export function emptyFindingsOnVendorAuthFailure(): {
  assets: [];
  findings: [];
  signals: [];
} {
  return {
    assets: [],
    findings: [],
    signals: []
  };
}

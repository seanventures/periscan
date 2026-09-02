/**
 * Minimal signed SAML 2.0 IdP fixture for acceptance tests.
 *
 * Produces a self-signed IdP certificate + Response that satisfies Periscan's
 * node-saml verifier (response + assertion signed, InResponseTo validated).
 * Used only in tests — never shipped as a product IdP.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";
import { randomUUID } from "node:crypto";

const apiRequire = createRequire(
  join(process.cwd(), "apps/api/package.json")
);
const nodeSamlEntry = apiRequire.resolve("@node-saml/node-saml");
const nestedRequire = createRequire(nodeSamlEntry);
// xml-crypto is a transitive dependency of @node-saml/node-saml (not a direct dep).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SignedXml } = nestedRequire("xml-crypto") as {
  SignedXml: new (options: {
    privateKey: string;
    publicCert: string;
  }) => {
    signatureAlgorithm: string;
    canonicalizationAlgorithm: string;
    addReference: (ref: {
      xpath: string;
      transforms: string[];
      digestAlgorithm: string;
      uri: string;
    }) => void;
    computeSignature: (
      xml: string,
      options: {
        location: { reference: string; action: string };
        prefix: string;
      }
    ) => void;
    getSignedXml: () => string;
  };
};

export type SamlIdpFixture = {
  certPem: string;
  privateKeyPem: string;
  /** Build a base64 SAMLResponse for ACS POST. */
  buildSignedResponseBase64: (input: {
    acsUrl: string;
    email: string;
    idpIssuer: string;
    inResponseTo: string;
    spEntityId: string;
  }) => string;
};

export function createSamlIdpFixture(): SamlIdpFixture {
  const dir = mkdtempSync(join(tmpdir(), "periscan-saml-idp-"));
  try {
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-keyout",
        "key.pem",
        "-out",
        "cert.pem",
        "-days",
        "1",
        "-nodes",
        "-subj",
        "/CN=periscan-acceptance-idp"
      ],
      { cwd: dir, stdio: "pipe" }
    );
    const privateKeyPem = readFileSync(join(dir, "key.pem"), "utf8");
    const certPem = readFileSync(join(dir, "cert.pem"), "utf8");

    return {
      certPem,
      privateKeyPem,
      buildSignedResponseBase64(input) {
        const responseId = `_${randomUUID().replace(/-/gu, "")}`;
        const assertionId = `_${randomUUID().replace(/-/gu, "")}`;
        const now = new Date();
        const earlier = new Date(now.getTime() - 60_000);
        const later = new Date(now.getTime() + 5 * 60_000);
        const issueInstant = now.toISOString();
        const notBefore = earlier.toISOString();
        const notOnOrAfter = later.toISOString();

        const assertion = `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" Version="2.0" ID="${assertionId}" IssueInstant="${issueInstant}">
  <saml:Issuer>${escapeXml(input.idpIssuer)}</saml:Issuer>
  <saml:Subject>
    <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${escapeXml(input.email)}</saml:NameID>
    <saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">
      <saml:SubjectConfirmationData NotOnOrAfter="${notOnOrAfter}" Recipient="${escapeXml(input.acsUrl)}" InResponseTo="${escapeXml(input.inResponseTo)}"/>
    </saml:SubjectConfirmation>
  </saml:Subject>
  <saml:Conditions NotBefore="${notBefore}" NotOnOrAfter="${notOnOrAfter}">
    <saml:AudienceRestriction>
      <saml:Audience>${escapeXml(input.spEntityId)}</saml:Audience>
    </saml:AudienceRestriction>
  </saml:Conditions>
  <saml:AuthnStatement AuthnInstant="${issueInstant}" SessionIndex="${assertionId}">
    <saml:AuthnContext>
      <saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef>
    </saml:AuthnContext>
  </saml:AuthnStatement>
  <saml:AttributeStatement>
    <saml:Attribute Name="email" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic">
      <saml:AttributeValue>${escapeXml(input.email)}</saml:AttributeValue>
    </saml:Attribute>
  </saml:AttributeStatement>
</saml:Assertion>`;

        const signedAssertion = signSamlElement({
          certPem,
          elementLocalName: "Assertion",
          id: assertionId,
          privateKeyPem,
          xml: assertion
        });

        const response = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="${responseId}" Version="2.0" IssueInstant="${issueInstant}" Destination="${escapeXml(input.acsUrl)}" InResponseTo="${escapeXml(input.inResponseTo)}">
  <saml:Issuer>${escapeXml(input.idpIssuer)}</saml:Issuer>
  <samlp:Status>
    <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>
  </samlp:Status>
  ${signedAssertion}
</samlp:Response>`;

        const signedResponse = signSamlElement({
          certPem,
          elementLocalName: "Response",
          id: responseId,
          privateKeyPem,
          xml: response
        });

        return Buffer.from(signedResponse, "utf8").toString("base64");
      }
    };
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
}

function signSamlElement(input: {
  certPem: string;
  elementLocalName: string;
  id: string;
  privateKeyPem: string;
  xml: string;
}): string {
  const sig = new SignedXml({
    privateKey: input.privateKeyPem,
    publicCert: input.certPem
  });
  sig.signatureAlgorithm =
    "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
  sig.canonicalizationAlgorithm = "http://www.w3.org/2001/10/xml-exc-c14n#";
  sig.addReference({
    xpath: `//*[local-name(.)='${input.elementLocalName}']`,
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/2001/10/xml-exc-c14n#"
    ],
    digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
    uri: `#${input.id}`
  });
  sig.computeSignature(input.xml, {
    location: {
      reference: `//*[local-name(.)='${input.elementLocalName}']/*[local-name(.)='Issuer']`,
      action: "after"
    },
    prefix: ""
  });
  return sig.getSignedXml();
}

function escapeXml(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&apos;");
}

/**
 * Decode HTTP-Redirect binding SAMLRequest (deflate + base64) and extract ID.
 */
export function extractSamlAuthnRequestId(authorizationUrl: string): string {
  const url = new URL(authorizationUrl);
  const encoded = url.searchParams.get("SAMLRequest");
  if (!encoded) {
    throw new Error("Authorization URL missing SAMLRequest parameter.");
  }
  const inflated = inflateRawSync(Buffer.from(encoded, "base64")).toString(
    "utf8"
  );
  const match = inflated.match(/\bID="([^"]+)"/u);
  if (!match?.[1]) {
    throw new Error("SAML AuthnRequest XML missing ID attribute.");
  }
  return match[1];
}

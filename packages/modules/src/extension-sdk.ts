import { createHash, createPublicKey, verify } from "node:crypto";

import {
  ExtensionScaffoldSchema,
  ExtensionExecutionContractSchema,
  type ExtensionCompatibilityReport,
  type ExtensionExecutionContract,
  type ExtensionProject,
  type ExtensionScaffold
} from "@periscan/shared";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)])
    );
  }
  return value;
}

function unsignedContract(contract: ExtensionExecutionContract) {
  const unsigned = Object.fromEntries(
    Object.entries(contract).filter(([key]) => key !== "signature")
  );
  return Buffer.from(JSON.stringify(canonicalize(unsigned)));
}

export function signableExtensionContract(
  rawContract: Omit<ExtensionExecutionContract, "signature">
) {
  return Buffer.from(JSON.stringify(canonicalize(rawContract)));
}

export function evaluateExtensionCompatibility(
  rawContract: ExtensionExecutionContract,
  options: { now?: Date } = {}
): ExtensionCompatibilityReport {
  const contract = ExtensionExecutionContractSchema.parse(rawContract);
  const payload = unsignedContract(contract);
  const contractDigest = createHash("sha256").update(payload).digest("hex");
  const checks: ExtensionCompatibilityReport["checks"] = [];

  const referenceDigest = contract.imageReference.slice(
    contract.imageReference.lastIndexOf("@") + 1
  );
  checks.push({
    checkId: "immutable-image",
    message:
      referenceDigest === contract.imageDigest
        ? "OCI image reference is pinned to the declared SHA-256 digest."
        : "OCI image reference and declared digest do not match.",
    status: referenceDigest === contract.imageDigest ? "Pass" : "Fail"
  });

  const signatureValid = (() => {
    try {
      return verify(
        "sha256",
        payload,
        createPublicKey(contract.signerPublicKeyPem),
        Buffer.from(contract.signature, "base64url")
      );
    } catch {
      return false;
    }
  })();
  checks.push({
    checkId: "contract-signature",
    message: signatureValid
      ? "Contract signature matches the declared signer public key."
      : "Contract signature could not be verified.",
    status: signatureValid ? "Pass" : "Fail"
  });

  const networkCapability = contract.capabilities.includes(
    "NetworkVerifiedScope"
  );
  const networkBounded = networkCapability
    ? contract.networkAllowlist.length > 0
    : contract.networkAllowlist.length === 0;
  checks.push({
    checkId: "network-capability",
    message: networkBounded
      ? "Network access and allowlist declarations are consistent."
      : "Network access must be capability-declared and explicitly allowlisted.",
    status: networkBounded ? "Pass" : "Fail"
  });

  const outputTyped =
    typeof contract.outputSchema.type === "string" &&
    Object.keys(contract.outputSchema).length >= 2;
  checks.push({
    checkId: "typed-output",
    message: outputTyped
      ? "A bounded JSON output schema is declared."
      : "Output schema must declare a JSON Schema type and constraints.",
    status: outputTyped ? "Pass" : "Fail"
  });

  const redactionDeclared = contract.redactionFields.length > 0;
  checks.push({
    checkId: "redaction-contract",
    message: redactionDeclared
      ? "Output redaction fields are explicitly declared."
      : "At least one output redaction field is required.",
    status: redactionDeclared ? "Pass" : "Fail"
  });

  const resourceBounded =
    contract.cpuLimitMillis <= 4_000 &&
    contract.memoryLimitMb <= 8_192 &&
    contract.timeoutSeconds <= 300 &&
    contract.maxOutputBytes <= 10_000_000;
  checks.push({
    checkId: "resource-envelope",
    message: resourceBounded
      ? "CPU, memory, time, and output limits fit the default review envelope."
      : "Requested resources exceed the default compatibility envelope.",
    status: resourceBounded ? "Pass" : "Fail"
  });

  return {
    arbitraryPythonUploadAllowed: false,
    checks,
    compatible: checks.every((check) => check.status === "Pass"),
    contractDigest,
    executionAuthorized: false,
    generatedAt: (options.now ?? new Date()).toISOString(),
    requiresCatalogAndSecurityReview: true
  };
}

function scaffoldFile(path: string, purpose: string, content: string) {
  return {
    content,
    contentSha256: createHash("sha256").update(content).digest("hex"),
    path,
    purpose
  };
}

export function generateExtensionScaffold(
  project: ExtensionProject,
  options: { now?: Date } = {}
): ExtensionScaffold {
  const contractTemplate = JSON.stringify(
    {
      capabilities: ["ReadEvidence"],
      contractVersion: "1.0",
      cpuLimitMillis: 500,
      imageDigest: "sha256:<replace-with-immutable-image-digest>",
      imageReference: `registry.example/${project.packageName}@sha256:<replace-with-immutable-image-digest>`,
      maxOutputBytes: 1_000_000,
      memoryLimitMb: 512,
      networkAllowlist: [],
      outputSchema: {
        additionalProperties: false,
        properties: { findings: { items: { type: "object" }, type: "array" } },
        required: ["findings"],
        type: "object"
      },
      packageName: project.packageName,
      redactionFields: ["rawResponse", "authorization"],
      signature: "<base64url-signature>",
      signerIdentity: "spiffe://your-organization/extensions/reviewer",
      signerPublicKeyPem: "<public-key-pem>",
      timeoutSeconds: 60
    },
    null,
    2
  );
  const handler = `export interface ExtensionInput {\n  evidenceIds: string[];\n  target: Record<string, unknown>;\n}\n\nexport interface ExtensionOutput {\n  findings: Array<Record<string, unknown>>;\n}\n\n/** Pure adapter entry point. Network and runner access remain contract-gated. */\nexport async function run(input: ExtensionInput): Promise<ExtensionOutput> {\n  void input;\n  return { findings: [] };\n}\n`;
  const test = `import { describe, expect, it } from "vitest";\n\nimport { run } from "./index";\n\ndescribe("${project.packageName}", () => {\n  it("returns typed normalized output without raw scanner data", async () => {\n    await expect(run({ evidenceIds: [], target: {} })).resolves.toEqual({ findings: [] });\n  });\n});\n`;
  const signingScript = `import { createPrivateKey, sign } from "node:crypto";\nimport { readFileSync } from "node:fs";\n\nconst contractPath = process.argv[2];\nconst privateKeyPath = process.env.EXTENSION_SIGNING_KEY_PATH;\nif (!contractPath || !privateKeyPath) throw new Error("Provide a contract path and EXTENSION_SIGNING_KEY_PATH.");\nconst contract = JSON.parse(readFileSync(contractPath, "utf8"));\ndelete contract.signature;\nconst canonicalize = (value) => Array.isArray(value) ? value.map(canonicalize) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonicalize(child)])) : value;\nconst payload = Buffer.from(JSON.stringify(canonicalize(contract)));\ncontract.signature = sign("sha256", payload, createPrivateKey(readFileSync(privateKeyPath, "utf8"))).toString("base64url");\nprocess.stdout.write(JSON.stringify(contract, null, 2) + "\\n");\n`;
  const readme = `# ${project.displayName}\n\n${project.description}\n\nThis scaffold produces a signed, immutable OCI execution contract for Periscan compatibility review. A passing report does not authorize execution. Private signing keys stay outside Periscan.\n\n1. Implement and test the typed adapter.\n2. Build the image and replace both digest placeholders with the same immutable SHA-256 digest.\n3. Export only the public verification key in the contract.\n4. Sign locally with \`EXTENSION_SIGNING_KEY_PATH=/secure/key.pem node scripts/sign-contract.mjs extension.contract.json\`.\n5. Submit the signed contract for compatibility and human security review.\n\nRepository: ${project.repositoryUrl}\nSupport: ${project.supportUrl}\nLicense: ${project.licenseSpdx}\n`;

  return ExtensionScaffoldSchema.parse({
    commands: [
      "pnpm test",
      "docker build --provenance=true -t <registry>/<image>:<version> .",
      "docker inspect --format='{{index .RepoDigests 0}}' <registry>/<image>:<version>",
      "EXTENSION_SIGNING_KEY_PATH=/secure/key.pem node scripts/sign-contract.mjs extension.contract.json"
    ],
    doesNotExecute: true,
    files: [
      scaffoldFile(
        "extension.contract.json",
        "Unsigned contract template with explicit permissions and resource bounds.",
        contractTemplate
      ),
      scaffoldFile(
        "src/index.ts",
        "Typed adapter entry point that returns normalized output.",
        handler
      ),
      scaffoldFile(
        "src/index.test.ts",
        "Starter normalization and anti-fabrication test.",
        test
      ),
      scaffoldFile(
        "scripts/sign-contract.mjs",
        "Local signer that never sends the private key to Periscan.",
        signingScript
      ),
      scaffoldFile("README.md", "Build, signing, and submission guide.", readme)
    ],
    generatedAt: (options.now ?? new Date()).toISOString(),
    packageName: project.packageName,
    safetyNotes: [
      "Arbitrary Python and source uploads are not accepted by the control plane.",
      "Compatibility, certification, and catalog activation do not grant runner execution.",
      "Network and runner capabilities require separate implementation and policy review."
    ],
    scaffoldVersion: "1.0"
  });
}

import { execFile as execFileCallback } from "node:child_process";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { chmod, mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import {
  executeModuleById,
  ModuleExecutionContextSchema,
  type ModuleOutput
} from "../packages/modules/src/index.ts";

const execFile = promisify(execFileCallback);
const COSIGN_IMAGE = "ghcr.io/sigstore/cosign/cosign:v3.0.6";
const COSIGN_PASSWORD = "periscan-local-qualification";

function context(target: Record<string, unknown>, safetyLevel: string) {
  return ModuleExecutionContextSchema.parse({
    inputs: {},
    integrationIds: [],
    missionId: randomUUID(),
    policyDecisionId: randomUUID(),
    runId: randomUUID(),
    runnerId: "local-oss-qualification-runner",
    safetyLevel,
    scopeId: randomUUID(),
    target,
    tenantId: randomUUID()
  });
}

function firstEvidenceAttributes(output: ModuleOutput) {
  return output.evidence[0]?.attributes ?? {};
}

async function runCosign(
  volumeName: string,
  args: string[],
  environment: string[] = []
) {
  await execFile(
    "docker",
    [
      "run",
      "--rm",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges:true",
      "--network",
      "none",
      "--user",
      "0:0",
      "--mount",
      `type=volume,source=${volumeName},target=/work`,
      "--workdir",
      "/work",
      ...environment.flatMap((value) => ["--env", value]),
      COSIGN_IMAGE,
      ...args
    ],
    { maxBuffer: 10 * 1024 * 1024 }
  );
}

async function qualifyCosign(labDirectory: string) {
  const artifactPath = path.join(process.cwd(), "package.json");
  const mismatchedArtifactPath = path.join(
    process.cwd(),
    "pnpm-workspace.yaml"
  );
  const bundlePath = path.join(labDirectory, "artifact.sigstore.json");
  const publicKeyPath = path.join(labDirectory, "cosign.pub");
  const volumeName = `periscan-cosign-qualification-${randomUUID()}`;
  const stagingContainer = `periscan-cosign-stage-${randomUUID()}`;

  await execFile("docker", ["volume", "create", volumeName]);
  try {
    await execFile("docker", [
      "create",
      "--name",
      stagingContainer,
      "--read-only",
      "--network",
      "none",
      "--mount",
      `type=volume,source=${volumeName},target=/work`,
      COSIGN_IMAGE
    ]);
    await execFile("docker", [
      "cp",
      artifactPath,
      `${stagingContainer}:/work/artifact`
    ]);

    await runCosign(
      volumeName,
      ["generate-key-pair"],
      [`COSIGN_PASSWORD=${COSIGN_PASSWORD}`, "COSIGN_TLOG_UPLOAD=false"]
    );
    await runCosign(
      volumeName,
      [
        "sign-blob",
        "--yes",
        "--use-signing-config=false",
        "--new-bundle-format=false",
        "--key",
        "/work/cosign.key",
        "--bundle",
        "/work/artifact.sigstore.json",
        "/work/artifact"
      ],
      [`COSIGN_PASSWORD=${COSIGN_PASSWORD}`, "COSIGN_TLOG_UPLOAD=false"]
    );
    await runCosign(volumeName, [
      "verify-blob",
      "--new-bundle-format=false",
      "--private-infrastructure=true",
      "--bundle",
      "/work/artifact.sigstore.json",
      "--key",
      "/work/cosign.pub",
      "/work/artifact"
    ]);

    await execFile("docker", [
      "cp",
      `${stagingContainer}:/work/artifact.sigstore.json`,
      bundlePath
    ]);
    await execFile("docker", [
      "cp",
      `${stagingContainer}:/work/cosign.pub`,
      publicKeyPath
    ]);
    await Promise.all([chmod(bundlePath, 0o600), chmod(publicKeyPath, 0o600)]);

    const target = { artifactPath, bundlePath, publicKeyPath };
    const verified = await executeModuleById(
      "sigstore.cosign_verify_blob",
      context(target, "PassiveReadOnly")
    );

    const rejected = await executeModuleById(
      "sigstore.cosign_verify_blob",
      context(
        { ...target, artifactPath: mismatchedArtifactPath },
        "PassiveReadOnly"
      )
    );

    if (
      verified.outcome !== "artifact_signature_verified" ||
      rejected.outcome !== "artifact_signature_rejected"
    ) {
      throw new Error(
        `Cosign qualification failed: ${verified.outcome}/${rejected.outcome}`
      );
    }

    return {
      rejected: {
        outcome: rejected.outcome,
        signalCount: rejected.signals.length,
        validationState: rejected.validationState
      },
      verified: {
        artifactSha256: firstEvidenceAttributes(verified).artifactSha256,
        bundleSha256: firstEvidenceAttributes(verified).bundleSha256,
        outcome: verified.outcome,
        publicKeySha256: firstEvidenceAttributes(verified).publicKeySha256,
        validationState: verified.validationState
      }
    };
  } finally {
    await execFile("docker", ["rm", "--force", stagingContainer]).catch(
      () => undefined
    );
    await execFile("docker", ["volume", "rm", "--force", volumeName]).catch(
      () => undefined
    );
  }
}

async function qualifySyft() {
  const repositoryPath = process.cwd();
  const output = await executeModuleById(
    "syft.sbom_generate",
    context(
      {
        repositoryName: "local/periscan",
        repositoryPath
      },
      "PassiveReadOnly"
    )
  );

  if (output.outcome !== "sbom_generated") {
    throw new Error(
      `Syft qualification failed: ${output.outcome} ${output.errors.join("; ")}`
    );
  }

  return {
    componentCount: firstEvidenceAttributes(output).componentCount,
    outcome: output.outcome,
    sbomSha256: firstEvidenceAttributes(output).sbomSha256,
    validationState: output.validationState
  };
}

async function qualifyZap() {
  const server = createServer((_request, response) => {
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "x-content-type-options": "nosniff"
    });
    response.end(
      "<!doctype html><html><title>Periscan ZAP lab</title><body><form><input name='q'></form></body></html>"
    );
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "0.0.0.0", resolve);
  });

  try {
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Could not determine the local ZAP lab port.");
    }

    const output = await executeModuleById(
      "web.zap_baseline",
      context(
        {
          maxDurationMinutes: 2,
          spiderMinutes: 0,
          url: `http://host.docker.internal:${address.port}`
        },
        "ActiveNonInvasive"
      )
    );

    if (!output.outcome.startsWith("zap_")) {
      throw new Error(`ZAP qualification failed: ${output.outcome}`);
    }

    return {
      alertCount: firstEvidenceAttributes(output).alertCount,
      outcome: output.outcome,
      signalCount: output.signals.length,
      validationState: output.validationState
    };
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}

async function main() {
  const qualificationRoot = path.join(
    process.cwd(),
    ".periscan",
    "qualification"
  );
  await mkdir(qualificationRoot, { recursive: true });
  const labDirectory = await mkdtemp(
    path.join(qualificationRoot, "oss-proof-")
  );
  await chmod(labDirectory, 0o777);

  try {
    const [syft, cosign] = await Promise.all([
      qualifySyft(),
      qualifyCosign(labDirectory)
    ]);
    const zap = await qualifyZap();

    console.log(
      JSON.stringify(
        {
          cosign,
          qualifiedAt: new Date().toISOString(),
          syft,
          zap
        },
        null,
        2
      )
    );
  } finally {
    await rm(labDirectory, { force: true, recursive: true });
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

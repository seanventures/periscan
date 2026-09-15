import { access, readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

async function readRepoFile(path: string) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

async function expectRepoPath(path: string) {
  await expect(
    access(new URL(`../../${path}`, import.meta.url))
  ).resolves.toBeUndefined();
}

function sectionBetween(
  source: string,
  startHeader: string,
  endHeader: string
) {
  const start = source.indexOf(startHeader);
  const end = source.indexOf(endHeader, start + startHeader.length);

  if (start === -1 || end === -1) {
    throw new Error(
      `Unable to find section between ${startHeader} and ${endHeader}`
    );
  }

  return source.slice(start, end);
}

function parseJson<T>(source: string): T {
  return JSON.parse(source) as T;
}

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
};

describe("PRD section 5 Recommended Tech Stack coverage", () => {
  it("keeps the section 5 source bullets explicit", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const section = sectionBetween(
      prd,
      "## 5. Recommended Tech Stack",
      "## 6. Data Model"
    );

    for (const requiredSourceText of [
      "apps/",
      "packages/",
      "infra/",
      "Next.js",
      "TypeScript",
      "Tailwind or equivalent design system",
      "React Query or TanStack Query",
      "Zod schemas from shared package",
      "Fastify or NestJS",
      "Prisma",
      "PostgreSQL",
      "Redis + BullMQ for MVP queue",
      "MinIO locally for S3-compatible evidence storage",
      "TypeScript worker process",
      "Go",
      "outbound-only",
      "mTLS",
      "signed tasks",
      "local scope enforcement",
      "S3-compatible object storage",
      "evidence metadata in Postgres",
      "redaction pipeline",
      "Postgres tables for graph nodes and edges"
    ]) {
      expect(section).toContain(requiredSourceText);
    }
  });

  it("maps the monorepo structure to real workspace packages and infra roots", async () => {
    for (const path of [
      "apps/web",
      "apps/api",
      "apps/worker",
      "apps/runner",
      "packages/shared",
      "packages/db",
      "packages/policy",
      "packages/evidence",
      "packages/connectors",
      "packages/modules",
      "packages/reports",
      "packages/risk",
      "packages/operators",
      "infra/docker-compose",
      "infra/terraform",
      "docs/PRD_AUDIT_PROTOCOL.md"
    ]) {
      await expectRepoPath(path);
    }

    const workspace = await readRepoFile("pnpm-workspace.yaml");
    expect(workspace).toContain("apps/*");
    expect(workspace).toContain("packages/*");
  });

  it("maps frontend recommendations to Next.js, TypeScript, Tailwind, TanStack Query, and shared Zod schemas", async () => {
    const webPackage = parseJson<PackageJson>(
      await readRepoFile("apps/web/package.json")
    );
    const layout = await readRepoFile("apps/web/app/layout.tsx");
    const provider = await readRepoFile(
      "apps/web/src/components/query-provider.tsx"
    );
    const sharedPackage = parseJson<PackageJson>(
      await readRepoFile("packages/shared/package.json")
    );
    const appClient = await readRepoFile(
      "apps/web/src/lib/periscan-api-client.ts"
    );

    expect(webPackage.dependencies).toMatchObject({
      "@periscan/shared": "workspace:^",
      "@tanstack/react-query": expect.any(String),
      next: expect.any(String),
      react: expect.any(String),
      "react-dom": expect.any(String),
      zod: expect.any(String)
    });
    expect(webPackage.devDependencies).toMatchObject({
      tailwindcss: expect.any(String)
    });
    expect(webPackage.scripts).toMatchObject({
      build: "next build",
      typecheck: "tsc --noEmit -p tsconfig.json"
    });
    expect(layout).toContain("PeriscanQueryProvider");
    expect(provider).toContain("QueryClientProvider");
    expect(provider).toContain("staleTime");
    expect(sharedPackage.dependencies).toMatchObject({
      zod: expect.any(String)
    });
    expect(appClient).toContain("@periscan/shared");
  });

  it("maps backend, database, queue, worker, evidence, and graph stack choices to implementation", async () => {
    const apiPackage = parseJson<PackageJson>(
      await readRepoFile("apps/api/package.json")
    );
    const workerPackage = parseJson<PackageJson>(
      await readRepoFile("apps/worker/package.json")
    );
    const dbPackage = parseJson<PackageJson>(
      await readRepoFile("packages/db/package.json")
    );
    const compose = await readRepoFile(
      "infra/docker-compose/docker-compose.yml"
    );
    const schema = await readRepoFile("packages/db/prisma/schema.prisma");
    const workerProcessor = await readRepoFile("apps/worker/src/processor.ts");
    const evidenceStorage = await readRepoFile(
      "packages/evidence/src/storage.ts"
    );
    const evidenceGraph = await readRepoFile("packages/evidence/src/graph.ts");
    const riskPackage = await readRepoFile("packages/risk/src/index.ts");

    expect(apiPackage.dependencies).toMatchObject({
      "@prisma/client": expect.any(String),
      bullmq: expect.any(String),
      fastify: expect.any(String),
      zod: expect.any(String)
    });
    expect(workerPackage.dependencies).toMatchObject({
      "@periscan/evidence": "workspace:^",
      "@periscan/modules": "workspace:^",
      bullmq: expect.any(String),
      ioredis: expect.any(String)
    });
    expect(dbPackage.dependencies).toMatchObject({
      "@prisma/client": expect.any(String)
    });
    expect(dbPackage.devDependencies).toMatchObject({
      prisma: expect.any(String)
    });
    expect(compose).toContain("postgres:");
    expect(compose).toContain("redis:");
    expect(compose).toContain("minio:");
    expect(schema).toContain('provider = "postgresql"');
    expect(schema).toContain("model GraphNode");
    expect(schema).toContain("model GraphEdge");
    expect(workerProcessor).toContain("createPrismaEvidenceGraphService");
    expect(workerProcessor).toContain("executeModule");
    expect(evidenceStorage).toContain("@aws-sdk/client-s3");
    expect(evidenceStorage).toContain("sha256");
    expect(evidenceStorage).toContain("redact");
    expect(evidenceGraph).toContain("createPrismaEvidenceGraphService");
    expect(riskPackage).toContain("calculateRiskScore");
  });

  it("maps the runner recommendation to the implemented outbound signed-task mTLS design", async () => {
    const goMod = await readRepoFile("apps/runner/go.mod");
    const runnerReadme = await readRepoFile("apps/runner/README.md");
    const runnerSpec = await readRepoFile("docs/RUNNER_SPEC.md");
    const runnerCode = await readRepoFile("apps/runner/main.go");
    const requirementLedger = await readRepoFile(
      "docs/PRD_REQUIREMENT_LEDGER.md"
    );

    expect(goMod).toContain("go 1.22");
    expect(runnerReadme).toContain("outbound-only");
    expect(runnerReadme).toContain("signed task envelopes");
    expect(runnerReadme).toContain("enforces scope constraints");
    expect(runnerReadme).toContain(
      "mTLS client certificate plus bearer-token authentication over TLS"
    );
    expect(runnerReadme).toContain("PERISCAN_RUNNER_MTLS_CLIENT_CERT_FILE");
    expect(runnerSpec).toContain(
      "Transport authentication is **mTLS client certificate plus bearer token over TLS**"
    );
    expect(runnerCode).toContain("func verifyTask");
    expect(runnerCode).toContain("tls.LoadX509KeyPair");
    expect(runnerCode).toContain("scope");
    expect(requirementLedger).toContain("PRD-RUNNER-003");
    expect(requirementLedger).toContain("Implemented");
  });
});

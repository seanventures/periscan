import { execFileSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const overlayRel = "infra/docker-compose/docker-compose.community.yml";
const depsRel = "infra/docker-compose/docker-compose.community-deps.yml";
const legacyDepsRel = "infra/docker-compose/docker-compose.yml";
const readmeRel = "infra/docker-compose/README.md";

async function readRepoFile(path: string) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

type ComposeService = {
  build?: { context?: string; dockerfile?: string };
  command?: string | string[];
  depends_on?: Record<string, { condition?: string }>;
  environment?: Record<string, string | number | boolean | null> | string[];
  image?: string;
  ports?: Array<{ published?: string | number; target?: number }>;
};

type ComposeConfig = {
  name?: string;
  services?: Record<string, ComposeService>;
  volumes?: Record<string, unknown>;
};

function envMap(service: ComposeService | undefined) {
  const env = service?.environment ?? {};
  if (Array.isArray(env)) {
    return Object.fromEntries(
      env.map((entry) => {
        const separator = entry.indexOf("=");
        if (separator === -1) {
          return [entry, ""];
        }
        return [entry.slice(0, separator), entry.slice(separator + 1)];
      })
    );
  }
  return Object.fromEntries(
    Object.entries(env).map(([key, value]) => [key, String(value ?? "")])
  );
}

function renderMergedCommunityCompose() {
  const raw = execFileSync(
    "docker",
    ["compose", "-f", depsRel, "-f", overlayRel, "config", "--format", "json"],
    { cwd: repoRoot, encoding: "utf8" }
  );
  return JSON.parse(raw) as ComposeConfig;
}

describe("Community local compose overlay", () => {
  it("documents the isolated new-install stack and keeps legacy MinIO available", async () => {
    await expect(
      access(new URL(`../../${overlayRel}`, import.meta.url))
    ).resolves.toBeUndefined();
    await expect(
      access(new URL(`../../${readmeRel}`, import.meta.url))
    ).resolves.toBeUndefined();

    const [overlay, readme, script] = await Promise.all([
      readRepoFile(overlayRel),
      readRepoFile(readmeRel),
      readRepoFile("scripts/community-up.sh")
    ]);

    expect(overlay).toContain("PERISCAN_DEV_MODE");
    expect(overlay).toMatch(/production forbids/iu);
    expect(overlay).not.toMatch(/traefik\.enable/iu);
    expect(overlay).not.toContain(".ts.net");
    expect(overlay).not.toContain("app.periscan.com");
    expect(overlay).not.toMatch(/^ {2}postgres:/mu);
    expect(overlay).not.toMatch(/^ {2}traefik:/mu);

    for (const source of [overlay, readme]) {
      expect(source).toContain(depsRel);
      expect(source).toContain(overlayRel);
    }
    expect(script).toContain("lab_community_deps_compose_file");
    expect(readme).toContain(legacyDepsRel);

    expect(readme).toContain("periscan-community-deps");
    expect(readme).toContain("3001");
    expect(readme).toContain("3000");
    expect(readme).toMatch(/pnpm lab:dev/);
    expect(readme).toContain("compose.yaml");
    expect(readme).toContain("repo root");
    expect(readme).toContain("PERISCAN_DEV_MODE=true");
    expect(readme).toContain("local-only");

    expect(script).toContain("up -d --build --wait");
    expect(script).toContain("DATABASE_URL");
  });

  it("renders api+web+worker against healthy Postgres, Redis, and S3", () => {
    const config = renderMergedCommunityCompose();
    const services = config.services ?? {};

    expect(config.name).toBe("periscan-community-deps");
    expect(Object.keys(services).sort()).toEqual(
      expect.arrayContaining([
        "api",
        "minio",
        "postgres",
        "redis",
        "s3-init",
        "web",
        "worker"
      ])
    );

    const apiEnv = envMap(services.api);
    const workerEnv = envMap(services.worker);
    const webEnv = envMap(services.web);

    expect(apiEnv.DATABASE_URL).toBe(
      "postgresql://periscan:periscan@postgres:5432/periscan"
    );
    expect(workerEnv.DATABASE_URL).toBe(apiEnv.DATABASE_URL);
    expect(apiEnv.REDIS_URL).toBe("redis://redis:6379");
    expect(apiEnv.PERISCAN_DEV_MODE).toBe("true");
    expect(workerEnv.PERISCAN_DEV_MODE).toBe("true");
    expect(apiEnv.PERISCAN_DEPLOYMENT_ENVIRONMENT).not.toBe("production");
    expect(webEnv.PERISCAN_API_URL).toBe("http://api:3001");

    expect(services.api?.build?.dockerfile).toMatch(/apps\/api\/Dockerfile$/u);
    expect(services.web?.build?.dockerfile).toMatch(/apps\/web\/Dockerfile$/u);
    expect(services.worker?.build?.dockerfile).toMatch(
      /scan-executor\.Dockerfile$/u
    );
    expect(services.worker?.build?.target).toBe("runtime");

    expect(services.api?.depends_on?.postgres?.condition).toBe(
      "service_healthy"
    );
    expect(services.api?.depends_on?.redis?.condition).toBe("service_healthy");
    expect(services.api?.depends_on?.["s3-init"]?.condition).toBe("service_completed_successfully");
    expect(services.worker?.depends_on?.postgres?.condition).toBe(
      "service_healthy"
    );
    expect(services.worker?.depends_on?.redis?.condition).toBe(
      "service_healthy"
    );
    expect(services.worker?.depends_on?.["s3-init"]?.condition).toBe("service_completed_successfully");
    expect(services.web?.depends_on?.api).toBeDefined();

    const apiPorts = services.api?.ports ?? [];
    const webPorts = services.web?.ports ?? [];
    expect(apiPorts.some((port) => String(port.published) === "3001")).toBe(
      true
    );
    expect(webPorts.some((port) => String(port.published) === "3000")).toBe(
      true
    );

    const rendered = JSON.stringify(config);
    expect(rendered).not.toMatch(/traefik/iu);
    expect(rendered).not.toContain(".ts.net");
  });

  it("pins pullable SeaweedFS for new data without reusing the legacy MinIO volume", () => {
    const config = renderMergedCommunityCompose();
    const image = config.services?.minio?.image ?? "";

    expect(image).toMatch(/^chrislusf\/seaweedfs:4\.47@sha256:[a-f0-9]{64}$/u);
    expect(config.volumes).toHaveProperty("seaweedfs_data");
    expect(config.volumes).not.toHaveProperty("minio_data");

    const legacyRaw = execFileSync(
      "docker",
      ["compose", "-f", legacyDepsRel, "config", "--format", "json"],
      { cwd: repoRoot, encoding: "utf8" }
    );
    const legacy = JSON.parse(legacyRaw) as ComposeConfig;
    expect(legacy.name).toBe("periscan-deps");
    expect(legacy.services?.minio?.image).toMatch(/^quay\.io\/minio\/minio:RELEASE\./u);
    expect(legacy.volumes).toHaveProperty("minio_data");
    expect(legacy.volumes).not.toHaveProperty("seaweedfs_data");
  });
});

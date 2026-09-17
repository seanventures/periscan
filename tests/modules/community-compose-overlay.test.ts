import { execFileSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const overlayRel = "infra/docker-compose/docker-compose.community.yml";
const depsRel = "infra/docker-compose/docker-compose.yml";
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
  it("keeps a documented overlay next to periscan-deps, not root compose.yaml", async () => {
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

    for (const source of [overlay, readme, script]) {
      expect(source).toContain(depsRel);
      expect(source).toContain(overlayRel);
    }

    expect(readme).toContain("periscan-deps");
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

  it("renders api+web+worker against healthy postgres/redis on the periscan-deps project", () => {
    const config = renderMergedCommunityCompose();
    const services = config.services ?? {};

    expect(config.name).toBe("periscan-deps");
    expect(Object.keys(services).sort()).toEqual(
      expect.arrayContaining([
        "api",
        "minio",
        "postgres",
        "redis",
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
    expect(services.worker?.depends_on?.postgres?.condition).toBe(
      "service_healthy"
    );
    expect(services.worker?.depends_on?.redis?.condition).toBe(
      "service_healthy"
    );
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

  it("pins MinIO from public Quay, not Docker Hub minio/minio (PERISCAN-572)", () => {
    const config = renderMergedCommunityCompose();
    const image = config.services?.minio?.image ?? "";

    expect(image).toMatch(/^quay\.io\/minio\/minio:RELEASE\./u);
    expect(image).not.toMatch(/^minio\/minio:/u);
  });
});
